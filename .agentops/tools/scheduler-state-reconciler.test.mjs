import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  REPOSITORY_ROOT, STATE_REF, DEV_REF, stableStringify, sha256, runGit,
  readState, buildPlan, validateAuthority, applyReconciliation, verifyReceipt,
} from './scheduler-state-reconciler.mjs';

const SOURCE_OID = '5d54c202917605bf8928b06def9bb4ec0e9a2308';
let failures = 0;
function check(label, condition, detail = '') {
  const ok = !!condition;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
}
function throws(label, fn, needle) {
  try { fn(); check(label, false, 'did not throw'); }
  catch (error) { check(label, error.message.includes(needle), error.message); }
}

function exec(root, args, options = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', input: options.input, env: { ...process.env, ...(options.env || {}) } });
  if ((result.status ?? 1) !== 0) throw new Error(`git ${args.join(' ')}: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function objectDirectory(root) {
  const common = exec(root, ['rev-parse', '--git-common-dir']);
  return path.resolve(root, common, 'objects').replace(/\\/g, '/');
}

function commitFiles(root, parent, files, message, at) {
  const index = path.join(root, '.git', `test-index-${sha256({ parent, files, message }).slice(0, 12)}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    exec(root, ['read-tree', parent], { env });
    for (const [name, text] of Object.entries(files)) {
      const blob = exec(root, ['hash-object', '-w', '--stdin'], { env, input: text });
      exec(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`], { env });
    }
    const tree = exec(root, ['write-tree'], { env });
    const identity = { ...env, GIT_AUTHOR_NAME: 'State Reconciler Test', GIT_AUTHOR_EMAIL: 'test@local.invalid', GIT_COMMITTER_NAME: 'State Reconciler Test', GIT_COMMITTER_EMAIL: 'test@local.invalid', GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at };
    return { oid: exec(root, ['commit-tree', tree, '-p', parent, '-m', message], { env: identity }), tree };
  } finally { try { fs.rmSync(index, { force: true }); } catch {} }
}

function leaseProjection(snapshot) {
  return Object.values(snapshot.work_items).filter((item) => item.lease_id !== null || item.assigned_actor !== null || item.assignment_kind !== null || item.lease_expiry !== null || item.lease_machine_id !== null).map((item) => ({
    issue_id: `#${item.issue_id}`, state: item.state, assigned_actor: item.assigned_actor, assignment_kind: item.assignment_kind,
    lease_id: item.lease_id, lease_epoch: item.lease_epoch, lease_expiry: item.lease_expiry,
    lease_machine_id: item.lease_machine_id, base_commit: item.base_commit,
  })).sort((a, b) => Number(a.issue_id.slice(1)) - Number(b.issue_id.slice(1)) || (a.lease_epoch ?? -1) - (b.lease_epoch ?? -1) || String(a.lease_id ?? '').localeCompare(String(b.lease_id ?? '')));
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ashen-state-reconcile-'));
  const remote = `${root}-remote.git`;
  exec(root, ['init', '--quiet']);
  fs.mkdirSync(path.join(root, '.git', 'objects', 'info'), { recursive: true });
  fs.writeFileSync(path.join(root, '.git', 'objects', 'info', 'alternates'), `${objectDirectory(REPOSITORY_ROOT)}\n`);
  const candidate = '3f3272c7e878cd0055d022e084478189365efe25';
  const candidateTree = exec(REPOSITORY_ROOT, ['show', '-s', '--format=%T', candidate]);
  exec(root, ['update-ref', 'refs/heads/test', candidate]);
  exec(root, ['symbolic-ref', 'HEAD', 'refs/heads/test']);
  exec(root, ['config', 'core.sparseCheckout', 'true']);
  fs.mkdirSync(path.join(root, '.git', 'info'), { recursive: true });
  fs.writeFileSync(path.join(root, '.git', 'info', 'sparse-checkout'), '/.agentops/governance/owner-command.json\n/.agentops/schemas/event.schema.json\n/.agentops/work/AS-1001/CURRENT.json\n');
  exec(root, ['read-tree', '-m', '-u', candidate]);
  exec(root, ['init', '--quiet', '--bare', remote]);
  fs.mkdirSync(path.join(remote, 'objects', 'info'), { recursive: true });
  fs.writeFileSync(path.join(remote, 'objects', 'info', 'alternates'), `${objectDirectory(REPOSITORY_ROOT)}\n`);
  exec(remote, ['update-ref', STATE_REF, SOURCE_OID]);
  exec(remote, ['update-ref', DEV_REF, candidate]);
  exec(root, ['remote', 'add', 'origin', remote]);

  const source = readState(root, SOURCE_OID);
  const trustedNow = '2026-08-31T18:30:00Z';
  const quiet = { schema: 'agentops/scheduler-quiet-window-receipt/v1', observed_from: '2026-08-31T18:20:00Z', observed_until: trustedNow, source_state_oid: SOURCE_OID, state_ref: STATE_REF, development_ref: DEV_REF, scheduler_process_count: 0, legacy_process_count: 0, state_mutation_count: 0, dispatch_frozen: true, no_external_mutation: true };
  const binding = {
    schema: 'agentops/scheduler-state-reconciliation-authority/v1', reconciler_head: candidate, reconciler_tree: candidateTree,
    source: { state_oid: source.oid, state_tree: source.tree, snapshot_sha256: source.snapshot.snapshot_hash, journal_manifest_sha256: source.journalManifest, event_count: source.events.length, state_version: source.stateVersion },
    target: { state_oid: '0'.repeat(40), state_tree: '0'.repeat(40), snapshot_sha256: '0'.repeat(64), journal_manifest_sha256: '0'.repeat(64), event_count: source.events.length + 1 },
    canonical_anchor_oid: 'dbd50e1656d22a72cbda43dd349e5ab7c9a46777', machine_lease: source.machineLease,
    work_leases: leaseProjection(source.snapshot), mode: 'release-custody-and-reconcile-work-leases', not_before: '2026-08-31T18:25:00Z', quiet_window_receipt_hash: sha256(quiet), expected_event_count_delta: 1,
    dispatch_frozen: true, no_refill: true, no_assignment: true, no_dispatch: true, no_external_mutation: true,
    one_use: true, expires_at: '2026-08-31T19:30:00Z', target_ref: STATE_REF, expected_remote_oid: SOURCE_OID,
    push_mode: 'non-force-forward-only-cas', abort_on_remote_change: true,
  };
  const prebuilt = buildPlan(root, { binding, enforceTarget: false });
  binding.target = prebuilt.target;
  const eventPath = '.agentops/events/AS-1001/AS-1001-state-reconciliation-authority-test.json';
  const event = { schema: 'agentops/event/v1', id: 'AS-1001-state-reconciliation-authority-test', ticket: 'AS-1001', seq: 999, parent_event: 'AS-1001-0003', kind: 'owner-decision', actor: 'owner', at: trustedNow, summary: 'Exact scheduler state reconciliation authority.', decision: { action: 'authorize-scheduler-state-reconciliation', authenticated_role: 'owner', authority_path: '.github/workflows/owner-command.yml:owner-command/v1', target: 'AS-1001', expected_current_hash: `sha256:${'1'.repeat(64)}`, candidate_oid: candidate, scheduler_state_reconciliation: binding } };
  const capsulePath = '.agentops/work/AS-1001/CURRENT.json';
  const capsule = JSON.parse(exec(root, ['show', `${candidate}:${capsulePath}`]));
  capsule.parent_hash = capsule.current_hash; capsule.revision += 1; capsule.next_action = 'Execute the exact scheduler state reconciliation authority once.'; capsule.current_hash = '';
  capsule.current_hash = `sha256:${sha256(capsule)}`;
  const authority = commitFiles(root, candidate, { [eventPath]: `${JSON.stringify(event, null, 2)}\n`, [capsulePath]: `${JSON.stringify(capsule, null, 2)}\n` }, 'owner authorize exact scheduler state reconciliation', trustedNow);
  exec(root, ['push', 'origin', `${authority.oid}:${DEV_REF}`]);
  return { root, remote, source, candidate, binding, quiet, trustedNow, eventPath, event, authorityOid: authority.oid, cleanup() { try { fs.rmSync(root, { recursive: true, force: true }); } catch {} try { fs.rmSync(remote, { recursive: true, force: true }); } catch {} } };
}

