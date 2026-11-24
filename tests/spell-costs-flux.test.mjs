// Owner, 2026-11-15 (W25-F): spells cost 1 more Mana (and 1 more Stamina unless a cantrip); Prepared takes 1 SP off a spell; a Focus item takes 1 MP off;
// the last spell's element becomes a flux that lifts the next card of that element by x1.25 (each number floored). The numbers live in
// fixCoreMechanics.json `spellCosts` and `elementFlux`; a fight created before the ruling has neither block and plays today's costs with no flux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules } from '../src/model/fixCoreMechanics.js';

test('shipped data holds the approved spell cost and flux numbers and the validator guards them', () => {
  assert.deepEqual(shipped.spellCosts, { version: 1, manaSurcharge: 1, staminaSurcharge: 0, cantripTag: 'rank.cantrip', manaOnlyTag: 'cost.manaOnly', preparedStaminaDiscount: 1, focusManaDiscount: 1 });
  assert.deepEqual(shipped.elementFlux, { version: 1, multiplier: 1.25 });
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  const { spellCosts, elementFlux, ...saved } = shipped;
  assert.doesNotThrow(() => validateFixCoreRules(saved), 'a block saved before the ruling stays valid');
  const costs = patch => validateFixCoreRules({ ...shipped, spellCosts: { ...shipped.spellCosts, ...patch } });
  assert.throws(() => costs({ manaSurcharge: -1 }), /spellCosts/);
  assert.throws(() => costs({ staminaSurcharge: 0.5 }), /spellCosts/);
  assert.throws(() => costs({ extra: 1 }), /spellCosts/);
  assert.throws(() => costs({ manaOnlyTag: '' }), /spellCosts/);
  const { manaOnlyTag, ...older } = shipped.spellCosts;
  assert.doesNotThrow(() => validateFixCoreRules({ ...shipped, spellCosts: older }), 'a block saved before the mana-only tag stays valid');
  assert.throws(() => costs({ version: 2 }), /spellCosts/);
  const flux = patch => validateFixCoreRules({ ...shipped, elementFlux: { ...shipped.elementFlux, ...patch } });
  assert.throws(() => flux({ multiplier: 0.5 }), /elementFlux/);
  assert.throws(() => flux({ extra: 1 }), /elementFlux/);
});

// ---- Costs (src/engine/spellCosts.js, applied in combat.js resolvedCardPriceReceipt) ----
import { fight, profile, reg } from './elementFixture.mjs';
import { cardPlayCosts, previewCard, dispatch } from '../src/engine/combat.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';
import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
const printedCostRegistries = legacyGearRegistries(reg);

const SPELLS = profile.content.cards.filter(card => cardManaCategory(reg, reg.cards.get(card.id)) === 'spell');
const PREPARED = { maneuver: 'casting', camp: 'spell' };
const fightCache = new Map();
// One fight per (hand, stance, rules) is reused for every card: pricing reads the fight and never changes it.
function costsIn({ hand, stance, id, legacy = false }) {
  const key = `${hand}|${stance ? 'prepared' : ''}|${legacy}`;
  if (!fightCache.has(key)) {
    // These tables isolate the spellCosts rule against its pre-gear price; live flux/payment fixtures below keep current equipment.
    const { combat } = fight({ legacy, registries: printedCostRegistries });
    if (legacy) { delete combat.fixCoreRules.spellCosts; delete combat.fixCoreRules.elementFlux; }
    combat.loadout.sets.rightHand[0] = hand;
    if (stance) combat.player.combatStance = { ...stance };
    fightCache.set(key, combat);
  }
  const combat = fightCache.get(key);
  const card = combat.piles.hand[0];
  card.cardId = id;
  return { costs: cardPlayCosts(combat, card.instanceId), preview: previewCard(combat, card.instanceId), combat };
}
// The rule written out on top of the price the fight charged before the ruling (its stance cuts, such as a Graduate's same-stance Mana cut, are unchanged):
// Mana +1; Stamina +1 unless a cantrip (or X-cost); Prepared -1 Stamina; a Focus item -1 Mana; floors at 0. `before` is the same card priced with the rule off.
function expected(card, before, { prepared, focus }) {
  const cantrip = card.tags.includes('rank.cantrip'), x = card.cost === 'X', manaOnly = card.tags.includes('cost.manaOnly');
  return { stamina: x ? null : Math.max(0, before.stamina + (cantrip || manaOnly ? 0 : 1) - (prepared ? 1 : 0)), mana: Math.max(0, before.mana + 1 - (focus ? 1 : 0)) };
}

