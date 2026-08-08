#!/usr/bin/env node
// tools/closedsets.mjs — Viki, 2026-08-08.
//
// ONE QUESTION: does an exported closed set have a READER other than its own
// declaration? A vocabulary nothing reads is decoration — and decoration is
// worse than nothing, because it is what an author will edit INSTEAD of the
// thing that actually enforces the rule.
//
// ITS FIRST RUN, against dev cd3da94, before a line of this branch's collapse:
// 65 sets, SIX of them read by nothing — five more than the one I was looking
// for. That is the whole argument for a derived population over a list a person
// remembers to keep:
//
//   PASSIVE_KEYS      no reader in the tree; the relic schema re-typed the same
//                     seven names by hand and did the refusing (#131 collapses it)
//   MODIFIER_KEYS     imported into validate.js and used for NOTHING, while
//                     modifiersSchema re-typed the same nine names
//   PILES / PILE_POSITIONS
//                     no reader; validate.js:807 and :811 re-typed both as
//                     inline literals
//   ALL_MODS          no reader at all — a union nobody ever wanted
//   M1_GAUNTLET       the M1 acceptance walk, re-exported through the content
//                     barrel and consumed by nothing since M2
//
//   $ node tools/closedsets.mjs          # at cd3da94
//   RESULT: 65 exported closed set(s) over 103 source file(s); … 6 with no reader.
//   exit 1
//
// Marina asked for the general form of that finding, so this is it: the
// population is derived from the tree (never a list I type here), the floor is
// that an empty population is a FINDING and not a pass, and the failing case has
// been observed — `--selftest`.
//
// WHAT A READER IS, precisely, because the definition is the whole check:
//   · a mention of the name in EXECUTABLE CODE — comments and string literals
//     are blanked before scanning. `// SPEC PASSIVE_KEYS` in a comment is how
//     that set looked alive for a month.
//   · at any site other than the declaration itself, in src/, tools/ or tests/.
//   · AN IMPORT IS NOT A READER. A name inside `import { … }` / `export { … }`
//     specifiers is ceremony; MODIFIER_KEYS had exactly one such line and
//     nothing else, which is a dead import wearing a vocabulary's clothes.
//
// WHAT THIS DOES NOT ASK, and the boundary is printed in its own output: it
// cannot see whether a SECOND, hand-typed copy of a set exists somewhere. Green
// here means "every closed set is read by something", never "no set is
// duplicated". Finding the duplicate is still a person's job — this only kills
// the half where the duplicate is the only thing that works.
//
// Run:  node tools/closedsets.mjs             the tree — exit 1 on findings
//       node tools/closedsets.mjs --selftest  the corpus — exit 1 if a plant survives
//       node tools/closedsets.mjs --json      the table, machine-readable
// Exit 2 = the check had nothing to rule on (SOP 2's ⚙ clause).

