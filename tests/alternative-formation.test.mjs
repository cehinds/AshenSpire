import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeFormation, fitAlternativeSprites, overheadGroupHeightPx, perspectiveCellContains, perspectiveLanePattern } from '../src/ui/models/AlternativeFormationModel.js';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { uiConfig } from '../src/config/generated/ui.js';

const plan = (count, players = 1) => combatFormation({ width: 1000, height: 500,
  presentation: { perspectiveGrid: true, formationPreset: 'straight' },
  friends: Array.from({ length: players }, (_, i) => `p${i}`),
  enemies: Array.from({ length: count }, (_, i) => `e${i}`) });

test('the perspective grid is one sheared grid: equal parallelograms on diagonal lanes', () => {
  for (const [width, height, narrow] of [[1600, 620, false], [390, 420, true], [844, 220, false]]) {
    const formation = alternativeFormation(plan(6), width, height, narrow);
    const enemies = formation.cells.filter(c => c.side === 'enemy');
    const players = formation.cells.filter(c => c.side === 'player');
    assert.equal(enemies.length, 6);
    assert.equal(players.length, 3, 'one player rank of three lanes');
    assert.equal(new Set(formation.cells.map(c => Math.round(c.box.width * 1e6))).size, 1, 'every cell has one width');
    const skew = formation.cells[0].box.skew;
    assert(skew > 0, 'the grid leans');
    for (const cell of formation.cells) {
      const anchor = { x: .5, y: 1 };
      assert(Math.abs(cell.ground - cell.box.top - anchor.y * cell.box.height) < 1e-6);
      const centre = cell.box.left + cell.box.width / 2 + skew * (cell.box.top + cell.box.height / 2 - cell.ground);
      assert(Math.abs(cell.x - centre - (anchor.x - .5) * cell.box.width) < 1e-6);
    }
    const back = enemies.filter(c => c.rank === 0), front = enemies.filter(c => c.rank === 1);
    assert(Math.max(...back.map(c => c.ground)) < Math.min(...front.map(c => c.ground)), 'back rank sits behind the front');
    assert(Math.max(...front.map(c => c.box.top + c.box.height)) <= Math.min(...players.map(c => c.box.top)) + 1e-6,
      'the party rank does not overlap the enemy ranks');
    for (const cell of formation.cells) {
      assert(cell.ground > cell.box.top && cell.ground <= cell.box.top + cell.box.height + 1e-6, 'the foot anchor is inside its cell, on its bottom edge at most');
      assert(perspectiveCellContains(cell.box, cell.x, cell.ground), 'the foot anchor is inside its parallelogram');
      assert(cell.box.top + cell.box.height <= height + 1e-6);
      for (const y of [cell.box.top, cell.box.top + cell.box.height]) {
        const centre = cell.box.left + cell.box.width / 2 + skew * (cell.box.top + cell.box.height / 2 - y);
        assert(centre - cell.box.width / 2 >= -1e-6 && centre + cell.box.width / 2 <= width + 1e-6, 'the sheared cell stays on the field');
      }
    }
  }
});

test('a press hits only the parallelogram it lands in', () => {
  const box = { left: 100, top: 100, width: 100, height: 50, skew: .5 };
  assert(perspectiveCellContains(box, 150, 125));
  assert(perspectiveCellContains(box, 160, 101), 'the top edge leans right');
  assert(!perspectiveCellContains(box, 105, 101), 'the bounding box corner outside the parallelogram misses');
  assert(!perspectiveCellContains(box, 150, 99));
});

test('enemies fill the back rank first, spread across the lanes', () => {
  assert.deepEqual(perspectiveLanePattern(1, 3), [1]);
  assert.deepEqual(perspectiveLanePattern(2, 3), [0, 2]);
  assert.deepEqual(perspectiveLanePattern(3, 3), [0, 1, 2]);
  for (let count = 1; count <= 6; count++) {
    const formation = alternativeFormation(plan(count), 1000, 500, false);
    const enemies = formation.slots.filter(s => s.side === 'enemy');
    assert.equal(enemies.length, count);
    assert.equal(new Set(enemies.map(s => s.cell)).size, count, 'no two enemies share a cell');
    assert.equal(enemies.filter(s => s.rank === 0).length, Math.min(3, count));
  }
});

