#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  appendEvents, applyAssignments, assertCandidatePortable, assertPortable, assertSchedulerCommandAllowed, assertSchedulerDispatchCutover, canonicalClaimPath, canonicalIssueIdentity, claimsConflict, commitAssignmentsAfterWakeDispatch, compareAndSwap, compileWake, ensureCustody,
  emptySnapshot, historyAdvanceAllowed, intakeAdmissionEvidence, main, makeEvent, mergeCommandArgs, mergeGateResult, mergedPrRecovery, pathsOverlap, planAssignments,
  fetchAuthenticatedProjectEvidence, legacyJournalManifestHash, localMachine, persistPortableState, protectedTransitionAllowed, readConfig, readPortableState, reconcileAssignmentEnvironment, reduceEvents, repositorySlug, resolveCanonicalIssue,
  runBoundedCommand, schedulerCommandsByClass, schedulerEventVersion, schedulerStateRefs, sealAdmissionEvidence, sha256, simulate, snapshotsMatch, stableStringify, transitionInput, trustedTransitionArgs, validateEvent, validateMachineIdentity, validateMachineLease, validatePortableStateVersion, validateSchedulerCutoverAuthority, validateSchedulerDocument, validateWorkers, watcherPlan
} from './scheduler.mjs';
import { exactV1NumericCheckpoint169333, schedulerV1CompatFixture } from './testdata/scheduler-v1-compat.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..', '..');
const trackedConfig = readConfig(path.resolve(toolDir, '..'));
const testFieldNames = ['Scheduler Status', 'Priority', 'Owner Role', 'Affected Paths', 'Affected Resources', 'Dependencies', 'External Claims', 'Human Gate', 'Scope Complete'];
const config = {
  ...trackedConfig,
  project_contract: {
    ...trackedConfig.project_contract,
    fields: Object.fromEntries(testFieldNames.map((name, index) => [name, {
      id: trackedConfig.project_contract.fields[name]?.id ?? `PVTF_test_contract_${index}`,
      kind: trackedConfig.project_contract.fields[name].kind,
      data_type: trackedConfig.project_contract.fields[name].data_type,
      ...(trackedConfig.project_contract.fields[name].kind === 'ProjectV2SingleSelectField' ? { options: [{ id: `option-${index}-a`, name: index === 0 ? 'READY' : index === 1 ? 'P1' : index === 2 ? 'maker' : 'TRUE' }] } : {})
    }]))
  },
  simulation_mode: true,
  workers: [
    { actor: 'seat:test:00000000-0000-4000-8000-000000000001', capabilities: ['implementation'] },
    { actor: 'seat:test:00000000-0000-4000-8000-000000000002', capabilities: ['implementation', 'review'] },
    { actor: 'seat:test:00000000-0000-4000-8000-000000000003', capabilities: ['implementation', 'review'] }
  ]
};
let passed = 0;
const MACHINE_A = '11111111-1111-4111-8111-111111111111';
const MACHINE_B = '22222222-2222-4222-8222-222222222222';
const governance = JSON.parse(fs.readFileSync(path.join(repoRoot, '.agentops', 'governance', 'git-ownership.json'), 'utf8'));

function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}: ${error.stack}\n`); process.exitCode = 1; }
}

function fresh() { return { oid: null, events: [], eventBlobs: {}, snapshot: emptySnapshot(), machineLease: null, stateVersion: '1' }; }
function migrateFixture(source, sourceTree, createdAt = '2026-08-30T02:00:00.000Z') {
  const authorityEvent = { id: 'test-owner-decision' };
  const authorityReceipt = { event_path: '.agentops/events/test-owner-decision.json', event_id: authorityEvent.id, event_hash: sha256(authorityEvent), authority_state_oid: 'e'.repeat(40), authority_event: authorityEvent };
  const payload = {
    from_state_version: 1, to_state_version: 2,
    source_state_oid: source.oid, source_state_tree: sourceTree,
    source_snapshot_hash: source.snapshot.snapshot_hash, source_last_sequence: source.snapshot.last_sequence,
    legacy_journal_manifest_hash: legacyJournalManifestHash(source.eventBlobs), legacy_machine_lease: source.machineLease,
    preserved_local_tip: null, dispatch_frozen: true, authority_receipt: authorityReceipt
  };
  const migrated = appendEvents(source, [{ event_version: 2, event_type: 'STATE_MIGRATED', issue_id: 'scheduler-state', actor: 'it-manager-iii', machine_id: null, lease_id: null, lease_epoch: null, exact_object: { oid: source.oid, snapshot_hash: source.snapshot.snapshot_hash }, payload, created_at: createdAt, idempotency_key: `test-migrate:${source.oid}` }]);
  return { ...migrated, stateVersion: '2', machineLease: { machine_id: null, lease_epoch: source.machineLease?.lease_epoch ?? 0, acquired_at: null, expires_at: createdAt, expected_state_ref_oid: source.oid, released_at: createdAt } };
}
function testProjectReceipt(observedAt = '2026-08-30T00:00:05.000Z') {
  const requiredFields = ['Scheduler Status', 'Priority', 'Owner Role', 'Affected Paths', 'Affected Resources', 'Dependencies', 'External Claims', 'Human Gate', 'Scope Complete'];
  const body = {
    schema: 'agentops/scheduler-project-fetch-receipt/v1', repository: repositorySlug(config.repository),
    project_owner: config.project_contract.owner, project_number: config.project_contract.number, project_id: config.project_contract.id, project_title: config.project_contract.title,
    project_item_count: 1, project_total_item_count: 1, project_field_count: 9, project_total_field_count: 9,
    required_fields: requiredFields, required_fields_complete: true,
    project_fields: requiredFields.map((name, index) => ({
      id: config.project_contract.fields[name]?.id ?? `PVTF_test_${index}`,
      name,
      kind: config.project_contract.fields[name].kind,
      data_type: config.project_contract.fields[name].data_type,
      options: structuredClone(config.project_contract.fields[name].options ?? [])
    })),
    authenticated_login: 'test-owner', granted_scopes: ['read:project'],
    fetched_at: observedAt,
    response_pages: { items: ['test-items-page-1', 'test-items-page-2'], fields: ['test-fields-page'] },
    response_page_hashes: { items: [sha256('test-items-page-1'), sha256('test-items-page-2')], fields: [sha256('test-fields-page')] },
    response_sha256: sha256({ items: ['test-items-page-1', 'test-items-page-2'], fields: ['test-fields-page'] })
  };
  return { ...body, receipt_hash: sha256(body) };
}
function intake(state, issue, options = {}) {
  const observedAt = options.observedAt ?? '2026-08-30T00:00:00.000Z';
  const receipt = testProjectReceipt(observedAt);
  const projectEvidence = sealAdmissionEvidence({
    schema: 'agentops/scheduler-admission/v1', canonical_issue_id: issue, board_sync_status: 'OK',
    project_priority: options.priority ?? 'P2', project_owner_role: options.ownerRole ?? 'maker', project_status: 'READY',
    project_authenticated_login: receipt.authenticated_login, project_fetch_receipt_hash: receipt.receipt_hash, project_response_sha256: receipt.response_sha256, project_fetch_receipt: structuredClone(receipt),
    scope_complete: true, dependencies_ready: true, human_gate_clear: true, external_claim_clear: true,
    conflict_identities: [], observed_at: observedAt, fresh_until: options.freshUntil ?? '2026-08-30T00:30:00.000Z'
  });
  return appendEvents(state, [{
    event_type: 'INTAKE_RECORDED', issue_id: issue, actor: 'intake', machine_id: 'machine-a',
    exact_object: { issue }, idempotency_key: `intake:${issue}`, created_at: '2026-08-30T00:00:00.000Z',
    payload: { title: options.title ?? issue, priority: options.priority ?? 'P2', dependencies: options.dependencies ?? [], branch: options.branch ?? `codex/${String(issue).replace(/^#/, '')}`, claimed_paths: options.paths ?? [`src/${issue}`], claimed_resources: options.resources ?? [], acceptance_commands: ['node test'], evidence_pointers: [], next_action: 'work', authority_ceiling: 'dev-delivery', project_evidence: projectEvidence }
  }]);
}
function claim(state, issue, actor = 'seat:test:00000000-0000-4000-8000-000000000001', epoch = 1) {
  const item = state.snapshot.work_items[issue];
  return appendEvents(state, [{ event_type: 'CLAIM_ACQUIRED', issue_id: issue, actor, machine_id: 'machine-a', lease_id: `lease:${issue}:${epoch}`, lease_epoch: epoch, exact_object: {}, idempotency_key: `claim:${issue}:${epoch}`, created_at: '2026-08-30T00:00:01.000Z', payload: { branch: item.branch, base_commit: 'a'.repeat(40), lease_expiry: '2026-08-30T00:30:01.000Z', claimed_paths: item.claimed_paths, claimed_resources: item.claimed_resources, next_action: 'work', admission_evidence: item.project_evidence } }]);
}
function liveReconciliation(state, issue, projectOverrides = {}, environmentOverrides = {}) {
  const item = state.snapshot.work_items[issue];
  const receipt = testProjectReceipt();
  return {
    project_sync: {
      status: 'OK', observed_at: '2026-08-30T00:00:05.000Z', source_id: `github-project:${config.project_contract.owner}/${config.project_contract.number}`,
      fetch_receipt: receipt,
      issues: {
        [issue]: {
          canonical_issue_id: issue, priority: item.priority, owner_role: item.project_owner_role,
          status: 'READY', issue_state: 'OPEN', issue_resolution: null, scope_complete: true,
          claimed_paths: item.claimed_paths, claimed_resources: item.claimed_resources,
          dependencies: [], assignees: [], external_claims: [], human_gate: null,
          ...projectOverrides
        }
      }
    },
    governance, agentops_leases: [], worktrees: [], ...environmentOverrides
  };
}
function blockedAdmission(state, issue, reconciliation) {
  const liveConfig = { ...config, simulation_mode: false };
  const plan = planAssignments(state.snapshot, liveConfig, '2026-08-30T00:00:05.000Z', null, reconciliation);
  assert.equal(plan.assignments.length, 0);
  return plan.blocked_items.find((entry) => entry.issue_id === issue);
}
function entered(state, issue) {
  const item = state.snapshot.work_items[issue];
  return appendEvents(state, [{ event_type: 'WORK_ENTERED', issue_id: issue, actor: item.assigned_actor, machine_id: 'machine-a', lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: 'a'.repeat(40) }, idempotency_key: `entered:${issue}`, created_at: '2026-08-30T00:00:02.000Z', payload: { base_commit: 'a'.repeat(40) } }]);
}
function candidate(state, issue, oid = 'b'.repeat(40)) {
  const item = state.snapshot.work_items[issue];
  return appendEvents(state, [{ event_type: 'CANDIDATE_READY', issue_id: issue, actor: item.assigned_actor, machine_id: 'machine-a', lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid }, idempotency_key: `candidate:${issue}:${oid}`, created_at: '2026-08-30T00:00:03.000Z', payload: { candidate_commit: oid, evidence_pointers: ['receipt:test'] } }]);
}
function qa(state, issue, result = 'PASS', oid = 'b'.repeat(40)) {
  let item = state.snapshot.work_items[issue];
  if (item.state === 'CANDIDATE_READY') {
    const actor = 'seat:test:00000000-0000-4000-8000-000000000002';
    const epoch = (item.lease_epoch ?? 0) + 1;
    state = appendEvents(state, [{ event_type: 'QA_ASSIGNED', issue_id: issue, actor, machine_id: 'machine-a', lease_id: `qa-lease:${issue}:${epoch}`, lease_epoch: epoch, exact_object: { oid }, idempotency_key: `qa-assign:${issue}:${epoch}`, created_at: '2026-08-30T00:00:03.500Z', payload: { candidate_commit: oid, lease_expiry: '2026-08-30T00:30:03.500Z' } }]);
    item = state.snapshot.work_items[issue];
  }
  return appendEvents(state, [{ event_type: 'QA_RESULT', issue_id: issue, actor: item.assigned_actor, machine_id: item.lease_machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid }, idempotency_key: `qa:${issue}:${oid}:${result}`, created_at: '2026-08-30T00:00:04.000Z', payload: { candidate_commit: oid, result, evidence_pointers: ['receipt:qa'] } }]);
}

test('1 deterministic replay and snapshot checksums', () => {
  let state = intake(fresh(), 'I-1'); state = claim(state, 'I-1');
  assert.equal(reduceEvents(state.events).snapshot_hash, reduceEvents(structuredClone(state.events)).snapshot_hash);
});

