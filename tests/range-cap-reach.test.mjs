// Owner, 2026-11-05: "Let's configure max range to be reach." Core caps every engagement band at Reach (1);
// a policy with no maxRange (a run or save from before the cap) keeps all three bands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { bandCap, createRangeState, movedEngagementState, rangePairKey, rangeStateProblems, rangePolicyProblems, snapshotRangePolicy, RANGE_POLICY_DEFAULTS } from '../src/model/combatEngagement.js';
import { displayRange } from '../src/model/combatRanges.js';
import { combatCardRange } from '../src/model/combatCardProfile.js';
import { nextUpgradeOptions } from '../src/model/cardUpgradeLimits.js';
import { mulberry32 } from '../src/engine/rng.js';
import { rollUpgradeOptions } from '../src/model/cardUpgradeSteps.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fight = (enemyId, seed = 511, weaponId = null) => {
  const run = createRunState({ registries, classId: 'reaver', seed });
  if (weaponId) { run.loadout.sets.rightHand[0] = weaponId; run.loadout.sets.leftHand[0] = null; }
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
  combat.player.hp = combat.player.maxHp = 10000;
  return { run, combat };
};
const settle = combat => { for (let k = 0; combat.pendingReaction && k < 50; k++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); };
const P = 'player:player', E = 'enemy:e1';
const noCap = () => { const { maxRange, ...rest } = RANGE_POLICY_DEFAULTS; return rest; };

test('the authored Core policy caps at reach and bandCap reads it', () => {
  const { run } = fight('wanderingSoldier');
  assert.equal(run.rangePolicy.maxRange, 'reach');
  assert.equal(bandCap(run.rangePolicy), 1);
  assert.equal(bandCap(noCap()), 2, 'no maxRange keeps three bands');
  assert.equal(bandCap(snapshotRangePolicy(noCap())), 2, 'the code default is ranged');
  assert.deepEqual(rangePolicyProblems({ ...noCap(), maxRange: 'far' }), ['Invalid range policy']);
});

test('a new Core fight never stores a band above reach, even with a shortbow or a Ranged-start enemy', () => {
  for (const [enemy, weapon] of [['wanderingSoldier', null], ['wanderingSoldier', 'shortbow'], ['eclipseCantor', null], ['ashheartDragon', 'shortbow']]) {
    const { combat } = fight(enemy, 511, weapon);
    for (const band of Object.values(combat.rangeState.engagements)) assert.ok(band <= 1, `${enemy}/${weapon}: band ${band}`);
    assert.deepEqual(rangeStateProblems(combat.rangeState), []);
  }
});

test('a shortbow wearer starts at reach', () => {
  const { combat } = fight('wanderingSoldier', 511, 'shortbow');
  assert.deepEqual(Object.values(combat.rangeState.engagements), [1]);
});

test('Retreat at the cap is a no-op, and below it still moves one band', () => {
  const { combat } = fight('wanderingSoldier');
  const at = movedEngagementState(combat.rangeState, P, E, 1);
  assert.ok(at.engagements[rangePairKey(P, E)] <= 1);
  const reach = { ...combat.rangeState, engagements: { [rangePairKey(P, E)]: 1 } };
  assert.equal(movedEngagementState(reach, P, E, 1).engagements[rangePairKey(P, E)], 1);
  const melee = { ...combat.rangeState, engagements: { [rangePairKey(P, E)]: 0 } };
  assert.equal(movedEngagementState(melee, P, E, 1).engagements[rangePairKey(P, E)], 1);
});

test('a live enemy retreat at reach leaves the pair at reach', () => {
  const { combat } = fight('graveWisp');
  const enemy = combat.enemies[0], key = Object.keys(combat.rangeState.engagements)[0];
  combat.rangeState.engagements[key] = 1;
  enemy.pendingMove = null;
  enemy.intent = { kind: 'buff', moveId: 'retreat' };
  enemy.plannedMoves = [{ moveId: 'retreat', sp: 2 }]; enemy.planDue = true;
  dispatch(combat, { type: 'endTurn' });
  settle(combat);
  assert.equal(combat.rangeState.engagements[key], 1);
});

