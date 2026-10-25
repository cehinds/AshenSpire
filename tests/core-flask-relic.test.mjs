import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { flaskKindOf } from '../src/model/gracerefill.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { rewards: { offerCount: 1000 } } });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = () => createRunState({ seed: 3, classId: 'reaver', registries });

test('Core rewards no longer offer the Crimson and Azure charge flasks', () => {
  const run = fresh(), offer = gameProfileRewardOffers(registries, run, createRng(7), { offerId: 'flasks' });
  const potions = offer.options.filter(option => option.kind === 'potions').map(option => option.id);
  assert.ok(potions.length > 0, 'utility flasks are still offered');
  for (const id of potions) assert.equal(flaskKindOf(registries.flasks.get(id)), 'utility', id);
  assert.ok(offer.options.some(option => option.kind === 'relics' && option.id === 'brimmingGourd'));
});
test('claiming the flask relic raises capacity by 1 and refills the flasks at once', () => {
  const run = fresh(), before = run.flaskCharges.capacity;
  run.flaskCharges.hpCurrent = 0; run.flaskCharges.manaCurrent = 0;
  const offer = gameProfileRewardOffers(registries, run, createRng(7), { offerId: 'gourd' });
  claimGameProfileReward(registries, run, 'gourd', offer.options.findIndex(option => option.id === 'brimmingGourd'));
  assert.ok(run.relics.includes('brimmingGourd'));
  assert.equal(run.flaskCharges.capacity, before + 1);
  assert.equal(run.flaskCharges.hpCurrent, run.flaskCharges.hp);
  assert.equal(run.flaskCharges.manaCurrent, run.flaskCharges.mana);
  assert.equal(registries.relics.all().some(row => row.id === 'brimmingGourd' && run.relics.filter(id => id === row.id).length > 1), false);
});
