// Owner, 2026-11-05: "use the front and back rows to indicate melee and reach". Display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { combatRangeRanks, rangeRankSnapshot, applyRangeRankEvent, rangeRanksFromSnapshot } from '../src/ui/models/CombatRangeRankModel.js';
import { alternativeFormation } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { createRangeState, rangePairKey, RANGE_POLICY_DEFAULTS } from '../src/model/combatEngagement.js';

const fight = (bands, { dead = [], range = true } = {}) => {
  const enemies = Object.keys(bands).map(id => ({ id, kind: 'enemy', alive: !dead.includes(id) }));
  const player = { id: 'player', alive: true };
  const combat = { player, enemies };
  if (range) {
    combat.rangeState = createRangeState({ ...RANGE_POLICY_DEFAULTS }, [{ key: 'player:player' }, ...enemies.map(e => ({ key: `enemy:${e.id}` }))]);
    for (const [id, band] of Object.entries(bands)) combat.rangeState.engagements[rangePairKey('player:player', `enemy:${id}`)] = band;
  }
  return combat;
};

test('melee stands front, reach stands back', () => {
  const melee = combatRangeRanks(fight({ e1: 0 }));
  assert.equal(melee.get('player:player'), 'front');
  assert.equal(melee.get('enemy:e1'), 'front');
  const reach = combatRangeRanks(fight({ e1: 1 }));
  assert.equal(reach.get('player:player'), 'back');
  assert.equal(reach.get('enemy:e1'), 'back');
});

test('mixed fight: the player is front if any enemy is at melee; each enemy follows its own band', () => {
  const ranks = combatRangeRanks(fight({ e1: 0, e2: 1 }));
  assert.equal(ranks.get('player:player'), 'front');
  assert.equal(ranks.get('enemy:e1'), 'front');
  assert.equal(ranks.get('enemy:e2'), 'back');
});

test('dead enemies are ignored and a player facing only reach enemies stays back', () => {
  const ranks = combatRangeRanks(fight({ e1: 0, e2: 1 }, { dead: ['e1'] }));
  assert.equal(ranks.has('enemy:e1'), false);
  assert.equal(ranks.get('player:player'), 'back');
});

test('no range state gives null', () => {
  assert.equal(combatRangeRanks(fight({ e1: 0 }, { range: false })), null);
  assert.equal(combatRangeRanks({ player: { id: 'player', alive: true }, enemies: [] }), null);
});

const plan = enemies => combatFormation({ width: 1000, height: 500, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
  friends: ['player'], enemies });
const strip = (formation, id) => formation.slots.find(s => s.id === id).formationRole;

test('the plan puts melee in the front strip and reach in the back strip, keeping lanes', () => {
  const base = alternativeFormation(plan(['e1', 'e2']), 1000, 500, false);
  const f = alternativeFormation(plan(['e1', 'e2']), 1000, 500, false, { rangeRanks: { player: 'front', e1: 'front', e2: 'back' } });
  assert.equal(strip(f, 'player'), 'player-front');
  assert.equal(strip(f, 'e1'), 'enemy-front');
  assert.equal(strip(f, 'e2'), 'enemy-back');
  for (const id of ['e1', 'e2']) assert.equal(f.slots.find(s => s.id === id).lane, base.slots.find(s => s.id === id).lane);
  const back = alternativeFormation(plan(['e1', 'e2']), 1000, 500, false, { rangeRanks: { player: 'back', e1: 'back', e2: 'back' } });
  assert.equal(strip(back, 'player'), 'player-back');
  const bands = Object.fromEntries(back.visualBands.map(b => [b.id, b.top]));
  const slot = back.slots.find(s => s.id === 'player');
  assert(slot.box.top >= bands['player-back'] - 1e-6 && slot.box.top > bands['player-front'], 'player drawn in the back strip, below the front strip');
});

test('three enemies at different ranks never share a strip lane', () => {
  const f = alternativeFormation(plan(['e1', 'e2', 'e3']), 1000, 500, false, { rangeRanks: { player: 'front', e1: 'front', e2: 'back', e3: 'front' } });
  const spots = f.slots.filter(s => s.side === 'enemy').map(s => `${s.formationRole}:${s.lane}`);
  assert.equal(new Set(spots).size, 3);
});

test('null ranks leave the layout identical to today', () => {
  const a = alternativeFormation(plan(['e1', 'e2']), 1000, 500, false);
  const b = alternativeFormation(plan(['e1', 'e2']), 1000, 500, false, { rangeRanks: null });
  assert.deepEqual(b, a);
});

test('playback: a strip changes on the beat of its own move, not when the engine finished', () => {
  // e1 is at melee, e2 at reach; in the enemy turn e1 acts, then e2 advances. `combat` is already post-dispatch.
  const before = fight({ e1: 0, e2: 1 });
  const snap = rangeRankSnapshot(before);
  const after = fight({ e1: 0, e2: 0 });
  assert.equal(combatRangeRanks(after).get('enemy:e2'), 'front', 'the finished state has e2 in front');
  const rank = () => rangeRanksFromSnapshot(snap).get('enemy:e2');
  assert.equal(rank(), 'back');
  applyRangeRankEvent(snap, { type: 'damageDealt', sourceId: 'e1', targetId: 'player' });
  assert.equal(rank(), 'back', 'e1 beats leave e2 behind');
  applyRangeRankEvent(snap, { type: 'combatEngagementMoved', sourceId: 'e2', targetId: 'player', bands: -1 });
  assert.equal(rank(), 'front', 'e2 steps up on its own move beat');
  applyRangeRankEvent(snap, { type: 'enemyDied', targetId: 'e1', enemyId: 'hound' });
  assert.equal(rangeRanksFromSnapshot(snap).has('enemy:e1'), false);
  assert.equal(rangeRankSnapshot(fight({ e1: 0 }, { range: false })), null);
});
