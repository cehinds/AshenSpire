import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeFormation, fitAlternativeSprites, perspectiveLanePattern } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';

const plan = (count, players = 1) => combatFormation({ width: 1000, height: 500,
  presentation: { perspectiveGrid: true, formationPreset: 'straight' },
  friends: Array.from({ length: players }, (_, i) => `p${i}`),
  enemies: Array.from({ length: count }, (_, i) => `e${i}`) });

test('the perspective grid is uniform: every rank shares the same lanes', () => {
  for (const [width, height, narrow] of [[1600, 620, false], [390, 420, true], [844, 220, false]]) {
    const formation = alternativeFormation(plan(6), width, height, narrow);
    const enemies = formation.cells.filter(c => c.side === 'enemy');
    const players = formation.cells.filter(c => c.side === 'player');
    assert.equal(enemies.length, 6);
    assert.equal(players.length, 3, 'one player rank of three lanes');
    for (const lane of [0, 1, 2]) {
      const column = formation.cells.filter(c => c.lane === lane);
      assert.equal(new Set(column.map(c => Math.round(c.x * 1e6))).size, 1, 'a lane has one x in every rank');
      assert.equal(new Set(column.map(c => Math.round(c.box.width * 1e6))).size, 1);
    }
    const back = enemies.filter(c => c.rank === 0), front = enemies.filter(c => c.rank === 1);
    assert(Math.max(...back.map(c => c.ground)) < Math.min(...front.map(c => c.ground)), 'back rank sits behind the front');
    assert(Math.max(...front.map(c => c.ground)) < Math.min(...players.map(c => c.ground)), 'the party stands nearest');
    for (const cell of formation.cells) {
      assert(cell.ground > cell.box.top && cell.ground < cell.box.top + cell.box.height, 'the foot anchor is inside its cell');
      assert(Math.abs(cell.x - (cell.box.left + cell.box.width / 2)) < 1e-9);
      assert(cell.box.top + cell.box.height <= height + 1e-6);
    }
  }
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
