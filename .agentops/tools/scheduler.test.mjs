#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  appendEvents, applyAssignments, assertPortable, assertSchedulerDispatchCutover, beginWakeDispatch, canonicalClaimPath, claimsConflict, commitAssignmentsAfterWakeDispatch, compareAndSwap, compileWake, ensureCustody,
  emptySnapshot, historyAdvanceAllowed, main, makeEvent, mergeCommandArgs, mergeGateResult, mergedPrRecovery, pathsOverlap, planAssignments,
  localMachine, persistPortableState, protectedTransitionAllowed, readConfig, readPortableState, reduceEvents, repositorySlug, resolveCanonicalIssue,
  runBoundedCommand, schedulerStateRefs, sealAdmissionEvidence, sha256, simulate, snapshotsMatch, stableStringify, transitionInput, trustedTransitionArgs, validateEvent, validateMachineIdentity, validateMachineLease, validateSchedulerCutoverAuthority, validateSchedulerDocument, validateWorkers, watcherPlan
} from './scheduler.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..', '..');
const config = {
  ...readConfig(path.resolve(toolDir, '..')),
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

function fresh() { return { oid: null, events: [], snapshot: emptySnapshot(), machineLease: null, stateVersion: '1' }; }
function cutoverFixture(root) {
  const git = (args) => {
    const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    return run.stdout.trim();
  };
  if (!fs.existsSync(path.join(root, '.git'))) git(['init']);
  fs.writeFileSync(path.join(root, 'state-seed'), 'state\n');
  git(['add', 'state-seed']);
  git(['-c', 'user.name=Scheduler Test', '-c', 'user.email=scheduler@test.invalid', 'commit', '-m', 'state seed']);
  const stateOid = git(['rev-parse', 'HEAD']);
  git(['update-ref', config.state_ref, stateOid]);
  const governance = path.join(root, '.agentops', 'governance');
  const eventDir = path.join(root, '.agentops', 'events', 'AS-SCHEDULER');
  fs.mkdirSync(governance, { recursive: true }); fs.mkdirSync(eventDir, { recursive: true });
  fs.copyFileSync(path.join(repoRoot, '.agentops', 'governance', 'owner-command.json'), path.join(governance, 'owner-command.json'));
  fs.copyFileSync(path.join(repoRoot, '.agentops', 'governance', 'owner-intent.json'), path.join(governance, 'owner-intent.json'));
  const event = {
    schema: 'agentops/event/v1', id: 'AS-SCHEDULER-0001', ticket: 'AS-SCHEDULER', seq: 1, parent_event: null,
    kind: 'owner-decision', actor: 'owner', at: '2026-08-30T00:00:00Z', summary: `Owner-command 'authorize-scheduler-cutover' by owner recorded for exact scheduler-state ${stateOid}.`,
    decision: { action: 'authorize-scheduler-cutover', authenticated_role: 'owner', target: 'AS-SCHEDULER', expected_current_hash: `sha256:${'a'.repeat(64)}`, candidate_oid: stateOid }
  };
  const eventPath = '.agentops/events/AS-SCHEDULER/AS-SCHEDULER-0001.json';
  fs.writeFileSync(path.join(root, ...eventPath.split('/')), `${JSON.stringify(event, null, 2)}\n`);
  const authorization_evidence = { event_path: eventPath, event_id: event.id, event_hash: sha256(event) };
  return { event, eventPath, stateOid, authorization_evidence, authorized: { ...config, cutover: { scheduler_dispatch_enabled: true, legacy_watcher_authoritative: false, authorization_evidence } } };
}
function intake(state, issue, options = {}) {
  const observedAt = options.observedAt ?? '2026-08-30T00:00:00.000Z';
  const projectEvidence = sealAdmissionEvidence({
    schema: 'agentops/scheduler-admission/v1', canonical_issue_id: issue, board_sync_status: 'OK',
    project_priority: options.priority ?? 'P2', project_owner_role: options.ownerRole ?? 'maker', project_status: 'READY',
    scope_complete: true, dependencies_ready: true, human_gate_clear: true, external_claim_clear: true,
    conflict_identities: [], observed_at: observedAt, fresh_until: options.freshUntil ?? '2026-08-30T00:30:00.000Z'
  });
  return appendEvents(state, [{
    event_type: 'INTAKE_RECORDED', issue_id: issue, actor: 'intake', machine_id: 'machine-a',
    exact_object: { issue }, idempotency_key: `intake:${issue}`, created_at: '2026-08-30T00:00:00.000Z',
    payload: { title: options.title ?? issue, priority: options.priority ?? 'P2', dependencies: options.dependencies ?? [], branch: options.branch ?? `codex/${issue}`, claimed_paths: options.paths ?? [`src/${issue}`], claimed_resources: options.resources ?? [], acceptance_commands: ['node test'], evidence_pointers: [], next_action: 'work', authority_ceiling: 'dev-delivery', project_evidence: projectEvidence }
  }]);
}
function claim(state, issue, actor = 'seat:test:00000000-0000-4000-8000-000000000001', epoch = 1) {
  const item = state.snapshot.work_items[issue];
  return appendEvents(state, [{ event_type: 'CLAIM_ACQUIRED', issue_id: issue, actor, machine_id: 'machine-a', lease_id: `lease:${issue}:${epoch}`, lease_epoch: epoch, exact_object: {}, idempotency_key: `claim:${issue}:${epoch}`, created_at: '2026-08-30T00:00:01.000Z', payload: { branch: item.branch, base_commit: 'a'.repeat(40), lease_expiry: '2026-08-30T00:30:01.000Z', claimed_paths: item.claimed_paths, claimed_resources: item.claimed_resources, next_action: 'work', admission_evidence: item.project_evidence } }]);
}
function liveReconciliation(state, issue, projectOverrides = {}, environmentOverrides = {}) {
  const item = state.snapshot.work_items[issue];
  return {
    project_sync: {
      status: 'OK', observed_at: '2026-08-30T00:00:05.000Z', source_id: 'github-project',
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

test('26 quiet no-change watcher cycle', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-scheduler-quiet-'));
  try {
    fs.mkdirSync(path.join(temp, '.agentops', 'scheduler'), { recursive: true });
    fs.copyFileSync(path.join(toolDir, '..', 'scheduler', 'config.json'), path.join(temp, '.agentops', 'scheduler', 'config.json'));
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const moduleUrl = pathToFileURL(path.join(toolDir, 'scheduler.mjs')).href;
    const script = `import(${JSON.stringify(moduleUrl)}).then(({main}) => { process.exitCode = main(['watch'], ${JSON.stringify(temp)}); })`;
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: temp, encoding: 'utf8', timeout: 5000 });
    assert.equal(run.status, 0, run.stderr); assert.equal(run.stdout, '');
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
  let state = intake(fresh(), '461'); state = claim(state, '461'); state = entered(state, '461'); state = candidate(state, '461'); state = qa(state, '461');
  state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: '461', actor: 'scheduler', machine_id: 'machine-a', lease_id: null, lease_epoch: state.snapshot.work_items['461'].lease_epoch, exact_object: { pr_number: 461 }, payload: { pr_url: 'https://github.com/cehinds/AshenSpire/pull/461' }, idempotency_key: 'merge-gate:pr', created_at: '2026-08-30T00:00:05Z' }]);
  const item = state.snapshot.work_items['461'];
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
    initial.oid = persistPortableState(first, initial, { push: true, message: 'initial' });
    git(second, ['fetch', 'origin', '+refs/heads/agentops/scheduler-state:refs/remotes/origin/agentops/scheduler-state']);
    let winner = readPortableState(second); winner.machineLease = { machine_id: MACHINE_A, lease_epoch: 1, acquired_at: '2026-08-30T00:00:00Z', expires_at: '2026-08-30T00:30:00Z', expected_state_ref_oid: winner.oid };
    const winnerOid = persistPortableState(second, winner, { push: true, message: 'winner' });
    const loser = { ...initial, machineLease: { machine_id: MACHINE_B, lease_epoch: 1, acquired_at: '2026-08-30T00:00:00Z', expires_at: '2026-08-30T00:30:00Z', expected_state_ref_oid: initial.oid } };
    let failure;
    try { persistPortableState(first, loser, { push: true, message: 'loser' }); } catch (error) { failure = error; }
    assert.equal(failure?.portableStateAuthorityLost, true);
    assert.equal(failure?.authoritativeStateOid, winnerOid);
    assert.equal(readPortableState(first).oid, winnerOid);
    assert.equal(readPortableState(first).machineLease.machine_id, MACHINE_A);
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
    ['invalid timestamp', { schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_A, created_at: 'not-a-time' }]
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
    { ...valid, expected_state_ref_oid: 'not-an-oid' }
  ]) assert.throws(() => validateMachineLease(plant));
  const machine = { schema: 'agentops/scheduler-machine/v1', machine_id: MACHINE_B, created_at: '2026-08-30T00:00:00Z' };
  assert.throws(() => ensureCustody({ machineLease: valid }, machine, Date.parse('2026-08-30T00:01:00Z')), /active machine custody required/);
});

