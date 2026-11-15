// Phone has no hover: a target armed by the picker, cursor or focus ring must quote the selected card at that enemy,
// so a back-row enemy's +1 Stamina shows on the cost badge before the play (shown = paid).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');

test('an armed (hover-target or gp-focus) enemy becomes the quote target without a pointer hover', () => {
  const begin = source.indexOf('  function syncArmedTarget(');
  const end = source.indexOf('\n  function ', begin + 1);
  assert.ok(begin >= 0 && end > begin);
  const body = source.slice(begin, end);
  assert.match(body, /hover-target, \.combatant\.enemy\.gp-focus/);
  assert.match(body, /cardTargets\(selected\)\.legalIds\.includes\(id\)/);
  assert.match(body, /lastTargetId = id;\s*renderHand\(\)/);
  assert.match(source, /syncArmedTarget\(\); refreshAim\(\)/);
});
