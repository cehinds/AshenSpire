// Owner ruling 2026-11-18 section 21: each Pierce stack deals 5 Poise damage BEFORE the card's damage resolves (pierce.poisePerStack).
// If that empties Poise the target breaks at once and the break's Vulnerable x1.25 applies to the same hit; then Block, Poise, HP as usual.
// The existing Block bypass stays. The break rule here is the Staggered stance (Vulnerable 1): the Broken x1.5 rule has its own pending ruling (3a).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { fixCoreMechanics } from '../src/content/generated/fixCoreMechanics.js';
import { fixCorePierceRules } from '../src/model/fixCoreMechanics.js';

const PIERCE = { combatProfile: { camp: 'physical', damageType: 'piercing', reach: 'contact' }, tags: ['camp:physical', 'pierce', 'damage:piercing'] };
const BLUNT = { combatProfile: { camp: 'physical', damageType: 'blunt', reach: 'contact' }, tags: ['camp:physical', 'damage:blunt'] };
const hit = (combat, target, carrier, base = 8) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const stancePoiseBreak = combat => { delete combat.fixCoreRules.poise.breakRule; return combat; };

test('the Pierce Poise damage is a config value: 5 per stack', () => {
  assert.equal(fixCoreMechanics.pierce.poisePerStack, 5);
  assert.equal(fixCorePierceRules({}).poisePerStack, 0, 'a fight saved without the key strips none');
});

test('(a) Pierce 1, 4 damage, target Poise 5: broken first, 5 HP damage (4 x 1.25), no Poise left to absorb', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  stancePoiseBreak(combat);
  enemy.persistentPoise = { value: 5, max: 20 };
  const receipt = hit(combat, enemy, PIERCE);
  assert.equal(receipt.pierceOpener.spent, 5);
  assert.equal(receipt.poiseMitigated, 0, 'no Poise absorbs the hit');
  assert.equal(receipt.poiseDrain, 5, 'the opener took the whole pool');
  assert.equal(receipt.hpLoss, 5, '4 x 1.25 Vulnerable from the break, same hit');
});

test('(a) live: the play empties Poise, breaks the target (Staggered, Vulnerable) and costs the same HP the quote showed', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  stancePoiseBreak(combat);
  enemy.persistentPoise = { value: 5, max: 20 };
  const hp = enemy.hp;
  const { row, lost } = play(combat, 'rogueShiv', enemy.id);
  assert.equal(enemy.persistentPoise.value, 0);
  assert.ok((enemy.statuses.vulnerable?.stacks || 0) >= 1, 'the break applied Vulnerable');
  assert.equal(lost[enemy.id], row.totalDamage, 'shown = dealt');
  assert.ok(hp - enemy.hp > 0);
});

test('(b) against Poise 8, Pierce 1 strips 5 first (3 left), then the 4 damage meets Poise as usual and nothing is broken', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  stancePoiseBreak(combat);
  enemy.persistentPoise = { value: 8, max: 20 };
  const receipt = hit(combat, enemy, PIERCE);
  assert.equal(receipt.pierceOpener.spent, 5);
  assert.equal(receipt.damageReceipt.hits[0].incoming, 4, 'no Vulnerable: Poise is not 0');
  assert.ok(receipt.poiseMitigated >= 1 && receipt.poiseMitigated <= 3, `the 3 Poise left absorbs its normal share (${receipt.poiseMitigated})`);
  assert.equal(receipt.hpLoss, 4 - receipt.poiseMitigated);
  assert.equal(receipt.poiseDrain, 5);
});

test('a non-Pierce hit strips no Poise, and the Block bypass of a Pierce hit is unchanged', () => {
  const { combat, enemy } = fight({ enemies: 1, poise: 0 });
  enemy.persistentPoise = { value: 8, max: 20 };
  assert.equal(hit(combat, enemy, BLUNT).pierceOpener, undefined);
  enemy.block = 10;
  const receipt = hit(combat, enemy, PIERCE, 40);
  assert.equal(receipt.pierceBypassed, Math.floor(0.2 * receipt.damageReceipt.hits[0].incoming), '20% of the hit goes past Block');
});
