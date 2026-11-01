import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCardHit } from '../src/engine/combat.js';
import { previewTargetFor, hitReadExact } from '../src/engine/stanceHit.js';

// Owner ruling D8: the hit-% badge has no Perception gate, but it must not leak the
// telegraphed stance. A failed read prices the target stance-neutral; an exact read does not.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live({ historical = false } = {}) {
  const run = createRunState({ registries: reg, classId: 'starseer', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  // Historical saved fights have no pairwise range state and keep stance-held distance.
  if (historical) delete combat.rangeState;
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, attributes: { dexterity: 0 } });
  delete target.combatCounter;
  return { combat, target };
}
const stances = { melee: { maneuver: 'attack', camp: 'physical', range: 'melee' }, ranged: { maneuver: 'evade', camp: 'physical', range: 'ranged' } };
const read = visibility => ({ reads: { player: { visibility } } });
function odds(combat, target, cardId, stance, visibility, observer = 'player') {
  target.combatStance = structuredClone(stance);
  target.matchingStanceCardMultiplier = stance === stances.ranged ? 0.25 : 0;
  target.knowledgeAction = read(visibility);
  const inst = { cardId, instanceId: 'probe-' + cardId, upgraded: false };
  combat.piles.hand.push(inst);
  const out = previewCardHit(combat, inst.instanceId, target.id, undefined, observer ? { observerId: observer } : {});
  combat.piles.hand.pop();
  return out.hitChance;
}
const cards = ['core.strike', 'core.cantrip']; // a melee attack and a spell

for (const historical of [false, true]) test(`${historical ? 'historical' : 'Core range'} failed read: melee and ranged telegraphs give the same badge for a melee and a spell card`, () => {
  assert.equal(cards.length, 2, 'a melee and a spell card are exercised');
  const { combat, target } = live({ historical });
  for (const cardId of cards) for (const visibility of ['hidden', 'unknown', undefined])
    assert.equal(odds(combat, target, cardId, stances.melee, visibility), odds(combat, target, cardId, stances.ranged, visibility), cardId + ' ' + visibility);
});
test('historical exact read: telegraphed stance-held range still changes the badge', () => {
  const { combat, target } = live({ historical: true });
  assert.notEqual(odds(combat, target, 'core.strike', stances.melee, 'exact'), odds(combat, target, 'core.strike', stances.ranged, 'exact'));
});
test('Core range: exact and unobserved telegraphs never move the public pair distance', () => {
  const { combat, target } = live();
  const before = structuredClone(combat.rangeState);
  for (const visibility of ['hidden', 'exact']) for (const observer of ['player', null]) {
    assert.equal(odds(combat, target, 'core.strike', stances.melee, visibility, observer),
      odds(combat, target, 'core.strike', stances.ranged, visibility, observer));
  }
  assert.deepEqual(combat.rangeState, before, 'preview/observer projection cannot move public distance');
  assert.deepEqual(target.combatStance, stances.ranged, 'preview never rewrites the live telegraph');
  const near = odds(combat, target, 'core.strike', stances.ranged, 'hidden');
  const key = Object.keys(combat.rangeState.engagements)[0];
  combat.rangeState.engagements[key] = 2;
  const far = odds(combat, target, 'core.strike', stances.ranged, 'hidden');
  assert.ok(near > far, 'actual public distance still affects the badge even when its telegraph is hidden');
  assert.equal(far, 0, 'the Strike cannot reach beyond its actual weapon coverage');
});
test('the preview never edits the live target, and no observer means the unchanged engine preview', () => {
  const { combat, target } = live({ historical: true });
  odds(combat, target, 'core.strike', stances.ranged, 'hidden');
  assert.deepEqual(target.combatStance, stances.ranged);
  assert.equal(target.matchingStanceCardMultiplier, 0.25);
  assert.notEqual(odds(combat, target, 'core.strike', stances.melee, 'hidden', null), odds(combat, target, 'core.strike', stances.ranged, 'hidden', null));
});
test('helper returns the same object on an exact read and a neutral copy otherwise', () => {
  const t = { combatStance: stances.ranged, knowledgeAction: read('exact') };
  assert.equal(previewTargetFor(t, 'player'), t); assert.equal(hitReadExact(t), true);
  const blind = previewTargetFor({ ...t, knowledgeAction: read('hidden') }, 'player');
  assert.deepEqual(blind.combatStance, { maneuver: 'neutral', camp: 'physical', range: 'melee' });
});

test('an active Read Intent reveal keeps the target stance in the badge price', async () => {
  const { previewTargetFor } = await import('../src/engine/stanceHit.js');
  const enemy = { id: 'e1', combatStance: { maneuver: 'smash', camp: 'physical', range: 'ranged' }, proposalIntentRevealedUntilByOwner: { player: 5 } };
  assert.equal(previewTargetFor(enemy, 'player', { turn: 3 }), enemy);
  assert.equal(previewTargetFor(enemy, 'player', { turn: 5 }).combatStance.maneuver, 'neutral');
});

test('a counter whose reply is stored as enemy damage shows no hit badge', async () => {
  const { cardAffectsEnemies } = await import('../src/model/hitBadge.js');
  const cards = Array.isArray(contentBundle.cards) ? contentBundle.cards : Object.values(contentBundle.cards);
  for (const id of ['guardCounter', 'riposte', 'rondelParry']) {
    const card = cards.find(row => row.id === id);
    if (!card) continue;
    assert.ok(card.effects.some(effect => effect.target === 'enemy'), `${id} stores an enemy-targeted reply`);
    assert.equal(cardAffectsEnemies(card), false, id);
  }
});
