#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const REQUEST_SCHEMA = "agentops/owner-command-request/v1";
const LEGACY_MARKER = "owner-decision/v1";
const PROJECT_MARKER = "agentops/project-schema-change-authority/v1";
const RECONCILIATION_MARKER = "agentops/scheduler-state-reconciliation-authority/v1";
const CUTOVER_MARKER = "agentops/scheduler-cutover-authority/v1";
const OID = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const CAPSULE_HASH = /^sha256:[0-9a-f]{64}$/;
const UTC_TIMESTAMP = /^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2})(?:\.[0-9]{1,7})?Z$/;

const LEGACY_SECTIONS = Object.freeze([
  "Owner-command form", "Action", "Target ticket", "Expected current hash", "Candidate OID",
  "Scheduler HEAD", "Scheduler tree", "Source state OID", "Source state tree",
  "Source snapshot SHA-256", "Source journal manifest SHA-256", "Source event count",
  "Source state version", "Target state version", "Canonical anchor OID", "Preserved local tip OID",
  "Dispatch frozen", "One use", "Expires at", "Target ref", "Expected remote OID", "Push mode",
  "Abort on remote change", "Reason"
]);
const COMMON_SECTIONS = Object.freeze(["Request schema", "Action", "Target ticket", "Expected current hash", "Candidate OID"]);
const PROJECT_SECTIONS = Object.freeze([
  ...COMMON_SECTIONS,
  "Executor head", "Executor tree", "Project owner", "Project owner type", "Project number", "Project ID",
  "Project title", "Project closed", "Authenticated login", "Required scope", "Project updated at",
  "Preflight field count", "Field state root", "Preflight item count", "Preflight field value count",
  "Item state root", "Pagination manifest hash", "Priority field ID", "Priority contract hash", "Definitions hash",
  "Mode", "Allowed mutation", "Forbid item mutation", "Forbid existing field update", "Forbid backfill",
  "Abort on any drift", "Retry mode", "One use", "Expires at"
]);
const RECONCILIATION_SECTIONS = Object.freeze([
  ...COMMON_SECTIONS,
  "Reconciler head", "Reconciler tree", "Source state OID", "Source state tree",
  "Source snapshot SHA-256", "Source journal manifest SHA-256", "Source event count", "Source state version",
  "Canonical anchor OID", "Target state OID", "Target state tree", "Target snapshot SHA-256",
  "Target journal manifest SHA-256", "Target event count", "Machine lease", "Work leases", "Mode", "Not before",
  "Quiet window receipt hash", "Expected event count delta", "Dispatch frozen", "No refill", "No assignment",
  "No dispatch", "No external mutation", "One use", "Expires at", "Target ref", "Expected remote OID", "Push mode",
  "Abort on remote change"
]);
const CUTOVER_SECTIONS = Object.freeze([
  ...COMMON_SECTIONS,
  "Scheduler head", "Scheduler tree", "QA receipt hash", "Migration boundary OID", "State migrated event hash",
  "Current state OID", "Current state tree", "Project schema receipt hash", "Project manifest hash",
  "Quiet window receipt hash", "Released custody hash", "Active work lease count", "Legacy activation blob OID",
  "Pre-cutover config blob OID", "Activation manifest hash", "State target ref", "Expected state remote OID",
  "Development ref", "Expected development remote OID", "One use", "Expires at", "Push mode",
  "Abort on remote change"
]);

