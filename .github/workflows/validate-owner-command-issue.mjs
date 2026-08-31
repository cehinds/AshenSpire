#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REQUEST_SCHEMA = "agentops/owner-command-request/v1";
const LEGACY_MARKER = "owner-decision/v1";
const PROJECT_MARKER = "agentops/project-schema-change-authority/v2";
const RECONCILIATION_MARKER = "agentops/scheduler-state-reconciliation-authority/v1";
const CUTOVER_MARKER = "agentops/scheduler-cutover-authority/v2";
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
  "Abort on any drift", "Retry mode", "One use", "Expires at", "Audit ref", "Expected audit remote OID",
  "Audit push mode", "Journal mode", "Recovery mode", "Audit paths", "Audit guards", "Audit result contract"
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
  "Scheduler head", "Scheduler tree", "QA receipt", "Migration", "Current state", "Project schema receipt",
  "Project manifest", "Quiet window receipt", "Active work lease count", "Legacy activation",
  "Pre-cutover config", "Post-cutover config", "Activation manifest", "Result receipt contract",
  "State target ref", "Expected state remote OID", "Development ref",
  "Expected development remote OID", "Publication mode", "Ambiguity policy", "Postcondition policy",
  "One use", "Expires at", "Push mode", "Abort on remote change"
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
  "One use": "one_use", "Expires at": "expires_at", "Audit ref": "audit_ref",
  "Expected audit remote OID": "expected_audit_remote_oid", "Audit push mode": "audit_push_mode",
  "Journal mode": "journal_mode", "Recovery mode": "recovery_mode", "Audit paths": "audit_paths",
  "Audit guards": "audit_guards", "Audit result contract": "audit_result_contract"
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
  "Scheduler head": "scheduler_head", "Scheduler tree": "scheduler_tree", "QA receipt": "qa_receipt",
  "Migration": "migration", "Current state": "current_state", "Project schema receipt": "project_schema_receipt",
  "Project manifest": "project_manifest", "Quiet window receipt": "quiet_window_receipt",
  "Active work lease count": "active_work_lease_count", "Legacy activation": "legacy_activation",
  "Pre-cutover config": "pre_cutover_config", "Post-cutover config": "post_cutover_config",
  "Activation manifest": "activation_manifest", "Result receipt contract": "result_receipt_contract",
  "State target ref": "state_target_ref",
  "Expected state remote OID": "expected_state_remote_oid", "Development ref": "development_ref",
  "Expected development remote OID": "expected_development_remote_oid", "Publication mode": "publication_mode",
  "Ambiguity policy": "ambiguity_policy", "Postcondition policy": "postcondition_policy", "One use": "one_use",
  "Expires at": "expires_at", "Push mode": "push_mode", "Abort on remote change": "abort_on_remote_change"
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

const OID_VALUE = Symbol("oid");
const HASH_VALUE = Symbol("sha256");
const EVENT_PATH_VALUE = Symbol("event-path");
const QA_SEMANTICS_VALUE = Symbol("qa-semantics");
const PROJECT_RECEIPT_SEMANTICS_VALUE = Symbol("project-receipt-semantics");
const PROJECT_MANIFEST_SEMANTICS_VALUE = Symbol("project-manifest-semantics");
const QUIET_SEMANTICS_VALUE = Symbol("quiet-semantics");
function closedShape(value, shape, field, errors) {
  if (shape === OID_VALUE) { oid(value, field, errors); return; }
  if (shape === HASH_VALUE) { hash(value, field, errors); return; }
  if (shape === EVENT_PATH_VALUE) {
    if (!/^journal\/[0-9]{8}-[A-Za-z0-9._-]+\.json$/.test(value ?? "")) errors.push(`${field} must be a canonical scheduler journal path`);
    return;
  }
  if (shape === QA_SEMANTICS_VALUE) { validateQaSemantics(value, field, errors); return; }
  if (shape === PROJECT_RECEIPT_SEMANTICS_VALUE) { validateProjectReceiptSemantics(value, field, errors); return; }
  if (shape === PROJECT_MANIFEST_SEMANTICS_VALUE) { validateProjectManifestSemantics(value, field, errors); return; }
  if (shape === QUIET_SEMANTICS_VALUE) { validateQuietSemantics(value, field, errors); return; }
  if (shape && typeof shape === "object" && !Array.isArray(shape)) {
    if (!exactKeys(value, Object.keys(shape), field, errors)) return;
    for (const [key, child] of Object.entries(shape)) closedShape(value[key], child, `${field}.${key}`, errors);
    return;
  }
  if (value !== shape) errors.push(`${field} must be exactly ${JSON.stringify(shape)}`);
}

