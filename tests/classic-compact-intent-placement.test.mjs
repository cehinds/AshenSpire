// Execute the production read/packing step with measured control boxes. Native
// browser QA owns text paint, hit testing and the final stylesheet cascade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withKitDom } from './helpers/kit-dom.mjs';
import { combatHeaderKeepoutBottom } from '../src/ui/components/battlefieldStage.js';
import { combatOverheadAnchors } from '../src/ui/models/CombatOverheadModel.js';

const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const start = source.indexOf('    // Classic compact intents can');
const end = source.indexOf('    for (const move of intentMoves) {', start);
assert(start >= 0 && end > start);
const place = new Function('classicAppearance', 'intentMoves', 'fieldRect', 'combat', 'zoom',
  'readRestingHand', 'visibleCombatPanelRect', 'combatOverheadAnchors', 'combatHeaderKeepoutBottom', source.slice(start, end));
const rect = (x, y, width, height) => ({ x, y, left: x, right: x + width, top: y, bottom: y + height, width, height });
const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function fixture({ classic = true, hud = 'false', selected = false, hidden = false, zeroSize = false, header = null } = {}) {
  // Frozen1795 two-enemy phone repro: the known primary is173.6px wide;
  // the neighboring concealed action retains88px. The old first box escapes390px.
  const boxes = [rect(231.421875, 104.01413, 173.609375, 26), rect(125.5625, 110.00813, 88, 26)];
  const hp = rect(238, 130, 132, 38);
  let reads = 0, anchors = [];
  const combat = { dataset: { targetHud: hud }, querySelector: () => { reads++; return header || { getBoundingClientRect: () => rect(0, 0, 390, 100.390625), querySelectorAll: () => [] }; },
    querySelectorAll: () => { reads++; return [hp]; } };
  const moves = boxes.map((box, index) => ({ frame: { dataset: { eid: 'e' + index } }, selected,
    intent: { hidden, getBoundingClientRect: () => zeroSize ? rect(0, 0, 0, 0) : box }, dx: 0, dy: 0 }));
  place(() => classic, moves, rect(0, 100.390625, 390, 400), combat, 1,
    () => ({ clearanceTop: 500 }), node => {
      if (node.hidden) return null;
      const box = node.getBoundingClientRect ? node.getBoundingClientRect() : node;
      return box.width > 0 && box.height > 0 ? box : null;
    }, options => { anchors = combatOverheadAnchors(options); return anchors; }, combatHeaderKeepoutBottom);
  return { boxes, hp, moves, reads, anchors, placed: moves.map((move, index) => {
    const box = boxes[index]; return rect(box.x + move.dx, box.y + move.dy, box.width, box.height);
  }) };
}

test('wide Classic compact controls clear the header, their HP strip and each other without resizing', () => {
  const result = fixture();
  assert(result.boxes[0].right > 390, 'the measured old position reproduces the viewport escape');
  for (let index = 0; index < result.placed.length; index++) {
    const box = result.placed[index];
    assert(box.left >= 6 && box.right <= 384, 'complete native button stays inside the phone');
    assert(box.top >= 106.390625, 'complete control clears the header');
    assert(!overlap(box, result.hp), 'the control cannot cover its own health strip');
    assert.equal(box.width, result.boxes[index].width);
    assert.equal(box.height, result.boxes[index].height);
  }
  assert(!overlap(...result.placed), 'the two native hit rectangles remain distinct');
  assert(result.anchors.every(anchor => !anchor.obstructed), 'the packer found actual clear placements');
});

test('selected Classic and default/alternative controls retain their exact positions without obstacle reads', () => {
  for (const mode of [{ selected: true }, { hud: 'true' }, { classic: false }, { hidden: true }, { zeroSize: true }]) {
    const result = fixture(mode);
    assert.deepEqual(result.placed, result.boxes, JSON.stringify(mode));
    assert.equal(result.reads, 0, 'excluded or empty modes do no geometry work');
  }
});


test('Classic packing clears absolute information rows below the header box', () => withKitDom(({ document }) => {
  const header = document.createElement('header');
  header.getBoundingClientRect = () => rect(0, 0, 390, 100.390625);
  const row = document.createElement('div'); row.className = 'hud-info-row';
  row.getBoundingClientRect = () => rect(240, 100.390625, 132, 19);
  header.append(row);
  const result = fixture({ header });
  for (const box of result.placed) {
    assert(box.top >= 125.390625, 'the full button clears the visible absolute row plus its gap');
    assert(!overlap(box, result.hp));
  }
  assert(result.anchors.every(anchor => !anchor.obstructed), 'no obstructed fallback is accepted');
  assert(!overlap(...result.placed));
}));
