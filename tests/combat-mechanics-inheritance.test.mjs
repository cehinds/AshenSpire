import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { combatMechanics } from '../src/content/generated/combatMechanics.js';
import { ResolveMechanicsTable, EffectiveWitherLimit, EffectiveCostGrowth } from '../src/model/combatMechanics.js';
import { WitherRemaining, Withered, projectCardBehavior } from '../src/engine/cardBehavior.js';
import { ScoreCard } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';

test('compiled combatMechanics resolves parent -> child inheritance with provenance', () => {
  assert.equal(combatMechanics.resolved.wither.enabled, true);
  assert.equal(combatMechanics.resolved.wither.countScope, 'instance');
  assert.equal(combatMechanics.resolved.wither.onLimit, 'exhaust');
  assert.equal(combatMechanics.resolved.wither.maxPlays, 3);
  assert.equal(combatMechanics.inheritedFrom.wither.countScope, 'useLimit');
  assert.equal(combatMechanics.inheritedFrom.wither.maxPlays, undefined);

  assert.equal(combatMechanics.resolved['wither.evade'].onLimit, 'exhaust');
  assert.equal(combatMechanics.inheritedFrom['wither.evade'].onLimit, 'useLimit');

  assert.equal(combatMechanics.resolved['costGrowth.evade'].scope, 'card');
  assert.equal(combatMechanics.resolved['costGrowth.evade'].maxSteps, 3);
  assert.equal(combatMechanics.inheritedFrom['costGrowth.evade'].scope, 'costGrowth.shared');
  assert.equal(combatMechanics.inheritedFrom['costGrowth.evade'].maxSteps, 'costGrowth');
});

test('editing a parent updates all non-overridden children while preserving child overrides', () => {
  const edited = structuredClone(combatMechanics.authored);
  edited.useLimit.enabled = false;
  edited.costGrowth.maxSteps = 5;
  const resolved = ResolveMechanicsTable(edited);

  assert.equal(resolved.resolved.wither.enabled, false);
  assert.equal(resolved.resolved['wither.evade'].enabled, false);
  assert.equal(resolved.resolved['costGrowth.evade'].maxSteps, 5);
  // costGrowth.retreat explicitly authored maxSteps: 3, so it keeps its override.
  assert.equal(resolved.resolved['costGrowth.retreat'].maxSteps, 3);
});

test('ResolveMechanicsTable refuses unknown parents and inheritance cycles by name', () => {
  assert.throws(() => ResolveMechanicsTable({ child: { extends: 'missingParent' } }), /unknown parent 'missingParent'/);
  assert.throws(() => ResolveMechanicsTable({ a: { extends: 'b' }, b: { extends: 'a' } }), /inheritance cycle/);
});

test('Wither N exhausts a copy on its Nth play and respects useLimit.enabled toggle', () => {
  const registries = createRegistries({
    ...contentBundle,
    cards: contentBundle.cards.map(c => c.id === 'strike' ? { ...c, wither: 2 } : c),
  });
  const player = {
    classId: 'reaver', hp: 80, maxHp: 80, mana: 10, maxMana: 10, energyMax: 10, drawPerTurn: 1,
    deck: [{ instanceId: 's1', cardId: 'strike' }], relicIds: [],
  };
  const c = createCombat({ registries, rng: createRng(7), enemyIds: ['wanderingSoldier'], player });
  const enemy = c.enemies[0];
  enemy.hp = enemy.maxHp = 200;
  const inst = c.piles.hand[0];
  const def = registries.cards.get('strike');

  assert.equal(WitherRemaining(c.player, inst, def, c), 2);
  dispatch(c, { type: 'playCard', cardInstanceId: 's1', targetId: enemy.id });
  assert.equal(c.piles.exhaust.length, 0, 'first play discards');
  assert.equal(WitherRemaining(c.player, inst, def, c), 1);

  // Move back to hand for 2nd play
  c.piles.hand.push(c.piles.discard.pop());
  dispatch(c, { type: 'playCard', cardInstanceId: 's1', targetId: enemy.id });
  assert.equal(c.piles.exhaust.length, 1, 'second play exhausts via Wither 2');
  assert.equal(Withered(c.player, inst, def, c), true);
  assert.ok(c.eventLog.some(e => e.type === 'cardExhausted' && e.reason === 'withered'));

  // Turning off parent useLimit disables Wither without touching card definitions
  const disabledAuthored = structuredClone(combatMechanics.authored);
  disabledAuthored.useLimit.enabled = false;
  const disabledCtx = { combatMechanics: ResolveMechanicsTable(disabledAuthored) };
  assert.equal(EffectiveWitherLimit(def, disabledCtx), null);
});

