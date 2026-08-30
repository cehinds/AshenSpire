#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runLiveOffer } from "./pipeline-pilot-live.mjs";
import { assignLiveClaim } from "./pipeline-seat-assignment.mjs";

const agentopsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const terminalStates = new Set(["resolved", "released"]);

export function resolveGitStateFile(repoRoot) {
  const common = execFileSync("git", ["-C", repoRoot, "rev-parse", "--git-common-dir"], { encoding: "utf8", windowsHide: true }).trim();
  if (!common) throw new Error("git returned an empty common directory");
  return path.join(path.resolve(repoRoot, common), "agentops-pipeline", "state.json");
}

function git(repoRoot, args) {
  return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", windowsHide: true }).trim();
}

export function isFastForward(repoRoot, oldHead, newHead) {
  try {
    execFileSync("git", ["-C", repoRoot, "merge-base", "--is-ancestor", oldHead, newHead], { windowsHide: true, stdio: "ignore" });
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

export function validateAuthoritativeCheckout(repoRoot, authoritativeRef = "dev", fetchRemote = false) {
  if (fetchRemote) execFileSync("git", ["-C", repoRoot, "fetch", "--quiet", "origin", authoritativeRef], { windowsHide: true });
  const branch = git(repoRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const head = git(repoRoot, ["rev-parse", "HEAD"]);
  const remote = git(repoRoot, ["rev-parse", `refs/remotes/origin/${authoritativeRef}`]);
  const dirty = git(repoRoot, ["status", "--porcelain", "--untracked-files=no"]);
  if (branch !== authoritativeRef) throw new Error(`scheduler requires authoritative branch ${authoritativeRef}; found ${branch}`);
  if (head !== remote) throw new Error(`scheduler checkout is not current with origin/${authoritativeRef}`);
  if (dirty) throw new Error("scheduler authoritative checkout has tracked changes");
  return { branch, head, remote };
}

export function validateSourceIntegrity(root) {
  const tool = path.join(root, "tools", "opsctl.mjs");
  execFileSync(process.execPath, [tool, "verify"], { cwd: path.dirname(root), windowsHide: true, stdio: "pipe" });
  return true;
}

export function terminalIdentity(capsule) {
  if (!capsule || !terminalStates.has(capsule.lifecycle_state) || !capsule.ticket || !capsule.owner_actor || !capsule.current_hash) return null;
  const source = [capsule.ticket, capsule.current_hash, capsule.lifecycle_state, capsule.owner_actor].join("\n");
  return `sha256:${crypto.createHash("sha256").update(source).digest("hex")}`;
}

export function readState(file) {
  if (!fs.existsSync(file)) return { schema: "agentops/pipeline-watch-state/v1", processed: [], pending: [], observations: [] };
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  if (state.schema !== "agentops/pipeline-watch-state/v1") throw new Error("invalid pipeline watcher state schema");
  return state;
}

export function replaceStateFile(temp, file, rename = fs.renameSync, wait = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds), attempts = 20) {
  const retryable = new Set(["EPERM", "EACCES", "EBUSY"]);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rename(temp, file);
      return;
    } catch (error) {
      if (!retryable.has(error.code) || attempt === attempts) throw error;
      wait(25);
    }
  }
}

