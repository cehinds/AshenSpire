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
// TWO FACTS, TWO JOBS, AND THIS FILE DERIVES BOTH:
//
//     BUILD 0.4.0.0618 · src 2d5a8cc240
//           └─ ORDERS ─┘   └ IDENTIFIES ┘
//
// The ORDINAL orders (Constantine, 2026-08-16: "the one with the higher value
// ... at th ened shoudl be the newest build"). The DIGEST identifies. Neither
// can do the other's job, and the string used to try to make the digest do
// both. Whose home is whose is in src/buildversion.js; the arithmetic is here.
//
// WHAT THE DIGEST COVERS, and it is a closed set stated in one place:
//
//     index.html · styles/** · src/** · assets/**
//     tools/bundle.mjs · tools/buildversion.mjs · tools/dirorder.mjs
//
// `buildordinal.json` is deliberately OUTSIDE that set — see INPUT_ROOTS for
// the fixpoint that forces it, and rows F and G for the lock that makes it
// safe.
//
// FOUR CONTENT SWEEPS, NOT AN IMPORT WALK, AND THAT IS DELIBERATE. tools/bundle.mjs
// discovers its modules by walking `import` from src/main.js. Re-implementing
// that walk here would be a second copy of the one thing this file exists to
// forbid, and it would fail in the silent direction: a module the bundler reads
// and my walk misses is a source change the version does not see. A whole-
// directory sweep cannot miss one. It is over-inclusive instead — an unimported
// file moves the string without moving the game — and over-inclusive is the
// side to be wrong on. src/buildversion.js states that trade in its own words.
//
// THE CONTAINMENT CLAIM IS CHECKED, NOT ASSUMED. `--check` proves player-content
// reads stay inside those four roots. The three small files that decide HOW those
// bytes become an artifact are identity inputs too, without widening the player-
// content/version-site scans into tools/ and their known false positives.
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
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
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

/** The ordinal's own anchors and placeholder — same rule, a different fact. */
export const ORD_MARKER_START = '/* BUILD_ORDINAL_START */';
export const ORD_MARKER_END = '/* BUILD_ORDINAL_END */';
export const ORD_PLACEHOLDER = 'UNBUMPED';

/** The build date's anchors and placeholder. A fact of history, like the ordinal. */
export const DATE_MARKER_START = '/* BUILD_DATE_START */';
export const DATE_MARKER_END = '/* BUILD_DATE_END */';
export const DATE_PLACEHOLDER = 'UNDATED';

/** The run path's anchors and placeholder — the one fact only the injector knows. */
export const RUN_MARKER_START = '/* BUILD_RUNPATH_START */';
export const RUN_MARKER_END = '/* BUILD_RUNPATH_END */';
export const RUN_PLACEHOLDER = 'UNPLACED';

/**
 * THE TWO RUN PATHS, NAMED ONCE. README offers exactly these two and nothing on
 * a screen has ever told them apart. The words are the player's, not ours: a
 * bug report says which file they opened, never which module graph served it.
 */
export const RUN_PATH_BUNDLE = 'standalone file';
export const RUN_PATH_SERVE = 'source tree';

/** Where the ORDERING half lives. Outside the digest roots, and see below. */
export const ORDINAL_HOME = 'buildordinal.json';
/**
 * UNPADDED, AND THE GUARANTEE IT COSTS IS NAMED RATHER THAN DROPPED QUIETLY.
 *
 * Constantine, 2026-09-01, re-reading the stamp he had been shipped: "I must
 * have misunderstood the ordinal ... I thought it was going to be something
 * like 0.5.3.2" — and then the rule, in his words: the tail "should restart the
 * ordinal to 0.5.4.0 and increment from there". A counter that restarts per
 * candidate is small by construction, and `0.5.4.0000` is not the string he
 * asked for.
 *
 * The old scheme padded to four so that a naive STRING sort of the whole
 * version agreed with eye order. That property is gone and cannot be recovered
 * by padding, because the candidate now lives in the third component: `0.5.10.0`
 * string-sorts below `0.5.9.0` no matter how the tail is padded. Version
 * comparison is COMPONENT-WISE NUMERIC from here — split on `.`, compare as
 * numbers — which is what every semver reader already does and what row H
 * enforces on the one axis that can still be checked mechanically.
 */
export const ORDINAL_PAD = 1;

// 10 hex = 40 bits = 1.1e12 names. At ten thousand builds the chance any two
// collide is about 5e-5. Stated rather than felt, because "it's a hash, it's
// fine" is how a number nobody computed gets shipped.
export const DIGEST_CHARS = 10;

/**
 * The closed set of player-content inputs. BUILD_IDENTITY_FILES beside it owns
 * the small executable seam that turns those inputs into an artifact.
 *
 * `buildordinal.json` IS DELIBERATELY NOT IN EITHER SET, and the reason is a
 * fixpoint, not an oversight: the ordinal is bumped WHEN THE DIGEST MOVES, so
 * covering it would make every bump move the digest, which would demand another
 * bump, forever. It sits at the repo root — outside all four roots — so nothing
 * has to be carved out of a sweep, and the "a whole-directory walk cannot miss
 * one" property this file rests on stays whole.
 *
 * WHAT THAT COSTS, STATED HERE BECAUSE IT IS THE PRICE OF THE WHOLE SCHEME: a
 * hand-edit of that file does not move the digest, so the build will not
 * correct it and the wrong number would ship in silence. That is SOP 5 row A's
 * subject arriving through a new door, and rows F and G below are the door's
 * lock. They are not a follow-up; they are why this is allowed to exist.
 */
