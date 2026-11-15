import { readSourceTextSync } from './helpers/read-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeFormation, perspectiveBandRows, fitAlternativeSprites, overheadGroupHeightPx, perspectiveCellContains, perspectiveLanePattern } from '../src/ui/models/AlternativeFormationModel.js';
import { alternativeCombatComposition } from '../src/ui/models/CombatCompositionModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { mobileFieldOverlap, desktopFieldBottom, desktopFooterLayout, desktopHandLayout } from '../src/ui/models/DesktopCombatFooter.js';
import { responsiveHandLayout, handLayout } from '../src/ui/models/HandLayout.js';
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

test('the extra enemy strip is drawn only when core enables it; the player has a front and a back strip', () => {
  const plans = [false,true].map(enabled => {
    const presentation = {perspectiveGrid:true,formationPreset:'straight',formationPolicy:{extraRow:{enabled,sides:['enemy'],capacityPerLane:1}}};
    return alternativeFormation(combatFormation({width:1440,height:441,presentation,friends:['p'],enemies:['e']}),1440,441,false,presentation);
  });
  assert.deepEqual(plans[0].visualBands.map(b=>b.id),['enemy-back','enemy-front','player-front','player-back']);
  assert.deepEqual(plans[1].visualBands.map(b=>b.id),['enemy-back','enemy-front','extra-combatants','player-front','player-back']);
  assert.equal(plans[0].visualCells.some(c=>c.visualBand==='C'),false, 'no extra tiles when disabled');
  assert.equal(plans[1].cells.filter(c=>c.visualBand==='C').length,3);
  // 9 gameplay-or-visual enemy cells become 6 without the extra rank; the player rank doubles to 6.
  assert.equal(plans[0].visualCells.length,12);
  assert.equal(plans[1].visualCells.length,15);
  const back = plans[0].visualCells.filter(c=>c.visualBand==='E');
  assert.ok(back.length===3 && back.every(c=>c.visualOnly && c.side==='player'));
  assert.ok(back.every(c=>!plans[0].slots.some(slot=>slot.cell===c.cell)));
  assert.ok(plans[0].slots.find(s=>s.side==='player').visualBand==='D', 'the player stands in the front strip');
  // Enabling the extra rank shrinks the strips so nothing leaves the field.
  assert.ok(plans[1].visualBands.at(-1).top + plans[1].visualBands.at(-1).height <= 441 + 1e-6);
});

test('the phone field never extends so far that the player back strip passes the resting cards', () => {
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  const p = grid.profiles.mobile, rows = perspectiveBandRows(grid, false, p).rows;
  for (const [width, natural, handHeight] of [[390, 480, 260], [375, 420, 240], [390, 560, 300], [360, 400, 230]]) {
    const extension = mobileFieldOverlap({ natural, width, handHeight, rem: 16, zoom: 1, compact: true });
    const input = { width, height: handHeight, count: 5, rem: 16, zoom: 1, compact: true, controlsHeight: 0, controlled: [], headroom: 0, formFactor: 'mobile' };
    const { restTop } = responsiveHandLayout(input, handLayout(input));
    // The last player strip ends at top + rows * rowHeight of the extended field; the cards rest at natural + restTop.
    assert.ok((natural + extension) * (p.top + rows * p.rowHeight) <= natural + restTop + 1e-6, `${width}x${natural}: player back strip clears the cards`);
  }
});

