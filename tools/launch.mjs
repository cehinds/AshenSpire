// tools/launch.mjs — the one-click launcher.
//
// 1. Builds the standalone single-file HTML (tools/bundle.mjs → build/).
// 2. Copies it into dist/ (a stable AshenSpire.html + a version-stamped copy).
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
import { release } from './buildversion.mjs';

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
 * WHAT IS NOT DECIDED IS NOT GUESSED AT HERE, and that is deliberate: his
 * `v0.00.01` padding against our `0.4.0`, the `dev` channel field (which exists
 * nowhere in this tree), and whether the source digest belongs in the filename
 * at all are all open. Inventing an answer to any of them inside this fix would
 * mint a second version scheme — which is the exact subject SOP 5 and
 * tools/buildversion.mjs exist to forbid. They come back specified or not at
 * all. The filename shape below is therefore UNCHANGED by this commit.
 */
function version() {
  try {
    return release(ROOT);
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

// 2. Refresh dist/ from the fresh build.
const src = resolve(ROOT, 'build', 'AshenSpire.html');
const distDir = resolve(ROOT, 'dist');
mkdirSync(distDir, { recursive: true });
const ver = version();
copyFileSync(src, resolve(distDir, 'AshenSpire.html'));
copyFileSync(src, resolve(distDir, `AshenSpire-${ver}.html`));
console.log(`launch: dist refreshed → dist/AshenSpire.html + dist/AshenSpire-${ver}.html`);

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
