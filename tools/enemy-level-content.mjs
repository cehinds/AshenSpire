#!/usr/bin/env node
// Focused inert-content gate for issue #238.

import process from 'node:process';
import { contentBundle } from '../src/content/index.js';
import { levelScalingReceipt } from '../src/model/levels.js';
import { validateContent } from '../src/model/validate.js';

const EXPECTED_ENEMIES = 19;
const EXPECTED_ENCOUNTERS = 21;
const SCALING_STATS = Object.freeze(['hp', 'damage', 'block', 'poise']);
const isBand = (value) => value
  && Number.isSafeInteger(value.min)
  && Number.isSafeInteger(value.max)
  && value.min > 0
  && value.min <= value.max;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const contentErrors = (bundle) => validateContent(bundle).errors.map(({ path, msg }) => `${path}: ${msg}`);

function ordinaryProgressionProblems(bundle) {
  const problems = [];
  const groups = new Map();
  for (const encounter of bundle.encounters.filter((row) => row.pool === 'normal')) {
    if (!isBand(encounter.floorBand) || !isBand(encounter.targetBand)) continue;
    const key = `${encounter.act}:${encounter.floorBand.min}:${encounter.floorBand.max}`;
    const group = groups.get(key) || {
      act: encounter.act,
      floorBand: encounter.floorBand,
      targetMin: encounter.targetBand.min,
      targetMax: encounter.targetBand.max,
    };
    group.targetMin = Math.min(group.targetMin, encounter.targetBand.min);
    group.targetMax = Math.max(group.targetMax, encounter.targetBand.max);
    groups.set(key, group);
  }
  const progression = [...groups.values()]
    .sort((a, b) => a.act - b.act || a.floorBand.min - b.floorBand.min);
  for (let index = 1; index < progression.length; index += 1) {
    const previous = progression[index - 1];
    const current = progression[index];
    if (current.targetMin < previous.targetMin) {
      problems.push(`act ${current.act} target min ${current.targetMin} regresses behind act ${previous.act} ${previous.targetMin}`);
    }
    if (current.targetMax < previous.targetMax) {
      problems.push(`act ${current.act} target max ${current.targetMax} regresses behind act ${previous.act} ${previous.targetMax}`);
    }
  }
  return problems;
}

const cases = [
  ['the shipped bundle remains schema-valid', () => {
    const verdict = validateContent(contentBundle);
    assert(verdict.ok, verdict.errors.map(({ path, msg }) => `${path}: ${msg}`).join('; '));
  }],
  ['all nineteen enemies own an explicit level profile', () => {
    assert(contentBundle.enemies.length === EXPECTED_ENEMIES, `expected ${EXPECTED_ENEMIES} enemies, found ${contentBundle.enemies.length}`);
    const missing = contentBundle.enemies.filter((enemy) => !isBand(enemy.levelProfile)).map((enemy) => enemy.id);
    assert(missing.length === 0, `missing/invalid levelProfile: ${missing.join(', ')}`);
  }],
  ['all twenty-one encounters own floor and target bands', () => {
    assert(contentBundle.encounters.length === EXPECTED_ENCOUNTERS, `expected ${EXPECTED_ENCOUNTERS} encounters, found ${contentBundle.encounters.length}`);
    const missing = contentBundle.encounters
      .filter((encounter) => !isBand(encounter.floorBand) || !isBand(encounter.targetBand))
      .map((encounter) => encounter.id);
    assert(missing.length === 0, `missing/invalid floorBand or targetBand: ${missing.join(', ')}`);
  }],
  ['every encounter target overlaps every enemy it can author', () => {
    const enemies = new Map(contentBundle.enemies.map((enemy) => [enemy.id, enemy]));
    for (const encounter of contentBundle.encounters) {
      for (const enemyId of encounter.enemies) {
        const profile = enemies.get(enemyId).levelProfile;
        const overlaps = Math.max(profile.min, encounter.targetBand.min) <= Math.min(profile.max, encounter.targetBand.max);
        assert(overlaps, `${encounter.id}/${enemyId} has no profile/target overlap`);
      }
    }
  }],
  ['ordinary act/floor target progression is monotonic', () => {
    const problems = ordinaryProgressionProblems(contentBundle);
    assert(problems.length === 0, problems.join('; '));
  }],
  ['HP, damage, block, and poise scaling are data-owned exact receipts', () => {
    const scaling = contentBundle.balance.levels.enemyScaling;
    assert(scaling && typeof scaling === 'object', 'balance.levels.enemyScaling is absent');
    for (const stat of SCALING_STATS) {
      const row = scaling[stat];
      assert(row && typeof row === 'object', `enemyScaling.${stat} is absent`);
      const receipt = levelScalingReceipt({
        stat,
        base: stat === 'hp' ? 30 : 8,
        baselineLevel: 1,
        resolvedLevel: 6,
        ...row,
      });
      assert(receipt.stat === stat && Number.isSafeInteger(receipt.result), JSON.stringify(receipt));
    }
    for (const enemy of contentBundle.enemies) {
      const common = { baselineLevel: enemy.levelProfile.min, resolvedLevel: enemy.levelProfile.max };
      for (const base of enemy.hp) levelScalingReceipt({ stat: 'hp', base, ...common, ...scaling.hp });
      levelScalingReceipt({ stat: 'poise', base: enemy.poiseMax, ...common, ...scaling.poise });
      for (const move of Object.values(enemy.moves)) {
        if (move.damage != null) levelScalingReceipt({ stat: 'damage', base: move.damage, ...common, ...scaling.damage });
        if (move.block != null) levelScalingReceipt({ stat: 'block', base: move.block, ...common, ...scaling.block });
      }
    }
  }],
];