import { readFileSync, readdirSync, existsSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const READER_DIRS = ['src', 'tools', 'tests'];
// THIS FILE IS NOT A READER, and the exclusion is one line so it can be argued
// with. Its known-bad corpus below names PILES, PASSIVE_KEYS and MODIFIER_KEYS
// in regex literals — code, not comments — so without this the check counts its
// own plants as usage and every plant survives. Observed: recall 4/7 until this
// existed. Excluded BY NAME, printed in the output, and it is the only exclusion.
const NOT_A_READER = 'tools/closedsets.mjs';
const POPULATION_DIRS = ['src']; // the SHIPPED vocabulary; a tool's own set is its own business

// An exported closed set: `export const SCREAMING_SNAKE =` followed by an array
// literal or ANY Object.freeze(…). Three shapes are in the tree and all three
// are vocabularies — a bare array (freezing is hardening, not what makes a set
// closed), a frozen array, and a frozen name→type MAP, which is what a set
// becomes the moment its schema is derived from it (MODIFIER_TYPES here,
// PASSIVE_TYPES on #131).
//
// THE WIDTH IS DELIBERATE AND IT IS THE SECOND DEFECT THIS CHECK CAN HAVE. The
// first version matched only array literals, so the instant MODIFIER_KEYS became
// `Object.freeze(Object.keys(MODIFIER_TYPES))` it left the POPULATION — the
// check went quiet about a set by way of the fix improving it. A population that
// shrinks when the tree changes shape is the silence this house keeps finding,
// so the count is printed on every run and a shape nobody matched is a finding
// to raise here, not a row to lose.
const DECL = /^export const ([A-Z][A-Z0-9_]*)\s*=\s*(?:Object\.freeze\(|\[)/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Blank comments and string/template literals, preserving line structure, so a
// name that appears only in prose or only inside a quoted string is not counted
// as a reader. Line numbers survive; columns do not, and nothing here needs them.
export function blankNonCode(src) {
  let out = '';
  let i = 0;
  let mode = null; // '//' | '/*' | quote char
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === null) {
      if (c === '/' && d === '/') { mode = '//'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { mode = '/*'; out += '  '; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { mode = c; out += ' '; i += 1; continue; }
      out += c; i += 1; continue;
    }
    if (mode === '//') { if (c === '\n') { mode = null; out += '\n'; } else out += ' '; i += 1; continue; }
    if (mode === '/*') {
      if (c === '*' && d === '/') { mode = null; out += '  '; i += 2; } else { out += c === '\n' ? '\n' : ' '; i += 1; }
      continue;
    }
    if (c === '\\') { out += '  '; i += 2; continue; }
    if (c === mode) { mode = null; out += ' '; i += 1; continue; }
    out += c === '\n' ? '\n' : ' ';
    i += 1;
  }
  return out;
}

// True for a line that only LISTS the name in an import/export clause. Kept
// deliberately generous: a one-name specifier line (`  MODIFIER_KEYS,`) inside a
// multi-line import is the common shape, so a bare `NAME,` / `NAME }` line
// counts as ceremony too.
function isSpecifierLine(line, name) {
  const t = line.trim();
  if (/^(import|export)\b/.test(t) && /[{}]/.test(t)) return true;
  return new RegExp(`^${name}\\s*(,|\\}.*)?$`).test(t);
}

/**
 * collect(root) → { files, sets: [{ name, file, line, readers: [ 'path:line' ] }] }
 * Reads from DISK under `root`. The selftest plants into a copied tree and calls
 * this exact function on it, so a known-bad enters by the same door the real
 * input does — nothing is injected as a string.
 */
export function collect(root) {
  const popFiles = POPULATION_DIRS.flatMap((d) => walk(join(root, d)));
  const readFiles = READER_DIRS.flatMap((d) => walk(join(root, d)))
    .filter((f) => relative(root, f).split(/[\\/]/).join('/') !== NOT_A_READER);
  const blanked = new Map();
  const linesOf = (f) => {
    if (!blanked.has(f)) blanked.set(f, blankNonCode(readFileSync(f, 'utf8')).split('\n'));
    return blanked.get(f);
  };

  const sets = [];
  for (const f of popFiles) {
    linesOf(f).forEach((l, i) => {
      const m = DECL.exec(l);
      if (m) sets.push({ name: m[1], file: relative(root, f), line: i + 1, readers: [] });
    });
  }
  for (const s of sets) {
    const word = new RegExp(`\\b${s.name}\\b`);
    for (const f of readFiles) {
      const rel = relative(root, f);
      linesOf(f).forEach((l, i) => {
        if (!word.test(l)) return;
        if (rel === s.file && i + 1 === s.line) return;   // the declaration itself
        if (isSpecifierLine(l, s.name)) return;           // ceremony, not a use
        s.readers.push(`${rel}:${i + 1}`);
      });
    }
  }
  return { files: readFiles.length, popFiles: popFiles.length, sets };
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);

function report(root, { quiet = false } = {}) {
  const { files, popFiles, sets } = collect(root);

  // FLOORS — an empty result set is never a pass (Vira's floor, SOP 2's ⚙).
  if (!files || !popFiles) {
    console.log(`closedsets: nothing to read under ${root} (${popFiles} population file(s), ${files} reader file(s)) — this is a FINDING, not a pass.`);
    return { code: 2, sets };
  }
  if (!sets.length) {
    console.log(`closedsets: 0 exported closed sets found in ${POPULATION_DIRS.join(', ')}/ across ${popFiles} file(s) — either the tree changed shape or this check has stopped matching. A check with nothing to rule on is unknown, not green.`);
    return { code: 2, sets };
  }

  const orphans = sets.filter((s) => !s.readers.length);
  if (!quiet) {
    console.log(`${pad('SET', 24)} ${pad('READERS', 8)} DECLARED AT`);
    for (const s of sets.slice().sort((a, b) => a.readers.length - b.readers.length || (a.name < b.name ? -1 : 1))) {
      console.log(`${pad(s.name, 24)} ${pad(s.readers.length || 'NONE', 8)} ${s.file}:${s.line}`);
    }
    console.log('');
    if (orphans.length) {
      console.log('FINDINGS — an exported closed set with no reader in src/, tools/ or tests/:');
      for (const s of orphans) console.log(`  ${s.name}  ${s.file}:${s.line}`);
      console.log('');
    }
    console.log(`RESULT: ${sets.length} exported closed set(s) over ${popFiles} source file(s); readers searched across ${files} file(s) in ${READER_DIRS.join('/, ')}/. ${orphans.length} with no reader.`);
    console.log(`EXCLUDED as a reader: ${NOT_A_READER} — its own known-bad corpus names sets, and a check may not cite itself as their consumer.`);
    console.log('BOUNDARY: this asks ONLY whether each set is read. It cannot see a second, hand-typed');
    console.log('copy of a set living elsewhere — green here is never a claim that nothing is duplicated.');
    console.log('Comments and string literals are blanked before scanning; import/export specifiers do not count.');
  }
  return { code: orphans.length ? 1 : 0, sets, orphans };
}

// ---------------------------------------------------------------------------
// --selftest: the known-bad corpus, planted into a COPY OF THE REAL TREE ON
// DISK and read back through collect() — the same door the real input uses.
//
// This is here because my last probe reported "every chip clears the 44 floor"
// while matching zero chips: a check that never touched its subject printed a
// number that looked like an answer. So each plant below is written into a real
// file, and the clean copy is asserted clean FIRST — if the baseline were dirty,
// every plant would "pass" for the wrong reason.
// ---------------------------------------------------------------------------
function selftest() {
  const tmp = join(tmpdir(), `closedsets-selftest-${process.pid}`);
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const d of new Set([...READER_DIRS, ...POPULATION_DIRS])) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });

  let bad = 0;
  const say = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) bad++; };
  const read = (rel) => readFileSync(join(tmp, rel), 'utf8');
  const write = (rel, text) => writeFileSync(join(tmp, rel), text);
  const orphanNames = () => collect(tmp).sets.filter((s) => !s.readers.length).map((s) => s.name);

  // 0 — the known-GOOD. The copied tree must be clean, or nothing below means
  // anything. (This is the assertion that fails first when the tree regresses.)
  const base = orphanNames();
  say(base.length === 0, 'the clean tree comes back with no findings', base.length ? `orphans: ${base.join(', ')}` : `${collect(tmp).sets.length} sets, all read`);
  const planted = (name, why) => {
    const all = collect(tmp).sets;
    const found = all.filter((s) => !s.readers.length).map((s) => s.name);
    const survived = (all.find((s) => s.name === name) || {}).readers || [];
    say(found.includes(name), why,
      found.includes(name) ? `flagged: ${found.join(', ')}` : `${name} still read at ${survived.join(', ') || '(nowhere — is it even in the population?)'}`);
  };
  const restore = (rel, text) => write(rel, text);

  // 1 — A NEW ORPHAN. The plainest form: somebody adds a vocabulary and wires
  // nothing to it. Written into the real schemas.js, on disk.
  {
    const rel = 'src/model/schemas.js';
    const original = read(rel);
    write(rel, `${original}\nexport const PLANTED_ORPHAN_SET = Object.freeze(['alpha', 'beta']);\n`);
    planted('PLANTED_ORPHAN_SET', 'a new closed set with no reader is found');
    restore(rel, original);
  }

  // 2 — THE PILES DEFECT ITSELF: a set that IS read, whose reader re-types the
  // values as an inline literal instead. Take the live reader out of the
  // validator and put the literal back exactly as it stood at cd3da94.
  {
    const rel = 'src/model/validate.js';
    const original = read(rel);
    write(rel, original
      .replace('!PILES.includes(eff.pile)', "!['draw', 'hand', 'discard', 'exhaust'].includes(eff.pile)")
      .replace('(legal: ${PILES.join(\', \')})', '')
      .replace(/^  PILES,$/m, ''));
    planted('PILES', 'a set whose reader re-types it as a literal goes red again');
    restore(rel, original);
  }

  // 3 — THE COMMENT TRAP. `// SPEC PASSIVE_KEYS` is how that set looked alive
  // for a month: one mention, in prose. A scanner that counts it is a scanner
  // that would have missed the original defect.
  {
    const rel = 'src/model/registries.js';
    const original = read(rel);
    write(rel, original
      .replace(/^const PASSIVE_SET = new Set\(PASSIVE_KEYS\);$/m, 'const PASSIVE_SET = new Set([]);')
      .replace(/PASSIVE_KEYS\.join\(', '\)/g, "''")
      .replace(/^import \{ REGISTRY_TYPES, PASSIVE_KEYS \} from '\.\/schemas\.js';$/m, "import { REGISTRY_TYPES } from './schemas.js';"));
    planted('PASSIVE_KEYS', 'a set mentioned only in a COMMENT is not read');
    restore(rel, original);
  }

  // 4 — THE STRING TRAP. The name quoted in a string is not a use of the set.
  {
    const rel = 'src/model/schemas.js';
    const original = read(rel);
    write(rel, `${original}\nexport const PLANTED_QUOTED_SET = Object.freeze(['x']);\nconst note = 'PLANTED_QUOTED_SET is described here';\nexport const PLANTED_NOTE = [note];\n`);
    planted('PLANTED_QUOTED_SET', 'a set named only inside a STRING is not read');
    restore(rel, original);
  }

  // 5 — THE IMPORT TRAP: imported and never used. This is exactly what
  // MODIFIER_KEYS was, and a scanner that counts the import line calls it green.
  {
    const rel = 'src/engine/statuses.js';
    const original = read(rel);
    write(rel, original
      .replace(/^const MODIFIER_SET = new Set\(MODIFIER_KEYS\);$/m, 'const MODIFIER_SET = new Set([]);')
      .replace(/MODIFIER_KEYS\.join\(', '\)/g, "''"));
    planted('MODIFIER_KEYS', 'a set that is only IMPORTED, never used, is not read');
    restore(rel, original);
  }

  // 6 — THE FLOOR, observed rather than asserted in prose: an empty tree must
  // exit 2 and print no counts, because a population of zero is a finding.
  {
    const empty = join(tmp, 'empty');
    mkdirSync(empty, { recursive: true });
    const r = report(empty, { quiet: true });
    say(r.code === 2, 'an empty tree is exit 2 (a finding), never a clean pass', `exit ${r.code}`);
  }

  // 7 — and the corpus put the tree back. If this fails, every PASS above is
  // suspect, because the plants were meant to be reversible.
  const after = orphanNames();
  say(after.length === 0, 'every plant was reverted and the tree is clean again', after.join(', ') || 'clean');

  rmSync(tmp, { recursive: true, force: true });
  console.log(`\nRESULT: known-bad recall ${bad === 0 ? '7/7' : `${7 - bad}/7`} — 5 plants, 1 floor, 1 clean baseline, all read off a copied tree on disk.`);
  return bad ? 1 : 0;
}

// Importing this file must not RUN it — a tool that executes on import is a trap
// for the next person who wants `collect` in a test.
const RUN_AS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (!RUN_AS_CLI) {
  /* imported for collect()/blankNonCode(); nothing runs */
} else if (process.argv.includes('--selftest')) {
  process.exit(selftest());
} else if (process.argv.includes('--json')) {
  const { sets } = collect(ROOT);
  console.log(JSON.stringify(sets, null, 2));
  process.exit(sets.some((s) => !s.readers.length) ? 1 : 0);
} else {
  process.exit(report(ROOT).code);
}