export const INPUT_ROOTS = Object.freeze(['index.html', 'styles', 'src', 'assets']);

/**
 * The closed executable seam that turns INPUT_ROOTS into the shipped bundle.
 * These files are hashed but are deliberately not scanned as player content:
 * changing EOL normalization, stamp injection, or directory ordering must move
 * build identity even when the authored game bytes do not.
 */
export const BUILD_IDENTITY_FILES = Object.freeze([
  'tools/bundle.mjs',
  'tools/buildversion.mjs',
  'tools/dirorder.mjs',
]);

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
 * CONTRACT COLUMNS THAT END IN `version` AND ARE NOT VERSION SITES.
 *
 * Arm 2 finds a SITE by its key. One key on this tree ends in `version` because
 * a documented table contract names its column so, not because it declares the
 * build: the successor packet's `source_export_recipe_and_tool_version`, one of
 * the twelve columns the art runbook requires by name
 * (docs/governance/RUNBOOKS/art.md §3). The key cannot be renamed away — the
 * contract owns the name — so the exemption is written HERE, one site at a
 * time, with the file, the key and the reason, and it holds only while the
 * value is prose: a sentence (two or more words) with no version-shaped number
 * in it. Type `0.4.0` or `9.9.z` into that column and arm 2 sees the site again
 * (the selftest plants exactly that).
 *
 * WHY NOT A SHAPE RULE FOR EVERY SITE, measured rather than argued: the first
 * cut of this exemption cleared any digitless value anywhere — and a second
 * copy that drifts to a LABEL (`const SHOWN_VERSION = 'latest'`) walked through
 * it, reproduced in a copied tree. A version site that has drifted to a word
 * is still a second home for the version, so a value-shape rule alone cannot
 * be the boundary; the site must be named. (An earlier cut, "no digit at all",
 * failed on the column's own sentence, whose `open_items_not_closed_by_d1`
 * carries a digit — recorded so nobody re-derives either.)
 */
const CONTRACT_COLUMN_SITES = Object.freeze([
  {
    file: 'assets/classes/successor-packet.manifest.json',
    key: 'source_export_recipe_and_tool_version',
    why: 'art runbook §3 twelve-column manifest contract; the value is the column\'s prose answer, not a build version',
  },
]);

/** True when a captured value is a SENTENCE with no version-shaped number. */
function isProse(value) {
  return /\S\s+\S/.test(value.trim()) && !/\d+\.\d+/.test(value) && !/^\s*v?\d+\s*$/.test(value);
}