test('the party shares one rank and keeps the slot ids', () => {
  const formation = alternativeFormation(plan(3, 3), 390, 420, true);
  const party = formation.slots.filter(s => s.side === 'player');
  assert.deepEqual(party.map(s => s.id), ['p0', 'p1', 'p2']);
  assert.equal(new Set(party.map(s => s.lane)).size, 3);
  assert.equal(party[0].lane, 0, 'the lead player spawns in the left lane');
});

test('fitted sprites stay inside their lane and above their foot anchor', () => {
  for (const [width, height, narrow] of [[1600, 620, false], [390, 420, true], [844, 220, false]]) {
    for (let count = 1; count <= 6; count++) {
      const formation = alternativeFormation(plan(count), width, height, narrow);
      for (const [visibleWidth, visibleHeight] of [[240, 700], [700, 320]]) {
        const actors = formation.slots.map(slot => ({ slot, side: slot.side, visibleWidth, visibleHeight,
          leading: 30, ratio: 1.1, multiplier: 1.25 }));
        const sizes = alternativeCombatComposition({width,height,actors,perspectiveGrid:true,
        sizes:fitAlternativeSprites({ width, height, actors, narrow })});
        assert.equal(sizes.length, actors.length);
        sizes.forEach((size, i) => {
          const actor = actors[i], halfWidth = visibleWidth * size.scale / 2;
          assert(size.scale > 0 && Number.isFinite(size.scale));
          assert(size.x - halfWidth >= 5 - 1e-6 && size.x + halfWidth <= width - 5 + 1e-6);
          assert(halfWidth * 2 <= actor.slot.box.width * (actor.side === 'player' ? 1.5 : 1) + 1e-6, 'player growth has its explicit width allowance');
          assert(actor.slot.ground - size.visibleHeight >= actor.leading + 6 - 1e-6);
        });
      }
    }
  }
});

test('the player stands inside the final band with HUD room above rather than below', () => {
  for (const height of [130, 160, 183, 420]) {
    const formation = alternativeFormation(plan(3), 844, height, false);
    for (const cell of formation.cells.filter(c => c.side === 'player')) assert(cell.ground < height && cell.visualBand === 'D');
  }
});

test('every member of a four-player party gets a lane of their own', () => {
  const formation = alternativeFormation(plan(3, 4), 390, 420, true);
  const party = formation.slots.filter(s => s.side === 'player');
  assert.equal(party.length, 4);
  assert.equal(new Set(party.map(s => s.cell)).size, 4);
  assert.equal(new Set(party.map(s => Math.round(s.x))).size, 4);
});

test('an encounter past the grid capacity keeps every enemy placed', () => {
  const formation = alternativeFormation(plan(15), 1000, 500, false);
  const enemies = formation.slots.filter(s => s.side === 'enemy');
  assert.equal(enemies.length, 15);
  assert(enemies.every(s => Number.isFinite(s.x) && Number.isFinite(s.ground) && s.box), 'no enemy loses its geometry');
});

test('enemies of one class stand one height in every rank; low creatures stay at half', () => {
  for (const [width, height, narrow] of [[1440, 400, false], [390, 460, true]]) {
    const formation = alternativeFormation(plan(5), width, height, narrow);
    const actors = formation.slots.map((slot, i) => ({ slot, side: slot.side, visibleWidth: 120 + i * 30, visibleHeight: 300,
      leading: 40, ratio: 1, multiplier: 1, enemyId: slot.side === 'enemy' && i === 2 ? 'blightHound' : `foe${i}` }));
    const sizes = alternativeCombatComposition({width,height,actors,perspectiveGrid:true,
        sizes:fitAlternativeSprites({ width, height, actors, narrow })});
    const enemy = sizes.filter(size => formation.slots.find(s => s.id === size.id).side === 'enemy');
    const hound = enemy.find(size => actors.find(a => a.slot.id === size.id).enemyId === 'blightHound');
    const others = enemy.filter(size => size !== hound);
    assert.equal(new Set(others.map(size => Math.round(size.visibleHeight * 1e6))).size, 1, 'one minion height across both ranks');
    assert(Math.abs(hound.visibleHeight - others[0].visibleHeight * .5) < 1e-6, 'a low creature is half its class height');
  }
});

