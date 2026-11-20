// Owner 2026-11-15 (W25-MS): "add more spells that cost 0 sp but 2 to 3 mp to make them worth while". Nine Core spells carry cost.manaOnly: printed
// 0 Stamina, 1 or 2 Mana; the spell cost rule adds the +1 Mana surcharge and skips the +1 Stamina one, so they pay 0 SP and 2 or 3 MP (a Focus item
// takes 1 MP off). Each is clearly stronger per Mana than the same-rarity 2 SP / 2 MP spells it replaces in the hand, computed here from card data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, profile, reg } from './elementFixture.mjs';
import { cardPlayCosts, dispatch } from '../src/engine/combat.js';
import { resolveCard } from '../src/model/registries.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { cardManaCategory } from '../src/model/cardManaPolicy.js';
import { ElementOfHit } from '../src/model/elementIdentityRules.js';

const NEW = {
  'core.pyreLash': { cls: 'starseer', rarity: 'uncommon', mana: 1, element: 'fire' },
  'core.conflagration': { cls: 'starseer', rarity: 'rare', mana: 2, element: 'fire' },
  'core.forkedBolt': { cls: 'colorless', rarity: 'uncommon', mana: 1, element: 'lightning' },
  'core.stormcall': { cls: 'starseer', rarity: 'rare', mana: 2, element: 'lightning' },
  'core.glacialSpike': { cls: 'starseer', rarity: 'uncommon', mana: 1, element: 'frost' },
  'core.radiantVerdict': { cls: 'herald', rarity: 'rare', mana: 2, element: 'divine' },
  'core.witherDraught': { cls: 'herald', rarity: 'uncommon', mana: 1, element: 'necrotic' },
  'core.batteringGale': { cls: 'colorless', rarity: 'uncommon', mana: 1, element: 'force' },
  'core.openArchive': { cls: 'colorless', rarity: 'rare', mana: 2, element: null },
};
const def = id => profile.content.cards.find(card => card.id === id);
const PREPARED = { maneuver: 'casting', camp: 'spell' };

test('every new card is authored in its class and rarity, tagged cost.manaOnly, prints 0 SP and passes content validation at both grades', () => {
  for (const [id, want] of Object.entries(NEW)) {
    const card = def(id);
    assert.ok(card, id);
    assert.deepEqual([card.class, card.rarity, card.staminaCost, card.manaCost], [want.cls, want.rarity, 0, want.mana], id);
    assert.ok(card.tags.includes('cost.manaOnly') && card.tags.includes('camp:spell') && !card.tags.includes('rank.cantrip'), id);
    const base = resolveCard(reg, { cardId: id }), up = resolveCard(reg, { cardId: id, upgraded: true });
    assert.ok(base.textTemplate && up.textTemplate, id);
    assert.notDeepEqual(up.effects, base.effects, `${id}: the upgrade changes numbers`);
    assert.equal(up.manaCost, base.manaCost, `${id}: the upgrade keeps its Mana cost`);
  }
  assert.equal(new Set(Object.keys(NEW).map(id => def(id).name)).size, 9);
});

test('the shipped cards carry the element their school names (flux and the element rules read it)', () => {
  for (const [id, want] of Object.entries(NEW)) assert.equal(ElementOfHit({ ...reg.cards.get(id), cardTags: reg.cards.get(id).tags }), want.element, id);
});

const fights = new Map();
function costsOf(id, { hand, stance, legacy = false }) {
  const key = `${hand}|${!!stance}|${legacy}`;
  if (!fights.has(key)) {
    const { combat } = fight();
    if (legacy) { delete combat.fixCoreRules.spellCosts; delete combat.fixCoreRules.elementFlux; }
    combat.loadout.sets.rightHand[0] = hand;
    if (stance) combat.player.combatStance = { ...stance };
    fights.set(key, combat);
  }
  const combat = fights.get(key), card = combat.piles.hand[0];
  card.cardId = id;
  return cardPlayCosts(combat, card.instanceId);
}

