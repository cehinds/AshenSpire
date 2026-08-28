import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SELF), '..');
const DEFAULT_ROOT = resolve(REPO_ROOT, 'ops/continuity');
const MAX_BYTES = 1024 * 1024;
const SHA256 = /^[A-F0-9]{64}$/;
const PROJECTION_KEYS = ['schemaVersion', 'projectionOnly', 'canonicalPath', 'authoritySource', 'authoritySourceSha256', 'projectionKind', 'ticketId'];
const REQUIRED_PATHS = [
  'authority/roles.yaml', 'authority/permissions.yaml', 'authority/delegations.json', 'authority/owner-directives.jsonl',
  'tickets/AS-HD-20260826-049/contract.yaml', 'tickets/AS-HD-20260826-049/state.json', 'tickets/AS-HD-20260826-049/evidence/INDEX.json', 'tickets/AS-HD-20260826-049/history.jsonl',
  'teams/coordination/state.json', 'teams/coordination/assignments.json',
  'features/AS-HD-20260826-049/dev.json', 'features/AS-HD-20260826-049/test.json', 'features/AS-HD-20260826-049/release.json', 'features/AS-HD-20260826-049/history.jsonl',
  'migrations/archive-inventory.json',
];
const PROJECTION_KINDS = new Map([
  ['tickets/AS-HD-20260826-049/contract.yaml', 'TICKET_CONTRACT'], ['tickets/AS-HD-20260826-049/state.json', 'TICKET_STATE'],
  ['tickets/AS-HD-20260826-049/evidence/INDEX.json', 'TICKET_EVIDENCE_INDEX'], ['tickets/AS-HD-20260826-049/history.jsonl', 'TICKET_HISTORY_INDEX'],
  ['teams/coordination/state.json', 'TEAM_STATE'], ['teams/coordination/assignments.json', 'TEAM_ASSIGNMENTS'],
  ['features/AS-HD-20260826-049/dev.json', 'FEATURE_DEV'], ['features/AS-HD-20260826-049/test.json', 'FEATURE_TEST'],
  ['features/AS-HD-20260826-049/release.json', 'FEATURE_RELEASE'], ['features/AS-HD-20260826-049/history.jsonl', 'FEATURE_HISTORY'],
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmpty = (value) => typeof value === 'string' && value.length > 0;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function relativeIssue(path) {
  if (!isNonEmpty(path) || isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.includes('\\')) return 'must be a repository-relative slash path';
  if (path.split('/').some((part) => !part || part === '.' || part === '..')) return 'empty, dot, and traversal components are forbidden';
  return null;
}

function readBounded(rootPath, refPath) {
  const issue = relativeIssue(refPath); if (issue) throw new Error(`${refPath}: ${issue}`);
  const root = realpathSync(rootPath); let cursor = root;
  for (const segment of refPath.split('/')) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) throw new Error(`${refPath}: does not exist`);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`${refPath}: symbolic links are forbidden`);
  }
  const target = realpathSync(cursor);
  if (!inside(root, target) || !lstatSync(target).isFile()) throw new Error(`${refPath}: must be a regular file inside continuity root`);
  if (lstatSync(target).size > MAX_BYTES) throw new Error(`${refPath}: exceeds ${MAX_BYTES} byte limit`);
  return readFileSync(target);
}

