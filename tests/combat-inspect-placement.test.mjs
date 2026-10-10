import test from 'node:test';
import assert from 'node:assert/strict';
import { combatInspectTapBox } from '../src/ui/components/battlefieldStage.js';

test('enemy Inspect placement uses the CSS target in physical screen pixels', () => {
  const tap = combatInspectTapBox({ left: 100, top: 80, width: 22 });
  assert.deepEqual(tap, { left: 89, right: 133, top: 62, bottom: 106 });
  assert.equal(tap.right - tap.left, 44);
  assert.equal(tap.bottom - tap.top, 44);
});
