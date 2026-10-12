import test from 'node:test';
import assert from 'node:assert/strict';
import { combatLogEntries } from '../src/model/combatLog.js';
import { guardHitFloatParts } from '../src/ui/fx.js';

const enemies = [{ id: 'e1', enemyId: 'graveWisp' }];
const log = events => combatLogEntries(events, { enemies }).map(row => row.text);

test('the combat log shows each layer a hit spent and what it left, then the damage inflicted', () => {
  const [line] = log([{ type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 2, blocked: 0,
    barrierAbsorbed: 6, barrierRemaining: 0, wardAbsorbed: 3, wardRemaining: 0, blockRemaining: 0 }]);
  assert.match(line, /for 11: Barrier absorbed 6 \(6 → 0\), Ward absorbed 3 \(3 → 0\); 2 damage dealt\./);
});

test('a hit Barrier stops outright reads resisted, in the log and on the fighter', () => {
  const event = { type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 0, blocked: 0, barrierAbsorbed: 4, barrierRemaining: 2 };
  assert.match(log([event])[0], /resisted the attack: Barrier absorbed 4 \(6 → 2\)\./);
  assert.equal(guardHitFloatParts(event).barrier.text, '4 RESISTED');
});

test('a miss shows the roll and what it needed', () => {
  const [line] = log([{ type: 'combatAvoidanceResolved', sourceId: 'e1', targetId: 'player', avoided: true,
    evade: { roll: 14, total: 17, difficulty: 12, success: true } }]);
  assert.match(line, /missed .*Evade rolled 14 \+ 3 bonus = 17, needed more than 12\./);
});

test('Ward and Barrier breaks are logged', () => {
  const lines = log([{ type: 'barrierBroken', targetId: 'player' }, { type: 'wardBroken', targetId: 'player', staminaLoss: 1 }]);
  assert.match(lines[0], /Barrier broke/); assert.match(lines[1], /Ward broke \(−1 Stamina next turn\)/);
});

test('a Ward refill from Barrier overflow is logged with what it restored', () => {
  const [line] = log([{ type: 'persistentWardChanged', targetId: 'player', restored: 4, value: 10, max: 10, source: 'barrier' }]);
  assert.match(line, /^Forsaken restored 4 Ward \(6 → 10\)\.$/);
});

test('a Ward change that restores nothing is not logged', () => {
  assert.deepEqual(log([{ type: 'persistentWardChanged', targetId: 'player', value: 3, max: 10 }]), []);
});

test('Poise shows as its own layer after Block, and the total includes what it absorbed', () => {
  // A physical 10: Block takes 3, Poise takes 4 of the 7 that reached it, 3 reach Health.
  const [line] = log([{ type: 'damageDealt', sourceId: 'e1', targetId: 'player', amount: 6, blocked: 3, blockRemaining: 0,
    poiseAbsorbed: 4, poiseRemaining: 0 }]);
  assert.match(line, /for 10: Block absorbed 3 \(3 → 0\), Poise absorbed 4 \(4 → 0\); 3 damage dealt\./);
});

test('a Poise break staggers an enemy and costs a player Stamina next turn', () => {
  const lines = log([{ type: 'poiseBroken', targetId: 'e1', interrupted: true, staminaLoss: 1 }, { type: 'poiseBroken', targetId: 'player', staminaLoss: 1 }]);
  assert.equal(lines[0], "Enemy's Poise broke (interrupted).", 'an enemy is interrupted and pays no Stamina');
  assert.equal(log([{ type: 'wardBroken', targetId: 'e1', interrupted: true, staminaLoss: 1 }])[0], "Enemy's Ward broke (interrupted).");
  assert.match(lines[1], /^Forsaken's Poise broke \(−1 Stamina next turn\)\.$/);
});

test('the stagger meter (ratingImpact poise) is named apart from the Poise pool', () => {
  const [line] = log([{ type: 'ratingImpact', targetId: 'e1', meter: 'poise', amount: 3, value: 5, max: 12 }]);
  assert.match(line, /stagger meter took 3 \(5\/12\)\.$/);
});
