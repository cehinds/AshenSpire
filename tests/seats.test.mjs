// tests/seats.test.mjs — SPEC §13 Seats: the falsifying commands, as a suite.
//   node --test tests/seats.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { SEATS, CAUSEWAY_REGION_ID } from '../src/content/seats.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng, STREAM_NAMES } from '../src/engine/rng.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { buildActMap, bossEncounterForNode, drawSeatOrder } from '../src/engine/actmap.js';
import { rollEncounter, resolveUnknownNode } from '../src/engine/encounters.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { defaultSeatOrder, seatAtTier, seatTierHpMult, seatOrderProblems, encounterFitsSeat, finalTier } from '../src/model/seats.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { regionForRun, combatEnvironment } from '../src/model/environmentArt.js';
import { createSession, restoreSession } from '../tools/session.mjs';
import { createCombat } from '../src/engine/combat.js';
import { actTitle } from '../src/ui/uiContent.js';

const REG = createRegistries(contentBundle);
const ORDER = defaultSeatOrder(REG);
const topology = (graph) => Object.values(graph.nodes).map(({ id, floor, col, type, next, resolved, encounterId }) => ({ id, floor, col, type, next, resolved, encounterId }));

test('13.1 the closed set: three seats, one baseline each, in region order', () => {
  assert.deepEqual(SEATS.map((s) => s.id), ['weald', 'marches', 'reach']);
  assert.deepEqual(ORDER, ['weald', 'marches', 'reach']);
  assert.deepEqual(SEATS.map((s) => s.baseTier), [1, 2, 3]);
  assert.equal(finalTier(REG), 3);
  assert.equal(validateContent(contentBundle).ok, true);
});

test('13.1 the validator refuses a duplicated baseline, a second null seat, and a seat with no boss', () => {
  const dup = { ...contentBundle, seats: contentBundle.seats.map((s) => (s.id === 'reach' ? { ...s, baseTier: 2 } : s)) };
  assert.match(validateContent(dup).errors.map((e) => e.msg).join('\n'), /baseTier values must be exactly 1\.\.3/);
  const twoNull = { ...contentBundle, encounters: contentBundle.encounters.map((e) => (e.id === 'bossOmen' ? { ...e, seat: null } : e)) };
  assert.match(validateContent(twoNull).errors.map((e) => e.msg).join('\n'), /exactly one encounter may carry seat: null/);
  const noBoss = { ...contentBundle, encounters: contentBundle.encounters.filter((e) => !(e.seat === 'marches' && e.pool === 'boss')) };
  assert.match(validateContent(noBoss).errors.map((e) => e.msg).join('\n'), /no 'boss' encounter is bound to this seat/);
  const withAct = { ...contentBundle, encounters: contentBundle.encounters.map((e) => (e.id === 'bossOmen' ? { ...e, act: 1 } : e)) };
  assert.match(validateContent(withAct).errors.map((e) => e.msg).join('\n'), /Unknown field 'act'/);
});

test('13.2 every encounter is bound to a seat; the Valkyrie alone is null', () => {
  const rows = contentBundle.encounters;
  assert.ok(rows.every((e) => e.seat === null || ['weald', 'marches', 'reach'].includes(e.seat)));
  assert.deepEqual(rows.filter((e) => e.seat === null).map((e) => e.id), ['a3_bossRotValkyrie']);
  assert.ok(rows.every((e) => !('act' in e)));
});

test('13.2 rollEncounter and resolveUnknownNode refuse the retired act argument', () => {
  assert.throws(() => rollEncounter(REG, createRng(1), { pool: 'normal', act: 1 }), /retired/);
  assert.throws(() => rollEncounter(REG, createRng(1), { pool: 'normal' }), /seat id is required/);
  assert.throws(() => resolveUnknownNode(REG, createRng(1), { act: 1 }), /retired/);
  assert.throws(() => buildActMap(REG, createRng(1), 1, 1), /seat id is required/);
  assert.throws(() => buildActMap(REG, createRng(1), 'nowhere', 1), /Unknown seat id/);
  for (const seat of ORDER) {
    const id = rollEncounter(REG, createRng(5), { pool: 'normal', seat });
    assert.equal(REG.encounters.get(id).seat, seat);
  }
});

