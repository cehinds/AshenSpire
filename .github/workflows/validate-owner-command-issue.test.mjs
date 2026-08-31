import assert from "node:assert/strict";
import fs from "node:fs";
import { validateOwnerCommandIssue } from "./validate-owner-command-issue.mjs";

const workflow = fs.readFileSync(".github/workflows/owner-command.yml", "utf8");
const parser = fs.readFileSync(".github/workflows/validate-owner-command-issue.mjs", "utf8");
const NOW = new Date("2026-08-31T16:00:00Z");
const OID_A = "a".repeat(40);
const OID_B = "b".repeat(40);
const OID_C = "c".repeat(40);
const OID_D = "d".repeat(40);
const OID_E = "e".repeat(40);
const OID_F = "f".repeat(40);
const HASH_A = "1".repeat(64);
const HASH_B = "2".repeat(64);

const HEADINGS = [
  "Owner-command form",
  "Action",
  "Target ticket",
  "Expected current hash",
  "Candidate OID",
  "Scheduler HEAD",
  "Scheduler tree",
  "Source state OID",
  "Source state tree",
  "Source snapshot SHA-256",
  "Source journal manifest SHA-256",
  "Source event count",
  "Source state version",
  "Target state version",
  "Canonical anchor OID",
  "Preserved local tip OID",
  "Dispatch frozen",
  "One use",
  "Expires at",
  "Target ref",
  "Expected remote OID",
  "Push mode",
  "Abort on remote change",
  "Reason"
];

const migrationValues = Object.freeze({
  "Owner-command form": "owner-decision/v1",
  "Action": "authorize-scheduler-migration",
  "Target ticket": "AS-1001",
  "Expected current hash": `sha256:${HASH_A}`,
  "Candidate OID": OID_A,
  "Scheduler HEAD": OID_A,
  "Scheduler tree": OID_B,
  "Source state OID": OID_C,
  "Source state tree": OID_D,
  "Source snapshot SHA-256": HASH_A,
  "Source journal manifest SHA-256": HASH_B,
  "Source event count": "27",
  "Source state version": "1",
  "Target state version": "2",
  "Canonical anchor OID": OID_E,
  "Preserved local tip OID": OID_F,
  "Dispatch frozen": "true",
  "One use": "true",
  "Expires at": "2026-09-01T15:10:17.123Z",
  "Target ref": "refs/heads/agentops/scheduler-state",
  "Expected remote OID": OID_C,
  "Push mode": "non-force-forward-only-cas",
  "Abort on remote change": "true",
  "Reason": "_No response_"
});

function renderBody(values = migrationValues, headings = HEADINGS) {
  return `${headings.map((heading) => `### ${heading}\n\n${values[heading] ?? "_No response_"}`).join("\n\n")}\n`;
}

function validate(values = migrationValues, options = {}) {
  return validateOwnerCommandIssue({
    title: options.title ?? "[decision] AS-1001",
    body: options.body ?? renderBody(values),
    actor: options.actor ?? "owner",
    now: options.now ?? NOW
  });
}

let checks = 0;
function check(condition, message) {
  checks += 1;
  assert.equal(Boolean(condition), true, message);
}

check(/types:\s*\[opened\]/.test(workflow), "workflow must run on opened issues");
check(!/types:\s*\[[^\]]*edited/.test(workflow), "edited issues must not replay a command");
check(/startsWith\(github\.event\.issue\.title, '\[decision\] '\)/.test(workflow), "workflow must keep the title gate");
check(/validate-owner-command-issue\.mjs/.test(workflow), "workflow must use the strict parser");
check(/--request-file \/tmp\/owner-command-request\.json/.test(workflow), "parser must emit an exact request file");
check((workflow.match(/--file \/tmp\/owner-command-request\.json/g) ?? []).length === 2, "dry-run and apply must use the same request file");
check(!/--issue-file/.test(workflow), "opsctl must not reparse the free-form issue body");
check(!/record-owner-override/.test(workflow), "migration transport must not reuse owner override");
check(/umask 077/.test(workflow) && /install -m 600 \/dev\/null \/tmp\/issue-body\.md/.test(workflow), "untrusted issue body must use a mode-0600 temporary file");
check(/mode: 0o600/.test(parser), "parsed request must be created mode 0600");
check(!/projects:\s*write/.test(workflow), "generic owner-command workflow must not receive Project write permission");
check(!/createProjectV2Field|gh project/.test(workflow), "Project mutation must remain a separate executor after authority recording");

