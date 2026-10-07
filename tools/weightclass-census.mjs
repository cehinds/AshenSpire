#!/usr/bin/env node
// tools/weightclass-census.mjs — the Weight Class A/B evidence instrument.
//
// For every class x attribute preset x starting armour set x (right hand x
// left hand) choice the character creator can produce — each hand offered
// independently, empty allowed, the same armament in both hands refused — compute the equip-load receipt the
// Armoury shows (model/statProjection.playerLoadReceipt, decided by the
// framework's Weight Class service) and print the class each combination
// lands in. The A/B question this answers: under the armour-weight rule
// this branch ships, how are the shipped kits distributed across
// Light / Medium / Heavy — and does any kit start Heavy by accident?
//
//   node tools/weightclass-census.mjs                    the table + one verdict line
//   node tools/weightclass-census.mjs --capacity-base=N  the same census as if
//                                      mechanics.weight.capacityBase were N (the
//                                      A/B for the contract's feasibility flag —
//                                      no data changes; the delta rides as a bonus)
//
// Terminal verdict form (tools/verdict.mjs): "weightclass-census: OK — N checks passed".

import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState } from '../src/model/state.js';
import { playerLoadReceipt, ARMOUR_WEIGHT_RULE } from '../src/model/statProjection.js';
import { attributeRules } from '../src/content/attributes.js';
import { creationHandChoices } from '../src/model/characterCreation.js';
import { creationMode, allocationTotal, attributeAllocationProblems, classAttributePreset, orderedAttributes } from '../src/model/attributes.js';
import { itemUpgradeTiers } from '../src/model/itemUpgrades.js';
import { startingHandsRequirementFailure } from '../src/model/loadout.js';
import { mechanics } from '../src/framework/data/mechanics.js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const creation = JSON.parse(readFileSync(resolve(ROOT, 'content/source/characterCreation.json'), 'utf8'));
const REG = createRegistries(contentBundle);
const BASE_ARG = (process.argv.find((a) => a.startsWith('--capacity-base=')) || '').slice('--capacity-base='.length);
const capacityBase = BASE_ARG ? Number(BASE_ARG) : mechanics.weight.capacityBase;
if (!Number.isFinite(capacityBase)) throw new Error(`--capacity-base expects a number, got '${BASE_ARG}'`);
const capacityBonus = capacityBase - mechanics.weight.capacityBase;

