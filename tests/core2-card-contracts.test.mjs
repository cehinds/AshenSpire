import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { makeAuditCombat, settleAuditChoices } from '../tools/combat-audit/fixtures.mjs';
import { assertImmediateContracts } from '../tools/combat-audit/cards.mjs';

test('every admitted Core 2 card and authored upgrade previews and resolves through paid dispatch', async t => {
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const api = { ...await loadAuditRuntime('native'), registries };
  const classIds = registries.classes.all().map(row => row.id);
  let played = 0, rejected = 0;
  for (const card of profile.content.cards) for (const upgraded of card.upgrade ? [false, true] : [false]) {
    const key = `${card.id}/${upgraded ? 'upgraded' : 'base'}`;
    const classId = classIds.includes(card.class) ? card.class : classIds[0];
    const { combat } = makeAuditCombat(api, {
      classId, enemyIds: ['wanderingSoldier'], relicIds: [],
      profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['first', 'second', 'third'] } } },
      instance: { cardId: card.id, instanceId: `core2:${key}`, upgraded },
      cardInstances: Array.from({ length: 3 }, (_, i) => ({ cardId: 'core.strike', instanceId: `core2:filler:${i}` })),
    });
    assert.deepEqual(combat.gameProfile.lock, profile.lock);
    assert.equal(combat.core2ActionRulesVersion, 2);
    const instance = combat.piles.hand[0], definition = resolveCard(registries, instance);
    const plan = api.cardTargetPlan(definition, combat.player.id, combat.enemies, [{ ...combat.player, connected: true }], { solo: true });
    const targetId = plan.legalIds[0];
    const choice = api.cardChoicePlan(combat, instance.instanceId)?.options?.find(row => !row.active)?.id;
    const rngBefore = combat.rng.getCounters();
    assert.doesNotThrow(() => api.previewCard(combat, instance.instanceId, targetId), `${key}: preview`);
    assert.deepEqual(combat.rng.getCounters(), rngBefore, `${key}: preview must not spend RNG`);
    const action = { type: 'playCard', cardInstanceId: instance.instanceId, targetId, ...(choice ? { choice } : {}) };
    if (registries.framework.isUnplayable(definition)) {
      assert.throws(() => api.dispatch(combat, action), /unplayable|cannot play/i, key);
      assert.equal(combat.eventLog.some(event => event.type === 'cardPlayed' && event.cardInstanceId === instance.instanceId), false, key);
      rejected++;
      continue;
    }
    const costs = api.cardPlayCosts(combat, instance.instanceId);
    const executedDefinition = api.selectCardVariant(combat, definition, costs, targetId === combat.player.id ? combat.player : combat.enemies.find(enemy => enemy.id === targetId));
    const eventStart = combat.eventLog.length;
    assert.doesNotThrow(() => api.dispatch(combat, action), `${key}: play`);
    for (let i = 0; i < 10; i++) {
      settleAuditChoices(api, combat);
      if (!combat.pendingCardChoice) break;
      const pending = combat.pendingCardChoice;
      api.dispatch(combat, { type: 'chooseCards', cardInstanceIds: pending.candidateIds.slice(0, pending.count) });
    }
    assert.equal(combat.pendingCardChoice ?? null, null, `${key}: choice converges`);
    assert.equal(combat.queue.length, 0, `${key}: queue converges`);
    const events = combat.eventLog.slice(eventStart);
    const receipts = events.filter(event => event.type === 'cardPlayed' && event.cardInstanceId === instance.instanceId);
    assert.equal(receipts.length, 1, `${key}: one paid receipt`);
    assert.equal(receipts[0].staminaSpent, costs.stamina, `${key}: SP payment`);
    assert.equal(receipts[0].manaSpent, costs.mana, `${key}: MP payment`);
    assert.ok(events.some(event => event.type === 'cardResolved' && event.cardInstanceId === instance.instanceId), `${key}: resolution receipt`);
    assert.doesNotThrow(() => assertImmediateContracts(executedDefinition, events, instance.instanceId), `${key}: immediate authored effects`);
    played++;
  }
  t.diagnostic(`${profile.content.cards.length} Core 2 card identities; ${played} base/upgrade paid plays; ${rejected} authored unplayable refusals`);
});
