import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wireAlternativeBackdrop } from '../src/ui/alternativeArt.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('only combat clamps the scenery floor; dialogue keeps its own floor line', () => {
  const art = read('../src/ui/alternativeArt.js');
  assert.match(art, /fitAlternativeBackdrop\(combat, \{[^}]*coverFloor = false[^}]*\}\)/, 'the clamp is opt-in');
  assert.match(art, /const cameraGround = coverFloor\s*\?/);
  const stage = read('../src/ui/components/battlefieldStage.js');
  const combatCall = stage.slice(stage.indexOf('fitAlternativeBackdrop(combat, {'), stage.indexOf('});', stage.indexOf('fitAlternativeBackdrop(combat, {')));
  assert.match(combatCall, /coverFloor: true/);
  const dialogue = read('../src/ui/components/dialogueStage.js');
  const at = dialogue.indexOf('fitAlternativeBackdrop(wrap, {');
  assert.ok(at >= 0);
  assert.doesNotMatch(dialogue.slice(at, dialogue.indexOf('});', at)), /coverFloor/, 'dialogue honours its 60% floor split');
});


test('backdrop pointer motion stays canonical when reduced, ambient-off or touch', () => {
  const saved = Object.fromEntries(['document', 'matchMedia', 'MutationObserver'].map(key => [key, globalThis[key]]));
  let setting = false, os = false, ambient = 'on', reads = 0, writes = 0, transform = '';
  const handlers = new Map(), mediaHandlers = new Map();
  const layer = { dataset: { depth: '2' }, firstElementChild: { dataset: { layer: 'far' } },
    style: { get transform() { return transform; }, set transform(value) { writes++; transform = value; } } };
  const combat = {
    querySelectorAll: () => [layer], querySelector: () => null,
    getBoundingClientRect: () => { reads++; return { left: 0, top: 0, width: 100, height: 100 }; },
    addEventListener: (type, fn) => handlers.set(type, fn), removeEventListener: type => handlers.delete(type),
  };
  globalThis.document = { body: { classList: { contains: () => setting } }, documentElement: { dataset: { get ambient() { return ambient; } } } };
  globalThis.matchMedia = () => ({ get matches() { return os; }, addEventListener: (type, fn) => mediaHandlers.set(type, fn), removeEventListener: type => mediaHandlers.delete(type) });
  globalThis.MutationObserver = undefined;
  try {
    const dispose = wireAlternativeBackdrop(combat);
    const move = pointerType => handlers.get('pointermove')({ clientX: 100, clientY: 100, pointerType });
    move('mouse');
    assert.equal(transform, 'translate(18px,6px)', 'active parallax retains authored depth offsets');
    assert.equal(reads, 1);
    for (const mode of ['setting', 'os', 'both', 'ambient', 'touch']) {
      setting = mode === 'setting' || mode === 'both'; os = mode === 'os' || mode === 'both'; ambient = mode === 'ambient' ? 'off' : 'on';
      const beforeReads = reads;
      move(mode === 'touch' ? 'touch' : 'mouse');
      assert.equal(transform, '', mode + ' settles to the identity');
      const settledWrites = writes;
      handlers.get('pointerleave')(); move(mode === 'touch' ? 'touch' : 'mouse'); handlers.get('pointerleave')();
      assert.equal(writes, settledWrites, mode + ' does not alternate equivalent identity transforms');
      assert.equal(reads, beforeReads, mode + ' does not read layout');
      setting = os = false; ambient = 'on'; move('mouse');
      assert.equal(transform, 'translate(18px,6px)');
    }
    handlers.get('pointerleave')(); assert.equal(transform, '');
    dispose(); assert.equal(handlers.size, 0); assert.equal(mediaHandlers.size, 0);
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});

// Owner 2026-10-31: the painted ground never starts below the back rank's cell top, so the grid's back edge stands
// on ground. Measured in Chromium: data-mobile-floor-paint-top equals band A's top at 1280x800, 1200x730 and 390x844.
test('combat passes the back rank top as a ceiling for the painted ground', () => {
  const art = read('../src/ui/alternativeArt.js');
  assert.match(art, /floorTop/);
  assert.match(art, /Math\.min\(floorShadowTop - floor\.shadowClearancePx \/ zoom, floorTop\)/);
  const stage = read('../src/ui/components/battlefieldStage.js');
  const combatCall = stage.slice(stage.indexOf('fitAlternativeBackdrop(combat, {'), stage.indexOf('});', stage.indexOf('fitAlternativeBackdrop(combat, {')));
  assert.match(combatCall, /floorTop: plan\.visualBands\?\.length \? fieldTop \+ plan\.visualBands\[0\]\.top \/ zoom/);
});
