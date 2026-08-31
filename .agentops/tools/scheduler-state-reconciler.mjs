#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSchema } from './opsctl.mjs';
import { reduceEvents } from './scheduler.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(HERE, '..', '..');
export const STATE_REF = 'refs/heads/agentops/scheduler-state';
export const DEV_REF = 'refs/heads/dev';
const ACTION = 'authorize-scheduler-state-reconciliation';
const ATTEMPT_ROOT = '.agentops/scheduler/state-reconciliation-attempts';
const OID = /^[0-9a-f]{40}$/;
const TRUSTED_EVENT_BINDING_SCHEMA_HASH = 'f653f120a443582c0ba7c90fe6ab0d46089dafa887cb7ad3d8f4c4f3833b9a01';
const TRUSTED_POLICY_ACTION_HASH = '5a892589de04968e80ae8712f421949906076684ba83e55b3b4b7bcccd985039';

function trustedGitExecutable() {
  const candidates = process.platform === 'win32'
    ? [process.env.AGENTOPS_TRUSTED_GIT, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe'), process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe')]
    : [process.env.AGENTOPS_TRUSTED_GIT, '/usr/bin/git', '/usr/local/bin/git'];
  const found = candidates.find((candidate) => candidate && path.isAbsolute(candidate) && fs.existsSync(candidate));
  if (!found) throw new Error('trusted host Git executable was not discovered; set AGENTOPS_TRUSTED_GIT to an absolute executable path');
  return found;
}

const TRUSTED_GIT = trustedGitExecutable();

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (stableStringify(actual) !== stableStringify(expected)) throw new Error(`${label} fields are incomplete or ambiguous`);
}

function instant(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a real ISO instant`);
  return Date.parse(value);
}

export function runGit(root, args, { input = null, allowFailure = false, env = {} } = {}) {
  const result = spawnSync(TRUSTED_GIT, args, { cwd: root, input, encoding: 'utf8', env: { ...process.env, ...env } });
  const out = { status: result.status ?? 1, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() };
  if (!allowFailure && out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr || out.stdout || `exit ${out.status}`}`);
  return out;
}

function gitText(root, args) { return runGit(root, args).stdout; }

function jsonAt(root, oid, name) {
  const raw = runGit(root, ['show', `${oid}:${name}`], { allowFailure: true });
  if (raw.status !== 0) throw new Error(`required ${name} is absent at ${oid}`);
  try { return JSON.parse(raw.stdout); }
  catch (error) { throw new Error(`${name} at ${oid} is invalid JSON: ${error.message}`); }
}

function textAt(root, oid, name) {
  const raw = runGit(root, ['show', `${oid}:${name}`], { allowFailure: true });
  if (raw.status !== 0) throw new Error(`required ${name} is absent at ${oid}`);
  return raw.stdout;
}

function remoteOid(root, remote, ref) {
  const result = runGit(root, ['ls-remote', '--exit-code', remote, ref], { allowFailure: true });
  if (result.status !== 0) throw new Error(`cannot read ${remote} ${ref}`);
  const rows = result.stdout.split(/\r?\n/).filter(Boolean);
  const match = rows.length === 1 ? /^([0-9a-f]{40})\s+(.+)$/.exec(rows[0]) : null;
  if (!match || match[2] !== ref) throw new Error(`remote lookup for ${ref} is ambiguous or malformed`);
  return match[1];
}

function ensureCommitObject(root, oid, remote, ref) {
  if (runGit(root, ['cat-file', '-e', `${oid}^{commit}`], { allowFailure: true }).status === 0) return;
  runGit(root, ['fetch', '--no-tags', '--no-write-fetch-head', remote, ref]);
  if (runGit(root, ['cat-file', '-e', `${oid}^{commit}`], { allowFailure: true }).status !== 0) throw new Error(`fresh ${ref} commit ${oid} is unavailable locally after fetch`);
}

function snapshotHash(snapshot) {
  const copy = structuredClone(snapshot);
  delete copy.snapshot_hash;
  return sha256(copy);
}

function treeEntries(root, oid, prefix = null) {
  const args = ['ls-tree', '-r', oid];
  if (prefix) args.push('--', prefix);
  const result = runGit(root, args);
  return result.stdout ? result.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const match = /^(\d+)\s+blob\s+([0-9a-f]{40})\t(.+)$/.exec(line);
    if (!match) throw new Error(`state tree contains a non-blob or malformed entry: ${line}`);
    return { mode: match[1], oid: match[2], name: match[3] };
  }) : [];
}

function journalManifest(entries) {
  return sha256(entries.filter((entry) => entry.name.startsWith('journal/')).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => `${entry.name}:${entry.oid}`).join('\n'));
}