test('cost table over every shipped Core 2 spell and cantrip: base, Prepared, Focus, both (shown = paid)', () => {
  assert.ok(SPELLS.length >= 60, 'the table covers the whole shipped spell list');
  assert.ok(SPELLS.some(card => card.tags.includes('rank.cantrip')) && SPELLS.some(card => !card.tags.includes('rank.cantrip')));
  for (const card of SPELLS) {
    for (const [name, hand, stance] of [['base', 'greatsword', null], ['Prepared', 'greatsword', PREPARED], ['Focus', 'boneSceptre', null], ['both', 'boneSceptre', PREPARED]]) {
      // Before the ruling: no Focus item, so nothing but the stance's own cuts is in this price.
      const before = costsIn({ hand: 'greatsword', stance, id: card.id, legacy: true }).costs;
      const want = expected(card, before, { prepared: !!stance, focus: hand === 'boneSceptre' });
      const { costs, preview } = costsIn({ hand, stance, id: card.id });
      if (want.stamina !== null) assert.equal(costs.stamina, want.stamina, `${card.id} ${name} SP`);
      assert.equal(costs.mana, want.mana, `${card.id} ${name} MP`);
      assert.equal(preview.manaCost, costs.mana, `${card.id} ${name}: the preview shows the Mana paid`);
      assert.equal(costs.energy, costs.stamina, `${card.id} ${name}: Stamina paid is the Action cost`);
    }
  }
});

test('literal prices: a 1 SP / 1 MP spell is 2/2 plain, 1/1 in Prepared, 2/1 with a Focus, 1/0 with both; a cantrip (Mana Surge is one) is 1/1, 0/1, 1/0, 0/0', () => {
  for (const [id, base, prepared, focus, both] of [['core.cometLance', [2, 2], [1, 1], [2, 1], [1, 0]], ['core.cantrip', [1, 2], [0, 1], [1, 1], [0, 0]] /* Arcane Spark prints 1 MP (owner 2026-11-22): +1 surcharge; the Graduate's Prepared cut floors at 0 (owner 2026-11-22), like Comet Lance */, ['core.manaSurge', [1, 1], [0, 1], [1, 0], [0, 0]]]) {
    for (const [hand, stance, want] of [['greatsword', null, base], ['greatsword', PREPARED, prepared], ['boneSceptre', null, focus], ['boneSceptre', PREPARED, both]]) {
      const { costs } = costsIn({ hand, stance, id });
      assert.deepEqual([costs.stamina, costs.mana], want, `${id} ${hand} ${stance ? 'Prepared' : 'no stance'}`);
    }
  }
});

test('a cantrip after a first spell with a Focus costs 0 SP and 0 MP, and the payment equals the face', () => {
  const { combat } = fight(); // its own fight: this test plays cards
  combat.loadout.sets.rightHand[0] = 'boneSceptre';
  const [first, second] = combat.piles.hand;
  first.cardId = 'core.cometLance'; second.cardId = 'core.mendingTouch'; // a 0 MP cantrip: Arcane Spark prints 1 MP since the owner ruling of 2026-11-22 (SPEC.md Cantrip and Basic Mana) and a Graduate's stance cut floors at 0 on the player's turn since 2026-11-22
  const open = cardPlayCosts(combat, second.instanceId);
  assert.deepEqual([open.stamina, open.mana], [1, 0], 'before the first cast: 1 SP, 0 MP (Focus took the surcharge back)');
  const [energy, mana] = [combat.player.energy, combat.player.mana];
  dispatch(combat, { type: 'playCard', cardInstanceId: first.instanceId, targetId: combat.enemies[0].id });
  assert.ok(energy - combat.player.energy >= 1);
  assert.ok(mana - combat.player.mana >= 0);
  assert.ok(['casting', 'prepared'].includes(combat.player.combatStance?.maneuver), 'the first cast enters Prepared');
  const after = cardPlayCosts(combat, second.instanceId);
  assert.deepEqual([after.stamina, after.mana], [0, 0]);
  assert.equal(previewCard(combat, second.instanceId).manaCost, 0);
  const [e1, m1] = [combat.player.energy, combat.player.mana];
  dispatch(combat, { type: 'playCard', cardInstanceId: second.instanceId, targetId: combat.player.id });
  assert.equal(e1 - combat.player.energy, 0, 'paid 0 SP');
  assert.equal(m1 - combat.player.mana, 0, 'paid 0 MP');
});

