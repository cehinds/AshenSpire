// Current per-point hand/SP/MP tuning (owner, 2026-11-24). The previous quarter-point rules remain part of saved-profile coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { profileHandSize } from '../src/engine/gameProfileCombat.js';
import { rederivePools } from '../src/model/levelup.js';
import { reconcileRunLoadoutHp } from '../src/model/loadout.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const shipped = Profile.resolveGameProfile('default');
const registries = Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, shipped)), shipped);
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };
const CLASSES = ['reaver', 'starseer', 'rogue', 'herald'];

function fight(classId, { weapon = null, relics = null, attributes = {} } = {}) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  if (weapon) run.loadout.sets.rightHand[0] = weapon;
  if (relics) run.relics = relics;
  Object.assign(run.attributes, attributes);
  if (Object.keys(attributes).length) rederivePools(registries, run, 'test');
  // A relic picked up mid-run reaches the pools the way a swapped armament does: through the loadout reconcile.
  if (relics) reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses: true });
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { run, combat };
}

test('every class starts at 3 + effective INT cards and each INT adds one', () => {
  for (const classId of CLASSES) {
    const { combat } = fight(classId);
    const hand = combat.piles.hand.length;
    assert.equal(hand, 3 + combat.player.attributes.intelligence, classId);
    assert.equal(profileHandSize(combat), hand, 'the hand size the engine reads is the same number');
  }
  // Check every value across the old four-point thresholds.
  const cards = int => profileHandSize(fight('reaver', { attributes: { intelligence: int } }).combat);
  // The INT the Reaver's gear adds over its own base INT.
  const reaver = fight('reaver');
  const gear = reaver.combat.player.attributes.intelligence - reaver.run.attributes.intelligence;
  const at = int => 3 + int + gear;
  for (const int of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(cards(int), at(int), `INT ${int}`);
});

test('each DEX adds one max SP and each WIS adds one max MP', () => {
  for (const classId of CLASSES) {
    const { combat } = fight(classId);
    const a = createRunState({ registries, classId, seed: 31, profileMeta: META }).attributes;
    const sp = combat.player.maxStamina, mp = combat.player.maxMana;
    // A gear penalty on a 0 base stat is floored at 0, so the SP and MP follow the effective stat.
    const dexFight = fight(classId, { attributes: { dexterity: a.dexterity + 4 } }).combat;
    const wisFight = fight(classId, { attributes: { wisdom: a.wisdom + 4 } }).combat;
    const dexGain = dexFight.player.attributes.dexterity - combat.player.attributes.dexterity;
    const wisGain = wisFight.player.attributes.wisdom - combat.player.attributes.wisdom;
    assert.ok(dexGain > 0 && wisGain > 0, `${classId}: four more base points raise the effective stats`);
    assert.equal(dexFight.player.maxStamina - sp, dexGain, `${classId}: each effective DEX is one more SP`);
    assert.equal(wisFight.player.maxMana - mp, wisGain, `${classId}: each effective WIS is one more MP`);
    assert.equal(fight(classId, { attributes: { intelligence: a.intelligence + 4 } }).combat.player.maxMana, mp, `${classId}: INT buys no Mana`);
  }
});

test('current staff or sceptre Focus takes 1 Mana off only in Prepared; preview equals play', () => {
  // Owner section 18 supersedes section 9's unconditional timing: current Focus discounts only Prepared.
  const costOf = (combat, cardId) => {
    combat.piles.hand.push({ instanceId: `probe-${cardId}`, cardId });
    return previewCard(combat, `probe-${cardId}`, combat.enemies[0].id).costs.mana;
  };
  const sceptre = fight('starseer').combat, sword = fight('starseer', { weapon: 'straightSword' }).combat;
  for (const cardId of ['starShower', 'core.cantrip', 'starstoneArc']) assert.equal(costOf(sceptre, cardId), costOf(sword, cardId), `${cardId}: no Focus discount outside Prepared`);
  sceptre.player.combatStance = sword.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
  for (const cardId of ['starShower', 'core.cantrip', 'starstoneArc']) assert.equal(costOf(sceptre, cardId), Math.max(0, costOf(sword, cardId) - 1), `${cardId}: one Focus discount in Prepared, final floor 0`);
  assert.equal(costOf(sceptre, 'core.cantrip'), 0, 'a free spell stays free, never negative');
  assert.equal(costOf(sceptre, 'warcry'), 0, 'a non-spell is untouched');
  for (const staff of contentBundle.equipment.armaments.filter(p => p.kind === 'staff')) {
    assert.ok(registries.equipment.armaments.find(p => p.id === staff.id).itemTypeTags.includes('item:magic-focus'), `${staff.id} is a Focus`);
  }
  assert.match(registries.tags.find(tag => tag.id === 'item:magic-focus').blurb, /Prepared stance.*lowers the final Mana cost of each spell by 1/);
  // Preview == play: the Mana the real play spends is the Mana the preview quoted.
  const { combat } = fight('starseer');
  combat.player.mana = combat.player.maxMana;
  combat.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
  combat.piles.hand.push({ instanceId: 'cast', cardId: 'starShower' });
  const quoted = previewCard(combat, 'cast', combat.enemies[0].id).costs.mana;
  const before = combat.player.mana;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'cast', targetId: combat.enemies[0].id });
  assert.equal(before - combat.player.mana, quoted, 'the play spent what the preview said');
});

test('Pearl of Sagacity, Azure Sigil and Graduate each give +1 max Mana', () => {
  const none = fight('reaver', { relics: [] }).combat.player.maxMana;
  for (const relic of ['pearlOfSagacity', 'azureSigil', 'graduate']) {
    const { combat } = fight('reaver', { relics: [relic] });
    assert.equal(combat.player.maxMana - none, 1, relic);
    const def = registries.relics.get(relic);
    assert.match(def.textTemplate, /^\+1 max Mana\./, `${relic} says so`);
    assert.ok(def.properties.includes('maxMana1'), `${relic} carries the property`);
  }
});
