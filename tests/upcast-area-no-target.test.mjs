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
import { cardNeedsEnemyTarget } from '../src/model/friendlyTargets.js';
import { upcastOptions } from '../src/model/upcasting.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, previewCoopCard, playCard } from '../src/engine/coopCombat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { combatCardView } from '../src/ui/models/CombatCardView.js';

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

test('co-op upcast area card sends one untargeted intent at the chosen rank; single-target still picks', () => {
  const area = { instanceId: 'contagion-1', cardId: 'contagion' };
  const single = { instanceId: 'spark-1', cardId: 'starSpark' };
  const coop = createCoopCombat({ registries, rng: createRng(5), combatExpansionVersion: 2, enemyIds,
    players: [{ id: 'a', ...player([area, single]), combatExpansionVersion: 2, orderedDraw: true }] });
  const seat = coop.players.get('a');
  const context = { registries, player: seat.entity, combatExpansionVersion: 2, breakMeterVersion: coop.breakMeterVersion ?? 0 };
  const players = [{ ...seat.entity, id: 'a', connected: true }];
  const view = (card, rank) => combatCardView(context, { ...card, combatPreview: previewCoopCard(coop, 'a', card.instanceId),
    upcastPreviews: { [rank]: previewCoopCard(coop, 'a', card.instanceId, undefined, rank) } }, rank);
  const rankOf = card => Math.max(...upcastOptions(combatCardView(context, card)).map(row => row.ranks ?? row.tier ?? row).filter(Number.isFinite));
  const areaRank = rankOf(area);
  const chosen = view(area, areaRank);
  const plan = cardTargetPlan(chosen, 'a', coop.enemies, players);
  assert.equal(plan.mode, 'enemy');
  assert.equal(upcastNextStep(plan, cardNeedsEnemyTarget(chosen), undefined), 'playUntargeted');
  const { events } = playCard(coop, 'a', area.instanceId, undefined, undefined, areaRank);
  assert.equal(events.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === area.instanceId).length, 1);
  const sparkRank = rankOf(single);
  const spark = view(single, sparkRank);
  const sparkPlan = cardTargetPlan(spark, 'a', coop.enemies, players);
  assert.equal(upcastNextStep(sparkPlan, cardNeedsEnemyTarget(spark), undefined), 'retarget', 'single-target opens the picker');
  assert.equal(upcastNextStep(sparkPlan, cardNeedsEnemyTarget(spark), coop.enemies[0].id), 'play');
});

test('both upcast-after-target doors route an untargeted step to an immediate play with the chosen ranks', () => {
  const solo = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  assert.match(solo, /upcastNextStep\(plan, previewCard\(combat, instanceId, undefined, Number\(selectedRank\)\)\.needsTarget, previousTarget\)/);
  assert.match(solo, /playCard\(instanceId, step === 'play' \? targetId : null, choice, Number\(selectedRank\)\)/);
  const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
  assert.match(coop, /upcastNextStep\(plan, cardNeedsEnemyTarget\(chosen\), previousTarget\)/);
  assert.match(coop, /step === 'playUntargeted'\) \{ send\(\{ \.\.\.obj, targetId: undefined, upcastTier: Number\(ranks\) \}\); return; \}/);
});
