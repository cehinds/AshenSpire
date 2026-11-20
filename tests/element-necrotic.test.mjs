// W25 (owner, 2026-11-14) Necrotic: x0.7 damage; ignores Poise entirely (Block then HP; Poise neither absorbs nor drops); each necrotic hit that lands while the target's Poise is broken adds Necrotic build-up
// equal to the attacker INT (at least 1; stat contract 2026-11-18: Decay/Necrotic is Divine, so WIS, and a fight saved before spell traditions keeps INT); build-up at or above the target's current HP kills it at the end of its own turn (bosses too); against an `undead` target necrotic heals it by the damage instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { getStacks } from '../src/engine/statuses.js';
import { ElementTurnEnd } from '../src/engine/elementIdentity.js';

const NECROTIC = { combatProfile: { camp: 'spell', school: 'decay', damageType: 'arcane', magicShare: 1 }, tags: ['school:decay'], magicShare: 1 };
const hit = (combat, target, base = 10) => profileDamageReceipt(combat, combat.player, target, base, { ...NECROTIC, skipRatingBonus: true }, { roll: 0 });
const stage = (receipt, id) => receipt.damageReceipt.hits[0].sources.find(row => row.id === id);

test('necrotic deals x0.7 and ignores Poise: the pool neither absorbs nor drops, Block still soaks', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 20 });
  const receipt = hit(combat, enemy);
  assert.equal(stage(receipt, 'element-necrotic').multiplier, 0.7);
  assert.deepEqual([receipt.raw, receipt.poiseMitigated, receipt.poiseDrain || 0, receipt.hpLoss], [7, 0, 0, 7]);
  enemy.block = 3;
  const blocked = hit(combat, enemy);
  assert.deepEqual([blocked.blocked, blocked.hpLoss, blocked.poiseMitigated], [3, 4, 0], 'Block first, then HP');
  assert.equal(enemy.persistentPoise.value, 20);
});

test('live: a necrotic hit never touches Poise, and the quote is what is lost', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 4 });
  const played = play(combat, 'core.graveToll', enemy.id);
  const dealt = combat.eventLog.find(event => event.type === 'damageDealt');
  assert.deepEqual([dealt.poiseMitigated, dealt.poiseDamage ?? 0], [0, 0], 'the hit neither met Poise nor drained it (the card prints a status whose own strain is not the hit)');
  assert.equal(played.lost.e1, played.row.faceValue);
  assert.ok(played.lost.e1 > 0);
});

test('a hit on a target whose Poise is broken adds build-up equal to the attacker WIS, at least 1; with Poise left it adds none', () => {
  // Stat contract 2026-11-18: "Divine and Decay/Necrotic are Divine", read from WIS whatever INT is.
  for (const [wisdom, intelligence, stacks] of [[4, 0, 4], [0, 4, 1]]) {
    const { combat, enemy } = fight({ enemies: 1, poise: 0, attributes: { wisdom, intelligence } });
    play(combat, 'core.graveToll', enemy.id);
    assert.equal(getStacks(enemy, 'necroticBuildup'), stacks, `WIS ${wisdom}, INT ${intelligence}`);
  }
  for (const [intelligence, stacks] of [[4, 4], [0, 1]]) {
    const { combat, enemy } = fight({ enemies: 1, poise: 0, attributes: { intelligence, wisdom: 0 }, preTraditions: true });
    play(combat, 'core.graveToll', enemy.id);
    assert.equal(getStacks(enemy, 'necroticBuildup'), stacks, `before spell traditions, INT ${intelligence}`);
  }
  const held = fight({ enemies: 1, poise: 50 });
  const played = play(held.combat, 'core.graveToll', held.enemy.id);
  assert.equal(getStacks(held.enemy, 'necroticBuildup'), 0, 'Poise left: no build-up');
  assert.equal(played.lost.e1, played.row.faceValue, 'the damage still ignores Poise');
  const old = fight({ enemies: 1, legacy: true });
  play(old.combat, 'core.graveToll', old.enemy.id);
  assert.equal(getStacks(old.enemy, 'necroticBuildup'), 0, 'an old fight builds nothing');
});

test('build-up at or above current HP kills at the end of its own turn; below it, nothing', () => {
  const { combat, enemy } = fight({ enemies: 1 });
  enemy.hp = 10; enemy.statuses.necroticBuildup = { stacks: 9 };
  ElementTurnEnd(combat, enemy);
  assert.equal(enemy.alive, true);
  enemy.statuses.necroticBuildup.stacks = 10;
  ElementTurnEnd(combat, enemy);
  assert.equal(enemy.alive, false);
  assert.equal(enemy.hp, 0);
});

test('a boss dies too when its build-up reaches its HP at its turn end', () => {
  const { combat, enemy } = fight({ enemies: 1 });
  enemy.tags = ['boss']; enemy.hp = 10; enemy.statuses.necroticBuildup = { stacks: 10 };
  ElementTurnEnd(combat, enemy);
  assert.equal(enemy.alive, false);
  const other = fight({ enemies: 1 });
  other.enemy.tags = ['boss']; other.enemy.statuses.necroticBuildup = { stacks: 12 };
  ElementTurnEnd(other.combat, other.enemy);
  assert.equal(other.enemy.hp, 500, 'below its HP: nothing');
});

test('against an undead target necrotic heals it by the damage, adds no build-up, and the quote says no damage', () => {
  const { combat, enemy } = fight({ enemies: 1, undead: true });
  enemy.hp = 400;
  const receipt = hit(combat, enemy);
  assert.deepEqual([receipt.hpLoss, receipt.element.heal], [0, 7]);
  const played = play(combat, 'core.graveToll', enemy.id);
  assert.equal(played.row.faceValue, 0);
  assert.ok(enemy.hp > 400, 'healed');
  assert.equal(getStacks(enemy, 'necroticBuildup'), 0);
});
