import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { atomicPublishExactRefs, consumeExactPacket, createProjectAuditRefOnce, executeAuthorityPublication, executeProjectPublication, validateOwnerCommandIssue } from "./validate-owner-command-issue.mjs";

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
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

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
check(/--execute-cutover/.test(workflow) && /authorize-scheduler-cutover/.test(workflow), "cutover must use its special local derivation and atomic publication path");
check(/if \[ "\$ACTION" = "authorize-scheduler-cutover" \]/.test(workflow), "generic dev publication must be excluded for cutover");
check(/--execute-project/.test(workflow) && /authorize-project-schema-change/.test(workflow), "Project authority must initialize its dedicated audit ref rather than fall through to dev-only publication");
check(/--execute-authority/.test(workflow) && !/git push origin HEAD:dev/.test(workflow), "remaining owner authorities must recheck expiry and use exact-lease dev publication");
check(!/cp \.agentops\/generated\/hud/.test(workflow), "workflow must rely on deterministic render outputs rather than a hand-copied HUD");
check(/"push", "--atomic"/.test(parser) && (parser.match(/--force-with-lease=/g) ?? []).length >= 2, "cutover transport must be one atomic two-ref exact-lease push");

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
  "Abort on any drift", "Retry mode", "One use", "Expires at", "Audit ref", "Expected audit remote OID",
  "Audit push mode", "Journal mode", "Recovery mode", "Audit paths", "Audit guards", "Audit result contract"
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
  ...COMMON, "Scheduler head", "Scheduler tree", "QA receipt", "Migration", "Current state",
  "Project schema receipt", "Project manifest", "Quiet window receipt", "Active work lease count",
  "Legacy activation", "Pre-cutover config", "Post-cutover config", "Activation manifest",
  "Result receipt contract", "State target ref", "Expected state remote OID",
  "Development ref", "Expected development remote OID", "Publication mode", "Ambiguity policy",
  "Postcondition policy", "One use", "Expires at", "Push mode", "Abort on remote change"
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
  "Request schema": "agentops/project-schema-change-authority/v2",
  "Action": "authorize-project-schema-change", "Target ticket": "AS-1001",
  "Expected current hash": `sha256:${HASH_A}`, "Candidate OID": OID_A,
  "Executor head": OID_A, "Executor tree": OID_B, "Project owner": "cehinds", "Project owner type": "user",
  "Project number": "4", "Project ID": "PVT_kwHOCSCyJ84BgfH9", "Project title": "Family Delivery",
  "Project closed": "false", "Authenticated login": "cehinds", "Required scope": "project",
  "Project updated at": "2026-08-31T15:57:21.1234567Z", "Preflight field count": "21",
  "Field state root": HASH_A, "Preflight item count": "155", "Preflight field value count": "412",
  "Item state root": HASH_B, "Pagination manifest hash": "3".repeat(64),
  "Priority field ID": "PVTSSF_lAHOCSCyJ84BgfH9zhfelc4", "Priority contract hash": "4".repeat(64),
  "Definitions hash": "5".repeat(64), "Mode": "create-missing-only", "Allowed mutation": "project-field-create",
  "Forbid item mutation": "true", "Forbid existing field update": "true", "Forbid backfill": "true",
  "Abort on any drift": "true", "Retry mode": "never", "One use": "true", "Expires at": "2026-09-01T15:10:17.1234567Z",
  "Audit ref": "refs/heads/agentops/project-schema-audit", "Expected audit remote OID": "null",
  "Audit push mode": "create-if-absent-then-non-force-forward-only-cas", "Journal mode": "append-only-intent-result",
  "Recovery mode": "inspect-once-never-create",
  "Audit paths": canonical({ root: ".agentops/scheduler/project-schema-attempts", journal_path: ".agentops/scheduler/project-schema-attempts/journal.jsonl", attempt_path_template: ".agentops/scheduler/project-schema-attempts/attempts/{attempt_id}.json", receipt_path_template: ".agentops/scheduler/project-schema-attempts/receipts/{attempt_id}.json", manifest_path_template: ".agentops/scheduler/project-schema-attempts/manifests/{attempt_id}.json" }),
  "Audit guards": canonical({ expected_absence: true, initial_commit_parent_binding: "derived-owner-authority-a", initial_creation_authorized_if_absent: true, subsequent_linear_direct_successors: true, allowed_mutation: "append-intent-result-attempt-and-receipt-records-only", intent_before_each_create: true, result_after_each_response: true, consumed_create_retry_forbidden: true, read_only_recovery: true, ref_recreation_forbidden: true, development_ref_mutation_forbidden: true }),
  "Audit result contract": canonical({ schema: "agentops/project-schema-audit-result-contract/v1", result_schema: "agentops/project-schema-audit-result/v1", path: ".git/agentops-project-schema/audit-result.json", schema_pointer: ".agentops/schemas/owner-command-request.schema.json#/definitions/project_schema_audit_result_receipt", construction_timing: "after-manifest-publication-and-single-postinspection", finalization_timing: "after-manifest-publication-and-single-postinspection", ambiguity_policy: "inspect-once-never-create", no_self_reference: true })
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
const projectIdentity = { owner: "cehinds", owner_type: "user", number: 4, id: "PVT_kwHOCSCyJ84BgfH9", title: "Family Delivery", closed: false };
const option = (id, name, color, description) => ({ id, name, color, description });
const statusOptions = [["READY","GREEN","Eligible for scheduler admission."],["BLOCKED","RED","Blocked by a recorded condition."],["PAUSED","GRAY","Intentionally paused and not schedulable."],["IN_PROGRESS","YELLOW","Implementation is active."],["QA_REVIEW","PURPLE","Awaiting or undergoing independent QA."],["PR_OPEN","BLUE","A pull request is open."],["DONE","GREEN","Completed and terminal."],["CANCELLED","GRAY","Cancelled and terminal."],["SUPERSEDED","PINK","Superseded by another work item or candidate."]].map(([name,color,description],i)=>option(`status-${i}`,name,color,description));
const priorityOptions = [option("5901e7b3","P0","GRAY",""),option("c3bc1e0d","P1","GRAY",""),option("f2b023f2","P2","GRAY",""),option("f85da77c","P3","GRAY","")];
const roleOptions = [["owner","PURPLE","Owner authority."],["it-manager-iii","RED","Technical integration and delivery authority."],["project-management-lead","BLUE","Portfolio, dependency, and sequencing stewardship."],["data-architecture-lead","PURPLE","Schema, lineage, and compatibility authority."],["help-desk","GRAY","Intake, routing, and status hygiene."],["maker","GREEN","Bounded implementation owner."],["qa-independent","YELLOW","Independent exact-head verification."],["it-support","ORANGE","Tooling and environment support."],["app-dev-i","GREEN","Application developer I."],["app-dev-ii","GREEN","Application developer II."],["app-dev-iii","GREEN","Application developer III."],["artist-i","PINK","Designer or artist I."],["artist-ii","PINK","Designer or artist II."],["artist-iii","PINK","Designer or artist III."],["qa-technician-i","YELLOW","QA technician I."],["qa-technician-ii","YELLOW","QA technician II."],["qa-technician-iii","YELLOW","QA technician III."],["team-lead","BLUE","Team staffing and capacity lead."]].map(([name,color,description],i)=>option(`role-${i}`,name,color,description));
const scopeOptions = [option("scope-true","TRUE","GREEN","Affected scope is complete."),option("scope-false","FALSE","RED","Affected scope is incomplete.")];
const manifestFields = [
  ["status","Scheduler Status","ProjectV2SingleSelectField","SINGLE_SELECT",statusOptions],
  ["PVTSSF_lAHOCSCyJ84BgfH9zhfelc4","Priority","ProjectV2SingleSelectField","SINGLE_SELECT",priorityOptions],
  ["role","Owner Role","ProjectV2SingleSelectField","SINGLE_SELECT",roleOptions],
  ["paths","Affected Paths","ProjectV2Field","TEXT",[]],["resources","Affected Resources","ProjectV2Field","TEXT",[]],
  ["dependencies","Dependencies","ProjectV2Field","TEXT",[]],["claims","External Claims","ProjectV2Field","TEXT",[]],
  ["gate","Human Gate","ProjectV2Field","TEXT",[]],["scope","Scope Complete","ProjectV2SingleSelectField","SINGLE_SELECT",scopeOptions]
].map(([id,name,kind,data_type,options])=>({id,name,kind,data_type,created_at:"2026-08-31T15:00:00Z",updated_at:"2026-08-31T15:55:00Z",options}));
const qaReceipt = { schema: "agentops/independent-qa-receipt/v1", path: ".agentops/scheduler/cutover/qa-receipt.json", blob_oid: OID_A, sha256: HASH_A, semantics: { schema: "agentops/independent-qa-receipt/v1", candidate: { head: OID_A, tree: OID_B }, verdict: "PASS", verifier: { actor: "qa-seat", role: "qa-independent" }, maker_actor: "maker-seat", independent_of_maker: true, tested_at: "2026-08-31T15:58:00Z", tests: [{ id: "suite", command: "node test", exit_code: 0, outcome: "PASS", output_sha256: HASH_B }], evidence: [] } };
const migration = { boundary_oid: OID_C, state_migrated_event: { schema: "agentops/scheduler-event/v2", path: "journal/00000001-state-migrated.json", blob_oid: OID_B, sha256: HASH_B, semantics: { event_version: 2, event_type: "STATE_MIGRATED", issue_id: "scheduler-state", payload_schema: "agentops/scheduler-migration/v2", dispatch_frozen: true, single_migration_boundary: true, boundary_commit_binding: "migration.boundary_oid" } } };
const currentState = { oid: OID_D, tree: OID_E, released_custody: { schema: "agentops/scheduler-machine-lease/v1", path: "machine-lease.json", blob_oid: OID_C, sha256: "3".repeat(64), semantics: { machine_id: null, acquired_at: null, released_at_required: true, expires_at_equals_released_at: true, expected_state_ref_oid_binding: "current_state.oid" } } };
const projectReceipt = { schema: "agentops/project-schema-change-receipt/v1", path: ".agentops/scheduler/cutover/project-schema-receipt.json", blob_oid: OID_D, sha256: "4".repeat(64), semantics: { status: "COMPLETE", failure_code: null, project: projectIdentity, mutation_counts: { created_field_count: 8, mutated_item_count: 0, updated_existing_field_count: 0, backfill_count: 0 }, readback_schema: "agentops/project-field-readback/v1", audit_ref: "refs/heads/agentops/project-schema-audit" } };
const projectManifest = { schema: "agentops/project-field-manifest/v1", path: ".agentops/scheduler/cutover/project-manifest.json", blob_oid: OID_E, sha256: "5".repeat(64), semantics: { schema: "agentops/project-field-manifest/v1", definitions_hash: "5".repeat(64), project: projectIdentity, observed_at: "2026-08-31T15:57:00Z", project_updated_at: "2026-08-31T15:56:00Z", fields: manifestFields, source_receipt_hash: "4".repeat(64) } };
const quietReceipt = { schema: "agentops/scheduler-quiet-window-receipt/v1", path: ".agentops/scheduler/cutover/quiet-window-receipt.json", blob_oid: OID_F, sha256: "6".repeat(64), semantics: { observed_from: "2026-08-31T15:45:00Z", observed_until: "2026-08-31T15:55:00Z", source_state_oid: OID_D, state_ref: "refs/heads/agentops/scheduler-state", development_ref: "refs/heads/dev", scheduler_process_count: 0, legacy_process_count: 0, state_mutation_count: 0, dispatch_frozen: true, no_external_mutation: true } };
const legacyActivation = { schema: "agentops/pipeline-activation/v1", path: ".agentops/pipeline-pilot/activation.json", blob_oid: OID_F, sha256: "7".repeat(64), semantics: { enabled: false, mode: "STOOD_DOWN_FOR_SCHEDULER_CUTOVER" } };
const preConfig = { schema: "agentops/scheduler-config/v1", path: ".agentops/scheduler/config.json", blob_oid: OID_B, sha256: "8".repeat(64), semantics: { scheduler_dispatch_enabled: false, legacy_watcher_authoritative: false, scheduler_authorization_evidence: null, migration_dispatch_frozen: true } };
const postConfig = { schema: "agentops/scheduler-config/v1", path: ".agentops/scheduler/config.json", blob_oid: OID_C, sha256: "9".repeat(64), semantics: { scheduler_dispatch_enabled: true, legacy_watcher_authoritative: false, scheduler_authorization_evidence_binding: "canonical-owner-event-in-direct-parent-a-by-path-and-id-no-hash", migration_dispatch_frozen: true } };
const activationTemplate = {
  schema: "agentops/scheduler-cutover-activation-template/v1",
  development_d0: { oid: OID_E, tree: OID_B, legacy_activation_blob_oid: OID_F, pre_cutover_config_blob_oid: OID_B, post_cutover_config_blob_oid: OID_C },
  state_s0: { oid: OID_D, tree: OID_E },
  authority_a_derivation: {
    parent_binding: "expected_development_remote_oid", parent_count: 1,
    source_paths: { owner_event_path_template: ".agentops/events/{target}/{event_id}.json", target_capsule_path_template: ".agentops/work/{target}/CURRENT.json" },
    cutover_evidence_paths: { qa_receipt: ".agentops/scheduler/cutover/qa-receipt.json", project_schema_receipt: ".agentops/scheduler/cutover/project-schema-receipt.json", project_manifest: ".agentops/scheduler/cutover/project-manifest.json", quiet_window_receipt: ".agentops/scheduler/cutover/quiet-window-receipt.json", activation_manifest: ".agentops/scheduler/cutover/activation-manifest.json" },
    deterministic_render_paths: { governance: ".agentops/generated/GOVERNANCE.md", hud: ".agentops/generated/hud/index.html", decisions: ".agentops/generated/hub/decisions.html", published_hud: "docs/generated/hud/index.html", published_decisions: "docs/generated/hub/decisions.html" },
    unchanged_render_bytes_omitted: true, other_changes_forbidden: true
  },
  state_s1_derivation: { parent_binding: "expected_state_remote_oid", parent_count: 1, activation_event: { path_template: "journal/{sequence:08}-{event_id}.json", schema: "agentops/scheduler-event/v2", payload_schema: "agentops/scheduler-activation/v2", event_version: 2, event_type: "SCHEDULER_ACTIVATED", issue_id: "scheduler-state", actor: "it-manager-iii", machine_id: null, lease_id: null, lease_epoch: null, source_binding: "current_state", authority_binding: "canonical-owner-event-in-derived-authority-a", count: 1 }, snapshot_path: "snapshot.json", preserved_paths_policy: "all-prior-journal-machine-lease-and-state-version-blobs-byte-identical", other_changes_forbidden: true },
  development_d1_derivation: { parent_binding: "derived-authority-a", parent_count: 1, scheduler_config_path: ".agentops/scheduler/config.json", scheduler_config_blob_binding: "post_cutover_config.blob_oid", authority_evidence_mode: "canonical-owner-event-in-direct-parent-a-by-path-and-id-no-hash", other_changes_forbidden: true },
  all_off_precondition: { scheduler_dispatch_enabled: false, legacy_watcher_authoritative: false, scheduler_authorization_evidence: null, migration_dispatch_frozen: true, legacy_activation_enabled: false, legacy_activation_mode: "STOOD_DOWN_FOR_SCHEDULER_CUTOVER" },
  derivation_order: "build-a-from-d0-build-s1-from-s0-build-d1-from-a-record-result-then-publish-s1-d1-atomically", no_self_reference: true
};
const activationManifest = { schema: "agentops/scheduler-cutover-activation-manifest/v1", path: ".agentops/scheduler/cutover/activation-manifest.json", blob_oid: OID_A, sha256: "a".repeat(64), blob_parse_policy: "parse-json-and-deep-equal-inline-template", template: activationTemplate };
const resultContract = { schema: "agentops/scheduler-cutover-result-contract/v1", result_schema: "agentops/scheduler-cutover-result/v1", path: ".git/agentops-scheduler/cutover-result.json", schema_pointer: ".agentops/schemas/owner-command-request.schema.json#/definitions/scheduler_cutover_result_receipt", construction_timing: "after-local-derivation-before-publication", publication_gate: "prebuilt-a-s1-d1-match-derivation-template", no_self_reference: true };
const cutoverValues = Object.freeze({
  "Request schema": "agentops/scheduler-cutover-authority/v2", "Action": "authorize-scheduler-cutover",
  "Target ticket": "AS-1001", "Expected current hash": `sha256:${HASH_A}`, "Candidate OID": OID_A,
  "Scheduler head": OID_A, "Scheduler tree": OID_B, "QA receipt": canonical(qaReceipt), "Migration": canonical(migration),
  "Current state": canonical(currentState), "Project schema receipt": canonical(projectReceipt),
  "Project manifest": canonical(projectManifest), "Quiet window receipt": canonical(quietReceipt),
  "Active work lease count": "0", "Legacy activation": canonical(legacyActivation), "Pre-cutover config": canonical(preConfig),
  "Post-cutover config": canonical(postConfig), "Activation manifest": canonical(activationManifest),
  "Result receipt contract": canonical(resultContract),
  "State target ref": "refs/heads/agentops/scheduler-state", "Expected state remote OID": OID_D,
  "Development ref": "refs/heads/dev", "Expected development remote OID": OID_E,
  "Publication mode": "atomic-two-ref-cas", "Ambiguity policy": "inspect-once-never-retry",
  "Postcondition policy": "both-exact-or-withhold", "One use": "true", "Expires at": "2026-09-01T15:10:17.1234567Z",
  "Push mode": "git-push-atomic-two-ref-exact-leases", "Abort on remote change": "true"
});

