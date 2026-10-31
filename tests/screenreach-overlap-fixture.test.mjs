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
  const start = tool.indexOf('  const visible = node => {', tool.indexOf('const INTENT_OVERLAP ='));
  const end = tool.indexOf('  const a = intent.getBoundingClientRect()', start);
  assert.ok(start >= 0 && end > start, 'execute only the canonical enemy-pair selection');
  const selection = tool.slice(start, end);
  for (const depths of [[200, 200, 200], [203, 201, 202], [200]]) {
    const parent = {};
    const frames = depths.map((z, index) => ({ index, parentElement: parent,
      classList: { contains: () => false }, querySelector: () => ({ zIndex: String(z),
        display: 'block', visibility: 'visible', getBoundingClientRect: () => ({ width:44, height:80 }) }) }));
    const run = () => runInNewContext(selection + '\n({ low, high })', {
      document: { querySelectorAll: () => frames }, getComputedStyle: sprite => sprite,
    });
    if (depths.length === 1) assert.throws(run, /missing its two enemies/, 'a single enemy cannot form a pair');
    else {
      const { low, high } = run();
      assert.equal(low, frames[depths.indexOf(Math.min(...depths))]);
      assert.ok(depths[high.index] >= depths[low.index]);
      assert.notEqual(high, low);
      if (depths[high.index] === depths[low.index]) {
        assert.equal(high.parentElement, low.parentElement);
        assert.ok(high.index > low.index, 'later sibling paints over the earlier intent');
      }
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
      dataset: { eid: 'e1' }, closest: () => ({ dataset: { targetHud: String(responsive) }, querySelectorAll: () => [] }),
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


test('responsive painted guard reads detached detail panels and status siblings from their combat layer', () => {
  const start = tool.indexOf("    for (const frame of document.querySelectorAll('.enemy-row .combatant'))");
  const end = tool.indexOf('    // Information is', start);
  const guard = tool.slice(start, end);
  const node = (top, bottom) => ({ getBoundingClientRect: () => ({ width: 40, height: bottom - top, top, bottom }) });
  const sprite = node(120, 200), panel = node(80, 140), statuses = node(330, 370);
  const shells = [{ dataset: { eid: 'e1' }, querySelectorAll: () => [panel, statuses] }];
  const combat = { dataset: { targetHud: 'true' }, querySelectorAll: () => shells };
  const frame = { dataset: { eid: 'e1' }, closest: () => combat, querySelector: () => null,
    querySelectorAll: () => [sprite] };
  const visual = [];
  runInNewContext(guard, { document: { querySelectorAll: () => [frame] }, hud: { bottom: 100 },
    hand: { top: 350 }, getComputedStyle: () => ({ visibility: 'visible' }), visual });
  assert.equal(visual.length, 2);
  assert.match(visual[0], /under the HUD/);
  assert.match(visual[1], /under the hand/);
});

test('zero-size proxies use artwork; undersized or noninteractive drawn proxies still face the patch check', () => {
  const start = tool.indexOf("    if (c.matches('.combatant[data-ui-component=");
  const end = tool.indexOf('    // A tall neighbouring enemy', start);
  const check = tool.slice(start, end);
  for (const [width, height, expectFrame] of [[0, 0, false], [0, 44, false], [10, 10, true], [44, 44, true]]) {
    const sprite = { getBoundingClientRect: () => ({ width: 64, height: 64 }) };
    const frame = { dataset: {}, querySelector: () => sprite, contains: () => false,
      matches: selector => selector !== '.player' };
    const calls = [];
    runInNewContext('for (const c of [frame]) {\n' + check + '\n}', {
      frame, z: 1, r: { left: 0, top: 0 }, frameOwnsHit: () => false,
      getComputedStyle: () => ({ display: 'block', content: '""', left: '32px', top: '32px',
        width: width + 'px', height: height + 'px', pointerEvents: 'none' }),
      exposedPatch: target => { calls.push(target); return true; },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0], expectFrame ? frame : sprite);
  }
});

test('overlap artwork growth composes with an already scaled fighter', () => {
  const start = tool.indexOf('  const existingScale =');
  const end = tool.indexOf('  const grown =', start);
  const growth = tool.slice(start, end);
  for (const scale of [1, .5, .16]) {
    const sprite = { style: {} };
    const initial = { width: 100 * scale, height: 160 * scale };
    runInNewContext(growth, { sprite, initial, a: { width: 44, height: 37 },
      getComputedStyle: () => ({ scale: String(scale) }) });
    const factor = Number(sprite.style.scale);
    assert.ok(100 * factor >= 60);
    assert.ok(160 * factor >= 101);
    assert.ok(100 * factor <= 100, 'a previously small actor grows only enough for the intended overlap');
  }
});