test('2 event idempotency', () => {
  const state = intake(fresh(), 'I-2'); const replay = reduceEvents([...state.events, structuredClone(state.events[0])]);
  assert.equal(replay.revision, 1); assert.equal(replay.errors.length, 0);
});

test('3 state-ref compare-and-swap races', () => {
  assert.deepEqual(compareAndSwap('old', 'old', 'winner'), { ok: true, current: 'winner' });
  assert.deepEqual(compareAndSwap('winner', 'old', 'loser'), { ok: false, current: 'winner' });
});

test('4 one-writer collision rejection', () => {
  assert.equal(pathsOverlap('src/shared', 'src/shared/file.js'), true);
  assert.equal(claimsConflict({ branch: 'a', claimed_paths: ['src/shared'], claimed_resources: [] }, { branch: 'b', claimed_paths: ['src/shared/x'], claimed_resources: [] }), true);
});

test('5 parallel dispatch of disjoint tickets', () => {
  let state = fresh(); for (const id of ['I-5A', 'I-5B', 'I-5C']) state = intake(state, id);
  assert.equal(planAssignments(state.snapshot, config, '2026-08-30T00:00:00Z').assignments.length, 3);
});

test('6 priority and dependency ordering', () => {
  let state = intake(fresh(), 'I-6A', { priority: 'P2' }); state = intake(state, 'I-6B', { priority: 'P0', dependencies: ['I-6A'] }); state = intake(state, 'I-6C', { priority: 'P1' });
  const plan = planAssignments(state.snapshot, { ...config, workers: [config.workers[0]], worker_slots: 1 }, '2026-08-30T00:00:00Z');
  assert.equal(plan.assignments[0].issue_id, 'I-6C');
});

test('7 backpressure-aware assignment', () => {
  let state = fresh();
  for (const [index, id] of ['I-7A', 'I-7B', 'I-7C'].entries()) { state = intake(state, id); state = claim(state, id, `seat:test:00000000-0000-4000-8000-00000000000${index + 4}`); state = entered(state, id); state = candidate(state, id, `${id.at(-1).charCodeAt(0).toString(16).padStart(2, '0')}`.repeat(20)); }
  state = intake(state, 'I-7D'); const plan = planAssignments(state.snapshot, { ...config, workers: [{ actor: 'seat:test:00000000-0000-4000-8000-000000000007', capabilities: ['implementation'] }], worker_slots: 1 }, '2026-08-30T00:00:00Z');
  assert.equal(plan.implementation_paused, true); assert.equal(plan.assignments.length, 0);
  const reviewSeatPlan = planAssignments(state.snapshot, { ...config, workers: [{ actor: 'seat:test:00000000-0000-4000-8000-000000000008', capabilities: ['implementation', 'review'] }], worker_slots: 1 }, '2026-08-30T00:00:00Z', 'c'.repeat(40));
  assert.equal(reviewSeatPlan.assignments.length, 1);
  assert.equal(reviewSeatPlan.assignments[0].kind, 'qa');
});

