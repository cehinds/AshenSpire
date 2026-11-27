import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, cardPickWeight } from '../src/model/gameProfileRewards.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const cards = Array.from({ length: 8 }, (_, i) => ({ id: `fixture.weight.${i}`, class: 'colorless', type: 'attack', rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0,
  tags: [i < 4 ? 'maneuver:attack' : 'maneuver:casting'], effects: [{ op: 'damage', target: 'enemy', amount: 1 }] }));
const neutral = { default: 1, 'maneuver:attack': 1, 'maneuver:casting': 1 };
const rule = { ownedCopyWeight: .05, tagWeights: { ...neutral, 'maneuver:attack': 1.5 } };

// These in-memory candidate fixtures exercise the real offer entry point. They
// are never serialized as historical profiles or installed as game content.
function sample(weights, offers = 600) {
  const picks = [];
  for (let i = 0; i < offers; i++) {
    const run = createRunState({ seed: i + 1, classId: 'reaver', registries });
    run.gameProfile = structuredClone(run.gameProfile);
    const content = run.gameProfile.content;
    content.cards = cards;
    content.rewards = { ...content.rewards, categories:['combatCards'], offerCount: 1, combatOfferCount: { min: 1, max: 1 },
      rewardGroups: [{ id: 'fixture.cards', weight: 1, categories: ['combatCards'] }],
      eligibility: { ...content.rewards.eligibility, excludeCardIds: [], playableOnly: false,
        weaponArts: { ...content.rewards.eligibility.weaponArts, cardIds: [] },
        combatCards: { ...weights, minRank: 0, lowerRankChance: 1, skipOwned: false, skipOwnedBasics: false,
          depthBias: null, typeWeights: {}, recentOfferWindow: 0, offeredCopyWeight: 1,
          stanceCoverage: { enabled: false, reservedSlots: 0, preferTiers: [], excludePools: [] } } } };
    run.gameProfile.modules.rewards.offerCount = 1;
    run.gameProfile.modules.rewards.rewardGroups=content.rewards.rewardGroups;
    run.gameProfile.modules.progression.cardRanks = false;
    run.gameProfile.modules.effects.spellRewardPolicyVersion = 0;
    run.deck = [0, 4].map(n => ({ instanceId: `owned${n}`, cardId: cards[n].id }));
    run.sideboard = [];
    for (const option of gameProfileRewardOffers(registries, run, createRng(500 + i), { offerId: `w${i}` }).options) {
      if (option.kind !== 'combatCards') continue;
      assert.ok(cards.some(card => card.id === option.id), 'only controlled candidates are offered');
      picks.push({ id: option.id, owned: run.deck.some(card => card.cardId === option.id) });
    }
  }
  return picks;
}

test('authored card ownership and tag weights reach the runtime rule', () => {
  const settings = profile.modules['reward-ranks'];
  const configured = profile.content.rewards.eligibility.combatCards;
  const authored=JSON.parse(readFileSync(new URL('../engine/modules/reward-ranks/defaults.json',import.meta.url)));
  assert.equal(configured.ownedCopyWeight, authored.ownedCopyWeight);
  assert.deepEqual(configured.tagWeights, authored.tagWeights);
  assert.equal(configured.ownedCopyWeight, settings.ownedCopyWeight);
  assert.deepEqual(configured.tagWeights, settings.tagWeights);
  for (const card of registries.cards.all()) for (const owned of [0, 1, 2]) {
    const matching = (card.tags || []).filter(tag => tag !== 'default' && Number.isFinite(configured.tagWeights?.[tag]));
    const tag = matching.length ? matching.reduce((product, key) => product * configured.tagWeights[key], 1) : configured.tagWeights?.default ?? 1;
    assert.equal(cardPickWeight(configured, card, owned), tag * Math.pow(configured.ownedCopyWeight ?? 1, owned));
  }
});

test('controlled tag and per-owned-copy weights multiply without special card identities', () => {
  assert.equal(cardPickWeight(rule, { tags: ['maneuver:casting'] }, 0), 1);
  assert.equal(cardPickWeight(rule, { tags: ['maneuver:attack'] }, 0), 1.5);
  assert.ok(Math.abs(cardPickWeight(rule, { tags: ['maneuver:attack'] }, 2) - 1.5 * .05 * .05) < 1e-12);
  assert.equal(cardPickWeight({}, { tags: ['unweighted'] }, 3), 1);
  assert.equal(cardPickWeight({ ownedCopyWeight: .5, tagWeights: { a: 2, b: 3 } }, { tags: ['a', 'b'] }, 2), 1.5);
});

test('the real seeded offer picker reduces owned picks and raises weighted tags with controlled candidates', () => {
  const before = sample({ ownedCopyWeight: 1, tagWeights: neutral });
  const after = sample(rule);
  const penaltyOnly = sample({ ownedCopyWeight: .05, tagWeights: neutral });
  const rate = picks => picks.filter(pick => pick.owned).length / picks.length;
  const attackShare = picks => picks.filter(pick => cards.find(card => card.id === pick.id).tags.includes('maneuver:attack')).length / picks.length;
  assert.equal(before.length, 600); assert.equal(after.length, 600);
  assert.ok(attackShare(after) > attackShare(before), 'tag weights affect the actual picker');
  assert.ok(rate(penaltyOnly) < rate(before), 'ownership weights affect the actual picker');
  assert.deepEqual(sample(rule, 30), sample(rule, 30), 'same seed and candidates replay identically');
});
