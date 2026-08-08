#!/usr/bin/env node
// tools/linkcheck.mjs — every named import in the tree resolves to a real
// export. Bjorn, 2026-08-08.
//
// WHY IT EXISTS. `tools/release-shots.mjs` — the canonical release capture set,
// the instrument the release floor cited as green — exited 1 before a browser
// launched, because #88 renamed an export and left the consumer standing. It
// was not a failed check. IT WAS A FAILED LOAD, and the first thing that would
// have noticed was a person, at delivery time, tired.
//
// The suite already named the gap in its own BOUNDARY block:
//   "release-shots is the half that has watched a panel paint."
// It names that tool as covering what it cannot, and had never so much as
// LOADED it. Eleven instruments in this tree are started by a human typing.
// All eleven import `src/` statically — 1 to 8 static reads each, zero dynamic.
//
// THE CHEAP HALF IS THE WHOLE CLASS. "Run it on every change" does not require
// "a browser in the unit suite" and never did. `vm.SourceTextModule` + link()
// stops before evaluate(), and A MISSING NAMED EXPORT IS AN INSTANTIATION
// ERROR — raised during linking, before one line of any module body runs. So
// this reproduces #88's exact error text, launches no browser, binds no port,
// and touches no state. A cheap check that runs always beats an expensive one
// that runs never.
//
// LINKING IS NOT RUNNING, and this file prints that first on every run.
//
// WHAT AN AUTHOR WRITES: nothing. No tool registers itself, there is no
// manifest, and the denominator is a DIRECTORY WALK — a tool added tomorrow is
// linked on the next run with no edit to this file. That is the only reason
// this is worth more than the grep it replaces. What IS authored is the plants
// in --selftest, and those are the check's own corpus, never its denominator.
// NO COUNT OF THEM IS TYPED HERE — the RESULT line carries it, and a number
// beside a list is the second copy this house exists to catch.
//
// I WROTE A REGEX FOR DYNAMIC import() TARGETS AND DELETED IT. On its first run
// it reported a file BROKEN because of a SENTENCE IN THAT FILE describing the
// regex. It was also unnecessary: the directory walk links every in-tree module
// whether or not anything imports it. The gap it would have closed — a dynamic
// target that has been deleted — is named in the boundary below instead of
// bought with a matcher that reads comments. (`tools/bundle.test.mjs` writes
// `from 'lodash'` INTO A TEMPLATE STRING as a fixture; a parser does not see it
// and a regex does. That is the whole argument.)
//
//   usage: node tools/linkcheck.mjs [--raw] [--selftest]
//     --selftest  plant known breakages in a COPY of the tree and require each
//                 to be caught. Never touches the working tree. Three verdicts
//                 per plant — CAUGHT, MISSED, UNPLANTABLE — because a plant that
//                 never applied measured nothing and must not be read as either.
//   exit 0 = every module graph links   1 = a broken import
//        2 = COULD NOT ANSWER — the flag re-exec failed, or the corpus could not
//            be scored (UNTESTABLE: the tree is already broken · UNPLANTABLE: a
//            plant did not apply). Unknown blocks exactly as red does.

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync, renameSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import vm from 'node:vm';

// ONE HOME FOR HOW THIS STARTS. vm.SourceTextModule needs a flag; a caller who
// has to remember it is a caller who will run this without it and read the
// crash as "the tool is broken". So the tool re-execs ITSELF, once, and says so.
if (!vm.SourceTextModule) {
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit' });
  process.exit(r.status == null ? 2 : r.status);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv.includes('--raw');
const SELFTEST = process.argv.includes('--selftest');

// The walk IS the denominator. Exclusions are named with reasons, because an
// omission is not an answer.
const ROOTS = ['src', 'tools', 'tests'];
const SKIP_DIRS = new Set([
  'node_modules',   // none in this tree, and not ours to link
  'build',          // generated bundle — linking a 2 MB single file says nothing
  'dist',           //   about the sources it was derived from
  '.git',
]);
// tests/fixtures/ is a FROZEN CORPUS, not tree code. Its files are copies of
// src/ modules cut at a named SHA (`good_tutorial_3a0def9.js` is
// src/ui/components/tutorial.js at 3a0def9) and kept so zoomunits has a
// known-bad to be proved against. Their relative imports point at the paths
// they had BEFORE they were copied, so linking them measures the snapshot's
// old address, never this tree. Excluded by path, with that reason, and the
// count of what was skipped is printed so the exclusion cannot hide.
const SKIP_PATHS = [join('tests', 'fixtures') + sep];
const isModule = (f) => f.endsWith('.js') || f.endsWith('.mjs');

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (isModule(name)) out.push(p);
  }
  return out;
}