test('13.5 the tier-3 act offers the Valkyrie beside the seat\'s own bosses, and no other tier does', () => {
  for (const seat of ORDER) {
    const top = buildActMap(REG, createRng(11), seat, 3);
    const bosses = top.bossIds.map((id) => bossEncounterForNode(REG, top, id, { seat, tier: 3 }));
    assert.ok(bosses.includes('a3_bossRotValkyrie'), `${seat} at tier 3 offers the Valkyrie`);
    assert.ok(bosses.some((id) => REG.encounters.get(id).seat === seat), `${seat} at tier 3 offers its own boss`);
    for (const tier of [1, 2]) {
      const low = buildActMap(REG, createRng(11), seat, tier);
      const lowBosses = low.bossIds.map((id) => bossEncounterForNode(REG, low, id, { seat, tier }));
      assert.ok(!lowBosses.includes('a3_bossRotValkyrie'), `${seat} at tier ${tier} never offers the Valkyrie`);
      assert.ok(lowBosses.every((id) => REG.encounters.get(id).seat === seat));
    }
  }
  assert.ok(encounterFitsSeat(REG.encounters.get('a3_bossRotValkyrie'), { seat: 'weald', tier: 3, finalTier: 3 }));
  assert.ok(!encounterFitsSeat(REG.encounters.get('a3_bossRotValkyrie'), { seat: 'weald', tier: 2, finalTier: 3 }));
  assert.throws(() => bossEncounterForNode(REG, buildActMap(REG, createRng(11), 'weald', 3), undefined, 1), /pass \{ seat, tier \}/);
});

test('13.6 claims 1 and 3: every existing seed\'s act map and HP roll are byte-identical to the pre-seat tree', () => {
  // The fixture was generated from dev at f727b08 — the last tree where
  // buildActMap took an act — with the same seeds, and is the one thing that
  // can say "unchanged" rather than "self-consistent".
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/actmap-fingerprint-pre-seats.json', import.meta.url), 'utf8'));
  for (const [key, before] of Object.entries(fixture.maps)) {
    const [seed, tier] = key.split(':').map(Number);
    const rng = createRng(seed);
    const g = buildActMap(REG, rng, ORDER[tier - 1], tier);
    const after = { counters: rng.getCounters(), nodes: Object.values(g.nodes).map(({ id, floor, col, type, next, resolved, encounterId, destinationLabel }) => ({ id, floor, col, type, next, resolved, encounterId, destinationLabel })), bossIds: g.bossIds, startIds: g.startIds };
    const { seats, ...counters } = after.counters;
    // JSON round-trip: the fixture dropped `undefined` fields the way any save does.
    assert.deepEqual(JSON.parse(JSON.stringify({ ...after, counters })), before, `seed ${seed} tier ${tier}`);
  }
  for (const [key, hp] of Object.entries(fixture.hp)) {
    const [seed, tier] = key.split(':').map(Number);
    const enc = REG.encounters.all().find((e) => e.pool === 'normal' && e.seat === ORDER[tier - 1]);
    const hpMult = seatTierHpMult(REG, ORDER[tier - 1], tier);
    const c = createCombat({ registries: REG, rng: createRng(seed), player: { classId: 'reaver', maxHp: 80, hp: 80, energyMax: 3, drawPerTurn: 5, deck: [{ instanceId: 'x1', cardId: 'strike', upgraded: false }] }, enemyIds: enc.enemies, hpMult });
    assert.deepEqual(c.enemies.map((e) => e.hp), hp, `seed ${seed} tier ${tier} HP`);
  }
});