function stringValue(value, field, errors) { if (typeof value !== "string" || !value) errors.push(`${field} must be a non-empty string`); }
function projectIdentity(value, field, errors) { closedShape(value, { owner: "cehinds", owner_type: "user", number: 4, id: "PVT_kwHOCSCyJ84BgfH9", title: "Family Delivery", closed: false }, field, errors); }
function validateQaSemantics(value, field, errors) {
  const keys = ["schema", "candidate", "verdict", "verifier", "maker_actor", "independent_of_maker", "tested_at", "tests", "evidence"];
  if (!exactKeys(value, keys, field, errors)) return;
  constant(value, "schema", "agentops/independent-qa-receipt/v1", errors);
  closedShape(value.candidate, { head: OID_VALUE, tree: OID_VALUE }, `${field}.candidate`, errors);
  if (value.verdict !== "PASS") errors.push(`${field}.verdict must be PASS`);
  if (exactKeys(value.verifier, ["actor", "role"], `${field}.verifier`, errors)) { stringValue(value.verifier.actor, `${field}.verifier.actor`, errors); constant(value.verifier, "role", "qa-independent", errors); }
  stringValue(value.maker_actor, `${field}.maker_actor`, errors); if (value.independent_of_maker !== true) errors.push(`${field}.independent_of_maker must be true`); stringValue(value.tested_at, `${field}.tested_at`, errors);
  if (!Array.isArray(value.tests) || value.tests.length === 0) errors.push(`${field}.tests must be a nonempty array`);
  else value.tests.forEach((test, index) => { const name = `${field}.tests[${index}]`; if (!exactKeys(test, ["id", "command", "exit_code", "outcome", "output_sha256"], name, errors)) return; stringValue(test.id, `${name}.id`, errors); stringValue(test.command, `${name}.command`, errors); if (test.exit_code !== 0) errors.push(`${name}.exit_code must be 0`); if (test.outcome !== "PASS") errors.push(`${name}.outcome must be PASS`); hash(test.output_sha256, `${name}.output_sha256`, errors); });
  if (!Array.isArray(value.evidence)) errors.push(`${field}.evidence must be an array`);
  else value.evidence.forEach((item, index) => { const name = `${field}.evidence[${index}]`; if (!exactKeys(item, ["kind", "path", "blob_oid", "sha256"], name, errors)) return; stringValue(item.kind, `${name}.kind`, errors); stringValue(item.path, `${name}.path`, errors); oid(item.blob_oid, `${name}.blob_oid`, errors); hash(item.sha256, `${name}.sha256`, errors); });
}
function validateProjectReceiptSemantics(value, field, errors) {
  if (!exactKeys(value, ["status", "failure_code", "project", "mutation_counts", "readback_schema", "audit_ref"], field, errors)) return;
  constant(value, "status", "COMPLETE", errors); constant(value, "failure_code", null, errors); projectIdentity(value.project, `${field}.project`, errors);
  closedShape(value.mutation_counts, { created_field_count: 8, mutated_item_count: 0, updated_existing_field_count: 0, backfill_count: 0 }, `${field}.mutation_counts`, errors);
  constant(value, "readback_schema", "agentops/project-field-readback/v1", errors); constant(value, "audit_ref", "refs/heads/agentops/project-schema-audit", errors);
}
const MANIFEST_FIELD_NAMES = Object.freeze(["Scheduler Status", "Priority", "Owner Role", "Affected Paths", "Affected Resources", "Dependencies", "External Claims", "Human Gate", "Scope Complete"]);
const STATUS_OPTIONS = Object.freeze([
  ["READY", "GREEN", "Eligible for scheduler admission."], ["BLOCKED", "RED", "Blocked by a recorded condition."],
  ["PAUSED", "GRAY", "Intentionally paused and not schedulable."], ["IN_PROGRESS", "YELLOW", "Implementation is active."],
  ["QA_REVIEW", "PURPLE", "Awaiting or undergoing independent QA."], ["PR_OPEN", "BLUE", "A pull request is open."],
  ["DONE", "GREEN", "Completed and terminal."], ["CANCELLED", "GRAY", "Cancelled and terminal."],
  ["SUPERSEDED", "PINK", "Superseded by another work item or candidate."]
]);
const PRIORITY_OPTIONS = Object.freeze([
  ["P0", "GRAY", "", "5901e7b3"], ["P1", "GRAY", "", "c3bc1e0d"],
  ["P2", "GRAY", "", "f2b023f2"], ["P3", "GRAY", "", "f85da77c"]
]);
const ROLE_OPTIONS = Object.freeze([
  ["owner", "PURPLE", "Owner authority."], ["it-manager-iii", "RED", "Technical integration and delivery authority."],
  ["project-management-lead", "BLUE", "Portfolio, dependency, and sequencing stewardship."], ["data-architecture-lead", "PURPLE", "Schema, lineage, and compatibility authority."],
  ["help-desk", "GRAY", "Intake, routing, and status hygiene."], ["maker", "GREEN", "Bounded implementation owner."],
  ["qa-independent", "YELLOW", "Independent exact-head verification."], ["it-support", "ORANGE", "Tooling and environment support."],
  ["app-dev-i", "GREEN", "Application developer I."], ["app-dev-ii", "GREEN", "Application developer II."], ["app-dev-iii", "GREEN", "Application developer III."],
  ["artist-i", "PINK", "Designer or artist I."], ["artist-ii", "PINK", "Designer or artist II."], ["artist-iii", "PINK", "Designer or artist III."],
  ["qa-technician-i", "YELLOW", "QA technician I."], ["qa-technician-ii", "YELLOW", "QA technician II."], ["qa-technician-iii", "YELLOW", "QA technician III."],
  ["team-lead", "BLUE", "Team staffing and capacity lead."]
]);
const SCOPE_OPTIONS = Object.freeze([["TRUE", "GREEN", "Affected scope is complete."], ["FALSE", "RED", "Affected scope is incomplete."]]);
const MANIFEST_FIELD_CONTRACTS = Object.freeze([
  ["ProjectV2SingleSelectField", "SINGLE_SELECT", STATUS_OPTIONS], ["ProjectV2SingleSelectField", "SINGLE_SELECT", PRIORITY_OPTIONS],
  ["ProjectV2SingleSelectField", "SINGLE_SELECT", ROLE_OPTIONS],
  ["ProjectV2Field", "TEXT", []], ["ProjectV2Field", "TEXT", []], ["ProjectV2Field", "TEXT", []],
  ["ProjectV2Field", "TEXT", []], ["ProjectV2Field", "TEXT", []], ["ProjectV2SingleSelectField", "SINGLE_SELECT", SCOPE_OPTIONS]
]);
function validateProjectManifestSemantics(value, field, errors) {
  const keys = ["schema", "definitions_hash", "project", "observed_at", "project_updated_at", "fields", "source_receipt_hash"];
  if (!exactKeys(value, keys, field, errors)) return;
  constant(value, "schema", "agentops/project-field-manifest/v1", errors); hash(value.definitions_hash, `${field}.definitions_hash`, errors); projectIdentity(value.project, `${field}.project`, errors); stringValue(value.observed_at, `${field}.observed_at`, errors); stringValue(value.project_updated_at, `${field}.project_updated_at`, errors); hash(value.source_receipt_hash, `${field}.source_receipt_hash`, errors);
  if (!Array.isArray(value.fields) || value.fields.length !== 9) { errors.push(`${field}.fields must contain exactly nine fields`); return; }
  value.fields.forEach((item, index) => {
    const name = `${field}.fields[${index}]`; if (!exactKeys(item, ["id", "name", "kind", "data_type", "created_at", "updated_at", "options"], name, errors)) return;
    for (const key of ["id", "name", "created_at", "updated_at"]) stringValue(item[key], `${name}.${key}`, errors);
    const [kind, dataType, expectedOptions] = MANIFEST_FIELD_CONTRACTS[index];
    if (item.name !== MANIFEST_FIELD_NAMES[index]) errors.push(`${name}.name is out of canonical order`);
    if (item.kind !== kind) errors.push(`${name}.kind must be ${kind}`); if (item.data_type !== dataType) errors.push(`${name}.data_type must be ${dataType}`);
    if (index === 1 && item.id !== "PVTSSF_lAHOCSCyJ84BgfH9zhfelc4") errors.push(`${name}.id must be the canonical Priority field ID`);
    if (!Array.isArray(item.options) || item.options.length !== expectedOptions.length) { errors.push(`${name}.options must contain the exact ordered option contract`); return; }
    item.options.forEach((option, optionIndex) => {
      const optionName = `${name}.options[${optionIndex}]`; if (!exactKeys(option, ["id", "name", "color", "description"], optionName, errors)) return;
      stringValue(option.id, `${optionName}.id`, errors); const [expectedName, expectedColor, expectedDescription, expectedId] = expectedOptions[optionIndex];
      if (option.name !== expectedName || option.color !== expectedColor || option.description !== expectedDescription || (expectedId && option.id !== expectedId)) errors.push(`${optionName} differs from the exact ordered option contract`);
    });
  });
}
function validateQuietSemantics(value, field, errors) {
  const keys=["observed_from","observed_until","source_state_oid","state_ref","development_ref","scheduler_process_count","legacy_process_count","state_mutation_count","dispatch_frozen","no_external_mutation"];
  if(!exactKeys(value,keys,field,errors))return; stringValue(value.observed_from,`${field}.observed_from`,errors); stringValue(value.observed_until,`${field}.observed_until`,errors); oid(value.source_state_oid,`${field}.source_state_oid`,errors); constant(value,"state_ref","refs/heads/agentops/scheduler-state",errors); constant(value,"development_ref","refs/heads/dev",errors); for(const key of ["scheduler_process_count","legacy_process_count","state_mutation_count"])constant(value,key,0,errors); constant(value,"dispatch_frozen",true,errors); constant(value,"no_external_mutation",true,errors);
}

