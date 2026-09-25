// tests/balance-validation-gfr.test.mjs — every balance/config knob the
// game-feel rework added is refused BY NAME at its door when malformed
// (PR #1287 review: a null eliteChest.cinders passed boot and threw mid-run
// when a chest rolled its purse). The shipped bundle and config pass.
import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { validateContent } from '../src/model/validate.js';
import { compileEntries, readConfigTree } from '../tools/config-build.mjs';

const rewards = contentBundle.balance.rewards;
const withRewards = (patch) => ({ ...contentBundle, balance: { ...contentBundle.balance, rewards: { ...rewards, ...patch } } });
const withBalance = (patch) => ({ ...contentBundle, balance: { ...contentBundle.balance, ...patch } });

function refusedAt(bundle, key, label) {
  const result = validateContent(bundle);
  const text = JSON.stringify(result.errors || []);
  assert.ok(!result.ok && text.includes(`"${key}`), `${label}: expected a refusal naming ${key}, got ${text.slice(0, 400)}`);
}

test('the shipped bundle passes', () => {
  const result = validateContent(contentBundle);
  assert.ok(result.ok, JSON.stringify(result.errors));
});

test('balance.rewards.eliteChest: each malformed value is refused by name', () => {
  const chest = rewards.eliteChest;
  const cases = [
    ['balance.rewards.eliteChest', null],
    ['balance.rewards.eliteChest.cinders', { cinders: null }],
    ['balance.rewards.eliteChest.cinders', { cinders: [130, 90] }],
    ['balance.rewards.eliteChest.cinders', { cinders: [90] }],
    ['balance.rewards.eliteChest.cinders', { cinders: [-1, 5] }],
    ['balance.rewards.eliteChest.cinders', { cinders: [1.5, 5] }],
    ['balance.rewards.eliteChest.choices', { choices: 0 }],
    ['balance.rewards.eliteChest.choices', { choices: 2.5 }],
    ['balance.rewards.eliteChest.upgradeOwnedPct', { upgradeOwnedPct: 101 }],
    ['balance.rewards.eliteChest.upgradeOwnedPct', { upgradeOwnedPct: -1 }],
    ['balance.rewards.eliteChest.smithingStones', { smithingStones: -1 }],
    ['balance.rewards.eliteChest.smithingStones', { smithingStones: null }],
    ['balance.rewards.eliteChest.categoryWeights', { categoryWeights: null }],
    ['balance.rewards.eliteChest.categoryWeights', { categoryWeights: { relic: 0, upgrade: 0, armament: 0, cinders: 0 } }],
    ['balance.rewards.eliteChest.categoryWeights.relic', { categoryWeights: { ...chest.categoryWeights, relic: -1 } }],
    ['balance.rewards.eliteChest.categoryWeights.relic', { categoryWeights: { ...chest.categoryWeights, relic: 'x' } }],
    ['balance.rewards.eliteChest.categoryWeights.gold', { categoryWeights: { ...chest.categoryWeights, gold: 5 } }],
    ['balance.rewards.eliteChest.bogus', { bogus: 1 }],
  ];
  for (const [key, patch] of cases) {
    refusedAt(withRewards({ eliteChest: patch === null ? null : { ...chest, ...patch } }), key, JSON.stringify(patch));
  }
});

test('balance.rewards.cardPity: each malformed value is refused by name', () => {
  const pity = rewards.cardPity;
  const cases = [
    ['balance.rewards.cardPity', null],
    ['balance.rewards.cardPity.offsetStart', { offsetStart: 1.5 }],
    ['balance.rewards.cardPity.offsetStart', { offsetStart: 50, offsetMax: 40 }],
    ['balance.rewards.cardPity.offsetMax', { offsetMax: null }],
    ['balance.rewards.cardPity.offsetStep', { offsetStep: -1 }],
    ['balance.rewards.cardPity.offsetStep', { offsetStep: 0.5 }],
    ['balance.rewards.cardPity.rareGuaranteeAfter', { rareGuaranteeAfter: 0 }],
    ['balance.rewards.cardPity.bogus', { bogus: 1 }],
  ];
  for (const [key, patch] of cases) {
    refusedAt(withRewards({ cardPity: patch === null ? null : { ...pity, ...patch } }), key, JSON.stringify(patch));
  }
});

