import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeCombatComposition, combatStandingGround } from '../src/ui/models/CombatCompositionModel.js';
import { alternativeFormation, fitAlternativeSprites } from '../src/ui/models/AlternativeFormationModel.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { alternativeEnemyTargetGrid } from '../src/ui/models/AlternativeEnemyTargetGridModel.js';

test('alternative labeled targets keep their original 88 pixel cells', () => {
  const targets = [{ id: 'a', x: 280, y: 190 }, { id: 'b', x: 350, y: 190 }];
  const slots = alternativeEnemyTargetGrid({ width: 650, height: 400, targets });
  assert.equal(slots.length, 2);
  assert(slots.every(slot => slot.width === 88 && slot.height === 88));
});

test('every body stands on its cell\'s foot anchor', () => {
  const actors = ['p', 'a', 'b'].map((id, i) => ({ side: i ? 'enemy' : 'player', visibleWidth: 60, leading: 40,
    slot: { id, x: [65, 195, 325][i], ground: [400, 210, 290][i] } }));
  const sizes = actors.map(a => ({ id: a.slot.id, x: 0, visibleHeight: 120, scale: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes, width: 390, height: 460 });
  fit.forEach((size, i) => {
    assert.equal(size.x, actors[i].slot.x);
    assert.equal(size.ground, actors[i].slot.ground);
    assert.equal(size.visibleHeight, 120, 'composition never refits the body');
  });
});

test('a body at the field edge stays on stage', () => {
  const actor = { side: 'enemy', visibleWidth: 100, leading: 40, slot: { id: 'a', x: 10, ground: 300 } };
  const [fit] = alternativeCombatComposition({ actors: [actor], sizes: [{ id: 'a', visibleHeight: 120, scale: 1, multiplier: 1 }], width: 390 });
  assert.equal(fit.x, 56);
});

test('a short portrait field keeps its enemies back on the floor, clear of the player', () => {
  // Owner's phone (2026-10-11): a 360x620 game viewport leaves a ~267px field.
  // On the perspective grid the enemy ranks stay well behind the party's.
  const height = 267, width = 360;
  const plan = alternativeFormation(combatFormation({ width, height, presentation: { perspectiveGrid: true, formationPreset: 'straight' },
    friends: ['p'], enemies: ['a', 'b'] }), width, height, true);
  const actors = plan.slots.map(slot => ({ slot, side: slot.side, visibleWidth: 60, visibleHeight: 160, leading: 40, ratio: 1, multiplier: 1 }));
  const fit = alternativeCombatComposition({ actors, sizes: fitAlternativeSprites({ width, height, actors, narrow: true }), width, height });
  const player = fit.find(f => f.id === 'p');
  for (const enemy of fit.filter(f => f.id !== 'p')) {
    assert.ok(enemy.ground <= height * .6, `enemy feet at ${enemy.ground}`);
    assert.ok(enemy.ground >= enemy.visibleHeight + 40 + 6 - 1e-9, 'intent and HP keep their headroom');
    assert.ok(player.ground - enemy.ground >= height * .25, 'depth between the player and the enemy row');
  }
  // The perspective composition carries no camera override: the backdrop frames the back rank.
  assert.equal(combatStandingGround(fit, actors, 0), Math.min(...fit.filter(f => f.id !== 'p').map(f => f.ground)));
});
