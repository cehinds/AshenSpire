import assert from "node:assert/strict";
import fs from "node:fs";
import { validateOwnerCommandIssue } from "./validate-owner-command-issue.mjs";

const workflow = fs.readFileSync(".github/workflows/owner-command.yml", "utf8");
const template = fs.readFileSync(".github/ISSUE_TEMPLATE/owner-decision.yml", "utf8");
const body = `### Owner-command form

owner-decision/v1

### Action

approve

### Target ticket

AS-1001

### Expected current hash

sha256:example

### Candidate OID

0123456789012345678901234567890123456789

### Reason

Verified.
`;

assert.match(workflow, /types:\s*\[opened\]/);
assert.doesNotMatch(workflow, /types:\s*\[[^\]]*edited/);
assert.match(workflow, /startsWith\(github\.event\.issue\.title, '\[decision\] '\)/);
assert.match(workflow, /validate-owner-command-issue\.mjs/);
assert.match(template, /id: owner_command_form[\s\S]*owner-decision\/v1/);
assert.match(template, /grant-dev-delivery-authority/);
assert.equal(validateOwnerCommandIssue({ title: "[decision] AS-1001", body }).ok, true);
assert.equal(validateOwnerCommandIssue({ title: "ordinary ticket", body }).ok, false);
assert.equal(validateOwnerCommandIssue({ title: "[decision] AS-1001", body: body.replace("owner-decision/v1", "owner-decision/v0") }).ok, false);
assert.equal(validateOwnerCommandIssue({ title: "[decision] AS-1001", body: body.replace("owner-decision/v1", "owner-decision/v1\nforged-extra") }).ok, false);
assert.equal(validateOwnerCommandIssue({ title: "[decision] AS-1001", body: body.replace("### Reason\n\nVerified.\n", "") }).ok, false);
assert.equal(validateOwnerCommandIssue({ title: "[decision] AS-1001", body: `${body}\n### Extra\n\nNo.\n` }).ok, false);

console.log("PASS 12/12; opened-only=yes; title-gate=yes; exact-versioned-form-shape=yes; dev-delivery-grant=yes; edited-reexecution=no");