/** True for a named contract column whose value is prose — the only clearance. */
function isContractColumn(file, key, value) {
  return CONTRACT_COLUMN_SITES.some((c) => c.file === file && c.key === key) && isProse(value);
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
// EMPTY SINCE 2026-08-16, AND THE EMPTINESS IS THE RECORD OF AN ANSWER.
//
// The one entry was `src/content/aiDisclosure.js` / `version` — the About
// screen rendering a hand-typed '0.4.x' while title/map/combat rendered the
// derived stamp. The entry said which of the two should move was a Tier-2 call
// and Constantine's. He made it: shown four About lines, he picked A4 — "a4 is
// really nice" — and A4 carries the derived build version. The field is gone
// from that module, so this entry met its own removal condition and was
// deleted rather than amended. Row B now rules on that site with no help from
// here: PASS because the second home is gone, RED the day one comes back.
export const OPEN_SECOND_SITES = Object.freeze([]);

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

/** Content plus the exact generator closure, in one stable order. */
export function identityFiles(root = REPO_ROOT) {
  const files = [...inputFiles(root)];
  for (const rel of BUILD_IDENTITY_FILES) {
    if (!existsSync(resolve(root, rel))) {
      throw new Error(`build identity input is missing: ${rel}`);
    }
    files.push(rel);
  }
  return [...new Set(files)].sort();
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
  const files = identityFiles(root);
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

/** One marker pair, replaced. Shared by both injections so they cannot drift. */
function between(text, start, end, name, line) {
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a < 0 || b < 0 || b < a) {
    throw new Error(`${VERSION_MODULE} has lost its ${name} markers — the build anchors on them`);
  }
  if (text.indexOf(start, a + 1) >= 0 || text.indexOf(end, b + 1) >= 0) {
    throw new Error(`${VERSION_MODULE} has more than one ${name} marker pair`);
  }
  return `${text.slice(0, a + start.length)}\n${line}\n${text.slice(b)}`;
}

/**
 * stampSource(text, digest, { ordinal, built, runPath }) → the module source
 * with SOURCE derived, and each optional fact derived when one is supplied.
 *
 * Throws rather than returning the text unchanged: an injector that silently
 * no-ops ships `UNSTAMPED` to a player and nothing says a word.
 *
 * THE OPTIONS ARE OPTIONAL AND THAT IS THE SERVE PATH, NOT A CONVENIENCE.
 * tools/serve.mjs must never bump — a dev server that bumped would burn an
 * ordinal per reload and dirty the tree doing it — so when the working copy has
 * drifted from the recorded digest it passes neither the ordinal nor the date
 * and the page keeps `UNBUMPED` / `UNDATED`. A page with no build number is
 * honest; a page wearing an older build's number is a lie that sorts, and a
 * page wearing an older build's DATE is the same lie with a friendlier face.
 *
 * THE RUN PATH IS NEVER OPTIONAL IN PRACTICE AND IS OPTIONAL IN THE SIGNATURE.
 * Only an injector can know which path it is, so only an injector may pass it —
 * but a caller that forgets leaves `UNPLACED`, which is the true answer for a
 * page nobody injected. A default of either label would be the guess this
 * field exists to replace.
 *
 * NAMED RATHER THAN POSITIONAL: three optional trailing values in a row is how
 * a date lands in an ordinal's slot and ships a plausible wrong string.
 */
export function stampSource(text, digest, { ordinal = null, built = null, runPath = null } = {}) {
  let out = between(text, MARKER_START, MARKER_END, 'BUILD_SOURCE', `export const SOURCE = '${digest}';`);
  if (ordinal !== null) {
    out = between(out, ORD_MARKER_START, ORD_MARKER_END, 'BUILD_ORDINAL', `export const ORDINAL = '${ordinal}';`);
  }
  if (built !== null) {
    out = between(out, DATE_MARKER_START, DATE_MARKER_END, 'BUILD_DATE', `export const BUILT = '${built}';`);
  }
  if (runPath !== null) {
    out = between(out, RUN_MARKER_START, RUN_MARKER_END, 'BUILD_RUNPATH', `export const RUN_PATH = '${runPath}';`);
  }
  return out;
}

/** stampFile(root, digest, opts?) → stamped source of the version module. */
export function stampFile(root, digest, opts = {}) {
  return stampSource(readFileSync(resolve(root, VERSION_MODULE), 'utf8'), digest, opts);
}

// ---------------------------------------------------------------------------
// the ordinal — the half that ORDERS
// ---------------------------------------------------------------------------

/** padOrdinal(618) → '0618'. Fixed width or the string sort is a coin toss. */
export function padOrdinal(n) {
  return String(n).padStart(ORDINAL_PAD, '0');
}

/**
 * A build as a COMPARABLE TUPLE — the version's components, then the tail.
 * `0.5.4` + 2 → [0, 5, 4, 2]. Non-numeric components sort as 0 rather than
 * throwing, because this is a comparison and not a validator; row F is where a
 * malformed release is refused.
 */
export function versionTuple(releaseString, ordinal) {
  const parts = versionPrefix(releaseString).split('.');
  // NO SUBSTITUTED ZEROES. This coerced a non-numeric component to 0 and said
  // in its own comment that row F refused a malformed release — a guarantee I
  // asserted without reading the row, which does not make it. Review on #579
  // shipped `0.6.x` through all eight checks that way: F compared the two
  // release strings and found them equal, and H read the invented `0.6.0.0` as
  // a rise over `0.5.4.4`. An unorderable version returns null here and the
  // callers refuse rather than rank it.
  if (!parts.every((n) => /^\d+$/.test(n))) return null;
  return [...parts.map(Number), ordinal];
}

/**
 * The release syntax the scheme admits: three numeric components, optionally
 * carrying a pre-release tag. Returns null when it parses, or the reason.
 */
export function releaseSyntaxError(releaseString) {
  if (/^\d+\.\d+\.\d+$/.test(releaseString)) return null;
  if (/^\d+\.\d+\.\d+-[A-Za-z]+\.\d+$/.test(releaseString)) return null;
  return `'${releaseString}' is not a release: the scheme admits three numeric components`
    + ` (0.5.4), optionally with a pre-release tag (0.5.0-rc.4). A component that is not a number`
    + ` cannot be ordered against one that is, so nothing downstream can rank this build.`;
}

/** Component-wise numeric compare of two versionTuple results. */
export function compareVersions(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * The candidate-bearing prefix of a release string: `0.5.0-rc.4` → `0.5.4`.
 *
 * Constantine's scheme puts the CANDIDATE NUMBER in the third component, so the
 * pre-release tag is not decoration on the patch number — it IS the third
 * component, and the patch number a candidate carries (`0.5.0`'s `0`) is the
 * release it is auditioning for rather than anything about this build.
 *
 * A release with no `-rc.N` keeps its own three components, so a shipped
 * `0.5.0` reads `0.5.0.<n>`. THAT SORTS BELOW ITS OWN CANDIDATES and the cost
 * is stated where the code is rather than discovered later: under this scheme a
 * release must be numbered past its last candidate to outsort it. Raised with
 * the owner when the directive was given; his call, recorded here.
 */
export function versionPrefix(releaseString) {
  const m = /^(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$/.exec(releaseString);
  if (m) return `${m[1]}.${m[2]}.${m[4]}`;
  return releaseString;
}

/**
 * readOrdinal(root) → { ordinal, digest, built } from its one home. Throws if
 * absent. `built` rides in this file rather than in one of its own for the
 * reason the ordinal does: it is a fact of history that the build computes once
 * and commits, and two files written under one condition are one fact with two
 * homes waiting to disagree.
 */
export function readOrdinal(root = REPO_ROOT) {
  const raw = JSON.parse(readFileSync(resolve(root, ORDINAL_HOME), 'utf8'));
  return {
    ordinal: Number(raw.ordinal), digest: raw.digest ?? null, built: raw.built ?? null,
    // The release the ordinal was counted under. Without it a reset is
    // indistinguishable from a hand-edit that lowered the number, and row H
    // could not tell the two apart.
    release: raw.release ?? null,
  };
}

/** The build date, UTC, as a build writes it. One format, one place. */
export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * bumpOrdinal(root) → { ordinal, bumped, digest } — THE BUILD'S ONE WRITE.
 *
 * Rewrites ORDINAL_HOME only when the tree's digest differs from the recorded
 * one. That single condition is what keeps tools/rebuild-matches.mjs green: a
 * rebuild of an unchanged tree finds the digests equal, writes nothing, injects
 * the same number and reproduces the committed bundle byte for byte.
 *
 * THE NEW VALUE IS `recorded + 1`, RESET TO 0 WHEN THE RELEASE STRING MOVES.
 * Constantine, 2026-09-01: the tail "should restart the ordinal to 0.5.4.0 and
 * increment from there". So this counts BUILDS WITHIN A CANDIDATE, and the
 * candidate itself is the third component, read from the release home.
 *
 * IT NO LONGER CONSULTS `rev-list --count`, AND THAT IS A SIMPLIFICATION THE
 * NEW RULE EARNS RATHER THAN A CHECK QUIETLY DROPPED. The old value was
 * `max(recorded + 1, count)`: the count supplied Constantine's original "commit
 * count" ask, and the `max` existed because the count ALONE does not move
 * between two builds of one commit. Under a per-candidate counter the count
 * cannot be the value — it does not reset — so the floor is the whole rule, and
 * `recorded + 1` is that floor with nothing left to raise it above. One
 * consequence, stated: the number no longer approximates the commit count, and
 * nothing should read it as one. The digest still identifies the tree exactly,
 * which is the job the count was never doing.
 *
 * THE RECORDED RELEASE IS WRITTEN IN THE SAME ACT, for the reason the date is:
 * a reset is only legitimate if the release moved, and a reader that cannot see
 * WHICH release the number was counted under cannot tell a reset from a
 * hand-edit that lowered it. Row H asks exactly that question.
 */
export function bumpOrdinal(root = REPO_ROOT) {
  const digest = sourceDigest(root).digest;
  const rec = readOrdinal(root);
  // THE DATE IS WRITTEN IN THIS ACT AND NOWHERE ELSE, under the same condition,
  // so it can never name a different build from the ordinal beside it. When the
  // digest has not moved this returns the RECORDED date rather than today's —
  // that is what keeps a rebuild of an unchanged tree byte-identical, and it is
  // also the truth: the artifact was built on the day it was built.
  if (rec.digest === digest) return { ordinal: rec.ordinal, bumped: false, digest, built: rec.built };

  const rel = release(root);
  // A release the recorded number was NOT counted under restarts the count.
  // `rec.release === null` is the pre-scheme file: it has no release to compare,
  // so it is treated as a different one and the counter starts where the
  // directive says a candidate starts.
  const ordinal = rec.release === rel ? rec.ordinal + 1 : 0;
  const built = today();
  writeFileSync(resolve(root, ORDINAL_HOME),
    `${JSON.stringify({
      _: 'DERIVED — written by tools/bundle.mjs, never by a hand. tools/buildversion.mjs owns the rule.',
      release: rel,
      ordinal,
      digest,
      built,
    }, null, 2)}\n`, 'utf8');
  return { ordinal, bumped: true, digest, built, release: rel };
}

/** The release string, read from its one home rather than re-typed. */
export function release(root = REPO_ROOT) {
  const m = /version:\s*'([^']+)'/.exec(readFileSync(resolve(root, RELEASE_HOME), 'utf8'));
  if (!m) throw new Error(`no version found in ${RELEASE_HOME} — the release half has lost its home`);
  return m[1];
}

/**
 * buildVersion(root) → the ORDERING half, composed the one way: `0.4.0.0618`.
 * Numeric throughout, last component sorts — Constantine's rule of 2026-08-16.
 * The recorded ordinal is used as-is; whether it BELONGS to this tree is rows
 * F and G's question, not this function's.
 */
export function buildVersion(root = REPO_ROOT) {
  return `${versionPrefix(release(root))}.${padOrdinal(readOrdinal(root).ordinal)}`;
}

/**
 * stampText(root) → the whole line a player reads: `BUILD 0.4.0.0618 · src …`.
 *
 * A SECOND COMPOSITION OF A STRING src/buildversion.js ALSO COMPOSES, AND IT IS
 * DELIBERATE RATHER THAN OVERLOOKED. The module composes it for the browser;
 * this composes it for tools/buildstamp-shot.mjs, which has to know what to
 * expect on a screen it photographs. The two are not checked against each other
 * by a third party — THEY CHECK EACH OTHER: the shot gate compares this string
 * to the rendered ink and goes red the moment they disagree, which is a
 * stronger binding than a comparison either of them could assert about itself.
 */
export function stampText(root = REPO_ROOT) {
  return `BUILD ${buildVersion(root)} · src ${sourceDigest(root).digest}`;
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

  // A — NO DERIVED VALUE IS EVER COMMITTED. Each is derived or it is typed;
  //     there is no third state, and this is where typing one would show up.
  //     ALL FOUR marker pairs are checked, because a scheme with four injected
  //     facts and three guarded ones is a scheme with an unguarded one. (It had
  //     two when the ordinal landed; the sentence was already written for this.)
  let ver = '';
  try { ver = src(VERSION_MODULE); } catch { /* reported below */ }
  if (!ver) {
    add(false, 'A ONE HOME', `${VERSION_MODULE} is missing — there is no home to check`);
  } else {
    const slice = (a, b) => (ver.includes(a) && ver.includes(b)
      ? ver.slice(ver.indexOf(a) + a.length, ver.indexOf(b)) : null);
    const held = [
      { what: 'SOURCE', got: slice(MARKER_START, MARKER_END), want: /^\s*export const SOURCE = 'UNSTAMPED';\s*$/ },
      { what: 'ORDINAL', got: slice(ORD_MARKER_START, ORD_MARKER_END), want: /^\s*export const ORDINAL = 'UNBUMPED';\s*$/ },
      { what: 'BUILT', got: slice(DATE_MARKER_START, DATE_MARKER_END), want: /^\s*export const BUILT = 'UNDATED';\s*$/ },
      { what: 'RUN_PATH', got: slice(RUN_MARKER_START, RUN_MARKER_END), want: /^\s*export const RUN_PATH = 'UNPLACED';\s*$/ },
    ];
    const bad = held.filter((h) => h.got === null || !h.want.test(h.got));
    add(bad.length === 0, 'A ONE HOME',
      bad.length === 0
        ? `${VERSION_MODULE} holds all four placeholders; the digest, the ordinal, the build date and the run path are injected, never committed`
        : `${VERSION_MODULE} does not hold a placeholder — a value typed into source is a version ASSERTED, not derived:`
          + bad.map((h) => `\n      ${h.what}: ${h.got === null ? 'its marker pair is missing' : h.got.trim().slice(0, 100)}`).join(''));
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
          if (!/version$/i.test(m[ki]) || isDerived(m[vi]) || isContractColumn(f, m[ki], m[vi])) continue;
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
      + ` which never compares the value to the release, so it does not go quiet when the value drifts).`
      + ` ${commentHits} prose mention${commentHits === 1 ? '' : 's'} in comments, which assert nothing and are not copies.`);
  }

  // C — EVERY CONSUMER DERIVES. Title owns its stamp directly. Map and combat
  //     now mount one shared HUD shell, so requiring the leaf screens to name
  //     buildStampHtml would reject the delegation that prevents them drifting.
  //     The whole chain is guarded instead: the shared owner must import AND
  //     invoke buildStampHtml, and each leaf must import AND invoke that owner.
  //     Requiring both halves prevents an unused import or a coincidental word
  //     in prose from buying green.
  const importsAndInvokes = (file, symbol, modulePath) => {
    const text = src(file);
    const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imported = new RegExp(`^import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*['"]${escaped}['"]\\s*;`, 'm').test(text);
    const invoked = new RegExp(`\\$\\{\\s*${symbol}\\s*\\(`).test(text);
    return imported && invoked;
  };
  const directTitle = importsAndInvokes('src/ui/screens/title.js', 'buildStampHtml', '../components/buildstamp.js');
  const sharedOwner = importsAndInvokes('src/ui/components/hudmeta.js', 'buildStampHtml', './buildstamp.js');
  const missingMounts = ['src/ui/screens/map.js', 'src/ui/screens/combat.js']
    .filter((f) => !importsAndInvokes(f, 'hudShellHtml', '../components/hudmeta.js'));
  const consumerFailures = [
    ...(!directTitle ? ['src/ui/screens/title.js does not derive directly'] : []),
    ...(!sharedOwner ? ['src/ui/components/hudmeta.js does not own the shared stamp'] : []),
    ...missingMounts.map((f) => `${f} does not mount the shared HUD owner`),
  ];
  add(consumerFailures.length === 0, 'C THREE CONSUMERS',
    consumerFailures.length === 0
      ? `title derives directly; shared hudmeta owns the stamp; map and combat both mount that owner`
      : `the named version-consumer chain is broken:\n      ${consumerFailures.join('\n      ')}`);

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
    // THE RUN PATH IS ASSERTED HERE AND NOWHERE ELSE, and this is the whole
    // falsifier for that field. The label's only job is to tell a screenshot of
    // the bundle apart from a screenshot of the served source tree; the way it
    // fails is that this file stops injecting it and the shipped page quietly
    // says `UNPLACED` — or, worse, says `source tree` because a rename crossed
    // the two constants. The bundle is the artifact that goes out, so the
    // bundle is where the claim is checked.
    const places = [...bundleText.matchAll(/const RUN_PATH = '([^']*)'/g)].map((m) => m[1]);
    const problems = [];
    if (found.length !== 1) problems.push(`${BUNDLE} carries ${found.length} SOURCE literals, expected exactly 1`);
    else if (found[0] !== want) problems.push(`${BUNDLE} carries SOURCE '${found[0]}', this tree derives '${want}' — the shipped stamp is not this source`);
    if (places.length !== 1) problems.push(`${BUNDLE} carries ${places.length} RUN_PATH literals, expected exactly 1`);
    else if (places[0] !== RUN_PATH_BUNDLE) problems.push(`${BUNDLE} says it was drawn by '${places[0]}' — a bundle is a '${RUN_PATH_BUNDLE}', and a page that misnames its own run path sends every bug report to the wrong artifact`);
    add(problems.length === 0, 'E SHIPPED STAMP',
      problems.length === 0
        ? `${BUNDLE} carries SOURCE '${want}', which is this tree's digest, and names its run path '${RUN_PATH_BUNDLE}'`
        : problems.join('\n      '));
  }


  // ---------------------------------------------------------------------------
  // F, G, H — THE LOCK ON THE ORDINAL, AND THEY ARE NOT OPTIONAL EXTRAS.
  //
  // The ordinal lives outside the digest (INPUT_ROOTS says why: covering it is a
  // fixpoint). That buys the whole scheme and costs one thing: a HAND-EDIT of
  // buildordinal.json moves nothing the digest can see, so the build will not
  // correct it and a wrong build number would ship in silence. These three rows
  // are what stands there instead, and every one of them compares a COMMITTED
  // fact to a COMMITTED fact — no clock, no HEAD, no off-by-one.
  //
  //   F  the number ON THE BOX is the number in the file, and it is well-formed
  //   G  the file's recorded digest is THIS tree's digest — i.e. the number was
  //      computed for the source it is sitting next to
  //   H  the number went UP at every commit that changed the shipped artifact
  //
  // F and G together catch a hand-edit: change the number and F fires; change
  // the number and the recorded digest to match, and G fires because the digest
  // you would have to forge is the tree's, which you cannot type. H is the one
  // that enforces his actual sentence — that a newer build reads higher.

  // F — THE SHIPPED ORDINAL IS THE FILE'S, AND IT IS WELL-FORMED.
  let recorded = null;
  try { recorded = readOrdinal(root); } catch (e) { /* reported */ recorded = e; }
  if (recorded instanceof Error || recorded === null) {
    add(false, 'F ORDINAL ON THE BOX',
      `${ORDINAL_HOME} could not be read — the ordering half has no home: ${recorded ? recorded.message : 'absent'}`);
  } else if (bundleText == null) {
    add(false, 'F ORDINAL ON THE BOX', `${BUNDLE} is missing — nothing to read an ordinal from`);
  } else {
    const want = padOrdinal(recorded.ordinal);
    const found = [...bundleText.matchAll(/const ORDINAL = '([^']*)'/g)].map((m) => m[1]);
    const problems = [];
    // THE DATE RIDES WITH THE ORDINAL because it is written in the same act,
    // under the same condition, into the same file — so the same hand-edit that
    // F exists to catch reaches it, and it needs no row of its own. A date is
    // the field on the About line a reader will BELIEVE without checking, which
    // is exactly why it gets the same lock as the number nobody reads.
    const dates = [...bundleText.matchAll(/const BUILT = '([^']*)'/g)].map((m) => m[1]);
    const wantDate = recorded.built;
    if (dates.length !== 1) problems.push(`${BUNDLE} carries ${dates.length} BUILT literals, expected exactly 1`);
    else if (wantDate === null) problems.push(`${BUNDLE} carries BUILT '${dates[0]}' and ${ORDINAL_HOME} records no build date — a date on the box with no home behind it`);
    else if (dates[0] !== wantDate) problems.push(`${BUNDLE} carries BUILT '${dates[0]}', ${ORDINAL_HOME} holds '${wantDate}' — the box and the file disagree about the day this was built`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(wantDate)) problems.push(`${ORDINAL_HOME} build date '${wantDate}' is not an ISO date — the About line reads it to a player`);
    if (found.length !== 1) problems.push(`${BUNDLE} carries ${found.length} ORDINAL literals, expected exactly 1`);
    else if (found[0] !== want) problems.push(`${BUNDLE} carries ORDINAL '${found[0]}', ${ORDINAL_HOME} holds '${want}' — the box and the file disagree`);
    if (!Number.isInteger(recorded.ordinal) || recorded.ordinal < 0) problems.push(`${ORDINAL_HOME} ordinal is not a non-negative integer: ${JSON.stringify(recorded.ordinal)}`);
    // THE RECORDED RELEASE IS LOCKED HERE TOO, and it has to be: the counter
    // resets when that field moves, so a hand-edit of the release alone would
    // license a reset the tree never earned. F is where a committed fact is
    // compared to a committed fact, and this is one.
    if (recorded.release === null) problems.push(`${ORDINAL_HOME} records no release — the ordinal is a count within a release, and a count with no release named is a number with no subject`);
    else if (recorded.release !== release(root)) problems.push(`${ORDINAL_HOME} counted ordinal ${recorded.ordinal} under release '${recorded.release}', but ${RELEASE_HOME} now says '${release(root)}' — the number belongs to a different candidate`);
    // AND THE RELEASE MUST BE A RELEASE. Agreement is not well-formedness: two
    // homes can hold the same malformed string and this row was satisfied by
    // that alone, which let `0.6.x` reach an ordering comparison (#579 review).
    // This is the row that owns "the number on the box is well-formed" — it
    // already says so of the ordinal and the date — so the release joins them.
    else {
      const bad = releaseSyntaxError(recorded.release);
      if (bad) problems.push(`${ORDINAL_HOME} records release ${bad}`);
    }
    add(problems.length === 0, 'F ORDINAL ON THE BOX',
      problems.length === 0
        ? `${BUNDLE} carries ORDINAL '${want}' and BUILT '${wantDate}', which are ${ORDINAL_HOME}'s, counted under release '${recorded.release}'`
        : problems.join('\n      '));
  }

  // G — THE RECORDED DIGEST IS THIS TREE'S. This is the row that makes a
  //     hand-edit unforgeable: to fake an ordinal you must also produce the
  //     digest of the tree you are sitting in, and that is derived here.
  if (recorded instanceof Error || recorded === null) {
    add(false, 'G ORDINAL BELONGS TO THIS TREE', `${ORDINAL_HOME} could not be read`);
  } else {
    const want = sourceDigest(root).digest;
    const ok = recorded.digest === want;
    add(ok, 'G ORDINAL BELONGS TO THIS TREE',
      ok ? `${ORDINAL_HOME} records digest '${want}', which is this tree's — the ordinal was computed for this source`
        : `${ORDINAL_HOME} records digest ${recorded.digest === null ? 'nothing' : `'${recorded.digest}'`}, this tree derives '${want}'`
          + ` — the ordinal belongs to a different source, so the number on the box is somebody else's.`
          + ` Rebuild (node tools/bundle.mjs) rather than editing the file.`);
  }

  // H — THE ORDINAL WENT UP WHEN THE ARTIFACT CHANGED. His sentence, machine-
  //     readable at last: a newer build reads higher. Committed vs committed,
  //     HEAD against its FIRST PARENT, so a merge is judged the same way the
  //     first-parent line reads it and nothing is off by one.
  //
  //     THE n/a CASES ARE PASSES AND THEY SAY SO. A root commit has no parent
  //     to compare against, and a parent from before this scheme existed has no
  //     ordinal to compare with. Both are honestly nothing-to-rule-on, and a row
  //     that pretended otherwise would be red on every fresh clone of history.
  // stderr is PIPED, not inherited: on a tree that is not a checkout git prints
  // `fatal: not a git repository`, and a row that already resolves that to
  // UNKNOWN in its own words does not also need git shouting between the rows.
  const g = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const at = (rev) => {
    try {
      const raw = JSON.parse(g('show', `${rev}:${ORDINAL_HOME}`));
      return { ordinal: Number(raw.ordinal), release: raw.release ?? null };
    } catch { return null; }
  };
  try {
    const parents = g('rev-list', '--parents', '-n', '1', 'HEAD').trim().split(/\s+/);
    const parent = parents[1] || null;
    if (!parent) {
      add(true, 'H ORDINAL INCREASES', 'HEAD has no parent — nothing to compare an ordinal against (n/a, stated)');
    } else {
      const changed = g('diff', '--name-only', parent, 'HEAD', '--', BUNDLE).trim() !== '';
      const before = at(parent);
      const now = at('HEAD');
      if (!changed) {
        add(true, 'H ORDINAL INCREASES', `${BUNDLE} is unchanged between ${parent.slice(0, 7)} and HEAD — no build shipped, so no ordinal was owed (n/a, stated)`);
      } else if (before === null) {
        add(true, 'H ORDINAL INCREASES', `${parent.slice(0, 7)} has no ${ORDINAL_HOME} — the scheme did not exist at the parent (n/a, stated)`);
      } else if (now === null) {
        add(false, 'H ORDINAL INCREASES', `HEAD changed ${BUNDLE} and has no readable ${ORDINAL_HOME} — a build shipped with no number`);
      } else if (before.release === null) {
        // THE TWO NUMBERS ARE NOT IN THE SAME SPACE — 2259 was a position in
        // the retired global sequence and 2 is a count within a candidate — so
        // no comparison can be invented here. What CANNOT be concluded from
        // that is that everything is fine.
        //
        // This branch said green, and review on #579 named the hole: a missing
        // field is not proof of provenance. After the migration a branch can
        // drop `release` in one commit and restore it in the next alongside a
        // changed bundle and a LOWER version; at that second commit rows F and
        // G both pass, and a green here would wave the ordering question
        // through entirely. The intermediate commit is red at row F, which is
        // no help when CI reads only the head.
        //
        // So it resolves to UNKNOWN, which blocks. That is this file's own
        // stated rule, ten lines below in the catch: a question we could not
        // put ourselves in a position to ask resolves to unknown, never to a
        // green. A branch based before the migration meets it and merges `dev`
        // to clear it, which is the same thing it needed to do anyway.
        add(null, 'H ORDINAL INCREASES',
          `UNKNOWN — ${parent.slice(0, 7)} records an ordinal with no release beside it, so its era cannot be established:`
          + ` a parent that predates the release-scoped counter and one that had the field removed look identical from here,`
          + ` and only the first is harmless. Merge a base that records its release rather than reading this as a pass.`);
      } else if (before.release !== now.release) {
        // WHAT MUST HOLD IS THAT THE VERSION WENT UP, NOT THAT THE TAIL IS 0.
        // The counter restarts at 0 on a new candidate, so a lower tail is
        // correct here and would be the defect anywhere else — but demanding
        // EXACTLY 0 was wrong in both directions, and review on #574 named
        // both. A candidate that advances after several builds on the branch
        // lands on a non-zero tail and is perfectly ordered (`0.5.5.3` beats
        // `0.5.4.9`), yet the old form called it red. And a candidate moving
        // BACKWARD to a `.0` tail — `0.5.3.0` after `0.5.4.7` — passed, which
        // is the one thing this row exists to refuse. Comparing the whole
        // version answers both at once.
        const beforeV = versionTuple(before.release, before.ordinal);
        const nowV = versionTuple(now.release, now.ordinal);
        if (beforeV === null || nowV === null) {
          // An unorderable version is not a fallen one and not a risen one.
          // Row F refuses the malformed release on its own account; this row
          // declines to rank what it cannot read rather than inventing a
          // verdict from substituted zeroes.
          add(null, 'H ORDINAL INCREASES',
            `UNKNOWN — ${beforeV === null ? `${parent.slice(0, 7)} records release '${before.release}'` : `HEAD records release '${now.release}'`},`
            + ` which has a component that is not a number. Nothing can be ordered against it; row F names the malformation.`);
          return { rows, red: rows.some((r) => !r.ok), unknown: rows.some((r) => r.ok === null) };
        }
        const rose = compareVersions(nowV, beforeV) > 0;
        add(rose, 'H ORDINAL INCREASES',
          rose
            ? `the release moved '${before.release}' → '${now.release}' between ${parent.slice(0, 7)} and HEAD, and the version rose ${beforeV.join('.')} → ${nowV.join('.')}`
            : `the release moved '${before.release}' → '${now.release}' and the version went ${beforeV.join('.')} → ${nowV.join('.')},`
              + ` which does not rise. A new candidate may restart the tail; it may not move the build backwards.`);
      } else {
        add(now.ordinal > before.ordinal, 'H ORDINAL INCREASES',
          now.ordinal > before.ordinal
            ? `${BUNDLE} changed between ${parent.slice(0, 7)} and HEAD, and the ordinal went ${before.ordinal} → ${now.ordinal} within release '${now.release}'`
            : `${BUNDLE} CHANGED between ${parent.slice(0, 7)} and HEAD and the ordinal went ${before.ordinal} → ${now.ordinal} within one release '${now.release}'.`
              + ` Two different builds that do not sort apart is the whole defect this scheme replaced.`);
      }
    }
  } catch (e) {
    // SOP 2's referent gate: a question we could not put ourselves in a
    // position to ask resolves to unknown, which blocks — never to a green.
    add(null, 'H ORDINAL INCREASES',
      `UNKNOWN — git could not be asked whether the ordinal increased (${e.message}).`
      + ` Outside a git checkout this row has no referent; it is not a pass.`);
  }

  // `!r.ok` catches false AND null on purpose: unknown blocks exactly as red
  // does, and there is no third exit code that means "carry on anyway".
  return { rows, red: rows.some((r) => !r.ok), unknown: rows.some((r) => r.ok === null) };
}

