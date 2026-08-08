#!/usr/bin/env node
// tools/screen-census.mjs — every player-facing screen in the tree, and what
// watches it. Rune, 2026-08-07, on Marina's ruling of the same day.
//
// WHY IT EXISTS. Constantine asked three times for a status checklist. The
// family's rule is that a third ask means the need is standing and it gets a
// DERIVED tool — because a hand-kept status page is the frozen-baseline defect
// pointed at the one artifact he actually reads, and we killed four of those in
// a day. So: nothing here is typed. Every line is read out of the tree, or is a
// POINTER to the one home that holds the fact, and each line says which.
//
// ONE CENSUS, TWO CONSUMERS (Marina's ruling, and it is the whole shape).
//   "What exists and who has watched it" is a CENSUS      — derived, and it is this file.
//   "Is it fit to ship"                  is a JUDGEMENT   — Sten's, against his datum,
//                                                           commons/release-floor.md.
// Two tools counting screens separately would be the second copy this one exists
// to kill. So this file counts screens ONCE and offers the floor a row it can
// cite; it does not grade anything.
//
// WHAT IT DOES NOT COUNT, on purpose. Top-level `?shot=` states and the
// navigable sub-surfaces (menu tabs, settings categories, armoury views) are
// counted by tools/release-shots.mjs and tools/surfaces.mjs. Those are their
// homes and this tool RECOUNTS NEITHER — it reads release-shots the way it reads
// every other instrument: as a file that either names a screen or does not.
//
// THE UNIT IS A SCREEN MODULE, and its home is the DIRECTORY. `src/ui/screens/`
// is a real single home: a file is there because it is a screen. No registry, no
// list, nothing to keep in sync — which is also what makes a new screen free
// (see CLAUSE 7 at the bottom).
//
// THREE STATES, because a checkbox implies existence and a binary flattens the
// honest middle (Marina):
//   [x]  built, and at least one instrument reaches it
//   [~]  built, and NOTHING in tools/ or tests/ reaches it — nobody has watched it work
//   [ ]  designed, not built — NOT DERIVABLE FROM A TREE. Paper leaves no trace
//        in src/. This tool prints the pointer to its home and refuses a count.
//
// THE HONEST LIMIT OF [x], said here rather than discovered later: a name in an
// instrument's SOURCE is not a run. This census proves an instrument KNOWS HOW
// TO REACH a screen; it does not prove the instrument still starts, still passes,
// or ever opened it. `release-shots` failed to start for a whole day while every
// name in it was still there. [x] means "something has a way in", never "it works".
//
// Usage:  node tools/screen-census.mjs [--selftest] [--raw]
// Exit:   0 the census was taken · 1 a finding · 2 the harness could not run
//
// REMOVAL CONDITION: delete this file the day `src/ui/screens/` stops being where
// screens live — the denominator would then be a guess, and a guessed denominator
// is what this tool was built to refuse.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv.includes('--raw');
const SELFTEST = process.argv.includes('--selftest');

const SCREEN_DIR = 'src/ui/screens';
const SRC_DIR = 'src';
const INSTRUMENT_DIRS = ['tools', 'tests'];

// The one fact this tool cannot derive, and whose home is in another repo.
// A POINTER, never a copy (Marina): a pointer that goes stale is a bug you can
// see; a copy that goes stale is a bug nobody can see.
const PAPER_HOME = 'commons/decisions/directions.md — Saga\'s ledger of what Constantine actually said';

// ---------------------------------------------------------------------------
// THE REF. Sten's rule, taken whole: no count is printed without the ref it was
// counted at, so a stale count declares itself instead of forgiving itself. Here
// the counts are computed at run time and cannot BE stale — but the tree can, so
// the ref is the reader's only way to know which tree these numbers describe.
//
// A tree with no git is exit 2, not a run with a blank ref. That is deliberate
// and it is the strictest line in this file: a count without its ref is the
// defect this tool was built to kill, so it may not print one.
// ---------------------------------------------------------------------------
function treeRef() {
  const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  const sha = git(['rev-parse', '--short', 'HEAD']);
  const dirty = git(['status', '--porcelain']).length > 0;
  // The TREE's date, not the wall clock. "When was this counted" is answered by
  // the ref; "how old is what I am looking at" is not, and that is the question
  // a reader of a status page actually has.
  const date = git(['log', '-1', '--format=%ad', '--date=short']);
  return { sha, dirty, date, label: dirty ? `${sha}-dirty` : sha };
}

