import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const pilotRoot = path.join(root, ".agentops", "pipeline-pilot");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function required(value, name) {
  if (value === undefined || value === null || value === "") throw new Error(`missing ${name}`);
}

function present(value, name) {
  if (value === undefined) throw new Error(`missing ${name}`);
}

function validOid(value) {
  return typeof value === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value);
}

export function validateNode(node) {
  const requiredFields = ["schema", "node_id", "ticket", "objective", "priority", "risk_route", "state", "required_capability", "dependencies", "base_ref", "first_action", "done_when", "affected_paths", "resource_locks", "evidence_targets"];
  for (const field of requiredFields) required(node[field], field);
  for (const field of ["base_oid", "owner", "writer", "blocker", "next_stage"]) present(node[field], field);
  if (node.schema !== "agentops/task-node/v1") throw new Error("unknown task node schema");
  if (!Array.isArray(node.dependencies)) throw new Error("dependencies must be an array");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(node.base_ref) || node.base_ref.includes("..") || node.base_ref.includes("//") || node.base_ref.endsWith("/")) throw new Error("base_ref must be a safe Git ref name");
  if (!Array.isArray(node.affected_paths) || node.affected_paths.length === 0) throw new Error("affected_paths must be non-empty");
  if (!Array.isArray(node.resource_locks)) throw new Error("resource_locks must be an array");
  if (!Array.isArray(node.evidence_targets)) throw new Error("evidence_targets must be an array");
  if (node.state === "ready" && node.base_oid !== null) throw new Error("ready node must not pin base_oid");
  if (["executing", "review", "integrate", "delivered", "closed"].includes(node.state) && !validOid(node.base_oid)) throw new Error(`${node.state} node must pin a valid base_oid`);
  return true;
}

export function observeReadyBaseMovement(node, observedBaseOid) {
  validateNode(node);
  if (node.state !== "ready") throw new Error("base movement observation applies only to ready nodes");
  if (!validOid(observedBaseOid)) throw new Error("observed base must be a valid object id");
  return { node, events: [] };
}

const pipelineStages = ["intake", "ready", "executing", "review", "integrate", "delivered", "closed"];

function occupancy(nodes) {
  return Object.fromEntries(pipelineStages.map((stage) => [stage, nodes.filter((node) => node.stage === stage).length]));
}

function resourcesOverlap(left, right) {
  return left.some((resource) => right.includes(resource));
}

export function simulateSaturation(scenario) {
  const state = structuredClone(scenario);
  required(state.observed_at, "observed_at");
  required(state.advance_to, "advance_to");
  if (!Array.isArray(state.nodes)) throw new Error("scenario nodes must be an array");
  if (state.advance_to <= state.observed_at) throw new Error("advance_to must be after observed_at");
  for (const node of state.nodes) {
    for (const field of ["id", "ticket", "stage", "created_at", "queued_at", "resource_locks"]) present(node[field], field);
    if (!pipelineStages.includes(node.stage)) throw new Error(`unknown simulation stage ${node.stage}`);
    if (!Array.isArray(node.dependencies) || !Array.isArray(node.resource_locks)) throw new Error("dependencies and resource_locks must be arrays");
  }

  const initialOccupancy = occupancy(state.nodes);
  const events = [];
  const closedIds = new Set(state.nodes.filter((node) => node.stage === "closed").map((node) => node.id));
  const reviewCapacity = state.capacities.review;

  for (const node of state.nodes.filter((candidate) => candidate.complete_at !== null && candidate.complete_at <= state.advance_to)) {
    if (node.stage === "executing" && node.next_stage === "review") {
      const used = state.nodes.filter((candidate) => candidate.stage === "review").length;
      if (used >= reviewCapacity) continue;
    }
    const from = node.stage;
    node.stage = node.next_stage;
    node.queued_at = state.advance_to;
    node.complete_at = null;
    events.push({ kind: "stage-transition", node_id: node.id, from, to: node.stage });
    if (node.stage === "closed") closedIds.add(node.id);
  }

  for (const node of state.nodes.filter((candidate) => candidate.stage === "intake" && candidate.dependencies.length > 0)) {
    if (node.dependencies.every((dependency) => closedIds.has(dependency))) {
      node.stage = "ready";
      node.queued_at = state.advance_to;
      events.push({ kind: "dependency-wake", node_id: node.id, to: "ready" });
    }
  }

  const activeLocks = state.nodes.filter((node) => node.stage === "executing").flatMap((node) => node.resource_locks);
  let executingFree = state.capacities.executing - state.nodes.filter((node) => node.stage === "executing").length;
  const ready = state.nodes.filter((node) => node.stage === "ready").sort((a, b) => a.queued_at - b.queued_at || a.id.localeCompare(b.id));
  for (const node of ready) {
    if (executingFree === 0) break;
    if (node.dependencies.some((dependency) => !closedIds.has(dependency))) continue;
    if (resourcesOverlap(node.resource_locks, activeLocks)) continue;
    node.stage = "executing";
    node.entered_at = state.advance_to;
    activeLocks.push(...node.resource_locks);
    executingFree -= 1;
    events.push({ kind: "automatic-refill", node_id: node.id, from: "ready", to: "executing" });
  }

  const finalOccupancy = occupancy(state.nodes);
  const initialReady = scenario.nodes.filter((node) => node.stage === "ready");
  const waitValues = initialReady.map((node) => scenario.observed_at - node.queued_at);
  const ageValues = scenario.nodes.map((node) => scenario.observed_at - node.created_at);
  const reviewBackpressure = state.nodes.filter((node) => node.stage === "executing" && node.next_stage === "review" && node.complete_at !== null && node.complete_at <= state.advance_to).map((node) => node.id);
  const lockSerialized = state.nodes.filter((node) => node.stage === "ready" && node.resource_locks.some((resource) => activeLocks.includes(resource))).map((node) => node.id);

  return {
    initial_occupancy: initialOccupancy,
    final_occupancy: finalOccupancy,
    concurrent_tickets: new Set(state.nodes.filter((node) => node.stage !== "closed").map((node) => node.ticket)).size,
    throughput: {
      material_transitions: events.length,
      closed: events.filter((event) => event.to === "closed").length,
      automatic_refills: events.filter((event) => event.kind === "automatic-refill").length,
      dependency_wakes: events.filter((event) => event.kind === "dependency-wake").length
    },
    queue: {
      ready_count: initialReady.length,
      average_wait: waitValues.reduce((sum, value) => sum + value, 0) / waitValues.length,
      max_wait: Math.max(...waitValues),
      average_age: ageValues.reduce((sum, value) => sum + value, 0) / ageValues.length,
      max_age: Math.max(...ageValues)
    },
    review_backpressure: reviewBackpressure,
    lock_serialized: lockSerialized,
    events,
    nodes: state.nodes
  };
}

