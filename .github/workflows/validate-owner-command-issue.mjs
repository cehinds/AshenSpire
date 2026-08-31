#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const EXPECTED_SECTIONS = Object.freeze([
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
]);

const BASE_FIELDS = Object.freeze({
  "Action": "action",
  "Target ticket": "target",
  "Expected current hash": "expected_current_hash",
  "Candidate OID": "candidate_oid"
});

const MIGRATION_FIELDS = Object.freeze({
  "Scheduler HEAD": "scheduler_head",
  "Scheduler tree": "scheduler_tree",
  "Source state OID": "source_state_oid",
  "Source state tree": "source_state_tree",
  "Source snapshot SHA-256": "source_snapshot_sha256",
  "Source journal manifest SHA-256": "source_journal_manifest_sha256",
  "Source event count": "source_event_count",
  "Source state version": "source_state_version",
  "Target state version": "target_state_version",
  "Canonical anchor OID": "canonical_anchor_oid",
  "Preserved local tip OID": "preserved_local_tip_oid",
  "Dispatch frozen": "dispatch_frozen",
  "One use": "one_use",
  "Expires at": "expires_at",
  "Target ref": "target_ref",
  "Expected remote OID": "expected_remote_oid",
  "Push mode": "push_mode",
  "Abort on remote change": "abort_on_remote_change"
});

const OID_FIELDS = Object.freeze([
  "scheduler_head",
  "scheduler_tree",
  "source_state_oid",
  "source_state_tree",
  "canonical_anchor_oid",
  "preserved_local_tip_oid",
  "expected_remote_oid"
]);

const SHA256_FIELDS = Object.freeze([
  "source_snapshot_sha256",
  "source_journal_manifest_sha256"
]);

