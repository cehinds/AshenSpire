#!/usr/bin/env node
// desktop/windows/build-installer.mjs — build the Windows installer, AshenSpire-Setup-<version>.exe.
//
//   node desktop/windows/build-installer.mjs [--web <dir>] [--out <dir>] [--stage-only]
//
//     --web <dir>     use a web edition already built with
//                     `node tools/bundle.mjs --external-art --out <dir>` (no --light:
//                     it must pin the high pack); default: build one into <out>/web
//     --out <dir>     where everything is written (default desktop/windows/build/)
//     --stage-only    stop after staging (no Electron package, no makensis)
//
// Needs Node 22+, npx (it runs @electron/packager) and NSIS 3 (`makensis` on PATH,
// or installed in the default place on Windows; `apt install nsis` on Linux).
// The installer can be built on Linux; it is only ever run on Windows.
//
// WHAT IT BUILDS (desktop/windows/README.md):
//   <out>/stage/app/                 the install tree, copied to the player's folder
//     AshenSpire.exe …               the Electron wrapper (desktop/electron), win32-x64
//     game/                          the web edition WITHOUT the high tier: the HTML,
//                                    the light and common indexes and their objects
//     install-data/
//       hd-index/high-<digest>.json|.js   the high index, copied into game/packs/
//                                         only once every high object is in place
//       high-objects.tsv             every object the high index lists
//       base-objects.tsv             every object the light and common indexes list
//       fetch-hd-art.ps1             the download / prune step
//   <out>/AshenSpire-Setup-<version>.exe
//
// The installer's "High-resolution art" choice downloads the release zip
// art-release.json pins for the high pack, checks it against that sha256 and every
// object against the index, and puts the index in last. Without it the game plays
// on the light art the installer carries. Saves live in %APPDATA%\AshenSpire.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectPath } from '../../tools/asset-pack.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const ELECTRON = resolve(ROOT, 'desktop', 'electron');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const OUT = resolve(opt('--out') || join(HERE, 'build'));
const STAGE_ONLY = args.includes('--stage-only');