test('a team gap of open ground separates the enemy and player strips on every profile and size', () => {
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  assert.equal(grid.teamGapRows, 0.6);
  assert.equal(perspectiveBandRows(grid, false).rows, 4 + grid.teamGapRows);
  assert.equal(perspectiveBandRows(grid, true).rows, 5 + grid.teamGapRows);
  // Per-profile gaps (owner 2026-11-05): the phone's gap is wide enough to read as open ground.
  assert.ok(grid.profiles.mobile.teamGapRows >= 1 && grid.shortLandscape.teamGapRows >= 1);
  for (const key of ['wide', 'narrow', 'short', 'shortLandscape', ...Object.keys(grid.profiles).map(k => `profiles.${k}`)]) {
    const p = key.startsWith('profiles.') ? grid.profiles[key.slice(9)] : grid[key];
    assert.ok(p.top + p.rowHeight * perspectiveBandRows(grid, false, p).rows <= 1 + 1e-9, `${key}: the strips and the gap fit the field`);
  }
  for (const [width, height, narrow, formFactor] of [[375, 667, true, 'mobile'], [390, 844, true, 'mobile'], [844, 390, false, 'tablet'], [1280, 800, false, 'desktop'], [1440, 900, false, 'desktop'], [844, 220, false, 'tablet'], [390, 240, true, 'mobile']]) {
    for (const extra of [false, true]) {
      const presentation = { perspectiveGrid: true, formationPreset: 'straight', formFactor, formationPolicy: { extraRow: { enabled: extra, sides: ['enemy'], capacityPerLane: 1 } } };
      const f = alternativeFormation(combatFormation({ width, height, presentation, friends: ['p'], enemies: ['a', 'b', 'c'] }), width, height, narrow, presentation);
      const label = `${width}x${height} extra=${extra}`;
      const last = f.visualBands.filter(b => b.side === 'enemy').at(-1), first = f.visualBands.find(b => b.side === 'player');
      const h = f.visualBands[0].height;
      const profileGap = (height < grid.shortBelowPx ? (width >= 600 ? grid.shortLandscape : grid.short) : grid.profiles[formFactor]).teamGapRows ?? grid.teamGapRows;
      assert.ok(first.top - (last.top + last.height) >= profileGap * h - 1e-6, `${label}: gap is at least the profile's teamGapRows strips`);
      assert.ok(f.visualBands[0].top >= 0, `${label}: nothing above the field`);
      const end = f.visualBands.at(-1);
      assert.ok(end.top + end.height <= height + 1e-6, `${label}: no strip leaves the field`);
      for (const c of f.visualCells) assert.ok(c.box.top >= 0 && c.box.top + c.box.height <= height + 1e-6, `${label}: cell inside the field`);
      // No cell lies in the gap: open ground.
      for (const c of f.visualCells) assert.ok(c.box.top + c.box.height <= last.top + last.height + 1e-6 || c.box.top >= first.top - 1e-6, `${label}: no tile in the gap`);
      for (const s of f.slots) assert.ok(Math.abs(s.ground - (s.box.top + s.box.height)) < 1e-6, `${label}: feet at the cell bottom`);
    }
  }
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
  const noGap=structuredClone(uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid);
  noGap.teamGapRows=0;assert.throws(()=>validatePerspectiveGrid(noGap),/visual bands/);
  const tall=structuredClone(uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid);
  tall.profiles.mobile.rowHeight=0.2;assert.throws(()=>validatePerspectiveGrid(tall),/mobile profile/);
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
        // Owner 2026-11-06: every mini HUD is exactly as wide as its cell (the old half-lane cap on desktop is gone; a
        // font scale fits the contents). It stays centred on its body.
        assert(Math.abs(actor.slot.miniHudWidth - box.width) < 1e-6);
        assert(Math.abs(actor.slot.miniHudLeft + actor.slot.miniHudWidth / 2 - actor.slot.x) < 1e-6, 'desktop HUD is centred over its body');
        continue;
      }
      assert.equal(actor.slot.miniHudWidth, box.width);
      assert(Math.abs(actor.slot.miniHudLeft - (box.left + box.skew * box.height / 2)) < 1e-6);
    }
    const back = formation.slots.filter(slot => slot.formationRole === 'enemy-back');
    assert.equal(new Set(back.map(slot => slot.miniHudTop)).size, 1, 'back-row HP geometry is level');
  }
});

