import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard, cardPlayCosts } from '../src/engine/combat.js';
import { createCoopCombat, playCard, chooseDiscard, endTurn, previewCoopCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { applyStatus, removeStatus, advanceStatusClock, getStacks } from '../src/engine/statuses.js';
import { evalPredicate, triggerOwnerKey } from '../src/engine/triggers.js';
import { grantAbilityCharge, beginAbilityTurn, matchingAbilityCharges } from '../src/engine/abilityRiders.js';
import { computeTokenBindings, validateEffects } from '../src/model/validate.js';

function fixture(effects, { manaCost = 0, cost = 1, coop = false } = {}) {
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, name: 'Rider fixture', cost, manaCost, effects, upgrade: {}, abilityKind: 'spell', abilityFamily: 'fixture', cardTags: ['kind.skill', 'source:spell'] };
  const registries = { ...base, cards: { ...base.cards, get: id => id === 'defend' ? card : base.cards.get(id) } };
  const player = { id: 'p1', classId: 'herald', maxHp: 80, hp: 50, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, relicIds: [], deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'defend', upgraded: false })) };
  const combat = coop ? createCoopCombat({ registries, rng: createRng(9), players: [{ ...player, id: 'a' }, { ...player, id: 'b' }], enemyIds: ['wanderingSoldier'] }) : createCombat({ registries, rng: createRng(9), player, enemyIds: ['wanderingSoldier'] });
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; }
  return combat;
}
const play = combat => dispatch(combat, { type: 'playCard', cardInstanceId: combat.piles.hand[0].instanceId, targetId: combat.enemies[0].id });

test('preplay target snapshots prevent a card from satisfying its own status and Block conditions', () => {
  const combat = fixture([{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 2 }, { op: 'block', target: 'enemy', amount: 4 }, { op: 'block', target: 'self', amount: 7, if: { p: 'hasStatus', of: 'target', status: 'weak', snapshot: 'beforePlay' } }, { op: 'block', target: 'self', amount: 8, if: { p: 'hasBlock', of: 'target', snapshot: 'beforePlay' } }]);
  play(combat); assert.equal(combat.player.block, 0);
  combat.piles.hand.push({ instanceId: 'second', cardId: 'defend', upgraded: false });
  play(combat); assert.equal(combat.player.block, 15);
});

test('once-per-family bonuses gate copies and reset at the next turn', () => {
  const combat = fixture([{ op: 'block', target: 'self', amount: 2, oncePerTurn: 'grade4' }]);
  play(combat); play(combat); assert.equal(combat.player.block, 2);
  beginAbilityTurn(combat.player); combat.piles.hand.push({ instanceId: 'third', cardId: 'defend', upgraded: false });
  play(combat); assert.equal(combat.player.block, 4);
});

test('HP offerings refuse atomically before random effects, payment, history and events', () => {
  const combat = fixture([{ op: 'damage', target: 'randomEnemy', amount: 2 }, { op: 'loseHp', target: 'self', amount: 50, nonlethal: true, offering: true }]);
  const saved = JSON.stringify(serializeCombatSnapshot(combat)); const rng = combat.rng.getCounters();
  assert.throws(() => play(combat), /nonlethal offering/);
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), saved); assert.deepEqual(combat.rng.getCounters(), rng);
});

test('charges discount the same Mana pool in preview and execution, apply once, and expire', () => {
  const combat = fixture([{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }, { op: 'damage', target: 'enemy', amount: 1 }], { manaCost: 3 });
  grantAbilityCharge(combat.player, { key: 'lesson', damage: 4, manaDiscount: 2, abilityKind: 'spell' });
  const id = combat.piles.hand[0].instanceId;
  const before = JSON.stringify(serializeCombatSnapshot(combat));
  assert.equal(previewCard(combat, id).manaCost, 1); assert.equal(cardPlayCosts(combat, id).mana, 1);
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), before);
  const hp = combat.enemies[0].hp; play(combat);
  assert.equal(combat.enemies[0].hp, hp - 11); assert.equal(combat.player.mana, 19);
  assert.deepEqual(combat.player.abilityRiders.charges, {});
  grantAbilityCharge(combat.player, { key: 'expiry', damage: 1 }); beginAbilityTurn(combat.player);
  assert.deepEqual(matchingAbilityCharges(combat.player, { type: 'skill' }).keys, []);
});

test('chosen discard sees newly drawn cards and saves its paid play and remaining effects', () => {
  const combat = fixture([{ op: 'draw', amount: 2 }, { op: 'discard', amount: 1, choose: true }, { op: 'block', target: 'self', amount: 5 }]);
  const id = combat.piles.hand[0].instanceId; const originallyDrawn = combat.piles.draw[0].instanceId;
  play(combat); assert.equal(combat.pendingAbilityDiscard.count, 1); assert.equal(combat.player.block, 0);
  assert.ok(combat.piles.hand.some(card => card.instanceId === originallyDrawn));
  assert.throws(() => dispatch(combat, { type: 'endTurn' }), /Choose the cards/);
  const saved = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(9, combat.rng.getCounters()), snapshot: saved });
  assert.throws(() => dispatch(restored, { type: 'chooseDiscard', cardInstanceIds: ['missing'] }), /distinct cards/);
  dispatch(restored, { type: 'chooseDiscard', cardInstanceIds: [originallyDrawn] });
  assert.equal(restored.pendingAbilityDiscard, undefined); assert.equal(restored.pendingAbilityPlay, undefined);
  assert.equal(restored.player.block, 5); assert.ok(restored.piles.discard.some(card => card.instanceId === id));
  assert.equal(restored.eventLog.filter(e => e.type === 'cardResolved').length, 1);
  assert.equal(restored.player.abilityRiders.discarded, 1);
});