function fail(msg) { console.error(`build-installer: ${msg}`); process.exit(1); }
function run(cmd, argv, opts = {}) {
  console.log(`build-installer: ${cmd} ${argv.join(' ')}`);
  const r = spawnSync(cmd, argv, { stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npx', ...opts });
  if (r.error) fail(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) fail(`${cmd} exited ${r.status}`);
}

// ---- version and the pinned high release -----------------------------------
const ordinal = JSON.parse(readFileSync(join(ROOT, 'buildordinal.json'), 'utf8'));
const VERSION = `${ordinal.release}.${ordinal.ordinal}`;
if (!/^\d+\.\d+\.\d+\.\d+$/.test(VERSION)) fail(`buildordinal.json gives version ${VERSION}, not a.b.c.d`);
const pin = JSON.parse(readFileSync(join(ROOT, 'art-release.json'), 'utf8'));
const highPin = pin.packs?.high;
if (!highPin?.zip || !/^[0-9a-f]{64}$/.test(highPin.sha256 || '')) fail('art-release.json pins no high pack');
const HD_URL = `https://github.com/${pin.repo}/releases/download/${pin.tag}/${highPin.zip}`;

// ---- the web edition ---------------------------------------------------------
let WEB = opt('--web') ? resolve(opt('--web')) : null;
if (!WEB) {
  WEB = join(OUT, 'web');
  run(process.execPath, [join(ROOT, 'tools', 'bundle.mjs'), '--external-art', '--out', WEB], { cwd: ROOT });
}
if (!existsSync(join(WEB, 'AshenSpire.html'))) fail(`${WEB} holds no AshenSpire.html`);

const packFiles = readdirSync(join(WEB, 'packs'));
function indexOf(pack) {
  const json = packFiles.filter((f) => new RegExp(`^${pack}-[0-9a-f]{12}\\.json$`).test(f));
  if (json.length !== 1) fail(`expected one ${pack} index in ${WEB}/packs, found ${json.length}${pack === 'high' ? ' (was the web edition built with --light?)' : ''}`);
  const entries = JSON.parse(readFileSync(join(WEB, 'packs', json[0]), 'utf8'));
  return { name: json[0].replace(/\.json$/, ''), entries };
}
const light = indexOf('light');
const common = indexOf('common');
const high = indexOf('high');

const rows = (index) => Object.entries(index.entries).map(([id, [sha, bytes]]) => ({ id, sha, bytes, path: objectPath(sha, id) }));
const baseRows = [...rows(light), ...rows(common)];
const highRows = rows(high);
const basePaths = new Set(baseRows.map((r) => r.path));
for (const r of [...baseRows, ...highRows]) {
  if (!existsSync(join(WEB, r.path))) fail(`${r.id}: ${r.path} is not in ${WEB}`);
}
const tsv = (list) => {
  const seen = new Set();
  return list.filter((r) => !seen.has(r.path) && seen.add(r.path))
    .map((r) => [r.sha, r.bytes, r.path, r.id].join('\t')).join('\n') + '\n';
};

// ---- stage -------------------------------------------------------------------
const STAGE = join(OUT, 'stage');
const APP = join(STAGE, 'app');
const GAME = join(APP, 'game');
const DATA = join(APP, 'install-data');
rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(DATA, 'hd-index'), { recursive: true });

// The objects only the high tier uses: what the download adds.
const highOnly = new Map(highRows.filter((r) => !basePaths.has(r.path)).map((r) => [r.path, r.bytes]));
const highOnlyBytes = [...highOnly.values()].reduce((a, b) => a + b, 0);
cpSync(WEB, GAME, {
  recursive: true,
  filter: (src) => {
    const rel = relative(WEB, src).split(/[\\/]/).join('/');
    if (/^packs\/high-/.test(rel)) return false;
    if (rel.startsWith('objects/') && statSync(src).isFile()) return basePaths.has(rel);
    return true;
  },
});
for (const f of packFiles.filter((f) => f.startsWith(`${high.name}.`))) cpSync(join(WEB, 'packs', f), join(DATA, 'hd-index', f));
writeFileSync(join(DATA, 'high-objects.tsv'), tsv(highRows));
writeFileSync(join(DATA, 'base-objects.tsv'), tsv(baseRows));
cpSync(join(HERE, 'fetch-hd-art.ps1'), join(DATA, 'fetch-hd-art.ps1'));

const HD_MB = Math.round(highOnlyBytes / 1e6);
console.log(`build-installer: staged ${GAME}`);
console.log(`  version ${VERSION} · base objects ${basePaths.size} · high objects ${highRows.length} (${HD_MB} MB not in the base)`);
console.log(`  high art: ${HD_URL}`);
if (STAGE_ONLY) process.exit(0);

// ---- the Electron wrapper, win32-x64 -----------------------------------------
const PKG_OUT = join(OUT, 'electron');
rmSync(PKG_OUT, { recursive: true, force: true });
const packagerArgs = ['--yes', '@electron/packager@18', ELECTRON, 'AshenSpire',
  '--platform=win32', '--arch=x64', `--out=${PKG_OUT}`, `--app-version=${VERSION}`, '--overwrite', '--asar',
  '--ignore=^/(userdata|build|dist-embed)(/|$)', '--ignore=(run-spike\\.sh|package\\.sh|render-check\\.mjs|.*results\\.txt)$'];
// Version resources (and an icon) are written with rcedit, which only runs on Windows.
if (process.platform === 'win32') {
  packagerArgs.push('--win32metadata.CompanyName=cehinds', '--win32metadata.ProductName=Ashen Spire',
    '--win32metadata.FileDescription=Ashen Spire', '--win32metadata.OriginalFilename=AshenSpire.exe');
}
run('npx', packagerArgs, { cwd: ELECTRON });
const packaged = join(PKG_OUT, 'AshenSpire-win32-x64');
if (!existsSync(join(packaged, 'AshenSpire.exe'))) fail(`no AshenSpire.exe in ${packaged}`);
cpSync(packaged, APP, { recursive: true });
// Chromium's own UI strings (context menus, dialogs) in English only: the game
// is in English, and the other 54 locales are ~45 MB.
for (const f of readdirSync(join(APP, 'locales'))) if (f !== 'en-US.pak') rmSync(join(APP, 'locales', f));

// The uninstaller removes exactly what was installed, never the whole folder.
const top = readdirSync(APP).sort();
const uninstall = top.map((name) => statSync(join(APP, name)).isDirectory()
  ? `  RMDir /r "$INSTDIR\\${name}"` : `  Delete "$INSTDIR\\${name}"`).join('\n') + '\n';
writeFileSync(join(STAGE, 'uninstall-files.nsh'), uninstall);
const sizeKb = (dir) => {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? sizeKb(join(dir, e.name)) : statSync(join(dir, e.name)).size / 1024;
  return n;
};

// ---- makensis ------------------------------------------------------------------
const makensis = [
  'makensis',
  'C:\\Program Files (x86)\\NSIS\\makensis.exe',
  'C:\\Program Files\\NSIS\\makensis.exe',
].find((m) => !spawnSync(m, ['-VERSION'], { stdio: 'ignore' }).error);
if (!makensis) fail('makensis not found: install NSIS 3 (https://nsis.sourceforge.io; `apt install nsis` or `choco install nsis`)');
const SETUP = join(OUT, `AshenSpire-Setup-${VERSION}.exe`);
const define = (k, v) => `-D${k}=${v}`;
run(makensis, [
  '-V3', '-INPUTCHARSET', 'UTF8',
  define('VERSION', VERSION),
  define('APP_DIR', APP),
  define('UNINSTALL_LIST', join(STAGE, 'uninstall-files.nsh')),
  define('LICENSE_FILE', join(ROOT, 'LICENSE')),
  define('OUTFILE', SETUP),
  define('HD_URL', HD_URL),
  define('HD_SHA256', highPin.sha256),
  define('HD_MB', String(HD_MB)),
  define('HD_SIZE_KB', String(Math.ceil(highOnlyBytes / 1024))),
  define('BASE_SIZE_KB', String(Math.ceil(sizeKb(APP)))),
  join(HERE, 'installer.nsi'),
]);
console.log(`build-installer: wrote ${SETUP} (${(statSync(SETUP).size / 1e6).toFixed(1)} MB)`);