function canonicalClosedObject(flat, key, shape, errors) {
  const value = canonicalJson(flat[key], key, errors);
  closedShape(value, shape, key, errors);
  return value;
}

const PROJECT_AUDIT_PATHS = Object.freeze({
  root: ".agentops/scheduler/project-schema-attempts",
  journal_path: ".agentops/scheduler/project-schema-attempts/journal.jsonl",
  attempt_path_template: ".agentops/scheduler/project-schema-attempts/attempts/{attempt_id}.json",
  receipt_path_template: ".agentops/scheduler/project-schema-attempts/receipts/{attempt_id}.json",
  manifest_path_template: ".agentops/scheduler/project-schema-attempts/manifests/{attempt_id}.json"
});
const PROJECT_AUDIT_GUARDS = Object.freeze({
  expected_absence: true,
  initial_commit_parent_binding: "derived-owner-authority-a",
  initial_creation_authorized_if_absent: true,
  subsequent_linear_direct_successors: true,
  allowed_mutation: "append-intent-result-attempt-and-receipt-records-only",
  intent_before_each_create: true,
  result_after_each_response: true,
  consumed_create_retry_forbidden: true,
  read_only_recovery: true,
  ref_recreation_forbidden: true,
  development_ref_mutation_forbidden: true
});
const PROJECT_AUDIT_RESULT_CONTRACT = Object.freeze({
  schema: "agentops/project-schema-audit-result-contract/v1",
  result_schema: "agentops/project-schema-audit-result/v1",
  path: ".git/agentops-project-schema/audit-result.json",
  schema_pointer: ".agentops/schemas/owner-command-request.schema.json#/definitions/project_schema_audit_result_receipt",
  construction_timing: "after-manifest-publication-and-single-postinspection",
  finalization_timing: "after-manifest-publication-and-single-postinspection",
  ambiguity_policy: "inspect-once-never-create",
  no_self_reference: true
});

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
  constant(flat, "allowed_mutation", "project-field-create", errors);
  for (const key of ["forbid_item_mutation", "forbid_existing_field_update", "forbid_backfill", "abort_on_any_drift", "one_use"]) strictTrue(flat, key, errors);
  constant(flat, "retry_mode", "never", errors);
  constant(flat, "audit_ref", "refs/heads/agentops/project-schema-audit", errors);
  constant(flat, "expected_audit_remote_oid", null, errors);
  constant(flat, "audit_push_mode", "create-if-absent-then-non-force-forward-only-cas", errors);
  constant(flat, "journal_mode", "append-only-intent-result", errors);
  constant(flat, "recovery_mode", "inspect-once-never-create", errors);
  const auditPaths = canonicalClosedObject(flat, "audit_paths", PROJECT_AUDIT_PATHS, errors);
  const auditGuards = canonicalClosedObject(flat, "audit_guards", PROJECT_AUDIT_GUARDS, errors);
  const auditResultContract = canonicalClosedObject(flat, "audit_result_contract", PROJECT_AUDIT_RESULT_CONTRACT, errors);
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
    one_use: flat.one_use, expires_at: flat.expires_at, audit_ref: flat.audit_ref,
    expected_audit_remote_oid: flat.expected_audit_remote_oid, audit_push_mode: flat.audit_push_mode,
    journal_mode: flat.journal_mode, recovery_mode: flat.recovery_mode, audit_paths: auditPaths,
    audit_guards: auditGuards, audit_result_contract: auditResultContract
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

