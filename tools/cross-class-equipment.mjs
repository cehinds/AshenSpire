#!/usr/bin/env node
// Observed-red contract: cross-class equipment requirements and card fit.
// Class-start eligibility remains owned by starting kits; this gate concerns
// loot already owned by a run and contains no class-id branch in equip logic.

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import * as Loadout from '../src/model/loadout.js';
import { resolveStartingKit } from '../src/model/startingKits.js';

const R = createRegistries(contentBundle);
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const piece = (id) => R.equipment.armaments.find((row) => row.id === id);
const greatsword = piece('greatsword');
const dagger = piece('dagger');
const ashStaff = piece('ashStaff');
check(greatsword?.requirements?.attributes?.strength === 12,
  'Greatsword explicitly requires STR 12', JSON.stringify(greatsword?.requirements));
check(dagger?.requirements?.attributes?.dexterity === 11,
  'Dagger explicitly requires DEX 11', JSON.stringify(dagger?.requirements));
check(ashStaff?.requirements?.attributes?.intelligence === 12,
  'Ash Staff explicitly requires INT 12', JSON.stringify(ashStaff?.requirements));
check(greatsword?.kind === 'weapon' && greatsword?.hand === 'right',
  'hand and category remain explicit item data', JSON.stringify(greatsword));

const requirementReceipt = Loadout.equipmentRequirementReceipt;
const cardCompatibility = Loadout.cardEquipmentCompatibility;
check(typeof requirementReceipt === 'function', 'one model resolver owns equipment requirement receipts');
check(typeof cardCompatibility === 'function', 'one model resolver owns card/equipment compatibility');
check(Array.isArray(R.equipment.cardEquipmentExceptions),
  'exact-weapon card exceptions are a registered generated table', JSON.stringify(R.equipment.cardEquipmentExceptions));

const all10 = { strength: 10, dexterity: 10, constitution: 10, wisdom: 10, intelligence: 10 };
const all15 = { strength: 15, dexterity: 15, constitution: 15, wisdom: 15, intelligence: 15 };
if (typeof requirementReceipt === 'function') {
  const low = requirementReceipt(R, greatsword, all10);
  const met = requirementReceipt(R, greatsword, { ...all10, strength: 12 });
  check(low?.ok === false && low?.failures?.some((row) => row.attributeId === 'strength' && row.required === 12 && row.actual === 10),
    'requirement receipt names unmet stat minimum', JSON.stringify(low));
  check(met?.ok === true && met.requirements?.length === 1,
    'requirement receipt accepts exact stat minimum', JSON.stringify(met));

  const mutantPiece = { ...greatsword, requirements: { attributes: { luck: 12 } } };
  let said = '';
  try { requirementReceipt(R, mutantPiece, all15); } catch (error) { said = error.message; }
  check(/luck|unknown attribute/i.test(said), 'unknown requirement attribute fails closed by name', said);
}

const ownsEverything = { has: () => true };
function tryEquip(classId, itemId, attributes) {
  const run = createRunState({ seed: 0xb, classId, registries: R });
  return {
    run,
    equipped: Loadout.equipPiece(R, run.loadout, 'rightHand', 0, itemId, ownsEverything,
      { inCombat: false, classId, attributes }),
  };
}
const starseerLow = tryEquip('starseer', 'greatsword', all10);
const starseerStrong = tryEquip('starseer', 'greatsword', { ...all10, strength: 12 });
check(starseerLow.equipped === false, 'non-class pickup refuses when explicit requirements are unmet');
check(starseerStrong.equipped === true && starseerStrong.run.loadout.sets.rightHand[0] === 'greatsword',
  'non-class pickup equips when hand/category/stat requirements pass', JSON.stringify(starseerStrong.run.loadout));
const reaverMage = tryEquip('reaver', 'ashStaff', { ...all10, intelligence: 12 });
check(reaverMage.equipped === true, 'equip gate has no class branch: a qualified Reaver may use Ash Staff');

const baseline = resolveStartingKit(R, 'starseer', undefined, {});
let crossStart = '';
try { resolveStartingKit(R, 'starseer', 'reaverGreatsword', { discoveredArmaments: ['greatsword'] }); }
catch (error) { crossStart = error.message; }
check(baseline.id === 'starseerBaseline' && /not eligible|class/i.test(crossStart),
  'starting-kit class eligibility stays separate from cross-class loot equipping', crossStart);

if (typeof cardCompatibility === 'function') {
  const classFit = cardCompatibility(R, { cardId: 'crimsonCleave', classId: 'reaver', pieceId: 'ashStaff' });
  const tagFit = cardCompatibility(R, { cardId: 'crimsonCleave', classId: 'starseer', pieceId: 'straightSword' });
  const noFit = cardCompatibility(R, { cardId: 'crimsonCleave', classId: 'starseer', pieceId: 'ashStaff' });
  check(classFit?.ok && classFit.reason === 'class', 'card compatibility primarily accepts authored class fit', JSON.stringify(classFit));
  check(tagFit?.ok && tagFit.reason === 'tag' && tagFit.sharedTags?.includes('blade'),
    'cross-class card compatibility accepts explicit shared tags', JSON.stringify(tagFit));
  check(noFit?.ok === false, 'card compatibility refuses when neither class nor tags fit', JSON.stringify(noFit));

  const exact = cardCompatibility(R, { cardId: 'starstoneKris', classId: 'starseer', pieceId: 'dagger' });
  const wrongExact = cardCompatibility(R, { cardId: 'starstoneKris', classId: 'starseer', pieceId: 'ashStaff' });
  check(exact?.ok && exact.reason === 'exactWeapon', 'registered exact-weapon exception may allow its named item', JSON.stringify(exact));
  check(wrongExact?.ok === false && wrongExact.reason === 'exactWeapon',
    'exact-weapon exception overrides generic class/tag fallback and fails closed', JSON.stringify(wrongExact));
} else {
  check(false, 'card compatibility primarily accepts authored class fit');
  check(false, 'cross-class card compatibility accepts explicit shared tags');
  check(false, 'card compatibility refuses when neither class nor tags fit');
  check(false, 'registered exact-weapon exception may allow its named item');
  check(false, 'exact-weapon exception overrides generic class/tag fallback and fails closed');
}

const loadoutSource = String(Loadout.equipmentRequirementReceipt || '') + String(Loadout.cardEquipmentCompatibility || '');
check(!/reaver|starseer|herald/.test(loadoutSource), 'requirement and compatibility resolvers contain no class-id branches');

console.log(`\ncross-class-equipment: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