// The canonical fixture is intentionally exact: one and only one active lease,
// issue #256, with every custody field bound.
{
  const box = setup();
  try {
    check('canonical source fixture has sole active #256 lease', box.binding.work_leases.length === 1 && box.binding.work_leases[0].issue_id === '#256', stableStringify(box.binding.work_leases));
    check('canonical #256 fixture binds the expected lease', box.binding.work_leases[0].lease_id === 'lease:256:1' && box.binding.work_leases[0].state === 'RUNNING');
    const validated = validateAuthority(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet });
    check('fresh owner event validates exact action/candidate/tree/quiet evidence', validated.binding.reconciler_head === box.candidate);
    const plan = buildPlan(box.root, { binding: box.binding });
    check('plan appends exactly the authorized event delta', plan.events.length === 1 && plan.target.event_count === box.source.events.length + 1);
    check('plan emits fenced LEASE_EXPIRED for #256', plan.events[0].event_type === 'LEASE_EXPIRED' && plan.events[0].issue_id === '256' && plan.events[0].lease_id === 'lease:256:1');
    const targetState = readState(box.root, plan.target.state_oid);
    const target256 = targetState.snapshot.work_items['256'];
    check('target releases #256 without assignment or refill', target256.state === 'READY' && target256.assigned_actor === null && target256.lease_id === null);
    check('target preserves unrelated item #420 byte-semantically', stableStringify(targetState.snapshot.work_items['420']) === stableStringify(box.source.snapshot.work_items['420']));
    check('target preserves released machine custody exactly', stableStringify(targetState.machineLease) === stableStringify(box.source.machineLease));
    check('target preserves every prior journal blob OID', box.source.entries.filter((e) => e.name.startsWith('journal/')).every((entry) => targetState.entries.find((e) => e.name === entry.name)?.oid === entry.oid));

    const result = applyReconciliation(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet });
    check('apply publishes exact prebuilt target once', runGit(box.root, ['ls-remote', 'origin', STATE_REF]).stdout.startsWith(result.target.state_oid));
    check('apply first commits durable ATTEMPTED record then final receipt', result.attempt.status === 'ATTEMPTED' && result.receipt.status === 'APPLIED');
    const verified = verifyReceipt(box.root, { receipt: result.receipt, receiptPath: result.receipt_path });
    check('verify-receipt proves fresh dev and state refs', verified.ok && verified.state.oid === result.target.state_oid);
    throws('exact authority replay is rejected after dev advanced', () => applyReconciliation(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet }), 'stale');
    const tampered = { ...result.receipt, target_state_oid: SOURCE_OID };
    throws('receipt target substitution is rejected', () => verifyReceipt(box.root, { receipt: tampered, receiptPath: result.receipt_path }), 'hash mismatch');
  } finally { box.cleanup(); }
}

