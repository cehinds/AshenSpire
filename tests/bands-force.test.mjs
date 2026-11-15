// Owner, 2026-11-15 (W25-BANDS) rule 6: Force moves an enemy between rows (push: front to back, pull: back to front).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { bandsFight, pairOf } from './helpers/bands-fight.mjs';
import { ElementPushPull } from '../src/engine/elementIdentity.js';

const galeFight = (opts = {}) => {
  const combat = bandsFight({ hand: ['core.batteringGale'], ...opts });
  combat.player.mana = combat.player.maxMana = 9;
  for (const enemy of combat.enemies) Object.assign(enemy, { hp: 500, maxHp: 500 });
  return combat;
};

test('a Force card pushes the hit front-row enemy to the back row (shown = dealt)', () => {
  const combat = galeFight();
  const [front] = combat.enemies;
  assert.equal(front.row, 'front');
  const shown = previewCard(combat, 'qa0', front.id);
  const hp = front.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: front.id });
  assert.equal(front.row, 'back');
  assert.equal(combat.rangeState.engagements[pairOf(front.id)], 1, 'out of melee reach');
  const dealt = hp - front.hp;
  assert.ok(dealt > 0);
  assert.equal(shown.cost, previewCard(galeFight(), 'qa0', 'e1').cost, 'the push does not change the price');
});

test('a pull brings a back-row enemy to the front row; a push of a back-row enemy changes nothing', () => {
  const combat = galeFight();
  const [, back] = combat.enemies;
  assert.equal(back.row, 'back');
  ElementPushPull(combat, combat.player, back, { tags: ['school:force'] });
  assert.equal(back.row, 'back');
  ElementPushPull(combat, combat.player, back, { tags: ['school:force', 'pull'] });
  assert.equal(back.row, 'front');
  assert.equal(combat.rangeState.engagements[pairOf(back.id)], 0, 'pulled into melee');
});

test('a pulled enemy keeps its planned reach move: it still fires on its turn', () => {
  const combat = bandsFight({ enemyIds: ['graveWisp', 'wanderingSoldier'] });
  const wisp = combat.enemies[0];
  assert.equal(wisp.row, 'back');
  const planned = wisp.intent?.moveId;
  assert.equal(wisp.intent.kind, 'attack');
  ElementPushPull(combat, combat.player, wisp, { tags: ['pull'] });
  assert.equal(wisp.row, 'front');
  assert.equal(wisp.intent.moveId, planned, 'the intent is kept');
  combat.enemies[1].skipNextTurn = true; // only the pulled enemy acts
  const hp = combat.player.hp;
  dispatch(combat, { type: 'endTurn' });
  assert.ok(combat.player.hp < hp, 'the planned reach attack landed');
});

test('a fight made without the bands key: Force moves the pair band only, no rows', () => {
  const saved = fixCoreMechanics.bands;
  delete fixCoreMechanics.bands;
  try {
    const combat = galeFight();
    const [front] = combat.enemies;
    dispatch(combat, { type: 'playCard', cardInstanceId: 'qa0', targetId: front.id });
    assert.equal(front.row, undefined);
    assert.equal(combat.rangeState.engagements[pairOf(front.id)], 1);
  } finally { fixCoreMechanics.bands = saved; }
});