test('effective cost table: 0 SP and 2 or 3 MP plain and Prepared; a Focus item takes 1 MP off (1 or 2 MP)', () => {
  for (const [id, want] of Object.entries(NEW)) {
    for (const [name, hand, stance, focus] of [['plain', 'greatsword', null, 0], ['Prepared', 'greatsword', PREPARED, 0], ['Focus', 'boneSceptre', null, 1], ['both', 'boneSceptre', PREPARED, 1]]) {
      // The price the fight charged before the ruling (a stance's own Mana cut is in it) plus the rule: Mana +1, a Focus -1; Stamina 0 whatever the stance.
      const before = costsOf(id, { hand: 'greatsword', stance, legacy: true });
      const costs = costsOf(id, { hand, stance });
      assert.deepEqual([costs.stamina, costs.mana], [0, before.mana + 1 - focus], `${id} ${name}`);
      if (!stance) assert.equal(costs.mana, want.mana + 1 - focus, `${id} ${name}: printed Mana + 1, a Focus 1 less`);
      assert.equal(costs.energy, 0, `${id} ${name}: no Action cost`);
    }
    assert.ok([2, 3].includes(want.mana + 1));
  }
});

test('a card without the mark still pays the +1 Stamina surcharge (Comet Lance stays 2 SP / 2 MP)', () => {
  const costs = costsOf('core.cometLance', { hand: 'greatsword', stance: null });
  assert.deepEqual([costs.stamina, costs.mana], [2, 2]);
});

test('a fight created before the mark (no manaOnlyTag key) has no exemption: the +1 Stamina surcharge lands on a mana-only card', () => {
  const { combat } = fight();
  combat.loadout.sets.rightHand[0] = 'greatsword';
  delete combat.fixCoreRules.spellCosts.manaOnlyTag;
  const card = combat.piles.hand[0]; card.cardId = 'core.pyreLash';
  const costs = cardPlayCosts(combat, card.instanceId);
  assert.deepEqual([costs.stamina, costs.mana], [1, 2], 'without the key the +1 Stamina surcharge applies again (the card has no exemption in an older fight)');
});