function exact(value, label, keys, findings) {
  if (!isObject(value)) { findings.push(`${label}: expected object`); return false; }
  for (const key of keys) if (!Object.hasOwn(value, key)) findings.push(`${label}: missing required property ${key}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) findings.push(`${label}: additional property ${key} is forbidden`);
  return true;
}

function parseFile(root, path, findings) {
  try {
    const text = readBounded(root, path).toString('utf8');
    return JSON.parse(path.endsWith('.jsonl') ? text.split(/\r?\n/).find(Boolean) : text);
  } catch (error) { findings.push(`${path}: ${error.message}`); return null; }
}

function validateAuthority(root, path, findings) {
  const value = parseFile(root, path, findings); if (!value) return;
  if (path.endsWith('roles.yaml')) {
    if (!exact(value, path, ['schemaVersion', 'roles'], findings)) return;
    if (value.schemaVersion !== 'ashenspire.continuity.authority.roles.v1' || !Array.isArray(value.roles) || value.roles.length !== 4) findings.push(`${path}: exact four-role authority model required`);
  } else if (path.endsWith('permissions.yaml')) {
    if (!exact(value, path, ['schemaVersion', 'oneWriterPerPath', 'localActions', 'separateTransitions', 'hardStops'], findings)) return;
    if (value.schemaVersion !== 'ashenspire.continuity.authority.permissions.v1' || value.oneWriterPerPath !== true || !Array.isArray(value.hardStops) || value.hardStops.length !== 3) findings.push(`${path}: authority permissions contract invalid`);
  } else if (path.endsWith('delegations.json')) {
    const keys = ['schemaVersion', 'ticketId', 'soleWriter', 'branch', 'worktree', 'base', 'reviewers', 'projectionOnlyPaths'];
    if (!exact(value, path, keys, findings)) return;
    if (value.schemaVersion !== 'ashenspire.continuity.authority.delegations.v1' || value.ticketId !== 'AS-HD-20260826-049' || value.soleWriter !== '/root/ticket_dedupe' || !/^[a-f0-9]{40}$/.test(value.base || '')) findings.push(`${path}: delegation identity invalid`);
  } else {
    const keys = ['schemaVersion', 'sequence', 'atUtc', 'ticketId', 'source', 'directive', 'authority'];
    if (!exact(value, path, keys, findings) || value.schemaVersion !== 'ashenspire.continuity.authority.directive.v1' || value.sequence !== 1) findings.push(`${path}: directive record invalid`);
  }
}

function validateProjection(root, path, findings) {
  const value = parseFile(root, path, findings); if (!value || !exact(value, path, PROJECTION_KEYS, findings)) return;
  if (value.schemaVersion !== 'ashenspire.continuity.projection.v1' || value.projectionOnly !== true || value.canonicalPath !== path || value.ticketId !== 'AS-HD-20260826-049' || value.projectionKind !== PROJECTION_KINDS.get(path)) findings.push(`${path}: projection identity invalid`);
  if (!SHA256.test(value.authoritySourceSha256 || '')) findings.push(`${path}.authoritySourceSha256: invalid`);
  try {
    const source = readBounded(root, value.authoritySource);
    if (hash(source) !== value.authoritySourceSha256) findings.push(`${path}.authoritySource: SHA-256 mismatch`);
  } catch (error) { findings.push(`${path}.authoritySource: ${error.message}`); }
}

function validateArchiveInventory(root, findings) {
  const path = 'migrations/archive-inventory.json'; const value = parseFile(root, path, findings);
  const keys = ['schemaVersion', 'historicalNoncurrent', 'cleanup', 'automation'];
  if (!value || !exact(value, path, keys, findings)) return;
  const entry = value.historicalNoncurrent?.[0];
  if (value.schemaVersion !== 'ashenspire.continuity.archive-inventory.v1' || value.historicalNoncurrent?.length !== 1 || entry?.status !== 'HISTORICAL_NONCURRENT' || entry?.supersededBy !== 'AS-HD-20260826-049') findings.push(`${path}: historical/noncurrent inventory invalid`);
  try { if (hash(readBounded(root, entry.path)) !== entry.sha256) findings.push(`${path}: retained historical ticket SHA-256 mismatch`); } catch (error) { findings.push(`${path}: ${error.message}`); }
  if (value.cleanup?.action !== 'RETAIN_IN_PLACE' || value.automation?.currentState !== 'MANUAL_READ_ONLY_RECONCILER' || value.automation?.scheduled !== false || value.automation?.externalAutomation !== 'UNKNOWN') findings.push(`${path}: cleanup or automation state invalid`);
}

export function reconcileCanonicalProjection(rootPath = DEFAULT_ROOT, manifestPath = 'migrations/000001-canonical-layout-projection.json') {
  const root = resolve(rootPath); const findings = [];
  const manifest = parseFile(root, manifestPath, findings);
  const keys = ['schemaVersion', 'id', 'atUtc', 'mode', 'pointerEntry', 'securityFix', 'verificationBoundary', 'files', 'coldStart', 'rollback'];
  if (!manifest || !exact(manifest, 'migration manifest', keys, findings)) return { ok: false, findings, files: 0 };
  if (manifest.schemaVersion !== 'ashenspire.continuity.migration.v1' || manifest.mode !== 'COMPATIBILITY_PROJECTION' || manifest.pointerEntry !== 'POINTER.json' || !isNonEmpty(manifest.securityFix) || !isNonEmpty(manifest.verificationBoundary) || !isNonEmpty(manifest.coldStart) || !isNonEmpty(manifest.rollback)) findings.push('migration manifest: identity, security, verification, coldStart, or rollback invalid');
  if (!Array.isArray(manifest.files) || manifest.files.length !== REQUIRED_PATHS.length) findings.push(`migration manifest: exactly ${REQUIRED_PATHS.length} files required`);
  const paths = [];
  for (const [index, ref] of (manifest.files || []).entries()) {
    if (!exact(ref, `migration manifest.files[${index}]`, ['path', 'sha256'], findings)) continue;
    paths.push(ref.path);
    if (!SHA256.test(ref.sha256 || '')) findings.push(`migration manifest.files[${index}].sha256: invalid`);
    try { const bytes = readBounded(root, ref.path); if (hash(bytes) !== ref.sha256) findings.push(`${ref.path}: SHA-256 mismatch`); } catch (error) { findings.push(`${ref.path}: ${error.message}`); }
  }
  if (JSON.stringify(paths) !== JSON.stringify(REQUIRED_PATHS)) findings.push('migration manifest: required canonical path order/set mismatch');
  for (const path of REQUIRED_PATHS.slice(0, 4)) validateAuthority(root, path, findings);
  for (const path of REQUIRED_PATHS.slice(4, -1)) validateProjection(root, path, findings);
  validateArchiveInventory(root, findings);
  return { ok: findings.length === 0, findings, files: paths.length, mode: manifest.mode };
}

export function reconcileCanonicalProjectionFromPointer(rootPath = DEFAULT_ROOT) {
  const root = resolve(rootPath); const findings = [];
  let pointer;
  try { pointer = JSON.parse(readBounded(root, 'POINTER.json').toString('utf8')); } catch (error) { return { ok: false, findings: [`POINTER.json: ${error.message}`], files: 0 }; }
  const ref = pointer.current?.migration;
  if (!isObject(ref) || !isNonEmpty(ref.path) || !SHA256.test(ref.sha256 || '')) return { ok: false, findings: ['POINTER.json: current.migration path/SHA is required'], files: 0 };
  try { if (hash(readBounded(root, ref.path)) !== ref.sha256) findings.push('POINTER.json current.migration: SHA-256 mismatch'); } catch (error) { findings.push(`POINTER.json current.migration: ${error.message}`); }
  const result = reconcileCanonicalProjection(root, ref.path);
  return { ...result, ok: findings.length === 0 && result.ok, findings: [...findings, ...result.findings] };
}

function copyCurrent(name) {
  const temp = mkdtempSync(join(tmpdir(), `ashenspire-canonical-${name}-`));
  cpSync(DEFAULT_ROOT, temp, { recursive: true });
  return temp;
}

export function runCanonicalProjectionSelfTest() {
  const cases = [];
  const clean = reconcileCanonicalProjectionFromPointer(DEFAULT_ROOT);
  cases.push({ name: 'POINTER-selected migration can cold reconstruct canonical projections without chat or memory', passed: clean.ok && clean.files === 15, detail: clean.findings.join('; ') });
  const plants = [
    ['tampered canonical projection hash is refused', (root) => writeFileSync(join(root, 'features/AS-HD-20260826-049/dev.json'), '{}\n'), /SHA-256 mismatch/],
    ['projection copied authority is refused', (root) => {
      const path = join(root, 'tickets/AS-HD-20260826-049/state.json'); const value = JSON.parse(readFileSync(path, 'utf8')); value.status = 'IN PROGRESS'; writeFileSync(path, `${JSON.stringify(value)}\n`);
    }, /additional property status is forbidden/],
    ['projection authority traversal is refused', (root) => {
      const path = join(root, 'teams/coordination/state.json'); const value = JSON.parse(readFileSync(path, 'utf8')); value.authoritySource = '../../outside'; writeFileSync(path, `${JSON.stringify(value)}\n`);
      const manifestPath = join(root, 'migrations/000001-canonical-layout-projection.json'); const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); const ref = manifest.files.find((item) => item.path === 'teams/coordination/state.json'); ref.sha256 = hash(readFileSync(path)); writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
    }, /traversal components are forbidden/],
    ['missing canonical manifest entry is refused', (root) => {
      const path = join(root, 'migrations/000001-canonical-layout-projection.json'); const value = JSON.parse(readFileSync(path, 'utf8')); value.files.pop(); writeFileSync(path, `${JSON.stringify(value)}\n`);
      const pointerPath = join(root, 'POINTER.json'); const pointer = JSON.parse(readFileSync(pointerPath, 'utf8')); pointer.current.migration.sha256 = hash(readFileSync(path)); writeFileSync(pointerPath, `${JSON.stringify(pointer)}\n`);
    }, /exactly 15 files required/],
  ];
  for (const [name, mutate, expected] of plants) {
    const root = copyCurrent(name.replace(/\W+/g, '-'));
    try { mutate(root); const result = reconcileCanonicalProjectionFromPointer(root); const detail = result.findings.join('; '); cases.push({ name, passed: !result.ok && expected.test(detail), detail }); } finally { rmSync(root, { recursive: true, force: true }); }
  }
  const failed = cases.filter((entry) => !entry.passed);
  return { ok: failed.length === 0, cases, passed: cases.length - failed.length, failed: failed.length };
}
