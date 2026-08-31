#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bootstrapSeatClaim, runtimeAuthorityHash, ABSENT_RUNTIME_HASH } from "./pipeline-seat-bootstrap.mjs";
import { sealClaim, seatFingerprint, validateClaim, validateLease } from "./pipeline-seat-claims.mjs";

const digest = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "agentops-seat-bootstrap-"));
const repo = path.join(temp, "repo");
fs.mkdirSync(repo, { recursive: true });
const git = (args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", windowsHide: true }).trim();
git(["init"]); git(["config", "user.name", "Bootstrap Test"]); git(["config", "user.email", "bootstrap@example.invalid"]);
fs.writeFileSync(path.join(repo, "seed.txt"), "seed\n"); git(["add", "."]); git(["commit", "-m", "seed"]);
const candidate = git(["rev-parse", "HEAD"]), devBase = candidate;
git(["branch", "codex/issue-460-scheduler-repair-2", candidate]); git(["branch", "codex/issue-460-scheduler-bootstrap", candidate]);

const agentops = path.join(repo, ".agentops");
fs.mkdirSync(path.join(agentops, "leases"), { recursive: true });
fs.mkdirSync(path.join(agentops, "work", "AS-1001"), { recursive: true });
fs.mkdirSync(path.join(agentops, "events", "AS-1001"), { recursive: true });
fs.writeFileSync(path.join(agentops, "leases", "lease-AS-1001-maker.json"), JSON.stringify({ id: "lease-AS-1001-maker", revoked: true, path_globs: [".agentops/tools/**"] }));
fs.writeFileSync(path.join(agentops, "leases", "lease-AS-1001-maker-r2.json"), JSON.stringify({ id: "lease-AS-1001-maker-r2", revoked: false, path_globs: [".agentops/work/AS-1001/**"] }));
fs.writeFileSync(path.join(agentops, "work", "AS-1001", "CURRENT.json"), JSON.stringify({ writer_lease: "lease-AS-1001-maker-r2", current_hash: "sha256:capsule" }));
const now = "2026-08-31T13:30:00.000Z", expiry = "2026-08-31T14:00:00.000Z", overrideExpiry = "2026-08-31T14:30:00.000Z";
const override = {
  id: "AS-1001-0004", kind: "owner-decision", actor: "owner",
  decision: { action: "record-owner-override" },
  summary: `OWNER_OVERRIDE epoch=1; expires=${overrideExpiry}; source_ref=codex/issue-460-scheduler-repair-2; source_oid=${candidate}; target_ref=codex/issue-460-scheduler-bootstrap; base_oid=${devBase}; live watcher create-seat/create-claim prohibition remains unchanged`,
};
const overrideFile = path.join(agentops, "events", "AS-1001", "AS-1001-0004.json");
fs.writeFileSync(overrideFile, `${JSON.stringify(override, null, 2)}\n`);
const runtime = path.join(temp, "runtime"); fs.mkdirSync(runtime);
assert.equal(runtimeAuthorityHash(runtime), ABSENT_RUNTIME_HASH);
const base = {
  ticket: "#460", role: "it-manager-iii", team: "it-manager-iii",
  ref: "codex/issue-460-scheduler-bootstrap", sourceRef: "codex/issue-460-scheduler-repair-2",
  sourceOid: candidate, expectedRefOid: candidate, expectedNewRefOldOid: "0".repeat(40),
  developmentBaseOid: devBase, expectedRuntimeHash: ABSENT_RUNTIME_HASH, epoch: 1,
  now, expiry, overrideExpiry, overrideEventId: override.id,
  overrideEventFile: path.relative(repo, overrideFile), overrideEventHash: digest(fs.readFileSync(overrideFile)),
  pathGlobs: [".agentops/tools/pipeline-seat-bootstrap.mjs", ".agentops/tools/pipeline-seat-bootstrap.test.mjs"],
  resources: ["seat-registry", "claim:#460", "lease:issue-460", "event-chain:#460"], runtimeRoot: runtime,
};

const result = bootstrapSeatClaim(repo, base);
assert.equal(result.status, "BOOTSTRAPPED");
assert.match(result.seat_id, /^seat:it-manager-iii:[0-9a-f-]{36}$/);
assert.equal(JSON.stringify(result).includes("capability"), false);
const claim = validateClaim(JSON.parse(fs.readFileSync(path.join(runtime, "claims", "#460.json"), "utf8")));
const lease = JSON.parse(fs.readFileSync(path.join(runtime, "leases", `${result.lease_id}.json`), "utf8"));
validateLease(lease, claim, now);
assert.equal(claim.current_hash, result.claim_hash); assert.equal(lease.current_hash, result.lease_hash);
const registry = JSON.parse(fs.readFileSync(path.join(runtime, "registry.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(runtime, "seat-runtime.json"), "utf8"));
const capability = fs.readFileSync(path.join(runtime, config.seats["it-manager-iii"].capability_file), "utf8").trim();
assert.equal(seatFingerprint(capability), registry.seats[result.seat_id].capability_fingerprint);
assert.equal(JSON.stringify(registry).includes(capability), false);
const receipt = JSON.parse(fs.readFileSync(path.join(runtime, "override-receipts", `${result.override_receipt}.json`), "utf8"));
assert.equal(receipt.status, "consumed"); assert.equal(receipt.prohibition_preserved, "live watcher may not create a claim or seat identity");
assert.throws(() => bootstrapSeatClaim(repo, base), /stale bootstrap runtime CAS/);

const staleRefRuntime = path.join(temp, "stale-ref"); fs.mkdirSync(staleRefRuntime);
assert.throws(() => bootstrapSeatClaim(repo, { ...base, runtimeRoot: staleRefRuntime, expectedRefOid: "1".repeat(40) }), /target ref moved/);
const staleOverrideRuntime = path.join(temp, "stale-override"); fs.mkdirSync(staleOverrideRuntime);
assert.throws(() => bootstrapSeatClaim(repo, { ...base, runtimeRoot: staleOverrideRuntime, overrideEventHash: `sha256:${"0".repeat(64)}` }), /override event hash mismatch/);
const expiredRuntime = path.join(temp, "expired"); fs.mkdirSync(expiredRuntime);
assert.throws(() => bootstrapSeatClaim(repo, { ...base, runtimeRoot: expiredRuntime, now: overrideExpiry }), /bootstrap claim window is invalid|owner override expired/);
const badRoleRuntime = path.join(temp, "bad-role"); fs.mkdirSync(badRoleRuntime);
assert.throws(() => bootstrapSeatClaim(repo, { ...base, runtimeRoot: badRoleRuntime, role: "maker" }), /scoped only to the IT Manager III/);

const collisionRuntime = path.join(temp, "collision"); fs.mkdirSync(path.join(collisionRuntime, "claims"), { recursive: true });
const otherClaim = sealClaim({ schema: "agentops/seat-claim/v1", revision: 1, parent_hash: null, ticket: "#999", seat_id: "seat:maker:11111111-1111-4111-8111-111111111111", lease_id: "lease-other", ref: "codex/other", path_globs: [base.pathGlobs[0]], issued: now, expiry, status: "active" });
fs.writeFileSync(path.join(collisionRuntime, "claims", "#999.json"), `${JSON.stringify(otherClaim, null, 2)}\n`);
assert.throws(() => bootstrapSeatClaim(repo, { ...base, runtimeRoot: collisionRuntime, expectedRuntimeHash: runtimeAuthorityHash(collisionRuntime) }), /path or ref collision/);

const recoveryRuntime = path.join(temp, "recovery"); fs.mkdirSync(recoveryRuntime);
const recoveryArgs = { ...base, runtimeRoot: recoveryRuntime, failAfterJournal: true };
assert.throws(() => bootstrapSeatClaim(repo, recoveryArgs), /simulated crash after bootstrap journal/);
const recovered = bootstrapSeatClaim(repo, recoveryArgs);
assert.equal(recovered.status, "RECOVERED");
assert.equal(fs.existsSync(path.join(recoveryRuntime, "bootstrap-transaction.lock.journal.json")), false);
assert.equal(JSON.stringify(recovered).includes("capability"), false);

fs.rmSync(temp, { recursive: true, force: true });
console.log("pipeline seat bootstrap: all tests passed");
