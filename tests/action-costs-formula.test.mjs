// The card cost formula (owner decisions, 2026-10-12; SPEC §4.3a) and the stat-driven enemy SP pool (SPEC §4.6a):
//   SP = floor(S_sp / D), MP = floor(S_mp / P); both 0 → the larger side pays 1 (SP on a tie).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { applyAbilityGrade } from '../src/model/abilityGrades.js';
import { COST_CONFIG, cardCostBudget, applyActionCosts, enemyPoolOf, isCostOptOut, validateCostConfig } from '../src/model/actionCosts.js';
import { COST_BUDGET, COST_TAGS } from '../src/content/actionCosts.js';
import { derivedStatRules } from '../src/content/derivedStats.js';
import * as Rounds from '../src/engine/combatRoundsAdapter.js';
import { createRunState } from '../src/model/state.js';
import { dispatch } from '../src/engine/combat.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';

const registries = createRegistries(contentBundle);
const variant = ({ budget = {}, tags = {} } = {}) => ({ ...COST_CONFIG, budget: { ...COST_CONFIG.budget, ...budget }, tags: { ...COST_CONFIG.tags, ...tags } });

// The owner's example (2026-10-12): "sword strike base damage 3, bladed, physical, slash, rank 0, all weight 1 →
// max(floor(6/20),1) = 1".
const SWORD_STRIKE = Object.freeze({ id: 'swordStrike', type: 'attack', cost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 3 }],
  tags: ['blade', 'camp:physical', 'damage:slashing'] });

test('the Sword Strike fixture: the owner\'s example prices to S_sp 6, and 1 SP at D = 20 and at the shipped tunables', () => {
  const owner = variant({ budget: { spDivisor: 20, damageWeight: 1, damageSteps: [] },
    tags: { blade: { weight: 1, side: 'sp' }, 'camp:physical': { weight: 1, side: 'sp' }, 'damage:slashing': { weight: 1, side: 'sp' } } });
  const example = cardCostBudget(SWORD_STRIKE, { rank: 0, config: owner });
  assert.equal(example.sSp, 6, '3 damage + bladed 1 + physical 1 + slash 1');
  assert.equal(example.sMp, 0);
  assert.deepEqual([example.sp, example.mp], [1, 0], 'floor(6/20) = 0, so the larger side (SP) pays 1');
  const shipped = cardCostBudget(SWORD_STRIKE, { rank: 0 });
  assert.deepEqual([shipped.sp, shipped.mp], [1, 0], 'a basic attack costs 1 SP at the shipped tunables');
  const halves = cardCostBudget(SWORD_STRIKE, { config: variant({ budget: { spDivisor: 2, damageWeight: 1, damageSteps: [] } }) });
  assert.equal(halves.sp, Math.floor(halves.sSp / 2), 'D is the divisor');
});

test('both sides 0: the larger side pays 1, SP on a tie', () => {
  const tiny = (tags) => cardCostBudget({ id: 't', type: 'skill', cost: 1, effects: [], tags }, { config: variant({ tags: { 'x:sp': { weight: 1, side: 'sp' }, 'x:mp': { weight: 2, side: 'mp' } } }) });
  assert.deepEqual([tiny(['x:sp']).sp, tiny(['x:sp']).mp], [1, 0]);
  assert.deepEqual([tiny(['x:mp']).sp, tiny(['x:mp']).mp], [0, 1], 'the Mana side is larger');
  assert.deepEqual([tiny([]).sp, tiny([]).mp], [1, 0], 'a tie at 0 pays SP');
});

