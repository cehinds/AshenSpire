#!/usr/bin/env node
// Repository-native continuity validator and maintenance reporter.
//
// This tool is deliberately dependency-free. It validates the committed packet
// against its JSON Schema, checks the Git objects and governance blobs named by
// that packet, and (in --audit mode) compares the recorded protected-branch
// snapshot with the remote. Maintenance modes only report; they never edit Git,
// delete records, commit, push, or mutate dev.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DATA = resolve(ROOT, 'docs/governance/continuity.json');
const DEFAULT_SCHEMA = resolve(ROOT, 'docs/governance/continuity.schema.json');
const DEFAULT_DOC = resolve(ROOT, 'docs/governance/CONTINUITY.md');
const EXPECTED_GENERATED_ORDER = [
  'buildordinal.json',
  'build/AshenSpire.html',
  'AshenSpire.html',
  'dist/AshenSpire.html',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pointer(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported schema reference ${ref}`);
  return ref.slice(2).split('/').reduce((value, part) => value?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], root);
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}

/** Validate the JSON Schema keywords used by continuity.schema.json. */
export function validateSchema(value, schema, rootSchema = schema, at = '$', errors = []) {
  if (schema.$ref) {
    const target = pointer(rootSchema, schema.$ref);
    if (!target) errors.push(`${at}: unresolved schema reference ${schema.$ref}`);
    else validateSchema(value, target, rootSchema, at, errors);
    return errors;
  }

  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errors.push(`${at}: must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) {
    errors.push(`${at}: must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}`);
  }

  const types = schema.type == null ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (types.length && !types.some((type) => typeMatches(value, type))) {
    errors.push(`${at}: expected ${types.join(' or ')}`);
    return errors;
  }

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
    if (schema.format === 'date-time' && !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
      errors.push(`${at}: is not an RFC 3339 date-time`);
    } else if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      errors.push(`${at}: is not a real date-time`);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${at}: below minimum ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${at}: above maximum ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${at}: fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${at}: more than ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      const unique = new Set(value.map((item) => JSON.stringify(item)));
      if (unique.size !== value.length) errors.push(`${at}: items must be unique`);
    }
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, rootSchema, `${at}[${index}]`, errors));
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}: missing required property ${key}`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) validateSchema(item, schema.properties[key], rootSchema, `${at}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected property ${key}`);
    }
  }
  return errors;
}

function duplicates(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function hasCycle(lanes) {
  const graph = new Map(lanes.map((lane) => [lane.id, lane.dependencies]));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of graph.get(id) || []) if (visit(dep)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return lanes.some((lane) => visit(lane.id));
}

function everyString(value, callback, path = '$') {
  if (typeof value === 'string') callback(value, path);
  else if (Array.isArray(value)) value.forEach((item, index) => everyString(item, callback, `${path}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) everyString(item, callback, `${path}.${key}`);
  }
}

