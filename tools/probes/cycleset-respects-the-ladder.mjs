#!/usr/bin/env node
// tools/probes/cycleset-respects-the-ladder.mjs — Vira, 2026-08-08, gating
// viki/inventory-and-ladder @ c43c908.
//
// A FALSIFIER, not a fix. I own no line of src/model/loadout.js and I am not
// going to sweep someone else's file at the end of a gate. Whoever fixes it
// deletes this file in the same act, because a property that lives beside the
// code that satisfies it is the second copy.
//
// THE PROPERTY, in one line:
//   a set index the player may ACTIVATE must be one openedSets() calls open.
//
// WHY IT IS THE SAME DEFECT #90 EXISTS TO KILL. `equipPiece()` carried a comment
// saying "the gate is HERE, on the mutation, and not in the screen." Viki proved
// that sentence was about fitsSlot and was never true of ownership — the only
// thing stopping a player from equipping an unfound greatsword at 77a02b9 was
// the picker declining to attach a click handler. She then made it true: `owned`
// is a required sixth argument and a stale call site fails closed.
//
// `cycleSet()` is three functions below it, in the same file, in the same
// commit, and it is still the pre-#90 shape: it bounds on `ids.length` — the
// raw array — and never consults `openedSets()`, which ships directly above it
// and already knows the answer. The ladder's gate is in the screen. That is the
// sentence #90 spent a commit disproving.
//
// Usage:  node tools/probes/cycleset-respects-the-ladder.mjs
// Exit:   0 the property holds · 1 it does not · 2 the probe could not run
//
// BOTH EDGES, and the second one is why this is not "just add a bound":
//   OVER-TIGHT is a real failure and it is the one openedSets() was written for.
//   A save from before today has `sets` full-width with pieces already in set 3
//   and zero rungs earned. openedSets() raises the floor to what the loadout is
//   already holding, on purpose — so the correct bound is openedSets(), NEVER
//   `1 + rungs earned`. A fix that strands a legacy player's weapon behind a
//   lock that did not exist when they put it there is worse than the defect.

import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { createLoadout, cycleSet, openedSets } from '../../src/model/loadout.js';

let REG;
try {
  REG = createRegistries(contentBundle);
} catch (e) {
  console.log(`RESULT: the probe could not build registries — ${e && e.message}. Nothing below was measured.`);
  process.exit(2);
}

const slots = (REG.equipment || {}).slots || [];
if (!slots.length) {
  console.log('RESULT: ZERO equipment slots. An empty denominator is not a game with no slots — it is content this probe could not read.');
  process.exit(2);
}

const findings = [];
let checked = 0;

console.log('cycleset-respects-the-ladder — may a player activate a set the ladder has not opened?\n');

console.log('  EDGE 1 — fresh profile, zero rungs earned, nothing in storage');
for (const slot of slots) {
  const meta = { unlocked: [] };
  const loadout = createLoadout(REG, 'reaver');
  const width = ((loadout.sets || {})[slot.id] || []).length;
  if (!width) continue;
  const open = openedSets(REG, slot, { meta, loadout });
  for (let i = 0; i < width; i++) {
    const probe = createLoadout(REG, 'reaver');
    const accepted = cycleSet(probe, slot.id, i);
    checked++;
    const shouldAccept = i < open;
    if (accepted !== shouldAccept) {
      findings.push({
        slot: slot.id, index: i, open, width, accepted,
        why: accepted
          ? `cycleSet accepted set ${i} while openedSets() says only ${open} of ${width} are open`
          : `cycleSet REFUSED set ${i} while openedSets() says ${open} are open — over-tight, the legacy edge`,
      });
    }
  }
  console.log(`    ${slot.id.padEnd(12)} width ${width} · openedSets ${open} · cycleSet accepts ${
    [...Array(width).keys()].filter((i) => cycleSet(createLoadout(REG, 'reaver'), slot.id, i)).length}`);
}

console.log('\n  EDGE 2 — legacy save: zero rungs earned, a piece already held in the LAST set');
for (const slot of slots) {
  const meta = { unlocked: [] };
  const loadout = createLoadout(REG, 'reaver');
  const ids = (loadout.sets || {})[slot.id];
  if (!ids || ids.length < 2) continue;
  const eq = REG.equipment || {};
  const pool = slot.kinds.includes('armor') ? (eq.armour || []) : (eq.armaments || []);
  const piece = pool[0];
  if (!piece) continue;
  ids[ids.length - 1] = piece.id;
  const open = openedSets(REG, slot, { meta, loadout });
  const last = ids.length - 1;
  const accepted = cycleSet(loadout, slot.id, last);
  checked++;
  if (open <= last) {
    findings.push({
      slot: slot.id, index: last, open, width: ids.length, accepted,
      why: `openedSets() did NOT raise its floor to a piece already held in set ${last} — that piece is stranded behind a lock that did not exist when it was put there`,
    });
  } else if (!accepted) {
    findings.push({
      slot: slot.id, index: last, open, width: ids.length, accepted,
      why: `openedSets() opened ${open} sets for a held piece but cycleSet refused set ${last} — the two disagree in the direction that strands a save`,
    });
  }
  console.log(`    ${slot.id.padEnd(12)} holding "${piece.id}" in set ${last} · openedSets ${open} · cycleSet(${last}) → ${accepted}`);
}

console.log('');
if (findings.length) {
  console.log(`FINDINGS — ${findings.length} of ${checked} checked:`);
  for (const f of findings) console.log(`  ${f.slot} set ${f.index} — ${f.why}`);
  console.log('');
  console.log('BOUNDARY — what this probe did NOT establish');
  console.log('  · Nothing here opened a browser. Whether the SCREEN offers the cell is a');
  console.log('    different question, and it is the one that made this invisible: the screen');
  console.log('    is currently the only thing enforcing the ladder, which is exactly the');
  console.log('    arrangement #90 proved cannot be trusted for ownership.');
  console.log('  · This probe does not say the defect is REACHABLE by a player today. It says');
  console.log('    the model permits it, and that the model is where #90 decided gates live.');
}
console.log(`RESULT: ${findings.length ? `${findings.length} finding(s)` : 'the property holds'} across ${checked} (slot, index) pairs at this ref.`);
process.exit(findings.length ? 1 : 0);