test('a basic attack is no spell: it takes no surcharge and no Prepared cut', () => {
  const strike = costsIn({ hand: 'greatsword', stance: PREPARED, id: 'core.strike' }).costs, plain = costsIn({ hand: 'greatsword', stance: PREPARED, id: 'core.strike', legacy: true }).costs;
  assert.deepEqual(strike, plain);
});

test('a fight saved without the spellCosts block keeps today\'s costs and the Prepared-only Focus rule', () => {
  for (const card of SPELLS) {
    const plain = costsIn({ hand: 'greatsword', stance: null, id: card.id, legacy: true }).costs;
    if (card.cost !== 'X') assert.equal(plain.stamina, card.staminaCost, `${card.id} SP as printed`);
    assert.equal(plain.mana, card.manaCost, `${card.id} MP as printed`);
    const focusOff = costsIn({ hand: 'boneSceptre', stance: null, id: card.id, legacy: true }).costs;
    assert.equal(focusOff.mana, card.manaCost, `${card.id}: old Focus gives nothing outside Prepared`);
    const prepared = costsIn({ hand: 'greatsword', stance: PREPARED, id: card.id, legacy: true }).costs;
    const focusOn = costsIn({ hand: 'boneSceptre', stance: PREPARED, id: card.id, legacy: true }).costs;
    assert.equal(focusOn.mana, Math.max(0, prepared.mana - 1), `${card.id}: old Focus takes 1 Mana off in Prepared`);
    if (card.cost !== 'X') assert.equal(prepared.stamina, card.staminaCost, `${card.id}: Prepared took no Stamina off before`);
  }
});

