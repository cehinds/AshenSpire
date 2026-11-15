// Integration boundary: authored/imported weapon metadata must reach a real
// Core run, live quote and committed action, rather than only a range helper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { importLegacyContent } from '../src/framework/importer.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { rangePairKey } from '../src/model/combatEngagement.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { validateContent } from '../src/model/validate.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';
import { enemyMoveQuote } from '../src/engine/combatRoundsAdapter.js';
import { uncappedRun, withLegacyRangedBow } from './helpers/uncapped-range.mjs';
import { withoutBands } from './legacyBandsRules.mjs';

const profile = resolveGameProfile('core');
const registries = withLegacyRangedBow(bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile));
const imported = importLegacyContent({ ...contentBundle, equipment: { ...contentBundle.equipment, armaments: contentBundle.equipment.armaments.map(piece => piece.id === 'shortbow' ? { ...piece, range: 'ranged' } : piece) } }); // the legacy Ranged bow
const importedWeapon = id => imported.entities.find(row => row.kind === 'EQUIPMENT' && row.explicitOverrides.legacyId === id).explicitOverrides;
const bandOf = range => ['melee', 'reach', 'ranged'].indexOf(range);
function live(weaponId, enemyId = 'wanderingSoldier', seed = 511) {
  const run = createRunState({ registries, classId: 'reaver', seed });
  uncappedRun(run);
  run.loadout.sets.rightHand[0] = weaponId;
  run.loadout.sets.leftHand[0] = null;
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  return { run, combat, enemy: combat.enemies[0] };
}
function handStrike(combat) {
  const card = Object.values(combat.piles).flat().find(row => row.cardId === 'core.strike');
  assert.ok(card, 'real starting Strike');
  for (const pile of Object.values(combat.piles)) {
    const index = pile.indexOf(card);
    if (index >= 0) pile.splice(index, 1);
  }
  combat.piles.hand.push(card);
  return card;
}
const pair = enemy => rangePairKey('player:player', `enemy:${enemy.id}`);

// A paid approach that closes the pair for good is the legacy (pre-rows, 2026-11-15) arithmetic: the fight is built without the `bands` block.
test('real imported sword, halberd and bow coverage sets initial distance and live Strike payment (legacy, no rows)', () => {
  for (const id of ['straightSword', 'halberd', 'shortbow']) {
    const metadata = importedWeapon(id), expected = bandOf(metadata.range);
    const { combat, enemy } = withoutBands(() => live(id)), card = handStrike(combat);
    assert.equal(combat.rangeState.engagements[pair(enemy)], expected, `${id}: imported initial range`);
    // A shared distant target separates source coverage from the initial pair.
    combat.rangeState.engagements[pair(enemy)] = 2;
    const preview = previewCard(combat, card.instanceId, enemy.id);
    const route = preview.range.routes.find(row => row.id === 'advance');
    assert.equal(route.targets[0].coverage, expected, `${id}: imported coverage reaches live preview`);
    assert.equal(route.advanceSp, 2 - expected, `${id}: exact missing bands`);
    assert.equal(route.targets[0].currentInRange, expected === 2);
    assert.ok(route.targets[0].hitChance > 0, `${id}: paid approach can connect`);
    combat.player.stamina = route.costs.stamina;
    const begin = combat.eventLog.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
    assert.equal(combat.player.stamina, 0, `${id}: actual pool matches quoted total`);
    const events = combat.eventLog.slice(begin);
    assert.equal(events.find(row => row.type === 'cardPlayed').staminaSpent, route.costs.stamina);
    assert.ok(events.some(row => row.type === 'attackHit' || row.type === 'attackMissed'), `${id}: a real hit roll resolved`);
    assert.equal(events.some(row => row.missReason === 'range'), false);
    assert.equal(combat.rangeState.engagements[pair(enemy)], expected, 'a paid approach persists as the new distance');
  }
});

