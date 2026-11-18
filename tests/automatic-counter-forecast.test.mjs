import test from 'node:test';
import assert from 'node:assert/strict';
import { productionBundle } from './helpers/production-bundle.mjs';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
const require = productionBundle();
const { contentBundle } = require('src/content/index.js');
const { createRegistries } = require('src/model/registries.js');
const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = require('src/model/gameProfile.js');
const { createRunState } = require('src/model/state.js');
const { createRng } = require('src/engine/rng.js');
const { createRunCombat } = require('src/engine/runCombat.js');
const { captureEnemyIntent } = require('src/engine/enemyIntentReceipt.js');
const { armCombatCounter } = require('src/engine/combatMatchups.js');
const { dispatch } = require('src/engine/combat.js');
// A three-contact Slash needs two SP, including during its initial forecast.
// Neutral JSON records cross the fixture VM boundary without host prototypes.
const author = JSON.parse(JSON.stringify({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
  characters: { tagRules: { 'tier.minion': { pools: { sp: 4 } } } },
} }), (_key, value) => value && typeof value === 'object' ? Object.assign(Object.create(null), value) : value);
const profile = resolveGameProfile(author);
const base = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const registries = { ...base, enemies: { ...base.enemies, get(id) {
  const def = base.enemies.get(id);
  return id !== 'wanderingSoldier' ? def : { ...def, firstMove: 'slash', moves: { ...def.moves,
    slash: { ...def.moves.slash, damage: 20, hits: 3, tags: [...(def.moves.slash.tags || []), 'finesse'] } } };
} } };
function fixture({ spent = false } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'automatic-counter-forecast' });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  { const { stanceBenefits, ...rest } = combat.fixCoreRules; combat.fixCoreRules = rest; } // pins the pre-Wave-2.5 arithmetic (see tests/legacyStanceRules.mjs)
  // ...and the owner-cycle budget of a fight created before the Counter-stack rule (Wave 2 batch 5 has no budget: every landed covered hit answers while stacks last).
  { const counter = { ...combat.fixCoreRules.counter }; for (const key of ['stackSource', 'returnPerStack', 'consumePerHit', 'decayPerTurn', 'advantageShare', 'stacksPerCard', 'stacksUpgradeBonus', 'stacksMax', 'stacksByCard']) delete counter[key]; combat.fixCoreRules = { ...combat.fixCoreRules, counter }; }
  assert.equal(combat.enemies[0].maxStamina, 3);
  assert.equal(combat.enemies[0].intent.moveId, 'slash');
  for (const entity of [combat.player, ...combat.enemies]) {
    Object.assign(entity, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, ratings: {}, ratingSources: [],
      persistentPoise: { value: 0, max: 0 }, basePrecisionBonus: 1000 });
    delete entity.combatStance; delete entity.combatCounter;
  }
  combat.enemies[0].actorIntentRevealed = true;
  combat.enemies[0].plannedMoves = [];
  combat.player.combatStance = { camp: 'physical', maneuver: 'counter', range: 'melee' };
  armCombatCounter(combat, combat.player, { combatProfile: { camp: 'physical', maneuver: 'counter', range: 'melee' } });
  if (spent) combat.player.combatCounterReturnedCycle = combat.player.combatOwnerCycle || 0;
  return combat;
}

for (const spent of [false, true]) test(`bundled full-action forecast retains the automatic Counter owner-cycle budget (spent=${spent})`, () => {
  const combat = fixture({ spent }), enemy = combat.enemies[0];
  const before = JSON.stringify({ player: combat.player, enemy, queue: combat.queue, log: combat.eventLog, rng: combat.rng.getCounters() });
  const forecast = captureEnemyIntent(combat, enemy);
  // Owner, 2026-11-14: the forecast is the HP lost per hit, the Counter stance and its Block included (what the Counter owner-cycle
  // budget changes); the damageDealt events below are the same numbers. The Core base-damage scale halves the Slash's 20 to 10 a
  // contact; the Counter stance cuts it to 7, and an unspent Counter's Block takes one more off the first hit (owner, 2026-11-17).
  // Owner, 2026-11-18: the enemy side scale takes the 10 to 7 and the Counter stance cuts that to 5; an unspent Counter's Block (a share of the scaled hit,
  // not scaled again) takes one more off the first hit.
  const expected = spent ? [5, 5, 5] : [4, 5, 5];
  assert.deepEqual(Array.from(forecast.hitDamages), expected);
  assert.equal(forecast.totalDamage, expected.reduce((a, b) => a + b, 0));
  assert.equal(forecast.hpLoss, expected.reduce((a, b) => a + b, 0), 'the forecast still knows the real HP loss');
  assert.equal(JSON.stringify({ player: combat.player, enemy, queue: combat.queue, log: combat.eventLog, rng: combat.rng.getCounters() }), before);
  assert.deepEqual(captureEnemyIntent(combat, enemy), forecast);
  primeAccuracyRolls(combat, { count: 3 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const events = combat.eventLog.slice(start);
  assert.deepEqual(Array.from(events.filter(e => e.type === 'damageDealt' && e.sourceId === enemy.id && e.targetId === combat.player.id), e => e.hpLoss), expected);
  assert.equal(events.filter(e => e.type === 'combatCounterTriggered').length, spent ? 0 : 1);
  assert.equal(combat.player.hp, 100 - forecast.hpLoss);
});
