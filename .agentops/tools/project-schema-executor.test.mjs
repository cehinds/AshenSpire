#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CREATE_FIELD_MUTATION, DEFINITIONS_HASH, DEFINITIONS_MANIFEST, ExecutorError,
  FIELD_DEFINITIONS, PRIORITY_OPTIONS, PROJECT, PRIORITY_FIELD_ID, applyProjectSchemaChange,
  createAttempt, defaultRunner, fetchProjectInventory, persistAttempt, sha256,
  recoverProjectSchemaChange, resolveGhExecutable, stableStringify, validateAuthority, validatePreflight, verifyReceipt
} from './project-schema-executor.mjs';

const SOURCE_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))), '..', '..');
let checks = 0;
function check(name, fn) {
  try { fn(); checks += 1; }
  catch (error) { console.error(`FAIL ${name}: ${error.stack ?? error.message}`); process.exitCode = 1; }
}
async function checkAsync(name, fn) {
  try { await fn(); checks += 1; }
  catch (error) { console.error(`FAIL ${name}: ${error.stack ?? error.message}`); process.exitCode = 1; }
}

function run(command, args, cwd, options = {}) {
  const result = defaultRunner(command, args, { cwd, ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function priorityField() {
  return {
    __typename: 'ProjectV2SingleSelectField', id: PRIORITY_FIELD_ID, name: 'Priority', dataType: 'SINGLE_SELECT',
    createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z', isIssueField: false,
    options: structuredClone(PRIORITY_OPTIONS)
  };
}

function projectState() {
  return {
    updatedAt: '2026-08-31T15:57:21Z', fields: [priorityField()],
    items: [{ id: 'PVTI_item1', createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z', isArchived: false, type: 'ISSUE', content: { __typename: 'Issue', id: 'I_1', number: 1, title: 'One', state: 'OPEN', stateReason: null, repository: { nameWithOwner: 'cehinds/AshenSpire' } }, values: [] }]
  };
}

function mockRunner(state, controls = {}) {
  const calls = [];
  const runner = (command, args, options = {}) => {
    if (command === 'git') return defaultRunner(command, args, options);
    assert.ok(command === 'gh' || /[\\/]gh(?:\.exe)?$/i.test(command));
    calls.push({ args: [...args], input: options.input ?? null });
    if (args[0] === '--version') return { status: 0, signal: null, error: null, stdout: 'gh version 2.80.0 (mock)\n', stderr: '' };
    if (args[0] === 'auth') return { status: 0, signal: null, error: null, stdout: 'Logged in to github.com account cehinds\nToken scopes: \'gist\', \'project\', \'repo\'', stderr: '' };
    const body = JSON.parse(options.input);
    const variables = body.variables;
    if (body.query.includes('query ProjectFields')) {
      const project = { id: PROJECT.id, number: PROJECT.number, title: PROJECT.title, closed: false, updatedAt: state.updatedAt };
      let nodes = state.fields;
      let pageInfo = { hasNextPage: false, endCursor: null };
      if (controls.repeatFieldCursor) { nodes = variables.cursor ? [] : state.fields.slice(0, 1); pageInfo = { hasNextPage: true, endCursor: 'same' }; }
      const data = { viewer: { login: controls.viewer ?? 'cehinds' }, user: { projectV2: { ...project, fields: { totalCount: state.fields.length, pageInfo, nodes } } } };
      return { status: 0, signal: null, error: null, stdout: JSON.stringify({ data }), stderr: '' };
    }
    if (body.query.includes('query ProjectItems')) {
      const nodes = state.items.map(({ values, ...item }) => item);
      const data = { user: { projectV2: { id: PROJECT.id, number: PROJECT.number, title: PROJECT.title, closed: false, updatedAt: state.updatedAt, items: { totalCount: nodes.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes } } } };
      return { status: 0, signal: null, error: null, stdout: JSON.stringify({ data }), stderr: '' };
    }
    if (body.query.includes('query ProjectItemValuesBatch')) {
      const nodes = variables.ids.map((id) => { const item = state.items.find((candidate) => candidate.id === id); return { id, fieldValues: { totalCount: item.values.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: item.values } }; });
      return { status: 0, signal: null, error: null, stdout: JSON.stringify({ data: { nodes } }), stderr: '' };
    }
    if (body.query.includes('query ProjectItemValues')) {
      const item = state.items.find((candidate) => candidate.id === variables.itemId);
      const data = { node: { id: item.id, fieldValues: { totalCount: item.values.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: item.values } } };
      return { status: 0, signal: null, error: null, stdout: JSON.stringify({ data }), stderr: '' };
    }
    if (body.query.includes('query ProjectInventoryClose')) {
      const data = { viewer: { login: controls.viewer ?? 'cehinds' }, user: { projectV2: { id: PROJECT.id, number: PROJECT.number, title: PROJECT.title, closed: false, updatedAt: controls.closeUpdatedAt ?? state.updatedAt, fields: { totalCount: state.fields.length }, items: { totalCount: state.items.length } } } };
      return { status: 0, signal: null, error: null, stdout: JSON.stringify({ data }), stderr: '' };
    }
    if (body.query.includes('mutation CreateProjectV2Field')) {
      controls.mutationCalls = (controls.mutationCalls ?? 0) + 1;
      if (controls.failMutationAt === controls.mutationCalls) return { status: 1, signal: null, error: null, stdout: '', stderr: 'simulated transport loss' };
      const input = variables.input;
      assert.deepEqual(Object.keys(input).sort(), input.dataType === 'TEXT' ? ['clientMutationId', 'dataType', 'name', 'projectId'] : ['clientMutationId', 'dataType', 'name', 'projectId', 'singleSelectOptions']);
      const stamp = `2026-08-31T16:${String(controls.mutationCalls).padStart(2, '0')}:00Z`;
      const field = input.dataType === 'TEXT'
        ? { __typename: 'ProjectV2Field', id: `FIELD_${controls.mutationCalls}`, name: input.name, dataType: input.dataType, createdAt: stamp, updatedAt: stamp, isIssueField: false }
        : { __typename: 'ProjectV2SingleSelectField', id: `FIELD_${controls.mutationCalls}`, name: input.name, dataType: input.dataType, createdAt: stamp, updatedAt: stamp, isIssueField: false, options: input.singleSelectOptions.map((option, index) => ({ id: `OPTION_${controls.mutationCalls}_${index}`, ...option })) };
      state.fields.push(field); state.updatedAt = stamp;
      if (controls.postCreateDriftAt === controls.mutationCalls) {
        state.fields.push({ __typename: 'ProjectV2Field', id: `DRIFT_${controls.mutationCalls}`, name: `Unexpected ${controls.mutationCalls}`, dataType: 'TEXT', createdAt: stamp, updatedAt: stamp, isIssueField: false });
      }
      if (controls.applyThenFailAt === controls.mutationCalls) return { status: 1, signal: null, error: null, stdout: '', stderr: 'simulated lost response after apply' };
      const data = { createProjectV2Field: { clientMutationId: input.clientMutationId, projectV2Field: field } };
      return { status: 0, signal: null, error: null, stdout: JSON.stringify({ data }), stderr: '' };
    }
    throw new Error(`unexpected gh call: ${body.query.slice(0, 80)}`);
  };
  runner.calls = calls; return runner;
}

function copyFile(source, target) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function capsuleHash(value) { return `sha256:${sha256({ ...value, current_hash: '' })}`; }
function resealReceipt(value) { const copy = structuredClone(value); delete copy.receipt_hash; return { ...copy, receipt_hash: sha256(copy) }; }

function createFixture(state, controls = {}) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'agentops-project-schema-test-'));
  const bare = path.join(parent, 'origin.git'); const repo = path.join(parent, 'repo');
  run('git', ['init', '--bare', bare], parent); run('git', ['init', '-b', 'executor', repo], parent);
  run('git', ['config', 'user.name', 'test'], repo); run('git', ['config', 'user.email', 'test@example.com'], repo);
  run('git', ['remote', 'add', 'origin', bare], repo);
  copyFile(path.join(SOURCE_ROOT, '.agentops', 'scheduler', 'schemas', 'project-schema-attempt.json'), path.join(repo, '.agentops', 'scheduler', 'schemas', 'project-schema-attempt.json'));
  copyFile(path.join(SOURCE_ROOT, '.agentops', 'scheduler', 'schemas', 'project-schema-receipt.json'), path.join(repo, '.agentops', 'scheduler', 'schemas', 'project-schema-receipt.json'));
  fs.writeFileSync(path.join(repo, 'executor.txt'), 'exact executor\n');
  run('git', ['add', '.'], repo); run('git', ['commit', '-m', 'executor'], repo);
  const executorHead = run('git', ['rev-parse', 'HEAD'], repo); const executorTree = run('git', ['rev-parse', 'HEAD^{tree}'], repo);
  const runner = mockRunner(state, controls); const inventory = fetchProjectInventory(repo, runner);
  const binding = {
    schema: 'agentops/project-schema-change-authority/v2', executor_head: executorHead, executor_tree: executorTree,
    project: PROJECT, authenticated_login: 'cehinds', required_scope: 'project', project_updated_at: inventory.project.updated_at,
    preflight: inventory.preflight, definitions_hash: DEFINITIONS_HASH, mode: 'create-missing-only', allowed_mutation: 'project-field-create',
    forbid_item_mutation: true, forbid_existing_field_update: true, forbid_backfill: true, abort_on_any_drift: true,
    retry_mode: 'never', one_use: true, expires_at: '2099-01-01T00:00:00Z', audit_ref: 'refs/heads/agentops/project-schema-audit', expected_audit_remote_oid: null,
    audit_push_mode: 'create-if-absent-then-non-force-forward-only-cas', journal_mode: 'append-only-intent-result', recovery_mode: 'inspect-once-never-create',
    audit_paths: { root: '.agentops/scheduler/project-schema-attempts', journal_path: '.agentops/scheduler/project-schema-attempts/journal.jsonl', attempt_path_template: '.agentops/scheduler/project-schema-attempts/attempts/{attempt_id}.json', receipt_path_template: '.agentops/scheduler/project-schema-attempts/receipts/{attempt_id}.json', manifest_path_template: '.agentops/scheduler/project-schema-attempts/manifests/{attempt_id}.json' },
    audit_guards: { expected_absence: true, initial_commit_parent_binding: 'derived-owner-authority-a', initial_creation_authorized_if_absent: true, subsequent_linear_direct_successors: true, allowed_mutation: 'append-intent-result-attempt-and-receipt-records-only', intent_before_each_create: true, result_after_each_response: true, consumed_create_retry_forbidden: true, read_only_recovery: true, ref_recreation_forbidden: true, development_ref_mutation_forbidden: true },
    audit_result_contract: { schema: 'agentops/project-schema-audit-result-contract/v1', result_schema: 'agentops/project-schema-audit-result/v1', path: '.git/agentops-project-schema/audit-result.json', schema_pointer: '.agentops/schemas/owner-command-request.schema.json#/definitions/project_schema_audit_result_receipt', construction_timing: 'after-manifest-publication-and-single-postinspection', finalization_timing: 'after-manifest-publication-and-single-postinspection', ambiguity_policy: 'inspect-once-never-create', no_self_reference: true }
  };
  const trusted = process.env.AGENTOPS_PROJECT_AUTHORITY_CONTRACT_OID ?? 'bcdbfaf979ff16a5f6dd98e7a455600f3f4b762d';
  for (const relative of ['.agentops/schemas/event.schema.json', '.agentops/schemas/owner-command-request.schema.json', '.agentops/schemas/work-capsule.schema.json', '.agentops/governance/owner-command.json']) {
    const body = run('git', ['show', `${trusted}:${relative}`], SOURCE_ROOT); const target = path.join(repo, ...relative.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, `${body}\n`);
  }
  if (controls.tamperCanonicalSchema) {
    const target = path.join(repo, '.agentops', 'schemas', 'event.schema.json'); const schema = JSON.parse(fs.readFileSync(target)); schema.properties.decision.properties.project_schema_change.additionalProperties = true; writeJson(target, schema);
  }
  const parentCapsule = { schema: 'agentops/work-capsule/v1', revision: 1, current_hash: '', parent_hash: null, ticket: 'AS-1001', lifecycle_state: 'BLOCKED', objective: 'Create exact Project schema', done_when: 'Receipt committed', next_action: 'Owner command', repo: 'cehinds/AshenSpire', ref: 'recovery/as-1001-project-schema-executor', base_oid: executorHead, tree: executorTree, expected_dirty_state: 'clean', owner_actor: 'maker', writer_lease: 'lease-AS-1001-project-schema-executor-maker', affected_paths: ['.agentops/tools/project-schema-executor.mjs'], evidence_pointers: [], blocker: null, authority: { may: ['implement'], must_not: ['push without authority'], expiry: '2099-01-01T00:00:00Z' }, rollback: 'Revert candidate', invalidation_keys: ['executor_head'] };
  parentCapsule.current_hash = capsuleHash(parentCapsule);
  writeJson(path.join(repo, '.agentops', 'work', 'AS-1001', 'CURRENT.json'), parentCapsule);
  run('git', ['add', '.agentops/schemas', '.agentops/governance', '.agentops/work'], repo); run('git', ['commit', '-m', 'canonical owner-command state'], repo);
  const event = { schema: 'agentops/event/v1', id: 'AS-1001-0001', ticket: 'AS-1001', seq: 1, parent_event: null, kind: 'owner-decision', actor: 'owner', at: '2026-08-31T18:00:00Z', summary: 'Authorize exact Project schema', decision: { action: 'authorize-project-schema-change', authenticated_role: 'owner', authority_path: '.github/workflows/owner-command.yml:owner-command/v1', target: controls.wrongTarget ? 'AS-OTHER' : 'AS-1001', expected_current_hash: controls.nullCas ? null : parentCapsule.current_hash, candidate_oid: executorHead, project_schema_change: binding } };
  writeJson(path.join(repo, '.agentops', 'events', 'AS-1001', 'AS-1001-0001.json'), event);
  const currentCapsule = controls.forgedStandalone ? parentCapsule : { ...parentCapsule, revision: 2, parent_hash: parentCapsule.current_hash, current_hash: '' }; currentCapsule.current_hash = capsuleHash(currentCapsule);
  writeJson(path.join(repo, '.agentops', 'work', 'AS-1001', 'CURRENT.json'), currentCapsule);
  run('git', ['add', '.agentops/events', '.agentops/work'], repo); run('git', ['commit', '-m', 'owner authority'], repo);
  const authorityStateOid = run('git', ['rev-parse', 'HEAD'], repo);
  run('git', ['push', 'origin', `HEAD:refs/heads/dev`], repo);
  run('git', ['switch', '--detach', executorHead], repo);
  return { parent, bare, repo, runner, controls, inventory, binding, event, executorHead, executorTree, authorityStateOid, eventPath: '.agentops/events/AS-1001/AS-1001-0001.json' };
}

function removeFixture(fixture) { fs.rmSync(fixture.parent, { recursive: true, force: true }); }

check('definitions exact byte length and independent hash', () => {
  assert.equal(Buffer.byteLength(stableStringify(DEFINITIONS_MANIFEST)), 2988);
  assert.equal(DEFINITIONS_HASH, '9533579b821006c1df48c1ca94fde906fa4c999fee82a2e09a7ff28ad9d71304');
  assert.deepEqual(FIELD_DEFINITIONS.map((field) => field.ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(FIELD_DEFINITIONS.filter((field) => field.dataType === 'TEXT').every((field) => !('singleSelectOptions' in field)));
});

check('source contains only the allowed Project mutation', () => {
  const source = fs.readFileSync(new URL('./project-schema-executor.mjs', import.meta.url), 'utf8');
  assert.match(CREATE_FIELD_MUTATION, /createProjectV2Field/);
  for (const forbidden of ['updateProjectV2ItemFieldValue', 'addProjectV2ItemById', 'deleteProjectV2Item', 'updateProjectV2Field', 'deleteProjectV2Field', 'clearProjectV2ItemFieldValue']) assert.doesNotMatch(source, new RegExp(forbidden));
});

check('inventory computes complete roots and exact Priority contract', () => {
  const state = projectState(); const inventory = fetchProjectInventory(process.cwd(), mockRunner(state));
  assert.equal(inventory.preflight.field_count, 1); assert.equal(inventory.preflight.item_count, 1); assert.equal(inventory.preflight.field_value_count, 0);
  assert.equal(inventory.preflight.priority_field_id, PRIORITY_FIELD_ID); assert.match(inventory.preflight.field_state_root, /^[0-9a-f]{64}$/);
});

check('repeated pagination cursor fails closed', () => {
  const state = projectState();
  assert.throws(() => fetchProjectInventory(process.cwd(), mockRunner(state, { repeatFieldCursor: true })), (error) => error instanceof ExecutorError && error.code === 'PAGINATION_CURSOR_REPEAT');
});

check('inventory closing read rejects a torn snapshot', () => {
  assert.throws(() => fetchProjectInventory(process.cwd(), mockRunner(projectState(), { closeUpdatedAt: '2026-08-31T15:57:22Z' })), (error) => error.code === 'PREFLIGHT_DRIFT');
});

check('preflight rejects a case-insensitive target field already present', () => {
  const state = projectState(); const inventory = fetchProjectInventory(process.cwd(), mockRunner(state));
  const binding = { project_updated_at: inventory.project.updated_at, preflight: inventory.preflight };
  state.fields.push({ __typename: 'ProjectV2Field', id: 'EXISTING', name: 'affected paths', dataType: 'TEXT', createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z', isIssueField: false });
  const changed = fetchProjectInventory(process.cwd(), mockRunner(state)); binding.preflight = changed.preflight;
  assert.throws(() => validatePreflight(changed, binding), (error) => ['TARGET_FIELD_PRESENT', 'TARGET_FIELD_CONFLICT'].includes(error.code));
});

check('preflight rejects the wrong Priority contract', () => {
  const state = projectState(); state.fields[0].options[3].name = 'P4';
  const inventory = fetchProjectInventory(process.cwd(), mockRunner(state));
  const binding = { project_updated_at: inventory.project.updated_at, preflight: inventory.preflight };
  assert.throws(() => validatePreflight(inventory, binding), (error) => error.code === 'PRIORITY_CONTRACT_MISMATCH');
});

check('duplicate Project item IDs fail closed', () => {
  const state = projectState(); state.items.push(structuredClone(state.items[0]));
  assert.throws(() => fetchProjectInventory(process.cwd(), mockRunner(state)), (error) => error.code === 'DUPLICATE_NODE_ID');
});

check('inventory canonical-hashes every supported field-value union member and rejects unknown members', () => {
  const state = projectState(); const field = { id: 'F', name: 'Any', dataType: 'TEXT' }; const stamp = '2026-08-31T00:00:00Z';
  const names = ['Date', 'Iteration', 'Label', 'Milestone', 'MultiSelect', 'Number', 'PullRequest', 'Repository', 'Reviewer', 'SingleSelect', 'Text', 'User'];
  state.items[0].values = names.map((name, index) => ({ __typename: `ProjectV2ItemField${name}Value`, id: `V${index}`, updatedAt: stamp, field, ...(name === 'Label' ? { labels: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } : {}), ...(name === 'PullRequest' ? { pullRequests: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } : {}), ...(name === 'Reviewer' ? { reviewers: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } : {}), ...(name === 'User' ? { users: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } } : {}) }));
  state.items[0].values.push({ __typename: 'ProjectV2ItemIssueFieldValue', field, issueFieldValue: { __typename: 'IssueFieldTextValue', id: 'INNER', value: 'x' } });
  const inventory = fetchProjectInventory(process.cwd(), mockRunner(state));
  assert.equal(inventory.preflight.field_value_count, 13);
  state.items[0].values.push({ __typename: 'ProjectV2ItemFieldFutureValue', id: 'BAD', updatedAt: stamp, field });
  assert.throws(() => fetchProjectInventory(process.cwd(), mockRunner(state)), (error) => error.code === 'UNSUPPORTED_FIELD_VALUE');
});

for (const [name, controls] of [
  ['forged standalone owner event', { forgedStandalone: true }],
  ['wrong target owner event', { wrongTarget: true }],
  ['null owner-command CAS', { nullCas: true }],
  ['tampered canonical event schema', { tamperCanonicalSchema: true }]
]) check(`authority rejects ${name}`, () => {
  const fixture = createFixture(projectState(), controls);
  try {
    assert.throws(() => validateAuthority(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath, now: '2026-08-31T18:00:30Z' }, fixture.runner), (error) => error instanceof ExecutorError && error.code === 'AUTHORITY_INVALID');
  } finally { removeFixture(fixture); }
});

check('GitHub CLI discovery resolves the actual authenticated host executable read-only', () => {
  const executable = resolveGhExecutable(SOURCE_ROOT);
  assert.ok(executable === 'gh' || /gh\.exe$/i.test(executable));
});

await checkAsync('ordinary non-force child commit durably consumes and second call refuses', async () => {
  const fixture = createFixture(projectState());
  try {
    const authority = validateAuthority(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath, now: '2026-08-31T18:00:30Z' }, fixture.runner);
    const attempt = createAttempt(authority, fixture.inventory, '2026-08-31T18:01:00Z');
    const first = persistAttempt(fixture.repo, authority, attempt);
    assert.equal(run('git', ['rev-parse', `${first.commit_oid}^`], fixture.repo), fixture.authorityStateOid);
    assert.equal(run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', fixture.authorityStateOid, first.commit_oid], fixture.repo), first.path);
    assert.throws(() => persistAttempt(fixture.repo, authority, attempt), (error) => error.code === 'ATTEMPT_ALREADY_CONSUMED');
  } finally { removeFixture(fixture); }
});

await checkAsync('full apply creates exactly eight fields and commits a sealed receipt', async () => {
  const state = projectState(); const controls = {}; const fixture = createFixture(state, controls);
  try {
    let tick = 0; const times = () => `2026-08-31T18:${String(10 + tick++).padStart(2, '0')}:00Z`;
    let auditPushes = 0; const ambiguityRunner = (command, args, options) => {
      const result = fixture.runner(command, args, options);
      if (command === 'git' && args[0] === 'push' && args.some((arg) => arg.endsWith(':refs/heads/agentops/project-schema-audit')) && ++auditPushes === 19) return { ...result, status: 1, stderr: 'simulated lost manifest-push response' };
      return result;
    };
    const result = applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, ambiguityRunner, { now: times });
    assert.equal(result.status, 'COMPLETE'); assert.equal(controls.mutationCalls, 8); assert.equal(result.receipt.created_fields.length, 8);
    assert.equal(result.receipt.mutation_counts.mutated_item_count, 0); assert.equal(result.receipt.mutation_counts.updated_existing_field_count, 0); assert.equal(result.receipt.mutation_counts.backfill_count, 0);
    assert.equal(run('git', ['rev-parse', `${result.receipt_commit.commit_oid}^`], fixture.repo), result.receipt.journal.head_oid);
    assert.equal(result.receipt.journal.entry_count, 16);
    assert.equal(verifyReceipt(fixture.repo, result.receipt), true);
    assert.equal(auditPushes, 19); assert.equal(result.project_manifest.source_receipt_hash, result.receipt.receipt_hash);
    assert.equal(run('git', ['rev-parse', `${result.manifest_commit.commit_oid}^`], fixture.repo), result.receipt_commit.commit_oid);
    assert.equal(run('git', ['ls-remote', '--refs', 'origin', 'refs/heads/agentops/project-schema-audit'], fixture.repo).split(/\s+/)[0], result.manifest_commit.commit_oid);
    const auditResult = JSON.parse(fs.readFileSync(path.join(fixture.repo, '.git', 'agentops-project-schema', 'audit-result.json')));
    assert.equal(auditResult.published_object.oid, result.manifest_commit.commit_oid); assert.equal(auditResult.manifest.blob_oid, result.manifest_commit.blob_oid); assert.equal(auditResult.postinspection.actual_oid, result.manifest_commit.commit_oid);
    assert.deepEqual(state.fields.slice(1).map((field) => field.name), FIELD_DEFINITIONS.map((field) => field.name));
  } finally { removeFixture(fixture); }
});

await checkAsync('ambiguous first mutation is never retried and authority remains consumed', async () => {
  const state = projectState(); const controls = { failMutationAt: 1 }; const fixture = createFixture(state, controls);
  try {
    let tick = 0; const times = () => `2026-08-31T19:${String(10 + tick++).padStart(2, '0')}:00Z`;
    let caught;
    try { applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, fixture.runner, { now: times }); }
    catch (error) { caught = error; }
    assert.equal(caught.code, 'MUTATION_AMBIGUOUS'); assert.equal(controls.mutationCalls, 1);
    assert.equal(caught.details.receipt.status, 'AMBIGUOUS'); assert.equal(caught.details.receipt.mutation_attempts.length, 1);
    const audit = run('git', ['ls-remote', '--refs', 'origin', 'refs/heads/agentops/project-schema-audit'], fixture.repo).split(/\s+/)[0];
    assert.equal(audit, caught.details.receipt_commit.commit_oid);
  } finally { removeFixture(fixture); }
});

await checkAsync('lost mutation response is reconciled to one exact prefix and never retried', async () => {
  const state = projectState(); const controls = { applyThenFailAt: 1 }; const fixture = createFixture(state, controls);
  try {
    let tick = 0; let caught;
    try { applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, fixture.runner, { now: () => `2026-08-31T19:${String(30 + tick++).padStart(2, '0')}:00Z` }); }
    catch (error) { caught = error; }
    assert.equal(caught.code, 'MUTATION_AMBIGUOUS'); assert.equal(controls.mutationCalls, 1);
    assert.equal(caught.details.receipt.status, 'AMBIGUOUS'); assert.equal(caught.details.receipt.created_fields.length, 1);
    assert.equal(caught.details.receipt.mutation_attempts[0].outcome, 'AMBIGUOUS_APPLIED');
    assert.equal(state.fields.filter((field) => field.name === FIELD_DEFINITIONS[0].name).length, 1);
  } finally { removeFixture(fixture); }
});

await checkAsync('post-create drift appends its RESULT and persists one terminal receipt', async () => {
  const state = projectState(); const controls = { postCreateDriftAt: 1 }; const fixture = createFixture(state, controls);
  try {
    let tick = 0; let caught;
    try { applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, fixture.runner, { now: () => `2026-08-31T19:${String(50 + tick++).padStart(2, '0')}:00Z` }); }
    catch (error) { caught = error; }
    assert.equal(caught.code, 'POST_MUTATION_DRIFT'); assert.equal(controls.mutationCalls, 1);
    assert.equal(caught.details.receipt.status, 'FAILED'); assert.equal(caught.details.receipt.failure_code, 'POST_MUTATION_DRIFT');
    assert.equal(caught.details.receipt.mutation_attempts.length, 1); assert.equal(caught.details.receipt.mutation_attempts[0].outcome, 'DRIFT');
    assert.equal(caught.details.receipt.journal.entry_count, 2);
    const journal = run('git', ['show', `${caught.details.receipt.journal.head_oid}:.agentops/scheduler/project-schema-attempts/journal.jsonl`], fixture.repo).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    assert.equal(journal.at(-1).phase, 'RESULT'); assert.deepEqual(journal.at(-1).after_preflight, caught.details.receipt.final_preflight);
    assert.equal(run('git', ['rev-parse', `${caught.details.receipt_commit.commit_oid}^`], fixture.repo), caught.details.receipt.journal.head_oid);
    assert.equal(verifyReceipt(fixture.repo, caught.details.receipt), true);
  } finally { removeFixture(fixture); }
});

