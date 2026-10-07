// tools/launch.mjs — the one-click launcher.
//
// 1. Builds the game (tools/bundle.mjs → build/): since
//    docs/EXTERNAL-ASSETS-PLAN.md step 8e that is ONE TREE — the pack-shaped
//    AshenSpire.html with its packs/ and objects/ beside it, and the light
//    single file at download/AshenSpire.html (inline, self-contained).
// 2. Copies that tree into dist/ (plus a version-stamped copy of the HTML),
//    and the light single file to the root as the easy-to-find alias.
// 3. Serves the live app on http://localhost and opens it in the browser.
//
// Invoked by run.bat (Windows) and run.sh (macOS/Linux), or: node tools/launch.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, cpSync, readdirSync, rmSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
// THE RELEASE STRING IS READ FROM ITS ONE HOME, NOT RE-DERIVED HERE. This file
// used to carry its own copy of buildversion.release() — the same regex against
// the same file — and the copy differed from the original in the one way that
// matters: it FELL BACK instead of failing. On one ordinary edit to
// src/content/index.js (`'0.4.0'` → `"0.4.0"`, single quotes to double) the
// original throws by name; the copy returned '0.0.0' and shipped
// dist/AshenSpire-0.0.0.html with nothing said. Bjorn found it; it had been
// here since the launcher was written. A second implementation of a rule is a
// second chance to disagree with it, and this one disagreed silently.
import { buildVersion } from './buildversion.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/**
 * The release half of the version, from src/content/index.js via the one home.
 *
 * NO FALLBACK, DELIBERATELY — Marina's MR-263: *when the version cannot be
 * derived, fail loudly — never emit a plausible filename.* `0.0.0` was
 * precisely a plausible filename. That is what made it worse than a crash: it
 * is not obviously wrong on disk, it is not obviously wrong pasted into a bug
 * report, and it reads as a fact on the box. A launcher that cannot find the
 * release does not know what it is building and must say so.
 *
 * This matters more than it did last week because Constantine has since given a
 * standing instruction that a build carries its name AND its version. The
 * DECIDED half of that — name plus version, DERIVED rather than typed — is what
 * the copyFileSync calls below already do.
 *
 * WHAT IS NOT DECIDED IS STILL NOT GUESSED AT HERE: the `dev` channel field
 * (which exists nowhere in this tree) and whether the source digest belongs in
 * a name read aloud on a phone call are both open, and inventing an answer to
 * either would mint a second version scheme — the exact subject SOP 5 and
 * tools/buildversion.mjs exist to forbid.
 *
 * WHAT CHANGED 2026-08-16, AND IT IS THE VERSION AND NOT THE SHAPE. This read
 * `release(ROOT)`, so every build in this project's history was handed over as
 * `AshenSpire-0.4.0.html` — 139 shipped bundles, two distinct names. A file you
 * cannot tell apart from the last one is the defect Constantine's rule of that
 * day is aimed at, arriving on the surface he actually receives. It now reads
 * `buildVersion(ROOT)`, which is the same fact with its ordering tail attached,
 * so `AshenSpire-0.4.0.0618.html` sorts in a directory listing the way he asked
 * a build to sort. The shape — `<name>-<version>.html` — is untouched, and the
 * padding is what makes the listing sort right rather than a style choice.
 */
function version() {
  try {
    return buildVersion(ROOT);
  } catch (e) {
    console.error(`launch: ${e.message}`);
    console.error('launch: refusing to name the artifact after a guess — fix the release home and retry.');
    console.error('launch: (this is the check tools/buildversion.mjs row A/B rest on; see that file.)');
    process.exit(1);
  }
}

const args = process.argv.slice(2);
// THE ART TIER, AND WHICH PACKS THE BUILD CARRIES. Light by default (owner,
// 2026-09-26: "light only on dev/test"): the light and common packs, default
// tier light. `--full-art` is the test/release/main shape
// (test joined 2026-10-04): all three packs, default
// tier high, light kept as its fallback. `--light` says the default out loud.
// The light single file is built either way: it is the one inline download
// (owner answer 3), and it is always light. The full-art single file and the
// separate mobile file are retired (owner answers 6 and 2, step 8e).
const FULL_ART = args.includes('--full-art');
if (FULL_ART && args.includes('--light')) {
  console.error('launch: --light and --full-art name two tiers; pick one.');
  process.exit(2);
}
const TIER_FLAG = FULL_ART ? [] : ['--light'];
const TIER = FULL_ART ? 'high' : 'light';

// 0a. Compile presentation config (content/config/**.json → src/config/generated/ui.js).
// Runs before the content build, whose stray-source sweep refuses a config file
// the generated module was not compiled from.
console.log('launch: compiling presentation config…');
const uiConfig = spawnSync(process.execPath, [resolve(ROOT, 'tools/config-build.mjs')], { stdio: 'inherit' });
if (uiConfig.status !== 0) {
  console.error('launch: config build failed — fix content/config and retry.');
  process.exit(uiConfig.status || 1);
}

// 0. Compile authored content (content/source/*.csv|json → src/content/generated).
// Runs first so a spreadsheet edit is picked up by the very next launch without
// anyone remembering a separate command.
console.log('launch: compiling authored content…');
const content = spawnSync(process.execPath, [resolve(ROOT, 'tools/content-build.mjs')], { stdio: 'inherit' });
if (content.status !== 0) {
  console.error('launch: content build failed — fix content/source and retry.');
  process.exit(content.status || 1);
}