// ---------------------------------------------------------------------------
// --which — digest on a screenshot → the commit that shipped it
// ---------------------------------------------------------------------------

/**
 * whichCommits(digest, root) → ['<short> <subject>', …], newest first.
 *
 * THIS IS THE WHOLE REASON THE VERSION MAY BE A DIGEST INSTEAD OF A REF.
 * src/buildversion.js argues that the stamp must be a fact of the SOURCE and
 * never of the ref, and pays for that with non-orderability, on the promise
 * that you can always ASK THE ARTIFACT: `git log -S'<digest>' -- build/…`.
 * If that command cannot answer, the trade was never paid — the string neither
 * orders nor identifies.
 *
 * IT COULD NOT ANSWER, AND IT FAILED ON THE LIVE BUILD. Measured 2026-08-16 at
 * `dev = a05d071`, whose bundle carries SOURCE `6de9a8b63e`:
 *
 *     git log -S'6de9a8b63e' --oneline -- build/AshenSpire.html   →  (nothing)
 *
 * TWO DEFECTS, one door.
 *
 *   1. MERGES. `git log` does not diff a merge commit at all by default, so the
 *      pickaxe never looks inside one. `6de9a8b63e` entered at `cc5f6dd`, a
 *      merge whose bundle differs from BOTH parents (3b74fd3 and a1a55a5 carry
 *      0 occurrences; cc5f6dd carries 1) — the bundle was re-derived in the
 *      merge act itself, which is this repo's normal way of landing work. So
 *      the tool was blind to exactly the commits that ship builds.
 *      `--diff-merges=first-parent` makes the merge visible.
 *
 *   2. `-S` REPORTS REMOVALS TOO, and the caller's question is not "when did
 *      this string move" but "which commit SHIPPED it". With merges visible,
 *      `--which d20fb1bd4d` returns both `ffdce3c` (added it) and `cc5f6dd`
 *      (replaced it) — one of those two shipped it and the other is the commit
 *      that stopped shipping it. Answering with both is a plausible wrong
 *      answer on a screenshot, which is worse than the silence it replaced.
 *
 * So: PICKAXE TO FIND CANDIDATES, THEN CONFIRM AGAINST THE COMMIT'S OWN BLOB.
 * The pickaxe is a cheap index over 139 bundle-touching commits; the blob read
 * is what makes each line it prints TRUE. A candidate the blob does not confirm
 * is dropped rather than reported.
 *
 * BOUNDARY, and the CLI prints it rather than leaving it here: this searches
 * first-parent history from HEAD. A digest that only ever existed on an
 * unmerged branch is not reachable, and this returns empty rather than
 * pretending the build never existed — the honest answer to "not on this line
 * of history" is not "nowhere".
 */
