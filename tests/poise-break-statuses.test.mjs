// Owner ruling 2026-11-18: a Poise break applies 2 stacks each of Staggered, Vulnerable, Weak and Frail (poise.breakStatusStacks), until the
// owner's next turn starts. This had no engine path before: the Broken rule applied none of them, and the Staggered stance only 1 Vulnerable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { EndBrokenWhenDue, BREAK_STATUS_IDS } from '../src/engine/brokenRule.js';
import { getStacks, decayAtTurnStart, removeStatus, TakeFromBreakGrant } from '../src/engine/statuses.js';
import { drainFixCorePoise } from '../src/engine/actions.js';

test('the break status stacks are a config value: 2', () => {
  assert.equal(fixCoreMechanics.poise.breakStatusStacks, 2);
  assert.deepEqual([...BREAK_STATUS_IDS], ['staggered', 'vulnerable', 'weak', 'frail']);
});

test('a Poise break applies 2 stacks each of Staggered, Vulnerable, Weak and Frail, and Broken ending removes them', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  assert.equal(enemy.persistentPoise.value, 0, 'Poise broke');
  assert.ok(enemy.broken, 'the owner is Broken');
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(enemy, id), 2, id);
  combat.turn = enemy.broken.endTurn;
  delete enemy.broken.loseNext;
  assert.equal(EndBrokenWhenDue(combat, enemy), true);
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(enemy, id), 0, `${id} leaves with Broken`);
});

test('a fight whose rules lack breakStatusStacks applies none', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  delete combat.fixCoreRules.poise.breakStatusStacks;
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(enemy, id), 0, id);
});

test('only what the break added leaves with Broken: 3 Vulnerable from Bash, a break (5), Broken ends -> 3 again; stacks added while Broken stay', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.statuses.vulnerable = { stacks: 3 }; // from Bash
  enemy.statuses.weak = { stacks: 1 };
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  assert.ok(enemy.broken);
  assert.equal(getStacks(enemy, 'vulnerable'), 5, '3 + the break\'s 2');
  assert.equal(getStacks(enemy, 'weak'), 3);
  enemy.statuses.frail = { stacks: (enemy.statuses.frail?.stacks || 0) + 4 }; // another source, while Broken
  combat.turn = enemy.broken.endTurn;
  delete enemy.broken.loseNext;
  assert.equal(EndBrokenWhenDue(combat, enemy), true);
  assert.equal(getStacks(enemy, 'vulnerable'), 3, 'back to the pre-break stacks (no decay ran in between)');
  assert.equal(getStacks(enemy, 'weak'), 1);
  assert.equal(getStacks(enemy, 'frail'), 4, 'the 4 added while Broken stay; only the break\'s 2 went');
  assert.equal(getStacks(enemy, 'staggered'), 0);
});

test('the break statuses leave at the start of the owner\'s next turn: this round if it has not started yet, else the next round; Broken itself stays', () => {
  const { combat, player, enemy } = fight({ enemies: 2, poise: 0 });
  const [a, b] = combat.enemies;
  // Enemy A broken in the player's phase: its turn has not started this round, so its statuses go at its turn start in the same round.
  a.fixCoreDecayRound = combat.turn - 1;
  a.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', a.id);
  assert.ok(a.broken);
  assert.equal(getStacks(a, 'vulnerable'), 2);
  combat.phase = 'enemy';
  decayAtTurnStart(combat, a);
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(a, id), 0, `${id} gone at the enemy's turn start that round`);
  assert.ok(a.broken, 'still Broken until its lost action is spent');
  // Enemy B broken by a hit during enemy A's action (the enemy phase, before B's own turn starts): gone at B's turn start that same round.
  b.fixCoreDecayRound = combat.turn - 1;
  b.persistentPoise = { value: 1, max: 20 };
  drainFixCorePoise(combat, a, b, 99);
  assert.ok(b.broken);
  assert.equal(getStacks(b, 'vulnerable'), 2);
  decayAtTurnStart(combat, b);
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(b, id), 0, `${id} gone at B's turn start that round, not a round later`);
  // An enemy broken after its own turn started waits for the next round.
  const c = fight({ enemies: 1, poise: 0 });
  c.enemy.fixCoreDecayRound = c.combat.turn; c.enemy.persistentPoise = { value: 1, max: 20 };
  drainFixCorePoise(c.combat, c.player, c.enemy, 99);
  assert.equal(getStacks(c.enemy, 'vulnerable'), 2);
  c.enemy.fixCoreDecayRound = -1; decayAtTurnStart(c.combat, c.enemy);
  assert.equal(getStacks(c.enemy, 'vulnerable'), 1, 'same round: only the ordinary decay');
  c.combat.turn += 1; c.enemy.fixCoreDecayRound = -1; decayAtTurnStart(c.combat, c.enemy);
  assert.equal(getStacks(c.enemy, 'vulnerable'), 0, 'gone at the next round\'s turn start');
  // The player broken on its own turn: the statuses stay through the enemy phase and go when its next turn starts.
  player.fixCoreDecayRound = combat.turn; combat.phase = 'player'; player.persistentPoise.value = 1;
  drainFixCorePoise(combat, enemy, player, 99);
  assert.ok(player.broken);
  assert.equal(getStacks(player, 'vulnerable'), 2);
  combat.phase = 'enemy';
  assert.equal(getStacks(player, 'vulnerable'), 2, 'they stay through the enemy phase');
  combat.turn += 1; combat.phase = 'player';
  player.fixCoreDecayRound = -1; decayAtTurnStart(combat, player);
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(player, id), 0, `${id} gone at the player's next turn start`);
  assert.ok(player.broken, 'the player stays Broken through the short turn');
});