// ---- Power per Mana against the 2 SP / 2 MP spells of the same rarity ----
// Weights (damage-equivalents): an All-enemies number counts twice (against two enemies); Poise 1.5; Block 1; heal 2; an enemy debuff or damage-over-time
// stack 3 (Burn, Shock, Chill, Necrotic Blight, Weak, Vulnerable, Frail); a self Regen stack 3; Barrier 1.5; a drawn card 7; a restored Mana 8.
const STATUS_WEIGHT = { burn: 3, shock: 3, chill: 3, necroticBlight: 3, weak: 3, vulnerable: 3, frail: 3, regen: 3 };
function power(effects) {
  let total = 0;
  for (const effect of effects) {
    const wide = effect.target === 'allEnemies' ? 2 : 1;
    if (effect.op === 'damage') total += effect.amount * wide;
    else if (effect.op === 'poiseDamage') total += effect.amount * 1.5 * wide;
    else if (effect.op === 'block') total += effect.amount;
    else if (effect.op === 'heal') total += effect.amount * 2;
    else if (effect.op === 'gainBarrier') total += effect.amount * 1.5;
    else if (effect.op === 'draw') total += effect.amount * 7;
    else if (effect.op === 'restoreMana') total += effect.amount * 8;
    else if (effect.op === 'applyStatus') total += (STATUS_WEIGHT[effect.status] ?? 3) * effect.stacks * wide;
  }
  return total;
}
const median = list => { const sorted = [...list].sort((a, b) => a - b), mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
// Power per effective Mana (printed Mana + the 1 surcharge) of a card at one grade, so a 2 SP / 2 MP spell and a 0 SP / 3 MP one compare on the scarce resource.
const perMana = (card, grade) => power(grade === 'up' ? card.upgrade.effects : card.effects) / (card.manaCost + 1);
const MARGIN = 1.25;

test(`every mana-only spell has at least ${MARGIN}x the power per Mana of the median same-rarity Core spell that pays Stamina and Mana (base and upgraded)`, () => {
  const peers = rarity => profile.content.cards.filter(card => card.rarity === rarity && card.staminaCost >= 1 && card.manaCost >= 1 && !card.tags.includes('cost.manaOnly')
    && !card.tags.includes('rank.cantrip') && cardManaCategory(reg, reg.cards.get(card.id)) === 'spell' && card.upgrade?.effects && card.class !== 'enemy' && card.effects.some(effect => ['damage', 'block', 'draw', 'applyStatus', 'heal'].includes(effect.op)));
  const rows = [];
  for (const rarity of ['uncommon', 'rare']) {
    const list = peers(rarity);
    assert.ok(list.length >= 3, `${rarity}: enough peers (${list.length})`);
    for (const grade of ['base', 'up']) {
      const bar = median(list.map(card => perMana(card, grade)));
      for (const [id, want] of Object.entries(NEW)) {
        if (want.rarity !== rarity) continue;
        const ratio = perMana(def(id), grade) / bar;
        rows.push(`${id} ${grade}: ${ratio.toFixed(2)}x (${perMana(def(id), grade).toFixed(1)} vs median ${bar.toFixed(1)} per Mana)`);
        assert.ok(ratio >= MARGIN, `${id} ${grade}: ${ratio.toFixed(2)}x of the ${rarity} median, wanted >= ${MARGIN}x`);
      }
    }
  }
  if (process.env.SHOW_RATIOS) console.log(rows.join('\n'));
});

// ---- Pools: each card reaches its own class ----
const live = (classId, seed) => createRunState({ registries: reg, seed, classId, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
// Owner, 2026-11-20: a fresh run is offered only the spells its max Mana pays (1 MP, +1 per four WIS; stat contract 2026-11-18). A card
// above a fresh class's pool is never offered to it; every card it can pay reaches it.
test('each new card is offered to its own class (colorless to every caster) when that class can pay for it, and never to another class', () => {
  const seen = { starseer: new Set(), herald: new Set(), rogue: new Set() };
  const pool = Object.fromEntries(Object.keys(seen).map(classId => [classId, live(classId, 1).maxMana]));
  const pays = (classId, id) => (def(id).manaCost || 0) <= pool[classId];
  const ownClass = (classId, id) => pays(classId, id) ? seen[classId].has(id) : !seen[classId].has(id);
  for (const classId of Object.keys(seen)) for (let seed = 1; seed <= 400; seed++) {
    const run = live(classId, seed); run.floor = 1 + (seed % 6);
    for (const option of gameProfileRewardOffers(reg, run, createRng(seed + 50000), { offerId: 'ms' }).options) if (option.kind === 'combatCards') seen[classId].add(option.id);
  }
  for (const [id, want] of Object.entries(NEW)) {
    if (want.cls === 'starseer') { assert.ok(ownClass('starseer', id), `${id} offered to Starseer exactly when it pays ${pool.starseer} MP or less`); assert.ok(!seen.herald.has(id) && !seen.rogue.has(id), `${id} stays in its class`); }
    if (want.cls === 'herald') { assert.ok(ownClass('herald', id), `${id} offered to Herald exactly when it pays ${pool.herald} MP or less`); assert.ok(!seen.starseer.has(id) && !seen.rogue.has(id), `${id} stays in its class`); }
    if (want.cls === 'colorless') for (const classId of Object.keys(seen)) assert.ok(ownClass(classId, id), `colorless ${id} reaches ${classId} exactly when it can pay`);
  }
});

// ---- Flux and play ----
test('the element spells play for 0 SP, set their element as the flux and the next one of that element is lifted x1.25', () => {
  const { combat, enemy } = fight({ enemies: 1 });
  combat.loadout.sets.rightHand[0] = 'boneSceptre';
  const [a, b] = combat.piles.hand;
  a.cardId = 'core.pyreLash'; b.cardId = 'core.conflagration';
  const energy = combat.player.energy, mana = combat.player.mana;
  dispatch(combat, { type: 'playCard', cardInstanceId: a.instanceId, targetId: enemy.id });
  assert.equal(combat.player.energy, energy, 'Pyre Lash cost no Stamina');
  assert.equal(mana - combat.player.mana, 1, 'with a Focus: printed 1 Mana + 1 surcharge - 1 Focus');
  assert.equal(combat.player.elementFlux, 'fire');
  const before = enemy.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: b.instanceId, targetId: enemy.id });
  assert.equal(combat.player.energy, energy, 'Conflagration cost no Stamina either');
  assert.ok(before - enemy.hp >= Math.floor(22 * 1.25) - 2, `the fluxed Fire card dealt ${before - enemy.hp}`);
});

test('Open the Archive draws, restores Mana and exhausts (non-element: it clears the flux)', () => {
  const { combat } = fight();
  combat.loadout.sets.rightHand[0] = 'greatsword';
  const card = combat.piles.hand[0]; card.cardId = 'core.openArchive';
  combat.player.elementFlux = 'fire';
  // Room for the restore: Core max Mana is 1 + one per four WIS (stat contract 2026-11-18), and the price and restore are what is tested.
  combat.player.maxMana = 4;
  combat.player.mana = 4;
  const mana = combat.player.mana;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
  assert.equal(combat.player.mana - mana, 2 - 3, 'costs 3 Mana, restores 2');
  assert.equal(combat.player.elementFlux ?? null, null);
  assert.ok(combat.piles.exhaust.some(c => c.instanceId === card.instanceId));
});
