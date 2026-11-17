// Theme G of the 2026-11-17 playtest (owner): cards that pay off on the enemy's or the player's own stance, status
// and combat range. The conditions reuse the predicate DSL: `inStance` reads any entity (`of`), `idle` is no combat
// stance, and `atRange` reads the engagement band between the owner and the target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { evalPredicate } from '../src/engine/triggers.js';
import { validatePredicate } from '../src/model/validate.js';
import { actorRangeKey, rangePairKey } from '../src/model/combatEngagement.js';
import { PlayConditionMet, PlayConditionReachable } from '../src/engine/cardBehavior.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function live({ classId = 'reaver', enemyId = 'wanderingSoldier', seed = 917 } = {}) {
  const run = createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  return { combat, player: combat.player, enemy: combat.enemies[0] };
}
const stance = maneuver => ({ maneuver, camp: maneuver === 'casting' ? 'spell' : 'physical', range: 'melee' });
const setBand = (combat, enemy, band) => {
  combat.rangeState.engagements[rangePairKey(actorRangeKey(combat, combat.player), actorRangeKey(combat, enemy))] = band;
};
const problemsOf = pred => {
  const problems = [];
  validatePredicate(pred, 'pred', { err: (path, message) => problems.push(`${path}: ${message}`), ids: { stances: new Set(), statuses: new Set(['burn']) }, nodeIds: new Set() });
  return problems;
};

test('inStance of target: Idle is true with no combat stance and false once the target holds one', () => {
  const { combat, player, enemy } = live();
  const pctx = { owner: player, source: player, target: enemy };
  delete enemy.combatStance;
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'target', stance: 'idle' }, pctx), true);
  enemy.combatStance = { maneuver: 'neutral' };
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'target', stance: 'idle' }, pctx), true, 'the neutral placeholder is no stance');
  enemy.combatStance = stance('attack');
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'target', stance: 'idle' }, pctx), false);
});

test('inStance of target: Prepared matches the casting stance and nothing else', () => {
  const { combat, player, enemy } = live();
  const pctx = { owner: player, source: player, target: enemy };
  enemy.combatStance = stance('casting');
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'target', stance: 'prepared' }, pctx), true);
  enemy.combatStance = stance('defend');
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'target', stance: 'prepared' }, pctx), false);
});

test('inStance of self: Defense reads the player, and snapshot reads the stance before the card was played', () => {
  const { combat, player, enemy } = live();
  player.combatStance = stance('defend');
  const pctx = { owner: player, source: player, target: enemy };
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'self', stance: 'defend' }, pctx), true);
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'self', stance: 'defense' }, pctx), true, 'defense is an alias of defend');
  player.combatStance = stance('attack');
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'self', stance: 'defend' }, pctx), false);
  const before = structuredClone(player);
  before.combatStance = stance('defend');
  const snapshot = { ...pctx, meta: { abilityEntities: { [player.id]: before } } };
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'self', stance: 'defend', snapshot: 'beforePlay' }, snapshot), true);
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'self', stance: 'defend' }, snapshot), false, 'without snapshot the live stance answers');
});

test('inStance without of keeps reading the player, as before', () => {
  const { combat, player, enemy } = live();
  player.combatStance = stance('counter');
  enemy.combatStance = stance('defend');
  assert.equal(evalPredicate(combat, { p: 'inStance', stance: 'counter' }, { target: enemy }), true);
  assert.equal(evalPredicate(combat, { p: 'inStance', stance: 'defend' }, { target: enemy }), false);
});

test('hasStatus of target: a Burning target is true, a clean one false', () => {
  const { combat, player, enemy } = live();
  const pctx = { owner: player, source: player, target: enemy };
  enemy.statuses = { burn: { stacks: 2 } };
  assert.equal(evalPredicate(combat, { p: 'hasStatus', of: 'target', status: 'burn' }, pctx), true);
  enemy.statuses = {};
  assert.equal(evalPredicate(combat, { p: 'hasStatus', of: 'target', status: 'burn' }, pctx), false);
});

