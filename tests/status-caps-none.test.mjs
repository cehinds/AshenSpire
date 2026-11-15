// Owner, 2026-11-15: "nothing should have a max stack count". A fight created under `statusCaps: "none"` holds any number of stacks of any status;
// a fight saved without the key keeps every old cap (expanded active statuses 3, Shock 10, Reflect 10). Per-grant amounts are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight } from './elementFixture.mjs';
import { applyStatus, getStacks } from '../src/engine/statuses.js';
import { applyStatusPressure } from '../src/engine/combatStatusControl.js';
import { combatStatusRules } from '../src/content/combatStatusRules.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { StatusCapsLifted, validateFixCoreRules } from '../src/model/fixCoreMechanics.js';
import { statusLifecycleText } from '../src/ui/statusLifecycle.js';

const ACTIVE = Object.values(combatStatusRules.statuses).map(row => row.activeStatus);
const FIRE = { combatProfile: { camp: 'spell', school: 'fire', damageType: 'fire', magicShare: 1 }, tags: ['school:fire'], magicShare: 1 };

test('the shipped rules carry statusCaps none and the validator accepts only that value (or no key)', () => {
  const { combat } = fight();
  assert.equal(combat.fixCoreRules.statusCaps, 'none');
  assert.equal(StatusCapsLifted(combat), true);
  assert.doesNotThrow(() => validateFixCoreRules(combat.fixCoreRules));
  assert.throws(() => validateFixCoreRules({ ...combat.fixCoreRules, statusCaps: 3 }), /statusCaps/);
  const old = fight({ oldCaps: true }).combat;
  assert.equal(StatusCapsLifted(old), false);
  assert.doesNotThrow(() => validateFixCoreRules(old.fixCoreRules));
});

test('every expanded active status holds more than its old cap of 3 when applied directly', () => {
  for (const id of ACTIVE) {
    const { combat, enemy, player } = fight();
    applyStatus(combat, enemy, id, 8, player);
    applyStatus(combat, enemy, id, 8, player);
    assert.ok(getStacks(enemy, id) > 3, `${id} holds ${getStacks(enemy, id)}`);
  }
});

test('the same applications stop at the old cap of 3 in a fight saved without statusCaps (legacy twin)', () => {
  for (const id of ACTIVE) {
    // Burn has had no cap under the element rules since 2026-11-14, so its old cap of 3 is checked in a fight without them.
    const { combat, enemy, player } = fight(id === 'burn' ? { legacy: true } : { oldCaps: true });
    // A status the Core 2 rules override (Weak, Vulnerable) never reached the expanded cap there: the cap only lives in non-FixCore fights.
    if (combat.fixCoreRules.statuses.overrides?.[id]) continue;
    applyStatus(combat, enemy, id, 8, player);
    applyStatus(combat, enemy, id, 8, player);
    assert.ok(getStacks(enemy, id) <= 3, `${id} holds ${getStacks(enemy, id)}`);
  }
});

test('build-up keeps converting into stacks past 3 under the rule and stops at 3 in an old fight', () => {
  const row = combatStatusRules.statuses.venom;
  const units = row.initialThreshold + row.activeThreshold * 9;
  const open = enemy => { enemy.poiseMeter = { value: 0, max: 0 }; delete enemy.persistentWard; };
  const now = fight();
  open(now.enemy);
  applyStatusPressure(now.combat, now.enemy, 'venom', units, now.player);
  assert.ok(getStacks(now.enemy, 'venom') > 3, `venom ${getStacks(now.enemy, 'venom')}`);
  const old = fight({ oldCaps: true });
  open(old.enemy);
  applyStatusPressure(old.combat, old.enemy, 'venom', units, old.player);
  assert.equal(getStacks(old.enemy, 'venom'), 3);
});

test('Burn at 40 stacks: the shown +5% per stack is what lands (shown = dealt)', () => {
  const { combat, enemy, player } = fight();
  const plain = profileDamageReceipt(combat, player, enemy, 100, { ...FIRE, skipRatingBonus: true }, { roll: 0 }).hpLoss;
  applyStatus(combat, enemy, 'burn', 40, player);
  assert.equal(getStacks(enemy, 'burn'), 40);
  const receipt = profileDamageReceipt(combat, player, enemy, 100, { ...FIRE, skipRatingBonus: true }, { roll: 0 });
  const stage = receipt.damageReceipt.hits[0].sources.find(row => row.id === 'element-burn');
  assert.equal(stage.multiplier, 3, '1 + 0.05 x 40');
  assert.equal(receipt.hpLoss, Math.floor(plain * 3));
});

test('the status tooltip states no cap under the rule and names the cap in an old fight', () => {
  const def = { id: 'venom', name: 'Venom', stackMode: 'add', decay: 'none' };
  const ctx = fight().combat, old = fight({ oldCaps: true }).combat;
  const pick = combat => ({ combatExpansionVersion: 2, fixCoreRules: combat.fixCoreRules, registries: combat.registries });
  assert.doesNotMatch(statusLifecycleText(def, pick(ctx)), /up to \d+/);
  assert.match(statusLifecycleText(def, pick(old)), /up to 3/);
});