test('13.3 a seat at its baseline scales by exactly 1; elsewhere by the tier ratio', () => {
  for (const seat of SEATS) assert.equal(seatTierHpMult(REG, seat.id, seat.baseTier), 1);
  const t = REG.balance.seatTiers;
  assert.equal(seatTierHpMult(REG, 'weald', 3), t[3] / t[1]);
  assert.equal(seatTierHpMult(REG, 'reach', 1), t[1] / t[3]);
  assert.equal(seatTierHpMult(REG, 'marches', 4), t[1] / t[2], 'Endless act 4 is tier 1 again');
  assert.equal(t[1], 1);
});

test('13.4 the run carries its order; the draw rides its own stream; a pin rotates', () => {
  assert.ok(STREAM_NAMES.includes('seats'));
  const run = createRunState({ seed: 0xbeef, classId: 'reaver', registries: REG });
  assert.deepEqual(run.seatOrder, ORDER, 'createRunState gives the default order');
  assert.equal(run.schemaVersion, RUN_SCHEMA_VERSION);
  const r1 = createRng(0xbeef), r2 = createRng(0xbeef);
  const drawn = drawSeatOrder(REG, r1);
  const pinned = drawSeatOrder(REG, r2, { firstSeat: 'reach' });
  assert.equal(pinned[0], 'reach');
  assert.deepEqual([...pinned].sort(), [...ORDER].sort());
  assert.deepEqual(r1.getCounters(), r2.getCounters(), 'pinning draws exactly what seeding draws');
  const { seats, ...restA } = r1.getCounters();
  assert.ok(seats > 0);
  assert.ok(Object.values(restA).every((n) => n === 0), 'no other stream moved');
  assert.deepEqual(drawn, drawSeatOrder(REG, createRng(0xbeef)), 'the draw is a function of the seed');
  assert.throws(() => drawSeatOrder(REG, createRng(1), { firstSeat: 'nowhere' }), /unknown first seat/);
  // Some seed opens somewhere other than the weald, or the feature is inert.
  const openings = new Set(Array.from({ length: 30 }, (_, i) => drawSeatOrder(REG, createRng(i + 1))[0]));
  assert.equal(openings.size, 3);
});

test('13.4 validateRunShape names a bad seatOrder; the load door fills a pre-§13 save with the default order and no draw', () => {
  const run = createRunState({ seed: 44, classId: 'herald', registries: REG });
  assert.ok(validateRunShape({ ...run, seatOrder: ['weald', 'weald', 'reach'] }).some((p) => p.includes('seatOrder')));
  assert.ok(validateRunShape({ ...run, seatOrder: 'weald' }).some((p) => p.includes('seatOrder')));
  const { seatOrder, ...noOrder } = run;
  assert.ok(validateRunShape(noOrder).some((p) => p.includes("missing 'seatOrder'")));
  // A schema-5 save: no seatOrder. Migrates, loads, climbs the default order.
  const old = JSON.parse(serializeRun(run));
  delete old.seatOrder; old.schemaVersion = 5;
  const back = deserializeRun(JSON.stringify(old));
  assert.equal(back.schemaVersion, 6);
  assert.equal(back.migratedFromRunSchemaVersion, 5);
  assert.equal(back.seatOrder, undefined, 'the model leaves the order to the load door');
  const store = createMemoryStorage();
  store.setItem('sote_run_v1', JSON.stringify({ ...JSON.parse(store.getItem('sote_run_v1') || '{}') }));
  const saves = createSaveManager(store);
  saves.saveRun(run);
  const slotJson = JSON.parse(store.getItem('sote_run_v1'));
  const key = Object.keys(slotJson).find((k) => slotJson[k] && typeof slotJson[k] === 'string' && slotJson[k].includes('"seatOrder"')) || null;
  if (key) {
    const raw = JSON.parse(slotJson[key]); delete raw.seatOrder; raw.schemaVersion = 5; slotJson[key] = JSON.stringify(raw);
    store.setItem('sote_run_v1', JSON.stringify(slotJson));
    const loaded = saves.loadRun(REG);
    assert.ok(loaded, 'a pre-seat save loads');
    assert.deepEqual(loaded.seatOrder, ORDER);
    assert.deepEqual(loaded.streamCounters, run.streamCounters, 'no draw during migration');
  }
  // A save naming an unknown seat is refused.
  saves.saveRun({ ...run, seatOrder: ['weald', 'marches', 'nowhere'] });
  assert.equal(saves.loadRun(REG), null);
  assert.match(saves.runStatus().reason, /unknown seat 'nowhere'/);
});

