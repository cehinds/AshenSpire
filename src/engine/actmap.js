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