/**
 * link(entry) → null when the whole graph instantiates, or the first error.
 *
 * NOTHING IS EVALUATED. We stop at instantiate(): link() resolves and binds
 * every named import, which is where a missing export is raised, and no module
 * body runs. That is the point — this tool has no side effects on the tree it
 * inspects and cannot be broken by a module that throws on load.
 */
async function linkGraph(entry, root) {
  const cache = new Map();
  // ONE CONTEXT FOR THE WHOLE GRAPH. A context per module is rejected with
  // "Linked modules must use the same context" — which my first run reported
  // for 88 of 149 graphs, i.e. my instrument, not the tree. Again.
  const context = vm.createContext({});
  const make = (file) => {
    const key = resolve(file);
    if (cache.has(key)) return cache.get(key);
    const m = new vm.SourceTextModule(readFileSync(key, 'utf8'), {
      identifier: pathToFileURL(key).href,
      context,
      initializeImportMeta: (meta) => { meta.url = pathToFileURL(key).href; },
      importModuleDynamically: () => { throw new Error('dynamic import is not linked here — see BOUNDARY'); },
    });
    cache.set(key, m);
    return m;
  };
  const linker = async (spec, referencing) => {
    // A NODE BUILTIN IS ACTUALLY IMPORTED. There is no source text to link, so
    // it is wrapped in a SyntheticModule over the real namespace — which means
    // builtins, and only builtins, are evaluated. Named in the boundary.
    if (spec.startsWith('node:') || !/^\.{0,2}\//.test(spec)) {
      let ns;
      try { ns = await import(spec); }
      catch { throw new Error(`bare specifier '${spec}' has no home — not a node builtin and this tree has no dependencies`); }
      const keys = Object.keys(ns);
      return new vm.SyntheticModule(keys, function () { for (const k of keys) this.setExport(k, ns[k]); },
        { identifier: spec, context: referencing.context });
    }
    const file = resolve(dirname(fileURLToPath(referencing.identifier)), spec);
    if (!existsSync(file)) { const e = new Error(`ENOENT: no such file or directory, open '${relative(root, file)}'`); e.code = 'ENOENT'; throw e; }
    return make(file);
  };
  try {
    const m = make(entry);
    await m.link(linker);          // <- instantiation happens here, and stops here
    return null;
  } catch (e) {
    return (e && e.message) ? e.message : String(e);
  }
}

async function checkTree(root) {
  const all = ROOTS.filter((d) => existsSync(join(root, d))).flatMap((d) => walk(join(root, d)));
  const files = all.filter((f) => !SKIP_PATHS.some((p) => relative(root, f).includes(p)));
  const skipped = all.length - files.length;
  const broken = [];
  for (const f of files) {
    const err = await linkGraph(f, root);
    if (err) broken.push({ file: relative(root, f).split(sep).join('/'), err });
  }
  return { total: files.length, skipped, broken };
}

// ---------------------------------------------------------------- selftest
// FIVE PLANTS, EACH THE SHAPE OF A REAL FAILURE THIS TREE HAS HAD OR COULD.
// They are applied to a COPY, so --selftest never edits the working tree and a
// crash mid-run cannot leave it dirty.
//
// UNPLANTABLE IS NEVER MISSED — the numerator's half of the guard. Sten found
// it: `UNTESTABLE` below asks whether a plant CAN mean anything (the
// denominator — a tree already broken cannot score a corpus), and NOTHING here
// asked whether the plant APPLIED. Every edit below is a String.replace, which
// returns the original string when its pattern stops matching AND REPORTS
// NOTHING. He imported one more real name into release-shots.mjs — correct
// code, tree links clean — and plant 1's pattern quietly matched nothing, so
// this tool printed `MISSED`: a well-formed, confident, FALSE claim about
// itself, pointing a reader at a check that was never broken.
//
// So a plant now ASSERTS THAT IT LANDED. Every edit goes through `edit`,
// `prepend` or `move` below, each of which throws `Unplantable` when its target
// is gone or its pattern matched nothing. Three verdicts, not two:
//
//   CAUGHT       the plant applied and the check went red for the right reason
//   MISSED       the plant applied and the check did NOT catch it — a defect
//                in this tool, and the only verdict that indicts the check
//   UNPLANTABLE  the plant never applied, so NOTHING WAS MEASURED. Not a miss,
//                not a catch. It blocks like UNTESTABLE does, and for the same
//                reason: unknown blocks exactly as red does.
//
// The error runs in the SAFE direction. A corpus that has drifted off the tree
// costs an hour of somebody re-anchoring a pattern; it never ships a defect,
// because UNPLANTABLE cannot be read as clearance. `MISSED` on a plant that was
// never planted is the opposite: it spends that hour on the wrong file.
class Unplantable extends Error {}

