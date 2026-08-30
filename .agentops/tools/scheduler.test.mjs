#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendEvents, assertPortable, claimsConflict, compareAndSwap, compileWake,
  emptySnapshot, historyAdvanceAllowed, makeEvent, pathsOverlap, planAssignments,
  protectedTransitionAllowed, readConfig, reduceEvents, resolveCanonicalIssue,
  simulate, stableStringify
} from './scheduler.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..', '..');
const config = {
  ...readConfig(path.resolve(toolDir, '..')),
  workers: [
    { actor: 'seat:test:00000000-0000-4000-8000-000000000001', capabilities: ['implementation'] },
    { actor: 'seat:test:00000000-0000-4000-8000-000000000002', capabilities: ['implementation', 'review'] },
    { actor: 'seat:test:00000000-0000-4000-8000-000000000003', capabilities: ['implementation', 'review'] }
  ]
};
let passed = 0;

function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write(`ok ${passed} - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}: ${error.stack}\n`); process.exitCode = 1; }
}

function fresh() { return { oid: null, events: [], snapshot: emptySnapshot(), machineLease: null, stateVersion: '1' }; }
function intake(state, issue, options = {}) {
  return appendEvents(state, [{
    event_type: 'INTAKE_RECORDED', issue_id: issue, actor: 'intake', machine_id: 'machine-a',
    exact_object: { issue }, idempotency_key: `intake:${issue}`, created_at: '2026-08-30T00:00:00.000Z',
    payload: { title: options.title ?? issue, priority: options.priority ?? 'P2', dependencies: options.dependencies ?? [], branch: options.branch ?? `codex/${issue}`, claimed_paths: options.paths ?? [`src/${issue}`], claimed_resources: options.resources ?? [], acceptance_commands: ['node test'], evidence_pointers: [], next_action: 'work', authority_ceiling: 'dev-delivery' }
  }]);
}
function claim(state, issue, actor = 'seat:test:00000000-0000-4000-8000-000000000001', epoch = 1) {
  const item = state.snapshot.work_items[issue];
  return appendEvents(state, [{ event_type: 'CLAIM_ACQUIRED', issue_id: issue, actor, machine_id: 'machine-a', lease_id: `lease:${issue}:${epoch}`, lease_epoch: epoch, exact_object: {}, idempotency_key: `claim:${issue}:${epoch}`, created_at: '2026-08-30T00:00:01.000Z', payload: { branch: item.branch, base_commit: 'a'.repeat(40), lease_expiry: '2026-08-30T00:30:01.000Z', claimed_paths: item.claimed_paths, claimed_resources: item.claimed_resources, next_action: 'work' } }]);
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
  const item = state.snapshot.work_items[issue];
  return appendEvents(state, [{ event_type: 'QA_RESULT', issue_id: issue, actor: 'seat:qa:01', machine_id: 'machine-a', lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid }, idempotency_key: `qa:${issue}:${oid}:${result}`, created_at: '2026-08-30T00:00:04.000Z', payload: { candidate_commit: oid, result, evidence_pointers: ['receipt:qa'] } }]);
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
  assert.equal(reviewSeatPlan.assignments.length, 0);
});

test('8 immediate refill after completion', () => {
  let state = intake(fresh(), 'I-8A'); state = claim(state, 'I-8A'); state = entered(state, 'I-8A'); state = candidate(state, 'I-8A'); state = qa(state, 'I-8A');
  state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: 'I-8A', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-8A:1', lease_epoch: 1, exact_object: { pr_number: 8 }, payload: { pr_url: 'https://github.com/cehinds/AshenSpire/pull/8' }, idempotency_key: 'pr:I-8A', created_at: '2026-08-30T00:00:05Z' }]);
  state = appendEvents(state, [{ event_type: 'MERGED_DEV', issue_id: 'I-8A', actor: 'scheduler', machine_id: 'machine-a', lease_id: 'lease:I-8A:1', lease_epoch: 1, exact_object: { oid: 'd'.repeat(40) }, payload: { merge_commit: 'd'.repeat(40) }, idempotency_key: 'merge:I-8A', created_at: '2026-08-30T00:00:06Z' }]);
  state = intake(state, 'I-8B');
  state = appendEvents(state, [{ event_type: 'COMPLETED', issue_id: 'I-8A', actor: 'seat:test:00000000-0000-4000-8000-000000000001', machine_id: 'machine-a', lease_id: 'lease:I-8A:1', lease_epoch: 1, exact_object: {}, payload: {}, idempotency_key: 'complete:I-8A', created_at: '2026-08-30T00:00:07Z' }]);
  const refill = planAssignments(state.snapshot, config, '2026-08-30T00:00:07Z', 'c'.repeat(40)).assignments.find((a) => a.issue_id === 'I-8B');
  assert.equal(refill.base_commit, 'c'.repeat(40));
  state = appendEvents(state, [{ event_type: 'CLAIM_ACQUIRED', issue_id: refill.issue_id, actor: refill.actor, machine_id: 'machine-a', lease_id: refill.lease_id, lease_epoch: refill.lease_epoch, exact_object: { base_commit: refill.base_commit }, payload: { branch: state.snapshot.work_items[refill.issue_id].branch, base_commit: refill.base_commit, lease_expiry: refill.lease_expiry }, idempotency_key: 'auto-claim:I-8B:1', created_at: '2026-08-30T00:00:07Z' }]);
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
  const run = spawnSync(process.execPath, [path.join(toolDir, 'scheduler.mjs'), 'watch'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); assert.equal(run.stdout, '');
});

test('pipeline saturation acceptance fixture', () => {
  const result = simulate(config); assert.equal(result.tickets, 12); assert.equal(result.concurrent, true); assert.equal(result.conflict_rejected, true); assert.equal(result.protected_stop, true);
});

test('canonical serialization is key-order independent', () => {
  assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));
});

if (!process.exitCode) process.stdout.write(`1..${passed}\nPASS ${passed}/${passed}\n`);
