// Owner, 2026-11-18 (docs/balance/owner-ruling-2026-11-18.md section 9): opening hand and draw are 5 + floor(INT / 4) (base 5 so a starting character holds
// 5 to 6 cards), max MP is 1 + floor(WIS / 4), max SP is 3 + floor(DEX / 4), a staff or sceptre takes 1 off every spell's Mana cost (never below 0), and
// a few magic relics give +1 max Mana. The formula boundaries (3/4, 7/8) are pinned in tests/balance-stats-2026-11-17.test.mjs item 5.
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

test('a starting character of every class holds 5 to 6 cards, and the hand follows floor(INT / 4)', () => {
  for (const classId of CLASSES) {
    const { combat } = fight(classId);
    const hand = combat.piles.hand.length;
    assert.ok(hand >= 5 && hand <= 6, `${classId} opens on ${hand}`);
    assert.equal(hand, 5 + Math.floor(combat.player.attributes.intelligence / 4), classId);
    assert.equal(profileHandSize(combat), hand, 'the hand size the engine reads is the same number');
  }
  // The boundaries, on one class: INT 3 -> 4 and 7 -> 8 each add one card, nothing in between does.
  const cards = int => profileHandSize(fight('reaver', { attributes: { intelligence: int } }).combat);
  const base = cards(1);
  const gear = fight('reaver').combat.player.attributes.intelligence - 1;
  const at = int => 5 + Math.floor((int + gear) / 4);
  for (const int of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(cards(int), at(int), `INT ${int}`);
  assert.ok(base >= 5);
});

test('max SP and MP read DEX and WIS in fours', () => {
  for (const classId of CLASSES) {
    const { combat } = fight(classId);
    const a = createRunState({ registries, classId, seed: 31, profileMeta: META }).attributes;
    const sp = combat.player.maxStamina, mp = combat.player.maxMana;
    const raisedDex = fight(classId, { attributes: { dexterity: a.dexterity + 4 } }).combat.player.maxStamina;
    const raisedWis = fight(classId, { attributes: { wisdom: a.wisdom + 4 } }).combat.player.maxMana;
    assert.equal(raisedDex - sp, 1, `${classId}: four more DEX is one more SP`);
    assert.equal(raisedWis - mp, 1, `${classId}: four more WIS is one more MP`);
    assert.equal(fight(classId, { attributes: { intelligence: a.intelligence + 4 } }).combat.player.maxMana, mp, `${classId}: INT buys no Mana`);
  }
});

test('a staff or sceptre takes 1 off every spell Mana cost (never below 0); preview equals play', () => {
  // The Focus item type every staff and sceptre carries is the owner's "inherently lower": Core prices a spell at its Mana + 1 and a held
  // focus (spellCosts.focusManaDiscount) takes the 1 back, so the same spell costs 1 more without one. It is shown in the Magic Focus text.
  const costOf = (combat, cardId) => {
    combat.piles.hand.push({ instanceId: `probe-${cardId}`, cardId });
    return previewCard(combat, `probe-${cardId}`, combat.enemies[0].id).costs.mana;
  };
  const sceptre = fight('starseer').combat, sword = fight('starseer', { weapon: 'straightSword' }).combat;
  for (const cardId of ['starShower', 'core.cantrip', 'starstoneArc']) assert.equal(costOf(sword, cardId) - costOf(sceptre, cardId), 1, `${cardId}: 1 less with a focus`);
  assert.equal(costOf(sceptre, 'core.cantrip'), 0, 'a free spell stays free, never negative');
  assert.equal(costOf(sceptre, 'warcry'), 0, 'a non-spell is untouched');
  for (const staff of contentBundle.equipment.armaments.filter(p => p.kind === 'staff')) {
    assert.ok(registries.equipment.armaments.find(p => p.id === staff.id).itemTypeTags.includes('item:magic-focus'), `${staff.id} is a Focus`);
  }
  assert.match(registries.tags.find(tag => tag.id === 'item:magic-focus').blurb, /lowers the Mana cost of every spell by 1/);
  // Preview == play: the Mana the real play spends is the Mana the preview quoted.
  const { combat } = fight('starseer');
  combat.player.mana = combat.player.maxMana;
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
