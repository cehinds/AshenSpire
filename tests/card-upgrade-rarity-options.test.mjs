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

// Element packet (owner, 2026-11-19): the element ADDS a magic packet to the hit; the card stays a physical Attack.
const strike6 = () => melee({ tags: ['camp:physical', 'maneuver:attack', 'classification.attack'] });
const elementSteps = (card, applied = [], limits = {}) => rollMany(card, applied, 1500, limits).filter((s) => s.damageSchool !== undefined);

test('element packet: 75% of the matching damage step, at least 2 / 3 / 6, and it adds damage instead of replacing it', () => {
  const steps = elementSteps(strike6());
  const bySize = (rarity) => steps.filter((s) => (s.r ?? 'common') === rarity);
  for (const [rarity, packet] of [['common', 2], ['uncommon', 3], ['rare', 6]]) {
    assert.ok(bySize(rarity).length, `${rarity} is rolled`);
    assert.ok(bySize(rarity).every((s) => s.packet === packet), `${rarity} Strike 6 packet is ${packet}`);
  }
  // Smash 12 reads +2, +3, +6 and Spell-sized 24 reads +3, +6, +12 (the proposal's table); the cap is +100% of the printed total.
  const smash = melee({ tags: ['camp:physical', 'maneuver:smash', 'classification.attack'], effects: [{ op: 'damage', target: 'enemy', amount: 12 }], cost: 2, staminaCost: 2 });
  assert.deepEqual([...new Set(elementSteps(smash).map((s) => s.packet))].sort((a, b) => a - b), [2, 3, 6]);
  const big = melee({ tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], effects: [{ op: 'damage', target: 'enemy', amount: 24 }] });
  assert.deepEqual([...new Set(elementSteps(big).map((s) => s.packet))].sort((a, b) => a - b), [3, 6, 12]);
  for (const step of steps) {
    const card = applyUpgradeSteps(strike6(), [step]);
    assert.equal(card.effects[0].amount, 6 + step.packet, 'the one damage effect rises by the packet');
    assert.ok(combatProfileFor(card).maneuver === 'attack' && combatProfileFor(card).camp === 'physical', 'still a physical Attack');
    assert.ok(card.tags.includes(`damage:${step.damage}`) && card.tags.includes(step.tag), 'the damage and school tags are the magic trait');
    assert.ok(Math.abs(card.magicShare - step.packet / (6 + step.packet)) < 1e-12, 'magic share = packet over the whole hit');
    assert.equal(upgradeStepsProblems({ upgraded: true, upgradeSteps: [step] }, 'x').length, 0, 'the saved step validates');
  }
});

test('element packet: a later damage step scales both parts in proportion; a held packet is raised, never a second element', () => {
  const step = elementSteps(strike6()).find((s) => s.packet === 2 && s.damageSchool === 'fire') || { k: 'tag', tag: 'school:fire', damage: 'fire', damageSchool: 'fire', packet: 2 };
  const once = applyUpgradeSteps(strike6(), [step]);
  const grown = applyUpgradeSteps(strike6(), [step, { k: 'dmg', n: 4 }]);
  assert.equal(grown.effects[0].amount, 12);
  assert.equal(grown.magicShare, once.magicShare, 'the share is unchanged, so the packet grows with the hit');
  const raised = elementSteps(strike6(), [step]);
  assert.ok(raised.length, 'a card holding a packet is offered to raise it');
  assert.ok(raised.every((s) => s.damageSchool === 'fire'), 'only its own element');
  const twice = applyUpgradeSteps(strike6(), [step, raised[0]]);
  assert.equal(twice.effects[0].amount, 6 + 2 + raised[0].packet);
  assert.equal(twice.damageSchool, 'fire');
  assert.deepEqual(twice.tags.filter((t) => t.startsWith('damage:')), ['damage:fire'], 'one element only');
});

test('element packet: a chosen physical type stays the physical part; spells, counters and typed attack blocks are not offered it; a saved whole-hit step still plays whole', () => {
  const blunt = { k: 'tag', damage: 'blunt' };
  const fire = { k: 'tag', tag: 'school:fire', damage: 'fire', damageSchool: 'fire', packet: 2 };
  assert.equal(applyUpgradeSteps(strike6(), [blunt, fire]).physicalDamageType, 'blunt');
  assert.equal(elementSteps(melee({ tags: ['camp:spell', 'maneuver:attack', 'classification.attack'], damageSchool: 'magic' })).length, 0, 'spell');
  assert.equal(elementSteps(melee({ tags: ['camp:physical', 'maneuver:counter', 'classification.attack'] })).length, 0, 'counter');
  assert.equal(elementSteps(strike6(), [fire, { k: 'tag', damage: 'blunt' }]).filter((s) => s.damageSchool !== 'fire').length, 0);
  const legacy = applyUpgradeSteps(strike6(), [{ k: 'tag', tag: 'school:fire', damage: 'fire', damageSchool: 'fire', magicShare: 1 }]);
  assert.equal(legacy.magicShare, 1, 'a step saved before packets keeps its whole-hit conversion');
  assert.equal(legacy.effects[0].amount, 6);
  assert.equal(elementSteps(strike6(), [{ k: 'tag', tag: 'school:fire', damage: 'fire', damageSchool: 'fire', magicShare: 1 }]).length, 0, 'and offers no packet on top');
});
