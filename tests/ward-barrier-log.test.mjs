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
