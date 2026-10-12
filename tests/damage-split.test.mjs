// Damage split (magic share): the data that says how much of a hit is magic
import { combatCardSummary } from '../src/model/playingCard.js';
// (Barrier and Ward) and how much is physical (Block), and the physical type
// of every weapon. The engine rules are tested in combat-damage-split.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { combatRules } from '../src/content/combatRules.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { combatRatingRows, resolveCombatRatings, combatRatingProblems, damageTypeMagicShare } from '../src/model/combatRatings.js';

test('every damage type states its magic share: physical 0, magic 1, arcane the hybrid 0.5', () => {
  const shares = Object.fromEntries(Object.entries(combatRules.damageTypes).map(([id, type]) => [id, type.magicShare]));
  assert.deepEqual(shares, {
    slashing: 0, piercing: 0, blunt: 0,
    fire: 1, frost: 1, lightning: 1, sacred: 1, decay: 1,
    arcane: 0.5,
  });
});

test('each damage type magic share is an Advanced row, 0 to 1 in steps of 0.05, and resolves to its default', () => {
  const rows = combatRatingRows(contentBundle);
  const arcane = rows.find(row => row.key === 'gameConfig.combatRatings.damageTypes.arcane');
  assert.ok(arcane, 'arcane row exists');
  assert.equal(arcane.label, 'Arcane magic share');
  assert.equal(arcane.min, 0);
  assert.equal(arcane.max, 1);
  assert.equal(arcane.step, 0.05);
  assert.equal(arcane.def, 0.5);
  assert.equal(rows.filter(row => row.key.includes('.damageTypes.')).length, Object.keys(combatRules.damageTypes).length);
  const config = resolveCombatRatings({}, contentBundle);
  assert.equal(damageTypeMagicShare(config, 'arcane'), 0.5);
  assert.equal(damageTypeMagicShare(config, 'slashing'), 0);
  assert.deepEqual(combatRatingProblems(config), []);
  const tuned = resolveCombatRatings({ 'gameConfig.combatRatings.damageTypes.arcane': 0.3 }, contentBundle);
  assert.equal(damageTypeMagicShare(tuned, 'arcane'), 0.3);
  assert.equal(damageTypeMagicShare(null, 'arcane'), 0.5, 'a config-less caller reads the content default');
  assert.equal(damageTypeMagicShare(config, 'psychic'), null, 'a type the rules do not name has no share');
});

test('the magic share Advanced row refuses a value outside 0 to 1', () => {
  const config = resolveCombatRatings({}, contentBundle);
  assert.deepEqual(combatRatingProblems({ ...config, damageTypes: { ...config.damageTypes, arcane: 1.5 } }), ['Invalid damage type magic share']);
});

test('the four staff and sceptre profiles are 40% magic; every other profile uses its damage type default', () => {
  const shares = Object.fromEntries(contentBundle.equipment.basicCardProfiles.map(profile => [profile.id, profile.magicShare]));
  for (const id of ['staffMagicAttack', 'sceptreArcaneAttack', 'staffGuard', 'sceptreGuard']) assert.equal(shares[id], 0.4, id);
  for (const [id, value] of Object.entries(shares)) {
    if (!['staffMagicAttack', 'sceptreArcaneAttack', 'staffGuard', 'sceptreGuard'].includes(id)) assert.ok(value === '' || value === undefined || value === null, `${id} is blank`);
  }
});

test('a staff Strike resolves to a 40% magic card face; an unshared profile carries no override', () => {
  const registries = createRegistries(contentBundle);
  const staff = resolveCard(registries, { cardId: 'strike', profileId: 'staffMagicAttack', damageSchool: 'magic', exposureBuildupPerHit: 1, upgraded: false, rank: 1, instanceId: 'staff-strike' });
  assert.equal(staff.magicShare, 0.4);
  const blade = resolveCard(registries, { cardId: 'strike', profileId: 'bladeAttack', damageSchool: 'physical', exposureBuildupPerHit: 0, upgraded: false, rank: 1, instanceId: 'blade-strike' });
  assert.equal(blade.magicShare, undefined);
  const withWeapon = resolveCard(registries, { cardId: 'strike', profileId: 'bladeAttack', damageSchool: 'physical', exposureBuildupPerHit: 0, physicalDamageType: 'slashing', upgraded: false, rank: 1, instanceId: 'blade-weapon' });
  assert.equal(withWeapon.physicalDamageType, 'slashing');
});

