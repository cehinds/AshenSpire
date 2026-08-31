import assert from "node:assert/strict";
import fs from "node:fs";
import { validateOwnerCommandIssue } from "./validate-owner-command-issue.mjs";

const workflow = fs.readFileSync(".github/workflows/owner-command.yml", "utf8");
const template = fs.readFileSync(".github/ISSUE_TEMPLATE/owner-decision.yml", "utf8");
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

assert.match(workflow, /types:\s*\[opened\]/);
assert.doesNotMatch(workflow, /types:\s*\[[^\]]*edited/);
assert.match(workflow, /startsWith\(github\.event\.issue\.title, '\[decision\] '\)/);
assert.match(workflow, /validate-owner-command-issue\.mjs/);
assert.match(template, /id: owner_command_form[\s\S]*owner-decision\/v1/);
assert.match(template, /grant-dev-delivery-authority/);

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

const grantValues = Object.fromEntries(HEADINGS.map((heading) => [heading, "_No response_"]));
Object.assign(grantValues, {
  "Owner-command form": "owner-decision/v1",
  "Action": "grant-dev-delivery-authority",
  "Target ticket": "AS-HD-029",
  "Expected current hash": `sha256:${HASH_A}`,
  "Reason": "Bounded normal-PR delivery grant."
});
const grantBody = renderBody(grantValues);
check(validate(grantValues, { title: "[decision] AS-HD-029" }).ok, "dev-delivery grant remains accepted");
check(!validate(grantValues, { title: "ordinary ticket" }).ok, "ordinary title must fail");
check(!validate(grantValues, { title: "[decision] AS-HD-029", body: grantBody.replace("owner-decision/v1", "owner-decision/v0") }).ok, "old form version must fail");
check(!validate(grantValues, { title: "[decision] AS-HD-029", body: `${grantBody}\n### Extra\n\nNo.\n` }).ok, "extra heading must fail");

console.log(`PASS ${checks}/${checks}; opened-only=yes; exact-structured-migration=yes; owner-exclusive=yes; cas-transport=yes; free-form=no; edited-reexecution=no`);
