#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateSchema } from './opsctl.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPOSITORY_ROOT = path.resolve(ROOT, '..');
export const EVENT_TYPES = new Set([
  'INTAKE_RECORDED', 'CLAIM_ACQUIRED', 'WORK_ENTERED', 'CANDIDATE_READY',
  'QA_ASSIGNED', 'QA_RESULT', 'PR_OPENED', 'MERGED_DEV', 'BLOCKED', 'RESOURCE_RELEASED',
  'LEASE_EXPIRED', 'DRIFT_DETECTED', 'RECOVERY_BOUND', 'SUPERSEDED',
  'CANCELLED', 'COMPLETED'
]);
export const ACTIVE_STATES = new Set(['CLAIMED', 'RUNNING', 'CANDIDATE_READY', 'QA', 'PR_READY', 'PR_OPEN']);
export const TERMINAL_STATES = new Set(['DONE', 'SUPERSEDED', 'CANCELLED']);
const SEAT_ID = /^seat:[a-z0-9-]+:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYSTEM_ACTORS = new Set(['scheduler', 'recovery']);
const SCHEMA_CACHE = new Map();

function schedulerSchema(name) {
  if (!SCHEMA_CACHE.has(name)) SCHEMA_CACHE.set(name, JSON.parse(fs.readFileSync(path.join(ROOT, 'scheduler', 'schemas', `${name}.json`), 'utf8')));
  return SCHEMA_CACHE.get(name);
}

function assertSchema(value, name) {
  const errors = validateSchema(value, schedulerSchema(name), '$');
  if (errors.length) throw new Error(`${name} schema: ${errors.join('; ')}`);
}

export function validateSchedulerDocument(value, name) {
  assertSchema(value, name);
  return true;
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
}

export function snapshotHash(snapshot) {
  const copy = structuredClone(snapshot);
  delete copy.snapshot_hash;
  return sha256(copy);
}

export function emptySnapshot() {
  const value = {
    schema: 'agentops/scheduler-snapshot/v1',
    revision: 0,
    last_sequence: 0,
    work_items: {},
    errors: [],
    snapshot_hash: ''
  };
  value.snapshot_hash = snapshotHash(value);
  return value;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
}

export function validateEvent(event) {
  assertSchema(event, 'event');
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('event must be an object');
  for (const key of ['event_id', 'idempotency_key', 'previous_snapshot_hash', 'issue_id', 'actor', 'event_type', 'created_at']) requiredString(event[key], key);
  if (!Number.isInteger(event.sequence) || event.sequence < 1) throw new Error('sequence must be a positive integer');
  if (!/^[0-9a-f]{64}$/.test(event.previous_snapshot_hash)) throw new Error('previous_snapshot_hash must be sha256');
  if (!EVENT_TYPES.has(event.event_type)) throw new Error(`unsupported event_type ${event.event_type}`);
  if (event.machine_id !== null && typeof event.machine_id !== 'string') throw new Error('machine_id must be string or null');
  if (event.lease_id !== null && typeof event.lease_id !== 'string') throw new Error('lease_id must be string or null');
  if (event.lease_epoch !== null && (!Number.isInteger(event.lease_epoch) || event.lease_epoch < 1)) throw new Error('lease_epoch must be positive integer or null');
  if (!event.exact_object || typeof event.exact_object !== 'object' || Array.isArray(event.exact_object)) throw new Error('exact_object must be an object');
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new Error('payload must be an object');
  if (Number.isNaN(Date.parse(event.created_at))) throw new Error('created_at must be an ISO instant');
  assertPortable(event);
  return true;
}