const artifactShape = (schema, path) => ({ schema, path, blob_oid: OID_VALUE, sha256: HASH_VALUE });
const CUTOVER_SHAPES = Object.freeze({
  qa_receipt: { ...artifactShape("agentops/independent-qa-receipt/v1", ".agentops/scheduler/cutover/qa-receipt.json"), semantics: QA_SEMANTICS_VALUE },
  migration: {
    boundary_oid: OID_VALUE,
    state_migrated_event: {
      schema: "agentops/scheduler-event/v2", path: EVENT_PATH_VALUE, blob_oid: OID_VALUE, sha256: HASH_VALUE,
      semantics: {
        event_version: 2, event_type: "STATE_MIGRATED", issue_id: "scheduler-state",
        payload_schema: "agentops/scheduler-migration/v2", dispatch_frozen: true,
        single_migration_boundary: true, boundary_commit_binding: "migration.boundary_oid"
      }
    }
  },
  current_state: {
    oid: OID_VALUE, tree: OID_VALUE,
    released_custody: {
      schema: "agentops/scheduler-machine-lease/v1", path: "machine-lease.json", blob_oid: OID_VALUE, sha256: HASH_VALUE,
      semantics: { machine_id: null, acquired_at: null, released_at_required: true, expires_at_equals_released_at: true, expected_state_ref_oid_binding: "current_state.oid" }
    }
  },
  project_schema_receipt: { ...artifactShape("agentops/project-schema-change-receipt/v1", ".agentops/scheduler/cutover/project-schema-receipt.json"), semantics: PROJECT_RECEIPT_SEMANTICS_VALUE },
  project_manifest: { ...artifactShape("agentops/project-field-manifest/v1", ".agentops/scheduler/cutover/project-manifest.json"), semantics: PROJECT_MANIFEST_SEMANTICS_VALUE },
  quiet_window_receipt: { ...artifactShape("agentops/scheduler-quiet-window-receipt/v1", ".agentops/scheduler/cutover/quiet-window-receipt.json"), semantics: QUIET_SEMANTICS_VALUE },
  legacy_activation: {
    ...artifactShape("agentops/pipeline-activation/v1", ".agentops/pipeline-pilot/activation.json"),
    semantics: { enabled: false, mode: "STOOD_DOWN_FOR_SCHEDULER_CUTOVER" }
  },
  pre_cutover_config: {
    ...artifactShape("agentops/scheduler-config/v1", ".agentops/scheduler/config.json"),
    semantics: { scheduler_dispatch_enabled: false, legacy_watcher_authoritative: false, scheduler_authorization_evidence: null, migration_dispatch_frozen: true }
  },
  post_cutover_config: {
    ...artifactShape("agentops/scheduler-config/v1", ".agentops/scheduler/config.json"),
    semantics: { scheduler_dispatch_enabled: true, legacy_watcher_authoritative: false, scheduler_authorization_evidence_binding: "canonical-owner-event-in-direct-parent-a-by-path-and-id-no-hash", migration_dispatch_frozen: true }
  },
  activation_manifest: {
    ...artifactShape("agentops/scheduler-cutover-activation-manifest/v1", ".agentops/scheduler/cutover/activation-manifest.json"),
    blob_parse_policy: "parse-json-and-deep-equal-inline-template",
    template: {
      schema: "agentops/scheduler-cutover-activation-template/v1",
      development_d0: { oid: OID_VALUE, tree: OID_VALUE, legacy_activation_blob_oid: OID_VALUE, pre_cutover_config_blob_oid: OID_VALUE, post_cutover_config_blob_oid: OID_VALUE },
      state_s0: { oid: OID_VALUE, tree: OID_VALUE },
      authority_a_derivation: {
        parent_binding: "expected_development_remote_oid", parent_count: 1,
        source_paths: { owner_event_path_template: ".agentops/events/{target}/{event_id}.json", target_capsule_path_template: ".agentops/work/{target}/CURRENT.json" },
        cutover_evidence_paths: {
          qa_receipt: ".agentops/scheduler/cutover/qa-receipt.json",
          project_schema_receipt: ".agentops/scheduler/cutover/project-schema-receipt.json",
          project_manifest: ".agentops/scheduler/cutover/project-manifest.json",
          quiet_window_receipt: ".agentops/scheduler/cutover/quiet-window-receipt.json",
          activation_manifest: ".agentops/scheduler/cutover/activation-manifest.json"
        },
        deterministic_render_paths: {
          governance: ".agentops/generated/GOVERNANCE.md", hud: ".agentops/generated/hud/index.html",
          decisions: ".agentops/generated/hub/decisions.html", published_hud: "docs/generated/hud/index.html",
          published_decisions: "docs/generated/hub/decisions.html"
        },
        unchanged_render_bytes_omitted: true, other_changes_forbidden: true
      },
      state_s1_derivation: {
        parent_binding: "expected_state_remote_oid", parent_count: 1,
        activation_event: {
          path_template: "journal/{sequence:08}-{event_id}.json", schema: "agentops/scheduler-event/v2",
          payload_schema: "agentops/scheduler-activation/v2", event_version: 2, event_type: "SCHEDULER_ACTIVATED",
          issue_id: "scheduler-state", actor: "it-manager-iii", machine_id: null, lease_id: null, lease_epoch: null,
          source_binding: "current_state", authority_binding: "canonical-owner-event-in-derived-authority-a", count: 1
        },
        snapshot_path: "snapshot.json", preserved_paths_policy: "all-prior-journal-machine-lease-and-state-version-blobs-byte-identical", other_changes_forbidden: true
      },
      development_d1_derivation: {
        parent_binding: "derived-authority-a", parent_count: 1, scheduler_config_path: ".agentops/scheduler/config.json",
        scheduler_config_blob_binding: "post_cutover_config.blob_oid",
        authority_evidence_mode: "canonical-owner-event-in-direct-parent-a-by-path-and-id-no-hash", other_changes_forbidden: true
      },
      all_off_precondition: {
        scheduler_dispatch_enabled: false, legacy_watcher_authoritative: false, scheduler_authorization_evidence: null,
        migration_dispatch_frozen: true, legacy_activation_enabled: false, legacy_activation_mode: "STOOD_DOWN_FOR_SCHEDULER_CUTOVER"
      },
      derivation_order: "build-a-from-d0-build-s1-from-s0-build-d1-from-a-record-result-then-publish-s1-d1-atomically",
      no_self_reference: true
    }
  },
  result_receipt_contract: {
    schema: "agentops/scheduler-cutover-result-contract/v1", result_schema: "agentops/scheduler-cutover-result/v1",
    path: ".git/agentops-scheduler/cutover-result.json",
    schema_pointer: ".agentops/schemas/owner-command-request.schema.json#/definitions/scheduler_cutover_result_receipt",
    construction_timing: "after-local-derivation-before-publication", publication_gate: "prebuilt-a-s1-d1-match-derivation-template", no_self_reference: true
  }
});

