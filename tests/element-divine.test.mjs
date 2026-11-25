// W25 (owner, 2026-11-14) Divine: a hit heals the attacker 1 HP per point of WIS and removes 1 Necrotic build-up and 1 Shock per point of WIS from it;
// x1.5 against an `undead` enemy; when it breaks Poise, 50% of the hit is also dealt straight to HP (Smite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { getStacks } from '../src/engine/statuses.js';

const DIVINE = { combatProfile: { camp: 'spell', school: 'divine', damageType: 'arcane', magicShare: 1 }, tags: ['school:divine'], magicShare: 1 };
// Base doubled: Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so the hit meets the element rules at the old 10.
const hit = (combat, target, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...DIVINE, skipRatingBonus: true }, { roll: 0 });
const stage = (receipt, id) => receipt.damageReceipt.hits[0].sources.find(row => row.id === id);

test('a divine hit heals the attacker WIS and removes WIS Necrotic build-up and WIS Shock from it', () => {
  const { combat, enemies, player } = fight({ enemies: 1, attributes: { wisdom: 3 } });
  player.hp = player.maxHp - 10;
  player.statuses.necroticBuildup = { stacks: 5 };
  player.statuses.shock = { stacks: 2 };
  play(combat, 'core.dawnFlame', enemies[0].id);
  assert.equal(player.hp, player.maxHp - 7, '+3 HP');
  assert.equal(getStacks(player, 'necroticBuildup'), 2, '5 - 3');
  assert.equal(getStacks(player, 'shock'), 0, '2 - 3, not below zero');
});

test('a divine hit with WIS 0 heals and removes nothing', () => {
  const { combat, enemies, player } = fight({ enemies: 1, attributes: { wisdom: 0 } });
  player.hp = player.maxHp - 10;
  player.statuses.shock = { stacks: 2 };
  play(combat, 'core.dawnFlame', enemies[0].id);
  assert.equal(player.hp, player.maxHp - 10);
  assert.equal(getStacks(player, 'shock'), 2);
});

test('x1.5 against an undead enemy, nothing against another', () => {
  const living = fight({ enemies: 1 }), dead = fight({ enemies: 1, undead: true });
  assert.equal(stage(hit(living.combat, living.enemy), 'element-divine-undead'), undefined);
  assert.equal(stage(hit(dead.combat, dead.enemy), 'element-divine-undead').multiplier, 1.5);
  assert.equal(hit(dead.combat, dead.enemy).raw, 15);
});

test('an enemy of the real undead kind is read from its definition tags', () => {
  const { combat, enemy } = fight({ enemies: 1, enemyId: 'huskBrute' });
  assert.equal(stage(hit(combat, enemy), 'element-divine-undead').multiplier, 1.5);
});

// d4298c12499: the original spell-Poise absorption arithmetic precedes weapon Poise.
function historicalDivineFight(options) {
  const world = fight(options);
  world.combat.fixCoreRules.poise = { drain: 'prevented' };
  world.combat.fixCoreRules.ward = { enabled: false };
  return world;
}

test('Smite: a divine hit that breaks Poise deals 50% of the hit straight to HP on top, and the quote of the hit is unchanged', () => {
  const smiting = historicalDivineFight({ enemies: 1, poise: 4 }), plain = historicalDivineFight({ enemies: 1, poise: 4, legacy: true });
  const withRules = play(smiting.combat, 'core.dawnFlame', smiting.enemy.id), without = play(plain.combat, 'core.dawnFlame', plain.enemy.id);
  assert.equal(smiting.enemy.persistentPoise.value, 0, 'broke Poise');
  // Spells meet Poise first, so the quoted number is the whole hit: 4 of it went to the pool, the rest to HP, and the Smite is half of the whole hit.
  assert.equal(withRules.lost.e1, withRules.row.faceValue - 4 + Math.floor(withRules.row.faceValue * 0.5), 'the HP the hit left plus half of the hit (HP and Poise it dealt)');
  assert.ok(withRules.lost.e1 > without.lost.e1);
});

test('no Smite without a break, and an old fight has no healing', () => {
  const { combat, enemies } = historicalDivineFight({ enemies: 1, poise: 500 });
  const played = play(combat, 'core.dawnFlame', enemies[0].id);
  // Poise (500) meets the whole spell first, so nothing reaches HP and no Smite follows: the pool lost exactly the quoted hit.
  assert.equal(played.lost.e1, 0);
  assert.equal(500 - enemies[0].persistentPoise.value, played.row.faceValue);
  const old = fight({ enemies: 1, legacy: true, attributes: { wisdom: 3 } });
  old.player.hp = old.player.maxHp - 10;
  play(old.combat, 'core.dawnFlame', old.enemy.id);
  assert.equal(old.player.hp, old.player.maxHp - 10);
});