export function assertPortable(value, keyPath = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => assertPortable(item, `${keyPath}[${index}]`));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (/(secret|token|password|capability)$/i.test(key)) throw new Error(`secret-like field rejected at ${keyPath}.${key}`);
      assertPortable(item, `${keyPath}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('/Users/') || value.startsWith('/home/'))) {
    throw new Error(`absolute machine path rejected at ${keyPath}`);
  }
}

function baseItem(event) {
  const p = event.payload;
  return {
    schema: 'agentops/scheduler-work-item/v1', revision: 1,
    issue_id: event.issue_id, title: p.title, priority: p.priority ?? 'P2',
    dependencies: p.dependencies ?? [], state: 'READY', base_commit: null,
    candidate_commit: null, branch: p.branch ?? null, assigned_actor: null,
    assignment_kind: null, lease_id: null, lease_epoch: null, lease_expiry: null, lease_machine_id: null,
    maker_actor: null, lease_history: [], late_candidates: [],
    claimed_paths: p.claimed_paths ?? [], claimed_resources: p.claimed_resources ?? [],
    acceptance_commands: p.acceptance_commands ?? [], evidence_pointers: p.evidence_pointers ?? [],
    blocker: null, wake_condition: null, next_action: p.next_action ?? 'Inspect the issue and reproduce the acceptance gap.',
    authority_ceiling: p.authority_ceiling ?? 'dev-delivery', updated_event: event.event_id, updated_at: event.created_at
  };
}

function assertExactLease(item, event, { requireActor = true } = {}) {
  if (requireActor && event.actor !== item.assigned_actor) throw new Error('lease actor fencing mismatch');
  if (event.machine_id !== item.lease_machine_id) throw new Error('lease machine fencing mismatch');
  if (event.lease_id !== item.lease_id) throw new Error('lease id fencing mismatch');
  if (event.lease_epoch !== item.lease_epoch) throw new Error('lease epoch fencing mismatch');
}

function priorLease(item, event) {
  return item.lease_history.find((lease) => lease.actor === event.actor
    && lease.machine_id === event.machine_id
    && lease.lease_id === event.lease_id
    && lease.lease_epoch === event.lease_epoch);
}

function clearSeat(item) {
  item.assigned_actor = null;
  item.assignment_kind = null;
  item.lease_id = null;
  item.lease_expiry = null;
  item.lease_machine_id = null;
}

function applyEvent(snapshot, event) {
  const item = snapshot.work_items[event.issue_id];
  const p = event.payload;
  if (event.event_type === 'INTAKE_RECORDED') {
    if (item) throw new Error(`duplicate issue intake ${event.issue_id}`);
    snapshot.work_items[event.issue_id] = baseItem(event);
    return;
  }
  if (!item) throw new Error(`unknown issue ${event.issue_id}`);
  const staleLease = event.lease_epoch !== null && item.lease_epoch !== null && event.lease_epoch < item.lease_epoch;
  const leaseBound = new Set(['WORK_ENTERED', 'CANDIDATE_READY', 'QA_RESULT', 'BLOCKED', 'RESOURCE_RELEASED', 'LEASE_EXPIRED', 'DRIFT_DETECTED']);
  if (staleLease && leaseBound.has(event.event_type) && event.event_type !== 'CANDIDATE_READY') throw new Error(`stale lease epoch ${event.lease_epoch} for ${event.issue_id}`);
  const touch = () => { item.revision += 1; item.updated_event = event.event_id; item.updated_at = event.created_at; };
  switch (event.event_type) {
    case 'CLAIM_ACQUIRED':
      if (!['READY', 'WAITING_DEPENDENCY', 'REPAIR_REQUIRED'].includes(item.state)) throw new Error(`cannot claim ${item.state}`);
      if (!SEAT_ID.test(event.actor)) throw new Error('claim requires an issued UUID-backed seat identity');
      requiredString(event.machine_id, 'claim machine_id');
      requiredString(event.lease_id, 'claim lease_id');
      if (!Number.isInteger(event.lease_epoch) || event.lease_epoch <= (item.lease_epoch ?? 0)) throw new Error('claim requires a strictly increasing lease epoch');
      if (!/^[0-9a-f]{40}$/.test(p.base_commit ?? '')) throw new Error('claim requires an exact base commit');
      if (!/^codex\/[A-Za-z0-9._\/-]+$/.test(p.branch ?? '')) throw new Error('claim requires a unique codex/ branch');
      if (Number.isNaN(Date.parse(p.lease_expiry)) || Date.parse(p.lease_expiry) <= Date.parse(event.created_at)) throw new Error('claim requires a future lease expiry');
      if (item.dependencies.some((dependency) => snapshot.work_items[String(dependency)]?.state !== 'DONE')) throw new Error('claim has unsatisfied dependencies');
      {
        const proposed = { ...item, branch: p.branch, claimed_paths: p.claimed_paths ?? item.claimed_paths, claimed_resources: p.claimed_resources ?? item.claimed_resources };
        const collision = Object.values(snapshot.work_items).find((other) => other.issue_id !== item.issue_id && holdsExclusiveClaim(other) && claimsConflict(proposed, other));
        if (collision) throw new Error(`one-writer collision with ${collision.issue_id}`);
      }
      item.lease_history.push({ actor: event.actor, machine_id: event.machine_id, lease_id: event.lease_id, lease_epoch: event.lease_epoch, assignment_kind: 'implementation' });
      Object.assign(item, {
        state: 'CLAIMED', assigned_actor: event.actor, assignment_kind: 'implementation', branch: p.branch ?? item.branch,
        base_commit: p.base_commit ?? item.base_commit, lease_id: event.lease_id,
        lease_epoch: event.lease_epoch, lease_expiry: p.lease_expiry, lease_machine_id: event.machine_id,
        claimed_paths: p.claimed_paths ?? item.claimed_paths,
        claimed_resources: p.claimed_resources ?? item.claimed_resources,
        blocker: null, wake_condition: null, next_action: p.next_action ?? item.next_action
      });
      break;
    case 'WORK_ENTERED':
      if (item.state !== 'CLAIMED') throw new Error(`cannot enter ${item.state}`);
      assertExactLease(item, event);
      item.state = 'RUNNING'; item.base_commit = p.base_commit ?? item.base_commit; item.next_action = p.next_action ?? item.next_action;
      break;
    case 'CANDIDATE_READY':
      if (!/^[0-9a-f]{40}$/.test(p.candidate_commit ?? '')) throw new Error('candidate requires an exact commit');
      if (staleLease || (item.assigned_actor === null && priorLease(item, event))) {
        if (!priorLease(item, event)) throw new Error('late candidate does not match a previously issued lease');
        item.late_candidates.push({ actor: event.actor, machine_id: event.machine_id, lease_id: event.lease_id, lease_epoch: event.lease_epoch, candidate_commit: p.candidate_commit, evidence_pointers: p.evidence_pointers ?? [], event_id: event.event_id, created_at: event.created_at });
        break;
      }
      if (item.state !== 'RUNNING') throw new Error(`cannot candidate ${item.state}`);
      assertExactLease(item, event);
      item.state = 'CANDIDATE_READY'; item.candidate_commit = p.candidate_commit; item.maker_actor = event.actor; item.evidence_pointers = p.evidence_pointers ?? item.evidence_pointers; item.next_action = 'Bind independent QA to this exact candidate.';
      clearSeat(item);
      break;
    case 'QA_ASSIGNED':
      if (item.state !== 'CANDIDATE_READY') throw new Error(`cannot assign QA from ${item.state}`);
      if (!SEAT_ID.test(event.actor)) throw new Error('QA assignment requires an issued UUID-backed seat identity');
      if (event.actor === item.maker_actor) throw new Error('QA actor must be independent from maker');
      if (p.candidate_commit !== item.candidate_commit || event.exact_object?.oid !== item.candidate_commit) throw new Error('QA assignment does not match exact candidate commit');
      requiredString(event.machine_id, 'QA machine_id');
      requiredString(event.lease_id, 'QA lease_id');
      if (!Number.isInteger(event.lease_epoch) || event.lease_epoch <= (item.lease_epoch ?? 0)) throw new Error('QA assignment requires a strictly increasing lease epoch');
      if (Number.isNaN(Date.parse(p.lease_expiry)) || Date.parse(p.lease_expiry) <= Date.parse(event.created_at)) throw new Error('QA assignment requires a future lease expiry');
      item.lease_history.push({ actor: event.actor, machine_id: event.machine_id, lease_id: event.lease_id, lease_epoch: event.lease_epoch, assignment_kind: 'qa' });
      item.state = 'QA'; item.assigned_actor = event.actor; item.assignment_kind = 'qa'; item.lease_machine_id = event.machine_id; item.lease_id = event.lease_id; item.lease_epoch = event.lease_epoch; item.lease_expiry = p.lease_expiry; item.next_action = 'Run independent QA against the exact candidate commit.';
      break;
    case 'QA_RESULT':
      if (item.state !== 'QA') throw new Error(`cannot QA ${item.state}`);
      assertExactLease(item, event);
      if (!SEAT_ID.test(event.actor) || event.actor === item.maker_actor || item.assignment_kind !== 'qa') throw new Error('QA result requires the issued independent QA lease');
      if (p.candidate_commit !== item.candidate_commit) throw new Error('QA candidate does not match exact current head');
      if (!['PASS', 'FAIL'].includes(p.result)) throw new Error('QA result must be PASS or FAIL');
      item.state = p.result === 'PASS' ? 'PR_READY' : 'REPAIR_REQUIRED';
      item.next_action = p.result === 'PASS' ? 'Deliver an issue-closing PR to dev.' : (p.next_action ?? 'Repair the exact failed candidate.');
      item.evidence_pointers = [...new Set([...item.evidence_pointers, ...(p.evidence_pointers ?? [])])];
      clearSeat(item);
      break;
    case 'PR_OPENED':
      if (item.state !== 'PR_READY') throw new Error(`cannot open PR from ${item.state}`);
      if (event.actor !== 'scheduler') throw new Error('PR_OPENED requires scheduler actor');
      item.state = 'PR_OPEN'; item.next_action = 'Wait for required checks and independent exact-head review.'; item.evidence_pointers = [...new Set([...item.evidence_pointers, p.pr_url].filter(Boolean))];
      break;
    case 'MERGED_DEV':
      if (item.state !== 'PR_OPEN') throw new Error(`cannot merge from ${item.state}`);
      if (event.actor !== 'scheduler') throw new Error('MERGED_DEV requires scheduler actor');
      if (!/^[0-9a-f]{40}$/.test(p.merge_commit ?? '')) throw new Error('dev merge requires an exact merge commit');
      item.state = 'MERGED_DEV'; item.next_action = 'Verify issue closure, release resources, and complete.'; item.evidence_pointers = [...new Set([...item.evidence_pointers, p.merge_commit].filter(Boolean))];
      break;
    case 'COMPLETED':
      if (item.state !== 'MERGED_DEV') throw new Error(`cannot complete from ${item.state}`);
      if (!SYSTEM_ACTORS.has(event.actor)) throw new Error('COMPLETED requires system actor');
      item.state = 'DONE'; item.next_action = null;
      item.claimed_paths = []; item.claimed_resources = []; clearSeat(item);
      break;
    case 'BLOCKED':
      if (TERMINAL_STATES.has(item.state)) throw new Error(`cannot block ${item.state}`);
      assertExactLease(item, event);
      item.state = 'WAITING_DEPENDENCY'; item.blocker = p.blocker; item.wake_condition = p.wake_condition; item.next_action = p.next_action ?? null;
      clearSeat(item); item.claimed_resources = p.retained_resources ?? []; item.claimed_paths = p.retained_paths ?? [];
      break;
    case 'RESOURCE_RELEASED':
      if (item.state === 'WAITING_DEPENDENCY' && item.assigned_actor === null) {
        if (event.actor !== 'scheduler' || !event.machine_id || event.lease_id !== null || event.lease_epoch !== item.lease_epoch) throw new Error('retained-claim release fencing mismatch');
      } else assertExactLease(item, event);
      clearSeat(item); item.claimed_paths = p.retained_paths ?? []; item.claimed_resources = p.retained_resources ?? [];
      if (p.requeue === true && !TERMINAL_STATES.has(item.state)) item.state = 'READY';
      break;
    case 'LEASE_EXPIRED':
      if (event.actor !== 'scheduler') throw new Error('lease expiry requires scheduler actor');
      requiredString(event.machine_id, 'lease expiry machine_id');
      if (event.lease_id !== item.lease_id || event.lease_epoch !== item.lease_epoch) throw new Error('lease expiry fencing token mismatch');
      item.state = item.assignment_kind === 'qa' ? 'CANDIDATE_READY' : 'READY'; clearSeat(item); item.next_action = item.state === 'CANDIDATE_READY' ? 'Reassign independent QA for the preserved candidate.' : 'Reclaim from the last preserved candidate or worktree.';
      break;
    case 'DRIFT_DETECTED':
      if (event.actor !== 'scheduler') throw new Error('drift detection requires scheduler actor');
      requiredString(event.machine_id, 'drift machine_id');
      if (item.lease_id !== null && (event.lease_id !== item.lease_id || event.lease_epoch !== item.lease_epoch)) throw new Error('drift fencing token mismatch');
      item.state = 'REPAIR_REQUIRED'; item.blocker = p.blocker ?? 'drift detected'; item.wake_condition = p.wake_condition ?? 'current base and exact head reconciled'; clearSeat(item);
      break;
    case 'RECOVERY_BOUND':
      if (!['READY', 'WAITING_DEPENDENCY', 'REPAIR_REQUIRED'].includes(item.state)) throw new Error(`cannot recover ${item.state}`);
      if (!SEAT_ID.test(event.actor)) throw new Error('recovery requires an issued UUID-backed seat identity');
      requiredString(event.machine_id, 'recovery machine_id'); requiredString(event.lease_id, 'recovery lease_id');
      if (!Number.isInteger(event.lease_epoch) || event.lease_epoch <= (item.lease_epoch ?? 0)) throw new Error('recovery requires a strictly increasing lease epoch');
      if (!/^[0-9a-f]{40}$/.test(p.base_commit ?? '') || Number.isNaN(Date.parse(p.lease_expiry))) throw new Error('recovery requires exact base and lease expiry');
      {
        const proposed = { ...item, branch: p.branch ?? item.branch };
        const collision = Object.values(snapshot.work_items).find((other) => other.issue_id !== item.issue_id && holdsExclusiveClaim(other) && claimsConflict(proposed, other));
        if (collision) throw new Error(`one-writer collision with ${collision.issue_id}`);
      }
      item.lease_history.push({ actor: event.actor, machine_id: event.machine_id, lease_id: event.lease_id, lease_epoch: event.lease_epoch, assignment_kind: 'implementation' });
      item.state = 'CLAIMED'; item.assigned_actor = event.actor; item.assignment_kind = 'implementation'; item.lease_id = event.lease_id; item.lease_epoch = event.lease_epoch; item.lease_expiry = p.lease_expiry; item.lease_machine_id = event.machine_id; item.branch = p.branch ?? item.branch; item.base_commit = p.base_commit ?? item.base_commit;
      break;
    case 'SUPERSEDED':
      if (event.actor !== 'scheduler') throw new Error('SUPERSEDED requires scheduler actor');
      item.state = 'SUPERSEDED'; clearSeat(item); item.claimed_paths = []; item.claimed_resources = []; item.next_action = null;
      break;
    case 'CANCELLED':
      if (event.actor !== 'scheduler') throw new Error('CANCELLED requires scheduler actor');
      item.state = 'CANCELLED'; clearSeat(item); item.claimed_paths = []; item.claimed_resources = []; item.next_action = null;
      break;
    default: throw new Error(`unhandled event ${event.event_type}`);
  }
  touch();
}

export function reduceEvents(events) {
  const snapshot = emptySnapshot();
  const seen = new Map();
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence || a.event_id.localeCompare(b.event_id));
  for (const event of ordered) {
    try {
      validateEvent(event);
      const prior = seen.get(event.idempotency_key);
      if (prior) {
        if (stableStringify(prior) !== stableStringify(event)) throw new Error(`idempotency collision ${event.idempotency_key}`);
        continue;
      }
      if (event.sequence !== snapshot.last_sequence + 1) throw new Error(`missing sequence ${snapshot.last_sequence + 1}`);
      if (event.previous_snapshot_hash !== snapshot.snapshot_hash) throw new Error('previous snapshot hash mismatch');
      applyEvent(snapshot, event);
      snapshot.revision += 1;
      snapshot.last_sequence = event.sequence;
      snapshot.snapshot_hash = snapshotHash(snapshot);
      seen.set(event.idempotency_key, event);
    } catch (error) {
      snapshot.errors.push({ event_id: event?.event_id ?? null, issue_id: event?.issue_id ?? null, error: error.message });
      snapshot.snapshot_hash = snapshotHash(snapshot);
    }
  }
  return snapshot;
}

export function pathsOverlap(left, right) {
  const normalize = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '').toLowerCase();
  const a = normalize(left); const b = normalize(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function claimsConflict(left, right) {
  if (left.branch && right.branch && left.branch === right.branch) return true;
  if ((left.claimed_resources ?? []).some((resource) => (right.claimed_resources ?? []).includes(resource))) return true;
  return (left.claimed_paths ?? []).some((a) => (right.claimed_paths ?? []).some((b) => pathsOverlap(a, b)));
}

function holdsExclusiveClaim(item) {
  if (TERMINAL_STATES.has(item.state)) return false;
  if (item.state === 'READY') return false;
  return ACTIVE_STATES.has(item.state)
    || (item.claimed_paths ?? []).length > 0
    || (item.claimed_resources ?? []).length > 0;
}

export function resolveCanonicalIssue(snapshot, issueId) {
  const item = snapshot.work_items[String(issueId)] ?? null;
  return item ? { duplicate: true, canonical_issue_id: item.issue_id, updated_event: item.updated_event } : { duplicate: false, canonical_issue_id: String(issueId) };
}

function priorityValue(value) {
  const match = /^P([0-9]+)$/i.exec(value ?? 'P9');
  return match ? Number(match[1]) : 99;
}

export function planAssignments(snapshot, config, now = new Date().toISOString(), currentBaseCommit = null) {
  const items = Object.values(snapshot.work_items);
  const active = items.filter((item) => ACTIVE_STATES.has(item.state));
  const activeActors = new Set(active.map((item) => item.assigned_actor).filter(Boolean));
  const qaBacklogItems = items.filter((item) => item.state === 'CANDIDATE_READY')
    .sort((a, b) => priorityValue(a.priority) - priorityValue(b.priority) || a.updated_event.localeCompare(b.updated_event) || a.issue_id.localeCompare(b.issue_id));
  const qaInFlight = items.filter((item) => item.state === 'QA').length;
  const qaBacklog = qaBacklogItems.length + qaInFlight;
  const prBacklog = items.filter((item) => ['PR_READY', 'PR_OPEN'].includes(item.state)).length;
  const implementationPaused = qaBacklog >= config.maximum_candidates_waiting_for_qa || prBacklog >= config.maximum_prs_waiting_for_review;
  const done = new Set(items.filter((item) => item.state === 'DONE').map((item) => item.issue_id));
  const ready = items.filter((item) => ['READY', 'REPAIR_REQUIRED'].includes(item.state) && item.dependencies.every((dependency) => done.has(String(dependency))))
    .sort((a, b) => priorityValue(a.priority) - priorityValue(b.priority) || a.updated_event.localeCompare(b.updated_event) || a.issue_id.localeCompare(b.issue_id));
  const seats = config.workers.filter((seat) => !activeActors.has(seat.actor));
  const planned = [];
  const locks = items.filter(holdsExclusiveClaim);
  const reservedActors = new Set();
  for (const candidate of qaBacklogItems) {
    if (qaInFlight + planned.filter((assignment) => assignment.kind === 'qa').length >= config.qa_slots) break;
    const seat = seats.find((worker) => !reservedActors.has(worker.actor) && worker.actor !== candidate.maker_actor && (worker.capabilities.includes('qa') || worker.capabilities.includes('review')));
    if (!seat) break;
    const epoch = (candidate.lease_epoch ?? 0) + 1;
    const expiry = new Date(Date.parse(now) + config.lease_duration_seconds * 1000).toISOString();
    planned.push({ kind: 'qa', issue_id: candidate.issue_id, actor: seat.actor, lease_id: `qa-lease:${candidate.issue_id}:${epoch}`, lease_epoch: epoch, lease_expiry: expiry, base_commit: candidate.base_commit, candidate_commit: candidate.candidate_commit });
    reservedActors.add(seat.actor);
  }
  for (const seat of seats.filter((worker) => !reservedActors.has(worker.actor) && worker.capabilities.includes('implementation'))) {
    if (implementationPaused) continue;
    const candidate = ready.find((item) => !planned.some((p) => p.issue_id === item.issue_id) && !locks.some((lock) => lock.issue_id !== item.issue_id && claimsConflict(item, lock)));
    if (!candidate) continue;
    const epoch = (candidate.lease_epoch ?? 0) + 1;
    const expiry = new Date(Date.parse(now) + config.lease_duration_seconds * 1000).toISOString();
    planned.push({ kind: 'implementation', issue_id: candidate.issue_id, actor: seat.actor, lease_id: `lease:${candidate.issue_id}:${epoch}`, lease_epoch: epoch, lease_expiry: expiry, base_commit: currentBaseCommit ?? candidate.base_commit });
    locks.push(candidate);
    reservedActors.add(seat.actor);
  }
  return { assignments: planned, no_safe_assignment: seats.length > 0 && planned.length === 0, implementation_paused: implementationPaused, qa_backlog: qaBacklog, qa_in_flight: qaInFlight, pr_backlog: prBacklog };
}

function currentDevelopmentBase(root, config) {
  runGit(root, ['fetch', 'origin', `+refs/heads/${config.development_branch}:refs/remotes/origin/${config.development_branch}`]);
  const oid = refOid(root, `refs/remotes/origin/${config.development_branch}`, false);
  if (!/^[0-9a-f]{40}$/.test(oid ?? '')) throw new Error('current development base is unavailable');
  return oid;
}

export function compileWake(item, config, repository = 'https://github.com/cehinds/AshenSpire.git') {
  const qa = item.assignment_kind === 'qa';
  const wake = {
    IDENTITY: item.assigned_actor,
    ISSUE: item.issue_id,
    OBJECTIVE: item.title,
    FIRST_ACTION: item.next_action,
    DONE_WHEN: qa ? `Independent QA records PASS or FAIL for exact candidate ${item.candidate_commit}.` : `Acceptance commands pass and a CANDIDATE_READY event names the exact candidate commit for ${item.issue_id}.`,
    REPOSITORY: repository,
    BASE_COMMIT: item.base_commit,
    BRANCH_WORKTREE: item.branch,
    ALLOWED_PATHS: item.claimed_paths,
    CLAIMED_RESOURCES: item.claimed_resources,
    LEASE: { id: item.lease_id, epoch: item.lease_epoch, expiry: item.lease_expiry },
    ACCEPTANCE_COMMANDS: item.acceptance_commands,
    EVIDENCE_TARGET: item.evidence_pointers,
    AUTHORITY_CEILING: item.authority_ceiling,
    FORBIDDEN_ACTIONS: ['edit outside lease', 'force-push', 'protected promotion', 'publish', 'deploy', 'release', 'manufacture QA or owner approval'],
    BLOCKER_WAKE: { blocker: item.blocker, wake_condition: item.wake_condition },
    ROLLBACK: 'Preserve the branch and evidence; emit BLOCKED or RESOURCE_RELEASED and let the scheduler refill the seat.'
  };
  assertSchema(wake, 'wake');
  const characters = stableStringify(wake).length;
  const estimatedTokens = Math.ceil(characters / 4);
  if (estimatedTokens > config.wake_hard_limit_tokens) throw new Error(`wake capsule exceeds ${config.wake_hard_limit_tokens} tokens`);
  return { wake, estimated_tokens: estimatedTokens, target_met: estimatedTokens <= config.wake_target_tokens };
}

export function protectedTransitionAllowed(config, transition, gates = {}) {
  const authorityKey = {
    test: 'promotion_to_test', release: 'promotion_to_release', main: 'promotion_to_main',
    pages: 'pages_publication', deploy: 'deployment', tag: 'tagging', production: 'production_release'
  }[transition];
  if (authorityKey) return { allowed: config.authority[authorityKey] === true, reason: config.authority[authorityKey] ? 'standing authority' : 'CONSTANTINE_DECISION_REQUIRED' };
  if (transition === 'merge-dev') {
    const required = ['current_base', 'head_unchanged', 'one_writer', 'checks_passed', 'independent_review', 'threads_resolved', 'no_competing_pr', 'rollback_known'];
    const missing = required.filter((key) => gates[key] !== true);
    return { allowed: config.authority.merge_eligible_pr_to_dev === true && missing.length === 0, reason: missing.length ? `missing:${missing.join(',')}` : 'standing dev merge authority' };
  }
  return { allowed: false, reason: 'unknown transition' };
}

export function compareAndSwap(current, expected, next) {
  if (current !== expected) return { ok: false, current };
  return { ok: true, current: next };
}

export function historyAdvanceAllowed(oldOid, newOid, isAncestor) {
  if (oldOid === newOid) return { allowed: true, changed: false };
  return isAncestor(oldOid, newOid) ? { allowed: true, changed: true } : { allowed: false, changed: true, reason: 'REWRITTEN_HISTORY' };
}

function runGit(root, args, options = {}) {
  const result = spawnSync('git', ['-c', `safe.directory=${root}`, '-C', root, ...args], { encoding: 'utf8', input: options.input, env: { ...process.env, ...(options.env ?? {}) } });
  if (result.status !== 0 && !options.allowFailure) throw new Error((result.stderr || result.stdout || `git ${args[0]} failed`).trim());
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function runGh(args, options = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8', input: options.input, env: process.env });
  if (result.status !== 0 && !options.allowFailure) throw new Error((result.stderr || result.stdout || `gh ${args[0]} failed`).trim());
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function numericIssue(issueId) {
  const match = /(?:^|#)(\d+)$/.exec(String(issueId));
  if (!match) throw new Error(`issue_id ${issueId} is not a canonical GitHub issue number`);
  return Number(match[1]);
}

export function deliverCandidate(root, item) {
  if (item.state !== 'PR_READY') throw new Error(`delivery requires PR_READY, found ${item.state}`);
  if (!/^codex\/[A-Za-z0-9._\/-]+$/.test(item.branch ?? '')) throw new Error('delivery requires a unique codex/ branch');
  if (!/^[0-9a-f]{40}$/.test(item.candidate_commit ?? '')) throw new Error('delivery requires an exact candidate commit');
  runGit(root, ['cat-file', '-e', `${item.candidate_commit}^{commit}`]);
  runGit(root, ['push', 'origin', `${item.candidate_commit}:refs/heads/${item.branch}`]);
  const existing = JSON.parse(runGh(['pr', 'list', '--repo', 'cehinds/AshenSpire', '--state', 'open', '--head', item.branch, '--base', 'dev', '--json', 'number,url,headRefOid']).stdout || '[]');
  if (existing.length > 1) throw new Error(`multiple open PRs for ${item.branch}`);
  if (existing.length === 1) {
    if (existing[0].headRefOid !== item.candidate_commit) throw new Error('open PR head differs from candidate');
    return { created: false, ...existing[0] };
  }
  const issue = numericIssue(item.issue_id);
  const body = `Closes #${issue}\n\nExact scheduler candidate: \`${item.candidate_commit}\`\n\nRollback: revert the merge commit; preserve the candidate branch and scheduler evidence.`;
  const url = runGh(['pr', 'create', '--repo', 'cehinds/AshenSpire', '--base', 'dev', '--head', item.branch, '--title', item.title, '--body', body]).stdout.split(/\r?\n/).at(-1);
  const created = JSON.parse(runGh(['pr', 'view', url, '--repo', 'cehinds/AshenSpire', '--json', 'number,url,headRefOid']).stdout);
  if (created.headRefOid !== item.candidate_commit) throw new Error('created PR head differs from candidate');
  return { created: true, ...created };
}

