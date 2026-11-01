// Weakness chips (owner, 2026-11-01; SPEC 5.3): an icon per trigger, a tooltip, and discovery gating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { WEAKNESS_ICON, weaknessIconId } from '../src/model/weaknessIcons.js';
import { WEAKNESS_HIT_TRIGGERS, WEAKNESS_STATUSES } from '../src/model/enemyWeaknessRules.js';
import { hasTagSymbol } from '../src/ui/components/cardTagSymbols.js';

test('every weakness trigger and every authored weakness has a real icon, never a letter', () => {
  const triggers = new Set([...WEAKNESS_HIT_TRIGGERS, ...WEAKNESS_STATUSES]);
  for (const def of contentBundle.enemies) for (const row of def.weaknesses || []) triggers.add(row.to);
  assert.ok(triggers.size >= 15);
  for (const to of triggers) {
    assert.ok(weaknessIconId(to), `${to} has an icon id`);
    assert.ok(hasTagSymbol(weaknessIconId(to)), `${to} icon ${weaknessIconId(to)} resolves to a mark`);
  }
  assert.deepEqual([...triggers].filter(to => !Object.hasOwn(WEAKNESS_ICON, to)), []);
});
