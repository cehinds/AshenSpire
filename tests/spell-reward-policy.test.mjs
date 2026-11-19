import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { RewardSpellTradition, SpellRewardEligible, BalanceSpellRewardWeights } from '../src/model/spellPoolPolicy.js';
import { SpellPoolRole } from '../src/model/spellTraditions.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const build = () => createRunState({ seed: 421, classId: 'reaver', registries });
const card = (id, school, offense) => ({ id, type: 'skill', tags: ['camp:spell', 'school:' + school],
  effects: [{ op: offense ? 'damage' : 'heal', target: offense ? 'enemy' : 'self', amount: 5 }] });
const cards = [card('damage1', 'fire', true), card('damage2', 'earth', true),
  card('support1', 'frost', false), card('support2', 'lightning', false)];
const roleTotals = weights => weights.reduce((out, value, i) => ({ ...out, [SpellPoolRole(cards[i])]: out[SpellPoolRole(cards[i])] + value }), { offense: 0, support: 0 });

test('Wisdom-led rewards target three support shares to one damage share despite card counts and rarity bias', () => {
  const run = build(); run.attributes.wisdom = 12;
  assert.equal(RewardSpellTradition(registries, run), 'divine');
  const weights = BalanceSpellRewardWeights(registries, run, cards, [100, 1, 2, 4]);
  const totals = roleTotals(weights);
  assert.ok(Math.abs(totals.support / totals.offense - 3) < 1e-10);
  assert.equal(weights[0] / weights[1], 100, 'within-role ownership/rarity bias survives');
  assert.ok(Math.abs(weights.reduce((a,b) => a+b,0) - 107) < 1e-10);
});
test('Intelligence-led rewards target two offense shares to one support share', () => {
  const run = build(); run.attributes.intelligence = 12;
  const totals = roleTotals(BalanceSpellRewardWeights(registries, run, cards, [1, 2, 70, 4]));
  assert.ok(Math.abs(totals.offense / totals.support - 2) < 1e-10);
  assert.equal(SpellRewardEligible(registries, run, card('prayer', 'divine', false)), false);
  assert.equal(SpellRewardEligible(registries, run, cards[0]), true, 'shared elements remain in both pools');
});
test('missing roles, martial cards and old saved rules retain usable weights', () => {
  const run = build();
  const offense = cards.slice(0,2);
  assert.deepEqual(BalanceSpellRewardWeights(registries, run, offense, [1,3]), [1,3]);
  const martial = { id: 'martial', type: 'attack', tags: ['camp:physical'], effects: [{ op:'damage', amount:5 }] };
  assert.equal(BalanceSpellRewardWeights(registries, run, [martial, ...cards], [7,1,1,1,1])[0], 7);
  const previous = { ...run, gameProfile: { ...run.gameProfile, modules: { ...run.gameProfile.modules,
    effects: { ...run.gameProfile.modules.effects, spellTraditionsVersion: 0 } } } };
  assert.deepEqual(BalanceSpellRewardWeights(registries, previous, cards, [1,2,3,4]), [1,2,3,4]);
  assert.equal(SpellRewardEligible(registries, previous, card('prayer', 'divine', false)), true);
});


test('support-only and empty reward pools stay usable without inventing missing roles', () => {
  const run = build(); run.attributes.intelligence = 12;
  const support = cards.slice(2);
  assert.deepEqual(BalanceSpellRewardWeights(registries, run, support, [2, 7]), [2, 7]);
  assert.deepEqual(BalanceSpellRewardWeights(registries, run, [], []), []);
});

test('zero-weight roles remain excluded while positive rewards retain their weight', () => {
  const run = build(); run.attributes.wisdom = 12;
  assert.deepEqual(BalanceSpellRewardWeights(registries, run, cards, [0, 0, 2, 7]), [0, 0, 2, 7]);
  assert.deepEqual(BalanceSpellRewardWeights(registries, run, cards, [2, 7, 0, 0]), [2, 7, 0, 0]);
  assert.deepEqual(BalanceSpellRewardWeights(registries, run, cards, [0, 0, 0, 0]), [0, 0, 0, 0]);
});

test('a saved fight without its own tradition version keeps legacy rewards despite a current profile', () => {
  const run = build(); run.attributes.intelligence = 12;
  assert.equal(SpellRewardEligible(registries, run, card('prayer', 'divine', false)), false, 'current profile filters opposite tradition');
  const savedFight = { ...run, fixCoreRules: {} };
  assert.deepEqual(BalanceSpellRewardWeights(registries, savedFight, cards, [1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.equal(SpellRewardEligible(registries, savedFight, card('prayer', 'divine', false)), true, 'absent fight version owns compatibility');
  const previousProfile = { ...run, gameProfile: { ...run.gameProfile, modules: { ...run.gameProfile.modules,
    effects: {} } } };
  assert.deepEqual(BalanceSpellRewardWeights(registries, previousProfile, cards, [1, 2, 3, 4]), [1, 2, 3, 4]);
  assert.equal(SpellRewardEligible(registries, previousProfile, card('prayer', 'divine', false)), true, 'absent profile version keeps legacy eligibility');
});


test('existing Dev profiles with casting version one but no reward-policy marker retain their original rewards', () => {
  const current = build(); current.attributes.intelligence = 12;
  assert.equal(current.gameProfile.modules.effects.spellRewardPolicyVersion, 1, 'new Core profiles opt into the rebalance');
  const effects = { ...current.gameProfile.modules.effects, spellTraditionsVersion: 1 };
  delete effects.spellRewardPolicyVersion;
  const previousDev = { ...current, gameProfile: { ...current.gameProfile,
    modules: { ...current.gameProfile.modules, effects } } };
  const opposite = card('prayer', 'divine', false);
  assert.equal(SpellRewardEligible(registries, current, opposite), false);
  assert.equal(SpellRewardEligible(registries, previousDev, opposite), true);
  assert.deepEqual(BalanceSpellRewardWeights(registries, previousDev, cards, [1, 2, 3, 4]), [1, 2, 3, 4]);
  const disabled = { ...previousDev, gameProfile: { ...previousDev.gameProfile,
    modules: { ...previousDev.gameProfile.modules, effects: { ...effects, spellRewardPolicyVersion: 0 } } } };
  assert.equal(SpellRewardEligible(registries, disabled, opposite), true);
  assert.deepEqual(BalanceSpellRewardWeights(registries, disabled, cards, [1, 2, 3, 4]), [1, 2, 3, 4]);
});
