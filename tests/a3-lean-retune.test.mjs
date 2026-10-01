// tests/a3-lean-retune.test.mjs — the A3 lean retune (FINISH D28, 2026-09-27).
//
// Two rows of content/derivedStats.js moved, each sized from the simulator
// (`node tools/runsim.mjs 100 --seeded-seats --incoming`; the numbers are in
// the PR and in the rows' own comment):
//
//   energy.dexterity 0.2 → 0.25   the first extra Action at DEX 4, not 5
//   hp.base          30 → 51      the lowest stock pool covers the fleet's
//                                 p90 HP lost over a run's first three fights
//
// Every assertion below reads the authored row, never a copy of the number,
// and the last block is the FINISH A2–A4 configurability test: overriding each
// row moves the engine's own result.

import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { applyLevelUp, awardLevelXp, xpToNext } from '../src/model/levelup.js';

const REG = createRegistries(contentBundle);
const withRows = (patch) => {
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  for (const [id, fields] of Object.entries(patch)) Object.assign(bundle.derivedStatRules.rules[id], fields);
  return createRegistries(bundle);
};
const run = (registries, classId, attributes) => createRunState({ seed: 0xa3, classId, registries, attributes });

test('stock lean pools open on the retuned HP base', () => {
  assert.equal(contentBundle.derivedStatRules.rules.hp.base, 51, 'hp.base is the A3 figure');
  // Reaver carries the Forsaken Medallion's flat ten, the Starseer its shard's
  // fourteen; CON 2 is 8 and the Reaver's STR 3 × 0.35 is one more.
  const pools = Object.fromEntries(['reaver', 'starseer', 'rogue', 'herald'].map((id) => [id, run(REG, id).maxHp]));
  assert.deepEqual(pools, { reaver: 70, starseer: 69, rogue: 59, herald: 59 });
  for (const [id, hp] of Object.entries(pools)) assert.equal(run(REG, id).hp, hp, `${id} opens at full HP`);
});

test('the first extra Action is at DEX 4: reachable at creation, and three level-ups from DEX 1', () => {
  assert.equal(contentBundle.derivedStatRules.rules.energy.dexterity, 0.25, 'energy.dexterity is the A3 figure');
  // Stock presets: nobody opens on DEX 4, so every class opens on 3.
  for (const id of ['reaver', 'starseer', 'rogue', 'herald']) assert.equal(run(REG, id).energyMax, 3, `${id} opens on 3 Actions`);
  // The lean mode's ceiling is 4, so a creation that pours all three points
  // into Dexterity now opens on 4 Actions (0.2 × 4 floored to 0 before).
  const quick = run(REG, 'rogue', { strength: 1, dexterity: 4, constitution: 1, wisdom: 1, intelligence: 1 });
  assert.equal(quick.energyMax, 4, 'DEX 4 at creation is the fourth Action');
  // A DEX-1 preset (the Reaver) reaches it in three level-ups — level 4, well
  // before the level term's own step at level 11.
  const reaver = run(REG, 'reaver');
  awardLevelXp(REG, reaver, [1, 2, 3].reduce((total, level) => total + xpToNext(REG, level), 0));
  assert.equal(reaver.level.level, 4);
  for (let i = 0; i < 2; i++) applyLevelUp(REG, reaver, 'dexterity');
  assert.equal(reaver.energyMax, 3, 'DEX 3 is still 3 Actions');
  applyLevelUp(REG, reaver, 'dexterity');
  assert.equal(reaver.attributes.dexterity, 4);
  assert.equal(reaver.energyMax, 4, 'the third point lands the fourth Action');
});

test('configurability (FINISH A2–A4): overriding each retuned row changes the engine result', () => {
  // hp.base: the stock Rogue's pool moves one for one with the row.
  assert.equal(run(withRows({ hp: { base: 30 } }), 'rogue').maxHp, 38, 'the pre-A3 base restores the pre-A3 pool');
  assert.equal(run(withRows({ hp: { base: 60 } }), 'rogue').maxHp, 68);
  // energy.dexterity: DEX 4 gives the extra Action only while 4 × weight ≥ 1.
  const dex4 = { strength: 1, dexterity: 4, constitution: 1, wisdom: 1, intelligence: 1 };
  assert.equal(run(withRows({ energy: { dexterity: 0.2 } }), 'rogue', dex4).energyMax, 3, 'the pre-A3 weight puts the step back at DEX 5');
  assert.equal(run(withRows({ energy: { dexterity: 0.5 } }), 'rogue', dex4).energyMax, 5, 'a heavier weight buys two');
});