export function readState(root, oid) {
  if (!OID.test(oid ?? '') || runGit(root, ['cat-file', '-e', `${oid}^{commit}`], { allowFailure: true }).status !== 0) throw new Error('source state OID is not a local commit');
  const entries = treeEntries(root, oid);
  const unexpected = entries.map((entry) => entry.name).filter((name) => !['snapshot.json', 'machine-lease.json', 'STATE_VERSION'].includes(name) && !/^journal\/[0-9]{8}-[A-Za-z0-9._-]+\.json$/.test(name));
  if (unexpected.length) throw new Error(`source state contains forbidden paths: ${unexpected.join(', ')}`);
  const events = entries.filter((entry) => entry.name.startsWith('journal/')).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => jsonAt(root, oid, entry.name));
  const snapshot = jsonAt(root, oid, 'snapshot.json');
  const machineLease = jsonAt(root, oid, 'machine-lease.json');
  const stateVersion = Number(textAt(root, oid, 'STATE_VERSION').trim());
  const eventSchemaName = stateVersion === 2 ? 'event-v2.json' : 'event.json';
  const schemaHead = gitText(root, ['rev-parse', 'HEAD']);
  const eventSchema = jsonAt(root, schemaHead, `.agentops/scheduler/schemas/${eventSchemaName}`);
  const journalEntries = entries.filter((entry) => entry.name.startsWith('journal/')).sort((a, b) => a.name.localeCompare(b.name));
  for (let index = 0; index < events.length; index++) {
    const schemaErrors = validateSchema(events[index], eventSchema, '$');
    if (schemaErrors.length) throw new Error(`source journal event ${index + 1} schema validation failed: ${schemaErrors.join('; ')}`);
    const expectedPath = `journal/${String(index + 1).padStart(8, '0')}-${events[index].event_id}.json`;
    if (journalEntries[index]?.name !== expectedPath) throw new Error(`source journal event ${index + 1} path/sequence/id binding is invalid`);
  }
  if (snapshot.snapshot_hash !== snapshotHash(snapshot)) throw new Error('source snapshot hash is not canonical');
  if (snapshot.last_sequence !== events.length || events.some((event, index) => event.sequence !== index + 1)) throw new Error('source journal sequence/count disagrees with snapshot');
  const replayed = reduceEvents(events);
  if (replayed.errors.length || stableStringify(replayed) !== stableStringify(snapshot)) throw new Error(`source state fails authoritative replay${replayed.errors.length ? `: ${replayed.errors.map((entry) => entry.error).join('; ')}` : ''}`);
  if (machineLease.machine_id !== null || !machineLease.released_at || machineLease.expires_at !== machineLease.released_at) throw new Error('source machine custody is not already released');
  return { oid, tree: gitText(root, ['show', '-s', '--format=%T', oid]), entries, events, snapshot, machineLease, stateVersion, journalManifest: journalManifest(entries) };
}

function activeWorkLeases(snapshot) {
  return Object.values(snapshot.work_items ?? {}).filter((item) => item.lease_id !== null || item.assigned_actor !== null || item.assignment_kind !== null || item.lease_expiry !== null || item.lease_machine_id !== null).map((item) => ({
    issue_id: `#${item.issue_id}`,
    state: item.state,
    assigned_actor: item.assigned_actor,
    assignment_kind: item.assignment_kind,
    lease_id: item.lease_id,
    lease_epoch: item.lease_epoch,
    lease_expiry: item.lease_expiry,
    lease_machine_id: item.lease_machine_id,
    base_commit: item.base_commit,
  })).sort((a, b) => Number(a.issue_id.slice(1)) - Number(b.issue_id.slice(1)) || (a.lease_epoch ?? -1) - (b.lease_epoch ?? -1) || String(a.lease_id ?? '').localeCompare(String(b.lease_id ?? '')));
}

function validateQuietReceipt(receipt, binding, trustedNow) {
  exactKeys(receipt, ['schema', 'observed_from', 'observed_until', 'source_state_oid', 'state_ref', 'development_ref', 'scheduler_process_count', 'legacy_process_count', 'state_mutation_count', 'dispatch_frozen', 'no_external_mutation'], 'quiet-window receipt');
  if (receipt.schema !== 'agentops/scheduler-quiet-window-receipt/v1') throw new Error('quiet-window receipt schema is unsupported');
  const from = instant(receipt.observed_from, 'quiet-window observed_from');
  const until = instant(receipt.observed_until, 'quiet-window observed_until');
  const now = instant(trustedNow, 'trusted_now');
  const notBefore = instant(binding.not_before, 'not_before');
  if (until !== now) throw new Error('trusted time skew: trusted_now must exactly equal the sealed quiet-window observed_until');
  if (from > notBefore || notBefore > until) throw new Error('quiet window does not cover the bound not_before instant');
  if (receipt.source_state_oid !== binding.source.state_oid || receipt.state_ref !== binding.target_ref || receipt.development_ref !== DEV_REF) throw new Error('quiet-window receipt identity does not match authority binding');
  if (receipt.scheduler_process_count !== 0 || receipt.legacy_process_count !== 0 || receipt.state_mutation_count !== 0 || receipt.dispatch_frozen !== true || receipt.no_external_mutation !== true) throw new Error('quiet-window receipt does not prove a mutation-free engine stop');
}

function validateBindingShape(binding, trustedNow) {
  const keys = ['schema', 'reconciler_head', 'reconciler_tree', 'source', 'target', 'canonical_anchor_oid', 'machine_lease', 'work_leases', 'mode', 'not_before', 'quiet_window_receipt_hash', 'expected_event_count_delta', 'dispatch_frozen', 'no_refill', 'no_assignment', 'no_dispatch', 'no_external_mutation', 'one_use', 'expires_at', 'target_ref', 'expected_remote_oid', 'push_mode', 'abort_on_remote_change'];
  exactKeys(binding, keys, 'scheduler_state_reconciliation');
  if (binding.schema !== 'agentops/scheduler-state-reconciliation-authority/v1') throw new Error('reconciliation authority schema is unsupported');
  if (binding.mode !== 'release-custody-and-reconcile-work-leases') throw new Error('reconciliation mode is not exact');
  for (const flag of ['dispatch_frozen', 'no_refill', 'no_assignment', 'no_dispatch', 'no_external_mutation', 'one_use', 'abort_on_remote_change']) if (binding[flag] !== true) throw new Error(`${flag} must be true`);
  if (binding.target_ref !== STATE_REF || binding.push_mode !== 'non-force-forward-only-cas') throw new Error('state ref/push mode is not exact non-force CAS');
  if (instant(binding.expires_at, 'authority expires_at') <= instant(trustedNow, 'trusted_now')) throw new Error('reconciliation authority is expired');
  if (instant(binding.not_before, 'not_before') > instant(trustedNow, 'trusted_now')) throw new Error('trusted time has not reached not_before');
  if (!Number.isInteger(binding.expected_event_count_delta) || binding.expected_event_count_delta < 0) throw new Error('expected_event_count_delta must be non-negative');
  if (!Array.isArray(binding.work_leases)) throw new Error('work_leases must be an exact array');
}

