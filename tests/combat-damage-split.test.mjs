// One hit, two parts: a magic part (Barrier, then Ward) and a physical part
// (Block). Exact numbers from the damage-split brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction, previewExpandedActions } from '../src/engine/combatExpansionActions.js';
import { executeAction, gainBlock, computeAttackDamage } from '../src/engine/actions.js';
import { resolveCombatRatings, magicShareOf, splitDamageTypesOf, attackImpact } from '../src/model/combatRatings.js';
import { applyCombatExpansionCard } from '../src/content/combatExpansionCards.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { objectTagIds } from '../src/content/tags.js';
import { previewCard } from '../src/engine/combat.js';
import { splitOf } from '../src/model/playingCard.js';

function fixture({ ward = 3, barrier = 0, block = 0, poise = 0, weakness = {}, flat = {}, damageTypeShares = null } = {}) {
  const registries = createRegistries(contentBundle);
  // A damage type's Advanced share (damageTypeShares) is a run's ratings config, read through ctx.ratingsRules.
  const ratingsRules = damageTypeShares ? { ...resolveCombatRatings(Object.fromEntries(Object.entries(damageTypeShares).map(([type, share]) => [`gameConfig.combatRatings.damageTypes.${type}`, share])), contentBundle), enabled: true } : null;
  const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2, ...(ratingsRules ? { ratingsRules } : {}),
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
  // The flat force Ward rider is gone: the hit's Ward loss is its magic absorption and nothing more, so no strip event.
  assert.equal(r.events.find(e => e.type === 'combatWardStripped'), undefined, 'no flat Ward strip after the hit');
});

