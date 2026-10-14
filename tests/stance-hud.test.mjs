import assert from 'node:assert/strict';
import { combatHealthModel } from '../src/ui/models/CombatHealthModel.js';
import { calloutForEvent } from '../src/ui/fx.js';

const row = combatHealthModel({ evasion: 12, poise: 5, ward: 9, defense: 7, barrier: 2 });
assert.deepEqual(row.badges.map(badge => badge.kind), ['evade', 'poise', 'ward', 'shield']);
assert.equal(row.badges[0].value, 12);
assert.equal(row.badges[2].barrier, 2);
assert.deepEqual(combatHealthModel({ evasion: 0 }).badges.map(badge => badge.kind), ['evade']);
assert.deepEqual(combatHealthModel({}).badges, []);
assert.deepEqual(calloutForEvent({ type: 'attackHit', targetId: 'enemy:1', label: 'Hit' }), { kind: 'hit', targetId: 'enemy:1' });
assert.deepEqual(calloutForEvent({ type: 'attackHit', targetId: 'enemy:1', label: 'Hit — Evade Failed' }), { kind: 'evadeFailed', targetId: 'enemy:1' });
assert.deepEqual(calloutForEvent({ type: 'attackMissed', targetId: 'player' }), { kind: 'missed', targetId: 'player' });
console.log('stance HUD checks passed');