export function validateAuthority(root, { authorityEventPath, authorityStateOid, trustedNow, remote = 'origin', quietWindowReceipt }) {
  if (!OID.test(authorityStateOid ?? '')) throw new Error('authority_state_oid must be an exact commit OID');
  if (!/^\.agentops\/events\/[^/]+\/[^/]+\.json$/.test(authorityEventPath ?? '') || authorityEventPath.includes('..')) throw new Error('authority event must use a canonical AgentOps event path');
  const freshDev = remoteOid(root, remote, DEV_REF);
  if (freshDev !== authorityStateOid) throw new Error(`authority_state_oid is stale; fresh ${DEV_REF} is ${freshDev}`);
  ensureCommitObject(root, authorityStateOid, remote, DEV_REF);
  const event = jsonAt(root, authorityStateOid, authorityEventPath);
  const eventSchema = jsonAt(root, authorityStateOid, '.agentops/schemas/event.schema.json');
  const bindingSchema = eventSchema?.properties?.decision?.properties?.scheduler_state_reconciliation;
  if (!bindingSchema || sha256(bindingSchema) !== TRUSTED_EVENT_BINDING_SCHEMA_HASH) throw new Error('committed event schema does not carry the trusted closed scheduler_state_reconciliation binding');
  const eventErrors = validateSchema(event, eventSchema, '$');
  if (eventErrors.length) throw new Error(`authority event schema validation failed: ${eventErrors.join('; ')}`);
  if (event.schema !== 'agentops/event/v1' || event.kind !== 'owner-decision' || event.actor !== 'owner' || event.decision?.action !== ACTION || event.decision.authenticated_role !== 'owner' || event.decision.authority_path !== '.github/workflows/owner-command.yml:owner-command/v1') throw new Error('authority event is not the exact authenticated owner-only scheduler reconciliation action');
  const binding = event.decision.scheduler_state_reconciliation;
  validateBindingShape(binding, trustedNow);
  if (event.decision.candidate_oid !== binding.reconciler_head) throw new Error('authority candidate_oid does not equal reconciler_head');
  const head = gitText(root, ['rev-parse', 'HEAD']);
  const actualTree = gitText(root, ['rev-parse', 'HEAD^{tree}']);
  if (gitText(root, ['status', '--porcelain=v1']) !== '') throw new Error('reconciler worktree must be clean at its bound executable head');
  if (head !== binding.reconciler_head || actualTree !== binding.reconciler_tree) throw new Error('running reconciler HEAD/tree does not match authority binding');
  if (runGit(root, ['merge-base', '--is-ancestor', binding.reconciler_head, authorityStateOid], { allowFailure: true }).status !== 0) throw new Error('reconciler head is not an ancestor of fresh authority state');
  const policy = jsonAt(root, authorityStateOid, '.agentops/governance/owner-command.json');
  const action = policy.actions?.find((entry) => entry.id === ACTION);
  if (sha256(action) !== TRUSTED_POLICY_ACTION_HASH) throw new Error('committed reconciliation action differs from the trusted protected action');
  if (!action?.protected || action.requires_cas !== true || action.one_use !== true || action.expires !== true || action.structured_only !== true || action.consumes_on_attempt !== true || stableStringify(action.authenticator_roles) !== stableStringify(['owner']) || stableStringify(action.required_fields) !== stableStringify(['target', 'expected_current_hash', 'candidate_oid', 'scheduler_state_reconciliation'])) throw new Error('committed reconciliation action is not exact owner-only CAS, expiring, structured, and consume-on-attempt authority');
  const parents = gitText(root, ['show', '-s', '--format=%P', authorityStateOid]).split(/\s+/).filter(Boolean);
  if (parents.length !== 1) throw new Error('authority event commit must be one ordinary direct child');
  const capsulePath = `.agentops/work/${event.ticket}/CURRENT.json`;
  const changed = gitText(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', parents[0], authorityStateOid]).split(/\r?\n/).filter(Boolean).sort();
  if (stableStringify(changed) !== stableStringify([authorityEventPath, capsulePath].sort())) throw new Error('authority event commit changed paths beyond its event and sealed capsule');
  const introducing = gitText(root, ['log', '--format=%H', '--diff-filter=A', authorityStateOid, '--', authorityEventPath]).split(/\r?\n/).filter(Boolean);
  if (stableStringify(introducing) !== stableStringify([authorityStateOid])) throw new Error('authority event is not introduced exactly once by authority_state_oid');
  const ticketFromPath = /^\.agentops\/events\/([^/]+)\//.exec(authorityEventPath)?.[1];
  if (event.ticket !== ticketFromPath || event.decision.target !== event.ticket) throw new Error('authority event path, ticket, and decision target are not identical');
  const priorPaths = gitText(root, ['ls-tree', '-r', '--name-only', parents[0], '--', `.agentops/events/${event.ticket}`]).split(/\r?\n/).filter(Boolean).sort();
  const priorEvents = priorPaths.map((eventPath) => jsonAt(root, parents[0], eventPath)).sort((left, right) => left.seq - right.seq);
  for (let index = 0; index < priorEvents.length; index++) {
    if (priorEvents[index].seq !== index + 1 || (index === 0 ? priorEvents[index].parent_event !== null : priorEvents[index].parent_event !== priorEvents[index - 1].id)) throw new Error('authority parent event chain is not contiguous and append-only');
  }
  const priorEvent = priorEvents.at(-1);
  if (!priorEvent || event.seq !== priorEvent.seq + 1 || event.parent_event !== priorEvent.id) throw new Error('authority event seq/parent does not append the canonical ticket event chain');
  const capsule = jsonAt(root, authorityStateOid, capsulePath);
  const parentCapsule = jsonAt(root, parents[0], capsulePath);
  const capsuleSchema = jsonAt(root, authorityStateOid, '.agentops/schemas/work-capsule.schema.json');
  const capsuleErrors = validateSchema(capsule, capsuleSchema, '$');
  if (capsuleErrors.length) throw new Error(`authority capsule schema validation failed: ${capsuleErrors.join('; ')}`);
  const unsealedCapsule = structuredClone(capsule); unsealedCapsule.current_hash = '';
  if (capsule.ticket !== event.ticket || capsule.current_hash !== `sha256:${sha256(unsealedCapsule)}`) throw new Error('authority capsule identity or seal is invalid');
  if (event.decision.expected_current_hash !== parentCapsule.current_hash || capsule.parent_hash !== parentCapsule.current_hash || capsule.revision !== parentCapsule.revision + 1) throw new Error('authority event/capsule compare-and-swap does not bind the exact parent capsule');
  const parentStable = structuredClone(parentCapsule); const nextStable = structuredClone(capsule);
  for (const field of ['current_hash', 'parent_hash', 'revision', 'next_action']) { delete parentStable[field]; delete nextStable[field]; }
  if (stableStringify(parentStable) !== stableStringify(nextStable)) throw new Error('authority capsule changes fields beyond its seal, revision, and next action');
  if (sha256(quietWindowReceipt) !== binding.quiet_window_receipt_hash) throw new Error('quiet-window receipt hash mismatch');
  validateQuietReceipt(quietWindowReceipt, binding, trustedNow);
  return { event, binding, authority: { authority_state_oid: authorityStateOid, event_path: authorityEventPath, event_id: event.id, event_hash: sha256(event) } };
}

function validateSourceBinding(root, source, binding) {
  const expected = { state_oid: source.oid, state_tree: source.tree, snapshot_sha256: source.snapshot.snapshot_hash, journal_manifest_sha256: source.journalManifest, event_count: source.events.length, state_version: source.stateVersion };
  if (stableStringify(binding.source) !== stableStringify(expected)) throw new Error('authority source binding does not match exact canonical state');
  if (binding.expected_remote_oid !== source.oid) throw new Error('expected_remote_oid does not equal source state');
  if (runGit(root, ['merge-base', '--is-ancestor', binding.canonical_anchor_oid, source.oid], { allowFailure: true }).status !== 0) throw new Error('canonical anchor is not an ancestor of source state');
  if (stableStringify(binding.machine_lease) !== stableStringify(source.machineLease)) throw new Error('authority machine lease does not match exact released custody');
  const active = activeWorkLeases(source.snapshot);
  if (stableStringify(binding.work_leases) !== stableStringify(active)) throw new Error('authority work_leases omits, adds, reorders, or substitutes active custody');
  for (const lease of active) if (instant(lease.lease_expiry, `${lease.issue_id} lease_expiry`) > instant(binding.not_before, 'not_before')) throw new Error(`${lease.issue_id} lease is not expired at not_before`);
  if (binding.expected_event_count_delta !== active.length) throw new Error('expected_event_count_delta must equal the exact enumerated expired work lease count');
  for (const lease of active) {
    if (!OID.test(lease.base_commit ?? '') || runGit(root, ['cat-file', '-e', `${lease.base_commit}^{commit}`], { allowFailure: true }).status !== 0) throw new Error(`${lease.issue_id} base/candidate reachability is unavailable`);
  }
  return active;
}

function reconciliationEvent(source, lease, binding, index) {
  const sequence = source.events.length + index + 1;
  const seed = sha256({ source: source.oid, lease, sequence, not_before: binding.not_before, reconciler_head: binding.reconciler_head });
  return {
    event_id: `evt-${String(sequence).padStart(8, '0')}-reconcile-${seed.slice(0, 16)}`,
    idempotency_key: `state-reconcile-expired:${lease.issue_id}:${lease.lease_id}:${lease.lease_epoch}:${source.oid}`,
    sequence,
    previous_snapshot_hash: null,
    issue_id: lease.issue_id.slice(1),
    actor: 'scheduler',
    machine_id: lease.lease_machine_id,
    lease_id: lease.lease_id,
    lease_epoch: lease.lease_epoch,
    event_type: 'LEASE_EXPIRED',
    exact_object: {},
    payload: { reconciliation: { source_state_oid: source.oid, reconciler_head: binding.reconciler_head, quiet_window_receipt_hash: binding.quiet_window_receipt_hash, no_refill: true, no_assignment: true, no_dispatch: true, no_external_mutation: true } },
    created_at: binding.not_before,
  };
}

function applyExpiration(snapshot, event) {
  const item = snapshot.work_items?.[event.issue_id];
  if (!item || item.lease_id !== event.lease_id || item.lease_epoch !== event.lease_epoch || item.lease_machine_id !== event.machine_id) throw new Error(`expired lease fencing mismatch for #${event.issue_id}`);
  if (instant(item.lease_expiry, `#${event.issue_id} lease_expiry`) > instant(event.created_at, 'event created_at')) throw new Error(`lease expiry for #${event.issue_id} is after reconciliation event`);
  item.state = item.assignment_kind === 'qa' ? 'CANDIDATE_READY' : 'READY';
  item.assigned_actor = null; item.assignment_kind = null; item.lease_id = null; item.lease_expiry = null; item.lease_machine_id = null;
  item.next_action = item.state === 'CANDIDATE_READY' ? 'Reassign independent QA for the preserved candidate.' : 'Reclaim from the last preserved candidate or worktree.';
  item.revision += 1; item.updated_event = event.event_id; item.updated_at = event.created_at;
  snapshot.revision += 1; snapshot.last_sequence = event.sequence; snapshot.snapshot_hash = snapshotHash(snapshot);
}

function createCommit(root, parent, files, message, createdAt) {
  const gitDir = gitText(root, ['rev-parse', '--git-dir']);
  const tempRoot = path.resolve(root, gitDir, 'agentops-state-reconciler');
  fs.mkdirSync(tempRoot, { recursive: true });
  const index = path.join(tempRoot, `index-${process.pid}-${sha256({ parent, message, createdAt }).slice(0, 16)}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    runGit(root, ['read-tree', parent], { env });
    for (const [name, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
      const blob = runGit(root, ['hash-object', '-w', '--stdin'], { input: text }).stdout;
      runGit(root, ['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`], { env });
    }
    const tree = runGit(root, ['write-tree'], { env }).stdout;
    const identity = { GIT_AUTHOR_NAME: 'AshenSpire State Reconciler', GIT_AUTHOR_EMAIL: 'state-reconciler@local.invalid', GIT_COMMITTER_NAME: 'AshenSpire State Reconciler', GIT_COMMITTER_EMAIL: 'state-reconciler@local.invalid', GIT_AUTHOR_DATE: createdAt, GIT_COMMITTER_DATE: createdAt };
    const oid = runGit(root, ['commit-tree', tree, '-p', parent, '-m', message], { env: { ...env, ...identity } }).stdout;
    const parents = gitText(root, ['show', '-s', '--format=%P', oid]).split(/\s+/).filter(Boolean);
    if (stableStringify(parents) !== stableStringify([parent])) throw new Error('generated commit is not the exact direct child of its CAS parent');
    const changed = gitText(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', parent, oid]).split(/\r?\n/).filter(Boolean).sort();
    if (stableStringify(changed) !== stableStringify(Object.keys(files).sort())) throw new Error('generated commit changed paths beyond its exact manifest');
    for (const [name, text] of Object.entries(files)) {
      const readback = runGit(root, ['show', `${oid}:${name}`]);
      if (readback.stdout !== text.trim()) throw new Error(`generated commit readback differs for ${name}`);
    }
    return { oid, tree };
  } finally { try { fs.rmSync(index, { force: true }); } catch { /* unique harmless residue */ } }
}

