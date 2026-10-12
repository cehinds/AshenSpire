import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeFormation, fitAlternativeSprites, perspectiveCellContains, perspectiveLanePattern } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';

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
    for (const lane of [0, 1, 2]) {
      // Every anchor of a lane lies on one diagonal line of slope -skew.
      const column = formation.cells.filter(c => c.lane === lane);
      const intercepts = column.map(c => c.x + skew * c.ground);
      assert(Math.max(...intercepts) - Math.min(...intercepts) < 1e-6, 'a lane is one straight diagonal');
    }
    const back = enemies.filter(c => c.rank === 0), front = enemies.filter(c => c.rank === 1);
    assert(Math.max(...back.map(c => c.ground)) < Math.min(...front.map(c => c.ground)), 'back rank sits behind the front');
    assert(Math.max(...front.map(c => c.box.top + c.box.height)) <= Math.min(...players.map(c => c.box.top)) + 1e-6,
      'the party rank does not overlap the enemy ranks');
    for (const cell of formation.cells) {
      assert(cell.ground > cell.box.top && cell.ground < cell.box.top + cell.box.height, 'the foot anchor is inside its cell');
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
        const sizes = fitAlternativeSprites({ width, height, actors, narrow });
        assert.equal(sizes.length, actors.length);
        sizes.forEach((size, i) => {
          const actor = actors[i], halfWidth = visibleWidth * size.scale / 2;
          assert(size.scale > 0 && Number.isFinite(size.scale));
          assert(size.x - halfWidth >= 5 - 1e-6 && size.x + halfWidth <= width - 5 + 1e-6);
          assert(halfWidth * 2 <= actor.slot.box.width + 1e-6, 'a body fits its lane');
          assert(actor.slot.ground - size.visibleHeight >= actor.leading + 6 - 1e-6);
        });
      }
    }
  }
});

test('the party keeps room for its name and meters below the feet on short fields', () => {
  for (const height of [130, 160, 183, 420]) {
    const formation = alternativeFormation(plan(3), 844, height, false);
    for (const cell of formation.cells.filter(c => c.side === 'player')) assert(cell.ground <= height - 32 + 1e-9);
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
    const sizes = fitAlternativeSprites({ width, height, actors, narrow });
    const enemy = sizes.filter(size => formation.slots.find(s => s.id === size.id).side === 'enemy');
    const hound = enemy.find(size => actors.find(a => a.slot.id === size.id).enemyId === 'blightHound');
    const others = enemy.filter(size => size !== hound);
    assert.equal(new Set(others.map(size => Math.round(size.visibleHeight * 1e6))).size, 1, 'one minion height across both ranks');
    assert(Math.abs(hound.visibleHeight - others[0].visibleHeight * .5) < 1e-6, 'a low creature is half its class height');
  }
});
