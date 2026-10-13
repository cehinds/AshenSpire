// Tests for the evasion, accuracy and miss-chance formulas (DECISIONS.md decision 11).
// Run: node --test docs/tag-model/tools/evasion.test.mjs
//
// The formulas are read from tables/formulas.csv and the numbers from
// tables/values.csv. Each [key] resolves to an input override, a formula, or a
// value row, in that order. Nothing here is a copy of the formula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const TABLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'tables');

function load(name) {
  const all = parseCsv(readFileSync(join(TABLES, name), 'utf8'));
  const header = all.shift();
  return all
    .filter(r => !(r.length === 1 && r[0] === ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const VALUES = Object.fromEntries(load('values.csv').map(r => [r.key, Number(r.value)]));
const FORMULAS = Object.fromEntries(
  load('formulas.csv').filter(r => r.expr.trim() !== '').map(r => [r.key, r.expr]),
);

// Evaluates a key: an input override first, then a formula, then a value row.
function evaluate(key, inputs = {}, depth = 0) {
  if (depth > 10) throw new Error(`formula loop at ${key}`);
  if (key in inputs) return inputs[key];
  if (key in FORMULAS) {
    const expr = FORMULAS[key].replace(/\[([^\]]+)\]/g, (_, k) => `(${evaluate(k, inputs, depth + 1)})`);
    return new Function('floor', 'min', 'max', `return (${expr});`)(Math.floor, Math.min, Math.max);
  }
  if (key in VALUES) return VALUES[key];
  throw new Error(`unresolved [${key}]`);
}

// Armour inputs taken from the material rows, as the armour's runtime values.
const armour = material => ({
  'armor.evasionBase': VALUES[`${material}.evasionBase`],
  'armor.dexCap': VALUES[`${material}.dexCap`],
});

// Level 1 class stats from content (STR, DEX, WIS, INT).
const STATS = {
  reaver: { strength: 3, dexterity: 1, wisdom: 1, intelligence: 1 },
  rogue: { strength: 1, dexterity: 3, wisdom: 1, intelligence: 1 },
  starseer: { strength: 1, dexterity: 1, wisdom: 2, intelligence: 3 },
  herald: { strength: 1, dexterity: 1, wisdom: 3, intelligence: 1 },
};

// Enemy accuracy used in the miss examples (value row enemy.accuracy).
const ENEMY_ACCURACY = VALUES['enemy.accuracy'];

const close = (actual, expected, msg) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${msg}: got ${actual}, expected ${expected}`);

// Miss chance of an attack with the given accuracy against the given evasion.
const missOf = (accuracy, evasion) => evaluate('hit.missChance', {
  'accuracy.rating': accuracy,
  'evasion.rating': evasion,
});

test('the enemy example values are the ones in the decision', () => {
  assert.equal(ENEMY_ACCURACY, 5);
  assert.equal(VALUES['wanderingSoldier.evasion'], 1);
  assert.equal(VALUES['blightHound.evasion'], 3);
  assert.equal(VALUES['huskBrute.evasion'], 0);
  assert.equal(VALUES['fellWarden.evasion'], 2);
});

test('accuracy at level 1 gives Reaver 5, Rogue 5, Starseer 4, Herald 4', () => {
  const expected = { reaver: 5, rogue: 5, starseer: 4, herald: 4 };
  for (const [name, expectedRating] of Object.entries(expected)) {
    assert.equal(evaluate('accuracy.rating', STATS[name]), expectedRating, name);
  }
});

test('accuracy tag bonuses: quick +1, telegraphed -2', () => {
  const reaver = STATS.reaver;
  assert.equal(evaluate('accuracy.rating', { ...reaver, 'accuracy.tagBonus': VALUES['quick.accuracy'] }), 6);
  assert.equal(evaluate('accuracy.rating', { ...STATS.rogue, 'accuracy.tagBonus': VALUES['telegraphed.accuracy'] }), 3);
});

test('evasion: Reaver plated DEX 1 is 1; Rogue leather DEX 3 with buckler is 3; Backstep adds 5', () => {
  assert.equal(evaluate('evasion.rating', { ...STATS.reaver, ...armour('plated') }), 1);
  const rogue = { ...STATS.rogue, ...armour('leather'), 'shield.evasion': VALUES['buckler.evasion'] };
  assert.equal(evaluate('evasion.rating', rogue), 3);
  assert.equal(evaluate('evasion.rating', { ...rogue, 'evasion.cardBonus': VALUES['backstep.evasion'] }), 8);
});

// Starseer and Herald are given cloth (evasion base 0). The decision gives
// their evasion as 0 and names no armour, so cloth is an assumption, noted in DECISIONS.md.
test('the five example miss chances against enemy accuracy 5', () => {
  const cases = [
    ['Starseer', evaluate('evasion.rating', { ...STATS.starseer, ...armour('cloth') }), 0.10],
    ['Herald', evaluate('evasion.rating', { ...STATS.herald, ...armour('cloth') }), 0.10],
    ['Reaver (plated)', evaluate('evasion.rating', { ...STATS.reaver, ...armour('plated') }), 0.15],
    ['Rogue (leather, DEX 3, buckler)', evaluate('evasion.rating', {
      ...STATS.rogue, ...armour('leather'), 'shield.evasion': VALUES['buckler.evasion'],
    }), 0.25],
    ['Rogue after Backstep', evaluate('evasion.rating', {
      ...STATS.rogue, ...armour('leather'), 'shield.evasion': VALUES['buckler.evasion'],
      'evasion.cardBonus': VALUES['backstep.evasion'],
    }), 0.50],
  ];
  for (const [name, evasion, expected] of cases) {
    close(missOf(ENEMY_ACCURACY, evasion), expected, name);
  }
});

// The rule: d20 + accuracy >= 8 + evasion hits, so a roll misses when d + A < 8 + E.
// A natural 1 always misses and a natural 20 always hits. The brute force below
// applies those rules roll by roll; the formula with its clamp (0.05 floor, 0.75
// cap) must give the same chance for every accuracy and evasion in range.
test('miss chance matches a roll-by-roll count of the hit rule, with natural 1 and 20', () => {
  for (let A = 1; A <= 10; A++) {
    for (let E = 0; E <= 20; E++) {
      let misses = 0;
      for (let d = 1; d <= 20; d++) {
        if (d === 20) continue; // natural 20 always hits
        if (d === 1 || d + A < 8 + E) misses++; // natural 1 always misses
      }
      const exact = Math.min(0.75, Math.max(0.05, misses / 20));
      close(missOf(A, E), exact, `A=${A} E=${E}`);
    }
  }
});

test('the clamp: miss chance never goes below 5% or above 75%', () => {
  close(missOf(20, 0), 0.05, 'far above the target stays at the 5% floor');
  close(missOf(1, 30), 0.75, 'far below the target caps at 75%');
});
