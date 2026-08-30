import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { compileWake, enterWork, observeReadyBaseMovement, runSeatRefillCycle, simulateSaturation, validateNode } from "./pipeline-pilot.mjs";

const node = JSON.parse(fs.readFileSync(".agentops/pipeline-pilot/tickets/AS-PIPELINE-PILOT-001/nodes/implement.json", "utf8"));
const routes = JSON.parse(fs.readFileSync(".agentops/pipeline-pilot/risk-routes.json", "utf8"));

assert.equal(validateNode(node), true);
assert.equal(node.state, "ready");
assert.equal(node.base_oid, null);

const unrelatedNewHead = "f".repeat(40);
const firstObservation = observeReadyBaseMovement(node, "e".repeat(40));
const secondObservation = observeReadyBaseMovement(firstObservation.node, unrelatedNewHead);
assert.equal(secondObservation.node.base_oid, null, "an idle ready node remains unpinned when dev moves");
assert.deepEqual(firstObservation.events, []);
assert.deepEqual(secondObservation.events, []);

const currentBase = execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${node.base_ref}^{commit}`], { encoding: "utf8" }).trim();
const entered = enterWork(node, { writer: "local-pilot-writer", baseOid: currentBase });
assert.equal(entered.node.state, "executing");
assert.equal(entered.node.base_oid, currentBase);
assert.equal(entered.event.kind, "entered-work");
assert.equal(entered.event.base_oid, currentBase);

const wake = compileWake(node, routes);
assert.ok(wake.length < 6000, `wake packet too large: ${wake.length} characters`);
assert.ok(!wake.includes("AS-HD-029"), "wake packet leaked unrelated ticket context");

assert.throws(() => validateNode({ ...node, base_oid: currentBase }), /ready node must not pin/);
assert.throws(() => enterWork(node, { writer: "", baseOid: currentBase }), /missing writer/);
assert.throws(() => enterWork(node, { writer: "local-pilot-writer", baseOid: "not-an-oid" }), /valid object id/);
assert.throws(() => observeReadyBaseMovement(entered.node, unrelatedNewHead), /only to ready nodes/);
assert.throws(() => validateNode({ ...node, base_ref: "--upload-pack=unexpected" }), /safe Git ref/);

const saturationScenario = JSON.parse(fs.readFileSync(".agentops/pipeline-pilot/saturation-scenario.json", "utf8"));
const saturation = simulateSaturation(saturationScenario);
assert.deepEqual(saturation.initial_occupancy, { intake: 2, ready: 3, executing: 2, review: 2, integrate: 1, delivered: 2, closed: 1 });
assert.ok(Object.values(saturation.initial_occupancy).every((count) => count > 0), "every pipeline stage must be occupied concurrently");
assert.ok(saturation.concurrent_tickets >= 10, "multiple independent pipelines must remain concurrent");
assert.equal(saturation.throughput.closed, 2);
assert.equal(saturation.throughput.automatic_refills, 1);
assert.equal(saturation.throughput.dependency_wakes, 1);
assert.equal(saturation.events.find((event) => event.kind === "automatic-refill").node_id, "B-refill");
assert.equal(saturation.events.find((event) => event.kind === "dependency-wake").node_id, "J-wake");
assert.deepEqual(saturation.review_backpressure, ["D-review-wait"]);
assert.deepEqual(saturation.lock_serialized, ["K-locked"]);
assert.deepEqual(saturation.queue, { ready_count: 3, average_wait: 95 / 3, max_wait: 40, average_age: 860 / 13, max_age: 100 });
assert.ok(Object.values(saturation.final_occupancy).every((count) => count > 0), "stage occupancy must survive refill and wake transitions");

const rehearsalRoot = ".agentops/pipeline-pilot/rehearsals/zoom-scanner";
const rehearsalNode = JSON.parse(fs.readFileSync(`${rehearsalRoot}/node-executing.json`, "utf8"));
const rehearsalWake = JSON.parse(fs.readFileSync(`${rehearsalRoot}/WAKE.json`, "utf8"));
const rehearsalEvents = fs.readFileSync(`${rehearsalRoot}/EVENTS.jsonl`, "utf8").trim().split("\n").map(JSON.parse);
const reviewBackpressure = JSON.parse(fs.readFileSync(`${rehearsalRoot}/REVIEW_BACKPRESSURE.json`, "utf8"));
assert.equal(validateNode(rehearsalNode), true);
assert.deepEqual(JSON.parse(compileWake(rehearsalNode, routes)), rehearsalWake);
assert.ok(JSON.stringify(rehearsalWake).length < 6000, "rehearsal wake packet must remain bounded");
assert.deepEqual(rehearsalEvents.map((event) => event.sequence), [1, 2, 3, 4]);
assert.ok(rehearsalEvents.every((event) => event.mode === "read-only-rehearsal" && event.product_mutation === false));
assert.equal(rehearsalEvents.filter((event) => event.from === "ready" && event.to === "executing").length, 1);
assert.equal(rehearsalNode.resource_locks.length, 2);
assert.equal(reviewBackpressure.expected.bypass_count, 0);
assert.equal(reviewBackpressure.expected.unrelated_executing_work_continues, true);

const refillScenario = JSON.parse(fs.readFileSync(".agentops/pipeline-pilot/seat-refill-scenario.json", "utf8"));
const refill = runSeatRefillCycle(refillScenario);
assert.deepEqual(refill.metrics, { released: 2, refilled: 1, no_safe_assignment: 1, idle_alarms: 0, duplicate_assignments: 0 });
assert.equal(refill.events.find((event) => event.kind === "completion-triggered-refill").node_id, "safe-refill");
assert.equal(refill.events.find((event) => event.kind === "completion-triggered-refill").seat_id, "seat-dev");
assert.ok(JSON.stringify(refill.events.find((event) => event.kind === "completion-triggered-refill").wake).length < 2000);
assert.equal(refill.events.find((event) => event.status === "NO_SAFE_ASSIGNMENT").seat_id, "seat-art");
assert.ok(JSON.stringify(refill.events).length < 6000, "refill event output must remain bounded");
assert.equal(refill.state.nodes.filter((node) => node.id === "safe-refill")[0].stage, "executing");
assert.equal(refill.state.nodes.filter((node) => node.id === "unsafe-locked")[0].stage, "ready");
assert.equal(refill.state.nodes.filter((node) => node.id === "unsafe-dependency")[0].stage, "ready");
assert.equal(refill.state.nodes.filter((node) => node.id === "unsafe-authority")[0].stage, "ready");
assert.equal(refill.state.nodes.filter((node) => node.id === "unsafe-review-pressure")[0].stage, "ready");
assert.equal(refill.state.nodes.filter((node) => node.assigned_seat === "seat-dev").length, 1);
const alarm = runSeatRefillCycle({ ...refill.state, now: 231, completions: [] });
assert.equal(alarm.metrics.idle_alarms, 1);
assert.equal(alarm.events.find((event) => event.kind === "idle-age-alarm").seat_id, "seat-art");
assert.equal(alarm.events.find((event) => event.kind === "idle-age-alarm").idle_age, 31);
assert.ok(JSON.stringify(alarm.events).length < 6000, "idle alarm event output must remain bounded");

console.log(`PASS 51/51; wake=${wake.length} characters; ready events=0; entered-work events=1; saturation=${JSON.stringify(saturation.final_occupancy)}; transitions=${saturation.throughput.material_transitions}; refill=${saturation.throughput.automatic_refills}; dependency-wake=${saturation.throughput.dependency_wakes}; review-backpressure=${saturation.review_backpressure.length}; lock-serialized=${saturation.lock_serialized.length}; zoom-rehearsal-events=${rehearsalEvents.length}; zoom-locks=${rehearsalNode.resource_locks.length}; zoom-wake=${JSON.stringify(rehearsalWake).length}; completion-refill=${refill.metrics.refilled}; no-safe=${refill.metrics.no_safe_assignment}; idle-alarms=${alarm.metrics.idle_alarms}; duplicate-assignments=${refill.metrics.duplicate_assignments}; refill-events=${JSON.stringify(refill.events).length}; alarm-events=${JSON.stringify(alarm.events).length}; git-ref-option-injection=refused`);
