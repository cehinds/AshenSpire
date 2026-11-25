// The rank-up bonus (owner, 2026-11-01): a Core rank-up also offers 2-3 rolled upgrade options at bigger amounts.
import { FillUpgradeSlots, RankUpRuleOff } from './helpers/rank-up-ready.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { awardSkillXp, xpToNext, raiseCardRank } from '../src/model/skills.js';
import { rankUpBonusOptions, rankUpBonusScale } from '../src/model/rankUpBonus.js';
import { nextUpgradeOptions, upgradeCost } from '../src/model/cardUpgradeLimits.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { upgradeStepsOf, upgradeCount, paidUpgradeCount, applyUpgradeSteps, upgradeStepsProblems, FlatSteps } from '../src/model/cardUpgrade.js';

// Owner 2026-11-23: rank-up needs a fully upgraded card (on by default), so these runs start with every slot used.
const newRun = (seed = 511) => {
  const run = createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  FillUpgradeSlots(run);
  return run;
};
const toLevel = (run, id, level) => awardSkillXp(registries, run, id, Array.from({ length: level }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0), { queueRewards: false, queueRankUps: true });
const strikeOf = (run) => run.deck.find((c) => c.cardId === 'core.strike');

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
  // Compare the same common status step at the tier where both rolls can
  // offer it. At starter tiers the new ladder has no scalable status option.
  const seeded = newRun(1);
  seeded.level.level = 8;
  const hammer = { instanceId: 'rap', cardId: 'core.hammerBlow', rank: 5 };
  const base = registries.cards.get(hammer.cardId);
  const plain = nextUpgradeOptions(seeded, { ...hammer, rank: 6 }, base, registries, 20,
    { everyFamily: true, noAuthored: true }).find(step => step.k === 'stk' && step.status === 'vulnerable' && !step.r);
  const bonus = rankUpBonusOptions(registries, seeded, hammer).find(({ step }) => step.k === 'stk' && step.status === 'vulnerable' && !step.r);
  assert.equal(plain?.n, 1);
  assert.equal(bonus?.step.n, plain.n * rankUpBonusScale(registries));
  for (const { step, after } of options) {
    assert.equal(step.bonus, true);
    assert.equal(after.rank, 1, 'the preview is the card at its new rank (an unranked card rises to Rank 1)');
    assert.deepEqual(upgradeStepsProblems({ upgraded: true, upgradeSteps: [step] }, 'x'), []);
  }
});

test('picking applies exactly that option, the rank and nothing else', () => {
  const run = RankUpRuleOff(newRun()); // the bonus alone, on a card with no other steps
  toLevel(run, 'item:blade', 3);
  const strike = strikeOf(run);
  const options = rankUpBonusOptions(registries, run, strike);
  const pick = options[options.length - 1].step;
  assert.equal(raiseCardRank(registries, run, 'item:blade', strike.instanceId, { k: 'dmg', n: 99, bonus: true }), null, 'an unoffered step lands nothing');
  assert.equal(run.skills['item:blade'].pendingRankUps, 2);
  assert.equal(strike.rank, undefined);
  const raised = raiseCardRank(registries, run, 'item:blade', strike.instanceId, pick);
  assert.equal(raised.rank, 1);
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

test('edge cases: a 0-cost card gets no cost cut, and a cut stops at 0 SP or 0 Mana on every card, a cantrip and a Basic included (owner 2026-11-22)', () => {
  const rng = () => upgradeStepRng(1, 'edge', 0);
  const kinds = (base, scale = 2) => FlatSteps(rollUpgradeOptions({ ...base, upgradeMenu: ['cost'] }, [], 0, rng(), { scale }, 20));
  const attack = { id: 'x', name: 'X', type: 'attack', rarity: 'uncommon', tags: [], effects: [{ op: 'damage', target: 'enemy', amount: 6 }] };
  assert.deepEqual(kinds({ ...attack, staminaCost: 0, cost: 0, manaCost: 0 }), [], '0-cost card: no cost option');
  const one = kinds({ ...attack, staminaCost: 1, cost: 1, manaCost: 0 });
  assert.ok(one.length === 1 && one[0].pool === 'sp' && one[0].n === undefined, '1 SP card: SP can drop to 0');
  const two = kinds({ ...attack, staminaCost: 3, cost: 3, manaCost: 0 });
  assert.ok(two.length === 1 && two[0].n === undefined && two[0].pool === 'sp', 'an Efficient step cuts one at any scale');
  const cut = applyUpgradeSteps({ ...attack, staminaCost: 3, cost: 3, manaCost: 0 }, two);
  assert.equal(cut.staminaCost, 2);
  assert.equal(applyUpgradeSteps({ ...attack, staminaCost: 2, cost: 2, manaCost: 0 }, kinds({ ...attack, staminaCost: 2, cost: 2, manaCost: 0 }, 1)).staminaCost, 1);
  assert.ok(kinds({ ...attack, tags: ['rank.cantrip'], staminaCost: 1, cost: 1, manaCost: 1 }).some((s) => s.pool === 'mp'), 'a cantrip with Mana can lose it (owner 2026-11-22)');
  const manaCard = { ...attack, rarity: 'common', staminaCost: 1, cost: 1, manaCost: 2 };
  const mana = kinds(manaCard).filter(step => step.pool === 'mp');
  assert.equal(mana.length, 1, 'the Basic can get a Mana cut');
  assert.equal(mana[0].n, undefined, 'this rarity cuts exactly one Mana');
  assert.equal(applyUpgradeSteps(manaCard, mana).manaCost, 1);
  // The new one-point roll still reads an already-saved two-point cost step.
  assert.ok(kinds({ ...attack, staminaCost: 3, cost: 3, manaCost: 0 }, 1).every((s) => s.n === undefined));
  assert.equal(applyUpgradeSteps({ ...attack, staminaCost: 3, cost: 3 }, [{ k: 'cost', pool: 'sp', n: 2 }]).staminaCost, 1);
});

test('a Legacy run, or a card with no option, offers no bonus and raises as before', () => {
  const run = newRun();
  assert.deepEqual(rankUpBonusOptions(registries, { ...run, gameProfile: null }, strikeOf(run)), []);
  assert.deepEqual(rankUpBonusOptions(registries, run, { instanceId: 'x', cardId: 'nope' }), []);
});
