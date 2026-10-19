import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { setProfileStance, profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { stanceOf, sameStance, stanceManaCost } from '../src/model/stanceRules.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';

// Owner ruling 2026-10-18 20:14: a scepter spell that mirrors a basic card plays in that basic's
// stance (Attack, Smash, ...) but stays a Spell and Cantrip, so spell-only rules still count it.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const card = id => reg.cards.get(id);
function live() {
  const run = createRunState({ registries: reg, classId: 'starseer', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
}

test('Arcane Spark mirrors Strike and keeps its Spell and Cantrip tags', () => {
  const spark = card('core.cantrip');
  assert.equal(spark.mirrors, 'attack');
  assert.equal(combatProfileFor(spark).mirrors, 'attack');
  for (const tag of ['camp:spell', 'source:spell', 'rank.cantrip']) assert(spark.tags.includes(tag), tag);
  assert.equal(card('core.starseerSpecial').mirrors, undefined, 'a class special mirrors nothing');
});

test('the mirrored cantrip reads as an Attack-stance Spell; other spells keep the casting stance', () => {
  assert.deepEqual(stanceOf(card('core.cantrip')), { maneuver: 'attack', camp: 'spell', mirrored: true, range: 'melee' });
  assert.equal(stanceOf(card('core.starseerSpecial')).maneuver, 'casting');
  assert.equal(stanceOf(card('core.strike')).maneuver, 'attack');
  assert.equal(stanceOf(card('core.strike')).camp, 'physical');
});

test('mirrored schemas: smash, sweep, defend and counter mirrors read the same way; junk does not', () => {
  for (const mirrors of ['smash', 'sweep', 'defend', 'counter'])
    assert.equal(stanceOf({ ...card('core.cantrip'), mirrors, combatProfile: undefined }).maneuver, mirrors, mirrors);
  assert.equal(stanceOf({ ...card('core.cantrip'), mirrors: 'casting', combatProfile: undefined }).maneuver, 'casting');
});

test('a played cantrip sets an Attack/Spell stance that a second cantrip matches', () => {
  const combat = live();
  const spark = card('core.cantrip');
  setProfileStance(combat, combat.player, { ...spark, combatProfile: combatProfileFor(spark) });
  assert.equal(combat.player.combatStance.maneuver, 'attack');
  assert.equal(combat.player.combatStance.camp, 'spell');
  assert.equal(combat.player.combatStance.mirrored, true);
  assert.equal(sameStance(combat.player, spark), true);
  assert.equal(sameStance(combat.player, card('core.strike')), false, 'physical Strike is another camp');
});

test('successive Spells still cut Mana after a mirrored cantrip, both ways', () => {
  const combat = live();
  const spark = card('core.cantrip'), costly = { ...card('core.starseerSpecial'), manaCost: 3 };
  const base = stanceManaCost(3, combat.player, costly, combat);
  assert.equal(base, 3, 'no spell played yet');
  setProfileStance(combat, combat.player, { ...spark, combatProfile: combatProfileFor(spark) });
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 2, 'a Spell after the cantrip is discounted');
  assert.equal(profileCardCosts(combat, costly).mana, 2);
  setProfileStance(combat, combat.player, { ...costly, combatProfile: combatProfileFor(costly) });
  assert.equal(stanceManaCost(3, combat.player, { ...spark, manaCost: 3 }, combat), 2, 'the cantrip after a Spell too');
  setProfileStance(combat, combat.player, { ...card('core.strike'), combatProfile: combatProfileFor(card('core.strike')) });
  assert.equal(stanceManaCost(3, combat.player, costly, combat), 3, 'a physical Strike breaks the chain');
});
