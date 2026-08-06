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

import { generateActMap } from './mapgen.js';
import { resolveUnknownNode } from './encounters.js';

/**
 * buildActMap(registries, rng, act) → mapGraph
 *
 * `act` is the CONTENT act (the caller answers Endless looping — main.js and
 * the tools pass their contentAct), required for the same reason
 * resolveUnknownNode requires it: guessing act 1 would be a default nobody
 * authored. Unknown (?) nodes come back with `.resolved` already set, so a
 * node's outcome is seed-determined at map birth and the Sealstone Key can
 * reveal it (SPEC §6).
 */
export function buildActMap(registries, rng, act) {
  const map = generateActMap({ config: registries.mapConfig(act), rng });
  const assigned = [];
  for (const node of Object.values(map.nodes)) {
    if (node.type === 'event') {
      node.resolved = resolveUnknownNode(registries, rng, { seenEvents: assigned, act });
      if (node.resolved.kind === 'event') assigned.push(node.resolved.eventId);
    }
  }
  return map;
}