const MIGRATION_FIELDS = Object.freeze({
  "Scheduler HEAD": "scheduler_head", "Scheduler tree": "scheduler_tree", "Source state OID": "source_state_oid",
  "Source state tree": "source_state_tree", "Source snapshot SHA-256": "source_snapshot_sha256",
  "Source journal manifest SHA-256": "source_journal_manifest_sha256", "Source event count": "source_event_count",
  "Source state version": "source_state_version", "Target state version": "target_state_version",
  "Canonical anchor OID": "canonical_anchor_oid", "Preserved local tip OID": "preserved_local_tip_oid",
  "Dispatch frozen": "dispatch_frozen", "One use": "one_use", "Expires at": "expires_at",
  "Target ref": "target_ref", "Expected remote OID": "expected_remote_oid", "Push mode": "push_mode",
  "Abort on remote change": "abort_on_remote_change"
});
const PROJECT_FIELDS = Object.freeze({
  "Executor head": "executor_head", "Executor tree": "executor_tree", "Project owner": "project_owner",
  "Project owner type": "project_owner_type", "Project number": "project_number", "Project ID": "project_id",
  "Project title": "project_title", "Project closed": "project_closed", "Authenticated login": "authenticated_login",
  "Required scope": "required_scope", "Project updated at": "project_updated_at",
  "Preflight field count": "preflight_field_count", "Field state root": "field_state_root",
  "Preflight item count": "preflight_item_count", "Preflight field value count": "preflight_field_value_count",
  "Item state root": "item_state_root", "Pagination manifest hash": "pagination_manifest_hash",
  "Priority field ID": "priority_field_id", "Priority contract hash": "priority_contract_hash",
  "Definitions hash": "definitions_hash", "Mode": "mode", "Allowed mutation": "allowed_mutation",
  "Forbid item mutation": "forbid_item_mutation", "Forbid existing field update": "forbid_existing_field_update",
  "Forbid backfill": "forbid_backfill", "Abort on any drift": "abort_on_any_drift", "Retry mode": "retry_mode",
  "One use": "one_use", "Expires at": "expires_at"
});
const RECONCILIATION_FIELDS = Object.freeze({
  "Reconciler head": "reconciler_head", "Reconciler tree": "reconciler_tree", "Source state OID": "source_state_oid",
  "Source state tree": "source_state_tree", "Source snapshot SHA-256": "source_snapshot_sha256",
  "Source journal manifest SHA-256": "source_journal_manifest_sha256", "Source event count": "source_event_count",
  "Source state version": "source_state_version", "Canonical anchor OID": "canonical_anchor_oid",
  "Target state OID": "target_state_oid", "Target state tree": "target_state_tree",
  "Target snapshot SHA-256": "target_snapshot_sha256",
  "Target journal manifest SHA-256": "target_journal_manifest_sha256", "Target event count": "target_event_count",
  "Machine lease": "machine_lease", "Work leases": "work_leases", "Mode": "mode", "Not before": "not_before",
  "Quiet window receipt hash": "quiet_window_receipt_hash", "Expected event count delta": "expected_event_count_delta",
  "Dispatch frozen": "dispatch_frozen", "No refill": "no_refill", "No assignment": "no_assignment",
  "No dispatch": "no_dispatch", "No external mutation": "no_external_mutation", "One use": "one_use",
  "Expires at": "expires_at", "Target ref": "target_ref", "Expected remote OID": "expected_remote_oid",
  "Push mode": "push_mode", "Abort on remote change": "abort_on_remote_change"
});
const CUTOVER_FIELDS = Object.freeze({
  "Scheduler head": "scheduler_head", "Scheduler tree": "scheduler_tree", "QA receipt hash": "qa_receipt_hash",
  "Migration boundary OID": "migration_boundary_oid", "State migrated event hash": "state_migrated_event_hash",
  "Current state OID": "current_state_oid", "Current state tree": "current_state_tree",
  "Project schema receipt hash": "project_schema_receipt_hash", "Project manifest hash": "project_manifest_hash",
  "Quiet window receipt hash": "quiet_window_receipt_hash", "Released custody hash": "released_custody_hash",
  "Active work lease count": "active_work_lease_count", "Legacy activation blob OID": "legacy_activation_blob_oid",
  "Pre-cutover config blob OID": "pre_cutover_config_blob_oid", "Activation manifest hash": "activation_manifest_hash",
  "State target ref": "state_target_ref", "Expected state remote OID": "expected_state_remote_oid",
  "Development ref": "development_ref", "Expected development remote OID": "expected_development_remote_oid",
  "One use": "one_use", "Expires at": "expires_at", "Push mode": "push_mode",
  "Abort on remote change": "abort_on_remote_change"
});

