// WARD RESIST POP-UPS. A magical hit the Ward absorbs entirely arrives as
// damageDealt with amount 0, blocked 0 and wardResisted > 0; the Ward pool
// dropping arrives as persistentWardChanged (spent) or combatWardStripped
// (amount). These helpers give each of those a pop-up, and the wardResist
// sound recipe is what plays with them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX_RECIPES } from '../src/content/sfx.js';
import { wardResistFloat, wardDropFloat, guardHitFloatParts } from '../src/ui/fx.js';

test('a fully Ward-absorbed hit shows a RESISTED pop-up', () => {
  const f = wardResistFloat({ type: 'damageDealt', amount: 0, blocked: 0, wardResisted: 5 });
  assert.ok(f, 'expected a float');
  assert.match(f.text, /5/);
  assert.equal(f.cls, 'ward small');
});

test('no Ward absorption means no RESISTED pop-up', () => {
  assert.equal(wardResistFloat({ type: 'damageDealt', amount: 4, blocked: 0, wardResisted: 0 }), null);
  assert.equal(wardResistFloat({ type: 'damageDealt', amount: 4 }), null);
});

test('a Ward pool drop shows WARD minus the spent amount', () => {
  const f = wardDropFloat({ type: 'persistentWardChanged', spent: 2 });
  assert.equal(f.text, 'WARD −2');
  assert.equal(f.cls, 'ward small');
});

test('a Ward strip shows WARD minus the stripped amount', () => {
  const f = wardDropFloat({ type: 'combatWardStripped', amount: 3 });
  assert.equal(f.text, 'WARD −3');
});

test('a Ward restore (no spend) shows no drop pop-up', () => {
  assert.equal(wardDropFloat({ type: 'persistentWardChanged', spent: 0, restored: 2 }), null);
});

test('a fully Ward-absorbed hit leaves the guard and damage channels empty', () => {
  const parts = guardHitFloatParts({ type: 'damageDealt', amount: 0, blocked: 0, wardResisted: 4 });
  assert.equal(parts.guard, null);
  assert.equal(parts.damage, null);
});

test('the wardResist sound recipe exists and is not the default blip', () => {
  const row = SFX_RECIPES.wardResist;
  assert.ok(Array.isArray(row) && row.length > 0, 'expected a wardResist recipe row');
  assert.notDeepEqual(row, SFX_RECIPES.block);
});