await checkAsync('recovery resolves a durable intent after result-push crash without another create', async () => {
  const state = projectState(); const controls = {}; const fixture = createFixture(state, controls);
  try {
    let pushes = 0; const crashRunner = (command, args, options) => {
      if (command === 'git' && args[0] === 'push' && args.some((arg) => arg.endsWith(':refs/heads/agentops/project-schema-audit')) && ++pushes === 3) return { status: 1, signal: null, error: null, stdout: '', stderr: 'crash after Project response before RESULT publication' };
      return fixture.runner(command, args, options);
    };
    let tick = 0; assert.throws(() => applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, crashRunner, { now: () => `2026-08-31T20:${String(10 + tick++).padStart(2, '0')}:00Z` }));
    assert.equal(controls.mutationCalls, 1);
    const recovered = recoverProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, fixture.runner, { now: () => `2026-08-31T20:${String(30 + tick++).padStart(2, '0')}:00Z` });
    assert.equal(recovered.status, 'AMBIGUOUS'); assert.equal(controls.mutationCalls, 1);
    assert.equal(recovered.receipt.mutation_attempts[0].outcome, 'AMBIGUOUS_APPLIED');
    assert.equal(recovered.receipt.created_fields.length, 1); assert.equal(verifyReceipt(fixture.repo, recovered.receipt), true);
  } finally { removeFixture(fixture); }
});