const priorityRank = Object.freeze({ T0: 0, T1: 1, T2: 2, T3: 3, T4: 4 });

function refillSafety(node, seat, state, closedIds, activeLocks) {
  const reasons = [];
  if (!seat.capabilities.includes(node.required_capability)) reasons.push("capability");
  if (node.dependencies.some((dependency) => !closedIds.has(dependency))) reasons.push("dependency");
  if (resourcesOverlap(node.resource_locks, activeLocks)) reasons.push("resource-lock");
  if (node.required_authority.some((authority) => !seat.authority.includes(authority))) reasons.push("authority");
  if (node.requires_immediate_review_slot && state.review_occupancy >= state.review_capacity) reasons.push("review-backpressure");
  return reasons;
}

export function runSeatRefillCycle(input) {
  const state = structuredClone(input);
  if (!Array.isArray(state.nodes) || !Array.isArray(state.seats) || !Array.isArray(state.completions)) throw new Error("refill scenario requires nodes, seats, and completions");
  if (!Number.isFinite(state.now) || !Number.isFinite(state.idle_alarm_threshold) || state.idle_alarm_threshold < 0) throw new Error("invalid refill timing");
  const events = [];

  for (const completion of state.completions) {
    if (!["review", "closed"].includes(completion.terminal_state)) throw new Error("seat release requires terminal review or closed state");
    const seat = state.seats.find((candidate) => candidate.id === completion.seat_id);
    const node = state.nodes.find((candidate) => candidate.id === completion.node_id);
    if (!seat || !node || seat.assigned_node !== node.id) throw new Error("completion does not match the active seat assignment");
    node.stage = completion.terminal_state;
    node.terminal = true;
    node.assigned_seat = null;
    seat.assigned_node = null;
    seat.released_at = state.now;
    events.push({ kind: "seat-released", seat_id: seat.id, node_id: node.id, terminal_state: completion.terminal_state });
  }

  const closedIds = new Set(state.nodes.filter((node) => ["review", "closed"].includes(node.stage) && node.terminal === true).map((node) => node.id));
  const activeLocks = state.nodes.filter((node) => node.stage === "executing" && node.assigned_seat !== null).flatMap((node) => node.resource_locks);
  const alreadyAssigned = new Set(state.nodes.filter((node) => node.assigned_seat !== null).map((node) => node.id));
  const ready = state.nodes.filter((node) => node.stage === "ready" && !alreadyAssigned.has(node.id)).sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority] || left.queued_at - right.queued_at || left.id.localeCompare(right.id));

  for (const seat of state.seats.filter((candidate) => candidate.assigned_node === null)) {
    const considered = ready.filter((node) => !alreadyAssigned.has(node.id));
    const assessments = considered.map((node) => ({ node, reasons: refillSafety(node, seat, state, closedIds, activeLocks) }));
    const selected = assessments.find((assessment) => assessment.reasons.length === 0)?.node;
    if (selected) {
      selected.stage = "executing";
      selected.assigned_seat = seat.id;
      selected.entered_at = state.now;
      seat.assigned_node = selected.id;
      alreadyAssigned.add(selected.id);
      activeLocks.push(...selected.resource_locks);
      events.push({
        kind: "completion-triggered-refill",
        seat_id: seat.id,
        node_id: selected.id,
        priority: selected.priority,
        wake: {
          objective: selected.objective,
          first_action: selected.first_action,
          base_ref: selected.base_ref,
          resource_locks: selected.resource_locks,
          authority: selected.required_authority
        }
      });
      continue;
    }

    const age = state.now - seat.released_at;
    const alarm = age > state.idle_alarm_threshold;
    events.push({
      kind: alarm ? "idle-age-alarm" : "no-safe-assignment",
      status: alarm ? "IDLE_ALARM" : "NO_SAFE_ASSIGNMENT",
      seat_id: seat.id,
      idle_age: age,
      threshold: state.idle_alarm_threshold,
      rejected: assessments.map(({ node, reasons }) => ({ node_id: node.id, reasons }))
    });
  }

  state.completions = [];
  const assignedNodeIds = state.seats.filter((seat) => seat.assigned_node !== null).map((seat) => seat.assigned_node);
  const assignedSeatIds = state.nodes.filter((node) => node.assigned_seat !== null).map((node) => node.assigned_seat);
  return {
    state,
    events,
    metrics: {
      released: events.filter((event) => event.kind === "seat-released").length,
      refilled: events.filter((event) => event.kind === "completion-triggered-refill").length,
      no_safe_assignment: events.filter((event) => event.status === "NO_SAFE_ASSIGNMENT").length,
      idle_alarms: events.filter((event) => event.kind === "idle-age-alarm").length,
      duplicate_assignments: (assignedNodeIds.length - new Set(assignedNodeIds).size) + (assignedSeatIds.length - new Set(assignedSeatIds).size)
    }
  };
}