// Binding omissions, additions, time and target substitutions all fail before
// a durable attempt is written.
for (const [label, mutate, needle] of [
  ['omitted active lease', (b) => { b.work_leases = []; }, 'omits, adds'],
  ['extra active lease', (b) => { b.work_leases.push({ ...b.work_leases[0], issue_id: '#999' }); }, 'omits, adds'],
  ['wrong event delta', (b) => { b.expected_event_count_delta = 2; }, 'delta'],
  ['dispatch unfrozen', (b) => { b.dispatch_frozen = false; }, 'dispatch_frozen'],
  ['target OID substitution', (b) => { b.target.state_oid = 'f'.repeat(40); }, 'target binding'],
  ['machine custody substitution', (b) => { b.machine_lease.lease_epoch += 1; }, 'machine lease'],
]) {
  const box = setup();
  try {
    const binding = structuredClone(box.binding); mutate(binding);
    throws(label, () => buildPlan(box.root, { binding }), needle);
  } finally { box.cleanup(); }
}

{
  const box = setup();
  try {
    const skewed = { ...box.quiet, observed_until: '2026-08-31T18:29:59Z' };
    const capsulePath = '.agentops/work/AS-1001/CURRENT.json';
    const nextCapsule = (parent, nextAction) => {
      const capsule = JSON.parse(exec(box.root, ['show', `${parent}:${capsulePath}`]));
      capsule.parent_hash = capsule.current_hash; capsule.revision += 1; capsule.next_action = nextAction; capsule.current_hash = ''; capsule.current_hash = `sha256:${sha256(capsule)}`;
      return capsule;
    };
    const skewEvent = structuredClone(box.event); skewEvent.id = 'AS-1001-time-skew'; skewEvent.decision.scheduler_state_reconciliation.quiet_window_receipt_hash = sha256(skewed);
    const skewPath = '.agentops/events/AS-1001/AS-1001-time-skew.json';
    const skewCommit = commitFiles(box.root, box.authorityOid, { [skewPath]: `${JSON.stringify(skewEvent, null, 2)}\n`, [capsulePath]: `${JSON.stringify(nextCapsule(box.authorityOid, 'Reject trusted-time skew.'), null, 2)}\n` }, 'time skew authority plant', box.trustedNow);
    exec(box.root, ['push', 'origin', `${skewCommit.oid}:${DEV_REF}`]);
    throws('trusted-time skew is rejected', () => validateAuthority(box.root, { authorityEventPath: skewPath, authorityStateOid: skewCommit.oid, trustedNow: box.trustedNow, quietWindowReceipt: skewed }), 'trusted time skew');
    const wrongHash = structuredClone(box.event); wrongHash.decision.scheduler_state_reconciliation.quiet_window_receipt_hash = 'f'.repeat(64);
    const wrongPath = '.agentops/events/AS-1001/AS-1001-wrong-quiet.json';
    const wrongCommit = commitFiles(box.root, skewCommit.oid, { [wrongPath]: `${JSON.stringify(wrongHash, null, 2)}\n`, [capsulePath]: `${JSON.stringify(nextCapsule(skewCommit.oid, 'Attempt substituted quiet receipt.'), null, 2)}\n` }, 'wrong quiet authority', box.trustedNow);
    exec(box.root, ['push', 'origin', `${wrongCommit.oid}:${DEV_REF}`]);
    throws('quiet receipt hash substitution is rejected', () => validateAuthority(box.root, { authorityEventPath: wrongPath, authorityStateOid: wrongCommit.oid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet }), 'hash mismatch');
  } finally { box.cleanup(); }
}

