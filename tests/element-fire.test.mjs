// W25 (owner, 2026-11-14) Fire: a single-target fire card hits every enemy at x0.6; it ignores 1 Poise per point of WIS + INT; breaking
// Poise inflicts Burn (stacks = INT, at least 1). Stat contract 2026-11-18: fire is a shared tradition, so both now read the higher of INT
// and WIS, never their sum; a fight saved before spell traditions keeps the old reads. Burn: +5% damage taken per stack, 1 HP per stack at turn start, 5% per stack to explode
// for its stacks on the owner's allies (clearing it), no stack cap (owner). A fight without `elements` rules plays as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fight, play } from './elementFixture.mjs';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { applyStatus, getStacks } from '../src/engine/statuses.js';
import { ElementOfHit } from '../src/model/elementIdentityRules.js';
import { ElementTurnStart } from '../src/engine/elementIdentity.js';

const FIRE = { combatProfile: { camp: 'spell', school: 'fire', damageType: 'arcane', magicShare: 1 }, tags: ['school:fire'], magicShare: 1 };
const hit = (combat, target, carrier = FIRE, base = 10) => profileDamageReceipt(combat, combat.player, target, base, { ...carrier, skipRatingBonus: true }, { roll: 0 });
const stage = (receipt, id) => receipt.damageReceipt.hits[0].sources.find(row => row.id === id);

test('the element of a hit is its school or damage type: a fire spell is fire even though spells default to arcane damage', () => {
  assert.equal(ElementOfHit(FIRE), 'fire');
  assert.equal(ElementOfHit({ combatProfile: { damageType: 'arcane' } }), null, 'a spell default damage type is not an element');
  assert.equal(ElementOfHit({ combatProfile: { school: 'force', damageType: 'arcane' } }), 'force');
  assert.equal(ElementOfHit({ tags: ['damage:arcane'] }), 'force');
  assert.equal(ElementOfHit({ combatProfile: { damageType: 'slashing' } }), null);
});

test('a single-target fire card hits every enemy at x0.6, and not when only one enemy stands or the card already hits all', () => {
  const { combat, enemies } = fight({ enemies: 2 });
  assert.equal(stage(hit(combat, enemies[0]), 'element-fire-spread').multiplier, 0.6);
  assert.equal(hit(combat, enemies[0]).raw, 6, 'floor(10 x 0.6)');
  enemies[1].alive = false;
  assert.equal(stage(hit(combat, enemies[0]), 'element-fire-spread'), undefined, 'alone it is not a spread');
  enemies[1].alive = true;
  assert.equal(stage(hit(combat, enemies[0], { ...FIRE, tags: ['school:fire', 'targeting:area'] }), 'element-fire-spread'), undefined, 'an area card keeps its full hit');
});

test('live: Cinder Dart reaches both enemies, each loses exactly what the quote said, and an old fight hits only its target', () => {
  const now = fight({ enemies: 2 });
  const played = play(now.combat, 'core.cinderDart', now.enemies[0].id);
  assert.ok(played.lost.e1 > 0 && played.lost.e2 > 0, 'both enemies are hit');
  assert.equal(played.lost.e1, played.row.faceValue, 'shown = dealt');
  assert.equal(played.lost.e1, played.lost.e2);
  const old = fight({ enemies: 2, legacy: true });
  const before = play(old.combat, 'core.cinderDart', old.enemies[0].id);
  assert.equal(before.lost.e2, 0, 'an old snapshot has no spread');
  assert.ok(before.lost.e1 > played.lost.e1, 'and no x0.6');
});

test('fire ignores 1 Poise per point of the higher of INT and WIS: the ignored Poise never absorbs and leaves the pool', () => {
  // Stat contract 2026-11-18: "Shared elemental spells use the higher of INT and WIS, never their sum."
  const { combat, enemies } = fight({ enemies: 1, poise: 20, attributes: { wisdom: 2, intelligence: 4 } });
  const target = enemies[0];
  const fire = hit(combat, target);
  assert.equal(fire.poiseMitigated, 10, 'the 16 Poise above the 4 ignored ones still absorb the whole hit');
  assert.equal(fire.poiseDrain, 4, 'max(INT 4, WIS 2) = 4 ignored points leave the pool, not their sum 6');
  target.persistentPoise.value = 8;
  const small = hit(combat, target);
  assert.deepEqual([small.poiseMitigated, small.poiseDrain, small.hpLoss], [4, 4, 6], 'a pool of 8: 4 absorb (the other 4 are ignored), so 6 of the 10 reaches HP and the pool is emptied');
});

test('a fight saved before spell traditions: fire ignores 1 Poise per point of WIS + INT', () => {
  const { combat, enemies } = fight({ enemies: 1, poise: 20, attributes: { wisdom: 2, intelligence: 4 }, preTraditions: true });
  const target = enemies[0], plain = hit(combat, target, { ...FIRE, combatProfile: { ...FIRE.combatProfile, school: 'poison', damageType: 'poison' }, tags: [] });
  const fire = hit(combat, target);
  assert.equal(plain.poiseMitigated, 10, 'a spell meets Poise first, 1:1');
  assert.equal(fire.poiseMitigated, 10, 'the 14 Poise above the 6 ignored ones still absorb the whole hit');
  assert.equal(fire.poiseDrain, 6, 'the six ignored points leave the pool, so fire can still break it');
  assert.equal(target.persistentPoise.value, 20, 'a receipt never edits the pool');
  target.persistentPoise.value = 8;
  const small = hit(combat, target);
  assert.deepEqual([small.poiseMitigated, small.poiseDrain, small.hpLoss], [2, 6, 8], 'a pool of 8: 2 absorb (the other 6 are ignored), so 8 of the 10 reaches HP and the pool is emptied');
});