function issueSections(body) {
  const matches = [...body.matchAll(/^### (.+)\r?$/gm)];
  const values = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const heading = matches[index][1].trim();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? body.length;
    values.set(heading, body.slice(start, end).trim());
  }
  return { headings: matches.map((match) => match[1].trim()), preamble: body.slice(0, matches[0]?.index ?? body.length).trim(), values };
}

function singleLine(values, heading, errors, { required = true } = {}) {
  const value = values.get(heading);
  if (!value || value === "_No response_") {
    if (required) errors.push(`${heading} is required`);
    return undefined;
  }
  if (value.includes("\n") || value.includes("\r")) {
    errors.push(`${heading} must contain exactly one line`);
    return undefined;
  }
  return value;
}

function oid(value, field, errors) {
  if (!OID.test(value ?? "")) errors.push(`${field} must be exactly 40 lowercase hex characters`);
}
function hash(value, field, errors) {
  if (!SHA256.test(value ?? "")) errors.push(`${field} must be exactly 64 lowercase hex characters`);
}
function integer(value, field, errors) {
  if (!/^(0|[1-9][0-9]*)$/.test(value ?? "")) {
    errors.push(`${field} must be a non-negative canonical base-10 integer`);
    return value;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) errors.push(`${field} must be a safe integer`);
  return parsed;
}
function constant(payload, key, expected, errors) {
  if (payload[key] !== expected && payload[key] !== String(expected)) errors.push(`${key} must be exactly ${expected}`);
  else payload[key] = expected;
}
function strictTrue(payload, key, errors) { constant(payload, key, true, errors); }

function timestamp(value, field, errors, { future = false, legacy = false } = {}, now = new Date()) {
  const legacyPattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$/;
  const match = (legacy ? legacyPattern : UTC_TIMESTAMP).exec(value ?? "");
  const millis = Date.parse(value ?? "");
  const secondPrefix = typeof value === "string" ? value.slice(0, 19) : "";
  const calendarMatches = Number.isFinite(millis) && new Date(millis).toISOString().slice(0, 19) === secondPrefix;
  if (!match || !calendarMatches) errors.push(`${field} must be a valid canonical UTC timestamp with seconds${legacy ? " and optional milliseconds" : " and optional 1-7 digit fractional seconds"}`);
  else if (future && millis <= now.getTime()) errors.push(`${field} must still be in the future when the command is accepted`);
  return millis;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function canonicalJson(value, field, errors) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { errors.push(`${field} must be valid one-line JSON`); return undefined; }
  if (stableJson(parsed) !== value) errors.push(`${field} must use canonical JSON with sorted object keys and no insignificant whitespace`);
  return parsed;
}
function exactKeys(value, keys, field, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${field} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push(`${field} must contain exactly: ${keys.join(", ")}`);
    return false;
  }
  return true;
}

function baseRequest(values, actor, errors, { requireBindings = false } = {}) {
  const request = { schema: REQUEST_SCHEMA };
  if (typeof actor !== "string" || !actor) errors.push("authenticated actor role is required outside the issue body");
  else request.actor = actor;
  for (const [heading, key, required] of [
    ["Action", "action", true], ["Target ticket", "target", true],
    ["Expected current hash", "expected_current_hash", requireBindings], ["Candidate OID", "candidate_oid", requireBindings]
  ]) {
    const value = singleLine(values, heading, errors, { required });
    if (value !== undefined) request[key] = value;
  }
  return request;
}
function validateCommonOwner(request, expectedAction, errors) {
  if (request.actor !== "owner") errors.push(`${expectedAction} is owner-exclusive`);
  if (request.action !== expectedAction) errors.push(`Action must be exactly ${expectedAction} for this request schema`);
  if (!CAPSULE_HASH.test(request.expected_current_hash ?? "")) errors.push("Expected current hash must be sha256: followed by 64 lowercase hex characters");
  oid(request.candidate_oid, "Candidate OID", errors);
}
function collect(values, fields, errors) {
  return Object.fromEntries(Object.entries(fields).map(([heading, key]) => [key, singleLine(values, heading, errors)]));
}

