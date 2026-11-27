import { cardManaCategory } from '../src/model/cardManaPolicy.js';
import { cardManaPolicy } from '../src/content/generated/cardManaPolicy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardCostBudget, isCostOptOut } from '../src/model/actionCosts.js';
import { applyAbilityGrade } from '../src/model/abilityGrades.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';

const reg = createRegistries(contentBundle);
const legacyReg = reg.legacyProgressionSource;
const rewardIds = new Set(contentBundle.legacyProgression.classes.flatMap(c => c.cardPool));

test('current legacy reward definitions resolve every authored pool entry at its quoted cost', () => {
  assert.ok(rewardIds.size > 0);
  for (const id of rewardIds) {
    const card = legacyReg.cards.get(id);
    assert.ok(card, `${id} from the authored reward pools reaches the registry`);
    for (const upgraded of [false, true]) {
      const def = resolveCard(legacyReg, { cardId: id, upgraded });
      const quote = legacyReg.framework.costProfile(def);
      assert.equal(quote.stamina, def.cost === 'X' ? 0 : def.cost, id);
      assert.equal(quote.mana, def.manaCost || 0, id);
      assert.ok(isCostOptOut(def) || def.cost + (def.manaCost || 0) >= 1, `${id}: priced cards cost a resource`);
    }
  }
});

// Every ability grade is priced by the cost formula at its own rank (SPEC §4.3a, owner 2026-10-12): the authored
// actionCost and manaCost are the inputs no longer; the face's effects and tags are. Replaced rule: the grade's Mana was
// its rank and its Actions were the authored number (later, the stance price plus the grade's delta).
test('every expanded ability grade pays its fixed or formula price with the authored Mana floor', () => {
  const families = reg.cards.all().filter(card => card.gradeProfiles);
  assert.ok(families.length > 0, 'exercise authored ability grades');
  for (const card of families) {
    for (const profile of card.gradeProfiles) {
      const rank = profile.rank;
      const def = resolveCard(reg, { cardId: card.id, abilityRank: rank });
      const cost = reg.framework.costProfile(def);
      assert.equal(profile.rank, rank, card.id);
      const grade = applyAbilityGrade(card, rank);
      if (isCostOptOut(grade)) {
        assert.equal(def.cost, profile.actionCost, `${card.id} grade ${rank}: fixed authored SP`);
        assert.equal(def.manaCost || 0, Math.max(profile.manaCost || 0, cardManaCategory(reg, grade) ? cardManaPolicy.minimumMana : 0), `${card.id} grade ${rank}: fixed authored MP`);
        assert.equal(cost.stamina, def.cost); assert.equal(cost.mana, def.manaCost || 0);
        continue;
      }
      const priced = cardCostBudget(grade, { rank });
      assert.equal(def.cost, priced.sp, `${card.id} grade ${rank}: the formula's Stamina`);
      assert.equal(def.manaCost || 0, Math.max(priced.mp, cardManaCategory(reg, grade) ? cardManaPolicy.minimumMana : 0), `${card.id} grade ${rank}: the formula's Mana`);
      assert.ok(def.cost + (def.manaCost || 0) >= 1, `${card.id} grade ${rank}: a priced card always costs something`);
      assert.equal(cost.stamina, def.cost, 'Actions and Stamina are the same resource');
      assert.equal(cost.mana, def.manaCost || 0, 'the framework reads the derived Mana');
      assert.equal(def.staminaCost || 0, 0, 'no additional Stamina charge');
    }
  }
});

// Payment and atomic refusal use explicit small cards, so retuning authored
// abilities does not change which resource or enemy this regression exercises.
const paymentCards = [
  { id: 'fixture.payment-sp', cost: 1, manaCost: 0 },
  { id: 'fixture.payment-dual', cost: 1, manaCost: 1 },
  { id: 'fixture.payment-mp', cost: 0, manaCost: 2 },
].map(row => ({ ...row, name: row.id, class: 'colorless', type: 'attack', rarity: 'common',
  costRule: 'fixed', keywords: [], tags: [], effects: [{ op: 'damage', target: 'enemy', amount: 1 }],
  textTemplate: 'Deal {damage} damage.', upgrade: { cost: row.cost, manaCost: row.manaCost, effects: [{ op: 'damage', target: 'enemy', amount: 2 }], textTemplate: 'Deal {damage} damage.' } }));
const paymentReg = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, ...paymentCards],
  enemies:[...contentBundle.enemies,{id:'fixture.payment-target',name:'Payment target',hp:[1000,1000],poiseMax:0,attributes:{strength:0,dexterity:0,constitution:0,wisdom:0,intelligence:0},moves:{wait:{intent:'block',block:0,weight:1}}}],
  tagging: [...contentBundle.tagging, ...paymentCards.flatMap(card => ['classification.attack', 'camp:physical'].map(tagId => ({ family: 'card', scope: '', objectId: card.id, tagId })))] });
function fight(cardId, upgraded = false) {
  const c = createCombat({ registries: paymentReg, rng: createRng(13), enemyIds: ['fixture.payment-target'],
    player: { classId: 'starseer', hp: 80, maxHp: 80, mana: 3, maxMana: 3, stamina: 3, maxStamina: 3,
      energyMax: 3, drawPerTurn: 1, relicIds: [], flasks: [],
      deck: [{ instanceId: 'cost-probe', cardId, upgraded }] } });
  c.player.energy = c.player.stamina = c.player.mana = 3;
  return c;
}
const play = c => dispatch(c, { type: 'playCard', cardInstanceId: 'cost-probe', targetId: c.enemies[0].id });

test('real plays pay quoted pools at base and upgraded levels', () => {
  for (const { id: cardId } of paymentCards) for (const upgraded of [false, true]) {
    const c = fight(cardId, upgraded);
    const def = resolveCard(paymentReg, { cardId, upgraded });
    play(c);
    assert.equal(c.player.energy, 3 - def.cost, `${cardId}: Actions`);
    assert.equal(c.player.stamina, 3 - def.cost, `${cardId}: stamina`);
    assert.equal(c.player.mana, 3 - (def.manaCost || 0), `${cardId}: mana`);
  }
});

test('either missing dual resource refuses atomically before payment or card movement', () => {
  for (const upgraded of [false, true]) for (const missing of ['mana', 'stamina']) {
    const c = fight('fixture.payment-dual', upgraded);
    c.player[missing] = 0;
    const before = { energy: c.player.energy, stamina: c.player.stamina, mana: c.player.mana,
      hand: structuredClone(c.piles.hand), hp: c.enemies[0].hp };
    assert.throws(() => play(c), missing === 'mana' ? /Not enough mana/ : /Not enough Actions \(Stamina\)/);
    assert.deepEqual({ energy: c.player.energy, stamina: c.player.stamina, mana: c.player.mana,
      hand: c.piles.hand, hp: c.enemies[0].hp }, before);
  }
});
