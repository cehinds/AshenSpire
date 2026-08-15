#!/usr/bin/env node
// tools/buildversion.mjs — DERIVE the build version, and hold the line that
// nobody may type it.
//
// The reasoning for the SCHEME lives where the string lives, in
// src/buildversion.js. This file is the machinery and the check; read that
// header first or none of the below has a reason.
//
//   node tools/buildversion.mjs              print the digest and the version
//   node tools/buildversion.mjs --check      the SOP 5 detector (exit 1 = red)
//   node tools/buildversion.mjs --selftest   the known-bad corpus, watched red
//   node tools/buildversion.mjs --which D    which commit shipped digest D
//
// WHAT THE DIGEST COVERS, and it is a closed set stated in one place:
//
//     index.html · styles/** · src/** · assets/**
//
// FOUR SWEEPS, NOT AN IMPORT WALK, AND THAT IS DELIBERATE. tools/bundle.mjs
// discovers its modules by walking `import` from src/main.js. Re-implementing
// that walk here would be a second copy of the one thing this file exists to
// forbid, and it would fail in the silent direction: a module the bundler reads
// and my walk misses is a source change the version does not see. A whole-
// directory sweep cannot miss one. It is over-inclusive instead — an unimported
// file moves the string without moving the game — and over-inclusive is the
// side to be wrong on. src/buildversion.js states that trade in its own words.
//
// THE CONTAINMENT CLAIM IS CHECKED, NOT ASSUMED. `--check` proves the bundler
// reads nothing outside those four roots: every stylesheet href in index.html,
// every `url()` inside those stylesheets, and every module id recorded in the
// committed bundle must resolve inside the set. If the bundler ever grows a
// fifth input, this goes red rather than quiet.
//
// CRLF: canonicalized to LF before hashing, for text files only, decided by
// round-trip rather than by an extension table (a second MIME table is a second
// copy). Without it a Windows checkout of one commit and a Linux checkout of
// the same commit are two different builds — this repo has already paid once
// for a filesystem's opinion reaching a shipped artifact (tools/dirorder.mjs).
//
// BOUNDARY, printed by the tool itself and not only here: a green says the
// version is derived and singly-homed. It says nothing about whether the stamp
// is VISIBLE on any screen — that is ink, not source, and it is
// tools/buildstamp-shot.mjs with a browser.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirSortedSync } from './dirorder.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..');

/** The anchors tools/bundle.mjs and tools/serve.mjs replace between. */
export const MARKER_START = '/* BUILD_SOURCE_START */';
export const MARKER_END = '/* BUILD_SOURCE_END */';
/** What the committed source must always hold. A digest here is a typed version. */
export const PLACEHOLDER = 'UNSTAMPED';
export const VERSION_MODULE = 'src/buildversion.js';
/** Where the release half lives. Not here, and not in src/buildversion.js. */
export const RELEASE_HOME = 'src/content/index.js';

// 10 hex = 40 bits = 1.1e12 names. At ten thousand builds the chance any two
// collide is about 5e-5. Stated rather than felt, because "it's a hash, it's
// fine" is how a number nobody computed gets shipped.
export const DIGEST_CHARS = 10;

/** The closed set of digest inputs. One home; --check proves it is a superset. */
export const INPUT_ROOTS = Object.freeze(['index.html', 'styles', 'src', 'assets']);