export function buildPlan(root, { binding, sourceOid = binding?.source?.state_oid, enforceTarget = true }) {
  validateBindingShape(binding, binding.not_before);
  const source = readState(root, sourceOid);
  const leases = validateSourceBinding(root, source, binding);
  const snapshot = structuredClone(source.snapshot);
  const events = [];
  for (let index = 0; index < leases.length; index++) {
    const event = reconciliationEvent(source, leases[index], binding, index);
    event.previous_snapshot_hash = snapshot.snapshot_hash;
    applyExpiration(snapshot, event);
    events.push(event);
  }
  const files = { 'snapshot.json': `${JSON.stringify(snapshot, null, 2)}\n` };
  for (const event of events) files[`journal/${String(event.sequence).padStart(8, '0')}-${event.event_id}.json`] = `${JSON.stringify(event, null, 2)}\n`;
  const targetCommit = createCommit(root, source.oid, files, `scheduler reconcile ${leases.map((lease) => lease.issue_id).join(',') || 'none'}`, binding.not_before);
  const targetEntries = treeEntries(root, targetCommit.oid);
  const target = { state_oid: targetCommit.oid, state_tree: targetCommit.tree, snapshot_sha256: snapshot.snapshot_hash, journal_manifest_sha256: journalManifest(targetEntries), event_count: source.events.length + events.length };
  if (enforceTarget && stableStringify(binding.target) !== stableStringify(target)) throw new Error('authority target binding does not match deterministic prebuilt target');
  if (target.event_count - source.events.length !== binding.expected_event_count_delta) throw new Error('deterministic target event delta differs from authority');
  if (stableStringify(jsonAt(root, target.state_oid, 'machine-lease.json')) !== stableStringify(source.machineLease)) throw new Error('target changed released machine custody');
  return { source, target, events, work_leases: leases };
}

