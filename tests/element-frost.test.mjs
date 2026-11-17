// W25 (owner, 2026-11-14) Frost: every frost hit applies Chill = 1 (+1 per 3 INT). Chill: -5% damage dealt per stack, the unit's next turn starts with
// -1 Stamina per 3 stacks, -1 stack per turn. A Poise break on a Chilled target Freezes it (loses its next action) and makes it Brittle (its next hit
// taken x1.5, then Brittle ends).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { getStacks, decayAtTurnStart } from '../src/engine/statuses.js';
import { ElementTurnStart } from '../src/engine/elementIdentity.js';

const SLASH = { combatProfile: { camp: 'physical', damageType: 'slashing' } };
const FROST = { combatProfile: { camp: 'spell', school: 'frost', damageType: 'arcane', magicShare: 1 }, tags: ['school:frost'], magicShare: 1 };
// Base doubled: Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so the hit meets the element rules at the old 100.
const hit = (combat, source, target, carrier = SLASH, base = 200) => profileDamageReceipt(combat, source, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const stage = (receipt, id) => receipt.damageReceipt.hits[0].sources.find(row => row.id === id);

// core.frostNip is a cantrip that prints Chill itself (w25-cantrips: a school cantrip carries its school status), so a hit adds the rule's stacks to it.
const FROST_NIP_PRINTED_CHILL = 3;
test('every frost hit applies 1 Chill plus 1 per 3 INT, to a single target', () => {
  for (const [intelligence, stacks] of [[0, 1], [2, 1], [3, 2], [4, 2], [6, 3], [9, 4]]) {
    const { combat, enemies } = fight({ enemies: 2, attributes: { intelligence } });
    play(combat, 'core.frostNip', enemies[0].id);
    assert.equal(getStacks(enemies[0], 'chill'), stacks + FROST_NIP_PRINTED_CHILL, `INT ${intelligence}`);
    assert.equal(getStacks(enemies[1], 'chill'), 0, 'frost never spreads by element');
  }
  const old = fight({ enemies: 1, legacy: true });
  play(old.combat, 'core.frostNip', old.enemy.id);
  assert.equal(getStacks(old.enemy, 'chill'), FROST_NIP_PRINTED_CHILL, 'an old fight adds no element Chill: only the card\'s printed Chill');
});

test('Chill: -5% of the damage the chilled unit deals, per stack', () => {
  const { combat, enemy, player } = fight({ enemies: 1 });
  // Empty the target's Poise so the hit lands 1:1 and only Chill moves it (Core gear now grants Poise, whose capped share is not linear).
  player.persistentPoise.value = 0;
  const plain = hit(combat, enemy, player).hpLoss;
  enemy.statuses.chill = { stacks: 4 };
  const chilled = hit(combat, enemy, player);
  assert.equal(stage(chilled, 'element-chill').multiplier, 0.8);
  assert.equal(chilled.hpLoss, Math.floor(plain * 0.8));
});

test('Chill: the next turn starts with 1 less Stamina per 3 stacks, for an enemy and for the player; one stack wears off per turn', () => {
  const { combat, enemy, player } = fight({ enemies: 1 });
  enemy.statuses.chill = { stacks: 7 };
  ElementTurnStart(combat, enemy);
  assert.equal(enemy.pendingStaminaLoss, 2);
  player.statuses.chill = { stacks: 3 };
  ElementTurnStart(combat, player);
  assert.equal(player.pendingActionLoss, 1);
  player.statuses.chill = { stacks: 2 };
  player.pendingActionLoss = 0;
  ElementTurnStart(combat, player);
  assert.equal(player.pendingActionLoss, 0, '2 stacks are not enough');
  decayAtTurnStart(combat, enemy);
  assert.equal(getStacks(enemy, 'chill'), 6);
});

test('a frost hit that breaks Poise on a Chilled target Freezes and Brittles it; without Chill (an old fight) it does not', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 3 });
  play(combat, 'core.frostNip', enemy.id);
  assert.equal(enemy.persistentPoise.value, 0, 'broke Poise');
  assert.equal(getStacks(enemy, 'chill') > 0, true);
  assert.equal(getStacks(enemy, 'freeze'), 1);
  assert.equal(getStacks(enemy, 'brittle'), 1);
  const old = fight({ enemies: 1, poise: 3, legacy: true });
  play(old.combat, 'core.frostNip', old.enemy.id);
  assert.equal(getStacks(old.enemy, 'freeze') + getStacks(old.enemy, 'brittle'), 0);
});

test('Freeze: the unit loses its next action (an enemy skips its turn, the player starts with less Stamina) and Freeze ends', () => {
  const { combat, enemy, player } = fight({ enemies: 1 });
  enemy.statuses.freeze = { stacks: 1 };
  ElementTurnStart(combat, enemy);
  assert.equal(enemy.skipNextTurn, true);
  assert.equal(getStacks(enemy, 'freeze'), 0);
  player.statuses.freeze = { stacks: 1 };
  ElementTurnStart(combat, player);
  assert.equal(player.pendingActionLoss, 2);
});

test('Brittle: the next hit taken deals x1.5 and is the last; the quote shows it and the hit spends it', () => {
  const { combat, enemy } = fight({ enemies: 1 });
  enemy.statuses.brittle = { stacks: 1 };
  assert.equal(stage(hit(combat, combat.player, enemy), 'element-brittle').multiplier, 1.5);
  assert.equal(getStacks(enemy, 'brittle'), 1, 'a receipt never spends it');
  const first = play(combat, 'core.strike', enemy.id);
  assert.equal(first.lost.e1, first.row.faceValue, 'shown = dealt');
  assert.equal(getStacks(enemy, 'brittle'), 0, 'the hit spent it');
  const plain = fight({ enemies: 1 });
  const unbroken = play(plain.combat, 'core.strike', plain.enemy.id);
  // The hit carries a fraction before it is floored for display (the Attack stance's +20% on 9 is 10.8), so x1.5 of the unrounded hit is
  // at least floor(1.5 x the shown hit) and below 1.5 x (the shown hit + 1).
  assert.ok(first.lost.e1 >= Math.floor(unbroken.lost.e1 * 1.5) && first.lost.e1 < (unbroken.lost.e1 + 1) * 1.5, 'x1.5 of the same hit');
});
