import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enemyTargetGrid } from '../src/ui/models/EnemyTargetGridModel.js';
import { alternativeEnemyTargetGrid } from '../src/ui/models/AlternativeEnemyTargetGridModel.js';

const overlaps = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left
  && a.top < b.top + b.height && a.top + a.height > b.top;

for (const [width, height] of [[320, 250], [390, 420], [844, 150], [1440, 600]]) {
  test(`crowded foes keep distinct square slots inside ${width}×${height}`, () => {
    const targets = Array.from({ length: 3 }, (_, index) => ({ id: `e${index}`, x: width * .65, y: height * .5 }));
    const obstacles = [{ left: 0, top: 0, width, height: 35 }];
    const placements = enemyTargetGrid({ width, height, targets, obstacles });
    assert.equal(placements.length, targets.length);
    for (const [index, slot] of placements.entries()) {
      assert.equal(slot.width, slot.height);
      assert.ok(slot.width >= 48);
      assert.ok(slot.left >= 8 && slot.top >= 8);
      assert.ok(slot.left + slot.width <= width - 8 && slot.top + slot.height <= height - 8);
      assert.ok(!obstacles.some(rect => overlaps(slot, rect)));
      assert.ok(!placements.slice(index + 1).some(rect => overlaps(slot, rect)));
    }
    assert.deepEqual(enemyTargetGrid({ width, height, targets, obstacles }), placements);
  });
}

test('Classic grid keeps vertical order of targets that share a column band', () => {
  const [upper, lower] = enemyTargetGrid({ width: 400, height: 400, targets: [
    { id: 'upper', x: 210, y: 100 }, { id: 'lower', x: 200, y: 250 }] });
  assert.equal(upper.id, 'upper');
  assert.equal(lower.id, 'lower');
  assert.ok(upper.top < lower.top, `upper (${upper.top}) must sit above lower (${lower.top})`);
});

test('isolated enemy uses its nearest free grid center', () => {
  const target = { id: 'e1', x: 210, y: 210 };
  const [slot] = enemyTargetGrid({ width: 420, height: 420, targets: [target] });
  assert.ok(Math.abs(slot.left + slot.width / 2 - target.x) <= 47);
  assert.ok(Math.abs(slot.top + slot.height / 2 - target.y) <= 47);
  assert.deepEqual(enemyTargetGrid({ width: 420, height: 420, targets: [] }), []);
});

test('adjacent hounds shrink locally instead of swapping to a distant empty cell', () => {
  const targets = [{ id:'left',x:440,y:145 },{id:'right',x:548,y:118}];
  const slots = enemyTargetGrid({width:650,height:337,targets,obstacles:[
    {left:398,top:33,width:84,height:55},{left:506,top:6,width:84,height:55},
    {left:398,top:197,width:84,height:14},{left:506,top:170,width:84,height:14},
  ]});
  assert.equal(slots.length,2);
  assert.ok(slots[0].left < slots[1].left,'screen order follows enemy order');
  for (const [index,slot] of slots.entries()) {
    assert.ok(slot.width<=64 && slot.width>=48);
    assert.ok(Math.hypot(slot.left+slot.width/2-targets[index].x,slot.top+slot.height/2-targets[index].y)<40,'stays on its own body');
  }
});

test('shifted grid fits narrow free band between intent and health controls', () => {
  const targets = [480, 600, 720].map((x, index) => ({ id: `e${index}`, x, y: 75 }));
  const obstacles = [{ left: 0, top: 0, width: 844, height: 35 }, { left: 0, top: 115, width: 844, height: 35 }];
  const slots = enemyTargetGrid({ width: 844, height: 150, targets, obstacles });
  assert.equal(slots.length, 3);
  assert.ok(slots.every(slot => !obstacles.some(rect => overlaps(slot, rect))));
});

test('fully occupied inspection area still produces distinct enemy buttons', () => {
  const slots = enemyTargetGrid({ width: 320, height: 200, targets: [1,2,3].map(id => ({ id, x: 100, y: 100 })),
    obstacles: [{ left: 0, top: 0, width: 320, height: 200 }] });
  assert.equal(slots.length, 3);
  assert.ok(slots.every((slot, index) => !slots.slice(index + 1).some(other => overlaps(slot, other))));
});

test('crowded fallback keeps the player sprite clear', () => {
  const player = { left: 0, top: 40, width: 180, height: 160 };
  const slots = enemyTargetGrid({ width: 320, height: 200,
    targets: [1,2,3].map(id => ({ id, x: 180, y: 110 })), hardObstacles: [player],
    obstacles: [{ left: 0, top: 0, width: 320, height: 55 },
      { left: 180, top: 50, width: 140, height: 80 }, { left: 180, top: 150, width: 140, height: 50 }] });
  assert.equal(slots.length, 3);
  assert.ok(slots.every((slot, index) => !overlaps(slot, player)
    && !slots.slice(index + 1).some(other => overlaps(slot, other))));
});