export function writeState(file, state, limit = 100) {
  const bounded = { ...state, observations: state.observations.slice(-limit) };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(bounded, null, 2)}\n`, { flag: "wx" });
  replaceStateFile(temp, file);
}

export function acquireWatcherLock(file, pid = process.pid) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, `${JSON.stringify({ pid, acquired_at: new Date().toISOString() })}\n`, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const owner = JSON.parse(fs.readFileSync(file, "utf8"));
    try { process.kill(owner.pid, 0); } catch (probe) {
      if (probe.code !== "ESRCH") throw new Error(`watcher lock cannot be validated: ${probe.code}`);
      fs.unlinkSync(file);
      return acquireWatcherLock(file, pid);
    }
    throw new Error(`pipeline watcher already active as pid ${owner.pid}`);
  }
  return () => {
    const owner = JSON.parse(fs.readFileSync(file, "utf8"));
    if (owner.pid === pid) fs.unlinkSync(file);
  };
}

export function scanTerminalCapsules(root) {
  const work = path.join(root, "work");
  if (!fs.existsSync(work)) return [];
  return fs.readdirSync(work, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => {
    const file = path.join(work, entry.name, "CURRENT.json");
    if (!fs.existsSync(file)) return [];
    const capsule = JSON.parse(fs.readFileSync(file, "utf8"));
    const event = terminalIdentity(capsule);
    return event ? [{ event, capsule }] : [];
  }).sort((a, b) => a.event.localeCompare(b.event));
}

function assignmentAttempt(root, result, options) {
  if (result.status !== "OFFERED" || !options.assign) return result;
  try {
    return { ...result, assignment: options.assign(root, { offer: result, now: options.now, runtimeConfigFile: options.runtimeConfigFile }) };
  } catch (error) {
    return { ...result, status: "NO_SAFE_ASSIGNMENT", assignment: { status: "FAILED", reason: String(error.message || error).slice(0, 240) } };
  }
}

export function cycle({ root = agentopsRoot, stateFile, now = new Date().toISOString(), limit = 100, offer = runLiveOffer, assign = null, runtimeConfigFile = null, idleAlarmSeconds = 300, initialize = false, sourceHead = null, allowSourceAdvance = false }) {
  const firstRun = !fs.existsSync(stateFile);
  const state = readState(stateFile);
  if (sourceHead && state.source_head && state.source_head !== sourceHead && !allowSourceAdvance) throw new Error(`non-fast-forward authoritative source drift: ${state.source_head} -> ${sourceHead}`);
  if (sourceHead) state.source_head = sourceHead;
  const terminals = scanTerminalCapsules(root);
  const currentTerminalEvents = new Set(terminals.map(({ event }) => event));
  const output = [];
  const processed = new Set(state.processed.filter((event) => currentTerminalEvents.has(event)));
  const pending = new Map(state.pending.filter((row) => currentTerminalEvents.has(row.event)).map((row) => [row.event, row]));
  const retryRows = [...pending.values()];
  if (firstRun && initialize) {
    for (const { event } of terminals) processed.add(event);
    state.initialized_at = now;
  }
  for (const { event, capsule } of terminals) {
    if (processed.has(event) || pending.has(event)) continue;
    const result = assignmentAttempt(root, offer(root, { releasedActor: capsule.owner_actor, completedTicket: capsule.ticket, releasedAt: now, now }), { assign, now, runtimeConfigFile });
    output.push({ event, observed_at: now, result });
    if (result.status === "NO_SAFE_ASSIGNMENT") pending.set(event, { event, ticket: capsule.ticket, actor: capsule.owner_actor, released_at: now, alarm_emitted: false });
    else if (result.status !== "OFFERED" || !assign || ["ASSIGNED", "ALREADY_ASSIGNED"].includes(result.assignment?.status)) processed.add(event);
  }
  for (const row of retryRows) {
    let result = assignmentAttempt(root, offer(root, { releasedActor: row.actor, completedTicket: row.ticket, releasedAt: row.released_at, now }), { assign, now, runtimeConfigFile });
    if (result.status === "NO_SAFE_ASSIGNMENT") {
      const alarmDue = (Date.parse(now) - Date.parse(row.released_at)) / 1000 >= idleAlarmSeconds;
      if (alarmDue && !row.alarm_emitted) {
        result = { ...result, status: "IDLE_ALARM" };
        row.alarm_emitted = true;
        output.push({ event: row.event, observed_at: now, result });
      }
      continue;
    }
    output.push({ event: row.event, observed_at: now, result });
    if (result.status !== "OFFERED" || !assign || ["ASSIGNED", "ALREADY_ASSIGNED"].includes(result.assignment?.status)) {
      processed.add(row.event);
      pending.delete(row.event);
    }
  }
  state.processed = [...processed];
  state.pending = [...pending.values()];
  state.observations.push(...output);
  state.last_scan_at = now;
  writeState(stateFile, state, limit);
  return { status: output.length ? "MATERIAL_CHANGE" : "QUIET", events: output, pending: state.pending.length };
}

async function main(argv = process.argv.slice(2)) {
  const value = (flag, fallback) => { const i = argv.indexOf(flag); return i < 0 ? fallback : argv[i + 1]; };
  const repoRoot = path.dirname(agentopsRoot);
  const activation = JSON.parse(fs.readFileSync(path.join(agentopsRoot, "pipeline-pilot", "activation.json"), "utf8"));
  const stateFile = path.resolve(value("--state", resolveGitStateFile(repoRoot)));
  const runtimeConfigFile = path.resolve(value("--seat-runtime", path.join(path.dirname(stateFile), "runtime", "seat-runtime.json")));
  const pollMs = Number(value("--poll-ms", "5000"));
  if (!Number.isInteger(pollMs) || pollMs < 100) throw new Error("poll-ms must be an integer >= 100");
  const releaseLock = acquireWatcherLock(path.join(path.dirname(stateFile), "watcher.lock"));
  try {
    do {
      const source = validateAuthoritativeCheckout(repoRoot, activation.authoritative_ref, true);
      const prior = readState(stateFile).source_head;
      if (!prior || prior !== source.head) validateSourceIntegrity(agentopsRoot);
      const allowSourceAdvance = Boolean(prior && prior !== source.head && isFastForward(repoRoot, prior, source.head));
      const result = cycle({ stateFile, initialize: true, sourceHead: source.head, allowSourceAdvance, assign: activation.mode === "LIVE_ASSIGNMENT" ? assignLiveClaim : null, runtimeConfigFile, idleAlarmSeconds: activation.idle_alarm_seconds });
      if (result.status !== "QUIET") console.log(JSON.stringify(result));
      if (argv.includes("--once")) break;
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    } while (true);
  } finally { releaseLock(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