function pushCas(root, remote, newOid, ref, expectedOld, pushRunner = runGit) {
  const before = remoteOid(root, remote, ref);
  if (before !== expectedOld) throw new Error(`${ref} remote CAS changed before push; expected ${expectedOld}, observed ${before}`);
  const pushed = pushRunner(root, ['push', `--force-with-lease=${ref}:${expectedOld}`, remote, `${newOid}:${ref}`], { allowFailure: true });
  const observed = remoteOid(root, remote, ref); // exactly one ambiguity inspection
  if (observed === newOid) return { outcome: pushed.status === 0 ? 'CONFIRMED' : 'AMBIGUOUS_CONFIRMED_ONCE', observed };
  if (pushed.status !== 0 && observed === expectedOld) return { outcome: 'AMBIGUOUS_UNCHANGED_ONCE', observed };
  if (pushed.status !== 0) throw new Error(`${ref} push result was ambiguous and one inspection observed ${observed}; exact lease is lost and will not retry`);
  throw new Error(`${ref} push reported success but exact target was not observed; attempt is consumed and will not retry`);
}

function validateCommittedRecord(root, reconcilerHead, schemaName, value, label) {
  const schema = jsonAt(root, reconcilerHead, `.agentops/scheduler/schemas/${schemaName}`);
  const errors = validateSchema(value, schema, '$');
  if (errors.length) throw new Error(`${label} schema validation failed: ${errors.join('; ')}`);
}

