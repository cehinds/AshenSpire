#!/usr/bin/env node
// Observed-red contract for the one presentation receipt shared by character
// creation and the Armoury. This is source-only: it must not read dist.

import fs from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, passiveSum } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveSwapCostRule, swapCostFor } from '../src/model/loadout.js';

// ---------------------------------------------------------------------------
// ARM 1 of MR-41 (as amended by MR-46) — THE SWAP-PRICE ROW'S SAME-DOOR CORPUS
// ---------------------------------------------------------------------------
//
// The defect: the comparison row derived its own swap number from
// `runMods().swapCostDelta` — a DELTA under a PRICE's label — while
// `swapCostFor()` already owned the answer. Measured with one talisman
// authored (a CSV row, zero code): the row read `0 → 2` while a `flat` run
// charged `2 → 2` and DISCARDED the +2. Wrong under all three shipped rules.
//
// THE DOOR, and it is why `doorplant` grew `edits` + `prep` today. This defect
// only FIRES on content nobody has authored yet, so a plant of the code alone
// is green for a reason unrelated to coverage, and a plant of the CSV alone
// never reaches the runtime (content/source -> content-build -> generated
// module is a TWO-STAGE door). Each plant below therefore carries the talisman
// row AND the defect, and runs the real compile in between.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  // The content half, identical in every plant: one talisman, authored the way
  // Constantine authors content — a row in the spreadsheet, no code. This is
  // the act equipSlots.csv's own blurb is waiting for ("Empty until talismans
  // are authored") and the act Law 0 exists to make free.
  const TALISMAN = 'wardingCharm,Warding Charm,talisman,,uncommon,dagger,1.00,C0B8A6,C9A227,charm,,,,'
    + 'self.swapCost=+2,,"A planted probe talisman — corpus only, never shipped.",0,,0';
  const csvRow = { file: 'content/source/weapons.csv', append: TALISMAN };
  const REBUILD = [['node', 'tools/content-build.mjs']];
  process.exit(await doorSelftest({
    tool: 'equipment-surface-receipts.mjs',
    plants: [
      {
        // THE DEFECT ITSELF, restored verbatim: the tree exactly as it stood at
        // train/preview-2026-08-15 = 1ab9777, plus one authored talisman.
        name: 'the row derives its own delta again (the second home returns) + a talisman authored by CSV',
        edits: [csvRow, {
          file: 'src/model/equipmentPresentation.js',
          find: '  resourceChanges.push(...swapPriceChanges(registries, run, run.loadout, loadout, meta, slot.id, setIndex));',
          replace: '  if (beforeMods.swapCostDelta !== afterMods.swapCostDelta) {\n'
            + "    resourceChanges.push({ id: 'swapCost', label: 'Active-set swap Actions',"
            + ' before: beforeMods.swapCostDelta, after: afterMods.swapCostDelta });\n  }',
        }],
        prep: REBUILD,
        expectRed: /FAIL every swap-price row is the number `swapCostFor\(\)` charges/,
      },
      {
        // `gearIgnored` is the field that exists so a declined talisman says so.
        // Silence here is the same defect one step quieter, so it gets its own
        // plant rather than riding the one above.
        name: 'the declined gear delta stops being reported + a talisman authored by CSV',
        edits: [csvRow, {
          file: 'src/model/equipmentPresentation.js',
          find: '    if (before.cost === after.cost && declined === 0) continue;',
          replace: '    if (before.cost === after.cost) continue;',
        }],
        prep: REBUILD,
        expectRed: /FAIL a gear-off rule reports the delta it DECLINED/,
      },
      {
        // A screen that keeps its settings to itself prices with the shipping
        // default and reads as plausible — Law 0 clause 5's failure mode.
        name: 'the Armoury stops handing its live settings to the receipt',
        edits: [csvRow, {
          file: 'src/ui/screens/equipment.js',
          find: '        candidate: { slotId: picking.slotId, setIndex: picking.setIndex, pieceId: piece.id },\n        meta,',
          replace: '        candidate: { slotId: picking.slotId, setIndex: picking.setIndex, pieceId: piece.id },',
        }],
        prep: REBUILD,
        expectRed: /FAIL the Armoury hands its live settings to the receipt/,
      },
    ],
  }));
}

