import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const SELF = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SELF), '..');
const PILOT_ROOT = resolve(REPO_ROOT, 'tests/fixtures/continuity-feature-pilot');
const COMMIT = /^[a-f0-9]{40}$/;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FEATURES = 64;
const EVENTS = new Set(['ENTERED_WORK', 'DEV_CHECKPOINT', 'TEST_PROMOTION', 'TEST_QA', 'RELEASE_PROMOTION', 'TERMINAL_LOCAL_CANDIDATE']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmpty = (value) => typeof value === 'string' && value.length > 0;
const isUtcDate = (value) => isNonEmpty(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const uniqueStrings = (value, min = 0) => Array.isArray(value) && value.length >= min && value.every(isNonEmpty) && new Set(value).size === value.length;

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function relativePathIssue(path) {
  if (!isNonEmpty(path)) return 'must be a non-empty string';
  if (isAbsolute(path) || /^[A-Za-z]:/.test(path)) return 'absolute paths are forbidden';
  if (path.includes('\\')) return 'backslashes are forbidden';
  if (path.split('/').some((part) => part === '' || part === '.' || part === '..')) return 'empty, dot, and traversal segments are forbidden';
  return null;
}

function exact(value, label, keys, findings) {
  if (!isObject(value)) {
    findings.push(`${label}: expected object`);
    return false;
  }
  for (const key of keys) if (!Object.hasOwn(value, key)) findings.push(`${label}: missing required property ${key}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) findings.push(`${label}: additional property ${key} is forbidden`);
  return true;
}

function readBounded(rootPath, refPath) {
  const issue = relativePathIssue(refPath);
  if (issue) throw new Error(`${refPath}: ${issue}`);
  const root = realpathSync(rootPath);
  let cursor = root;
  for (const segment of refPath.split('/')) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) throw new Error(`${refPath}: does not exist`);
    if (lstatSync(cursor).isSymbolicLink()) throw new Error(`${refPath}: symbolic links are forbidden`);
  }
  const target = realpathSync(cursor);
  if (!inside(root, target) || !lstatSync(target).isFile()) throw new Error(`${refPath}: must be a regular file inside feature root`);
  if (lstatSync(target).size > MAX_FILE_BYTES) throw new Error(`${refPath}: exceeds ${MAX_FILE_BYTES} byte limit`);
  return readFileSync(target, 'utf8');
}

function parseJson(root, path, findings) {
  try {
    return JSON.parse(readBounded(root, path));
  } catch (error) {
    findings.push(`${path}: ${error.message}`);
    return null;
  }
}

function validateOwner(owner, label, findings) {
  if (!exact(owner, label, ['role', 'taskId'], findings)) return;
  if (!isNonEmpty(owner.role) || !isNonEmpty(owner.taskId)) findings.push(`${label}: role and taskId are required`);
}

function validateContract(contract, ticketId, findings) {
  const keys = ['schemaVersion', 'ticketId', 'owner', 'immediateEntry', 'refs', 'claims', 'retention', 'promotionRules', 'verification', 'excludedEvidence'];
  if (!exact(contract, 'contract', keys, findings)) return;
  if (contract.schemaVersion !== 'ashenspire.feature.contract.v1') findings.push('contract: unsupported schemaVersion');
  if (contract.ticketId !== ticketId) findings.push('contract: ticketId must equal directory name');
  validateOwner(contract.owner, 'contract.owner', findings);
  const entryKeys = ['directiveSource', 'controllingCurrentWork', 'assignmentTiming', 'assignmentMode', 'temporaryProtocol', 'occupiedSeatProtocol', 'startedRequires', 'preWorkApprovalLoop', 'currentEntry'];
  if (exact(contract.immediateEntry, 'contract.immediateEntry', entryKeys, findings)) {
    if (!isNonEmpty(contract.immediateEntry.directiveSource)) findings.push('contract.immediateEntry: directiveSource is required');
    if (contract.immediateEntry.controllingCurrentWork !== true || contract.immediateEntry.assignmentTiming !== 'SAME_CYCLE') findings.push('contract.immediateEntry: owner directive must control and assign in the same cycle');
    if (!['PERMANENT_OWNER', 'BOUNDED_TEMPORARY_AGENT'].includes(contract.immediateEntry.assignmentMode)) findings.push('contract.immediateEntry: invalid assignmentMode');
    if (!isNonEmpty(contract.immediateEntry.temporaryProtocol) || !isNonEmpty(contract.immediateEntry.occupiedSeatProtocol)) findings.push('contract.immediateEntry: temporary and occupied-seat protocols are required');
    const requiredStarted = ['entered-agent', 'ticket', 'branch-worktree-or-scope', 'first-action', 'next-handoff'];
    if (!uniqueStrings(contract.immediateEntry.startedRequires, 5) || requiredStarted.some((item) => !contract.immediateEntry.startedRequires.includes(item))) findings.push('contract.immediateEntry: STARTED requirements are incomplete');
    if (contract.immediateEntry.preWorkApprovalLoop !== false) findings.push('contract.immediateEntry: pre-work approval loop must be false');
    const currentKeys = ['agentSession', 'branch', 'worktree', 'base', 'firstAction', 'nextHandoff', 'soleWriter'];
    if (exact(contract.immediateEntry.currentEntry, 'contract.immediateEntry.currentEntry', currentKeys, findings)) {
      for (const name of ['agentSession', 'branch', 'worktree', 'firstAction', 'nextHandoff']) if (!isNonEmpty(contract.immediateEntry.currentEntry[name])) findings.push(`contract.immediateEntry.currentEntry.${name}: required`);
      if (!COMMIT.test(contract.immediateEntry.currentEntry.base || '')) findings.push('contract.immediateEntry.currentEntry.base: expected commit');
      if (contract.immediateEntry.currentEntry.soleWriter !== true) findings.push('contract.immediateEntry.currentEntry: soleWriter must be true');
    }
  }
  if (exact(contract.refs, 'contract.refs', ['dev', 'test', 'release'], findings)) {
    for (const channel of ['dev', 'test', 'release']) {
      const expected = `codex/feature/${ticketId}/${channel}`;
      if (contract.refs[channel] !== expected) findings.push(`contract.refs.${channel}: expected ${expected}`);
    }
  }
  if (exact(contract.claims, 'contract.claims', ['exclusivePaths', 'serializedLanes'], findings)) {
    if (!uniqueStrings(contract.claims.exclusivePaths, 1)) findings.push('contract.claims.exclusivePaths: non-empty unique paths required');
    else for (const path of contract.claims.exclusivePaths) {
      const issue = relativePathIssue(path);
      if (issue) findings.push(`contract.claims.exclusivePaths ${path}: ${issue}`);
    }
    if (!uniqueStrings(contract.claims.serializedLanes) || contract.claims.serializedLanes.some((lane) => !['shared-integration', 'generated-artifacts'].includes(lane))) findings.push('contract.claims.serializedLanes: only shared-integration and generated-artifacts are supported');
  }
  const retentionKeys = ['commitPointersOnly', 'copiedTreesForbidden', 'localWorktreeSoleCustodyForbidden', 'cleanupRequiresOriginCommit', 'cleanupRequiresResolvablePointer', 'removeOnlyUnintegratedRemoteRefForbidden'];
  if (exact(contract.retention, 'contract.retention', retentionKeys, findings)) {
    for (const key of retentionKeys) if (contract.retention[key] !== true) findings.push(`contract.retention.${key}: must be true`);
  }
  if (!uniqueStrings(contract.promotionRules, 7)) findings.push('contract.promotionRules: seven distinct rules required');
  const verificationKeys = ['ackDeadlineSeconds', 'completeDeadlineSeconds', 'timeoutResult', 'continueAuthorizedSequence', 'passClaimForbiddenOnTimeout', 'hardStops', 'timeoutRecordRequires'];
  if (exact(contract.verification, 'contract.verification', verificationKeys, findings)) {
    const hardStops = ['SECURITY_FAILURE', 'DESTRUCTIVE_DATA_FAILURE', 'TECHNICAL_BRANCH_PROTECTION_FAILURE'];
    const recordFields = ['startedAtUtc', 'ackAtUtc', 'completedAtUtc', 'attempt', 'testsRun', 'rollback', 'nextVerificationOpportunity'];
    if (contract.verification.ackDeadlineSeconds !== 300 || contract.verification.completeDeadlineSeconds !== 600 || contract.verification.timeoutResult !== 'UNVERIFIED_TIMEOUT' || contract.verification.continueAuthorizedSequence !== true || contract.verification.passClaimForbiddenOnTimeout !== true || JSON.stringify(contract.verification.hardStops) !== JSON.stringify(hardStops) || JSON.stringify(contract.verification.timeoutRecordRequires) !== JSON.stringify(recordFields)) findings.push('contract.verification: exact 5-minute ACK, 10-minute completion, timeout record, and hard-stop policy required');
  }
  if (!uniqueStrings(contract.excludedEvidence, 4)) findings.push('contract.excludedEvidence: four exclusions required');
}

export function verificationDisposition({ startedAtUtc, nowUtc, ackAtUtc = null, completedAtUtc = null, hardFailure = null }) {
  if (![startedAtUtc, nowUtc].every(isUtcDate) || (ackAtUtc !== null && !isUtcDate(ackAtUtc)) || (completedAtUtc !== null && !isUtcDate(completedAtUtc))) throw new Error('verification timestamps must be UTC dates or null');
  const hardStops = ['SECURITY_FAILURE', 'DESTRUCTIVE_DATA_FAILURE', 'TECHNICAL_BRANCH_PROTECTION_FAILURE'];
  if (hardFailure !== null && !hardStops.includes(hardFailure)) throw new Error('unknown hard verification failure');
  if (hardFailure) return { result: 'STOP_EXACT_TRANSITION', hardFailure };
  const elapsed = Math.floor((Date.parse(nowUtc) - Date.parse(startedAtUtc)) / 1000);
  if (completedAtUtc !== null && Date.parse(completedAtUtc) - Date.parse(startedAtUtc) <= 600000) return { result: 'COMPLETED_WITHIN_WINDOW', hardFailure: null };
  if ((ackAtUtc === null && elapsed > 300) || (completedAtUtc === null && elapsed > 600)) return { result: 'UNVERIFIED_TIMEOUT', hardFailure: null };
  return { result: 'PENDING', hardFailure: null };
}

function validateGuard(guard, label, findings) {
  if (guard === null) return;
  if (!exact(guard, label, ['code', 'blocks', 'retryTrigger', 'safeWork'], findings)) return;
  if (!isNonEmpty(guard.code) || !uniqueStrings(guard.blocks, 1) || !isNonEmpty(guard.retryTrigger) || !uniqueStrings(guard.safeWork)) findings.push(`${label}: incomplete exact promotion guard`);
}

function validateCommon(channel, label, ticketId, expectedChannel, findings) {
  if (channel.ticketId !== ticketId) findings.push(`${label}: ticketId mismatch`);
  if (channel.channel !== expectedChannel) findings.push(`${label}: channel must be ${expectedChannel}`);
  const expectedRef = `codex/feature/${ticketId}/${expectedChannel.toLowerCase()}`;
  if (channel.ref !== expectedRef) findings.push(`${label}: ref must be ${expectedRef}`);
  if (!Number.isInteger(channel.revision) || channel.revision < 0) findings.push(`${label}: revision must be integer >= 0`);
  for (const name of ['commit', 'originObservedCommit']) if (channel[name] !== null && !COMMIT.test(channel[name] || '')) findings.push(`${label}.${name}: expected commit or null`);
  if (!['ORIGIN_REF_ABSENT', 'CURRENT', 'STALE'].includes(channel.currentness)) findings.push(`${label}.currentness: unsupported value`);
  validateGuard(channel.guard, `${label}.guard`, findings);
}

function validateOriginState(channel, label, originRefs, findings) {
  if (channel.commit === null) {
    if (channel.revision !== 0 || channel.originObservedCommit !== null || channel.observedAtUtc !== null || channel.currentness !== 'ORIGIN_REF_ABSENT') findings.push(`${label}: empty channel must be revision 0 with absent origin state`);
    if (!channel.guard) findings.push(`${label}: absent origin ref requires an exact guard`);
    return;
  }
  if (channel.revision < 1 || channel.originObservedCommit !== channel.commit || !isUtcDate(channel.observedAtUtc) || channel.currentness !== 'CURRENT') findings.push(`${label}: commit pointer must be current and identically observed on origin`);
  if (originRefs && originRefs[channel.ref] !== channel.commit) findings.push(`${label}: recorded commit is not current on supplied origin ref snapshot`);
}

function validateDev(dev, ticketId, originRefs, findings) {
  const keys = ['schemaVersion', 'ticketId', 'channel', 'ref', 'revision', 'mutable', 'commit', 'originObservedCommit', 'observedAtUtc', 'currentness', 'guard'];
  if (!exact(dev, 'dev', keys, findings)) return;
  if (dev.schemaVersion !== 'ashenspire.feature.dev.v1' || dev.mutable !== true) findings.push('dev: schemaVersion/mutable contract invalid');
  validateCommon(dev, 'dev', ticketId, 'DEV', findings);
  validateOriginState(dev, 'dev', originRefs, findings);
  if (dev.commit !== null && dev.guard !== null) findings.push('dev: current origin-backed checkpoint must not retain a promotion guard');
  if (dev.commit === null && dev.guard?.code !== 'DEV_ORIGIN_REF_ABSENT') findings.push('dev: absent ref requires DEV_ORIGIN_REF_ABSENT guard');
}

function validateQa(qa, test, findings) {
  const keys = ['status', 'testRevision', 'commit', 'atUtc', 'evidence'];
  if (!exact(qa, 'test.qa', keys, findings)) return;
  if (!['NOT_RUN', 'PASS', 'FAIL'].includes(qa.status)) findings.push('test.qa.status: unsupported value');
  if (qa.status === 'NOT_RUN') {
    if ([qa.testRevision, qa.commit, qa.atUtc, qa.evidence].some((value) => value !== null)) findings.push('test.qa: NOT_RUN requires null revision, commit, atUtc, and evidence');
  } else if (qa.testRevision !== test.revision || qa.commit !== test.commit || !isUtcDate(qa.atUtc) || !isNonEmpty(qa.evidence)) findings.push('test.qa: result must bind the exact immutable TEST revision and commit');
}

function validateTest(test, ticketId, originRefs, findings) {
  const keys = ['schemaVersion', 'ticketId', 'channel', 'ref', 'revision', 'immutable', 'commit', 'originObservedCommit', 'observedAtUtc', 'currentness', 'promotedFromDevRevision', 'promotedFromDevCommit', 'qa', 'guard'];
  if (!exact(test, 'test', keys, findings)) return;
  if (test.schemaVersion !== 'ashenspire.feature.test.v1' || test.immutable !== true) findings.push('test: schemaVersion/immutable contract invalid');
  validateCommon(test, 'test', ticketId, 'TEST', findings);
  validateOriginState(test, 'test', originRefs, findings);
  if (test.commit === null) {
    if (test.promotedFromDevRevision !== null || test.promotedFromDevCommit !== null || test.guard?.code !== 'TEST_NO_PROMOTION') findings.push('test: empty channel requires TEST_NO_PROMOTION guard and null source');
  } else if (!Number.isInteger(test.promotedFromDevRevision) || test.promotedFromDevRevision < 1 || test.promotedFromDevCommit !== test.commit) findings.push('test: promotion must copy an identical DEV commit');
  validateQa(test.qa, test, findings);
  if (test.qa?.status === 'PASS' && test.guard !== null) findings.push('test: passed revision must not retain a release guard');
  if (test.qa?.status === 'FAIL' && (test.guard?.code !== 'TEST_QA_FAILED_REVISION' || test.guard?.blocks?.length !== 1 || test.guard.blocks[0] !== 'RELEASE_PROMOTION')) findings.push('test: failed QA must guard only that revision RELEASE promotion');
}

function validateRelease(release, ticketId, originRefs, findings) {
  const keys = ['schemaVersion', 'ticketId', 'channel', 'ref', 'revision', 'immutable', 'commit', 'originObservedCommit', 'observedAtUtc', 'currentness', 'promotedFromTestRevision', 'promotedFromTestCommit', 'guard'];
  if (!exact(release, 'release', keys, findings)) return;
  if (release.schemaVersion !== 'ashenspire.feature.release.v1' || release.immutable !== true) findings.push('release: schemaVersion/immutable contract invalid');
  validateCommon(release, 'release', ticketId, 'RELEASE', findings);
  validateOriginState(release, 'release', originRefs, findings);
  if (release.commit === null) {
    if (release.promotedFromTestRevision !== null || release.promotedFromTestCommit !== null || release.guard?.code !== 'RELEASE_NO_PASSED_TEST') findings.push('release: empty channel requires exact no-passed-TEST guard');
  } else if (!Number.isInteger(release.promotedFromTestRevision) || release.promotedFromTestRevision < 1 || release.promotedFromTestCommit !== release.commit || release.guard !== null) findings.push('release: promotion must copy an identical passed TEST commit without guard');
}

function parseHistory(root, findings) {
  let text;
  try {
    text = readBounded(root, 'history.jsonl');
  } catch (error) {
    findings.push(`history.jsonl: ${error.message}`);
    return [];
  }
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 1 || lines.length > 1024) findings.push('history.jsonl: expected 1-1024 records');
  return lines.map((line, index) => {
    try { return JSON.parse(line); } catch (error) { findings.push(`history.jsonl line ${index + 1}: ${error.message}`); return null; }
  }).filter(Boolean);
}

function validateHistory(records, root, ticketId, dev, test, release, findings) {
  const keys = ['schemaVersion', 'sequence', 'atUtc', 'event', 'ticketId', 'actor', 'devRevision', 'testRevision', 'releaseRevision', 'commit', 'qaResult', 'guardCode', 'evidence', 'detail'];
  for (const [index, record] of records.entries()) {
    const label = `history[${index}]`;
    if (!exact(record, label, keys, findings)) continue;
    if (record.schemaVersion !== 'ashenspire.feature.history.v1' || record.sequence !== index + 1 || !isUtcDate(record.atUtc) || !EVENTS.has(record.event) || record.ticketId !== ticketId || !isNonEmpty(record.actor) || !isNonEmpty(record.detail)) findings.push(`${label}: invalid identity, sequence, timestamp, event, actor, or detail`);
    for (const name of ['devRevision', 'testRevision', 'releaseRevision']) if (!Number.isInteger(record[name]) || record[name] < 0) findings.push(`${label}.${name}: expected integer >= 0`);
    if (record.commit !== null && !COMMIT.test(record.commit || '')) findings.push(`${label}.commit: expected commit or null`);
    if (![null, 'PASS', 'FAIL'].includes(record.qaResult)) findings.push(`${label}.qaResult: expected PASS, FAIL, or null`);
    if (record.event === 'TEST_QA' && !['PASS', 'FAIL'].includes(record.qaResult)) findings.push(`${label}: TEST_QA requires qaResult`);
    if (record.event !== 'TEST_QA' && record.qaResult !== null) findings.push(`${label}: qaResult is only valid for TEST_QA`);
    const evidenceIssue = relativePathIssue(record.evidence);
    if (evidenceIssue) findings.push(`${label}.evidence: ${evidenceIssue}`);
    else try { readBounded(root, record.evidence); } catch (error) { findings.push(`${label}.evidence: ${error.message}`); }
  }
  const devEvents = records.filter((r) => r.event === 'DEV_CHECKPOINT');
  const testEvents = records.filter((r) => r.event === 'TEST_PROMOTION');
  const qaEvents = records.filter((r) => r.event === 'TEST_QA');
  const releaseEvents = records.filter((r) => r.event === 'RELEASE_PROMOTION');
  const uniqueRevision = (events, key, label) => {
    const values = events.map((event) => event[key]);
    if (new Set(values).size !== values.length) findings.push(`history: ${label} revisions must be immutable and unique`);
  };
  uniqueRevision(devEvents, 'devRevision', 'DEV');
  uniqueRevision(testEvents, 'testRevision', 'TEST promotion');
  uniqueRevision(releaseEvents, 'releaseRevision', 'RELEASE promotion');
  for (const event of testEvents) {
    const source = devEvents.find((candidate) => candidate.devRevision === event.devRevision);
    if (!source || source.commit !== event.commit) findings.push(`history: TEST revision ${event.testRevision} must copy identical DEV revision ${event.devRevision} commit`);
  }
  for (const event of releaseEvents) {
    const source = testEvents.find((candidate) => candidate.testRevision === event.testRevision);
    const qa = qaEvents.find((candidate) => candidate.testRevision === event.testRevision && candidate.commit === event.commit && candidate.qaResult === 'PASS');
    if (!source || source.commit !== event.commit || !qa) findings.push(`history: RELEASE revision ${event.releaseRevision} requires identical passed TEST revision ${event.testRevision} commit`);
  }
  if (dev.commit !== null && !devEvents.some((event) => event.devRevision === dev.revision && event.commit === dev.commit)) findings.push('history: current DEV pointer lacks matching checkpoint event');
  if (test.commit !== null && !testEvents.some((event) => event.testRevision === test.revision && event.commit === test.commit && event.devRevision === test.promotedFromDevRevision)) findings.push('history: current TEST pointer lacks matching promotion event');
  if (test.qa?.status !== 'NOT_RUN' && !qaEvents.some((event) => event.testRevision === test.revision && event.commit === test.commit && event.qaResult === test.qa.status)) findings.push('history: current TEST QA result lacks matching revision event');
  if (release.commit !== null && !releaseEvents.some((event) => event.releaseRevision === release.revision && event.commit === release.commit && event.testRevision === release.promotedFromTestRevision)) findings.push('history: current RELEASE pointer lacks matching promotion event');
}

export function reconcileFeatureChannel(featureRoot, originRefs = null) {
  const root = resolve(featureRoot);
  const ticketId = root.split(/[\\/]/).at(-1);
  const findings = [];
  try {
    if (lstatSync(root).isSymbolicLink()) findings.push('feature root: symbolic links are forbidden');
    const allowed = new Set(['contract.yaml', 'dev.json', 'test.json', 'release.json', 'history.jsonl', 'evidence']);
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) findings.push(`${entry.name}: symbolic links are forbidden`);
      if (!allowed.has(entry.name)) findings.push(`${entry.name}: copied or unexpected feature-channel content is forbidden`);
    }
  } catch (error) {
    return { ok: false, findings: [`feature root: ${error.message}`], ticketId };
  }
  const contract = parseJson(root, 'contract.yaml', findings);
  const dev = parseJson(root, 'dev.json', findings);
  const test = parseJson(root, 'test.json', findings);
  const release = parseJson(root, 'release.json', findings);
  validateContract(contract, ticketId, findings);
  if (dev) validateDev(dev, ticketId, originRefs, findings);
  if (test) validateTest(test, ticketId, originRefs, findings);
  if (release) validateRelease(release, ticketId, originRefs, findings);
  const history = parseHistory(root, findings);
  if (dev && test && release) validateHistory(history, root, ticketId, dev, test, release, findings);
  return { ok: findings.length === 0, findings, ticketId, claims: contract?.claims, devRevision: dev?.revision, testRevision: test?.revision, releaseRevision: release?.revision, historyRecords: history.length, devCommit: dev?.commit, testCommit: test?.commit, releaseCommit: release?.commit };
}

function pathsOverlap(a, b) {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function reconcileFeatureDirectory(featureDirectory) {
  const root = resolve(featureDirectory);
  const findings = [];
  let entries = [];
  try {
    if (lstatSync(root).isSymbolicLink()) findings.push('feature directory: symbolic links are forbidden');
    entries = readdirSync(root, { withFileTypes: true });
    if (entries.length > MAX_FEATURES) findings.push(`feature directory exceeds ${MAX_FEATURES} channel limit`);
  } catch (error) {
    return { ok: false, findings: [`feature directory: ${error.message}`], channels: [] };
  }
  const channels = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) { findings.push(`feature/${entry.name}: expected regular directory`); continue; }
    const result = reconcileFeatureChannel(join(root, entry.name));
    channels.push(result);
    for (const finding of result.findings) findings.push(`feature/${entry.name}: ${finding}`);
  }
  for (let left = 0; left < channels.length; left++) {
    for (let right = left + 1; right < channels.length; right++) {
      for (const a of channels[left].claims?.exclusivePaths || []) for (const b of channels[right].claims?.exclusivePaths || []) {
        if (pathsOverlap(a, b)) findings.push(`feature collision: ${channels[left].ticketId} and ${channels[right].ticketId} overlap exclusive paths ${a} <> ${b}`);
      }
    }
  }
  return { ok: findings.length === 0, findings, channels };
}

function copyPilot(name) {
  const temp = mkdtempSync(join(tmpdir(), `ashenspire-feature-${name}-`));
  cpSync(PILOT_ROOT, temp, { recursive: true });
  return { temp, root: join(temp, 'feature/PILOT-001'), refs: JSON.parse(readFileSync(join(temp, 'origin-refs.json'), 'utf8')) };
}

function rewriteJson(path, mutate) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  mutate(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function runFeatureChannelSelfTest() {
  const cases = [];
  const clean = copyPilot('clean');
  try {
    const result = reconcileFeatureChannel(clean.root, clean.refs);
    cases.push({ name: 'cold pilot reconstructs from origin refs while DEV advances beyond stable TEST and identical RELEASE', passed: result.ok && result.devCommit !== result.testCommit && result.testCommit === result.releaseCommit, detail: result.findings.join('; ') });
  } finally { rmSync(clean.temp, { recursive: true, force: true }); }
  const concurrent = copyPilot('concurrent');
  try {
    const second = join(concurrent.temp, 'feature/PILOT-002');
    cpSync(concurrent.root, second, { recursive: true });
    for (const name of ['contract.yaml', 'dev.json', 'test.json', 'release.json', 'history.jsonl']) {
      const path = join(second, name);
      writeFileSync(path, readFileSync(path, 'utf8').replaceAll('PILOT-001', 'PILOT-002'));
    }
    rewriteJson(join(second, 'contract.yaml'), (contract) => { contract.claims.exclusivePaths = ['src/pilot-two']; });
    const result = reconcileFeatureDirectory(join(concurrent.temp, 'feature'));
    cases.push({ name: 'multiple collision-free feature channels coexist while shared lanes remain declared serialized', passed: result.ok && result.channels.length === 2, detail: result.findings.join('; ') });
  } finally { rmSync(concurrent.temp, { recursive: true, force: true }); }
  const collision = copyPilot('collision');
  try {
    const second = join(collision.temp, 'feature/PILOT-002');
    cpSync(collision.root, second, { recursive: true });
    for (const name of ['contract.yaml', 'dev.json', 'test.json', 'release.json', 'history.jsonl']) {
      const path = join(second, name);
      writeFileSync(path, readFileSync(path, 'utf8').replaceAll('PILOT-001', 'PILOT-002'));
    }
    const result = reconcileFeatureDirectory(join(collision.temp, 'feature'));
    const detail = result.findings.join('; ');
    cases.push({ name: 'overlapping concurrent feature paths are refused', passed: !result.ok && /feature collision/.test(detail), detail });
  } finally { rmSync(collision.temp, { recursive: true, force: true }); }
  const plants = [
    ['origin currentness mismatch is refused', ({ refs }) => { refs['codex/feature/PILOT-001/dev'] = '3333333333333333333333333333333333333333'; }, /not current on supplied origin ref/],
    ['non-identical TEST promotion is refused', ({ root }) => rewriteJson(join(root, 'test.json'), (test) => { test.promotedFromDevCommit = '2222222222222222222222222222222222222222'; }), /promotion must copy an identical DEV commit/],
    ['RELEASE without identical passed TEST is refused', ({ root, refs }) => {
      rewriteJson(join(root, 'release.json'), (release) => { release.commit = '2222222222222222222222222222222222222222'; release.originObservedCommit = release.commit; release.promotedFromTestCommit = release.commit; });
      refs['codex/feature/PILOT-001/release'] = '2222222222222222222222222222222222222222';
      const historyPath = join(root, 'history.jsonl');
      const records = readFileSync(historyPath, 'utf8').trimEnd().split(/\r?\n/).map(JSON.parse);
      for (const record of records) if (record.event === 'RELEASE_PROMOTION') record.commit = '2222222222222222222222222222222222222222';
      writeFileSync(historyPath, `${records.map(JSON.stringify).join('\n')}\n`);
    }, /requires identical passed TEST/],
    ['force-like duplicate TEST revision is refused', ({ root }) => {
      const path = join(root, 'history.jsonl');
      const lines = readFileSync(path, 'utf8').trimEnd().split(/\r?\n/);
      const duplicate = JSON.parse(lines[2]); duplicate.sequence = lines.length + 1; lines.push(JSON.stringify(duplicate)); writeFileSync(path, `${lines.join('\n')}\n`);
    }, /TEST promotion revisions must be immutable and unique/],
    ['local-only DEV custody is refused', ({ root }) => rewriteJson(join(root, 'dev.json'), (dev) => { dev.originObservedCommit = null; dev.observedAtUtc = null; dev.currentness = 'ORIGIN_REF_ABSENT'; }), /commit pointer must be current and identically observed on origin/],
    ['copied source tree in channel is refused', ({ root }) => writeFileSync(join(root, 'copied-tree.zip'), 'not-a-pointer'), /copied or unexpected feature-channel content is forbidden/],
    ['immediate entry without first action is refused', ({ root }) => rewriteJson(join(root, 'contract.yaml'), (contract) => { contract.immediateEntry.currentEntry.firstAction = ''; }), /firstAction: required/],
  ];
  for (const [name, mutate, expected] of plants) {
    const copy = copyPilot(name.replace(/\W+/g, '-'));
    try {
      mutate(copy);
      const result = reconcileFeatureChannel(copy.root, copy.refs);
      const detail = result.findings.join('; ');
      cases.push({ name, passed: !result.ok && expected.test(detail), detail });
    } finally { rmSync(copy.temp, { recursive: true, force: true }); }
  }
  const qaFail = copyPilot('qa-fail-revision-only');
  try {
    rewriteJson(join(qaFail.root, 'test.json'), (test) => {
      test.qa.status = 'FAIL';
      test.guard = { code: 'TEST_QA_FAILED_REVISION', blocks: ['RELEASE_PROMOTION'], retryTrigger: 'Repair DEV and promote a new TEST revision.', safeWork: ['dev-repair', 'dev-checkpoint'] };
    });
    rewriteJson(join(qaFail.root, 'release.json'), (release) => {
      release.revision = 0; release.commit = null; release.originObservedCommit = null; release.observedAtUtc = null; release.currentness = 'ORIGIN_REF_ABSENT'; release.promotedFromTestRevision = null; release.promotedFromTestCommit = null;
      release.guard = { code: 'RELEASE_NO_PASSED_TEST', blocks: ['SHARED_DEV_INTEGRATION'], retryTrigger: 'Promote an identical commit from a passed TEST revision.', safeWork: ['dev-repair', 'test-qa'] };
    });
    delete qaFail.refs['codex/feature/PILOT-001/release'];
    const historyPath = join(qaFail.root, 'history.jsonl');
    const records = readFileSync(historyPath, 'utf8').trimEnd().split(/\r?\n/).map(JSON.parse).filter((record) => record.event !== 'RELEASE_PROMOTION');
    for (const record of records) if (record.event === 'TEST_QA') { record.qaResult = 'FAIL'; record.guardCode = 'TEST_QA_FAILED_REVISION'; record.detail = 'TEST revision 1 failed; DEV revision 2 repair work remains valid.'; }
    writeFileSync(historyPath, `${records.map(JSON.stringify).join('\n')}\n`);
    const result = reconcileFeatureChannel(qaFail.root, qaFail.refs);
    cases.push({ name: 'QA failure guards only its TEST revision while newer DEV remains valid', passed: result.ok && result.devRevision === 2 && result.testRevision === 1 && result.releaseRevision === 0, detail: result.findings.join('; ') });
  } finally { rmSync(qaFail.temp, { recursive: true, force: true }); }
  const verificationStart = '2026-08-28T08:02:46.758Z';
  cases.push({ name: 'verification without ACK after five minutes becomes UNVERIFIED_TIMEOUT without PASS', passed: verificationDisposition({ startedAtUtc: verificationStart, nowUtc: '2026-08-28T08:07:47.758Z' }).result === 'UNVERIFIED_TIMEOUT', detail: '' });
  cases.push({ name: 'verification ACK without completion after ten minutes becomes UNVERIFIED_TIMEOUT', passed: verificationDisposition({ startedAtUtc: verificationStart, nowUtc: '2026-08-28T08:12:47.758Z', ackAtUtc: '2026-08-28T08:06:00.000Z' }).result === 'UNVERIFIED_TIMEOUT', detail: '' });
  cases.push({ name: 'hard security failure stops its exact transition despite timeout authority', passed: verificationDisposition({ startedAtUtc: verificationStart, nowUtc: '2026-08-28T08:13:00.000Z', hardFailure: 'SECURITY_FAILURE' }).result === 'STOP_EXACT_TRANSITION', detail: '' });
  const failed = cases.filter((entry) => !entry.passed);
  return { ok: failed.length === 0, cases, passed: cases.length - failed.length, failed: failed.length };
}