export function whichCommits(digest, root = REPO_ROOT) {
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const candidates = git(
    'log', '--diff-merges=first-parent', '--no-patch', '--format=%H',
    '-S', digest, '--', BUNDLE,
  ).split('\n').map((s) => s.trim()).filter(Boolean);

  const out = [];
  for (const sha of candidates) {
    // `-a`: .gitattributes marks the bundle `-text` (byte-identity gate), and
    // git would otherwise decline to grep it. Exit 1 = "not in this blob", which
    // is an answer, not a failure — hence the try rather than a status check.
    let present = false;
    try { present = git('grep', '-c', '-a', digest, sha, '--', BUNDLE).trim().length > 0; } catch { present = false; }
    if (present) out.push(git('log', '-1', '--format=%h %s', sha).trim());
  }
  return out;
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
    let hits;
    try {
      hits = whichCommits(d);
    } catch (e) {
      console.error(`buildversion: git could not answer — ${e.message}`);
      process.exit(2);
    }
    if (!hits.length) {
      console.log(`buildversion: no commit of ${BUNDLE} carries '${d}'`);
      console.log(`  searched: every commit whose ${BUNDLE} differs from its FIRST PARENT, merges included,`);
      console.log(`  then confirmed against that commit's own blob. A digest introduced by a merge is`);
      console.log(`  reachable; one that only ever existed in an unmerged branch is not.`);
      process.exit(1);
    }
    for (const h of hits) console.log(h);
    process.exit(0);
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
  console.log(`buildversion: ${stampText()}`);
  console.log(`  the ORDERING half   ${buildVersion()}   — numeric, last component sorts; a higher one is newer`);
  console.log(`  the IDENTIFYING half ${d.digest}   — over ${d.files} canonical files: ${INPUT_ROOTS.join(' · ')} plus ${BUILD_IDENTITY_FILES.join(' · ')}`);
  console.log(`  which commit shipped it: node tools/buildversion.mjs --which ${d.digest}`);
  process.exit(0);
}