test('13.2 scenery follows the seat; the final tier\'s boss node is the causeway; a run without seats keeps its rotation', () => {
  const base = { seedString: 'SEATS', floor: 2, actNumber: 1 };
  for (const [i, seat] of SEATS.entries()) {
    assert.equal(regionForRun({ ...base, seatOrder: ORDER, actNumber: i + 1 }).id, seat.regionId);
    assert.equal(regionForRun({ ...base, seatOrder: [...ORDER].reverse(), actNumber: 3 - i }).id, seat.regionId);
  }
  const legacy = regionForRun({ ...base });
  assert.equal(legacy.id, regionForRun({ ...base, actNumber: 1 }).id, 'no seatOrder → the seeded rotation, unchanged');
  const graph = buildActMap(REG, createRng(3), 'weald', 3);
  const bossId = graph.bossIds[0];
  const atCauseway = combatEnvironment({ ...base, seatOrder: ORDER, actNumber: 3, mapGraph: graph, mapNodeId: bossId });
  assert.equal(atCauseway.region.id, CAUSEWAY_REGION_ID);
  const low = buildActMap(REG, createRng(3), 'weald', 1);
  assert.equal(combatEnvironment({ ...base, seatOrder: ORDER, actNumber: 1, mapGraph: low, mapNodeId: low.bossIds[0] }).region.id, 'hollow-weald');
});

test('13.2 the act title names the tier and the seat; without a seat the authored table still answers', () => {
  assert.equal(actTitle(2, 'The Pale Marches'), 'ACT II — THE PALE MARCHES');
  assert.equal(actTitle(5, 'The Cinder Reach'), 'ACT II — THE CINDER REACH · CYCLE 2');
  assert.equal(actTitle(1), 'ACT I — THE FALLOW MARCHES');
});

test('13.4 a co-op session draws, carries and restores the party\'s order', () => {
  const host = createSession({ registries: REG, seedString: 'CAUSEWAY' });
  host.addMember({ id: 'p1', name: 'One', classId: 'reaver' });
  host.start();
  const saved = host.serialize();
  assert.deepEqual([...saved.seatOrder].sort(), [...ORDER].sort());
  assert.ok(saved.members.every((m) => JSON.stringify(m.run.seatOrder) === JSON.stringify(saved.seatOrder)));
  const back = restoreSession(REG, structuredClone(saved));
  assert.deepEqual(back.serialize().seatOrder, saved.seatOrder);
  const legacySave = structuredClone(saved); delete legacySave.seatOrder; legacySave.actNumber = 1;
  legacySave.mapGraph = buildActMap(REG, createRng(9), ORDER[0], 1); legacySave.cursorId = null; legacySave.reachableIds = legacySave.mapGraph.startIds.slice();
  assert.deepEqual(restoreSession(REG, legacySave).serialize().seatOrder, ORDER, 'a pre-seat party save climbs the default order');
});

test('seatOrderProblems names every defect', () => {
  assert.deepEqual(seatOrderProblems(ORDER, REG), []);
  assert.ok(seatOrderProblems(['weald'], REG).some((p) => p.includes('every seat once')));
  assert.ok(seatOrderProblems(['weald', 'marches', 'x'], REG).some((p) => p.includes("unknown seat 'x'")));
  assert.ok(seatOrderProblems(null).length);
  assert.equal(seatAtTier(ORDER, 4), 'weald');
});