test('the extra band keeps identical geometry when core occupancy is disabled', () => {
  const plans = [false,true].map(enabled => {
    const presentation = {perspectiveGrid:true,formationPreset:'straight',formationPolicy:{extraRow:{enabled,sides:['enemy'],capacityPerLane:1}}};
    return alternativeFormation(combatFormation({width:1440,height:441,presentation,friends:['p'],enemies:['e']}),1440,441,false,presentation);
  });
  assert.deepEqual(plans[0].visualBands,plans[1].visualBands);
  assert.equal(plans[0].visualBands.length,4);
  assert.equal(plans[0].cells.some(c=>c.visualBand==='C'),false);
  assert.equal(plans[1].cells.filter(c=>c.visualBand==='C').length,3);
  const coreVisual = plans[0].visualCells.filter(c=>c.visualBand==='C');
  assert.equal(coreVisual.length,3);
  assert.ok(coreVisual.every(c=>c.visualOnly));
  assert.ok(coreVisual.every(c=>!plans[0].slots.some(slot=>slot.cell===c.cell)));
  assert.deepEqual(coreVisual.map(c=>c.box),plans[1].visualCells.filter(c=>c.visualBand==='C').map(c=>c.box));
  assert.equal(plans[0].visualCells.length,12);
});

test('engine occupancy is authoritative for extra combatants and saved player lanes', () => {
  const presentation = {perspectiveGrid:true,formationPreset:'straight',formationPolicy:{extraRow:{enabled:true,sides:['enemy'],capacityPerLane:1}},
    formationOccupancy:[{id:'p',side:'player',cell:'B2'},{id:'e',side:'enemy',cell:'A5'}]};
  const result=alternativeFormation(combatFormation({width:1440,height:441,presentation,friends:['p'],enemies:['e']}),1440,441,false,presentation);
  assert.equal(result.slots.find(s=>s.id==='e').visualBand,'C');
  assert.equal(result.slots.find(s=>s.id==='e').cell,'A5');
  assert.equal(result.slots.find(s=>s.id==='p').cell,'B1');
  assert.equal(result.slots.find(s=>s.id==='p').lane,1);
  const old=plan(2);old.slots.find(s=>s.side==='player').row=0;
  assert.equal(alternativeFormation(old,1440,441,false).slots.find(s=>s.side==='player').lane,2);
});

test('malformed visual band configuration fails before producing NaN geometry', async () => {
  const {validatePerspectiveGrid}=await import('../src/ui/models/AlternativeFormationModel.js');
  const {uiConfig}=await import('../src/config/generated/ui.js');
  const grid=structuredClone(uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid);
  grid.bands[2].id='enemy-front';assert.throws(()=>validatePerspectiveGrid(grid),/visual bands/);
  const invalid=structuredClone(uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid);
  invalid.wide.rowHeight=NaN;assert.throws(()=>validatePerspectiveGrid(invalid),/wide profile/);
});

test('a spacious enemy rank keeps its approved body size as independent HUDs grow', () => {
  const formation=alternativeFormation(plan(2),1440,441,false);
  const actors=formation.slots.filter(s=>s.side==='enemy').map(slot=>({slot,side:'enemy',enemyId:'stitchedHound',ratio:1,multiplier:1.5,visibleWidth:179,visibleHeight:190,artLeading:0,leading:180}));
  const sizes=fitAlternativeSprites({width:1440,height:441,actors,narrow:false});
  for (const fit of sizes) {
    const actor = actors.find(actor => actor.slot.id === fit.id);
    assert(fit.visibleHeight > 0);
    assert(fit.visibleHeight < actor.slot.ground - 6);
    assert(fit.scale * actor.visibleWidth <= actor.slot.box.width - 12);
  }
});

