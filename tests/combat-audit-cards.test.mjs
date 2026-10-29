import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { makeAuditCombat, settleAuditChoices } from '../tools/combat-audit/fixtures.mjs';
import { assertImmediateContracts, auditCounterLifecycle, auditDeferredConditions, auditStateSnapshot } from '../tools/combat-audit/cards.mjs';
test('positive authored effects require operation receipts even when card dispatch succeeds', () => {
  const card = { id: 'fixture', effects: [{ op: 'damage', amount: 6, target: 'enemy' }] };
  assert.throws(() => assertImmediateContracts(card, [{ type: 'cardPlayed', cardInstanceId: 'a' }], 'a'), /must emit damageDealt/);
  assert.throws(() => assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'b', incoming: 6 }], 'a'), /must emit damageDealt/);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'a', incoming: 6 }], 'a').covered, ['damage']);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'a', damageReceipt: { hits: [{ incoming: 6 }] } }], 'a').covered, ['damage']);
  assert.throws(() => assertImmediateContracts(card, [{ type: 'damageDealt', cardInstanceId: 'a', damageReceipt: { hits: [{ incoming: 0 }] } }], 'a'), /positive damage/);
});

for (const mode of ['native', 'bundled']) test(`${mode}: Fire Cleanse pays its self-hit before removing Poison and Greased`, async () => {
  const api = await loadAuditRuntime(mode);
  for (const greased of [false, true]) {
    const { combat } = makeAuditCombat(api, { classId: 'reaver', enemyIds: ['wanderingSoldier'], instance: { cardId: 'base.fire-cleanse' }, relicIds: [] });
    combat.player.statuses['base.poison'] = { stacks: 5 };
    if (greased) combat.player.statuses['base.greased'] = { stacks: 3 };
    const instance = combat.piles.hand[0], hpBefore = combat.player.hp, start = combat.eventLog.length;
    api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: combat.player.id });
    settleAuditChoices(api, combat);
    const events = combat.eventLog.slice(start), expected = greased ? 6 : 2;
    assert.equal(hpBefore - combat.player.hp, expected, 'the fire cost really removes HP; Greased triples it before cleansing');
    const damage = events.filter(event => event.type === 'damageDealt' && event.cardInstanceId === instance.instanceId);
    assert.equal(damage.length, 1);
    assert.equal(damage[0].targetId, combat.player.id);
    assert.equal(damage[0].incoming, expected);
    assert.equal(events.filter(event => event.type === 'hpLost' && event.targetId === combat.player.id).reduce((n, event) => n + event.amount, 0), expected);
    assert.equal(combat.player.statuses['base.poison'], undefined);
    assert.equal(combat.player.statuses['base.greased'], undefined);
    if (greased) assert.equal(combat.player.statuses.burn.stacks, 3);
    assert.ok(events.findIndex(event => event.type === 'damageDealt') < events.findIndex(event => event.type === 'statusRemoved' && event.status === 'base.poison'));
    assert.equal(combat.pendingReaction ?? null, null, 'self damage never offers a hostile reaction against its caster');
    assert.ok(events.some(event => event.type === 'cardResolved' && event.cardInstanceId === instance.instanceId));
  }
});

for (const mode of ['native', 'bundled']) test(`${mode}: card audit settles Scout and checks the selected stance payload`, async () => {
  const api = await loadAuditRuntime(mode);
  const scout = makeAuditCombat(api, { classId: 'reaver', instance: { cardId: 'base.scout' }, relicIds: [] }).combat;
  const instance = scout.piles.hand[0];
  api.dispatch(scout, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: scout.player.id });
  assert.equal(scout.pendingCardChoice.count, 3);
  assert.deepEqual(settleAuditChoices(api, scout), ['cards']);
  assert.ok(scout.eventLog.some(event => event.type === 'cardResolved' && event.cardInstanceId === instance.instanceId));
  for (const maneuver of ['attack', 'smash']) {
    const { combat } = makeAuditCombat(api, { classId: 'reaver', instance: { cardId: 'base.current-stance-variant' }, relicIds: [] });
    combat.player.combatStance = { maneuver, camp: 'physical', range: 'melee' };
    const inst = combat.piles.hand[0], def = api.resolveCombatCard(combat, inst);
    const costs = api.cardPlayCosts(combat, inst.instanceId);
    const selected = api.selectCardVariant(combat, def, costs, combat.enemies[0]);
    assert.equal(selected.effects[0].op, maneuver === 'smash' ? 'damage' : 'block');
    api.dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: combat.enemies[0].id });
    settleAuditChoices(api, combat);
    assert.doesNotThrow(() => assertImmediateContracts(selected, combat.eventLog, inst.instanceId));
  }
});