test('8 immediate refill after completion', () => {
  let state = intake(fresh(), 'I-8A'); state = claim(state, 'I-8A'); state = entered(state, 'I-8A'); state = candidate(state, 'I-8A'); state = qa(state, 'I-8A');
  state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: 'I-8A', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-8A:1', lease_epoch: 1, exact_object: { pr_number: 8 }, payload: { pr_url: 'https://github.com/cehinds/AshenSpire/pull/8' }, idempotency_key: 'pr:I-8A', created_at: '2026-08-30T00:00:05Z' }]);
  state = appendEvents(state, [{ event_type: 'MERGED_DEV', issue_id: 'I-8A', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-8A:1', lease_epoch: 1, exact_object: { oid: 'd'.repeat(40) }, payload: { merge_commit: 'd'.repeat(40) }, idempotency_key: 'merge:I-8A', created_at: '2026-08-30T00:00:06Z' }]);
  state = intake(state, 'I-8B');
  state = appendEvents(state, [{ event_type: 'COMPLETED', issue_id: 'I-8A', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-8A:1', lease_epoch: 1, exact_object: {}, payload: {}, idempotency_key: 'complete:I-8A', created_at: '2026-08-30T00:00:07Z' }]);
  const refill = planAssignments(state.snapshot, config, '2026-08-30T00:00:07Z', 'c'.repeat(40)).assignments.find((a) => a.issue_id === 'I-8B');
  assert.equal(refill.base_commit, 'c'.repeat(40));
  state = appendEvents(state, [{ event_type: 'CLAIM_ACQUIRED', issue_id: refill.issue_id, actor: refill.actor, machine_id: 'machine-a', lease_id: refill.lease_id, lease_epoch: refill.lease_epoch, exact_object: { base_commit: refill.base_commit }, payload: { branch: state.snapshot.work_items[refill.issue_id].branch, base_commit: refill.base_commit, lease_expiry: refill.lease_expiry, admission_evidence: refill.admission_evidence }, idempotency_key: 'auto-claim:I-8B:1', created_at: '2026-08-30T00:00:07Z' }]);
  assert.equal(state.snapshot.work_items['I-8B'].state, 'CLAIMED');
});

test('9 immediate refill after blocking', () => {
  let state = intake(fresh(), 'I-9A'); state = claim(state, 'I-9A'); state = intake(state, 'I-9B');
  state = appendEvents(state, [{ event_type: 'BLOCKED', issue_id: 'I-9A', actor: 'seat:test:00000000-0000-4000-8000-000000000001', machine_id: 'machine-a', lease_id: 'lease:I-9A:1', lease_epoch: 1, exact_object: {}, payload: { blocker: 'dependency', wake_condition: 'dependency closes' }, idempotency_key: 'block:I-9A', created_at: '2026-08-30T00:00:02Z' }]);
  assert.equal(planAssignments(state.snapshot, config, '2026-08-30T00:00:02Z').assignments.some((a) => a.issue_id === 'I-9B'), true);
});

test('blocked work retains exclusive paths until explicitly released', () => {
  let state = intake(fresh(), 'I-9C', { paths: ['src/shared'] }); state = claim(state, 'I-9C');
  state = appendEvents(state, [{ event_type: 'BLOCKED', issue_id: 'I-9C', actor: state.snapshot.work_items['I-9C'].assigned_actor, machine_id: 'machine-a', lease_id: 'lease:I-9C:1', lease_epoch: 1, exact_object: {}, payload: { blocker: 'dependency', wake_condition: 'dependency closes', retained_paths: ['src/shared'] }, idempotency_key: 'block:I-9C', created_at: '2026-08-30T00:00:02Z' }]);
  state = intake(state, 'I-9D', { paths: ['src/shared/file.js'] });
  assert.equal(planAssignments(state.snapshot, config, '2026-08-30T00:00:03Z', 'c'.repeat(40)).assignments.some((a) => a.issue_id === 'I-9D'), false);
});

test('10 immediate refill after QA result', () => {
  let state = intake(fresh(), 'I-10A'); state = claim(state, 'I-10A'); state = entered(state, 'I-10A'); state = candidate(state, 'I-10A'); state = intake(state, 'I-10B'); state = qa(state, 'I-10A', 'PASS');
  assert.equal(planAssignments(state.snapshot, config, '2026-08-30T00:00:04Z').assignments.some((a) => a.issue_id === 'I-10B'), true);
});

test('11 lease expiry and fencing', () => {
  let state = intake(fresh(), 'I-11'); state = claim(state, 'I-11');
  assert.throws(() => appendEvents(state, [{ event_type: 'LEASE_EXPIRED', issue_id: 'I-11', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-11:1', lease_epoch: 2, exact_object: {}, payload: {}, idempotency_key: 'expire:I-11', created_at: '2026-08-30T01:00:00Z' }]), /fencing/);
});

test('12 agent-disappearance recovery', () => {
  let state = intake(fresh(), 'I-12'); state = claim(state, 'I-12');
  state = appendEvents(state, [{ event_type: 'DRIFT_DETECTED', issue_id: 'I-12', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-12:1', lease_epoch: 1, exact_object: {}, payload: { blocker: 'agent disappeared' }, idempotency_key: 'drift:I-12', created_at: '2026-08-30T00:10:00Z' }]);
  assert.equal(state.snapshot.work_items['I-12'].state, 'REPAIR_REQUIRED');
});

test('13 scheduler restart and replay', () => {
  let state = intake(fresh(), 'I-13'); state = claim(state, 'I-13'); const serialized = JSON.parse(JSON.stringify(state.events));
  assert.equal(reduceEvents(serialized).snapshot_hash, state.snapshot.snapshot_hash);
});

test('14 stale base head tree refusal', () => {
  let state = intake(fresh(), 'I-14'); state = claim(state, 'I-14'); state = entered(state, 'I-14'); state = candidate(state, 'I-14');
  assert.throws(() => qa(state, 'I-14', 'PASS', 'c'.repeat(40)), /does not match/);
});

test('15 fast-forward branch recovery', () => {
  assert.deepEqual(historyAdvanceAllowed('a', 'b', () => true), { allowed: true, changed: true });
});

test('16 rewritten-history refusal', () => {
  assert.equal(historyAdvanceAllowed('a', 'b', () => false).reason, 'REWRITTEN_HISTORY');
});

test('17 lost completion recovery', () => {
  let state = intake(fresh(), 'I-17'); state = claim(state, 'I-17'); state = entered(state, 'I-17'); state = candidate(state, 'I-17'); state = qa(state, 'I-17');
  state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: 'I-17', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-17:1', lease_epoch: 1, exact_object: { pr_number: 17 }, payload: { pr_url: 'https://github.com/cehinds/AshenSpire/pull/17' }, idempotency_key: 'pr:I-17', created_at: '2026-08-30T00:00:05Z' }]);
  state = appendEvents(state, [{ event_type: 'MERGED_DEV', issue_id: 'I-17', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-17:1', lease_epoch: 1, exact_object: { oid: 'd'.repeat(40) }, payload: { merge_commit: 'd'.repeat(40) }, idempotency_key: 'merge:I-17', created_at: '2026-08-30T00:00:06Z' }]);
  const recovered = appendEvents(state, [{ event_type: 'COMPLETED', issue_id: 'I-17', actor: 'recovery', machine_id: 'machine-a', lease_id: 'lease:I-17:1', lease_epoch: 1, exact_object: {}, payload: {}, idempotency_key: 'recovered-complete:I-17', created_at: '2026-08-30T01:00:00Z' }]);
  assert.equal(recovered.snapshot.work_items['I-17'].state, 'DONE');
});

test('18 orphan-branch reconciliation', () => {
  let state = intake(fresh(), 'I-18'); state = claim(state, 'I-18');
  state = appendEvents(state, [{ event_type: 'DRIFT_DETECTED', issue_id: 'I-18', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-18:1', lease_epoch: 1, exact_object: { branch: 'codex/orphan' }, payload: { blocker: 'orphan branch', wake_condition: 'bind exact candidate' }, idempotency_key: 'orphan:I-18', created_at: '2026-08-30T00:10:00Z' }]);
  assert.equal(state.snapshot.work_items['I-18'].blocker, 'orphan branch');
});

test('19 duplicate Help Desk intake', () => {
  const state = intake(fresh(), 'I-19');
  assert.deepEqual(resolveCanonicalIssue(state.snapshot, 'I-19'), { duplicate: true, canonical_issue_id: 'I-19', updated_event: state.events[0].event_id });
});

test('20 exact-head QA binding', () => {
  let state = intake(fresh(), 'I-20'); state = claim(state, 'I-20'); state = entered(state, 'I-20'); state = candidate(state, 'I-20'); state = qa(state, 'I-20');
  assert.equal(state.snapshot.work_items['I-20'].state, 'PR_READY');
});

test('21 automated PR delivery under standing authority', () => {
  const gates = Object.fromEntries(['current_base', 'head_unchanged', 'one_writer', 'checks_passed', 'independent_review', 'threads_resolved', 'no_competing_pr', 'rollback_known'].map((key) => [key, true]));
  assert.equal(protectedTransitionAllowed(config, 'merge-dev', gates).allowed, true);
});

test('22 rejection of unauthorized protected promotion', () => {
  assert.equal(protectedTransitionAllowed(config, 'main').reason, 'CONSTANTINE_DECISION_REQUIRED');
});

test('23 secret and machine-path rejection', () => {
  assert.throws(() => assertPortable({ access_token: 'x' }), /secret-like/);
  assert.throws(() => assertPortable({ evidence: 'C:\\private\\file' }), /absolute machine path/);
  assert.throws(() => assertPortable({ evidence: '/workspace/private/file' }), /absolute machine path/);
});

test('24 clean-clone bounded wake reconstruction', () => {
  let state = intake(fresh(), 'I-24'); state = claim(state, 'I-24'); const result = compileWake(state.snapshot.work_items['I-24'], config);
  assert.equal(result.estimated_tokens <= 1500, true); assert.equal(result.target_met, true);
});

test('25 cross-machine custody transfer', () => {
  const first = compareAndSwap(null, null, { machine_id: 'a', lease_epoch: 1 });
  const released = compareAndSwap(first.current, first.current, null); const second = compareAndSwap(released.current, null, { machine_id: 'b', lease_epoch: 2 });
  assert.equal(second.ok, true); assert.equal(second.current.machine_id, 'b');
});

test('26 pre-migration watcher is blocked before creating machine identity', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-scheduler-quiet-'));
  try {
    fs.mkdirSync(path.join(temp, '.agentops', 'scheduler'), { recursive: true });
    fs.copyFileSync(path.join(toolDir, '..', 'scheduler', 'config.json'), path.join(temp, '.agentops', 'scheduler', 'config.json'));
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const moduleUrl = pathToFileURL(path.join(toolDir, 'scheduler.mjs')).href;
    const script = `import(${JSON.stringify(moduleUrl)}).then(({main}) => { process.exitCode = main(['watch'], ${JSON.stringify(temp)}); })`;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: temp, encoding: 'utf8', timeout: 5000 });
    assert.notEqual(run.status, 0); assert.match(run.stderr, /SCHEDULER_STATE_MIGRATION_REQUIRED/); assert.equal(run.stdout, '');
    assert.equal(fs.existsSync(path.join(temp, '.git', 'agentops-scheduler', 'machine.json')), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('pipeline saturation acceptance fixture', () => {
  const result = simulate(config); const replay = simulate(config); assert.equal(result.tickets, 12); assert.equal(result.concurrent, true); assert.equal(result.conflict_rejected, true); assert.equal(result.protected_stop, true); assert.equal(result.deterministic_hash, replay.deterministic_hash);
});

test('canonical serialization is key-order independent', () => {
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
});

test('lease holder fencing rejects actor machine id and epoch substitution', () => {
  let state = intake(fresh(), 'I-FENCE'); state = claim(state, 'I-FENCE');
  const item = state.snapshot.work_items['I-FENCE'];
  const base = { event_type: 'WORK_ENTERED', issue_id: 'I-FENCE', actor: item.assigned_actor, machine_id: item.lease_machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: {}, payload: { base_commit: 'a'.repeat(40) }, created_at: '2026-08-30T00:00:02Z' };
  assert.throws(() => appendEvents(state, [{ ...base, actor: config.workers[1].actor, idempotency_key: 'fence:actor' }]), /actor fencing/);
  assert.throws(() => appendEvents(state, [{ ...base, machine_id: 'machine-b', idempotency_key: 'fence:machine' }]), /machine fencing/);
  assert.throws(() => appendEvents(state, [{ ...base, lease_id: 'lease:other:1', idempotency_key: 'fence:id' }]), /id fencing/);
  assert.throws(() => appendEvents(state, [{ ...base, lease_epoch: 2, idempotency_key: 'fence:epoch' }]), /epoch fencing/);
});

test('direct claims reject paths retained by dependency-wait work', () => {
  let state = intake(fresh(), 'I-LOCK-A', { paths: ['src/locked'] }); state = claim(state, 'I-LOCK-A');
  const held = state.snapshot.work_items['I-LOCK-A'];
  state = appendEvents(state, [{ event_type: 'BLOCKED', issue_id: held.issue_id, actor: held.assigned_actor, machine_id: held.lease_machine_id, lease_id: held.lease_id, lease_epoch: held.lease_epoch, exact_object: {}, payload: { blocker: 'dependency', wake_condition: 'later', retained_paths: ['src/locked'] }, created_at: '2026-08-30T00:00:02Z', idempotency_key: 'lock:block' }]);
  state = intake(state, 'I-LOCK-B', { paths: ['src/locked/file.js'] });
  assert.throws(() => claim(state, 'I-LOCK-B', config.workers[1].actor), /one-writer collision/);
  const blocked = state.snapshot.work_items['I-LOCK-A'];
  state = appendEvents(state, [{ event_type: 'RESOURCE_RELEASED', issue_id: blocked.issue_id, actor: 'scheduler', machine_id: 'machine-b', lease_id: null, lease_epoch: blocked.lease_epoch, exact_object: {}, payload: { requeue: false, retained_paths: [], retained_resources: [] }, created_at: '2026-08-30T00:00:03Z', idempotency_key: 'lock:release' }]);
  state = claim(state, 'I-LOCK-B', config.workers[1].actor);
  assert.equal(state.snapshot.work_items['I-LOCK-B'].state, 'CLAIMED');
});

test('candidate releases maker and planner issues independent QA plus refill', () => {
  let state = intake(fresh(), 'I-QA-A'); state = claim(state, 'I-QA-A'); state = entered(state, 'I-QA-A'); state = candidate(state, 'I-QA-A'); state = intake(state, 'I-QA-B');
  assert.equal(state.snapshot.work_items['I-QA-A'].assigned_actor, null);
  const plan = planAssignments(state.snapshot, config, '2026-08-30T00:00:04Z', 'c'.repeat(40));
  assert.equal(plan.assignments.some((assignment) => assignment.issue_id === 'I-QA-A' && assignment.kind === 'qa'), true);
  assert.equal(plan.assignments.some((assignment) => assignment.issue_id === 'I-QA-B' && assignment.kind === 'implementation'), true);
  assert.notEqual(plan.assignments.find((assignment) => assignment.issue_id === 'I-QA-A').actor, state.snapshot.work_items['I-QA-A'].maker_actor);
  state = applyAssignments(state, plan.assignments, 'machine-a', '2026-08-30T00:00:04Z');
  assert.equal(state.snapshot.work_items['I-QA-A'].state, 'QA');
  assert.equal(state.snapshot.work_items['I-QA-B'].state, 'CLAIMED');
  assert.equal(compileWake(state.snapshot.work_items['I-QA-A'], config).wake.DONE_WHEN.includes('Independent QA'), true);
});

test('QA rejects maker self-certification and unissued identities', () => {
  let state = intake(fresh(), 'I-QA-FENCE'); state = claim(state, 'I-QA-FENCE'); state = entered(state, 'I-QA-FENCE'); state = candidate(state, 'I-QA-FENCE');
  const item = state.snapshot.work_items['I-QA-FENCE']; const epoch = item.lease_epoch + 1;
  const assignment = { event_type: 'QA_ASSIGNED', issue_id: item.issue_id, machine_id: 'machine-a', lease_id: `qa:${epoch}`, lease_epoch: epoch, exact_object: { oid: item.candidate_commit }, payload: { candidate_commit: item.candidate_commit, lease_expiry: '2026-08-30T00:30:00Z' }, created_at: '2026-08-30T00:00:04Z' };
  assert.throws(() => appendEvents(state, [{ ...assignment, actor: item.maker_actor, idempotency_key: 'qa:self' }]), /independent/);
  assert.throws(() => appendEvents(state, [{ ...assignment, actor: 'qa-person', idempotency_key: 'qa:unissued' }]), /issued/);
});

test('late expired-epoch candidate is preserved but not current', () => {
  let state = intake(fresh(), 'I-LATE'); state = claim(state, 'I-LATE'); state = entered(state, 'I-LATE');
  const old = structuredClone(state.snapshot.work_items['I-LATE']);
  state = appendEvents(state, [{ event_type: 'LEASE_EXPIRED', issue_id: old.issue_id, actor: 'scheduler', machine_id: old.lease_machine_id, lease_id: old.lease_id, lease_epoch: old.lease_epoch, exact_object: {}, payload: {}, created_at: '2026-08-30T00:31:00Z', idempotency_key: 'late:expire' }]);
  state = claim(state, 'I-LATE', config.workers[1].actor, 2);
  state = appendEvents(state, [{ event_type: 'CANDIDATE_READY', issue_id: old.issue_id, actor: old.assigned_actor, machine_id: old.lease_machine_id, lease_id: old.lease_id, lease_epoch: old.lease_epoch, exact_object: { oid: 'd'.repeat(40) }, payload: { candidate_commit: 'd'.repeat(40), evidence_pointers: ['late'] }, created_at: '2026-08-30T00:32:00Z', idempotency_key: 'late:candidate' }]);
  assert.equal(state.snapshot.work_items['I-LATE'].candidate_commit, null);
  assert.equal(state.snapshot.work_items['I-LATE'].late_candidates[0].candidate_commit, 'd'.repeat(40));
});

test('declared event schema rejects additional properties', () => {
  const event = makeEvent(emptySnapshot(), { event_type: 'INTAKE_RECORDED', issue_id: 'I-SCHEMA', actor: 'intake', exact_object: {}, payload: { title: 'Schema test' }, created_at: '2026-08-30T00:00:00Z' });
  assert.throws(() => validateEvent({ ...event, undeclared: true }), /additional property/);
});

test('declared snapshot and wake schemas reject additional properties', () => {
  assert.throws(() => validateSchedulerDocument({ ...emptySnapshot(), undeclared: true }, 'snapshot'), /additional property/);
  let state = intake(fresh(), 'I-WAKE-SCHEMA'); state = claim(state, 'I-WAKE-SCHEMA');
  const wake = compileWake(state.snapshot.work_items['I-WAKE-SCHEMA'], config).wake;
  assert.throws(() => validateSchedulerDocument({ ...wake, undeclared: true }, 'wake'), /additional property/);
  assert.throws(() => validateSchedulerDocument({ ...wake, LEASE: { ...wake.LEASE, undeclared: true } }, 'wake'), /additional property/);
});

test('snapshot verification compares complete deterministic content', () => {
  let state = intake(fresh(), 'I-SNAPSHOT'); const corrupted = structuredClone(state.snapshot); corrupted.work_items['I-SNAPSHOT'].title = 'tampered';
  assert.equal(corrupted.snapshot_hash, state.snapshot.snapshot_hash);
  assert.equal(snapshotsMatch(state.snapshot, corrupted), false);
});

test('watcher plans expiry and raises configured idle alarm', () => {
  let state = intake(fresh(), 'I-WATCH'); state = claim(state, 'I-WATCH');
  const expired = watcherPlan(state.snapshot, config, '2026-08-30T00:31:00Z', 'c'.repeat(40));
  assert.equal(expired.expirations.length, 1);
  let idle = intake(fresh(), 'I-IDLE');
  const alarm = watcherPlan(idle.snapshot, config, '2026-08-30T00:00:31Z', 'c'.repeat(40));
  assert.equal(alarm.idle_alarm, true);
});

test('dev merge command pins the reviewed exact head', () => {
  const oid = 'e'.repeat(40); const args = mergeCommandArgs(461, oid);
  assert.deepEqual(args.slice(-2), ['--match-head-commit', oid]);
});

test('dev merge one-writer gate uses preserved maker lease after QA releases seats', () => {
  const issue = '#461';
  let state = intake(fresh(), issue); state = claim(state, issue); state = entered(state, issue); state = candidate(state, issue); state = qa(state, issue);
  state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: issue, actor: 'scheduler', machine_id: 'machine-a', lease_id: null, lease_epoch: state.snapshot.work_items[issue].lease_epoch, exact_object: { pr_number: 461 }, payload: { pr_url: 'https://github.com/cehinds/AshenSpire/pull/461' }, idempotency_key: 'merge-gate:pr', created_at: '2026-08-30T00:00:05Z' }]);
  const item = state.snapshot.work_items[issue];
  assert.equal(item.assigned_actor, null);
  const pr = { author: { login: 'maker' }, headRefOid: item.candidate_commit, statusCheckRollup: [{ conclusion: 'SUCCESS' }], reviews: [{ state: 'APPROVED', author: { login: 'independent' }, commit: { oid: item.candidate_commit } }] };
  const gate = mergeGateResult(config, item, pr, { currentBaseIsAncestor: true, unresolvedThreads: 0, competingPrs: 0, rollbackKnown: true });
  assert.equal(gate.gates.one_writer, true);
  assert.equal(gate.allowed, true);
});

test('terminal DONE rejects lease expiry and drift regressions', () => {
  let state = intake(fresh(), 'I-TERMINAL'); state = claim(state, 'I-TERMINAL'); state = entered(state, 'I-TERMINAL'); state = candidate(state, 'I-TERMINAL'); state = qa(state, 'I-TERMINAL');
  state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: 'I-TERMINAL', actor: 'scheduler', machine_id: 'machine-a', lease_id: null, lease_epoch: state.snapshot.work_items['I-TERMINAL'].lease_epoch, exact_object: { pr_number: 999 }, payload: { pr_url: 'https://github.com/cehinds/AshenSpire/pull/999' }, idempotency_key: 'terminal:pr', created_at: '2026-08-30T00:00:05Z' }]);
  state = appendEvents(state, [{ event_type: 'MERGED_DEV', issue_id: 'I-TERMINAL', actor: 'scheduler', machine_id: 'machine-a', lease_id: null, lease_epoch: state.snapshot.work_items['I-TERMINAL'].lease_epoch, exact_object: { oid: 'd'.repeat(40) }, payload: { merge_commit: 'd'.repeat(40) }, idempotency_key: 'terminal:merge', created_at: '2026-08-30T00:00:06Z' }]);
  state = appendEvents(state, [{ event_type: 'COMPLETED', issue_id: 'I-TERMINAL', actor: 'scheduler', machine_id: 'machine-a', lease_id: null, lease_epoch: state.snapshot.work_items['I-TERMINAL'].lease_epoch, exact_object: {}, payload: {}, idempotency_key: 'terminal:done', created_at: '2026-08-30T00:00:07Z' }]);
  const terminal = state.snapshot.work_items['I-TERMINAL'];
  const base = { issue_id: terminal.issue_id, actor: 'scheduler', machine_id: 'machine-a', lease_id: null, lease_epoch: terminal.lease_epoch, exact_object: {}, payload: {}, created_at: '2026-08-30T00:01:00Z' };
  assert.throws(() => appendEvents(state, [{ ...base, event_type: 'LEASE_EXPIRED', idempotency_key: 'terminal:expire' }]), /terminal DONE/);
  assert.throws(() => appendEvents(state, [{ ...base, event_type: 'DRIFT_DETECTED', idempotency_key: 'terminal:drift' }]), /terminal DONE/);
  assert.equal(state.snapshot.work_items['I-TERMINAL'].state, 'DONE');
});

test('intake rejects missing or blank titles before storage', () => {
  const base = { event_type: 'INTAKE_RECORDED', issue_id: 'I-NO-TITLE', actor: 'intake', machine_id: 'machine-a', exact_object: { issue: 'I-NO-TITLE' }, created_at: '2026-08-30T00:00:00Z' };
  assert.throws(() => appendEvents(fresh(), [{ ...base, payload: {}, idempotency_key: 'intake:no-title' }]), /intake title/);
  assert.throws(() => appendEvents(fresh(), [{ ...base, payload: { title: '   ' }, idempotency_key: 'intake:blank-title' }]), /intake title/);
  assert.equal(Object.keys(fresh().snapshot.work_items).length, 0);
});

test('refill assignment persistence waits for successful recoverable dispatch', () => {
  const state = intake(fresh(), 'I-DISPATCH');
  const plan = planAssignments(state.snapshot, config, '2026-08-30T00:00:01Z', 'c'.repeat(40));
  let persistCalled = false;
  assert.throws(() => commitAssignmentsAfterWakeDispatch(state, plan.assignments, 'machine-a', '2026-08-30T00:00:01Z', {
    dispatch: () => { throw new Error('wake compilation failed'); },
    persist: () => { persistCalled = true; return 'f'.repeat(40); }
  }), /wake compilation failed/);
  assert.equal(persistCalled, false);
  assert.equal(state.snapshot.work_items['I-DISPATCH'].state, 'READY');

  let rolledBack = false;
  assert.throws(() => commitAssignmentsAfterWakeDispatch(state, plan.assignments, 'machine-a', '2026-08-30T00:00:01Z', {
    dispatch: () => ({ dispatched: [{ issue_id: 'I-DISPATCH' }], commit() {}, rollback() { rolledBack = true; } }),
    persist: () => { throw new Error('state CAS failed'); }
  }), /state CAS failed/);
  assert.equal(rolledBack, true);
  assert.equal(state.snapshot.work_items['I-DISPATCH'].state, 'READY');

  let unconfirmedRolledBack = false; let unconfirmedCommitted = false;
  assert.throws(() => commitAssignmentsAfterWakeDispatch(state, plan.assignments, 'machine-a', '2026-08-30T00:00:01Z', {
    dispatch: () => ({ dispatched: [{ issue_id: 'I-DISPATCH' }], commit() { unconfirmedCommitted = true; }, rollback() { unconfirmedRolledBack = true; } }),
    persist: () => { const error = new Error('remote confirmation unavailable'); error.portableStatePersisted = true; throw error; }
  }), /remote confirmation unavailable/);
  assert.equal(unconfirmedRolledBack, true);
  assert.equal(unconfirmedCommitted, false);
});

test('remote CAS loss revokes losing wake and reconciles authoritative assignments', () => {
  const state = intake(fresh(), 'I-CAS-LOSS');
  const plan = planAssignments(state.snapshot, config, '2026-08-30T00:00:01Z', 'c'.repeat(40));
  const authoritative = intake(fresh(), 'I-AUTHORITATIVE');
  let rolledBack = false; let reconciled = null;
  assert.throws(() => commitAssignmentsAfterWakeDispatch(state, plan.assignments, 'machine-a', '2026-08-30T00:00:01Z', {
    dispatch: () => ({
      dispatched: [{ issue_id: 'I-CAS-LOSS' }],
      commit() {}, rollback() { rolledBack = true; },
      reconcile(snapshot) { reconciled = snapshot; }
    }),
    persist: () => {
      const error = new Error('non-fast-forward');
      error.portableStateAuthorityLost = true;
      error.authoritativeState = authoritative;
      throw error;
    }
  }), /non-fast-forward/);
  assert.equal(rolledBack, false);
  assert.equal(reconciled.snapshot_hash, authoritative.snapshot.snapshot_hash);
  assert.equal(state.snapshot.work_items['I-CAS-LOSS'].state, 'READY');
});

test('portable state push race fetches and installs the authoritative winner', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-scheduler-cas-'));
  const remote = path.join(temp, 'remote.git'); const first = path.join(temp, 'first'); const second = path.join(temp, 'second');
  const git = (root, args) => {
    const run = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout); return run.stdout.trim();
  };
  try {
    fs.mkdirSync(first); fs.mkdirSync(second);
    git(temp, ['init', '--bare', remote]);
    for (const root of [first, second]) { git(root, ['init']); git(root, ['remote', 'add', 'origin', remote]); }
    const initial = fresh(); initial.machineLease = { machine_id: null, lease_epoch: 0, acquired_at: null, expires_at: null, expected_state_ref_oid: null };
    initial.oid = persistPortableState(first, initial, { push: true, message: 'initial', config });
    git(second, ['fetch', 'origin', '+refs/heads/agentops/scheduler-state:refs/remotes/origin/agentops/scheduler-state']);
    let winner = readPortableState(second, config); winner.machineLease = { machine_id: MACHINE_A, lease_epoch: 1, acquired_at: '2026-08-30T00:00:00Z', expires_at: '2026-08-30T00:30:00Z', expected_state_ref_oid: winner.oid };
    const winnerOid = persistPortableState(second, winner, { push: true, message: 'winner', config });
    const loser = { ...initial, machineLease: { machine_id: MACHINE_B, lease_epoch: 1, acquired_at: '2026-08-30T00:00:00Z', expires_at: '2026-08-30T00:30:00Z', expected_state_ref_oid: initial.oid } };
    let failure;
    try { persistPortableState(first, loser, { push: true, message: 'loser', config }); } catch (error) { failure = error; }
    assert.equal(failure?.portableStateAuthorityLost, true);
    assert.equal(failure?.authoritativeStateOid, winnerOid);
    assert.equal(readPortableState(first, config).oid, winnerOid);
    assert.equal(readPortableState(first, config).machineLease.machine_id, MACHINE_A);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('configured worker identities are unique before scheduling', () => {
  const duplicate = [config.workers[0], { ...config.workers[0], capabilities: ['review'] }];
  assert.throws(() => validateWorkers(duplicate, 3), /duplicate worker actor identity/);
  assert.throws(() => planAssignments(intake(fresh(), 'I-DUP-WORKER').snapshot, { ...config, workers: duplicate }, '2026-08-30T00:00:01Z'), /duplicate worker actor identity/);
});

test('claimed paths are canonical repository-relative identities', () => {
  assert.equal(canonicalClaimPath('src//feature\\file.js'), 'src/feature/file.js');
  assert.equal(pathsOverlap('src//feature\\file.js', 'src/feature/file.js'), true);
  for (const invalid of ['../src/file.js', 'src/../file.js', './src/file.js', '/src/file.js', 'C:\\src\\file.js']) {
    assert.throws(() => canonicalClaimPath(invalid), /claimed path/);
  }
  assert.throws(() => intake(fresh(), 'I-PATH-ESCAPE', { paths: ['src/../../outside'] }), /claimed path/);
});

test('configured repository state ref and development branch remain portable inputs', () => {
  const custom = {
    ...config,
    repository: 'https://github.com/example/portable-game.git',
    state_ref: 'refs/heads/custom/scheduler-state',
    development_branch: 'integration'
  };
  assert.deepEqual(schedulerStateRefs(custom), {
    local: 'refs/heads/custom/scheduler-state',
    branch: 'custom/scheduler-state',
    remote: 'refs/remotes/origin/custom/scheduler-state'
  });
  assert.equal(repositorySlug(custom.repository), 'example/portable-game');
  assert.equal(compileWake(claim(intake(fresh(), 'I-PORTABLE-CONFIG'), 'I-PORTABLE-CONFIG').snapshot.work_items['I-PORTABLE-CONFIG'], custom).wake.REPOSITORY, custom.repository);
  assert.equal(mergeCommandArgs(461, 'e'.repeat(40), custom).includes('example/portable-game'), true);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-scheduler-ref-'));
  try {
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const state = fresh();
    state.oid = persistPortableState(temp, state, { config: custom, message: 'custom state ref' });
    assert.equal(readPortableState(temp, custom).oid, state.oid);
    const customRef = spawnSync('git', ['rev-parse', '--verify', custom.state_ref], { cwd: temp, encoding: 'utf8' });
    const defaultRef = spawnSync('git', ['rev-parse', '--verify', config.state_ref], { cwd: temp, encoding: 'utf8' });
    assert.equal(customRef.status, 0, customRef.stderr);
    assert.notEqual(defaultRef.status, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('concurrent machine initialization accepts the EEXIST winner', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-machine-eexist-'));
  try {
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const runtime = path.join(temp, '.git', 'agentops-scheduler');
    fs.mkdirSync(runtime, { recursive: true });
    const winner = { schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_A, created_at: '2026-08-30T00:00:00Z' };
    fs.writeFileSync(path.join(runtime, 'machine.json'), `${JSON.stringify(winner)}\n`, { flag: 'wx' });
    assert.deepEqual(localMachine(temp), winner);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('existing machine identity fails closed on malformed and invalid plants', () => {
  const plants = [
    ['malformed JSON', '{'],
    ['array', []],
    ['empty object', {}],
    ['wrong schema', { schema: 'agentops/scheduler-machine/v0', machine_id: MACHINE_A, created_at: '2026-08-30T00:00:00Z' }],
    ['blank machine id', { schema: 'agentops/scheduler-machine/v1', machine_id: ' ', created_at: '2026-08-30T00:00:00Z' }],
    ['non UUID machine id', { schema: 'agentops/scheduler-machine/v1', machine_id: 'machine-a', created_at: '2026-08-30T00:00:00Z' }],
    ['invalid timestamp', { schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_A, created_at: 'not-a-time' }],
    ['undeclared key', { schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_A, created_at: '2026-08-30T00:00:00Z', hostname: 'must-not-be-portable' }]
  ];
  for (const [name, value] of plants) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-machine-invalid-'));
    try {
      const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
      assert.equal(init.status, 0, init.stderr);
      const runtime = path.join(temp, '.git', 'agentops-scheduler');
      fs.mkdirSync(runtime, { recursive: true });
      fs.writeFileSync(path.join(runtime, 'machine.json'), typeof value === 'string' ? value : `${JSON.stringify(value)}\n`);
      assert.throws(() => localMachine(temp), undefined, name);
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
});

test('portable machine lease identity fails closed on malformed, invalid, and mismatched plants', () => {
  const valid = { machine_id: MACHINE_A, lease_epoch: 1, acquired_at: '2026-08-30T00:00:00Z', expires_at: '2026-08-30T00:30:00Z', expected_state_ref_oid: 'a'.repeat(40) };
  assert.equal(validateMachineIdentity({ schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_A, created_at: '2026-08-30T00:00:00Z' }), true);
  assert.equal(validateMachineLease(valid), true);
  for (const plant of [
    [], {},
    { ...valid, machine_id: '' },
    { ...valid, machine_id: 'machine-a' },
    { ...valid, acquired_at: 'invalid' },
    { ...valid, expires_at: 'invalid' },
    { ...valid, expires_at: valid.acquired_at },
    { ...valid, expected_state_ref_oid: 'not-an-oid' },
    { ...valid, hostname: 'undeclared' }
  ]) assert.throws(() => validateMachineLease(plant));
  const machine = { schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_B, created_at: '2026-08-30T00:00:00Z' };
  assert.throws(() => ensureCustody({ machineLease: valid }, machine, Date.parse('2026-08-30T00:01:00Z')), /active machine custody required/);
});

test('resource release cannot orphan claimed, implementation, or QA work', () => {
  let claimedState = intake(fresh(), 'I-RELEASE-CLAIMED', { paths: ['src/claimed'], resources: ['generated-outputs'] });
  claimedState = claim(claimedState, 'I-RELEASE-CLAIMED');
  const claimed = claimedState.snapshot.work_items['I-RELEASE-CLAIMED'];
  const releaseClaimed = {
    event_type: 'RESOURCE_RELEASED', issue_id: claimed.issue_id, actor: claimed.assigned_actor,
    machine_id: claimed.lease_machine_id, lease_id: claimed.lease_id, lease_epoch: claimed.lease_epoch,
    exact_object: {}, created_at: '2026-08-30T00:00:02Z'
  };
  assert.throws(() => appendEvents(claimedState, [{ ...releaseClaimed, payload: {}, idempotency_key: 'release:claimed:default' }]), /requires requeue=true/);
  assert.throws(() => appendEvents(claimedState, [{ ...releaseClaimed, payload: { requeue: false }, idempotency_key: 'release:claimed:false' }]), /requires requeue=true/);
  claimedState = appendEvents(claimedState, [{ ...releaseClaimed, payload: { requeue: true, admission_evidence: claimed.project_evidence }, idempotency_key: 'release:claimed:true' }]);
  const requeuedClaim = claimedState.snapshot.work_items[claimed.issue_id];
  assert.equal(requeuedClaim.state, 'READY');
  assert.equal(requeuedClaim.assigned_actor, null);
  assert.equal(requeuedClaim.assignment_kind, null);
  assert.equal(requeuedClaim.lease_id, null);
  assert.equal(requeuedClaim.lease_expiry, null);
  assert.equal(requeuedClaim.lease_machine_id, null);
  assert.deepEqual(requeuedClaim.claimed_paths, []);
  assert.deepEqual(requeuedClaim.claimed_resources, []);

  let implementation = intake(fresh(), 'I-RELEASE-IMPLEMENTATION');
  implementation = claim(implementation, 'I-RELEASE-IMPLEMENTATION');
  implementation = entered(implementation, 'I-RELEASE-IMPLEMENTATION');
  const running = implementation.snapshot.work_items['I-RELEASE-IMPLEMENTATION'];
  const releaseRunning = {
    event_type: 'RESOURCE_RELEASED', issue_id: running.issue_id, actor: running.assigned_actor,
    machine_id: running.lease_machine_id, lease_id: running.lease_id, lease_epoch: running.lease_epoch,
    exact_object: {}, created_at: '2026-08-30T00:00:03Z'
  };
  assert.throws(() => appendEvents(implementation, [{ ...releaseRunning, payload: {}, idempotency_key: 'release:implementation:default' }]), /requires requeue=true/);
  assert.throws(() => appendEvents(implementation, [{ ...releaseRunning, payload: { requeue: false }, idempotency_key: 'release:implementation:false' }]), /requires requeue=true/);
  implementation = appendEvents(implementation, [{ ...releaseRunning, payload: { requeue: true, admission_evidence: running.project_evidence }, idempotency_key: 'release:implementation:true' }]);
  assert.equal(implementation.snapshot.work_items[running.issue_id].state, 'READY');
  assert.equal(implementation.snapshot.work_items[running.issue_id].assigned_actor, null);

  let review = intake(fresh(), 'I-RELEASE-QA'); review = claim(review, 'I-RELEASE-QA'); review = entered(review, 'I-RELEASE-QA'); review = candidate(review, 'I-RELEASE-QA');
  const reviewPlan = planAssignments(review.snapshot, config, '2026-08-30T00:00:04Z', 'c'.repeat(40));
  review = applyAssignments(review, reviewPlan.assignments, 'machine-a', '2026-08-30T00:00:04Z');
  const reviewing = review.snapshot.work_items['I-RELEASE-QA'];
  const releaseQa = {
    event_type: 'RESOURCE_RELEASED', issue_id: reviewing.issue_id, actor: reviewing.assigned_actor,
    machine_id: reviewing.lease_machine_id, lease_id: reviewing.lease_id, lease_epoch: reviewing.lease_epoch,
    exact_object: {}, created_at: '2026-08-30T00:00:05Z'
  };
  assert.throws(() => appendEvents(review, [{ ...releaseQa, payload: {}, idempotency_key: 'release:qa:default' }]), /requires requeue=true/);
  assert.throws(() => appendEvents(review, [{ ...releaseQa, payload: { requeue: false }, idempotency_key: 'release:qa:false' }]), /requires requeue=true/);
  review = appendEvents(review, [{ ...releaseQa, payload: { requeue: true, admission_evidence: reviewing.project_evidence }, idempotency_key: 'release:qa:true' }]);
  assert.equal(review.snapshot.work_items[reviewing.issue_id].state, 'CANDIDATE_READY');
  assert.equal(review.snapshot.work_items[reviewing.issue_id].assigned_actor, null);
  assert.equal(review.snapshot.work_items[reviewing.issue_id].candidate_commit, 'b'.repeat(40));
});

test('Git and GitHub subprocesses fail closed on startup errors and timeouts', () => {
  assert.throws(() => runBoundedCommand('ashenspire-command-that-does-not-exist', [], { timeoutMs: 100 }), /failed to start/);
  assert.throws(() => runBoundedCommand(process.execPath, ['--eval', 'setTimeout(() => {}, 10000)'], { timeoutMs: 50 }), /timed out/);
  assert.throws(() => runBoundedCommand(process.execPath, [], { timeoutMs: 0 }), /invalid subprocess timeout/);
});

test('quiet-window configuration keeps both scheduler and legacy watcher disabled', () => {
  assert.equal(config.cutover.scheduler_dispatch_enabled, false);
  assert.equal(config.cutover.legacy_watcher_authoritative, false);
  assert.equal(config.cutover.authorization_evidence, null);
  assert.throws(() => assertSchedulerDispatchCutover(config), /cutover is not authorized/);
  const localAssertion = { event_path: '.agentops/events/AS-SCHEDULER/fake.json', event_id: 'fake', event_hash: '0'.repeat(64) };
  const attempted = { ...config, cutover: { scheduler_dispatch_enabled: true, legacy_watcher_authoritative: false, authorization_evidence: localAssertion } };
  assert.throws(() => validateSchedulerCutoverAuthority(repoRoot, localAssertion, attempted), /SCHEDULER_CUTOVER_AUTHORITY_UNAVAILABLE/);
  assert.throws(() => assertSchedulerDispatchCutover(attempted, repoRoot), /keep legacy dispatch authoritative/);
});

test('raw merged-dev transition cannot bypass the protected merge handler', () => {
  let state = intake(fresh(), 'I-RAW-MERGE'); state = claim(state, 'I-RAW-MERGE');
  assert.throws(() => transitionInput('merged-dev', { issue: 'I-RAW-MERGE', commit: 'd'.repeat(40) }, state, { machine_id: 'machine-a' }), /unknown transition command/);
});

test('lease expiry and candidate acceptance are fenced at the declared instant', () => {
  let state = intake(fresh(), 'I-TIME-FENCE'); state = claim(state, 'I-TIME-FENCE'); state = entered(state, 'I-TIME-FENCE');
  const item = state.snapshot.work_items['I-TIME-FENCE'];
  const earlyExpiry = { event_type: 'LEASE_EXPIRED', issue_id: item.issue_id, actor: 'scheduler', machine_id: item.lease_machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: {}, payload: {}, created_at: '2026-08-30T00:29:59Z', idempotency_key: 'time-fence:early-expiry' };
  assert.throws(() => appendEvents(state, [earlyExpiry]), /cannot precede/);
  const lateCandidate = { event_type: 'CANDIDATE_READY', issue_id: item.issue_id, actor: item.assigned_actor, machine_id: item.lease_machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: 'f'.repeat(40) }, payload: { candidate_commit: 'f'.repeat(40), evidence_pointers: ['receipt:late'] }, created_at: item.lease_expiry, idempotency_key: 'time-fence:late-candidate' };
  state = appendEvents(state, [lateCandidate]);
  assert.equal(state.snapshot.work_items[item.issue_id].state, 'RUNNING');
  assert.equal(state.snapshot.work_items[item.issue_id].late_candidates[0].candidate_commit, 'f'.repeat(40));
});

test('work entry rejects expired leases and any replacement of the claimed exact base', () => {
  let state = intake(fresh(), 'I-ENTER-FENCE'); state = claim(state, 'I-ENTER-FENCE');
  const item = state.snapshot.work_items['I-ENTER-FENCE'];
  const base = { event_type: 'WORK_ENTERED', issue_id: item.issue_id, actor: item.assigned_actor, machine_id: item.lease_machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, idempotency_key: 'enter:fence' };
  assert.throws(() => appendEvents(state, [{ ...base, exact_object: { oid: item.base_commit }, payload: { base_commit: item.base_commit }, created_at: item.lease_expiry }]), /at or after lease expiry/);
  assert.throws(() => appendEvents(state, [{ ...base, idempotency_key: 'enter:replace-payload', exact_object: { oid: item.base_commit }, payload: { base_commit: 'b'.repeat(40) }, created_at: '2026-08-30T00:00:02Z' }]), /preserve the claimed exact base/);
  assert.throws(() => appendEvents(state, [{ ...base, idempotency_key: 'enter:replace-object', exact_object: { oid: 'b'.repeat(40) }, payload: { base_commit: item.base_commit }, created_at: '2026-08-30T00:00:02Z' }]), /preserve the claimed exact base/);
  assert.equal(state.snapshot.work_items[item.issue_id].state, 'CLAIMED');
  assert.equal(state.snapshot.work_items[item.issue_id].base_commit, 'a'.repeat(40));
});

test('QA result is rejected at the exact QA lease expiry', () => {
  let state = intake(fresh(), 'I-QA-EXPIRY'); state = claim(state, 'I-QA-EXPIRY'); state = entered(state, 'I-QA-EXPIRY'); state = candidate(state, 'I-QA-EXPIRY');
  let item = state.snapshot.work_items['I-QA-EXPIRY']; const actor = config.workers[1].actor; const epoch = item.lease_epoch + 1;
  state = appendEvents(state, [{ event_type: 'QA_ASSIGNED', issue_id: item.issue_id, actor, machine_id: 'machine-a', lease_id: `qa:${epoch}`, lease_epoch: epoch, exact_object: { oid: item.candidate_commit }, idempotency_key: 'qa-expiry:assign', created_at: '2026-08-30T00:00:04Z', payload: { candidate_commit: item.candidate_commit, lease_expiry: '2026-08-30T00:30:04Z' } }]);
  item = state.snapshot.work_items[item.issue_id];
  const result = { event_type: 'QA_RESULT', issue_id: item.issue_id, actor: item.assigned_actor, machine_id: item.lease_machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: item.candidate_commit }, idempotency_key: 'qa-expiry:result', created_at: item.lease_expiry, payload: { candidate_commit: item.candidate_commit, result: 'PASS', evidence_pointers: ['receipt:late'] } };
  assert.throws(() => appendEvents(state, [result]), /at or after QA lease expiry/);
  assert.equal(state.snapshot.work_items[item.issue_id].state, 'QA');
});

test('canonical glob claims collide with the repository paths they cover', () => {
  assert.equal(pathsOverlap('src/**', 'src/file.js'), true);
  assert.equal(pathsOverlap('src/**', 'src/nested/file.js'), true);
  assert.equal(pathsOverlap('src/**', 'assets/file.js'), false);
  assert.equal(pathsOverlap('*.html', 'AshenSpire.html'), true);
  assert.equal(pathsOverlap('*.html', 'build/AshenSpire.html'), false);
  assert.throws(() => pathsOverlap('src/*/file.js', 'src/ui/file.js'), /unsupported glob/);
});

test('an already merged exact PR is a recoverable persistence fact', () => {
  const item = { branch: 'codex/recovery', candidate_commit: 'a'.repeat(40) };
  const pr = {
    number: 461,
    url: 'https://github.com/example/portable-game/pull/461',
    state: 'MERGED',
    baseRefName: 'integration',
    headRefName: item.branch,
    headRefOid: item.candidate_commit,
    mergedAt: '2026-08-30T01:00:00Z',
    mergeCommit: { oid: 'b'.repeat(40) }
  };
  const custom = { ...config, development_branch: 'integration' };
  const recovery = mergedPrRecovery(custom, item, pr);
  assert.equal(recovery.recovered, true);
  assert.equal(recovery.merged.mergeCommit.oid, 'b'.repeat(40));
  assert.throws(() => mergedPrRecovery(custom, item, { ...pr, headRefOid: 'c'.repeat(40) }), /identity/);
  assert.throws(() => mergedPrRecovery(custom, item, { ...pr, mergeCommit: null }), /exact recovery identity/);
});

test('unsupported local cutover evidence cannot create or reconcile wake files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-stale-wake-'));
  try {
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const governanceDir = path.join(temp, '.agentops', 'governance'); fs.mkdirSync(governanceDir, { recursive: true });
    fs.copyFileSync(path.join(repoRoot, '.agentops', 'governance', 'owner-command.json'), path.join(governanceDir, 'owner-command.json'));
    const attempted = { ...config, cutover: { scheduler_dispatch_enabled: true, legacy_watcher_authoritative: false, authorization_evidence: { event_path: '.agentops/events/fake.json', event_id: 'fake', event_hash: '0'.repeat(64) } } };
    assert.throws(() => assertSchedulerDispatchCutover(attempted, temp), /SCHEDULER_CUTOVER_AUTHORITY_UNAVAILABLE/);
    assert.equal(fs.existsSync(path.join(temp, '.git', 'agentops-scheduler', 'dispatch')), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('unconfirmed scheduler-state push restores the prior local ref and preserves no live authority', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-unconfirmed-state-'));
  try {
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' }); assert.equal(init.status, 0, init.stderr);
    const remote = path.join(temp, 'missing-remote.git');
    const add = spawnSync('git', ['remote', 'add', 'origin', remote], { cwd: temp, encoding: 'utf8' }); assert.equal(add.status, 0, add.stderr);
    let failure = null;
    try { persistPortableState(temp, fresh(), { push: true, config, message: 'must confirm remote' }); } catch (error) { failure = error; }
    assert.equal(failure?.portableStateAuthorityUnconfirmed, true);
    const local = spawnSync('git', ['show-ref', '--verify', config.state_ref], { cwd: temp, encoding: 'utf8' });
    assert.notEqual(local.status, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('git ownership declares the scheduler source lane and portable state ref', () => {
  const ownership = JSON.parse(fs.readFileSync(path.join(repoRoot, '.agentops', 'governance', 'git-ownership.json'), 'utf8'));
  assert.equal(ownership.refs.some((entry) => entry.ref === 'agentops/scheduler-state' && entry.mutation === 'expected-old-oid-cas-only'), true);
  assert.equal(ownership.paths.some((entry) => entry.glob === '.agentops/scheduler/**' && entry.serialized_lane === 'agentops-scheduler'), true);
});

test('live transition time ignores a caller supplied backdate and recovery must remain future', () => {
  const trusted = trustedTransitionArgs({ at: '2020-01-01T00:00:00Z' }, '2026-08-30T02:00:00Z');
  assert.equal(trusted.at, '2026-08-30T02:00:00Z');
  const state = intake(fresh(), 'I-TRUSTED-TIME');
  const admissionEvidence = sealAdmissionEvidence({
    ...state.snapshot.work_items['I-TRUSTED-TIME'].project_evidence,
    observed_at: '2026-08-30T01:59:50Z', fresh_until: '2026-08-30T02:00:20Z'
  });
  const event = transitionInput('recover', {
    ...trusted,
    issue: 'I-TRUSTED-TIME', actor: config.workers[0].actor,
    lease_id: 'recovery:expired', lease_epoch: 1,
    branch: 'codex/I-TRUSTED-TIME', base_commit: 'a'.repeat(40),
    expiry: '2026-08-30T01:59:59Z', trusted_admission_evidence: admissionEvidence
  }, state, { machine_id: 'machine-a' });
  assert.throws(() => appendEvents(state, [event]), /later than the trusted event time/);
});

test('admission fails closed when Project evidence is missing, stale, or has no runnable priority and owner', () => {
  const state = intake(fresh(), 'GH-BOARD-SYNC', { paths: ['src/board-sync.js'] });
  let reconciliation = liveReconciliation(state, 'GH-BOARD-SYNC');
  let blocked = blockedAdmission(state, 'GH-BOARD-SYNC', { ...reconciliation, project_sync: { ...reconciliation.project_sync, status: 'BOARD_SYNC_FAILED' } });
  assert.deepEqual(
    { blocker: blocked.blocker, conflict_identity: blocked.conflict_identity, wake_evidence: blocked.wake_evidence },
    { blocker: 'BOARD_SYNC_FAILED', conflict_identity: `github-project:${config.project_contract.owner}/${config.project_contract.number}`, wake_evidence: 'record a fresh successful Project priority and ownership observation' }
  );
  reconciliation = { ...reconciliation, project_sync: { ...reconciliation.project_sync, observed_at: '2026-08-29T00:00:00Z' } };
  blocked = blockedAdmission(state, 'GH-BOARD-SYNC', reconciliation);
  assert.equal(blocked.blocker, 'BOARD_EVIDENCE_STALE');
  reconciliation = { ...liveReconciliation(state, 'GH-BOARD-SYNC'), project_sync: { ...liveReconciliation(state, 'GH-BOARD-SYNC').project_sync, observed_at: '2026-08-29T23:59:35.000Z' } };
  blocked = blockedAdmission(state, 'GH-BOARD-SYNC', reconciliation);
  assert.equal(blocked.blocker, 'BOARD_EVIDENCE_STALE');
  reconciliation = liveReconciliation(state, 'GH-BOARD-SYNC', { priority: null, owner_role: null });
  blocked = blockedAdmission(state, 'GH-BOARD-SYNC', reconciliation);
  assert.equal(blocked.blocker, 'PROJECT_PRIORITY_OR_OWNER_MISSING');
  reconciliation = liveReconciliation(state, 'GH-BOARD-SYNC'); delete reconciliation.project_sync.fetch_receipt;
  blocked = blockedAdmission(state, 'GH-BOARD-SYNC', reconciliation);
  assert.equal(blocked.blocker, 'BOARD_SYNC_FAILED');
  assert.match(blocked.wake_evidence, /local JSON assertions are not admission evidence/);
  for (const mutate of [
    (receipt) => { receipt.response_pages.items[0] = 'tampered-page'; },
    (receipt) => { delete receipt.response_pages; },
    (receipt) => { receipt.response_pages.items.reverse(); }
  ]) {
    reconciliation = liveReconciliation(state, 'GH-BOARD-SYNC');
    const receipt = reconciliation.project_sync.fetch_receipt;
    mutate(receipt); delete receipt.receipt_hash; receipt.receipt_hash = sha256(receipt);
    blocked = blockedAdmission(state, 'GH-BOARD-SYNC', reconciliation);
    assert.equal(blocked.blocker, 'BOARD_SYNC_FAILED');
  }
});

test('numeric hash and GitHub URL issue aliases collapse to one canonical work item', () => {
  assert.equal(canonicalIssueIdentity('426'), '#426');
  assert.equal(canonicalIssueIdentity('#0426'), '#426');
  assert.equal(canonicalIssueIdentity('https://github.com/cehinds/AshenSpire/issues/426'), '#426');
  assert.throws(() => canonicalIssueIdentity(undefined), /issue identity/);
  const state = intake(fresh(), '426', { paths: ['src/canonical-426.js'] });
  assert.deepEqual(Object.keys(state.snapshot.work_items), ['#426']);
  for (const alias of ['426', '#426', 'https://github.com/cehinds/AshenSpire/issues/426']) {
    assert.equal(resolveCanonicalIssue(state.snapshot, alias).canonical_issue_id, '#426');
  }
  const aliasInput = { ...state.events[0], event_id: null, issue_id: 'https://github.com/cehinds/AshenSpire/issues/426', idempotency_key: 'intake:url-alias' };
  assert.throws(() => appendEvents(state, [aliasInput]), /duplicate (canonical )?issue intake/);
});

test('assignee-only identity is existing custody and cannot receive a second scheduler seat', () => {
  const issue = 'GH-ASSIGNEE';
  const state = intake(fresh(), issue, { paths: ['src/assignee.js'] });
  let blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, { assignees: ['alice'] }));
  assert.equal(blocked.blocker, 'ASSIGNEE_CUSTODY_UNMAPPED');
  assert.equal(blocked.conflict_identity, 'alice');
  blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, { assignees: ['alice'], external_claims: [{ claim_id: 'claim:alice', actor: 'alice', status: 'EXPIRED', terminal_event: 'RELEASED' }] }));
  assert.equal(blocked.blocker, 'ASSIGNEE_CUSTODY_UNMAPPED');
});

test('mapped worktree custody requires complete exact scope and explicit release before reassignment', () => {
  const issue = 'GH-WORKTREE';
  const state = intake(fresh(), issue, { branch: 'codex/GH-WORKTREE', paths: ['src/worktree.js'] });
  const base = { identity: 'worktree:codex/GH-WORKTREE:abc', head: 'a'.repeat(40), branch: 'codex/GH-WORKTREE', custody: 'MAPPED', issue_id: issue, claim_id: 'claim:worktree', claim_verified: false };
  let blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, {}, { worktrees: [{ ...base, scope_complete: false, claimed_paths: [], claimed_resources: [] }] }));
  assert.equal(blocked.blocker, 'WORKTREE_MAPPING_INVALID');
  blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, {}, { worktrees: [{ ...base, scope_complete: true, claimed_paths: ['src/worktree.js'], claimed_resources: [] }] }));
  assert.equal(blocked.blocker, 'WORKTREE_MAPPING_UNVERIFIED');
  const verifiedBase = { ...base, claim_verified: true };
  blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, {}, { worktrees: [{ ...verifiedBase, scope_complete: true, claimed_paths: ['src/other.js'], claimed_resources: [] }] }));
  assert.equal(blocked.blocker, 'WORKTREE_CLAIM_MISMATCH');
  blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, {}, { worktrees: [{ ...verifiedBase, scope_complete: true, claimed_paths: ['src/worktree.js'], claimed_resources: [] }] }));
  assert.equal(blocked.blocker, 'WORKTREE_EXISTING_CUSTODY');
  assert.match(blocked.wake_evidence, /RELEASED or SUPERSEDED/);
});

test('closed GitHub issues are terminal even when Project resolution says completed', () => {
  const issue = 'GH-CLOSED';
  const state = intake(fresh(), issue, { paths: ['src/closed.js'] });
  const reconciliation = liveReconciliation(state, issue, { issue_state: 'CLOSED', issue_resolution: 'COMPLETED', status: 'READY' });
  const blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'ISSUE_CLOSED_TERMINAL');
  assert.equal(blocked.conflict_identity, 'COMPLETED');
  assert.throws(() => intakeAdmissionEvidence(emptySnapshot(), issue, { priority: 'P2', branch: 'codex/GH-CLOSED', claimed_paths: ['src/closed.js'], claimed_resources: [] }, { ...config, simulation_mode: false }, '2026-08-30T00:00:05.000Z', reconciliation), /ISSUE_CLOSED_TERMINAL/);
});

test('GitHub Project admission is built from an authenticated read-project fetch receipt', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-project-fetch-'));
  try {
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' }); assert.equal(init.status, 0, init.stderr);
    const runtime = path.join(temp, '.git', 'agentops-scheduler'); fs.mkdirSync(runtime, { recursive: true });
    fs.writeFileSync(path.join(runtime, 'project-source.json'), `${JSON.stringify({ schema: 'agentops/scheduler-project-source/v1', repository: repositorySlug(config.repository), owner: 'cehinds', number: 4 })}\n`);
    const requiredFields = ['Scheduler Status', 'Priority', 'Owner Role', 'Affected Paths', 'Affected Resources', 'Dependencies', 'External Claims', 'Human Gate', 'Scope Complete'];
    const fieldNodes = requiredFields.map((name, index) => ({
      id: config.project_contract.fields[name]?.id ?? `field-${index}`,
      name,
      __typename: config.project_contract.fields[name].kind,
      dataType: config.project_contract.fields[name].data_type,
      options: structuredClone(config.project_contract.fields[name].options ?? [])
    }));
    const values = {
      'Scheduler Status': 'READY', Priority: 'P1', 'Owner Role': 'maker',
      'Affected Paths': JSON.stringify(['src/receipt.js']), 'Affected Resources': '[]', Dependencies: '[]',
      'External Claims': '[]', 'Human Gate': '', 'Scope Complete': 'TRUE'
    };
    const itemNodes = [{
      id: 'PVTI_test_426',
      content: { __typename: 'Issue', number: 426, repository: { nameWithOwner: repositorySlug(config.repository) }, state: 'OPEN', stateReason: null, assignees: { totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] } },
      fieldValues: { totalCount: requiredFields.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: requiredFields.map((name) => {
        const expected = config.project_contract.fields[name];
        return expected.kind === 'ProjectV2SingleSelectField'
          ? { __typename: 'ProjectV2ItemFieldSingleSelectValue', field: { id: expected.id, name }, name: values[name], optionId: expected.options[0].id }
          : { __typename: 'ProjectV2ItemFieldTextValue', field: { id: expected.id, name }, text: values[name] };
      }) }
    }];
    itemNodes[0].fieldValues.nodes.push({ __typename: 'ProjectV2ItemFieldRepositoryValue' });
    itemNodes[0].fieldValues.totalCount += 1;
    const projectIdentity = { id: config.project_contract.id, title: config.project_contract.title, number: 4 };
    const itemResponse = () => ({ data: { user: { projectV2: { ...projectIdentity, items: { totalCount: 1, pageInfo: { hasNextPage: false, endCursor: null }, nodes: itemNodes } } } } });
    const fieldResponse = () => ({ data: { user: { projectV2: { ...projectIdentity, fields: { totalCount: fieldNodes.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: fieldNodes } } } } });
    const runner = (command, args) => {
      assert.equal(command, 'gh');
      if (args[0] === 'auth') return { status: 0, stdout: '', stderr: "Logged in to github.com account test-owner\nToken scopes: 'repo', 'read:project'" };
      if (args[0] === 'api' && args[1] === 'graphql') {
        const query = args.find((value) => value.startsWith('query=')) ?? '';
        return { status: 0, stdout: JSON.stringify(query.includes('items(first:100') ? itemResponse() : fieldResponse()), stderr: '' };
      }
      throw new Error(`unexpected gh call ${args.join(' ')}`);
    };
    const sync = fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', runner);
    assert.equal(sync.status, 'OK');
    assert.equal(sync.issues['#426'].canonical_issue_id, '#426');
    assert.equal(sync.fetch_receipt.authenticated_login, 'test-owner');
    assert.equal(sync.fetch_receipt.granted_scopes.includes('read:project'), true);
    assert.equal(sync.fetch_receipt.project_item_count, sync.fetch_receipt.project_total_item_count);
    assert.equal(sync.fetch_receipt.project_field_count, sync.fetch_receipt.project_total_field_count);
    assert.equal(sync.fetch_receipt.receipt_hash, sha256(Object.fromEntries(Object.entries(sync.fetch_receipt).filter(([key]) => key !== 'receipt_hash'))));
    const truncatedRunner = (command, args) => {
      const result = runner(command, args);
      const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      if (parsed?.data?.user?.projectV2?.items) { parsed.data.user.projectV2.items.totalCount = 2; return { ...result, stdout: JSON.stringify(parsed) }; }
      return result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', truncatedRunner), /truncated GitHub Project items response/);
    const malformedRunner = (command, args) => {
      const result = runner(command, args);
      const malformed = result.stdout ? JSON.parse(result.stdout) : null;
      const nodes = malformed?.data?.user?.projectV2?.items?.nodes;
      if (nodes) { nodes[0].fieldValues.nodes.find((value) => value.field.name === 'Dependencies').text = '{not-json'; return { ...result, stdout: JSON.stringify(malformed) }; }
      return result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', malformedRunner), /Dependencies is not valid JSON/);
    const wrongTypeRunner = (command, args) => {
      const result = runner(command, args); const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const field = parsed?.data?.user?.projectV2?.fields?.nodes?.find((candidate) => candidate.name === 'Affected Paths');
      if (field) field.dataType = 'NUMBER';
      return parsed ? { ...result, stdout: JSON.stringify(parsed) } : result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', wrongTypeRunner), /field contract mismatch for Affected Paths/);
    const alteredOptionRunner = (command, args) => {
      const result = runner(command, args); const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const field = parsed?.data?.user?.projectV2?.fields?.nodes?.find((candidate) => candidate.name === 'Priority');
      if (field) field.options[0].name = 'P0';
      return parsed ? { ...result, stdout: JSON.stringify(parsed) } : result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', alteredOptionRunner), /select option contract mismatch for Priority/);
    const nestedTruncationRunner = (command, args) => {
      const result = runner(command, args); const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const assignees = parsed?.data?.user?.projectV2?.items?.nodes?.[0]?.content?.assignees;
      if (assignees) assignees.totalCount = 1;
      return parsed ? { ...result, stdout: JSON.stringify(parsed) } : result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', nestedTruncationRunner), /assignees connection is incomplete or truncated/);
    const fieldValueTruncationRunner = (command, args) => {
      const result = runner(command, args); const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      const valuesConnection = parsed?.data?.user?.projectV2?.items?.nodes?.[0]?.fieldValues;
      if (valuesConnection) valuesConnection.pageInfo.hasNextPage = true;
      return parsed ? { ...result, stdout: JSON.stringify(parsed) } : result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', fieldValueTruncationRunner), /fieldValues connection is incomplete or truncated/);
    const graphqlErrorRunner = (command, args) => {
      const result = runner(command, args); const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      if (parsed?.data?.user?.projectV2?.items) parsed.errors = [{ message: 'partial response' }];
      return parsed ? { ...result, stdout: JSON.stringify(parsed) } : result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', graphqlErrorRunner), /GraphQL response contains errors/);
    const missingPageInfoRunner = (command, args) => {
      const result = runner(command, args); const parsed = result.stdout ? JSON.parse(result.stdout) : null;
      if (parsed?.data?.user?.projectV2?.items) delete parsed.data.user.projectV2.items.pageInfo.hasNextPage;
      return parsed ? { ...result, stdout: JSON.stringify(parsed) } : result;
    };
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', missingPageInfoRunner), /connection is incomplete/);
    assert.throws(() => fetchAuthenticatedProjectEvidence(temp, { ...config, simulation_mode: false }, '2026-08-30T00:00:05Z', (command, args) => args[0] === 'auth' ? { status: 0, stdout: '', stderr: 'Logged in to github.com account test-owner\nToken scopes: repo' } : runner(command, args)), /lacks read:project/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('caller-supplied admission JSON cannot bypass the trusted GitHub Project reconciliation path', () => {
  const issue = 'GH-FORGED-ADMISSION';
  const state = intake(fresh(), issue, { paths: ['src/forged-admission.js'] });
  const item = state.snapshot.work_items[issue];
  const event = transitionInput('claim', {
    issue, actor: config.workers[0].actor, lease_id: 'lease:forged', lease_epoch: 1,
    base_commit: 'a'.repeat(40), expiry: '2026-08-30T00:30:01Z', at: '2026-08-30T00:00:01Z',
    admission_evidence: JSON.stringify(item.project_evidence)
  }, state, { machine_id: 'machine-a' });
  assert.equal(event.payload.admission_evidence, null);
  assert.throws(() => appendEvents(state, [event]), /fresh authenticated admission evidence/);
});

test('issue 426-shaped continuity work waits for precursor termination and the live governance-docs lease', () => {
  const issue = 'GH-426';
  const state = intake(fresh(), issue, { ownerRole: 'project-management-lead', paths: ['docs/governance/continuity.json'] });
  const precursor = { claim_id: 'claim:continuity-precursor', actor: 'project-management-lead', status: 'ACTIVE', terminal_event: null };
  const lease = { id: 'lease-AS-HD-054-project-management-lead', ref: 'recovery/as-hd-054', path_globs: ['docs/governance/**'], resources: [], revoked: false, terminal_event: null };
  let reconciliation = liveReconciliation(state, issue, { external_claims: [precursor] }, { agentops_leases: [lease] });
  let blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'EXTERNAL_CLAIM_ACTIVE');
  assert.equal(blocked.conflict_identity, precursor.claim_id);
  reconciliation = liveReconciliation(state, issue, { external_claims: [{ ...precursor, terminal_event: 'SUPERSEDED' }] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'AGENTOPS_LEASE_CONFLICT');
  assert.equal(blocked.conflict_identity, lease.id);
  assert.match(blocked.wake_evidence, /RELEASED or SUPERSEDED/);
});

test('issue 194-shaped paused work requires reprioritization, its artifact decision, and the tools lane', () => {
  const issue = 'GH-194';
  const state = intake(fresh(), issue, { ownerRole: 'it-support', paths: ['tools/gallery-runner.mjs'] });
  const decision = { status: 'UNRESOLVED', decision_id: 'artifact-policy', wake_condition: 'record the exact gallery artifact policy decision' };
  const lease = { id: 'lease:tools-current-writer', ref: 'recovery/tools-current-writer', path_globs: ['tools/**'], resources: [], revoked: false, terminal_event: null };
  let reconciliation = liveReconciliation(state, issue, { status: 'PAUSED', wake_condition: 'explicitly reprioritize the paused issue', human_gate: decision }, { agentops_leases: [lease] });
  let blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'PROJECT_STATUS_PAUSED');
  assert.equal(blocked.wake_evidence, 'explicitly reprioritize the paused issue');
  reconciliation = liveReconciliation(state, issue, { human_gate: decision }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'HUMAN_DECISION_REQUIRED');
  assert.equal(blocked.conflict_identity, decision.decision_id);
  reconciliation = liveReconciliation(state, issue, { human_gate: { ...decision, status: 'RESOLVED' } }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'AGENTOPS_LEASE_CONFLICT');
  assert.equal(blocked.conflict_identity, lease.id);
});

test('issue 313-shaped work resolves contradictory identity, expired claim, complete scope, and tools custody in order', () => {
  const issue = 'GH-313';
  const state = intake(fresh(), issue, { ownerRole: 'it-support', paths: ['tools/targeting-probe.mjs'] });
  const expired = { claim_id: 'claim:GH-313:old', actor: 'old-seat', status: 'EXPIRED', terminal_event: null };
  const lease = { id: 'lease:tools-active', ref: 'recovery/tools-active', path_globs: ['tools/**'], resources: [], revoked: false, terminal_event: null };
  let reconciliation = liveReconciliation(state, issue, { assignees: ['new-seat'], external_claims: [expired], scope_complete: false, claimed_paths: [] }, { agentops_leases: [lease] });
  let blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'CONTRADICTORY_ASSIGNMENT_STATE');
  assert.match(blocked.conflict_identity, /old-seat/); assert.match(blocked.conflict_identity, /new-seat/);
  reconciliation = liveReconciliation(state, issue, { assignees: [], external_claims: [expired], scope_complete: false, claimed_paths: [] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'EXPIRED_EXTERNAL_CLAIM_UNSUPERSEDED');
  assert.equal(blocked.conflict_identity, expired.claim_id);
  const released = { ...expired, terminal_event: 'RELEASED' };
  reconciliation = liveReconciliation(state, issue, { assignees: [], external_claims: [released], scope_complete: false, claimed_paths: [] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'INCOMPLETE_AFFECTED_SCOPE');
  reconciliation = liveReconciliation(state, issue, { assignees: [], external_claims: [released], claimed_paths: ['src/targeting.js'] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'AFFECTED_SCOPE_CONTRADICTION');
  reconciliation = liveReconciliation(state, issue, { assignees: [], external_claims: [released] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'AGENTOPS_LEASE_CONFLICT');
  assert.equal(blocked.conflict_identity, lease.id);
});

test('unmapped live worktree custody and duplicate canonical intake both fail closed', () => {
  const issue = 'GH-CUSTODY';
  const state = intake(fresh(), issue, { paths: ['src/custody.js'] });
  const unknown = { identity: 'worktree:codex/unmapped:deadbeef', head: 'deadbeef', branch: 'codex/unmapped', custody: 'UNKNOWN' };
  const blocked = blockedAdmission(state, issue, liveReconciliation(state, issue, {}, { worktrees: [unknown] }));
  assert.equal(blocked.blocker, 'WORKTREE_CUSTODY_UNKNOWN');
  assert.equal(blocked.conflict_identity, unknown.identity);
  assert.match(blocked.wake_evidence, /map the live worktree/);
  const duplicate = { ...state.events[0], event_id: null, idempotency_key: 'intake:duplicate-canonical' };
  assert.throws(() => appendEvents(state, [duplicate]), /duplicate (canonical )?issue intake/);
});

test('pre-migration sync push cannot publish a preserved local-ahead state commit', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-sync-push-'));
  const remote = path.join(temp, 'remote.git'); const work = path.join(temp, 'work');
  const git = (root, args) => {
    const run = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout); return run.stdout.trim();
  };
  try {
    fs.mkdirSync(work); git(temp, ['init', '--bare', remote]); git(work, ['init']); git(work, ['remote', 'add', 'origin', remote]);
    const configDir = path.join(work, '.agentops', 'scheduler'); fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
    const initial = fresh(); initial.oid = persistPortableState(work, initial, { push: true, config, message: 'initial' });
    const advanced = { ...initial, machineLease: { machine_id: MACHINE_A, lease_epoch: 1, acquired_at: '2026-08-30T00:00:00Z', expires_at: '2026-08-30T00:30:00Z', expected_state_ref_oid: initial.oid } };
    const localOid = persistPortableState(work, advanced, { push: false, config, message: 'local ahead' });
    assert.throws(() => main(['sync', '--push'], work), /SCHEDULER_STATE_MIGRATION_REQUIRED/);
    const remoteOid = git(work, ['ls-remote', 'origin', config.state_ref]).split(/\s+/)[0];
    assert.equal(remoteOid, initial.oid);
    assert.notEqual(remoteOid, localOid);
    assert.equal(fs.existsSync(path.join(work, '.git', 'agentops-scheduler', 'machine.json')), false);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('frozen numeric v1 events replay only when event_version is absent', () => {
  const fixture = schedulerV1CompatFixture(reduceEvents);
  const sourceBytes = fixture.events.map((event) => JSON.stringify(event));
  const replay = reduceEvents(fixture.events);
  assert.equal(replay.errors.length, 0);
  assert.equal(replay.schema, 'agentops/scheduler-snapshot/v1');
  assert.equal(replay.work_items['00422'].state, 'CLAIMED');
  assert.equal(fixture.events.every((event) => schedulerEventVersion(event) === 1), true);
  assert.deepEqual(fixture.events.map((event) => JSON.stringify(event)), sourceBytes);
  assert.throws(() => validateEvent({ ...fixture.events[0], event_version: 1 }), /must omit event_version/);
});

test('exact 16-event numeric checkpoint preserves blob identities and rejects exact-object tampering', () => {
  const fixture = exactV1NumericCheckpoint169333();
  assert.equal(fixture.events.length, 16);
  for (const entry of fixture.entries) {
    const header = `blob ${Buffer.byteLength(entry.raw)}\0`;
    const oid = crypto.createHash('sha1').update(header).update(entry.raw).digest('hex');
    assert.equal(oid, entry.oid);
  }
  const replay = reduceEvents(fixture.events);
  assert.equal(replay.errors.length, 0);
  assert.equal(replay.snapshot_hash, fixture.snapshot_hash);
  assert.deepEqual(Object.fromEntries(Object.entries(replay.work_items).map(([id, item]) => [id, item.state])), {
    396: 'SUPERSEDED', 422: 'CLAIMED', 426: 'CLAIMED', 468: 'CLAIMED', 470: 'PR_OPEN'
  });
  assert.equal(fixture.events.every((event) => !Object.prototype.hasOwnProperty.call(event, 'event_version')), true);
  const tampered = structuredClone(fixture.events);
  const candidate = tampered.find((event) => event.event_type === 'CANDIDATE_READY');
  candidate.exact_object.oid = 'f'.repeat(40);
  assert.match(reduceEvents(tampered).errors.find((error) => error.event_id === candidate.event_id).error, /exact object and payload disagree/);
});

test('single v2 migration boundary canonicalizes and quarantines legacy authority', () => {
  const fixture = schedulerV1CompatFixture(reduceEvents);
  const snapshot = reduceEvents(fixture.events);
  const eventBlobs = {
    'journal/00000001-legacy-intake-00422.json': '3'.repeat(40),
    'journal/00000002-legacy-claim-00422.json': '4'.repeat(40)
  };
  const source = { oid: fixture.source_state_oid, events: fixture.events, eventBlobs, snapshot, machineLease: null, stateVersion: '1' };
  const migrated = migrateFixture(source, fixture.source_state_tree);
  assert.equal(migrated.stateVersion, '2');
  assert.equal(migrated.events.length, 3);
  assert.equal(migrated.events[2].event_type, 'STATE_MIGRATED');
  assert.equal(migrated.snapshot.schema, 'agentops/scheduler-snapshot/v2');
  assert.deepEqual(Object.keys(migrated.snapshot.work_items), ['#422']);
  const item = migrated.snapshot.work_items['#422'];
  assert.equal(item.state, 'MIGRATION_QUARANTINED');
  assert.equal(item.assigned_actor, null);
  assert.equal(item.migration_quarantine.prior_assignments[0].assigned_actor, 'seat:legacy:00000000-0000-4000-8000-000000000422');
  assert.deepEqual(item.claimed_paths, ['src/legacy/**']);
  assert.equal(migrated.snapshot.migration.legacy_journal_manifest_hash, legacyJournalManifestHash(eventBlobs));
  assert.equal(migrated.snapshot.migration.dispatch_frozen, true);
  assert.equal(validatePortableStateVersion(migrated), true);
  assert.deepEqual(migrated.events.slice(0, 2), fixture.events);

  const missingVersionAfterBoundary = { ...fixture.events[0], event_id: 'legacy-after-boundary', idempotency_key: 'legacy-after-boundary', sequence: 4, previous_snapshot_hash: migrated.snapshot.snapshot_hash };
  assert.match(reduceEvents([...migrated.events, missingVersionAfterBoundary]).errors.at(-1).error, /forbidden after/);
  const duplicateBoundary = { ...migrated.events[2], event_id: 'second-boundary', idempotency_key: 'second-boundary', sequence: 4, previous_snapshot_hash: migrated.snapshot.snapshot_hash };
  assert.match(reduceEvents([...migrated.events, duplicateBoundary]).errors.at(-1).error, /duplicate STATE_MIGRATED/);
  assert.throws(() => validatePortableStateVersion({ ...migrated, stateVersion: '1' }), /boundary-free v1/);
});

test('v2 exact-object pairs fail closed and read-only status creates no machine identity', () => {
  const fixture = schedulerV1CompatFixture(reduceEvents);
  const snapshot = reduceEvents(fixture.events);
  const source = { oid: fixture.source_state_oid, events: fixture.events, eventBlobs: {}, snapshot, machineLease: null, stateVersion: '1' };
  const migrated = migrateFixture(source, fixture.source_state_tree);
  assert.throws(() => makeEvent(migrated.snapshot, { event_type: 'CLAIM_ACQUIRED', issue_id: '#422', actor: config.workers[0].actor, machine_id: 'machine-v2', lease_id: 'lease-v2', lease_epoch: 2, exact_object: { base_commit: 'a'.repeat(40) }, payload: { base_commit: 'b'.repeat(40) }, created_at: '2026-08-30T02:00:01.000Z' }), /exact object and payload disagree/);
  assert.throws(() => makeEvent(migrated.snapshot, { event_type: 'CANDIDATE_READY', issue_id: '#422', actor: config.workers[0].actor, machine_id: 'machine-v2', lease_id: 'lease-v2', lease_epoch: 2, exact_object: { oid: 'a'.repeat(40) }, payload: { candidate_commit: 'a'.repeat(40), evidence_pointers: ['coop-hand-parity: WITHHOLD timeout'] }, created_at: '2026-08-30T02:00:01.000Z' }), /negative or WITHHOLD/);
  assert.throws(() => makeEvent(migrated.snapshot, { event_type: 'QA_RESULT', issue_id: '#422', actor: config.workers[1].actor, machine_id: 'machine-v2', lease_id: 'qa-v2', lease_epoch: 3, exact_object: { oid: 'a'.repeat(40) }, payload: { candidate_commit: 'a'.repeat(40), result: 'PASS', evidence_pointers: ['receipt:qa:FAIL'] }, created_at: '2026-08-30T02:00:01.000Z' }), /negative or WITHHOLD/);
  assert.doesNotThrow(() => makeEvent(migrated.snapshot, { event_type: 'QA_RESULT', issue_id: '#422', actor: config.workers[1].actor, machine_id: 'machine-v2', lease_id: 'qa-v2', lease_epoch: 3, exact_object: { oid: 'a'.repeat(40) }, payload: { candidate_commit: 'a'.repeat(40), result: 'FAIL', evidence_pointers: ['receipt:qa:FAIL'] }, created_at: '2026-08-30T02:00:01.000Z' }));

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-status-guard-'));
  try {
    fs.mkdirSync(path.join(temp, '.agentops', 'scheduler'), { recursive: true });
    fs.mkdirSync(path.join(temp, '.agentops', 'governance'), { recursive: true });
    fs.copyFileSync(path.join(toolDir, '..', 'scheduler', 'config.json'), path.join(temp, '.agentops', 'scheduler', 'config.json'));
    fs.copyFileSync(path.join(repoRoot, '.agentops', 'governance', 'git-ownership.json'), path.join(temp, '.agentops', 'governance', 'git-ownership.json'));
    assert.equal(spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' }).status, 0);
    assert.equal(main(['status'], temp), 0);
    assert.equal(fs.existsSync(path.join(temp, '.git', 'agentops-scheduler', 'machine.json')), false);
    assert.throws(() => assertCandidatePortable(temp, { branch: 'codex/missing-candidate', candidate_commit: 'a'.repeat(40) }), /not readable/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('every operational command is side-effect-free on v1 and blocked on frozen v2', () => {
  const commands = schedulerCommandsByClass('OPERATIONAL');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-command-matrix-'));
  try {
    fs.mkdirSync(path.join(temp, '.agentops', 'scheduler'), { recursive: true });
    fs.mkdirSync(path.join(temp, '.agentops', 'governance'), { recursive: true });
    fs.copyFileSync(path.join(toolDir, '..', 'scheduler', 'config.json'), path.join(temp, '.agentops', 'scheduler', 'config.json'));
    fs.copyFileSync(path.join(repoRoot, '.agentops', 'governance', 'git-ownership.json'), path.join(temp, '.agentops', 'governance', 'git-ownership.json'));
    assert.equal(spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' }).status, 0);
    for (const command of commands) assert.throws(() => main([command], temp), command === 'bootstrap' ? /SCHEDULER_BOOTSTRAP_AUTHORITY_REQUIRED/ : /SCHEDULER_STATE_MIGRATION_REQUIRED/);
    assert.equal(fs.existsSync(path.join(temp, '.git', 'agentops-scheduler')), false);
    const ref = spawnSync('git', ['show-ref'], { cwd: temp, encoding: 'utf8' });
    assert.equal(ref.stdout, '');

    const fixture = schedulerV1CompatFixture(reduceEvents);
    const source = { oid: fixture.source_state_oid, events: fixture.events, eventBlobs: {}, snapshot: reduceEvents(fixture.events), machineLease: null, stateVersion: '1' };
    const migrated = migrateFixture(source, fixture.source_state_tree);
    for (const command of commands) assert.throws(() => assertSchedulerCommandAllowed(command, migrated, config, temp), /PRE_CUTOVER_MUTATION_BLOCKED/);
    assert.throws(() => main(['pr-open'], temp), /not accepted as a raw/);
    assert.throws(() => main(['merged-dev'], temp), /not accepted as a raw/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

if (!process.exitCode) process.stdout.write(`1..${passed}\nPASS ${passed}/${passed}\n`);
