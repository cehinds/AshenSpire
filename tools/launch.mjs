// tools/launch.mjs — the one-click launcher.
//
// 1. Builds the standalone single-file HTML (tools/bundle.mjs → build/).
// 2. Copies it into dist/ (a stable AshenSpire.html + a version-stamped copy).
// 3. Serves the live app on http://localhost and opens it in the browser.
//
// Invoked by run.bat (Windows) and run.sh (macOS/Linux), or: node tools/launch.mjs
//
// CONTRACT-SET: actor — it builds, serves and opens a browser for a person. Nothing here rules on the tree.

import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

function version() {
  try {
    const idx = readFileSync(resolve(ROOT, 'src/content/index.js'), 'utf8');
    const m = /version:\s*'([^']+)'/.exec(idx);
    return m ? m[1] : '0.0.0';
  } catch {
    return '0.0.0';
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
