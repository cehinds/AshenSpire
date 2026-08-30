#!/usr/bin/env node
// Focused pure-model gate for issue #237.

import process from 'node:process';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import {
  ENCOUNTER_LEVEL_SEAM,
  levelScalingReceipt,
  playerLevel,
  resolveEnemyLevel,
} from '../src/model/levels.js';
import { validateContent } from '../src/model/validate.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const throws = (fn, pattern) => {
  try { fn(); return false; }
  catch (error) { return pattern.test(String(error && error.message)); }
};

const REG = createRegistries(contentBundle);
const context = {
  seed: 0x237,
  contextKey: 'act-2/floor-7/encounter-a/slot-1',
  act: 2,
  floor: 7,
  targetBand: { min: 4, max: 8 },
  modifiers: [{ id: 'route-depth', delta: 1 }],
};

const cases = [
  ['shipped content validates with one authored player starting level', () => {
    const verdict = validateContent(contentBundle);
    assert(verdict.ok, verdict.errors.map((error) => `${error.path}: ${error.msg}`).join('; '));
    assert(REG.balance.levels.playerStartingLevel === 1, JSON.stringify(REG.balance.levels));
  }],
  ['a fresh player begins at the authored level', () => {
    assert(playerLevel(REG, { levelUps: 0, levelPoints: 0 }) === 1, 'fresh player did not start at 1');
  }],
  ['each shrine purchase advances level exactly once', () => {
    assert(playerLevel(REG, { levelUps: 6, levelPoints: 19 }) === 7, 'six purchases did not produce level 7');
  }],
  ['levelPoints cannot masquerade as a purchase count', () => {
    assert(playerLevel(REG, { levelUps: 2, levelPoints: 20 }) === 3, 'levelPoints changed the player level');
  }],
  ['a legacy run with no levelUps starts at the authored level', () => {
    assert(playerLevel(REG, { levelPoints: 99 }) === 1, 'legacy absence was not zero purchases');
  }],
  ['enemy resolution is deterministic and returns a whole number inside authored bounds', () => {
    const a = resolveEnemyLevel({ min: 3, max: 9 }, context);
    const b = resolveEnemyLevel({ min: 3, max: 9 }, structuredClone(context));
    assert(JSON.stringify(a) === JSON.stringify(b), 'same inputs produced different receipts');
    assert(Number.isInteger(a.result) && a.result >= 3 && a.result <= 9, JSON.stringify(a));
  }],
  ['the roll is selected from the authored/act-floor overlap', () => {
    const receipt = resolveEnemyLevel({ min: 3, max: 9 }, { ...context, modifiers: [] });
    assert(receipt.rolledLevel >= 4 && receipt.rolledLevel <= 8, JSON.stringify(receipt));
  }],
  ['an empty overlap chooses the nearest authored edge rather than inventing a fallback band', () => {
    const receipt = resolveEnemyLevel({ min: 10, max: 12 }, { ...context, targetBand: { min: 2, max: 4 }, modifiers: [] });
    assert(receipt.rolledLevel === 10 && receipt.planning.overlap === null, JSON.stringify(receipt));
  }],
  ['modifiers are named, summed, and clamped to the authored profile', () => {
    const receipt = resolveEnemyLevel({ min: 3, max: 9 }, { ...context, modifiers: [{ id: 'boss', delta: 99 }] });
    assert(receipt.result === 9 && receipt.modifierTotal === 99 && receipt.clamped, JSON.stringify(receipt));
  }],
  ['modifier accumulation remains exact when safe deltas cross the safe-integer boundary and cancel', () => {
    const receipt = resolveEnemyLevel({ min: 1, max: 9 }, {
      ...context,
      targetBand: { min: 1, max: 1 },
      modifiers: [
        { id: 'positive-boundary', delta: Number.MAX_SAFE_INTEGER },
        { id: 'cross-boundary', delta: 2 },
        { id: 'cancel-boundary', delta: -Number.MAX_SAFE_INTEGER },
      ],
    });
    assert(receipt.modifierTotal === 2 && receipt.unclamped === 3 && receipt.result === 3, JSON.stringify(receipt));
  }],
  ['the receipt carries source band, act/floor target, modifiers, result, and dedicated seam', () => {
    const receipt = resolveEnemyLevel({ min: 3, max: 9 }, context);
    assert(receipt.seam === ENCOUNTER_LEVEL_SEAM, receipt.seam);
    assert(receipt.sourceBand.min === 3 && receipt.sourceBand.max === 9, JSON.stringify(receipt.sourceBand));
    assert(receipt.actFloorTarget.act === 2 && receipt.actFloorTarget.floor === 7, JSON.stringify(receipt.actFloorTarget));
    assert(receipt.modifiers[0].id === 'route-depth' && Number.isInteger(receipt.result), JSON.stringify(receipt));
  }],
  ['the resolver leaves profile and context inputs untouched', () => {
    const profile = { min: 3, max: 9 };
    const supplied = structuredClone(context);
    const before = JSON.stringify({ profile, supplied });
    resolveEnemyLevel(profile, supplied);
    assert(JSON.stringify({ profile, supplied }) === before, 'resolver mutated an input');
  }],
  ['stat scaling states its level delta, coefficient, rounding, cap, and result', () => {
    const receipt = levelScalingReceipt({
      stat: 'hp', base: 31, baselineLevel: 3, resolvedLevel: 6,
      perLevel: 2.5, rounding: 'floor', min: 1, max: 36,
    });
    assert(receipt.levelDelta === 3 && receipt.unrounded === 38.5, JSON.stringify(receipt));
    assert(receipt.rounded === 38 && receipt.result === 36 && receipt.clamped, JSON.stringify(receipt));
  }],
  ['integer scaling remains exact when an unsafe product cancels to a safe result', () => {
    const receipt = levelScalingReceipt({
      stat: 'hp',
      base: -Number.MAX_SAFE_INTEGER,
      baselineLevel: 1,
      resolvedLevel: 4,
      perLevel: 3002399751580331,
      rounding: 'round',
    });
    assert(receipt.levelDelta === 3 && receipt.unrounded === 2, JSON.stringify(receipt));
    assert(receipt.rounded === 2 && receipt.result === 2, JSON.stringify(receipt));
  }],
];