const accepted = validate();
check(accepted.ok, accepted.errors.join(" | "));
assert.deepEqual(accepted.request, {
  schema: "agentops/owner-command-request/v1",
  actor: "owner",
  action: "authorize-scheduler-migration",
  target: "AS-1001",
  expected_current_hash: `sha256:${HASH_A}`,
  candidate_oid: OID_A,
  scheduler_migration: {
    scheduler_head: OID_A,
    scheduler_tree: OID_B,
    source_state_oid: OID_C,
    source_state_tree: OID_D,
    source_snapshot_sha256: HASH_A,
    source_journal_manifest_sha256: HASH_B,
    source_event_count: 27,
    source_state_version: 1,
    target_state_version: 2,
    canonical_anchor_oid: OID_E,
    preserved_local_tip_oid: OID_F,
    dispatch_frozen: true,
    one_use: true,
    expires_at: "2026-09-01T15:10:17.123Z",
    target_ref: "refs/heads/agentops/scheduler-state",
    expected_remote_oid: OID_C,
    push_mode: "non-force-forward-only-cas",
    abort_on_remote_change: true
  }
});
checks += 1;

check(!validate(migrationValues, { title: "ordinary ticket" }).ok, "ordinary title must fail");
check(!validate({ ...migrationValues, "Owner-command form": "owner-decision/v0" }).ok, "wrong marker must fail");
check(!validate({ ...migrationValues, "Owner-command form": "owner-decision/v1\nforged" }).ok, "marker extra text must fail");
check(!validate(migrationValues, { body: `preamble\n\n${renderBody()}` }).ok, "preamble must fail");
check(!validate(migrationValues, { body: renderBody(migrationValues, HEADINGS.slice(0, -1)) }).ok, "missing heading must fail");
check(!validate(migrationValues, { body: `${renderBody()}\n### Extra\n\nNo.\n` }).ok, "extra heading must fail");
check(!validate({ ...migrationValues, "Reason": "please migrate it" }).ok, "free-form reason must fail");
check(!validate(migrationValues, { actor: "it-manager-iii" }).ok, "deputy must not authorize migration");
check(!validateOwnerCommandIssue({ title: "[decision] AS-1001", body: renderBody(), now: NOW }).ok, "actor must never default from the issue body");
check(!validate({ ...migrationValues, "Candidate OID": OID_B }).ok, "candidate must equal scheduler head");
check(!validate({ ...migrationValues, "Expected remote OID": OID_D }).ok, "source state must equal expected remote");
check(!validate({ ...migrationValues, "Expires at": "2026-08-31T16:00:00Z" }).ok, "expired command must fail");
check(!validate({ ...migrationValues, "Expires at": "2026-02-31T12:00:00Z" }).ok, "invalid calendar timestamp must fail");
check(!validate({ ...migrationValues, "Expected current hash": HASH_A }).ok, "CAS hash without algorithm must fail");
check(!validate({ ...migrationValues, "Candidate OID": OID_A.toUpperCase(), "Scheduler HEAD": OID_A.toUpperCase() }).ok, "uppercase OIDs must fail");
check(!validate({ ...migrationValues, "Target ref": "agentops/scheduler-state" }).ok, "short target ref must fail");
check(!validate({ ...migrationValues, "Push mode": "force" }).ok, "force mode must fail");
check(!validate({ ...migrationValues, "Dispatch frozen": "false" }).ok, "unfrozen dispatch must fail");
check(!validate({ ...migrationValues, "One use": "false" }).ok, "reusable authority must fail");
check(!validate({ ...migrationValues, "Abort on remote change": "false" }).ok, "remote-change continuation must fail");
check(!validate({ ...migrationValues, "Source state version": "2" }).ok, "wrong source version must fail");
check(!validate({ ...migrationValues, "Target state version": "1" }).ok, "wrong target version must fail");
check(!validate({ ...migrationValues, "Source event count": "01" }).ok, "non-canonical event count must fail");
check(!validate({ ...migrationValues, "Source event count": "-1" }).ok, "negative event count must fail");
check(!validate({ ...migrationValues, "Source event count": "9007199254740992" }).ok, "unsafe event count must fail");
check(!validate({ ...migrationValues, "Scheduler tree": `${OID_B}\nextra` }).ok, "multi-line structured field must fail");

