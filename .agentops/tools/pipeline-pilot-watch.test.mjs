import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquireWatcherLock, cycle, readState, resolveGitStateFile, terminalIdentity, writeState } from "./pipeline-pilot-watch.mjs";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "agentops-pipeline-watch-"));
const actualRepo = path.resolve(rootFromImportMeta(import.meta.url), "..", "..");
const watcherFile = path.join(actualRepo, ".agentops", "tools", "pipeline-pilot-watch.mjs");
const root = path.join(temp, ".agentops");
const stateFile = path.join(temp, ".git", "agentops-pipeline", "state.json");
fs.mkdirSync(path.join(root, "work", "AS-1"), { recursive: true });
const capsule = { ticket: "AS-1", lifecycle_state: "resolved", owner_actor: "maker", current_hash: "sha256:aaa" };
fs.writeFileSync(path.join(root, "work", "AS-1", "CURRENT.json"), JSON.stringify(capsule));
assert.match(terminalIdentity(capsule), /^sha256:[a-f0-9]{64}$/);
assert.equal(terminalIdentity({ ...capsule, lifecycle_state: "assigned" }), null);
const actualState = resolveGitStateFile(actualRepo);
assert.match(actualState.replaceAll("\\", "/"), /\.git\/agentops-pipeline\/state\.json$/);
execFileSync(process.execPath, [watcherFile, "--once"], { cwd: actualRepo, windowsHide: true });
assert.equal(fs.existsSync(actualState), true);
const gitFixture = path.join(temp, "git-fixture");
const linkedFixture = path.join(temp, "git-fixture-linked");
const secondLinkedFixture = path.join(temp, "git-fixture-linked-second");
fs.mkdirSync(gitFixture);
execFileSync("git", ["init", "-q"], { cwd: gitFixture, windowsHide: true });
fs.writeFileSync(path.join(gitFixture, "seed.txt"), "seed\n");
execFileSync("git", ["add", "seed.txt"], { cwd: gitFixture, windowsHide: true });
execFileSync("git", ["-c", "user.name=AgentOps Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "seed"], { cwd: gitFixture, windowsHide: true });
execFileSync("git", ["worktree", "add", "-q", linkedFixture, "-b", "linked-test"], { cwd: gitFixture, windowsHide: true });
execFileSync("git", ["worktree", "add", "-q", secondLinkedFixture, "-b", "linked-test-second"], { cwd: gitFixture, windowsHide: true });
assert.equal(resolveGitStateFile(linkedFixture), resolveGitStateFile(secondLinkedFixture));
assert.match(resolveGitStateFile(linkedFixture).replaceAll("\\", "/"), /\.git\/agentops-pipeline\/state\.json$/);
const sharedLock = path.join(path.dirname(resolveGitStateFile(linkedFixture)), "watcher.lock");
const releaseShared = acquireWatcherLock(sharedLock);
assert.throws(() => acquireWatcherLock(path.join(path.dirname(resolveGitStateFile(secondLinkedFixture)), "watcher.lock")), /already active/);
releaseShared();

const baselineState = path.join(temp, ".git", "agentops-pipeline", "baseline.json");
let baselineCalls = 0;
assert.equal(cycle({ root, stateFile: baselineState, now: "2026-08-30T09:59:00Z", initialize: true, offer: () => { baselineCalls++; return { status: "OFFERED" }; } }).status, "QUIET");
assert.equal(baselineCalls, 0);

let calls = 0;
const offered = (_root, args) => { calls++; return { status: "OFFERED", completed_ticket: args.completedTicket, released_actor: args.releasedActor }; };
assert.equal(cycle({ root, stateFile, now: "2026-08-30T10:00:00Z", offer: offered }).status, "MATERIAL_CHANGE");
assert.equal(calls, 1);
assert.equal(cycle({ root, stateFile, now: "2026-08-30T10:00:01Z", offer: offered }).status, "QUIET");
assert.equal(calls, 1);

capsule.current_hash = "sha256:bbb";
fs.writeFileSync(path.join(root, "work", "AS-1", "CURRENT.json"), JSON.stringify(capsule));
assert.equal(cycle({ root, stateFile, now: "2026-08-30T10:01:00Z", offer: offered }).events.length, 1);
assert.equal(calls, 2);

capsule.current_hash = "sha256:ccc";
fs.writeFileSync(path.join(root, "work", "AS-1", "CURRENT.json"), JSON.stringify(capsule));
const alarmOffer = (_root, args) => ({ status: Date.parse(args.now) - Date.parse(args.releasedAt) >= 300000 ? "IDLE_ALARM" : "NO_SAFE_ASSIGNMENT" });
assert.equal(cycle({ root, stateFile, now: "2026-08-30T11:00:00Z", offer: alarmOffer }).status, "MATERIAL_CHANGE");
assert.equal(readState(stateFile).pending.length, 1);
assert.equal(cycle({ root, stateFile, now: "2026-08-30T11:04:59Z", offer: alarmOffer }).status, "QUIET");
const alarm = cycle({ root, stateFile, now: "2026-08-30T11:05:00Z", offer: alarmOffer });
assert.equal(alarm.events[0].result.status, "IDLE_ALARM");
assert.equal(readState(stateFile).pending.length, 0);
assert.equal(cycle({ root, stateFile, now: "2026-08-30T11:05:01Z", offer: alarmOffer }).events.length, 0);

const before = fs.readFileSync(path.join(root, "work", "AS-1", "CURRENT.json"), "utf8");
const state = readState(stateFile);
state.observations = Array.from({ length: 150 }, (_, i) => ({ i }));
writeState(stateFile, state, 100);
assert.equal(readState(stateFile).observations.length, 100);
assert.equal(fs.readFileSync(path.join(root, "work", "AS-1", "CURRENT.json"), "utf8"), before);
const lockFile = path.join(temp, ".git", "agentops-pipeline", "test.lock");
const release = acquireWatcherLock(lockFile);
assert.throws(() => acquireWatcherLock(lockFile), /already active/);
release();
assert.equal(fs.existsSync(lockFile), false);
console.log("PASS 25/25; second-linked-watcher-refused=yes; repo-wide-common-state=yes; two-linked-worktrees-one-identity=yes; watcher-once-baseline=yes; single-watcher-lock=yes; historical-baseline=yes; stable-terminal-hash=yes; persistent-dedupe=yes; replay0; new-hash-new-event=yes; immediate-offer=yes; pending-alarm=yes; alarm-at-300s=yes; duplicate-alarm0; bounded-state=100; AgentOps-writes=0");

function rootFromImportMeta(url) {
  return new URL(".", url).pathname.replace(/^\/(.:)/, "$1");
}