/**
 * Row B arm 2: a SITE that declares a version — an identifier or object key
 * ending in `version`, bound to a string literal. The caller filters on the
 * key; the VALUE is captured to be REPORTED and is never compared, which is the
 * whole point of the arm.
 *
 * TWO PATTERNS, NOT ONE, AND THE SECOND HALF OF THIS COMMENT IS AN APOLOGY.
 * My first version of this was a single permissive pattern that let a quote sit
 * between the key and the colon, so JSON would fall out for free. Planted and
 * watched on the live tree, it returned TWO false positives:
 *
 *   src/ui/screens/profileNotice.js:81   ...a newer version' : 'We couldn’t...
 *
 * — the last WORD of an English sentence, with a ternary's colon read as an
 * assignment. So the two forms are now written separately and exactly: a bare
 * identifier takes NO quote before its colon, and a quoted key takes quotes on
 * BOTH sides. Prose cannot satisfy either. I had written into row B's own
 * comment that a predicate with standing false positives gets muted, and then
 * shipped one with two — caught only because I planted it instead of reading it.
 *
 * DERIVATION IS NOT A COPY, and that was the other false positive:
 *
 *   src/buildversion.js:104   export const BUILD_VERSION = `${RELEASE}+${SOURCE}`
 *
 * — the canonical composition this whole file exists to protect, reported as a
 * second home for the release. A value is a derivation, not a typed version,
 * when it interpolates and has no digits of its own left once the `${...}`
 * groups are removed. `${RELEASE}+${SOURCE}` reduces to `+` and is derivation;
 * `0.4.0 ${x}` still carries digits and is a copy wearing a template. Testing
 * merely "contains ${" would have been the looser rule and would have opened
 * exactly that hole.
 *
 * ON SCANNING tools/ — AND THIS PARAGRAPH IS A CORRECTION OF MY OWN, MEASURED
 * RATHER THAN REASONED. I first wrote here that row B "cannot be widened to
 * tools/, because a sweep that included tools/ would make this file match
 * itself" — the ai-disclosure trap (Sunna's D-S1: our own falsifier came back
 * red on a clean tree because the file it searched contained the thing it
 * searched for). Then I swept these two patterns over tools/*.mjs and looked.
 * SIX HITS, AND NOT ONE OF THEM IS IN THIS FILE. The stated reason was false.
 *
 * It is false by accident, which is the part worth keeping: the patterns match
 * an identifier, then `\s*`, then a quote — and inside this file's own regex
 * SOURCE the characters `\s*` are a backslash, an `s` and an asterisk, none of
 * which are whitespace. `VERSION_MODULE` and `RELEASE_HOME` are saved by the
 * other half, `/version$/i`, which their names do not satisfy. So the self-match
 * is LATENT, not absent: one ordinary rewrite of either pattern re-arms it.
 *
 * The conclusion survives, on different evidence. Widening to tools/ is still
 * not free — the six hits are `contentVersion: 'x'` twice in
 * profile-durability-probe.mjs, two PROSE values in saveroundtrip.mjs, a log
 * line assembled by concatenation in bundle.mjs, and the plant literal in this
 * tool's own corpus. All six are false positives, and six standing false
 * positives mute a row. Anyone widening this must deal with those AND re-check
 * the self-match, which today holds only by the spelling of a regex.
 */