test('a cleanse that empties a status the break added does not make a later gain from another source look like the grant', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  assert.equal(getStacks(enemy, 'vulnerable'), 2);
  removeStatus(combat, enemy, 'vulnerable', { reason: 'cleansed' }); // a cleanse takes it to 0
  assert.equal(getStacks(enemy, 'vulnerable'), 0);
  enemy.statuses.vulnerable = { stacks: 3 }; // another source adds stacks before Broken ends
  combat.turn = enemy.broken.endTurn; delete enemy.broken.loseNext;
  EndBrokenWhenDue(combat, enemy);
  assert.equal(getStacks(enemy, 'vulnerable'), 3, 'the other source\'s stacks stay');
  // A partial loss shrinks the grant first: 2 granted, 1 decayed, the last grant stack leaves, the held stacks stay.
  const second = fight({ enemies: 1, poise: 0 });
  second.enemy.statuses.vulnerable = { stacks: 3 };
  second.enemy.persistentPoise = { value: 2, max: 20 };
  play(second.combat, 'cometFragment', second.enemy.id);
  assert.equal(getStacks(second.enemy, 'vulnerable'), 5);
  removeStatus(second.combat, second.enemy, 'vulnerable', { amount: 1, reason: 'ownerTurnStart' });
  second.combat.turn = second.enemy.broken.endTurn; delete second.enemy.broken.loseNext;
  EndBrokenWhenDue(second.combat, second.enemy);
  assert.equal(getStacks(second.enemy, 'vulnerable'), 3, 'the loss took the grant first');
});

test('every stack loss takes the break\'s grant first, including gains made after the break: base 1, break +2, Bash +2, lose 1 -> expiry leaves 3', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.statuses.vulnerable = { stacks: 1 };
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  assert.equal(getStacks(enemy, 'vulnerable'), 3, '1 held + the break\'s 2');
  enemy.statuses.vulnerable.stacks += 2; // Bash, after the break
  removeStatus(combat, enemy, 'vulnerable', { amount: 1, reason: 'ownerTurnStart' }); // turn-start decay path
  assert.equal(getStacks(enemy, 'vulnerable'), 4);
  assert.equal(enemy.broken.statusGrants.vulnerable.granted, 1, 'the loss took the grant first');
  combat.turn = enemy.broken.endTurn; delete enemy.broken.loseNext;
  EndBrokenWhenDue(combat, enemy);
  assert.equal(getStacks(enemy, 'vulnerable'), 3);
});

test('turn-end decay and a cleanse also take the grant first', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  TakeFromBreakGrant(enemy, 'weak', 1); // the helper the turn-end decay and ClearTurnBoosts call
  assert.equal(enemy.broken.statusGrants.weak.granted, 1);
  TakeFromBreakGrant(enemy, 'weak', 5);
  assert.equal(enemy.broken.statusGrants.weak.granted, 0, 'never below 0');
  assert.equal(getStacks(enemy, 'frail'), 2);
  removeStatus(combat, enemy, 'frail', { reason: 'cleansed' });
  assert.equal(enemy.broken.statusGrants.frail.granted, 0, 'a cleanse to 0 takes the whole grant');
});
