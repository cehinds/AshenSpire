import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { gameProfileRewardOffers, cardPickWeight } from '../src/model/gameProfileRewards.js';

const build = modules => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules });
  return bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
};
// Module overrides merge into the defaults, so a neutral tag table names every authored tag.
const NEUTRAL = { 'maneuver:casting': 1, 'maneuver:smash': 1, 'maneuver:counter': 1, 'maneuver:sweep': 1, default: 1 };
const weighted = build({}), uniform = build({ 'reward-ranks': { ownedCopyWeight: 1, tagWeights: NEUTRAL } });
const starter = ['core.strike', 'core.strike', 'core.strike', 'core.defend', 'core.defend', 'core.counter', 'core.smash', 'core.sweep', 'core.evade', 'base.draw', 'core.reaverSpecial'];
function sample(registries, offers = 120) {
  const picks = [];
  for (let i = 0; i < offers; i++) {
    const run = createRunState({ seed: i + 1, classId: 'reaver', registries });
    run.deck = starter.map((cardId, n) => ({ instanceId: `d${n}`, cardId, upgraded: false }));
    const owned = new Set(starter);
    for (const option of gameProfileRewardOffers(registries, run, createRng(500 + i), { offerId: `w${i}` }).options) if (option.kind === 'combatCards') picks.push({ id: option.id, owned: owned.has(option.id) });
  }
  return picks;
}

test('Core Smash and the other basic stance cards are offerable rank 1 cards', () => {
  const cards = weighted.cards;
  for (const id of ['core.smash', 'core.sweep', 'core.counter', 'core.strike', 'core.defend']) assert.equal(cards.get(id).rarity, 'common', id);
  assert.ok(sample(weighted, 200).some(pick => pick.id === 'core.smash'), 'Smash appears among 200 Core offers');
});
test('owned cards are weighted down, non-casting maneuvers up, and the pick is deterministic', () => {
  const run = createRunState({ seed: 1, classId: 'reaver', registries: weighted });
  const combat = run.gameProfile.content.rewards.eligibility.combatCards;
  assert.equal(combat.ownedCopyWeight, 0.2);
  assert.equal(cardPickWeight(combat, { tags: ['maneuver:casting'] }, 0), 1);
  assert.equal(cardPickWeight(combat, { tags: ['maneuver:attack'] }, 0), 3);
  assert.equal(cardPickWeight(combat, { tags: ['maneuver:smash'] }, 2), 10 * 0.2 * 0.2);
  assert.equal(cardPickWeight({}, { tags: ['x'] }, 3), 1);
  const a = sample(weighted, 30), b = sample(weighted, 30);
  assert.deepEqual(a, b);
});
test('weights cut the owned-card rate and raise non-casting maneuvers against uniform picks', () => {
  const rate = picks => picks.filter(pick => pick.owned).length / picks.length;
  const share = (registries, picks) => picks.filter(pick => !(registries.cards.get(pick.id).tags || []).includes('maneuver:casting')).length / picks.length;
  const before = sample(uniform, 600), after = sample(weighted, 600);
  assert.ok(share(weighted, after) > share(uniform, before), `non-casting share rises: ${share(weighted, after)} vs ${share(uniform, before)}`);
  // Basics are favoured by tag weight, so compare owned copies of NON-basic picks too: the penalty alone must lower the rate.
  const penaltyOnly = sample(build({ 'reward-ranks': { tagWeights: NEUTRAL } }), 600);
  assert.ok(rate(penaltyOnly) < rate(before), `owned rate ${rate(penaltyOnly)} < ${rate(before)}`);
});