for (const heading of Object.keys(migrationValues).filter((heading) => !["Owner-command form", "Action", "Target ticket", "Reason"].includes(heading))) {
  check(!validate({ ...migrationValues, [heading]: "_No response_" }).ok, `missing ${heading} must fail`);
}

for (const heading of [
  "Scheduler HEAD",
  "Scheduler tree",
  "Source state OID",
  "Source state tree",
  "Canonical anchor OID",
  "Preserved local tip OID",
  "Expected remote OID"
]) {
  check(!validate({ ...migrationValues, [heading]: "0".repeat(39) }).ok, `malformed ${heading} must fail`);
}

for (const heading of ["Source snapshot SHA-256", "Source journal manifest SHA-256"]) {
  check(!validate({ ...migrationValues, [heading]: "0".repeat(63) }).ok, `malformed ${heading} must fail`);
}

const approveValues = Object.fromEntries(HEADINGS.map((heading) => [heading, "_No response_"]));
Object.assign(approveValues, {
  "Owner-command form": "owner-decision/v1",
  "Action": "approve",
  "Target ticket": "AS-1001",
  "Expected current hash": `sha256:${HASH_A}`,
  "Candidate OID": OID_A
});
check(validate(approveValues).ok, "existing structured actions must remain accepted");
check(!validate({ ...approveValues, "Scheduler HEAD": OID_A }).ok, "migration fields on another action must fail");
check(validate({ ...approveValues, "Action": "prioritize", "Expected current hash": "_No response_", "Candidate OID": "_No response_" }).ok, "legacy actions without exact-object bindings must remain accepted");

const COMMON = ["Request schema", "Action", "Target ticket", "Expected current hash", "Candidate OID"];
const PROJECT_HEADINGS = [
  ...COMMON, "Executor head", "Executor tree", "Project owner", "Project owner type", "Project number", "Project ID",
  "Project title", "Project closed", "Authenticated login", "Required scope", "Project updated at",
  "Preflight field count", "Field state root", "Preflight item count", "Preflight field value count",
  "Item state root", "Pagination manifest hash", "Priority field ID", "Priority contract hash", "Definitions hash",
  "Mode", "Allowed mutation", "Forbid item mutation", "Forbid existing field update", "Forbid backfill",
  "Abort on any drift", "Retry mode", "One use", "Expires at"
];
const RECONCILIATION_HEADINGS = [
  ...COMMON, "Reconciler head", "Reconciler tree", "Source state OID", "Source state tree",
  "Source snapshot SHA-256", "Source journal manifest SHA-256", "Source event count", "Source state version",
  "Canonical anchor OID", "Target state OID", "Target state tree", "Target snapshot SHA-256",
  "Target journal manifest SHA-256", "Target event count", "Machine lease", "Work leases", "Mode", "Not before",
  "Quiet window receipt hash", "Expected event count delta", "Dispatch frozen", "No refill", "No assignment",
  "No dispatch", "No external mutation", "One use", "Expires at", "Target ref", "Expected remote OID", "Push mode",
  "Abort on remote change"
];
const CUTOVER_HEADINGS = [
  ...COMMON, "Scheduler head", "Scheduler tree", "QA receipt hash", "Migration boundary OID",
  "State migrated event hash", "Current state OID", "Current state tree", "Project schema receipt hash",
  "Project manifest hash", "Quiet window receipt hash", "Released custody hash", "Active work lease count",
  "Legacy activation blob OID", "Pre-cutover config blob OID", "Activation manifest hash", "State target ref",
  "Expected state remote OID", "Development ref", "Expected development remote OID", "One use", "Expires at",
  "Push mode", "Abort on remote change"
];