function buildCutoverPayload(flat, request, errors, now) {
  for (const key of ["scheduler_head", "scheduler_tree", "expected_state_remote_oid", "expected_development_remote_oid"]) oid(flat[key], key, errors);
  const nested = Object.fromEntries(Object.entries(CUTOVER_SHAPES).map(([key, shape]) => [key, canonicalClosedObject(flat, key, shape, errors)]));
  flat.active_work_lease_count = integer(flat.active_work_lease_count, "active_work_lease_count", errors);
  constant(flat, "active_work_lease_count", 0, errors);
  constant(flat, "state_target_ref", "refs/heads/agentops/scheduler-state", errors);
  constant(flat, "development_ref", "refs/heads/dev", errors);
  constant(flat, "publication_mode", "atomic-two-ref-cas", errors);
  constant(flat, "ambiguity_policy", "inspect-once-never-retry", errors);
  constant(flat, "postcondition_policy", "both-exact-or-withhold", errors);
  strictTrue(flat, "one_use", errors);
  strictTrue(flat, "abort_on_remote_change", errors);
  constant(flat, "push_mode", "git-push-atomic-two-ref-exact-leases", errors);
  timestamp(flat.expires_at, "expires_at", errors, { future: true }, now);
  if (request.candidate_oid && flat.scheduler_head && request.candidate_oid !== flat.scheduler_head) errors.push("candidate_oid must equal scheduler_cutover.scheduler_head");
  if (nested.current_state?.oid !== flat.expected_state_remote_oid) errors.push("current_state.oid must equal expected_state_remote_oid");
  const template = nested.activation_manifest?.template;
  if (template) {
    if (template.development_d0.oid !== flat.expected_development_remote_oid) errors.push("activation_manifest.template.development_d0.oid must equal expected_development_remote_oid");
    if (template.state_s0.oid !== nested.current_state?.oid || template.state_s0.tree !== nested.current_state?.tree) errors.push("activation manifest S0 must equal current_state oid/tree");
    if (template.development_d0.legacy_activation_blob_oid !== nested.legacy_activation?.blob_oid || template.development_d0.pre_cutover_config_blob_oid !== nested.pre_cutover_config?.blob_oid || template.development_d0.post_cutover_config_blob_oid !== nested.post_cutover_config?.blob_oid) errors.push("activation manifest D0 blob bindings must equal their canonical descriptors");
  }
  return {
    schema: CUTOVER_MARKER, scheduler_head: flat.scheduler_head, scheduler_tree: flat.scheduler_tree,
    qa_receipt: nested.qa_receipt, migration: nested.migration, current_state: nested.current_state,
    project_schema_receipt: nested.project_schema_receipt, project_manifest: nested.project_manifest,
    quiet_window_receipt: nested.quiet_window_receipt, active_work_lease_count: flat.active_work_lease_count,
    legacy_activation: nested.legacy_activation, pre_cutover_config: nested.pre_cutover_config,
    post_cutover_config: nested.post_cutover_config, activation_manifest: nested.activation_manifest,
    result_receipt_contract: nested.result_receipt_contract,
    state_target_ref: flat.state_target_ref, expected_state_remote_oid: flat.expected_state_remote_oid,
    development_ref: flat.development_ref, expected_development_remote_oid: flat.expected_development_remote_oid,
    publication_mode: flat.publication_mode, ambiguity_policy: flat.ambiguity_policy,
    postcondition_policy: flat.postcondition_policy, one_use: flat.one_use, expires_at: flat.expires_at,
    push_mode: flat.push_mode, abort_on_remote_change: flat.abort_on_remote_change
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

function runGit(repo, args, { input, allowFailure = false, env = {} } = {}) {
  const result = spawnSync("git", args, { cwd: repo, input, encoding: "utf8", env: { ...process.env, ...env } });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  return { status: result.status, stdout: result.stdout.trim(), rawStdout: result.stdout, stderr: result.stderr.trim() };
}
function objectSha256(raw) { return crypto.createHash("sha256").update(raw).digest("hex"); }
function gitOid(repo, revision) { return runGit(repo, ["rev-parse", "--verify", revision]).stdout; }
function gitTree(repo, revision) { return runGit(repo, ["show", "-s", "--format=%T", revision]).stdout; }
function remoteRefs(repo, remote, refs) {
  const output = runGit(repo, ["ls-remote", "--refs", remote, ...refs]).stdout;
  const found = Object.fromEntries(refs.map((ref) => [ref, null]));
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [oidValue, ref] = line.split(/\s+/);
    if (Object.prototype.hasOwnProperty.call(found, ref)) found[ref] = oidValue;
  }
  return found;
}

export function atomicPublishExactRefs({ repo, remote = "origin", stateRef, expectedStateOid, stateTargetOid, developmentRef, expectedDevelopmentOid, developmentTargetOid, attemptedAt = new Date().toISOString(), expiresAt = null, now = () => new Date() }) {
  const refs = [stateRef, developmentRef];
  const before = remoteRefs(repo, remote, refs);
  if (before[stateRef] !== expectedStateOid || before[developmentRef] !== expectedDevelopmentOid) {
    throw new Error("cutover prepublication CAS mismatch; no push attempted");
  }
  if (expiresAt && Date.parse(expiresAt) <= now().getTime()) throw new Error("cutover authority expired immediately before atomic publication");
  const push = runGit(repo, [
    "push", "--atomic",
    `--force-with-lease=${stateRef}:${expectedStateOid}`,
    `--force-with-lease=${developmentRef}:${expectedDevelopmentOid}`,
    remote, `${stateTargetOid}:${stateRef}`, `${developmentTargetOid}:${developmentRef}`
  ], { allowFailure: true });
  const after = remoteRefs(repo, remote, refs);
  const ok = after[stateRef] === stateTargetOid && after[developmentRef] === developmentTargetOid;
  const receipt = {
    mode: "git-push-atomic-two-ref-exact-leases", attempted_at: attemptedAt,
    atomic_push_exit_code: push.status,
    postinspection: {
      inspection_count: 1, retry_permitted: false,
      state_ref: stateRef, state_actual_oid: after[stateRef], development_ref: developmentRef, development_actual_oid: after[developmentRef]
    }
  };
  return { ok, receipt, stderr: push.stderr };
}

function authorityBinding(request) {
  return request.scheduler_migration ?? request.project_schema_change ?? request.scheduler_state_reconciliation ?? request.scheduler_cutover;
}

function assertPublicationFresh(request, label, now = new Date()) {
  const binding = authorityBinding(request);
  const expiresAt = binding?.expires_at;
  if (!expiresAt || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now.getTime()) throw new Error(`${label} authority expired before publication`);
}

function ownerEventAt(repo, request, authorityOid = "HEAD") {
  const a = gitOid(repo, authorityOid);
  const parent = gitOid(repo, `${a}^`);
  const eventFiles = runGit(repo, ["diff-tree", "--no-commit-id", "--name-only", "-r", parent, a]).stdout.split(/\r?\n/).filter((name) => new RegExp(`^\\.agentops/events/${request.target}/[^/]+\\.json$`).test(name));
  if (eventFiles.length !== 1) throw new Error("authority A must contain exactly one canonical owner event for its target");
  const event = JSON.parse(runGit(repo, ["show", `${a}:${eventFiles[0]}`]).stdout);
  if (event.kind !== "owner-decision" || event.actor !== "owner" || event.decision?.action !== request.action) throw new Error("authority A owner event does not match the exact request action");
  return { oid: a, parent, path: eventFiles[0], event, eventHash: objectSha256(stableJson(event)) };
}

export function consumeExactPacket({ repo, request, authorityOid = "HEAD", consumedAt = new Date().toISOString() }) {
  const authority = ownerEventAt(repo, request, authorityOid);
  const ref = `refs/agentops/owner-command-consumed/${request.action}/${authority.eventHash}`;
  const prior = runGit(repo, ["rev-parse", "--verify", ref], { allowFailure: true });
  if (prior.status === 0) {
    const record = JSON.parse(runGit(repo, ["show", `${ref}:.agentops/local-owner-command-consumption.json`]).stdout);
    if (record.authority_oid !== authority.oid || record.event_hash !== authority.eventHash || record.action !== request.action) throw new Error("local owner-command consumption tombstone conflicts with the exact packet");
    return { ref, oid: prior.stdout, record, recovery: true, authority };
  }
  const record = { schema: "agentops/local-owner-command-consumption/v1", action: request.action, authority_oid: authority.oid, event_path: authority.path, event_id: authority.event.id, event_hash: authority.eventHash, consumed_at: consumedAt, retention: "never-delete", authority_effect: "evidence-only-no-authority-expansion" };
  const blob = hashBlob(repo, `${stableJson(record)}\n`);
  const tree = treeWithBlobs(repo, authority.oid, { ".agentops/local-owner-command-consumption.json": blob });
  const oidValue = commitFromTree(repo, authority.oid, tree, `AgentOps consume ${request.action}`, consumedAt, "AgentOps Owner Command");
  runGit(repo, ["update-ref", ref, oidValue, "0".repeat(40)]);
  return { ref, oid: oidValue, record, recovery: false, authority };
}

export function createProjectAuditRefOnce({ repo, authorityOid, auditTargetOid, remote = "origin", auditRef = "refs/heads/agentops/project-schema-audit", expiresAt = null, now = () => new Date() }) {
  if (gitOid(repo, `${auditTargetOid}^`) !== authorityOid) throw new Error("initial Project audit commit must be the direct child of authority A");
  const before = remoteRefs(repo, remote, [auditRef]);
  if (before[auditRef] !== null) throw new Error("Project audit ref is not absent; no creation attempted");
  if (expiresAt && Date.parse(expiresAt) <= now().getTime()) throw new Error("Project schema authority expired immediately before audit-ref publication");
  const push = runGit(repo, ["push", `--force-with-lease=${auditRef}:`, remote, `${auditTargetOid}:${auditRef}`], { allowFailure: true });
  const after = remoteRefs(repo, remote, [auditRef]);
  const targetExact = after[auditRef] === auditTargetOid;
  return {
    ok: targetExact,
    observation: { publication: { ref: auditRef, push_mode: "create-if-absent", push_exit_code: push.status }, postinspection: { inspection_count: 1, retry_create_permitted: false, ref: auditRef, actual_oid: after[auditRef] } },
    stderr: push.stderr
  };
}

function commitFromTree(repo, parentOid, treeOid, message, at, identity) {
  return runGit(repo, ["commit-tree", treeOid, "-p", parentOid, "-m", message], { env: {
    GIT_AUTHOR_NAME: identity, GIT_AUTHOR_EMAIL: "agentops@local.invalid", GIT_COMMITTER_NAME: identity,
    GIT_COMMITTER_EMAIL: "agentops@local.invalid", GIT_AUTHOR_DATE: at, GIT_COMMITTER_DATE: at
  } }).stdout;
}
function treeWithBlobs(repo, baseOid, replacements) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "agentops-cutover-index-"));
  const index = path.join(temp, "index");
  try {
    const env = { GIT_INDEX_FILE: index };
    runGit(repo, ["read-tree", baseOid], { env });
    for (const [file, blob] of Object.entries(replacements)) runGit(repo, ["update-index", "--add", "--cacheinfo", `100644,${blob},${file}`], { env });
    return runGit(repo, ["write-tree"], { env }).stdout;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
function hashBlob(repo, raw) { return runGit(repo, ["hash-object", "-w", "--stdin"], { input: raw }).stdout; }
function snapshotHash(snapshot) { const copy = structuredClone(snapshot); delete copy.snapshot_hash; return objectSha256(stableJson(copy)); }
function artifactAt(repo, commit, descriptor, { requireSchema = true } = {}) {
  const entry = runGit(repo, ["ls-tree", commit, "--", descriptor.path]).stdout.trim().split(/\s+/);
  if (entry[2] !== descriptor.blob_oid) throw new Error(`artifact ${descriptor.path} Git blob binding mismatch at ${commit}`);
  const raw = runGit(repo, ["cat-file", "blob", descriptor.blob_oid]).rawStdout;
  if (objectSha256(raw) !== descriptor.sha256) throw new Error(`artifact ${descriptor.path} SHA-256 binding mismatch`);
  const parsed = JSON.parse(raw);
  if (requireSchema && parsed.schema !== descriptor.schema) throw new Error(`artifact ${descriptor.path} schema mismatch`);
  return parsed;
}
function assertProjection(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) throw new Error(`${label} missing semantic ${key}`);
    if (value && typeof value === "object" && !Array.isArray(value)) assertProjection(actual[key], value, `${label}.${key}`);
    else if (stableJson(actual[key]) !== stableJson(value)) throw new Error(`${label} semantic ${key} mismatch`);
  }
}