/** A targeted replacement that CANNOT no-op silently. */
function edit(t, rel, pattern, replacement) {
  const p = join(t, rel);
  if (!existsSync(p)) throw new Unplantable(`${rel} is not in the tree — the plant has no target`);
  const before = readFileSync(p, 'utf8');
  const after = before.replace(pattern, replacement);
  if (after === before) throw new Unplantable(`${rel} matched ${pattern} nowhere — the edit landed on nothing`);
  writeFileSync(p, after, 'utf8');
}

/** Prepending cannot no-op, but the file it prepends to can be gone. */
function prepend(t, rel, text) {
  const p = join(t, rel);
  if (!existsSync(p)) throw new Unplantable(`${rel} is not in the tree — the plant has no target`);
  writeFileSync(p, text + readFileSync(p, 'utf8'), 'utf8');
}

/** A rename whose source is gone threw an uncaught ENOENT and killed the run. */
function move(t, rel, toRel) {
  const p = join(t, rel);
  if (!existsSync(p)) throw new Unplantable(`${rel} is not in the tree — nothing to move away`);
  renameSync(p, join(t, toRel));
}

const PLANTS = [
  // #88's OWN SHAPE: the export is renamed and every consumer is left standing.
  // This is the plant the tool was written for and the one it did not have —
  // plant 2 below renames the IMPORT, which produces the same error text from
  // the mirror image of the real defect.
  { name: "#88's own line — the EXPORT renamed, every consumer left standing",
    expect: /does not provide an export named 'settingsCategories'/,
    apply: (t) => edit(t, 'src/ui/screens/settings.js',
      /export function settingsCategories\b/, 'export function SETTINGS_CATEGORIES') },
  // Anchored inside the import's brace group, not on the whole line: a second
  // name added to that import is a legal edit and must not turn this plant
  // UNPLANTABLE. When it DOES stop matching — a namespace import, the name
  // gone — that is the honest unknown, and it prints.
  { name: "#88's error text — the consumer's named import renamed instead",
    expect: /does not provide an export named 'SETTINGS_CATEGORIES'/,
    apply: (t) => edit(t, 'tools/release-shots.mjs',
      /(import\s*\{[^}]*?)\bsettingsCategories\b/, '$1SETTINGS_CATEGORIES') },
  { name: 'a typo in a named import',
    expect: /does not provide an export named 'surfaceReprot'/,
    apply: (t) => prepend(t, 'src/main.js', `import { surfaceReprot } from './ui/surfaces.js';\n`) },
  { name: 'a file that moved and left its importers behind',
    expect: /ENOENT/,
    apply: (t) => move(t, 'tools/dirorder.mjs', 'tools/dirorder-moved.mjs') },
  { name: 'a default import from a module with no default export',
    expect: /does not provide an export named 'default'/,
    apply: (t) => prepend(t, 'src/main.js', `import notADefault from './ui/surfaces.js';\n`) },
  // A SYNTAX ERROR — THE CLASS THIS TOOL WAS CATCHING BY ACCIDENT AND HAD NOT
  // DECLARED. Every plant above is a RESOLUTION failure: a name that does not
  // exist. Parsing is the step before that, and nothing in this corpus said
  // this tool could go red on it, so the class was `unknown` — not covered
  // (`development.md`, *The instrument rule*). It went red for a real defect on
  // 2026-08-08 (#128: four backticks in an HTML comment INSIDE a template
  // literal closed the string, the screen stopped mounting, and every other
  // instrument reported did-not-mount rather than a syntax error). A check that
  // catches a class its corpus never claimed is one silent refactor away from
  // not catching it, and nobody would learn that from a green.
  //
  // AND THE OBVIOUS CHEAPER SUBSTITUTE IS A DEAD INSTRUMENT HERE. `node --check`
  // exits 0 on ANY syntax error in a `.js` file that uses ESM syntax when the
  // tree has no `package.json` — measured on node v22.22.2, 2026-08-08:
  //
  //     printf 'export const a=1;\nconst y = 1 +;\n' > /tmp/b.js
  //     node --check /tmp/b.js ; echo $?     ->  0
  //     cp /tmp/b.js /tmp/b.mjs
  //     node --check /tmp/b.mjs ; echo $?    ->  1
  //
  // It is not blind to backticks; it is blind to EVERYTHING in that shape, and
  // 104 of 104 files under `src/` are that shape. `tools/` is `.mjs` and is
  // fine. So on the half of this tree a person edits most, this plant is the
  // only thing standing between a parse error and a blank screen.
  //
  // ANCHORED ON `<g id="map-nodes">` DELIBERATELY: mapboard.js names that id as
  // its PUBLIC HANDLE (two instruments key on it), so this plant is pinned to a
  // declared contract rather than to prose that may be reworded. The day it
  // moves anyway, `edit` throws and this prints UNPLANTABLE, which blocks — the
  // safe direction, and the reason no plant here is allowed to no-op quietly.
  { name: 'a SYNTAX error: backticks in a comment inside a template literal',
    expect: /missing \) after argument list/,
    apply: (t) => edit(t, 'src/ui/components/mapboard.js',
      /(\n(\s*))(<g id="map-nodes")/, '$1<!-- `map.js` -->$1$3') },
];