export function invariantErrors(doc, raw) {
  const errors = [];
  const laneIds = doc.lanes?.map((lane) => lane.id) || [];
  const laneSet = new Set(laneIds);
  const branchNames = doc.repository?.branches?.map((branch) => branch.name) || [];

  for (const id of duplicates(laneIds)) errors.push(`$.lanes: duplicate lane id ${id}`);
  for (const branch of duplicates(doc.lanes?.map((lane) => lane.branch) || [])) errors.push(`$.lanes: duplicate lane branch ${branch}`);
  for (const name of duplicates(branchNames)) errors.push(`$.repository.branches: duplicate branch ${name}`);
  if (!branchNames.includes(doc.repository?.defaultBranch)) errors.push('$.repository.defaultBranch: missing from branch snapshot');
  for (const branch of doc.repository?.branches || []) {
    if (!branch.policyProtected) errors.push(`$.repository.branches.${branch.name}: policyProtected must stay true`);
  }

  for (const lane of doc.lanes || []) {
    for (const dep of lane.dependencies || []) {
      if (!laneSet.has(dep)) errors.push(`$.lanes.${lane.id}: unknown dependency ${dep}`);
      if (dep === lane.id) errors.push(`$.lanes.${lane.id}: self dependency`);
    }
    if (['active', 'candidate-frozen', 'complete'].includes(lane.status) && !lane.owner?.acknowledged) {
      errors.push(`$.lanes.${lane.id}: ${lane.status} lane is not acknowledged`);
    }
    if (['candidate-frozen', 'complete'].includes(lane.status) && !lane.headSha) {
      errors.push(`$.lanes.${lane.id}: ${lane.status} lane needs an exact headSha`);
    }
    if (['blocked', 'waiting-decision'].includes(lane.status) && !lane.block) {
      errors.push(`$.lanes.${lane.id}: ${lane.status} lane needs an exact block`);
    }
    if (lane.owner?.acknowledged === false && lane.owner?.acknowledgedAt !== null) {
      errors.push(`$.lanes.${lane.id}: unacknowledged owner cannot have acknowledgedAt`);
    }
    if (lane.owner?.acknowledged === true && !lane.owner?.acknowledgedAt) {
      errors.push(`$.lanes.${lane.id}: acknowledged owner needs acknowledgedAt`);
    }
  }
  if (hasCycle(doc.lanes || [])) errors.push('$.lanes: dependency graph contains a cycle');

  for (const collision of doc.collisions || []) {
    for (const lane of collision.lanes) if (!laneSet.has(lane)) errors.push(`$.collisions.${collision.resource}: unknown lane ${lane}`);
    if (new Set(collision.lanes).size !== collision.lanes.length) errors.push(`$.collisions.${collision.resource}: lane list repeats an id`);
  }

  const orders = doc.nextActions?.map((action) => action.order) || [];
  for (const order of duplicates(orders)) errors.push(`$.nextActions: duplicate order ${order}`);
  const sorted = [...orders].sort((a, b) => a - b);
  if (orders.some((order, index) => order !== sorted[index])) errors.push('$.nextActions: actions are not in ascending order');
  for (const action of doc.nextActions || []) if (!laneSet.has(action.lane)) errors.push(`$.nextActions.${action.order}: unknown lane ${action.lane}`);

  if (JSON.stringify(doc.generatedArtifacts?.order) !== JSON.stringify(EXPECTED_GENERATED_ORDER)) {
    errors.push(`$.generatedArtifacts.order: expected ${EXPECTED_GENERATED_ORDER.join(' -> ')}`);
  }
  if (doc.authority?.directDevMutationAllowed !== false) errors.push('$.authority.directDevMutationAllowed: direct dev mutation is forbidden');
  if (doc.authority?.remoteActionsRequireSeparateAuthority !== true) errors.push('$.authority: remote actions must require separate authority');
  if (doc.generatedArtifacts?.directEditsAllowed !== false) errors.push('$.generatedArtifacts.directEditsAllowed: generated files cannot be hand edited');
  for (const tombstone of doc.tombstones || []) if (tombstone.deletionAuthorized !== false) errors.push(`$.tombstones.${tombstone.id}: packet cannot authorize deletion`);

  everyString(doc, (text, at) => {
    if (/(?:^|\s)[A-Za-z]:[\\/]/.test(text) || /^file:/i.test(text) || /^\\\\/.test(text)) {
      errors.push(`${at}: machine-local path is forbidden`);
    }
  });

  const bytes = Buffer.byteLength(raw, 'utf8');
  const tokens = Math.ceil(bytes / 4);
  if (doc.budgets) {
    if (bytes > doc.budgets.maxBytes) errors.push(`$.budgets.maxBytes: packet is ${bytes} bytes, limit ${doc.budgets.maxBytes}`);
    if (tokens > doc.budgets.maxEstimatedTokens) errors.push(`$.budgets.maxEstimatedTokens: packet estimates ${tokens} tokens, limit ${doc.budgets.maxEstimatedTokens}`);
    if ((doc.lanes?.length || 0) > doc.budgets.maxLanes) errors.push('$.budgets.maxLanes: lane count exceeded');
    if ((doc.nextActions?.length || 0) > doc.budgets.maxNextActions) errors.push('$.budgets.maxNextActions: next-action count exceeded');
    if ((doc.tombstones?.length || 0) > doc.budgets.maxTombstones) errors.push('$.budgets.maxTombstones: tombstone count exceeded');
  }
  return errors;
}

