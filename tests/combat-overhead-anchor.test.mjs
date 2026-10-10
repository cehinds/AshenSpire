import test from 'node:test';
import assert from 'node:assert/strict';

test('a foot-locked target never escapes a blocked floor by crossing its body', () => {
  const [target] = combatTargetAnchors({ width: 288, height: 200, size: 28, lockX: true,
    targets: [{ id: 'enemy', x: 170, y: 150, minY: 150, width: 88 }],
    obstacles: [{ left: 100, right: 240, top: 152, bottom: 200 }] });
  assert.ok(target.y >= 150);
  assert.equal(target.obstructed, true);
});
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

const overlapsBox = (box, o) => box.left < o.right && box.right > o.left && box.top < o.bottom && box.bottom > o.top;
const overheadBox = (control, anchor) => ({ left: anchor.x - control.width / 2, right: anchor.x + control.width / 2,
  top: control.top + (anchor.offsetY ?? 0), bottom: control.bottom + (anchor.offsetY ?? 0) });

test('a 320-wide enemy overhead moves off the player art and its controls it would cover', () => {
  // Measured at 320x568 with three enemies: the left enemy's packed overhead sat
  // over the player's red-cape art and "i" control.
  const controls = [{ id: 'e1', side: 'enemy', x: 77, width: 70.4, top: 152.7, bottom: 200.7 }];
  const obstacles = [
    { ownerId: 'player', left: 33.5, right: 116.9, top: 185.3, bottom: 273.8 },
    { ownerId: 'player', left: 65.2, right: 87.2, top: 159.6, bottom: 181.6 },
    { ownerId: 'player', left: 20.2, right: 132.2, top: 276.1, bottom: 295.1 },
  ];
  const [anchor] = combatOverheadAnchors({ width: 320, controls, obstacles });
  const box = overheadBox(controls[0], anchor);
  for (const obstacle of obstacles) assert.equal(overlapsBox(box, obstacle), false,
    'the overhead never covers the player art or controls');
  assert.notEqual(anchor.obstructed, true, 'a clear slot exists above the player');
  assert.ok(anchor.offsetY < 0, 'the overhead moves up before it moves sideways');
  assert.ok(box.top >= 0, 'the moved overhead stays inside the field');
});

test('an overhead never blocks itself, and unobstructed anchors are unchanged', () => {
  const controls = [{ id: 'e1', side: 'enemy', x: 77, width: 70.4, top: 152.7, bottom: 200.7 }];
  assert.deepEqual(combatOverheadAnchors({ width: 320, controls,
    obstacles: [{ ownerId: 'e1', left: 40, right: 110, top: 150, bottom: 205 }] }),
  combatOverheadAnchors({ width: 320, controls }), 'an obstacle owned by the overhead is ignored');
  const far = [{ ownerId: 'player', left: 0, right: 10, top: 0, bottom: 10 }];
  assert.deepEqual(combatOverheadAnchors({ width: 320, controls, obstacles: far }),
    combatOverheadAnchors({ width: 320, controls }), 'a distant obstacle leaves the packed anchor alone');
});