// Under the shipped rows rule the pair band does not persist a paid approach: the melee card aimed at a back-row enemy Advances you instead,
// and Advanced (bands.advancedTurnEnds turn ends) puts you in reach of every enemy (SPEC, Rows).
test('a paid approach under rows Advances the player instead of storing a new distance', () => {
  const { combat, enemy } = live('straightSword'), card = handStrike(combat);
  enemy.row = 'back';
  combat.rangeState.engagements[pair(enemy)] = 1;
  assert.ok(!(combat.player.advanced > 0), 'fixture: not Advanced yet');
  const preview = previewCard(combat, card.instanceId, enemy.id);
  combat.player.stamina = preview.costs?.stamina ?? 5;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id });
  assert.ok(combat.player.advanced > 0, 'the auto-Advance leaves the player Advanced');
  assert.equal(combat.rangeState.engagements[pair(enemy)], 0, 'Advanced puts the player in reach of the back-row enemy');
});

test('the imported dagger Throw property exposes and commits only its one-band extension', () => {
  assert.ok(importedWeapon('dagger').propertyTags.includes('throw'));
  const { combat, enemy } = live('dagger'), card = handStrike(combat);
  combat.rangeState.engagements[pair(enemy)] = 1;
  const preview = previewCard(combat, card.instanceId, enemy.id, undefined, { rangeRoute: 'throw' });
  const route = preview.range.routes.find(row => row.id === 'throw');
  assert.equal(route.available, true);
  assert.equal(route.advanceSp, 0);
  assert.equal(route.targets[0].coverage, 0);
  assert.equal(route.targets[0].precisionDelta, -combat.rangeState.policy.throwPrecisionPenalty);
  assert.equal(route.targets[0].currentHitChance, 0);
  assert.ok(route.targets[0].hitChance > 0);
  combat.rangeState.engagements[pair(enemy)] = 2;
  assert.equal(previewCard(combat, card.instanceId, enemy.id).range.routes.find(row => row.id === 'throw').available, false);
  combat.rangeState.engagements[pair(enemy)] = 1;
  combat.player.stamina = route.costs.stamina;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id, rangeRoute: 'throw' });
  assert.equal(combat.player.stamina, 0);
  assert.ok(combat.eventLog.some(row => row.type === 'attackHit' || row.type === 'attackMissed'));
  assert.equal(combat.eventLog.some(row => row.missReason === 'range'), false);
  assert.equal(combat.rangeState.engagements[pair(enemy)], 1);
});


test('Core mobility projection preserves nested and explicit flat offense override authority', () => {
  const enemies = contentBundle.enemies.map(row => row.id === 'wanderingSoldier'
    ? { ...row, moves: { ...row.moves, slash: { ...row.moves.slash, damage: 99 } } } : row);
  const nested = applyGameProfileToContent({ ...contentBundle, enemies }, profile);
  assert.equal(nested.enemies.find(row => row.id === 'wanderingSoldier').moves.slash.damage, 99);
  const enemyMoves = contentBundle.enemyMoves.map(row => row.enemyId === 'wanderingSoldier' && row.id === 'slash' ? { ...row, damage: 77 } : row);
  const explicit = applyGameProfileToContent({ ...contentBundle, enemies, enemyMoves }, profile);
  assert.equal(explicit.enemies.find(row => row.id === 'wanderingSoldier').moves.slash.damage, 77);
});