export function mergeGateResult(config, item, pr, { currentBaseIsAncestor, unresolvedThreads, competingPrs, rollbackKnown }) {
  const checks = pr.statusCheckRollup ?? [];
  const checksPassed = checks.length > 0 && checks.every((check) => ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(check.conclusion ?? check.state));
  const independentReview = (pr.reviews ?? []).some((review) => review.state === 'APPROVED' && review.author?.login && review.author.login !== pr.author?.login && review.commit?.oid === item.candidate_commit);
  const gates = {
    current_base: currentBaseIsAncestor,
    head_unchanged: pr.headRefOid === item.candidate_commit,
    one_writer: Boolean(item.lease_id && item.assigned_actor && item.claimed_paths.length + item.claimed_resources.length > 0),
    checks_passed: checksPassed,
    independent_review: independentReview,
    threads_resolved: unresolvedThreads === 0,
    no_competing_pr: competingPrs === 0,
    rollback_known: rollbackKnown === true
  };
  return { ...protectedTransitionAllowed(config, 'merge-dev', gates), gates };
}

export function mergeCommandArgs(prNumber, candidateCommit) {
  if (!/^[0-9a-f]{40}$/.test(candidateCommit ?? '')) throw new Error('merge command requires exact candidate head');
  return ['pr', 'merge', String(prNumber), '--repo', 'cehinds/AshenSpire', '--merge', '--match-head-commit', candidateCommit];
}