for (const mode of ['native', 'bundled']) test(`${mode}: planned self damage honors both branches of its authored predicate`, async () => {
  const loaded = await loadAuditRuntime(mode);
  const cards = loaded.contentBundle.cards.map(card => card.id === 'base.fire-cleanse'
    ? { ...card, effects: card.effects.map((effect, i) => i === 0 ? { ...effect, if: { p: 'hasStatus', of: 'self', status: 'base.poison' } } : effect) }
    : card);
  const api = { ...loaded, registries: loaded.createRegistries({ ...loaded.contentBundle, cards }) };
  for (const poisoned of [false, true]) {
    const { combat } = makeAuditCombat(api, { classId: 'reaver', instance: { cardId: 'base.fire-cleanse' }, relicIds: [] });
    if (poisoned) combat.player.statuses['base.poison'] = { stacks: 5 };
    const instance = combat.piles.hand[0], before = combat.player.hp;
    api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: combat.player.id });
    settleAuditChoices(api, combat);
    assert.equal(before - combat.player.hp, poisoned ? 2 : 0);
    assert.equal(combat.player.statuses['base.poison'], undefined);
    assert.ok(combat.eventLog.some(event => event.type === 'cardResolved' && event.cardInstanceId === instance.instanceId));
  }
});
test('counter reply payload requires preparation rather than premature HP damage', () => {
  const card = { id: 'counter', tags: ['maneuver:counter'], effects: [{ op: 'damage', amount: 6 }] };
  assert.throws(() => assertImmediateContracts(card, [], 'a'), /payload must arm/);
  assert.deepEqual(assertImmediateContracts(card, [{ type: 'combatCounterArmed', cardInstanceId: 'a' }], 'a'), {
    covered: ['counter-preparation'], uncovered: ['deferred-damage'] });
});

for (const mode of ['native', 'bundled']) test(`${mode}: real counter incoming, suppression, bypass and declined-reaction lifecycle`, async () => {
  const report = await auditCounterLifecycle({ mode });
  assert.equal(report.cases.length, 4);
  assert.deepEqual(report.failures, []);
});

for (const mode of ['native', 'bundled']) test(`${mode}: refusal state proof includes enemies, gates and RNG`, async () => {
  const api = await loadAuditRuntime(mode);
  const { combat } = makeAuditCombat(api, { classId: 'reaver', instance: { cardId: 'strike', upgraded: false } });
  let before = auditStateSnapshot(api, combat);
  combat.enemies[0].hp--;
  assert.notEqual(auditStateSnapshot(api, combat), before);
  before = auditStateSnapshot(api, combat);
  combat.triggerState.set('audit:unexpected', { fires: 1, turn: combat.turn, turnFires: 1 });
  assert.notEqual(auditStateSnapshot(api, combat), before);
  before = auditStateSnapshot(api, combat);
  combat.rng.float('misc');
  assert.notEqual(auditStateSnapshot(api, combat), before);
  combat.queue.push({ effect: { op: 'draw', amount: 1 }, source: combat.player });
  assert.throws(() => auditStateSnapshot(api, combat), /still resolving/);
});

for (const mode of ['native', 'bundled']) test(`${mode}: guarded and HP-loss predicates retain exact deferred reply payloads`, async () => {
  const report = await auditDeferredConditions({ mode });
  assert.equal(report.rows.length, 12);
  assert.deepEqual(report.failures, []);
});