function git(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

export function repositoryErrors(doc, adapter) {
  const errors = [];
  const commits = new Set([doc.repository.baseSha]);
  for (const branch of doc.repository.branches) commits.add(branch.sha);
  for (const lane of doc.lanes) {
    commits.add(lane.baseSha);
    if (lane.headSha) commits.add(lane.headSha);
  }
  for (const sha of commits) if (!adapter.objectExists(sha, 'commit')) errors.push(`git object: missing commit ${sha}`);

  for (const source of doc.repository.governance) {
    if (!adapter.objectExists(source.blob, 'blob')) errors.push(`governance ${source.path}: missing blob ${source.blob}`);
    const actual = adapter.hashFile(source.path);
    if (!actual) errors.push(`governance ${source.path}: file missing or unreadable`);
    else if (actual !== source.blob) errors.push(`governance ${source.path}: blob drift ${source.blob} -> ${actual}`);
  }
  if (adapter.documentationErrors) errors.push(...adapter.documentationErrors());
  return errors;
}

export function markdownLinkErrors(text, documentPath, root, fileExists = existsSync) {
  const errors = [];
  const link = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of text.matchAll(link)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    const withoutFragment = target.split('#', 1)[0];
    const absolute = resolve(dirname(documentPath), decodeURIComponent(withoutFragment));
    const rel = relative(root, absolute);
    if (rel.startsWith('..') || isAbsolute(rel)) errors.push(`documentation ${relative(root, documentPath)}: link escapes repository: ${target}`);
    else if (!fileExists(absolute)) errors.push(`documentation ${relative(root, documentPath)}: missing local link ${target}`);
  }
  return errors;
}

export function currentnessErrors(doc, remoteHeads, now = new Date()) {
  const errors = [];
  const observed = new Date(doc.repository.observedAt);
  const ageHours = (now.getTime() - observed.getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0) errors.push('currentness: observedAt is invalid or in the future');
  else if (ageHours > doc.budgets.maxSnapshotAgeHours) {
    errors.push(`currentness: snapshot age ${ageHours.toFixed(1)}h exceeds ${doc.budgets.maxSnapshotAgeHours}h`);
  }
  for (const branch of doc.repository.branches) {
    const remote = remoteHeads.get(branch.name);
    if (!remote) errors.push(`currentness: remote branch ${branch.name} is missing`);
    else if (remote !== branch.sha) errors.push(`currentness: ${branch.name} drift ${branch.sha} -> ${remote}`);
  }
  return errors;
}

function realAdapter(root) {
  return {
    objectExists(sha, type) {
      return git(root, ['cat-file', '-e', `${sha}^{${type}}`]).status === 0;
    },
    hashFile(path) {
      if (!existsSync(resolve(root, path))) return null;
      const result = git(root, ['hash-object', '--', path]);
      return result.status === 0 ? result.stdout : null;
    },
    documentationErrors() {
      if (!existsSync(DEFAULT_DOC)) return [`documentation ${relative(root, DEFAULT_DOC)}: file missing`];
      return markdownLinkErrors(readFileSync(DEFAULT_DOC, 'utf8'), DEFAULT_DOC, root);
    },
  };
}

function loadRemoteHeads(root, remote, names) {
  const result = git(root, ['ls-remote', '--heads', remote, ...names.map((name) => `refs/heads/${name}`)]);
  if (result.status !== 0) throw new Error(result.stderr || 'git ls-remote failed');
  const heads = new Map();
  for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const [sha, ref] = line.split(/\s+/);
    heads.set(ref.replace('refs/heads/', ''), sha);
  }
  return heads;
}

export function evaluate(doc, raw, schema, { adapter, audit = false, remoteHeads = new Map(), now = new Date() } = {}) {
  const errors = [
    ...validateSchema(doc, schema),
    ...invariantErrors(doc, raw),
  ];
  if (adapter) errors.push(...repositoryErrors(doc, adapter));
  if (audit) errors.push(...currentnessErrors(doc, remoteHeads, now));
  return [...new Set(errors)];
}

export function buildPruneProposal(doc, asOf = new Date()) {
  const eligible = (doc.tombstones || [])
    .filter((row) => Date.parse(row.retainUntil) <= asOf.getTime())
    .map((row) => ({
      id: row.id,
      retainUntil: row.retainUntil,
      recovery: row.recovery,
      recommendation: 'REQUEST DECISION; no deletion performed',
      deletionAuthorized: false,
    }));
  return {
    kind: 'continuity-pruning-proposal',
    dryRun: true,
    asOf: asOf.toISOString(),
    candidateCount: eligible.length,
    candidates: eligible,
    mutationsPerformed: 0,
    authorityRequired: 'IT Manager III/user authority for each exact target',
  };
}