test('boss relic choice and consolation are refused by name', () => {
  for (const v of [0, 1.5, null, '3', undefined]) refusedAt(withRewards({ bossRelicChoices: v }), 'balance.rewards.bossRelicChoices', String(v));
  for (const v of [-1, 2.5, null, undefined]) refusedAt(withRewards({ bossRelicConsolationCinders: v }), 'balance.rewards.bossRelicConsolationCinders', String(v));
});

test('weaponScaling and weaponArtCharge keep their existing refusals', () => {
  const scaling = contentBundle.balance.weaponScaling;
  refusedAt(withBalance({ weaponScaling: { ...scaling, anchor: -1 } }), 'balance.weaponScaling.anchor', 'anchor');
  refusedAt(withBalance({ weaponScaling: { ...scaling, grades: { ...scaling.grades, S: -1 } } }), 'balance.weaponScaling.grades.S', 'grade');
  const art = contentBundle.balance.weaponArtCharge;
  refusedAt(withBalance({ weaponArtCharge: { ...art, defaultMax: 1.5 } }), 'balance.weaponArtCharge.defaultMax', 'defaultMax');
  refusedAt(withBalance({ weaponArtCharge: { ...art, maxByWeapon: { ...art.maxByWeapon, dagger: -1 } } }), 'balance.weaponArtCharge.maxByWeapon.dagger', 'maxByWeapon');
});

// ---- combat juice (content/config/ui/presentation/combatJuiceModel.json) ----
const CONTENT = join(fileURLToPath(new URL('..', import.meta.url)), 'content');
const REL = 'ui/presentation/combatJuiceModel.json';
function juiceErrors(mutate) {
  const entries = readConfigTree(CONTENT);
  const at = entries.findIndex((e) => e.rel === REL);
  assert.ok(at >= 0, `no ${REL}`);
  const data = JSON.parse(entries[at].text);
  mutate(data);
  entries[at] = { rel: REL, text: JSON.stringify(data) };
  return compileEntries(entries).errors;
}

test('the shipped combat-juice config compiles clean', () => {
  assert.deepEqual(juiceErrors(() => {}), []);
});

test('combat-juice config: each malformed value is refused by file and name', () => {
  const cases = [
    ['sizing.damageTiers', (d) => { d.sizing.damageTiers.critAt = d.sizing.damageTiers.heavyAt; }],
    ['sizing.damageTiers', (d) => { d.sizing.damageTiers.capAt = 1; }],
    ['sizing.damageTiers.chipBelow', (d) => { d.sizing.damageTiers.chipBelow = -1; }],
    ['sizing.damageScale.critBoost', (d) => { d.sizing.damageScale.critBoost = null; }],
    ['sizing.killCam.zoom', (d) => { d.sizing.killCam.zoom = 0; }],
    ['sizing.killCam.vignetteOpacity', (d) => { d.sizing.killCam.vignetteOpacity = 2; }],
    ['motion.hitStop.minMs', (d) => { d.motion.hitStop.minMs = -5; }],
    ['motion.hitStop', (d) => { d.motion.hitStop.critMs = 500; }],
    ['motion.hitStop.impactFraction', (d) => { d.motion.hitStop.impactFraction = 1.5; }],
    ['motion.killCam.bossMs', (d) => { d.motion.killCam.bossMs = 'long'; }],
    ['motion.killCam.slowRate', (d) => { d.motion.killCam.slowRate = 0; }],
    ['motion.coopFinaleHoldMs', (d) => { d.motion.coopFinaleHoldMs = -1; }],
    ['behavior.killCam.lastEnemy', (d) => { d.behavior.killCam.lastEnemy = 'yes'; }],
    ['behavior.killCam.rankByStature.huge', (d) => { d.behavior.killCam.rankByStature.huge = 'king'; }],
    ['sizing', (d) => { d.sizing = 3; }],
  ];
  for (const [name, mutate] of cases) {
    const errors = juiceErrors(mutate);
    assert.ok(errors.some((e) => e.startsWith(`content/config/${REL}: ${name} `)), `${name}: got ${errors.join(' | ') || '(none)'}`);
  }
});