// Owner 2026-11-06: "make the mini HUD only as wide as the cell". The short and desktop profiles no longer narrow it to
// 0.55 / 0.5 of the lane (that test is replaced): every profile gives the whole cell, and the contents are fitted by
// the mini HUD font scale instead.
test('every profile gives each HUD the whole width of its cell; desktop stays centred on the body', () => {
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  assert.equal(grid.miniHudInsetPx, 0);
  assert.equal(grid.short.hudWidthFraction, 1);
  for (const [width, height, narrow] of [[844, 240, false], [1600, 620, false], [390, 420, true]]) {
    const formation = alternativeFormation(plan(3), width, height, narrow);
    for (const cell of formation.cells) {
      assert.ok(Math.abs(cell.miniHudWidth - cell.box.width) < 1e-6, `${width}x${height}: HUD width is the cell width`);
      if (width === 1600) { // desktop: centred on the body, not the lane (owner 2026-10-28)
        assert.ok(Math.abs(cell.miniHudLeft + cell.miniHudWidth / 2 - cell.x) < 1e-6, `${width}x${height}: the desktop HUD is centred over its body`);
        continue;
      }
      const flush = cell.box.left + cell.box.skew * cell.box.height / 2;
      assert.ok(Math.abs(cell.miniHudLeft - flush) < 1e-6, `${width}x${height}: the HUD stands flush with its cell`);
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
    // 2026-11-05: 0.65, was 0.7. The gap and the player's second strip must also end above the cards (shortLandscape top .62, rowHeight .045).
    if (label === 'landscape') assert.ok(ground >= height * 0.65, `back-rank feet at ${ground}`);
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
  assert.equal(overheadGroupHeightPx(grid, { wide: true, shortWindow: true }), 84);
  assert.ok(overheadGroupHeightPx(grid, { wide: true }) > overheadGroupHeightPx(grid, { wide: true, shortWindow: true }));
  // Desktop form factor at 1101-1199 wide: the tall health row (min-width 1200) is not drawn, so the group is the phone's.
  assert.equal(overheadGroupHeightPx(grid, { wide: true, tall: false }), grid.miniHudGroupHeightPx, '1150 wide');
  assert.equal(overheadGroupHeightPx(grid, { wide: true, tall: false, shortWindow: false }), 78);
  // The stage's helper takes no frame and reads no layout: a selected frame hides its meters, so any DOM
  // measurement here would change with selection and refit the settled artwork on every click.
  const source = readSourceTextSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url));
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
  // heights for the same 60x150 envelope, 3 enemies (measured with the parent profile forced). 2026-11-05: the 116px floors drop to 5.2 (was 13.3):
  // the retuned strips (gap + two player strips above the cards) stand the back rank higher up the field, which a field that short cannot spare.
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid.shortLandscape;
  const makePlan = (width, height) => combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p0'], enemies: ['e0', 'e1', 'e2'] });
  for (const [width, height, floor] of [[667, 131, 15.1], [740, 116, 5.2], [780, 116, 5.2], [667, 187, 39.3]]) {
    const formation = alternativeFormation(makePlan(width, height), width, height, false);
    const actors = formation.slots.filter(slot => slot.side === 'enemy').map(slot => ({ slot, side: 'enemy', visibleWidth: 60, visibleHeight: 150, leading: 66, ratio: 1, multiplier: 1 }));
    for (const fit of fitAlternativeSprites({ width, height, actors, narrow: false })) assert.ok(fit.visibleHeight >= floor - 0.05, `${width}x${height}: ${fit.visibleHeight} < parent ${floor}`);
    const cell = formation.cells[0].box;
    assert.ok(cell.width - 2 * cell.skew * cell.height >= grid.minArtLaneFraction * width * (grid.right - grid.left) / 3 - 1e-6, `${width}x${height}: artwork keeps under ${grid.minArtLaneFraction} of the unsheared lane`);
  }
});