const WEAPON_PHYSICAL_TYPE = {
  straightSword: 'slashing', greatsword: 'slashing', dagger: 'piercing', shortbow: 'piercing', katana: 'slashing',
  halberd: 'slashing', warhammer: 'blunt', twinblade: 'slashing', battleaxe: 'slashing',
  buckler: 'blunt', kiteShield: 'blunt', towerShield: 'blunt', roundShield: 'blunt', spikedShield: 'piercing',
  lantern: 'blunt', torch: 'blunt', parryDagger: 'piercing',
  ashStaff: 'blunt', starstoneStaff: 'blunt', boneSceptre: 'blunt', emberlightSceptre: 'blunt', goldboughBranch: 'blunt',
  blightRod: 'blunt', gorefireBrand: 'blunt', wyrmhornStaff: 'blunt', frostSpear: 'piercing', cinderAxe: 'slashing', duskChime: 'blunt',
};

test('every weapon, shield and staff names its physical damage type, as authored', () => {
  const armaments = contentBundle.equipment.armaments;
  assert.equal(armaments.length, Object.keys(WEAPON_PHYSICAL_TYPE).length);
  for (const piece of armaments) assert.equal(piece.physicalDamageType, WEAPON_PHYSICAL_TYPE[piece.id], piece.id);
});

test('a split strike reads "5 damage (3 blunt, 2 arcane)" and a split defend "Gain 3 Block and 2 Ward" on the card', () => {
  const scepterStrike = { id: 'scepterStrike', name: 'Scepter Strike', type: 'attack', cost: 1,
    tags: ['camp:spell', 'maneuver:casting', 'damage:arcane'], magicShare: 0.4, physicalDamageType: 'blunt',
    combatProfile: { camp: 'spell', maneuver: 'casting', damageType: 'arcane', school: 'force' },
    effects: [{ op: 'damage', target: 'enemy', amount: 5 }] };
  const strike = combatCardSummary(scepterStrike);
  assert.match(strike, /Deal 5 damage \(3 blunt, 2 arcane\)/);
  const scepterGuard = { id: 'scepterGuard', name: 'Ritual Ward', type: 'skill', cost: 1,
    tags: ['camp:spell', 'maneuver:defend'], magicShare: 0.4,
    combatProfile: { camp: 'spell', maneuver: 'defend', damageType: 'arcane' },
    effects: [{ op: 'block', target: 'self', amount: 5 }] };
  assert.match(combatCardSummary(scepterGuard), /Gain 3 Block and 2 Ward/);
  const whole = { ...scepterStrike, magicShare: undefined, combatProfile: { camp: 'spell', damageType: 'fire' }, tags: ['camp:spell', 'damage:fire'] };
  assert.match(combatCardSummary(whole), /Deal 5 Fire damage/, 'a whole-magic card keeps its plain line');
});

test('a split card reads the configured magic share the way combat does, not the content default', () => {
  const configured = resolveCombatRatings({ 'gameConfig.combatRatings.damageTypes.arcane': 0.8 }, contentBundle);
  const registries = createRegistries({ ...contentBundle, balance: { ...contentBundle.balance, combatRatings: configured } });
  const strike = { id: 'scepterStrike', name: 'Scepter Strike', type: 'attack', cost: 1,
    tags: ['camp:spell', 'maneuver:casting', 'damage:arcane'], physicalDamageType: 'blunt',
    combatProfile: { camp: 'spell', maneuver: 'casting', damageType: 'arcane', school: 'force' },
    effects: [{ op: 'damage', target: 'enemy', amount: 5 }] };
  assert.match(combatCardSummary(strike, null, registries), /Deal 5 damage \(1 blunt, 4 arcane\)/);
  assert.match(combatCardSummary(strike), /Deal 5 damage \(3 blunt, 2 arcane\)/, 'a config-less read keeps the content default');
  assert.match(combatCardSummary({ ...strike, magicShare: 0.4 }, null, registries), /Deal 5 damage \(3 blunt, 2 arcane\)/, 'a card\'s own magic share still wins');
  const guard = { id: 'scepterGuard', name: 'Ritual Ward', type: 'skill', cost: 1,
    tags: ['camp:spell', 'maneuver:defend', 'damage:arcane'],
    combatProfile: { camp: 'spell', maneuver: 'defend', damageType: 'arcane' },
    effects: [{ op: 'block', target: 'self', amount: 5 }] };
  assert.match(combatCardSummary(guard, null, registries), /Gain 1 Block and 4 Ward/);
  assert.match(combatCardSummary(guard), /Gain 3 Block and 2 Ward/, 'the block split follows the configured share too');
});