function buildProjectPayload(flat, request, errors, now) {
  for (const key of ["executor_head", "executor_tree"]) oid(flat[key], key, errors);
  for (const key of ["field_state_root", "item_state_root", "pagination_manifest_hash", "priority_contract_hash", "definitions_hash"]) hash(flat[key], key, errors);
  flat.project_number = integer(flat.project_number, "project_number", errors);
  flat.preflight_field_count = integer(flat.preflight_field_count, "preflight_field_count", errors);
  flat.preflight_item_count = integer(flat.preflight_item_count, "preflight_item_count", errors);
  flat.preflight_field_value_count = integer(flat.preflight_field_value_count, "preflight_field_value_count", errors);
  constant(flat, "project_owner", "cehinds", errors);
  constant(flat, "project_owner_type", "user", errors);
  constant(flat, "project_number", 4, errors);
  constant(flat, "project_id", "PVT_kwHOCSCyJ84BgfH9", errors);
  constant(flat, "project_title", "Family Delivery", errors);
  constant(flat, "project_closed", false, errors);
  constant(flat, "authenticated_login", "cehinds", errors);
  constant(flat, "required_scope", "project", errors);
  constant(flat, "preflight_field_count", 21, errors);
  constant(flat, "preflight_item_count", 155, errors);
  if (!/^PVTSSF_[A-Za-z0-9]+$/.test(flat.priority_field_id ?? "")) errors.push("priority_field_id must be a canonical ProjectV2 single-select field ID");
  constant(flat, "mode", "create-missing-only", errors);
  constant(flat, "allowed_mutation", "createProjectV2Field", errors);
  for (const key of ["forbid_item_mutation", "forbid_existing_field_update", "forbid_backfill", "abort_on_any_drift", "one_use"]) strictTrue(flat, key, errors);
  constant(flat, "retry_mode", "never", errors);
  timestamp(flat.project_updated_at, "project_updated_at", errors, {}, now);
  timestamp(flat.expires_at, "expires_at", errors, { future: true }, now);
  if (request.candidate_oid && flat.executor_head && request.candidate_oid !== flat.executor_head) errors.push("candidate_oid must equal project_schema_change.executor_head");
  return {
    schema: PROJECT_MARKER,
    executor_head: flat.executor_head, executor_tree: flat.executor_tree,
    project: { owner: flat.project_owner, owner_type: flat.project_owner_type, number: flat.project_number, id: flat.project_id, title: flat.project_title, closed: flat.project_closed },
    authenticated_login: flat.authenticated_login, required_scope: flat.required_scope, project_updated_at: flat.project_updated_at,
    preflight: {
      field_count: flat.preflight_field_count, field_state_root: flat.field_state_root,
      item_count: flat.preflight_item_count, field_value_count: flat.preflight_field_value_count,
      item_state_root: flat.item_state_root, pagination_manifest_hash: flat.pagination_manifest_hash,
      priority_field_id: flat.priority_field_id, priority_contract_hash: flat.priority_contract_hash
    },
    definitions_hash: flat.definitions_hash, mode: flat.mode, allowed_mutation: flat.allowed_mutation,
    forbid_item_mutation: flat.forbid_item_mutation, forbid_existing_field_update: flat.forbid_existing_field_update,
    forbid_backfill: flat.forbid_backfill, abort_on_any_drift: flat.abort_on_any_drift, retry_mode: flat.retry_mode,
    one_use: flat.one_use, expires_at: flat.expires_at
  };
}