await checkAsync('failed marker CAS prevents every Project mutation', async () => {
  const state = projectState(); const controls = {}; const fixture = createFixture(state, controls);
  try {
    const failingRunner = (command, args, options) => {
      if (command === 'git' && args[0] === 'push' && args.includes('origin') && args.some((arg) => arg.endsWith(':refs/heads/agentops/project-schema-audit'))) return { status: 1, signal: null, error: null, stdout: '', stderr: 'simulated CAS rejection' };
      return fixture.runner(command, args, options);
    };
    assert.throws(() => applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, failingRunner, { now: () => '2026-08-31T20:00:00Z' }), (error) => error.code === 'CONSUMPTION_PERSIST_FAILED');
    assert.equal(controls.mutationCalls ?? 0, 0);
    assert.equal(run('git', ['ls-remote', '--refs', 'origin', 'refs/heads/dev'], fixture.repo).split(/\s+/)[0], fixture.authorityStateOid);
    assert.equal(run('git', ['ls-remote', '--refs', 'origin', 'refs/heads/agentops/project-schema-audit'], fixture.repo), '');
  } finally { removeFixture(fixture); }
});

check('receipt verification detects any tampering', () => {
  const state = projectState(); const controls = {}; const fixture = createFixture(state, controls);
  try {
    let tick = 0; const result = applyProjectSchemaChange(fixture.repo, { authorityStateOid: fixture.authorityStateOid, eventPath: fixture.eventPath }, fixture.runner, { now: () => `2026-08-31T21:${String(10 + tick++).padStart(2, '0')}:00Z` });
    const tampered = structuredClone(result.receipt); tampered.mutation_counts.backfill_count = 1;
    assert.throws(() => verifyReceipt(fixture.repo, tampered), (error) => ['RECEIPT_INVALID', 'DOCUMENT_SCHEMA_INVALID'].includes(error.code));
    const zeroAuthority = structuredClone(result.receipt); zeroAuthority.authority.state_oid = '0'.repeat(40);
    assert.throws(() => verifyReceipt(fixture.repo, resealReceipt(zeroAuthority)), (error) => ['RECEIPT_INVALID', 'AUTHORITY_EVENT_UNAVAILABLE'].includes(error.code));
    const invented = structuredClone(result.receipt); invented.created_fields[0].id = 'INVENTED'; invented.mutation_attempts[0].returned_field.id = 'INVENTED'; invented.project_readback.fields[0].id = 'INVENTED'; invented.project_readback_hash = sha256(invented.project_readback); invented.config_pin.fields['Scheduler Status'].id = 'INVENTED';
    assert.throws(() => verifyReceipt(fixture.repo, resealReceipt(invented)), (error) => error.code === 'RECEIPT_INVALID');
    const fabricated = structuredClone(result.receipt); fabricated.created_fields = []; fabricated.mutation_attempts = []; fabricated.mutation_counts.created_field_count = 0; fabricated.final_preflight = structuredClone(fabricated.initial_preflight);
    assert.throws(() => verifyReceipt(fixture.repo, resealReceipt(fabricated)), (error) => error.code === 'RECEIPT_INVALID');
    const selfHashedUncommitted = structuredClone(result.receipt); selfHashedUncommitted.completed_at = '2026-08-31T23:59:59Z';
    assert.throws(() => verifyReceipt(fixture.repo, resealReceipt(selfHashedUncommitted)), (error) => error.code === 'RECEIPT_INVALID' && /exact committed receipt/.test(error.message));
    const journalPreflightMismatch = structuredClone(result.receipt); journalPreflightMismatch.final_preflight.pagination_manifest_hash = 'f'.repeat(64);
    assert.throws(() => verifyReceipt(fixture.repo, resealReceipt(journalPreflightMismatch)), (error) => error.code === 'RECEIPT_INVALID' && /final journal RESULT/.test(error.message));

    run('git', ['switch', '--detach', result.receipt.journal.head_oid], fixture.repo);
    fs.writeFileSync(path.join(fixture.repo, 'interposed.txt'), 'not receipt-only\n'); run('git', ['add', 'interposed.txt'], fixture.repo); run('git', ['commit', '-m', 'interposed'], fixture.repo);
    const receiptPath = `.agentops/scheduler/project-schema-attempts/receipts/${result.receipt.authority.event_hash}.json`;
    writeJson(path.join(fixture.repo, ...receiptPath.split('/')), result.receipt); run('git', ['add', receiptPath], fixture.repo); run('git', ['commit', '-m', 'fabricated receipt publication'], fixture.repo);
    run('git', ['push', '--force', 'origin', `HEAD:refs/heads/agentops/project-schema-audit`], fixture.repo);
    assert.throws(() => verifyReceipt(fixture.repo, result.receipt), (error) => error.code === 'RECEIPT_INVALID' && /direct successor/.test(error.message));

    run('git', ['switch', '--detach', result.receipt_commit.commit_oid], fixture.repo);
    fs.writeFileSync(path.join(fixture.repo, 'interposed-manifest.txt'), 'not manifest-only\n'); run('git', ['add', 'interposed-manifest.txt'], fixture.repo); run('git', ['commit', '-m', 'interposed manifest parent'], fixture.repo);
    const manifestPath = `.agentops/scheduler/project-schema-attempts/manifests/${result.receipt.authority.event_hash}.json`;
    writeJson(path.join(fixture.repo, ...manifestPath.split('/')), result.project_manifest); run('git', ['add', manifestPath], fixture.repo); run('git', ['commit', '-m', 'fabricated manifest publication'], fixture.repo);
    run('git', ['push', '--force', 'origin', `HEAD:refs/heads/agentops/project-schema-audit`], fixture.repo);
    assert.throws(() => verifyReceipt(fixture.repo, result.receipt), (error) => error.code === 'RECEIPT_INVALID' && /manifest-only direct successor/.test(error.message));
  } finally { removeFixture(fixture); }
});

if (!process.exitCode) console.log(`project-schema-executor tests: PASS ${checks}/${checks}`);
