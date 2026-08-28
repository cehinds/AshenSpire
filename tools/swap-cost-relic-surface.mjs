#!/usr/bin/env node
// tools/swap-cost-relic-surface.mjs — ARM 2 of MR-41 (as amended by MR-46):
// the STARTING-RELIC half of A8 has no presentation anywhere, and this is its
// wake.
//
// ---------------------------------------------------------------------------
// WHAT IS MISSING, AND WHY IT IS NOT THE ARMOURY ROW'S JOB
// ---------------------------------------------------------------------------
//
// Constantine, D15/A8: *"switching sets should cost actions. perhaps this
// action costs more or less depending on Talisman OR STARTING RELIC … that way
// I can try each."* Two channels. `swapCostFor()` honours both — it sums a WORN
// delta from `runMods()` and a RELIC delta from `passiveSum()`, sourced in two
// different modules — and the engine charges the total.
//
// The talisman channel now has a surface: the Armoury's comparison prices each
// combat-swappable slot from `swapCostFor()` before and after (MR-41 arm 1,
// tools/equipment-surface-receipts.mjs). THE RELIC CHANNEL HAS NONE, and arm 1
// did not give it one — it cannot. A relic does not change when you slot a
// weapon, so its delta lands identically in `before` and `after` and CANCELS in
// any comparison. That is correct arithmetic, not a bug in the row.
//
// So: author a relic passive tomorrow and the price a player pays changes while
// NOTHING ON ANY SCREEN MOVES. It does not lie. It says nothing — and its
// correct state and its expired state print the same nothing, which is
// precisely the class *The wake condition* (commons/development.md, Freja,
// 2026-08-14) exists for. Absence never fails a test written to expect absence,
// so this file does not test the absence. It tests THE PREMISE.
//
// ---------------------------------------------------------------------------
// THE WAKE CONDITION, AS AN OBSERVABLE PREDICATE
// ---------------------------------------------------------------------------
//
//   PREMISE   — read off REAL shipped content:
//               no relic row authors a `swapCostDelta` passive.
//               It HOLDS while that set is empty; it DIES the day it is not.
//
//   SURFACE   — read BEHAVIOURALLY off the real presentation readers, never by
//               grepping for a word: give one relic a `swapCostDelta` and ask
//               whether any shipped read model's output MOVES. Plus a census of
//               `src/ui/**` for a direct consult of `swapCostFor(` or the
//               `swapCostDelta` passive key, comment-stripped, so a reader I
//               failed to enumerate is not silently missed.
//
//   MARKER    — the paragraph in src/model/equipmentPresentation.js that states
//               this gap, its reason and its discharge condition (MR-45: a
//               structural decision leaves a marker, AND THE MARKER HAS TO BE
//               TRUE OR IT IS AN INVITATION).
//
//   RED, both ways:
//     · WAKE RED   — premise DEAD and no surface. A relic is charging a price
//                    no screen reports. Named relic, named channel.
//     · MARKER RED — a surface EXISTS while the marker still says none does.
//                    The marker has become the false sentence MR-45 is about.
//
// A relic authoring `swapCostDelta` is not a defect. Authoring one while
// nothing shows it is. This file's whole job is to make sure the day those two
// come apart is a day the suite goes red, and not a day six months later when
// somebody counts by hand.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the relic channel gets
// a real surface and the marker comes out with it. There is nothing left to
// watch once the premise cannot die quietly.
//
//   node tools/swap-cost-relic-surface.mjs             the wake
//   node tools/swap-cost-relic-surface.mjs --selftest  the same-door corpus

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// THE SAME-DOOR CORPUS
// ---------------------------------------------------------------------------
//
// Relics are authored in `src/content/relics.js` — there is no relics CSV, so
// that FILE is the door a real relic enters by, and a plant of its bytes in a
// copied tree travels the whole import graph exactly as a real row would. The
// surface plants enter at the source files a real surface would be written in.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'swap-cost-relic-surface.mjs',
    plants: [
      {
        // THE PREMISE DYING, through the door a relic actually enters by.
        name: 'WAKE: a relic authors swapCostDelta while nothing on any screen reports it',
        file: 'src/content/relics.js',
        find: "    passives: { poiseThresholdAdd: 2 },",
        replace: "    passives: { poiseThresholdAdd: 2, swapCostDelta: 1 },",
        expectRed: /FAIL\s+WAKE RED.*THE PREMISE DIED AND THE RELIC CHANNEL STILL HAS NO SURFACE/,
      },
      {
        // THE MARKER GOING FALSE, limb 1: a read model starts moving.
        name: 'MARKER: a presentation reader starts reporting the relic channel while the marker denies it',
        file: 'src/model/equipmentPresentation.js',
        find: '    if (before.cost === after.cost && declined === 0) continue;',
        replace: '    if (relicDelta) rows.push({ id: `relicSwap:${slot.id}`, label: `${slot.label} relic swap Actions`,'
          + ' before: relicDelta, after: relicDelta, ruleId: after.ruleId, note: \'\' });\n'
          + '    if (before.cost === after.cost && declined === 0) continue;',
        expectRed: /FAIL\s+MARKER RED.*A SURFACE EXISTS AND THE MARKER STILL DENIES IT/,
      },
      {
        // THE MARKER GOING FALSE, limb 2: a screen consults the price directly,
        // which the behavioural probe over the enumerated read models would
        // never see. Two limbs, two plants — a predicate whose halves are never
        // both exercised is one half of a predicate.
        name: 'MARKER: a screen consults swapCostFor() directly while the marker denies any surface',
        file: 'src/ui/screens/equipment.js',
        append: "export const plantedSwapReadout = (registries, o) => swapCostFor(registries, o).cost;",
        expectRed: /FAIL\s+MARKER RED.*A SURFACE EXISTS AND THE MARKER STILL DENIES IT/,
      },
    ],
  }));
}