test('costGrowth inherits scope and maxSteps from combatMechanics and respects enabled toggle', () => {
  const def = { id: 'testCard', cost: 1, staminaCost: 1, costGrowth: { scope: 'card', stamina: 1 } };
  const ctx = {
    player: { abilityRiders: { cardUsesCombat: { testCard: 4 }, instanceUsesCombat: {} } },
  };
  const projected = projectCardBehavior(ctx, { instanceId: 'i1', cardId: 'testCard' }, def, { applyGear: false });
  assert.equal(projected.staminaCost, 4, 'capped at inherited maxSteps=3 (1 + 3)');

  const disabledAuthored = structuredClone(combatMechanics.authored);
  disabledAuthored.costGrowth.enabled = false;
  const disabledCtx = { ...ctx, combatMechanics: ResolveMechanicsTable(disabledAuthored) };
  assert.equal(EffectiveCostGrowth(def, disabledCtx), null);
  const projectedOff = projectCardBehavior(disabledCtx, { instanceId: 'i1', cardId: 'testCard' }, def, { applyGear: false });
  assert.equal(projectedOff.staminaCost, 1, 'costGrowth disabled leaves base cost');
});

test('ScoreCard reads Wither and costGrowth through combatMechanics for Score Studio', () => {
  const baseFace = {
    name: 'Probe', cls: 'reaver', rarity: 'common', camp: 'physical', type: 'skill',
    sp: 1, mp: 0, dmg: 0, hits: 0, blk: 12, poise: 0, statuses: [], kw: [], tags: [],
    draw: 0, heal: 0, loseHp: 0, discard: 0, restoreSp: 0, restoreMp: 0, cleanse: 0,
    counter: 0, reflect: 0, pull: 0, move: 0, holdOne: 0, boost: 0, cull: 0, shuffle: 0, copy: 0, attr: 0,
  };
  const witherFace = { ...baseFace, wither: 3 };
  const plainScore = ScoreCard(baseFace, scoring);
  const witherScore = ScoreCard(witherFace, scoring);
  assert.ok(witherScore.raw < plainScore.raw, 'Wither 3 discounts raw power relative to plain card');
  assert.ok(witherScore.parts.wither < 0, 'ScoreCard records a wither part for Score Studio');

  // Turning off useLimit in combatMechanics immediately removes the Wither CP discount
  const offAuthored = structuredClone(combatMechanics.authored);
  offAuthored.useLimit.enabled = false;
  const offScore = ScoreCard(witherFace, scoring, { combatMechanics: ResolveMechanicsTable(offAuthored) });
  assert.equal(offScore.raw, plainScore.raw);

  // Turning on costGrowth surcharge in scoring prices costGrowth cards
  const growthFace = { ...baseFace, costGrowth: { scope: 'card', stamina: 1 } };
  const growthScoring = structuredClone(scoring);
  growthScoring.keywords.costGrowth.surchargeEnabled = true;
  const growthScore = ScoreCard(growthFace, growthScoring);
  assert.ok(growthScore.parts.costGrowth < 0, 'costGrowth discount applies when enabled in Score Studio weights');
});
