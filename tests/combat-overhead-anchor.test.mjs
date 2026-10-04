import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { combatOverheadAnchorX, combatOverheadAnchors } from '../src/ui/models/CombatOverheadModel.js';
import { fitCombatSprites } from '../src/ui/models/CombatSpriteScaleModel.js';
import { presentationConfig } from '../src/model/advancedConfig.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../src/ui/fx.js';

const ownerAt = (controls, x) => controls.findLast(control =>
  x >= control.x - control.width / 2 && x <= control.x + control.width / 2)?.id;

test('half-field mobile figures keep distinct reachable intent anchors in the short portrait field', () => {
  const width = 390, height = 650 * .55;
  const plan = combatFormation({ width, height, presentation: presentationConfig(),
    friends: ['player'], enemies: ['right-enemy', 'front-enemy'] });
  const actors = plan.slots.map(slot => ({ slot, ratio: 1, leading: 66,
    visibleHeight: 180, visibleWidth: 180 }));
  const sizes = fitCombatSprites({ width, height, actors, minHeight: height * .5 });
  const enemies = plan.slots.filter(slot => slot.side === 'enemy');
  for (const widths of [[108, 62], [62, 62]]) {
    const prior = enemies.map((slot, i) => ({ id: slot.id,
      x: sizes.find(size => size.id === slot.id).x, width: widths[i] }));
    assert.notEqual(ownerAt(prior, prior[0].x), prior[0].id,
      'the inward art clamp reproduces the covered normal/XL intent centre');
    const controls = enemies.map((slot, i) => ({ id: slot.id, side: slot.side, row: slot.row,
      x: slot.x, width: widths[i] }));
    const anchors = combatOverheadAnchors({ width, controls });
    const fixed = controls.map(control => ({ ...control, x: anchors.find(anchor => anchor.id === control.id).x }));
    for (const control of fixed) {
      assert.equal(ownerAt(fixed, control.x), control.id, 'each intent centre answers to its own control');
      assert.ok(control.x - control.width / 2 >= 6);
      assert.ok(control.x + control.width / 2 <= width - 6);
    }
    const [left, right] = fixed.toSorted((a, b) => a.x - b.x);
    assert.ok(left.x + left.width / 2 + 6 <= right.x - right.width / 2,
      'whole intent boxes have six screen pixels of clearance, not just exposed centres');
  }
  assert.ok(sizes.every(size => size.visibleHeight >= height * .5 - 1e-9),
    'overhead placement does not reduce the requested half-field sprite height');
});

test('measured Inspect expansion preserves slot order and full overhead clearance', () => {
  const controls = [
    { id: 'outer', side: 'enemy', row: 1, x: 366, width: 164, top: 80, bottom: 128 },
    { id: 'inner', side: 'enemy', row: 1, x: 295, width: 62, top: 80, bottom: 128 },
    { id: 'player', side: 'player', row: 1, x: 42, width: 80 },
    { id: 'other-row', side: 'enemy', row: 0, x: 295, width: 62 },
    { id: 'other-band', side: 'enemy', row: 1, x: 295, width: 62, top: 10, bottom: 58 },
  ];
  const anchors = combatOverheadAnchors({ width: 390, controls });
  const x = id => anchors.find(anchor => anchor.id === id).x;
  assert.ok(x('inner') + 31 + 6 <= x('outer') - 82);
  assert.ok(x('inner') - 31 >= 6 && x('outer') + 82 <= 384);
  assert.equal(x('other-row'), 295, 'another formation row keeps its reserved anchor');
  assert.equal(x('other-band'), 295, 'different-stature overhead bands retain their reserved anchor');
  assert.equal(x('player'), 46, 'the opposite side retains its own edge clamp');
  const spaced = [{ id: 'a', side: 'enemy', row: 0, x: 700, width: 80 },
    { id: 'b', side: 'enemy', row: 0, x: 1000, width: 108 }];
  assert.deepEqual(combatOverheadAnchors({ width: 1440, controls: spaced }),
    spaced.map(({ id, x }) => ({ id, x })), 'already-separated controls do not move');
  const wide = combatOverheadAnchors({ width: 390, controls: [
    { id: 'outer', side: 'enemy', row: 1, x: 366, width: 200 },
    { id: 'inner', side: 'enemy', row: 1, x: 295, width: 62 },
  ] });
  assert.ok(wide.find(a => a.id === 'outer').x > wide.find(a => a.id === 'inner').x,
    'a wide edge clamp never reverses reserved slot order');
});

test('overhead offsets convert screen pixels once and retain the measured control box at UI zoom', () => {
  for (const zoom of [.65, .83, 1, 1.25]) {
    const fieldWidth = 390, reservedX = 366, artX = 294;
    const localControlWidth = 108 / zoom;
    const overheadX = combatOverheadAnchorX({ width: fieldWidth, x: reservedX,
      controlWidth: localControlWidth * zoom });
    const localOffset = anchorLocalBox(VIEWPORT_ORIGIN,
      { left: overheadX - artX, top: 0, width: 0, height: 0 }, { zoom }).left;
    assert.equal(artX + localOffset * zoom, overheadX);
    assert.ok(overheadX + localControlWidth * zoom / 2 <= fieldWidth - 6);
    assert.ok(overheadX - localControlWidth * zoom / 2 >= 6);
  }
});

test('an in-bounds reserved control anchor stays put independently of figure growth', () => {
  assert.equal(combatOverheadAnchorX({ width: 1440, x: 1030, controlWidth: 108 }), 1030);
  assert.equal(combatOverheadAnchorX({ width: 390, x: 8, controlWidth: 80 }), 46);
  assert.equal(combatOverheadAnchorX({ width: 390, x: 385, controlWidth: 80 }), 344);
  assert.equal(combatOverheadAnchorX({ width: 844, x: 800, controlWidth: 164 }), 756,
    'short-landscape side-by-side Inspect and intent reserve their full measured union');
});