let failures = 0;
for (const [name, run] of cases) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.log(`FAIL ${name} — ${error.message}`); }
}
console.log(`enemy level content: ${cases.length - failures}/${cases.length}`);

if (process.argv.includes('--selftest')) {
  const plants = [
    ['missing enemy profile is refused', () => {
      const enemies = contentBundle.enemies.map((enemy) => ({ ...enemy }));
      delete enemies[0].levelProfile;
      return contentErrors({ ...contentBundle, enemies }).some((error) => /enemies\.wanderingSoldier\.levelProfile.*Missing required field/.test(error));
    }],
    ['missing encounter target band is refused', () => {
      const encounters = contentBundle.encounters.map((encounter) => ({ ...encounter }));
      delete encounters[0].targetBand;
      return contentErrors({ ...contentBundle, encounters }).some((error) => /encounters\.loneSoldier\.targetBand.*Missing required field/.test(error));
    }],
    ['inverted encounter floor band is refused by name', () => {
      const encounters = contentBundle.encounters.map((encounter) => ({ ...encounter }));
      encounters[0].floorBand = { min: 4, max: 1 };
      return contentErrors({ ...contentBundle, encounters }).some((error) => /loneSoldier\.floorBand.*must not exceed/.test(error));
    }],
    ['a missing scaling stat is refused', () => {
      const enemyScaling = { ...contentBundle.balance.levels.enemyScaling };
      delete enemyScaling.damage;
      const balance = { ...contentBundle.balance, levels: { ...contentBundle.balance.levels, enemyScaling } };
      return contentErrors({ ...contentBundle, balance }).some((error) => /enemyScaling\.damage.*must be an object/.test(error));
    }],
    ['an unknown scaling stat is refused', () => {
      const enemyScaling = { ...contentBundle.balance.levels.enemyScaling, hits: { perLevel: 1, rounding: 'round', min: 0, max: 9 } };
      const balance = { ...contentBundle.balance, levels: { ...contentBundle.balance.levels, enemyScaling } };
      return contentErrors({ ...contentBundle, balance }).some((error) => /enemyScaling\.hits.*unknown stat/.test(error));
    }],
    ['a scaling row cannot smuggle move-order data', () => {
      const enemyScaling = {
        ...contentBundle.balance.levels.enemyScaling,
        hp: { ...contentBundle.balance.levels.enemyScaling.hp, phase: 2 },
      };
      const balance = { ...contentBundle.balance, levels: { ...contentBundle.balance.levels, enemyScaling } };
      return contentErrors({ ...contentBundle, balance }).some((error) => /enemyScaling\.hp\.phase.*unknown field/.test(error));
    }],
    ['an ordinary act-level regression is caught', () => {
      const encounters = contentBundle.encounters.map((encounter) => ({ ...encounter }));
      const row = encounters.find((encounter) => encounter.id === 'a3_revenant');
      row.targetBand = { min: 1, max: 2 };
      return ordinaryProgressionProblems({ ...contentBundle, encounters }).length > 0;
    }],
  ];
  let caught = 0;
  for (const [name, plant] of plants) {
    let ok = false;
    try { ok = plant(); } catch { ok = false; }
    if (ok) caught += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} PLANT ${name}`);
  }
  console.log(`enemy level content selftest: ${caught}/${plants.length} plants caught`);
  if (caught !== plants.length) failures += 1;
}

process.exit(failures ? 1 : 0);