const { contentBundle } = await import('../src/content/index.js');
const { createRegistries } = await import('../src/model/registries.js');
const { createRunState } = await import('../src/model/state.js');
const { equipmentSurfaceReceipt } = await import('../src/model/equipmentPresentation.js');
const { statProjection, playerPoiseThresholdReceipt } = await import('../src/model/statProjection.js');
const { creationBrief } = await import('../src/model/creationBrief.js');
const { equipmentKitReceipt } = await import('../src/model/loadout.js');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let checks = 0;
let failures = 0;
function check(name, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name} — ${error && error.message ? error.message : error}`);
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };

console.log('swap-cost-relic-surface — the A8 relic channel and its wake\n');

// ---------------------------------------------------------------------------
// PREMISE — real shipped content, no mutation
// ---------------------------------------------------------------------------
const authoringRelics = contentBundle.relics
  .filter((row) => row.passives && Object.prototype.hasOwnProperty.call(row.passives, 'swapCostDelta'))
  .map((row) => `${row.id}(${row.passives.swapCostDelta})`);
const premiseHolds = authoringRelics.length === 0;

// ---------------------------------------------------------------------------
// SURFACE, limb 1 — behavioural, over every read model a screen consumes
// ---------------------------------------------------------------------------
//
// The probe gives ONE relic a `swapCostDelta` and nothing else, builds the same
// run against both bundles, and diffs each reader's output. A reader that moves
// is reporting the channel; a reader that does not, is not. No string is
// matched, so no comment, label or doc-block can satisfy this.
//
// WHICH RELIC: the class's own STARTING relic, because "starting relic" is the
// half of A8 with no surface and the run already carries it.
function bundleWithRelicDelta(relicId, value) {
  return {
    ...contentBundle,
    relics: contentBundle.relics.map((row) => (row.id === relicId
      ? { ...row, passives: { ...(row.passives || {}), swapCostDelta: value } }
      : row)),
  };
}

// The enumerated readers. A future read model that is not in this list reads as
// NO SURFACE, loudly, which is the right way round — it is why limb 2 exists.
const READERS = [
  ['equipmentSurfaceReceipt (active)', (reg, run) => equipmentSurfaceReceipt(reg, run)],
  ['equipmentSurfaceReceipt (candidate, flat)', (reg, run) => equipmentSurfaceReceipt(reg, run, {
    candidate: { slotId: 'rightHand', setIndex: 1, pieceId: 'greatsword' }, meta: { settings: { swapCostRule: 'flat' } },
  })],
  ['equipmentSurfaceReceipt (candidate, gear)', (reg, run) => equipmentSurfaceReceipt(reg, run, {
    candidate: { slotId: 'rightHand', setIndex: 1, pieceId: 'greatsword' }, meta: { settings: { swapCostRule: 'gear' } },
  })],
  ['statProjection', (reg, run) => statProjection(reg, run)],
  ['playerPoiseThresholdReceipt', (reg, run) => playerPoiseThresholdReceipt(reg, run)],
  ['creationBrief', (reg, run) => creationBrief(reg, run)],
  ['equipmentKitReceipt', (reg, run) => equipmentKitReceipt(reg, run.loadout, run.class, run.attributes, run.equipmentProfileRuleSnapshot)],
];

function readersThatMove() {
  const plain = createRegistries(contentBundle);
  const classId = 'reaver';
  const relicId = plain.classes.get(classId).startingRelic;
  const withDelta = createRegistries(bundleWithRelicDelta(relicId, 3));
  const moved = [];
  for (const [label, read] of READERS) {
    const a = createRunState({ seed: 0xA8, classId, registries: plain });
    const b = createRunState({ seed: 0xA8, classId, registries: withDelta });
    let left = null;
    let right = null;
    try { left = JSON.stringify(read(plain, a)); } catch (error) { left = `threw:${error.message}`; }
    try { right = JSON.stringify(read(withDelta, b)); } catch (error) { right = `threw:${error.message}`; }
    if (left !== right) moved.push(label);
  }
  return { relicId, moved };
}

// ---------------------------------------------------------------------------
// SURFACE, limb 2 — does any screen consult the price at all
// ---------------------------------------------------------------------------
//
// COMMENTS ARE STRIPPED BEFORE MATCHING (MR-47: a check that matches text
// cannot tell code from commentary about code, and this very file's marker
// paragraph names both tokens). Ceiling, stated: regex stripping, not parsing.
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.js')) out.push(full);
  }
  return out;
}
function screensThatConsult() {
  return walk(resolve(ROOT, 'src/ui'))
    .filter((file) => /swapCostFor\s*\(|['"`]swapCostDelta['"`]/.test(codeOnly(readFileSync(file, 'utf8'))))
    .map((file) => relative(ROOT, file));
}