function renderProfile(values, headings) {
  return `${headings.map((heading) => `### ${heading}\n\n${values[heading] ?? "_No response_"}`).join("\n\n")}\n`;
}
function validateProfile(values, headings, options = {}) {
  return validateOwnerCommandIssue({
    title: options.title ?? "[decision] AS-1001",
    body: options.body ?? renderProfile(values, headings),
    actor: options.actor ?? "owner",
    now: options.now ?? NOW
  });
}

const projectValues = Object.freeze({
  "Request schema": "agentops/project-schema-change-authority/v1",
  "Action": "authorize-project-schema-change", "Target ticket": "AS-1001",
  "Expected current hash": `sha256:${HASH_A}`, "Candidate OID": OID_A,
  "Executor head": OID_A, "Executor tree": OID_B, "Project owner": "cehinds", "Project owner type": "user",
  "Project number": "4", "Project ID": "PVT_kwHOCSCyJ84BgfH9", "Project title": "Family Delivery",
  "Project closed": "false", "Authenticated login": "cehinds", "Required scope": "project",
  "Project updated at": "2026-08-31T15:57:21.1234567Z", "Preflight field count": "21",
  "Field state root": HASH_A, "Preflight item count": "155", "Preflight field value count": "412",
  "Item state root": HASH_B, "Pagination manifest hash": "3".repeat(64),
  "Priority field ID": "PVTSSF_lAHOCSCyJ84BgfH9zhfelc4", "Priority contract hash": "4".repeat(64),
  "Definitions hash": "5".repeat(64), "Mode": "create-missing-only", "Allowed mutation": "createProjectV2Field",
  "Forbid item mutation": "true", "Forbid existing field update": "true", "Forbid backfill": "true",
  "Abort on any drift": "true", "Retry mode": "never", "One use": "true", "Expires at": "2026-09-01T15:10:17.1234567Z"
});