for (const [label, grid] of [['Classic', enemyTargetGrid], ['Alternative', alternativeEnemyTargetGrid]]) {
  test(`${label} grid centres a lone foe even when its own controls cover the centre`, () => {
    const target = { id: 'a', x: 200, y: 200 };
    const [slot] = grid({ width: 420, height: 420, targets: [target],
      obstacles: [{ left: 170, top: 170, width: 60, height: 60, owner: 'a' }] });
    assert.equal(slot.left + slot.width / 2, target.x);
    assert.equal(slot.top + slot.height / 2, target.y);
  });

  test(`${label} grid keeps a foe off a neighbour's controls`, () => {
    const neighbour = { left: 170, top: 170, width: 60, height: 60, owner: 'b' };
    const placements = grid({ width: 420, height: 420, targets: [
      { id: 'a', x: 200, y: 200 }, { id: 'b', x: 300, y: 200 }], obstacles: [neighbour] });
    assert.equal(placements.length, 2);
    const a = placements.find(slot => slot.id === 'a');
    assert.ok(a, 'foe a is placed');
    assert.ok(!overlaps(a, neighbour), 'a box never covers b\'s controls');
  });

  test(`${label} grid still pushes a foe off unowned obstacles`, () => {
    const blocker = { left: 170, top: 170, width: 60, height: 60 };
    const [slot] = grid({ width: 420, height: 420, targets: [{ id: 'a', x: 200, y: 200 }], obstacles: [blocker] });
    assert.ok(slot, 'foe a is placed');
    assert.ok(!overlaps(slot, blocker));
  });
}

// A small foe's intent, Inspect, HP bar and armor sit directly above its art.
// The picker used to pass them as obstacles, which pushed the target box below
// the foe's feet. The box now centres on the visible art (the `.sprite` rect,
// which the stage trims to the ink) and the overhead controls stay clickable
// above it through their combat-layers.css z-index.
const pickerSource = readFileSync(new URL('../src/ui/components/enemyTargetPicker.js', import.meta.url), 'utf8');
const layerCss = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

test('picker tags each foe\'s controls with its owner and keeps player controls as plain obstacles', () => {
  assert.match(pickerSource, /\.combat-hud/);
  assert.match(pickerSource, /\.turn-ribbon/);
  assert.match(pickerSource, /\.combatant\.player :is\(\.combatant-leading, \.meters\)/, 'player controls are obstacles');
  assert.match(pickerSource, /\.combatant\.enemy/);
  assert.match(pickerSource, /:is\(\.combatant-leading, \.meters, \.nm\)/, 'foe controls include the name plate');
  assert.match(pickerSource, /owner:\s*figure\.dataset\.eid/, 'foe controls carry their owner');
  assert.match(pickerSource, /hardObstacles/, 'hard obstacles stay in place');
});

for (const [label, grid] of [['Classic', enemyTargetGrid], ['Alternative', alternativeEnemyTargetGrid]]) {
  test(`${label} grid centres an isolated small foe's box on its art with overhead controls above it`, () => {
    // 320x568 phone geometry measured in Chromium: a 42px foe under its HP row
    // and intent/Inspect row, with the HUD and turn ribbon along the top.
    const target = { id: 'e1', x: 182, y: 176 };
    const meters = { left: 138, top: 132, width: 88, height: 19 };
    const leading = { left: 92, top: 103, width: 180, height: 54 };
    const obstacles = [{ left: 0, top: 0, width: 320, height: 60 }, { left: 110, top: 64, width: 100, height: 22 }];
    const width = 320, height = 420;
    // The foe's own controls are owned, so its box may still centre over them.
    const owned = [{ ...meters, owner: target.id }, { ...leading, owner: target.id }];
    const [slot] = grid({ width, height, targets: [target], obstacles: [...obstacles, ...owned] });
    assert.ok(slot, 'the foe gets a box');
    assert.ok(Math.abs(slot.left + slot.width / 2 - target.x) <= 0.5, `box centre x ${slot.left + slot.width / 2} = ${target.x}`);
    assert.ok(Math.abs(slot.top + slot.height / 2 - target.y) <= 0.5, `box centre y ${slot.top + slot.height / 2} = ${target.y}`);
    assert.ok(overlaps(slot, meters), 'the box may now cover the HP row, which stays clickable above it');
    // The defect: with the overhead controls as obstacles the box sank below
    // the art centre (Alternative: under the feet; Classic: shrunk to 48px).
    const [old] = grid({ width, height, targets: [target], obstacles: [...obstacles, meters, leading] });
    assert.ok(old.top + old.height / 2 - target.y > 4, 'old obstacle list dropped the box below the art centre');
  });
}

test('overhead controls paint above the target picker in the formation stacking context', () => {
  const z = selector => {
    const rule = [...layerCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, sel, body]) => sel.trim().endsWith(selector) && /z-index/.test(body));
    assert.ok(rule, `rule for ${selector}`);
    const value = rule[2].match(/z-index:\s*([^;]+)/)?.[1].trim();
    assert.ok(value, `${selector} sets z-index`);
    return value;
  };
  assert.equal(z('.enemy-target-picker'), 'var(--combat-layer-selection)');
  // !important beats the inline z-index (the selection layer itself) that the
  // stage writes on a packed footer; without it the later picker would win.
  assert.equal(z('.combatant :is(.nm,.meters,.statuses)'), 'calc(var(--combat-layer-selection) + 1) !important');
  assert.equal(z('.combatant .combatant-leading'), 'calc(var(--combat-layer-selection) + 3) !important');
});
