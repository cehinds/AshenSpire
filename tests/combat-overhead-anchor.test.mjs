import test from 'node:test';
import assert from 'node:assert/strict';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { combatOverheadAnchorX, combatOverheadAnchors, combatOverheadRibbonShift, combatTargetAnchors } from '../src/ui/models/CombatOverheadModel.js';
import { fitCombatSprites } from '../src/ui/models/CombatSpriteScaleModel.js';

test('short-phone fitted feet keep separate full tap areas without changing the artwork', () => {
  const targets = [
    { id: 'player', x: 89.047, y: 237.891 },
    { id: 'e1', x: 283.586, y: 242.203 },
    { id: 'e2', x: 214.945, y: 242.203 },
    { id: 'e3', x: 275.867, y: 242.219 },
  ];
  const before = structuredClone(targets);
  const packed = combatTargetAnchors({ width: 390, height: 275.203, targets });
  assert.deepEqual(targets, before, 'measured sprite feet are inputs, never moved');
  const sorted = packed.toSorted((a, b) => a.x - b.x);
  for (const target of sorted) {
    assert.ok(target.x - 22 >= 0 && target.x + 22 <= 390);
    assert.ok(target.y - 22 >= 0 && target.y + 22 <= 275.203);
    assert.equal(target.y, before.find(t => t.id === target.id).y);
  }
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].x - sorted[i - 1].x >= 46,
    'all final target rectangles, including coincident formation rows, have clearance');
  assert.notEqual(packed.find(t => t.id === 'e3').x, before.find(t => t.id === 'e3').x);
});

test('tap target packing preserves unconstrained feet and clamps only targets to stage edges', () => {
  const targets = [{ id: 'player', x: 60, y: 100 }, { id: 'enemy', x: 300, y: 200 }];
  assert.deepEqual(combatTargetAnchors({ width: 390, height: 300, targets }), targets);
  assert.deepEqual(combatTargetAnchors({ width: 390, height: 300,
    targets: [{ id: 'edge', x: 389, y: 299 }] }), [{ id: 'edge', x: 368, y: 278 }]);
});

test('packed frame targets reserve their visible health footer as the owner cue', () => {
  const targets = [{ id: 'e1', x: 284, y: 242, width: 70 },
    { id: 'e2', x: 215, y: 242, width: 70 }, { id: 'e3', x: 276, y: 242, width: 70 }];
  const packed = combatTargetAnchors({ width: 390, height: 275, targets }).toSorted((a,b) => a.x-b.x);
  assert.ok(packed.every(target => target.x - 35 >= 0 && target.x + 35 <= 390));
  for (let i=1;i<packed.length;i++) assert.ok(packed[i].x-packed[i-1].x>=72,
    'whole visible footers have clearance, not only invisible targets');
  assert.ok(packed.every(target => target.y === 242));
});

test('short landscape overheads pack intersecting rows despite a wide stage', () => {
  const controls = [
    { id: 'e1', side: 'enemy', x: 788.18, width: 58.704, top: 75.89, bottom: 123.89 },
    { id: 'e2', side: 'enemy', x: 639.63, width: 58.704, top: 75.89, bottom: 123.89 },
    { id: 'e3', side: 'enemy', x: 771.48, width: 58.704, top: 53.16, bottom: 101.16 },
  ];
  const packed = combatOverheadAnchors({ width: 844, controls }).toSorted((a,b)=>a.x-b.x);
  for(let i=1;i<packed.length;i++) assert.ok(packed[i].x-packed[i-1].x>=64.704-1e-9,
    'wide aspect does not waive the full measured intent clearance');
  assert.deepEqual(combatOverheadAnchors({ width: 1440, controls }),
    combatOverheadAnchors({ width: 844, controls }), 'packing follows measured bands rather than a phone breakpoint');
});
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

test('actual 844x390 XL foot targets and health footers clear final intent boxes inside the 139.86px stage', () => {
  const fieldTop = 47.140625, height = 139.859375, footerWidth = 115.859375;
  const targets = [
    { id: 'player', x: 77.125, y: 136.796875 - fieldTop, width: footerWidth },
    { id: 'e1', x: 788.1796875, y: 138.984375 - fieldTop, width: footerWidth },
    { id: 'e2', x: 639.6328125, y: 138.984375 - fieldTop, width: footerWidth },
    { id: 'e3', x: 771.4765625, y: 116.25 - fieldTop, width: footerWidth },
  ];
  const obstacles = [
    { left: 758.828125, right: 817.53125, top: 75.890625 - fieldTop, bottom: 123.890625 - fieldTop },
    { left: 610.28125, right: 668.984375, top: 75.890625 - fieldTop, bottom: 123.890625 - fieldTop },
    { left: 694.15625, right: 752.859375, top: 53.15625 - fieldTop, bottom: 101.15625 - fieldTop },
  ];
  const anchors = combatTargetAnchors({ width: 844, height, targets, obstacles });
  for (const anchor of anchors) {
    assert.ok(anchor.x - 22 >= 0 && anchor.x + 22 <= 844);
    assert.ok(anchor.y - 22 >= 0 && anchor.y + 22 <= height);
    assert.equal(anchor.obstructed, undefined);
    for (const obstacle of obstacles) assert.ok(anchor.x + footerWidth / 2 <= obstacle.left
      || anchor.x - footerWidth / 2 >= obstacle.right || anchor.y + 22 <= obstacle.top
      || anchor.y - 22 >= obstacle.bottom, `${anchor.id}: complete target/footer band avoids final intent`);
  }
  assert.equal(anchors.find(a => a.id === 'player').y, targets[0].y, 'clear player anchor stays put');
  assert.equal(anchors.find(a => a.id === 'e3').y + fieldTop, 147.890625,
    'Wisp clears its actual neighbour bottom by 22px half-target plus 2px gap');
  const settled = targets.map(target => ({ ...target, ...anchors.find(a => a.id === target.id) }));
  assert.deepEqual(combatTargetAnchors({ width: 844, height, targets: settled, obstacles }), anchors,
    'settled positions are idempotent');
  for (const zoom of [.62, .83, 1, 1.25]) {
    const wisp = anchors.find(a => a.id === 'e3'), original = targets.find(a => a.id === 'e3');
    const offset = anchorLocalBox(VIEWPORT_ORIGIN, {left:wisp.x-original.x,top:wisp.y-original.y,width:0,height:0},{zoom});
    assert.equal(original.x + offset.left * zoom, wisp.x);
    assert.equal(original.y + offset.top * zoom, wisp.y, 'footer and target translate once in both axes');
  }
});

