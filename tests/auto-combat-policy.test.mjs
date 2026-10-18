import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as policy from '../src/model/autoCombatPolicy.js';
import { resolveCombatAutomation } from '../src/model/autoCombatPolicy.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { profileKeys } from '../src/model/settingsSync.js';

test('policy defaults are off, ×1, offense and a half-second delay', () => {
  assert.deepEqual(resolveCombatAutomation(), { enabled: false, speed: 1, preference: 'offense', delayMs: 500 });
  assert.equal(resolveCombatAutomation({ combatSpeed: NaN }).speed, 1);
  assert.equal(resolveCombatAutomation({ combatSpeed: 999 }).speed, 8);
});
test('auto-combat never plays cards or ends turns (D12)', () => {
  assert.equal(policy.chooseAutoCombatAction, undefined);
  const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const auto = screen.slice(screen.indexOf('function autoReactionChoice'), screen.indexOf('// ---------- rendering'));
  assert.ok(auto.includes('chooseReaction'));
  for (const call of ['playCard(', 'commitEndTurn(', "type: 'playCard'", "type: 'endTurn'"]) assert.ok(!auto.includes(call), call);
});
test('automation settings participate in durable profile export and reset rows', () => {
  const rows = settingsRows();
  const keys = profileKeys(rows);
  for (const key of ['autoCombat', 'combatSpeed', 'combatPreference', 'combatActionDelay']) {
    assert.ok(rows.some(row => row.key === key)); assert.ok(keys.includes(key), key);
  }
});
