import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { targetBodyHudPlacement } from '../src/ui/models/TargetHudModel.js';

const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const start = source.indexOf('  function centerTargetOverheads()');
const end = source.indexOf('\n  function placePlayerHud(', start);

test('native mini and selected intent follow true pose body heads at every form factor', () => {
  for (const [formFactor, zoom] of [['mobile', 1], ['tablet', 1.25], ['desktop', 1.6]]) {
    const values = new Map([['--combat-mini-hud-left', '19px'], ['--combat-mini-hud-width', '145px']]);
    let body;
    const leading = {};
    const sprite = {};
    const frameRect = { left: 12, top: 75 };
    const rack = { querySelector: () => ({ getBoundingClientRect: () => ({ height: 37 }) }) };
    const frame = { dataset: {}, style: { setProperty: (name, value) => values.set(name, value) },
      getBoundingClientRect: () => frameRect,
      querySelector: selector => selector === '.sprite' ? sprite : selector === '.combatant-leading' ? leading : rack };
    const combat = { querySelector: () => null };
    const field = { querySelectorAll: () => [frame], closest: () => combat };
    const align = runInNewContext(source.slice(start, end) + '\ncenterTargetOverheads', {
      uiZoom: () => zoom, field, schedule() {}, targetBodyHudPlacement,
      uiConfig: { presentation: { combatFormationModel: { positioning: { perspectiveGrid: { miniHudGroupHeightPx: 61, miniHudSpriteGapPx: 5 } } } } },
      currentSpriteBodyBounds: () => body, placeHitBadges() {}, readHitBadges: () => null,
    });
    for (const [pose, head, weaponTop] of [['idle', 410, 400], ['attack', 390, 240], ['smash', 360, 190], ['defend', 420, 300], ['counter', 375, 200], ['casting', 395, 160]]) {
      body = { headY: head, feetY: head + 160, top: weaponTop, left: 55, right: 145 };
      align();
      const miniTop = parseFloat(values.get('--combat-mini-hud-top'));
      const intentTop = parseFloat(values.get('--combat-selected-intent-top'));
      assert.ok(Math.abs(head - (frameRect.top + miniTop * zoom + 61) - 5) < 1e-9, `${formFactor}/${pose}: full mini group clears body head`);
      assert.ok(Math.abs(head - (frameRect.top + intentTop * zoom + 37) - 5) < 1e-9, `${formFactor}/${pose}: selected intent clears body head`);
      assert.equal(values.get('--combat-mini-hud-left'), '19px', 'pose never changes cell-aligned left edge');
      assert.equal(values.get('--combat-mini-hud-width'), '145px', 'pose never changes cell-sized HP width');
      assert.equal(Number(frame.dataset.miniHudHeadY), head);
    }
  }
});

test('reduced motion settles a deliberate pose once without starting an idle tracking loop', () => {
  const begin = source.indexOf('  const poseObserver = new MutationObserver(');
  const finish = source.indexOf('\n  poseObserver.observe(', begin);
  let callback, settled = 0, requested = 0;
  const context = { MutationObserver: class { constructor(fn) { callback = fn; } }, reducedMotionRequested: () => true,
    field: { closest: () => ({ dataset: { targetHud: 'true' } }) }, centerTargetOverheads: () => settled++,
    trackingRequest: 0, requestAnimationFrame: () => requested++, trackPlayerHud() {} };
  runInNewContext(source.slice(begin, finish), context);
  callback();
  assert.equal(settled, 1);
  assert.equal(requested, 0);
});
