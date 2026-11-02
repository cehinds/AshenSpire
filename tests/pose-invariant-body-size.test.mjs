import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bodyScaleFactor, bodyResize } from '../src/ui/models/CombatBodyModel.js';
import { COMBAT_BODY_LANDMARKS } from '../src/content/combatBodyLandmarks.js';
import { enemyExpansion } from '../src/content/enemyExpansion.js';

test('every measured enemy frame draws at the idle body height', () => {
  let frames = 0;
  for (const id of Object.keys(enemyExpansion)) {
    const idle = COMBAT_BODY_LANDMARKS[`assets/enemy-poses/expansion/${id}/idle.webp`];
    if (!idle) continue;
    const reference = idle.feetY - idle.headY;
    for (const [path, body] of Object.entries(COMBAT_BODY_LANDMARKS)) {
      if (!path.startsWith(`assets/enemy-poses/expansion/${id}/`)) continue;
      const drawn = (body.feetY - body.headY) * bodyScaleFactor(reference, body);
      assert.ok(Math.abs(drawn - reference) < 1e-9, path);
      frames++;
    }
  }
  assert.ok(frames > 100, `checked ${frames} frames`);
  assert.equal(bodyScaleFactor(300, null), 1);
  assert.equal(bodyScaleFactor(null, { headY: 10, feetY: 20 }), 1);
});

test('the enemy stage no longer limits the factor to held frames', () => {
  const source = readFileSync(new URL('../src/ui/enemyExpansionStage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /normalizeBody/);
  assert.match(source, /bodyScaleFactor\(referenceBodyHeight, landmarks\)/);
});

test('bodyResize rescales about the frame feet and keeps its authored lift', () => {
  const landmarks = { headY: 100, feetY: 400, height: 512 };
  const placement = { left: 0, top: 50, width: 512, height: 512, anchorX: 256 };
  const resized = bodyResize(placement, landmarks, 150);
  assert.ok(Math.abs((resized.body.feetY - resized.body.headY) - 150) < 1e-9);
  assert.equal(resized.body.feetY, 50 + 400);
  assert.equal(resized.height, 512 * .5);
});
