// Owner, 2026-11-15 (W25-BANDS) rule 8: two or more enemies in the same row each gain `bands.formationBlock` Block at the start of their turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { bandsFight } from './helpers/bands-fight.mjs';
import { BandsFormationBlock } from '../src/engine/bandRows.js';

// Enemy Block is cleared and the formation Block gained at the enemy phase start; read it after the phase (a bare attack move adds none), as the difference from a bands-free fight.
const blockAfterPhase = (combat) => { dispatch(combat, { type: 'endTurn' }); return new Map(combat.enemies.map(e => [e.id, e.block || 0])); };
const baseline = ids => { const saved = fixCoreMechanics.bands; delete fixCoreMechanics.bands; try { return blockAfterPhase(bandsFight({ enemyIds: ids })); } finally { fixCoreMechanics.bands = saved; } };

test('the formation Block is data: 2 in the shipped rules', () => {
  assert.equal(fixCoreMechanics.bands.formationBlock, 2);
});

test('two enemies in one row each gain the Block; a lone enemy in its row gains none', () => {
  const pair = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier', 'graveWisp'] });
  assert.deepEqual(pair.enemies.map(e => e.row), ['front', 'front', 'back']);
  assert.deepEqual(pair.enemies.map(e => BandsFormationBlock(pair, e)), [2, 2, 0]);
  const base = baseline(['wanderingSoldier', 'wanderingSoldier', 'graveWisp']), blocks = blockAfterPhase(pair);
  assert.equal(blocks.get('e1') - base.get('e1'), 2);
  assert.equal(blocks.get('e2') - base.get('e2'), 2);
  assert.equal(blocks.get('e3') - base.get('e3'), 0, 'the lone back enemy gets none');
});

test('the Block is gained after the old Block falls away, so it never stacks turn on turn', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  combat.enemies[0].block = 9;
  assert.equal(blockAfterPhase(combat).get('e1') - baseline(['wanderingSoldier', 'wanderingSoldier']).get('e1'), 2, 'the 9 old Block is gone');
});

test('a fight made without the bands key gains no formation Block', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
    assert.equal(BandsFormationBlock(combat, combat.enemies[0]), 0);
    assert.equal(blockAfterPhase(combat).get('e1'), baseline(['wanderingSoldier', 'wanderingSoldier']).get('e1'));
  } finally { fixCoreMechanics.bands = saved; }
});

test('the formation Block honours the enemy\'s blockCap (the same +2 otherwise)', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  const [first] = combat.enemies;
  first.statuses = { ...first.statuses, unbreakable: { stacks: 1 } }; // keeps its Block through the turn start and caps it at 30
  first.block = 29;
  dispatch(combat, { type: 'endTurn' });
  assert.equal(first.block, 30, '29 + 2 stops at the cap');
});
