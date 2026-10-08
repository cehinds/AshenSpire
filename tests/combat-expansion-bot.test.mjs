import test from 'node:test';
import assert from 'node:assert/strict';
import { runExpandedBotSmoke } from '../tools/combat-expansion-smoke.mjs';

test('version two simulator handles locked status and pending feat, then advances within bounded actions', () => {
  const rows = runExpandedBotSmoke();
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(row.choices, 1);
    assert.ok(row.recovery >= 1);
    assert.ok(row.actions < 120);
  }
});
