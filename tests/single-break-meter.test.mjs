import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, computeAttackDamage, executeAction } from '../src/engine/actions.js';
import { mountProperties } from '../src/engine/properties.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { advancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { combatSnapshotProblems } from '../src/model/combatSnapshot.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { validateContent } from '../src/model/validate.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { breakPropertyText } from '../src/model/breakMeter.js';

const magic = { damageSchool: 'magic', exposureBuildupPerHit: 5 };
const physical = { damageSchool: 'physical' };
const player = () => ({ classId: 'starseer', hp: 1000, maxHp: 1000, mana: 0, maxMana: 10,
  attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 },
  stamina: 20, maxStamina: 20, energyMax: 20, drawPerTurn: 3, relicIds: [],
  deck: [{ cardId: 'dodgeRoll', instanceId: 'dodge', upgraded: false }] });
function fight({ stamp = 1, ratings = true, enemyIds = ['wanderingSoldier'], tune = null } = {}) {
  const bundle = { ...contentBundle, balance: structuredClone(contentBundle.balance) }; tune?.(bundle);
  const reg = createRegistries(bundle);
  const c = createCombat({ registries: reg, rng: createRng(7), player: player(), enemyIds,
    breakMeterVersion: stamp });
  c.enemies.forEach(e => { e.hp = e.maxHp = 10000; });
  return c;
}
const events = (c, type) => c.eventLog.filter(e => e.type === type);
function mount(c, tag) { mountProperties(c, { kind: 'armament', id: tag, instanceId: tag, ownerKey: 'player', tagIds: [tag] }); }

test('fully Blocked hits cause no impact; explicit Poise damage adds no magical buildup', () => {
  const c = fight(); const e = c.enemies[0]; e.block = 100;
  applyAttackDamage(c, c.player, e, 20, [], magic);
  assert.equal(e.poiseMeter.value, 0); assert.equal(events(c, 'arcaneImpact').length, 0);
  executeAction(c, { source: c.player, owner: c.player, card: magic, effect: { op: 'poiseDamage', target: 'enemy', amount: 2 }, targetId: e.id, meta: {} });
  assert.equal(e.poiseMeter.value, 2); assert.equal(events(c, 'arcaneImpact').length, 0);
});

test('property descriptions follow the stamped run and configured Stagger Break impact', () => {
  const current = createRegistries(configuredContentBundle(contentBundle, advancedConfigSnapshot({ 'gameConfig.balance.exposure.staggerBreakImpact': 4 })));
  assert.equal(breakPropertyText(current, 'staggerBreak'), 'Spell hits gain 4 magical impact.');
  assert.match(breakPropertyText(current, 'staggerBreak', { breakMeterVersion: 0 }), /Arcane Exposure/);
});

test('new-run snapshots stamp the version', () => {
  assert.equal(advancedConfigSnapshot().breakMeterVersion, 1);
});


test('a version-1 break-meter stamp restores and saves again without the retired ratings rules', () => {
  // A save written under version 1 carried ratingsRules; the restore no longer does,
  // so the stamp alone must be legal (Codex regression on #2633).
  const saved = serializeCombatSnapshot(fight({ stamp: 1 }));
  assert.equal(saved.ratingsRules, undefined);
  saved.breakMeterVersion = 1;
  // Version 1 retired these fields (the validator refuses them under the stamp), so a real v1 save lacks them.
  for (const entity of [saved.player, ...saved.enemies]) for (const field of ['wardMeter', 'arcaneExposure', 'wardGuard']) delete entity[field];
  const restored = restoreCombatSnapshot({ registries: createRegistries(contentBundle), rng: createRng(7), snapshot: saved });
  const again = serializeCombatSnapshot(restored);
  assert.equal(again.breakMeterVersion, 1);
  assert.deepEqual(combatSnapshotProblems(again), []);
});