function parseArgs(argv) {
  const out = { mode: 'check', data: DEFAULT_DATA, schema: DEFAULT_SCHEMA, jsonOut: null, asOf: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') out.mode = 'check';
    else if (arg === '--audit') out.mode = 'audit';
    else if (arg === '--selftest') out.mode = 'selftest';
    else if (arg === '--prune-proposal') out.mode = 'prune';
    else if (arg === '--data') out.data = resolve(argv[++i] || '');
    else if (arg === '--schema') out.schema = resolve(argv[++i] || '');
    else if (arg === '--json-out') out.jsonOut = resolve(argv[++i] || '');
    else if (arg === '--as-of') out.asOf = new Date(argv[++i] || '');
    else throw new Error(`unknown argument ${arg}`);
  }
  if (out.asOf && Number.isNaN(out.asOf.getTime())) throw new Error('--as-of must be an RFC 3339 date-time');
  return out;
}

function writeReport(path, report) {
  if (!path) return;
  const rel = relative(ROOT, path);
  if (!rel.startsWith('..') && !isAbsolute(rel)) throw new Error('--json-out must be outside the repository');
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function selftest(doc, raw, schema) {
  const expectedObjects = new Set([
    doc.repository.baseSha,
    ...doc.repository.branches.map((row) => row.sha),
    ...doc.repository.governance.map((row) => row.blob),
  ]);
  const expectedHashes = new Map(doc.repository.governance.map((row) => [row.path, row.blob]));
  const remoteHeads = new Map(doc.repository.branches.map((row) => [row.name, row.sha]));
  const adapter = {
    objectExists: (sha) => expectedObjects.has(sha),
    hashFile: (path) => expectedHashes.get(path) || null,
    documentationErrors: () => [],
  };
  const now = new Date(doc.repository.observedAt);
  const plants = [
    ['clean packet', (x) => x, null],
    ['malformed SHA', (x) => { x.repository.baseSha = 'short'; }, 'does not match'],
    ['unknown dependency', (x) => { x.lanes[0].dependencies = ['missing-lane']; }, 'unknown dependency'],
    ['dependency cycle', (x) => { x.lanes[0].dependencies = [x.lanes[1].id]; x.lanes[1].dependencies = [x.lanes[0].id]; }, 'contains a cycle'],
    ['unacknowledged active owner', (x) => { x.lanes[0].owner.acknowledged = false; x.lanes[0].owner.acknowledgedAt = null; }, 'active lane is not acknowledged'],
    ['frozen head omitted', (x) => { x.lanes[0].status = 'candidate-frozen'; x.lanes[0].headSha = null; }, 'needs an exact headSha'],
    ['packet over byte budget', (x) => { x.budgets.maxBytes = 4096; }, 'packet is'],
    ['direct dev mutation enabled', (x) => { x.authority.directDevMutationAllowed = true; }, 'directDevMutationAllowed'],
    ['generated order changed', (x) => { x.generatedArtifacts.order.reverse(); }, 'generatedArtifacts.order'],
    ['duplicate lane id', (x) => { x.lanes[1].id = x.lanes[0].id; }, 'duplicate lane id'],
    ['machine-local path', (x) => { x.lanes[0].next = 'open C:\\temp\\handoff'; }, 'machine-local path'],
    ['missing Git object', (x) => { x.repository.baseSha = '1111111111111111111111111111111111111111'; }, 'missing commit'],
    ['governance blob drift', (x) => { x.repository.governance[0].blob = '2222222222222222222222222222222222222222'; }, 'governance'],
    ['remote branch drift', (x) => { x.repository.branches[0].sha = '3333333333333333333333333333333333333333'; }, 'currentness: dev drift'],
    ['stale snapshot', (x) => x, 'snapshot age', new Date(now.getTime() + (doc.budgets.maxSnapshotAgeHours + 1) * 3_600_000)],
  ];

  let passed = 0;
  for (const [name, plant, expected, plantNow = now] of plants) {
    const candidate = clone(doc);
    plant(candidate);
    const candidateRaw = `${JSON.stringify(candidate, null, 2)}\n`;
    const errors = evaluate(candidate, candidateRaw, schema, { adapter, audit: true, remoteHeads, now: plantNow });
    const ok = expected === null ? errors.length === 0 : errors.some((error) => error.includes(expected));
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${expected ? ` -> ${expected}` : ''}`);
    if (!ok) {
      console.error(`    observed: ${errors.join(' | ') || 'no finding'}`);
    } else passed++;
  }

  const pruneFixture = clone(doc);
  pruneFixture.tombstones = [{
    id: 'closed-example',
    closedAt: '2026-01-01T00:00:00Z',
    retainUntil: '2026-02-01T00:00:00Z',
    recovery: 'recover from the named commit',
    deletionAuthorized: false,
  }];
  const proposal = buildPruneProposal(pruneFixture, new Date('2026-03-01T00:00:00Z'));
  const pruneOk = proposal.dryRun === true && proposal.mutationsPerformed === 0
    && proposal.candidateCount === 1 && proposal.candidates[0].deletionAuthorized === false;
  console.log(`  ${pruneOk ? 'PASS' : 'FAIL'} pruning stays proposal-only`);
  if (pruneOk) passed++;

  const linkErrors = markdownLinkErrors('[missing](not-here.md)', DEFAULT_DOC, ROOT, () => false);
  const linkOk = linkErrors.some((error) => error.includes('missing local link'));
  console.log(`  ${linkOk ? 'PASS' : 'FAIL'} missing Markdown target is caught`);
  if (linkOk) passed++;

  const total = plants.length + 2;
  if (passed !== total) {
    console.error(`continuity selftest: RED — ${passed}/${total} clean/known-bad cases discriminated`);
    return 1;
  }
  console.log(`continuity selftest: OK — ${passed}/${total} clean/known-bad cases discriminated`);
  return 0;
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(`continuity: USAGE — ${error.message}`); return 2; }

  let raw, schemaRaw, doc, schema;
  try {
    raw = readFileSync(args.data, 'utf8');
    schemaRaw = readFileSync(args.schema, 'utf8');
    doc = JSON.parse(raw);
    schema = JSON.parse(schemaRaw);
  } catch (error) {
    console.error(`continuity: UNKNOWN — cannot read or parse packet/schema: ${error.message}`);
    return 2;
  }

  if (args.mode === 'selftest') return selftest(doc, raw, schema);

  let remoteHeads = new Map();
  if (args.mode === 'audit') {
    try {
      remoteHeads = loadRemoteHeads(ROOT, doc.repository.remote, doc.repository.branches.map((row) => row.name));
    } catch (error) {
      console.error(`continuity audit: UNKNOWN — remote currentness unavailable: ${error.message}`);
      return 2;
    }
  }

  const now = args.asOf || new Date();
  const errors = evaluate(doc, raw, schema, {
    adapter: realAdapter(ROOT),
    audit: args.mode === 'audit',
    remoteHeads,
    now,
  });
  const report = {
    kind: args.mode === 'audit' ? 'continuity-audit' : 'continuity-check',
    repository: doc.repository.slug,
    packetUpdatedAt: doc.updatedAt,
    checkedAt: now.toISOString(),
    result: errors.length ? 'FAIL' : 'PASS',
    findings: errors,
    mutationsPerformed: 0,
  };

  if (args.mode === 'prune') {
    if (errors.length) {
      for (const error of errors) console.error(`  FAIL ${error}`);
      console.error(`continuity pruning proposal: RED — ${errors.length} packet finding(s); no proposal emitted`);
      return 1;
    }
    const proposal = buildPruneProposal(doc, now);
    try { writeReport(args.jsonOut, proposal); }
    catch (error) { console.error(`continuity pruning proposal: UNKNOWN — ${error.message}`); return 2; }
    console.log(JSON.stringify(proposal, null, 2));
    console.log(`continuity pruning proposal: OK — ${proposal.candidateCount} candidate(s), 0 mutations`);
    return 0;
  }

  try { writeReport(args.jsonOut, report); }
  catch (error) { console.error(`continuity ${args.mode}: UNKNOWN — ${error.message}`); return 2; }
  for (const error of errors) console.error(`  FAIL ${error}`);
  if (errors.length) {
    console.error(`continuity ${args.mode}: RED — ${errors.length} finding(s), 0 mutations`);
    return 1;
  }
  const bytes = Buffer.byteLength(raw, 'utf8');
  console.log(`continuity ${args.mode}: OK — schema/invariants/Git${args.mode === 'audit' ? '/remote currentness' : ''} pass; ${bytes} bytes, ~${Math.ceil(bytes / 4)} tokens, 0 mutations`);
  return 0;
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) process.exit(await main());