// ---------------------------------------------------------------------------
// The reader. Everything below goes through it so `--selftest` can plant a
// breakage in memory without writing to the disk — same discipline as
// tools/surfaces.mjs, one layer lower because this tool's homes are FILES.
// ---------------------------------------------------------------------------
function fsReader() {
  return {
    list: (dir) => readdirSync(resolve(ROOT, dir), { withFileTypes: true })
      .map((e) => ({ name: e.name, dir: e.isDirectory() })),
    read: (path) => readFileSync(resolve(ROOT, path), 'utf8'),
  };
}

function walkJs(reader, dir, out = []) {
  for (const e of reader.list(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.dir) walkJs(reader, p, out);
    else if (/\.(mjs|js)$/.test(e.name)) out.push(p);
  }
  return out;
}

// ---- what a screen module says about itself --------------------------------

/** Its entry points: the functions another file calls to put it on the page. */
function entryExports(text) {
  return [...text.matchAll(/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]);
}

/**
 * The DOM names it coins — the ids and classes it writes into the page.
 *
 * TWO CONDITIONS, and both are derived rather than judged:
 *
 *  1. COMPOUND. The name must contain a hyphen. A bare word is a WORD — `port`,
 *     `ready`, `txt`, `cat` — and every one of those matched an instrument for
 *     the wrong reason on the first run of this tool: `.txt` in a static file
 *     server said the About panel was watched, and it is not. A hyphenated DOM
 *     name is a name this screen coined, and coincidence is what the rule buys
 *     out. What it costs is named in the BOUNDARY: a screen whose only DOM name
 *     is a bare word would read unwatched, so the per-row floor below counts
 *     usable names and goes red at zero rather than reporting a confident zero.
 *
 *  2. UNIQUE ACROSS src/. Applied by the caller, not here: a name that also
 *     appears in another source file cannot witness THIS screen. `.card` is
 *     everywhere and drops out by measurement, not by taste.
 */