const MACHINE_KEYS = Object.freeze(["machine_id", "lease_epoch", "acquired_at", "released_at", "expires_at", "expected_state_ref_oid"]);
const WORK_KEYS = Object.freeze(["issue_id", "state", "assigned_actor", "assignment_kind", "lease_id", "lease_epoch", "lease_expiry", "lease_machine_id", "base_commit"]);
function validateMachineLease(value, errors, now) {
  const lease = canonicalJson(value, "machine_lease", errors);
  if (!exactKeys(lease, MACHINE_KEYS, "machine_lease", errors)) return lease;
  if (lease.machine_id !== null && (typeof lease.machine_id !== "string" || !lease.machine_id)) errors.push("machine_lease.machine_id must be a non-empty string or null");
  if (!Number.isSafeInteger(lease.lease_epoch) || lease.lease_epoch < 0) errors.push("machine_lease.lease_epoch must be a non-negative safe integer");
  timestamp(lease.acquired_at, "machine_lease.acquired_at", errors, {}, now);
  timestamp(lease.expires_at, "machine_lease.expires_at", errors, {}, now);
  if (lease.released_at !== null) timestamp(lease.released_at, "machine_lease.released_at", errors, {}, now);
  if (lease.machine_id === null && lease.released_at === null) errors.push("released machine custody must include released_at");
  if (lease.machine_id !== null && lease.released_at !== null) errors.push("active machine custody must have released_at null");
  oid(lease.expected_state_ref_oid, "machine_lease.expected_state_ref_oid", errors);
  return lease;
}
function compareWorkLease(a, b) {
  const aNumeric = /^[0-9]+$/.test(a.issue_id);
  const bNumeric = /^[0-9]+$/.test(b.issue_id);
  let issueOrder;
  if (aNumeric && bNumeric) issueOrder = BigInt(a.issue_id) < BigInt(b.issue_id) ? -1 : BigInt(a.issue_id) > BigInt(b.issue_id) ? 1 : 0;
  else issueOrder = a.issue_id < b.issue_id ? -1 : a.issue_id > b.issue_id ? 1 : 0;
  if (issueOrder) return issueOrder;
  if (a.lease_epoch !== b.lease_epoch) return a.lease_epoch - b.lease_epoch;
  return a.lease_id < b.lease_id ? -1 : a.lease_id > b.lease_id ? 1 : 0;
}
function validateWorkLeases(value, errors, now) {
  const leases = canonicalJson(value, "work_leases", errors);
  if (!Array.isArray(leases)) { errors.push("work_leases must be an array"); return leases; }
  const identities = new Set();
  const issueIds = new Set();
  const leaseIds = new Set();
  for (const [index, lease] of leases.entries()) {
    const field = `work_leases[${index}]`;
    if (!exactKeys(lease, WORK_KEYS, field, errors)) continue;
    for (const key of WORK_KEYS.filter((key) => key !== "lease_epoch")) {
      if (typeof lease[key] !== "string" || !lease[key]) errors.push(`${field}.${key} must be a non-empty string`);
    }
    if (!Number.isSafeInteger(lease.lease_epoch) || lease.lease_epoch < 1) errors.push(`${field}.lease_epoch must be a positive safe integer`);
    timestamp(lease.lease_expiry, `${field}.lease_expiry`, errors, {}, now);
    oid(lease.base_commit, `${field}.base_commit`, errors);
    const identity = `${lease.issue_id}\u0000${lease.lease_epoch}\u0000${lease.lease_id}`;
    if (identities.has(identity)) errors.push("work_leases contains a duplicate lease identity");
    if (issueIds.has(lease.issue_id)) errors.push("work_leases contains a duplicate issue_id");
    if (leaseIds.has(lease.lease_id)) errors.push("work_leases contains a duplicate lease_id");
    identities.add(identity);
    issueIds.add(lease.issue_id);
    leaseIds.add(lease.lease_id);
  }
  for (let index = 1; index < leases.length; index += 1) {
    if (compareWorkLease(leases[index - 1], leases[index]) > 0) {
      errors.push("work_leases must be sorted by numeric-or-code-point issue_id, lease_epoch, then lease_id");
      break;
    }
  }
  return leases;
}