const machineLease = {
  acquired_at: "2026-08-31T16:01:00.1234567Z", expected_state_ref_oid: OID_C,
  expires_at: "2026-08-31T16:20:00.1234567Z", lease_epoch: 7,
  machine_id: "e43d6cf5-cac8-4084-a747-b5e2d21aeb72", released_at: null
};
const workLease2 = {
  assigned_actor: "seat:codex:two", assignment_kind: "maker", base_commit: OID_A, issue_id: "2", lease_epoch: 1,
  lease_expiry: "2026-08-31T16:30:00.1234567Z", lease_id: "lease:2:1", lease_machine_id: machineLease.machine_id,
  state: "RUNNING"
};
const workLease10 = {
  assigned_actor: "seat:codex:ten", assignment_kind: "qa", base_commit: OID_B, issue_id: "10", lease_epoch: 2,
  lease_expiry: "2026-08-31T16:45:00Z", lease_id: "lease:10:2", lease_machine_id: machineLease.machine_id,
  state: "QA_REVIEW"
};
const reconciliationValues = Object.freeze({
  "Request schema": "agentops/scheduler-state-reconciliation-authority/v1",
  "Action": "authorize-scheduler-state-reconciliation", "Target ticket": "AS-1001",
  "Expected current hash": `sha256:${HASH_A}`, "Candidate OID": OID_A,
  "Reconciler head": OID_A, "Reconciler tree": OID_B, "Source state OID": OID_C, "Source state tree": OID_D,
  "Source snapshot SHA-256": HASH_A, "Source journal manifest SHA-256": HASH_B, "Source event count": "27",
  "Source state version": "1", "Canonical anchor OID": OID_E, "Target state OID": OID_F,
  "Target state tree": OID_A, "Target snapshot SHA-256": "3".repeat(64),
  "Target journal manifest SHA-256": "4".repeat(64), "Target event count": "30",
  "Machine lease": JSON.stringify(machineLease), "Work leases": JSON.stringify([workLease2, workLease10]),
  "Mode": "expire-all-and-release-expired-custody", "Not before": "2026-08-31T17:00:00.1234567Z",
  "Quiet window receipt hash": "5".repeat(64), "Expected event count delta": "3", "Dispatch frozen": "true",
  "No refill": "true", "No assignment": "true", "No dispatch": "true", "No external mutation": "true",
  "One use": "true", "Expires at": "2026-09-01T15:10:17.1234567Z",
  "Target ref": "refs/heads/agentops/scheduler-state", "Expected remote OID": OID_C,
  "Push mode": "non-force-forward-only-cas", "Abort on remote change": "true"
});
const cutoverValues = Object.freeze({
  "Request schema": "agentops/scheduler-cutover-authority/v1", "Action": "authorize-scheduler-cutover",
  "Target ticket": "AS-1001", "Expected current hash": `sha256:${HASH_A}`, "Candidate OID": OID_A,
  "Scheduler head": OID_A, "Scheduler tree": OID_B, "QA receipt hash": HASH_A, "Migration boundary OID": OID_C,
  "State migrated event hash": HASH_B, "Current state OID": OID_D, "Current state tree": OID_E,
  "Project schema receipt hash": "3".repeat(64), "Project manifest hash": "4".repeat(64),
  "Quiet window receipt hash": "5".repeat(64), "Released custody hash": "6".repeat(64),
  "Active work lease count": "0", "Legacy activation blob OID": OID_F, "Pre-cutover config blob OID": OID_B,
  "Activation manifest hash": "7".repeat(64), "State target ref": "refs/heads/agentops/scheduler-state",
  "Expected state remote OID": OID_D, "Development ref": "refs/heads/dev", "Expected development remote OID": OID_E,
  "One use": "true", "Expires at": "2026-09-01T15:10:17.1234567Z",
  "Push mode": "non-force-forward-only-cas", "Abort on remote change": "true"
});

const acceptedProject = validateProfile(projectValues, PROJECT_HEADINGS);
check(acceptedProject.ok, acceptedProject.errors.join(" | "));
assert.deepEqual(Object.keys(acceptedProject.request.project_schema_change), [
  "schema", "executor_head", "executor_tree", "project", "authenticated_login", "required_scope", "project_updated_at",
  "preflight", "definitions_hash", "mode", "allowed_mutation", "forbid_item_mutation", "forbid_existing_field_update",
  "forbid_backfill", "abort_on_any_drift", "retry_mode", "one_use", "expires_at"
]);
checks += 1;
assert.deepEqual(acceptedProject.request.project_schema_change.project, {
  owner: "cehinds", owner_type: "user", number: 4, id: "PVT_kwHOCSCyJ84BgfH9", title: "Family Delivery", closed: false
});
checks += 1;
assert.deepEqual(Object.keys(acceptedProject.request.project_schema_change.preflight), [
  "field_count", "field_state_root", "item_count", "field_value_count", "item_state_root", "pagination_manifest_hash",
  "priority_field_id", "priority_contract_hash"
]);
checks += 1;

const acceptedReconciliation = validateProfile(reconciliationValues, RECONCILIATION_HEADINGS);
check(acceptedReconciliation.ok, acceptedReconciliation.errors.join(" | "));
assert.deepEqual(Object.keys(acceptedReconciliation.request.scheduler_state_reconciliation), [
  "schema", "reconciler_head", "reconciler_tree", "source", "target", "canonical_anchor_oid", "machine_lease",
  "work_leases", "mode", "not_before", "quiet_window_receipt_hash", "expected_event_count_delta", "dispatch_frozen",
  "no_refill", "no_assignment", "no_dispatch", "no_external_mutation", "one_use", "expires_at", "target_ref",
  "expected_remote_oid", "push_mode", "abort_on_remote_change"
]);
checks += 1;
assert.deepEqual(acceptedReconciliation.request.scheduler_state_reconciliation.machine_lease, machineLease);
checks += 1;
assert.deepEqual(acceptedReconciliation.request.scheduler_state_reconciliation.work_leases, [workLease2, workLease10]);
checks += 1;