function attemptIdentity(authority, binding) {
  return sha256({ authority, source: binding.source, target: binding.target, reconciler_head: binding.reconciler_head });
}

function ensureNoPriorAttempt(root, authorityStateOid, attemptPath) {
  if (runGit(root, ['cat-file', '-e', `${authorityStateOid}:${attemptPath}`], { allowFailure: true }).status === 0) throw new Error('exact reconciliation authority packet was already attempted');
}

function attemptRecord(authority, binding, trustedNow) {
  const attempt_id = attemptIdentity(authority, binding);
  return {
    schema: 'agentops/scheduler-state-reconciliation-attempt/v1', attempt_id, status: 'ATTEMPTED', authority,
    reconciler: { head: binding.reconciler_head, tree: binding.reconciler_tree }, source: binding.source, target: binding.target,
    quiet_window_receipt_hash: binding.quiet_window_receipt_hash, trusted_now: trustedNow, state_ref: binding.target_ref, development_ref: DEV_REF,
    invariants: { dispatch_frozen: binding.dispatch_frozen, no_refill: binding.no_refill, no_assignment: binding.no_assignment, no_dispatch: binding.no_dispatch, no_external_mutation: binding.no_external_mutation, push_mode: binding.push_mode, abort_on_remote_change: binding.abort_on_remote_change },
  };
}

function receiptRecord(attempt, attemptPath, attemptCommitOid, authority, statePush) {
  const receipt = { schema: 'agentops/scheduler-state-reconciliation-receipt/v1', attempt_id: attempt.attempt_id, status: 'APPLIED', attempt_path: attemptPath, attempt_commit_oid: attemptCommitOid, authority, source_state_oid: attempt.source.state_oid, target_state_oid: attempt.target.state_oid, observed_state_remote_oid: attempt.target.state_oid, development_parent_oid: attemptCommitOid, state_push: statePush, receipt_hash: '' };
  receipt.receipt_hash = sha256({ ...receipt, receipt_hash: '' });
  return receipt;
}

export function applyReconciliation(root, options) {
  const { authorityEventPath, authorityStateOid, trustedNow, quietWindowReceipt, remote = 'origin', pushRunner = runGit } = options;
  const validated = validateAuthority(root, { authorityEventPath, authorityStateOid, trustedNow, remote, quietWindowReceipt });
  ensureCommitObject(root, validated.binding.source.state_oid, remote, validated.binding.target_ref);
  const plan = buildPlan(root, { binding: validated.binding });
  if (remoteOid(root, remote, validated.binding.target_ref) !== plan.source.oid) throw new Error('state remote changed after planning; nothing attempted');
  const attempt = attemptRecord(validated.authority, validated.binding, trustedNow);
  validateCommittedRecord(root, validated.binding.reconciler_head, 'state-reconciliation-attempt.json', attempt, 'reconciliation attempt');
  const attemptPath = `${ATTEMPT_ROOT}/${attempt.attempt_id}.json`;
  ensureNoPriorAttempt(root, authorityStateOid, attemptPath);
  const attemptCommit = createCommit(root, authorityStateOid, { [attemptPath]: `${JSON.stringify(attempt, null, 2)}\n` }, `scheduler state reconciliation attempted ${attempt.attempt_id}`, trustedNow);
  const attemptPush = pushCas(root, remote, attemptCommit.oid, DEV_REF, authorityStateOid, pushRunner);
  if (attemptPush.outcome === 'AMBIGUOUS_UNCHANGED_ONCE') {
    const consumed = { ...attempt, status: 'AMBIGUOUS_UNCHANGED_CONSUMED' };
    validateCommittedRecord(root, validated.binding.reconciler_head, 'state-reconciliation-attempt.json', consumed, 'reconciliation consumed marker');
    const consumedCommit = createCommit(root, authorityStateOid, { [attemptPath]: `${JSON.stringify(consumed, null, 2)}\n` }, `scheduler state reconciliation consumed ${attempt.attempt_id}`, trustedNow);
    const consumedPush = pushCas(root, remote, consumedCommit.oid, DEV_REF, authorityStateOid, pushRunner);
    if (!['CONFIRMED', 'AMBIGUOUS_CONFIRMED_ONCE'].includes(consumedPush.outcome)) throw new Error('ambiguous attempt publication could not durably record consumption; operator intervention required');
    throw new Error('attempt publication was ambiguous and unchanged; durable consumption marker recorded and state push forbidden');
  }

  // The authority is now durably consumed on dev. From here every failure is
  // terminal for this packet: inspect ambiguous transport once, never retry.
  if (remoteOid(root, remote, DEV_REF) !== attemptCommit.oid) throw new Error('dev changed after durable attempt; attempt consumed and state push forbidden');
  if (remoteOid(root, remote, validated.binding.target_ref) !== plan.source.oid) throw new Error('state remote changed after durable attempt; attempt consumed and no state push performed');
  const stateResult = pushCas(root, remote, plan.target.state_oid, validated.binding.target_ref, plan.source.oid, pushRunner);
  if (stateResult.outcome === 'AMBIGUOUS_UNCHANGED_ONCE') throw new Error('state push was ambiguous and unchanged; durable attempt is consumed and state push will not retry');
  const receipt = receiptRecord(attempt, attemptPath, attemptCommit.oid, validated.authority, stateResult.outcome);
  validateCommittedRecord(root, validated.binding.reconciler_head, 'state-reconciliation-receipt.json', receipt, 'reconciliation receipt');
  const receiptPath = `${ATTEMPT_ROOT}/${attempt.attempt_id}.receipt.json`;
  const receiptCommit = createCommit(root, attemptCommit.oid, { [receiptPath]: `${JSON.stringify(receipt, null, 2)}\n` }, `scheduler state reconciliation applied ${attempt.attempt_id}`, trustedNow);
  const receiptPush = pushCas(root, remote, receiptCommit.oid, DEV_REF, attemptCommit.oid, pushRunner);
  if (receiptPush.outcome === 'AMBIGUOUS_UNCHANGED_ONCE') throw new Error('receipt publication was ambiguous and unchanged; attempt remains consumed and receipt will not retry');
  return { attempt, attempt_path: attemptPath, attempt_commit_oid: attemptCommit.oid, target: plan.target, receipt, receipt_path: receiptPath, receipt_commit_oid: receiptCommit.oid };
}

