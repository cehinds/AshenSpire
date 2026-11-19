// Owner ruling 2026-11-18: a Poise break applies 2 stacks each of Staggered, Vulnerable, Weak and Frail (poise.breakStatusStacks), until the
// owner's next turn starts. This had no engine path before: the Broken rule applied none of them, and the Staggered stance only 1 Vulnerable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { EndBrokenWhenDue, BREAK_STATUS_IDS } from '../src/engine/brokenRule.js';
import { getStacks, decayAtTurnStart } from '../src/engine/statuses.js';
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

test('the break statuses leave at the start of the owner\'s next turn: a player\'s next turn, an enemy\'s own turn later in the same round; Broken itself stays', () => {
  const { combat, player, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 2, max: 20 };
  play(combat, 'cometFragment', enemy.id);
  assert.ok(enemy.broken);
  assert.equal(getStacks(enemy, 'vulnerable'), 2);
  enemy.fixCoreDecayRound = -1; combat.phase = 'enemy';
  decayAtTurnStart(combat, enemy);
  for (const id of BREAK_STATUS_IDS) assert.equal(getStacks(enemy, id), 0, `${id} gone at the enemy's next turn start`);
  assert.ok(enemy.broken, 'the enemy is still Broken until its lost action is spent');
  // The player broken on its own turn: the statuses stay through the enemy phase and go when its next turn starts.
  combat.phase = 'player'; player.persistentPoise.value = 1;
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