test('right-first phone allocation uses inward cell room before shrinking a whole enemy class', () => {
  const formation=alternativeFormation(plan(2),390,426,true);
  const actors=formation.slots.filter(slot=>slot.side==='enemy').map(slot=>({slot,side:'enemy',enemyId:'stitchedHound',ratio:1,multiplier:1,visibleWidth:179,visibleHeight:217.4,leading:66}));
  assert.deepEqual(actors.map(actor=>actor.slot.cell),['C4','A4']);
  const fits=fitAlternativeSprites({width:390,height:426,actors,narrow:true});
  const leftOnly=fitAlternativeSprites({width:390,height:426,actors:[actors[1]],narrow:true})[0];
  for(const fit of fits) assert.equal(fit.visibleHeight,leftOnly.visibleHeight,'outer right lane retains the same readable class height as the left lane');
  assert(fits[0].visibleHeight>70,'normal phone enemies do not collapse to the old far-right edge reserve');
});


test('every form factor fits the entire artwork envelope within its own cell', () => {
  for (const [formFactor, width, height, narrow] of [['mobile',390,426,true], ['tablet',820,650,false], ['desktop',1440,620,false]]) {
    const formation = alternativeFormation(plan(6), width, height, narrow, { formFactor });
    const actors = formation.slots.map(slot => ({ slot, side: slot.side, visibleWidth: 700, visibleHeight: 320, leading: 30, ratio: 1, multiplier: 1 }));
    const sizes = alternativeCombatComposition({ width, height, actors, perspectiveGrid: true, sizes: fitAlternativeSprites({ width, height, actors, narrow }) });
    for (const actor of actors) {
      const fit = sizes.find(size => size.id === actor.slot.id), box = actor.slot.box;
      const half = actor.visibleWidth * fit.scale / 2;
      const left = box.left + Math.abs(box.skew) * box.height / 2;
      const right = box.left + box.width - Math.abs(box.skew) * box.height / 2;
      assert(fit.x - half >= left + 6 - 1e-6, `${formFactor} complete left edge`);
      assert(fit.x + half <= right - 6 + 1e-6, `${formFactor} complete right edge`);
      if (formFactor === 'desktop') {
        // Owner 2026-10-28: on desktop and widescreen the HP bar is capped at half the lane and centred on its body.
        assert(Math.abs(actor.slot.miniHudWidth - (box.width * 0.5 - 4)) < 1e-6);
        assert(Math.abs(actor.slot.miniHudLeft + actor.slot.miniHudWidth / 2 - actor.slot.x) < 1e-6, 'desktop HUD is centred over its body');
        continue;
      }
      assert.equal(actor.slot.miniHudWidth, box.width - 4);
      assert(Math.abs(actor.slot.miniHudLeft - (box.left + box.skew * box.height / 2 + 2)) < 1e-6);
    }
    const back = formation.slots.filter(slot => slot.formationRole === 'enemy-back');
    assert.equal(new Set(back.map(slot => slot.miniHudTop)).size, 1, 'back-row HP geometry is level');
  }
});

test('the short profile narrows each HUD to 0.55 of its lane, desktop to 0.5 centred on the body; phone keeps the whole lane', () => {
  const inset = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.miniHudInsetPx;
  assert.equal(uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.short.hudWidthFraction, 0.55);
  for (const [width, height, narrow, fraction] of [[844, 240, false, 0.55], [1600, 620, false, 0.5], [390, 420, true, 1]]) {
    const formation = alternativeFormation(plan(3), width, height, narrow);
    for (const cell of formation.cells) {
      const lane = cell.box.width;
      assert.ok(Math.abs(cell.miniHudWidth - (lane * fraction - 2 * inset)) < 1e-6, `${width}x${height}: HUD width is ${fraction} of the lane`);
      if (width === 1600) { // desktop: centred on the body, not the lane (owner 2026-10-28)
        assert.ok(Math.abs(cell.miniHudLeft + cell.miniHudWidth / 2 - cell.x) < 1e-6, `${width}x${height}: the desktop HUD is centred over its body`);
        continue;
      }
      const slack = (lane - lane * fraction) / 2;
      const flush = cell.box.left + cell.box.skew * cell.box.height / 2 + inset;
      assert.ok(Math.abs(cell.miniHudLeft - (flush + slack)) < 1e-6, `${width}x${height}: the narrowed HUD stays centred in its lane`);
    }
  }
});