{
  const box = setup();
  try {
    exec(box.remote, ['update-ref', STATE_REF, box.binding.canonical_anchor_oid]);
    const beforeDev = exec(box.remote, ['rev-parse', DEV_REF]);
    throws('state remote drift aborts before durable attempt', () => applyReconciliation(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet }), 'changed after planning');
    check('pre-attempt remote drift leaves dev unchanged', exec(box.remote, ['rev-parse', DEV_REF]) === beforeDev);
  } finally { box.cleanup(); }
}

{
  const box = setup();
  try {
    let pushes = 0;
    const ambiguousConfirmed = (root, args, options) => {
      pushes++;
      const real = runGit(root, args, options);
      return pushes === 2 ? { ...real, status: 1, stderr: 'simulated lost transport acknowledgement' } : real;
    };
    const result = applyReconciliation(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet, pushRunner: ambiguousConfirmed });
    check('ambiguous state transport is inspected once and confirmed without retry', pushes === 3 && result.receipt.state_push === 'AMBIGUOUS_CONFIRMED_ONCE');
  } finally { box.cleanup(); }
}

{
  const box = setup();
  try {
    let pushes = 0;
    const ambiguousUnchanged = (root, args, options) => {
      pushes++;
      if (pushes === 2) return { status: 1, stdout: '', stderr: 'simulated transport loss before update' };
      return runGit(root, args, options);
    };
    throws('ambiguous unchanged state transport is never retried', () => applyReconciliation(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet, pushRunner: ambiguousUnchanged }), 'will not retry');
    check('failed ambiguous state push consumed exactly one attempt push', pushes === 2 && exec(box.remote, ['rev-parse', STATE_REF]) === SOURCE_OID);
    const advancedDev = exec(box.remote, ['rev-parse', DEV_REF]);
    check('ATTEMPTED record remains durable after ambiguous failure', advancedDev !== box.authorityOid);
    throws('consumed ambiguous packet cannot replay', () => applyReconciliation(box.root, { authorityEventPath: box.eventPath, authorityStateOid: box.authorityOid, trustedNow: box.trustedNow, quietWindowReceipt: box.quiet }), 'stale');
  } finally { box.cleanup(); }
}

for (const schema of ['state-reconciliation-attempt.json', 'state-reconciliation-receipt.json']) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(REPOSITORY_ROOT, '.agentops/scheduler/schemas', schema), 'utf8'));
  check(`${schema} is a closed JSON Schema`, parsed.type === 'object' && parsed.additionalProperties === false && Array.isArray(parsed.required));
}

if (failures) {
  console.error(`STATE RECONCILER TEST FAIL: ${failures} failure(s)`);
  process.exitCode = 1;
} else console.log('STATE RECONCILER TEST PASS');
