import fs from "node:fs";

function requireValue(value, name) {
  if (value === undefined || value === null || value === "") throw new Error(`missing ${name}`);
}

export function projectAgentOpsCapsule(capsule, lease, compatibility, { observedAt }) {
  if (capsule.schema !== "agentops/work-capsule/v1") throw new Error("unsupported capsule schema");
  if (compatibility.schema !== "agentops/pipeline-compatibility-map/v1") throw new Error("unsupported compatibility map");
  requireValue(observedAt, "observedAt");
  const stage = compatibility.lifecycle[capsule.lifecycle_state];
  if (!stage) throw new Error(`unmapped AgentOps lifecycle state ${capsule.lifecycle_state}`);
  const ready = stage === "ready";
  const requiresActiveLease = ["executing", "review", "integrate"].includes(stage);

  if (requiresActiveLease) {
    if (!lease || lease.schema !== "agentops/lease/v1") throw new Error("active projection requires the referenced AgentOps lease");
    if (lease.id !== capsule.writer_lease || lease.ticket !== capsule.ticket) throw new Error("capsule and lease identity mismatch");
    if (lease.revoked) throw new Error("referenced AgentOps lease is revoked");
    if (lease.base_oid !== capsule.base_oid) throw new Error("capsule and lease base mismatch");
    if (Date.parse(lease.expiry) <= Date.parse(observedAt)) throw new Error("referenced AgentOps lease is expired");
  }

  const node = {
    schema: "agentops/task-node/v1",
    node_id: `${capsule.ticket}-SHADOW`,
    ticket: capsule.ticket,
    objective: capsule.objective,
    priority: "T2",
    risk_route: "reversible-docs",
    state: stage,
    required_capability: capsule.owner_actor,
    dependencies: [],
    base_ref: capsule.ref,
    base_oid: ready ? null : capsule.base_oid,
    owner: capsule.owner_actor,
    writer: requiresActiveLease ? lease.actor : null,
    first_action: capsule.next_action,
    done_when: capsule.done_when,
    affected_paths: capsule.affected_paths,
    resource_locks: requiresActiveLease ? lease.path_globs.map((glob) => `path:${glob}`) : [],
    evidence_targets: [
      `agentops-current:${capsule.current_hash}`,
      `agentops-tree:${capsule.tree}`,
      ...capsule.evidence_pointers
    ],
    blocker: capsule.blocker,
    next_stage: stage === "closed" ? null : "review"
  };
  const compatibilityEvidence = {
    authoritative_source: "AgentOps",
    pipeline_mode: "read-only-shadow",
    source_lifecycle_state: capsule.lifecycle_state,
    source_current_hash: capsule.current_hash,
    source_lease: requiresActiveLease ? lease.id : null,
    legacy_base_oid_ignored_while_ready: ready ? capsule.base_oid : null,
    released_fact: capsule.lifecycle_state === "released",
    reverse_write_permitted: false
  };
  return { node, compatibility: compatibilityEvidence };
}

export function observationFor(projection, packetCharacters, observationAge = 0) {
  return {
    schema: "agentops/pipeline-observation/v1",
    mode: "read-only-shadow",
    source_current_hash: projection.compatibility.source_current_hash,
    source_lease: projection.compatibility.source_lease,
    projected_stage: projection.node.state,
    projection_drift: 0,
    refill_recommendations: 0,
    no_safe_assignment: 0,
    idle_alarms: 0,
    duplicate_assignments: 0,
    protected_action_attempts: 0,
    packet_characters: packetCharacters,
    observation_age: observationAge
  };
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