function copyTree() {
  const t = mkdtempSync(join(tmpdir(), 'linkcheck-'));
  for (const d of ROOTS) if (existsSync(join(ROOT, d))) cpSync(join(ROOT, d), join(t, d), { recursive: true });
  return t;
}

console.log(`linkcheck: every named import in the tree, resolved against a real export.\n`);

if (SELFTEST) {
  // UNTESTABLE IS NOT MISS. If the tree ALREADY carries a broken import, a
  // plant "being caught" is not evidence the plant was caught — the tool was
  // going to go red anyway. That is the conflation 39/40 exist as two lines to
  // avoid, and unknown blocks exactly as red does.
  const clean = copyTree();
  const base = await checkTree(clean);
  rmSync(clean, { recursive: true, force: true });
  if (base.broken.length) {
    console.log(`  UNTESTABLE — the tree already carries ${base.broken.length} broken import(s), so a`);
    console.log(`  plant going red proves nothing about the plant. Fix the tree, then re-run.`);
    for (const b of base.broken.slice(0, 4)) console.log(`    ${b.file}: ${b.err}`);
    console.log(`\nRESULT: UNTESTABLE — the tree carries ${base.broken.length} broken import(s) of its own, so the corpus could not be scored.`);
    process.exit(2);
  }
  let caught = 0;
  const unplantable = [];
  for (const p of PLANTS) {
    const t = copyTree();
    let hit = false, seen = '', why = null;
    try {
      try { p.apply(t); }
      catch (e) { if (e instanceof Unplantable) why = e.message; else throw e; }
      if (!why) {
        const r = await checkTree(t);
        seen = (r.broken.find((b) => p.expect.test(b.err)) || {}).err || (r.broken[0] || {}).err || '(nothing went red)';
        hit = r.broken.some((b) => p.expect.test(b.err));
      }
    } finally { rmSync(t, { recursive: true, force: true }); }
    if (why) {
      unplantable.push({ name: p.name, why });
      console.log(`  UNPLANTABLE  ${p.name}`);
      console.log(`               ${why}`);
      console.log(`               NOTHING WAS MEASURED here — this is not a miss, and the check is not accused.`);
      continue;
    }
    if (hit) caught++;
    console.log(`  ${hit ? 'CAUGHT     ' : 'MISSED     '} ${p.name}`);
    console.log(`               ${String(seen).split('\n')[0].slice(0, 120)}`);
  }
  if (unplantable.length) {
    console.log(`\nRESULT: UNPLANTABLE — ${unplantable.length} of ${PLANTS.length} plants never applied (${unplantable[0].why}), so the corpus could not be scored.`);
    process.exit(2);
  }
  console.log(`\nRESULT: ${caught}/${PLANTS.length} planted breakages went red, and the clean tree came back with 0.`);
  process.exit(caught === PLANTS.length ? 0 : 1);
}

const r = await checkTree(ROOT);
if (!RAW) for (const b of r.broken) console.log(`  BROKEN  ${b.file}\n          ${b.err}`);
console.log(`\nRESULT: ${r.total - r.broken.length}/${r.total} module graphs link, ${r.broken.length} broken (${r.skipped} frozen fixture module(s) excluded by path).`);
console.log(`
BOUNDARY — what a green from this tool does NOT mean:
  · LINKING IS NOT RUNNING. Every named import resolves to a real export. Not one
    module body was executed, so nothing here says a tool WORKS — only that it starts.
    release-shots must still be RUN by a person before a delivery.
  · a name that exists but is WRONG links green. This checks identity, never meaning.
  · dynamic import() targets are not followed, so a deleted dynamic target links green.
    The walk covers every in-tree module regardless of who imports it, which is why
    that gap is narrow — but it is a gap, and no regex is buying it back.
  · node builtins ARE imported (there is no source text to link), so they, and only
    they, are evaluated. Nothing in src/, tools/ or tests/ is.
  · build/ and dist/ are excluded: linking the generated bundle proves nothing about
    the sources it came from. That is tools/verify-shipped.mjs and tools/bundle.test.mjs.`);
process.exit(r.broken.length ? 1 : 0);