export function deriveCutoverObjects({ repo, request, authorityOid = "HEAD" }) {
  const binding = request.scheduler_cutover;
  if (!binding || request.action !== "authorize-scheduler-cutover") throw new Error("cutover derivation requires the exact scheduler-cutover request");
  const a = gitOid(repo, authorityOid);
  const d0 = binding.expected_development_remote_oid;
  if (gitOid(repo, `${a}^`) !== d0) throw new Error("authority A must be the sole direct child of D0");
  if (gitTree(repo, d0) !== binding.activation_manifest.template.development_d0.tree) throw new Error("D0 tree binding mismatch");
  if (gitTree(repo, binding.current_state.oid) !== binding.current_state.tree) throw new Error("S0 tree binding mismatch");
  if (gitTree(repo, binding.scheduler_head) !== binding.scheduler_tree) throw new Error("scheduler head/tree binding mismatch");
  const qaReceipt = artifactAt(repo, d0, binding.qa_receipt); assertProjection(qaReceipt, binding.qa_receipt.semantics, "QA receipt");
  if (qaReceipt.candidate.head !== binding.scheduler_head || qaReceipt.candidate.tree !== binding.scheduler_tree || qaReceipt.verifier.actor === qaReceipt.maker_actor) throw new Error("QA receipt candidate or independence binding mismatch");
  const projectReceipt = artifactAt(repo, d0, binding.project_schema_receipt); assertProjection(projectReceipt, binding.project_schema_receipt.semantics, "Project receipt");
  const projectManifest = artifactAt(repo, d0, binding.project_manifest); assertProjection(projectManifest, binding.project_manifest.semantics, "Project manifest");
  if (projectManifest.source_receipt_hash !== projectReceipt.receipt_hash || projectManifest.definitions_hash !== projectReceipt.definitions_hash) throw new Error("Project receipt/manifest linkage mismatch");
  const quietReceipt = artifactAt(repo, d0, binding.quiet_window_receipt); assertProjection(quietReceipt, binding.quiet_window_receipt.semantics, "quiet-window receipt");
  if (quietReceipt.source_state_oid !== binding.current_state.oid) throw new Error("quiet-window source state mismatch");
  artifactAt(repo, d0, binding.activation_manifest);
  const migrationEvent = artifactAt(repo, binding.migration.boundary_oid, binding.migration.state_migrated_event, { requireSchema: false });
  if (migrationEvent.event_version !== 2 || migrationEvent.event_type !== "STATE_MIGRATED" || migrationEvent.issue_id !== "scheduler-state" || migrationEvent.payload?.schema !== "agentops/scheduler-migration/v2") throw new Error("migration event semantic mismatch");
  const custody = artifactAt(repo, binding.current_state.oid, binding.current_state.released_custody);
  if (custody.machine_id !== null || custody.acquired_at !== null || !custody.released_at || custody.expires_at !== custody.released_at || custody.expected_state_ref_oid !== binding.current_state.oid) throw new Error("released custody semantic mismatch");
  const legacyActivation = artifactAt(repo, d0, binding.legacy_activation); assertProjection(legacyActivation, binding.legacy_activation.semantics, "legacy activation");
  const preConfig = artifactAt(repo, d0, binding.pre_cutover_config);
  for (const [key, expected] of Object.entries(binding.pre_cutover_config.semantics)) {
    const actual = key === "migration_dispatch_frozen" ? preConfig.migration?.dispatch_frozen : key === "scheduler_authorization_evidence" ? preConfig.cutover?.authorization_evidence : preConfig.cutover?.[key];
    if (actual !== expected) throw new Error(`pre-cutover config semantic ${key} mismatch`);
  }
  const manifestRaw = runGit(repo, ["cat-file", "blob", binding.activation_manifest.blob_oid]).rawStdout;
  if (stableJson(JSON.parse(manifestRaw)) !== stableJson(binding.activation_manifest.template)) throw new Error("activation manifest blob must deep-equal the inline template");
  const postRaw = runGit(repo, ["cat-file", "blob", binding.post_cutover_config.blob_oid]).rawStdout;
  if (objectSha256(postRaw) !== binding.post_cutover_config.sha256) throw new Error("post-cutover config SHA-256 mismatch");
  const postConfig = JSON.parse(postRaw);
  if (postConfig.schema !== binding.post_cutover_config.schema) throw new Error("post-cutover config schema mismatch");
  const template = binding.activation_manifest.template;
  if (template.development_d0.oid !== d0 || template.development_d0.tree !== gitTree(repo, d0) || template.state_s0.oid !== binding.current_state.oid || template.state_s0.tree !== binding.current_state.tree) throw new Error("activation template D0/S0 binding mismatch");
  if (template.development_d0.legacy_activation_blob_oid !== binding.legacy_activation.blob_oid || template.development_d0.pre_cutover_config_blob_oid !== binding.pre_cutover_config.blob_oid || template.development_d0.post_cutover_config_blob_oid !== binding.post_cutover_config.blob_oid) throw new Error("activation template repeated blob binding mismatch");
  const eventFiles = runGit(repo, ["diff-tree", "--no-commit-id", "--name-only", "-r", d0, a]).stdout.split(/\r?\n/).filter((name) => new RegExp(`^\\.agentops/events/${request.target}/[^/]+\\.json$`).test(name));
  if (eventFiles.length !== 1) throw new Error("A must contain exactly one canonical owner event for its target");
  const ownerEvent = JSON.parse(runGit(repo, ["show", `${a}:${eventFiles[0]}`]).stdout);
  if (ownerEvent.kind !== "owner-decision" || ownerEvent.actor !== "owner" || ownerEvent.decision?.action !== "authorize-scheduler-cutover") throw new Error("A owner event is not the exact cutover decision");
  const at = ownerEvent.at;
  if (Number.isNaN(Date.parse(at))) throw new Error("authority event timestamp is invalid");
  const snapshotRaw = runGit(repo, ["show", `${binding.current_state.oid}:snapshot.json`]).stdout;
  const snapshot = JSON.parse(snapshotRaw);
  const sequence = snapshot.last_sequence + 1;
  const eventId = `evt-cutover-${a.slice(0, 24)}`;
  const activationEvent = {
    event_version: 2, event_id: eventId, idempotency_key: `scheduler-activated:${a}:${binding.current_state.oid}`,
    sequence, previous_snapshot_hash: snapshot.snapshot_hash, issue_id: "scheduler-state", actor: "it-manager-iii",
    machine_id: null, lease_id: null, lease_epoch: null, event_type: "SCHEDULER_ACTIVATED",
    exact_object: { authority_oid: a, source_state_oid: binding.current_state.oid },
    payload: { schema: "agentops/scheduler-activation/v2", authority_event: { path: eventFiles[0], event_id: ownerEvent.id }, source_state_oid: binding.current_state.oid, source_state_tree: binding.current_state.tree },
    created_at: at
  };
  const eventPath = `journal/${String(sequence).padStart(8, "0")}-${eventId}.json`;
  const eventText = `${JSON.stringify(activationEvent, null, 2)}\n`;
  const eventBlob = hashBlob(repo, eventText);
  const nextSnapshot = structuredClone(snapshot); nextSnapshot.revision += 1; nextSnapshot.last_sequence = sequence; nextSnapshot.snapshot_hash = snapshotHash(nextSnapshot);
  const snapshotText = `${JSON.stringify(nextSnapshot, null, 2)}\n`;
  const snapshotBlob = hashBlob(repo, snapshotText);
  const s1Tree = treeWithBlobs(repo, binding.current_state.oid, { [eventPath]: eventBlob, "snapshot.json": snapshotBlob });
  const s1 = commitFromTree(repo, binding.current_state.oid, s1Tree, "AgentOps activate scheduler dispatch", at, "AshenSpire Scheduler");
  const d1Tree = treeWithBlobs(repo, a, { [binding.post_cutover_config.path]: binding.post_cutover_config.blob_oid });
  const d1 = commitFromTree(repo, a, d1Tree, "AgentOps enable scheduler dispatch", at, "AgentOps Owner Command");
  return {
    authorityA: { oid: a, tree: gitTree(repo, a) },
    stateS1: { oid: s1, tree: s1Tree, activation_event: { path: eventPath, blob_oid: eventBlob, sha256: objectSha256(eventText) } },
    developmentD1: { oid: d1, tree: d1Tree, scheduler_config: { path: binding.post_cutover_config.path, blob_oid: binding.post_cutover_config.blob_oid, sha256: binding.post_cutover_config.sha256 } }
  };
}