const buildDir = resolve(ROOT, 'build');
const distDir = resolve(ROOT, 'dist');

// 1. The game file, pack-shaped, into build/ (its packs/ and objects/ beside it).
// This run bumps the ordinal when the tree moved; the single file below reads
// the same number.
console.log(`launch: building the game (pack shape, ${TIER} art by default)…`);
const build = spawnSync(process.execPath, [resolve(ROOT, 'tools/bundle.mjs'), ...TIER_FLAG], { stdio: 'inherit' });
if (build.status !== 0) {
  console.error('launch: build failed — aborting.');
  process.exit(build.status || 1);
}

// 1b. The light single file into build/download/ — the same source and stamp,
// every byte inside it (about 31 MB; held to no byte budget since step 8e). Its
// art is the light pack's, which the bundler reads through tools/art-source.mjs.
console.log('launch: building the light single file (download/)…');
const single = spawnSync(process.execPath, [resolve(ROOT, 'tools/bundle.mjs'), '--single-file'], { stdio: 'inherit' });
if (single.status !== 0) {
  console.error('launch: light single-file build failed — aborting.');
  process.exit(single.status || 1);
}

// 1c. What an earlier launcher left that this build no longer makes. Each one,
// left in place, is an older build under a current-looking name, or a folder
// that would quietly serve a tile, a track or an image the pinned index lacks.
// Only launcher output (all of it git-ignored) is touched.
const ver = version();
const stale = [
  resolve(ROOT, 'AshenSpire-mobile.html'),
  resolve(buildDir, 'AshenSpire-mobile.html'),
  resolve(buildDir, 'web'),          // the pack shape's old home (steps 3a–7)
  resolve(buildDir, 'music'),
  resolve(buildDir, 'map-detail'),
  resolve(distDir, 'music'),
  resolve(distDir, 'map-detail'),
  resolve(distDir, 'packs'),         // replaced whole below
  resolve(distDir, 'objects'),
  resolve(distDir, 'cards'),
];
if (existsSync(distDir)) {
  for (const name of readdirSync(distDir)) {
    // The retired mobile files, and version-stamped HTML from another build:
    // a pack-shaped copy pins packs this dist/ no longer carries.
    if (/^AshenSpire-mobile(-.*)?\.html$/.test(name)) stale.push(resolve(distDir, name));
    else if (/^AshenSpire-.+\.html$/.test(name) && name !== `AshenSpire-${ver}.html`) stale.push(resolve(distDir, name));
  }
}
const removed = stale.filter((f) => existsSync(f));
for (const f of removed) rmSync(f, { recursive: true, force: true });
if (removed.length) console.log(`launch: removed ${removed.length} stale launcher output(s): ${removed.map((f) => relative(ROOT, f).split(sep).join('/')).join(', ')}`);

// 2. Refresh dist/ from build/ (the same tree, so dist/AshenSpire.html opens by
// double-click with its folder), and the root alias from the light single file
// (the root carries no packs/ or objects/, so its alias is the self-contained
// file). #12 NAMES THIS TOOL IN SCOPE, AND A BUILDER IS NOT EXEMPT: the aliases
// are counted and VERIFIED to exist after the copy, so the number is a
// measurement of what landed rather than a constant typed beside the copy calls.
const html = resolve(buildDir, 'AshenSpire.html');
const singleFile = resolve(buildDir, 'download', 'AshenSpire.html');
mkdirSync(resolve(distDir, 'download'), { recursive: true });
for (const part of ['packs', 'objects', 'cards']) cpSync(resolve(buildDir, part), resolve(distDir, part), { recursive: true });
for (const part of ['asset-base.json', '.asset-pack']) copyFileSync(resolve(buildDir, part), resolve(distDir, part));
const aliases = [
  [html, resolve(distDir, 'AshenSpire.html')],
  [html, resolve(distDir, `AshenSpire-${ver}.html`)],
  [singleFile, resolve(distDir, 'download', 'AshenSpire.html')],
  [singleFile, resolve(ROOT, 'AshenSpire.html')],
];
for (const [from, to] of aliases) copyFileSync(from, to);
const landed = aliases.filter(([, to]) => existsSync(to)).length;
console.log(`launch: current build refreshed → dist/AshenSpire.html + dist/AshenSpire-${ver}.html (+ packs/, objects/) + dist/download/AshenSpire.html + AshenSpire.html (the light single file)`);
if (landed !== aliases.length) {
  console.error(`launch: REFUSED — ${landed} of ${aliases.length} current-build aliases exist after the copy.`);
  process.exit(1);
}

if (args.includes('--build-only')) {
  // The terminated verdict line #12's contract requires: one line, one count.
  // The tier note goes on the line before, because tools/verdict.mjs admits
  // only the noun and the full stop on the verdict line itself.
  console.log(`launch: ${TIER} art by default; the pack HTML, its dist/ copies and the light single file`);
  console.log(`launch: OK — ${landed}/${aliases.length} current-build aliases refreshed.`);
  process.exit(0);
}

// 3. Serve the live app and open the browser.
const pi = args.indexOf('--port');
serve({
  root: ROOT,
  port: pi >= 0 ? Number(args[pi + 1]) : 8080,
  open: !args.includes('--no-open'),
  lan: !args.includes('--no-lan'),
});