test('atRange reads the engagement band between the owner and the target', () => {
  const { combat, player, enemy } = live();
  assert.ok(combat.rangeState?.policy.enabled, 'Core fights carry range state');
  const pctx = { owner: player, source: player, target: enemy };
  setBand(combat, enemy, 1);
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'reach' }, pctx), true);
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'melee' }, pctx), false);
  setBand(combat, enemy, 0);
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'reach' }, pctx), false);
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'melee' }, pctx), true);
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'melee' }, { owner: player, source: player }), false, 'no target, no range');
});

test('atRange without range mechanics counts every pair as melee', () => {
  const { combat, player, enemy } = live();
  combat.rangeState = null;
  const pctx = { owner: player, source: player, target: enemy };
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'melee' }, pctx), true);
  assert.equal(evalPredicate(combat, { p: 'atRange', range: 'reach' }, pctx), false);
});

test('the predicate grammar admits the new fields and refuses bad ones', () => {
  assert.deepEqual(problemsOf({ p: 'inStance', of: 'target', stance: 'idle' }), []);
  assert.deepEqual(problemsOf({ p: 'inStance', of: 'self', stance: 'defend', snapshot: 'beforePlay' }), []);
  assert.deepEqual(problemsOf({ p: 'atRange', range: 'reach' }), []);
  assert.deepEqual(problemsOf({ p: 'atRange', range: 'reach', of: 'target' }), []);
  assert.equal(problemsOf({ p: 'atRange', range: 'far' }).length, 1);
  assert.equal(problemsOf({ p: 'inStance', stance: 'nap' }).length, 1);
  assert.equal(problemsOf({ p: 'atRange', range: 'reach', stance: 'idle' }).length, 1);
});

test('playIf: a reach-only card is allowed at reach and refused at melee', () => {
  const { combat, enemy } = live();
  const def = { id: 'probe', name: 'Probe', playIf: { p: 'atRange', range: 'reach' } };
  setBand(combat, enemy, 1);
  assert.equal(PlayConditionMet(combat, def, enemy), true);
  assert.equal(PlayConditionReachable(combat, def), true);
  setBand(combat, enemy, 0);
  assert.equal(PlayConditionMet(combat, def, enemy), false);
  assert.equal(PlayConditionReachable(combat, def), false, 'no living enemy can be aimed to meet it');
  assert.equal(PlayConditionMet(combat, { id: 'plain' }, enemy), true, 'a card without playIf is always allowed');
});

test('a playIf range gate reads on the card face', async () => {
  const { PlayConditionPhrase } = await import('../src/model/playingCard.js');
  assert.equal(PlayConditionPhrase({ p: 'atRange', range: 'reach' }), 'Only at Reach');
  assert.equal(PlayConditionPhrase({ p: 'inStance', of: 'target', stance: 'idle' }), 'Only while the target is Idle');
  assert.equal(PlayConditionPhrase(undefined), null);
});

test('a card preview that hides an unread enemy stance reads it as unknown, never as Idle (review of #2816)', async () => {
  const { previewCard } = await import('../src/engine/combat.js');
  const { knowledgeIntentProjection } = await import('../src/engine/enemyKnowledge.js');
  const { combat, enemy } = live();
  enemy.actorIntentRevealed = false;
  enemy.knowledgeAction.reads.player.visibility = 'unknown';
  assert.equal(knowledgeIntentProjection(combat, enemy)?.exact, false, 'the enemy intent is not read');
  enemy.combatStance = stance('attack');
  combat.piles.hand.unshift({ instanceId: 'oc', cardId: 'openingCut' });
  const view = {};
  previewCard(combat, 'oc', enemy.id, undefined, { knowledgeView: view });
  const shown = view.visible.enemies.find(row => row.id === enemy.id);
  assert.equal(shown.combatStance, undefined, 'the preview copy hides the stance');
  const pctx = { owner: view.visible.player, source: view.visible.player, target: shown };
  for (const wanted of ['idle', 'attack', 'prepared']) {
    assert.equal(evalPredicate(view.visible, { p: 'inStance', of: 'target', stance: wanted }, pctx), false, `a hidden stance is not ${wanted}`);
  }
  assert.equal(evalPredicate(combat, { p: 'inStance', of: 'target', stance: 'attack' }, { owner: combat.player, source: combat.player, target: enemy }), true, 'the live fight still reads the real stance');
});
