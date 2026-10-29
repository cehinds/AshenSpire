import { gameModule, gameContent } from '../model/gameProfile.js';
// src/engine/actmap.js — the ONE act-boot path: generate the act's map, then
// pre-roll every unknown (?) node (EldenSpire#54).
//
// WHY THIS FILE EXISTS. This sequence used to live three times — main.js
// buildActMap(), tools/runsim.mjs's per-act loop, tools/session.mjs buildMap()
// — three copies of one fact with nothing checking they agree. When
// resolveUnknownNode grew its required `act` argument, the change reached
// main.js and neither harness: the game was fine while the completability
// evidence machine exited 1 on every run (fix/harness-act-plumbing, 5caf115).
// A signature can only be hand-carried to N copies N ways; with one copy there
// is nothing to carry. Game and harnesses MUST import this — a new caller that
// inlines the sequence is reintroducing the defect class this file deletes.
//
// SEEDING CONTRACT (deliberate, and callers depend on it): draws happen in
// exactly the order the three copies made them — the 'map' stream inside
// generateActMap, then one 'events'-stream roll per event node in
// Object.values(nodes) order, each resolved event id joining the no-repeat
// list. Extraction changed the home of this code and not one draw, so
// existing seeds replay identically (gated: runsim/session-smoke green at the
// extraction commit).
//
// Headless: pure function of (registries, rng, act) — no DOM, no storage.

import { generateActMap, assignBossDestinations } from './mapgen.js';
import { resolveUnknownNode } from './encounters.js';
import { applyRunShape } from '../model/floorplan.js';
import { MAP_SHAPE_LIMITS, LEGACY_ACT_BOSSES } from '../content/mapconfig.js';
import { defaultSeatOrder, encounterFitsSeat, finalTier } from '../model/seats.js';
import { bossDestinationLabel } from '../model/bossDestinationLabels.js';

/**
 * buildActMap(registries, rng, act, mapShape, { history }) → mapGraph
 *
 * `history` is the run's choice history at map birth (quest steps, E12): an
 * event gated on an earlier choice enters this act's Unknown nodes only once
 * that choice was made — so an act answers the acts before it. Absent ⇒ the
 * ungated pool, byte-for-byte today's act for every existing seed.
 *
 * `act` is the CONTENT act (the caller answers Endless looping — main.js and
 * the tools pass their contentAct), required for the same reason
 * resolveUnknownNode requires it: guessing act 1 would be a default nobody
 * authored. Unknown (?) nodes come back with `.resolved` already set, so a
 * node's outcome is seed-determined at map birth and the Sealstone Key can
 * reveal it (SPEC §6).
 *
 * `mapShape` is the Custom Climb debug shape (`run.custom.mapShape`) or null.
 * It is applied HERE, in the one act-boot path, for exactly the reason this file
 * exists: a per-run override applied at each of the four call sites would be
 * four copies of one fact, and the fourth would be the one that forgets. Absent
 * ⇒ byte-for-byte today's act, so every existing seed replays unchanged.
 *
 * A shape that does not resolve THROWS and names the knob. The screen refuses
 * it before the run starts (ui/screens/customRun.js), so reaching this throw
 * means a shape arrived from somewhere the screen does not guard — a hand-edited
 * save, a future caller. That is precisely when a loud failure is worth its cost.
 */
