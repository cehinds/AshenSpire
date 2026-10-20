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

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const imported = importLegacyContent(contentBundle);
const importedWeapon = id => imported.entities.find(row => row.kind === 'EQUIPMENT' && row.explicitOverrides.legacyId === id).explicitOverrides;
const bandOf = range => ['melee', 'reach', 'ranged'].indexOf(range);
function live(weaponId, enemyId = 'wanderingSoldier') {
  const run = createRunState({ registries, classId: 'reaver', seed: 511 });
  run.loadout.sets.rightHand[0] = weaponId;
  run.loadout.sets.leftHand[0] = null;
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [enemyId] });
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
