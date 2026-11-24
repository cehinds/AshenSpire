// W25 (owner, 2026-11-14) Necrotic: x0.7 damage; ignores Poise entirely (Block then HP; Poise neither absorbs nor drops); each necrotic hit that lands while the target's Poise is broken adds Necrotic build-up
// equal to WIS for current Decay/Divine casting (archived W25: INT), at least 1; build-up at or above the target's current HP kills it at the end of its own turn (bosses too); against an `undead` target necrotic heals it by the damage instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fight, play, profile, reg } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { getStacks } from '../src/engine/statuses.js';
import { ElementTurnEnd } from '../src/engine/elementIdentity.js';

const NECROTIC = { combatProfile: { camp: 'spell', school: 'decay', damageType: 'arcane', magicShare: 1 }, tags: ['school:decay'], magicShare: 1 };
// Base doubled: Core halves card base damage (ceil, effects.baseDamageMultiplier 0.5), so the hit meets the element rules at the old 10.
const hit = (combat, target, base = 20) => profileDamageReceipt(combat, combat.player, target, base, { ...NECROTIC, skipRatingBonus: true }, { roll: 0 });
const stage = (receipt, id) => receipt.damageReceipt.hits[0].sources.find(row => row.id === id);
const archivedProfile = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-6727a255.json.gz', import.meta.url))));

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
  const played = play(combat, 'core.venomSpray', enemy.id);
  const dealt = combat.eventLog.find(event => event.type === 'damageDealt');
  assert.deepEqual([dealt.poiseMitigated, dealt.poiseDamage ?? 0], [0, 0], 'the hit neither met Poise nor drained it (the card prints a status whose own strain is not the hit)');
  assert.equal(played.lost.e1, played.row.faceValue);
  assert.ok(played.lost.e1 > 0);
});

test('current Decay build-up uses WIS, at least 1, ignoring higher INT', () => {
  for (const [wisdom, stacks] of [[4, 4], [0, 1]]) {
    const { combat, enemy } = fight({ enemies: 1, poise: 0, attributes: { wisdom, intelligence: 9 } });
    const played = play(combat, 'core.venomSpray', enemy.id, { upgraded: true });
    assert.equal(getStacks(enemy, 'necroticBuildup'), stacks, `WIS ${wisdom}, INT 9`);
    assert.equal(played.lost.e1, played.row.faceValue, 'shown = dealt');
    assert.ok(played.lost.e1 > 0, 'the live hit landed');
  }
});

test('archived 6727 with elements enabled retains INT build-up and leaves the live fixture untouched', () => {
  const archivedBefore = structuredClone(archivedProfile);
  const liveBefore = structuredClone(profile);
  for (const [intelligence, stacks] of [[4, 4], [0, 1]]) {
    const { combat, enemy } = fight({ registries: reg, profile: archivedProfile, enemies: 1, poise: 0, attributes: { intelligence, wisdom: 9 } });
    assert.equal(combat.fixCoreRules.elements.version, 1, 'the archived fight still has element rules');
    play(combat, 'core.graveToll', enemy.id);
    assert.equal(getStacks(enemy, 'necroticBuildup'), stacks, `archived INT ${intelligence}, WIS 9`);
  }
  assert.deepEqual(archivedProfile, archivedBefore, 'the supplied profile was not mutated');
  assert.deepEqual(profile, liveBefore, 'the default profile was not rebound');
  const current = fight({ attributes: { wisdom: 4, intelligence: 9 } });
  play(current.combat, 'core.venomSpray', current.enemy.id, { upgraded: true });
  assert.equal(getStacks(current.enemy, 'necroticBuildup'), 4, 'a subsequent default fight still uses WIS');
});

test('with Poise left necrotic adds no build-up; an elements-disabled old fight also adds none', () => {
  const held = fight({ enemies: 1, poise: 50 });
  const played = play(held.combat, 'core.venomSpray', held.enemy.id);
  assert.equal(getStacks(held.enemy, 'necroticBuildup'), 0, 'Poise left: no build-up');
  assert.equal(played.lost.e1, played.row.faceValue, 'the damage still ignores Poise');
  const old = fight({ enemies: 1, legacy: true });
  play(old.combat, 'core.venomSpray', old.enemy.id);
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
  const played = play(combat, 'core.venomSpray', enemy.id);
  assert.equal(played.row.faceValue, 0);
  assert.ok(enemy.hp > 400, 'healed');
  assert.equal(getStacks(enemy, 'necroticBuildup'), 0);
});