const acceptedProject = validateProfile(projectValues, PROJECT_HEADINGS);
check(acceptedProject.ok, acceptedProject.errors.join(" | "));
assert.deepEqual(Object.keys(acceptedProject.request.project_schema_change), [
  "schema", "executor_head", "executor_tree", "project", "authenticated_login", "required_scope", "project_updated_at",
  "preflight", "definitions_hash", "mode", "allowed_mutation", "forbid_item_mutation", "forbid_existing_field_update",
  "forbid_backfill", "abort_on_any_drift", "retry_mode", "one_use", "expires_at", "audit_ref",
  "expected_audit_remote_oid", "audit_push_mode", "journal_mode", "recovery_mode", "audit_paths", "audit_guards",
  "audit_result_contract"
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
  "schema", "scheduler_head", "scheduler_tree", "qa_receipt", "migration", "current_state",
  "project_schema_receipt", "project_manifest", "quiet_window_receipt", "active_work_lease_count",
  "legacy_activation", "pre_cutover_config", "post_cutover_config", "activation_manifest", "result_receipt_contract",
  "state_target_ref", "expected_state_remote_oid", "development_ref",
  "expected_development_remote_oid", "publication_mode", "ambiguity_policy", "postcondition_policy", "one_use",
  "expires_at", "push_mode", "abort_on_remote_change"
]);
checks += 1;
assert.deepEqual(acceptedCutover.request.scheduler_cutover.migration, migration);
checks += 1;
assert.deepEqual(acceptedCutover.request.scheduler_cutover.current_state, currentState);
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
check(!validateProfile({ ...cutoverValues, "QA receipt": canonical({ ...qaReceipt, semantics: { ...qaReceipt.semantics, verdict: "WITHHOLD" } }) }, CUTOVER_HEADINGS).ok, "cutover QA verdict must be PASS");
check(!validateProfile({ ...cutoverValues, "QA receipt": canonical({ ...qaReceipt, semantics: { ...qaReceipt.semantics, tests: [{ ...qaReceipt.semantics.tests[0], exit_code: 1, outcome: "FAIL" }] } }) }, CUTOVER_HEADINGS).ok, "cutover QA tests must be PASS with exit zero");
check(!validateProfile({ ...cutoverValues, "Project manifest": canonical({ ...projectManifest, semantics: { ...projectManifest.semantics, project_updated_at: undefined } }) }, CUTOVER_HEADINGS).ok, "Project manifest updated-at is required");
check(!validateProfile({ ...cutoverValues, "Project manifest": canonical({ ...projectManifest, semantics: { ...projectManifest.semantics, fields: [manifestFields[1], manifestFields[0], ...manifestFields.slice(2)] } }) }, CUTOVER_HEADINGS).ok, "Project manifest tuple order is exact");
check(!validateProfile({ ...projectValues, "Request schema": "agentops/project-schema-change-authority/v1" }, PROJECT_HEADINGS).ok, "Project v1 substitution must fail");
check(!validateProfile({ ...projectValues, "Audit paths": canonical({ ...JSON.parse(projectValues["Audit paths"]), extra: true }) }, PROJECT_HEADINGS).ok, "Project nested audit extras must fail");
check(!validateProfile({ ...cutoverValues, "Request schema": "agentops/scheduler-cutover-authority/v1" }, CUTOVER_HEADINGS).ok, "cutover v1 substitution must fail");
check(!validateProfile({ ...cutoverValues, "Current state": canonical({ ...currentState, extra: true }) }, CUTOVER_HEADINGS).ok, "cutover nested descriptor extras must fail");
check(!validateProfile({ ...cutoverValues, "Activation manifest": canonical({ ...activationManifest, template: { ...activationTemplate, all_off_precondition: { ...activationTemplate.all_off_precondition, scheduler_dispatch_enabled: true } } }) }, CUTOVER_HEADINGS).ok, "cutover all-off substitution must fail");

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentops-owner-command-test-"));
try {
  const bare = path.join(fixtureRoot, "remote.git");
  const repo = path.join(fixtureRoot, "repo");
  fs.mkdirSync(repo);
  git(fixtureRoot, ["init", "--bare", bare]);
  git(repo, ["init"]);
  git(repo, ["config", "user.name", "AgentOps Test"]); git(repo, ["config", "user.email", "test@local.invalid"]);
  git(repo, ["remote", "add", "origin", bare]);
  fs.mkdirSync(path.join(repo, ".agentops", "work", "AS-1001"), { recursive: true });
  fs.writeFileSync(path.join(repo, "base.txt"), "base\n");
  fs.writeFileSync(path.join(repo, ".agentops", "work", "AS-1001", "CURRENT.json"), `${JSON.stringify({ current_hash: `sha256:${"1".repeat(64)}` }, null, 2)}\n`);
  git(repo, ["add", "base.txt", ".agentops/work/AS-1001/CURRENT.json"]); git(repo, ["commit", "-m", "D0"]);
  const d0 = git(repo, ["rev-parse", "HEAD"]);
  fs.mkdirSync(path.join(repo, ".agentops", "events", "AS-1001"), { recursive: true });
  const ownerEvent = { id: "evt-project-authority", kind: "owner-decision", actor: "owner", at: "2026-08-31T16:00:00Z", decision: { action: "authorize-project-schema-change" } };
  fs.writeFileSync(path.join(repo, ".agentops", "events", "AS-1001", "evt.json"), `${JSON.stringify(ownerEvent, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, ".agentops", "work", "AS-1001", "CURRENT.json"), `${JSON.stringify({ parent_hash: `sha256:${"1".repeat(64)}`, current_hash: `sha256:${"2".repeat(64)}` }, null, 2)}\n`);
  git(repo, ["add", ".agentops/events/AS-1001/evt.json", ".agentops/work/AS-1001/CURRENT.json"]); git(repo, ["commit", "-m", "A"]);
  const authorityA = git(repo, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(repo, "config.txt"), "D1\n"); git(repo, ["add", "config.txt"]); git(repo, ["commit", "-m", "D1"]);
  const d1 = git(repo, ["rev-parse", "HEAD"]);
  const cutoverEvent = { id: "evt-cutover-authority", kind: "owner-decision", actor: "owner", at: "2026-08-31T16:00:00Z", decision: { action: "authorize-scheduler-cutover" } };
  fs.writeFileSync(path.join(repo, ".agentops", "events", "AS-1001", "cutover.json"), `${JSON.stringify(cutoverEvent, null, 2)}\n`);
  git(repo, ["add", ".agentops/events/AS-1001/cutover.json"]); git(repo, ["commit", "-m", "cutover A"]);
  const cutoverA = git(repo, ["rev-parse", "HEAD"]);
  git(repo, ["checkout", "--orphan", "state"]); git(repo, ["rm", "-rf", "."]);
  fs.writeFileSync(path.join(repo, "state.txt"), "S0\n"); git(repo, ["add", "state.txt"]); git(repo, ["commit", "-m", "S0"]);
  const s0 = git(repo, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(repo, "state.txt"), "S1\n"); git(repo, ["add", "state.txt"]); git(repo, ["commit", "-m", "S1"]);
  const s1 = git(repo, ["rev-parse", "HEAD"]);
  git(repo, ["push", "origin", `${d0}:refs/heads/dev`, `${s0}:refs/heads/agentops/scheduler-state`]);
  const atomic = atomicPublishExactRefs({ repo, stateRef: "refs/heads/agentops/scheduler-state", expectedStateOid: s0, stateTargetOid: s1, developmentRef: "refs/heads/dev", expectedDevelopmentOid: d0, developmentTargetOid: d1 });
  check(atomic.ok && atomic.receipt.postinspection.state_actual_oid === s1 && atomic.receipt.postinspection.development_actual_oid === d1 && !("outcome" in atomic.receipt.postinspection), "local bare atomic cutover must record only both observed refs");
  check(git(repo, ["ls-remote", "origin", "refs/heads/dev"]).startsWith(d1), "cutover must publish D1, never authority A alone");
  assert.throws(() => atomicPublishExactRefs({ repo, stateRef: "refs/heads/agentops/scheduler-state", expectedStateOid: s0, stateTargetOid: s1, developmentRef: "refs/heads/dev", expectedDevelopmentOid: d0, developmentTargetOid: d1 }), /prepublication CAS mismatch/);
  checks += 1;
  const expiredStateRef = "refs/heads/test-state-expired"; const expiredDevRef = "refs/heads/test-dev-expired";
  git(repo, ["push", "origin", `${s0}:${expiredStateRef}`, `${d0}:${expiredDevRef}`]);
  assert.throws(() => atomicPublishExactRefs({ repo, stateRef: expiredStateRef, expectedStateOid: s0, stateTargetOid: s1, developmentRef: expiredDevRef, expectedDevelopmentOid: d0, developmentTargetOid: d1, expiresAt: "2026-08-31T15:59:59Z", now: () => new Date("2026-08-31T16:00:00Z") }), /expired immediately before/);
  check(git(repo, ["ls-remote", "origin", expiredStateRef]).startsWith(s0) && git(repo, ["ls-remote", "origin", expiredDevRef]).startsWith(d0), "expired cutover publication must leave both refs unchanged");
  const cutoverConsumed = consumeExactPacket({ repo, request: acceptedCutover.request, authorityOid: cutoverA, consumedAt: "2026-08-31T16:00:01Z" });
  const cutoverRecovered = consumeExactPacket({ repo, request: acceptedCutover.request, authorityOid: cutoverA, consumedAt: "2026-08-31T16:00:02Z" });
  check(!cutoverConsumed.recovery && cutoverRecovered.recovery && cutoverConsumed.oid === cutoverRecovered.oid, "cutover must durably consume its exact packet before publication and never replace the tombstone");
  git(repo, ["push", "--force", "origin", `${d0}:refs/heads/dev`]);
  const project = executeProjectPublication({ repo, request: acceptedProject.request, authorityOid: authorityA });
  check(project.ok && !project.consumed.recovery && project.initial.path.startsWith(".agentops/scheduler/project-schema-attempts/attempts/") && git(repo, ["diff-tree", "--no-commit-id", "--name-only", "-r", authorityA, project.initial.oid]) === project.initial.path, "Project execution must consume once, publish A, and initialize the non-empty leased-subtree audit child");
  check(git(repo, ["ls-remote", "origin", "refs/heads/dev"]).startsWith(authorityA) && git(repo, ["ls-remote", "origin", acceptedProject.request.project_schema_change.audit_ref]).startsWith(project.initial.oid), "Project execution must keep audit data off dev and create only its dedicated audit ref");
  const recovered = executeProjectPublication({ repo, request: acceptedProject.request, authorityOid: authorityA });
  check(recovered.ok && recovered.consumed.recovery && recovered.consumed.oid === project.consumed.oid, "a consumed Project packet must inspect once and never retry either publication");
  const auditOid = project.initial.oid;
  assert.throws(() => createProjectAuditRefOnce({ repo, authorityOid: authorityA, auditTargetOid: auditOid }), /not absent/);
  checks += 1;
  const expiredRef = "refs/heads/agentops/project-schema-audit-expired";
  assert.throws(() => createProjectAuditRefOnce({ repo, authorityOid: authorityA, auditTargetOid: auditOid, auditRef: expiredRef, expiresAt: "2026-08-31T15:59:59Z", now: () => new Date("2026-08-31T16:00:00Z") }), /expired immediately before/);
  check(git(repo, ["ls-remote", "origin", expiredRef]) === "", "expired Project publication must not create a ref");
  const genericRequest = { ...accepted.request, scheduler_migration: { ...accepted.request.scheduler_migration, expires_at: "2026-08-31T15:59:59Z" } };
  assert.throws(() => executeAuthorityPublication({ repo, request: genericRequest, authorityOid: authorityA, now: () => new Date("2026-08-31T16:00:00Z") }), /expired before publication/);
  check(git(repo, ["ls-remote", "origin", "refs/heads/dev"]).startsWith(authorityA), "expired generic authority publication must not change dev");
  const projectReceipt = path.join(repo, ".git", "agentops-project-schema", "consumption-result.json");
  const tampered = JSON.parse(fs.readFileSync(projectReceipt, "utf8")); tampered.authority_oid = "0".repeat(40);
  fs.writeFileSync(projectReceipt, `${JSON.stringify(tampered, null, 2)}\n`);
  assert.throws(() => executeProjectPublication({ repo, request: acceptedProject.request, authorityOid: authorityA }), /does not bind the recovered exact packet/);
} finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }

console.log(`PASS ${checks}/${checks}; opened-only=yes; four-exact-authority-profiles=yes; owner-exclusive=yes; cas-transport=yes; canonical-json=yes; free-form=no; edited-reexecution=no`);
