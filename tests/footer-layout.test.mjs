import assert from 'node:assert/strict';
import { footerLayout, footerSizing } from '../src/content/footerLayout.js';
import { footerBounds, footerLayoutModel, footerText, footerArtHeight, footerStaminaLayers } from '../src/ui/models/FooterLayoutModel.js';
import { allocateCombatBands, packCombatFooter } from '../src/ui/models/CombatLayout.js';

const plan = footerLayoutModel(footerLayout);
for (const role of ['sp', 'draw', 'end', 'discard', 'potions']) {
  assert.ok(plan.groups[role].items.length, `${role} has independently rendered layers`);
  assert.ok(plan.groups[role].bounds.w > 0);
}
const joined = footerLayoutModel({ ...footerLayout, items: footerLayout.items.map(n => ({ ...n, group: 'joined-rail-a' })) });
for (const role of Object.keys(plan.groups)) {
  assert.deepEqual(joined.groups[role].items.map(n => n.id), plan.groups[role].items.map(n => n.id), 'docking never rebinds game actions');
  assert.deepEqual(joined.groups[role].bounds, plan.groups[role].bounds);
}
const count = footerLayout.items.find(n => n.binding === 'draw');
assert.equal(footerText(count, { draw: 0 }), '0');
assert.equal(footerText(count, { draw: 37 }), '37');
assert.equal(footerText({ binding: 'discard', text: '{label} {value}' }, { discard: 4, discardLabel: 'Spent' }), 'Spent 4');
assert.equal(footerText({ text: '<img src=x>', binding: 'static' }, {}), '<img src=x>', 'literal text is handed to textContent');
const moved = footerLayoutModel({ ...footerLayout, items: footerLayout.items.map(n => n.asset === 'draw' || n.binding?.startsWith('draw') ? { ...n, x: n.x + 60 } : n) });
assert.equal(moved.groups.draw.bounds.x, plan.groups.draw.bounds.x + 60);
assert.deepEqual(footerBounds([]), { x: 0, y: 0, w: 1, h: 1 });
assert.equal(footerArtHeight(1000, 1), footerSizing.maximumWidthPx * plan.bounds.h / plan.bounds.w);
assert.equal(footerArtHeight(500, 2) * 2, footerArtHeight(1000, 1), 'physical footer proportions survive UI zoom');
assert.equal(footerArtHeight(195, 2), 32);
for (const width of [288, 320, 390]) {
  assert.equal(footerArtHeight(width), 64, 'compact footer reserves primary controls without the desktop art canvas');
  assert.equal(footerArtHeight(width / 2, 2) * 2, 64, 'compact height stays physical at UI zoom');
  for (const zoom of [1, 1.5, 2]) {
    const compact = packCombatFooter({ width: width / zoom, height: 64 / zoom, zoom, rem: 24 });
    assert.ok(compact.supported && compact.groupWidth <= width / zoom);
    assert.equal(compact.pileWidth * zoom, 44);
    // The 64px cap (compactCombat.footerDiameterMaxPx) or the band height, whichever binds.
    assert.ok(compact.diameter * zoom > 52 && compact.diameter * zoom <= 64 + 1e-9);
    assert.ok(compact.endWidth * zoom >= 56, 'the primary action stays larger than either pile');
    assert.ok(compact.diameter > compact.pileWidth, 'resources and potions outrank piles');
  }
}
for (const [width, height] of [[1280, 900], [390, 844], [844, 390]]) {
  const base = allocateCombatBands({ width, height });
  const art = allocateCombatBands({ width, height, footerArtPx: footerArtHeight(width) });
  assert.ok(art.arrangement === 'rails' || art.footer >= base.footer);
  assert.ok(art.hand >= base.hand || art.arrangement === 'rails');
}
for (const capacity of [0, 3, 6, 12, 18]) {
  const resource = { gems: Array.from({ length: capacity }, (_, i) => ({ id: i < 2 ? 'diamond' : 'spent' })) };
  const layers = footerStaminaLayers(footerLayout, resource);
  assert.equal(layers.filter(n => ['diamond', 'spent'].includes(n.asset)).length, capacity);
  assert.equal(layers.filter(n => n.asset === 'diamond').length, Math.min(capacity, 2));
  const reordered = footerStaminaLayers({ ...footerLayout, items: [...footerLayout.items].reverse() }, resource);
  assert.deepEqual(reordered.filter(n => ['diamond', 'spent'].includes(n.asset)), layers.filter(n => ['diamond', 'spent'].includes(n.asset)), 'stacking order must not change live mana sockets');
  const hidden = { ...footerLayout, items: footerLayout.items.map(n => n.asset === 'frame' ? { ...n, visible: false } : n) };
  assert.equal(footerStaminaLayers(hidden, resource).some(n => n.asset === 'frame'), false);
  const shifted = { ...footerLayout, items: footerLayout.items.map(n => n.asset === 'orb' ? { ...n, x: n.x + 20, w: n.w * .8 } : n) };
  const orb = footerStaminaLayers(shifted, resource).find(n => n.asset === 'orb');
  assert.equal(orb.x, footerLayout.items.find(n => n.asset === 'orb').x + 20);
  assert.equal(orb.w, footerLayout.items.find(n => n.asset === 'orb').w * .8);
}
console.log('footer-layout: bindings, docking, authored SP art and live mana capacity pass');