export function mergeDevPr(root, config, item, prNumber, { rollbackKnown = false } = {}) {
  if (item.state !== 'PR_OPEN') throw new Error(`dev merge requires PR_OPEN, found ${item.state}`);
  runGit(root, ['fetch', 'origin', '+refs/heads/dev:refs/remotes/origin/dev']);
  const pr = JSON.parse(runGh(['pr', 'view', String(prNumber), '--repo', 'cehinds/AshenSpire', '--json', 'number,url,state,author,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup,reviews']).stdout);
  if (pr.state !== 'OPEN' || pr.baseRefName !== 'dev' || pr.headRefName !== item.branch) throw new Error('PR identity/base/branch mismatch');
  runGit(root, ['fetch', 'origin', `+refs/pull/${pr.number}/head:refs/remotes/origin/pr-${pr.number}`]);
  const ancestry = runGit(root, ['merge-base', '--is-ancestor', 'origin/dev', item.candidate_commit], { allowFailure: true }).status === 0;
  const query = 'query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved}}}}}';
  const threadData = JSON.parse(runGh(['api', 'graphql', '-f', `query=${query}`, '-f', 'owner=cehinds', '-f', 'name=AshenSpire', '-F', `number=${pr.number}`]).stdout);
  const unresolvedThreads = threadData.data.repository.pullRequest.reviewThreads.nodes.filter((thread) => !thread.isResolved).length;
  const openPrs = JSON.parse(runGh(['pr', 'list', '--repo', 'cehinds/AshenSpire', '--state', 'open', '--limit', '100', '--json', 'number,body']).stdout || '[]');
  const issue = numericIssue(item.issue_id);
  const competingPrs = openPrs.filter((candidate) => candidate.number !== pr.number && new RegExp(`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#${issue}\\b`, 'i').test(candidate.body ?? '')).length;
  const gate = mergeGateResult(config, item, pr, { currentBaseIsAncestor: ancestry, unresolvedThreads, competingPrs, rollbackKnown });
  if (!gate.allowed) throw new Error(`dev merge withheld: ${gate.reason}`);
  if (pr.mergeable !== 'MERGEABLE' || !['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(pr.mergeStateStatus)) throw new Error(`dev merge withheld: mergeable=${pr.mergeable} state=${pr.mergeStateStatus}`);
  runGh(mergeCommandArgs(pr.number, item.candidate_commit));
  const merged = JSON.parse(runGh(['pr', 'view', String(pr.number), '--repo', 'cehinds/AshenSpire', '--json', 'state,mergedAt,mergeCommit,url']).stdout);
  if (merged.state !== 'MERGED' || !merged.mergeCommit?.oid) throw new Error('merge command returned without an exact merge commit');
  return { pr, gate, merged };
}

export function gitCommonDir(root = REPOSITORY_ROOT) {
  const value = runGit(root, ['rev-parse', '--git-common-dir']).stdout;
  return path.resolve(root, value);
}

export function localRuntimeDir(root = REPOSITORY_ROOT) {
  return path.join(gitCommonDir(root), 'agentops-scheduler');
}

function readJsonFile(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function readConfig(root = ROOT) { return readJsonFile(path.join(root, 'scheduler', 'config.json')); }

function refOid(root, ref, allowMissing = true) {
  const result = runGit(root, ['rev-parse', '--verify', ref], { allowFailure: allowMissing });
  return result.status === 0 ? result.stdout : null;
}

function showJson(root, ref, name) {
  const result = runGit(root, ['show', `${ref}:${name}`], { allowFailure: true });
  return result.status === 0 ? JSON.parse(result.stdout) : null;
}

export function readPortableState(root = REPOSITORY_ROOT, ref = 'refs/heads/agentops/scheduler-state') {
  const oid = refOid(root, ref) ?? refOid(root, 'refs/remotes/origin/agentops/scheduler-state');
  if (!oid) return { oid: null, events: [], snapshot: emptySnapshot(), machineLease: null, stateVersion: '1' };
  const treeNames = runGit(root, ['ls-tree', '-r', '--name-only', oid]).stdout.split(/\r?\n/).filter(Boolean);
  const unexpected = treeNames.filter((name) => !['snapshot.json', 'machine-lease.json', 'STATE_VERSION'].includes(name) && !/^journal\/[0-9]{8}-[A-Za-z0-9._-]+\.json$/.test(name));
  if (unexpected.length) throw new Error(`scheduler state contains forbidden paths: ${unexpected.join(',')}`);
  const namesResult = runGit(root, ['ls-tree', '-r', '--name-only', oid, '--', 'journal']);
  const events = namesResult.stdout ? namesResult.stdout.split(/\r?\n/).filter(Boolean).map((name) => showJson(root, oid, name)) : [];
  const snapshot = showJson(root, oid, 'snapshot.json') ?? reduceEvents(events);
  const machineLease = showJson(root, oid, 'machine-lease.json');
  const version = runGit(root, ['show', `${oid}:STATE_VERSION`], { allowFailure: true });
  return { oid, events, snapshot, machineLease, stateVersion: version.status === 0 ? version.stdout : null };
}

function hashObject(root, text) {
  return runGit(root, ['hash-object', '-w', '--stdin'], { input: text }).stdout;
}

function writePortableCommit(root, state, oldOid, message) {
  const runtime = localRuntimeDir(root); fs.mkdirSync(runtime, { recursive: true });
  const index = path.join(runtime, `index-${process.pid}-${crypto.randomUUID()}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    runGit(root, ['read-tree', '--empty'], { env });
    const files = new Map();
    state.events.forEach((event) => files.set(`journal/${String(event.sequence).padStart(8, '0')}-${event.event_id}.json`, `${JSON.stringify(event, null, 2)}\n`));
    files.set('snapshot.json', `${JSON.stringify(state.snapshot, null, 2)}\n`);
    files.set('machine-lease.json', `${JSON.stringify(state.machineLease, null, 2)}\n`);
    files.set('STATE_VERSION', `${state.stateVersion ?? '1'}\n`);
    for (const [name, text] of files) {
      const oid = hashObject(root, text);
      runGit(root, ['update-index', '--add', '--cacheinfo', `100644,${oid},${name}`], { env });
    }
    const tree = runGit(root, ['write-tree'], { env }).stdout;
    const args = ['commit-tree', tree, '-m', message]; if (oldOid) args.push('-p', oldOid);
    return runGit(root, args, { env: { ...env, GIT_AUTHOR_NAME: 'AshenSpire Scheduler', GIT_AUTHOR_EMAIL: 'scheduler@local.invalid', GIT_COMMITTER_NAME: 'AshenSpire Scheduler', GIT_COMMITTER_EMAIL: 'scheduler@local.invalid' } }).stdout;
  } finally {
    try { fs.rmSync(index, { force: true }); }
    catch (error) {
      // Windows can retain the temporary index handle briefly after Git exits.
      // A stale uniquely named index is harmless; stopping the scheduler is not.
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
    }
  }
}

export function persistPortableState(root, state, { push = false, expectedOid = state.oid, message = 'agentops scheduler state' } = {}) {
  const local = refOid(root, 'refs/heads/agentops/scheduler-state');
  const remote = refOid(root, 'refs/remotes/origin/agentops/scheduler-state');
  const current = local ?? remote;
  if (current !== expectedOid) throw new Error(`state CAS failed: expected ${expectedOid ?? 'missing'}, found ${current ?? 'missing'}`);
  if (!local && expectedOid) runGit(root, ['update-ref', 'refs/heads/agentops/scheduler-state', expectedOid]);
  const newOid = writePortableCommit(root, state, expectedOid, message);
  const update = ['update-ref', 'refs/heads/agentops/scheduler-state', newOid]; if (expectedOid) update.push(expectedOid);
  runGit(root, update);
  if (push) runGit(root, ['push', 'origin', `${newOid}:refs/heads/agentops/scheduler-state`]);
  return newOid;
}

export function localMachine(root = REPOSITORY_ROOT) {
  const runtime = localRuntimeDir(root); fs.mkdirSync(runtime, { recursive: true });
  const file = path.join(runtime, 'machine.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, `${JSON.stringify({ schema: 'agentops/scheduler-machine/v1', machine_id: crypto.randomUUID(), created_at: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx' });
  return readJsonFile(file);
}

export function configuredWorkers(root = REPOSITORY_ROOT, config = readConfig(path.join(root, '.agentops'))) {
  const file = path.join(localRuntimeDir(root), 'workers.json');
  const workers = fs.existsSync(file) ? readJsonFile(file).workers : config.workers;
  if (!Array.isArray(workers)) throw new Error('workers must be an array');
  for (const worker of workers) {
    if (!SEAT_ID.test(worker.actor ?? '')) throw new Error(`unissued or invalid seat identity ${worker.actor ?? '<missing>'}`);
    if (!Array.isArray(worker.capabilities) || worker.capabilities.length === 0) throw new Error(`seat ${worker.actor} has no capabilities`);
  }
  if (workers.length > config.worker_slots) throw new Error('registered workers exceed worker_slots');
  return workers;
}

export function makeEvent(snapshot, input) {
  const sequence = snapshot.last_sequence + 1;
  const event = {
    event_id: input.event_id ?? `evt-${String(sequence).padStart(8, '0')}-${crypto.randomUUID()}`,
    idempotency_key: input.idempotency_key ?? `${input.event_type}:${input.issue_id}:${input.lease_epoch ?? 0}:${input.exact_object?.oid ?? input.created_at ?? 'once'}`,
    sequence, previous_snapshot_hash: snapshot.snapshot_hash, issue_id: String(input.issue_id),
    actor: input.actor, machine_id: input.machine_id ?? null, lease_id: input.lease_id ?? null,
    lease_epoch: input.lease_epoch ?? null, event_type: input.event_type,
    exact_object: input.exact_object ?? {}, payload: input.payload ?? {}, created_at: input.created_at ?? new Date().toISOString()
  };
  validateEvent(event); return event;
}

export function appendEvents(state, inputs) {
  const events = [...state.events]; let snapshot = state.snapshot;
  for (const input of inputs) {
    const event = makeEvent(snapshot, input); events.push(event); snapshot = reduceEvents(events);
    const failure = snapshot.errors.find((item) => item.event_id === event.event_id);
    if (failure) throw new Error(failure.error);
  }
  return { ...state, events, snapshot };
}

export function assignmentEvent(state, assignment, machineId, createdAt = new Date().toISOString()) {
  const item = state.snapshot.work_items[assignment.issue_id];
  if (!item) throw new Error(`assignment references unknown issue ${assignment.issue_id}`);
  if (assignment.kind === 'qa') {
    return {
      event_type: 'QA_ASSIGNED', issue_id: item.issue_id, actor: assignment.actor,
      machine_id: machineId, lease_id: assignment.lease_id, lease_epoch: assignment.lease_epoch,
      exact_object: { oid: item.candidate_commit }, payload: { candidate_commit: item.candidate_commit, lease_expiry: assignment.lease_expiry },
      created_at: createdAt, idempotency_key: `qa-assign:${item.issue_id}:${assignment.lease_epoch}`
    };
  }
  return {
    event_type: 'CLAIM_ACQUIRED', issue_id: item.issue_id, actor: assignment.actor,
    machine_id: machineId, lease_id: assignment.lease_id, lease_epoch: assignment.lease_epoch,
    exact_object: { base_commit: assignment.base_commit },
    payload: { branch: item.branch, base_commit: assignment.base_commit, lease_expiry: assignment.lease_expiry, claimed_paths: item.claimed_paths, claimed_resources: item.claimed_resources, next_action: item.next_action },
    created_at: createdAt, idempotency_key: `auto-claim:${item.issue_id}:${assignment.lease_epoch}`
  };
}

export function applyAssignments(state, assignments, machineId, createdAt = new Date().toISOString()) {
  for (const assignment of assignments) state = appendEvents(state, [assignmentEvent(state, assignment, machineId, createdAt)]);
  return state;
}

export function watcherPlan(snapshot, config, now = new Date().toISOString(), currentBaseCommit = null) {
  const expirations = Object.values(snapshot.work_items)
    .filter((item) => item.assigned_actor && item.lease_id && item.lease_expiry && Date.parse(item.lease_expiry) <= Date.parse(now))
    .map((item) => ({ issue_id: item.issue_id, actor: 'scheduler', lease_id: item.lease_id, lease_epoch: item.lease_epoch }));
  const lastMaterialAt = Object.values(snapshot.work_items).length === 0 ? null : Math.max(...Object.values(snapshot.work_items).map((item) => Date.parse(item.updated_at ?? 0) || 0));
  const activeSeats = new Set(Object.values(snapshot.work_items).map((item) => item.assigned_actor).filter(Boolean));
  const queued = Object.values(snapshot.work_items).some((item) => ['READY', 'REPAIR_REQUIRED', 'CANDIDATE_READY'].includes(item.state));
  const idleAlarm = queued && activeSeats.size < config.worker_slots && lastMaterialAt > 0 && Date.parse(now) - lastMaterialAt >= config.idle_alarm_seconds * 1000;
  return { expirations, idle_alarm: idleAlarm, current_base_commit: currentBaseCommit };
}

export function dispatchWakes(root, snapshot, assignments, config) {
  const dispatchRoot = path.join(localRuntimeDir(root), 'dispatch');
  fs.mkdirSync(dispatchRoot, { recursive: true });
  const dispatched = [];
  for (const assignment of assignments) {
    const item = snapshot.work_items[assignment.issue_id];
    if (!item || item.assigned_actor !== assignment.actor) throw new Error(`dispatch assignment drift for ${assignment.issue_id}`);
    const compiled = compileWake(item, config);
    const file = path.join(dispatchRoot, `${assignment.actor.replaceAll(':', '_')}.json`);
    fs.writeFileSync(file, `${JSON.stringify(compiled, null, 2)}\n`, { flag: 'w' });
    dispatched.push({ issue_id: item.issue_id, actor: assignment.actor, wake_file: path.relative(root, file).replaceAll('\\', '/'), estimated_tokens: compiled.estimated_tokens });
  }
  return dispatched;
}

export function simulate(config = readConfig()) {
  config = { ...config, workers: config.workers.length ? config.workers : [
    { actor: 'seat:simulation:00000000-0000-4000-8000-000000000001', capabilities: ['implementation'] },
    { actor: 'seat:simulation:00000000-0000-4000-8000-000000000002', capabilities: ['implementation', 'review'] },
    { actor: 'seat:simulation:00000000-0000-4000-8000-000000000003', capabilities: ['implementation', 'review'] }
  ] };
  const now = '2026-08-30T00:00:00.000Z';
  let state = { oid: null, events: [], snapshot: emptySnapshot(), machineLease: null, stateVersion: '1' };
  const specs = Array.from({ length: 12 }, (_, index) => ({
    issue_id: `SIM-${String(index + 1).padStart(2, '0')}`, title: `Synthetic ticket ${index + 1}`,
    priority: index < 2 ? 'P0' : index < 6 ? 'P1' : 'P2', dependencies: index === 4 ? ['SIM-01'] : [],
    claimed_paths: index === 3 ? ['src/shared'] : index === 4 ? ['src/shared/file.js'] : [`src/sim-${index + 1}`],
    claimed_resources: index === 7 ? ['generated-outputs'] : [], acceptance_commands: ['node .agentops/tools/scheduler.test.mjs']
  }));
  for (const spec of specs) state = appendEvents(state, [{ event_id: `sim-intake-${spec.issue_id}`, event_type: 'INTAKE_RECORDED', issue_id: spec.issue_id, actor: 'simulation', exact_object: { issue: spec.issue_id }, payload: spec, created_at: now, idempotency_key: `sim-intake:${spec.issue_id}` }]);
  const plan = planAssignments(state.snapshot, config, now);
  const conflictRejected = claimsConflict(state.snapshot.work_items['SIM-04'], state.snapshot.work_items['SIM-05']);
  const protectedStop = protectedTransitionAllowed(config, 'main').allowed === false;
  return { tickets: specs.length, assignments: plan.assignments.length, worker_slots: config.worker_slots, concurrent: plan.assignments.length >= 3, conflict_rejected: conflictRejected, protected_stop: protectedStop, deterministic_hash: state.snapshot.snapshot_hash, refill_target_seconds: config.refill_latency_target_seconds };
}

function parseArgs(argv) {
  const command = argv[0] ?? 'status'; const args = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]; if (!token.startsWith('--')) continue;
    const key = token.slice(2).replaceAll('-', '_'); const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[key] = true; else { args[key] = next; index += 1; }
  }
  return { command, args };
}

function jsonArg(value, fallback) { return value === undefined ? fallback : JSON.parse(value); }
function emit(command, result, summary) { process.stdout.write(`${JSON.stringify({ command, ok: true, ...result })}\n${summary}\n`); }
function stateCounts(snapshot) {
  const counts = {}; for (const item of Object.values(snapshot.work_items)) counts[item.state] = (counts[item.state] ?? 0) + 1; return counts;
}

function ensureCustody(state, machine, now = Date.now()) {
  if (!state.machineLease || state.machineLease.machine_id !== machine.machine_id || Date.parse(state.machineLease.expires_at) <= now) throw new Error('active machine custody required');
}

function transitionInput(command, args, state, machine) {
  const issue = String(args.issue);
  const item = state.snapshot.work_items[issue];
  const common = { issue_id: issue, actor: args.actor ?? item?.assigned_actor ?? 'scheduler', machine_id: machine.machine_id, lease_id: args.lease_id ?? item?.lease_id ?? null, lease_epoch: args.lease_epoch ? Number(args.lease_epoch) : item?.lease_epoch ?? null, exact_object: jsonArg(args.exact_object, {}), created_at: args.at ?? new Date().toISOString(), idempotency_key: args.idempotency_key };
  if (command === 'enqueue') return { ...common, actor: args.actor ?? 'intake', lease_id: null, lease_epoch: null, event_type: 'INTAKE_RECORDED', payload: { title: args.title, priority: args.priority ?? 'P2', dependencies: jsonArg(args.dependencies, []), branch: args.branch ?? `codex/issue-${issue}`, claimed_paths: jsonArg(args.paths, []), claimed_resources: jsonArg(args.resources, []), acceptance_commands: jsonArg(args.acceptance, []), evidence_pointers: jsonArg(args.evidence, []), next_action: args.next_action, authority_ceiling: args.authority_ceiling ?? 'dev-delivery' } };
  if (command === 'claim') return { ...common, event_type: 'CLAIM_ACQUIRED', lease_id: args.lease_id, lease_epoch: Number(args.lease_epoch), payload: { branch: args.branch ?? item.branch, base_commit: args.base_commit, lease_expiry: args.expiry, claimed_paths: jsonArg(args.paths, item.claimed_paths), claimed_resources: jsonArg(args.resources, item.claimed_resources), next_action: args.next_action } };
  if (command === 'entered') return { ...common, event_type: 'WORK_ENTERED', payload: { base_commit: args.base_commit, next_action: args.next_action } };
  if (command === 'candidate') return { ...common, event_type: 'CANDIDATE_READY', exact_object: { oid: args.commit }, payload: { candidate_commit: args.commit, evidence_pointers: jsonArg(args.evidence, []) } };
  if (command === 'qa') return { ...common, actor: args.actor ?? 'independent-qa', event_type: 'QA_RESULT', exact_object: { oid: args.commit }, payload: { candidate_commit: args.commit, result: args.result, evidence_pointers: jsonArg(args.evidence, []), next_action: args.next_action } };
  if (command === 'pr-open') return { ...common, event_type: 'PR_OPENED', payload: { pr_url: args.url } };
  if (command === 'merged-dev') return { ...common, event_type: 'MERGED_DEV', exact_object: { oid: args.commit }, payload: { merge_commit: args.commit } };
  if (command === 'complete') return { ...common, event_type: 'COMPLETED', payload: {} };
  if (command === 'block') return { ...common, event_type: 'BLOCKED', payload: { blocker: args.blocker, wake_condition: args.wake, next_action: args.next_action, retained_paths: jsonArg(args.retained_paths, []), retained_resources: jsonArg(args.retained_resources, []) } };
  if (command === 'release') return { ...common, event_type: 'RESOURCE_RELEASED', payload: { requeue: args.requeue === true || args.requeue === 'true', retained_paths: jsonArg(args.retained_paths, []), retained_resources: jsonArg(args.retained_resources, []) } };
  if (command === 'recover') return { ...common, event_type: 'RECOVERY_BOUND', lease_id: args.lease_id, lease_epoch: Number(args.lease_epoch), payload: { branch: args.branch, base_commit: args.base_commit, lease_expiry: args.expiry } };
  if (command === 'expire') return { ...common, event_type: 'LEASE_EXPIRED', payload: {} };
  if (command === 'supersede') return { ...common, event_type: 'SUPERSEDED', payload: {} };
  if (command === 'cancel') return { ...common, event_type: 'CANCELLED', payload: {} };
  throw new Error(`unknown transition command ${command}`);
}

export function verifyScheduler(root = REPOSITORY_ROOT) {
  const config = readConfig(path.join(root, '.agentops'));
  const problems = [];
  for (const name of ['event.json', 'snapshot.json', 'wake.json']) if (!fs.existsSync(path.join(root, '.agentops', 'scheduler', 'schemas', name))) problems.push(`missing schema ${name}`);
  if (config.workers.length > config.worker_slots) problems.push('configured workers exceed worker_slots');
  if (config.wake_hard_limit_tokens > 1500) problems.push('wake hard limit exceeds 1500');
  const state = readPortableState(root);
  const rebuilt = reduceEvents(state.events);
  if (rebuilt.errors.length) problems.push(`event replay contains ${rebuilt.errors.length} error(s)`);
  try { assertSchema(rebuilt, 'snapshot'); } catch (error) { problems.push(error.message); }
  try { assertSchema(state.snapshot, 'snapshot'); } catch (error) { problems.push(error.message); }
  if (state.oid && !snapshotsMatch(rebuilt, state.snapshot)) problems.push('snapshot does not match deterministic replay');
  if (state.stateVersion !== '1') problems.push('unsupported STATE_VERSION');
  return { ok: problems.length === 0, problems, config, state, rebuilt };
}

export function snapshotsMatch(rebuilt, stored) {
  return stableStringify(rebuilt) === stableStringify(stored);
}

export function main(argv = process.argv.slice(2), root = REPOSITORY_ROOT) {
  const { command, args } = parseArgs(argv); const config = readConfig(path.join(root, '.agentops'));
  config.workers = configuredWorkers(root, config);
  if (command === 'simulate') { const result = simulate(config); emit(command, result, `SIMULATE ${result.concurrent && result.conflict_rejected && result.protected_stop ? 'PASS' : 'FAIL'}: ${result.tickets} tickets, ${result.assignments} concurrent assignments.`); return 0; }
  if (command === 'verify') { const result = verifyScheduler(root); if (!result.ok) throw new Error(result.problems.join('; ')); emit(command, { state_ref_oid: result.state.oid, snapshot_hash: result.rebuilt.snapshot_hash, events: result.state.events.length }, `VERIFY PASS: ${result.state.events.length} material events replayed deterministically.`); return 0; }
  let state = readPortableState(root); const machine = localMachine(root);
  if (command === 'bootstrap') {
    if (state.oid) { emit(command, { state_ref_oid: state.oid, snapshot_hash: state.snapshot.snapshot_hash }, 'BOOTSTRAP NOOP: scheduler state already exists.'); return 0; }
    state.machineLease = { machine_id: null, lease_epoch: 0, acquired_at: null, expires_at: null, expected_state_ref_oid: null }; const oid = persistPortableState(root, state, { push: args.push === true, message: 'agentops scheduler bootstrap' });
    emit(command, { state_ref_oid: oid, snapshot_hash: state.snapshot.snapshot_hash }, 'BOOTSTRAP PASS: portable scheduler state initialized.'); return 0;
  }
  if (command === 'status') { emit(command, { state_ref_oid: state.oid, snapshot_hash: state.snapshot.snapshot_hash, material_events: state.events.length, machine_lease: state.machineLease, live_worker_capacity: config.workers.length, configured_worker_slots: config.worker_slots, counts: stateCounts(state.snapshot) }, `STATUS: ${state.events.length} events; ${Object.values(state.snapshot.work_items).length} work items; ${config.workers.length}/${config.worker_slots} live workers.`); return 0; }
  if (command === 'acquire-machine') {
    const now = args.at ?? new Date().toISOString();
    if (state.machineLease && Date.parse(state.machineLease.expires_at) > Date.parse(now) && state.machineLease.machine_id !== machine.machine_id) throw new Error(`machine custody held by ${state.machineLease.machine_id}`);
    const epoch = (state.machineLease?.lease_epoch ?? 0) + 1;
    state.machineLease = { machine_id: machine.machine_id, lease_epoch: epoch, acquired_at: now, expires_at: new Date(Date.parse(now) + config.lease_duration_seconds * 1000).toISOString(), expected_state_ref_oid: state.oid };
    const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler custody ${machine.machine_id}` });
    emit(command, { machine_id: machine.machine_id, lease_epoch: epoch, state_ref_oid: oid }, 'ACQUIRE PASS: this machine owns dispatch custody.'); return 0;
  }
  if (command === 'release-machine') {
    ensureCustody(state, machine); const now = new Date().toISOString(); state.machineLease = { machine_id: null, lease_epoch: state.machineLease.lease_epoch, acquired_at: state.machineLease.acquired_at, released_at: now, expires_at: now, expected_state_ref_oid: state.oid }; const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler custody release ${machine.machine_id}` });
    emit(command, { state_ref_oid: oid }, 'RELEASE PASS: machine custody released.'); return 0;
  }
  if (command === 'sync') {
    const remoteState = runGit(root, ['ls-remote', '--exit-code', '--heads', 'origin', 'refs/heads/agentops/scheduler-state'], { allowFailure: true });
    if (remoteState.status === 0) {
      runGit(root, ['fetch', 'origin', '+refs/heads/agentops/scheduler-state:refs/remotes/origin/agentops/scheduler-state']);
      const remoteOid = refOid(root, 'refs/remotes/origin/agentops/scheduler-state');
      const localOid = refOid(root, 'refs/heads/agentops/scheduler-state');
      if (!localOid) runGit(root, ['update-ref', 'refs/heads/agentops/scheduler-state', remoteOid]);
      else if (localOid !== remoteOid) {
        runGit(root, ['update-ref', `refs/agentops/rejected-scheduler-state/${localOid}`, localOid]);
        runGit(root, ['update-ref', 'refs/heads/agentops/scheduler-state', remoteOid, localOid]);
      }
      state = readPortableState(root);
    }
    const before = state.snapshot.snapshot_hash; const rebuilt = reduceEvents(state.events); if (rebuilt.errors.length) throw new Error(`replay errors: ${JSON.stringify(rebuilt.errors)}`); state.snapshot = rebuilt;
    const changed = before !== rebuilt.snapshot_hash; if (changed) persistPortableState(root, state, { push: args.push === true, message: 'scheduler deterministic sync' });
    emit(command, { changed, snapshot_hash: rebuilt.snapshot_hash, counts: stateCounts(rebuilt) }, changed ? 'SYNC PASS: snapshot rebuilt.' : 'SYNC NOOP: no material change.'); return 0;
  }
  if (command === 'watch') {
    if (!state.oid) return 0;
    ensureCustody(state, machine);
    const now = args.at ?? new Date().toISOString();
    const rebuilt = reduceEvents(state.events); if (rebuilt.errors.length) throw new Error(`replay errors: ${JSON.stringify(rebuilt.errors)}`);
    const reconciled = stableStringify(state.snapshot) !== stableStringify(rebuilt);
    state.snapshot = rebuilt;
    const preliminary = watcherPlan(state.snapshot, config, now);
    for (const expiration of preliminary.expirations) {
      state = appendEvents(state, [{ ...expiration, machine_id: machine.machine_id, event_type: 'LEASE_EXPIRED', exact_object: {}, payload: {}, created_at: now, idempotency_key: `watch-expire:${expiration.issue_id}:${expiration.lease_epoch}` }]);
    }
    const needsBase = Object.values(state.snapshot.work_items).some((item) => ['READY', 'REPAIR_REQUIRED'].includes(item.state)) && config.workers.some((worker) => worker.capabilities.includes('implementation'));
    const baseCommit = needsBase ? currentDevelopmentBase(root, config) : null;
    const plan = planAssignments(state.snapshot, config, now, baseCommit);
    state = applyAssignments(state, plan.assignments, machine.machine_id, now);
    const material = reconciled || preliminary.expirations.length > 0 || plan.assignments.length > 0;
    let oid = state.oid;
    if (material) oid = persistPortableState(root, state, { push: args.push === true, message: 'scheduler watcher reconcile/expire/refill' });
    const dispatched = dispatchWakes(root, state.snapshot, plan.assignments, config);
    const after = watcherPlan(state.snapshot, config, now, baseCommit);
    if (!material && !after.idle_alarm) return 0;
    emit(command, { state_ref_oid: oid, reconciled, expired: preliminary.expirations, assignments: plan.assignments, dispatched, idle_alarm: after.idle_alarm, refill_target_seconds: config.refill_latency_target_seconds, idle_alarm_seconds: config.idle_alarm_seconds }, material ? 'WATCH: reconciled state, expired stale leases, and refilled available seats.' : 'WATCH IDLE ALARM: queued work has exceeded the configured idle limit.'); return 0;
  }
  ensureCustody(state, machine);
  if (command === 'enqueue') {
    const canonical = resolveCanonicalIssue(state.snapshot, args.issue);
    if (canonical.duplicate) { emit(command, canonical, `INTAKE NOOP: linked to existing canonical issue ${canonical.canonical_issue_id}.`); return 0; }
  }
  if (command === 'deliver') {
    const item = state.snapshot.work_items[String(args.issue)]; if (!item) throw new Error(`unknown issue ${args.issue}`);
    if (!config.authority.non_force_push_codex_branch || !config.authority.open_issue_closing_pr_to_dev) throw new Error('PR delivery authority is not enabled');
    const delivered = deliverCandidate(root, item);
    state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { pr_number: delivered.number, oid: item.candidate_commit }, payload: { pr_url: delivered.url }, created_at: new Date().toISOString(), idempotency_key: `pr-open:${delivered.number}:${item.candidate_commit}` }]);
    const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler PR_OPENED ${item.issue_id}` });
    emit(command, { state_ref_oid: oid, issue: state.snapshot.work_items[item.issue_id], delivery: delivered }, `PR_OPENED accepted for ${item.issue_id}: ${delivered.url}`); return 0;
  }
  if (command === 'merge-dev') {
    const item = state.snapshot.work_items[String(args.issue)]; if (!item) throw new Error(`unknown issue ${args.issue}`);
    const result = mergeDevPr(root, config, item, Number(args.pr), { rollbackKnown: args.rollback_known === true || args.rollback_known === 'true' });
    const createdAt = result.merged.mergedAt;
    state = appendEvents(state, [
      { event_type: 'MERGED_DEV', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: result.merged.mergeCommit.oid, pr_number: result.pr.number }, payload: { merge_commit: result.merged.mergeCommit.oid }, created_at: createdAt, idempotency_key: `merged-dev:${result.pr.number}:${result.merged.mergeCommit.oid}` },
      { event_type: 'COMPLETED', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: result.merged.mergeCommit.oid }, payload: {}, created_at: createdAt, idempotency_key: `completed:${item.issue_id}:${result.merged.mergeCommit.oid}` }
    ]);
    const baseCommit = currentDevelopmentBase(root, config);
    const plan = planAssignments(state.snapshot, config, createdAt, baseCommit);
    state = applyAssignments(state, plan.assignments, machine.machine_id, createdAt);
    const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler MERGED_DEV ${item.issue_id}` });
    const dispatched = dispatchWakes(root, state.snapshot, plan.assignments, config);
    emit(command, { state_ref_oid: oid, issue: state.snapshot.work_items[item.issue_id], merge: result.merged, gates: result.gate.gates, refill_assignments: plan.assignments, dispatched }, `MERGED_DEV accepted for ${item.issue_id}; refill candidates=${plan.assignments.length}.`); return 0;
  }
  const input = transitionInput(command, args, state, machine); state = appendEvents(state, [input]);
  const triggers = new Set(['candidate', 'qa', 'block', 'release', 'expire', 'complete', 'merged-dev']);
  const baseCommit = triggers.has(command) ? currentDevelopmentBase(root, config) : null;
  const plan = triggers.has(command) ? planAssignments(state.snapshot, config, input.created_at, baseCommit) : { assignments: [], no_safe_assignment: false };
  state = applyAssignments(state, plan.assignments, machine.machine_id, input.created_at);
  let oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler ${input.event_type} ${input.issue_id}` });
  state.oid = oid;
  let delivery = null;
  let item = state.snapshot.work_items[input.issue_id];
  if (command === 'qa' && args.result === 'PASS' && args.no_deliver !== true && args.no_deliver !== 'true' && config.authority.non_force_push_codex_branch && config.authority.open_issue_closing_pr_to_dev) {
    delivery = deliverCandidate(root, item);
    state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { pr_number: delivery.number, oid: item.candidate_commit }, payload: { pr_url: delivery.url }, created_at: input.created_at, idempotency_key: `pr-open:${delivery.number}:${item.candidate_commit}` }]);
    oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler PR_OPENED ${item.issue_id}` });
    item = state.snapshot.work_items[input.issue_id];
  }
  const wake = item?.state === 'CLAIMED' ? compileWake(item, config) : null;
  const dispatched = dispatchWakes(root, state.snapshot, plan.assignments, config);
  emit(command, { state_ref_oid: oid, snapshot_hash: state.snapshot.snapshot_hash, issue: item, refill_assignments: plan.assignments, no_safe_assignment: plan.no_safe_assignment, wake, dispatched, delivery }, `${input.event_type} accepted for ${input.issue_id}; refill assignments=${plan.assignments.length}${delivery ? `; PR=${delivery.url}` : ''}.`); return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = main(); } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n${error.message}\n`); process.exitCode = 1; }
}