function buildReconciliationPayload(flat, request, errors, now) {
  for (const key of ["reconciler_head", "reconciler_tree", "source_state_oid", "source_state_tree", "canonical_anchor_oid", "target_state_oid", "target_state_tree", "expected_remote_oid"]) oid(flat[key], key, errors);
  for (const key of ["source_snapshot_sha256", "source_journal_manifest_sha256", "target_snapshot_sha256", "target_journal_manifest_sha256", "quiet_window_receipt_hash"]) hash(flat[key], key, errors);
  flat.source_event_count = integer(flat.source_event_count, "source_event_count", errors);
  flat.target_event_count = integer(flat.target_event_count, "target_event_count", errors);
  flat.expected_event_count_delta = integer(flat.expected_event_count_delta, "expected_event_count_delta", errors);
  constant(flat, "source_state_version", 1, errors);
  constant(flat, "mode", "expire-all-and-release-expired-custody", errors);
  for (const key of ["dispatch_frozen", "no_refill", "no_assignment", "no_dispatch", "no_external_mutation", "one_use", "abort_on_remote_change"]) strictTrue(flat, key, errors);
  constant(flat, "target_ref", "refs/heads/agentops/scheduler-state", errors);
  constant(flat, "push_mode", "non-force-forward-only-cas", errors);
  const notBefore = timestamp(flat.not_before, "not_before", errors, {}, now);
  const expires = timestamp(flat.expires_at, "expires_at", errors, { future: true }, now);
  if (Number.isFinite(notBefore) && Number.isFinite(expires) && notBefore >= expires) errors.push("not_before must be earlier than expires_at");
  const machineLease = validateMachineLease(flat.machine_lease, errors, now);
  const workLeases = validateWorkLeases(flat.work_leases, errors, now);
  if (request.candidate_oid && flat.reconciler_head && request.candidate_oid !== flat.reconciler_head) errors.push("candidate_oid must equal scheduler_state_reconciliation.reconciler_head");
  if (flat.source_state_oid && flat.expected_remote_oid && flat.source_state_oid !== flat.expected_remote_oid) errors.push("source_state_oid must equal expected_remote_oid");
  if (Number.isSafeInteger(flat.source_event_count) && Number.isSafeInteger(flat.target_event_count) && Number.isSafeInteger(flat.expected_event_count_delta) && flat.target_event_count !== flat.source_event_count + flat.expected_event_count_delta) errors.push("target_event_count must equal source_event_count plus expected_event_count_delta");
  if (Number.isFinite(notBefore) && machineLease?.expires_at && Date.parse(machineLease.expires_at) > notBefore) errors.push("not_before must not precede machine_lease.expires_at");
  if (Number.isFinite(notBefore) && Array.isArray(workLeases) && workLeases.some((lease) => Date.parse(lease.lease_expiry) > notBefore)) errors.push("not_before must not precede any work lease expiry");
  return {
    schema: RECONCILIATION_MARKER,
    reconciler_head: flat.reconciler_head, reconciler_tree: flat.reconciler_tree,
    source: { state_oid: flat.source_state_oid, state_tree: flat.source_state_tree, snapshot_sha256: flat.source_snapshot_sha256, journal_manifest_sha256: flat.source_journal_manifest_sha256, event_count: flat.source_event_count, state_version: flat.source_state_version },
    target: { state_oid: flat.target_state_oid, state_tree: flat.target_state_tree, snapshot_sha256: flat.target_snapshot_sha256, journal_manifest_sha256: flat.target_journal_manifest_sha256, event_count: flat.target_event_count },
    canonical_anchor_oid: flat.canonical_anchor_oid, machine_lease: machineLease, work_leases: workLeases,
    mode: flat.mode, not_before: flat.not_before, quiet_window_receipt_hash: flat.quiet_window_receipt_hash,
    expected_event_count_delta: flat.expected_event_count_delta, dispatch_frozen: flat.dispatch_frozen,
    no_refill: flat.no_refill, no_assignment: flat.no_assignment, no_dispatch: flat.no_dispatch,
    no_external_mutation: flat.no_external_mutation, one_use: flat.one_use, expires_at: flat.expires_at,
    target_ref: flat.target_ref, expected_remote_oid: flat.expected_remote_oid, push_mode: flat.push_mode,
    abort_on_remote_change: flat.abort_on_remote_change
  };
}

