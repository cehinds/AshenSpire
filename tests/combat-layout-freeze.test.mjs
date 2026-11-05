// The layout freeze: a measure is kept per layout key, re-measured on a real layout change, and never kept mid-motion.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frozenSpriteBox, clearFrozenSpriteGeometry, invalidateSpriteRects } from '../src/ui/components/combatSpriteGeometry.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';

function rig({ stage = { settle() {} } } = {}) {
  const root = { dataset: {} };
  const previous = { document: globalThis.document, innerWidth: globalThis.innerWidth, innerHeight: globalThis.innerHeight };
  globalThis.document = { documentElement: root };
  globalThis.innerWidth = 1000; globalThis.innerHeight = 600;
  const stack = { style: { top: '10px' } };
  const living = [{ dataset: { eid: 'a' } }, { dataset: { eid: 'b' } }];
  let width = 80, reads = 0;
  const frame = { dataset: { eid: 'a', formationCell: '0' }, className: 'combatant', isConnected: true,
    closest: () => ({ querySelectorAll: () => living }), querySelector: () => stack,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 300, right: 200, bottom: 300 }) };
  const sprite = { offsetWidth: 100, offsetHeight: 100, className: 'sprite', style: { zoom: '1' },
    closest: () => frame, parentElement: frame,
    getBoundingClientRect: () => { reads++; return { left: 5, top: 6, width, height: 100 }; } };
  registerStage(sprite, stage);
  return { sprite, stack, living, frame, setWidth: v => { width = v; }, reads: () => reads,
    done: () => { for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; } clearFrozenSpriteGeometry(); } };
}
const read = r => { invalidateSpriteRects(); return frozenSpriteBox(r.sprite).width; };

test('the same layout key is measured once and then served from the freeze', () => {
  const r = rig();
  try { assert.equal(read(r), 80); r.setWidth(90); assert.equal(read(r), 80, 'frozen'); assert.equal(r.reads(), 1); } finally { r.done(); }
});

test('a changed layout key (living set, stack top, sprite zoom) measures again', () => {
  const r = rig();
  try {
    assert.equal(read(r), 80);
    r.setWidth(90); r.living.pop(); assert.equal(read(r), 90, 'living set');
    r.setWidth(95); r.stack.style.top = '14px'; assert.equal(read(r), 95, 'stack top');
    r.setWidth(99); r.sprite.style.zoom = '0.8'; assert.equal(read(r), 99, 'sprite zoom');
  } finally { r.done(); }
});

test('a measure taken during hitflash, act-* or a busy stage is not kept', () => {
  for (const cls of ['sprite hitflash', 'sprite act-attack', 'sprite hit-heavy']) {
    const r = rig();
    try {
      r.sprite.className = cls; assert.equal(read(r), 80);
      r.sprite.className = 'sprite'; r.setWidth(90); assert.equal(read(r), 90, `${cls} was not frozen`);
    } finally { r.done(); }
  }
  const busy = { busy: true, settle() {} }, r = rig({ stage: busy });
  try { assert.equal(read(r), 80); busy.busy = false; r.setWidth(90); assert.equal(read(r), 90, 'busy stage not frozen'); } finally { r.done(); }
});

test('a stage with no busy getter is not frozen while its frame has a finite animation running', () => {
  const r = rig();
  try {
    r.frame.getAnimations = () => [{ playState: 'running', effect: { getTiming: () => ({ iterations: 1 }) } }];
    assert.equal(read(r), 80);
    r.frame.getAnimations = () => []; r.setWidth(90);
    assert.equal(read(r), 90);
  } finally { r.done(); }
});