const R = createRegistries(contentBundle);
let passed = 0;
let failed = 0;
function check(ok, label, detail = '') {
  if (ok) { passed++; console.log(`PASS ${label}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

let equipmentSurfaceReceipt = null;
try {
  ({ equipmentSurfaceReceipt } = await import('../src/model/equipmentPresentation.js'));
} catch (error) {
  check(false, 'shared equipment presentation reader exists', error.message);
}
check(typeof equipmentSurfaceReceipt === 'function', 'shared equipment presentation reader is exported');

if (equipmentSurfaceReceipt) {
  const reaver = createRunState({ seed: 0x51, classId: 'reaver', registries: R });
  const active = equipmentSurfaceReceipt(R, reaver);
  check(JSON.stringify(active.roleCopies) === JSON.stringify({ attack: 4, guard: 4, technique: 1, signature: 1 }),
    'active receipt owns exact 4/4/1/1 copy counts', JSON.stringify(active.roleCopies));
  check(active.roles.length === 3 && active.roles.every((row) => row.copies === active.roleCopies[row.role]),
    'each equipment role carries its authored copy count', JSON.stringify(active.roles));
  check(active.signature?.copies === 1 && active.signature?.cardId === R.classes.get('reaver').startingSignatureCard,
    'class signature is the fourth fixed type and carries one copy', JSON.stringify(active.signature));
  check(active.requirements.every((row) => row.pieceId && Array.isArray(row.requirements)),
    'active equipment requirements are presentation-ready receipts', JSON.stringify(active.requirements));
  check(active.poise?.active === false && active.poise?.value === active.poise?.equipment + active.poise?.relic,
    'player Poise threshold stays an inert item plus relic receipt', JSON.stringify(active.poise));
  // WAS AN EXACT-BYTES COPY OF A MODEL-OWNED SENTENCE, AND IT HAD DRIFTED RED.
  // This asserted `=== 'No current consumer. Player Poise is not the enemy
  // Poise meter.'`; the vessel migration (2026-08-14) rewrote the model's note
  // and left this tool failing on a sentence whose home is statProjection.js.
  // A string with two homes is Law 1 clause 2, so the copy goes and the
  // PROPERTIES stay — which is what tools/player-poise-threshold.mjs, that
  // sentence's own contract, already asserts. Not my card: a one-line stale
  // copy inside a file I was already opening, and it is why the baseline here
  // could not be green. Fixed in its own commit.
  check(/display consumer only/i.test(active.poise?.note || '') && /no combat consumer/i.test(active.poise?.note || ''),
    'the no-consumer disclosure is model-owned and still discloses both halves', active.poise?.note);

  const lowStrengthReaver = { ...reaver, attributes: { ...reaver.attributes, strength: 10 } };
  const greatsword = equipmentSurfaceReceipt(R, lowStrengthReaver, {
    candidate: { slotId: 'rightHand', setIndex: 0, pieceId: 'greatsword' },
  }).candidate;
  check(greatsword?.pieceId === 'greatsword' && greatsword.requirement?.ok === false
      && greatsword.requirement.failures.some((row) => row.attributeId === 'strength'),
    'candidate comparison carries unmet requirement receipt', JSON.stringify(greatsword));
  check(greatsword?.roles.length === 3 && greatsword.roles.every((row) => Number.isFinite(row.beforeValue) && Number.isFinite(row.afterValue)),
    'candidate comparison carries before-to-after numbers for every equipment role', JSON.stringify(greatsword?.roles));
  check(greatsword?.addedEffects.some((row) => /damage|cost|poise/i.test(row.label)),
    'candidate comparison exposes explicit added effects from registered mod data', JSON.stringify(greatsword?.addedEffects));

  const herald = createRunState({ seed: 0x52, classId: 'herald', registries: R });
  const armourSlot = R.equipment.slots.find((row) => row.kinds.includes('armor'));
  const pilgrim = equipmentSurfaceReceipt(R, herald, {
    candidate: { slotId: armourSlot.id, setIndex: 0, pieceId: 'pilgrim' },
  }).candidate;
  check(pilgrim?.resourceChanges.some((row) => row.id === 'maxHp' && row.after === row.before + 4),
    'candidate comparison exposes authoritative resource before-to-after change', JSON.stringify(pilgrim?.resourceChanges));
  check(pilgrim?.poise && Number.isFinite(pilgrim.poise.before) && Number.isFinite(pilgrim.poise.after),
    'candidate comparison exposes player Poise before-to-after without activating it', JSON.stringify(pilgrim?.poise));

  // ---- ARM 1 (MR-41/MR-46): the swap-price row reads the price -------------
  //
  // The row's numbers are re-derived here from `swapCostFor()` — the same
  // function, the same inputs — and must agree exactly. That is the whole
  // claim: there is one home for what a swap costs, and this receipt reads it.
  // A row that agrees with a re-derivation of the SAME source is not a second
  // copy; it is the check standing where a second copy would have to appear.
  const COMBAT_SLOTS = (R.equipment.slots || []).filter((s) => s.swap === 'combat');
  const priceOf = (run, loadout, ruleId, slotId, setIndex) => swapCostFor(R, {
    rule: resolveSwapCostRule(R, ruleId ? { settings: { swapCostRule: ruleId } } : null),
    loadout,
    classId: run.class,
    slotId,
    setIndex,
    relicDelta: passiveSum(R, run.relics || [], 'swapCostDelta'),
  });

  // The population, and it is floored. Every shipped rule × every combat slot ×
  // a candidate that actually moves a price under at least one of them. A run
  // that priced nothing has measured nothing and must not read as a pass
  // (Vira's denominator floor; MR-48 — a population with no cell either side of
  // its own boundary cannot tell you the boundary is wrong, so BOTH a rule that
  // charges the category and one that does not are in here).
  const RULES = (R.balance.equipment.swapCostRules || []).map((r) => r.id);
  const priced = [];
  const disagreements = [];
  for (const ruleId of RULES) {
    for (const [pieceId, slotId, setIndex] of [['greatsword', 'rightHand', 1], ['dagger', 'rightHand', 1], [null, 'rightHand', 1]]) {
      const seen = equipmentSurfaceReceipt(R, reaver, {
        candidate: { slotId, setIndex, pieceId },
        meta: { settings: { swapCostRule: ruleId } },
      }).candidate;
      const after = structuredClone(reaver.loadout);
      after.sets[slotId][setIndex] = pieceId;
      after.active[slotId] = setIndex;
      for (const slot of COMBAT_SLOTS) {
        const idx = slot.id === slotId ? setIndex : Number(after.active[slot.id]) || 0;
        const b = priceOf(reaver, reaver.loadout, ruleId, slot.id, idx);
        const a = priceOf(reaver, after, ruleId, slot.id, idx);
        priced.push(`${ruleId}/${pieceId || 'bare'}/${slot.id}:${b.cost}->${a.cost}`);
        const row = (seen.resourceChanges || []).find((r) => r.id === `swapCost:${slot.id}`);
        const wanted = b.cost !== a.cost || b.gearIgnored !== a.gearIgnored;
        if (!wanted) { if (row) disagreements.push(`${ruleId}/${pieceId}/${slot.id}: row rendered for an unmoved price`); continue; }
        if (!row) { disagreements.push(`${ruleId}/${pieceId}/${slot.id}: price moved ${b.cost}->${a.cost} and NO row rendered`); continue; }
        if (row.before !== b.cost || row.after !== a.cost) {
          disagreements.push(`${ruleId}/${pieceId}/${slot.id}: row says ${row.before}->${row.after}, swapCostFor says ${b.cost}->${a.cost}`);
        }
        if (row.ruleId !== ruleId) disagreements.push(`${ruleId}/${pieceId}/${slot.id}: row priced with '${row.ruleId}'`);
      }
    }
  }
  check(priced.length >= RULES.length * COMBAT_SLOTS.length && disagreements.length === 0,
    'every swap-price row is the number `swapCostFor()` charges, under every shipped rule',
    disagreements.length ? disagreements.join(' · ') : `only ${priced.length} price(s) compared`);
  // BOTH EDGES, and the second one is the one a delta-derivation passes: at
  // least one rule must MOVE a price and at least one must leave it still.
  check(priced.some((p) => !/(\d+)->\1$/.test(p)) && priced.some((p) => /(\d+)->\1$/.test(p)),
    'the priced population holds a moved price and an unmoved one',
    priced.join(' '));
  // The whole point of the fix, stated as its own claim: a rule the row is not
  // told about cannot be the rule it prices with.
  const flatRow = equipmentSurfaceReceipt(R, reaver, {
    candidate: { slotId: 'rightHand', setIndex: 1, pieceId: 'greatsword' }, meta: { settings: { swapCostRule: 'flat' } },
  }).candidate.resourceChanges.filter((r) => r.id.startsWith('swapCost'));
  const catRow = equipmentSurfaceReceipt(R, reaver, {
    candidate: { slotId: 'rightHand', setIndex: 1, pieceId: 'greatsword' }, meta: { settings: { swapCostRule: 'category' } },
  }).candidate.resourceChanges.filter((r) => r.id.startsWith('swapCost'));
  check(flatRow.length === 0 && catRow.length === 1 && catRow[0].after === 3,
    'the live rule decides the row: `flat` shows no change for a heavy weapon, `category` shows 2 → 3',
    `${JSON.stringify(flatRow)} / ${JSON.stringify(catRow)}`);

  // THE GEAR CHANNEL'S FLOOR — this contract's own boundary, printed rather
  // than assumed. No shipped piece authors `self.swapCost` and no shipped relic
  // authors `swapCostDelta`, so every check above exercises the CATEGORY rung
  // and NONE of them exercises the gear rung on shipped content. `--selftest`
  // is where that rung is exercised, by authoring a talisman through the real
  // CSV door. Saying so is the difference between a green and a green that
  // covers what its reader assumes.
  const gearPieces = [...(R.equipment.armaments || []), ...(R.equipment.armour || [])]
    .filter((p) => (p.mods || []).some((m) => /^self\.swapCost=/.test(m))).map((p) => p.id);
  const gearRelics = contentBundle.relics.filter((r) => r.passives && Object.prototype.hasOwnProperty.call(r.passives, 'swapCostDelta')).map((r) => r.id);
  console.log(`FLOOR gear rung unexercised on shipped content — pieces authoring self.swapCost: ${gearPieces.length ? gearPieces.join(', ') : 'NONE'}`
    + ` · relics authoring swapCostDelta: ${gearRelics.length ? gearRelics.join(', ') : 'NONE'}.`
    + ' Run `--selftest` for the gear rung; the relic rung has no surface at all (tools/swap-cost-relic-surface.mjs).');
  // If content ever DOES author one, the gear rung stops being selftest-only
  // and this contract must exercise it here rather than keep printing a floor.
  if (gearPieces.length) {
    const worn = structuredClone(reaver.loadout);
    worn.sets.talisman[0] = gearPieces[0];
    const seen = equipmentSurfaceReceipt(R, reaver, {
      candidate: { slotId: 'talisman', setIndex: 0, pieceId: gearPieces[0] }, meta: { settings: { swapCostRule: 'flat' } },
    }).candidate.resourceChanges.filter((r) => r.id.startsWith('swapCost'));
    check(seen.length === COMBAT_SLOTS.length && seen.every((r) => r.before === r.after && /does not charge gear/.test(r.note || '')),
      'a gear-off rule reports the delta it DECLINED instead of showing an unmoved number',
      JSON.stringify(seen));
    const geared = equipmentSurfaceReceipt(R, reaver, {
      candidate: { slotId: 'talisman', setIndex: 0, pieceId: gearPieces[0] }, meta: { settings: { swapCostRule: 'gear' } },
    }).candidate.resourceChanges.filter((r) => r.id.startsWith('swapCost'));
    check(geared.length === COMBAT_SLOTS.length && geared.every((r) => r.after > r.before && !r.note),
      'a gear-on rule charges the authored delta and has nothing to decline', JSON.stringify(geared));
  }
}

const customize = fs.readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
const armoury = fs.readFileSync(new URL('../src/ui/screens/equipment.js', import.meta.url), 'utf8');
const receiptComponents = fs.readFileSync(new URL('../src/ui/components/equipmentReceipts.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/ui.css', import.meta.url), 'utf8');
for (const [source, label] of [[customize, 'creation'], [armoury, 'Armoury']]) {
  check(/equipmentSurfaceReceipt/.test(source), `${label} consumes the shared equipment presentation reader`);
  check(/renderEquipmentRequirements/.test(source), `${label} renders the shared requirement receipt`);
  check(/renderPlayerPoise/.test(source), `${label} renders the shared player Poise receipt`);
}
check(/role-copy-count/.test(armoury), 'Armoury renders role copy-count selectors');
check(/renderCandidateComparison/.test(armoury) && /equip-candidate-comparison/.test(receiptComponents),
  'Armoury renders the canonical candidate comparison');
check(/equip-resource-change/.test(receiptComponents) && /equip-added-effect/.test(receiptComponents),
  'Armoury renders resource and explicit-effect comparison selectors');
for (const selector of ['equipment-requirements', 'player-poise-receipt', 'equip-candidate-comparison']) {
  check(new RegExp(`\\.${selector}[^}]*overflow-wrap\\s*:\\s*anywhere`, 's').test(css),
    `${selector} wraps rather than clipping at 320/390`);
}
check(/\.equip-chip[^}]*min-height\s*:\s*var\(--tap-floor\)/s.test(css),
  'candidate touch target keeps the authored tap floor at 320/390');

// ---- ARM 1's structural half: one home, and the screen hands its rule over --
//
// COMMENTS ARE STRIPPED BEFORE MATCHING (MR-47's general answer, and this file
// needs it literally: the marker paragraph I just wrote into
// equipmentPresentation.js CONTAINS the word `swapCostDelta`, so a plain grep
// would be guarding its own footnote — the exact shape Bjorn found in Saga's
// check 9). Ceiling, stated not hidden: this strips `//` and `/* */` with a
// regex and does not parse; a `//` inside a string literal would be
// mis-stripped. It is a text match either way — what it buys is that PROSE
// ABOUT the code can no longer satisfy a check ABOUT the code.
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const presentation = codeOnly(fs.readFileSync(new URL('../src/model/equipmentPresentation.js', import.meta.url), 'utf8'));
// A MEMBER READ is the defect; the passive KEY is not. `passiveSum(registries,
// run.relics, 'swapCostDelta')` names the relic channel and hands it to
// `swapCostFor` — that is the one home being fed. `beforeMods.swapCostDelta` is
// the second home coming back, so the pattern is the dot, not the word.
check(!/\.swapCostDelta/.test(presentation),
  'the presentation reads no `.swapCostDelta` of its own — the delta is the price function\'s business',
  (presentation.match(/.*\.swapCostDelta.*/) || [''])[0].trim());
check(/swapCostFor\s*\(/.test(presentation) && /resolveSwapCostRule\s*\(/.test(presentation),
  'the presentation reads the price and the live rule from their one home');
const armouryCode = codeOnly(armoury);
const call = (armouryCode.match(/equipmentSurfaceReceipt\(registries, run, \{[\s\S]{0,400}?\}\)/) || [''])[0];
check(/\bmeta\b/.test(call),
  'the Armoury hands its live settings to the receipt, so the row is priced with the rule the player chose',
  call.replace(/\s+/g, ' ').slice(0, 160) || 'no candidate call found');

console.log(`\nequipment surface receipts: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
