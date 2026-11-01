import test from 'node:test';
import assert from 'node:assert/strict';
import { combatHealthModel, stanceBadgeFor } from '../src/ui/models/CombatHealthModel.js';

const ctx = { combatExpansionVersion: 2 };
const entity = maneuver => ({ combatStance: maneuver ? { maneuver, camp: 'physical', range: 'melee' } : undefined });

test('the stance badge ends the row with the stance glyph and a help line', () => {
  for (const [maneuver, label] of [['attack', 'Attack'], ['counter', 'Counter'], ['evade', 'Evade']]) {
    const stance = stanceBadgeFor(entity(maneuver), ctx);
    assert.ok(stance, maneuver);
    const model = combatHealthModel({ defense: 5, precision: 2, stance });
    const last = model.badges[model.badges.length - 1];
    assert.equal(last.kind, 'stance');
    assert.equal(last.glyph, maneuver);
    assert.match(last.help, new RegExp(`^Stance: ${label}`));
  }
  assert.match(stanceBadgeFor(entity('counter'), ctx).help, /\+\d+ AR/);
  assert.match(stanceBadgeFor(entity('counter'), ctx).help, /\+\d+ DR/);
});

test('no stance, or a rules version without stances, shows no stance badge', () => {
  assert.equal(stanceBadgeFor(entity(null), ctx), null);
  assert.equal(stanceBadgeFor(entity('counter'), { combatExpansionVersion: 1 }), null);
  assert.equal(combatHealthModel({ defense: 5, stance: null }).badges.some(b => b.kind === 'stance'), false);
});

test('the Counter badge has its own glyph, distinct from every stance sigil', () => {
  const model = combatHealthModel({ counterStacks: 9, reflectStacks: 2, stance: stanceBadgeFor(entity('counter'), ctx) });
  const glyphs = Object.fromEntries(model.badges.map(b => [b.kind, b.glyph || b.kind]));
  assert.equal(glyphs.counter, 'riposte');
  assert.notEqual(glyphs.counter, glyphs.stance);
  assert.equal(model.badges.find(b => b.kind === 'counter').value, 9);
  assert.equal(model.badges.find(b => b.kind === 'reflect').value, 2);
});
