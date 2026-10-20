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

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const imported = importLegacyContent(contentBundle);
const importedWeapon = id => imported.entities.find(row => row.kind === 'EQUIPMENT' && row.explicitOverrides.legacyId === id).explicitOverrides;
const bandOf = range => ['melee', 'reach', 'ranged'].indexOf(range);
function live(weaponId, enemyId = 'wanderingSoldier', seed = 511) {
  const run = createRunState({ registries, classId: 'reaver', seed });
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

test('real imported sword, halberd and bow coverage sets initial distance and live Strike payment', () => {
  for (const id of ['straightSword', 'halberd', 'shortbow']) {
    const metadata = importedWeapon(id), expected = bandOf(metadata.range);
    const { combat, enemy } = live(id), card = handStrike(combat);
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
    assert.equal(combat.rangeState.engagements[pair(enemy)], 2, 'temporary approach cannot persistently move the pair');
  }
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

test('Core projects only owned paid mobility and range metadata without repricing existing enemy offense', () => {
  const before = JSON.stringify(contentBundle.enemies);
  const bundle = applyGameProfileToContent(contentBundle, profile);
  const validation = validateContent(bundle);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.deepEqual(applyGameProfileToContent(bundle, profile), bundle, 'range projection is idempotent');
  for (const original of contentBundle.enemies) {
    const source = profile.content.enemies.find(row => row.id === original.id);
    const projected = bundle.enemies.find(row => row.id === original.id);
    for (const [id, move] of Object.entries(original.moves)) assert.deepEqual(projected.moves[id], move, `${original.id}.${id}: offense unchanged`);
    for (const field of ['startingRange', 'rangeClosingMove', 'rangeRoutePolicy']) assert.equal(projected[field], source[field], `${original.id}/${field}`);
    const cardId = source.defaultDeck.find(id => source.cardHints?.[id]?.legacyMove === source.rangeClosingMove);
    const card = profile.content.enemyCards.find(row => row.id === cardId);
    assert.ok(card, `${original.id}: closing card is truly owned`);
    const move = registries.enemies.get(original.id).moves[source.rangeClosingMove];
    assert.equal(move.sp, card.staminaCost);
    assert.equal(move.weight, 0, 'mobility is selected explicitly, never added to the random attack pool');
    assert.deepEqual(move.effects, card.effects);
    assert.equal(combatProfileFor(move).maneuver, null, 'Advance cannot award an attack stance');
  }
  for (const id of ['hookCast', 'chainSnare', 'draggingBlow']) assert.equal(combatProfileFor(registries.enemies.get('chainScavenger').moves[id]).range, 'reach');
  const { combat, enemy } = live('straightSword', 'chainScavenger');
  assert.equal(combat.rangeState.engagements[pair(enemy)], 1, 'authored chain starting range reaches the real fight');
  assert.equal(JSON.stringify(contentBundle.enemies), before, 'projection does not mutate shared Legacy/Current enemy content');
  const current = applyGameProfileToContent(contentBundle, 'current');
  assert.deepEqual(current.enemies, contentBundle.enemies);
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

test('a real authored 1 SP enemy closes Ranged to Reach to Melee, then attacks on successive turns', () => {
  // Seed 2 naturally schedules the shipped soldier's Slash for these turns;
  // no move, intent, SP pool, enemy stat, or engagement state is injected.
  const { combat, enemy } = live('shortbow', 'wanderingSoldier', 2);
  assert.equal(enemy.maxStamina, 1, 'the actual configured enemy has only 1 SP');
  assert.equal(combat.rangeState.engagements[pair(enemy)], 2, 'the equipped bow establishes Ranged');
  const source = profile.content.enemies.find(row => row.id === enemy.enemyId);
  assert.ok(source.defaultDeck.includes('wanderingSoldier.advance'));
  assert.equal(registries.enemies.get(enemy.enemyId).moves.advance.sp, 1);
  for (const [index, band] of [1, 0, 0].entries()) {
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    let attempts = 0;
    while (combat.pendingReaction && attempts++ < 20) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    assert.equal(!!combat.pendingReaction, false, 'the normal reaction continuation finishes');
    assert.equal(combat.rangeState.engagements[pair(enemy)], band, `turn ${index + 1} distance`);
    assert.equal(enemy.maxStamina, 1, 'movement cannot inflate the authored pool');
    assert.equal(enemy.stamina, 0, 'one normally priced action spends the complete 1 SP');
    const events = combat.eventLog.slice(start);
    const expectedMove = index < 2 ? 'advance' : 'slash';
    assert.deepEqual(events.filter(row => row.type === 'enemyMoveStarted').map(row => row.moveId), [expectedMove]);
    assert.deepEqual(enemy.performedMoves, ['advance', 'advance', 'slash'].slice(0, index + 1));
    if (index < 2) {
      assert.equal(events.filter(row => row.type === 'combatEngagementMoved').length, 1);
      assert.equal(events.some(row => row.type === 'damageDealt' && row.sourceId === enemy.id), false, 'closing is a paid movement action, not an attack');
    } else {
      assert.ok(events.some(row => ['attackHit', 'attackMissed'].includes(row.type) && row.sourceId === enemy.id), 'the third turn resolves a genuine attack');
      assert.equal(events.some(row => row.missReason === 'range'), false);
    }
  }
});
