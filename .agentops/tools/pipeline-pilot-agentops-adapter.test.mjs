import assert from "node:assert/strict";
import { compileWake, validateNode } from "./pipeline-pilot.mjs";
import { observationFor, projectAgentOpsCapsule, readJson } from "./pipeline-pilot-agentops-adapter.mjs";

const capsule = readJson(".agentops/work/AS-1001/CURRENT.json");
const lease = readJson(`.agentops/leases/${capsule.writer_lease}.json`);
const compatibility = readJson(".agentops/pipeline-pilot/adoption/COMPATIBILITY_MAP.json");
const routes = readJson(".agentops/pipeline-pilot/risk-routes.json");
const currentness = readJson(".agentops/pipeline-pilot/adoption/CURRENTNESS.json");

const active = projectAgentOpsCapsule(capsule, lease, compatibility, { observedAt: "2026-08-30T00:00:00Z" });
assert.equal(validateNode(active.node), true);
assert.equal(active.node.state, "executing");
assert.equal(active.node.base_oid, capsule.base_oid);
assert.equal(active.node.writer, lease.actor);
assert.deepEqual(active.node.resource_locks, lease.path_globs.map((glob) => `path:${glob}`));
assert.equal(active.compatibility.reverse_write_permitted, false);

const assignedCapsule = { ...capsule, lifecycle_state: "assigned", current_hash: "sha256:assigned-shadow" };
const ready = projectAgentOpsCapsule(assignedCapsule, null, compatibility, { observedAt: "2026-08-30T00:00:00Z" });
assert.equal(ready.node.state, "ready");
assert.equal(ready.node.base_oid, null);
assert.equal(ready.node.writer, null);
assert.deepEqual(ready.node.resource_locks, []);
assert.equal(ready.compatibility.legacy_base_oid_ignored_while_ready, capsule.base_oid);

const released = projectAgentOpsCapsule({ ...capsule, lifecycle_state: "released", current_hash: "sha256:released-shadow" }, null, compatibility, { observedAt: "2026-08-30T00:00:00Z" });
assert.equal(released.node.state, "closed");
assert.equal(released.node.writer, null);
assert.deepEqual(released.node.resource_locks, []);
assert.equal(released.compatibility.released_fact, true);

assert.throws(() => projectAgentOpsCapsule(capsule, null, compatibility, { observedAt: "2026-08-30T00:00:00Z" }), /requires.*lease/);
assert.throws(() => projectAgentOpsCapsule(capsule, { ...lease, revoked: true }, compatibility, { observedAt: "2026-08-30T00:00:00Z" }), /revoked/);
assert.throws(() => projectAgentOpsCapsule(capsule, { ...lease, base_oid: "f".repeat(40) }, compatibility, { observedAt: "2026-08-30T00:00:00Z" }), /base mismatch/);
assert.throws(() => projectAgentOpsCapsule({ ...capsule, lifecycle_state: "unknown" }, lease, compatibility, { observedAt: "2026-08-30T00:00:00Z" }), /unmapped/);

const packet = compileWake(active.node, routes);
const observation = observationFor(active, packet.length);
assert.ok(packet.length < 6000);
assert.equal(observation.protected_action_attempts, 0);
assert.equal(observation.projection_drift, 0);
assert.equal(observation.source_current_hash, capsule.current_hash);
assert.ok(JSON.stringify(observation).length < 2000);
assert.equal(currentness.live_base_drift_detected, false);
assert.equal(currentness.candidate_state, "PR_READY_LIVE_OFFER_NOT_DELIVERED");

console.log(`PASS 25/25; AgentOps-authoritative=yes; shadow-stage=${active.node.state}; ready-base=null; ready-locks=0; released-writer=null; wake=${packet.length}; observation=${JSON.stringify(observation).length}; protected-attempts=0; reverse-writes=false; live-drift-detected=${currentness.live_base_drift_detected}; candidate=${currentness.candidate_state}`);