test('a short landscape field stands its enemy ranks low and fits bodies about 1.5x taller than the portrait short profile', () => {
  // Owner 2026-10-28, phone landscape (844x390, field ~146px): "enemies are too tiny".
  const height = 146;
  const heights = {};
  for (const [label, width] of [['landscape', 844], ['portrait', 599]]) {
    const formation = alternativeFormation(plan(3), width, height, false);
    const back = formation.cells.filter(c => c.side === 'enemy' && c.rank === 0);
    const player = formation.cells.filter(c => c.side === 'player');
    const ground = Math.max(...back.map(c => c.ground));
    if (label === 'landscape') assert.ok(ground >= height * 0.7, `back-rank feet at ${ground}`);
    // The party's baseline stays at the bottom of the field either way: feet on the cell bottom.
    assert.ok(Math.max(...player.map(c => c.ground)) <= height * 0.95 + 1e-6);
    const actors = formation.slots.filter(slot => slot.side === 'enemy').map(slot => ({ slot, side: 'enemy', visibleWidth: 60, visibleHeight: 150, leading: 66, ratio: 1, multiplier: 1 }));
    heights[label] = Math.max(...fitAlternativeSprites({ width, height, actors, narrow: false }).map(f => f.visibleHeight));
  }
  assert.ok(heights.landscape >= heights.portrait * 1.4, `enemy height ${heights.landscape} vs ${heights.portrait}`);
});

test('the overhead group height is config only: phone, desktop and short desktop window, never selection', () => {
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  assert.equal(overheadGroupHeightPx(grid, { wide: false }), grid.miniHudGroupHeightPx);
  assert.equal(overheadGroupHeightPx(grid, { wide: false, shortWindow: true }), grid.miniHudGroupHeightPx, 'phones ignore the short-window rule');
  assert.equal(overheadGroupHeightPx(grid, { wide: true }), 96);
  assert.equal(overheadGroupHeightPx(grid, { wide: true, shortWindow: true }), 80);
  assert.ok(overheadGroupHeightPx(grid, { wide: true }) > overheadGroupHeightPx(grid, { wide: true, shortWindow: true }));
  // Desktop form factor at 1101-1199 wide: the tall health row (min-width 1200) is not drawn, so the group is the phone's.
  assert.equal(overheadGroupHeightPx(grid, { wide: true, tall: false }), grid.miniHudGroupHeightPx, '1150 wide');
  assert.equal(overheadGroupHeightPx(grid, { wide: true, tall: false, shortWindow: false }), 61);
  // The stage's helper takes no frame and reads no layout: a selected frame hides its meters, so any DOM
  // measurement here would change with selection and refit the settled artwork on every click.
  const source = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
  const helper = source.slice(source.indexOf('const miniHudGroupHeight ='), source.indexOf('\n\n', source.indexOf('const miniHudGroupHeight =')));
  assert.ok(helper.length > 40, 'helper found');
  assert.doesNotMatch(helper, /offsetHeight|getBoundingClientRect|clientHeight|querySelector|classList/);
  assert.doesNotMatch(source, /miniHudGroupHeight\([^)]*\bframe\b/, 'no call passes a frame');
});

