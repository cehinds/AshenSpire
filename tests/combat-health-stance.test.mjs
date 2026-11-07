import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel, stanceBadgeFor } from '../src/ui/models/CombatHealthModel.js';

const ctx = { combatExpansionVersion: 2 };
const entity = maneuver => ({ combatStance: maneuver ? { maneuver, camp: 'physical', range: 'melee' } : undefined });

// Owner 2026-11-05: no stance badge in the HUD row; the stance summary stays available as data.
test('the stance summary is still built, but the health row never carries a stance badge', () => {
  for (const [maneuver, label] of [['attack', 'Attack'], ['counter', 'Counter'], ['evade', 'Evade']]) {
    const stance = stanceBadgeFor(entity(maneuver), ctx);
    assert.ok(stance, maneuver);
    assert.match(stance.help, new RegExp(`^Stance: ${label}`));
    assert.equal(combatHealthModel({ defense: 5, precision: 2, stance }).badges.some(b => b.kind === 'stance'), false);
  }
  assert.match(stanceBadgeFor(entity('counter'), ctx).help, /\+\d+ AR/);
  assert.match(stanceBadgeFor(entity('counter'), ctx).help, /\+\d+ DR/);
});

test('no stance, or a rules version without stances, gives no stance summary', () => {
  assert.equal(stanceBadgeFor(entity(null), ctx), null);
  assert.equal(stanceBadgeFor(entity('counter'), { combatExpansionVersion: 1 }), null);
});

test('the Counter badge keeps its riposte glyph and its count', () => {
  const model = combatHealthModel({ counterStacks: 9, reflectStacks: 2 });
  assert.equal(model.badges.find(b => b.kind === 'counter').glyph, 'riposte');
  assert.equal(model.badges.find(b => b.kind === 'counter').value, 9);
  assert.equal(model.badges.find(b => b.kind === 'reflect').value, 2);
});
