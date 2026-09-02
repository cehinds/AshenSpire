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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SYSTEM_ACTORS = new Set(['scheduler', 'recovery']);
const SCHEMA_CACHE = new Map();
const DEFAULT_PROCESS_TIMEOUT_MS = 30_000;
const MAX_PROCESS_TIMEOUT_MS = 120_000;

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

function validInstant(value, label) {
  requiredString(value, label);
  if (Number.isNaN(Date.parse(value))) throw new Error(`${label} must be an ISO instant`);
}

function assertNoAdditionalKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new Error(`${label} contains undeclared keys: ${unexpected.sort().join(', ')}`);
}

export function validateMachineIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('machine identity must be an object');
  assertNoAdditionalKeys(value, new Set(['schema', 'machine_id', 'created_at']), 'machine identity');
  if (value.schema !== 'agentops/scheduler-machine/v1') throw new Error('machine identity schema must be agentops/scheduler-machine/v1');
  if (typeof value.machine_id !== 'string' || !UUID.test(value.machine_id)) throw new Error('machine identity machine_id must be a valid UUID');
  validInstant(value.created_at, 'machine identity created_at');
  assertPortable(value);
  return true;
}

export function validateMachineLease(value) {
  if (value === null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('machine lease must be an object or null');
  assertNoAdditionalKeys(value, new Set(['machine_id', 'lease_epoch', 'acquired_at', 'expires_at', 'expected_state_ref_oid', 'released_at']), 'machine lease');
  if (!Number.isInteger(value.lease_epoch) || value.lease_epoch < 0) throw new Error('machine lease lease_epoch must be a non-negative integer');
  if (value.expected_state_ref_oid !== null && !/^[0-9a-f]{40}$/.test(value.expected_state_ref_oid ?? '')) throw new Error('machine lease expected_state_ref_oid must be a commit OID or null');
  if (value.machine_id === null) {
    for (const key of ['acquired_at', 'expires_at']) {
      if (value[key] !== null) validInstant(value[key], `machine lease ${key}`);
    }
    if (value.released_at !== undefined && value.released_at !== null) validInstant(value.released_at, 'machine lease released_at');
  } else {
    if (typeof value.machine_id !== 'string' || !UUID.test(value.machine_id)) throw new Error('machine lease machine_id must be a valid UUID or null');
    validInstant(value.acquired_at, 'machine lease acquired_at');
    validInstant(value.expires_at, 'machine lease expires_at');
    if (Date.parse(value.expires_at) <= Date.parse(value.acquired_at)) throw new Error('machine lease expires_at must be later than acquired_at');
  }
  assertPortable(value);
  return true;
}

export function canonicalClaimPath(value) {
  requiredString(value, 'claimed path');
  const slash = value.replaceAll('\\', '/');
  if (slash.startsWith('/') || /^[A-Za-z]:\//.test(slash)) throw new Error(`claimed path must be repository-relative: ${value}`);
  const segments = slash.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error(`claimed path contains a forbidden dot segment: ${value}`);
  const canonical = segments.filter(Boolean).join('/');
  if (!canonical) throw new Error('claimed path must name a repository-relative path');
  return canonical;
}

function canonicalClaimPaths(values) {
  if (!Array.isArray(values)) throw new Error('claimed_paths must be an array');
  return [...new Set(values.map(canonicalClaimPath))];
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
  if (event.event_type === 'INTAKE_RECORDED') requiredString(event.payload.title, 'intake title');
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
  if (typeof value === 'string' && (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('/'))) {
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
    claimed_paths: canonicalClaimPaths(p.claimed_paths ?? []), claimed_resources: p.claimed_resources ?? [],
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

function leaseExpiredAt(item, instant) {
  return item.lease_expiry && Date.parse(instant) >= Date.parse(item.lease_expiry);
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
  if (TERMINAL_STATES.has(item.state)) throw new Error(`cannot apply ${event.event_type} to terminal ${item.state}`);
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
        const proposed = { ...item, branch: p.branch, claimed_paths: canonicalClaimPaths(p.claimed_paths ?? item.claimed_paths), claimed_resources: p.claimed_resources ?? item.claimed_resources };
        const collision = Object.values(snapshot.work_items).find((other) => other.issue_id !== item.issue_id && holdsExclusiveClaim(other) && claimsConflict(proposed, other));
        if (collision) throw new Error(`one-writer collision with ${collision.issue_id}`);
      }
      item.lease_history.push({ actor: event.actor, machine_id: event.machine_id, lease_id: event.lease_id, lease_epoch: event.lease_epoch, assignment_kind: 'implementation' });
      Object.assign(item, {
        state: 'CLAIMED', assigned_actor: event.actor, assignment_kind: 'implementation', branch: p.branch ?? item.branch,
        base_commit: p.base_commit ?? item.base_commit, lease_id: event.lease_id,
        lease_epoch: event.lease_epoch, lease_expiry: p.lease_expiry, lease_machine_id: event.machine_id,
        claimed_paths: canonicalClaimPaths(p.claimed_paths ?? item.claimed_paths),
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
      if (staleLease || leaseExpiredAt(item, event.created_at) || (item.assigned_actor === null && priorLease(item, event))) {
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
      clearSeat(item); item.claimed_resources = p.retained_resources ?? []; item.claimed_paths = canonicalClaimPaths(p.retained_paths ?? []);
      break;
    case 'RESOURCE_RELEASED':
      {
        const releasedFrom = item.state;
        const seatBound = ['CLAIMED', 'RUNNING', 'QA'].includes(releasedFrom);
        if (seatBound && p.requeue !== true) throw new Error(`RESOURCE_RELEASED from ${releasedFrom} requires requeue=true`);
        if (item.state === 'WAITING_DEPENDENCY' && item.assigned_actor === null) {
          if (event.actor !== 'scheduler' || !event.machine_id || event.lease_id !== null || event.lease_epoch !== item.lease_epoch) throw new Error('retained-claim release fencing mismatch');
        } else assertExactLease(item, event);
        clearSeat(item); item.claimed_paths = canonicalClaimPaths(p.retained_paths ?? []); item.claimed_resources = p.retained_resources ?? [];
        if (p.requeue === true && !TERMINAL_STATES.has(item.state)) {
          item.state = releasedFrom === 'QA' ? 'CANDIDATE_READY' : 'READY';
          item.next_action = item.state === 'CANDIDATE_READY'
            ? 'Reassign independent QA for the preserved candidate.'
            : 'Reclaim from the last preserved candidate or worktree.';
        }
      }
      break;
    case 'LEASE_EXPIRED':
      if (event.actor !== 'scheduler') throw new Error('lease expiry requires scheduler actor');
      requiredString(event.machine_id, 'lease expiry machine_id');
      if (event.lease_id !== item.lease_id || event.lease_epoch !== item.lease_epoch) throw new Error('lease expiry fencing token mismatch');
      if (!leaseExpiredAt(item, event.created_at)) throw new Error('lease expiry cannot precede the declared expiry');
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
      if (Date.parse(p.lease_expiry) <= Date.parse(event.created_at)) throw new Error('recovery lease expiry must be later than the trusted event time');
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
  function scope(value) {
    const claim = canonicalClaimPath(value).toLowerCase();
    const stars = [...claim].filter((character) => character === '*').length;
    if (claim.endsWith('/**') && stars === 2) return { kind: 'tree', value: claim.slice(0, -3) };
    const rootWildcard = /^\*\.([a-z0-9_-]+)$/.exec(claim);
    if (rootWildcard) return { kind: 'root-extension', value: `.${rootWildcard[1]}` };
    if (stars > 0) throw new Error(`claimed path uses an unsupported glob: ${value}`);
    return { kind: 'exact', value: claim };
  }
  const a = scope(left); const b = scope(right);
  if (a.kind === 'root-extension' || b.kind === 'root-extension') {
    if (a.kind === 'root-extension' && b.kind === 'root-extension') return a.value === b.value;
    const wildcard = a.kind === 'root-extension' ? a : b;
    const other = a.kind === 'root-extension' ? b : a;
    return other.kind === 'exact' && !other.value.includes('/') && other.value.endsWith(wildcard.value);
  }
  const aPath = a.value; const bPath = b.value;
  if (a.kind === 'tree' && b.kind === 'tree') return aPath === bPath || aPath.startsWith(`${bPath}/`) || bPath.startsWith(`${aPath}/`);
  if (a.kind === 'tree') return bPath === aPath || bPath.startsWith(`${aPath}/`);
  if (b.kind === 'tree') return aPath === bPath || aPath.startsWith(`${bPath}/`);
  return aPath === bPath || aPath.startsWith(`${bPath}/`) || bPath.startsWith(`${aPath}/`);
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
  validateWorkers(config.workers, config.worker_slots);
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
    if (!seat) continue;
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
  validateBranchName(config.development_branch, 'development_branch');
  runGit(root, ['fetch', 'origin', `refs/heads/${config.development_branch}:refs/remotes/origin/${config.development_branch}`]);
  const oid = refOid(root, `refs/remotes/origin/${config.development_branch}`, false);
  if (!/^[0-9a-f]{40}$/.test(oid ?? '')) throw new Error('current development base is unavailable');
  return oid;
}

export function compileWake(item, config, repository = config.repository) {
  requiredString(repository, 'scheduler repository');
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

export function runBoundedCommand(command, args, options = {}) {
  const timeout = options.timeoutMs ?? DEFAULT_PROCESS_TIMEOUT_MS;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_PROCESS_TIMEOUT_MS) throw new Error(`invalid subprocess timeout ${timeout}`);
  const result = spawnSync(command, args, {
    encoding: 'utf8', input: options.input, env: { ...process.env, ...(options.env ?? {}) },
    timeout, killSignal: 'SIGTERM', maxBuffer: 10 * 1024 * 1024,
    cwd: options.cwd
  });
  if (result.error) {
    const timedOut = result.error.code === 'ETIMEDOUT' || result.signal === 'SIGTERM';
    throw new Error(timedOut
      ? `${command} timed out after ${timeout}ms`
      : `${command} failed to start: ${result.error.message}`);
  }
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (result.status !== 0 && !options.allowFailure) throw new Error((stderr || stdout || `${command} failed`).trim());
  return { status: result.status, stdout: stdout.trim(), stderr: stderr.trim() };
}

function runGit(root, args, options = {}) {
  return runBoundedCommand('git', ['-c', `safe.directory=${root}`, '-C', root, ...args], options);
}

function runGh(args, options = {}) {
  return runBoundedCommand('gh', args, options);
}

function validateBranchName(value, label) {
  requiredString(value, label);
  if (!/^[A-Za-z0-9._\/-]+$/.test(value) || value.startsWith('/') || value.endsWith('/') || value.includes('..')) throw new Error(`${label} is not a safe branch name`);
  return value;
}

export function schedulerStateRefs(config) {
  const local = config.state_ref;
  if (typeof local !== 'string' || !local.startsWith('refs/heads/')) throw new Error('state_ref must be a refs/heads/ ref');
  const branch = validateBranchName(local.slice('refs/heads/'.length), 'state_ref branch');
  return { local, branch, remote: `refs/remotes/origin/${branch}` };
}

export function repositorySlug(repository) {
  requiredString(repository, 'scheduler repository');
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(repository);
  if (!match) throw new Error('scheduler repository must identify a GitHub owner/repository');
  return `${match[1]}/${match[2]}`;
}

export function assertSchedulerDispatchCutover(config, root = null) {
  if (config.cutover?.scheduler_dispatch_enabled !== true || config.cutover?.legacy_watcher_authoritative !== false || !config.cutover?.authorization_evidence) {
    throw new Error('scheduler dispatch cutover is not authorized; legacy watcher remains authoritative');
  }
  if (root) {
    const activationFile = path.join(root, '.agentops', 'pipeline-pilot', 'activation.json');
    if (fs.existsSync(activationFile)) {
      const legacy = readJsonFile(activationFile);
      if (legacy.enabled === true || legacy.mode === 'LIVE_ASSIGNMENT') throw new Error('scheduler dispatch cutover rejected: legacy watcher activation is still live');
    }
  }
  return true;
}

function numericIssue(issueId) {
  const match = /(?:^|#)(\d+)$/.exec(String(issueId));
  if (!match) throw new Error(`issue_id ${issueId} is not a canonical GitHub issue number`);
  return Number(match[1]);
}

export function deliverCandidate(root, item, config) {
  const repository = repositorySlug(config.repository);
  const developmentBranch = validateBranchName(config.development_branch, 'development_branch');
  if (item.state !== 'PR_READY') throw new Error(`delivery requires PR_READY, found ${item.state}`);
  if (!/^codex\/[A-Za-z0-9._\/-]+$/.test(item.branch ?? '')) throw new Error('delivery requires a unique codex/ branch');
  if (!/^[0-9a-f]{40}$/.test(item.candidate_commit ?? '')) throw new Error('delivery requires an exact candidate commit');
  runGit(root, ['cat-file', '-e', `${item.candidate_commit}^{commit}`]);
  runGit(root, ['push', 'origin', `${item.candidate_commit}:refs/heads/${item.branch}`]);
  const existing = JSON.parse(runGh(['pr', 'list', '--repo', repository, '--state', 'open', '--head', item.branch, '--base', developmentBranch, '--limit', '1000', '--json', 'number,url,headRefOid']).stdout || '[]');
  if (existing.length > 1) throw new Error(`multiple open PRs for ${item.branch}`);
  if (existing.length === 1) {
    if (existing[0].headRefOid !== item.candidate_commit) throw new Error('open PR head differs from candidate');
    return { created: false, ...existing[0] };
  }
  const issue = numericIssue(item.issue_id);
  const body = `Closes #${issue}\n\nExact scheduler candidate: \`${item.candidate_commit}\`\n\nRollback: revert the merge commit; preserve the candidate branch and scheduler evidence.`;
  const url = runGh(['pr', 'create', '--repo', repository, '--base', developmentBranch, '--head', item.branch, '--title', item.title, '--body', body]).stdout.split(/\r?\n/).at(-1);
  const created = JSON.parse(runGh(['pr', 'view', url, '--repo', repository, '--json', 'number,url,headRefOid']).stdout);
  if (created.headRefOid !== item.candidate_commit) throw new Error('created PR head differs from candidate');
  return { created: true, ...created };
}

// A recorded owner exception to the distinct-account half of the review gate.
// It is never inferred: the flag alone does nothing, because an exception whose
// authorization is not written down is indistinguishable from a bug. Both the
// flag and complete evidence must be present, so `scheduler verify` and the
// merge event carry WHO relaxed the rule and WHY, and so restoring the rule is
// a one-line revert rather than an archaeology exercise.
// Returns the exception's authorization, or null if it does not hold. Presence
// is not enough: a whitespace approver, an `at` of 'not-a-date' and a reason
// that is an array are all truthy, so a check for truthiness would accept an
// evidence block that records nothing — the very state this is meant to refuse.
// A future-dated authorization is refused too; it has not happened yet.
//
// What this CANNOT do is authenticate the approver. Anyone able to set the flag
// can also type any name beside it, so matching that string against an expected
// owner would be ceremony, not a control — the same shared-identity problem
// (#434) one layer down. The tool refuses malformed evidence and makes the
// exception visible in `verify`; who authorized it is a claim the ledger and
// the config's history carry, not something this predicate can establish.
export function sameIdentityReviewEvidence(config, now = Date.now()) {
  if (config.authority?.same_identity_review_accepted !== true) return null;
  const evidence = config.authority?.same_identity_review_evidence;
  const filled = (value) => typeof value === 'string' && value.trim().length > 0;
  if (!evidence || !filled(evidence.authorized_by) || !filled(evidence.reason) || !filled(evidence.at)) return null;
  const at = Date.parse(evidence.at);
  if (Number.isNaN(at) || at > now) return null;
  return { authorized_by: evidence.authorized_by.trim(), at: evidence.at, reason: evidence.reason.trim() };
}

export function sameIdentityReviewAccepted(config, now = Date.now()) {
  return sameIdentityReviewEvidence(config, now) !== null;
}

// Which rule, if any, makes this candidate independently verified. DERIVED from
// the PR and the item rather than remembered, so the recovery path can re-answer
// it from the same two inputs after a crash instead of losing it.
//
// An approval is only evidence about the bytes it was given: it must name the
// exact candidate commit, so a review of an earlier head never authorizes a
// later one. The exception relaxes WHO may verify, never WHAT.
//
// GitHub refuses to let a pull request's author approve it. So when every seat
// shares one account there is no obtainable GitHub approval at all, and an
// exception phrased in terms of one would be inert — it would read as a
// relaxation while stalling every merge exactly as before.
//
// Independence is therefore taken from the layer that DOES hold separate
// identities here: the scheduler's own seats. A QA lease is only ever issued to
// a seat other than the maker, and a PASS is only accepted against the exact
// candidate commit — so a recorded QA seat is an independent party's verdict on
// precisely these bytes. An item cannot return from PR_READY or PR_OPEN to
// candidacy, so that verdict can never be inherited by a later head. What is
// given up against a distinct GitHub account is that both seats authenticate as
// one login; what is kept is a separate actor, a separate lease, and a verdict
// bound to the exact commit.
export function reviewIndependenceOf(config, item, pr) {
  const approvals = (pr.reviews ?? []).filter((review) => review.state === 'APPROVED' && review.author?.login && review.commit?.oid === item.candidate_commit);
  if (approvals.some((review) => review.author.login !== pr.author?.login)) return 'distinct-account';
  const independentQaSeat = (item.lease_history ?? []).some((lease) => lease.assignment_kind === 'qa' && lease.actor && lease.actor !== item.maker_actor);
  return independentQaSeat && sameIdentityReviewAccepted(config) ? 'independent-qa-seat' : 'none';
}

export function mergeGateResult(config, item, pr, { currentBaseIsAncestor, unresolvedThreads, competingPrs, rollbackKnown }) {
  const checks = pr.statusCheckRollup ?? [];
  const checksPassed = checks.length > 0 && checks.every((check) => ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(check.conclusion ?? check.state));
  const reviewIndependence = reviewIndependenceOf(config, item, pr);
  const independentReview = reviewIndependence !== 'none';
  const makerLeaseRecorded = (item.lease_history ?? []).some((lease) => lease.assignment_kind === 'implementation' && lease.actor === item.maker_actor);
  const gates = {
    current_base: currentBaseIsAncestor,
    head_unchanged: pr.headRefOid === item.candidate_commit,
    one_writer: Boolean(makerLeaseRecorded && item.claimed_paths.length + item.claimed_resources.length > 0),
    checks_passed: checksPassed,
    independent_review: independentReview,
    threads_resolved: unresolvedThreads === 0,
    no_competing_pr: competingPrs === 0,
    rollback_known: rollbackKnown === true
  };
  return { ...protectedTransitionAllowed(config, 'merge-dev', gates), gates, review_independence: reviewIndependence };
}

export function mergeCommandArgs(prNumber, candidateCommit, config = { repository: 'https://github.com/cehinds/AshenSpire.git' }) {
  if (!/^[0-9a-f]{40}$/.test(candidateCommit ?? '')) throw new Error('merge command requires exact candidate head');
  return ['pr', 'merge', String(prNumber), '--repo', repositorySlug(config.repository), '--merge', '--match-head-commit', candidateCommit];
}

function unresolvedReviewThreadCount(repository, prNumber) {
  const [owner, name] = repository.split('/');
  const query = 'query($owner:String!,$name:String!,$number:Int!,$endCursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$endCursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}';
  const pages = JSON.parse(runGh(['api', 'graphql', '--paginate', '--slurp', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${prNumber}`]).stdout);
  return pages.flatMap((page) => page.data.repository.pullRequest.reviewThreads.nodes).filter((thread) => !thread.isResolved).length;
}

function openPullRequests(repository) {
  const pages = JSON.parse(runGh(['api', '--paginate', '--slurp', `repos/${repository}/pulls?state=open&per_page=100`]).stdout);
  return pages.flat();
}

export function mergedPrRecovery(config, item, pr) {
  const developmentBranch = validateBranchName(config.development_branch, 'development_branch');
  if (pr.baseRefName !== developmentBranch || pr.headRefName !== item.branch || pr.headRefOid !== item.candidate_commit) throw new Error('PR identity/base/branch/head mismatch');
  if (pr.state !== 'MERGED') return null;
  if (!pr.mergedAt || !/^[0-9a-f]{40}$/.test(pr.mergeCommit?.oid ?? '')) throw new Error('merged PR lacks an exact recovery identity');
  return {
    pr,
    // Two different facts, kept apart on purpose. review_independence answers
    // "under which rule did THIS process permit the merge", and for a recovery
    // the honest answer is that it did not: the merge already existed, and the
    // scheduler cannot tell its own interrupted merge from one a human made
    // outside it. review_independence_evidence answers "what verification does
    // the merged candidate actually carry", which is still derivable here from
    // the PR's reviews and the item's lease history. Collapsing the two would
    // let a hand merge inherit a gate verdict it never passed.
    gate: {
      allowed: true, reason: 'RECOVER_GITHUB_MERGE', gates: { github_already_merged: true, head_unchanged: true },
      review_independence: 'recovered', review_independence_evidence: reviewIndependenceOf(config, item, pr)
    },
    merged: { state: 'MERGED', mergedAt: pr.mergedAt, mergeCommit: pr.mergeCommit, url: pr.url },
    recovered: true
  };
}

export function mergeDevPr(root, config, item, prNumber, { rollbackKnown = false } = {}) {
  if (item.state !== 'PR_OPEN') throw new Error(`dev merge requires PR_OPEN, found ${item.state}`);
  const repository = repositorySlug(config.repository);
  const developmentBranch = validateBranchName(config.development_branch, 'development_branch');
  runGit(root, ['fetch', 'origin', `refs/heads/${developmentBranch}:refs/remotes/origin/${developmentBranch}`]);
  const pr = JSON.parse(runGh(['pr', 'view', String(prNumber), '--repo', repository, '--json', 'number,url,state,author,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup,reviews,mergedAt,mergeCommit']).stdout);
  const recovery = mergedPrRecovery(config, item, pr);
  if (recovery) return recovery;
  if (pr.state !== 'OPEN') throw new Error(`PR is neither open nor recoverably merged: ${pr.state}`);
  runGit(root, ['fetch', 'origin', `+refs/pull/${pr.number}/head:refs/remotes/origin/pr-${pr.number}`]);
  const ancestry = runGit(root, ['merge-base', '--is-ancestor', `origin/${developmentBranch}`, item.candidate_commit], { allowFailure: true }).status === 0;
  const unresolvedThreads = unresolvedReviewThreadCount(repository, pr.number);
  const openPrs = openPullRequests(repository);
  const issue = numericIssue(item.issue_id);
  const competingPrs = openPrs.filter((candidate) => candidate.number !== pr.number && new RegExp(`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#${issue}\\b`, 'i').test(candidate.body ?? '')).length;
  const gate = mergeGateResult(config, item, pr, { currentBaseIsAncestor: ancestry, unresolvedThreads, competingPrs, rollbackKnown });
  if (!gate.allowed) throw new Error(`dev merge withheld: ${gate.reason}`);
  if (pr.mergeable !== 'MERGEABLE' || !['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(pr.mergeStateStatus)) throw new Error(`dev merge withheld: mergeable=${pr.mergeable} state=${pr.mergeStateStatus}`);
  runGh(mergeCommandArgs(pr.number, item.candidate_commit, config));
  const merged = JSON.parse(runGh(['pr', 'view', String(pr.number), '--repo', repository, '--json', 'state,mergedAt,mergeCommit,url']).stdout);
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

function stateConfig(root, config) {
  if (config) return config;
  const file = path.join(root, '.agentops', 'scheduler', 'config.json');
  return fs.existsSync(file) ? readJsonFile(file) : { state_ref: 'refs/heads/agentops/scheduler-state' };
}

function refOid(root, ref, allowMissing = true) {
  const result = runGit(root, ['rev-parse', '--verify', ref], { allowFailure: allowMissing });
  return result.status === 0 ? result.stdout : null;
}

function showJson(root, ref, name) {
  const result = runGit(root, ['show', `${ref}:${name}`], { allowFailure: true });
  return result.status === 0 ? JSON.parse(result.stdout) : null;
}

export function readPortableState(root = REPOSITORY_ROOT, config = stateConfig(root)) {
  const refs = schedulerStateRefs(stateConfig(root, config));
  const oid = refOid(root, refs.local) ?? refOid(root, refs.remote);
  if (!oid) return { oid: null, events: [], snapshot: emptySnapshot(), machineLease: null, stateVersion: '1' };
  const treeNames = runGit(root, ['ls-tree', '-r', '--name-only', oid]).stdout.split(/\r?\n/).filter(Boolean);
  const unexpected = treeNames.filter((name) => !['snapshot.json', 'machine-lease.json', 'STATE_VERSION'].includes(name) && !/^journal\/[0-9]{8}-[A-Za-z0-9._-]+\.json$/.test(name));
  if (unexpected.length) throw new Error(`scheduler state contains forbidden paths: ${unexpected.join(',')}`);
  const namesResult = runGit(root, ['ls-tree', '-r', '--name-only', oid, '--', 'journal']);
  const events = namesResult.stdout ? namesResult.stdout.split(/\r?\n/).filter(Boolean).map((name) => showJson(root, oid, name)) : [];
  const snapshot = showJson(root, oid, 'snapshot.json') ?? reduceEvents(events);
  const machineLease = showJson(root, oid, 'machine-lease.json');
  validateMachineLease(machineLease);
  const version = runGit(root, ['show', `${oid}:STATE_VERSION`], { allowFailure: true });
  return { oid, events, snapshot, machineLease, stateVersion: version.status === 0 ? version.stdout : null };
}

function hashObject(root, text) {
  return runGit(root, ['hash-object', '-w', '--stdin'], { input: text }).stdout;
}

function writePortableCommit(root, state, oldOid, message) {
  validateMachineLease(state.machineLease);
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

export function persistPortableState(root, state, { push = false, expectedOid = state.oid, message = 'agentops scheduler state', config = stateConfig(root) } = {}) {
  const refs = schedulerStateRefs(config);
  const local = refOid(root, refs.local);
  const remote = refOid(root, refs.remote);
  const current = local ?? remote;
  if (current !== expectedOid) throw new Error(`state CAS failed: expected ${expectedOid ?? 'missing'}, found ${current ?? 'missing'}`);
  if (!local && expectedOid) runGit(root, ['update-ref', refs.local, expectedOid]);
  const newOid = writePortableCommit(root, state, expectedOid, message);
  const update = ['update-ref', refs.local, newOid]; if (expectedOid) update.push(expectedOid);
  runGit(root, update);
  if (push) {
    const pushed = runGit(root, ['push', 'origin', `${newOid}:${refs.local}`], { allowFailure: true });
    if (pushed.status !== 0) {
      const error = new Error((pushed.stderr || pushed.stdout || 'scheduler state push failed').trim());
      const fetched = runGit(root, ['fetch', 'origin', `+${refs.local}:${refs.remote}`], { allowFailure: true });
      const authoritativeOid = fetched.status === 0 ? refOid(root, refs.remote) : null;
      if (authoritativeOid && authoritativeOid !== newOid) {
        runGit(root, ['update-ref', `refs/agentops/rejected-scheduler-state/${newOid}`, newOid]);
        runGit(root, ['update-ref', refs.local, authoritativeOid, newOid]);
        error.portableStateAuthorityLost = true;
        error.authoritativeStateOid = authoritativeOid;
        error.authoritativeState = readPortableState(root, config);
      } else {
        // A transport failure without a conflicting authoritative ref leaves the
        // locally committed lease durable and retryable.
        error.portableStatePersisted = true;
        error.portableStateOid = newOid;
      }
      throw error;
    }
  }
  return newOid;
}

export function localMachine(root = REPOSITORY_ROOT) {
  const runtime = localRuntimeDir(root); fs.mkdirSync(runtime, { recursive: true });
  const file = path.join(runtime, 'machine.json');
  const identity = `${JSON.stringify({ schema: 'agentops/scheduler-machine/v1', machine_id: crypto.randomUUID(), created_at: new Date().toISOString() }, null, 2)}\n`;
  try {
    const descriptor = fs.openSync(file, 'wx');
    try { fs.writeFileSync(descriptor, identity); fs.fsyncSync(descriptor); }
    finally { fs.closeSync(descriptor); }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  // A concurrent creator may have won the exclusive create but not completed
  // its bounded write yet. Retry only the local identity read, never creation.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const machine = readJsonFile(file);
      validateMachineIdentity(machine);
      return machine;
    }
    catch (error) {
      if (attempt === 19 || !['ENOENT', 'EACCES'].includes(error.code) && !(error instanceof SyntaxError)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  throw new Error('machine identity initialization did not complete');
}

export function configuredWorkers(root = REPOSITORY_ROOT, config = readConfig(path.join(root, '.agentops'))) {
  const file = path.join(localRuntimeDir(root), 'workers.json');
  const workers = fs.existsSync(file) ? readJsonFile(file).workers : config.workers;
  validateWorkers(workers, config.worker_slots);
  return workers;
}

export function validateWorkers(workers, workerSlots) {
  if (!Array.isArray(workers)) throw new Error('workers must be an array');
  const actors = new Set();
  for (const worker of workers) {
    if (!SEAT_ID.test(worker.actor ?? '')) throw new Error(`unissued or invalid seat identity ${worker.actor ?? '<missing>'}`);
    if (actors.has(worker.actor)) throw new Error(`duplicate worker actor identity ${worker.actor}`);
    actors.add(worker.actor);
    if (!Array.isArray(worker.capabilities) || worker.capabilities.length === 0) throw new Error(`seat ${worker.actor} has no capabilities`);
  }
  if (workers.length > workerSlots) throw new Error('registered workers exceed worker_slots');
  return true;
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

function restoreWakeFiles(backups) {
  for (const [file, prior] of [...backups.entries()].reverse()) {
    if (prior === null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, prior);
  }
}

export function beginWakeDispatch(root, snapshot, assignments, config) {
  const dispatchRoot = path.join(localRuntimeDir(root), 'dispatch');
  fs.mkdirSync(dispatchRoot, { recursive: true });
  // Compile the complete desired dispatch set before touching any live wake.
  // This both stages new assignments and revokes stale wakes for seats whose
  // lease was released by the transition that triggered this refill.
  const assignmentActors = new Set(assignments.map((assignment) => assignment.actor));
  const byActor = new Map(Object.values(snapshot.work_items)
    .filter((item) => item.assigned_actor && ['CLAIMED', 'RUNNING', 'QA'].includes(item.state))
    .map((item) => [item.assigned_actor, item]));
  for (const assignment of assignments) {
    const item = byActor.get(assignment.actor);
    if (!item || item.issue_id !== assignment.issue_id) throw new Error(`dispatch assignment drift for ${assignment.issue_id}`);
  }
  const prepared = config.workers.map((worker) => {
    const file = path.join(dispatchRoot, `${worker.actor.replaceAll(':', '_')}.json`);
    const item = byActor.get(worker.actor);
    if (!item) return { file, contents: null, receipt: null };
    const compiled = compileWake(item, config);
    return {
      file,
      contents: `${JSON.stringify(compiled, null, 2)}\n`,
      receipt: assignmentActors.has(worker.actor)
        ? { issue_id: item.issue_id, actor: worker.actor, wake_file: path.relative(root, file).replaceAll('\\', '/'), estimated_tokens: compiled.estimated_tokens }
        : null
    };
  });
  const backups = new Map();
  try {
    for (const entry of prepared) {
      backups.set(entry.file, fs.existsSync(entry.file) ? fs.readFileSync(entry.file) : null);
      if (entry.contents === null) fs.rmSync(entry.file, { force: true });
      else fs.writeFileSync(entry.file, entry.contents, { flag: 'w' });
    }
  } catch (error) {
    try { restoreWakeFiles(backups); }
    catch (rollbackError) { error.message += `; wake rollback failed: ${rollbackError.message}`; }
    throw error;
  }
  let open = true;
  return {
    dispatched: prepared.map((entry) => entry.receipt).filter(Boolean),
    commit() { open = false; },
    rollback() { if (open) { restoreWakeFiles(backups); open = false; } },
    reconcile(authoritativeSnapshot) { if (open) { reconcileWakeDispatch(root, authoritativeSnapshot, config); open = false; } }
  };
}

export function reconcileWakeDispatch(root, snapshot, config) {
  const dispatchRoot = path.join(localRuntimeDir(root), 'dispatch');
  fs.mkdirSync(dispatchRoot, { recursive: true });
  const byActor = new Map(Object.values(snapshot.work_items)
    .filter((item) => item.assigned_actor && ['CLAIMED', 'RUNNING', 'QA'].includes(item.state))
    .map((item) => [item.assigned_actor, item]));
  for (const worker of config.workers) {
    const file = path.join(dispatchRoot, `${worker.actor.replaceAll(':', '_')}.json`);
    const item = byActor.get(worker.actor);
    if (!item) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, `${JSON.stringify(compileWake(item, config), null, 2)}\n`, { flag: 'w' });
  }
}

export function dispatchWakes(root, snapshot, assignments, config) {
  const transaction = beginWakeDispatch(root, snapshot, assignments, config);
  transaction.commit();
  return transaction.dispatched;
}

export function commitAssignmentsAfterWakeDispatch(state, assignments, machineId, createdAt, { dispatch, persist }) {
  if (assignments.length === 0) return { state, oid: state.oid, dispatched: [] };
  const assignedState = applyAssignments(state, assignments, machineId, createdAt);
  // Dispatch is deliberately first. A compilation or filesystem failure never
  // makes a lease durable, so the seat remains eligible for immediate refill.
  const transaction = dispatch(assignedState.snapshot, assignments);
  try {
    const oid = persist(assignedState);
    transaction.commit?.();
    return { state: { ...assignedState, oid }, oid, dispatched: transaction.dispatched ?? [] };
  } catch (error) {
    // A remote race loser replaces its speculative wake set with the fetched
    // authoritative assignments. A transport-only failure keeps the locally
    // durable wake; a pre-CAS failure restores the exact pre-dispatch files.
    if (error.portableStateAuthorityLost === true && error.authoritativeState?.snapshot) transaction.reconcile?.(error.authoritativeState.snapshot);
    else if (error.portableStatePersisted !== true) transaction.rollback?.();
    else transaction.commit?.();
    throw error;
  }
}

function persistRefillAssignments(root, state, plan, machineId, createdAt, config, { push = false, message = 'scheduler refill assignments' } = {}) {
  if (plan.assignments.length === 0) {
    // Once cut over, a material transition still owns one dispatch action: it
    // removes wakes whose leases are no longer present. Before cutover, leave
    // the authoritative legacy watcher's files entirely untouched.
    if (config.cutover?.scheduler_dispatch_enabled === true) {
      assertSchedulerDispatchCutover(config, root);
      const transaction = beginWakeDispatch(root, state.snapshot, [], config);
      transaction.commit();
    }
    return { state, oid: state.oid, dispatched: [] };
  }
  assertSchedulerDispatchCutover(config, root);
  return commitAssignmentsAfterWakeDispatch(state, plan.assignments, machineId, createdAt, {
    dispatch: (snapshot, assignments) => beginWakeDispatch(root, snapshot, assignments, config),
    persist: (assignedState) => persistPortableState(root, assignedState, { push, message, config })
  });
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

export function ensureCustody(state, machine, now = Date.now()) {
  validateMachineIdentity(machine);
  validateMachineLease(state.machineLease);
  if (!state.machineLease || state.machineLease.machine_id !== machine.machine_id || Date.parse(state.machineLease.expires_at) <= now) throw new Error('active machine custody required');
}

export function transitionInput(command, args, state, machine) {
  const issue = String(args.issue);
  const item = state.snapshot.work_items[issue];
  const common = { issue_id: issue, actor: args.actor ?? item?.assigned_actor ?? 'scheduler', machine_id: machine.machine_id, lease_id: args.lease_id ?? item?.lease_id ?? null, lease_epoch: args.lease_epoch ? Number(args.lease_epoch) : item?.lease_epoch ?? null, exact_object: jsonArg(args.exact_object, {}), created_at: args.at ?? new Date().toISOString(), idempotency_key: args.idempotency_key };
  if (command === 'enqueue') return { ...common, actor: args.actor ?? 'intake', lease_id: null, lease_epoch: null, event_type: 'INTAKE_RECORDED', payload: { title: args.title, priority: args.priority ?? 'P2', dependencies: jsonArg(args.dependencies, []), branch: args.branch ?? `codex/issue-${issue}`, claimed_paths: jsonArg(args.paths, []), claimed_resources: jsonArg(args.resources, []), acceptance_commands: jsonArg(args.acceptance, []), evidence_pointers: jsonArg(args.evidence, []), next_action: args.next_action, authority_ceiling: args.authority_ceiling ?? 'dev-delivery' } };
  if (command === 'claim') return { ...common, event_type: 'CLAIM_ACQUIRED', lease_id: args.lease_id, lease_epoch: Number(args.lease_epoch), payload: { branch: args.branch ?? item.branch, base_commit: args.base_commit, lease_expiry: args.expiry, claimed_paths: jsonArg(args.paths, item.claimed_paths), claimed_resources: jsonArg(args.resources, item.claimed_resources), next_action: args.next_action } };
  if (command === 'entered') return { ...common, event_type: 'WORK_ENTERED', payload: { base_commit: args.base_commit, next_action: args.next_action } };
  if (command === 'candidate') return { ...common, event_type: 'CANDIDATE_READY', exact_object: { oid: args.commit }, payload: { candidate_commit: args.commit, evidence_pointers: jsonArg(args.evidence, []) } };
  if (command === 'qa') return { ...common, actor: args.actor ?? 'independent-qa', event_type: 'QA_RESULT', exact_object: { oid: args.commit }, payload: { candidate_commit: args.commit, result: args.result, evidence_pointers: jsonArg(args.evidence, []), next_action: args.next_action } };
  if (command === 'pr-open') return { ...common, event_type: 'PR_OPENED', payload: { pr_url: args.url } };
  if (command === 'complete') return { ...common, event_type: 'COMPLETED', payload: {} };
  if (command === 'block') return { ...common, event_type: 'BLOCKED', payload: { blocker: args.blocker, wake_condition: args.wake, next_action: args.next_action, retained_paths: jsonArg(args.retained_paths, []), retained_resources: jsonArg(args.retained_resources, []) } };
  if (command === 'release') return { ...common, event_type: 'RESOURCE_RELEASED', payload: { requeue: args.requeue === true || args.requeue === 'true', retained_paths: jsonArg(args.retained_paths, []), retained_resources: jsonArg(args.retained_resources, []) } };
  if (command === 'recover') return { ...common, event_type: 'RECOVERY_BOUND', lease_id: args.lease_id, lease_epoch: Number(args.lease_epoch), payload: { branch: args.branch, base_commit: args.base_commit, lease_expiry: args.expiry } };
  if (command === 'expire') return { ...common, event_type: 'LEASE_EXPIRED', payload: {} };
  if (command === 'supersede') return { ...common, event_type: 'SUPERSEDED', payload: {} };
  if (command === 'cancel') return { ...common, event_type: 'CANCELLED', payload: {} };
  throw new Error(`unknown transition command ${command}`);
}

export function trustedTransitionArgs(args, now = new Date().toISOString()) {
  if (Number.isNaN(Date.parse(now))) throw new Error('trusted scheduler time must be an ISO instant');
  return { ...args, at: now };
}

export function verifyScheduler(root = REPOSITORY_ROOT) {
  const config = readConfig(path.join(root, '.agentops'));
  const problems = [];
  for (const name of ['event.json', 'snapshot.json', 'wake.json']) if (!fs.existsSync(path.join(root, '.agentops', 'scheduler', 'schemas', name))) problems.push(`missing schema ${name}`);
  if (config.workers.length > config.worker_slots) problems.push('configured workers exceed worker_slots');
  // Enabled-but-unauthorized fails verification rather than quietly reverting
  // to the strict gate: a relaxation someone believes is active while it is not
  // is its own defect, and so is malformed evidence nobody notices.
  if (config.authority?.same_identity_review_accepted === true && !sameIdentityReviewAccepted(config)) problems.push('same-identity review exception is enabled but its authorization evidence is missing, malformed, or future-dated');
  if (config.wake_hard_limit_tokens > 1500) problems.push('wake hard limit exceeds 1500');
  const state = readPortableState(root, config);
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
  if (command === 'verify') {
    const result = verifyScheduler(root); if (!result.ok) throw new Error(result.problems.join('; '));
    // Surfaced on every verify so an active relaxation of the merge gate cannot
    // sit unnoticed in the config: visibility is the control this can offer.
    const exception = sameIdentityReviewEvidence(result.config);
    emit(command, { state_ref_oid: result.state.oid, snapshot_hash: result.rebuilt.snapshot_hash, events: result.state.events.length, same_identity_review_exception: exception }, `VERIFY PASS: ${result.state.events.length} material events replayed deterministically.${exception ? ` MERGE GATE RELAXED: same-identity review exception active, authorized by ${exception.authorized_by} at ${exception.at}.` : ''}`); return 0;
  }
  let state = readPortableState(root, config); const machine = localMachine(root);
  if (command === 'bootstrap') {
    if (state.oid) { emit(command, { state_ref_oid: state.oid, snapshot_hash: state.snapshot.snapshot_hash }, 'BOOTSTRAP NOOP: scheduler state already exists.'); return 0; }
    state.machineLease = { machine_id: null, lease_epoch: 0, acquired_at: null, expires_at: null, expected_state_ref_oid: null }; const oid = persistPortableState(root, state, { push: args.push === true, message: 'agentops scheduler bootstrap', config });
    emit(command, { state_ref_oid: oid, snapshot_hash: state.snapshot.snapshot_hash }, 'BOOTSTRAP PASS: portable scheduler state initialized.'); return 0;
  }
  if (command === 'status') { emit(command, { state_ref_oid: state.oid, snapshot_hash: state.snapshot.snapshot_hash, material_events: state.events.length, machine_lease: state.machineLease, live_worker_capacity: config.workers.length, configured_worker_slots: config.worker_slots, counts: stateCounts(state.snapshot) }, `STATUS: ${state.events.length} events; ${Object.values(state.snapshot.work_items).length} work items; ${config.workers.length}/${config.worker_slots} live workers.`); return 0; }
  if (command === 'acquire-machine') {
    const now = new Date().toISOString();
    if (state.machineLease && Date.parse(state.machineLease.expires_at) > Date.parse(now) && state.machineLease.machine_id !== machine.machine_id) throw new Error(`machine custody held by ${state.machineLease.machine_id}`);
    const epoch = (state.machineLease?.lease_epoch ?? 0) + 1;
    state.machineLease = { machine_id: machine.machine_id, lease_epoch: epoch, acquired_at: now, expires_at: new Date(Date.parse(now) + config.lease_duration_seconds * 1000).toISOString(), expected_state_ref_oid: state.oid };
    const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler custody ${machine.machine_id}`, config });
    emit(command, { machine_id: machine.machine_id, lease_epoch: epoch, state_ref_oid: oid }, 'ACQUIRE PASS: this machine owns dispatch custody.'); return 0;
  }
  if (command === 'release-machine') {
    ensureCustody(state, machine); const now = new Date().toISOString(); state.machineLease = { machine_id: null, lease_epoch: state.machineLease.lease_epoch, acquired_at: state.machineLease.acquired_at, released_at: now, expires_at: now, expected_state_ref_oid: state.oid }; const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler custody release ${machine.machine_id}`, config });
    emit(command, { state_ref_oid: oid }, 'RELEASE PASS: machine custody released.'); return 0;
  }
  if (command === 'sync') {
    const refs = schedulerStateRefs(config);
    let localAheadOid = null;
    const remoteState = runGit(root, ['ls-remote', '--exit-code', '--heads', 'origin', refs.local], { allowFailure: true });
    if (remoteState.status === 0) {
      runGit(root, ['fetch', 'origin', `+${refs.local}:${refs.remote}`]);
      const remoteOid = refOid(root, refs.remote);
      const localOid = refOid(root, refs.local);
      if (!localOid) runGit(root, ['update-ref', refs.local, remoteOid]);
      else if (localOid !== remoteOid) {
        const remoteIsAncestor = runGit(root, ['merge-base', '--is-ancestor', remoteOid, localOid], { allowFailure: true }).status === 0;
        if (remoteIsAncestor) localAheadOid = localOid;
        else {
          runGit(root, ['update-ref', `refs/agentops/rejected-scheduler-state/${localOid}`, localOid]);
          runGit(root, ['update-ref', refs.local, remoteOid, localOid]);
        }
      }
      state = readPortableState(root, config);
    } else localAheadOid = refOid(root, refs.local);
    const before = state.snapshot.snapshot_hash; const rebuilt = reduceEvents(state.events); if (rebuilt.errors.length) throw new Error(`replay errors: ${JSON.stringify(rebuilt.errors)}`); state.snapshot = rebuilt;
    const changed = before !== rebuilt.snapshot_hash;
    let pushed = false;
    if (changed) { persistPortableState(root, state, { push: args.push === true, message: 'scheduler deterministic sync', config }); pushed = args.push === true; }
    else if (args.push === true && localAheadOid) {
      runGit(root, ['push', 'origin', `${localAheadOid}:${refs.local}`]);
      pushed = true;
    }
    emit(command, { changed, pushed, snapshot_hash: rebuilt.snapshot_hash, counts: stateCounts(rebuilt) }, changed ? 'SYNC PASS: snapshot rebuilt.' : pushed ? 'SYNC PUSH: preserved local state published.' : 'SYNC NOOP: no material change.'); return 0;
  }
  if (command === 'watch') {
    if (!state.oid) return 0;
    ensureCustody(state, machine);
    const now = new Date().toISOString();
    const rebuilt = reduceEvents(state.events); if (rebuilt.errors.length) throw new Error(`replay errors: ${JSON.stringify(rebuilt.errors)}`);
    const reconciled = stableStringify(state.snapshot) !== stableStringify(rebuilt);
    state.snapshot = rebuilt;
    const preliminary = watcherPlan(state.snapshot, config, now);
    for (const expiration of preliminary.expirations) {
      state = appendEvents(state, [{ ...expiration, machine_id: machine.machine_id, event_type: 'LEASE_EXPIRED', exact_object: {}, payload: {}, created_at: now, idempotency_key: `watch-expire:${expiration.issue_id}:${expiration.lease_epoch}` }]);
    }
    const coreMaterial = reconciled || preliminary.expirations.length > 0;
    let oid = state.oid;
    if (coreMaterial) {
      oid = persistPortableState(root, state, { push: args.push === true, message: 'scheduler watcher reconcile/expire', config });
      state.oid = oid;
    }
    const needsBase = Object.values(state.snapshot.work_items).some((item) => ['READY', 'REPAIR_REQUIRED'].includes(item.state)) && config.workers.some((worker) => worker.capabilities.includes('implementation'));
    const baseCommit = needsBase ? currentDevelopmentBase(root, config) : null;
    const plan = planAssignments(state.snapshot, config, now, baseCommit);
    const refill = persistRefillAssignments(root, state, plan, machine.machine_id, now, config, { push: args.push === true, message: 'scheduler watcher refill' });
    state = refill.state; oid = refill.oid;
    const dispatched = refill.dispatched;
    const material = coreMaterial || plan.assignments.length > 0;
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
    const delivered = deliverCandidate(root, item, config);
    state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { pr_number: delivered.number, oid: item.candidate_commit }, payload: { pr_url: delivered.url }, created_at: new Date().toISOString(), idempotency_key: `pr-open:${delivered.number}:${item.candidate_commit}` }]);
    const oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler PR_OPENED ${item.issue_id}`, config });
    emit(command, { state_ref_oid: oid, issue: state.snapshot.work_items[item.issue_id], delivery: delivered }, `PR_OPENED accepted for ${item.issue_id}: ${delivered.url}`); return 0;
  }
  if (command === 'merge-dev') {
    const item = state.snapshot.work_items[String(args.issue)]; if (!item) throw new Error(`unknown issue ${args.issue}`);
    const result = mergeDevPr(root, config, item, Number(args.pr), { rollbackKnown: args.rollback_known === true || args.rollback_known === 'true' });
    const createdAt = result.merged.mergedAt;
    state = appendEvents(state, [
      { event_type: 'MERGED_DEV', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: result.merged.mergeCommit.oid, pr_number: result.pr.number }, payload: { merge_commit: result.merged.mergeCommit.oid, review_independence: result.gate.review_independence, ...(result.gate.review_independence_evidence ? { review_independence_evidence: result.gate.review_independence_evidence } : {}) }, created_at: createdAt, idempotency_key: `merged-dev:${result.pr.number}:${result.merged.mergeCommit.oid}` },
      { event_type: 'COMPLETED', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { oid: result.merged.mergeCommit.oid }, payload: {}, created_at: createdAt, idempotency_key: `completed:${item.issue_id}:${result.merged.mergeCommit.oid}` }
    ]);
    let oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler MERGED_DEV ${item.issue_id}`, config });
    state.oid = oid;
    const baseCommit = currentDevelopmentBase(root, config);
    const plan = planAssignments(state.snapshot, config, createdAt, baseCommit);
    const refill = persistRefillAssignments(root, state, plan, machine.machine_id, createdAt, config, { push: args.push === true, message: `scheduler post-merge refill ${item.issue_id}` });
    state = refill.state; oid = refill.oid;
    const dispatched = refill.dispatched;
    emit(command, { state_ref_oid: oid, issue: state.snapshot.work_items[item.issue_id], merge: result.merged, gates: result.gate.gates, review_independence: result.gate.review_independence, refill_assignments: plan.assignments, dispatched }, `MERGED_DEV accepted for ${item.issue_id} (review: ${result.gate.review_independence}); refill candidates=${plan.assignments.length}.`); return 0;
  }
  const input = transitionInput(command, trustedTransitionArgs(args), state, machine); state = appendEvents(state, [input]);
  let oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler ${input.event_type} ${input.issue_id}`, config });
  state.oid = oid;
  const triggers = new Set(['candidate', 'qa', 'block', 'release', 'expire', 'complete']);
  let delivery = null;
  let item = state.snapshot.work_items[input.issue_id];
  if (command === 'qa' && args.result === 'PASS' && args.no_deliver !== true && args.no_deliver !== 'true' && config.authority.non_force_push_codex_branch && config.authority.open_issue_closing_pr_to_dev) {
    delivery = deliverCandidate(root, item, config);
    state = appendEvents(state, [{ event_type: 'PR_OPENED', issue_id: item.issue_id, actor: 'scheduler', machine_id: machine.machine_id, lease_id: item.lease_id, lease_epoch: item.lease_epoch, exact_object: { pr_number: delivery.number, oid: item.candidate_commit }, payload: { pr_url: delivery.url }, created_at: input.created_at, idempotency_key: `pr-open:${delivery.number}:${item.candidate_commit}` }]);
    oid = persistPortableState(root, state, { push: args.push === true, message: `scheduler PR_OPENED ${item.issue_id}`, config });
    state.oid = oid;
    item = state.snapshot.work_items[input.issue_id];
  }
  const needsBase = triggers.has(command)
    && Object.values(state.snapshot.work_items).some((workItem) => ['READY', 'REPAIR_REQUIRED'].includes(workItem.state))
    && config.workers.some((worker) => worker.capabilities.includes('implementation'));
  const baseCommit = needsBase ? currentDevelopmentBase(root, config) : null;
  const plan = triggers.has(command) ? planAssignments(state.snapshot, config, input.created_at, baseCommit) : { assignments: [], no_safe_assignment: false };
  const refill = persistRefillAssignments(root, state, plan, machine.machine_id, input.created_at, config, { push: args.push === true, message: `scheduler refill after ${input.event_type} ${input.issue_id}` });
  state = refill.state; oid = refill.oid;
  item = state.snapshot.work_items[input.issue_id];
  const wake = item?.state === 'CLAIMED' ? compileWake(item, config) : null;
  const dispatched = refill.dispatched;
  emit(command, { state_ref_oid: oid, snapshot_hash: state.snapshot.snapshot_hash, issue: item, refill_assignments: plan.assignments, no_safe_assignment: plan.no_safe_assignment, wake, dispatched, delivery }, `${input.event_type} accepted for ${input.issue_id}; refill assignments=${plan.assignments.length}${delivery ? `; PR=${delivery.url}` : ''}.`); return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = main(); } catch (error) { process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n${error.message}\n`); process.exitCode = 1; }
}
