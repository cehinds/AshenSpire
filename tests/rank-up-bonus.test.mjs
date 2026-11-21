// The rank-up bonus (owner, 2026-11-01): a Core rank-up also offers 2-3 rolled upgrade options at bigger amounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { awardSkillXp, xpToNext, raiseCardRank } from '../src/model/skills.js';
import { rankUpBonusOptions, rankUpBonusScale } from '../src/model/rankUpBonus.js';
import { nextUpgradeOptions, upgradeCost } from '../src/model/cardUpgradeLimits.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { upgradeStepsOf, upgradeCount, paidUpgradeCount, applyUpgradeSteps, upgradeStepsProblems } from '../src/model/cardUpgrade.js';

const newRun = (seed = 511) => createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const toLevel = (run, id, level) => awardSkillXp(registries, run, id, Array.from({ length: level }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0), { queueRewards: false, queueRankUps: true });
const strikeOf = (run) => run.deck.find((c) => c.cardId === 'core.strike');
const amount = (step) => step.n;

test('the scale is data: balance.skill.rankUpBonusScale', () => {
  assert.equal(rankUpBonusScale(registries), registries.balance.skill.rankUpBonusScale);
  assert.ok(rankUpBonusScale(registries) > 1);
});

test('a rank-up offers 2 to 3 distinct options from the blacksmith pool, with bigger amounts', () => {
  const run = newRun();
  const strike = strikeOf(run);
  const options = rankUpBonusOptions(registries, run, strike);
  assert.ok(options.length >= 2 && options.length <= 3, `got ${options.length}`);
  assert.equal(new Set(options.map((o) => JSON.stringify(o.step))).size, options.length);
  // The 2026-11-14 menu no longer guarantees a damage step (the first upgrades offer one option, the pool is wider), so the
  // "bigger amounts" rule is read on whichever number step both rolls offer, over several seeds.
  const base = registries.cards.get(strike.cardId);
  let compared = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const seeded = newRun(seed), card = strikeOf(seeded);
    const bonusSteps = rankUpBonusOptions(registries, seeded, card).map((o) => o.step);
    for (const plainStep of nextUpgradeOptions(seeded, card, base, registries, 3)) {
      const bonusStep = bonusSteps.find((s) => s.k === plainStep.k && s.fx === plainStep.fx && s.r === plainStep.r && Number.isFinite(s.n) && Number.isFinite(plainStep.n));
      if (!bonusStep) continue;
      // A step already at its ceiling (Block cannot exceed the card's base) cannot grow: never smaller, and the scaled amount where it can.
      assert.ok(amount(bonusStep) >= amount(plainStep), 'a rank-up number step is never smaller than a blacksmith one');
      // Rarity multiplies the size first (x2 / x4), the +100% guard clips it, so the bonus is the plain step scaled, or what the guard leaves.
      if (amount(bonusStep) > amount(plainStep)) { compared++; assert.ok(amount(bonusStep) <= plainStep.n * rankUpBonusScale(registries)); }
    }
  }
  assert.ok(compared > 0, 'some seed offers a number step that the rank-up makes bigger');
  for (const { step, after } of options) {
    assert.equal(step.bonus, true);
    assert.equal(after.rank, 2, 'the preview is the card at its new rank');
    assert.deepEqual(upgradeStepsProblems({ upgraded: true, upgradeSteps: [step] }, 'x'), []);
  }
});