test('a real authored 1 SP enemy closes Ranged to Reach to Melee and attacks with legitimate support interleaves', () => {
  // The old planner consumed two AI picks for its nominal 2 SP queue even
  // though this native enemy can execute only one. Strict actual-pool planning
  // consumes one pick: preserve its legitimate Guard decisions, not hidden draws.
  // No move, intent, SP pool, enemy stat, or engagement state is injected.
  const { combat, enemy } = live('shortbow', 'wanderingSoldier', 2);
  assert.equal(enemy.maxStamina, 1, 'the actual configured enemy has only 1 SP');
  assert.equal(combat.rangeState.engagements[pair(enemy)], 2, 'the equipped bow establishes Ranged');
  const source = profile.content.enemies.find(row => row.id === enemy.enemyId);
  assert.ok(source.defaultDeck.includes('wanderingSoldier.advance'));
  assert.equal(registries.enemies.get(enemy.enemyId).moves.advance.sp, 1);
  const trace = ['advance', 'guard', 'advance', 'guard', 'slash'];
  for (const [index, band] of [1, 1, 0, 0, 0].entries()) {
    assert.deepEqual(enemyPlanActions(combat, enemy).map(row => [row.id, row.sp]), [[trace[index], 1]], 'the complete affordable action is forecast before execution');
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    let attempts = 0;
    while (combat.pendingReaction && attempts++ < 20) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    assert.equal(!!combat.pendingReaction, false, 'the normal reaction continuation finishes');
    assert.equal(combat.rangeState.engagements[pair(enemy)], band, `turn ${index + 1} distance`);
    assert.equal(enemy.maxStamina, 1, 'movement cannot inflate the authored pool');
    assert.equal(enemy.stamina, 0, 'one normally priced action spends the complete 1 SP');
    const events = combat.eventLog.slice(start);
    const expectedMove = trace[index];
    assert.deepEqual(events.filter(row => row.type === 'enemyMoveStarted').map(row => row.moveId), [expectedMove]);
    assert.deepEqual(enemy.performedMoves, trace.slice(0, index + 1));
    if (expectedMove === 'advance') {
      assert.equal(events.filter(row => row.type === 'combatEngagementMoved').length, 1);
      assert.equal(events.some(row => row.type === 'damageDealt' && row.sourceId === enemy.id), false, 'closing is a paid movement action, not an attack');
    } else if (expectedMove === 'slash') {
      assert.ok(events.some(row => ['attackHit', 'attackMissed'].includes(row.type) && row.sourceId === enemy.id), 'the fifth turn resolves a genuine attack');
      assert.equal(events.some(row => row.missReason === 'range'), false);
    }
  }
});

test('the native paid closing move is committed and previewed before execution without spending SP or RNG', () => {
  const { combat, enemy } = live('shortbow', 'wanderingSoldier', 2);
  const before = JSON.stringify({ stamina: enemy.stamina, intent: enemy.intent, plan: enemy.plannedMoves,
    distance: combat.rangeState, rng: combat.rng.getCounters() });
  assert.equal(enemy.intent.moveId, 'advance', 'the forecast commits owned mobility rather than an unaffordable Slash');
  assert.deepEqual(enemy.plannedMoves, []);
  assert.deepEqual(enemyPlanActions(combat, enemy).map(action => [action.id, action.sp]), [['advance', 1]]);
  const def = registries.enemies.get(enemy.enemyId);
  assert.equal(enemyMoveQuote(def.moves.slash, { enemy, moveId: 'slash', combat }).totalSp, 3);
  assert.equal(enemyMoveQuote(def.moves.advance, { enemy, moveId: 'advance', combat }).totalSp, 1);
  assert.equal(JSON.stringify({ stamina: enemy.stamina, intent: enemy.intent, plan: enemy.plannedMoves,
    distance: combat.rangeState, rng: combat.rng.getCounters() }), before);
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  for (let count = 0; combat.pendingReaction; count++) {
    assert.ok(count < 20);
    dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  const started = combat.eventLog.slice(start).filter(event => event.type === 'enemyMoveStarted');
  assert.deepEqual(started.map(event => event.moveId), ['advance']);
  assert.equal(started[0].actionPreview.totalSp, 1);
  assert.equal(enemy.stamina, 0);
  assert.equal(enemy.maxStamina, 1);
});

test('native range closing does not make a multi-hit move affordable below its 2 SP base floor', () => {
  const { combat, enemy } = live('shortbow', 'blightHound', 2);
  const def = registries.enemies.get(enemy.enemyId);
  assert.equal(enemy.maxStamina, 1);
  assert.equal(enemyMoveQuote(def.moves.lunge, { enemy, moveId: 'lunge', combat }).sp, 2);
  assert.equal(enemy.intent.moveId, 'advance');
  assert.deepEqual(enemyPlanActions(combat, enemy).map(action => [action.id, action.sp]), [['advance', 1]]);
});
