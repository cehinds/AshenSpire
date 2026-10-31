import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The enemy slot's early `continue` must not hide a changed intent forecast: projectCombatIntent reads the
// player's defences, so an in-combat equipment swap changes it with no enemy change.
const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
const keyAt = source.indexOf('const renderKey = JSON.stringify([artKey, enemy,');
assert.ok(keyAt > 0);
const line = source.slice(keyAt, source.indexOf('\n', keyAt));

test('shown intent is computed before the enemy slot render guard', () => {
  const shownAt = source.lastIndexOf('const shownIntent = ', keyAt);
  assert.ok(shownAt > 0 && shownAt < keyAt, 'shownIntent precedes renderKey');
  assert.ok(source.indexOf('projectCombatIntent(combat, enemy.id)', shownAt) < keyAt);
  assert.equal(source.split('const shownIntent = showIntent').length - 1, 1, 'computed once');
});

test('shown intent is part of the outer enemy render key', () => {
  assert.match(line, /\bshownIntent\b/);
  const guardAt = source.indexOf('if (record?.renderKey === renderKey) continue;', keyAt);
  assert.ok(guardAt > keyAt);
});