test('an enemy overhead with no clear slot is reported obstructed rather than hidden', () => {
  const controls = [{ id: 'e1', side: 'enemy', x: 77, width: 70.4, top: 152.7, bottom: 200.7 }];
  const [anchor] = combatOverheadAnchors({ width: 320, controls, height: 400,
    obstacles: [{ ownerId: 'player', left: 0, right: 320, top: 0, bottom: 400 }] });
  assert.equal(anchor.obstructed, true);
  assert.equal(anchor.x, 77, 'the reported anchor keeps its packed position');
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

test('actual 390x650 XL aligned feet fit complete 44px targets below visible intents', () => {
  const top=74.734375,height=275.203125;
  const targets=[{id:'player',x:91.65625,y:462.046875-top,width:44},
    {id:'e1',x:161.2421875,y:303.15625-top+54.390625/2,width:96},
    {id:'e2',x:263.2421875,y:303.15625-top+54.390625/2,width:96},
    {id:'e3',x:165.734375,y:259.109375-top+54.390625/2,width:96}];
  const obstacles=[{left:113.25,right:209.25,top:195.453125-top,bottom:249.84375-top},
    {left:215.25,right:311.25,top:195.453125-top,bottom:249.84375-top},
    {left:117.75,right:213.75,top:129.953125-top,bottom:184.34375-top}];
  const before=structuredClone(targets);
  const packed=combatTargetAnchors({width:390,height,size:44,targets,obstacles,lockX:true});
  assert.deepEqual(targets,before,'the retry never mutates measured feet');
  for(const target of packed){
    assert.equal(target.x,before.find(t=>t.id===target.id).x,'canonical columns do not move');
    assert.equal(target.obstructed,false,target.id);
    assert.ok(target.y-22>=0&&target.y+22<=height,target.id+' stays inside the field');
    for(const obstacle of obstacles)assert.ok(target.x+target.width/2<=obstacle.left
      || target.x-target.width/2>=obstacle.right || target.y+22<=obstacle.top
      || target.y-22>=obstacle.bottom,target.id+' clears every visible intent');
  }
  for(let i=0;i<packed.length;i++)for(let j=i+1;j<packed.length;j++){
    const a=packed[i],b=packed[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=46,
      a.id+'/'+b.id+' complete target/footer rectangles remain separate');
  }
  const byId=id=>packed.find(t=>t.id===id);
  assert.equal(byId('e1').y,height-22,'the crowded column keeps its floor target');
  assert.equal(byId('e3').y,byId('e1').y-46,'the other row fills the remaining lower slot');
  assert.equal(byId('player').y,byId('e1').y-46,'a narrow player target clears the wider tied floor plate');
  assert.deepEqual(combatTargetAnchors({width:390,height,size:44,targets,lockX:true,
    obstacles:[...obstacles,{left:120,right:270,top:0,bottom:26}]}),packed,
    'a visible ribbon ceiling cannot force a target away from the available lower slots');
  assert.deepEqual(combatTargetAnchors({width:390,height,size:44,targets:packed,obstacles,lockX:true})
    .toSorted((a,b)=>a.id.localeCompare(b.id)),packed.toSorted((a,b)=>a.id.localeCompare(b.id)),
    'a repeated refresh keeps the settled packing');
});

test('bounded floor retry does not trade an impossible stage for outside or overlapping targets', () => {
  const targets=[{id:'a',x:60,y:58,width:44},{id:'b',x:60,y:60,width:44}];
  const packed=combatTargetAnchors({width:120,height:80,size:44,targets,lockX:true});
  assert.equal(packed.filter(t=>t.obstructed).length,1,'insufficient room remains explicitly obstructed');
  for(const target of packed){assert.equal(target.x,60);assert.ok(target.y-22>=0&&target.y+22<=80);}
  assert.deepEqual(combatTargetAnchors({width:120,height:80,size:44,targets,lockX:true}),packed,
    'the two bounded attempts are deterministic');
});

test('ordinary 390x650 feet reserve the complete visible player HUD without moving artwork columns', () => {
  const top=69.515625,height=280.421875;
  const targets=[{id:'player',x:91.65625,y:479.28125-top,width:44},
    {id:'e1',x:161.25,y:302.28125-top+54.390625/2,width:96},
    {id:'e2',x:263.2421875,y:302.265625-top+54.390625/2,width:96}];
  const intents=[{left:113.25,right:209.25,top:166.796875-top,bottom:221.1875-top},
    {left:215.25,right:311.25,top:172.875-top,bottom:227.265625-top}];
  const hud={left:35.65625,right:147.65625,top:321.9375-top,bottom:335.9375-top};
  const input={width:390,height,size:44,targets,lockX:true};
  const original=combatTargetAnchors({...input,obstacles:intents});
  const player=original.find(t=>t.id==='player');
  assert.ok(player.y-22<hud.bottom&&player.y+22>hud.top,
    'actual ordinary fixture reproduces the unchanged foot gate failure');
  const obstacles=[...intents,hud],before=structuredClone(targets);
  const packed=combatTargetAnchors({...input,obstacles});
  assert.deepEqual(targets,before,'measured artwork feet are not mutated');
  for(const target of packed){
    assert.equal(target.x,before.find(t=>t.id===target.id).x,'keep the canonical column');
    assert.equal(target.obstructed,false,target.id);
    assert.ok(target.y-22>=0&&target.y+22<=height,'the full physical 44px plate is in the field');
    for(const obstacle of obstacles)assert.ok(target.x+target.width/2<=obstacle.left
      || target.x-target.width/2>=obstacle.right || target.y+22<=obstacle.top
      || target.y-22>=obstacle.bottom,target.id+' clears complete HUD and intent rectangles');
  }
  for(let i=0;i<packed.length;i++)for(let j=i+1;j<packed.length;j++){
    const a=packed[i],b=packed[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=46,
      'complete target/footer rectangles keep their clearance');
  }
  assert.deepEqual(combatTargetAnchors({...input,targets:packed,obstacles})
    .toSorted((a,b)=>a.id.localeCompare(b.id)),packed.toSorted((a,b)=>a.id.localeCompare(b.id)),
    'stable widget geometry does not feed back into repeated packing');
});

test('actual desktop player plate clears its raised mini-HUD while enemy feet stay unchanged', () => {
  const top=85.09375,height=303.1875;
  const targets=[{id:'player',x:345.8125,y:531.53125-top,width:44},
    {id:'e1',x:522,y:330.65625-top+54.390625/2,width:96},
    {id:'e2',x:798,y:330.65625-top+54.390625/2,width:96},
    {id:'e3',x:420,y:294.265625-top+54.390625/2,width:96}];
  const hud={left:289.8125,right:401.8125,top:355.578125-top,bottom:369.578125-top};
  const input={width:1200,height,size:44,targets,lockX:true};
  const original=combatTargetAnchors(input),packed=combatTargetAnchors({...input,obstacles:[hud]});
  const player=packed.find(t=>t.id==='player');
  assert.equal(player.y+22,hud.top-2,'the entire 44px plate clears the independent reading widget');
  for(const target of packed){
    assert.equal(target.x,targets.find(t=>t.id===target.id).x);
    assert.equal(target.obstructed,false);
    assert.ok(target.y-22>=0&&target.y+22<=height);
    if(target.id!=='player')assert.deepEqual(target,original.find(t=>t.id===target.id),
      'unobstructed enemy footer cues retain their exact placement');
  }
  assert.deepEqual(combatTargetAnchors({...input,targets:packed,obstacles:[hud]})
    .toSorted((a,b)=>a.id.localeCompare(b.id)),packed.toSorted((a,b)=>a.id.localeCompare(b.id)),
    'the final HUD rectangle yields idempotent anchors');
});

test('actual 1178 crowded phone repairs only foot cues within one tap width of their artwork column', () => {
  const top=74.734375,height=275.203125;
  const targets=[{id:'player',x:91.65625,y:462.046875-top,width:44},
    {id:'e1',x:161.2421875,y:303.15625-top+54.390625/2,width:96},
    {id:'e2',x:263.2421875,y:303.15625-top+54.390625/2,width:96},
    {id:'e3',x:165.734375,y:259.109375-top+54.390625/2,width:96}];
  const obstacles=[{left:113.25,right:209.25,top:195.453125-top,bottom:249.84375-top},
    {left:215.25,right:311.25,top:195.453125-top,bottom:249.84375-top},
    {left:117.75,right:213.75,top:129.953125-top,bottom:184.34375-top},
    {left:35.65625,right:147.65625,top:321.40625-top,bottom:335.40625-top},
    {left:104,right:285,top:0,bottom:98-top}];
  const input={width:390,height,size:44,targets,obstacles,lockX:true};
  assert.ok(combatTargetAnchors(input).some(t=>t.obstructed),
    'full HUD and ribbon reproduce the old unsatisfied locked-column geometry');
  const before=structuredClone(targets),packed=combatTargetAnchors({...input,maxShiftX:44});
  assert.deepEqual(targets,before,'no actor geometry is changed');
  for(const target of packed){
    const source=before.find(t=>t.id===target.id);
    assert.equal(target.obstructed,false,target.id);
    assert.ok(Math.abs(target.x-source.x)<=44,'only the target/footer has a bounded horizontal shift');
    assert.ok(Math.abs(target.y-Math.min(source.y,height-22))<=88,'cues stay near the clamped feet');
    assert.equal(target.width,source.width,'complete 96px enemy bands are retained');
    assert.ok(target.x-target.width/2>=0&&target.x+target.width/2<=390);
    assert.ok(target.y-22>=0&&target.y+22<=height,'full 44px height remains in the field');
    for(const obstacle of obstacles)assert.ok(target.x+target.width/2<=obstacle.left
      || target.x-target.width/2>=obstacle.right || target.y+22<=obstacle.top
      || target.y-22>=obstacle.bottom,target.id+' clears full HUD, intents and ribbon');
  }
  for(let i=0;i<packed.length;i++)for(let j=i+1;j<packed.length;j++){
    const a=packed[i],b=packed[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=46,
      a.id+'/'+b.id+' retain separate complete footer rectangles');
  }
  assert.equal(packed.find(t=>t.id==='e1').y,height-22,'first row returns to its foot band');
  assert.equal(packed.find(t=>t.id==='e1').x,197.65625,'keep the accepted ordinary-scene repair exactly');
  assert.equal(packed.find(t=>t.id==='e2').x,295.65625,'lookahead cannot perturb a completed clear pack');
  assert.equal(packed.find(t=>t.id==='e3').y,height-22-46,'other row stays one band above');
  assert.equal(packed.find(t=>t.id==='player').x,targets[0].x,'the clear player column stays fixed');
  assert.deepEqual(combatTargetAnchors({...input,maxShiftX:44}),packed,'no sampling/order randomness');
  assert.deepEqual(combatTargetAnchors({...input,targets:packed,maxShiftX:44})
    .toSorted((a,b)=>a.id.localeCompare(b.id)),packed.toSorted((a,b)=>a.id.localeCompare(b.id)),
    'settled target/footer positions remain idempotent');
  const limited=combatTargetAnchors({...input,maxShiftX:8});
  assert.ok(limited.some(t=>t.obstructed),'insufficient permitted clearance remains explicit');
  assert.ok(limited.every(t=>Math.abs(t.x-targets.find(s=>s.id===t.id).x)<=8));
});

test('optional foot shift never changes clear ordinary placements or disguises impossible space', () => {
  const input={width:390,height:240,size:44,lockX:true,
    targets:[{id:'a',x:120,y:150,width:96},{id:'b',x:260,y:160,width:96}],
    obstacles:[{left:80,right:300,top:0,bottom:70}]};
  assert.deepEqual(combatTargetAnchors({...input,maxShiftX:44}),combatTargetAnchors(input),
    'successful original vertical placement is exactly retained');
  const blocked=combatTargetAnchors({width:120,height:60,size:44,lockX:true,maxShiftX:44,
    targets:[{id:'a',x:60,y:38,width:96}],
    obstacles:[{left:0,right:120,top:0,bottom:60}]});
  assert.equal(blocked[0].obstructed,true,'an impossible full-field obstacle still fails');
  assert.equal(blocked[0].x,60,'a useless repair does not drift the original cue');
  assert.ok(blocked[0].y-22>=0&&blocked[0].y+22<=60);
});

test('actual 1180 refitted overlap keeps an earlier cue from consuming the last fighter slot', () => {
  const top=74.734375,height=275.203125;
  const targets=[{id:'player',x:154.56300354003906,y:477.3125-top,width:44},
    {id:'e1',x:195.00463104248047,y:271.52691650390625-top+54.390625/2,width:96},
    {id:'e2',x:263.2421875,y:303.15625-top+54.390625/2,width:96},
    {id:'e3',x:165.734375,y:259.109375-top+54.390625/2,width:96}];
  const obstacles=[{left:113.25,right:209.25,top:195.453125-top,bottom:249.84375-top},
    {left:146.80557250976562,right:242.80557250976562,
      top:161.03619384765625-top,bottom:215.42681884765625-top},
    {left:117.75,right:213.75,top:129.953125-top,bottom:184.34375-top},
    // The 16px fixture's complete HUD remains above its displaced artwork.
    {left:98.563,right:210.563,top:436.21-top,bottom:450.21-top},
    {left:104,right:285,top:0,bottom:98-top}];
  const input={width:390,height,size:44,targets,obstacles,lockX:true};
  assert.ok(combatTargetAnchors(input).some(t=>t.obstructed),'the captured crowded column needs repair');
  const before=structuredClone(targets),packed=combatTargetAnchors({...input,maxShiftX:44});
  assert.deepEqual(targets,before,'the grown artwork and moved small player keep their authored fixture positions');
  for(const target of packed){
    const source=before.find(t=>t.id===target.id);
    assert.equal(target.obstructed,false,target.id);
    assert.ok(Math.abs(target.x-source.x)<=44,'horizontal repair stays within one physical tap width');
    assert.ok(Math.abs(target.y-Math.min(source.y,height-22))<=88,'every owner cue remains near its feet');
    assert.equal(target.width,source.width,'full enemy plate/footer widths are not weakened');
    assert.ok(target.x-target.width/2>=0&&target.x+target.width/2<=390);
    assert.ok(target.y-22>=0&&target.y+22<=height);
    for(const obstacle of obstacles)assert.ok(target.x+target.width/2<=obstacle.left
      || target.x-target.width/2>=obstacle.right || target.y+22<=obstacle.top
      || target.y-22>=obstacle.bottom,target.id+' clears every full intent, HUD and ribbon rectangle');
  }
  for(let i=0;i<packed.length;i++)for(let j=i+1;j<packed.length;j++){
    const a=packed[i],b=packed[j];
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=46,
      'all actor footer bands and their 44px target cores remain separate');
  }
  const e1=packed.find(t=>t.id==='e1'),e3=packed.find(t=>t.id==='e3');
  assert.equal(e1.x,targets[1].x+44,'retain a bounded earlier alternative instead of the locally nearest trap');
  assert.equal(e3.x,e1.x-98,'the later full-width footer uses that freed edge with a two-pixel gap');
  assert.equal(e3.y,height-22-46,'the later owner cue stays in the lower field');
  assert.deepEqual(combatTargetAnchors({...input,maxShiftX:44}),packed,'bounded exploration is deterministic');
  assert.deepEqual(combatTargetAnchors({...input,targets:packed,maxShiftX:44})
    .toSorted((a,b)=>a.id.localeCompare(b.id)),packed.toSorted((a,b)=>a.id.localeCompare(b.id)),
    'settled alternatives do not cause a new fitting feedback loop');
  assert.ok(combatTargetAnchors({...input,maxShiftX:8}).some(t=>t.obstructed),
    'exhausted alternatives preserve the insufficient-space flag');
});

test('bounded footer packing moves plates above the real hand while preserving clear anchors', () => {
  const targets = [{ id: 'left', x: 300, y: 210, width: 104 },
    { id: 'right', x: 470, y: 210, width: 104 }];
  const before = structuredClone(targets);
  const anchors = combatTargetAnchors({ width: 650, height: 320, targets, size: 44,
    packWithinBounds: true, obstacles: [{ left: 0, right: 650, top: 195, bottom: 320 }] });
  assert.deepEqual(targets, before, 'the actor anchors remain immutable');
  for (const anchor of anchors) {
    assert.equal(anchor.x, before.find(target => target.id === anchor.id).x);
    assert.ok(anchor.y + 22 <= 193, 'the full footer clears the hand by two pixels');
    assert.ok(!anchor.obstructed);
  }
  const clear = combatTargetAnchors({ width: 650, height: 320, targets, size: 44,
    packWithinBounds: true });
  assert.deepEqual(clear.map(({ id, x, y }) => ({ id, x, y })),
    targets.map(({ id, x, y }) => ({ id, x, y })), 'ordinary attached plates keep their original positions');
});

test('bounded footers reserve a player details panel and a crowded hand together', () => {
  const obstacles = [{ left: 10, right: 138, top: 100, bottom: 195 },
    { left: 0, right: 360, top: 200, bottom: 500 }];
  const anchors = combatTargetAnchors({ width: 360, height: 500, size: 44, packWithinBounds: true,
    targets: [{ id: 'a', x: 108, y: 210, width: 104 }, { id: 'b', x: 250, y: 210, width: 104 },
      { id: 'c', x: 300, y: 240, width: 104 }], obstacles });
  const boxes = anchors.map(anchor => ({ left: anchor.x - 52, right: anchor.x + 52,
    top: anchor.y - 22, bottom: anchor.y + 22 }));
  const clear = (a, b) => a.right + 2 <= b.left || a.left >= b.right + 2
    || a.bottom + 2 <= b.top || a.top >= b.bottom + 2;
  assert.ok(anchors.every(anchor => !anchor.obstructed));
  boxes.forEach((box, index) => {
    assert.ok(obstacles.every(obstacle => clear(box, obstacle)));
    assert.ok(boxes.slice(index + 1).every(other => clear(box, other)));
  });
});

test('bounded footer packing reports an impossible panel without fabricating a clear slot', () => {
  const anchors = combatTargetAnchors({ width: 120, height: 80, size: 44, packWithinBounds: true,
    targets: [{ id: 'enemy', x: 60, y: 40, width: 104 }],
    obstacles: [{ left: 0, right: 120, top: 0, bottom: 80 }] });
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].obstructed, true);
  assert.ok(Number.isFinite(anchors[0].x) && Number.isFinite(anchors[0].y));
  assert.ok(anchors[0].x >= 52 && anchors[0].x <= 68);
  assert.ok(anchors[0].y >= 22 && anchors[0].y <= 58);
});

