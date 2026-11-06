// An unchanged paint signature clears nothing (owner, 2026-11-06: static, no redraw flicker).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPaintGate, paintSignature } from '../src/ui/paintSignature.js';

function fakePaint(gate) {
  const calls = { clearRect: 0, draw: 0 };
  return { calls, paint(parts) { if (!gate.changed(paintSignature(parts))) return; calls.clearRect++; calls.draw++; } };
}
const base = { pose: 'ready', x: 0, effect: '', rest: 'idle', stance: '', lite: false, off: false, flashing: -1 };

test('an unchanged signature does not clear or draw', () => {
  const stage = fakePaint(createPaintGate());
  stage.paint(base); stage.paint(base); stage.paint({ ...base }); stage.paint(base);
  assert.equal(stage.calls.clearRect, 1);
});
test('a changed pose, offset, flash or flag paints again', () => {
  const stage = fakePaint(createPaintGate());
  stage.paint(base); stage.paint({ ...base, pose: 'slash-1' }); stage.paint({ ...base, pose: 'slash-1', x: 12 });
  stage.paint({ ...base, flashing: 40 }); stage.paint({ ...base, flashing: 40, lite: true });
  assert.equal(stage.calls.clearRect, 5);
});
test('the stage gates paint() before it clears and never resizes its canvas', () => {
  const src = readFileSync(new URL('../src/ui/alternativeCardStage.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function paint('), src.indexOf('function tick('));
  assert.ok(body.indexOf('paintGate.changed') > 0 && body.indexOf('paintGate.changed') < body.indexOf('ctx.clearRect'));
  assert.equal((src.match(/canvas\.(width|height)\s*=[^=]/g) || []).length, 2, 'canvas sized once (width and height), at creation');
});
