// Owner ruling 2026-10-28: a Core armament (weapon, armor, shield) levels up three times. Each tier's step is
// +1, +1, +2 (effective bonus 1/2/4), paid 1/2/3 Smithing Stones. Legacy and Current keep the single authored tier.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { gameContent, resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { smithingPlan, commitItemUpgrade } from '../src/model/smithing.js';
import { withGameProfileService, gameProfileEquipmentReceipt } from '../src/model/gameProfileRun.js';
import { itemUpgradeTiers } from '../src/model/itemUpgrades.js';
import '../src/engine/runCombat.js';
import { upgradeTierBonus } from '../engine/kernel/gameConfig.js';

const profile = resolveGameProfile(JSON.parse(readFileSync(new URL('../games/ashenspire/game.json', import.meta.url))));
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const legacyReg = createRegistries(contentBundle);
const WEAPON = 'armament/greatsword';
const candidateOf = (registries, run, itemRef) => smithingPlan(registries, run).candidates.find((row) => row.itemRef === itemRef);
const smithOnce = (run, itemRef) => withGameProfileService(run, 'smith', () => commitItemUpgrade(reg, run, itemRef));

test('the bonus steps are config: tiers 0..3 give 0/1/2/4', () => {
  const equipment = { upgradeBonuses: { tierBonusSteps: [1, 1, 2] } };
  assert.deepEqual([0, 1, 2, 3, 4].map((level) => upgradeTierBonus(equipment, level)), [0, 1, 2, 4, 4]);
  assert.equal(upgradeTierBonus({ upgradeBonuses: {} }, 1), 1, 'no steps configured: one bonus per tier');
});

test('Core weapon: three upgrades at 1/2/3 stones, AR gain +1, +1, +2, and a fourth is refused', () => {
  const run = createRunState({ seed: 73, classId: 'reaver', registries: reg, runId: 'unique-run' });
  run.smithingStones = 6;
  const arGain = [];
  for (const [level, cost, gain] of [[0, 1, 1], [1, 2, 1], [2, 3, 2]]) {
    const candidate = candidateOf(reg, run, WEAPON);
    assert.equal(candidate.currentLevel, level);
    assert.equal(candidate.nextLevel, level + 1);
    assert.equal(candidate.cost, cost, `tier ${level + 1} costs ${cost}`);
    const stones = run.smithingStones;
    const receipt = smithOnce(run, WEAPON);
    assert.equal(receipt.spent, cost);
    assert.equal(run.smithingStones, stones - cost);
    const ar = receipt.changes.find((row) => row.label === 'AR');
    arGain.push(ar.after - ar.before);
    assert.equal(gain, ar.after - ar.before, `tier ${level + 1} adds ${gain} AR`);
  }
  assert.deepEqual(arGain, [1, 1, 2]);
  assert.equal(run.itemUpgradeLevels[WEAPON], 3);
  assert.equal(candidateOf(reg, run, WEAPON), undefined, 'no fourth upgrade is offered');
  assert.throws(() => smithOnce(run, WEAPON), /not an eligible Smithing candidate/);
  assert.equal(run.smithingStones, 0);
});

test('Core: not enough stones refuses the dearer tiers; relics keep their authored cap', () => {
  const run = createRunState({ seed: 74, classId: 'reaver', registries: reg, runId: 'unique-run-2' });
  run.smithingStones = 1;
  run.itemUpgradeLevels = { [WEAPON]: 1 };
  const candidate = candidateOf(reg, run, WEAPON);
  assert.equal(candidate.affordable, false);
  assert.throws(() => smithOnce(run, WEAPON), /Insufficient Smithing Stones/);
  assert.deepEqual(itemUpgradeTiers(reg, 'relic/ember', run).length <= 1, true);
});

test('Core armor budget follows the steps (3 baseline + 1/2/4 points)', () => {
  const run = createRunState({ seed: 75, classId: 'reaver', registries: reg, runId: 'unique-run-3' });
  const gear = gameContent(run, 'gear').find((item) => item.kind === 'armor' && (!item.classes || item.classes.includes(run.class)));
  const id = gear.source?.id || gear.id;
  run.loadout.sets.armor = [id];
  const armorRef = `armor/${run.class}/${id}`;
  const budget = (level) => { run.itemUpgradeLevels = { [armorRef]: level }; return gameProfileEquipmentReceipt(reg, run).sources.find((row) => row.sourceId === armorRef).resolved.budget; };
  const base = budget(0);
  assert.deepEqual([1, 2, 3].map((level) => budget(level) - base), [1, 2, 4]);
});

test('Legacy runs stay capped at one tier for one stone', () => {
  const run = createRunState({ seed: 76, classId: 'reaver', registries: legacyReg });
  run.smithingStones = 9;
  assert.deepEqual([...itemUpgradeTiers(legacyReg, WEAPON)], [1]);
  assert.deepEqual([...itemUpgradeTiers(legacyReg, WEAPON, run)], [1]);
  const candidate = smithingPlan(legacyReg, run).candidates.find((row) => row.itemKind === 'armament');
  assert.equal(candidate.cost, 1);
  run.itemUpgradeLevels = { [candidate.itemRef]: 1 };
  assert.equal(candidateOf(legacyReg, run, candidate.itemRef), undefined, 'no tier 2 is offered');
});
