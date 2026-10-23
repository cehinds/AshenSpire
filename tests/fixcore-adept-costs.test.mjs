import test from 'node:test';
import assert from 'node:assert/strict';
import { stanceStaminaCost, stanceManaCost, stanceOf } from '../src/model/stanceRules.js';
import { profileCardCosts } from '../src/engine/gameProfileCombat.js';
import { dispatch, cardPlayCosts, previewCard } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { live, baseRegistries, profile } from './helpers/fixcore-combat-rules.mjs';

const physical = { cost: 3, staminaCost: 3, manaCost: 3, type: 'attack', combatProfile: { camp: 'physical', maneuver: 'counter' }, cardTags: ['trait:reaction'] };
const magic = { ...physical, type: 'spell', combatProfile: { camp: 'spell', maneuver: 'casting', range: 'ranged' } };
function unit(classId, card = physical) {
  const player = { id: 'player', kind: 'player', classId, combatStance: stanceOf(card) };
  return { gameProfile: profile, combatExpansionVersion: 2, core2ActionRulesVersion: 1, phase: 'player', player };
}
function native(classId) {
  const run = createRunState({ registries: baseRegistries, classId, seed: 511,
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return createRunCombat({ registries: baseRegistries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
}

test('Adept costs use the equipped class tag, authoritative Spell camp and only its resource lane', () => {
  for (const classId of ['reaver', 'rogue', 'starseer', 'herald', 'missing']) for (const card of [physical, magic]) {
    const ctx = unit(classId, card);
    const martial = ['reaver', 'rogue'].includes(classId) && card === physical;
    const magical = ['starseer', 'herald'].includes(classId) && card === magic;
    assert.deepEqual(profileCardCosts(ctx, card), { energy: martial ? 2 : 3, stamina: martial ? 2 : 3, mana: magical ? 2 : 3 }, `${classId}/${card.type}`);
    ctx.player.classUnequipped = true;
    assert.deepEqual(profileCardCosts(ctx, card), { energy: 3, stamina: 3, mana: 3 });
  }
  const ctx = unit('reaver');
  assert.equal(stanceStaminaCost(3, ctx.player, { ...physical, manaCost: 9 }, ctx, 9), 2, 'MP cost alone does not make a Spell');
});

test('own-turn reduction stops at one, matching enemy reactions reach zero, and authored free lanes stay free', () => {
  for (const [classId, card, cost] of [['reaver', physical, stanceStaminaCost], ['starseer', magic, stanceManaCost]]) {
    const ctx = unit(classId, card);
    assert.equal(cost(1, ctx.player, card, ctx), 1);
    assert.equal(cost(0, ctx.player, card, ctx), 0);
    ctx.phase = 'enemy';
    assert.equal(cost(1, ctx.player, card, ctx), 0);
    assert.equal(cost(3, ctx.player, card, ctx), 2, 'the old generic reaction cut does not stack');
    assert.equal(cost(0, ctx.player, card, ctx), 0);
    assert.equal(cost(1, ctx.player, { ...card, cardTags: [] }, ctx), 1, 'only a reaction earns the zero floor');
    delete ctx.player.combatStance;
    assert.equal(cost(3, ctx.player, card, ctx), 3, 'entering a stance cannot discount that play');
  }
  const ctx = unit('reaver');
  assert.equal(stanceStaminaCost(8, ctx.player, { ...physical, cost: 'X' }, ctx), 8);
});

test('Spell chains retain mirrored cross-stance eligibility and overlap with Adept as one MP cut', () => {
  for (const classId of ['starseer', 'reaver']) {
    const ctx = unit(classId, magic);
    ctx.player.combatStance = { camp: 'spell', maneuver: 'attack', mirrored: true };
    assert.equal(stanceManaCost(3, ctx.player, magic, ctx), 2, 'existing independent chain rule');
    const mirrored = { ...magic, combatProfile: { camp: 'spell', maneuver: 'attack', mirrors: 'attack' } };
    assert.equal(stanceManaCost(3, ctx.player, mirrored, ctx), 2, 'overlap never cuts twice');
  }
});

test('missing policy version retains historical own-turn and reaction prices', () => {
  const ctx = unit('reaver'); delete ctx.core2ActionRulesVersion;
  assert.equal(stanceStaminaCost(3, ctx.player, physical, ctx), 3);
  assert.equal(stanceManaCost(3, ctx.player, physical, ctx), 2);
  ctx.phase = 'enemy';
  assert.equal(stanceStaminaCost(1, ctx.player, physical, ctx), 0);
  ctx.player.classId = 'starseer'; ctx.player.combatStance = stanceOf(magic);
  assert.equal(stanceStaminaCost(3, ctx.player, magic, ctx), 2);
  assert.equal(stanceManaCost(1, ctx.player, magic, ctx), 1);
});

test('native Smash entry, matching preview, affordability and actual payment agree without mutating previews', () => {
  const ctx = live();
  ctx.enemies[0].hp = ctx.enemies[0].maxHp = 1000;
  ctx.piles.hand = ['first', 'second'].map(instanceId => ({ instanceId, cardId: 'core.smash', upgraded: false }));
  ctx.player.stamina = 5;
  assert.equal(cardPlayCosts(ctx, 'first').stamina, 2);
  assert.equal(previewCard(ctx, 'first', ctx.enemies[0].id).staminaCost, 2);
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'first', targetId: ctx.enemies[0].id });
  assert.equal(ctx.player.stamina, 3, 'entry pays the full two SP');
  const before = serializeCombatSnapshot(ctx), counters = ctx.rng.getCounters();
  assert.equal(cardPlayCosts(ctx, 'second').stamina, 1);
  assert.equal(previewCard(ctx, 'second', ctx.enemies[0].id).staminaCost, 1);
  assert.deepEqual(serializeCombatSnapshot(ctx), before);
  assert.deepEqual(ctx.rng.getCounters(), counters);
  ctx.player.stamina = 0;
  assert.throws(() => dispatch(ctx, { type: 'playCard', cardInstanceId: 'second', targetId: ctx.enemies[0].id }), /stamina/i);
  assert.equal(ctx.player.stamina, 0);
  ctx.player.stamina = 1;
  const out = dispatch(ctx, { type: 'playCard', cardInstanceId: 'second', targetId: ctx.enemies[0].id });
  assert.equal(ctx.player.stamina, 0);
  assert.equal(out.events.find(row => row.type === 'cardPlayed').staminaSpent, 1);
});

test('native Frost Counter has a zero-MP matching reaction quote and identical snapshot-resumed payment', () => {
  const ctx = native('starseer');
  ctx.piles.hand = [{ instanceId: 'frost', cardId: 'frostCounter', upgraded: false }];
  ctx.player.combatStance = stanceOf(resolveCombatCard(ctx, ctx.piles.hand[0]));
  ctx.player.stamina = 2; ctx.player.mana = 0;
  assert.deepEqual(cardPlayCosts(ctx, 'frost'), { energy: 1, stamina: 1, mana: 1 }, 'own-turn MP floor is one');
  dispatch(ctx, { type: 'endTurn' });
  const option = ctx.pendingReaction?.options.find(row => row.cardId === 'frostCounter' && row.play.upcastTier === undefined);
  assert.ok(option, 'zero Mana remains affordable during a matching reaction');
  assert.equal(option.staminaCost, 1); assert.equal(option.manaCost, 0);
  const snapshot = serializeCombatSnapshot(ctx);
  const restored = restoreCombatSnapshot({ registries: baseRegistries, snapshot, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), expectedGameProfile: ctx.gameProfile });
  const play = combat => dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: option.id });
  const a = play(ctx), b = play(restored);
  assert.deepEqual(a, b);
  const paid = a.events.find(row => row.type === 'cardPlayed' && row.cardId === 'frostCounter');
  assert.equal(paid.staminaSpent, 1); assert.equal(paid.manaSpent, 0);
  assert.deepEqual(serializeCombatSnapshot(ctx), serializeCombatSnapshot(restored));
});

