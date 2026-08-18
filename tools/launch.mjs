// tools/launch.mjs — the one-click launcher.
//
// 1. Builds the standalone single-file HTML (tools/bundle.mjs → build/).
// 2. Copies it to the root and into dist/ (stable current-build aliases plus a
//    version-stamped dist copy).
// 3. Serves the live app on http://localhost and opens it in the browser.
//
// Invoked by run.bat (Windows) and run.sh (macOS/Linux), or: node tools/launch.mjs

import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// 0. Compile authored content (content/source/*.csv|json → src/content/generated).
// Runs first so a spreadsheet edit is picked up by the very next launch without
// anyone remembering a separate command.
console.log('launch: compiling authored content…');
const content = spawnSync(process.execPath, [resolve(ROOT, 'tools/content-build.mjs')], { stdio: 'inherit' });
if (content.status !== 0) {
  console.error('launch: content build failed — fix content/source and retry.');
  process.exit(content.status || 1);
}

// 1. Build the standalone bundle.
console.log('launch: building the standalone bundle…');
const build = spawnSync(process.execPath, [resolve(ROOT, 'tools/bundle.mjs')], { stdio: 'inherit' });
if (build.status !== 0) {
  console.error('launch: build failed — aborting.');
  process.exit(build.status || 1);
}

// 2. Refresh the player-facing current-build aliases from the fresh build.
const src = resolve(ROOT, 'build', 'AshenSpire.html');
const distDir = resolve(ROOT, 'dist');
mkdirSync(distDir, { recursive: true });
const ver = version();
copyFileSync(src, resolve(ROOT, 'AshenSpire.html'));
copyFileSync(src, resolve(distDir, 'AshenSpire.html'));
copyFileSync(src, resolve(distDir, `AshenSpire-${ver}.html`));
console.log(`launch: current build refreshed → AshenSpire.html + dist/AshenSpire.html + dist/AshenSpire-${ver}.html`);

if (args.includes('--build-only')) {
  console.log('launch: --build-only set, skipping server.');
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
