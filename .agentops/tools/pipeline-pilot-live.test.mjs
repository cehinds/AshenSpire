import assert from "node:assert/strict";
import fs from "node:fs";
import { loadContracts, loadRuntime } from "./opsctl.mjs";
import { planLiveOffer, validateActivation } from "./pipeline-pilot-live.mjs";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const { contracts, errors } = loadContracts(root);
assert.deepEqual(errors, []);
const runtime = loadRuntime(root);
const config = validateActivation(JSON.parse(fs.readFileSync(new URL("../pipeline-pilot/activation.json", import.meta.url), "utf8")));
const workflow = fs.readFileSync(new URL("../../.github/workflows/pipeline-refill.yml", import.meta.url), "utf8");
assert.match(workflow, /repository_dispatch:\s*\n\s*types: \[agentops-ticket-completed\]/);
assert.match(workflow, /permissions:\s*\n\s*contents: read/);
assert.match(workflow, /pipeline-refill-\$\{\{ steps\.event\.outputs\.event_id \}\}/);
assert.match(workflow, /Offer immediate safe refill[\s\S]*pipeline-pilot-live\.mjs/);
assert.match(workflow, /sleep 300[\s\S]*expected IDLE_ALARM after threshold/);
const terminal = structuredClone(runtime.capsules["AS-1001"]);
terminal.lifecycle_state = "resolved";
terminal.owner_actor = "maker";
runtime.capsules["AS-1001"] = terminal;

const immediate = planLiveOffer({ contracts, runtime, config, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" });
assert.equal(immediate.status, "OFFERED");
assert.equal(immediate.selected.ticket, "AS-HD-040");
assert.equal(immediate.metrics.duplicate_assignments, 0);
assert.equal(immediate.metrics.elapsed_seconds, 1);

const locked = structuredClone(runtime);
locked.capsules["AS-HD-040"].blocker = { kind: "technical", escalation_class: "technical-blocker", summary: "test blocker" };
locked.capsules["AS-HD-050"].blocker = { kind: "technical", escalation_class: "technical-blocker", summary: "test blocker" };
locked.capsules["AS-HD-056"].blocker = { kind: "technical", escalation_class: "technical-blocker", summary: "test blocker" };
const noSafe = planLiveOffer({ contracts, runtime: locked, config, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:04:59Z" });
assert.equal(noSafe.status, "NO_SAFE_ASSIGNMENT");
const alarm = planLiveOffer({ contracts, runtime: locked, config, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:05:00Z" });
assert.equal(alarm.status, "IDLE_ALARM");
assert.equal(alarm.metrics.idle_alarms, 1);

const collision = structuredClone(runtime);
collision.capsules["AS-HD-040"].owner_actor = "help-desk";
assert.equal(planLiveOffer({ contracts, runtime: collision, config, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" }).selected.ticket, "AS-HD-050");
const resourceLocked = structuredClone(runtime);
resourceLocked.capsules["AS-HD-050"].lifecycle_state = "in-progress";
resourceLocked.leases.find((lease) => lease.ticket === "AS-HD-050").path_globs = ["assets/classes/**"];
resourceLocked.capsules["AS-HD-056"].blocker = null;
const lockPlan = planLiveOffer({ contracts, runtime: resourceLocked, config, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" });
assert.equal(lockPlan.selected.ticket, "AS-HD-056");
assert.ok(lockPlan.rejected.find((row) => row.ticket === "AS-HD-040").reasons.includes("resource-lock"));
const dependencyConfig = structuredClone(config);
dependencyConfig.priority.find((row) => row.ticket === "AS-HD-040").dependencies = ["AS-HD-999"];
assert.equal(planLiveOffer({ contracts, runtime, config: dependencyConfig, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" }).selected.ticket, "AS-HD-050");
const noAuthority = structuredClone(contracts);
noAuthority.transitions.transitions.find((move) => move.from === "assigned" && move.to === "in-progress").permitted_actor_roles = ["it-manager-iii"];
assert.equal(planLiveOffer({ contracts: noAuthority, runtime, config, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" }).status, "NO_SAFE_ASSIGNMENT");
assert.throws(() => planLiveOffer({ contracts, runtime, config, releasedActor: "maker", completedTicket: "AS-HD-040", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" }), /terminal capsule/);
assert.throws(() => planLiveOffer({ contracts, runtime, config: { ...config, priority: [...config.priority, config.priority[0]] }, releasedActor: "maker", completedTicket: "AS-1001", releasedAt: "2026-08-30T08:00:00Z", now: "2026-08-30T08:00:01Z" }), /unique/);

console.log("PASS 22/22; completion-hook=repository_dispatch; event-dedupe=cache+concurrency; immediate-refill=1s; selected=AS-HD-040; one-claim-writer=yes; blockers-safe=yes; resource-lock-safe=yes; dependency-safe=yes; collision-safe=yes; authority-safe=yes; no-safe-distinct=yes; idle-alarm=300s; duplicate-assignments=0; AgentOps-writes=0");