test('Git and GitHub subprocesses fail closed on startup errors and timeouts', () => {
  assert.throws(() => runBoundedCommand('ashenspire-command-that-does-not-exist', [], { timeoutMs: 100 }), /failed to start/);
  assert.throws(() => runBoundedCommand(process.execPath, ['--eval', 'setTimeout(() => {}, 10000)'], { timeoutMs: 50 }), /timed out/);
  assert.throws(() => runBoundedCommand(process.execPath, [], { timeoutMs: 0 }), /invalid subprocess timeout/);
});

test('scheduler dispatch remains mechanically disabled while legacy watcher is authoritative', () => {
  assert.throws(() => assertSchedulerDispatchCutover(config), /legacy watcher remains authoritative/);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-cutover-guard-'));
  try {
    const fixture = cutoverFixture(temp); const authorized = fixture.authorized;
    const activationDir = path.join(temp, '.agentops', 'pipeline-pilot'); fs.mkdirSync(activationDir, { recursive: true });
    fs.writeFileSync(path.join(activationDir, 'activation.json'), `${JSON.stringify({ enabled: true, mode: 'LIVE_ASSIGNMENT' })}\n`);
    assert.throws(() => assertSchedulerDispatchCutover(authorized, temp), /legacy watcher activation is still live/);
    fs.writeFileSync(path.join(activationDir, 'activation.json'), `${JSON.stringify({ enabled: false, mode: 'DISABLED' })}\n`);
    assert.equal(assertSchedulerDispatchCutover(authorized, temp), true);
    assert.throws(() => validateSchedulerCutoverAuthority(temp, 'owner:any-string', authorized), /authenticated exact owner decision/);
    assert.throws(() => validateSchedulerCutoverAuthority(temp, { ...fixture.authorization_evidence, event_hash: '0'.repeat(64) }, authorized), /hash mismatch/);
    const wrongActor = { ...fixture.event, actor: 'it-manager-iii' };
    fs.writeFileSync(path.join(temp, ...fixture.eventPath.split('/')), `${JSON.stringify(wrongActor, null, 2)}\n`);
    assert.throws(() => validateSchedulerCutoverAuthority(temp, { ...fixture.authorization_evidence, event_hash: sha256(wrongActor) }, authorized), /authenticated owner decision/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
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

test('dispatch reconciliation deletes a wake after its lease is released', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ashenspire-stale-wake-'));
  try {
    const init = spawnSync('git', ['init'], { cwd: temp, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const authorized = cutoverFixture(temp).authorized;
    let state = intake(fresh(), 'I-STALE-WAKE'); state = claim(state, 'I-STALE-WAKE'); state = entered(state, 'I-STALE-WAKE');
    const actor = state.snapshot.work_items['I-STALE-WAKE'].assigned_actor;
    beginWakeDispatch(temp, state.snapshot, [{ issue_id: 'I-STALE-WAKE', actor }], authorized).commit();
    const wakeFile = path.join(temp, '.git', 'agentops-scheduler', 'dispatch', `${actor.replaceAll(':', '_')}.json`);
    assert.equal(fs.existsSync(wakeFile), true);
    state = candidate(state, 'I-STALE-WAKE');
    beginWakeDispatch(temp, state.snapshot, [], authorized).commit();
    assert.equal(fs.existsSync(wakeFile), false);
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
    expiry: '2026-08-30T01:59:59Z', admission_evidence: JSON.stringify(admissionEvidence)
  }, state, { machine_id: 'machine-a' });
  assert.throws(() => appendEvents(state, [event]), /later than the trusted event time/);
});

test('admission fails closed when Project evidence is missing, stale, or has no runnable priority and owner', () => {
  const state = intake(fresh(), 'GH-BOARD-SYNC', { paths: ['src/board-sync.js'] });
  let reconciliation = liveReconciliation(state, 'GH-BOARD-SYNC');
  let blocked = blockedAdmission(state, 'GH-BOARD-SYNC', { ...reconciliation, project_sync: { ...reconciliation.project_sync, status: 'BOARD_SYNC_FAILED' } });
  assert.deepEqual(
    { blocker: blocked.blocker, conflict_identity: blocked.conflict_identity, wake_evidence: blocked.wake_evidence },
    { blocker: 'BOARD_SYNC_FAILED', conflict_identity: 'github-project', wake_evidence: 'record a fresh successful Project priority and ownership observation' }
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
  reconciliation = liveReconciliation(state, issue, { assignees: ['old-seat'], external_claims: [expired], scope_complete: false, claimed_paths: [] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'EXPIRED_EXTERNAL_CLAIM_UNSUPERSEDED');
  assert.equal(blocked.conflict_identity, expired.claim_id);
  const released = { ...expired, terminal_event: 'RELEASED' };
  reconciliation = liveReconciliation(state, issue, { assignees: ['old-seat'], external_claims: [released], scope_complete: false, claimed_paths: [] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'INCOMPLETE_AFFECTED_SCOPE');
  reconciliation = liveReconciliation(state, issue, { assignees: ['old-seat'], external_claims: [released], claimed_paths: ['src/targeting.js'] }, { agentops_leases: [lease] });
  blocked = blockedAdmission(state, issue, reconciliation);
  assert.equal(blocked.blocker, 'AFFECTED_SCOPE_CONTRADICTION');
  reconciliation = liveReconciliation(state, issue, { assignees: ['old-seat'], external_claims: [released] }, { agentops_leases: [lease] });
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

test('sync push publishes a preserved local-ahead state commit', () => {
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
    assert.equal(main(['sync', '--push'], work), 0);
    const remoteOid = git(work, ['ls-remote', 'origin', config.state_ref]).split(/\s+/)[0];
    assert.equal(remoteOid, localOid);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

if (!process.exitCode) process.stdout.write(`1..${passed}\nPASS ${passed}/${passed}\n`);
