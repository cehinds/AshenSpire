import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const tool = readFileSync(new URL('../tools/screenreach.mjs', import.meta.url), 'utf8');
const start = tool.indexOf('  const playerFrame = player.closest');
const end = tool.indexOf('  if (playerMoved.width >= 24', start);
assert.ok(start >= 0 && end > start, 'execute the actual canonical side-movement setup');
const movement = tool.slice(start, end);

test('overlap fixture preserves the fitted 44px target above the hand while moving its 16px sprite sideways', () => {
  for (const zoom of [.62, .83, 1, 1.25]) {
    for (const frameMoves of [false, true]) {
      let deltaX = 0;
      const values = {};
      const frame = {
        getBoundingClientRect: () => ({ left: 35.09375 + (frameMoves ? deltaX : 0),
          top: 74.734375, width: 85.796875, height: 275.203125 }),
        style: { setProperty: (name, value) => { values[name] = parseFloat(value); } },
      };
      const stack = {
        getBoundingClientRect: () => ({ width: 85.796875 }),
        style: { set translate(value) { deltaX = parseFloat(value) * zoom; } },
      };
      const playerAfter = { left: 70, width: 16, bottom: 349.96875 };
      const player = {
        closest: selector => selector === '.combatant' ? frame : stack,
        getBoundingClientRect: () => ({ ...playerAfter, left: playerAfter.left + deltaX }),
      };
      const fittedY = 349.9375 - 22;
      runInNewContext(movement, { player, playerAfter, zoom,
        fieldBox: { left: 0, width: 390 },
        getComputedStyle: () => ({ top: `${(fittedY - frame.getBoundingClientRect().top) / zoom}px` }),
      });
      const movedFrame = frame.getBoundingClientRect();
      const globalX = movedFrame.left + values['--enemy-hit-x'] * zoom;
      const globalY = movedFrame.top + values['--enemy-hit-y'] * zoom;
      assert.ok(Math.abs(globalX - (playerAfter.left + deltaX + 8)) < 1e-8,
        'current frame coordinates anchor the complete target to the moved sprite');
      assert.ok(Math.abs(globalY - fittedY) < 1e-8, 'keep the production fitted screen anchor');
      assert.ok(globalY + 22 <= 349.9375, 'the full 44px target stays above the hand boundary');
      assert.ok(playerAfter.bottom > globalY + 22, 'raw sprite foot is not a valid target centre here');
      assert.equal(playerAfter.width, 16, 'the deliberate small-player exposure fixture remains');
    }
  }
});