function buildCutoverPayload(flat, request, errors, now) {
  for (const key of ["scheduler_head", "scheduler_tree", "migration_boundary_oid", "current_state_oid", "current_state_tree", "legacy_activation_blob_oid", "pre_cutover_config_blob_oid", "expected_state_remote_oid", "expected_development_remote_oid"]) oid(flat[key], key, errors);
  for (const key of ["qa_receipt_hash", "state_migrated_event_hash", "project_schema_receipt_hash", "project_manifest_hash", "quiet_window_receipt_hash", "released_custody_hash", "activation_manifest_hash"]) hash(flat[key], key, errors);
  flat.active_work_lease_count = integer(flat.active_work_lease_count, "active_work_lease_count", errors);
  constant(flat, "active_work_lease_count", 0, errors);
  constant(flat, "state_target_ref", "refs/heads/agentops/scheduler-state", errors);
  constant(flat, "development_ref", "refs/heads/dev", errors);
  strictTrue(flat, "one_use", errors);
  strictTrue(flat, "abort_on_remote_change", errors);
  constant(flat, "push_mode", "non-force-forward-only-cas", errors);
  timestamp(flat.expires_at, "expires_at", errors, { future: true }, now);
  if (request.candidate_oid && flat.scheduler_head && request.candidate_oid !== flat.scheduler_head) errors.push("candidate_oid must equal scheduler_cutover.scheduler_head");
  if (flat.current_state_oid && flat.expected_state_remote_oid && flat.current_state_oid !== flat.expected_state_remote_oid) errors.push("current_state_oid must equal expected_state_remote_oid");
  return {
    schema: CUTOVER_MARKER,
    scheduler_head: flat.scheduler_head, scheduler_tree: flat.scheduler_tree, qa_receipt_hash: flat.qa_receipt_hash,
    migration: { boundary_oid: flat.migration_boundary_oid, state_migrated_event_hash: flat.state_migrated_event_hash },
    current_state: { oid: flat.current_state_oid, tree: flat.current_state_tree },
    project_schema_receipt_hash: flat.project_schema_receipt_hash, project_manifest_hash: flat.project_manifest_hash,
    quiet_window_receipt_hash: flat.quiet_window_receipt_hash, released_custody_hash: flat.released_custody_hash,
    active_work_lease_count: flat.active_work_lease_count, legacy_activation_blob_oid: flat.legacy_activation_blob_oid,
    pre_cutover_config_blob_oid: flat.pre_cutover_config_blob_oid, activation_manifest_hash: flat.activation_manifest_hash,
    state_target_ref: flat.state_target_ref, expected_state_remote_oid: flat.expected_state_remote_oid,
    development_ref: flat.development_ref, expected_development_remote_oid: flat.expected_development_remote_oid,
    one_use: flat.one_use, expires_at: flat.expires_at, push_mode: flat.push_mode,
    abort_on_remote_change: flat.abort_on_remote_change
  };
}

const PROFILES = Object.freeze({
  [PROJECT_MARKER]: Object.freeze({ action: "authorize-project-schema-change", sections: PROJECT_SECTIONS, fields: PROJECT_FIELDS, payloadKey: "project_schema_change", build: buildProjectPayload }),
  [RECONCILIATION_MARKER]: Object.freeze({ action: "authorize-scheduler-state-reconciliation", sections: RECONCILIATION_SECTIONS, fields: RECONCILIATION_FIELDS, payloadKey: "scheduler_state_reconciliation", build: buildReconciliationPayload }),
  [CUTOVER_MARKER]: Object.freeze({ action: "authorize-scheduler-cutover", sections: CUTOVER_SECTIONS, fields: CUTOVER_FIELDS, payloadKey: "scheduler_cutover", build: buildCutoverPayload })
});

