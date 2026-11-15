// Owner, 2026-11-14: Core keeps two bands of card reach, melee and reach. No shipped weapon, card or enemy
// carries the ranged band (the band stays in the code only so an old save still loads).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';

const walk = (node, visit, seen = new WeakSet(), path = '') => {
  if (node === null || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  for (const [key, value] of Object.entries(node)) { visit(key, value, `${path}/${key}`); walk(value, visit, seen, `${path}/${key}`); }
};

test('no shipped weapon, card or enemy move carries the ranged range band', () => {
  const found = [];
  for (const section of ['equipment', 'cards', 'enemies', 'enemyMoves', 'stances']) {
    walk(contentBundle[section], (key, value, path) => {
      if ((/^(range|reach)$/.test(key) && value === 'ranged') || value === 'range:ranged') found.push(`${section}${path}`);
    });
  }
  assert.deepEqual(found, []);
});

test('the shortbow reaches the reach band', () => {
  const bow = contentBundle.equipment.armaments.find(item => item.id === 'shortbow');
  assert.equal(bow.range, 'reach');
});
