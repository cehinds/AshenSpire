#!/usr/bin/env node
// Observed-red contract: representative DEX weapons and five-stat ownership.
//
// This gate deliberately models no range, distance, line-of-sight or board
// position. A bow is a data-authored core-card projection in the combat system
// that already exists; `ranged` and `precision` are explicit presentation tags.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { DAMAGE_SCHOOLS, equipmentKitReceipt, stampDeck, validateEquipment } from '../src/model/loadout.js';
import { deriveStat } from '../src/model/derivedStats.js';
import { createCombat, previewCard, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { validateContent } from '../src/model/validate.js';

const R = createRegistries(contentBundle);
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}
const equal = (actual, expected, label) => check(Object.is(actual, expected), label, `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);

const profile = (id) => (R.equipment.basicCardProfiles || []).find((row) => row.id === id);
const piece = (id) => (R.equipment.armaments || []).find((row) => row.id === id);
const daggerProfile = profile('daggerPierceAttack');
const bowProfile = profile('bowPierceAttack');
const bowTechnique = profile('bowTechnique');
const dagger = piece('dagger');
const bow = piece('shortbow');

const expectedSchools = ['physical', 'magic', 'arcane', 'holy', 'fire'];
equal(JSON.stringify(DAMAGE_SCHOOLS), JSON.stringify(expectedSchools), 'one runtime damage-school vocabulary is authoritative');
for (const school of expectedSchools) {
  const bundle = { ...contentBundle, equipment: { ...contentBundle.equipment,
    basicCardProfiles: contentBundle.equipment.basicCardProfiles.map((row) => ({ ...row })) } };
  bundle.equipment.basicCardProfiles[0].damageSchool = school;
  const schoolErrors = validateContent(bundle).errors.filter((error) => /basicCardProfiles.*damageSchool/.test(error.path));
  check(schoolErrors.length === 0, `schema accepts runtime damage school ${school}`, schoolErrors.map((error) => error.msg).join(' | '));
}
{
  const bundle = { ...contentBundle, equipment: { ...contentBundle.equipment,
    basicCardProfiles: contentBundle.equipment.basicCardProfiles.map((row) => ({ ...row })) } };
  bundle.equipment.basicCardProfiles[0].damageSchool = 'magick';
  const said = validateContent(bundle).errors.map((error) => `${error.path}: ${error.msg}`).join(' | ');
  check(/damageSchool.*magick|Expected one of.*magick/i.test(said), 'unknown damage school fails closed by path', said);
}

check(dagger?.attackProfile === 'daggerPierceAttack', 'dagger explicitly references its DEX attack profile', String(dagger?.attackProfile));
check(daggerProfile?.scalingStat === 'dexterity' && daggerProfile?.baseValue === 3
  && daggerProfile?.pointsPerTier === 5 && daggerProfile?.rounding === 'floor'
  && daggerProfile?.gainPerTier === 1 && daggerProfile?.cap == null,
  'dagger profile authors base 3 + floor(DEX/5), uncapped', JSON.stringify(daggerProfile));
check(daggerProfile?.damageSchool === 'physical' && daggerProfile?.tags?.includes('pierce')
  && daggerProfile?.tags?.includes('flourish') && !(daggerProfile?.mods || []).some((mod) => /^hits=/.test(mod)),
  'dagger explicitly authors Pierce, finesse tags, and two hits', JSON.stringify(daggerProfile));
check(!(dagger?.mods || []).some((mod) => /^strike\.damage=/.test(mod))
  && dagger?.mods?.includes('strike.hits=2'),
  'dagger item authors hits only and cannot erase scaled damage', JSON.stringify(dagger?.mods));

const sword = piece('straightSword');
check(!(sword?.mods || []).some((mod) => /^strike\.damage=/.test(mod)),
  'Straight Sword has no duplicate item damage above its profile receipt', JSON.stringify(sword?.mods));

check(bow?.kind === 'weapon' && bow?.hand === 'right' && bow?.rarity === 'common',
  'representative shortbow is a common right-hand weapon row', JSON.stringify(bow));
check(bow?.artKey === 'dagger',
  'shortbow declares the temporary existing generic-art boundary', JSON.stringify(bow));
check(bow?.attackProfile === 'bowPierceAttack' && bow?.techniqueProfile === 'bowTechnique',
  'shortbow references explicit attack and technique profiles', JSON.stringify(bow));
check(bowProfile?.baseValue === 4 && bowProfile?.scalingStat === 'dexterity'
  && bowProfile?.pointsPerTier === 5 && bowProfile?.rounding === 'floor'
  && bowProfile?.gainPerTier === 1 && bowProfile?.cap == null,
  'bow profile authors base 4 + floor(DEX/5), uncapped', JSON.stringify(bowProfile));
check(bowProfile?.damageSchool === 'physical'
  && ['pierce', 'ranged', 'precision'].every((tag) => bowProfile?.tags?.includes(tag))
  && !(bowProfile?.mods || []).some((mod) => /^hits=/.test(mod)),
  'bow explicitly authors Pierce/ranged/precision and one hit', JSON.stringify(bowProfile));
check(bowTechnique?.role === 'technique' && bowTechnique?.scalingStat === 'dexterity'
  && ['ranged', 'precision'].every((tag) => bowTechnique?.tags?.includes(tag)),
  'bow technique is an explicit DEX presentation row', JSON.stringify(bowTechnique));
for (const row of [bow, bowProfile, bowTechnique].filter(Boolean)) {
  check(!['range', 'distance', 'position', 'lineOfSight', 'los'].some((key) => Object.hasOwn(row, key)),
    `${row.id} adds no ranged-position system field`, JSON.stringify(row));
}

const baseRun = createRunState({ seed: 0x51a7, classId: 'reaver', registries: R });
const allTen = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 };
function roleReceipt(pieceId, role, attributes) {
  if (!piece(pieceId)) return null;
  const loadout = structuredClone(baseRun.loadout);
  loadout.sets.rightHand[0] = pieceId;
  loadout.sets.leftHand[0] = null;
  return equipmentKitReceipt(R, loadout, 'reaver', attributes, baseRun.equipmentProfileRuleSnapshot)
    .find((row) => row.role === role)?.receipt || null;
}
function vector(attributes) {
  const rules = baseRun.derivedStatRuleSnapshot.rules;
  const cls = R.classes.get('reaver');
  return {
    swordAttack: roleReceipt('straightSword', 'attack', attributes)?.value ?? null,
    daggerAttack: roleReceipt('dagger', 'attack', attributes)?.value ?? null,
    bowAttack: roleReceipt('shortbow', 'attack', attributes)?.value ?? null,
    weaponGuard: roleReceipt('straightSword', 'guard', attributes)?.value ?? null,
    sceptreAttack: roleReceipt('boneSceptre', 'attack', attributes)?.value ?? null,
    staffAttack: roleReceipt('ashStaff', 'attack', attributes)?.value ?? null,
    hp: deriveStat(rules, 'hp', { attributes, classDef: cls }).value,
    stamina: deriveStat(rules, 'stamina', { attributes, classDef: cls }).value,
    mana: deriveStat(rules, 'mana', { attributes, classDef: cls }).value,
    energy: deriveStat(rules, 'energy', { attributes, classDef: cls }).value,
    draw: deriveStat(rules, 'draw', { attributes, classDef: cls }).value,
  };
}

const expectedBase = {
  swordAttack: 7, daggerAttack: 5, bowAttack: 6, weaponGuard: 4,
  sceptreAttack: 6, staffAttack: 4,
  hp: 86, stamina: 2, mana: 2, energy: 3, draw: 5,
};
const expectedChanges = {
  strength: { swordAttack: 8 },
  dexterity: { daggerAttack: 6, bowAttack: 7, weaponGuard: 5, energy: 4 },
  constitution: { hp: 87, stamina: 3 },
  wisdom: { sceptreAttack: 7, mana: 3 },
  intelligence: { staffAttack: 5, draw: 6 },
};
equal(JSON.stringify(vector(allTen)), JSON.stringify(expectedBase), 'all-10 output vector matches exact representative receipts');
for (const stat of Object.keys(allTen)) {
  const attributes = { ...allTen, [stat]: 15 };
  const expected = { ...expectedBase, ...expectedChanges[stat] };
  equal(JSON.stringify(vector(attributes)), JSON.stringify(expected),
    `${stat.toUpperCase()} +5 changes only its owned output cells`);
}

const standardRun = createRunState({ seed: 0x4850, classId: 'reaver', registries: R });
const con15Run = createRunState({
  seed: 0x4851, classId: 'reaver', registries: R,
  attributes: { strength: 10, dexterity: 10, constitution: 15, wisdom: 10, intelligence: 10 },
});
check(standardRun.maxHp === 86 && con15Run.maxHp === 87 && con15Run.maxStamina === 3,
  'actual Wayfarer runs consume the CON HP/Stamina receipt', `${standardRun.maxHp}/${con15Run.maxHp}/${con15Run.maxStamina}`);

function executionReceipt(pieceId, expectedPerHit, expectedHits) {
  if (!piece(pieceId)) return { missing: true };
  const run = createRunState({ seed: 91, classId: 'reaver', registries: R });
  run.attributes = { ...allTen };
  run.loadout.sets.rightHand[0] = pieceId;
  run.loadout.sets.leftHand[0] = null;
  stampDeck(R, run);
  const attack = run.deck.find((card) => card.equipmentRole === 'attack');
  const def = resolveCard(R, attack);
  const effect = def.effects.find((row) => row.op === 'damage');
  const combat = createCombat({
    registries: R, rng: createRng(91),
    player: {
      classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck,
      relicIds: [], flasks: [], loadout: run.loadout,
    },
    enemyIds: [R.enemies.ids()[0]],
  });
  const live = [...combat.piles.hand, ...combat.piles.draw].find((card) => card.instanceId === attack.instanceId);
  if (!combat.piles.hand.includes(live)) {
    combat.piles.draw.splice(combat.piles.draw.indexOf(live), 1);
    combat.piles.hand.push(live);
  }
  const preview = previewCard(combat, live.instanceId, 'e1').values.find((row) => row.op === 'damage');
  const before = combat.enemies[0].hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: live.instanceId, targetId: 'e1' });
  return {
    receipt: attack.profileReceipt?.value,
    definitionAmount: effect?.amount,
    definitionHits: effect?.hits ?? 1,
    previewAmount: preview?.value,
    previewHits: preview?.hits,
    executedTotal: before - combat.enemies[0].hp,
    expectedPerHit,
    expectedHits,
  };
}
for (const [id, amount, hits] of [['dagger', 5, 2], ['shortbow', 6, 1]]) {
  const got = executionReceipt(id, amount, hits);
  check(!got.missing && got.receipt === amount && got.definitionAmount === amount
    && got.definitionHits === hits && got.previewAmount === amount && got.previewHits === hits
    && got.executedTotal === amount * hits,
  `${id} receipt, preview and execution agree per hit`, JSON.stringify(got));
}

for (const [id, amount, rarityBonus] of [['straightSword', 7, 0], ['dagger', 5, 0], ['shortbow', 6, 0], ['boneSceptre', 6, 1]]) {
  const receipt = roleReceipt(id, 'attack', allTen);
  check(receipt?.rarityBonus === rarityBonus && receipt?.value === amount
    && !(piece(id)?.mods || []).some((mod) => /^strike\.damage=/.test(mod)),
  `${id} applies rarity exactly once and no item mod duplicates final damage`, JSON.stringify({ receipt, mods: piece(id)?.mods }));
}

function equipmentMutant(pieceId, mod) {
  const armaments = R.equipment.armaments.map((row) => row.id === pieceId
    ? { ...row, mods: [...row.mods, mod] } : row);
  return { ...R, equipment: { ...R.equipment, armaments } };
}
for (const id of ['straightSword', 'dagger', 'shortbow']) {
  if (!piece(id)) continue;
  const said = validateEquipment(equipmentMutant(id, 'strike.damage=+1')).join(' | ');
  check(/damage.*profile|duplicate.*damage|second.*authority/i.test(said),
    `mutant: ${id} cannot duplicate profile damage through an item mod`, said);
}

console.log(`\nequipment-stat-isolation: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
