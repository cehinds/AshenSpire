// Players start at 1 attribute point (owner, 2026-11-28); enemies keep their 6-point budget and floor 1.
// The baseline was written from origin/dev before the change by tests/helpers/enemy-attribute-snapshot.mjs --write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EnemyAttributeSnapshot, ReadEnemyAttributeBaseline } from './helpers/enemy-attribute-snapshot.mjs';

test('every enemy resolves the same attributes and pools as before the player base-stat change', () =>
{
  assert.deepEqual(EnemyAttributeSnapshot(), ReadEnemyAttributeBaseline());
});
