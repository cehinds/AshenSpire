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
 * Branched act map (owner, 2026-10-25). Depth 1 is a shared opening row of T = b * L nodes, one per column. From depth 2 each
 * branch k is its own subgraph of L lanes: one rest node per rest floor, at least one elite at or past minimumThreatFloor, and
 * its own boss `boss_k`. Edges after depth 1 never leave a branch, so a branch's rests are never on another branch's route.
 *
 * b = rng.int('map', 1, min(maxBranches, distinct bosses)); the bosses are the first b of a seeded shuffle, so they are distinct.
 * L = clamp(floor(2 * branchColumns / b), 1, branchColumns): 3 lanes for b 1-2, 2 for b 3, 1 for b 4-5. That caps the board at
 * 2 * branchColumns columns (6 today), the widest the 390 px map frames with free pan, while a lone branch keeps the old width.
 */
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
  // One guaranteed elite slot per branch, drawn before any node so it cannot depend on how the lanes roll.
  const eliteFloors = [];
  for (let floor = Math.max(2, minimumThreatFloor); floor <= count; floor++) if (!restSet.has(floor) && alternatives.includes('elite')) eliteFloors.push(floor);
  const guaranteed = new Set();
  if (eliteFloors.length) for (let k = 0; k < branchCount; k++) guaranteed.add(`${rng.pick('map', eliteFloors)}:${k * lanes + rng.int('map', 0, lanes - 1)}`);
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
    // Depth 1 is shared by every branch: a row of T nodes, or one node when it is authored as a rest depth.
    if (floor === 1) {
      if (restSet.has(1)) layer.push(makeNode('n1_0', 1, (total - 1) / 2, null, true, 0));
      else for (let lane = 0; lane < total; lane++) layer.push(makeNode(`n1_${lane}`, 1, lane, null, false, lane));
    }
    else for (let k = 0; k < branchCount; k++) {
      if (restSet.has(floor)) layer.push(makeNode(`n${floor}_${k * lanes}`, floor, k * lanes + (lanes - 1) / 2, k, true, k * lanes));
      else for (let j = 0; j < lanes; j++) layer.push(makeNode(`n${floor}_${k * lanes + j}`, floor, k * lanes + j, k, false, k * lanes + j));
    }
    layers.push(layer);
  }
  const bossIds = bosses.map((boss, k) => {
    const id = `boss_${k}`;
    nodes[id] = { id, floor: count + 1, col: k * lanes + (lanes - 1) / 2, branch: k, type: 'boss', actualType: 'boss', next: [], encounterId: boss.id, label: bossDestinationLabel(registries, boss.id), destinationLabel: bossDestinationLabel(registries, boss.id) }; // named now, so each branch shows its boss before any reload
    return id;
  });
  layers.push(bossIds);
  for (let depth = 0; depth < layers.length - 1; depth++) {
    for (const id of layers[depth]) {
      const from = nodes[id];
      from.next = layers[depth + 1].filter((target) => {
        const to = nodes[target];
        if (depth === 0) return from.actualType === 'rest' || (to.actualType === 'rest' || to.type === 'boss' ? Math.floor(from.col / lanes) === to.branch : Math.abs(from.col - to.col) <= 1); // the shared opening reaches every branch
        if (from.branch !== to.branch) return false;
        const single = from.actualType === 'rest' || to.type === 'boss' || to.actualType === 'rest';
        return single || Math.abs(from.col - to.col) <= 1;
      });
    }
  }
  const shrineIds = restSet.has(count) ? Array.from({ length: branchCount }, (_, k) => `n${count}_${k * lanes}`) : [];
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