test('native Magic Adept preview and payment reduce a two-MP spell once while leaving its SP unchanged', () => {
  const ctx = native('starseer');
  ctx.enemies[0].hp = ctx.enemies[0].maxHp = 1000;
  ctx.piles.hand = [{ instanceId: 'gravity', cardId: 'gravityWell', rank: 3, upgraded: false }];
  const def = resolveCombatCard(ctx, ctx.piles.hand[0]);
  assert.equal(def.manaCost, 2);
  assert.equal(cardPlayCosts(ctx, 'gravity').mana, 2, 'entering Casting still pays the full price');
  ctx.player.combatStance = stanceOf(def);
  const sp = ctx.player.stamina;
  assert.deepEqual(cardPlayCosts(ctx, 'gravity'), { energy: 1, stamina: 1, mana: 1 });
  assert.equal(previewCard(ctx, 'gravity', ctx.enemies[0].id).manaCost, 1);
  ctx.player.mana = 0;
  assert.throws(() => dispatch(ctx, { type: 'playCard', cardInstanceId: 'gravity', targetId: ctx.enemies[0].id }), /mana/i);
  assert.equal(ctx.player.stamina, sp);
  ctx.player.mana = 1;
  const result = dispatch(ctx, { type: 'playCard', cardInstanceId: 'gravity', targetId: ctx.enemies[0].id });
  const paid = result.events.find(row => row.type === 'cardPlayed' && row.cardId === 'gravityWell');
  assert.equal(paid.staminaSpent, 1); assert.equal(paid.manaSpent, 1);
  assert.equal(ctx.player.mana, 0); assert.equal(ctx.player.stamina, sp - 1);
});

