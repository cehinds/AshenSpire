import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { RetreatRulesActive, validateFixCoreRules } from '../src/model/fixCoreMechanics.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { previewCard, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { SetEnemyRow, RetreatStacks } from '../src/engine/bandRows.js';
import { applyStatus } from '../src/engine/statuses.js';
import { ProjectRetreatRuleFace } from '../src/model/retreatRuleFaces.js';
import { playingCardDefinition } from '../src/model/playingCard.js';
import { quoteRangeActions, acceptRangeActions } from '../src/engine/combatEngagement.js';

const archived = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}-profile.json.gz`, import.meta.url))));
function fight(profile = resolveGameProfile('default')) {
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId: 'reaver', seed: 713 });
  const combat = createRunCombat({ registries, run, rng: createRng(713), enemyIds: ['wanderingSoldier'] });
  dispatch(combat, { type: 'setReactions', enabled: false });
  combat.player.stamina = combat.player.energy = combat.player.mana = 100;
  combat.player.combatStance = { maneuver: 'neutral', camp: 'physical', range: 'melee' };
  combat.piles.hand = ['core.strike', 'core.smokeVeil', 'core.retreat', 'dodgeRoll', 'backstep'].map((cardId, i) => ({ cardId, instanceId: `compat-${i}`, upgraded: false }));
  return combat;
}
const quote = (combat, i) => previewCard(combat, `compat-${i}`, i < 2 ? combat.enemies[0].id : undefined).cost;

test('Retreat opt-in uses the complete saved policy, including explicit absence and zero', () => {
  const gameProfile = { modules: { effects: { retreatRulesVersion: 1 } } };
  assert.equal(RetreatRulesActive({ gameProfile }), true);
  for (const fixCoreRules of [{}, { retreatRulesVersion: 0 }]) assert.equal(RetreatRulesActive({ gameProfile, fixCoreRules }), false);
  assert.equal(RetreatRulesActive({ gameProfile, fixCoreRules: { retreatRulesVersion: 1 } }), true);
  assert.equal(RetreatRulesActive({ gameProfile: { modules: { effects: {} } } }), false);
  const rules = fight().fixCoreRules;
  assert.throws(() => validateFixCoreRules({ ...rules, retreatRulesVersion: 2 }), /retreatRulesVersion/);
});

for (const policy of ['absent', 0, 1]) test(`saved Retreat policy ${policy} keeps its pricing and spending through restore`, () => {
  const combat = fight(), enemy = combat.enemies[0];
  assert.equal(combat.gameProfile.modules.effects.retreatRulesVersion, 1);
  if (policy === 'absent') delete combat.fixCoreRules.retreatRulesVersion;
  else combat.fixCoreRules.retreatRulesVersion = policy;
  const nearStrike = quote(combat, 0), nearStatus = quote(combat, 1);
  SetEnemyRow(combat, enemy, 'back', 'fixture');
  applyStatus(combat, enemy, 'retreat', 3, null);
  applyStatus(combat, combat.player, 'retreat', 2, null);
  assert.equal(quote(combat, 0), nearStrike + (policy === 1 ? 5 : 1), 'only the opted-in fight prices each stack on both sides');
  assert.equal(quote(combat, 1), nearStatus + (policy === 1 ? 0 : 1), 'status-only Reach is versioned independently of rows');
  const snapshot = serializeCombatSnapshot(combat), savedRules = structuredClone(snapshot.fixCoreRules);
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(713, combat.rng.getCounters()), snapshot, expectedGameProfile: combat.gameProfile });
  assert.deepEqual(restored.fixCoreRules, savedRules);
  assert.equal(quote(restored, 0), quote(combat, 0));
  dispatch(restored, { type: 'playCard', cardInstanceId: 'compat-0', targetId: enemy.id });
  assert.equal(RetreatStacks(restored.player), policy === 1 ? 0 : 2);
  assert.equal(RetreatStacks(restored.enemies[0]), policy === 1 ? 0 : 2, 'legacy Advance spends its original single enemy stack');
});

for (const policy of ['absent', 0, 1]) test(`enemy Advance retains the saved ${policy} Retreat policy`, () => {
  const combat = fight(), enemy = combat.enemies[0];
  if (policy === 'absent') delete combat.fixCoreRules.retreatRulesVersion;
  else combat.fixCoreRules.retreatRulesVersion = policy;
  SetEnemyRow(combat, enemy, 'back', 'fixture');
  applyStatus(combat, enemy, 'retreat', 3, null);
  applyStatus(combat, combat.player, 'retreat', 2, null);
  enemy.fixCoreStaminaRemaining = enemy.stamina = 100;
  const carrier = { id: 'versioned-enemy-contact', combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
  const actions = [{ source: enemy, owner: enemy, target: combat.player, card: carrier, effect: { op: 'damage', target: 'player', amount: 1 }, meta: {} }];
  const plan = quoteRangeActions(combat, enemy, actions, { preview: true });
  assert.equal(plan.advanceSp, policy === 1 ? 5 : 1);
  acceptRangeActions(combat, enemy, actions, carrier, 'versioned-enemy-root');
  assert.equal(100 - enemy.fixCoreStaminaRemaining, plan.advanceSp);
  assert.equal(RetreatStacks(enemy), policy === 1 ? 0 : 2);
  assert.equal(RetreatStacks(combat.player), policy === 1 ? 0 : 2);
  assert.equal(enemy.row, policy === 1 ? 'front' : 'back');
});

for (const name of ['dev-0b11a358', 'retreat-54d43945']) test(`genuine ${name} retains its pinned Core card definitions and saved full rules`, () => {
  const profile = archived(name), original = structuredClone(profile), combat = fight(profile);
  const rules = JSON.parse(readFileSync(new URL(`./fixtures/${name}-rules.json`, import.meta.url)));
  assert.equal(Object.hasOwn(profile.modules.effects, 'retreatRulesVersion'), false);
  for (const id of ['core.retreat', 'core.backstep', 'core.hitAndRun', 'core.galePush']) {
    const pinned = profile.content.cards.find(card => card.id === id), actual = combat.registries.cards.get(id);
    assert.deepEqual(actual.keywords, pinned.keywords, `${id} lifecycle belongs to the saved definition`);
    assert.equal(actual.manaCost, pinned.manaCost);
    assert.deepEqual(actual.effects.map(effect => [effect.op, effect.status]), pinned.effects.map(effect => [effect.op, effect.status]));
  }
  const snapshot = serializeCombatSnapshot(combat); snapshot.fixCoreRules = structuredClone(rules);
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(713), snapshot, expectedGameProfile: profile });
  assert.deepEqual(restored.fixCoreRules, rules);
  assert.equal(RetreatRulesActive(restored), false);
  assert.equal(quote(restored, 2), profile.content.cards.find(card => card.id === 'core.retreat').staminaCost);
  assert.deepEqual(profile, original);
});

test('the genuine Dev 213 global Rogue fallback retains its original Exhaust policy', () => {
  const combat = fight(archived('dev-0b11a358'));
  assert.equal(combat.registries.cards.get('backstep').keywords.includes('exhaust'), false);
  const preview = previewCard(combat, 'compat-4');
  assert.equal(preview.resolvedDefinition.keywords.includes('exhaust'), false);
});

test('authored version faces are idempotent and retain both directions without mutating their source', () => {
  const definition = { id: 'synthetic', keywords: ['retain'], textTemplate: 'Current.',
    retreatRuleFaces: { legacy: { keywords: ['retain'], textTemplate: 'Legacy.' }, current: { keywords: ['retain', 'exhaust'], textTemplate: 'Current.' } } };
  const before = structuredClone(definition), old = { fixCoreRules: {} }, current = { fixCoreRules: { retreatRulesVersion: 1 } };
  const projected = ProjectRetreatRuleFace(definition, old);
  assert.deepEqual(ProjectRetreatRuleFace(projected, old), projected);
  assert.deepEqual(ProjectRetreatRuleFace(ProjectRetreatRuleFace(projected, current), old), projected);
  assert.deepEqual(ProjectRetreatRuleFace(ProjectRetreatRuleFace(definition, current), current), ProjectRetreatRuleFace(definition, current));
  assert.deepEqual(definition, before);
  const ordinary = { id: 'ordinary', keywords: ['exhaust'] };
  assert.equal(ProjectRetreatRuleFace(ordinary, old), ordinary, 'unversioned Exhaust remains authoritative');
});

for (const order of [[0, 1, 0], [1, 0, 1]]) test(`the same registry caches upgraded and ranked version faces independently: ${order.join('→')}`, () => {
  const combat = fight();
  for (const policy of order) {
    const context = { ...combat, fixCoreRules: { ...combat.fixCoreRules, retreatRulesVersion: policy } };
    const upgradedDodge = resolveCard(combat.registries, { cardId: 'dodgeRoll', upgraded: true }, undefined, context);
    assert.equal(Boolean(upgradedDodge.choiceModes.find(mode => mode.id === 'retreat').costGrowth), policy === 1);
    const ranked = resolveCard(combat.registries, { cardId: 'backstep', rank: 2 }, undefined, context);
    assert.equal(ranked.keywords.includes('exhaust'), policy === 1);
    assert.equal(resolveCard(combat.registries, { cardId: 'backstep', upgraded: true, upgradeSteps: [{ k: 'fx', fx: 'unexhaust' }] }, undefined, context).keywords.includes('exhaust'), false);
  }
});

for (const profileIsCurrent of [false, true]) for (const savedPolicy of [0, 1]) {
  test(`profile ${profileIsCurrent ? 'current' : 'Dev 213'} with saved policy ${savedPolicy} projects live and outside-combat faces before upgrades`, () => {
    const combat = fight(profileIsCurrent ? resolveGameProfile('default') : archived('dev-0b11a358'));
    combat.fixCoreRules.retreatRulesVersion = savedPolicy;
    const rulesBefore = structuredClone(combat.fixCoreRules), registryBefore = structuredClone(combat.registries.cards.get('backstep'));
    const ref = { cardId: 'backstep', upgraded: false };
    const outside = playingCardDefinition(combat.registries, ref, { rules: combat });
    assert.equal(outside.keywords.includes('exhaust'), savedPolicy === 1);
    assert.equal(previewCard(combat, 'compat-4').resolvedDefinition.keywords.includes('exhaust'), savedPolicy === 1);
    assert.equal(playingCardDefinition(combat.registries, { ...ref, upgraded: true, upgradeSteps: [{ k: 'fx', fx: 'unexhaust' }] }, { rules: combat }).keywords.includes('exhaust'), false, 'the actual drawback-removal upgrade removes Exhaust after policy projection');
    assert.deepEqual(combat.fixCoreRules, rulesBefore);
    assert.deepEqual(combat.registries.cards.get('backstep'), registryBefore);
    const instance = combat.piles.hand.find(card => card.instanceId === 'compat-3');
    const costs = [];
    for (let use = 0; use < 3; use++) {
      if (!combat.piles.hand.includes(instance)) {
        combat.piles.discard = combat.piles.discard.filter(card => card.instanceId !== instance.instanceId);
        combat.piles.hand.push(instance);
      }
      const shown = previewCard(combat, instance.instanceId, undefined, undefined, { choice: 'retreat' }).cost;
      const before = combat.player.stamina;
      dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, choice: 'retreat' });
      costs.push(shown);
      assert.equal(before - combat.player.stamina, shown);
    }
    // The same-stance Adept cut has no floor of 1 (owner ruling 2026-11-22, no card has a minimum): from the second play the printed price (1, or 2 and 3 as Retreat grows) loses 1.
    assert.deepEqual(costs, savedPolicy === 1 ? [1, 1, 2] : [1, 0, 0]);
  });
}