// Owner 2026-10-31: the battle grid sits lower so the back rank stands on the painted ground and the player's rank
// ends above the hand. Owner 2026-11-01: the field runs under the top of the cards (handOverlapFraction of a card's
// height), so rank D's bottom (top + 4 * rowHeight of the field) must stay above the resting top card edge, which is
// the field's bottom minus that overlap. Desktop is checked against the model's own field bottom at three viewports
// (short desktops such as 1366x657 clamp the overlap so the feet stand above the card edge).
// Cards may overlap the field's background, never a sprite's feet. The widescreen form factor has no profile of its
// own and falls back to `wide`; its player anchor must sit above the resting top card edge (10 cards rest at the same
// height as 5) at ultrawide-ish sizes, with the player in the right-hand lane.
test('widescreen player feet stay above the resting cards', () => {
  const footer = uiConfig.scenes.w4a.sizing.desktopFooter;
  const header = uiConfig.scenes.w4a.sizing.desktopHeader.splitHeightPx;
  for (const [width, height] of [[1920, 800], [2560, 1080], [1920, 980], [3440, 1440], [1920, 600]]) {
    const footerPlan = desktopFooterLayout({ width, height });
    const fieldHeight = desktopFieldBottom(footerPlan, { width, zoom: 1, rem: 16, formFactor: 'widescreen' }) - header;
    for (const count of [5, 10]) {
      const input = { width, height: footerPlan.handHeight, count, rem: 16, zoom: 1, compact: false, controlsHeight: 0, controlled: [], headroom: 0, formFactor: 'widescreen' };
      const cardTop = footerPlan.handTop + responsiveHandLayout(input, desktopHandLayout(input)).restTop;
      const formation = alternativeFormation(combatFormation({ width, height: fieldHeight, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
        friends: ['p0', 'p1', 'p2'], enemies: ['e0', 'e1', 'e2'] }), width, fieldHeight, false, { formFactor: 'widescreen' });
      for (const slot of formation.slots) assert.ok(header + slot.ground <= cardTop, `${width}x${height} x${count} cards: ${slot.side} ${slot.cell} feet ${header + slot.ground} below the cards at ${cardTop}`);
    }
  }
  assert.ok(footer.handOverlapFraction > 0);
});

// Phones: the field extension is whatever the real fan allows. For every field and hand height pair of a dense sweep
// (and the reviewed 360x660 case: field 306.7, hand 201.3) the lowest rank's ground, measured from the field's top,
// must stand at or above the resting top card edge that responsiveHandLayout produces: the hand band's top (the
// field's natural bottom) plus the fan's restTop. Both sides of shortBelowPx are swept; the short profile keeps
// its own 94% rank D.
test('phone field extension keeps every ground at or above the resting cards', () => {
  const sizing = uiConfig.scenes.w4a.sizing;
  const cases = [];
  for (const width of [360, 390, 467]) for (let natural = 200; natural <= 640; natural += 10) for (let hand = 150; hand <= 300; hand += 10) cases.push([width, natural, hand]);
  cases.push([360, 306.7, 201.3]);
  // The live chooser row (0, the reviewed 52px, and tall ones up to a third of the hand) raises the resting cards.
  for (const controls of [52, 100, 150]) for (const width of [360, 467]) for (let natural = 260; natural <= 560; natural += 20) for (const hand of [200, 240, 290]) cases.push([width, natural, hand, controls]);
  cases.push([360, 380, 260, 52]);
  for (const [width, natural, handHeight, controlsHeight = 0] of cases) {
    const extension = mobileFieldOverlap({ natural, width, handHeight, controlsHeight });
    assert.ok(extension >= 0 && extension <= sizing.mobileFieldHandOverlapPx, `${width}x${natural}/${handHeight}: extension ${extension} within the authored cap`);
    const input = { width, height: handHeight, count: 5, rem: 16, zoom: 1, compact: true, controlsHeight, controlled: [], headroom: 0, formFactor: 'mobile' };
    const cardTop = natural + responsiveHandLayout(input, handLayout(input)).restTop;
    const field = natural + extension;
    const formation = alternativeFormation(combatFormation({ width, height: field, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
      friends: ['p0'], enemies: ['e0', 'e1', 'e2'] }), width, field, true, { formFactor: 'mobile' });
    for (const slot of formation.slots) assert.ok(slot.ground <= cardTop + 1e-6, `${width}: field ${natural} hand ${handHeight}: ${slot.side} ${slot.cell} feet ${slot.ground} below the cards at ${cardTop}`);
  }
  const reviewed = mobileFieldOverlap({ natural: 306.7, width: 360, handHeight: 201.3 });
  assert.ok(reviewed < 66, '360x660 no longer takes the full cap');
});