// The force rider (a flat 2-Ward strip) is gone: a scepter strike changes Ward by exactly its magic absorption.
test('a scepter strike only changes Ward by what its magic part absorbed (no flat force strip)', () => {
  for (const ward of [3, 2, 1]) {
    const r = strike(scepter, 5, { ward });
    const [d] = r.damage;
    assert.equal(r.enemy.persistentWard.value, ward - d.wardAbsorbed, `Ward ${ward} changes by ${d.wardAbsorbed}`);
    assert.equal(r.events.find(e => e.type === 'combatWardStripped'), undefined, `no strip event at Ward ${ward}`);
  }
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

// Was: 'a spell with a physical tag stays on its camp: Ward, not Block' (magicAmount 5, wardAbsorbed 3).
// The damage type decides the route, so a spell-camp blunt hit is physical: Ward is untouched and HP takes it.
test('a spell-camp counter with blunt damage routes its physical part through Block and HP, not Ward', () => {
  const counter = { tags: ['camp:spell', 'damage:blunt'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'blunt', maneuver: 'counter', reach: 'near', targeting: 'single' } };
  const r = strike(counter, 5, { ward: 3 });
  const d = r.damage[0];
  assert.equal(d.magicAmount, 0);
  assert.equal(d.physicalAmount, 5);
  assert.equal(d.wardAbsorbed, undefined, 'Ward is not spent');
  assert.equal(r.enemy.persistentWard.value, 3, 'Ward stays 3');
  assert.equal(r.hpLost(r.hpBefore), 5);
});

test('a spell-camp card with slashing damage hits Block and then Poise, and never Ward', () => {
  const slashSpell = { tags: ['camp:spell', 'damage:slashing'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'slashing', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const r = strike(slashSpell, 6, { ward: 3, block: 2, poise: 2 });
  const [d] = r.damage;
  assert.equal(d.magicAmount, 0);
  assert.equal(d.physicalAmount, 6);
  assert.equal(d.blocked, 2, 'Block soaks 2 first');
  assert.equal(r.enemy.block, 0, 'Block is spent');
  assert.equal(r.enemy.persistentPoise.value, 0, 'Poise soaks the rest of the physical part');
  assert.equal(d.wardAbsorbed, undefined);
  assert.equal(r.enemy.persistentWard.value, 3, 'Ward untouched');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('a physical-camp card whose damage type shares 1 hits Barrier and Ward, not Block', () => {
  const slashAsMagic = { tags: ['camp:physical', 'damage:slashing'], skipRatingBonus: true, combatProfile: { camp: 'physical', damageType: 'slashing', maneuver: 'attack', reach: 'contact', targeting: 'single' } };
  const r = strike(slashAsMagic, 5, { ward: 3, block: 3, barrier: 2, damageTypeShares: { slashing: 1 } });
  const [d] = r.damage;
  assert.equal(d.magicAmount, 5, 'all magic');
  assert.equal(d.physicalAmount, 0);
  assert.equal(d.blocked, 0, 'Block does not soak a magic part');
  assert.equal(r.enemy.block, 3, 'Block untouched');
  assert.equal(r.enemy.barrier, 0, 'Barrier soaks 2 first');
  assert.equal(d.wardAbsorbed, 2, 'Ward then soaks 2 of the remaining 3: a pure hit lets at least 1 through Ward');
  assert.equal(r.hpLost(r.hpBefore), 1, 'that 1 reaches HP');
  assert.equal(r.preview, r.committed);
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

// Precedence (model/combatRatings.js magicShareOf): a card's own share, then its damage type's share
// (endpoints honoured), then the camp only when the hit has no damage type.
test('magicShareOf: card override, then damage type with 0 and 1 honoured, then camp only for an untyped hit', () => {
  const config = resolveCombatRatings({}, contentBundle);
  assert.equal(magicShareOf({ camp: 'physical', damageType: 'slashing', magicShare: 0.4 }, config), 0.4, 'a card override wins');
  assert.equal(magicShareOf({ camp: 'spell', damageType: 'slashing' }, config), 0, 'a spell-camp slashing hit is physical');
  assert.equal(magicShareOf({ camp: 'physical', damageType: 'fire' }, config), 1, 'a physical-camp fire hit is magic');
  assert.equal(magicShareOf({ camp: 'spell', damageType: 'arcane' }, config), 0.5, 'arcane still splits');
  assert.equal(magicShareOf({ camp: 'physical', damageType: 'arcane' }, config), 0.5, 'arcane splits in either camp');
  assert.equal(magicShareOf({ camp: 'spell' }, config), 1, 'no damage type: the spell camp is all magic');
  assert.equal(magicShareOf({ camp: 'physical' }, config), 0, 'no damage type: the physical camp is all physical');
  assert.equal(magicShareOf({ camp: 'spell', damageType: 'psychic' }, config), 1, 'a type the rules do not name falls back to camp');
});

// Owner routing (magicShareOf precedence, the card's split base, and the rating bonus typed by its rating).
// A v2 card carrier, built the way combat builds one: the overlaid card's tags and combat profile.
const v2Carrier = (id, extra = {}) => {
  const def = applyCombatExpansionCard(contentBundle.cards.find(card => card.id === id));
  return { cardId: id, tags: def.tags, attack: def.attack, damageSchool: def.damageSchool, combatProfile: combatProfileFor(def), skipRatingBonus: true, ...extra };
};
const hitOf = r => r.damage[0];

test('starstonePebble in v2 (force) splits 50:50: five magic, five blunt', () => {
  const r = strike(v2Carrier('starstonePebble'), 10, { ward: 10 });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 5);
  assert.equal(d.physicalAmount, 5);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('a ranged (near) lightning spell is all magic despite its v2 piercing tag', () => {
  const r = strike(v2Carrier('starSpark'), 5, { ward: 0 });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 5);
  assert.equal(d.physicalAmount, 0);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('a spell-camp hit with no school and a physical type is all physical', () => {
  const plain = { tags: ['camp:spell', 'damage:piercing'], skipRatingBonus: true, combatProfile: { camp: 'spell', damageType: 'piercing', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  const r = strike(plain, 5, { ward: 3 });
  assert.equal(hitOf(r).magicAmount, 0);
  assert.equal(hitOf(r).physicalAmount, 5);
  assert.equal(r.enemy.persistentWard.value, 3, 'Ward untouched');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('a 10-damage melee fire spell with a slashing tag is all fire: the magic school decides, the tag is a secondary type', () => {
  const meleeFire = { tags: ['camp:spell', 'school:fire', 'damage:slashing', 'reach:contact'], skipRatingBonus: true,
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'slashing', reach: 'contact', targeting: 'single' } };
  const r = strike(meleeFire, 10, { ward: 10, block: 3 });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 10, 'a magic-only school spell is all magic, whatever physical tag it carries');
  assert.equal(d.physicalAmount, 0);
  assert.equal(d.blocked, 0, 'Block takes no part of it');
  assert.equal(r.enemy.block, 3, 'Block is untouched');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('a 10-damage fire-tagged smash technique deals 3 fire and 7 physical', () => {
  const smash = { tags: ['camp:physical', 'maneuver:smash', 'damage:fire'], skipRatingBonus: true,
    combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'fire', reach: 'contact', targeting: 'single' } };
  const r = strike(smash, 10, { ward: 10 });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 3, 'the Technique magic share (0.3) of 10 is magic');
  assert.equal(d.physicalAmount, 7);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

// Alteration is a spell whose damage is all physical (combatRules.js schools.alteration): its enemy moves
// carry the spell tags and their own physical tag, and they deal no Ward or Barrier damage.
const enemyMoveCarrier = (enemyId, moveId) => ({ enemyId, moveId, cardId: undefined,
  tags: objectTagIds('enemyMove', moveId, enemyId), skipRatingBonus: true,
  combatProfile: combatProfileFor({ enemyId, moveId }) });

test('thornNeedles (alteration, piercing) is all physical: the card tag piercing, no magic', () => {
  const carrier = enemyMoveCarrier('thornMatriarch', 'thornNeedles');
  assert.equal(carrier.combatProfile.school, 'alteration');
  assert.equal(carrier.combatProfile.damageType, 'piercing');
  const r = strike(carrier, 6, { ward: 10 });
  assert.equal(hitOf(r).magicAmount, 0);
  assert.equal(hitOf(r).physicalAmount, 6);
  assert.equal(r.enemy.persistentWard.value, 10, 'Ward untouched');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('briarCast (alteration, piercing) is all physical', () => {
  const r = strike(enemyMoveCarrier('briarHermit', 'briarCast'), 6, { ward: 10 });
  assert.equal(hitOf(r).magicAmount, 0);
  assert.equal(hitOf(r).physicalAmount, 6);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

// Briar Cast under the Ward and Poise rules (damageTypeShares: {} turns the rating rules on, so the
// meters and their impacts run). A fully physical hit takes Block and Poise and never Ward or a Ward rating impact.
test('briarCast with Block 2, Ward 3, Poise 5 takes no Ward and no Ward rating impact', () => {
  const r = strike(enemyMoveCarrier('briarHermit', 'briarCast'), 5, { ward: 3, block: 2, poise: 5, damageTypeShares: {} });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 0);
  assert.equal(d.wardResisted, 0, 'a physical hit is not Ward-resisted, even where its physical part is reduced');
  assert.equal(d.wardAbsorbed, undefined, 'Ward is not spent');
  assert.equal(r.enemy.persistentWard.value, 3, 'Ward stays 3');
  const wardImpacts = r.events.filter(e => e.type === 'ratingImpact' && e.meter === 'ward');
  assert.equal(wardImpacts.length, 0, 'no Ward rating impact on a physical hit');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

// The mirror: a fully magic hit meets Ward and Barrier only. Block and Poise, and their rating
// impact, never see it, even on a physical-looking carrier whose magic share is 1.
test('a fully magic hit on a physical-looking carrier skips Block and Poise and fills the Ward meter', () => {
  const magicOnly = { tags: ['camp:physical', 'damage:slashing'], magicShare: 1, skipRatingBonus: true,
    combatProfile: { camp: 'physical', damageType: 'slashing', maneuver: 'attack', reach: 'contact', targeting: 'single' } };
  const r = strike(magicOnly, 5, { ward: 10, block: 3, poise: 5, damageTypeShares: {} });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 5);
  assert.equal(d.physicalAmount, 0);
  assert.equal(r.enemy.block, 3, 'Block is untouched');
  assert.equal(r.enemy.persistentPoise.value, 5, 'Poise is untouched');
  assert.equal(r.events.filter(e => e.type === 'ratingImpact' && e.meter === 'poise').length, 0, 'no Poise rating impact');
  assert.equal(r.events.filter(e => e.type === 'ratingImpact' && e.meter === 'ward').length, 1, 'the Ward meter takes the impact');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('entwiningRoots (alteration, blunt) is all physical', () => {
  const r = strike(enemyMoveCarrier('thornMatriarch', 'entwiningRoots'), 6, { ward: 10 });
  assert.equal(hitOf(r).magicAmount, 0);
  assert.equal(hitOf(r).physicalAmount, 6);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

// Magic share precedence, rule by rule (combatRatings.js magicShareOf).
test('magicShareOf precedence: a listed school below 1 decides at any reach; a melee spell without a magic school takes the Melee share', () => {
  const config = resolveCombatRatings({}, contentBundle);
  const spell = { camp: 'spell', maneuver: 'casting' };
  assert.equal(magicShareOf({ ...spell, school: 'force', damageType: 'arcane', reach: 'contact' }, config), 0.5, 'force splits at melee reach');
  assert.equal(magicShareOf({ ...spell, school: 'alteration', damageType: 'piercing', reach: 'contact' }, config), 0, 'alteration is all physical at melee reach');
  assert.equal(magicShareOf({ ...spell, school: 'alteration', damageType: 'piercing', reach: 'near' }, config), 0, 'alteration is all physical at near reach');
  assert.equal(magicShareOf({ ...spell, school: 'lightning', damageType: 'slashing', reach: 'contact' }, config), 1, 'a magic-only school spell with a physical tag is all magic');
  assert.equal(magicShareOf({ ...spell, damageType: 'slashing', reach: 'contact' }, config), 0.7, 'a melee spell with no school and a physical type takes the Melee share');
  assert.equal(magicShareOf({ ...spell, damageType: 'slashing', reach: 'contact' }, { ...config, magicSplit: { ...config.magicSplit, meleeSpell: 0.4 } }), 0.4, 'the Melee share is the run row');
  assert.equal(magicShareOf({ ...spell, damageType: 'slashing', reach: 'near' }, config), 0, 'a ranged spell with a physical type is physical, not the Melee share');
  assert.equal(magicShareOf({ ...spell, damageType: 'fire', reach: 'contact' }, config), 1, 'a melee spell with a magic type is magic');
  assert.equal(magicShareOf({ camp: 'physical', maneuver: 'smash', damageType: 'fire', reach: 'contact' }, config), 0.3, 'a fire-tagged technique takes the Technique share');
});

test('damage components define the split: magic weight over total, an explicit magicShare still wins, one component does not split', () => {
  const config = resolveCombatRatings({}, contentBundle);
  const ruinous = { camp: 'physical', maneuver: 'smash', school: 'force', damageType: 'blunt', reach: 'contact',
    damageComponents: [{ type: 'blunt', weight: 60 }, { type: 'arcane', weight: 40 }] };
  assert.equal(magicShareOf(ruinous, config), 0.4, 'Force (arcane, physical: false) is the magic share, ahead of the force school and the Technique share');
  assert.deepEqual(splitDamageTypesOf(ruinous), { magic: 'arcane', physical: 'blunt' });
  assert.equal(magicShareOf({ ...ruinous, damageComponents: [{ type: 'slashing', weight: 50 }, { type: 'necrotic', weight: 50 }] }, config), 0.5, 'an aliased magic type counts as magic');
  assert.equal(magicShareOf({ ...ruinous, damageComponents: [{ type: 'fire', weight: 1 }, { type: 'decay', weight: 1 }] }, config), 1, 'all-magic components deal only magic');
  assert.equal(magicShareOf({ ...ruinous, damageComponents: [{ type: 'blunt', weight: 1 }, { type: 'piercing', weight: 3 }] }, config), 0, 'all-physical components deal only physical');
  assert.equal(magicShareOf({ ...ruinous, magicShare: 0.9 }, config), 0.9, 'an explicit magicShare outranks the components');
  assert.equal(magicShareOf({ ...ruinous, damageComponents: [{ type: 'blunt', weight: 1 }] }, config), 0.5, 'a single component is no split list: the force school decides');
});

// A hit that lists its components (#1914) routes each part by them: magic types meet Barrier and Ward,
// physical types Block and Poise, and each component type meets its own typed defence with its weighted share.
const mixed = { tags: ['camp:physical', 'maneuver:smash'], skipRatingBonus: true,
  combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'slashing', reach: 'contact', targeting: 'single',
    damageComponents: [{ type: 'slashing', weight: 50 }, { type: 'necrotic', weight: 25 }, { type: 'fire', weight: 25 }] } };

test('a mixed-component hit of 8 is 4 magic (2 decay, 2 fire) and 4 slashing; a fire weakness doubles only the fire share', () => {
  const r = strike(mixed, 8, { ward: 0, weakness: { fire: 100 } });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 6, '2 decay + 2 fire doubled to 4');
  assert.equal(d.physicalAmount, 4, 'the slashing half meets no fire weakness');
  assert.equal(r.committed, 10);
  assert.equal(r.preview, r.committed, 'preview equals commit');
});

test('a mixed-component hit meets Ward with its magic part and Block with its physical part', () => {
  const r = strike(mixed, 8, { ward: 3, block: 10 });
  const d = hitOf(r);
  assert.equal(d.wardAbsorbed, 3, 'Ward takes from the 4 magic');
  assert.equal(r.committed, 1, 'Block soaks the 4 slashing; 1 magic gets past Ward');
  assert.equal(r.enemy.block, 6, 'Block soaked only the physical 4');
  assert.equal(r.preview, r.committed, 'preview equals commit');
});

// The card face splits its amount the way the committed hit does: the card's own damage by its share,
// then the rating bonus by its category. A real previewCard builds the face (no target, so the face is the card's own number).
function faceOf(cards, cardId, ratingValue) {
  const registries = createRegistries({ ...contentBundle, cards: contentBundle.cards.map(card => cards[card.id] ? { ...card, ...cards[card.id] } : card) });
  const combat = createCombat({ registries, rng: createRng(901), combatExpansionVersion: 2, enemyIds: ['wanderingSoldier'],
    player: { classId: 'starseer', maxHp: 100, hp: 100, maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  combat.piles.hand = [{ instanceId: 'face', cardId, upgraded: false, ratingValue }];
  const preview = previewCard(combat, 'face');
  const value = preview.values.find(row => row.op === 'damage');
  return { value, parts: splitOf(preview.resolvedDefinition, combatProfileFor(preview.resolvedDefinition), value.faceValue, null, value) };
}

test('a spell face with a +4 Power splits as its committed hit: the card base by share, the Power all magic', () => {
  const face = faceOf({}, 'starstonePebble', 4);
  assert.equal(face.value.splitBase, 6, 'the card base is 6');
  assert.equal(face.value.faceValue, 10, 'the face is the base plus the Power');
  const committed = hitOf(strike({ ...v2Carrier('starstonePebble'), skipRatingBonus: false, ratingValue: 4 }, face.value.splitBase, { ward: 20 }));
  assert.deepEqual([face.parts.magic, face.parts.physical], [committed.magicAmount, committed.physicalAmount]);
  assert.deepEqual([face.parts.magic, face.parts.physical], [7, 3]);
});

test('a technique face with a +4 Attack splits as its committed hit: the Technique share of its base, the Attack all physical', () => {
  const cards = { stomp: { tags: ['camp:physical', 'maneuver:smash', 'damage:fire'], attack: { damageType: 'fire' } } };
  const face = faceOf(cards, 'stomp', 4);
  assert.equal(face.value.splitBase, 9, 'the card base is 9');
  const carrier = { cardId: 'stomp', tags: ['camp:physical', 'maneuver:smash', 'damage:fire'], skipRatingBonus: false, ratingValue: 4,
    combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'fire', reach: 'contact', targeting: 'single' } };
  const committed = hitOf(strike(carrier, face.value.splitBase, { ward: 20 }));
  assert.deepEqual([face.parts.magic, face.parts.physical], [committed.magicAmount, committed.physicalAmount]);
  assert.deepEqual([face.parts.magic, face.parts.physical], [2, 11]);
});

test('physical type: the card tag wins, else the school (force and alteration: blunt), magic-only schools keep their card tag', () => {
  const type = profile => splitDamageTypesOf(profile);
  assert.deepEqual(type({ camp: 'spell', school: 'force', damageType: 'arcane' }), { magic: 'arcane', physical: 'blunt' }, 'force with no physical tag is blunt');
  assert.deepEqual(type({ camp: 'spell', school: 'force', damageType: 'arcane', physicalDamageType: 'piercing' }), { magic: 'arcane', physical: 'piercing' }, 'a weapon physical type wins');
  assert.deepEqual(type({ camp: 'spell', school: 'alteration', damageType: 'piercing' }), { magic: 'arcane', physical: 'piercing' }, 'an alteration card tag wins');
  assert.deepEqual(type({ camp: 'spell', school: 'alteration' }), { magic: 'arcane', physical: 'blunt' }, 'alteration with no tag is blunt');
  assert.deepEqual(type({ camp: 'spell', school: 'lightning', damageType: 'piercing' }), { magic: 'lightning', physical: 'piercing' }, 'a lightning spell with a piercing tag keeps its physical tag');
});

test('a plain physical technique is all physical', () => {
  const r = strike(v2Carrier('rogueShiv'), 6, { ward: 3 });
  assert.equal(hitOf(r).magicAmount, 0);
  assert.equal(hitOf(r).physicalAmount, 6);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test("a card's own magicShare wins over its school and its camp", () => {
  const override = { ...v2Carrier('rogueShiv'), magicShare: 1 };
  assert.equal(hitOf(strike(override, 6, { ward: 10 })).magicAmount, 6, 'a technique with magicShare 1 is all magic');
  const force = { ...v2Carrier('starstonePebble'), magicShare: 0.2 };
  assert.equal(hitOf(strike(force, 10, { ward: 10 })).magicAmount, 2, 'a force Spell with magicShare 0.2 splits 2:8');
});

test('a +4 rating bonus on a spell adds to its magic part', () => {
  const spell = { ...v2Carrier('starSpark'), skipRatingBonus: false, ratingValue: 4 };
  const r = strike(spell, 10, { ward: 20 });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 14, 'the 10 lightning and the +4 Power are all magic');
  assert.equal(d.physicalAmount, 0);
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

test('a +4 rating bonus on a technique adds to its physical part', () => {
  // A 10-damage fire-tagged smash, so the split (3 magic, 7 physical) is what the rating joins.
  const technique = { cardId: 'rogueShiv', tags: ['camp:physical', 'maneuver:smash', 'damage:fire'], skipRatingBonus: false, ratingValue: 4,
    combatProfile: { camp: 'physical', maneuver: 'smash', damageType: 'fire', reach: 'contact', targeting: 'single' } };
  const r = strike(technique, 10, { ward: 20 });
  const d = hitOf(r);
  assert.equal(d.magicAmount, 3, 'the 10 keeps its 0.3 magic part');
  assert.equal(d.physicalAmount, 11, 'the +4 Attack joins the 7 physical');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

// An enemy's physical hit adds 1 to the player's Poise-break meter (owner decision, 2026-10-12): the
// rating impact default for an enemy physical hit with no card or weapon value is 1, not 2.
test('an enemy physical hit with no card or weapon impact adds 1 to the Poise meter', () => {
  const ctx = { registries: createRegistries(contentBundle), ratingsRules: resolveCombatRatings({}, contentBundle) };
  assert.equal(ctx.ratingsRules.impact.enemyPhysical, 1, 'the default rating impact of an enemy physical hit');
  assert.equal(attackImpact(ctx, { kind: 'enemy' }, {}, false), 1, 'the impact the Poise meter takes');
});

// Pools only (owner decision, 2026-10-12): Poise protects as a pool. A physical hit takes no rating cut;
// Block takes its share, Poise soaks what Block left (at least 1 gets through) and is spent by it.
test('briarCast into Block 2 and Poise 5 takes 1 HP, Poise absorbs 2 and drops to 3, and no Ward is resisted', () => {
  const r = strike(enemyMoveCarrier('briarHermit', 'briarCast'), 5, { ward: 3, block: 2, poise: 5, damageTypeShares: {} });
  const d = hitOf(r);
  assert.equal(r.hpLost(r.hpBefore), 1, 'Block takes 2 of 5, Poise takes 2 of the 3 left, 1 HP');
  assert.equal(r.enemy.persistentPoise.value, 3, 'Poise 5 is spent by the 2 it absorbs');
  assert.equal(d.wardResisted, 0, 'no Ward is resisted by a physical hit');
  assert.equal(r.preview, r.committed, 'preview equals committed');
});

// The card face reads computeAttackDamage without beforeDefense. Pools only: it takes no Poise or Ward rating cut either,
// so the face of a 5 slash into Poise 5 and of a 5 fire into Ward 3 is 5, the same figure the contacts split.
test('the card face takes no Poise or Ward rating cut: 5 slash into Poise 5 and 5 fire into Ward 3 both read 5', () => {
  const { combat, enemy } = fixture({ ward: 3, poise: 5, damageTypeShares: {} });
  assert.equal(computeAttackDamage(combat, combat.player, enemy, 5, slash.tags, slash, { matchups: false }), 5, 'physical face');
  assert.equal(computeAttackDamage(combat, combat.player, enemy, 5, fireBolt.tags, fireBolt, { matchups: false }), 5, 'magic face');
});