export function buildActMap(registries, rng, seat, tier, mapShape = null, { history = [] } = {}) {
  // SPEC §13.2: the SEAT names the content, the TIER names the geometry. A
  // number in the seat slot is a caller still passing an act — refused by
  // name rather than read as a seat that does not exist.
  if (typeof seat !== 'string' || !seat) throw new Error(`buildActMap: a seat id is required, got ${JSON.stringify(seat)} (SPEC §13.2)`);
  if (!Number.isInteger(tier) || tier < 1) throw new Error(`buildActMap: tier must be a positive integer, got ${JSON.stringify(tier)}`);
  registries.seats.get(seat); // an unknown seat throws by name here, before any draw
  if (registries.gameProfile?.foundation.mode === 'configured' && !gameModule(registries, 'routes')) return buildGameProfileActivities(registries, rng, seat, tier);
  if (gameModule(registries, 'routes')?.mode === 'configured') return buildGameProfileActMap(registries, rng, seat, tier, { history });
  const authored = registries.mapConfig(tier);
  const shaped = applyRunShape(authored, mapShape, MAP_SHAPE_LIMITS);
  if (shaped.errors.length) {
    throw new Error(`buildActMap: this run's map shape does not resolve — ${
      shaped.errors.map((e) => `${e.key}: ${e.msg}`).join(' · ')}`);
  }
  const map = generateActMap({ config: shaped.config, rng });
  const assigned = [];
  for (const node of Object.values(map.nodes)) {
    if (node.type === 'event') {
      node.resolved = resolveUnknownNode(registries, rng, { seenEvents: assigned, tier, history });
      if (node.resolved.kind === 'event') assigned.push(node.resolved.eventId);
    }
  }
  // The boss pool is the seat's boss rows PLUS, at the final tier, the one
  // null-seat row (SPEC §13.5) — filtered in bundle order, never appended, so
  // the columns each destination lands in are the columns it always landed in
  // (§13.6: the Valkyrie row keeps its place in reach.js for exactly this).
  const fit = { seat, tier, finalTier: finalTier(registries) };
  const pool = registries.encounters.all().filter((encounter) => encounter.pool === 'boss' && encounterFitsSeat(encounter, fit));
  if (!pool.length) throw new Error(`buildActMap: seat '${seat}' has no boss encounters`);
  // Every available slot has a different destination. When a narrow custom
  // map cannot fit the pool, choose a seeded subset without replacement.
  const selected = pool.length > map.columns ? rng.shuffle('map', pool).slice(0, map.columns) : pool;
  return assignBossDestinations(map, selected.map((encounter) => ({
    encounterId: encounter.id,
    label: bossDestinationLabel(registries, encounter.id),
  })));
}

/** Authoritative encounter identity for solo, LAN, and simulations. Read-only:
 * loading/entering a legacy terminal never rerolls or regenerates its graph.
 * `{ seat, tier }`: a legacy singular graph (no `bossIds`) maps by TIER through
 * LEGACY_ACT_BOSSES — such a graph only exists in a pre-§13 save, which the
 * load door gives the default order, so tier n is the seat act n always was. */
export function bossEncounterForNode(registries, graph, nodeId, { seat, tier } = {}) {
  if (typeof seat !== 'string' || !seat || !Number.isInteger(tier)) throw new Error('bossEncounterForNode: pass { seat, tier } (SPEC §13.2)');
  const node = graph?.nodes?.[nodeId];
  if (!node || node.type !== 'boss') throw new Error(`Boss destination '${nodeId}' is not a boss node`);
  const encounterId = node.encounterId || (!graph.bossIds && graph.bossId === nodeId ? LEGACY_ACT_BOSSES[tier] : null);
  const encounter = encounterId && registries.encounters.has(encounterId) ? registries.encounters.get(encounterId) : null;
  if (!encounter || encounter.pool !== 'boss' || !encounterFitsSeat(encounter, { seat, tier, finalTier: finalTier(registries) })) {
    throw new Error(`Boss destination '${nodeId}' has no valid encounter for seat '${seat}' at tier ${tier}`);
  }
  return encounterId;
}

/**
 * drawSeatOrder(registries, rng, { firstSeat }) → seat ids, seeded (SPEC §13.4).
 *
 * ONE draw, on the `seats` stream and no other, so every pre-existing stream's
 * counters and values are untouched for every existing seed (§13.6). A pinned
 * first seat ROTATES the drawn order rather than skipping the draw: one draw
 * either way, so pinning changes nothing any later stream rolls.
 */