test('desktop and phone profiles stand the back rank lower and keep the player strips above the hand', () => {
  const grid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
  assert.deepEqual([grid.profiles.desktop.top, grid.profiles.desktop.rowHeight], [0.44, 0.066]);  // owner 2026-11-13: triple the team gap (4.364 rows) and lower the field slightly
  assert.deepEqual([grid.profiles.mobile.top, grid.profiles.mobile.rowHeight], [0.5, 0.052]);  // owner 2026-11-13: the phone's gap tripled to 5.48 rows
  for (const key of ['desktop', 'mobile']) {
    const p = grid.profiles[key];
    assert.ok(p.top >= 0.4, `${key}: the back rank starts at or below 40% of the field`);
    assert.ok(p.top + perspectiveBandRows(grid, false, p).rows * p.rowHeight <= 1, `${key}: the profile validates`);
  }
  const footer = uiConfig.scenes.w4a.sizing.desktopFooter;
  const header = uiConfig.scenes.w4a.sizing.desktopHeader.splitHeightPx;
  const desktop = grid.profiles.desktop;
  for (const [width, height] of [[1280, 720], [1280, 800], [1920, 800], [1920, 980], [2560, 1080], [1366, 657], [1280, 600], [1280, 560]]) {
    const footerPlan = desktopFooterLayout({ width, height });
    const fieldBottom = desktopFieldBottom(footerPlan, { width, zoom: 1, rem: 16, formFactor: 'desktop' });
    const input = { width, height: footerPlan.handHeight, count: 5, rem: 16, zoom: 1, compact: false, controlsHeight: 0, controlled: [], headroom: 0, formFactor: 'desktop' };
    const fan = responsiveHandLayout(input, desktopHandLayout(input));
    const cardTop = footerPlan.handTop + fan.restTop;
    const overlap = fieldBottom - cardTop;
    assert.ok(overlap <= footer.handOverlapFraction * fan.cardHeight + 1e-6, `${width}x${height}: the field runs at most handOverlapFraction of a card under the cards`);
    // Short desktops shrink the overlap to keep rank D clear, they never drop it below the cards' top edge.
    assert.ok(overlap >= -1e-6, `${width}x${height}: the field reaches the cards`);
    const fieldHeight = fieldBottom - header;
    assert.ok(header + fieldHeight * (desktop.top + perspectiveBandRows(grid, false, desktop).rows * desktop.rowHeight) <= cardTop, `${width}x${height}: the last player strip ends above the resting cards`);
  }
  // Phone: the cards' top sits in the DOM (not in a model), so tests/battlefield-layout.browser.mjs and the measured
  // 390x844 / 360x740 shots own that check; the player front strip ends at 89% of the field here, the back strip at 99%.
  const formation = alternativeFormation(plan(3), 1280, 516, false, { formFactor: 'desktop' });
  const [back] = formation.visualBands;
  assert.ok(Math.abs(back.top - 516 * 0.44) < 1e-6 && Math.abs(back.height - 516 * 0.066) < 1e-6);
});