test('an older active reaction snapshot retains its accepted MP quote and old payment after reload', () => {
  const ctx = native('starseer'); delete ctx.core2ActionRulesVersion;
  ctx.piles.hand = [{ instanceId: 'old-frost', cardId: 'frostCounter', upgraded: false }];
  ctx.player.combatStance = stanceOf(resolveCombatCard(ctx, ctx.piles.hand[0]));
  ctx.player.stamina = 2; ctx.player.mana = 1;
  dispatch(ctx, { type: 'endTurn' });
  const option = ctx.pendingReaction.options.find(row => row.cardId === 'frostCounter');
  assert.equal(option.manaCost, 1);
  const snapshot = serializeCombatSnapshot(ctx);
  const restored = restoreCombatSnapshot({ registries: baseRegistries, snapshot, rng: createRng(ctx.rng.seed, ctx.rng.getCounters()), expectedGameProfile: ctx.gameProfile });
  assert.equal(restored.core2ActionRulesVersion, undefined);
  assert.deepEqual(restored.pendingReaction.options, ctx.pendingReaction.options);
  const result = dispatch(restored, { type: 'chooseReaction', offerId: restored.pendingReaction.id, optionId: option.id });
  assert.equal(result.events.find(row => row.type === 'cardPlayed' && row.cardId === 'frostCounter').manaSpent, 1);
});

test('Mana Surge keeps one SP cost, zero MP cost and its separate two-Mana restore', () => {
  const ctx = native('herald');
  ctx.piles.hand = [{ instanceId: 'surge', cardId: 'core.manaSurge', upgraded: false }];
  ctx.player.combatStance = stanceOf(resolveCombatCard(ctx, ctx.piles.hand[0]));
  ctx.player.stamina = 3; ctx.player.mana = 0;
  assert.deepEqual(cardPlayCosts(ctx, 'surge'), { energy: 1, stamina: 1, mana: 0 });
  dispatch(ctx, { type: 'playCard', cardInstanceId: 'surge' });
  assert.equal(ctx.player.stamina, 2); assert.equal(ctx.player.mana, 2);
});
