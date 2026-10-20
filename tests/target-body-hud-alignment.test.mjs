import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { targetBodyHudPlacement } from '../src/ui/models/TargetHudModel.js';
import { currentSpriteBodyBounds } from '../src/ui/components/combatSpriteGeometry.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';

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
  callback([{ attributeName: 'data-pose', oldValue: 'idle',
    target: { getAttribute: () => 'guard' } }]);
  assert.equal(settled, 1);
  assert.equal(requested, 0);
});


test('every target body is measured before inherited HUD coordinates are written', () => {
  const operations = [];
  const frames = [1, 2, 3].map(id => ({
    dataset: {},
    style: { setProperty: () => operations.push(`write:${id}`) },
    getBoundingClientRect: () => { operations.push(`read:${id}`); return { left: 0, top: 0 }; },
    querySelector: selector => selector === '.sprite' ? { id } : selector === '.combatant-leading' ? {} : {
      querySelector: () => ({ getBoundingClientRect: () => ({ height: 37 }) }),
    },
  }));
  // A partially mounted combatant has no sprite yet and must stay untouched.
  frames.push({ querySelector: () => null });
  const align = runInNewContext(source.slice(start, end) + '\ncenterTargetOverheads', {
    uiZoom: () => 1.25, field: { querySelectorAll: () => frames, closest: () => ({ dataset: {}, querySelector: () => null }) },
    schedule() {}, readHitBadges: () => null, targetBodyHudPlacement,
    uiConfig: { presentation: { combatFormationModel: { positioning: { perspectiveGrid: { miniHudGroupHeightPx: 61, miniHudSpriteGapPx: 5 } } } } },
    currentSpriteBodyBounds: sprite => ({ headY: 400, feetY: 560, top: 380, left: sprite.id * 50, right: sprite.id * 50 + 40 }),
  });
  align();
  assert.equal(operations.filter(op => op.startsWith('read:')).length, 3);
  const firstWrite = operations.findIndex(op => op.startsWith('write:'));
  assert.ok(firstWrite > operations.lastIndexOf('read:3'), 'all targets read before the first style invalidation');
  assert.ok(operations.slice(firstWrite).every(op => op.startsWith('write:')), 'no later target forces layout after a coordinate write');
  for (const frame of frames.slice(0, 3)) assert.equal(frame.dataset.miniHudHeadY, '400');
});


test('body geometry snapshots an authored getter once and retains unregistered fallback bounds', () => {
  let reads = 0;
  const sprite = {};
  const body = { headY: 120, feetY: 280, left: 20, right: 80 };
  registerStage(sprite, { get currentBody() { reads++; return body; } });
  assert.equal(currentSpriteBodyBounds(sprite), body);
  assert.equal(reads, 1, 'one layout-backed getter read per measured figure');
  const rect = { top: 20, bottom: 120, left: 10, right: 50, width: 40, height: 100 };
  const fallback = currentSpriteBodyBounds({ querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => rect });
  assert.equal(fallback.headY, 20);
  assert.equal(fallback.feetY, 120);
  assert.equal(fallback.bodyHeight, 100);
  assert.equal(fallback.source, 'unregistered');
});