export function drawSeatOrder(registries, rng, { firstSeat = null } = {}) {
  const drawn = rng.shuffle('seats', defaultSeatOrder(registries));
  if (firstSeat == null) return drawn;
  const at = drawn.indexOf(firstSeat);
  if (at < 0) throw new Error(`drawSeatOrder: unknown first seat '${firstSeat}'`);
  return [...drawn.slice(at), ...drawn.slice(0, at)];
}


// Configured length counts depths, not the alternatives offered at each depth.
// Mandatory rest depths merge every lane, so every route visits each rest once.
export function buildGameProfileActMap(registries, rng, seat, tier, { history = [] } = {}) {
  const rules = gameContent(registries, 'routes');
  if (!rules || tier < 1 || tier > rules.acts) throw new Error('Configured route tier is out of range');
  const count = rules.prebossNodes;
  const columns = rules.branchColumns;
  if (!Number.isInteger(count) || count < 1 || count < rules.restsPerAct) throw new Error('Invalid configured route length');
  if (!Number.isInteger(columns) || columns < 2 || columns > 5) throw new Error('Invalid configured branchColumns');
  const minimumThreatFloor = rules.minimumThreatFloor;
  if (!Number.isInteger(minimumThreatFloor) || minimumThreatFloor < 1 || count + 1 < minimumThreatFloor) throw new Error('Invalid configured minimumThreatFloor');
  const restFloors = rules.restFloors;
  if (!Array.isArray(restFloors)) throw new Error('Configured route requires authored restFloors');
  if (restFloors.length !== rules.restsPerAct || new Set(restFloors).size !== rules.restsPerAct || restFloors.some(n => !Number.isInteger(n) || n < 1 || n > count)) throw new Error('Invalid configured rest floors');
  if (rules.requirePrebossRest && !restFloors.includes(count)) throw new Error('Configured route requires a rest immediately before the boss');
  const firstFloor = rules.firstFloor ?? null;
  const shopShare = rules.shopShare ?? null;
  if (shopShare !== null && !(shopShare >= 0 && shopShare <= 1)) throw new Error('Invalid configured shopShare');
  const displayTypes = { fight: 'monster', event: 'event', elite: 'elite', treasure: 'treasure', shop: 'merchant', rest: 'shrine', boss: 'boss' };
  const hidden = new Set(rules.hiddenTypes);
  const alternatives = [...new Set([...(rules.hiddenTypes || []), ...(rules.visibleTypes || [])])].filter(type => !['rest', 'boss'].includes(type));
  if (!alternatives.length || alternatives.some(type => !displayTypes[type])) throw new Error('Invalid configured route node types');
  // firstFloor (owner, 2026-10-18): depth 1 is forced to one authored node type, so a run can open on a fight. It must be a
  // real alternative (never rest or boss), an elite only where minimumThreatFloor allows depth 1, and depth 1 cannot also be a rest depth
  // (a rest floor is a single shared node, not a lane per type).
  if (firstFloor !== null && (!alternatives.includes(firstFloor) || restFloors.includes(1) || (firstFloor === 'elite' && minimumThreatFloor > 1))) throw new Error('Invalid configured firstFloor');
  const hideUnknown = gameModule(registries, 'routes').hideUnknownNodes;
  // maxBranches (owner, 2026-10-25): present means the act splits into 1..min(maxBranches, distinct bosses) branches after a shared
  // opening depth. Absent keeps the single-trunk map below, draw for draw, so older profiles and seeds roll the same maps.
  if (rules.maxBranches != null) {
    return buildBranchedActMap(registries, rng, seat, tier, {
      rules, count, columns, minimumThreatFloor, restFloors, firstFloor, shopShare, displayTypes, hidden, alternatives, hideUnknown, history,
    });
  }
  const nodes = {}, layers = [], seenEvents = [];
  for (let floor = 1; floor <= count; floor++) {
    const rest = restFloors.includes(floor);
    const layer = [];
    const choices = alternatives.filter(type => type !== 'elite' || floor >= minimumThreatFloor);
    if (!rest && !choices.length) throw new Error(`Configured route has no permitted node types at depth ${floor}`);
    for (let lane = 0; lane < (rest ? 1 : columns); lane++) {
      const id = `n${floor}_${lane}`;
      const forced = !rest && floor === 1 && firstFloor !== null;
      // A forced opening node is drawn as what it is even when hidden types show as '?': the player must see the opening fight.
      let actual = rest ? 'rest' : forced ? firstFloor : rng.pick('map', choices);
      // shopShare (owner ruling D9): of the randomly typed nodes (elites stay as drawn), 15% are shops and the rest keep the even
      // event/fight/treasure split. Absent shopShare keeps the old even draw, so older profiles roll the same maps.
      if (!rest && !forced && shopShare != null && alternatives.includes('shop') && actual !== 'elite') {
        const plain = alternatives.filter(type => type !== 'elite' && type !== 'shop');
        actual = rng.chance('map', shopShare * 100) || !plain.length ? 'shop' : rng.pick('map', plain);
      }
      const type = hideUnknown && hidden.has(actual) && !forced ? 'event' : displayTypes[actual];
      const node = { id, floor, col: rest ? (columns - 1) / 2 : lane, type, actualType: actual, next: [] };
      if (type === 'event') {
        node.resolved = actual === 'event' ? resolveUnknownNode({ ...registries, mapConfig: () => ({ unknownWeights: { event: 1 } }) }, rng, { seenEvents, tier, history }) : { kind: actual === 'shop' ? 'merchant' : actual };
        if (node.resolved.kind === 'event') seenEvents.push(node.resolved.eventId);
      }
      nodes[id] = node;
      layer.push(id);
    }
    layers.push(layer);
  }
  const pool = registries.encounters.all().filter(enc => enc.pool === 'boss' && encounterFitsSeat(enc, { seat, tier, finalTier: rules.acts }));
  if (!pool.length) throw new Error(`Configured route has no boss for ${seat}/${tier}`);
  const boss = rng.pick('map', pool);
  nodes.boss = { id: 'boss', floor: count + 1, col: (columns - 1) / 2, type: 'boss', actualType: 'boss', next: [], encounterId: boss.id, label: bossDestinationLabel(registries, boss.id) };
  layers.push(['boss']);
  for (let depth = 0; depth < layers.length - 1; depth++) {
    const current = layers[depth], next = layers[depth + 1];
    for (const id of current) {
      // Singleton rests/bosses merge or fan out; other depths connect adjacent
      // lanes, including a straight continuation for every incoming lane.
      nodes[id].next = next.filter(target => current.length === 1 || next.length === 1 || Math.abs(nodes[id].col - nodes[target].col) <= 1);
    }
  }
  return { nodes, startIds: layers[0], shrineId: restFloors.length ? `n${Math.max(...restFloors)}_0` : null, bossId: 'boss', bossIds: ['boss'], floors: count + 1, columns, gameProfileHash: registries.gameProfile.hash };
}