test('picking applies exactly that option, the rank and nothing else', () => {
  const run = newRun();
  toLevel(run, 'item:blade', 3);
  const strike = strikeOf(run);
  const options = rankUpBonusOptions(registries, run, strike);
  const pick = options[options.length - 1].step;
  assert.equal(raiseCardRank(registries, run, 'item:blade', strike.instanceId, { k: 'dmg', n: 99, bonus: true }), null, 'an unoffered step lands nothing');
  assert.equal(run.skills['item:blade'].pendingRankUps, 2);
  assert.equal(strike.rank, undefined);
  const raised = raiseCardRank(registries, run, 'item:blade', strike.instanceId, pick);
  assert.equal(raised.rank, 2);
  assert.deepEqual(upgradeStepsOf(raised), [pick]);
  assert.equal(raised.upgraded, true);
  assert.equal(run.skills['item:blade'].pendingRankUps, 1);
  // The bonus is a gift: it does not use the free upgrade the new rank earns.
  assert.equal(upgradeCount(raised), 1);
  assert.equal(paidUpgradeCount(raised), 0);
  assert.equal(upgradeCost(run, raised, registries.cards.get('core.strike'), registries), 0);
  // The face shows it.
  assert.notDeepEqual(applyUpgradeSteps(registries.cards.get('core.strike'), upgradeStepsOf(raised)), registries.cards.get('core.strike'));
});

test('the options are deterministic for a seed and survive a save and load mid-choice', () => {
  const a = newRun(77); const b = newRun(77);
  const steps = (run) => JSON.stringify(rankUpBonusOptions(registries, run, strikeOf(run)).map((o) => o.step));
  assert.equal(steps(a), steps(b));
  const reloaded = JSON.parse(JSON.stringify(a));
  assert.equal(steps(reloaded), steps(a));
  // The salt gives the bonus its own stream: the blacksmith's roll is the same on either run.
  const strike = strikeOf(a);
  const base = registries.cards.get('core.strike');
  assert.equal(JSON.stringify(nextUpgradeOptions(a, strike, base, registries, 3)), JSON.stringify(nextUpgradeOptions(reloaded, strikeOf(reloaded), base, registries, 3)));
});

test('edge cases: a 0-cost or 1-cost card gets no cost cut, a cantrip no Mana cut, and a cut never passes the floor', () => {
  const rng = () => upgradeStepRng(1, 'edge', 0);
  const kinds = (base, scale = 2) => rollUpgradeOptions(base, [], 0, rng(), { scale, minStaminaCost: 1, minActionCost: 1 }, 20).filter((s) => s.k === 'cost');
  const attack = { id: 'x', name: 'X', type: 'attack', rarity: 'uncommon', tags: [], effects: [{ op: 'damage', target: 'enemy', amount: 6 }] };
  assert.deepEqual(kinds({ ...attack, staminaCost: 0, cost: 0, manaCost: 0 }), [], '0-cost card: no cost option');
  assert.deepEqual(kinds({ ...attack, staminaCost: 1, cost: 1, manaCost: 0 }), [], '1 SP card: SP stays at least 1');
  const two = kinds({ ...attack, staminaCost: 3, cost: 3, manaCost: 0 });
  assert.ok(two.length === 1 && two[0].n === 2 && two[0].pool === 'sp', 'a 3 SP card can lose 2');
  const cut = applyUpgradeSteps({ ...attack, staminaCost: 3, cost: 3, manaCost: 0 }, two);
  assert.equal(cut.staminaCost, 1);
  assert.deepEqual(kinds({ ...attack, tags: ['rank.cantrip'], staminaCost: 1, cost: 1, manaCost: 3 }), [], 'a cantrip has no Mana to cut');
  const mana = kinds({ ...attack, staminaCost: 1, cost: 1, manaCost: 2 });
  assert.ok(mana.every((s) => s.pool === 'mp' && s.n === undefined), 'Mana 2 loses 1 only (never below 1)');
  // The plain (scale 1) roll is exactly the old one.
  assert.ok(kinds({ ...attack, staminaCost: 3, cost: 3, manaCost: 0 }, 1).every((s) => s.n === undefined));
});

test('a Legacy run, or a card with no option, offers no bonus and raises as before', () => {
  const run = newRun();
  assert.deepEqual(rankUpBonusOptions(registries, { ...run, gameProfile: null }, strikeOf(run)), []);
  assert.deepEqual(rankUpBonusOptions(registries, run, { instanceId: 'x', cardId: 'nope' }), []);
});