function issueSections(body) {
  const matches = [...body.matchAll(/^### (.+)\r?$/gm)];
  const values = new Map();
  for (let index = 0; index < matches.length; index += 1) {
    const heading = matches[index][1].trim();
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? body.length;
    values.set(heading, body.slice(start, end).trim());
  }
  return {
    headings: matches.map((match) => match[1].trim()),
    preamble: body.slice(0, matches[0]?.index ?? body.length).trim(),
    values
  };
}

function singleLine(values, heading, errors, { required = false } = {}) {
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

function validateMigration(values, request, errors, now) {
  if (request.actor !== "owner") errors.push("authorize-scheduler-migration is owner-exclusive");
  if (!/^sha256:[0-9a-f]{64}$/.test(request.expected_current_hash ?? "")) {
    errors.push("Expected current hash must be sha256: followed by 64 lowercase hex characters");
  }
  if (!/^[0-9a-f]{40}$/.test(request.candidate_oid ?? "")) {
    errors.push("Candidate OID must be exactly 40 lowercase hex characters");
  }

  const migration = {};
  for (const [heading, key] of Object.entries(MIGRATION_FIELDS)) {
    migration[key] = singleLine(values, heading, errors, { required: true });
  }

  for (const key of OID_FIELDS) {
    if (!/^[0-9a-f]{40}$/.test(migration[key] ?? "")) errors.push(`${key} must be exactly 40 lowercase hex characters`);
  }
  for (const key of SHA256_FIELDS) {
    if (!/^[0-9a-f]{64}$/.test(migration[key] ?? "")) errors.push(`${key} must be exactly 64 lowercase hex characters`);
  }

  if (!/^(0|[1-9][0-9]*)$/.test(migration.source_event_count ?? "")) {
    errors.push("source_event_count must be a non-negative base-10 integer");
  } else {
    migration.source_event_count = Number(migration.source_event_count);
    if (!Number.isSafeInteger(migration.source_event_count)) errors.push("source_event_count must be a safe integer");
  }

  if (migration.source_state_version !== "1") errors.push("source_state_version must be exactly 1");
  else migration.source_state_version = 1;
  if (migration.target_state_version !== "2") errors.push("target_state_version must be exactly 2");
  else migration.target_state_version = 2;
  if (migration.dispatch_frozen !== "true") errors.push("dispatch_frozen must be exactly true");
  else migration.dispatch_frozen = true;
  if (migration.one_use !== "true") errors.push("one_use must be exactly true");
  else migration.one_use = true;
  if (migration.abort_on_remote_change !== "true") errors.push("abort_on_remote_change must be exactly true");
  else migration.abort_on_remote_change = true;
  if (migration.target_ref !== "refs/heads/agentops/scheduler-state") {
    errors.push("target_ref must be exactly refs/heads/agentops/scheduler-state");
  }
  if (migration.push_mode !== "non-force-forward-only-cas") {
    errors.push("push_mode must be exactly non-force-forward-only-cas");
  }

  const expiresPattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{3})?Z$/;
  const expiresMillis = Date.parse(migration.expires_at ?? "");
  const canonicalExpiry = Number.isFinite(expiresMillis) ? new Date(expiresMillis).toISOString() : null;
  const normalizedExpiry = canonicalExpiry && !migration.expires_at?.includes(".")
    ? canonicalExpiry.replace(/\.000Z$/, "Z")
    : canonicalExpiry;
  if (!expiresPattern.test(migration.expires_at ?? "") || normalizedExpiry !== migration.expires_at) {
    errors.push("expires_at must be a valid UTC timestamp with seconds and optional milliseconds");
  } else if (expiresMillis <= now.getTime()) {
    errors.push("expires_at must still be in the future when the command is accepted");
  }

  if (request.candidate_oid && migration.scheduler_head && request.candidate_oid !== migration.scheduler_head) {
    errors.push("candidate_oid must equal scheduler_migration.scheduler_head");
  }
  if (migration.source_state_oid && migration.expected_remote_oid && migration.source_state_oid !== migration.expected_remote_oid) {
    errors.push("source_state_oid must equal expected_remote_oid");
  }

  const reason = values.get("Reason");
  if (reason && reason !== "_No response_") errors.push("authorize-scheduler-migration does not accept free-form Reason text");
  request.scheduler_migration = migration;
}

export function validateOwnerCommandIssue({ title, body, actor, now = new Date() }) {
  const errors = [];
  if (typeof title !== "string" || !/^\[decision\] \S/.test(title)) errors.push("title must start with '[decision] ' and name a target");
  if (typeof body !== "string") return { ok: false, errors: [...errors, "body must be text"], request: null };

  const { headings, preamble, values } = issueSections(body);
  if (preamble) errors.push("body contains content before the first owner-decision section");
  if (JSON.stringify(headings) !== JSON.stringify(EXPECTED_SECTIONS)) errors.push("body does not match the owner-decision/v1 section order");
  if (values.get("Owner-command form") !== "owner-decision/v1") {
    errors.push("owner-decision/v1 form marker is missing, changed, or contains extra content");
  }

  const request = { schema: "agentops/owner-command-request/v1" };
  if (typeof actor !== "string" || !actor) errors.push("authenticated actor role is required outside the issue body");
  else request.actor = actor;
  for (const [heading, key] of Object.entries(BASE_FIELDS)) {
    const value = singleLine(values, heading, errors, { required: heading === "Action" || heading === "Target ticket" });
    if (value !== undefined) request[key] = value;
  }

  if (request.action === "authorize-scheduler-migration") {
    validateMigration(values, request, errors, now);
  } else {
    for (const heading of Object.keys(MIGRATION_FIELDS)) {
      const value = values.get(heading);
      if (value && value !== "_No response_") errors.push(`${heading} is only valid for authorize-scheduler-migration`);
    }
    const reason = values.get("Reason");
    if (reason && reason !== "_No response_") request.reason = reason.split(/\r?\n/)[0].trim();
  }

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
  console.log("owner-command intake accepted: owner-decision/v1 form shape and structured request");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
