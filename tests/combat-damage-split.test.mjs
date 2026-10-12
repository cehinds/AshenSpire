// One hit, two parts: a magic part (Barrier, then Ward) and a physical part
// (Block). Exact numbers from the damage-split brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction, previewExpandedActions } from '../src/engine/combatExpansionActions.js';
import { executeAction, gainBlock } from '../src/engine/actions.js';

function fixture({ ward = 3, barrier = 0, block = 0, poise = 0, weakness = {}, flat = {} } = {}) {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.block = block; enemy.barrier = barrier;
  enemy.damageResistanceFlat = { ...flat }; enemy.damageWeaknessPercent = { ...weakness };
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise, ward: 3 };
  if (poise > 0) enemy.persistentPoise = { max: poise, value: poise };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.persistentWard.max = 3; enemy.persistentWard.value = ward;
  return { combat, enemy };
}

// Commit one damage action of `amount` from `carrier`, return its events and the preview's contacts.
function strike(carrier, amount, setup = {}) {
  const { combat, enemy } = fixture(setup);
  const hpBefore = enemy.hp;
  const action = () => ({ effect: { op: 'damage', target: 'enemy', amount }, source: combat.player, owner: combat.player,
    target: enemy, card: carrier, meta: {} });
  const preview = previewExpandedActions(combat, [action()], { source: combat.player, target: enemy, carrier })
    .flat().reduce((sum, contact) => sum + contact.amount, 0);
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  enqueueExpandedAction(combat, [action()], { source: combat.player, target: enemy, carrier });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  const damage = events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  // committed is the HP the hit took: the figure a preview shows (after Block and Poise).
  return { combat, enemy, events, damage, preview, hpBefore, committed: hpBefore - enemy.hp,
    hpLost: before => before - enemy.hp };
}

const scepter = { cardId: undefined, tags: ['camp:spell', 'maneuver:casting', 'damage:arcane'], skipRatingBonus: true,
  magicShare: 0.4, physicalDamageType: 'blunt', damageSchool: 'magic',
  combatProfile: { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'arcane', reach: 'near', targeting: 'single' } };

test('a scepter strike of 5 is 2 arcane and 3 blunt: Ward takes the 2, the 3 is HP', () => {
  const r = strike(scepter, 5, { ward: 3 });
  assert.equal(r.damage.length, 1);
  const [d] = r.damage;
  assert.equal(d.amount, 3, 'what reaches Block and HP');
  assert.equal(d.magicAmount, 2);
  assert.equal(d.physicalAmount, 3);
  assert.equal(d.wardAbsorbed, 2);
  assert.equal(d.wardRemaining, 1, 'Ward 3 becomes 1');
  assert.equal(r.hpLost(r.hpBefore), 3, 'total HP loss is 3');
  // A force hit's shipped rider (damageRiders.force) then strips 2 more Ward; the hit's own numbers stay as above.
  assert.equal(r.events.find(e => e.type === 'combatWardStripped')?.amount, 1);
});

test('against Block 3 the physical 3 is blocked, and at least 1 magic gets through from Ward', () => {
  const r = strike(scepter, 5, { ward: 3, block: 3 });
  const [d] = r.damage;
  assert.equal(d.blocked, 3);
  assert.equal(d.amount, 4, 'one magic point is let through by the at-least-1 rule');
  assert.equal(d.wardAbsorbed, 1, 'Ward gives up the point it let through');
  assert.equal(d.wardRemaining, 2, 'Ward 3 becomes 2');
  assert.equal(r.enemy.block, 0);
  assert.equal(r.hpLost(r.hpBefore), 1, 'total HP loss is 1');
  assert.equal(r.preview, r.committed, 'preview total equals committed damage');
});

test('preview total equals committed damage for a split strike, with and without Barrier and Block', () => {
  for (const setup of [{ ward: 3 }, { ward: 3, block: 3 }, { ward: 0, barrier: 2, block: 1 }, { ward: 0 }]) {
    const r = strike(scepter, 5, setup);
    assert.equal(r.preview, r.committed, JSON.stringify(setup));
  }
});

