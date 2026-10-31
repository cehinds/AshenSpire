import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel, stanceBadgeFor } from '../src/ui/models/CombatHealthModel.js';

const ctx = { combatExpansionVersion: 2 };
const entity = maneuver => ({ combatStance: maneuver ? { maneuver, camp: 'physical', range: 'melee' } : undefined });

test('the stance badge leads the row with the stance glyph and a help line', () => {
  for (const [maneuver, label] of [['attack', 'Attack'], ['counter', 'Counter'], ['evade', 'Evade']]) {
    const stance = stanceBadgeFor(entity(maneuver), ctx);
    assert.ok(stance, maneuver);
    const model = combatHealthModel({ defense: 5, precision: 2, stance });
    assert.equal(model.badges[0].kind, 'stance');
    assert.equal(model.badges[0].glyph, maneuver);
    assert.match(model.badges[0].help, new RegExp(`^Stance: ${label}`));
  }
  assert.match(stanceBadgeFor(entity('counter'), ctx).help, /\+\d+ AR/);
  assert.match(stanceBadgeFor(entity('counter'), ctx).help, /\+\d+ DR/);
});

test('no stance, or a rules version without stances, shows no stance badge', () => {
  assert.equal(stanceBadgeFor(entity(null), ctx), null);
  assert.equal(stanceBadgeFor(entity('counter'), { combatExpansionVersion: 1 }), null);
  assert.equal(combatHealthModel({ defense: 5, stance: null }).badges.some(b => b.kind === 'stance'), false);
});