test('a card cannot push an enemy footer above its body-bottom constraint', () => {
  const target = { id: 'enemy', x: 150, y: 180, minY: 180, width: 104 };
  const options = { width: 360, height: 300, size: 44, packWithinBounds: true,
    obstacles: [{ left: 90, right: 210, top: 170, bottom: 240 }] };
  const [unconstrained] = combatTargetAnchors({ ...options, targets: [{ ...target, minY: undefined }] });
  assert.ok(unconstrained.y < target.minY, 'the nearer free slot would otherwise overlap the actor');
  const [placed] = combatTargetAnchors({ ...options, targets: [target] });
  assert.ok(!placed.obstructed, 'a lateral or lower clear slot exists');
  assert.ok(placed.y >= target.minY, 'the footer never rises into the owning sprite');
  assert.ok(placed.x + placed.width / 2 <= 88 || placed.x - placed.width / 2 >= 212
    || placed.y - 22 >= 242, 'the entire footer still clears the real card');
  assert.deepEqual(target, { id: 'enemy', x: 150, y: 180, minY: 180, width: 104 });
});

test('lock-X upward fallback honors the owning body-bottom floor', () => {
  const target = { id: 'enemy', x: 150, y: 180, minY: 180, width: 104 };
  const options = { width: 360, height: 300, size: 44, lockX: true,
    obstacles: [{ left: 90, right: 210, top: 170, bottom: 280 }] };
  const [unconstrained] = combatTargetAnchors({ ...options, targets: [{ ...target, minY: undefined }] });
  assert.ok(unconstrained.y < target.minY, 'the unconstrained fallback uses the tempting slot over the actor');
  const [placed] = combatTargetAnchors({ ...options, targets: [target] });
  assert.equal(placed.y, target.minY, 'the constrained footer stays at or below the owning body');
  assert.equal(placed.obstructed, true, 'impossible space is reported instead of hiding the collision over the actor');
});