test('a force (arcane) card with no override splits 50:50', () => {
  const force = { tags: ['camp:spell', 'damage:arcane'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'arcane', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const r = strike(force, 5, { ward: 0 });
  assert.equal(r.damage[0].magicAmount, 2, 'floor(5 x 0.5)');
  assert.equal(r.damage[0].physicalAmount, 3);
  assert.equal(r.hpLost(r.hpBefore), 5, 'no Ward, so all 5 lands');
});

test('a fire card stays all magic, and a slashing strike all physical', () => {
  const fire = { tags: ['camp:spell', 'damage:fire'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'fire', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const f = strike(fire, 5, { ward: 0 }).damage[0];
  assert.equal(f.magicAmount, 5);
  assert.equal(f.physicalAmount, 0);
  const slash = { tags: ['camp:physical', 'damage:slashing'], skipRatingBonus: true, combatProfile: { camp: 'physical', damageType: 'slashing', maneuver: 'attack', reach: 'contact', targeting: 'single' } };
  const s = strike(slash, 5, { ward: 3 }).damage[0];
  assert.equal(s.magicAmount, 0);
  assert.equal(s.physicalAmount, 5);
  assert.equal(s.wardAbsorbed, undefined, 'a physical hit never touches Ward');
});

test('a spell with a physical tag stays on its camp: Ward, not Block (shipped counters keep their route)', () => {
  const counter = { tags: ['camp:spell', 'damage:blunt'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'blunt', maneuver: 'counter', reach: 'near', targeting: 'single' } };
  const d = strike(counter, 5, { ward: 3 }).damage[0];
  assert.equal(d.magicAmount, 5);
  assert.equal(d.wardAbsorbed, 3);
});

test('a scepter defend of 5 gives Barrier 2 and Block 3 on full Ward, and Ward 2 and Block 3 on empty Ward', () => {
  const guard = { tags: ['camp:spell', 'maneuver:defend'], skipRatingBonus: true, magicShare: 0.4, physicalDamageType: 'blunt',
    combatProfile: { camp: 'spell', maneuver: 'defend', damageType: 'arcane', reach: 'near', targeting: 'single' } };
  for (const [ward, wardAfter, barrier] of [[3, 3, 2], [0, 2, 0]]) {
    const { combat } = fixture({ ward: 0 });
    const player = combat.player;
    player.persistentWard = { max: 3, value: ward };
    player.barrier = 0; player.block = 0;
    const gained = gainBlock(combat, player, 5, guard);
    assert.equal(gained, 5, 'the guard lays down 5 in all');
    assert.equal(player.block, 3, 'Block 3');
    assert.equal(player.persistentWard.value, wardAfter, `Ward ${ward} becomes ${wardAfter}`);
    assert.equal(player.barrier, barrier, `Barrier ${barrier}`);
  }
});

import { combatLogEntries } from '../src/model/combatLog.js';

// Commit a fire strike of `amount` at an enemy with `hp`, and return its events.
function breakingStrike({ hp, ward, amount }) {
  const { combat, enemy } = fixture({ ward });
  enemy.hp = hp;
  const fire = { tags: ['camp:spell', 'damage:fire'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'fire', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  enqueueExpandedAction(combat, [{ effect: { op: 'damage', target: 'enemy', amount }, source: combat.player, owner: combat.player, target: enemy, card: fire, meta: {} }],
    { source: combat.player, target: enemy, carrier: fire });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  return { events, enemy };
}

test('a hit that breaks Ward and kills the enemy logs the break without "(interrupted)"', () => {
  const { events, enemy } = breakingStrike({ hp: 2, ward: 1, amount: 5 });
  assert.equal(enemy.alive, false, 'the hit kills');
  const ward = events.find(e => e.type === 'wardBroken');
  assert.ok(ward, 'Ward broke');
  assert.ok(!ward.interrupted, 'a killed enemy is not interrupted');
  assert.equal(events.some(e => e.type === 'enemyInterrupted'), false);
  const line = combatLogEntries(events, { enemies: [enemy] }).map(row => row.text).find(text => /Ward broke/.test(text));
  assert.match(line, /Ward broke/);
  assert.doesNotMatch(line, /interrupted/);
});

test('a Ward break on a living enemy is interrupted exactly when the enemy is interrupted', () => {
  const { events } = breakingStrike({ hp: 100, ward: 1, amount: 5 });
  const ward = events.find(e => e.type === 'wardBroken');
  assert.ok(ward, 'Ward broke');
  assert.equal(Boolean(ward.interrupted), events.some(e => e.type === 'enemyInterrupted'));
});

const slash = { tags: ['camp:physical', 'damage:slashing'], skipRatingBonus: true, combatProfile: { camp: 'physical', damageType: 'slashing', maneuver: 'attack', reach: 'contact', targeting: 'single' } };
const fireBolt = { tags: ['camp:spell', 'damage:fire'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'fire', maneuver: 'casting', reach: 'near', targeting: 'single' } };

test('a physical hit is previewed after Poise: 5 against 10 Poise deals 1, and the preview says 1', () => {
  const r = strike(slash, 5, { ward: 0, poise: 10 });
  assert.equal(r.hpLost(r.hpBefore), 1, 'the hit deals 1');
  assert.equal(r.preview, 1, 'the preview shows 1');
  assert.equal(r.preview, r.committed);
});

test('a physical hit is previewed after Block: 5 against Block 3 deals 2, and the preview says 2', () => {
  const r = strike(slash, 5, { block: 3 });
  assert.equal(r.hpLost(r.hpBefore), 2);
  assert.equal(r.preview, 2);
});

test('a magic hit is previewed after Ward: 5 fire against Ward 3 deals 2, and the preview says 2', () => {
  const r = strike(fireBolt, 5, { ward: 3 });
  assert.equal(r.hpLost(r.hpBefore), 2);
  assert.equal(r.preview, 2);
  assert.equal(r.preview, r.committed);
});

test('preview equals committed for physical, magic and split hits, with Block and Poise in play', () => {
  const cases = [[slash, 5, { ward: 0, poise: 10, block: 2 }], [fireBolt, 5, { ward: 3, block: 3 }], [scepter, 5, { ward: 3, block: 3, poise: 2 }]];
  for (const [carrier, amount, setup] of cases) {
    const r = strike(carrier, amount, setup);
    assert.equal(r.preview, r.committed, JSON.stringify(setup));
  }
});

// A weapon's authored physicalDamageType (content/source/weapons.csv) rides on the carrier and types
// every physical part, split or not. The shared card profile (bladeAttack) is slashing for all of them.
const weaponStrike = (physicalDamageType) => ({ tags: ['camp:physical', 'damage:slashing'], skipRatingBonus: true,
  ...(physicalDamageType ? { physicalDamageType } : {}),
  combatProfile: { camp: 'physical', damageType: 'slashing', maneuver: 'attack', reach: 'contact', targeting: 'single' } });
const warhammerStrike = weaponStrike('blunt');
const frostSpearStrike = weaponStrike('piercing');
const plainSlashStrike = weaponStrike(null);

test('a Warhammer (blunt) hit takes the blunt weakness; a slashing hit and a Frost Spear (piercing) hit do not', () => {
  const weakBlunt = { blunt: 50 };
  assert.equal(strike(warhammerStrike, 4, { ward: 0, weakness: weakBlunt }).damage[0].amount, 6, 'blunt 4 x 1.5');
  assert.equal(strike(plainSlashStrike, 4, { ward: 0, weakness: weakBlunt }).damage[0].amount, 4, 'slashing 4, no weakness');
  assert.equal(strike(frostSpearStrike, 4, { ward: 0, weakness: weakBlunt }).damage[0].amount, 4, 'piercing 4, no weakness');
});

test('a Frost Spear (piercing) hit takes the piercing weakness and a flat piercing resistance', () => {
  assert.equal(strike(frostSpearStrike, 4, { ward: 0, weakness: { piercing: 50 } }).damage[0].amount, 6);
  assert.equal(strike(frostSpearStrike, 4, { ward: 0, flat: { piercing: 1 } }).damage[0].amount, 3);
  assert.equal(strike(plainSlashStrike, 4, { ward: 0, flat: { piercing: 1 } }).damage[0].amount, 4, 'slashing ignores piercing resistance');
});

test('a Warhammer hit takes a flat blunt resistance, not a slashing one', () => {
  assert.equal(strike(warhammerStrike, 4, { ward: 0, flat: { blunt: 2 } }).damage[0].amount, 2);
  assert.equal(strike(warhammerStrike, 4, { ward: 0, flat: { slashing: 2 } }).damage[0].amount, 4);
});
