// Owner 2026-10-19: Core card offers reserve a slot for a basic/cantrip card of a stance the character lacks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { gameProfileRewardOffers, gameProfileShopStock } from '../src/model/gameProfileRewards.js';
import { missingBasicStances } from '../src/model/stanceCoverage.js';
import { stanceOf } from '../src/model/stanceRules.js';
const bind = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const core = resolveGameProfile('core'), reg = bind(core);
const off = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { 'reward-ranks': { stanceCoverage: { enabled: false } } } }), regOff = bind(off);
const templates = new Map();
// The Core Reaver now opens on strike/defend/counter + its smash art and lacks sweep, casting and evade. These tests
// model the older premise (only evade missing), so `fresh` first adds the Sweep and Draw cards the old shared deck held.
const bare = (r = reg) => createRunState({ seed: 1, classId: 'reaver', registries: r });
const fresh = (r = reg) => {
  if (!templates.has(r)) { const run = bare(r); for (const cardId of ['core.sweep', 'base.draw']) run.deck.push({ instanceId: `t:${cardId}`, cardId, upgraded: false }); templates.set(r, run); }
  return structuredClone(templates.get(r));
};
const own = (run, cardId) => run.sideboard.push({ instanceId: `t:${cardId}`, cardId, upgraded: false });
const offer = (r, run, seed, source = 'combat') => gameProfileRewardOffers(r, run, createRng(seed), { offerId: `o${seed}`, source });
const stanceOfId = id => stanceOf(reg.cards.get(id))?.maneuver ?? null;
const SEEDS = Array.from({ length: 12 }, (_, i) => i);

test('the Core Reaver opening deck lacks the sweep, casting and evade stances', () => {
  assert.deepEqual(missingBasicStances(bare(), reg), ['sweep', 'casting', 'evade']);
});
test('missingBasicStances lists only stances with no owned card', () => {
  const run = fresh();
  assert.deepEqual(missingBasicStances(run, reg), ['evade']);
  const before = JSON.stringify(run);
  missingBasicStances(run, reg);
  assert.equal(JSON.stringify(run), before, 'pure');
  own(run, 'core.evade');
  assert.deepEqual(missingBasicStances(run, reg), []);
  run.deck = run.deck.filter(card => card.cardId !== 'core.sweep');
  assert.deepEqual(missingBasicStances(run, reg), ['sweep']);
});
test('the Reaver starting deck: every combat and level offer holds the missing-stance basic', () => {
  for (const seed of SEEDS) for (const source of ['combat', 'level']) {
    const o = offer(reg, fresh(), seed, source), ids = o.options.map(row => row.id);
    assert.equal(o.options.length, 3);
    assert.equal(new Set(ids).size, 3, `seed ${seed}: duplicate ids`);
    assert.ok(ids.includes('core.evade'), `seed ${seed} ${source}: ${ids}`);
  }
});
test('the reserved slot is never a stance already owned', () => {
  // The reserved card is any basic or cantrip of the dropped card's stance (several Core cards share Attack now), never an owned stance.
  for (const dropped of ['core.sweep', 'core.strike', 'core.counter']) {
    const run = fresh(); run.deck = run.deck.filter(card => card.cardId !== dropped);
    const accepted = reg.cards.all().map(card => card.id).filter(id => stanceOfId(id) === stanceOfId(dropped));
    assert.ok(accepted.includes(dropped));
    const missing = missingBasicStances(run, reg);
    assert.ok(missing.includes('evade') && missing.length === 2, `${dropped}: ${missing}`);
    for (const seed of SEEDS) {
      const ids = offer(reg, run, seed).options.map(row => row.id);
      assert.ok(ids[0] === 'core.evade' || accepted.includes(ids[0]), `${dropped} seed ${seed}: ${ids}`);
      assert.ok(ids[0] === 'core.evade' || missingBasicStances(run, reg).includes(stanceOfId(ids[0])), `${dropped} seed ${seed}: reserved card is of an owned stance`);
    }
  }
  const run = fresh(); run.deck = run.deck.filter(card => card.cardId !== 'core.sweep'); own(run, 'core.evade');
  for (const seed of SEEDS) assert.equal(offer(reg, run, seed).options[0].id, 'core.sweep', `seed ${seed}`);
});
test('owning every basic stance leaves offers exactly as the unreserved roll, with the same draws', () => {
  for (const seed of SEEDS) {
    const a = fresh(), b = fresh(regOff); own(a, 'core.evade'); own(b, 'core.evade');
    const ra = createRng(seed), rb = createRng(seed);
    assert.deepEqual(gameProfileRewardOffers(reg, a, ra, { offerId: 'x' }).options, gameProfileRewardOffers(regOff, b, rb, { offerId: 'x' }).options);
    assert.deepEqual(ra.getCounters(), rb.getCounters());
  }
});
test('the same seed rolls the same offer; disabling the setting restores the plain roll', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(offer(reg, fresh(), seed), offer(reg, fresh(), seed));
  }
  let withEvade = 0;
  for (const seed of SEEDS) if (offer(regOff, fresh(regOff), seed).options.some(row => row.id === 'core.evade')) withEvade++;
  assert.ok(withEvade < SEEDS.length, 'the plain roll does not always hold evade');
});
test('shops and Core 1 are untouched', () => {
  const stock = gameProfileShopStock(reg, fresh(), createRng(3), { shopId: 's' }), plain = gameProfileShopStock(regOff, fresh(regOff), createRng(3), { shopId: 's' });
  assert.deepEqual(stock.options, plain.options);
  const v1 = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@1.0.0', modules: {} });
  assert.equal(v1.content.rewards.eligibility.combatCards.stanceCoverage.enabled, false);
});
test('reservations never exceed the offer size and draw nothing for slots the offer cannot show', () => {
  const tuned = (offerCount, reservedSlots) => {
    const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { rewards: { offerCount, takeCount: Math.min(1, offerCount) }, 'reward-ranks': { stanceCoverage: { reservedSlots } } } });
    return bind(profile);
  };
  // The run carries its own profile, so each tuned run is created under its tuned registries.
  const draws = r => {
    const run = fresh(r); own(run, 'core.evade'); run.deck = run.deck.filter(card => !['core.sweep', 'core.counter'].includes(card.cardId));
    assert.equal(missingBasicStances(run, r).length, 2, 'sweep and counter (smash is still held by the Reaver special)');
    const rng = createRng(5), o = gameProfileRewardOffers(r, run, rng, { offerId: 'x', source: 'level' });
    return { o, c: rng.getCounters().cardRewards };
  };
  const one = draws(tuned(1, 10)), cap = draws(tuned(1, 1));
  assert.equal(one.o.options.length, 1);
  assert.deepEqual(one.o.options, cap.o.options);
  assert.equal(one.c, cap.c, 'same draws as one reserved slot');
  const none = draws(tuned(0, 10));
  assert.equal(none.o.options.length, 0);
  assert.ok(!none.c, 'no cardRewards draws for an empty offer');
});