test('an old policy and engagement state with no maxRange keeps three bands', () => {
  const policy = noCap();
  assert.deepEqual(rangePolicyProblems(policy), []);
  const actors = [{ key: P, startingRange: 'ranged' }, { key: E, startingRange: 'melee' }];
  const state = createRangeState(policy, actors);
  assert.equal(state.engagements[rangePairKey(P, E)], 2);
  assert.deepEqual(rangeStateProblems(state, [P, E]), []);
  assert.equal(movedEngagementState({ ...state, engagements: { [rangePairKey(P, E)]: 1 } }, P, E, 1).engagements[rangePairKey(P, E)], 2);
  const capped = createRangeState({ ...policy, maxRange: 'reach' }, actors);
  assert.equal(capped.engagements[rangePairKey(P, E)], 1);
  assert.deepEqual(rangeStateProblems({ ...capped, engagements: { [rangePairKey(P, E)]: 2 } }, [P, E]), ['Invalid engagement pair'], 'a band above the cap is invalid');
});

test('Core enemy AI never plans a retreat while the fight is at the cap', () => {
  for (const id of ['graveWisp', 'lanternMoth', 'chainScavenger', 'courtSurgeon', 'mirrorScribe', 'blightedValkyrie', 'eclipseCantor', 'ashheartDragon']) {
    for (let i = 0; i < 6; i++) {
      const { combat } = fight(id, 900 + i), enemy = combat.enemies[0];
      const key = Object.keys(combat.rangeState.engagements)[0];
      combat.rangeState.engagements[key] = 1;
      dispatch(combat, { type: 'endTurn' });
      settle(combat);
      assert.equal(combat.rangeState.engagements[key] <= 1, true);
      const moves = [enemy.intent?.moveId, ...(enemy.plannedMoves || []).map(m => m.moveId)];
      if (combat.rangeState.engagements[key] >= 1) assert.ok(!moves.includes('retreat'), `${id}: no retreat at the cap`);
    }
  }
});

test('card labels read the cap: Ranged reads Reach, melee and reach stay, no cap shows as authored', () => {
  assert.equal(displayRange('ranged', 'reach'), 'reach');
  assert.equal(displayRange('reach', 'reach'), 'reach');
  assert.equal(displayRange('melee', 'reach'), 'melee');
  assert.equal(displayRange('ranged', undefined), 'ranged');
  const ranged = { type: 'attack', effects: [{ op: 'damage', amount: 4, target: 'enemy' }], tags: ['maneuver:attack', 'camp:physical', 'range:ranged'] };
  assert.equal(combatCardRange(ranged), 'ranged');
  assert.equal(combatCardRange(ranged, 'reach'), 'reach');
});

test('an upgrade never offers Reach to Ranged under the cap, and still offers Melee to Reach', () => {
  const attack = (range) => ({ id: 't.x', name: 'X', type: 'attack', cost: 1, staminaCost: 1, rarity: 'common', effects: [{ op: 'damage', amount: 4, target: 'enemy' }],
    tags: ['maneuver:attack', 'camp:physical', `range:${range}`] });
  const offers = (range, maxRange) => {
    const seen = new Set();
    for (let seed = 0; seed < 200; seed++) {
      for (const step of rollUpgradeOptions(attack(range), [], 0, mulberry32(seed), { maxRange }, 12)) if (step.k === 'tag' && step.tag?.startsWith('range:')) seen.add(step.tag);
    }
    return seen;
  };
  assert.ok(offers('reach', undefined).has('range:ranged'), 'uncapped control offers reach to ranged');
  assert.ok(!offers('reach', 'reach').has('range:ranged'));
  assert.ok(offers('melee', 'reach').has('range:reach'));
  // The run's own policy is the limit source: nextUpgradeOptions passes it through.
  const { run } = fight('wanderingSoldier');
  const base = attack('reach'), instance = { instanceId: 'i1', cardId: 'core.strike' };
  const ranged = (policy) => { let found = false; for (let seed = 0; seed < 200; seed++) {
    const steps = nextUpgradeOptions({ ...run, seed, rangePolicy: policy }, instance, base, registries, 12, { noAuthored: true });
    if (steps.some(step => step.tag === 'range:ranged')) found = true; } return found; };
  assert.equal(ranged(noCap()), true, 'no cap: the roll can offer ranged');
  assert.equal(ranged(run.rangePolicy), false, 'Core cap: never');
});
