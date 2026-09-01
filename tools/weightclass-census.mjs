#!/usr/bin/env node
// tools/weightclass-census.mjs — the Weight Class A/B evidence instrument.
//
// For every class x attribute preset x starting armour set x starting hand
// kit the character creator can produce, compute the equip-load receipt the
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
for (const cls of contentBundle.classes) {
  const kits = contentBundle.equipment.startingKits.filter((k) => k.classId === cls.id);
  const armours = (creation.classes[cls.id] || {}).armourIds || ['default'];
  for (const [mode, presets] of Object.entries(attributeRules.presets)) {
    const attributes = presets[cls.id];
    if (!attributes) continue;
    for (const armourId of armours) {
      for (const kit of kits) {
        // startingHands rather than startingKitId: alternate kits are gated on
        // profile discovery, and a census counts every kit the creator can offer.
        const run = createRunState({ seed: 7, classId: cls.id, registries: REG, attributes, attributeMode: mode, startingHands: { rightHand: kit.rightHand || null, leftHand: kit.leftHand || null } });
        run.loadout.sets.armor = [armourId];
        run.loadout.active.armor = 0;
        const r = playerLoadReceipt(REG, run, { capacityBonus });
        checks += 1;
        tally[r.classId] = (tally[r.classId] || 0) + 1;
        rows.push(`${cls.id.padEnd(9)} ${mode.padEnd(9)} ${armourId.padEnd(10)} ${kit.id.padEnd(20)} load ${String(r.load).padStart(3)}/${String(r.capacity).padStart(3)} ${String(r.percent).padStart(3)}%  ${r.word}`);
      }
    }
  }
}
// THE REACHABILITY LINES: the heaviest kit each class could ever wear at its
// tuned attributes (heaviest right hand, heaviest left hand, heaviest outfit).
// If even that stays Light, no loadout can leave Light and the class does not
// exist for the player — the contract's own feasibility flag, answered here.
const heaviest = [];
const armaments = contentBundle.equipment.armaments;
const heaviestHand = (hand) => armaments.filter((a) => a.hand === hand || a.hand === 'either').sort((a, b) => b.weight - a.weight)[0];
for (const cls of contentBundle.classes) {
  const attributes = attributeRules.presets.tuned[cls.id];
  if (!attributes) continue;
  const outfit = contentBundle.equipment.armour.filter((o) => o.classId === cls.id).sort((a, b) => b.poiseThreshold - a.poiseThreshold)[0];
  const right = heaviestHand('right'); const left = heaviestHand('left');
  const decided = REG.framework.weightClass({
    attributes, bonuses: capacityBonus,
    weights: { mainHandWeight: right.weight + left.weight, offHandWeight: 0, armorWeight: ARMOUR_WEIGHT_RULE === 'poiseThreshold' ? outfit.poiseThreshold : 0, otherCountedWeight: 0 },
  });
  checks += 1;
  heaviest.push(`${cls.id.padEnd(9)} heaviest ${right.id}+${left.id}+${outfit.id}: load ${decided.load}/${decided.capacity} ${decided.percent}% → ${decided.word}`);
}
console.log(`weightclass-census — armour weight rule: ${ARMOUR_WEIGHT_RULE} · capacity base ${capacityBase}${capacityBonus ? ` (shipped ${mechanics.weight.capacityBase}; delta ${capacityBonus} as a bonus)` : ''}`);
for (const row of rows) console.log('  ' + row);
console.log(`  distribution of shipped starts: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')} (of ${checks - heaviest.length})`);
for (const row of heaviest) console.log('  ' + row);
console.log(`weightclass-census: OK — ${checks} checks passed`);