// ---------------------------------------------------------------------------
// MARKER — the artifact whose truth this file exists to keep
// ---------------------------------------------------------------------------
const MARKER_HOME = 'src/model/equipmentPresentation.js';
const MARKER_SENTENCE = 'THE RELIC CHANNEL HAS NO SURFACE HERE';
const markerSource = readFileSync(resolve(ROOT, MARKER_HOME), 'utf8');
const markerStands = markerSource.includes(MARKER_SENTENCE);

// ---------------------------------------------------------------------------
// THE VERDICT, AND ITS FOUR CELLS
// ---------------------------------------------------------------------------
//
// Three of these four are planted through the real door by `--selftest`. The
// fourth — premise dead AND a surface present — is the day this file is
// DELETED, and it is not plantable as a red because it is correct. It is
// checked here on the verdict function alone, and that limitation is named
// rather than smoothed: a green in that cell is arithmetic, not an observation.
function verdict({ premiseDead, surface }) {
  if (premiseDead && !surface) return 'WAKE';
  if (!premiseDead && surface) return 'MARKER';
  return 'OK';
}

check('the verdict has a cell on both sides of both boundaries (MR-48)', () => {
  const table = [
    [{ premiseDead: false, surface: false }, 'OK'],
    [{ premiseDead: true, surface: false }, 'WAKE'],
    [{ premiseDead: false, surface: true }, 'MARKER'],
    [{ premiseDead: true, surface: true }, 'OK'],
  ];
  for (const [cell, want] of table) {
    assert(verdict(cell) === want, `${JSON.stringify(cell)} → ${verdict(cell)}, wanted ${want}`);
  }
  return '4/4 cells, and the fourth (dead premise + a real surface) is this file\'s removal condition';
});

const { relicId, moved } = readersThatMove();
const consulting = screensThatConsult();
const surface = moved.length > 0 || consulting.length > 0;

check('the surface probe examined a real population, floored', () => {
  assert(READERS.length >= 5, `only ${READERS.length} read models probed`);
  const files = walk(resolve(ROOT, 'src/ui')).length;
  assert(files >= 20, `only ${files} UI files scanned — the census measured almost nothing`);
  return `${READERS.length} read models against relic '${relicId}' · ${files} UI files scanned`;
});

check('PREMISE — no shipped relic authors a swapCostDelta passive', () => {
  assert(premiseHolds, `the premise is DEAD: ${authoringRelics.join(', ')}. This is not itself a failure —`
    + ' the WAKE below is the check that decides whether it matters.');
  return 'the relic channel of A8 is unauthored; nothing is being charged unreported today';
});

