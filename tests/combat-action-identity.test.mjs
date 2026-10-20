import test from 'node:test';
import assert from 'node:assert/strict';
import { combatActionIdentity } from '../src/ui/models/CombatActionIdentityModel.js';

const registries = { cards: new Map([['strike', { name: 'Sword Strike', tags: ['camp:physical', 'maneuver:attack'] }],
  ['guardCounter', { name: 'Guard Counter', tags: ['camp:physical', 'maneuver:counter'] }]]),
enemies: new Map([['soldier', { moves: { slash: { name: 'Blade Slash', tags: ['maneuver:attack'] },
  riposte: { name: 'Shield Riposte', tags: ['maneuver:counter'] } } }]]),
equipment: { armaments: [{ id: 'sword', name: 'Iron Sword' }, { id: 'shield', name: 'Round Shield' }] } };
const identity = (event, kind = 'attack') => combatActionIdentity({ kind, events: [event] }, registries, () => ({ enemyId: 'soldier' }));

test('committed card identity names its maneuver, card and actual weapon', () => {
  assert.equal(identity({ type: 'cardPlayed', cardId: 'strike', cardInstance: { sourceArmamentId: 'sword' } }), 'Attack · Sword Strike · Iron Sword');
});
test('a Counter return uses its own committed card or move, including outside the hand', () => {
  assert.equal(identity({ type: 'combatCounterTriggered', cardId: 'guardCounter', cardInstance: { sourceArmamentId: 'shield' } }, 'counter'), 'Counter · Guard Counter · Round Shield');
  assert.equal(identity({ type: 'combatCounterTriggered', sourceId: 'enemy', moveId: 'riposte' }, 'counter'), 'Counter · Shield Riposte');
});
test('enemy executed moves resolve on the receipt owner without leaking future intent', () => {
  assert.equal(identity({ type: 'enemyMoveStarted', sourceId: 'enemy', moveId: 'slash' }), 'Attack · Blade Slash');
  assert.equal(identity({ type: 'enemyActorTurnStarted', intent: { moveId: 'slash' } }), null);
  assert.equal(identity({ type: 'cardPlayed', cardId: 'missing', cardName: '<Unknown>' }), '<Unknown>');
});