// ---- Elemental flux (src/engine/elementFlux.js) ----
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { FluxScale, FluxMultiplier, FluxElement } from '../src/engine/elementFlux.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const FIRE = { cardId: 'core.cinderDart', instanceId: 'i1', combatProfile: { camp: 'spell', school: 'fire', damageType: 'arcane', magicShare: 1 }, tags: ['school:fire'], magicShare: 1 };
const FROST = { ...FIRE, combatProfile: { ...FIRE.combatProfile, school: 'frost' }, tags: ['school:frost'] };
// The printed base is doubled because Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so the flux stage meets `base`.
const quote = (combat, carrier, base) => profileDamageReceipt(combat, combat.player, combat.enemies[0], base * 2, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const flux = receipt => receipt.damageReceipt.hits[0].sources.find(row => row.id === 'element-flux');

test('a card of the flux element is lifted x1.25 and floored: 10 -> 12, 7 -> 8, 3 -> 3; another element, no flux, a return hit and an old fight are not', () => {
  const { combat } = fight();
  combat.player.elementFlux = 'fire';
  for (const [base, want] of [[10, 12], [7, 8], [3, 3], [20, 25]]) {
    const stage = flux(quote(combat, FIRE, base));
    assert.equal(stage.multiplier, 1.25, `the quote lists the flux stage for ${base}`);
    assert.equal(stage.effective, want, `floor(${base} x 1.25)`);
  }
  assert.equal(flux(quote(combat, FROST, 10)), undefined, 'a Frost card is not lifted by Fire flux');
  assert.equal(flux(quote(combat, { ...FIRE, counterReturnAttack: true }, 10)), undefined, 'a Counter return hit is never lifted');
  assert.equal(flux(quote(combat, { ...FIRE, cardId: undefined, instanceId: undefined }, 10)), undefined, 'only a played card is lifted (no status tick or enemy move)');
  delete combat.player.elementFlux;
  assert.equal(flux(quote(combat, FIRE, 10)), undefined, 'no flux, no lift');
  const old = fight({ legacy: true });
  delete old.combat.fixCoreRules.elementFlux; old.combat.player.elementFlux = 'fire';
  assert.equal(flux(quote(old.combat, FIRE, 10)), undefined, 'a fight created before the ruling has no flux even if the key is set');
  assert.equal(FluxMultiplier(old.combat, old.combat.player, FIRE), 1);
  assert.equal(FluxElement(old.combat, old.combat.player), null);
});

test('FluxScale floors every number it lifts (Block, healing, status stacks)', () => {
  const { combat } = fight();
  combat.player.elementFlux = 'fire';
  assert.deepEqual([3, 4, 5, 8, 10].map(n => FluxScale(combat, combat.player, FIRE, n)), [3, 5, 6, 10, 12]);
  assert.deepEqual([3, 4].map(n => FluxScale(combat, combat.player, FROST, n)), [3, 4]);
  combat.phase = 'enemy';
  assert.equal(FluxScale(combat, combat.player, FIRE, 4), 4, 'the enemy phase neither reads nor changes the flux');
});

const SELF = new Set(['core.steadyHands', 'core.mendingTouch']);
function sequence(ids, { legacy = false, attributes = { strength: 2 } } = {}) {
  const { combat, enemy } = fight({ attributes });
  if (legacy) delete combat.fixCoreRules.elementFlux;
  combat.player.energy = 30; combat.player.mana = 30;
  const rows = [];
  ids.forEach((id, index) => {
    const card = combat.piles.hand[0];
    card.cardId = id;
    const target = SELF.has(id) ? undefined : enemy.id;
    primeAccuracyRolls(combat);
    const before = { hp: enemy.hp, block: combat.player.block, playerHp: combat.player.hp };
    const view = previewCard(combat, card.instanceId, target);
    const face = view.values.find(value => value.op === 'damage')?.faceValue ?? null;
    const blockFace = view.values.find(value => value.op === 'block')?.value ?? null;
    const healFace = view.values.find(value => value.op === 'heal')?.value ?? null;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target });
    rows.push({ id, face, blockFace, healFace, lost: before.hp - enemy.hp, block: combat.player.block - before.block, flux: combat.player.elementFlux ?? null });
  });
  return { combat, rows };
}
const DART = 'core.cinderDart', NIP = 'core.frostNip', ARC = 'core.cantrip', STRIKE = 'core.strike';

test('flux chain: Fire, Fire, Fire lifts the second and third (the first sets it); face = damage dealt', () => {
  const live = sequence([DART, DART, DART]).rows, control = sequence([DART, DART, DART], { legacy: true }).rows;
  assert.deepEqual(live.map(row => row.flux), ['fire', 'fire', 'fire'], 'the flux stays while the element repeats');
  assert.deepEqual(control.map(row => row.flux), [null, null, null], 'an old fight sets none');
  assert.equal(live[0].face, control[0].face, 'the first cast is never lifted by the flux it creates');
  for (const index of [1, 2]) {
    assert.ok(live[index].face > control[index].face, `cast ${index + 1} is lifted`);
    assert.ok(Math.abs(live[index].face - control[index].face * 1.25) < 1.25 + 1e-9, `cast ${index + 1} is about x1.25: ${live[index].face} vs ${control[index].face}`);
  }
  for (const row of live) assert.equal(row.lost, row.face, `${row.id}: shown = dealt`);
});

test('flux chain: Fire then Frost replaces the flux, a non-element spell clears it, a non-spell leaves it', () => {
  const live = sequence([DART, NIP, DART, STRIKE, ARC, DART]).rows, control = sequence([DART, NIP, DART, STRIKE, ARC, DART], { legacy: true }).rows;
  assert.deepEqual(live.map(row => row.flux), ['fire', 'frost', 'fire', 'fire', null, 'fire']);
  assert.equal(live[1].face, control[1].face, 'Frost after Fire is not lifted (the flux was Fire)');
  assert.equal(live[2].face, control[2].face, 'Fire after Frost is not lifted (Frost replaced the flux)');
  assert.equal(live[5].face, control[5].face, 'Fire after a non-element spell is not lifted (it cleared the flux)');
});