let failures = 0;
for (const [name, run] of cases) {
  try { run(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.log(`FAIL ${name} — ${error.message}`); }
}
console.log(`level semantics: ${cases.length - failures}/${cases.length}`);

if (process.argv.includes('--selftest')) {
  const plants = [
    ['missing player starting level is refused', () => {
      const bad = { ...REG, balance: { ...REG.balance, levels: {} } };
      return throws(() => playerLevel(bad, { levelUps: 0 }), /playerStartingLevel/);
    }],
    ['fractional purchase count is refused', () => throws(() => playerLevel(REG, { levelUps: 1.5 }), /levelUps/)],
    ['inverted enemy bounds are refused', () => throws(() => resolveEnemyLevel({ min: 9, max: 3 }, context), /must not exceed/)],
    ['fractional target bands are refused', () => throws(() => resolveEnemyLevel({ min: 3, max: 9 }, { ...context, targetBand: { min: 4.5, max: 8 } }), /targetBand\.min/)],
    ['unknown level-profile fields are refused', () => throws(() => resolveEnemyLevel({ min: 3, max: 9, tier: 2 }, context), /tier: unknown field/)],
    ['unknown planning-context fields are refused', () => throws(() => resolveEnemyLevel({ min: 3, max: 9 }, { ...context, enemyAI: true }), /enemyAI: unknown field/)],
    ['unlabelled modifiers are refused', () => throws(() => resolveEnemyLevel({ min: 3, max: 9 }, { ...context, modifiers: [{ delta: 1 }] }), /\.id/)],
    ['unknown modifier fields are refused', () => throws(() => resolveEnemyLevel({ min: 3, max: 9 }, { ...context, modifiers: [{ id: 'route', delta: 1, bonus: 2 }] }), /unknown field/)],
    ['unstated scaling rounding is refused', () => throws(() => levelScalingReceipt({
      stat: 'damage', base: 5, baselineLevel: 1, resolvedLevel: 2, perLevel: 0.5,
    }), /rounding/)],
    ['inverted scaling caps are refused', () => throws(() => levelScalingReceipt({
      stat: 'poise', base: 10, baselineLevel: 1, resolvedLevel: 2, perLevel: 1, rounding: 'round', min: 20, max: 10,
    }), /must not exceed/)],
    ['fractional scaling caps cannot undo integer rounding', () => throws(() => levelScalingReceipt({
      stat: 'hp', base: 0, baselineLevel: 1, resolvedLevel: 1, perLevel: 0, rounding: 'floor', min: 0.5,
    }), /min: must be a safe integer/)],
    ['unknown scaling-spec keys are refused', () => throws(() => levelScalingReceipt({
      stat: 'damage', base: 5, baselineLevel: 1, resolvedLevel: 2, perLevel: 1, rounding: 'floor', maximum: 9,
    }), /spec\.maximum: unknown field/)],
    ['non-finite scaling results are refused', () => throws(() => levelScalingReceipt({
      stat: 'hp', base: Number.MAX_VALUE, baselineLevel: 1, resolvedLevel: 2, perLevel: Number.MAX_VALUE, rounding: 'floor',
    }), /finite|safe arithmetic range/)],
    ['content validation rejects an inverted enemy profile', () => {
      // The bundle deliberately contains script functions, so clone only the
      // authored population this plant mutates instead of pretending the whole
      // runtime bundle is structured-cloneable.
      const bad = { ...contentBundle, enemies: contentBundle.enemies.map((enemy) => ({ ...enemy })) };
      bad.enemies[0].levelProfile = { min: 8, max: 2 };
      const verdict = validateContent(bad);
      return !verdict.ok && verdict.errors.some((error) => /levelProfile/.test(error.path) && /must not exceed/.test(error.msg));
    }],
  ];
  let caught = 0;
  for (const [name, plant] of plants) {
    let ok = false;
    try { ok = plant(); } catch { ok = false; }
    if (ok) caught += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} PLANT ${name}`);
  }
  console.log(`level semantics selftest: ${caught}/${plants.length} plants caught`);
  if (caught !== plants.length) failures += 1;
}

process.exit(failures ? 1 : 0);