test('Exhaust never raises a cost: every priced card costs no more with Exhaust than without it', () => {
  for (const card of registries.cards.all()) {
    if (isCostOptOut(card)) continue;
    const faces = Array.isArray(card.gradeProfiles) ? [0, 1, 2, 3, 4, 5].map((r) => [applyAbilityGrade(card, r), r]) : [[card, 0], [card, 2]];
    for (const [face, rank] of faces) {
      const keywords = (face.keywords || []).filter((k) => k !== 'exhaust');
      const without = cardCostBudget({ ...face, keywords }, { rank });
      const withIt = cardCostBudget({ ...face, keywords: [...keywords, 'exhaust'] }, { rank });
      assert.ok(withIt.sSp <= without.sSp && withIt.sMp <= without.sMp, `${card.id}@${rank}: Exhaust lowers the sums`);
      assert.ok(withIt.sp + withIt.mp <= without.sp + without.mp, `${card.id}@${rank}: ${withIt.sp}/${withIt.mp} with Exhaust, ${without.sp}/${without.mp} without`);
      assert.ok(withIt.sp <= without.sp || withIt.mp < without.mp, `${card.id}@${rank}: Exhaust buys no Stamina`);
    }
  }
});

test('the SP/MP trade is monotonic: moving points from the Mana side to the Stamina side never lowers SP or raises MP', () => {
  const tags = {};
  for (let i = 0; i < 24; i++) { tags[`x:sp${i}`] = { weight: 1, side: 'sp' }; tags[`x:mp${i}`] = { weight: 1, side: 'mp' }; }
  const config = variant({ tags });
  for (const total of [1, 3, 5, 8, 12, 17, 24]) {
    let prev = null;
    for (let spPoints = 0; spPoints <= total; spPoints++) {
      const card = { id: 'trade', type: 'skill', cost: 1, effects: [],
        tags: [...Array.from({ length: spPoints }, (_, i) => `x:sp${i}`), ...Array.from({ length: total - spPoints }, (_, i) => `x:mp${i}`)] };
      const out = cardCostBudget(card, { config });
      assert.equal(out.sSp + out.sMp, total, 'fixture: the points only move between the sides');
      if (prev) {
        assert.ok(out.sp >= prev.sp, `total ${total}, ${spPoints} on SP: SP ${prev.sp} → ${out.sp}`);
        assert.ok(out.mp <= prev.mp, `total ${total}, ${spPoints} on SP: MP ${prev.mp} → ${out.mp}`);
      }
      prev = out;
    }
  }
});

test('more damage, a higher rank, or another tag never lowers a cost', () => {
  const card = { id: 'm', type: 'attack', cost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 4 }], tags: ['camp:physical', 'delivery:melee'] };
  let prev = cardCostBudget(card);
  for (const damage of [6, 12, 20, 30, 45]) {
    const next = cardCostBudget({ ...card, effects: [{ op: 'damage', target: 'enemy', amount: damage }] });
    assert.ok(next.sSp >= prev.sSp && next.sp >= prev.sp, `damage ${damage}`);
    prev = next;
  }
  for (let rank = 1; rank <= 9; rank++) assert.ok(cardCostBudget(card, { rank }).sp >= cardCostBudget(card, { rank: rank - 1 }).sp, `rank ${rank}`);
  assert.ok(cardCostBudget({ ...card, tags: [...card.tags, 'maneuver:smash'] }).sp >= cardCostBudget(card).sp);
});

test('the validator refuses a weight outside -3..3, a negative non-drawback, a bad side, and a non-positive divisor', () => {
  assert.doesNotThrow(() => validateCostConfig(COST_CONFIG));
  assert.throws(() => validateCostConfig(variant({ tags: { blade: { weight: 4, side: 'sp' } } })), /blade/);
  assert.throws(() => validateCostConfig(variant({ tags: { blade: { weight: -1, side: 'sp' } } })), /only drawbacks/);
  assert.throws(() => validateCostConfig(variant({ tags: { blade: { weight: 1, side: 'hp' } } })), /side/);
  assert.throws(() => validateCostConfig(variant({ budget: { spDivisor: 0 } })), /spDivisor/);
  assert.throws(() => validateCostConfig({ ...COST_CONFIG, statusWeight: 1 }), /2\.\.3/);
  assert.throws(() => validateCostConfig(variant({ budget: { damageSteps: [5, 3] } })), /damageSteps/);
  for (const [tag, row] of Object.entries(COST_TAGS)) if (row.weight < 0) assert.ok(['lifecycle.exhaust', 'lifecycle.ethereal'].includes(tag) || tag.startsWith('drawback:'), tag);
  assert.ok(Object.isFrozen(COST_BUDGET) && Object.isFrozen(COST_TAGS));
});