export function verifyReceipt(root, { receipt, receiptPath, remote = 'origin' }) {
  exactKeys(receipt, ['schema', 'attempt_id', 'status', 'attempt_path', 'attempt_commit_oid', 'authority', 'source_state_oid', 'target_state_oid', 'observed_state_remote_oid', 'development_parent_oid', 'state_push', 'receipt_hash'], 'reconciliation receipt');
  if (receipt.schema !== 'agentops/scheduler-state-reconciliation-receipt/v1' || receipt.status !== 'APPLIED') throw new Error('reconciliation receipt schema/status is invalid');
  receiptPath ??= `${ATTEMPT_ROOT}/${receipt.attempt_id}.receipt.json`;
  if (receipt.development_parent_oid !== receipt.attempt_commit_oid || !['CONFIRMED', 'AMBIGUOUS_CONFIRMED_ONCE'].includes(receipt.state_push)) throw new Error('reconciliation receipt parent or state-push outcome is invalid');
  if (receipt.receipt_hash !== sha256({ ...receipt, receipt_hash: '' })) throw new Error('reconciliation receipt hash mismatch');
  if (remoteOid(root, remote, STATE_REF) !== receipt.target_state_oid) throw new Error('receipt target is not the fresh scheduler-state remote');
  const dev = remoteOid(root, remote, DEV_REF);
  const committed = jsonAt(root, dev, receiptPath);
  if (stableStringify(committed) !== stableStringify(receipt)) throw new Error('receipt differs from the fresh dev commit');
  const parents = gitText(root, ['show', '-s', '--format=%P', dev]).split(/\s+/).filter(Boolean);
  if (stableStringify(parents) !== stableStringify([receipt.attempt_commit_oid])) throw new Error('receipt commit is not the exact child of the durable attempt commit');
  const attempt = jsonAt(root, receipt.attempt_commit_oid, receipt.attempt_path);
  exactKeys(attempt, ['schema', 'attempt_id', 'status', 'authority', 'reconciler', 'source', 'target', 'quiet_window_receipt_hash', 'trusted_now', 'state_ref', 'development_ref', 'invariants'], 'reconciliation attempt');
  const expectedAttemptId = sha256({ authority: attempt.authority, source: attempt.source, target: attempt.target, reconciler_head: attempt.reconciler.head });
  if (attempt.schema !== 'agentops/scheduler-state-reconciliation-attempt/v1' || attempt.status !== 'ATTEMPTED' || attempt.attempt_id !== expectedAttemptId || attempt.attempt_id !== receipt.attempt_id || stableStringify(attempt.authority) !== stableStringify(receipt.authority) || attempt.target.state_oid !== receipt.target_state_oid || attempt.source.state_oid !== receipt.source_state_oid) throw new Error('receipt does not bind its exact durable attempt');
  validateCommittedRecord(root, attempt.reconciler.head, 'state-reconciliation-attempt.json', attempt, 'reconciliation attempt');
  validateCommittedRecord(root, attempt.reconciler.head, 'state-reconciliation-receipt.json', receipt, 'reconciliation receipt');
  const attemptParents = gitText(root, ['show', '-s', '--format=%P', receipt.attempt_commit_oid]).split(/\s+/).filter(Boolean);
  if (stableStringify(attemptParents) !== stableStringify([attempt.authority.authority_state_oid])) throw new Error('durable attempt commit is not the exact child of authority_state_oid');
  const attemptPaths = gitText(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', attempt.authority.authority_state_oid, receipt.attempt_commit_oid]).split(/\r?\n/).filter(Boolean);
  if (stableStringify(attemptPaths) !== stableStringify([receipt.attempt_path])) throw new Error('durable attempt commit manifest is not exactly the attempt record');
  const receiptPaths = gitText(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', receipt.attempt_commit_oid, dev]).split(/\r?\n/).filter(Boolean);
  if (stableStringify(receiptPaths) !== stableStringify([receiptPath])) throw new Error('receipt commit manifest is not exactly the receipt record');
  const authorityEvent = jsonAt(root, attempt.authority.authority_state_oid, attempt.authority.event_path);
  if (authorityEvent.id !== attempt.authority.event_id || sha256(authorityEvent) !== attempt.authority.event_hash) throw new Error('receipt durable attempt authority evidence is unavailable or changed');
  const authorityBinding = authorityEvent.decision?.scheduler_state_reconciliation;
  if (authorityEvent.decision?.action !== ACTION || authorityEvent.decision?.candidate_oid !== attempt.reconciler.head || attempt.reconciler.tree !== authorityBinding?.reconciler_tree || stableStringify(attempt.source) !== stableStringify(authorityBinding?.source) || stableStringify(attempt.target) !== stableStringify(authorityBinding?.target) || attempt.quiet_window_receipt_hash !== authorityBinding?.quiet_window_receipt_hash || attempt.state_ref !== authorityBinding?.target_ref || stableStringify(attempt.invariants) !== stableStringify({ dispatch_frozen: authorityBinding?.dispatch_frozen, no_refill: authorityBinding?.no_refill, no_assignment: authorityBinding?.no_assignment, no_dispatch: authorityBinding?.no_dispatch, no_external_mutation: authorityBinding?.no_external_mutation, push_mode: authorityBinding?.push_mode, abort_on_remote_change: authorityBinding?.abort_on_remote_change })) throw new Error('receipt attempt does not bind the full authority source, target, reconciler, and invariant payload');
  if (gitText(root, ['show', '-s', '--format=%T', attempt.reconciler.head]) !== attempt.reconciler.tree) throw new Error('receipt reconciler head/tree binding is invalid');
  const rebuilt = buildPlan(root, { binding: authorityBinding });
  if (rebuilt.target.state_oid !== receipt.target_state_oid || rebuilt.source.oid !== receipt.source_state_oid) throw new Error('receipt does not bind the deterministic authority source and target');
  const state = readState(root, receipt.target_state_oid);
  if (state.tree !== attempt.target.state_tree || state.snapshot.snapshot_hash !== attempt.target.snapshot_sha256 || state.journalManifest !== attempt.target.journal_manifest_sha256 || state.events.length !== attempt.target.event_count || receipt.observed_state_remote_oid !== receipt.target_state_oid) throw new Error('receipt target state tree/hash/manifest/count evidence mismatch');
  const stateParents = gitText(root, ['show', '-s', '--format=%P', receipt.target_state_oid]).split(/\s+/).filter(Boolean);
  if (stableStringify(stateParents) !== stableStringify([receipt.source_state_oid])) throw new Error('receipt target state is not the exact direct successor of source state');
  const targetPaths = gitText(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', receipt.source_state_oid, receipt.target_state_oid]).split(/\r?\n/).filter(Boolean).sort();
  const expectedTargetPaths = ['snapshot.json', ...state.entries.filter((entry) => entry.name.startsWith('journal/')).slice(attempt.source.event_count).map((entry) => entry.name)].sort();
  if (stableStringify(targetPaths) !== stableStringify(expectedTargetPaths)) throw new Error('receipt target commit manifest contains omissions or extra paths');
  return { ok: true, receipt_commit_oid: dev, attempt, state };
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) out._.push(token);
    else { const key = token.slice(2).replace(/-/g, '_'); const next = argv[index + 1]; if (next === undefined || next.startsWith('--')) out[key] = true; else { out[key] = next; index++; } }
  }
  return out;
}

function readJsonFile(file, label) {
  if (!file) throw new Error(`${label} file is required`);
  try { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
  catch (error) { throw new Error(`${label} file is invalid: ${error.message}`); }
}

export function main(argv = process.argv.slice(2), root = REPOSITORY_ROOT) {
  const args = parseArgs(argv);
  const command = args._[0];
  if (!['plan', 'apply', 'verify-receipt'].includes(command)) throw new Error('usage: scheduler-state-reconciler.mjs plan|apply|verify-receipt');
  if (command === 'plan') {
    const value = readJsonFile(args.binding, 'binding');
    const binding = value.scheduler_state_reconciliation ?? value.decision?.scheduler_state_reconciliation ?? value;
    const plan = buildPlan(root, { binding, enforceTarget: false });
    process.stdout.write(`${JSON.stringify({ source: binding.source, target: plan.target, work_leases: plan.work_leases, events: plan.events }, null, 2)}\n`);
    return 0;
  }
  if (command === 'apply') {
    const result = applyReconciliation(root, { authorityEventPath: args.authority_event, authorityStateOid: args.authority_state_oid, trustedNow: args.trusted_now, quietWindowReceipt: readJsonFile(args.quiet_window_receipt, 'quiet-window receipt'), remote: args.remote ?? 'origin' });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  const receipt = readJsonFile(args.receipt, 'receipt');
  const result = verifyReceipt(root, { receipt, receiptPath: args.receipt_path, remote: args.remote ?? 'origin' });
  process.stdout.write(`${JSON.stringify({ ok: result.ok, receipt_commit_oid: result.receipt_commit_oid, target_state_oid: result.state.oid }, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); }
  catch (error) { process.stderr.write(`STATE_RECONCILIATION_FAILED: ${error.message}\n`); process.exitCode = 1; }
}