/**
 * Branched act map (owner, 2026-10-25; sub-branches 2026-10-27). Depth 1 is ONE start node (n1_0, centred) that reaches the opening node(s) of every branch; it refills
 * HP and flasks when routes.startNodeRefills is not false. From depth 2 each main branch k is a TREE inside up to L lanes that joins at its own boss `boss_k`:
 * it opens narrow (one node, or two when L >= 3), forks outward lane by lane over the next depths (FORK_PERCENT per boundary node per depth, forced so the branch
 * is full by depth count-3), may narrow again over the last two depths (never below two lanes, so no rest depth collapses to one path), and every path ends at the
 * branch's boss. Rests: one per lane that exists on a rest depth. Elites: every lane holds at least one elite at or past minimumThreatFloor on a depth where the
 * lane exists (a lane too short to have one has none). Edges after depth 1 never leave a branch. REMERGE_PERCENT of in-branch gaps add one neighbour edge.
 *
 * b = rng.int('map', 1, min(maxBranches, distinct bosses)); the bosses are the first b of a seeded shuffle, so they are distinct.
 * L = clamp(floor(2 * branchColumns / b), 1, branchColumns): 3 lanes for b 1-2, 2 for b 3, 1 for b 4-5. That caps the board at
 * 2 * branchColumns columns (6 today), the widest the 390 px map frames with free pan, while a lone branch keeps the old width.
 */