test('def.manaCost reaches the framework Mana cost, and a played spell spends it', () => {
  // A rank-2 grade: rank weighs on the Mana side, so it pays Mana (a cantrip at grade 0 pays Stamina only).
  const spell = resolveCard(registries, { cardId: 'cometFragment', abilityRank: 2 });
  assert.ok(spell.manaCost >= 1, 'fixture: a spell the formula prices with Mana');
  assert.equal(registries.framework.costProfile(spell).mana, spell.manaCost);
  assert.equal(registries.framework.costProfile(spell).stamina, spell.cost);
  const physical = resolveCard(registries, { cardId: 'strike' });
  assert.equal(registries.framework.costProfile(physical).mana, 0, 'a physical card pays no Mana');
  // A grade rank's Mana is the formula's, not the authored grade's.
  const graded = resolveCard(registries, { cardId: 'cometFragment', abilityRank: 3 });
  assert.equal(registries.framework.costProfile(graded).mana, cardCostBudget(applyAbilityGrade(registries.cards.get('cometFragment'), 3), { rank: 3 }).mp);
  // The rank is part of the cached face: each rank is priced on its own.
  assert.ok(resolveCard(registries, { cardId: 'cometFragment', abilityRank: 0 }) !== graded);
  assert.equal(applyActionCosts(spell, spell, { rank: 2 }).manaCost, spell.manaCost, 'pricing a priced face again at its rank keeps its Mana');
});

test('enemy SP comes from stats: the stamina row on the enemy\'s attributes, plus equipment SP; 3 with none', () => {
  const row = derivedStatRules.rules.stamina;
  assert.equal(row.base, 3, 'fixture: the stamina row starts at 3');
  assert.equal(enemyPoolOf({}), 3, 'a minion or an elite with no stats');
  assert.equal(enemyPoolOf({ attributes: { dexterity: 4, constitution: 4, wisdom: 5, intelligence: 5 } }), 3 + 1 + 1 + 1 + 1);
  assert.equal(enemyPoolOf({ attributes: { dexterity: 3 } }), 3, 'each attribute term is floored on its own');
  assert.equal(enemyPoolOf({ equipmentSp: 2 }), 5);
  assert.equal(enemyPoolOf({ equipmentSp: -9 }), 0, 'never below 0');
  // Every shipped enemy is priced by its stats, and the rounds adapter reads the same pool.
  for (const def of registries.enemies.all()) {
    assert.equal(Rounds.enemyPool(def), enemyPoolOf(def), def.id);
    if (def.attributes === undefined && def.equipmentSp === undefined) assert.equal(Rounds.enemyPool(def), 3, `${def.id} has no stats`);
  }
  const run = createRunState({ seed: 3, classId: 'reaver', registries });
  const combat = createRunCombat({ registries, rng: createRng(3), run, enemyIds: ['wanderingSoldier'], settings: {} });
  const plan = [combat.enemies[0].intent.moveId, ...(combat.enemies[0].plannedMoves || []).map((m) => m.moveId)];
  const spent = plan.reduce((sum, id) => sum + Rounds.enemyMoveSp(registries.enemies.get('wanderingSoldier').moves[id]), 0);
  assert.ok(spent <= 3 && spent >= 2, `the soldier plans within its pool of 3: ${plan}`);
});

// Owner decisions of 2026-10-12, second pass: rank counts on the Mana side of a magic card too; restored Mana and
// Stamina offset the card's own cost; Ethereal is a drawback; status stacks count (no cap by default).
test('a magic card\'s rank weighs on its Mana side as well as its Stamina side; a physical card\'s only on Stamina', () => {
  const spell = { id: 's', type: 'attack', cost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 3 }], tags: ['camp:spell', 'school:fire'] };
  const blade = { id: 'b', type: 'attack', cost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 3 }], tags: ['camp:physical', 'blade'] };
  const { rankWeight, rankWeightMp } = COST_BUDGET;
  assert.equal(cardCostBudget(spell, { rank: 2 }).sMp - cardCostBudget(spell, { rank: 0 }).sMp, 2 * rankWeightMp);
  assert.equal(cardCostBudget(spell, { rank: 2 }).sSp - cardCostBudget(spell, { rank: 0 }).sSp, 2 * rankWeight);
  assert.equal(cardCostBudget(blade, { rank: 2 }).sMp, 0, 'a physical card has no Mana side to raise');
  for (let rank = 1; rank <= 5; rank++) assert.ok(cardCostBudget(spell, { rank }).mp >= cardCostBudget(spell, { rank: rank - 1 }).mp, `rank ${rank}`);
});

