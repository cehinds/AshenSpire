import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock, claimGameProfileReward } from '../src/model/gameProfileRewards.js';
import { moveFromSideboard, moveToSideboard, commitDeckEditDraft } from '../src/model/deckRules.js';
import { deckEditorModel } from '../src/ui/models/DeckEditorModel.js';
import { createRng } from '../src/engine/rng.js';
import { gameDigest } from '../engine/kernel/gameConfig.js';

const profile = structuredClone(resolveGameProfile('core'));
const template = profile.content.cards.find(card => card.id === 'core.defend');
const movement = { ...template, id: 'fixture.advance', name: 'Advance fixture', rarity: 'common', rank: 1,
  tags: [], effects: [{ op: 'moveEngagement', target: 'enemy', bands: -1 }] };
const mixed = { ...movement, id: 'fixture.closingDodge', name: 'Closing Dodge fixture', effects: [
  { op: 'applyStatus', target: 'self', status: 'evade', stacks: 1 }, ...movement.effects] };
profile.content.cards.push(movement, mixed);
profile.modules.rewards.offerCount = 1000;
profile.modules.shops.itemsPerCategory = 1000;
delete profile.hash;
profile.hash = gameDigest(profile);
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fresh = enabled => {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
  run.rangePolicy = { version: 1, enabled, advanceSpPerBand: 1, reachPrecisionBonus: 1, throwPrecisionPenalty: 1 };
  return run;
};

test('range-off combat, level and shop pools omit pure movement but retain defensive movement', () => {
  for (const enabled of [false, true]) {
    const run = fresh(enabled), rng = createRng(19);
    const offers = [gameProfileRewardOffers(reg, run, rng, { offerId: 'fight' }),
      gameProfileRewardOffers(reg, run, rng, { offerId: 'level', source: 'level' }),
      gameProfileShopStock(reg, run, rng, { shopId: 'shop' })];
    for (const offer of offers) {
      const cards = offer.options.filter(row => row.kind === 'combatCards').map(row => row.id);
      assert.equal(cards.includes(movement.id), enabled, offer.source);
      assert.ok(cards.includes(mixed.id), `${offer.source} keeps the useful defense`);
    }
  }
});

test('range-off refuses stale movement claims and sideboard additions without changing ownership', () => {
  const run = fresh(false);
  run.gameProfileRewardOffers = { stale: { id: 'stale', source: 'combat', options: [{ kind: 'combatCards', id: movement.id }], takeCount: 1, taken: [], claimed: null } };
  const beforeClaim = structuredClone(run);
  assert.throws(() => claimGameProfileReward(reg, run, 'stale', 0), /unavailable/);
  assert.deepEqual(run, beforeClaim);
  const advance = { cardId: movement.id, instanceId: 'owned-advance', upgraded: false };
  const dodge = { cardId: mixed.id, instanceId: 'owned-dodge', upgraded: false };
  run.sideboard.push(advance, dodge);
  const before = structuredClone(run);
  assert.equal(moveFromSideboard(reg, run, advance.instanceId), false);
  assert.deepEqual(run, before);
  const tile = deckEditorModel({ registries: reg, run }).collection.find(row => row.cardId === movement.id);
  assert.equal(tile.addable, false);
  assert.match(tile.refusal, /Range mechanics are disabled/);
  const forged = structuredClone(run);
  forged.deck.push(forged.sideboard.shift());
  assert.throws(() => commitDeckEditDraft(reg, run, forged, { deckMinUnlimited: true, deckMaxUnlimited: true }), /Range mechanics/);
  assert.deepEqual(run, before);
  assert.equal(moveFromSideboard(reg, run, dodge.instanceId), true);
  run.rangePolicy.enabled = true;
  assert.equal(moveFromSideboard(reg, run, advance.instanceId), true);
  run.rangePolicy.enabled = false;
  assert.equal(moveToSideboard(reg, run, advance.instanceId), true, 'old owned movement remains removable');
});