const VERSION_SITES = Object.freeze([
  // a bare identifier: `version: '…'`, `const SHOWN_VERSION = '…'`. No quote
  // may sit between the key and the colon — that is what let prose through.
  /(?:^|[{(,;]|\b(?:const|let|var)\s+|\s)([A-Za-z_$][\w$]*)\s*[:=]\s*(['"`])([^'"`\n]*)\2/g,
  // a quoted key, so JSON is covered: `"version": "…"`. Quotes on BOTH sides.
  /(['"])([A-Za-z_$][\w$]*)\1\s*:\s*(['"`])([^'"`\n]*)\3/g,
]);

/**
 * True when a captured value COMPOSES a version rather than typing one. See the
 * comment above for why "has an interpolation" alone is too loose.
 */
function isDerived(value) {
  return value.includes('${') && !/\d/.test(value.replace(/\$\{[^}]*\}/g, ''));
}

/**
 * SECOND VERSION SITES THAT ARE KNOWN, STATED AND OPEN — not clean, not fresh.
 *
 * A site listed here resolves row B to UNKNOWN, which blocks exactly as red
 * does. It is NOT an exemption and it does not buy a green: it is the
 * difference between an instrument that is silent about a thing and an
 * instrument that names it, prints its current value on every run, and says who
 * owes the decision. `unknown` is never green (house law).
 *
 * REMOVAL CONDITION: delete an entry the day the question it names is answered.
 * The row then rules on that site by itself — PASS if the second home is gone,
 * RED if it is still there — with no help from this list.
 */
export const OPEN_SECOND_SITES = Object.freeze([
  Object.freeze({
    file: 'src/content/aiDisclosure.js',
    key: 'version',
    raised: '2026-08-16 (Bjorn found the inversion, Sten rebuilt the row)',
    why: "the About screen renders this string to a player while the build stamp on title/map/combat "
      + "renders the release — two numbers, two screens, live. Constantine APPROVED THIS WORDING "
      + "(b349bbd / #92), so which of the two should move is a Tier-2 call (SOP 1) and is his, not "
      + "this tool's and not the maker's. Marina is carrying the split to him with a picture. This "
      + "row's job is to stop the tree from reporting clean while it is open.",
  }),
]);

// ---------------------------------------------------------------------------
// the digest
// ---------------------------------------------------------------------------

function walk(root, rel, out) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) return;
  if (!statSync(abs).isDirectory()) { out.push(rel); return; }
  for (const entry of readdirSortedSync(abs, { withFileTypes: true })) {
    walk(root, `${rel}/${entry.name}`, out);
  }
}

/** Every input file, repo-relative, in one stable order on every filesystem. */
export function inputFiles(root = REPO_ROOT) {
  const out = [];
  for (const r of INPUT_ROOTS) walk(root, r, out);
  return out;
}

/**
 * Canonical bytes for hashing. Text files lose CRLF; anything that does not
 * survive a utf8 round-trip is hashed raw, so a .webp is never mangled into an
 * agreement with a different .webp.
 */
export function canonicalBytes(buf) {
  const asText = buf.toString('utf8');
  if (!Buffer.from(asText, 'utf8').equals(buf)) return buf;
  return Buffer.from(asText.replace(/\r\n/g, '\n'), 'utf8');
}

/** sourceDigest(root) → { digest, files, bytes, manifest } — pure, no writes. */
export function sourceDigest(root = REPO_ROOT) {
  const files = inputFiles(root);
  const h = createHash('sha256');
  let bytes = 0;
  const manifest = [];
  for (const rel of files) {
    const canon = canonicalBytes(readFileSync(resolve(root, rel)));
    const per = createHash('sha256').update(canon).digest('hex');
    // The PATH is hashed too: a rename with no content change is a different
    // source, and a manifest of hashes alone cannot tell you so.
    h.update(rel).update('\0').update(per).update('\n');
    bytes += canon.length;
    manifest.push({ rel, sha: per, bytes: canon.length });
  }
  return { digest: h.digest('hex').slice(0, DIGEST_CHARS), files: files.length, bytes, manifest };
}

// ---------------------------------------------------------------------------
// the stamp — ONE HOME for the injection, called by bundle.mjs and serve.mjs
// ---------------------------------------------------------------------------

/**
 * stampSource(text, digest) → the module source with SOURCE derived.
 * Throws rather than returning the text unchanged: an injector that silently
 * no-ops ships `UNSTAMPED` to a player and nothing says a word.
 */
export function stampSource(text, digest) {
  const a = text.indexOf(MARKER_START);
  const b = text.indexOf(MARKER_END);
  if (a < 0 || b < 0 || b < a) {
    throw new Error(`${VERSION_MODULE} has lost its BUILD_SOURCE markers — the build anchors on them`);
  }
  if (text.indexOf(MARKER_START, a + 1) >= 0 || text.indexOf(MARKER_END, b + 1) >= 0) {
    throw new Error(`${VERSION_MODULE} has more than one BUILD_SOURCE marker pair`);
  }
  const head = text.slice(0, a + MARKER_START.length);
  const tail = text.slice(b);
  return `${head}\nexport const SOURCE = '${digest}';\n${tail}`;
}

/** stampFile(root, digest) → stamped source of the version module. */
export function stampFile(root, digest) {
  return stampSource(readFileSync(resolve(root, VERSION_MODULE), 'utf8'), digest);
}

/** The release string, read from its one home rather than re-typed. */
export function release(root = REPO_ROOT) {
  const m = /version:\s*'([^']+)'/.exec(readFileSync(resolve(root, RELEASE_HOME), 'utf8'));
  if (!m) throw new Error(`no version found in ${RELEASE_HOME} — the release half has lost its home`);
  return m[1];
}

/** buildVersion(root) → what a player will read, composed the one way. */
export function buildVersion(root = REPO_ROOT) {
  return `${release(root)}+${sourceDigest(root).digest}`;
}

// ---------------------------------------------------------------------------
// the check
// ---------------------------------------------------------------------------

const BUNDLE = 'build/AshenSpire.html';

/** Module ids the committed bundle actually carries: `"src/x.js": function (`. */
function bundledModuleIds(text) {
  const ids = [];
  const re = /"((?:src|tools|tests)\/[^"]+\.js)":\s*function \(/g;
  let m;
  while ((m = re.exec(text)) !== null) ids.push(m[1]);
  return ids;
}

function insideRoots(rel) {
  return INPUT_ROOTS.some((r) => rel === r || rel.startsWith(`${r}/`));
}

/**
 * check(root) → { rows, red, unknown } — each row states its own verdict, and a
 * row that could not be answered resolves to red, never to the softer bucket
 * (SOP 2).
 *
 * THREE STATES, NOT TWO. `ok: true` passes, `ok: false` is red, and `ok: null`
 * is UNKNOWN — a question this tool put itself in a position to ask and cannot
 * answer, because answering it is somebody else's call. Unknown BLOCKS: it is
 * counted into `red` for the exit code and it is never printed as a pass. The
 * bucket exists so that "we know about this and it is open" stops being
 * indistinguishable from "we looked and the tree is clean" — which is the state
 * row B was in, silently, for as long as the About screen has disagreed with
 * the build stamp.
 */
export function check(root = REPO_ROOT) {
  const rows = [];
  const add = (ok, name, detail) => { rows.push({ ok, name, detail }); return ok; };
  const src = (rel) => readFileSync(resolve(root, rel), 'utf8');

  // A — THE DIGEST IS NEVER COMMITTED. The version is derived or it is typed;
  //     there is no third state, and this is where typing it would show up.
  let ver = '';
  try { ver = src(VERSION_MODULE); } catch { /* reported below */ }
  if (!ver) {
    add(false, 'A ONE HOME', `${VERSION_MODULE} is missing — there is no home to check`);
  } else {
    const between = ver.slice(ver.indexOf(MARKER_START) + MARKER_START.length, ver.indexOf(MARKER_END));
    const ok = /^\s*export const SOURCE = 'UNSTAMPED';\s*$/.test(between)
      && ver.includes(MARKER_START) && ver.includes(MARKER_END);
    add(ok, 'A ONE HOME',
      ok ? `${VERSION_MODULE} holds the placeholder; the digest is injected, never committed`
        : `${VERSION_MODULE} between the markers is not the placeholder — a digest typed into source is a version ASSERTED, not derived:\n      ${between.trim().slice(0, 120)}`);
  }

  // B — NO SECOND COPY OF THE RELEASE. TWO ARMS, AND THE SECOND EXISTS BECAUSE
  //     THE FIRST ONE TURNS AROUND.
  //
  //     ARM 1 — exact string equality with the release, over the files that
  //     reach the shipped artifact. It is right about the defect's BIRTH (each
  //     of palworld's three drifts began as agreement) and it is the only arm
  //     that can see a copy at an UNNAMED site — a bare literal inside a
  //     template with no identifier attached to it. It is kept for that.
  //
  //     ARM 2 — and here is the finding. Equality is a PROXY for copy-hood, and
  //     Bjorn watched the proxy invert, in a copied tree, both ways:
  //
  //         aiDisclosure version '0.4.0'   agreeing → RED
  //         aiDisclosure version '0.4.x'   drifted  → PASS
  //
  //     Red-at-agreement is correct. GREEN-AT-DRIFT IS THE DEFECT: the row
  //     fired while the copy was still harmless and went quiet the moment the
  //     harm landed — two different numbers rendered to a player on two
  //     different screens, and the instrument built to catch exactly that
  //     reporting clean. Marina's MR-251, which generalises it:
  //
  //       An instrument whose predicate is a proxy will invert wherever the
  //       proxy and the subject diverge — and the moment of divergence is
  //       usually the moment of harm.
  //
  //     So arm 2 does not WIDEN the proxy, it REMOVES it. It looks for a SITE
  //     that declares a version — an identifier or object key ending in
  //     `version`, bound to a string literal — and it never reads the value to
  //     decide. A predicate that does not compare the value cannot invert when
  //     the value drifts. The value is reported, never tested.
  //
  //     WHY A SITE AND NOT A SHAPE, measured before it was written rather than
  //     argued: on this tree the site predicate returns 1 hit and it is the real
  //     defect. The obvious alternative — a version-SHAPED literal, /\d+\.\d+/ —
  //     returns 37, of which 36 are SVG stroke widths in src/ui/assets.js and
  //     `"scale"` values in assets/equipment/manifest.json. A predicate with 36
  //     standing false positives gets muted, and a muted check is arm 1's defect
  //     again by another route.
  //
  //     Comments are excluded by BOTH arms, unchanged: SOP 5's words are "prose
  //     mention ≠ copy — but the moment anything ASSERTS IT EQUAL to the source,
  //     it's a consumer". A `//` line asserts nothing. The convention is
  //     bundle.mjs's, not a new one, so there is one idea of what a comment is
  //     in this build.
  //
  //     BOUNDARY, and it is a real hole, not a formality: a copy that has BOTH
  //     drifted AND sits at an unnamed site is invisible to both arms — a bare
  //     `Ashen Spire 0.4.x` inside a template literal with no `version` key on
  //     it. Arm 1 cannot see it (the value differs) and arm 2 cannot see it (no
  //     site declares it). Nothing in this file closes that; it is named here so
  //     the green states its own extent.
  const rel = release(root);
  const copies = [];
  const sites = [];
  let commentHits = 0;
  const isComment = (t) => t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  for (const f of inputFiles(root)) {
    if (f === RELEASE_HOME) continue;
    if (!/\.(js|css|html|json)$/.test(f)) continue;
    const text = readFileSync(resolve(root, f), 'utf8');
    text.split('\n').forEach((line, i) => {
      const t = line.trim();
      // arm 1 — the value equals the release
      if (line.includes(`'${rel}'`) || line.includes(`"${rel}"`) || line.includes(`\`${rel}\``)) {
        if (isComment(t)) commentHits += 1;
        else copies.push(`${f}:${i + 1}  ${t.slice(0, 90)}`);
      }
      // arm 2 — a site DECLARES a version; the value is recorded, never tested
      if (isComment(t)) return;
      for (const [n, re] of VERSION_SITES.entries()) {
        // bare-identifier form captures (key, quote, value); quoted-key form
        // captures (quote, key, quote, value) — hence the index shift.
        const [ki, vi] = n === 0 ? [1, 3] : [2, 4];
        for (const m of line.matchAll(re)) {
          if (!/version$/i.test(m[ki]) || isDerived(m[vi])) continue;
          sites.push({ file: f, line: i + 1, key: m[ki], value: m[vi] });
        }
      }
    });
  }

  // A site that is KNOWN AND OPEN is not a clean tree and not a fresh defect.
  // It resolves to unknown, which blocks — never to the softer bucket (SOP 2).
  const open = sites.filter((s) => OPEN_SECOND_SITES.some((o) => o.file === s.file && o.key === s.key));
  const unstated = sites.filter((s) => !open.includes(s));
  const show = (s) => `${s.file}:${s.line}  ${s.key} = '${s.value}'`;

  if (copies.length || unstated.length) {
    add(false, 'B NO SECOND COPY',
      `the release has a second home under ${INPUT_ROOTS.join(', ')}:`
      + (copies.length ? `\n      [arm 1 · the value equals the release '${rel}']\n      ${copies.join('\n      ')}` : '')
      + (unstated.length ? `\n      [arm 2 · a second site declares a version; agreeing or drifted, it is a copy]\n      ${unstated.map(show).join('\n      ')}` : ''));
  } else if (open.length) {
    add(null, 'B NO SECOND COPY',
      `UNKNOWN — ${open.length} second version site, stated and open, not a clean tree and not a fresh defect:`
      + open.map((s) => {
        const o = OPEN_SECOND_SITES.find((x) => x.file === s.file && x.key === s.key);
        return `\n      ${show(s)}   (release home holds '${rel}')\n        raised ${o.raised}: ${o.why}`;
      }).join('')
      + `\n      arm 1 alone reported this tree GREEN — that is the inversion this row was rebuilt for.`);
  } else {
    add(true, 'B NO SECOND COPY',
      `no second home for the release under ${INPUT_ROOTS.join(', ')}: no file re-types '${rel}'`
      + ` outside ${RELEASE_HOME} (arm 1), and no other site declares a version at all (arm 2,`
      + ` which does not read the value, so it does not go quiet when the value drifts).`
      + ` ${commentHits} prose mention${commentHits === 1 ? '' : 's'} in comments, which assert nothing and are not copies.`);
  }

  // C — EVERY CONSUMER DERIVES. The three surfaces he named must read the one
  //     module. A screen that prints a version it computed itself is a copy
  //     that agrees today.
  const CONSUMERS = ['src/ui/screens/title.js', 'src/ui/screens/map.js', 'src/ui/screens/combat.js'];
  const missing = CONSUMERS.filter((f) => !/buildStampHtml/.test(src(f)));
  add(missing.length === 0, 'C THREE CONSUMERS',
    missing.length === 0
      ? `title, map and combat all render through ui/components/buildstamp.js`
      : `these named surfaces do not derive the version: ${missing.join(', ')}`);

  // D — THE CONTAINMENT CLAIM. The digest's four roots must be a superset of
  //     what the bundler reads, or a real source change can move the build
  //     without moving the string.
  const outside = [];
  const index = src('index.html');
  const hrefs = [...index.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const h of hrefs) {
    const r = relative(root, resolve(root, h)).split('\\').join('/');
    if (!insideRoots(r)) outside.push(`index.html → ${h}`);
    else {
      const css = readFileSync(resolve(root, h), 'utf8');
      for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
        if (/^(data:|https?:|\/\/)/i.test(m[2])) continue;
        const t = relative(root, resolve(dirname(resolve(root, h)), m[2].split(/[?#]/)[0])).split('\\').join('/');
        if (!insideRoots(t)) outside.push(`${h} → url(${m[2]})`);
      }
    }
  }
  let bundleText = null;
  try { bundleText = src(BUNDLE); } catch { /* reported */ }
  if (bundleText == null) {
    outside.push(`${BUNDLE} is missing — the module list cannot be bound to the sweep`);
  } else {
    for (const id of bundledModuleIds(bundleText)) {
      if (!insideRoots(id)) outside.push(`${BUNDLE} carries module ${id}`);
      else if (!existsSync(resolve(root, id))) outside.push(`${BUNDLE} carries module ${id}, absent from this tree`);
    }
  }
  add(outside.length === 0, 'D CONTAINMENT',
    outside.length === 0
      ? `every stylesheet, css asset and bundled module resolves inside ${INPUT_ROOTS.join(', ')}`
      : `the build reads outside the digest's roots — the version can miss a real change:\n      ${outside.join('\n      ')}`);

  // E — THE SHIPPED BUNDLE CARRIES THIS SOURCE'S VERSION. Narrower than
  //     rebuild-matches on purpose and it does not replace it: that one is
  //     generative and total, this one is a single literal and costs no build.
  //     Its own value is the SOP 5 question — is the stamp on the box the one
  //     this tree derives — which is exactly the question that drifted three
  //     times in palworld-server-tools.
  if (bundleText == null) {
    add(false, 'E SHIPPED STAMP', `${BUNDLE} is missing — nothing to read a stamp from`);
  } else {
    const want = sourceDigest(root).digest;
    const found = [...bundleText.matchAll(/const SOURCE = '([^']*)'/g)].map((m) => m[1]);
    const ok = found.length === 1 && found[0] === want;
    add(ok, 'E SHIPPED STAMP',
      ok ? `${BUNDLE} carries SOURCE '${want}', which is this tree's digest`
        : `${BUNDLE} carries ${found.length === 1 ? `SOURCE '${found[0]}'` : `${found.length} SOURCE literals`}, this tree derives '${want}' — the shipped stamp is not this source`);
  }

  // `!r.ok` catches false AND null on purpose: unknown blocks exactly as red
  // does, and there is no third exit code that means "carry on anyway".
  return { rows, red: rows.some((r) => !r.ok), unknown: rows.some((r) => r.ok === null) };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printCheck(root, label) {
  const { rows, red, unknown } = check(root);
  for (const r of rows) {
    console.log(`  ${r.ok === null ? 'UNK ' : r.ok ? 'PASS' : 'RED '}  [${r.name}] ${r.detail}`);
  }
  console.log('');
  if (!red) console.log(`buildversion: OK — ${rows.length} checks passed`);
  else if (rows.some((r) => r.ok === false)) console.log(`buildversion: RED — ${label}`);
  else {
    console.log(`buildversion: UNKNOWN — ${rows.filter((r) => r.ok === null).length} row(s) name an open question this tool cannot answer.`);
    console.log('  UNKNOWN BLOCKS. It is not a pass and it is not a soft red: the tree is not');
    console.log('  clean, and the decision that would settle it is not this tool\'s to make.');
  }
  return red;
}

function boundary() {
  console.log('');
  console.log('BOUNDARY — what a green here does NOT mean:');
  console.log('  · nothing about INK. This reads source and one literal in the bundle; whether');
  console.log('    the stamp is drawn, or drawn where an eye lands, is tools/buildstamp-shot.mjs.');
  console.log('  · nothing about dist/. verify-shipped check B owns dist == build; one home each.');
  console.log('  · check E is ONE LITERAL, not the artifact. A bundle that agrees on the version');
  console.log('    and differs everywhere else passes it — that is tools/rebuild-matches.mjs,');
  console.log('    which is generative and which this deliberately does not restate.');
  console.log('  · the release NUMBER is not judged here, only its singleness. Choosing it is a');
  console.log('    Tier-2 call (SOP 1); SOP 5 automates the checking, never the choosing.');
  console.log('  · row B sweeps INPUT_ROOTS ONLY, so a second copy of the release living in');
  console.log('    tools/ is invisible to it — tools/launch.mjs carried exactly that for as long');
  console.log('    as the launcher has existed. Widening is not free: swept over tools/*.mjs the');
  console.log('    arm-2 patterns return 6 hits, all false positives, and six of those mute a row.');
  console.log('  · row B has one hole it cannot close: a copy that has BOTH drifted AND sits at');
  console.log('    an unnamed site — a bare `0.4.x` inside a template with no version key on it.');
  console.log('    Arm 1 misses it (value differs), arm 2 misses it (no site declares it).');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);

  if (args.includes('--which')) {
    const d = args[args.indexOf('--which') + 1];
    if (!d) { console.error('buildversion: --which needs a digest'); process.exit(2); }
    try {
      const out = execFileSync('git', ['-C', REPO_ROOT, 'log', '-S', d, '--oneline', '--', BUNDLE], { encoding: 'utf8' }).trim();
      console.log(out || `buildversion: no commit of ${BUNDLE} carries '${d}'`);
      process.exit(out ? 0 : 1);
    } catch (e) {
      console.error(`buildversion: git could not answer — ${e.message}`);
      process.exit(2);
    }
  }

  // Spawned, not imported. The corpus imports check() from this file, and an
  // in-process `await import()` here is an ESM cycle with a top-level await in
  // it — which does not throw, it HANGS. A tool that hangs instead of ruling is
  // the silent bucket wearing a different coat, so the corpus runs as its own
  // program and this passes its exit code through untouched.
  if (args.includes('--selftest')) {
    const r = spawnSync(process.execPath, [resolve(HERE, 'buildversion-selftest.mjs')], { stdio: 'inherit' });
    process.exit(r.status == null ? 2 : r.status);
  }

  if (args.includes('--check')) {
    const red = printCheck(REPO_ROOT, 'the version is not singly-homed and derived (rows above)');
    boundary();
    process.exit(red ? 1 : 0);
  }

  const d = sourceDigest();
  console.log(`buildversion: ${release()}+${d.digest}`);
  console.log(`  digest over ${d.files} files, ${d.bytes} canonical bytes, under ${INPUT_ROOTS.join(' · ')}`);
  console.log(`  which commit shipped it: node tools/buildversion.mjs --which ${d.digest}`);
  process.exit(0);
}
