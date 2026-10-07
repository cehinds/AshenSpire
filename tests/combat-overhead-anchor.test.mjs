import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { combatOverheadAnchorX, combatOverheadAnchors, combatOverheadRibbonShift } from '../src/ui/models/CombatOverheadModel.js';
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
  // #1606: the fit moves a side's art as one group, so its figures no longer
  // collapse onto one x; the overhead anchors below stay independent of it.
  const artXs = enemies.map(slot => sizes.find(size => size.id === slot.id).x);
  assert.ok(Math.abs((artXs[1] - artXs[0]) - (enemies[1].x - enemies[0].x)) < 1e-9);
  for (const widths of [[108, 62], [62, 62]]) {
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
  const plain = fitCombatSprites({ width, height, actors });
  assert.ok(sizes.every((size, i) => size.visibleHeight >= plain[i].visibleHeight - 1e-9),
    'the half-field floor never makes a figure smaller than its plain fit');
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

test('full-height enemies from separate formation rows keep every intent reachable when their fitted bands coincide', () => {
  for (const width of [320, 375]) {
    const controls = [
      { id: 'rear', side: 'enemy', row: 0, x: width - 35, width: 62, top: 80, bottom: 128 },
      { id: 'front-left', side: 'enemy', row: 1, x: width - 100, width: 50, top: 80, bottom: 128 },
      { id: 'front-right', side: 'enemy', row: 1, x: width - 35, width: 62, top: 80, bottom: 128 },
      { id: 'separate-band', side: 'enemy', row: 0, x: width - 35, width: 62, top: 180, bottom: 228 },
    ];
    const anchors = combatOverheadAnchors({ width, controls });
    const band = controls.slice(0, 3).map(control => ({ ...control, x: anchors.find(anchor => anchor.id === control.id).x }));
    for (const control of band) {
      assert.equal(ownerAt(band, control.x), control.id, 'each physical intent centre belongs to its own control');
      assert.ok(control.x - control.width / 2 >= 6 && control.x + control.width / 2 <= width - 6);
    }
    const ordered = band.toSorted((a, b) => a.x - b.x);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(ordered[i - 1].x + ordered[i - 1].width / 2 + 6 <= ordered[i].x - ordered[i].width / 2,
        'different formation rows still reserve a complete six-pixel physical gap');
    }
    assert.equal(anchors.find(anchor => anchor.id === 'separate-band').x, width - 37,
      'a vertically separate intent retains only its original edge clamp');
  }
});

test('an in-bounds reserved control anchor stays put independently of figure growth', () => {
  assert.equal(combatOverheadAnchorX({ width: 1440, x: 1030, controlWidth: 108 }), 1030);
  assert.equal(combatOverheadAnchorX({ width: 390, x: 8, controlWidth: 80 }), 46);
  assert.equal(combatOverheadAnchorX({ width: 390, x: 385, controlWidth: 80 }), 344);
  assert.equal(combatOverheadAnchorX({ width: 844, x: 800, controlWidth: 164 }), 756,
    'short-landscape side-by-side Inspect and intent reserve their full measured union');
});

test('ribbon clearance repacks the final physical bands without moving already clear controls', () => {
  const ribbon = { left: 100, right: 240, top: 100, bottom: 140 };
  const controls = [
    { id: 'shifted', side: 'enemy', row: 0, x: 200, width: 62, top: 80, bottom: 128 },
    { id: 'unshifted', side: 'enemy', row: 1, x: 200, width: 62, top: 150, bottom: 198 },
    { id: 'above', side: 'enemy', row: 0, x: 200, width: 62, top: 20, bottom: 68 },
    { id: 'player', side: 'player', row: 0, x: 40, width: 44, top: 80, bottom: 124 },
  ];
  const anchors = combatOverheadAnchors({ width: 320, controls, ribbon });
  const byId = id => anchors.find(a => a.id === id);
  assert.equal(byId('shifted').offsetY, 74);
  assert.equal(byId('unshifted').offsetY, 0);
  assert.ok(Math.abs(byId('shifted').x - byId('unshifted').x) >= 62 + 6,
    'a ribbon-shifted row reserves clearance from its new physical neighbour');
  assert.deepEqual(byId('above'), {id:'above',x:200,offsetY:0});
  assert.deepEqual(byId('player'), {id:'player',x:40,offsetY:0});
  assert.equal(combatOverheadRibbonShift({x:200,width:62,top:20,bottom:68,ribbon}),0,
    'a control fully above the ribbon keeps its ordinary anchor');
});
