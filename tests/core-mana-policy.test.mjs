import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, cardPlayCosts } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { getStacks } from '../src/engine/statuses.js';
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fresh(classId = 'reaver', reg = registries) {
  return createRunState({ seed: 73, classId, registries: reg, runId: 'mana-policy-test',
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['one'] } } },
  });
}
function fight(cardId, classId = 'reaver', reg = registries) {
  const run = fresh(classId, reg);
  const combat = createRunCombat({ registries: reg, rng: createRng(3), run, enemyIds: ['wanderingSoldier'], settings: {} });
  const card = { instanceId: 'mana-test-card', cardId, upgraded: false };
  combat.piles.hand = [card];
  combat.enemies[0].hp = combat.enemies[0].maxHp = 1000;
  return { combat, card };
}

test('core Reaver starts with one MP and an earned WIS point still adds exactly one maximum MP', () => {
  const run = fresh(); assert.equal(run.maxMana, 1); assert.equal(run.mana, 1);
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1); run.mapNodeId = 'n3_0';
  beginGameProfileRest(run, '1:n3_0'); run.level.unspentPoints = 1;
  commitGameProfileRest(registries, run, 'levelUp', { attributeId: 'wisdom' });
  assert.equal(run.maxMana, 2); assert.equal(run.mana, 2);
});

test('core Smash is twice its same-rank Strike for one extra SP; Sundering Art is three times that Smash plus one MP', () => {
  const strike = resolveCard(registries, { cardId: 'core.strike' });
  const smash = resolveCard(registries, { cardId: 'core.smash' });
  const art = resolveCard(registries, { cardId: 'core.reaverSpecial' });
  assert.deepEqual([strike.effects[0].amount, strike.staminaCost, strike.manaCost], [6, 1, 0]);
  assert.deepEqual([smash.effects[0].amount, smash.staminaCost, smash.manaCost], [12, 2, 0]);
  assert.deepEqual([art.effects[0].amount, art.staminaCost, art.manaCost], [36, 2, 1]);
  assert.ok(smash.tags.includes('maneuver:smash') && art.tags.includes('maneuver:smash'));
});

test('Sundering Art preview, affordability and actual combat payment use the same 2 SP and 1 MP', () => {
  const { combat, card } = fight('core.reaverSpecial');
  assert.deepEqual(cardPlayCosts(combat, card.instanceId), { energy: 2, stamina: 2, mana: 1 });
  combat.player.mana = 0;
  const before = combat.player.stamina;
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }), /mana/i);
  assert.equal(combat.player.stamina, before, 'refused play pays nothing');
  combat.player.mana = 1;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  assert.equal(combat.player.mana, 0);
  assert.equal(combat.player.stamina, before - 2);
  assert.ok(combat.eventLog.some(event => event.type === 'cardPlayed' && event.cardInstanceId === card.instanceId));
});

test('Star Spark pays one MP and actually applies two decaying Vulnerable stacks', () => {
  const { combat, card } = fight('core.starseerSpecial', 'starseer');
  const before = combat.player.mana;
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
  assert.equal(combat.player.mana, before - 1);
  assert.equal(getStacks(combat.enemies[0], 'vulnerable'), 2);
  assert.equal(registries.statuses.get('vulnerable').modifiers.damageTakenMult, 1.25);
  assert.equal(registries.statuses.get('vulnerable').decay, 'perTurnEnd');
});

test('configured MP-off variants keep the resource absent instead of reintroducing a Mana requirement', () => {
  const noMp = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@1.0.0', modules: { resources: { include: ['hp', 'sp'] } } });
  const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, noMp)), noMp);
  for (const id of ['core.reaverSpecial', 'core.starseerSpecial']) {
    const card = resolveCard(reg, { cardId: id }); assert.equal(card.manaCost, 0); assert.equal(card.resourceCosts?.mp || 0, 0);
  }
});
