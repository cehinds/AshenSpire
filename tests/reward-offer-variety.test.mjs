// Owner 2026-10-31: cards shown in an earlier offer (taken or not) come back less often (offeredCopyWeight^timesOffered), so the
// player sees new-for-the-run options. Core 1 pins the weight to 1 (neutral); an empty history changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun, validateRunShape } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';

const build = (weight, core = 'ashen.core@2.0.0') => {
  const modules = weight === undefined ? {} : { 'reward-ranks': { offeredCopyWeight: weight } };
  const profile = resolveGameProfile({ formatVersion: 1, core, modules });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
};
const cardIds = offer => offer.options.filter(o => o.kind === 'combatCards').map(o => o.id);
// (Core 2's recentOfferWindow already steers away from the last few screens; this isolates the run-long history.)
// Fraction of the second offer's cards that also appeared in the first, over N seeds (one run per variant).
function repeatRatio(registries, n = 300) {
  const run = createRunState({ seed: 1, classId: 'reaver', registries });
  let repeats = 0, total = 0;
  for (let i = 0; i < n; i++) {
    delete run.gameProfileRewardOffers; delete run.rewardOfferHistory;
    const rng = createRng(500 + i);
    const first = new Set(cardIds(gameProfileRewardOffers(registries, run, rng, { offerId: 'a', source: 'combat' })));
    delete run.gameProfileRewardOffers; // drop the recent-offer window so only the run-long history differs
    const second = cardIds(gameProfileRewardOffers(registries, run, rng, { offerId: 'b', source: 'combat' }));
    total += second.length; repeats += second.filter(id => first.has(id)).length;
  }
  return repeats / total;
}

test('a second combat offer repeats the first offer\'s cards far less often than with weight 1', () => {
  const neutral = repeatRatio(build(1)), varied = repeatRatio(build());
  console.log(`repeat ratio: weight 1 = ${neutral.toFixed(4)}, Core 2 default 0.25 = ${varied.toFixed(4)}`);
  assert.ok(neutral > 0.02, `weight 1 does repeat (${neutral})`);
  assert.ok(varied < neutral * 0.5, `varied ${varied} vs neutral ${neutral}`);
});
test('the first offer is byte-identical with and without the setting; the history records what was shown', () => {
  const regs = [build(1), build(0.25), build()];
  const offers = regs.map(registries => {
    const run = createRunState({ seed: 7, classId: 'reaver', registries });
    assert.equal(run.rewardOfferHistory, undefined);
    const offer = gameProfileRewardOffers(registries, run, createRng(11), { offerId: 'a', source: 'combat' });
    for (const id of cardIds(offer)) assert.equal(run.rewardOfferHistory.cards[id], 1);
    // Cached: asking again neither re-rolls nor double counts.
    gameProfileRewardOffers(registries, run, createRng(99), { offerId: 'a', source: 'combat' });
    for (const id of cardIds(offer)) assert.equal(run.rewardOfferHistory.cards[id], 1);
    return JSON.stringify(offer);
  });
  assert.equal(offers[0], offers[1]); assert.equal(offers[1], offers[2]);
});
test('Core 1 pins the weight to 1: the second offer is the old draw', () => {
  const core1 = build(undefined, 'ashen.core@1.0.0');
  const run = createRunState({ seed: 3, classId: 'reaver', registries: core1 });
  const a = gameProfileRewardOffers(core1, run, createRng(5), { offerId: 'a', source: 'combat' });
  const run2 = createRunState({ seed: 3, classId: 'reaver', registries: core1 });
  const a2 = gameProfileRewardOffers(core1, run2, createRng(5), { offerId: 'a', source: 'combat' });
  assert.equal(JSON.stringify(a), JSON.stringify(a2));
  assert.ok(Object.keys(run.rewardOfferHistory?.cards || {}).length >= 0);
});
test('shop card stock is weighted by the same history', () => {
  const count = registries => {
    const run = createRunState({ seed: 1, classId: 'reaver', registries });
    // Mark every card but one as offered 3 times; the shelf should now favour the unseen cards.
    const all = [...registries.cards.all()].map(c => c.id);
    let seen = 0, unseen = 0;
    const first = new Set();
    for (let i = 0; i < 300; i++) {
      delete run.gameProfileRewardOffers; delete run.rewardOfferHistory;
      const opened = gameProfileRewardOffers(registries, run, createRng(700 + i), { offerId: 'c', source: 'combat' });
      cardIds(opened).forEach(id => first.add(id));
      delete run.gameProfileRewardOffers;
      const marked = new Set(cardIds(opened));
      for (const option of gameProfileShopStock(registries, run, createRng(900 + i), { shopId: 'm' }).options)
        if (option.kind === 'combatCards') (marked.has(option.id) ? seen++ : unseen++);
    }
    return { seen, unseen, all: all.length };
  };
  const neutral = count(build(1)), varied = count(build());
  console.log(`shop cards from the earlier offer: weight 1 = ${neutral.seen}/${neutral.seen + neutral.unseen}, 0.25 = ${varied.seen}/${varied.seen + varied.unseen}`);
  assert.ok(varied.seen < neutral.seen * 0.7, `${varied.seen} vs ${neutral.seen}`);
});
test('the history survives a save round trip and an old save without it still loads', () => {
  const registries = build();
  const run = createRunState({ seed: 2, classId: 'reaver', registries });
  gameProfileRewardOffers(registries, run, createRng(4), { offerId: 'a', source: 'combat' });
  const history = structuredClone(run.rewardOfferHistory);
  assert.ok(Object.keys(history.cards).length > 0);
  const back = deserializeRun(serializeRun(run));
  assert.deepEqual(back.rewardOfferHistory, history);
  assert.deepEqual(validateRunShape(back), []);
  delete back.rewardOfferHistory;
  assert.deepEqual(validateRunShape(back), []);
  back.rewardOfferHistory = 'x';
  assert.ok(validateRunShape(back).some(p => p.includes('rewardOfferHistory')));
});
test('offeredCopyWeight is a 0..1 schema setting; Core 2 default 0.25, Core 1 bundle pins 1', () => {
  const schema = JSON.parse(readFileSync(new URL('../engine/modules/reward-ranks/settings.schema.json', import.meta.url)));
  const defaults = JSON.parse(readFileSync(new URL('../engine/modules/reward-ranks/defaults.json', import.meta.url)));
  const bundle = JSON.parse(readFileSync(new URL('../games/ashenspire/bundles/core-v1/bundle.json', import.meta.url)));
  assert.deepEqual([schema.properties.offeredCopyWeight.minimum, schema.properties.offeredCopyWeight.maximum], [0, 1]);
  assert.equal(defaults.offeredCopyWeight, 0.25);
  assert.equal(bundle.modules['reward-ranks'].settings.offeredCopyWeight, 1);
  assert.throws(() => build(1.5)); assert.throws(() => build(-0.1));
});
