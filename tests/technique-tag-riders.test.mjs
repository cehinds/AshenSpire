// Technique tag riders (design elements-and-tag-mechanics §4.2/§4.3, owner
// decision 11): Precision attacks bypass up to 4 Block (the larger of this and
// Piercing's 2, never the sum); Gorefire attacks apply 1 Burn after HP loss.
// Both resolve with the damage rider, once per action and target, in v1 and v2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatMatchups, combatExpansionMatchups } from '../src/content/combatMatchups.js';
import { createRegistries } from '../src/model/registries.js';
import { combatMatchupRulesProblems, combatExpansionMatchupRulesProblems } from '../src/model/combatTacticsRules.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { prepareMatchupHit, matchupRiderEffects, previewTacticalAction } from '../src/engine/combatMatchups.js';

const registries = createRegistries(contentBundle);
const profile = damageType => ({ camp: 'physical', maneuver: 'attack', damageType });
const carrier = (tags, damageType = 'slashing') => ({ tags, combatProfile: profile(damageType), combatRiderTargets: [] });

function v1Combat(cardId, classId) {
  const combat = createCombat({ registries, rng: createRng(12), enemyIds: ['wanderingSoldier'],
    player: { classId, maxHp: 80, hp: 80, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId, instanceId: 'c', upgraded: false }] } });
  const enemy = combat.enemies[0];
  enemy.hp = enemy.maxHp = 500; enemy.block = 0; enemy.statuses = {};
  delete enemy.combatCounter;
  return { combat, enemy };
}

test('the tables carry the knobs and both validators accept them (and an old table without them)', () => {
  assert.equal(combatMatchups.tagRiders.precision.guardBypass, 4);
  assert.deepEqual({ ...combatMatchups.tagRiders.gorefire }, { status: 'burn', stacks: 1, requiresHpLoss: true });
  assert.equal(combatExpansionMatchups.tagRiders.gorefire.pressure, 4);
  assert.deepEqual(combatMatchupRulesProblems(structuredClone(combatMatchups)), []);
  assert.deepEqual(combatExpansionMatchupRulesProblems(structuredClone(combatExpansionMatchups)), []);
  const old = structuredClone(combatExpansionMatchups); delete old.tagRiders;
  assert.deepEqual(combatExpansionMatchupRulesProblems(old), []);
  const bad = structuredClone(combatExpansionMatchups); bad.tagRiders.gorefire.stacks = 1;
  assert.ok(combatExpansionMatchupRulesProblems(bad).some(problem => /tagRiders\.gorefire\.stacks/.test(problem)));
});

test('v1: Precision bypasses 4 Block once, Precision plus Piercing bypasses 4 (not 6), plain Piercing 2', () => {
  const { combat, enemy } = v1Combat('strike', 'reaver');
  enemy.block = 10;
  assert.equal(prepareMatchupHit(combat, combat.player, enemy, carrier(['precision']), 8).guardBypass, 4);
  assert.equal(prepareMatchupHit(combat, combat.player, enemy, carrier(['precision'], 'piercing'), 8).guardBypass, 4);
  assert.equal(prepareMatchupHit(combat, combat.player, enemy, carrier([], 'piercing'), 8).guardBypass, 2);
  assert.equal(prepareMatchupHit(combat, combat.player, enemy, carrier([]), 8).guardBypass, 0);
  const spent = carrier(['precision']); spent.combatRiderTargets.push(enemy.id);
  assert.equal(prepareMatchupHit(combat, combat.player, enemy, spent, 8).guardBypass, 0, 'once per action and target');
});

test('v1: Gorefire applies 1 Burn after HP loss, once per target, never when the hit is blocked or Burn is printed', () => {
  const { combat, enemy } = v1Combat('strike', 'reaver');
  const gore = carrier(['gorefire']);
  const effects = matchupRiderEffects(combat, combat.player, enemy, gore, { amount: 5, hpLoss: 5 });
  assert.deepEqual(effects, [{ op: 'applyStatus', status: 'bleed', stacks: 1 }, { op: 'applyStatus', status: 'burn', stacks: 1 }]);
  assert.deepEqual(matchupRiderEffects(combat, combat.player, enemy, gore, { amount: 5, hpLoss: 5 }), [], 'budget spent');
  assert.deepEqual(matchupRiderEffects(combat, combat.player, enemy, carrier(['gorefire']), { amount: 5, hpLoss: 0 }), []);
  const printed = { ...carrier(['gorefire'], 'blunt'), appliedStatuses: ['burn'] };
  assert.deepEqual(matchupRiderEffects(combat, combat.player, enemy, printed, { amount: 5, hpLoss: 5 }), [{ op: 'poiseDamage', amount: 2 }]);
});

test('v1 play: Gorefire Slash leaves 1 Burn on the target', () => {
  const { combat, enemy } = v1Combat('gorefireSlash', 'reaver');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  assert.equal(enemy.statuses.burn?.stacks, 1);
});

test('v2: Precision joins Piercing as the larger bypass, Gorefire turns into Burn build-up', () => {
  const ctx = { combatExpansionVersion: 2, registries, combatExpansionRules: { matchups: combatExpansionMatchups } };
  const target = { id: 'e', block: 6, alive: true };
  const bypass = (tags, type) => previewTacticalAction(ctx, {}, target, carrier(tags, type), [{ amount: 10 }]).guardBypass;
  assert.equal(bypass(['precision'], 'slashing'), 4);
  assert.equal(bypass(['precision'], 'piercing'), 4);
  assert.equal(bypass([], 'piercing'), 2);
  assert.equal(bypass([], 'slashing'), 0);
  const effects = matchupRiderEffects(ctx, {}, target, carrier(['gorefire'], 'blunt'), { amount: 5, hpLoss: 5 });
  assert.deepEqual(effects, [{ op: 'poiseDamage', amount: 2 },
    { op: 'buildup', status: 'burn', amount: 4, camp: 'physical', recoveryProfile: 'elemental' }]);
});

// Owner decision #25: Lethal Dose carries Precision, so it bypasses 4 Block like the other Precision cards.
test('v1: Lethal Dose carries the Precision tags and bypasses 4 Block', () => {
  const { combat, enemy } = v1Combat('lethalDose', 'rogue');
  enemy.block = 10;
  const def = registries.cards.get('lethalDose');
  assert.ok(def.tags.includes('precision') && def.tags.includes('technique:precision'), 'Precision tags');
  assert.equal(prepareMatchupHit(combat, combat.player, enemy, carrier(def.tags, 'poison'), 8).guardBypass, 4);
});

test('v1 play: a Precision Piercing card into 10 Block puts 4 through (Piercing alone would put 2), preview equals the hit', () => {
  const { combat, enemy } = v1Combat('coupDeGrace', 'rogue');
  enemy.block = 10;
  const shown = previewCard(combat, 'c', enemy.id).values.find(row => row.op === 'damage');
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c', targetId: enemy.id });
  const hit = combat.eventLog.find(row => row.type === 'damageDealt' && row.targetId === enemy.id);
  assert.equal(hit.amount, shown.value, 'preview equals the hit');
  assert.equal(shown.value, 10);
  assert.equal(500 - enemy.hp, 4, 'Precision bypasses 4 of the Block');
  assert.equal(enemy.block, 4);
});
