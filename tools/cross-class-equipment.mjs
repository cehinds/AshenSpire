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
import { classAttributePreset } from '../src/model/attributes.js';
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
// EXPLICIT, NOT A REMEMBERED HAND. The claim is that `kind` and `hand` are
// authored item columns rather than something inferred from tags or the name.
// Pinning 'right' made it a snapshot instead, and 5819aa58 (2026-08-23,
// "unify equipment inventory interactions") moved every weapon in weapons.csv
// onto 'either' — all 25 of them, deliberately and uniformly — so the value
// moved while the claim did not. `either` is first-class vocabulary, not a
// gap: loadout.js pieceHand reads it as unconstrained and validateEquipment
// accepts exactly `${HANDS}|either`. So assert the column is authored and in
// that closed set, sourced from HANDS rather than re-typed here.
check(greatsword?.kind === 'weapon' && [...Loadout.HANDS, 'either'].includes(greatsword?.hand),
  'hand and category remain explicit item data', JSON.stringify({ kind: greatsword?.kind, hand: greatsword?.hand }));

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

// BY NAME, NOT BY INDEX. This duplicated equipmentRequirements[0] while
// asserting the refusal names greatsword:strength. Row 0 is straightSword's
// now, so BOTH doors refused correctly and by name ("duplicate
// 'straightSword:strength'") while these two rows read red — the refusal was
// never the thing that moved, the positional reach was. Greatsword is this
// tool's worked example three rows above, so name it.
const greatswordRequirement = R.equipment.equipmentRequirements
  .find((row) => row.itemId === 'greatsword' && row.attributeId === 'strength');
check(greatswordRequirement != null, 'greatsword carries the STR requirement row these mutants duplicate',
  JSON.stringify(R.equipment.equipmentRequirements));
const duplicatedRequirement = [...R.equipment.equipmentRequirements, { ...greatswordRequirement }];
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
    // THE SAME UNSTAMPED SEAT class-loadouts.mjs carried until Rune found it
    // building that tool's known-bad (2026-08-15); this file kept it.
    // createPlayerCombatEntity has refused an unstamped seat since the
    // derived-authority slice, so this THREW here — 29 PASS lines printed
    // above the stack trace and every assertion below it never run at all,
    // which is why the reds under it went unseen. The refusal is correct and
    // the CALLER was wrong, which is exactly the invariant
    // tools/derived-runtime-authority.mjs asserts.
    energyMax: starseerStrong.run.energyMax, drawPerTurn: starseerStrong.run.drawPerTurn,
  }],
});
const coopPlayer = coop.players.get('p1');
const coopCross = [...coopPlayer.piles.hand, ...coopPlayer.piles.draw, ...coopPlayer.piles.discard]
  .find((card) => card.instanceId === crossAttack.instanceId);
// NOT "NO SUCH FIELD" ANY MORE. e17fef72 gave the seat its own `loadout` on
// purpose, so the framework Weight Class (dodge pricing and the dodge check)
// is decided from THIS seat's equipment instead of a Light default — so
// `hasOwnProperty(coopPlayer, 'loadout')` stopped being the question. The
// claim it stood for is intact, and is what this row says instead: this seat
// was handed NO loadout, and the card still carries the whole stamped receipt
// and resolves to the same final number — which is only possible if the
// numbers travel on the card. (Never observed either way before now: the
// unstamped seat above threw first, so nothing from here down ever ran.)
check(coopCross?.equipmentRole === crossAttack.equipmentRole && coopCross?.profileId === crossAttack.profileId
  && JSON.stringify(coopCross?.profileReceipt) === JSON.stringify(crossAttack.profileReceipt)
  && resolveCard(R, coopCross).effects.find((effect) => effect.op === 'damage')?.amount === crossFinal
  && coopPlayer?.loadout == null,
  'co-op carries the stamped role/profile/final card, not a mutable loadout', JSON.stringify(coopCross));
// The other half of "not MUTABLE", which no row held once the field existed:
// a seat handed a loadout must CLONE it, or the Weight Class field is a live
// handle on the run's equipment and co-op can write back through it.
const coopSeatWithLoadout = createCoopCombat({
  registries: R, rng: createRng(0xb00), enemyIds: [R.enemies.ids()[0]],
  players: [{
    id: 'p1', classId: starseerStrong.run.class, maxHp: starseerStrong.run.maxHp, hp: starseerStrong.run.hp,
    maxMana: starseerStrong.run.maxMana, mana: starseerStrong.run.mana,
    maxStamina: starseerStrong.run.maxStamina, stamina: starseerStrong.run.stamina,
    deck: starseerStrong.run.deck, relicIds: [], flasks: [],
    energyMax: starseerStrong.run.energyMax, drawPerTurn: starseerStrong.run.drawPerTurn,
    loadout: starseerStrong.run.loadout,
  }],
}).players.get('p1');
check(coopSeatWithLoadout?.loadout != null
  && coopSeatWithLoadout.loadout !== starseerStrong.run.loadout
  && JSON.stringify(coopSeatWithLoadout.loadout) === JSON.stringify(starseerStrong.run.loadout),
  'a seat handed a loadout clones it rather than aliasing the run', JSON.stringify(coopSeatWithLoadout?.loadout));

const baseline = resolveStartingKit(R, 'starseer', undefined, {});
let crossStart = '';
try { resolveStartingKit(R, 'starseer', 'reaverGreatsword', { discoveredArmaments: ['greatsword'] }); }
catch (error) { crossStart = error.message; }
check(baseline.id === 'starseerBaseline' && /not eligible|class/i.test(crossStart),
  'starting-kit class eligibility stays separate from cross-class loot equipping', crossStart);
// IT HAS TO SUM TO THE MODE'S FIXED TOTAL OR IT NEVER REACHES THE GATE.
// `{ ...all10, dexterity: 15 }` is a pre-`tuned` set: it totals 55 (and all10
// still spells the HP stat `vigour`, which has not been an attribute id since
// the rename), so createRunState refused it at the ATTRIBUTE door — "total 55
// must equal 53 for mode 'tuned'" — and this row would have read that as its
// greatsword red. Derive from the contractual Reaver preset instead (SPEC
// §5.1: 13/11/11/8/10 = 53) and move three points off STR onto DEX: the total
// stays whatever the mode says it is, and STR 10 is under the greatsword's
// authored 12, which is the thing actually being proved. Should a future
// preset put Reaver STR at 12+, the kit would be allowed and this row goes
// red on its own rather than passing for the wrong reason.
const reaverPreset = classAttributePreset(R, 'reaver');
const reaverWeakStr = { ...reaverPreset, strength: reaverPreset.strength - 3, dexterity: reaverPreset.dexterity + 3 };
let weakStart = '';
try {
  createRunState({ seed: 12, classId: 'reaver', registries: R, startingKitId: 'reaverGreatsword',
    profileMeta: { discoveredArmaments: ['greatsword'] }, attributes: reaverWeakStr });
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