export function enterWork(node, { writer, baseOid }) {
  validateNode(node);
  if (node.state !== "ready") throw new Error("only a ready node may enter work");
  required(writer, "writer");
  required(baseOid, "baseOid");
  if (!validOid(baseOid)) throw new Error("baseOid must be a valid object id");
  const next = { ...node, state: "executing", writer, base_oid: baseOid };
  validateNode(next);
  const event = {
    schema: "agentops/pipeline-event/v1",
    ticket: node.ticket,
    node_id: node.node_id,
    kind: "entered-work",
    from: "ready",
    to: "executing",
    writer,
    base_oid: baseOid
  };
  return { node: next, event };
}

export function compileWake(node, routes) {
  validateNode(node);
  const route = routes.routes[node.risk_route];
  if (!route) throw new Error(`unknown risk route ${node.risk_route}`);
  return JSON.stringify({
    node_id: node.node_id,
    ticket: node.ticket,
    objective: node.objective,
    state: node.state,
    required_capability: node.required_capability,
    writer: node.writer,
    first_action: node.first_action,
    done_when: node.done_when,
    base_ref: node.base_ref,
    base_oid: node.base_oid,
    affected_paths: node.affected_paths,
    resource_locks: node.resource_locks,
    evidence_targets: node.evidence_targets,
    blocker: node.blocker,
    route,
    authority: {
      may: ["reversible-local-work", "tests", "local-commit"],
      protected_separately: routes.protected_actions
    }
  });
}

function main() {
  const nodePath = process.argv[2] ?? path.join(pilotRoot, "tickets", "AS-PIPELINE-PILOT-001", "nodes", "implement.json");
  const node = readJson(nodePath);
  const routes = readJson(path.join(pilotRoot, "risk-routes.json"));
  validateNode(node);
  const wake = compileWake(node, routes);
  const baseOid = execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${node.base_ref}^{commit}`], { cwd: root, encoding: "utf8" }).trim();
  const entered = enterWork(node, { writer: "local-pilot-writer", baseOid });
  console.log(JSON.stringify({
    verdict: "PASS",
    ready_base_oid: node.base_oid,
    ready_event_count: 0,
    entered_base_oid: entered.node.base_oid,
    entered_event_count: 1,
    wake_characters: wake.length,
    wake_under_1500_tokens_estimate: wake.length < 6000
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