test('lethal plays finish their draw/discard and resolve exactly once before combatEnd', () => {
  const combat = fixture([{ op: 'damage', target: 'enemy', amount: 2000 }, { op: 'draw', amount: 1 }, { op: 'discard', amount: 1, choose: true }]);
  play(combat); assert.equal(combat.result, null); assert.ok(combat.pendingAbilityDiscard);
  dispatch(combat, { type: 'chooseDiscard', cardInstanceIds: [combat.piles.hand[0].instanceId] });
  assert.equal(combat.result, 'victory');
  const types = combat.eventLog.map(e => e.type); assert.ok(types.indexOf('cardResolved') < types.indexOf('combatEnd'));
});

test('co-op discard belongs to its seat and charges and resolution carry seat ownership', () => {
  const combat = fixture([{ op: 'draw', amount: 1 }, { op: 'discard', amount: 1, choose: true }], { coop: true });
  const owner = combat.players.get('a'); const id = owner.piles.hand[0].instanceId;
  grantAbilityCharge(owner.entity, { key: 'discount', manaDiscount: 1 });
  assert.equal(previewCoopCard(combat, 'a', id).manaCost, 0);
  playCard(combat, 'a', id); assert.equal(combat.pendingAbilityDiscard.playerId, 'a');
  assert.throws(() => endTurn(combat, 'b'), /Choose the cards/);
  assert.throws(() => chooseDiscard(combat, 'b', []), /another player/);
  chooseDiscard(combat, 'a', [combat.players.get('a').piles.hand[0].instanceId]);
  assert.equal(combat.pendingAbilityDiscard, undefined); assert.equal(combat.pendingAbilityPlay, undefined);
  const resolved = combat.eventLog.find(e => e.type === 'cardResolved'); assert.equal(resolved.sourcePlayerId, 'a');
  assert.equal(combat.players.get('a').entity.abilityRiders.discarded, 1);
  assert.equal(combat.players.get('b').entity.abilityRiders.discarded, 0);
});

test('kill predicates retain the actual target status immediately before a fatal hit', () => {
  const combat = fixture([{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }, { op: 'damage', target: 'enemy', amount: 2000 }]);
  play(combat); const event = combat.eventLog.find(e => e.type === 'enemyDied');
  assert.equal(evalPredicate(combat, { p: 'enemyKilledWithStatus', status: 'weak' }, { event }), true);
  assert.equal(evalPredicate(combat, { p: 'hasStatus', of: 'target', status: 'weak', snapshot: 'beforeEvent' }, { event, target: combat.enemies[0] }), true);
});

test('all new numeric rider tokens come from their executable effects', () => {
  const bindings = computeTokenBindings([{ op: 'grantCardCharge', key: 'x', damage: 2, manaDiscount: 1 }, { op: 'removeStatus', status: 'weak', amount: 1 }, { op: 'discard', amount: 2, choose: true }]);
  assert.deepEqual(bindings.map(b => b.token), ['chargeDamage', 'chargeManaDiscount', 'removeStatus', 'discard']);
});

test('preparing property charges affect every first-effect hit and preview without mutating live gates', () => {
  const combat = fixture([{ op: 'damage', target: 'allEnemies', amount: 3, hits: 2 }, { op: 'damage', target: 'enemy', amount: 1 }], { manaCost: 3 });
  combat.propertyMounts[triggerOwnerKey(combat, combat.player)].fixture = { kind: 'feat', id: 'fixture', rules: [{ triggers: [{ on: 'cardPreparing', if: { p: 'all', preds: [{ p: 'eventSourceIsOwner' }, { p: 'turnMetric', metric: 'cardPlaysCombat', atMost: 0 }] }, do: [{ op: 'grantCardCharge', target: 'self', key: 'feat:fixture', damage: 2, damageScope: 'effect', manaDiscount: 3 }] }] }] };
  combat.player.mana = 0;
  const id = combat.piles.hand[0].instanceId; const saved = JSON.stringify(serializeCombatSnapshot(combat));
  const preview = previewCard(combat, id); assert.equal(preview.manaCost, 0); assert.equal(preview.values[0].value, 5);
  assert.equal(JSON.stringify(serializeCombatSnapshot(combat)), saved);
  const hp = combat.enemies[0].hp; play(combat); assert.equal(combat.enemies[0].hp, hp - 11);
  assert.equal(combat.player.abilityRiders.cardPlaysCombat, 1);
});

