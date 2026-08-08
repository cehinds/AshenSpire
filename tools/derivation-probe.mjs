// derivation-probe.mjs — Bjorn, 2026-08-08, for Marina's charge on #106:
// "can anything see a copy that EXISTS, not only one that diverges?"
//
// THE ANSWER IS NOT A TEST. No assertion over a function's inputs and outputs
// can see a faithful copy — that is a theorem, not a gap in Vira's suite: a copy
// that agrees is behaviourally identical, and a test only ever reads behaviour.
//
// What a copy IS, structurally: a consumer whose answer is computed from the raw
// data rather than derived from the single home. So the discriminator is not
// "what does the consumer answer" but "does the consumer MOVE WHEN ITS SOURCE
// MOVES." Break the single home; every consumer that genuinely asks it breaks
// with it. A consumer that keeps answering correctly under a broken source has
// its own copy of the rule — and it does not have to diverge to be seen.
//
// GENERATIVE, NOT A BLACKLIST. This types no token of the rule: not `swap`, not
// 'combat', not the comparison. It types two NAMES — the single home and the
// consumer — which is the derivation edge the design already claims in prose
// ("Two questions, one home, no second copy", loadout.js:~868). It checks the
// claim, not the spelling.
//
// USAGE: node derivation-probe.mjs <worktree>
// EXIT 0 clean · 1 a copy was seen · 2 the probe could not answer (see below).

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node derivation-probe.mjs <worktree>'); process.exit(2); }

const SRC = join(ROOT, 'src/model/loadout.js');
const MUT = join(ROOT, 'src/model/__bjorn_mutant.js');   // beside the original, so './validate.js' still resolves

// --- the two names the author must type, and the only two -------------------
const HOME = 'canSwap';        // the single home of the rule
const CONSUMER = 'cycleSet';   // the function that CLAIMS to ask it

// --- the mutation: make the single home lie, without touching any consumer ---
// Inverting `ok` rather than pinning it to one value: a pinned mutant can be
// absorbed by a consumer that happens to short-circuit the same way, and an
// inversion moves EVERY cell, which is what makes the control below meaningful.
function mutate(text) {
  const sig = `export function ${HOME}(`;
  const at = text.indexOf(sig);
  if (at < 0) return null;
  const open = text.indexOf('{', text.indexOf(')', at));
  // find the matching close brace of the function body
  let depth = 0, end = -1;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) return null;
  const body = text.slice(open, end + 1);
  const renamed = `export function ${HOME}__true(${text.slice(text.indexOf('(', at) + 1, text.indexOf(')', at))}) ${body}`;
  const shim = `\nexport function ${HOME}(...a) { const r = ${HOME}__true(...a); return { ...r, ok: !r.ok }; }\n`;
  return text.slice(0, at) + renamed + shim + text.slice(end + 1);
}

function sweep(modUrl) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { createRegistries } from ${JSON.stringify(join(ROOT, 'src/model/registries.js'))};
    import { contentBundle } from ${JSON.stringify(join(ROOT, 'src/content/index.js'))};
    import { createLoadout, ${CONSUMER}, ${HOME} } from ${JSON.stringify(modUrl)};
    const REG = createRegistries(contentBundle);
    const slots = REG.equipment.slots;
    const rows = [];
    const hush = console.error; console.error = () => {};
    for (const s of slots) for (const inCombat of [false, true]) {
      const lo = createLoadout(REG, 'reaver');
      rows.push([s.id, inCombat, ${CONSUMER}(REG, lo, s.id, 0, { meta: {}, inCombat }), ${HOME}(REG, s.id, { inCombat }).ok].join('|'));
    }
    console.error = hush;
    process.stdout.write(rows.join('\\n'));
  `], { encoding: 'utf8' });
}

const original = readFileSync(SRC, 'utf8');
const mutantText = mutate(original);
if (!mutantText) { console.error('UNTESTABLE — could not locate the single home in the source.'); process.exit(2); }
writeFileSync(MUT, mutantText);

let before, after;
try {
  before = sweep(SRC).trim().split('\n').map((r) => r.split('|'));
  after = sweep(MUT).trim().split('\n').map((r) => r.split('|'));
} finally { if (existsSync(MUT)) unlinkSync(MUT); }

// --- CONTROL FIRST. A check that edits something must prove the edit landed. --
// (My own #88 lesson: `String.replace` succeeds loudly at doing nothing.) If the
// mutation moved no cell of the SINGLE HOME's own answer, the probe has ruled on
// nothing and must say so rather than print green.
const homeMoved = before.filter((r, i) => r[3] !== after[i][3]).length;
if (homeMoved === 0) {
  console.error(`UNTESTABLE — the mutation moved 0 of ${before.length} cells of ${HOME}'s own answer.`);
  console.error('The probe edited the source and the source did not notice. Nothing is proven.');
  process.exit(2);
}

// --- THE FINDING -------------------------------------------------------------
// A cell where the home moved and the consumer did NOT is a cell the consumer
// answers from its own copy of the rule.
const stuck = [];
for (let i = 0; i < before.length; i += 1) {
  const [slot, inCombat, cBefore, hBefore] = before[i];
  const [, , cAfter, hAfter] = after[i];
  if (hBefore !== hAfter && cBefore === cAfter) stuck.push(`${slot} @ inCombat=${inCombat}`);
}

console.log(`DERIVATION PROBE — does ${CONSUMER} move when ${HOME} moves?`);
console.log(`  cells swept          ${before.length}  (every slot × both edges of the fight)`);
console.log(`  ${HOME} cells moved   ${homeMoved}   <- the control: the mutation landed`);
console.log(`  ${CONSUMER} cells stuck ${stuck.length}`);
console.log('');
console.log('BOUNDARY. This sees a copy only on the ONE derivation edge named above.');
console.log('It cannot discover an edge nobody declared, and it is silent about the');
console.log(`PRICE: swapCost is charged outside ${CONSUMER}, so a direct caller still`);
console.log('moves a combat slot for 0 Energy. That is a different act, not this probe.');
if (stuck.length) {
  console.log('');
  console.log(`A SECOND COPY EXISTS. ${CONSUMER} kept its answer while ${HOME} lied, at:`);
  for (const c of stuck) console.log(`  · ${c}`);
  process.exit(1);
}
console.log('');
console.log(`CLEAN — ${CONSUMER} follows ${HOME} on every cell that moved.`);