const REMERGE_PERCENT = 18;
const FORK_PERCENT = 40;
const NARROW_PERCENT = 25;
// Per-branch lane occupancy: { [floor]: { lo, hi } } (contiguous lanes, branch-local), plus the fork/narrow edges that make the tree.
function drawBranchShape(rng, lanes, count) {
  const active = {}, edges = []; // edges: [floor, fromLane, toLane] join floor -> floor + 1, branch-local lanes
  if (count < 2) return { active, edges };
  const width = lanes >= 3 && rng.chance('map', 50) ? 2 : 1;
  const lo0 = rng.int('map', Math.floor((lanes - width) / 2), Math.ceil((lanes - width) / 2));
  active[2] = { lo: lo0, hi: lo0 + width - 1 };
  const fillBy = Math.max(3, count - 3);
  for (let floor = 2; floor < count; floor++) {
    const { lo, hi } = active[floor], next = { lo, hi };
    if (floor < fillBy) {
      const left = rng.chance('map', FORK_PERCENT), right = rng.chance('map', FORK_PERCENT);
      const left0 = lo, right0 = hi, remaining = fillBy - floor;
      if (lo > 0 && (left || lo >= remaining)) { next.lo = lo - 1; edges.push([floor, left0, lo - 1]); }
      if (hi < lanes - 1 && (right || lanes - 1 - hi >= remaining)) { next.hi = hi + 1; edges.push([floor, right0, hi + 1]); }
    } else {
      const narrow = rng.chance('map', NARROW_PERCENT), dropLeft = rng.chance('map', 50);
      if (floor >= count - 2 && narrow && hi - lo + 1 >= 3) {
        if (dropLeft) { next.lo = lo + 1; edges.push([floor, lo, lo + 1]); }
        else { next.hi = hi - 1; edges.push([floor, hi, hi - 1]); }
      }
    }
    active[floor + 1] = next;
  }
  return { active, edges };
}
function buildBranchedActMap(registries, rng, seat, tier, ctx) {
  const { rules, count, columns, minimumThreatFloor, restFloors, firstFloor, shopShare, displayTypes, hidden, alternatives, hideUnknown, history } = ctx;
  const maxBranches = rules.maxBranches;
  if (!Number.isInteger(maxBranches) || maxBranches < 1 || maxBranches > 5) throw new Error('Invalid configured maxBranches');
  const pool = registries.encounters.all().filter(enc => enc.pool === 'boss' && encounterFitsSeat(enc, { seat, tier, finalTier: rules.acts }));
  if (!pool.length) throw new Error(`Configured route has no boss for ${seat}/${tier}`);
  const branchCount = rng.int('map', 1, Math.min(maxBranches, pool.length));
  const bosses = rng.shuffle('map', pool).slice(0, branchCount);
  const lanes = Math.max(1, Math.min(columns, Math.floor(2 * columns / branchCount)));
  const total = branchCount * lanes;
  const restSet = new Set(restFloors);
  const nodeId = (floor, globalLane) => `n${floor}_${globalLane}`;
  // Every branch's tree shape is drawn first, so what a lane holds cannot depend on how its nodes roll.
  const shapes = Array.from({ length: branchCount }, () => drawBranchShape(rng, lanes, count));
  const laneAt = (k, floor, lane) => { const a = shapes[k].active[floor]; return !!a && lane >= a.lo && lane <= a.hi; };
  // One guaranteed elite slot per lane (owner, 2026-10-27): drawn from the depths where that lane exists, before any node rolls.
  const guaranteed = new Set();
  if (alternatives.includes('elite')) for (let k = 0; k < branchCount; k++) for (let lane = 0; lane < lanes; lane++) {
    const floors = [];
    for (let floor = Math.max(2, minimumThreatFloor); floor <= count; floor++) if (!restSet.has(floor) && laneAt(k, floor, lane)) floors.push(floor);
    if (floors.length) guaranteed.add(`${rng.pick('map', floors)}:${k * lanes + lane}`);
  }
  const nodes = {}, layers = [], seenEvents = [];
  const makeNode = (id, floor, col, branch, rest, lane) => {
    const choices = alternatives.filter(type => type !== 'elite' || floor >= minimumThreatFloor);
    if (!rest && !choices.length) throw new Error(`Configured route has no permitted node types at depth ${floor}`);
    const forced = !rest && floor === 1 && firstFloor !== null;
    let actual;
    if (rest) actual = 'rest';
    else if (forced) actual = firstFloor;
    else if (guaranteed.has(`${floor}:${lane}`)) actual = 'elite';
    else {
      actual = rng.pick('map', choices);
      if (shopShare != null && alternatives.includes('shop') && actual !== 'elite') {
        const plain = alternatives.filter(type => type !== 'elite' && type !== 'shop');
        actual = rng.chance('map', shopShare * 100) || !plain.length ? 'shop' : rng.pick('map', plain);
      }
    }
    const type = hideUnknown && hidden.has(actual) && !forced ? 'event' : displayTypes[actual];
    const node = { id, floor, col, branch, type, actualType: actual, next: [] };
    if (type === 'event') {
      node.resolved = actual === 'event' ? resolveUnknownNode({ ...registries, mapConfig: () => ({ unknownWeights: { event: 1 } }) }, rng, { seenEvents, tier, history }) : { kind: actual === 'shop' ? 'merchant' : actual };
      if (node.resolved.kind === 'event') seenEvents.push(node.resolved.eventId);
    }
    nodes[id] = node;
    return id;
  };
  for (let floor = 1; floor <= count; floor++) {
    const layer = [];
    // Depth 1 is the single start node shared by every branch, centred over the board.
    if (floor === 1) {
      layer.push(makeNode('n1_0', 1, (total - 1) / 2, null, restSet.has(1), 0));
      if (rules.startNodeRefills !== false) nodes.n1_0.refill = true;
    }
    else for (let k = 0; k < branchCount; k++) {
      for (let j = 0; j < lanes; j++) if (laneAt(k, floor, j)) layer.push(makeNode(nodeId(floor, k * lanes + j), floor, k * lanes + j, k, restSet.has(floor), k * lanes + j));
    }
    layers.push(layer);
  }
  const bossIds = bosses.map((boss, k) => {
    const id = `boss_${k}`;
    nodes[id] = { id, floor: count + 1, col: k * lanes + (lanes - 1) / 2, branch: k, type: 'boss', actualType: 'boss', next: [], encounterId: boss.id, label: bossDestinationLabel(registries, boss.id), destinationLabel: bossDestinationLabel(registries, boss.id) }; // named now, so each branch shows its boss before any reload
    return id;
  });
  layers.push(bossIds);
  // Edges: depth 1 reaches every branch's opening node(s); inside a branch each node continues straight down its lane, the fork /
  // narrow edges drawn in the shape add the tree, and the boss is each branch's join. Remerges (owner 2026-10-27: "it can remerge
  // but not consistently"): per branch and per gap between two in-branch depths one 'map' draw (REMERGE_PERCENT) may add ONE edge
  // between neighbouring lanes that exist on both depths. Every draw is made so the stream is fixed; a branch never remerges
  // into every rest depth.
  const link = (from, to) => { if (nodes[from] && nodes[to] && !nodes[from].next.includes(to)) nodes[from].next.push(to); };
  for (const id of layers[0]) for (const to of layers[1] || []) link(id, to);
  for (let k = 0; k < branchCount; k++) {
    const base = k * lanes;
    for (let floor = 2; floor < count; floor++) {
      for (let j = 0; j < lanes; j++) if (laneAt(k, floor, j) && laneAt(k, floor + 1, j)) link(nodeId(floor, base + j), nodeId(floor + 1, base + j));
    }
    for (const [floor, from, to] of shapes[k].edges) link(nodeId(floor, base + from), nodeId(floor + 1, base + to));
    if (count >= 2) for (let j = 0; j < lanes; j++) if (laneAt(k, count, j)) link(nodeId(count, base + j), bossIds[k]);
  }
  const crossings = new Map(); // `${floor}:${branch}` -> [fromId, toId]
  for (let floor = 2; floor < count; floor++) {
    for (let k = 0; k < branchCount; k++) {
      const hit = rng.chance('map', REMERGE_PERCENT), pick = rng.int('map', 0, Math.max(0, lanes - 2)), forward = rng.chance('map', 50);
      const pairs = [];
      for (let j = 0; j + 1 < lanes; j++) if ([floor, floor + 1].every(f => laneAt(k, f, j) && laneAt(k, f, j + 1))) pairs.push(j);
      if (!hit || !pairs.length) continue;
      const j = pairs[pick % pairs.length], g = k * lanes + j;
      crossings.set(`${floor}:${k}`, forward ? [nodeId(floor, g), nodeId(floor + 1, g + 1)] : [nodeId(floor, g + 1), nodeId(floor + 1, g)]);
    }
  }
  for (let k = 0; k < branchCount; k++) {
    const intoRest = [];
    for (let floor = 2; floor < count; floor++) if (restSet.has(floor + 1)) intoRest.push(`${floor}:${k}`);
    if (intoRest.length > 1 && intoRest.every(key => crossings.has(key))) crossings.delete(intoRest[intoRest.length - 1]);
  }
  for (const [, [fromId, toId]] of crossings) link(fromId, toId);
  for (const id of Object.keys(nodes)) nodes[id].next.sort((a, b) => nodes[a].col - nodes[b].col || (a < b ? -1 : 1));
  const shrineIds = restSet.has(count) ? layers[count - 1].filter(id => nodes[id].actualType === 'rest') : [];
  const branches = bosses.map((boss, k) => ({ index: k, bossId: bossIds[k], encounterId: boss.id, firstCol: k * lanes, lanes, restIds: layers.flat().filter(id => nodes[id].branch === k && nodes[id].actualType === 'rest') }));
  return { nodes, startIds: layers[0], shrineId: shrineIds[0] ?? null, shrineIds, bossId: bossIds[0], bossIds, branches, floors: count + 1, columns: total, gameProfileHash: registries.gameProfile.hash };
}


