// Review of #2816: the simulator bot met the reach-only cards (playIf atRange reach) at melee, picked one as
// affordable, and the engine's refusal escaped tools/runsim.mjs as a crash. The bot now skips a card whose play
// condition no living enemy meets, aims a playIf card at an enemy that meets it, and runsim sets any structured
// play refusal aside, as coresim does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardChoicePlan } from '../src/engine/combat.js';
import { actorRangeKey, rangePairKey } from '../src/model/combatEngagement.js';
import { affordableCards, botCardTargetId, refusalsFor } from '../tools/simbot.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const REACH_ONLY = ['lungingThrust', 'distantStar'];

function meleeFight(seed, enemyIds = ['wanderingSoldier']) {
  const run = createRunState({ registries, classId: 'reaver', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.deck = [...REACH_ONLY, ...REACH_ONLY, 'core.strike', 'core.strike', 'core.strike', 'core.defend', 'core.defend']
    .map((cardId, index) => ({ instanceId: `d${index}`, cardId, upgraded: false }));
  return createRunCombat({ registries, run, rng: createRng(seed), enemyIds });
}
const band = (combat, enemy) => combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, enemy))];

test('at melee the bot never offers a reach-only card, and a whole fight finishes with no refusal', () => {
  for (const seed of [3, 17, 29]) {
    const combat = meleeFight(seed);
    assert.ok(combat.rangeState?.policy.enabled, 'a Core fight carries range');
    let guard = 0, reachOffered = 0;
    while (!combat.result && guard++ < 4000 && combat.turn <= 60) {
      if (combat.pendingReaction) { dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); continue; }
      const living = combat.enemies.filter(enemy => enemy.alive);
      const atMelee = living.every(enemy => band(combat, enemy) === 0);
      const card = affordableCards(registries, combat, refusalsFor(combat))[0];
      if (!card) { dispatch(combat, { type: 'endTurn' }); continue; }
      if (REACH_ONLY.includes(card.cardId)) { reachOffered += 1; assert.ok(!atMelee, `seed ${seed}: a reach-only card was offered at melee`); }
      const targetId = botCardTargetId(registries, combat, card, living[0]?.id);
      const choice = cardChoicePlan(combat, card.instanceId)?.options[0]?.id;
      // Any throw here fails the test: the bot must not choose a play the engine refuses.
      dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId, choice });
    }
    assert.ok(guard < 4000, `seed ${seed}: the decision loop stays bounded`);
    assert.ok(combat.result || combat.turn > 60, `seed ${seed}: the fight ran to an end`);
    assert.equal(reachOffered, 0, `seed ${seed}: the enemy stayed at melee, so no reach-only card was ever offered`);
  }
});

test('at reach the bot offers the reach-only card and aims it at the enemy that meets the condition', () => {
  const combat = meleeFight(5, ['wanderingSoldier', 'wanderingSoldier']);
  const [near, far] = combat.enemies;
  combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, near))] = 0;
  combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, far))] = 1;
  Object.assign(combat.player, { energy: 9, stamina: 9, mana: 9 });
  combat.piles.hand.unshift({ instanceId: 'lt', cardId: 'lungingThrust' });
  const offered = affordableCards(registries, combat, new Set()).find(card => card.instanceId === 'lt');
  assert.ok(offered, 'one enemy is at reach, so the card is playable');
  assert.equal(botCardTargetId(registries, combat, offered, near.id), far.id, 'aimed at the enemy at reach, not the one at melee');
  const hp = far.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'lt', targetId: far.id });
  assert.ok(far.hp < hp);
});

test('runsim sets a structured play refusal aside instead of crashing', () => {
  const source = readFileSync(new URL('../tools/runsim.mjs', import.meta.url), 'utf8');
  assert.match(source, /function setAsideOrCrash\(e\) \{\n\s+if \(!\(e && e\.playRefusal\) && !ENGINE_REFUSALS\.some/);
});