test('partial strongest status consumption cannot resurrect the consumed magnitude on expiry', () => {
  const combat = fixture([]); const target = combat.player;
  combat.foundation = {};
  combat.emit = (type, payload) => combat.eventLog.push({ type, ...payload });
  const original = combat.registries.statuses;
  combat.registries = { ...combat.registries, statuses: { ...original, get: id => id === 'weak' ? { ...original.get(id), stacking: { mode: 'strongest', cap: 99, duration: 3 } } : original.get(id) } };
  target.statuses.weak = { stacks: 5, applications: [{ sourceId: 'a', value: 5, expires: 1 }, { sourceId: 'b', value: 4, expires: 3 }] };
  removeStatus(combat, target, 'weak', { amount: 2, reason: 'consumed' }); assert.equal(getStacks(target, 'weak'), 3);
  advanceStatusClock(combat, target, 'ownerTurnEnd'); assert.equal(getStacks(target, 'weak'), 3);
});

test('co-op lethal play still awaits its owner choice and resolves before victory', () => {
  const combat = fixture([{ op: 'damage', target: 'enemy', amount: 2000 }, { op: 'draw', amount: 1 }, { op: 'discard', amount: 1, choose: true }], { coop: true });
  playCard(combat, 'a', combat.players.get('a').piles.hand[0].instanceId);
  assert.equal(combat.result, null);
  chooseDiscard(combat, 'a', [combat.players.get('a').piles.hand[0].instanceId]);
  assert.equal(combat.result, 'victory');
  const resolved = combat.eventLog.find(e => e.type === 'cardResolved'); assert.equal(resolved.sourcePlayerId, 'a');
  assert.ok(combat.eventLog.indexOf(resolved) < combat.eventLog.findIndex(e => e.type === 'combatEnd'));
});

test('buildup charges retain independent status filters and augment only the first matching effect', () => {
  const combat = fixture([{ op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }]);
  grantAbilityCharge(combat.player, { key: 'weak', buildup: 2, buildupStatus: 'weak' });
  grantAbilityCharge(combat.player, { key: 'vulnerable', buildup: 3, buildupStatus: 'vulnerable' });
  play(combat); assert.equal(getStacks(combat.enemies[0], 'weak'), 4); assert.equal(getStacks(combat.enemies[0], 'vulnerable'), 4);
});

test('credited proc kills preserve meter contents from before the fatal burst', () => {
  const combat = fixture([{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 1000 }]);
  combat.enemies[0].hp = 1; play(combat);
  const event = combat.eventLog.find(e => e.type === 'enemyDied');
  assert.equal(event.sourceId, combat.player.id);
  assert.equal(evalPredicate(combat, { p: 'enemyKilledWithStatus', status: 'bleed' }, { event }), true);
});

test('all charge numeric fields accept generic formulas and executable resolved balance values', () => {
  const fields = ['damage', 'manaDiscount', 'block', 'heal', 'break', 'buildup'];
  const charge = { op: 'grantCardCharge', target: 'self', key: 'formula', buildupStatus: 'weak', ...Object.fromEntries(fields.map((field, i) => [field, { f: 'add', args: [i, 1] }])) };
  const errors = [];
  validateEffects([charge], 'fixture', { err: (path, msg) => errors.push({ path, msg }), nodeIds: new Set(), ids: { statuses: new Set(['weak']) } });
  assert.deepEqual(errors, []);
  const combat = fixture([charge]); play(combat);
  for (const [i, field] of fields.entries()) assert.equal(combat.player.abilityRiders.charges.formula[field], i + 1);
  const id = combat.piles.hand[0].instanceId; const preview = previewCard(combat, id);
  for (const [i, field] of fields.entries()) assert.equal(preview.tokens[`charge${field[0].toUpperCase()}${field.slice(1)}`], i + 1);
  const literal = fixture([{ op: 'grantCardCharge', target: 'self', key: 'resolved-balance', damage: contentBundle.balance.exposure.siphonMasteryLevel }]);
  play(literal); assert.equal(literal.player.abilityRiders.charges['resolved-balance'].damage, contentBundle.balance.exposure.siphonMasteryLevel);
});

test('explicit-discard predicates exclude overflow and end-turn cleanup even after prior discards', () => {
  const combat = fixture([]);
  for (const reason of ['effect', 'chosen', 'random']) assert.equal(evalPredicate(combat, { p: 'eventDiscardExplicit' }, { event: { type: 'cardDiscarded', reason, explicit: true } }), true);
  for (const reason of ['endTurn', 'handFull', 'overflow']) assert.equal(evalPredicate(combat, { p: 'eventDiscardExplicit' }, { event: { type: 'cardDiscarded', reason } }), false);
  combat.player.abilityRiders.discarded = 1;
  const event = { abilityBefore: { discarded: 0 } };
  assert.equal(evalPredicate(combat, { p: 'turnMetric', metric: 'discarded', atLeast: 1 }, { event }), false);
  assert.equal(evalPredicate(combat, { p: 'turnMetric', metric: 'discarded', atLeast: 1, snapshot: 'current' }, { event }), true);
});
