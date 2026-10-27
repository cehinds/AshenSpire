// Owner 2026-10-27: Core combat rewards are 70% cards / 20% potions / 10% weapons, lean hard to cards the character does not
// own, avoid the last reward screens, and favour basic/cantrip cards early and mana-cost cards after map depth 3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers } from '../src/model/gameProfileRewards.js';
import { basicOrCantripMatcher } from '../src/model/stanceCoverage.js';

const build = (modules = {}, core = 'ashen.core@2.0.0') => {
  const profile = resolveGameProfile({ formatVersion: 1, core, modules });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
};
const NO_RESERVE = { 'reward-ranks': { stanceCoverage: { enabled: false, reservedSlots: 0, preferTiers: ['basic'], excludePools: ['special'] } } };
const reg = build(NO_RESERVE);
const fresh = (seed, registries = reg) => createRunState({ seed, classId: 'reaver', registries });
const cardsOf = run => run.gameProfile.content.cards;

test('combat reward kinds roll 70% cards, 20% potions, 10% weapons over 1000 seeded rolls', () => {
  const profile = { 'reward-ranks': NO_RESERVE['reward-ranks'], rewards: { offerCount: 1 } };
  const registries = build(profile), counts = {};
  for (let i = 0; i < 1000; i++) {
    const [option] = gameProfileRewardOffers(registries, fresh(i + 1, registries), createRng(7000 + i), { offerId: 'f' }).options;
    const kind = ['combatCards', 'weaponArts'].includes(option.kind) ? 'cards' : option.kind;
    counts[kind] = (counts[kind] || 0) + 1;
  }
  for (const [kind, share] of Object.entries({ cards: .7, potions: .2, weapons: .1 })) assert.ok(Math.abs(counts[kind] / 1000 - share) <= .03, JSON.stringify(counts));
  assert.deepEqual(Object.keys(counts).sort(), ['cards', 'potions', 'weapons'], 'relics and armor are retired from combat rewards');
});

test('owned cards are offered far less often than unowned ones, per card', () => {
  const run0 = fresh(1), ids = cardsOf(run0).filter(c => c.rarity === 'common' && c.class === 'colorless').map(c => c.id);
  const ownedIds = new Set(ids.slice(0, Math.floor(ids.length / 2)));
  const hits = new Map(); let n = 0;
  for (let i = 0; i < 400; i++) {
    const run = fresh(i + 1); run.floor = 5;
    run.deck = [...run.deck, ...[...ownedIds].map((cardId, k) => ({ instanceId: `o${k}`, cardId, upgraded: false }))];
    for (const o of gameProfileRewardOffers(reg, run, createRng(100 + i), { offerId: 'f' }).options) if (o.kind === 'combatCards') hits.set(o.id, (hits.get(o.id) || 0) + 1);
  }
  const avg = list => list.reduce((s, id) => s + (hits.get(id) || 0), 0) / list.length;
  const owned = [...ownedIds], unowned = ids.filter(id => !ownedIds.has(id));
  assert.ok(owned.length > 2 && unowned.length > 2);
  assert.ok(avg(owned) * 5 < avg(unowned), `owned ${avg(owned)} vs unowned ${avg(unowned)} per card`);
});

test('offers are deterministic, and an exhausted unowned pool falls back to owned cards', () => {
  const run = fresh(3); run.floor = 2;
  const again = structuredClone(run);
  assert.deepEqual(gameProfileRewardOffers(reg, run, createRng(9), { offerId: 'f' }).options, gameProfileRewardOffers(reg, again, createRng(9), { offerId: 'f' }).options);
  const full = fresh(4); full.floor = 2;
  full.deck = cardsOf(full).filter(c => c.class === 'colorless' || c.class === full.class).map((c, k) => ({ instanceId: `a${k}`, cardId: c.id, upgraded: false }));
  const kinds = new Set();
  for (let i = 0; i < 60; i++) { const run2 = structuredClone(full); for (const o of gameProfileRewardOffers(reg, run2, createRng(i), { offerId: 'f' }).options) kinds.add(o.kind); }
  assert.ok(kinds.has('combatCards'), 'owned cards are still offered when nothing unowned is left');
});

test('a card shown on a recent reward screen is offered less often than a fresh one', () => {
  const run0 = fresh(1); run0.floor = 5;
  const probe = gameProfileRewardOffers(reg, structuredClone(run0), createRng(1), { offerId: 'p' }).options.find(o => o.kind === 'combatCards').id;
  let withRecent = 0, without = 0;
  for (let i = 0; i < 600; i++) {
    const a = fresh(i + 1); a.floor = 5;
    const b = structuredClone(a);
    a.gameProfileRewardOffers = { '1:x:combat': { id: '1:x:combat', source: 'combat', options: [{ kind: 'combatCards', id: probe }], takeCount: 1, taken: [], claimed: null } };
    if (gameProfileRewardOffers(reg, a, createRng(500 + i), { offerId: 'f' }).options.some(o => o.id === probe)) withRecent++;
    if (gameProfileRewardOffers(reg, b, createRng(500 + i), { offerId: 'f' }).options.some(o => o.id === probe)) without++;
  }
  assert.ok(withRecent * 3 < without, `recent ${withRecent} vs fresh ${without}`);
});

test('depth 1-3 offers lean basic/cantrip, depth 4+ offers lean mana-cost cards (owner 2026-10-27)', () => {
  const isBasic = basicOrCantripMatcher(reg, fresh(1)), defs = new Map(cardsOf(fresh(1)).map(c => [c.id, c]));
  const share = depths => {
    let total = 0, basic = 0, mana = 0, high = 0;
    for (const depth of depths) for (let i = 0; i < 250; i++) {
      const run = fresh(i + 1); run.floor = depth;
      for (const o of gameProfileRewardOffers(reg, run, createRng(i * 7 + depth), { offerId: 'f' }).options) if (o.kind === 'combatCards') {
        total++; if (isBasic(o.id)) basic++; if ((defs.get(o.id).manaCost || 0) > 0) mana++; if (['uncommon', 'rare'].includes(defs.get(o.id).rarity)) high++;
      }
    }
    return { basic: basic / total, mana: mana / total, high: high / total };
  };
  const early = share([1, 2, 3]), late = share([4, 5, 6]);
  console.log('depth shares', JSON.stringify({ early, late }));
  assert.ok(early.basic > late.basic + .05, `basic/cantrip early ${early.basic} vs late ${late.basic}`);
  assert.ok(late.mana > early.mana + .02, `mana late ${late.mana} vs early ${early.mana}`);
});

test('Core 1 stays neutral: no depth, recent or ownership bias', () => {
  const core1 = build({}, 'ashen.core@1.0.0'), rule = fresh(1, core1).gameProfile.content.rewards.eligibility.combatCards;
  assert.equal(rule.ownedCopyWeight, 1);
  assert.equal(rule.recentOfferWindow, 0);
  assert.equal(rule.depthBias.early.basicOrCantrip, 1);
  assert.equal(rule.depthBias.late.mana, 1);
});