test('a taller short-landscape field keeps its sprite width: the shear is capped and enemies never fall below the parent short profile', () => {
  // Codex review on #2352: skew 4.2 at 844x240 shears 121px out of 133px cells and clamps the artwork to 1px (2.5px
  // tall enemies). Floors below are the parent `short` profile's fitted enemy heights at 844 wide for the same
  // 60x150 artwork envelope (measured with the parent profile forced), per field height.
  const parentFloor = { 146: 16.8, 200: 47, 240: 70.8, 279: 74.2 };
  for (const count of [3, 4]) for (const [height, floor] of Object.entries(parentFloor)) {
    const formation = alternativeFormation(plan(count), 844, Number(height), false);
    const actors = formation.slots.filter(slot => slot.side === 'enemy').map(slot => ({ slot, side: 'enemy', visibleWidth: 60, visibleHeight: 150, leading: 66, ratio: 1, multiplier: 1 }));
    const fitted = fitAlternativeSprites({ width: 844, height: Number(height), actors, narrow: false });
    for (const fit of fitted) assert.ok(fit.visibleHeight >= floor - 0.05, `${count} enemies at 844x${height}: ${fit.visibleHeight} < parent ${floor}`);
    const cell = formation.cells[0].box;
    const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.shortLandscape;
    const unshearedLane = 844 * (grid.right - grid.left) / 3 /* the plan helper builds three lanes */;
    assert.ok(cell.width - 2 * cell.skew * cell.height >= grid.minArtLaneFraction * unshearedLane - 1e-6, `${count} enemies at 844x${height}: artwork keeps under 40% of the unsheared lane`);
  }
});

test('narrow phone strips keep sprite width and stay above the parent short profile (667, 740, 780 wide)', () => {
  // The cap also bites at the tuned 146px height on narrower strips; floors are the parent `short` profile's fitted
  // heights for the same 60x150 envelope, 3 enemies (measured with the parent profile forced).
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.shortLandscape;
  const makePlan = (width, height) => combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p0'], enemies: ['e0', 'e1', 'e2'] });
  for (const [width, height, floor] of [[667, 131, 15.1], [740, 116, 13.3], [780, 116, 13.3], [667, 187, 39.3]]) {
    const formation = alternativeFormation(makePlan(width, height), width, height, false);
    const actors = formation.slots.filter(slot => slot.side === 'enemy').map(slot => ({ slot, side: 'enemy', visibleWidth: 60, visibleHeight: 150, leading: 66, ratio: 1, multiplier: 1 }));
    for (const fit of fitAlternativeSprites({ width, height, actors, narrow: false })) assert.ok(fit.visibleHeight >= floor - 0.05, `${width}x${height}: ${fit.visibleHeight} < parent ${floor}`);
    const cell = formation.cells[0].box;
    assert.ok(cell.width - 2 * cell.skew * cell.height >= grid.minArtLaneFraction * width * (grid.right - grid.left) / 3 - 1e-6, `${width}x${height}: artwork keeps under ${grid.minArtLaneFraction} of the unsheared lane`);
  }
});

// Owner 2026-10-31: the battle grid sits lower so the back rank stands on the painted ground and the player's rank
// ends above the hand. Measured in Chromium at 1280x800, 1200x730 and 390x844 (back rank top = ground paint top,
// rank D bottom <= hand top). Desktop was top .3 / rowHeight .17, mobile .32 / .16; each profile still validates
// (top + 4 * rowHeight <= 1) and keeps a clear margin for the hand under rank D.
test('desktop and phone profiles stand the back rank lower and keep rank D above the hand', () => {
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  assert.deepEqual([grid.profiles.desktop.top, grid.profiles.desktop.rowHeight], [0.4, 0.13]);
  assert.deepEqual([grid.profiles.mobile.top, grid.profiles.mobile.rowHeight], [0.43, 0.14]);
  for (const key of ['desktop', 'mobile']) {
    const p = grid.profiles[key];
    assert.ok(p.top >= 0.4, `${key}: the back rank starts at or below 40% of the field`);
    // The hand reaches up to 94% of the desktop field and to the field's bottom edge on a phone (measured).
    assert.ok(p.top + 4 * p.rowHeight <= (key === 'desktop' ? 0.94 : 1), `${key}: rank D ends above the hand`);
  }
  const formation = alternativeFormation(plan(3), 1280, 516, false, { formFactor: 'desktop' });
  const [back] = formation.visualBands;
  assert.ok(Math.abs(back.top - 516 * 0.4) < 1e-6 && Math.abs(back.height - 516 * 0.13) < 1e-6);
});