test('flux lifts Block and healing too, floored; the face shows the lifted number', () => {
  const ward = sequence([DART, 'core.cinderWard']), wardControl = sequence([DART, 'core.cinderWard'], { legacy: true });
  assert.ok(ward.rows[1].block > wardControl.rows[1].block, 'Cinder Ward after Fire gains more Block');
  assert.equal(ward.rows[1].blockFace, ward.rows[1].block, 'Block face = Block gained');
  const heal = sequence(['core.steadyHands', 'core.mendingTouch']), healControl = sequence(['core.steadyHands', 'core.mendingTouch'], { legacy: true });
  assert.deepEqual(heal.rows.map(row => row.flux), ['divine', 'divine']);
  assert.ok(heal.rows[1].healFace > healControl.rows[1].healFace, 'Mending Touch after Steady Hands heals more');
  assert.equal(heal.rows[0].healFace, healControl.rows[0].healFace, 'the first cast is not lifted');
});

test('flux ends at the end of the turn and with the fight', () => {
  const { combat } = sequence([DART, DART]);
  assert.equal(combat.player.elementFlux, 'fire');
  dispatch(combat, { type: 'endTurn' });
  assert.equal(combat.player.elementFlux, undefined, 'the player turn ended');
  const { combat: other } = sequence([DART]);
  assert.equal(other.player.elementFlux, 'fire');
  other.enemies.forEach(enemy => { enemy.hp = 1; });
  other.piles.hand[0].cardId = DART;
  primeAccuracyRolls(other);
  dispatch(other, { type: 'playCard', cardInstanceId: other.piles.hand[0].instanceId, targetId: other.enemies[0].id });
  assert.equal(other.result, 'victory');
  assert.equal(other.player.elementFlux, undefined, 'the fight is over: no flux');
});

// ---- The caster's second stance icon (src/ui/models/StanceBenefitModel.js) ----
import { PlayerFluxView, FluxTip } from '../src/ui/models/StanceBenefitModel.js';
import { ElementFluxRules } from '../src/engine/elementFlux.js';

test('the second stance icon shows for a caster: the flux element, or the plain magic mark in Prepared; nothing without the rules or a stance', () => {
  const { combat } = fight(), rules = ElementFluxRules(combat);
  assert.equal(rules.multiplier, 1.25);
  assert.deepEqual(PlayerFluxView(rules, { elementFlux: 'fire' }, true), { element: 'fire', multiplier: 1.25 });
  assert.deepEqual(PlayerFluxView(rules, {}, true), { element: null, multiplier: 1.25 }, 'Prepared with no flux wears the magic mark');
  assert.deepEqual(PlayerFluxView(rules, { elementFlux: 'frost' }, false), { element: 'frost', multiplier: 1.25 });
  assert.equal(PlayerFluxView(rules, {}, false), null, 'no stance and no flux: hidden');
  assert.equal(PlayerFluxView(null, { elementFlux: 'fire' }, true), null, 'a fight without the rule shows none');
  const old = fight().combat; delete old.fixCoreRules.elementFlux;
  assert.equal(ElementFluxRules(old), null);
});

test('the flux tooltip names the element, the multiplier and the rounding', () => {
  assert.deepEqual(FluxTip({ element: 'fire', multiplier: 1.25 }).title, 'Fire flux');
  assert.match(FluxTip({ element: 'fire', multiplier: 1.25 }).body, /Next Fire cards ×1\.25 \(rounded down\)/);
  assert.match(FluxTip({ element: 'necrotic', multiplier: 1.25 }).title, /Necrotic flux/);
  assert.equal(FluxTip({ element: null, multiplier: 1.25 }).title, 'Magic');
  assert.match(FluxTip({ element: null, multiplier: 1.25 }).body, /only the stance bonus/);
});

test('a change of flux is announced once: set, replaced, cleared, and nothing when it did not change', () => {
  const { combat } = sequence([DART, DART, NIP, ARC]);
  const events = combat.eventLog.filter(row => row.type === 'elementFluxChanged').map(row => row.element);
  assert.deepEqual(events, ['fire', 'frost', null]);
});