function validateMigration(values, request, errors, now) {
  validateCommonOwner(request, "authorize-scheduler-migration", errors);
  const migration = collect(values, MIGRATION_FIELDS, errors);
  for (const key of ["scheduler_head", "scheduler_tree", "source_state_oid", "source_state_tree", "canonical_anchor_oid", "preserved_local_tip_oid", "expected_remote_oid"]) oid(migration[key], key, errors);
  for (const key of ["source_snapshot_sha256", "source_journal_manifest_sha256"]) hash(migration[key], key, errors);
  migration.source_event_count = integer(migration.source_event_count, "source_event_count", errors);
  constant(migration, "source_state_version", 1, errors);
  constant(migration, "target_state_version", 2, errors);
  strictTrue(migration, "dispatch_frozen", errors);
  strictTrue(migration, "one_use", errors);
  strictTrue(migration, "abort_on_remote_change", errors);
  constant(migration, "target_ref", "refs/heads/agentops/scheduler-state", errors);
  constant(migration, "push_mode", "non-force-forward-only-cas", errors);
  timestamp(migration.expires_at, "expires_at", errors, { future: true, legacy: true }, now);
  if (request.candidate_oid && migration.scheduler_head && request.candidate_oid !== migration.scheduler_head) errors.push("candidate_oid must equal scheduler_migration.scheduler_head");
  if (migration.source_state_oid && migration.expected_remote_oid && migration.source_state_oid !== migration.expected_remote_oid) errors.push("source_state_oid must equal expected_remote_oid");
  const reason = values.get("Reason");
  if (reason && reason !== "_No response_") errors.push("authorize-scheduler-migration does not accept free-form Reason text");
  request.scheduler_migration = migration;
}
function validateLegacy(values, headings, actor, errors, now) {
  if (JSON.stringify(headings) !== JSON.stringify(LEGACY_SECTIONS)) errors.push("body does not match the owner-decision/v1 section order");
  if (values.get("Owner-command form") !== LEGACY_MARKER) errors.push("owner-decision/v1 form marker is missing, changed, or contains extra content");
  const request = baseRequest(values, actor, errors);
  if (request.action === "authorize-scheduler-migration") validateMigration(values, request, errors, now);
  else {
    for (const heading of Object.keys(MIGRATION_FIELDS)) {
      const value = values.get(heading);
      if (value && value !== "_No response_") errors.push(`${heading} is only valid for authorize-scheduler-migration`);
    }
    const reason = values.get("Reason");
    if (reason && reason !== "_No response_") request.reason = reason.split(/\r?\n/)[0].trim();
  }
  return request;
}
function validateProfile(profile, values, headings, actor, errors, now) {
  if (JSON.stringify(headings) !== JSON.stringify(profile.sections)) errors.push(`body does not match the ${values.get("Request schema") ?? "unknown"} section order`);
  const request = baseRequest(values, actor, errors, { requireBindings: true });
  validateCommonOwner(request, profile.action, errors);
  request[profile.payloadKey] = profile.build(collect(values, profile.fields, errors), request, errors, now);
  return request;
}

export function validateOwnerCommandIssue({ title, body, actor, now = new Date() }) {
  const errors = [];
  if (typeof title !== "string" || !/^\[decision\] \S/.test(title)) errors.push("title must start with '[decision] ' and name a target");
  if (typeof body !== "string") return { ok: false, errors: [...errors, "body must be text"], request: null };
  const { headings, preamble, values } = issueSections(body);
  if (preamble) errors.push("body contains content before the first owner-decision section");
  const marker = values.get("Request schema");
  let request;
  if (marker !== undefined) {
    const profile = PROFILES[marker];
    if (!profile) {
      errors.push("Request schema marker is missing, changed, or unsupported");
      request = baseRequest(values, actor, errors, { requireBindings: true });
    } else request = validateProfile(profile, values, headings, actor, errors, now);
  } else request = validateLegacy(values, headings, actor, errors, now);
  return { ok: errors.length === 0, errors, request: errors.length === 0 ? request : null };
}

function option(argv, name, { required = false } = {}) {
  const index = argv.indexOf(name);
  if (index === -1 || !argv[index + 1]) {
    if (required) throw new Error(`missing required ${name}`);
    return undefined;
  }
  return argv[index + 1];
}
function main(argv = process.argv) {
  const bodyFile = option(argv, "--body-file", { required: true });
  const requestFile = option(argv, "--request-file", { required: true });
  const actor = option(argv, "--actor", { required: true });
  const result = validateOwnerCommandIssue({ title: process.env.ISSUE_TITLE, body: fs.readFileSync(bodyFile, "utf8"), actor });
  if (!result.ok) {
    for (const error of result.errors) console.error(`owner-command intake rejected: ${error}`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(requestFile, `${JSON.stringify(result.request, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log("owner-command intake accepted: exact versioned form shape and structured request");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