test('restored Mana offsets the card\'s own Mana cost, and restored Stamina its own Stamina cost', () => {
  for (const id of ['attune', 'emberCommunion']) {
    const card = registries.cards.get(id);
    const priced = cardCostBudget(card);
    const restored = card.effects.filter((e) => e.op === 'restoreMana').reduce((sum, e) => sum + e.amount, 0);
    assert.ok(restored > 0, `fixture: ${id} restores Mana`);
    assert.equal(priced.mp, Math.max(0, priced.rawMp - restored), `${id}: Mana price less the Mana it restores`);
    assert.ok((resolveCard(registries, { cardId: id }).manaCost || 0) - restored < 0, `${id} nets Mana`);
  }
  const surge = { id: 'surge', type: 'skill', cost: 1, effects: [{ op: 'gainEnergy', amount: 2 }, { op: 'damage', target: 'enemy', amount: 30 }], tags: ['camp:physical', 'maneuver:smash'] };
  const out = cardCostBudget(surge);
  assert.equal(out.sp, Math.max(1, out.rawSp - 2), 'its Stamina price less the 2 Stamina it restores (a priced card always costs something)');
});

test('a Herald with 0 Mana casts Ember Communion and Attune: a Mana-restoring card pays Stamina, never Mana it lacks', () => {
  for (const [classId, cardId] of [['herald', 'emberCommunion'], ['starseer', 'attune']]) {
    const run = createRunState({ seed: 3, classId, registries });
    const combat = createRunCombat({ registries, rng: createRng(3), run, enemyIds: ['wanderingSoldier'], settings: {} });
    combat.player.mana = 0;
    combat.piles.hand.push({ instanceId: `dry-${cardId}`, cardId, upgraded: false });
    assert.equal(resolveCard(registries, { cardId }).manaCost || 0, 0, `${cardId} costs no Mana`);
    dispatch(combat, { type: 'playCard', cardInstanceId: `dry-${cardId}` });
    assert.ok(combat.player.mana >= 1, `${cardId} restored Mana from 0`);
  }
});

test('Ethereal is a drawback: it never raises a cost', () => {
  assert.ok(COST_TAGS['lifecycle.ethereal'].weight < 0);
  for (const card of registries.cards.all()) {
    if (isCostOptOut(card) || Array.isArray(card.gradeProfiles)) continue;
    const keywords = (card.keywords || []).filter((k) => k !== 'ethereal');
    const plain = cardCostBudget({ ...card, keywords }), ethereal = cardCostBudget({ ...card, keywords: [...keywords, 'ethereal'] });
    assert.ok(ethereal.sSp <= plain.sSp && ethereal.sp + ethereal.mp <= plain.sp + plain.mp, card.id);
  }
});

test('status stacks count: with no cap (the default), every stack adds the status weight', () => {
  assert.equal(COST_CONFIG.statusStackCap, null);
  const bleed = (stacks) => cardCostBudget({ id: 'x', type: 'skill', cost: 1, effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks }], tags: ['camp:physical'] }).sSp;
  assert.equal(bleed(5) - bleed(1), 4 * COST_CONFIG.statusWeight);
  const capped = { ...COST_CONFIG, statusStackCap: 2 };
  assert.equal(cardCostBudget({ id: 'x', type: 'skill', cost: 1, effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 5 }], tags: ['camp:physical'] }, { config: capped }).sSp, bleed(2), 'a configured cap still applies');
  assert.throws(() => validateCostConfig({ ...COST_CONFIG, statusStackCap: 0 }), /stack cap/);
});
