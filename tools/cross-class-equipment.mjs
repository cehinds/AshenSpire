#!/usr/bin/env node
// Observed-red contract: cross-class equipment requirements and card fit.
// Class-start eligibility remains owned by starting kits; this gate concerns
// loot already owned by a run and contains no class-id branch in equip logic.

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveCard } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import * as Loadout from '../src/model/loadout.js';
import { resolveStartingKit } from '../src/model/startingKits.js';
import { validateContent } from '../src/model/validate.js';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';
import { createCoopCombat } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';

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

function equipmentMutant(patch) {
  return createRegistries({ ...contentBundle, equipment: { ...contentBundle.equipment, ...patch } });
}
// `cardTagging` is no longer among these: model/registries.js derives that index
// from the bundle's own `tagging` rows, so deleting the equipment key is a no-op
// — the defect became impossible to write, and the plant moved to the table it
// is derived FROM (below) rather than being dropped.
for (const [field, label] of [
  ['equipmentRequirements', 'requirements'],
  ['cardEquipmentExceptions', 'exact exceptions'],
]) {
  const mutant = { ...contentBundle.equipment };
  delete mutant[field];
  const said = Loadout.validateEquipment(createRegistries({ ...contentBundle, equipment: mutant })).join(' | ');
  check(new RegExp(field, 'i').test(said), `mutant: missing generated ${label} table fails closed`, said);
  const bootSaid = validateContent({ ...contentBundle, equipment: mutant }).errors.map((row) => `${row.path}: ${row.msg}`).join(' | ');
  check(new RegExp(field, 'i').test(bootSaid), `boot mutant: missing generated ${label} table fails closed`, bootSaid);
}
{
  // Same claim, the door that now owns it: with no tagging table there is no
  // card-tag index to build, and the fit check must fail closed rather than
  // read a stale fold.
  const noTagging = { ...contentBundle };
  delete noTagging.tagging;
  const said = Loadout.validateEquipment(createRegistries(noTagging)).join(' | ');
  check(/cardTagging/i.test(said), 'mutant: missing generated card tags table fails closed', said);
  const bootSaid = validateContent(noTagging).errors.map((row) => `${row.path}: ${row.msg}`).join(' | ');
  check(/tagging/i.test(bootSaid), 'boot mutant: missing generated card tags table fails closed', bootSaid);
}

const duplicatedRequirement = [...R.equipment.equipmentRequirements, { ...R.equipment.equipmentRequirements[0] }];
check(/duplicate.*greatsword:strength/i.test(Loadout.validateEquipment(equipmentMutant({ equipmentRequirements: duplicatedRequirement })).join(' | ')),
  'mutant: duplicate item/stat requirement fails closed');
const bootErrors = (equipment) => validateContent({ ...contentBundle, equipment: { ...contentBundle.equipment, ...equipment } })
  .errors.map((row) => `${row.path}: ${row.msg}`).join(' | ');
check(/duplicate.*greatsword:strength/i.test(bootErrors({ equipmentRequirements: duplicatedRequirement })),
  'boot mutant: duplicate item/stat requirement fails closed');
const badMinimum = R.equipment.equipmentRequirements.map((row) => row.itemId === 'greatsword' ? { ...row, minimum: -1 } : row);
check(/minimum.*non-negative|greatsword:strength/i.test(Loadout.validateEquipment(equipmentMutant({ equipmentRequirements: badMinimum })).join(' | ')),
  'mutant: negative requirement minimum fails closed');
for (const [value, label] of [[undefined, 'missing'], ['12', 'string'], [1.5, 'fractional'], [Number.NaN, 'NaN'], [Number.POSITIVE_INFINITY, 'Infinity'], [-1, 'negative']]) {
  const rows = R.equipment.equipmentRequirements.map((row) => row.itemId === 'greatsword'
    ? Object.fromEntries(Object.entries({ ...row, minimum: value }).filter(([, v]) => v !== undefined)) : row);
  check(/greatsword:strength|minimum/i.test(bootErrors({ equipmentRequirements: rows })),
    `boot mutant: ${label} requirement minimum fails closed`, bootErrors({ equipmentRequirements: rows }));
}
const danglingException = [{ cardId: 'missingCard', weaponId: 'missingWeapon' }];
const danglingSaid = Loadout.validateEquipment(equipmentMutant({ cardEquipmentExceptions: danglingException })).join(' | ');
check(/unknown card 'missingCard'/.test(danglingSaid) && /unknown weapon 'missingWeapon'/.test(danglingSaid),
  'mutant: dangling exact card and weapon ids fail closed', danglingSaid);