export function deriveProjectAuditInitialCommit({ repo, request, authorityOid = "HEAD", attemptedAt }) {
  const binding = request.project_schema_change;
  if (!binding || request.action !== "authorize-project-schema-change" || binding.expected_audit_remote_oid !== null) throw new Error("initial Project audit derivation requires exact absent-ref v2 authority");
  const authority = ownerEventAt(repo, request, authorityOid);
  const at = attemptedAt ?? authority.event.at;
  const capsulePath = `.agentops/work/${request.target}/CURRENT.json`;
  const parentCapsule = JSON.parse(runGit(repo, ["show", `${authority.parent}:${capsulePath}`]).stdout);
  const currentCapsule = JSON.parse(runGit(repo, ["show", `${authority.oid}:${capsulePath}`]).stdout);
  const attempt = {
    schema: "agentops/project-schema-attempt/v1", status: "ATTEMPTED",
    authority: { state_oid: authority.oid, event_path: authority.path, event_id: authority.event.id, event_hash: authority.eventHash, parent_oid: authority.parent, target_capsule_path: capsulePath, parent_capsule_hash: parentCapsule.current_hash, current_capsule_hash: currentCapsule.current_hash },
    executor: { head: binding.executor_head, tree: binding.executor_tree },
    project: { ...binding.project, updated_at: binding.project_updated_at }, definitions_hash: binding.definitions_hash,
    initial_preflight: binding.preflight, attempted_at: at
  };
  attempt.attempt_hash = objectSha256(stableJson(attempt));
  const relative = binding.audit_paths.attempt_path_template.replace("{attempt_id}", authority.eventHash);
  const blob = hashBlob(repo, `${stableJson(attempt)}\n`);
  const tree = treeWithBlobs(repo, authority.oid, { [relative]: blob });
  const oidValue = commitFromTree(repo, authority.oid, tree, `AgentOps consume Project schema authority ${authority.event.id}`, at, "AgentOps Project Audit");
  const changed = runGit(repo, ["diff-tree", "--no-commit-id", "--name-only", "-r", authority.oid, oidValue]).stdout.split(/\r?\n/).filter(Boolean);
  if (stableJson(changed) !== stableJson([relative])) throw new Error("initial Project audit commit must change only its exact attempt path");
  return { oid: oidValue, tree, path: relative, blob_oid: blob, attempt, authority };
}

function writePrivateJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
}

function persistRecoveryReceipt(file, value, identity) {
  if (!fs.existsSync(file)) {
    writePrivateJson(file, value);
    return value;
  }
  const prior = JSON.parse(fs.readFileSync(file, "utf8"));
  identity(prior, value);
  return prior;
}

function observedCutoverPublication({ repo, remote, binding, attemptedAt, atomicPushExitCode }) {
  const after = remoteRefs(repo, remote, [binding.state_target_ref, binding.development_ref]);
  return {
    publication: { mode: "git-push-atomic-two-ref-exact-leases", attempted_at: attemptedAt, atomic_push_exit_code: atomicPushExitCode },
    postinspection: { inspection_count: 1, retry_permitted: false, state_ref: binding.state_target_ref, state_actual_oid: after[binding.state_target_ref], development_ref: binding.development_ref, development_actual_oid: after[binding.development_ref] }
  };
}

