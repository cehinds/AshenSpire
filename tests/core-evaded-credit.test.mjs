// An evaded hit (accuracy.hitRoll false reports missReason 'evaded') must count as evaded for every reader:
// the knowledge credit, the selected-weapon body reaction, the combat log row and the presentation's dodge test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { snapshotEnemyKnowledgeRules } from '../src/model/enemyKnowledgeRules.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { openRunEnemyKnowledge } from '../src/model/enemyKnowledgeRun.js';
import { selectedWeaponReactionFor, REAVER_GREATSWORD_PILOT as pilot } from '../src/model/selectedWeaponStances.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('a Core fight (knowledge opted in): an enemy attack into one Evade stack credits the knowledge and reads as an evade reaction', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 11, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  // The shipped Core profile turns enemy knowledge off; opt this run in so the credit path is exercised under the shipped hit rules.
  run.enemyKnowledgeRules = snapshotEnemyKnowledgeRules(registries);
  Object.assign(run.enemyKnowledgeRules.reads, { minimumExact: 0, maximumExact: 0, minimumClue: 0, maximumClue: 0 });
  openRunEnemyKnowledge(run, { bankable: true, receiptId: 'evaded-credit-run' });
  const combat = createRunCombat({ registries, run, rng: createRng(11), enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  assert.equal(combat.fixCoreRules.accuracy.hitRoll, false, 'the shipped rules');
  combat.player.statuses.evade = { stacks: 1 };
  const owner = combat.enemyKnowledge.owners.player;
  assert.equal(owner.earnedXp, 0);
  combat.enemies[0].knowledgeAction.reads.player.visibility = 'unknown'; // an unread action is the one that pays Perception
  dispatch(combat, { type: 'endTurn' });
  for (let i = 0; combat.pendingReaction && i < 64; i++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  const evaded = combat.eventLog.find(event => event.type === 'attackMissed' && event.targetId === 'player');
  assert.ok(evaded, 'the attack was evaded');
  assert.equal(evaded.missReason, 'evaded');
  assert.equal(combat.enemyKnowledge.owners.player.earnedXp, 1, 'the evade credit is recorded');
  assert.equal(selectedWeaponReactionFor(evaded, pilot), 'evade', 'the Reaver plays its evade reaction');
});