test('intent clearance repacks a newly joined footer band without shifting clear targets', () => {
  const targets = [{id:'shifted',x:120,y:30,width:70},{id:'unshifted',x:120,y:84,width:70},
    {id:'clear',x:300,y:200,width:70}];
  const anchors = combatTargetAnchors({width:390,height:240,targets,
    obstacles:[{left:95,right:145,top:40,bottom:60}]});
  const shifted=anchors.find(a=>a.id==='shifted'),unshifted=anchors.find(a=>a.id==='unshifted');
  assert.equal(shifted.y,84);
  assert.ok(Math.abs(shifted.x-unshifted.x)>=72,'final intersecting 70px footer bands have a 2px gap');
  assert.deepEqual(anchors.find(a=>a.id==='clear'),{id:'clear',x:300,y:200});
});

test('insufficient stage room is reported rather than placing a target over another control or outside the stage', () => {
  const anchors=combatTargetAnchors({width:120,height:60,targets:[{id:'a',x:60,y:30}],
    obstacles:[{left:0,right:120,top:0,bottom:60}]});
  assert.deepEqual(anchors,[{id:'a',x:60,y:30,obstructed:true}]);
  assert.ok(anchors[0].y-22>=0&&anchors[0].y+22<=60);
});

test('aligned target plates resolve crowded footers vertically', () => {
  const placed = combatTargetAnchors({ width:390,height:500,size:54,lockX:true,
    targets:[{id:'a',x:180,y:250,width:96},{id:'b',x:200,y:250,width:96}] });
  assert.equal(placed[0].x,180); assert.equal(placed[1].x,200);
  assert(placed[1].y-placed[0].y>=56);
  assert(placed.every(p=>!p.obstructed));
});

test('actual 1200x730 XL floor targets find upward room without detaching their columns', () => {
  const height=303.1875, size=54.3906;
  const targets=[{id:'e1',x:765.57815,y:272.773,width:96},
    {id:'e2',x:554.39065,y:272.773,width:96},
    {id:'e3',x:741.82815,y:248.586,width:96}];
  const obstacles=[{left:706,right:778,top:100,bottom:140}];
  const placed=combatTargetAnchors({width:1200,height,size,targets,obstacles,lockX:true});
  const e1=placed.find(p=>p.id==='e1'),e3=placed.find(p=>p.id==='e3');
  assert.equal(e1.x,targets[0].x);assert.equal(e3.x,targets[2].x);
  assert.ok(e1.y+size/2+2<=e3.y-size/2,'complete target bands clear at least two pixels');
  assert.ok(e1.y<targets[0].y,'floor exhaustion uses available upward space');
  for(const p of placed){assert.equal(p.obstructed,false);assert.ok(p.y-size/2>=0&&p.y+size/2<=height);}
  const settled=targets.map(t=>({...t,y:placed.find(p=>p.id===t.id).y}));
  assert.deepEqual(combatTargetAnchors({width:1200,height,size,targets:settled,obstacles,lockX:true}).toSorted((a,b)=>a.id.localeCompare(b.id)),
    placed.toSorted((a,b)=>a.id.localeCompare(b.id)),
    'the packed result remains stable on a subsequent refit');
});

test('waist-overlap player foot below the field retains a clamped 44px target', () => {
  const placed=combatTargetAnchors({width:390,height:275.203,size:44,lockX:true,
    targets:[{id:'player',x:112.297,y:395.094,width:44}]});
  assert.equal(placed[0].x,112.297);assert.equal(placed[0].y,275.203-22);
  assert.ok(Number.isFinite(placed[0].y));assert.equal(placed[0].obstructed,false);
});

test('upward fallback still reports obstruction when an overhead occupies all available space', () => {
  const placed=combatTargetAnchors({width:120,height:60,size:44,lockX:true,
    targets:[{id:'player',x:60,y:38,width:44}],
    obstacles:[{left:0,right:120,top:0,bottom:60}]});
  assert.equal(placed[0].obstructed,true);assert.equal(placed[0].x,60);
  assert.ok(placed[0].y-22>=0&&placed[0].y+22<=60);
});
