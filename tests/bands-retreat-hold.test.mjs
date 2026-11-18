// Owner, 2026-11-18 (ruling §12): an enemy sent back by Retreat or a push stays in the back row through its next turn;
// only after that does the empty-front-row rule pull it forward.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { bandsFight } from './helpers/bands-fight.mjs';

const endTurn = combat => dispatch(combat, { type: 'endTurn' });
const pulled = (combat, id) => combat.eventLog.some(e => e.type === 'combatRowChanged' && e.targetId === id && e.reason === 'frontEmpty');

test('a lone front enemy retreated stays back through its next enemy phase, then is pulled forward the phase after', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.retreat'] });
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.equal(enemy.row, 'back');
  assert.equal(enemy.rowHold, 1);
  endTurn(combat);
  assert.ok(!pulled(combat, enemy.id), 'the hold keeps it back at the first phase start');
  assert.equal(enemy.rowHold, 0, 'the hold is spent');
  if (enemy.row === 'back') {
    endTurn(combat);
    assert.ok(pulled(combat, enemy.id), 'the phase after, the empty front row pulls it forward');
  }
});

test('a push (Gale Push) holds the lone enemy back through its next phase', () => {
  const combat = bandsFight({ enemyIds: ['wanderingSoldier'], hand: ['core.galePush'] });
  const enemy = combat.enemies[0];
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: enemy.id });
  assert.equal(enemy.row, 'back');
  assert.equal(enemy.rowHold, 1);
  endTurn(combat);
  assert.ok(!pulled(combat, enemy.id));
  assert.equal(enemy.rowHold, 0);
});

test('two enemies: an unheld back enemy steps forward at once; the held one stays', () => {
  const combat = bandsFight({ hand: ['core.retreat'] }); // wanderingSoldier front, graveWisp back
  const [soldier, wisp] = combat.enemies;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0' });
  assert.deepEqual([soldier.row, wisp.row], ['back', 'back']);
  assert.ok(!(wisp.rowHold > 0), 'an enemy already back is not held');
  endTurn(combat);
  assert.ok(pulled(combat, wisp.id), 'the unheld back enemy steps forward');
  assert.ok(!pulled(combat, soldier.id), 'the held one stays');
});
