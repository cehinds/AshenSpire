// Codex P1 (PR 2164): under Core 2 a Poise break sets combatStance.maneuver = 'staggered' and adds no `staggered`
// status, yet Impale / Executioner / Poise Breaker / Sunderplate / Dread of the Hammer gate on hasStatus 'staggered'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { applyAttackDamage } from '../src/engine/actions.js';
import { applyStatus } from '../src/engine/statuses.js';
import { evalPredicate } from '../src/engine/triggers.js';
import { activeCombatStances, isStaggered } from '../src/engine/concurrentStances.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const carrier = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
// `legacy` (the default) is the Staggered rule a fight saved before Wave 3 keeps (no `poise.breakRule`); `legacy: false` is the shipped
// Broken rule (`poise.breakRule: "broken"`), covered by the twin tests below and by tests/poise-broken.test.mjs.
function live(poise = 2, { legacy = true } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier']});
  if (legacy) combat.fixCoreRules = { ...(combat.fixCoreRules || combat.gameProfile.fixCoreRules), poise: { drain: 'prevented' } };
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  delete target.combatStance; delete target.combatCounter;
  return { combat, target };
}
const breakPoise = (combat, target) => { primeAccuracyRolls(combat); applyAttackDamage(combat, combat.player, target, 10, [], carrier); };
const staggeredPred = { p: 'hasStatus', of: 'target', status: 'staggered' };
const ev = (combat, target, pred = staggeredPred, pctx = {}) => evalPredicate(combat, pred, { owner: combat.player, target, ...pctx });

test('Core: a real Poise break makes hasStatus staggered true with no status; before the break it is false', () => {
  const { combat, target } = live();
  assert.equal(ev(combat, target), false, 'no stance, no status');
  breakPoise(combat, target);
  assert.equal(target.combatStance.maneuver, 'staggered');
  assert.equal(target.statuses.staggered, undefined);
  assert.equal(ev(combat, target), true);
  assert.equal(ev(combat, target, { ...staggeredPred, atLeast: 1 }), true);
  assert.equal(ev(combat, target, { ...staggeredPred, atLeast: 2 }), false, 'the stance counts as one stack');
  assert.equal(ev(combat, target, { p: 'not', pred: staggeredPred }), false);
  assert.equal(ev(combat, target, { p: 'hasStatus', of: 'allEnemies', status: 'staggered' }), true);
  assert.equal(ev(combat, target, { p: 'hasStatus', of: 'target', status: 'vulnerable' }), true, 'other statuses unchanged');
  assert.equal(ev(combat, target, { p: 'hasStatus', of: 'target', status: 'weak' }), false);
});

test('Core: an expired stance no longer counts; other stances do not count', () => {
  const { combat, target } = live();
  breakPoise(combat, target);
  target.combatStance = { ...target.combatStance, maneuver: 'attack' };
  assert.equal(ev(combat, target), false);
  assert.equal(isStaggered(combat, target), false);
  assert.equal(isStaggered(combat, null), false);
});

test('Broken (shipped rule): a real Poise break makes hasStatus staggered true through `broken`, with no stance and no status', () => {
  const { combat, target } = live(2, { legacy: false });
  assert.equal(combat.fixCoreRules.poise.breakRule, 'broken');
  assert.equal(ev(combat, target), false, 'not broken yet');
  breakPoise(combat, target);
  assert.ok(target.broken, 'the break made the target Broken');
  assert.equal(target.statuses.staggered, undefined);
  assert.equal(isStaggered(combat, target), true);
  assert.equal(ev(combat, target), true);
  assert.equal(ev(combat, target, { ...staggeredPred, atLeast: 2 }), false, 'Broken counts as one stack');
  assert.equal(ev(combat, target, { p: 'hasStatus', of: 'target', status: 'weak' }), false);
});

test('Broken (shipped rule): a Staggered stance alone does not count; only Broken does', () => {
  const { combat, target } = live(2, { legacy: false });
  target.combatStance = { maneuver: 'staggered', camp: 'physical', range: 'melee' };
  assert.equal(isStaggered(combat, target), false);
  assert.equal(ev(combat, target), false);
});

test('Current: a staggered status still satisfies the predicate; the stance alone does not apply outside Core 2', () => {
  const { combat, target } = live();
  assert.equal(ev(combat, target), false);
  applyStatus(combat, target, 'staggered', 1);
  assert.equal(ev(combat, target), true);
  const bare = { statuses: {}, combatStance: { maneuver: 'staggered' } };
  assert.equal(evalPredicate({ player: bare, enemies: [], registries: reg }, { p: 'hasStatus', of: 'self', status: 'staggered' }, { owner: bare }), false, 'not Core: stance ignored');
});

test('Executioner: base branch before the break, Broken branch after a real Core Poise break (shipped rule); legacy Staggered still works', () => {
  for (const legacy of [false, true]) {
  const dmg = (stagger) => {
    const { combat, target } = live(2, { legacy });
    // The unbroken target holds no stance (Idle, x1.25 under theme B, 2026-11-17) and the broken one holds Staggered; the comparison is the branch alone.
    delete combat.fixCoreRules.stanceBenefits?.neutral?.damageTakenMultiplier;
    if (stagger) breakPoise(combat, target);
    combat.player.energy = 99; combat.piles.hand.push({ instanceId: 'exec', cardId: 'executioner' });
    primeAccuracyRolls(combat);
    const before = combat.eventLog.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'exec', targetId: target.id });
    return combat.eventLog.slice(before).filter(e => e.type === 'damageDealt' && e.sourceId === 'player').map(e => e.amount);
  };
  const base = dmg(false), broken = dmg(true);
  assert.equal(base.length, 1); assert.equal(broken.length, 1);
  // Authored 10 vs 15 (x1.5, the Broken bonus was nerfed from 25) before scaling; the target also takes Vulnerable x1.25 (legacy Staggered) or the Broken x1.5, so the branch is well past 1.5x.
  assert.ok(broken[0] > base[0] * 1.5, `Broken branch fires (legacy ${legacy}: ${base} -> ${broken})`);
  }
  const card = reg.cards.get('executioner');
  assert.match(card.textTemplate, /If the target is Broken/);
  assert.deepEqual(card.faceTemplate, ['Deal {damage} damage.', 'Broken: deal {damage.2} instead.']);
});

test('Dread of the Hammer: its staggered target gate (before-play snapshot) holds after a Core Poise break', () => {
  const node = JSON.parse(readFileSync(new URL('../content/source/nodeEffects.json', import.meta.url), 'utf8'))['feat:dread-of-the-hammer'];
  const walk = (p) => p.p === 'hasStatus' ? p : (p.preds || []).map(walk).find(Boolean);
  const gate = walk(node.triggers[0].if);
  assert.equal(gate.status, 'staggered'); assert.equal(gate.snapshot, 'beforePlay');
  const { combat, target } = live();
  const snap = () => ({ abilityEntities: { [target.id]: structuredClone(target) }, targetId: target.id, targetStatusesBefore: structuredClone(target.statuses) });
  assert.equal(ev(combat, target, gate, { meta: snap() }), false);
  breakPoise(combat, target);
  assert.equal(ev(combat, target, gate, { meta: snap() }), true);
});