check(/unknown card 'missingCard'/.test(bootErrors({ cardEquipmentExceptions: danglingException }))
  && /unknown weapon 'missingWeapon'/.test(bootErrors({ cardEquipmentExceptions: danglingException })),
  'boot mutant: dangling exact card and weapon ids fail closed', bootErrors({ cardEquipmentExceptions: danglingException }));
const duplicatedException = [...R.equipment.cardEquipmentExceptions, { ...R.equipment.cardEquipmentExceptions[0] }];
check(/duplicate.*starstoneKris:dagger/i.test(bootErrors({ cardEquipmentExceptions: duplicatedException })),
  'boot mutant: duplicate exact card/weapon pair fails closed');

const all10 = { strength: 10, dexterity: 10, vigour: 10, wisdom: 10, intelligence: 10 };
const all15 = { strength: 15, dexterity: 15, vigour: 15, wisdom: 15, intelligence: 15 };
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

Loadout.stampDeck(R, starseerStrong.run);
const crossAttack = starseerStrong.run.deck.find((card) => card.equipmentRole === 'attack');
const crossFinal = resolveCard(R, crossAttack).effects.find((effect) => effect.op === 'damage')?.amount;
const saves = createSaveManager(createMemoryStorage());
saves.saveRun(starseerStrong.run);
const resumedCross = saves.loadRun(R);
const resumedCrossAttack = resumedCross?.deck.find((card) => card.instanceId === crossAttack.instanceId);
check(resumedCross?.loadout?.sets?.rightHand?.[0] === 'greatsword'
  && resumedCrossAttack?.equipmentRole === crossAttack.equipmentRole
  && resumedCrossAttack?.profileId === crossAttack.profileId
  && JSON.stringify(resumedCrossAttack?.profileReceipt) === JSON.stringify(crossAttack.profileReceipt)
  && resolveCard(R, resumedCrossAttack).effects.find((effect) => effect.op === 'damage')?.amount === crossFinal,
  'qualified cross-class equip save/resume preserves item, role, profile, receipt and final card', JSON.stringify(resumedCrossAttack));
const coop = createCoopCombat({
  registries: R, rng: createRng(0xb00), enemyIds: [R.enemies.ids()[0]],
  players: [{
    id: 'p1', classId: starseerStrong.run.class, maxHp: starseerStrong.run.maxHp, hp: starseerStrong.run.hp,
    maxMana: starseerStrong.run.maxMana, mana: starseerStrong.run.mana,
    maxStamina: starseerStrong.run.maxStamina, stamina: starseerStrong.run.stamina,
    deck: starseerStrong.run.deck, relicIds: [], flasks: [],
  }],
});
const coopPlayer = coop.players.get('p1');
const coopCross = [...coopPlayer.piles.hand, ...coopPlayer.piles.draw, ...coopPlayer.piles.discard]
  .find((card) => card.instanceId === crossAttack.instanceId);
check(coopCross?.equipmentRole === crossAttack.equipmentRole && coopCross?.profileId === crossAttack.profileId
  && JSON.stringify(coopCross?.profileReceipt) === JSON.stringify(crossAttack.profileReceipt)
  && resolveCard(R, coopCross).effects.find((effect) => effect.op === 'damage')?.amount === crossFinal
  && !Object.prototype.hasOwnProperty.call(coopPlayer, 'loadout'),
  'co-op carries the stamped role/profile/final card, not a mutable loadout', JSON.stringify(coopCross));

const baseline = resolveStartingKit(R, 'starseer', undefined, {});
let crossStart = '';
try { resolveStartingKit(R, 'starseer', 'reaverGreatsword', { discoveredArmaments: ['greatsword'] }); }
catch (error) { crossStart = error.message; }
check(baseline.id === 'starseerBaseline' && /not eligible|class/i.test(crossStart),
  'starting-kit class eligibility stays separate from cross-class loot equipping', crossStart);
let weakStart = '';
try {
  createRunState({ seed: 12, classId: 'reaver', registries: R, startingKitId: 'reaverGreatsword',
    profileMeta: { discoveredArmaments: ['greatsword'] }, attributes: { ...all10, dexterity: 15 } });
} catch (error) { weakStart = error.message; }
check(/greatsword|strength|12/i.test(weakStart),
  'starting-kit eligibility does not bypass explicit equipment requirements', weakStart);

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
