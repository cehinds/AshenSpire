import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { rewardSpellTradition, spellRewardEligible, balanceSpellRewardWeights } from '../src/model/spellPoolPolicy.js';
import { spellPoolRole } from '../src/model/spellTraditions.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const build = () => createRunState({ seed: 421, classId: 'reaver', registries });
const card = (id, school, offense) => ({ id, type: 'skill', tags: ['camp:spell', 'school:' + school],
  effects: [{ op: offense ? 'damage' : 'heal', target: offense ? 'enemy' : 'self', amount: 5 }] });
const cards = [card('damage1', 'fire', true), card('damage2', 'earth', true),
  card('support1', 'frost', false), card('support2', 'lightning', false)];
const roleTotals = weights => weights.reduce((out, value, i) => ({ ...out, [spellPoolRole(cards[i])]: out[spellPoolRole(cards[i])] + value }), { offense: 0, support: 0 });

test('Wisdom-led rewards target three support shares to one damage share despite card counts and rarity bias', () => {
  const run = build(); run.attributes.wisdom = 12;
  assert.equal(rewardSpellTradition(registries, run), 'divine');
  const weights = balanceSpellRewardWeights(registries, run, cards, [100, 1, 2, 4]);
  const totals = roleTotals(weights);
  assert.ok(Math.abs(totals.support / totals.offense - 3) < 1e-10);
  assert.equal(weights[0] / weights[1], 100, 'within-role ownership/rarity bias survives');
  assert.ok(Math.abs(weights.reduce((a,b) => a+b,0) - 107) < 1e-10);
});
test('Intelligence-led rewards target two offense shares to one support share', () => {
  const run = build(); run.attributes.intelligence = 12;
  const totals = roleTotals(balanceSpellRewardWeights(registries, run, cards, [1, 2, 70, 4]));
  assert.ok(Math.abs(totals.offense / totals.support - 2) < 1e-10);
  assert.equal(spellRewardEligible(registries, run, card('prayer', 'divine', false)), false);
  assert.equal(spellRewardEligible(registries, run, cards[0]), true, 'shared elements remain in both pools');
});
test('missing roles, martial cards and old saved rules retain usable weights', () => {
  const run = build();
  const offense = cards.slice(0,2);
  assert.deepEqual(balanceSpellRewardWeights(registries, run, offense, [1,3]), [1,3]);
  const martial = { id: 'martial', type: 'attack', tags: ['camp:physical'], effects: [{ op:'damage', amount:5 }] };
  assert.equal(balanceSpellRewardWeights(registries, run, [martial, ...cards], [7,1,1,1,1])[0], 7);
  const previous = { ...run, gameProfile: { ...run.gameProfile, modules: { ...run.gameProfile.modules,
    effects: { ...run.gameProfile.modules.effects, spellTraditionsVersion: 0 } } } };
  assert.deepEqual(balanceSpellRewardWeights(registries, previous, cards, [1,2,3,4]), [1,2,3,4]);
  assert.equal(spellRewardEligible(registries, previous, card('prayer', 'divine', false)), true);
});