function domNames(text) {
  const out = new Set();
  const SEL = /[#.]([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi;
  for (const m of text.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) {
    for (const t of m[2].matchAll(SEL)) out.add(t[1]);
  }
  for (const m of text.matchAll(/class=["'`]([^"'`$]*)/g)) {
    for (const w of m[1].split(/\s+/)) if (/^[a-z][a-z0-9-]*$/.test(w)) out.add(w);
  }
  for (const m of text.matchAll(/\bid=["'`]([a-z][a-z0-9-]*)/g)) out.add(m[1]);
  return [...out].filter((t) => t.includes('-'));
}

/** A DOM name in SELECTOR or LOOKUP position — `.x`, `#x`, `'x'`, `"x"`, `` `x` ``. */
const nameRe = (t) => new RegExp(`[#.'"\`]${t.replace(/[-]/g, '\\-')}(?![\\w-])`);
/** An identifier, whole — never a substring. `mountShop` must not match `shop.js`. */
const identRe = (t) => new RegExp(`\\b${t}\\b`);

/** Import specifiers, resolved against the importing file. */
function importsOf(path, text) {
  const here = dirname(path);
  const specs = [
    ...[...text.matchAll(/\bfrom\s*(['"])([^'"]+)\1/g)].map((m) => m[2]),
    ...[...text.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)].map((m) => m[2]),
  ];
  return specs
    .filter((s) => s.startsWith('.'))
    .map((s) => relative(ROOT, resolve(ROOT, here, s)).split('\\').join('/'));
}

// ---------------------------------------------------------------------------
// THE CENSUS
// ---------------------------------------------------------------------------
function census(reader) {
  const findings = [];

  // FLOOR 0 — the denominator. An empty screens directory is not a tree with no
  // screens; it is a home this tool can no longer read. Vira's rule, and it is
  // the DENOMINATOR that is floored, never the findings list.
  let screenFiles;
  try {
    screenFiles = reader.list(SCREEN_DIR).filter((e) => !e.dir && e.name.endsWith('.js')).map((e) => e.name).sort();
  } catch (e) {
    return { fatal: `${SCREEN_DIR} could not be read — ${e && e.message}` };
  }
  if (!screenFiles.length) {
    return { fatal: `${SCREEN_DIR} declares ZERO screens. An empty denominator is not a small game — it is a home this tool can no longer read.` };
  }

  // FLOOR 1 — the other denominator, and the one that would produce the
  // spectacular false alarm. With no instrument files read, EVERY screen reads
  // unwatched and the report is a confident, total lie.
  //
  // FLOORED PER SOURCE, NEVER ON THE AGGREGATE. The finding is VIRA'S, gating
  // this file on 2026-08-08; the reason it is worth a paragraph is that I had
  // floored the TOTAL and wrapped each directory's walk in `catch { return [] }`,
  // so losing ONE of the two sources was silent. Reproduced by me on a synthetic
  // two-screen tree before adopting it — `tests/` moved aside, `tools/` emptied,
  // both directions:
  //
  //     2 modules · 1 reachable · 1 by nothing · 0 findings · EXIT 0
  //     "THE [~] LIST … Nobody has watched these work:  beta"
  //
  // and `beta` was watched, by the file the census had just stopped reading.
  // THAT IS A FALSE CLAIM ABOUT THE GAME, PRINTED AT EXIT 0, CAUSED BY A DEFECT
  // IN THE CHECK — the worst thing an instrument can do, in the tool written to
  // stop instruments doing it. The only trace was `1 instrument files read` in
  // the header: a bare number with nothing to compare it against.
  //
  // Why it survived my own known-bad corpus: the plant I wrote emptied BOTH
  // directories, so the floor had been watched going red and read as observed.
  // The case that actually happens is one step smaller — a renamed directory, a
  // partial checkout, a clone made narrow. A plant that fires does not prove the
  // floor is at the right HEIGHT.
  //
  // It adds no baseline and no frozen constant: zero is derived every run, not
  // remembered. (Vira's queue-properties.md P1, written about a queue on the 7th
  // and landing on a census on the 8th.)
  //
  // TWO FAILURES, NOT ONE, and the second is the one my `catch` swallowed: a
  // source can come back EMPTY, or it can THROW. A directory that is GONE throws
  // — which is exactly how I reproduced it — so the throw path gets its own
  // named fatal and its own plant, rather than sharing the empty one's.
  //
  // SELF-EXCLUSION, and the first thing this tool caught was itself. The very
  // first run printed `[x] shop — 1 · screen-census`, on the strength of the
  // comment eleven lines above identRe() reading "`mountShop` must not match
  // `shop.js`". A sentence written to prevent a false match WAS one. Two
  // reasons it is excluded rather than tidied: this file opens no browser and
  // mounts nothing, so it can never be what watched a screen work; and a census
  // that may cite itself is a self-confirming green — the purest form of the
  // lying instrument, in the tool whose whole job is to not be one.
  const SELF = 'tools/screen-census.mjs';
  const sources = [];
  const instrumentFiles = [];
  for (const d of INSTRUMENT_DIRS) {
    let files;
    try {
      files = walkJs(reader, d).filter((p) => p !== SELF);
    } catch (e) {
      return { fatal: `instrument source ${d}/ COULD NOT BE READ — ${e && e.message}. Every screen that only ${d}/ reaches would report unwatched, and the [~] list would name it as something nobody has watched work. That is a false claim about the game caused by a defect in the check, so no census is taken.` };
    }
    if (!files.length) {
      return { fatal: `instrument source ${d}/ returned ZERO files. Every screen that only ${d}/ reaches would report unwatched, and the [~] list would name it as something nobody has watched work. That is a false claim about the game caused by a defect in the check, so no census is taken.` };
    }
    sources.push({ dir: d, count: files.length });
    instrumentFiles.push(...files);
  }

  const srcFiles = walkJs(reader, SRC_DIR);
  const srcText = srcFiles.map((p) => [p, reader.read(p)]);
  const instrText = instrumentFiles.map((p) => [p, reader.read(p)]);

  // Who imports what, across src/ — the reachability half.
  const importedBy = new Map();
  for (const [p, t] of srcText) {
    for (const target of importsOf(p, t)) {
      if (!importedBy.has(target)) importedBy.set(target, []);
      importedBy.get(target).push(p);
    }
  }

  const rows = [];
  for (const file of screenFiles) {
    const path = `${SCREEN_DIR}/${file}`;
    const text = reader.read(path);
    const id = file.replace(/\.js$/, '');
    const exports = entryExports(text);

    // Unique across src/ — measured, never judged.
    const names = domNames(text).filter((tk) => {
      const owners = srcText.filter(([, s]) => nameRe(tk).test(s)).map(([p]) => p);
      return owners.length === 1 && owners[0] === path;
    });

    // FLOOR 2, PER ROW. A module this tool derived NO way to recognise would
    // land silently in the unwatched bucket and read as a finding about the
    // game. It is a finding about the census. Floored here, at the entry point
    // where the number is made (Vira: at EVERY entry point).
    if (!exports.length && !names.length) {
      findings.push({ kind: 'unreadable', id, why: 'no entry export and no DOM name unique to it — this census cannot recognise it in an instrument, so "unwatched" would be a claim it has not earned', fix: `read ${path} by hand, or widen domNames()` });
    }

    const importers = (importedBy.get(path) || []).filter((p) => p !== path);
    // FLOOR 3 — a screen no file in src/ imports cannot be mounted, so no player
    // can reach it. That is a finding about the game, not about the check.
    if (!importers.length) {
      findings.push({ kind: 'unreachable', id, why: 'nothing in src/ imports it, so nothing can mount it', fix: `import it where it belongs, or delete ${path}` });
    }

    const watchers = [];
    for (const [p, s] of instrText) {
      const why = [];
      if (importsOf(p, s).includes(path)) why.push('imports it');
      for (const e of exports) if (identRe(e).test(s)) why.push(e);
      for (const tk of names) if (nameRe(tk).test(s)) why.push(tk);
      if (why.length) watchers.push({ file: p, why: [...new Set(why)] });
    }

    rows.push({
      id,
      path,
      exports,
      names: names.length,
      // A screen main.js mounts is a SCREEN; one another screen mounts is a
      // SECTION of that screen (Settings → About is not a place you navigate to).
      // Derived from the importers, never labelled by hand.
      kind: importers.includes('src/main.js') ? 'screen' : 'section',
      importers,
      watchers,
      readable: Boolean(exports.length || names.length),
    });
  }

  return { rows, findings, sources, instrumentCount: instrumentFiles.length, srcCount: srcFiles.length };
}

// ---------------------------------------------------------------------------
// THE WATCHER COLUMN — one cell per instrument, as the READER sees it.
//
// IT IS A FUNCTION BECAUSE THE DEFECT LIVES AT THE PRINT. Vira found that `[x]`
// was unfalsifiable: `watchers[].why` — the exact token each instrument matched
// on — was derived at the join and dropped here, so a reader was handed a
// FILENAME and no way to check it. She reproduced this tool's own first bug on a
// fresh tree with one comment reading "this tool deliberately does NOT touch
// mountBeta", and got `[x] beta 2`. I reproduced it too, on my own synthetic
// tree, with the same sentence. A comment saying a tool does not touch a screen
// still counts as the tool touching it — my self-exclusion fixed the INSTANCE
// and left the CLASS, and the class is one file away in any tree.
//
// Printing the token does not prevent a false match. It makes one FINDABLE by
// whoever reads the report, which is the whole of the ask.
//
// AND THIS IS WHY IT IS EXTRACTED RATHER THAN INLINED. Vira planted the property
// on the MODEL — every `watchers[].why` non-empty — and wrote that its falsifier
// was "delete `why` from the join, OR STOP PRINTING IT". The second half does not
// hold, and I checked before adopting rather than after: with her print reverted
// to the bare filename in her own clone, her corpus still reads 10/10 red and
// `[x] map 7` still prints `contrast-audit · mapreach · …`. A property planted on
// the model cannot see the print. So the cell is a named function, the plant
// calls the same function the report calls, and D2 cannot come back silently.
// ---------------------------------------------------------------------------
function watcherCells(r) {
  if (!r.readable) return ['UNREADABLE — this census cannot recognise it (see findings)'];
  if (!r.watchers.length) return ['nothing names it'];
  return r.watchers.map((w) => `${w.file.replace(/^tools\//, '').replace(/\.mjs$/, '')}:${w.why.join('+')}`);
}

// The one typed number in the report, and it decides nothing about the game: how
// wide a line may be before it wraps. Constantine reads this output, so a row is
// WRAPPED, never TRUNCATED — a truncated reason is D2 again wearing a layout
// costume, and "+3 more" would be the same unfalsifiable claim with a number on
// it. A cell is never split either: half a token is not greppable, and the point
// of the token is that a reader can go and check it. A single cell longer than
// the budget therefore overhangs on purpose.
//
// Measured before adopting: with the tokens inline and no wrap, this report's
// widest row is 244 columns (settings), 7 rows clear 100, median 57. That is the
// artifact he actually reads.
const ROW_WIDTH = 100;

function wrapCells(prefix, cells, width = ROW_WIDTH) {
  const pad = ' '.repeat(prefix.length); // derived from the prefix, never typed twice
  const lines = [];
  let cur = prefix;
  let empty = true;
  for (const cell of cells) {
    const sep = empty ? '' : ' · ';
    if (!empty && cur.length + sep.length + cell.length > width) {
      lines.push(cur);
      cur = pad + cell;
    } else {
      cur += sep + cell;
      empty = false;
    }
  }
  lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// THE REPORT — the artifact Constantine reads. Legible at a glance is a
// requirement, not a preference.
// ---------------------------------------------------------------------------
function printReport(c, ref) {
  const screens = c.rows.filter((r) => r.kind === 'screen');
  const sections = c.rows.filter((r) => r.kind === 'section');
  const watched = c.rows.filter((r) => r.watchers.length);
  const dark = c.rows.filter((r) => !r.watchers.length && r.readable);

  console.log(`SCREEN CENSUS — every player-facing screen in the tree, and what can reach it`);
  console.log(`  ref ${ref.label} · committed ${ref.date}${ref.dirty ? '  (WORKING TREE IS DIRTY — these numbers are of files on disk, not of that commit)' : ''}`);
  console.log(`  ${c.rows.length} screen modules · ${c.instrumentCount} instrument files read · every line below is derived`);
  // THE SOURCES, ONE LINE EACH, ABOVE ANY COUNT DERIVED FROM THEM — Vira's, and
  // I am keeping her sentence for it because it is the argument: a reader who
  // can see `tests/ 1 file` where there were 7 can see the census lost a source;
  // a reader given only the total cannot. Each is floored at zero and at a read
  // failure above, so a source that vanishes is a fatal rather than a smaller
  // number — this line is what makes a source that merely SHRANK visible too,
  // which no floor can do.
  console.log(`  sources:  ${c.sources.map((s) => `${s.dir}/ ${s.count} file${s.count === 1 ? '' : 's'}`).join('  ·  ')}  ·  ${SRC_DIR}/ ${c.srcCount} files\n`);

  console.log(`  [x] ${String(watched.length).padStart(2)}  built, and at least one instrument can reach it`);
  console.log(`  [~] ${String(dark.length).padStart(2)}  built, and NOTHING in tools/ or tests/ can reach it`);
  console.log(`  [ ]  ?  designed but not built — NOT DERIVABLE HERE. See THE COLUMN I REFUSE TO DERIVE.\n`);

  const block = (label, rows) => {
    if (!rows.length) return;
    console.log(label);
    for (const r of rows.slice().sort((a, b) => (b.watchers.length - a.watchers.length) || a.id.localeCompare(b.id))) {
      const box = !r.readable ? '[?]' : r.watchers.length ? '[x]' : '[~]';
      const prefix = `  ${box} ${r.id.padEnd(15)}${String(r.watchers.length).padStart(2)}  `;
      for (const line of wrapCells(prefix, watcherCells(r))) console.log(line);
    }
    console.log('');
  };

  block(`SCREENS — ${screens.length} · mounted from src/main.js · home: ${SCREEN_DIR}/`, screens);
  block(`SECTIONS — ${sections.length} · mounted inside another screen, never navigated to directly`, sections);

  if (dark.length) {
    console.log(`THE [~] LIST, in full — ${dark.length} of ${c.rows.length}. Nobody has watched these work:`);
    console.log(`  ${dark.map((r) => r.id).join(', ')}`);
    console.log(`  Each is built and reachable by a player. No file in tools/ or tests/ names its`);
    console.log(`  entry point or any DOM name unique to it, so no instrument we own can open it,`);
    console.log(`  and no picture of it exists to regress against.\n`);
  }

  console.log(`THE COLUMN I REFUSE TO DERIVE — designed but not built, the [ ] state`);
  console.log(`  It is NOT in this report and it will never be. Paper leaves no trace in a tree:`);
  console.log(`  a screen Constantine has described and nobody has built has no file to count.`);
  console.log(`  Its home, and this is a POINTER, never a copy:`);
  console.log(`      ${PAPER_HOME}`);
  console.log(`  Read D2 there before believing any number on this page is the whole project —`);
  console.log(`  the meta-progression layer is paper in its entirety, by that ledger's own line.\n`);

  console.log(`COUNTED ELSEWHERE, ON PURPOSE — one fact, one home`);
  console.log(`  top-level ?shot= states, and every navigable sub-surface (menu tabs, settings`);
  console.log(`  categories, armoury views):   node tools/release-shots.mjs`);
  console.log(`  every declared surface has a handler:            node tools/surfaces.mjs`);
  console.log(`  This census recounts neither. It reads release-shots as one instrument among`);
  console.log(`  ${c.instrumentCount}, and a second screen count would be the copy it exists to kill.\n`);

  console.log(`FOR THE RELEASE FLOOR — commons/release-floor.md is Sten's file and his judgement.`);
  console.log(`  The row this census offers him, counted by this run at ${ref.label}, never typed:`);
  console.log(`  | Every player-facing screen can be opened by an instrument | node tools/screen-census.mjs |`);
  console.log(`    ${c.rows.length} modules · ${watched.length} reachable by an instrument · ${dark.length} by nothing |`);
  console.log(`  Whether that is fit to ship is his to say. This tool does not grade.\n`);

  return { screens, sections, watched, dark };
}

function printFindings(findings) {
  console.log(`FINDINGS — ${findings.length}:`);
  for (const f of findings) console.log(`  ${f.kind.toUpperCase().padEnd(11)} ${f.id} — ${f.why}\n              fix: ${f.fix}`);
  console.log('');
}

function printBoundary(c, ref) {
  console.log(`BOUNDARY — what this census did NOT establish`);
  console.log(`  · [x] means an instrument NAMES a way in. It is not a run, not a pass, not a`);
  console.log(`    picture. release-shots named every screen it names for a whole day while it`);
  console.log(`    exited 1 before the browser started. A name is a way in, never a witness.`);
  console.log(`  · Nothing here opened a browser or drew a pixel. Whether a screen RENDERS is`);
  console.log(`    release-shots'; whether it is legible is Sunna's; whether it is correct is Vira's.`);
  console.log(`  · This census has NO MEMORY. It reports ${ref.label} and compares it to nothing.`);
  console.log(`    A screen that loses its last instrument moves [x] → [~] between two runs and`);
  console.log(`    no line goes red. That is deliberate: the alternative is a recorded baseline,`);
  console.log(`    which is the frozen-constant defect this tool was built to replace.`);
  console.log(`  · A screen mounted from somewhere other than ${SCREEN_DIR}/ is invisible here.`);
  console.log(`    The directory is the denominator; nothing checks that it is the whole world.`);
  console.log(`  · The [~] bucket is "no instrument can reach it", never "it is broken" and never`);
  console.log(`    "it is unfinished". A screen nobody watches may be perfect. Unknown, not red.`);
}

// ---------------------------------------------------------------------------
// KNOWN-BAD FIRST (development.md, the instrument rule). A detector nobody has
// watched go red is `unknown`, not green. Each plant is one edit an author could
// make, applied to the READER in memory, and the tree is re-censused clean after
// every one.
//
// THE OTHER EDGE is the plant I would have skipped: a tree where every screen IS
// reachable must print no alarm. A checker that only ever fires has not been
// shown to stop firing.
//
// PLANTS ARE NAMED, NEVER NUMBERED, in this comment and in every comment that
// cites one. An index into a list is a positional identifier — insert a plant in
// the middle and every sentence naming "plant 6" is quietly about a different
// plant, with nothing going red. That happened to this comment the moment Vira's
// three source plants landed above, which is how I know it is not hypothetical.
// It is the same defect as a hand-numbered test, one file over.
// ---------------------------------------------------------------------------
function selftest() {
  const base = fsReader();
  const overlay = (patch) => ({
    list: (dir) => (patch.list && patch.list(dir)) ?? base.list(dir),
    read: (path) => (patch.read && patch.read(path)) ?? base.read(path),
  });

  const truth = census(base);
  if (truth.fatal) {
    console.log(`RESULT: the census could not read the real tree, so no plant means anything — ${truth.fatal}`);
    process.exit(2);
  }
  const darkNow = truth.rows.filter((r) => !r.watchers.length && r.readable).map((r) => r.id);
  const litNow = truth.rows.filter((r) => r.watchers.length);
  const victim = litNow.slice().sort((a, b) => a.watchers.length - b.watchers.length)[0];

  const plants = [
    ['the screens directory emptied — the DENOMINATOR edge',
      () => overlay({ list: (d) => (d === SCREEN_DIR ? [] : undefined) }),
      (c) => Boolean(c.fatal && /ZERO screens/.test(c.fatal))],

    ['tools/ and tests/ emptied — the edge where EVERY screen reads unwatched',
      () => overlay({ list: (d) => (INSTRUMENT_DIRS.includes(d) ? [] : undefined) }),
      (c) => Boolean(c.fatal && /instrument source \w+\/ returned ZERO files/.test(c.fatal))],

    // PLANTS 3, 4 AND 5 — ONE SOURCE LOST, NOT BOTH. Vira's finding, and plants
    // 3 and 4 are hers. The plant above is now the SUBSUMED case: with the floor
    // per source it fires on whichever source is checked first, so it can no
    // longer tell me the floor is at the right height. These can.
    //
    // Both directions on purpose: `tools/` is first in INSTRUMENT_DIRS, so a
    // floor that checked only the first source would still pass the tools/ plant
    // and fail the tests/ one. One of these two is load-bearing and I cannot say
    // in advance which, so both stay.
    //
    // PLANT 5 IS MINE AND IT IS THE ONE MY REPRODUCTION ACTUALLY USED. A source
    // that is GONE does not come back empty — `readdirSync` THROWS. The old code
    // swallowed exactly that throw in `catch { return [] }`, so the throw path is
    // the branch that shipped the defect, and a fix whose evidence only covers
    // the empty path leaves the guilty branch unwatched. A detector nobody has
    // watched go red is unknown, not green — including a detector that replaced
    // one somebody did watch.
    ['ONLY tests/ emptied — one source lost, and the other one still answers',
      () => overlay({ list: (d) => (d === 'tests' ? [] : undefined) }),
      (c) => Boolean(c.fatal && /instrument source tests\/ returned ZERO files/.test(c.fatal))],

    ['ONLY tools/ emptied — the same, from the other side',
      () => overlay({ list: (d) => (d === 'tools' ? [] : undefined) }),
      (c) => Boolean(c.fatal && /instrument source tools\/ returned ZERO files/.test(c.fatal))],

    ['tests/ GONE, not empty — the throw path, which is how a lost source really fails',
      () => overlay({ list: (d) => { if (d !== 'tests') return undefined; const e = new Error(`ENOENT: no such file or directory, scandir '${d}'`); e.code = 'ENOENT'; throw e; } }),
      (c) => Boolean(c.fatal && /instrument source tests\/ COULD NOT BE READ/.test(c.fatal) && /ENOENT/.test(c.fatal))],

    ['a screen stripped of its exports and its DOM names — unrecognisable, NOT unwatched',
      () => overlay({ read: (p) => (p === `${SCREEN_DIR}/shop.js` ? '// nothing at all\n' : undefined) }),
      (c) => !c.fatal && c.findings.some((f) => f.kind === 'unreadable' && f.id === 'shop')],

    ['a screen nothing in src/ imports — built, and no player can reach it',
      () => overlay({ read: (p) => (p === 'src/main.js' ? base.read(p).replace(/^import .*screens\/rest\.js';$/m, '') : undefined) }),
      (c) => !c.fatal && c.findings.some((f) => f.kind === 'unreachable' && f.id === 'rest')],

    [`the only instrument naming a watched screen, deleted — [x] must become [~]`,
      () => overlay({ read: (p) => (victim && p === victim.watchers[0].file ? '// gone\n' : undefined) }),
      (c) => !c.fatal && victim && victim.watchers.length === 1
        && !c.rows.find((r) => r.id === victim.id).watchers.length],

    ['THE OTHER EDGE — every dark screen given an instrument: the alarm must STOP',
      () => overlay({
        read: (p) => {
          if (p !== 'tools/screenreach.mjs') return undefined;
          const names = darkNow.map((id) => {
            const r = truth.rows.find((x) => x.id === id);
            return r.exports[0] || '';
          }).filter(Boolean);
          return `${base.read(p)}\n// planted: ${names.join(' ')}\n`;
        },
      }),
      (c) => !c.fatal && c.rows.filter((r) => !r.watchers.length && r.readable).length === 0],

    // NOT A BREAKAGE — A PROPERTY, and the one plant here that reads the REPORT
    // rather than the model. Vira's finding and Vira's property; the subject is
    // mine, because hers sat on `c.rows` and D2 was a defect of the PRINT. Proven
    // rather than argued: with her print reverted to the bare filename, her
    // corpus still read 10/10 red while `[x] map 7` printed seven filenames and
    // no reasons — the exact output she withheld the branch over.
    //
    // Falsifier, and this one holds: drop `why` from the join, OR stop rendering
    // it in watcherCells(), OR truncate the cells, and this goes MISS.
    ['EVERY [x] PRINTS THE TOKEN IT RESTS ON — the claim a reader can go and check',
      () => fsReader(),
      (c) => {
        if (c.fatal) return false;
        const lit = c.rows.filter((r) => r.watchers.length);
        if (!lit.length) return false; // vacuous truth is not evidence
        return lit.every((r) => {
          const cells = watcherCells(r);
          return cells.length === r.watchers.length && r.watchers.every((w, i) => {
            if (!w.why.length) return false;
            const rendered = cells[i].slice(cells[i].indexOf(':') + 1).split('+');
            return w.why.every((t) => rendered.includes(t));
          });
        });
      }],

    ['a NEW screen module nobody registered anywhere — Law 0\'s falsifier, one file',
      () => overlay({
        list: (d) => (d === SCREEN_DIR ? [...base.list(d), { name: 'oubliette.js', dir: false }] : undefined),
        read: (p) => (p === `${SCREEN_DIR}/oubliette.js`
          ? `export function mountOubliette(app){ app.innerHTML = '<div class="oubliette-wrap"></div>'; }\n`
          : p === 'src/main.js'
            ? `import { mountOubliette } from './ui/screens/oubliette.js';\n${base.read(p)}`
            : undefined),
      }),
      (c) => {
        const r = !c.fatal && c.rows.find((x) => x.id === 'oubliette');
        return Boolean(r && r.kind === 'screen' && !r.watchers.length && r.readable);
      }],
  ];

  console.log('SELFTEST — each plant is one edit an author could make by hand:');
  let reds = 0;
  for (const [what, make, expected] of plants) {
    const c = census(make());
    const hit = expected(c);
    console.log(`  ${hit ? 'RED ' : 'MISS'}  ${what}`);
    if (hit) reds++;
  }
  const after = census(fsReader());
  const clean = !after.fatal && after.findings.length === truth.findings.length;
  console.log(`  ${clean ? 'CLEAN' : 'DIRTY'}  the real tree after every plant was undone`);
  const ok = reds === plants.length && clean;
  console.log(`RESULT: ${reds}/${plants.length} planted edits went red and the tree came back clean${ok ? '' : ' — IT DID NOT'}.`);
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------------------

if (SELFTEST) selftest();

let ref;
try {
  ref = treeRef();
} catch (e) {
  console.log(`RESULT: the census could not read the tree's ref — ${e && e.message}. A count without the ref it was counted at is the defect this tool exists to kill, so it prints none.`);
  process.exit(2);
}

const c = census(fsReader());

// A RUN THAT MEASURED NOTHING PRINTS ITS EMPTINESS, NOT ITS BOUNDARIES (Marina's
// amended audit law, minted off a tool that printed `all checks passed` beside a
// boundary naming four uncovered things, having measured nothing). So the report,
// the pointers and the BOUNDARY block are all downstream of having counted
// something — a fatal floor prints the floor and stops.
if (c.fatal) {
  console.log(`SCREEN CENSUS — ref ${ref.label}`);
  console.log(`  MEASURED NOTHING. ${c.fatal}`);
  console.log(`  No counts, no pointers and no boundary follow: a report about a tree this tool`);
  console.log(`  could not read would be a confident zero, which is worse than an error.`);
  console.log(`RESULT: the census could not be taken at ${ref.label} — ${c.fatal}`);
  process.exit(1);
}

let tally;
if (!RAW) {
  tally = printReport(c, ref);
  if (c.findings.length) printFindings(c.findings);
  printBoundary(c, ref);
  console.log('');
} else {
  const watched = c.rows.filter((r) => r.watchers.length);
  tally = { watched, dark: c.rows.filter((r) => !r.watchers.length && r.readable) };
}

console.log(`RESULT: ${c.rows.length} screen modules at ${ref.label}, ${tally.watched.length} reachable by an instrument, ${tally.dark.length} by nothing, ${c.findings.length} finding${c.findings.length === 1 ? '' : 's'}.`);
process.exit(c.findings.length ? 1 : 0);

// ---------------------------------------------------------------------------
// CLAUSE 7 — for this tool's own output (Law 0 clause 1: an entry DESCRIBES,
// the machinery DERIVES).
//
//   WHAT A NEW ENTRY REQUIRES THE AUTHOR TO WRITE:  a file in src/ui/screens/.
//   That is the whole list. Not a row here, not a name in a registry, not a
//   line in any manifest. Drop the module in the directory and it is in the
//   census on the next run.
//
//   WHAT THE MACHINERY DERIVES:  its id (the filename) · its entry points (its
//   own export statements) · the DOM names it coins, and which of those are
//   unique enough to recognise it by (measured across src/) · whether anything
//   mounts it, and therefore whether it is a SCREEN or a SECTION of one ·
//   which instruments can reach it, and by which token · its three-state box ·
//   every count · the ref every count was counted at.
//
//   THE FALSIFIER, and it is run rather than promised: the --selftest plant
//   named "a NEW screen module nobody registered anywhere" adds one fictional
//   screen module and one import, ZERO edits to this file, and the census
//   reports it as a screen nobody watches. Named, not numbered — see the note
//   above selftest().
// ---------------------------------------------------------------------------
