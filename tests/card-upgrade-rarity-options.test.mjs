// Upgrade rarity, wave 2 (owner, 2026-11-19; docs/balance/buff-drawbacks-proposal-2026-11-19.md sections 6 to 11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rollUpgradeOptions, upgradeStepRng, UPGRADE_KIND_WEIGHTS, upgradeRarityOdds, upgradeCategoryOf, UPGRADE_VENDORS } from '../src/model/cardUpgradeSteps.js';
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

// Vendors (proposal section 11): category weights over the kinds, then the category's own rarity odds.
const vendorMix = (card, vendor, { n = 4000, applied = [] } = {}) => {
  const mix = { physical: 0, magic: 0, neutral: 0, rare: 0, own: 0, total: 0 };
  for (let i = 0; i < n; i += 1) {
    const [step] = rollUpgradeOptions(card, applied, applied.length, upgradeStepRng(i, 'vend', applied.length), vendor ? { vendor } : {}, 1);
    if (!step) continue;
    const kind = step.k === 'fx' ? `fx:${step.fx}` : step.k === 'tag' ? (step.damageSchool ? 'element' : step.damage ? 'dmgType' : step.tag?.startsWith('range:') ? 'range' : step.tag?.startsWith('targeting:') ? 'targeting' : step.tag?.startsWith('maneuver:') ? 'maneuver' : 'rankDown')
      : step.k === 'combo' ? 'combo' : step.k;
    const cat = kind === 'combo' ? 'neutral' : upgradeCategoryOf(kind, kind === 'fx:boost' ? { stat: step.stat } : kind === 'addStatus' ? { statuses: [step.status] } : kind === 'cost' ? { pools: [step.pool || 'sp'] } : {}, card);
    mix[cat] += 1; mix.total += 1;
    if (step.r === 'rare') mix.rare += 1;
  }
  return Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, v / mix.total]));
};

test('vendor odds: the own category rolls rarer than the off category, neutral reads the base table', () => {
  assert.deepEqual(upgradeRarityOdds(1), [70, 25, 5]);
  assert.deepEqual([1, 4, 6, 8].map((n) => upgradeRarityOdds(n, 'own')), [[55, 33, 12], [35, 42, 23], [18, 42, 40], [7, 33, 60]]);
  assert.deepEqual([1, 4, 6, 8].map((n) => upgradeRarityOdds(n, 'off')), [[80, 18, 2], [60, 32, 8], [40, 42, 18], [25, 45, 30]]);
  assert.deepEqual(upgradeRarityOdds(9, 'base'), [10, 40, 50]);
  assert.deepEqual(UPGRADE_VENDORS.blacksmith, { own: 'physical', physical: 3, magic: 0.25, neutral: 1 });
  assert.deepEqual(UPGRADE_VENDORS.arcane, { own: 'magic', physical: 0.25, magic: 3, neutral: 1 });
});

test('vendor: the Blacksmith skews an Attack toward physical kinds and rarer rolls; the Arcane Trader the reverse; no vendor is the base table', () => {
  const card = strike6();
  const base = vendorMix(card, ''), smith = vendorMix(card, 'blacksmith'), arcane = vendorMix(card, 'arcane');
  assert.ok(smith.physical > base.physical + 0.03, `physical ${base.physical} -> ${smith.physical}`);
  assert.ok(smith.magic < base.magic, `magic ${base.magic} -> ${smith.magic}`);
  assert.ok(arcane.magic > base.magic, `magic ${base.magic} -> ${arcane.magic}`);
  assert.ok(arcane.physical < base.physical - 0.03, `physical ${base.physical} -> ${arcane.physical}`);
  assert.ok(smith.rare > base.rare, `rare ${base.rare} -> ${smith.rare}`);
  // Without a vendor the roll is exactly the one before vendors existed: same stream, same step.
  assert.deepEqual(rollMany(card, [], 50), rollMany(card, [], 50, {}));
});

test('vendor: a card with no kind in the vendor category still gets a full list, and neutral rows are the same at both vendors', () => {
  const buff = { id: 't.buff', name: 'Buff', type: 'skill', cost: 1, staminaCost: 1, manaCost: 0, keywords: ['exhaust'], damageSchool: 'physical', tags: ['camp:physical', 'maneuver:defend'],
    effects: [{ op: 'block', target: 'self', amount: 6 }, { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 }] };
  const steps = (vendor) => { const out = []; for (let i = 0; i < 300; i += 1) out.push(...rollUpgradeOptions(buff, [], 0, upgradeStepRng(i, 'b', 0), { vendor }, 3)); return out; };
  assert.ok(steps('arcane').length >= 300, 'the Arcane Trader still lists options for a card with no magic kind');
  const ease = (list) => list.filter((s) => s.k === 'fx' && s.fx === 'unexhaust').length / list.length;
  assert.ok(Math.abs(ease(steps('arcane')) - ease(steps('blacksmith'))) < 0.12, 'ease kinds are neutral at both vendors');
});

test('the Blacksmith plans its upgrade with the vendor, and a committed quote keeps it', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { registries } = await import('./helpers/fixcore-combat-rules.mjs');
  const { planCardUpgrade, commitCardUpgrade } = await import('../src/model/cardUpgradeService.js');
  const run = createRunState({ registries, classId: 'reaver', seed: 77, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  run.smithingStones = 9;
  const card = run.deck.find((c) => c.cardId === 'core.strike');
  const quote = planCardUpgrade(run, registries, card.instanceId, { choices: 3, vendor: 'blacksmith' });
  assert.equal(quote.vendor, 'blacksmith');
  assert.equal(planCardUpgrade(run, registries, card.instanceId, { choices: 3 }).vendor, undefined, 'a rest-site quote has none');
  const receipt = commitCardUpgrade(run, registries, { ...quote, step: quote.options[1].step });
  assert.deepEqual(receipt.step, quote.options[1].step, 'the commit re-plans with the same vendor and finds the chosen step');
});