test('breaking Poise with fire inflicts Burn equal to the higher of the attacker INT and WIS (at least 1)', () => {
  const burnAfterBreak = (attributes) => {
    const { combat, enemies } = fight({ enemies: 1, poise: 3, attributes });
    play(combat, 'core.emberFlick', enemies[0].id);
    assert.equal(enemies[0].persistentPoise.value, 0, 'the hit broke Poise');
    return getStacks(enemies[0], 'burn');
  };
  assert.equal(burnAfterBreak({ intelligence: 4, wisdom: 2 }), 2 + 4, 'the card prints 2 Burn, the break adds INT when it is higher');
  assert.equal(burnAfterBreak({ intelligence: 1, wisdom: 3 }), 2 + 3, 'WIS when it is higher');
  assert.equal(burnAfterBreak({ intelligence: 0, wisdom: 0 }), 2 + 1, 'INT and WIS 0 still inflict 1');
});

test('a fight saved before spell traditions: breaking Poise with fire inflicts Burn equal to the attacker INT (at least 1)', () => {
  const { combat: c2, enemies: e2 } = fight({ enemies: 1, poise: 3, attributes: { intelligence: 4 }, preTraditions: true });
  play(c2, 'core.emberFlick', e2[0].id);
  assert.equal(e2[0].persistentPoise.value, 0, 'the hit broke Poise');
  assert.equal(getStacks(e2[0], 'burn'), 2 + 4, 'the card prints 2 Burn, the break adds INT');
  const { combat: c3, enemies: e3 } = fight({ enemies: 1, poise: 3, attributes: { intelligence: 0 }, preTraditions: true });
  play(c3, 'core.emberFlick', e3[0].id);
  assert.equal(getStacks(e3[0], 'burn'), 2 + 1, 'INT 0 still inflicts 1');
});

test('Burn: +5% damage taken per stack, and a fire hit on a burning unit quotes it', () => {
  const { combat, enemies } = fight({ enemies: 1 });
  const target = enemies[0];
  const plain = hit(combat, target, { combatProfile: { camp: 'physical', damageType: 'slashing' } }, 100).hpLoss;
  target.statuses.burn = { stacks: 4 };
  const burning = hit(combat, target, { combatProfile: { camp: 'physical', damageType: 'slashing' } }, 100);
  assert.equal(stage(burning, 'element-burn').multiplier, 1.2);
  assert.equal(burning.hpLoss, Math.floor(plain * 1.2));
});

test('Burn ticks 1 HP per stack at turn start and explodes on the owner allies; the explosion clears the Burn', () => {
  const { combat, enemies } = fight({ enemies: 2 });
  const [a, b] = enemies;
  a.statuses.burn = { stacks: 4 };
  combat.rng.chance = (stream, pct) => { assert.equal(stream, 'elements'); assert.equal(pct, 20, '5% x 4 stacks'); return true; };
  ElementTurnStart(combat, a);
  assert.equal(b.hp, 500 - 4, 'every ally takes damage equal to the stacks');
  assert.equal(a.hp, 500, 'the burning unit itself is not hurt by its own explosion');
  assert.equal(getStacks(a, 'burn'), 0);
  const calm = fight({ enemies: 2 });
  calm.enemies[0].statuses.burn = { stacks: 3 };
  calm.combat.rng.chance = () => false;
  ElementTurnStart(calm.combat, calm.enemies[0]);
  assert.equal(getStacks(calm.enemies[0], 'burn'), 3, 'no explosion, no change');
  assert.equal(calm.enemies[1].hp, 500);
});

test('Burn has no cap under the element rules (its explosion chance clamps at 100%) and caps at 3 in an old fight; a unit with no Burn draws no random number', () => {
  const now = fight({ enemies: 1 });
  applyStatus(now.combat, now.enemy, 'burn', 15, now.player);
  assert.equal(getStacks(now.enemy, 'burn'), 15);
  now.enemy.statuses.burn.stacks = 25;
  const pcts = []; now.combat.rng.chance = (stream, pct) => { pcts.push(pct); return false; };
  ElementTurnStart(now.combat, now.enemy);
  assert.deepEqual(pcts, [100], '5% x 25 clamps at 100%');
  now.enemy.statuses = {};
  const old = fight({ enemies: 1, legacy: true });
  applyStatus(old.combat, old.enemy, 'burn', 15, old.player);
  assert.equal(getStacks(old.enemy, 'burn'), 3);
  now.enemy.statuses = {};
  ElementTurnStart(now.combat, now.enemy);
  assert.equal(now.combat.rng.getCounters().elements, undefined, 'no Burn, Shock or other rule needing a roll: the elements stream is untouched');
});

test('a spread hit that kills the aimed enemy still costs the other enemy the spread multiplier (shown = dealt)', () => {
  const healthy = fight({ enemies: 2 });
  const both = play(healthy.combat, 'core.cinderDart', healthy.enemies[0].id);
  const dying = fight({ enemies: 2 });
  dying.enemies[0].hp = 1;
  const r = play(dying.combat, 'core.cinderDart', dying.enemies[0].id);
  const [first, second] = dying.enemies.map((e) => e.id);
  assert.equal(r.lost[first], 1, 'the aimed enemy had 1 HP');
  assert.equal(r.lost[second], both.lost[healthy.enemies[1].id], 'the other enemy loses the spread amount, not the full hit');
  assert.equal(r.lost[second], r.row.faceValue, 'what it loses is what the card face shows');
});
