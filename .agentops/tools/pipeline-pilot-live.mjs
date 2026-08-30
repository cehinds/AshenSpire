#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { actorRole, globCovers, loadContracts, loadRuntime, runValidate, runWake, utcInstant } from "./opsctl.mjs";

const agentopsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.dirname(agentopsRoot);
const priorityRank = Object.freeze({ T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 });

function overlap(left, right) {
  return left.some((a) => right.some((b) => globCovers(a, b) || globCovers(b, a)));
}

export function validateActivation(config) {
  if (config?.schema !== "agentops/pipeline-activation/v1") throw new Error("invalid pipeline activation schema");
  if (typeof config.enabled !== "boolean" || config.mode !== "LIVE_OFFER") throw new Error("pipeline activation must declare LIVE_OFFER mode");
  if (!Number.isInteger(config.tracking_issue) || config.tracking_issue < 1) throw new Error("tracking_issue must be a positive integer");
  if (!Number.isFinite(config.idle_alarm_seconds) || config.idle_alarm_seconds < 0) throw new Error("idle_alarm_seconds must be non-negative");
  if (!Array.isArray(config.priority) || new Set(config.priority.map((row) => row.ticket)).size !== config.priority.length) throw new Error("priority must contain unique ticket rows");
  for (const row of config.priority) {
    if (!row.ticket || !(row.rank in priorityRank) || !Array.isArray(row.dependencies)) throw new Error("invalid priority row");
  }
  return config;
}

export function planLiveOffer({ contracts, runtime, config, releasedActor, completedTicket, releasedAt, now }) {
  validateActivation(config);
  const nowMs = utcInstant(now);
  const releasedMs = utcInstant(releasedAt);
  if (nowMs === null || releasedMs === null || releasedMs > nowMs) throw new Error("releasedAt and now must be ordered real UTC instants");
  if (!releasedActor || !completedTicket) throw new Error("released actor and completed ticket are required");
  if (!config.enabled) return { status: "DISABLED", tracking_issue: config.tracking_issue, offers: [], rejected: [], metrics: { offers: 0, idle_alarms: 0, duplicate_assignments: 0 } };

  const completed = runtime.capsules[completedTicket];
  if (!completed || completed.owner_actor !== releasedActor || !config.completion_states.includes(completed.lifecycle_state)) {
    throw new Error("completion does not identify a terminal capsule owned by the released actor");
  }

  const activeCapsules = Object.values(runtime.capsules).filter((cap) => cap.ticket !== completedTicket && ["in-progress", "local", "qa-review"].includes(cap.lifecycle_state));
  const activeLeases = activeCapsules.map((cap) => runtime.leases.find((lease) => lease.id === cap.writer_lease)).filter(Boolean);
  const transition = contracts.transitions.transitions.find((move) => move.from === "assigned" && move.to === "in-progress" && !move.protected);
  const role = actorRole(contracts, releasedActor);
  const rows = [...config.priority].sort((a, b) => priorityRank[a.rank] - priorityRank[b.rank] || a.ticket.localeCompare(b.ticket));
  const rejected = [];

  for (const row of rows) {
    const reasons = [];
    const cap = runtime.capsules[row.ticket];
    const lease = cap && runtime.leases.find((candidate) => candidate.id === cap.writer_lease);
    if (!cap) reasons.push("missing-capsule");
    else {
      if (cap.lifecycle_state !== "assigned") reasons.push("not-ready");
      if (cap.blocker) reasons.push("blocked");
      if (cap.owner_actor !== releasedActor) reasons.push("different-owner");
    }
    if (!lease) reasons.push("missing-lease");
    else {
      if (lease.revoked) reasons.push("revoked-lease");
      if (lease.actor !== releasedActor || lease.ticket !== row.ticket) reasons.push("claim-mismatch");
      const expiry = utcInstant(lease.expiry);
      if (expiry === null || expiry <= nowMs) reasons.push("expired-lease");
      if (overlap(lease.path_globs, activeLeases.flatMap((active) => active.path_globs))) reasons.push("resource-lock");
    }
    if (!transition || !transition.permitted_actor_roles.includes(role)) reasons.push("authority");
    if (row.dependencies.some((ticket) => !config.completion_states.includes(runtime.capsules[ticket]?.lifecycle_state))) reasons.push("dependency");
    if (!reasons.length) {
      return {
        status: "OFFERED",
        tracking_issue: config.tracking_issue,
        completed_ticket: completedTicket,
        released_actor: releasedActor,
        selected: { ticket: row.ticket, rank: row.rank, lease: lease.id, ref: lease.ref, next_action: cap.next_action },
        rejected,
        metrics: { offers: 1, idle_alarms: 0, duplicate_assignments: 0, elapsed_seconds: (nowMs - releasedMs) / 1000 },
        authority: config.authority,
      };
    }
    rejected.push({ ticket: row.ticket, reasons: [...new Set(reasons)].sort() });
  }

  const elapsed = (nowMs - releasedMs) / 1000;
  const alarm = elapsed >= config.idle_alarm_seconds;
  return {
    status: alarm ? "IDLE_ALARM" : "NO_SAFE_ASSIGNMENT",
    tracking_issue: config.tracking_issue,
    completed_ticket: completedTicket,
    released_actor: releasedActor,
    selected: null,
    rejected,
    metrics: { offers: 0, idle_alarms: alarm ? 1 : 0, duplicate_assignments: 0, elapsed_seconds: elapsed },
    authority: config.authority,
  };
}

export function runLiveOffer(root, options) {
  const checked = runValidate(root);
  if (checked.errors.length) throw new Error(`AgentOps validation failed: ${checked.errors.join("; ")}`);
  const config = validateActivation(JSON.parse(fs.readFileSync(path.join(root, "pipeline-pilot", "activation.json"), "utf8")));
  const runtime = loadRuntime(root);
  const result = planLiveOffer({ contracts: checked.contracts, runtime, config, ...options });
  if (result.status === "OFFERED") {
    const wake = runWake(root, options.releasedActor, result.selected.ticket);
    if (wake.errors?.length) throw new Error(`bounded wake failed: ${wake.errors.join("; ")}`);
    result.wake = wake.text;
    result.wake_characters = wake.text.length;
  }
  return result;
}

function main(argv = process.argv.slice(2)) {
  const value = (flag) => { const index = argv.indexOf(flag); return index === -1 ? null : argv[index + 1]; };
  const releasedActor = value("--actor");
  const completedTicket = value("--completed");
  const releasedAt = value("--released-at");
  const now = value("--now") ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  if (!releasedActor || !completedTicket || !releasedAt) throw new Error("usage: pipeline-pilot-live.mjs --actor <actor> --completed <terminal-ticket> --released-at <UTC> [--now <UTC>]");
  const result = runLiveOffer(agentopsRoot, { releasedActor, completedTicket, releasedAt, now });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
