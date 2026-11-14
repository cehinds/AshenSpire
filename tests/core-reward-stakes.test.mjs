// Wave 1 "run stakes": every won fight offers a card choice, an elite adds a relic choice, and a class is never offered a card it cannot pay for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, GameProfileEliteRelicOffer, claimGameProfileReward, gameProfileShopStock } from '../src/model/gameProfileRewards.js';

const build = () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
};
const reg = build();
// A run pins its profile; a legacy run is the shipped one with the rewards block overridden by the old values.
const legacyRun = (seed, patch) => {
  const run = fresh(seed), rewards = structuredClone(run.gameProfile.content.rewards);
  patch(rewards);
  run.gameProfile = { ...run.gameProfile, content: { ...run.gameProfile.content, rewards }, modules: { ...run.gameProfile.modules, rewards: { ...run.gameProfile.modules.rewards, rewardGroups: rewards.rewardGroups } } };
  return run;
};
const fresh = (seed, classId = 'reaver', registries = reg) => createRunState({ seed, classId, registries, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const allow = fresh(1).gameProfile.content.rewards.eligibility.relics.allow;
const manaOf = (run, id) => (run.gameProfile.content.cards.find(card => card.id === id)?.manaCost || 0);

test('a Reaver combat offer is 3-5 cards or weapon arts over 300 seeds', () => {
  for (let i = 0; i < 300; i++) {
    const options = gameProfileRewardOffers(reg, fresh(i + 1), createRng(500 + i), { offerId: 'f' }).options;
    assert.ok(options.length >= 3 && options.length <= 5, `seed ${i}: ${options.length} options`);
    for (const option of options) assert.ok(['combatCards', 'weaponArts'].includes(option.kind), `seed ${i}: ${option.kind}`);
  }
});

test('no offered card costs mana the class cannot pay; a Starseer still sees mana cards', () => {
  let starseerMana = 0;
  for (let i = 0; i < 300; i++) for (const [classId, source] of [['reaver', 'combat'], ['reaver', 'level'], ['reaver', 'treasure'], ['starseer', 'combat'], ['starseer', 'level'], ['starseer', 'treasure']]) {
    const run = fresh(i + 1, classId);
    for (const option of gameProfileRewardOffers(reg, run, createRng(900 + i), { offerId: `o:${source}`, source }).options) {
      if (!['combatCards', 'weaponArts'].includes(option.kind)) continue;
      const cost = manaOf(run, option.id);
      if (classId === 'reaver') assert.equal(cost, 0, `reaver ${source} ${option.id}`);
      else { assert.ok(cost <= run.maxMana, `starseer ${source} ${option.id} costs ${cost} > ${run.maxMana}`); if (cost > 0) starseerMana++; }
    }
  }
  assert.ok(starseerMana > 0, 'a Starseer is still offered mana cards');
});

test('an elite pending reward yields a two-relic choice that claims into run.relics', () => {
  const run = fresh(3), id = '1:n:combat:elite';
  const offer = GameProfileEliteRelicOffer(reg, run, createRng(1), { offerId: id });
  assert.equal(offer.source, 'elite'); assert.equal(offer.options.length, 2);
  assert.equal(new Set(offer.options.map(o => o.id)).size, 2);
  for (const o of offer.options) { assert.equal(o.kind, 'relics'); assert.ok(allow.includes(o.id), o.id); assert.ok(!run.relics.includes(o.id)); }
  assert.equal(GameProfileEliteRelicOffer(reg, run, createRng(99), { offerId: id }), offer, 'cached');
  const taken = offer.options[0].id;
  claimGameProfileReward(reg, run, id, 0);
  assert.ok(run.relics.includes(taken)); assert.notEqual(run.gameProfileRewardOffers[id].claimed, null);
  assert.deepEqual(offer.options.map(o => o.id).sort(), run.gameProfileRewardOffers[id].options.map(o => o.id).sort());
});

test('an elite relic offer is skipped when every eligible relic is owned', () => {
  const run = fresh(4);
  for (const id of allow) run.relics.push(id);
  assert.equal(GameProfileEliteRelicOffer(reg, run, createRng(1), { offerId: 'x:elite' }), null);
  assert.equal(run.gameProfileRewardOffers?.['x:elite'], undefined);
});

test('the shipped elite relic pool for a new Reaver (list)', () => {
  const ids = new Set();
  for (let i = 0; i < 400; i++) for (const o of GameProfileEliteRelicOffer(reg, fresh(i + 1), createRng(i), { offerId: 'e' }).options) ids.add(o.id);
  console.log('elite relic pool:', [...ids].sort().join(','));
  assert.ok(ids.size >= 2);
});

test('a legacy rewards fixture (old weights, no eliteRelic, no playableOnly) keeps the old mix and makes no elite offer', () => {
  const legacy = rules => {
    delete rules.eliteRelic;
    delete rules.eligibility.playableOnly;
    const weights = { cards: 66, weaponArts: 4, potions: 18, flaskRelic: 2, weapons: 10, retired: 0 };
    for (const group of rules.rewardGroups) group.weight = weights[group.id];
  };
  const kinds = new Set(); let manaForReaver = 0;
  for (let i = 0; i < 300; i++) {
    const run = legacyRun(i + 1, legacy);
    assert.equal(GameProfileEliteRelicOffer(reg, run, createRng(1), { offerId: 'e' }), null);
    for (const o of gameProfileRewardOffers(reg, run, createRng(i), { offerId: 'f' }).options) { kinds.add(o.kind); if (['combatCards'].includes(o.kind) && manaOf(run, o.id) > 0) manaForReaver++; }
  }
  assert.ok(kinds.has('potions') && kinds.has('weapons'), [...kinds].join());
  assert.ok(manaForReaver > 0, 'legacy still offers mana cards to a Reaver');
});

test('every allowed relic id exists in the relic registry (no build-time check exists for relic ids)', () => {
  assert.equal(allow.length, 28);
  for (const id of allow) assert.ok(reg.relics.all().some(row => row.id === id), id);
});

test('new treasure, shop and elite offers only hold allowed relics; a saved offer outside the list stays claimable', () => {
  const outside = reg.relics.all().find(row => !allow.includes(row.id) && row.pool !== 'core2' && !fresh(7).relics.includes(row.id)).id;
  let relicsSeen = 0;
  for (let i = 0; i < 300; i++) {
    const run = fresh(i + 1);
    run.cinders = 9999;
    const offers = [gameProfileRewardOffers(reg, run, createRng(i), { offerId: 't', source: 'treasure' }), GameProfileEliteRelicOffer(reg, run, createRng(i), { offerId: 'e' })];
    for (const offer of offers) for (const o of offer.options) if (o.kind === 'relics') { relicsSeen++; assert.ok(allow.includes(o.id), `${offer.source}: ${o.id}`); }
    const stock = gameProfileShopStock(reg, run, createRng(i), { shopId: 's' });
    for (const offer of [run.gameProfileRewardOffers['shop:s']].filter(Boolean)) for (const o of offer.options) if (o.kind === 'relics') { relicsSeen++; assert.ok(allow.includes(o.id), `shop: ${o.id}`); }
    void stock;
  }
  assert.ok(relicsSeen > 0);
  const run = fresh(7);
  run.gameProfileRewardOffers = { old: { id: 'old', source: 'treasure', options: [{ kind: 'relics', id: outside }], takeCount: 1, taken: [], claimed: null } };
  claimGameProfileReward(reg, run, 'old', 0);
  assert.ok(run.relics.includes(outside));
});
