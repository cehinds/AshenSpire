import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState, projectZones } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardOffers, claimGameProfileReward, claimGameProfileRewardToDeck, rewardDeckAddRefusal, rewardInstanceId } from '../src/model/gameProfileRewards.js';

const p = resolveGameProfile('core'), reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, p)), p);
const fresh = () => {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
  const offer = gameProfileRewardOffers(reg, run, createRng(19), { offerId: 'level1', source: 'level' });
  return { run, offer };
};
const idOf = (offer) => rewardInstanceId(offer.id, 0);

test('add to deck claims the card and moves that instance into the deck', () => {
  const { run, offer } = fresh();
  const size = run.deck.length, side = run.sideboard.length;
  assert.equal(rewardDeckAddRefusal(reg, run, offer.id, 0), '');
  const option = claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  assert.equal(option.id, offer.options[0].id);
  assert.equal(run.deck.length, size + 1);
  assert.equal(run.deck.at(-1).instanceId, idOf(offer));
  assert.equal(run.sideboard.length, side);
  assert.equal(JSON.stringify(run.zones), JSON.stringify(projectZones(run).zones), 'zones follow the deck');
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, 0);
});

test('add to deck is idempotent on a double click', () => {
  const { run, offer } = fresh();
  claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  const after = JSON.stringify(run);
  claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  assert.equal(JSON.stringify(run), after);
});

test('add to deck refuses a full deck and leaves run and offer untouched', () => {
  const { run, offer } = fresh();
  const settings = { deckMaxUnlimited: false, deckMaxSize: run.deck.length };
  assert.equal(rewardDeckAddRefusal(reg, run, offer.id, 0, settings), 'full');
  const before = JSON.stringify(run);
  assert.throws(() => claimGameProfileRewardToDeck(reg, run, offer.id, 0, settings), error => error.code === 'full');
  assert.equal(JSON.stringify(run), before);
  assert.equal(run.gameProfileRewardOffers[offer.id].claimed, null);
});

test('add to deck works after an earlier claim to the sideboard (edit-deck path)', () => {
  const { run, offer } = fresh();
  claimGameProfileReward(reg, run, offer.id, 0);
  assert.ok(run.sideboard.some(c => c.instanceId === idOf(offer)));
  claimGameProfileRewardToDeck(reg, run, offer.id, 0);
  assert.ok(run.deck.some(c => c.instanceId === idOf(offer)));
  assert.ok(!run.sideboard.some(c => c.instanceId === idOf(offer)));
});

test('add to deck refuses non-card rewards', () => {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
  let found = null;
  for (let seed = 0; seed < 300 && !found; seed++) {
    const r = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    const o = gameProfileRewardOffers(reg, r, createRng(seed), { offerId: 'fight' });
    const at = o.options.findIndex(row => !['combatCards', 'weaponArts'].includes(row.kind));
    if (at >= 0) found = { r, o, at };
  }
  assert.ok(found);
  assert.equal(rewardDeckAddRefusal(reg, found.r, found.o.id, found.at), 'notCard');
  void run;
});
