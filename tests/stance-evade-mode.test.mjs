import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { executeAction } from '../src/engine/actions.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { tacticalCarrier } from '../src/engine/combatCardTactics.js';
import { beginTacticalAction, setCombatStance } from '../src/engine/combatMatchups.js';
import { attackHitPreview, resolveAttackHit } from '../src/engine/stanceHit.js';
import { createRng } from '../src/engine/rng.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const registries = createRegistries(contentBundle);
function playCrawlingShot(prone) {
  const ctx = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'rogue', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
      deck: [{ cardId: 'crawlingShot', instanceId: 'crawl' }] } });
  let actor = ctx.player, enemy = ctx.enemies[0];
  enemy.hp = enemy.maxHp = 1000;
  enemy.combatStance = { camp: 'physical', maneuver: 'attack', range: 'melee' };
  if (prone) actor.statuses.prone = { stacks: 1 };
  const def = resolveCombatCard(ctx, ctx.piles.hand[0]);
  const carrier = tacticalCarrier(def, { cardId: 'crawlingShot', type: def.type }, ctx, actor);
  primeAccuracyRolls(ctx);
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'crawl', targetId: enemy.id });
  actor = ctx.player; enemy = ctx.enemies[0];
  actor.evasion = 0; enemy.accuracy = 100;
  assert.equal(actor.combatStance.range, 'reach', 'the real Crawling Shot stance keeps authored Reach');
  const incoming = { tags: ['camp:physical', 'maneuver:attack'],
    combatProfile: { camp: 'physical', maneuver: 'attack', range: 'reach' } };
  return { ctx, actor, enemy, carrier, incoming };
}

test('Crawling Shot grants its conditional Advantage for one shared eligible avoidance check', () => {
  const { ctx, actor, enemy, carrier, incoming } = playCrawlingShot(true);
  assert.equal(actor.statuses.evade.stacks, 1);
  assert.deepEqual(actor.nextEvadeMode, { advantage: true, disadvantage: false, whileStatus: 'prone' });
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(ctx)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), snapshot });
  assert.deepEqual(restored.player.nextEvadeMode, actor.nextEvadeMode, 'the conditional pending mode survives the canonical save validator');
  let draws = 0;
  ctx.rng.int = () => { draws++; return draws === 1 ? 19 : 1; };
  const receipt = beginTacticalAction(ctx, enemy, actor, incoming, [{ amount: 1 }, { amount: 1 }, { amount: 1 }]);
  assert.equal(receipt.counterAttack.mode, 'disadvantage');
  assert.deepEqual(receipt.counterAttack.dice, [19, 1]);
  assert.equal(receipt.avoided, true);
  assert.equal(draws, 2, 'three contacts share one advantaged defender decision');
  assert.equal(actor.statuses.evade?.stacks || 0, 0, 'the eligible miss consumes one stack');
  assert.equal(actor.nextEvadeMode, undefined);
  ctx.rng.int = () => { draws++; return 19; };
  assert.equal(resolveAttackHit(ctx, enemy, actor, incoming).mode, 'normal');
  assert.equal(draws, 3, 'the next action uses only its ordinary single roll');
  setCombatStance(ctx, actor, carrier);
  assert.equal(actor.nextEvadeMode, undefined, 'same-stance repetition grants no extra entry mode');
});

test('an ineligible Crawling Shot entry grants neither unconditional stacks nor Advantage', () => {
  const { ctx, actor, enemy, incoming } = playCrawlingShot(false);
  assert.equal(actor.statuses.evade, undefined);
  assert.equal(actor.nextEvadeMode, undefined);
  assert.equal(attackHitPreview(ctx, enemy, actor, incoming).mode, 'normal');
});

test('conditional Advantage waits through range, Target, disabled Evasion and a missing condition', () => {
  const { ctx, actor, enemy, incoming } = playCrawlingShot(true);
  const pending = structuredClone(actor.nextEvadeMode);
  let draws = 0; ctx.rng.int = () => { draws++; return 19; };
  const melee = { ...incoming, combatProfile: { ...incoming.combatProfile, range: 'melee' } };
  assert.equal(resolveAttackHit(ctx, enemy, actor, melee).missReason, 'range');
  const targetSpell = { tags: ['target'], combatProfile: { camp: 'spell', maneuver: 'casting', range: 'reach' } };
  assert.equal(resolveAttackHit(ctx, enemy, actor, targetSpell).hit, true);
  assert.equal(draws, 0); assert.deepEqual(actor.nextEvadeMode, pending);
  assert.equal(resolveAttackHit(ctx, enemy, actor, incoming, { evadeDisabled: true }).mode, 'normal');
  assert.deepEqual(actor.nextEvadeMode, pending);
  delete actor.statuses.prone;
  assert.equal(resolveAttackHit(ctx, enemy, actor, incoming).mode, 'normal');
  assert.deepEqual(actor.nextEvadeMode, pending, 'a missing condition does not consume the prepared eligible check');
  actor.statuses.prone = { stacks: 1 };
  assert.equal(attackHitPreview(ctx, enemy, actor, incoming).mode, 'disadvantage');
  assert.equal(actor.statuses.evade.stacks, 1, 'none of the ineligible actions consumes the stack');
});

test('Clear Head waits through ordinary attacks until an actual Evade is available', () => {
  const ctx = createCombat({ registries, rng: createRng(702), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'rogue', maxHp: 100, hp: 100,
      maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1,
      deck: [{ cardId: 'clearHead', instanceId: 'clear' }] } });
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'clear' });
  const actor = ctx.player, enemy = ctx.enemies[0];
  actor.evasion = 0; enemy.accuracy = 100;
  assert.deepEqual(actor.nextEvadeMode, { advantage: true, disadvantage: false });
  assert.equal(actor.statuses.evade, undefined); assert.equal(actor.combatEvade, undefined);
  const incoming = { tags: ['camp:physical', 'maneuver:attack'],
    combatProfile: { camp: 'physical', maneuver: 'attack', range: 'ranged' } };
  let draws = 0; ctx.rng.int = () => { draws++; return 19; };
  assert.equal(resolveAttackHit(ctx, enemy, actor, incoming).mode, 'normal');
  assert.equal(draws, 1);
  assert.deepEqual(actor.nextEvadeMode, { advantage: true, disadvantage: false },
    'a normal incoming attack cannot spend a pending next-Evade mode');
  executeAction(ctx, { effect: { op: 'applyStatus', target: 'self', status: 'evade', stacks: 1 },
    source: actor, owner: actor, target: actor });
  draws = 0; ctx.rng.int = () => { draws++; return draws === 1 ? 19 : 1; };
  const receipt = beginTacticalAction(ctx, enemy, actor, incoming, [{ amount: 1 }, { amount: 1 }]);
  assert.equal(receipt.counterAttack.mode, 'disadvantage');
  assert.equal(receipt.avoided, true);
  assert.equal(draws, 2, 'the whole incoming action shares one advantaged decision');
  assert.equal(actor.nextEvadeMode, undefined);
  assert.equal(actor.statuses.evade?.stacks || 0, 0);
});