const acceptedCutover = validateProfile(cutoverValues, CUTOVER_HEADINGS);
check(acceptedCutover.ok, acceptedCutover.errors.join(" | "));
assert.deepEqual(Object.keys(acceptedCutover.request.scheduler_cutover), [
  "schema", "scheduler_head", "scheduler_tree", "qa_receipt_hash", "migration", "current_state",
  "project_schema_receipt_hash", "project_manifest_hash", "quiet_window_receipt_hash", "released_custody_hash",
  "active_work_lease_count", "legacy_activation_blob_oid", "pre_cutover_config_blob_oid", "activation_manifest_hash",
  "state_target_ref", "expected_state_remote_oid", "development_ref", "expected_development_remote_oid", "one_use",
  "expires_at", "push_mode", "abort_on_remote_change"
]);
checks += 1;
assert.deepEqual(acceptedCutover.request.scheduler_cutover.migration, { boundary_oid: OID_C, state_migrated_event_hash: HASH_B });
checks += 1;
assert.deepEqual(acceptedCutover.request.scheduler_cutover.current_state, { oid: OID_D, tree: OID_E });
checks += 1;

for (const [name, values, headings] of [
  ["project", projectValues, PROJECT_HEADINGS],
  ["reconciliation", reconciliationValues, RECONCILIATION_HEADINGS],
  ["cutover", cutoverValues, CUTOVER_HEADINGS]
]) {
  const reordered = [...headings];
  [reordered[6], reordered[7]] = [reordered[7], reordered[6]];
  check(!validateProfile(values, headings, { body: renderProfile(values, reordered) }).ok, `${name} reordered headings must fail`);
  check(!validateProfile(values, headings, { body: renderProfile(values, headings.slice(0, -1)) }).ok, `${name} missing heading must fail`);
  check(!validateProfile(values, headings, { body: `${renderProfile(values, headings)}\n### Reason\n\nforged\n` }).ok, `${name} extra/free-form heading must fail`);
  check(!validateProfile({ ...values, [headings[5]]: `${values[headings[5]]}\nforged` }, headings).ok, `${name} multiline injection must fail`);
  check(!validateProfile({ ...values, "Request schema": `${values["Request schema"]}-wrong` }, headings).ok, `${name} wrong marker must fail`);
  check(!validateProfile({ ...values, "Action": "approve" }, headings).ok, `${name} wrong action must fail`);
  check(!validateProfile(values, headings, { actor: "it-manager-iii" }).ok, `${name} deputy use must fail`);
  check(!validateProfile({ ...values, "Expected current hash": HASH_A }, headings).ok, `${name} malformed CAS hash must fail`);
  check(!validateProfile({ ...values, "Candidate OID": "a".repeat(39) }, headings).ok, `${name} malformed candidate OID must fail`);
  check(!validateProfile({ ...values, "Expires at": "2026-02-31T12:00:00Z" }, headings).ok, `${name} malformed timestamp must fail`);
  check(!validateProfile(values, headings, { body: `${renderProfile(values, headings)}\n### Params\n\n{}\n` }).ok, `${name} params heading must fail`);
  for (const heading of headings) check(!validateProfile({ ...values, [heading]: "_No response_" }, headings).ok, `${name} missing ${heading} must fail`);
}