// Adapter-shaped activities let existing encounter/service doors remain useful
// with the routes feature absent. The UI renders these as a launcher, not a map.
export function buildGameProfileActivities(registries, rng, seat, tier) {
  const definitions = [
    { id: 'activityFight', type: 'monster', label: 'Fight' },
    ...(gameModule(registries, 'rest') ? [{ id: 'activityRest', type: 'shrine', label: 'Rest' }] : []),
    ...(gameModule(registries, 'shops') ? [{ id: 'activityShop', type: 'merchant', label: 'Shop' }] : []),
    { id: 'activityBoss', type: 'boss', label: 'Challenge boss' },
  ];
  const ids = definitions.map(row => row.id);
  const fit = { seat, tier, finalTier: gameContent(registries, 'routes')?.acts || registries.seats.all().length };
  const pool = registries.encounters.all().filter(row => row.pool === 'boss' && encounterFitsSeat(row, fit));
  if (!pool.length) throw new Error('Foundation activity requires a valid boss encounter');
  const boss = rng.pick('map', pool);
  const nodes = Object.fromEntries(definitions.map((row, col) => [row.id, { ...row, floor: 1, col, next: ids, ...(row.type === 'boss' ? { encounterId: boss.id } : {}) }]));
  return { activityLauncher: true, nodes, startIds: ids, bossId: 'activityBoss', bossIds: ['activityBoss'], shrineId: nodes.activityRest ? 'activityRest' : null, floors: 1, columns: definitions.length, gameProfileHash: registries.gameProfile.hash };
}
