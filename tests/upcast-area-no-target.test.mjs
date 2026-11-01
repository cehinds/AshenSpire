// Regression: with "ask to upcast after target" on, an area card (Contagion:
// allEnemies) chosen at a rank plays once with that rank and no
// target, instead of arming a single-enemy picker and asking for the rank again.
// Single-target cards keep #1728's re-target-after-rank beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { cardTargetPlan, upcastNextStep } from '../src/model/cardTargets.js';
import { upcastOptions } from '../src/model/upcasting.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';

const registries = createRegistries(contentBundle);
const player = deck => ({ classId: 'starseer', hp: 80, maxHp: 80, maxMana: 30, mana: 30, maxStamina: 30,
  stamina: 30, energyMax: 10, drawPerTurn: deck.length, deck });
const enemyIds = ['wanderingSoldier', 'wanderingSoldier'];

function soloStep(combat, instanceId, rank, previousTarget) {
  const inst = combat.piles.hand.find(card => card.instanceId === instanceId);
  const preview = previewCard(combat, instanceId, undefined, rank);
  const plan = cardTargetPlan({ ...resolveCombatCard(combat, inst, { upcastRanks: rank }), combatPreview: preview },
    combat.player.id, combat.enemies, [{ id: combat.player.id, alive: true, connected: true }], { solo: true });
  return { plan, step: upcastNextStep(plan, preview.needsTarget, previousTarget) };
}

for (const cardId of ['contagion']) test(`solo upcast ${cardId} (allEnemies) plays once at the chosen rank with no picker`, () => {
  const instanceId = `${cardId}-1`;
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    player: player([{ instanceId, cardId }]), enemyIds });
  const def = resolveCombatCard(combat, combat.piles.hand[0]);
  const ranks = upcastOptions(def).map(row => row.ranks ?? row.tier ?? row).filter(Number.isFinite);
  assert.ok(ranks.length, `${cardId} offers upcast ranks`);
  const rank = Math.max(...ranks);
  const { plan, step } = soloStep(combat, instanceId, rank, null);
  assert.equal(plan.mode, 'enemy', 'area card is hostile');
  assert.equal(plan.legalIds.includes(null), false, 'the old check could never pass for a null target');
  assert.equal(step, 'playUntargeted');
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, upcastTier: rank });
  const played = out.events.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === instanceId);
  assert.equal(played.length, 1, 'played exactly once');
  assert.equal(combat.piles.hand.some(card => card.instanceId === instanceId), false);
});

test('solo single-target upcast still re-targets after the rank when no legal target is remembered', () => {
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2,
    player: player([{ instanceId: 'spark-1', cardId: 'starSpark' }]), enemyIds });
  const rank = Math.max(...upcastOptions(resolveCombatCard(combat, combat.piles.hand[0])).map(row => row.ranks ?? row.tier ?? row).filter(Number.isFinite));
  assert.equal(soloStep(combat, 'spark-1', rank, null).step, 'retarget');
  assert.equal(soloStep(combat, 'spark-1', rank, combat.enemies[0].id).step, 'play');
});

test('the upcast-after-target door routes an untargeted step to an immediate play with the chosen ranks', () => {
  const solo = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(solo, /upcastNextStep\(plan, previewCard\(combat, instanceId, undefined, Number\(selectedRank\)\)\.needsTarget, previousTarget\)/);
  assert.match(solo, /playCard\(instanceId, step === 'play' \? targetId : null, choice, Number\(selectedRank\)\)/);
});