check(!validateProfile({ ...projectValues, "Executor head": OID_B }, PROJECT_HEADINGS).ok, "project candidate/executor mismatch must fail");
check(!validateProfile({ ...projectValues, "Required scope": "project-write" }, PROJECT_HEADINGS).ok, "Project authority must bind actual gh project scope");
check(!validateProfile({ ...projectValues, "Project number": "5" }, PROJECT_HEADINGS).ok, "wrong Project number must fail");
check(!validateProfile({ ...projectValues, "Preflight item count": "154" }, PROJECT_HEADINGS).ok, "wrong preflight item count must fail");
check(!validateProfile({ ...projectValues, "Definitions hash": "a".repeat(63) }, PROJECT_HEADINGS).ok, "malformed definitions hash must fail");
check(!validateProfile({ ...projectValues, "Retry mode": "retry" }, PROJECT_HEADINGS).ok, "retryable Project authority must fail");

check(!validateProfile({ ...reconciliationValues, "Reconciler head": OID_B }, RECONCILIATION_HEADINGS).ok, "reconciliation candidate/head mismatch must fail");
check(!validateProfile({ ...reconciliationValues, "Expected remote OID": OID_D }, RECONCILIATION_HEADINGS).ok, "reconciliation source/remote mismatch must fail");
check(!validateProfile({ ...reconciliationValues, "Target event count": "29" }, RECONCILIATION_HEADINGS).ok, "reconciliation event-count mismatch must fail");
check(!validateProfile({ ...reconciliationValues, "Not before": "2026-08-31T16:40:00Z" }, RECONCILIATION_HEADINGS).ok, "not-before preceding a work expiry must fail");
check(!validateProfile({ ...reconciliationValues, "Machine lease": JSON.stringify({ ...machineLease, unexpected: true }) }, RECONCILIATION_HEADINGS).ok, "machine lease nested extras must fail");
check(!validateProfile({ ...reconciliationValues, "Machine lease": JSON.stringify({ ...machineLease, expected_state_ref_oid: "d".repeat(39) }) }, RECONCILIATION_HEADINGS).ok, "malformed machine lease expected-state OID must fail");
check(!validateProfile({ ...reconciliationValues, "Machine lease": JSON.stringify(machineLease, null, 1) }, RECONCILIATION_HEADINGS).ok, "noncanonical machine lease JSON must fail");
check(!validateProfile({ ...reconciliationValues, "Work leases": JSON.stringify([workLease10, workLease2]) }, RECONCILIATION_HEADINGS).ok, "noncanonical work lease order must fail");
check(!validateProfile({ ...reconciliationValues, "Work leases": JSON.stringify([workLease2, workLease2]) }, RECONCILIATION_HEADINGS).ok, "duplicate work lease must fail");
check(!validateProfile({ ...reconciliationValues, "Work leases": JSON.stringify([{ ...workLease2, injected: true }, workLease10]) }, RECONCILIATION_HEADINGS).ok, "work lease nested extras must fail");
check(!validateProfile({ ...reconciliationValues, "No refill": "false" }, RECONCILIATION_HEADINGS).ok, "reconciliation refill must remain forbidden");

check(!validateProfile({ ...cutoverValues, "Scheduler head": OID_B }, CUTOVER_HEADINGS).ok, "cutover candidate/head mismatch must fail");
check(!validateProfile({ ...cutoverValues, "Expected state remote OID": OID_C }, CUTOVER_HEADINGS).ok, "cutover current-state/remote mismatch must fail");
check(!validateProfile({ ...cutoverValues, "Active work lease count": "1" }, CUTOVER_HEADINGS).ok, "cutover with an active work lease must fail");
check(!validateProfile({ ...cutoverValues, "State target ref": "refs/heads/dev" }, CUTOVER_HEADINGS).ok, "wrong cutover state ref must fail");
check(!validateProfile({ ...cutoverValues, "Development ref": "refs/heads/main" }, CUTOVER_HEADINGS).ok, "wrong cutover development ref must fail");
check(!validateProfile({ ...cutoverValues, "Abort on remote change": "false" }, CUTOVER_HEADINGS).ok, "cutover must abort on remote change");

console.log(`PASS ${checks}/${checks}; opened-only=yes; four-exact-authority-profiles=yes; owner-exclusive=yes; cas-transport=yes; canonical-json=yes; free-form=no; edited-reexecution=no`);
