// Upgrade rarity, wave 2 (owner, 2026-11-19; docs/balance/buff-drawbacks-proposal-2026-11-19.md sections 6 to 11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollUpgradeOptions, upgradeStepRng, UPGRADE_KIND_WEIGHTS } from '../src/model/cardUpgradeSteps.js';
import { applyUpgradeSteps, upgradeStepsProblems } from '../src/model/cardUpgrade.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const byId = (id) => cards.find((c) => c.id === id);
const rollMany = (card, applied = [], n = 600, limits = {}) => {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(...rollUpgradeOptions(card, applied, applied.length, upgradeStepRng(i, 'w2', applied.length), limits, 1));
  return out;
};

test('a Sweep rolls dmg and hits: the gate is allEnemies, not only a single enemy', () => {
  const sweep = byId('core.sweep');
  assert.equal(sweep.effects[0].target, 'allEnemies');
  const steps = rollMany(sweep);
  const dmg = steps.find((s) => s.k === 'dmg');
  assert.ok(dmg, 'a Sweep offers a damage step');
  const after = applyUpgradeSteps(sweep, [dmg]);
  assert.equal(after.effects[0].target, 'allEnemies');
  assert.equal(after.effects[0].amount, 4 + dmg.n, 'the step raises the damage each target takes');
  // Core Sweep pays 1 SP, below a two-hit card's SP floor, so hits is judged on a 2 SP sweep.
  const wide = { ...sweep, id: 't.wide', cost: 2, staminaCost: 2, effects: [{ op: 'damage', target: 'allEnemies', amount: 6 }] };
  const hits = rollMany(wide).find((s) => s.k === 'hits');
  assert.ok(hits, 'a 2 SP Sweep offers a hits step');
  assert.equal(applyUpgradeSteps(wide, [hits]).effects[0].hits, hits.hits);
  assert.equal(applyUpgradeSteps(wide, [hits]).effects[0].target, 'allEnemies');
});

test('range weighs 3, half its old 6 (a Reach hit skips the Advance SP and gains Precision)', () => {
  assert.equal(UPGRADE_KIND_WEIGHTS.range, 3);
  assert.equal(UPGRADE_KIND_WEIGHTS.targeting, 6, 'the other identity kinds keep their weight');
});

// dmgType: a melee, non-spell, non-elemental attack, smash or sweep may change its physical type, once per card (saved as a `tag` step with `damage`).
const PHYSICAL = ['slashing', 'piercing', 'blunt'];
const melee = (extra = {}) => ({ id: 't.melee', name: 'Melee', type: 'attack', cost: 1, staminaCost: 1, manaCost: 0, keywords: [], damageSchool: 'physical',
  tags: ['camp:physical', 'maneuver:attack', 'classification.attack', 'damage:slashing'], effects: [{ op: 'damage', target: 'enemy', amount: 6 }], ...extra });
const typeSteps = (card, applied = []) => rollMany(card, applied, 800).filter((s) => s.k === 'tag' && s.damage !== undefined && s.tag === undefined);

test('dmgType: a melee physical attack, smash and sweep roll a different physical type, stored as a tag step', () => {
  for (const maneuver of ['attack', 'smash', 'sweep']) {
    const card = melee({ tags: ['camp:physical', `maneuver:${maneuver}`, 'classification.attack', 'damage:slashing'], ...(maneuver === 'sweep' ? { effects: [{ op: 'damage', target: 'allEnemies', amount: 4 }] } : {}) });
    const steps = typeSteps(card);
    assert.ok(steps.length, `${maneuver} rolls dmgType`);
    for (const step of steps) {
      assert.ok(['piercing', 'blunt'].includes(step.damage), 'never the type it already has');
      assert.deepEqual(Object.keys(step).filter((k) => !['k', 'damage', 'r'].includes(k)), [], 'a plain tag step with no tag field');
      const after = applyUpgradeSteps(card, [step]);
      assert.equal(combatProfileFor(after).damageType, step.damage, 'the engine reads the new type');
      assert.deepEqual(after.tags.filter((t) => t.startsWith('damage:')), [`damage:${step.damage}`]);
      assert.equal(upgradeStepsProblems({ upgraded: true, upgradeSteps: [step] }, 'x').length, 0, 'the saved step validates');
    }
  }
  const kinds = new Set(typeSteps(melee()).map((s) => s.damage));
  assert.deepEqual([...kinds].sort(), ['blunt', 'piercing'], 'both other types are reachable');
});

test('dmgType: a weapon card may change away from its weapon, and it is offered once', () => {
  const weapon = melee({ tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], attack: { weaponDamage: true, components: [{ type: 'slashing', weight: 1 }] } });
  const step = typeSteps(weapon).find((s) => s.damage === 'blunt');
  assert.ok(step, 'a weapon card rolls it');
  const after = applyUpgradeSteps(weapon, [step]);
  assert.equal(after.attack.weaponDamage, undefined, 'the weapon block goes');
  assert.equal(combatProfileFor(after).damageType, 'blunt');
  assert.equal(typeSteps(weapon, [step]).length, 0, 'once per card');
});

test('dmgType: never on a spell, an elemental hit, a Reach card or a counter', () => {
  assert.equal(typeSteps(melee({ tags: ['camp:spell', 'maneuver:attack', 'classification.attack'], damageSchool: 'magic' })).length, 0, 'spell');
  assert.equal(typeSteps(melee({ tags: ['camp:physical', 'maneuver:attack', 'classification.attack', 'damage:fire'] })).length, 0, 'elemental tag');
  assert.equal(typeSteps(melee({ tags: ['camp:physical', 'maneuver:attack', 'classification.attack', 'damage:slashing', 'range:reach'] })).length, 0, 'Reach');
  assert.equal(typeSteps(melee({ tags: ['camp:physical', 'maneuver:counter', 'classification.attack', 'damage:slashing'] })).length, 0, 'counter');
  assert.equal(typeSteps(melee({ type: 'skill', tags: ['camp:physical', 'maneuver:defend', 'damage:slashing'], effects: [{ op: 'block', target: 'self', amount: 6 }] })).length, 0, 'defend');
  assert.ok(PHYSICAL.length === 3);
});