let checks = 0;
const tally = {};
const rows = [];
// THE CREATOR'S OWN SPACE, not the paired kit rows: the Starting Equipment
// disclosure offers every configured `handIds` choice for EACH hand
// independently (model/characterCreation.creationEquipmentSectionViews +
// selectStartingHand), and a hand may also be left empty. So the census is the
// Cartesian product of the legal per-hand choices — an armament in both hands
// is refused by the creator (resolveCreationHands) and is not a row here.
const creatorHands = (classId, slotId) => [null, ...creationHandChoices(REG, classId, slotId).map((piece) => piece.id)];
const handLabel = (id) => id || '—';
// THE ATTRIBUTE SPACE: only the modes the creator SHOWS (characterCreation
// visibleModeIds — `tuned` is the balance preset, not a player choice), and
// within a mode not just its preset but the two ALLOCATION BOUNDARIES that
// bound the capacity: every point the player can pull out of Constitution and
// Strength (the lightest capacity a legal sheet allows) and every point they
// can pour in. Capacity is decided by CON and STR alone, so these two sheets
// bracket every legal allocation's class for a given kit; the preset is the
// editor's opening position between them. Each sheet is validated by the same
// rule the creator applies (attributeAllocationProblems) — a boundary the
// creator would refuse is a bug in this tool, not a row.
const visibleModeIds = creation.visibleModeIds;
// THE CREATOR'S OWN ACCEPTANCE GATE, applied exactly as Begin applies it
// (ui/screens/customize.js → model/loadout.startingHandsRequirementFailure):
// a hand the sheet cannot hold (a Greatsword at Strength 10, a Straight Sword
// at 8) is refused there, so it is not a creatable start and not a row here.
// createRunState alone does not refuse it — customized hands inherit the
// baseline kit flag — which is why the gate is asked by name.
let refusedByRequirements = 0;
const attributeIds = orderedAttributes(REG).map((a) => a.id);
function boundarySheet(modeId, classId, want) {
  const mode = creationMode(REG, modeId);
  const floor = mode.belowBaseline === 'forbid' ? Math.max(mode.minimum, mode.baseline) : mode.minimum;
  const ceiling = mode.maximum;
  const total = allocationTotal(REG, modeId);
  const capacityIds = ['constitution', 'strength'];
  const rest = attributeIds.filter((id) => !capacityIds.includes(id));
  const values = {};
  for (const id of attributeIds) values[id] = floor;
  // The capacity pair takes as little (min) or as much (max) as a legal sheet
  // allows — every other attribute at the floor bounds how much the pair can
  // hold — and whatever the fixed total leaves over is poured into the rest,
  // each up to the ceiling. A leftover that fits nowhere is not a sheet.
  let remaining = total - attributeIds.length * floor;
  if (want === 'max') {
    for (const id of capacityIds) { const add = Math.min(ceiling - floor, remaining); values[id] += add; remaining -= add; }
  }
  for (const id of rest) { const add = Math.min(ceiling - floor, remaining); values[id] += add; remaining -= add; }
  if (want === 'min' && remaining > 0) {
    for (const id of capacityIds) { const add = Math.min(ceiling - floor, remaining); values[id] += add; remaining -= add; }
  }
  if (remaining !== 0) throw new Error(`${classId}/${modeId}: no legal ${want}-capacity sheet (${remaining} points left over)`);
  const problems = attributeAllocationProblems(REG, classId, modeId, values);
  if (problems.length) throw new Error(`${classId}/${modeId} ${want}-capacity sheet refused by the creator's rule: ${problems.map((p) => p.msg).join('; ')}`);
  return values;
}
for (const cls of contentBundle.classes) {
  const armours = (creation.classes[cls.id] || {}).armourIds || ['default'];
  const rights = creatorHands(cls.id, 'rightHand');
  const lefts = creatorHands(cls.id, 'leftHand');
  for (const modeId of visibleModeIds) {
    const sheets = [
      ['preset', classAttributePreset(REG, cls.id, modeId)],
      ['min-cap', boundarySheet(modeId, cls.id, 'min')],
      ['max-cap', boundarySheet(modeId, cls.id, 'max')],
    ];
    for (const [sheetName, attributes] of sheets) {
      for (const armourId of armours) {
        for (const rightHand of rights) {
          for (const leftHand of lefts) {
            if (rightHand && leftHand && rightHand === leftHand) continue;
            if (startingHandsRequirementFailure(REG, { rightHand, leftHand }, attributes)) { refusedByRequirements += 1; continue; }
            // startingHands rather than startingKitId: the creator's choice is a
            // pair of hands, and the run is born through the same resolver the
            // creator uses (resolveCreationHands inside createRunState).
            const run = createRunState({ seed: 7, classId: cls.id, registries: REG, attributes, attributeMode: modeId, startingHands: { rightHand, leftHand } });
            run.loadout.sets.armor = [armourId];
            run.loadout.active.armor = 0;
            const r = playerLoadReceipt(REG, run, { capacityBonus });
            checks += 1;
            const bucket = tally[sheetName] || (tally[sheetName] = {});
            bucket[r.classId] = (bucket[r.classId] || 0) + 1;
            rows.push(`${cls.id.padEnd(9)} ${modeId.padEnd(9)} ${sheetName.padEnd(8)} ${armourId.padEnd(10)} ${`${handLabel(rightHand)} + ${handLabel(leftHand)}`.padEnd(30)} load ${String(r.load).padStart(3)}/${String(r.capacity).padStart(3)} ${String(r.percent).padStart(3)}%  ${r.word}`);
          }
        }
      }
    }
  }
}
// THE REACHABILITY LINES: the heaviest loadout each class could ever wear at
// its tuned attributes, the outfit at its highest Smithing tier. Not "the
// heaviest item, twice": a run holds ONE copy of
// an armament in one hand (applyEquipTransition moves it, and the weapon-card
// plan refuses a duplicate id), so the candidates are every ORDERED PAIR OF
// DISTINCT armaments, each hand may also be empty, and each pair is measured
// through a real run loadout and the same receipt the Armoury shows — not by
// adding two numbers. If even the heaviest stays Light, no loadout can leave
// Light and the class does not exist for the player: the contract's own
// feasibility flag, answered here.
const heaviest = [];
const armaments = contentBundle.equipment.armaments;
for (const cls of contentBundle.classes) {
  // At the default VISIBLE mode's preset — the sheet a player who changes
  // nothing actually starts with; the boundary sheets above bracket it.
  const reachMode = visibleModeIds[0];
  const attributes = classAttributePreset(REG, cls.id, reachMode);
  const outfit = contentBundle.equipment.armour.filter((o) => o.classId === cls.id).sort((a, b) => b.poiseThreshold - a.poiseThreshold)[0];
  const run = createRunState({ seed: 7, classId: cls.id, registries: REG, attributes, attributeMode: reachMode });
  run.loadout.sets.armor = [outfit.id];
  run.loadout.active.armor = 0;
  // "Could ever wear" includes the Smith: an armour tier raises the poise
  // threshold and therefore the weight, so the outfit is worn at its highest
  // authored tier. Armament tiers change card numbers only, never weight.
  const armourRef = `armor/${cls.id}/${outfit.id}`;
  const armourTier = itemUpgradeTiers(REG, armourRef).slice(-1)[0] || 0;
  run.itemUpgradeLevels = { [armourRef]: armourTier };
  let best = null;
  let pairs = 0;
  const handIds = [null, ...armaments.map((a) => a.id)];
  for (const rightId of handIds) {
    for (const leftId of handIds) {
      if (rightId && leftId && rightId === leftId) continue;
      run.loadout.sets.rightHand = [rightId];
      run.loadout.sets.leftHand = [leftId];
      run.loadout.active.rightHand = 0;
      run.loadout.active.leftHand = 0;
      const r = playerLoadReceipt(REG, run, { capacityBonus });
      pairs += 1;
      if (!best || r.load > best.receipt.load) best = { rightId, leftId, receipt: r };
    }
  }
  // The receipt must have counted exactly the two distinct hands and the
  // outfit — a third source, or a hand counted twice, is the defect this
  // enumeration replaced.
  const expectedSources = [best.rightId, best.leftId, outfit.id].filter(Boolean).length;
  if (best.receipt.sources.length !== expectedSources) throw new Error(`${cls.id}: heaviest loadout counted ${best.receipt.sources.length} sources, expected ${expectedSources}`);
  checks += 1;
  heaviest.push(`${cls.id.padEnd(9)} (${reachMode} preset) heaviest of ${pairs} distinct hand pairs: ${handLabel(best.rightId)}+${handLabel(best.leftId)}+${outfit.id}${armourTier ? `+${armourTier}` : ''}: load ${best.receipt.load}/${best.receipt.capacity} ${best.receipt.percent}% → ${best.receipt.word}`);
}
console.log(`weightclass-census — armour weight rule: ${ARMOUR_WEIGHT_RULE} · capacity base ${capacityBase}${capacityBonus ? ` (shipped ${mechanics.weight.capacityBase}; delta ${capacityBonus} as a bonus)` : ''}`);
for (const row of rows) console.log('  ' + row);
console.log(`  hand pairs the creator's requirement gate refuses (not creatable, not counted): ${refusedByRequirements}`);
for (const [sheetName, bucket] of Object.entries(tally)) {
  console.log(`  distribution of creatable starts at the ${sheetName} sheet: ${Object.entries(bucket).map(([k, v]) => `${k} ${v}`).join(' · ')} (of ${Object.values(bucket).reduce((a, b) => a + b, 0)})`);
}
for (const row of heaviest) console.log('  ' + row);
console.log(`weightclass-census: OK — ${checks} checks passed`);