check('the marker states the gap, its reason and its discharge condition (MR-45)', () => {
  assert(markerStands, `${MARKER_HOME} no longer carries "${MARKER_SENTENCE}" — a structural keep with no marker`
    + ' is a keep the next reader deletes as tidying');
  assert(/discharge/i.test(markerSource) && markerSource.includes('swap-cost-relic-surface'),
    'the marker names no discharge condition or does not point at this check — a marker without either is decoration');
  return `${MARKER_HOME}`;
});

// TWO REDS, TWO CHECKS, and they are not the same claim — the first says a
// price is being charged unreported, the second says a sentence has gone false.
// One check carrying both would print one name over either finding, which is
// how a red stops telling you what to do about it.
const premiseDead = !premiseHolds;

check('WAKE RED — the premise is probed, not the absence', () => {
  assert(verdict({ premiseDead, surface }) !== 'WAKE',
    `THE PREMISE DIED AND THE RELIC CHANNEL STILL HAS NO SURFACE — relic(s) ${authoringRelics.join(', ')} author `
    + '`swapCostDelta`, so `swapCostFor()` charges a price that changed, and NO shipped read model moves and NO '
    + 'screen consults it. A player is paying a relic\'s price with nothing on any screen to see. Give the channel '
    + `a surface and delete ${MARKER_HOME}'s marker and this file, or retire the relic passive.`);
  return premiseDead
    ? `premise dead (${authoringRelics.join(', ')}) and a surface reports it — this file's removal condition is met`
    : 'premise alive (0 relics author swapCostDelta) — nothing is being charged unreported';
});

check('MARKER RED — the marker is only as good as its truth (MR-45)', () => {
  assert(verdict({ premiseDead, surface }) !== 'MARKER',
    `A SURFACE EXISTS AND THE MARKER STILL DENIES IT — ${[...moved, ...consulting].join(', ')} now report(s) the relic `
    + `channel while ${MARKER_HOME} still says "${MARKER_SENTENCE}". A false marker is not a harmless overstatement; `
    + 'it is an argument for deleting the thing it protects, handed to the next careful reader. Delete the marker '
    + 'and this file.');
  return surface
    ? `${[...moved, ...consulting].join(', ')} reports the channel and the premise is dead — discharged`
    : 'no reader moves, no screen consults — the marker still says something true';
});

console.log(`\n${failures ? `RELIC SURFACE RED — ${failures}/${checks} failing` : `RELIC SURFACE GREEN — ${checks}/${checks}`}`);
console.log('DOOR: the premise is read from the real content bundle by import; the surface is read');
console.log('      BEHAVIOURALLY — seven shipped read models run twice against two real registries,');
console.log('      outputs diffed — plus a comment-stripped census of every src/ui/**.js file.');
console.log('      `--selftest` re-observes three known-bads planted as bytes in a copy of the real');
console.log('      tree: the relic passive enters at src/content/relics.js, which IS the door a relic');
console.log('      enters by (relics have no CSV), and each surface limb enters at a source file a');
console.log('      real surface would be written in.');
console.log('\nBOUNDARY — what a green here does NOT mean:');
console.log('  · NOTHING HERE RENDERS A PIXEL. "A surface exists" means a read model\'s output moves or');
console.log('    a screen file consults the price. Whether a player can SEE it, read it, or reach it on');
console.log('    a phone is not this tool\'s claim and no shot was taken.');
console.log(`  · THE READER LIST IS ENUMERATED (${READERS.length}). A future read model outside it reads as`);
console.log('    no-surface, loudly — the UI census is the second limb precisely because of that.');
console.log('  · THE FOURTH CELL IS ARITHMETIC, NOT AN OBSERVATION. Premise dead + surface present is');
console.log('    checked on the verdict function; it is not planted, because it is the correct state and');
console.log('    the day it happens this file is deleted rather than kept green.');
console.log('  · IT SAYS NOTHING ABOUT THE TALISMAN CHANNEL. That is arm 1 and it has its own contract:');
console.log('    node tools/equipment-surface-receipts.mjs [--selftest].');
console.log('  · IT SAYS NOTHING ABOUT WHETHER 2 ACTIONS IS THE RIGHT PRICE.');
if (failures) process.exit(1);