export function executeProjectPublication({ repo, remote = "origin", request, authorityOid = "HEAD" }) {
  const consumed = consumeExactPacket({ repo, request, authorityOid });
  const initial = deriveProjectAuditInitialCommit({ repo, request, authorityOid: consumed.authority.oid, attemptedAt: consumed.record.consumed_at });
  const devRef = "refs/heads/dev"; const auditRef = request.project_schema_change.audit_ref;
  let devPushExitCode = null; let auditPushExitCode = null;
  if (!consumed.recovery) {
    assertPublicationFresh(request, "Project schema");
    const before = remoteRefs(repo, remote, [devRef, auditRef]);
    if (before[devRef] !== consumed.authority.parent || before[auditRef] !== null) throw new Error("Project schema publication CAS mismatch; no push attempted");
    assertPublicationFresh(request, "Project schema");
    const devPush = runGit(repo, ["push", `--force-with-lease=${devRef}:${consumed.authority.parent}`, remote, `${consumed.authority.oid}:${devRef}`], { allowFailure: true });
    devPushExitCode = devPush.status;
    const afterDev = remoteRefs(repo, remote, [devRef]);
    if (afterDev[devRef] === consumed.authority.oid) {
      assertPublicationFresh(request, "Project schema audit");
      const audit = createProjectAuditRefOnce({ repo, authorityOid: consumed.authority.oid, auditTargetOid: initial.oid, remote, auditRef, expiresAt: request.project_schema_change.expires_at });
      auditPushExitCode = audit.observation.publication.push_exit_code;
    }
  }
  const observed = remoteRefs(repo, remote, [devRef, auditRef]);
  const result = { schema: "agentops/project-schema-consumption-result/v1", authority_oid: consumed.authority.oid, tombstone_ref: consumed.ref, recovered: consumed.recovery, publication: { development_ref: devRef, development_push_exit_code: devPushExitCode, audit_ref: auditRef, audit_push_exit_code: auditPushExitCode }, initial_audit: { oid: initial.oid, tree: initial.tree, path: initial.path, blob_oid: initial.blob_oid }, postinspection: { inspection_count: 1, retry_permitted: false, development_actual_oid: observed[devRef], audit_actual_oid: observed[auditRef] } };
  const output = path.join(repo, ".git", "agentops-project-schema", "consumption-result.json");
  persistRecoveryReceipt(output, result, (prior, current) => {
    if (prior.schema !== current.schema || prior.authority_oid !== current.authority_oid || prior.tombstone_ref !== current.tombstone_ref || stableJson(prior.initial_audit) !== stableJson(current.initial_audit) || prior.postinspection?.retry_permitted !== false) throw new Error("existing Project consumption receipt does not bind the recovered exact packet");
  });
  const ok = observed[devRef] === consumed.authority.oid && observed[auditRef] === initial.oid;
  return { ok, result, consumed, initial };
}

export function executeAuthorityPublication({ repo, remote = "origin", request, authorityOid = "HEAD", now = () => new Date() }) {
  assertPublicationFresh(request, request.action, now());
  const authority = ownerEventAt(repo, request, authorityOid);
  const devRef = "refs/heads/dev";
  const before = remoteRefs(repo, remote, [devRef]);
  if (before[devRef] !== authority.parent) throw new Error("authority publication CAS mismatch; no push attempted");
  assertPublicationFresh(request, request.action, now());
  const push = runGit(repo, ["push", `--force-with-lease=${devRef}:${authority.parent}`, remote, `${authority.oid}:${devRef}`], { allowFailure: true });
  const after = remoteRefs(repo, remote, [devRef]);
  return { ok: after[devRef] === authority.oid, authority, observation: { publication: { push_exit_code: push.status }, postinspection: { inspection_count: 1, retry_permitted: false, development_ref: devRef, development_actual_oid: after[devRef] } } };
}

function executeSpecial(argv) {
  const requestFile = option(argv, "--request-file", { required: true });
  const repo = option(argv, "--repo") ?? process.cwd();
  const remote = option(argv, "--remote") ?? "origin";
  const request = JSON.parse(fs.readFileSync(requestFile, "utf8"));
  if (argv.includes("--execute-cutover")) {
    const consumed = consumeExactPacket({ repo, request });
    const objects = deriveCutoverObjects({ repo, request });
    const binding = request.scheduler_cutover;
    let facts;
    if (consumed.recovery) facts = observedCutoverPublication({ repo, remote, binding, attemptedAt: consumed.record.consumed_at, atomicPushExitCode: null });
    else {
      assertPublicationFresh(request, "scheduler cutover");
      const published = atomicPublishExactRefs({ repo, remote, stateRef: binding.state_target_ref, expectedStateOid: binding.expected_state_remote_oid, stateTargetOid: objects.stateS1.oid, developmentRef: binding.development_ref, expectedDevelopmentOid: binding.expected_development_remote_oid, developmentTargetOid: objects.developmentD1.oid, attemptedAt: consumed.record.consumed_at, expiresAt: binding.expires_at });
      facts = { publication: { ...published.receipt }, postinspection: published.receipt.postinspection }; delete facts.publication.postinspection;
    }
    const receipt = { schema: "agentops/scheduler-cutover-result/v1", authority_a: objects.authorityA, state_s1: objects.stateS1, development_d1: objects.developmentD1, publication: facts.publication, postinspection: facts.postinspection };
    const receiptPath = path.join(repo, binding.result_receipt_contract.path);
    persistRecoveryReceipt(receiptPath, receipt, (prior, current) => {
      if (prior.schema !== current.schema || stableJson(prior.authority_a) !== stableJson(current.authority_a) || stableJson(prior.state_s1) !== stableJson(current.state_s1) || stableJson(prior.development_d1) !== stableJson(current.development_d1) || prior.postinspection?.retry_permitted !== false) throw new Error("existing cutover receipt does not bind the recovered exact packet");
    });
    const ok = facts.postinspection.state_actual_oid === objects.stateS1.oid && facts.postinspection.development_actual_oid === objects.developmentD1.oid;
    console.log(JSON.stringify({ ok, recovered: consumed.recovery, authority_a: objects.authorityA.oid, state_s1: objects.stateS1.oid, development_d1: objects.developmentD1.oid }));
    if (!ok) process.exitCode = 1;
    return;
  }
  if (argv.includes("--execute-project")) {
    const published = executeProjectPublication({ repo, remote, request });
    console.log(JSON.stringify({ ok: published.ok, recovered: published.consumed.recovery, authority_a: published.consumed.authority.oid, audit_oid: published.initial.oid }));
    if (!published.ok) process.exitCode = 1;
    return;
  }
  if (argv.includes("--execute-authority")) {
    const published = executeAuthorityPublication({ repo, remote, request });
    console.log(JSON.stringify({ ok: published.ok, authority_a: published.authority.oid }));
    if (!published.ok) process.exitCode = 1;
    return;
  }
  throw new Error("missing special execution mode");
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
  if (argv.includes("--execute-cutover") || argv.includes("--execute-project") || argv.includes("--execute-authority")) return executeSpecial(argv);
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
