import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const tool = readFileSync(new URL('../tools/screenreach.mjs', import.meta.url), 'utf8');
const start = tool.indexOf('  const playerFrame = player.closest');
const end = tool.indexOf('  // Stage the pair in the clear centre', start);
assert.ok(start >= 0 && end > start, 'execute the actual canonical side-movement setup');
const movement = tool.slice(start, end);

test('overlap fixture keeps a visible player frame fitted and leaves artwork-only targets in place', () => {
  for (const playerPlate of [true, false]) {
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
          getBoundingClientRect: () => ({ ...playerAfter, left: playerAfter.left + deltaX,
            right: playerAfter.left + deltaX + playerAfter.width }),
        };
        const fittedY = 349.9375 - 22;
        runInNewContext(movement, { player, playerAfter, playerPlate, zoom,
          fieldBox: { left: 0, width: 390, right: 390 },
          getComputedStyle: () => ({ top: `${(fittedY - frame.getBoundingClientRect().top) / zoom}px` }),
        });
        if (!playerPlate) {
          assert.equal(deltaX, 0, 'exposed artwork keeps its production position');
          assert.deepEqual(values, {}, 'a hidden frame gets no artificial plate anchor');
          continue;
        }
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
  }
});


test('overlap fixture selects distinct paint-ordered enemies at tied and unequal depths', () => {
  const start = tool.indexOf('  const frames = [...document.querySelectorAll');
  const end = tool.indexOf('  const intent = low?.querySelector', start);
  const selection = tool.slice(start, end);
  for (const depths of [[200, 200, 200], [203, 201, 202], [200]]) {
    const frames = depths.map((z, index) => ({ index, querySelector: () => ({ zIndex: String(z) }) }));
    const { low, high } = runInNewContext(selection + '\n({ low, high })', {
      document: { querySelectorAll: () => frames }, getComputedStyle: sprite => sprite,
    });
    if (depths.length === 1) assert.equal(high, null, 'a single enemy cannot form a pair');
    else {
      const ordered = frames.toSorted((a, b) => depths[a.index] - depths[b.index]);
      assert.equal(low, ordered[0]);
      assert.equal(high, ordered.at(-1));
      assert.notEqual(high, low);
    }
  }
});

test('reachability census excludes native disabled controls while retaining active targets', () => {
  const start = tool.indexOf('  const all = [...app.querySelectorAll(sel)].filter');
  const end = tool.indexOf('  const frameOwnsHit', start);
  const census = tool.slice(start, end);
  const candidate = disabled => ({
    matches: selector => selector === ':disabled' && disabled,
    getBoundingClientRect: () => ({ width: 44, height: 44 }), closest: () => null,
  });
  const active = candidate(false), disabled = candidate(true);
  const result = runInNewContext(census + '\nall', {
    app: { querySelectorAll: () => [active, disabled] }, sel: 'button',
    getComputedStyle: () => ({ visibility: 'visible' }),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0], active);
});

test('paint guard ignores transparent responsive owners but catches painted and legacy overlap', () => {
  const start = tool.indexOf("    for (const frame of document.querySelectorAll('.enemy-row .combatant'))");
  const end = tool.indexOf('    // Information is', start);
  const guard = tool.slice(start, end);
  const box = (top, bottom) => ({ width: 50, height: bottom - top, top, bottom });
  const receipt = (top, bottom) => ({ getBoundingClientRect: () => box(top, bottom) });
  for (const [responsive, parts, want] of [
    [true, [receipt(120, 200)], []],
    [true, [receipt(80, 200)], ['HUD']],
    [true, [receipt(120, 200), receipt(330, 370)], ['hand']],
    [false, [receipt(120, 200)], ['HUD']],
  ]) {
    const frame = {
      dataset: { eid: 'e1' }, closest: () => ({ dataset: { targetHud: String(responsive) } }),
      querySelector: () => null, querySelectorAll: () => parts,
      getBoundingClientRect: () => box(50, 350),
    };
    const visual = [];
    runInNewContext(guard, {
      document: { querySelectorAll: () => [frame] }, hud: { bottom: 100 }, hand: { top: 350 },
      getComputedStyle: () => ({ visibility: 'visible' }), visual,
    });
    assert.equal(visual.length, want.length);
    for (const band of want) assert.match(visual[0], new RegExp('under the ' + band));
  }
});
