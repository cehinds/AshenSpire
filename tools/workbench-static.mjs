#!/usr/bin/env node
// tools/workbench-static.mjs — builds the Workbench as a static site for GitHub Pages.
//
//   node tools/workbench-static.mjs --out DIR [--base /AshenSpire/workbench/] [--no-art]
//
// GitHub Pages has no server, so the Workbench cannot call its /api routes there.
// This tool boots the real Workbench server on a free port, reads its answers
// (tools, file listing, library, previews, assets, export manifest, settings,
// jobs, review state, backups, git) and the text of every file the Workbench
// edits, and writes them to DIR/static-api/snapshot.json and DIR/static-api/files/.
// The browser module static/static-api.mjs (loaded before app.mjs) answers the
// app's /api calls from that snapshot, so the same page works with no server.
//
// The UI itself (index.html, app.mjs, workbench.css, shared/, ui/, modules/, lib/)
// is copied from workbench/ with its absolute paths moved under --base. The game
// runtime that tools/serve.mjs serves (index.html, src/, styles/, the workbench
// modules and the top level of pose-studio/) is mirrored to DIR/game/, so the
// Workbench's game preview still loads. Unless --no-art is given, the light art
// pack (assets-mobile/) goes to DIR/game/assets/, where serve.mjs would answer
// /assets/ with the light twin, and the Asset Gallery reads it from there. The
// Asset Gallery's display art (assets-display/) goes to DIR/asset-file/assets-display/,
// where its asset-file/ URLs load it. The light art is copied once.
// COMMON fonts go to DIR/game/assets/fonts/ for the mirrored styles' font URLs;
// their complete copyright/OFL notice remains embedded in styles/kit.css.
//
// docs/design/ (large design rigs) is never read or copied. A missing optional
// input (the static-api module, assets-mobile/) prints a warning and the build
// carries on. --out is removed before the build starts.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createWorkbench } from '../workbench/server.mjs';
import { artDir } from './art-source.mjs';
import { authoringRoot, compositeSourcePath } from './art-authoring.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ART_CHECKOUT = authoringRoot({root:REPO,required:false});
const DESIGN_PREFIX = 'docs/design/';
const UI_NAMES = ['index.html', 'app.mjs', 'workbench.css', 'shared', 'ui', 'modules', 'lib'];
const UI_REWRITE = /(["'`(])\/(api|shared|ui|modules|lib|static|export|asset-file|app\.mjs|workbench\.css)\b/g;
const GAME_REWRITE = /(["'`(])\/(workbench|styles|src|assets|pose-studio)\//g;
const PREVIEW_PAGE = /^([\w.-]+-preview|tooltip-review[\w.-]*)\.html$/;
const UI_TEXT = /\.(html|mjs|js|css)$/;
const GAME_TEXT = /\.(html|mjs|js|css|json|svg)$/;
const SNAPSHOT_DIRS = ['content', 'docs/tag-model', 'pose-studio/renewal', 'pose-studio/stances', 'workbench/workspace', 'ui-studio/workspace', 'games/ashenspire', 'engine/modules'];
const SNAPSHOT_FILES = ['src/content/card-layout.json', 'src/content/formationPositioningPresets.js', 'src/content/bookArtPresets.js'];
const SNAPSHOT_APIS = ['tools', 'files/list', 'library', 'previews', 'assets/list', 'export/manifest', 'settings', 'jobs', 'review/state', 'files/backups', 'git'];

function parseArgs(argv) {
  const args = { out: '', base: '/AshenSpire/workbench/', art: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i] || '';
    else if (a === '--base') args.base = argv[++i] || '';
    else if (a === '--no-art') args.art = false;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!args.out) throw new Error('usage: node tools/workbench-static.mjs --out DIR [--base /AshenSpire/workbench/] [--no-art]');
  const trimmed = args.base.replace(/^\/+|\/+$/g, '');
  args.base = trimmed ? `/${trimmed}/` : '/';
  return args;
}

function safeRel(rel) {
  const norm = path.posix.normalize(rel);
  if (!rel || norm.startsWith('../') || norm === '..' || path.posix.isAbsolute(norm)) throw new Error(`unsafe path from the Workbench: ${rel}`);
  return norm;
}

async function writeOut(out, rel, data) {
  const abs = path.join(out, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
}

// Copies a file or directory tree. Dotfiles, `tests` and `node_modules` are skipped.
// Text files matching `textRe` get `rewrite` applied; every other file is copied as is.
async function copyTree(src, dst, { textRe = null, rewrite = null } = {}) {
  const st = await fs.stat(src);
  if (st.isDirectory()) {
    for (const entry of await fs.readdir(src)) {
      if (entry.startsWith('.') || entry === 'tests' || entry === 'node_modules') continue;
      await copyTree(path.join(src, entry), path.join(dst, entry), { textRe, rewrite });
    }
    return;
  }
  await fs.mkdir(path.dirname(dst), { recursive: true });
  if (rewrite && textRe && textRe.test(src)) {
    const text = (await fs.readFile(src, 'utf8')).replace(rewrite.re, rewrite.to);
    await fs.writeFile(dst, rewrite.after ? rewrite.after(text) : text);
  }
  else await fs.copyFile(src, dst);
}

// Font URLs in the mirrored styles resolve under game/assets/fonts. Fonts belong
// to COMMON, not the LIGHT image tree. Always copy the pinned release, including
// when a local authoring checkout or fixture-tree mode is selected elsewhere.
export async function copyGameFonts(game, { root = REPO } = {}) {
  const { dir } = artDir('assets/fonts', { root, env: { ASHEN_ART_SOURCE: 'cache' } });
  await copyTree(dir, path.join(game, 'assets', 'fonts'));
}

// The root preview pages (names only) that go to game/ and the Library opens from there.
async function rootPreviewPages() {
  return (await fs.readdir(REPO, { withFileTypes: true })).filter((e) => e.isFile() && PREVIEW_PAGE.test(e.name)).map((e) => e.name);
}

// The site root above the Workbench base: '/AshenSpire/' for '/AshenSpire/workbench/', '/' for '/'.
function siteRootOf(base) {
  const parts = base.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}/` : '/';
}

// The Library's pages that GitHub Pages serves at the site root (not mirrored into game/)
// now open the published copy. Mutates the library body; returns how many entries changed.
function markSiteLinks(library, siteRoot, mirrored) {
  let changed = 0;
  for (const entry of library?.entries || []) {
    if (entry.servedBy === 'workbench-child' || entry.external || !entry.exists) continue;
    if (typeof entry.path !== 'string' || mirrored.has(entry.path)) continue;
    entry.external = true;
    entry.url = siteRoot + entry.path.split('/').map(encodeURIComponent).join('/');
    changed += 1;
  }
  return changed;
}

async function treeBytes(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    total += entry.isDirectory() ? await treeBytes(abs) : (await fs.stat(abs)).size;
  }
  return total;
}

// The machine paths the snapshot must not carry: the checkout, the temp state dir and the home
// directory, each as it appears in JSON text (plain and forward-slash forms). Longest first, so
// a path that contains another is removed whole. A root path ('/') is never a needle.
function machinePathNeedles(stateDir) {
  const found = new Set();
  for (const p of [REPO, ART_CHECKOUT, stateDir, os.homedir()]) {
    if (!p || p === path.parse(p).root) continue;
    for (const form of [p, p.replace(/\\/g, '/')]) found.add(JSON.stringify(form).slice(1, -1));
  }
  return [...found].sort((a, b) => b.length - a.length);
}

function scrubMachinePaths(json, needles) {
  let text = json;
  for (const needle of needles) text = text.split(needle).join('');
  return text;
}

// Boots the Workbench on a free port and records what its read-only API answers.
async function buildSnapshot(out, { base, previews }) {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wbs-'));
  const needles = machinePathNeedles(stateDir);
  let app = null;
  // A published gallery always describes the pinned release, even when the
  // caller has an unpublished authoring checkout selected in its terminal.
  const priorAuthoring=process.env.ASHEN_ART_CHECKOUT;
  delete process.env.ASHEN_ART_CHECKOUT;
  try {
    app = await createWorkbench({ root: REPO, port: 0, children: false, stateDir });
    const get = async (p) => {
      const res = await fetch(`${app.url}/api/${p}`, { headers: { 'x-studio-token': app.token } });
      const text = await res.text();
      let body = text;
      try { body = JSON.parse(text); } catch { /* a non-JSON answer is kept as text */ }
      return { status: res.status, body };
    };
    const snap = {};
    for (const p of SNAPSHOT_APIS) snap[p] = await get(p);
    if (!Array.isArray(snap['files/list'].body?.files)) throw new Error('files/list did not answer with a file list');

    const paths = new Set(snap['files/list'].body.files);
    for (const dir of SNAPSHOT_DIRS) {
      for (const f of (await get(`files/list?dir=${encodeURIComponent(dir)}`)).body?.files || []) paths.add(f);
    }
    for (const f of SNAPSHOT_FILES) paths.add(f);

    const index = {};
    let read = 0;
    for (const rel of [...paths].filter((p) => !p.startsWith(DESIGN_PREFIX) && p !== 'docs/design').sort()) {
      const file = safeRel(rel);
      const res = await get(`files/read?path=${encodeURIComponent(file)}`);
      if (res.status !== 200) continue;
      index[file] = { hash: res.body.hash, kind: res.body.kind };
      await writeOut(out, `static-api/files/${file}.json`, scrubMachinePaths(JSON.stringify(res.body), needles));
      read += 1;
    }

    markSiteLinks(snap.library?.body, siteRootOf(base), new Set(previews));
    const git = snap.git?.body || {};
    const meta = { branch: git.branch || '', head: git.head || '', builtAt: new Date().toISOString() };
    // The settings' environment is the build machine's: its values are not published.
    const env = snap.settings?.body?.env;
    if (env && typeof env === 'object') for (const k of Object.keys(env)) env[k] = '';
    await writeOut(out, 'static-api/snapshot.json', scrubMachinePaths(JSON.stringify({ meta, snap, index }), needles));
    return read;
  } finally {
    if (app) await app.close();
    if(priorAuthoring!==undefined)process.env.ASHEN_ART_CHECKOUT=priorAuthoring;
    await fs.rm(stateDir, { recursive: true, force: true });
  }
}

async function main() {
  const { out: outArg, base, art } = parseArgs(process.argv.slice(2));
  const out = path.resolve(outArg);
  const warnings = [];
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  const previews = await rootPreviewPages();
  const mirroredPages = [...previews];
  if (existsSync(path.join(REPO, 'pose-studio/enemy-back-proposals/index.html'))) mirroredPages.push('pose-studio/enemy-back-proposals/index.html');
  const files = await buildSnapshot(out, { base, previews: mirroredPages });

  // The UI, with its absolute paths moved under the base.
  const uiRewrite = { re: UI_REWRITE, to: `$1${base}$2` };
  for (const name of UI_NAMES) {
    const src = path.join(REPO, 'workbench', name);
    if (!existsSync(src)) { if (name === 'index.html' || name === 'app.mjs') throw new Error(`missing workbench/${name}`); continue; }
    await copyTree(src, path.join(out, name), { textRe: UI_TEXT, rewrite: uiRewrite });
  }

  // The static-api module answers the app's /api calls; it must load before app.mjs.
  const shimSrc = path.join(REPO, 'workbench', 'static', 'static-api.mjs');
  if (existsSync(shimSrc)) {
    await writeOut(out, 'static/static-api.mjs', await fs.readFile(shimSrc));
    const indexPath = path.join(out, 'index.html');
    const html = await fs.readFile(indexPath, 'utf8');
    const appTag = /<script type="module"[^>]*\bsrc="[^"]*app\.mjs"/;
    if (!appTag.test(html)) throw new Error('workbench/index.html has no module script for app.mjs');
    const shimTag = `<script type="module" src="${base}static/static-api.mjs"></script>\n`;
    await fs.writeFile(indexPath, html.replace(appTag, (m) => shimTag + m));
  } else {
    warnings.push('workbench/static/static-api.mjs is missing: the page will not answer /api calls');
  }

  // The game runtime that tools/serve.mjs serves from the checkout.
  // A render page with <base href="/"> resolves every relative path from the game root, so
  // its base moves to the mirror's root and its ../../../ (the way back to the root from
  // workbench/modules/<module>/) is dropped.
  const gameRewrite = {
    re: GAME_REWRITE, to: `$1${base}game/$2/`,
    after: (text) => (text.includes('<base href="/">') ? text.replace('<base href="/">', `<base href="${base}game/">`).replace(/(["'])(?:\.\.\/){3}/g, '$1') : text),
  };
  const game = path.join(out, 'game');
  await copyTree(path.join(REPO, 'index.html'), path.join(game, 'index.html'), { textRe: GAME_TEXT, rewrite: gameRewrite });
  // The root preview pages the Entity Browser and Library open from the game server.
  for (const name of previews) await copyTree(path.join(REPO, name), path.join(game, name), { textRe: GAME_TEXT, rewrite: gameRewrite });
  for (const dir of ['src', 'styles']) await copyTree(path.join(REPO, dir), path.join(game, dir), { textRe: GAME_TEXT, rewrite: gameRewrite });
  await copyTree(path.join(REPO, 'workbench', 'modules'), path.join(game, 'workbench', 'modules'), { textRe: GAME_TEXT, rewrite: gameRewrite });
  for (const entry of await fs.readdir(path.join(REPO, 'pose-studio'), { withFileTypes: true })) {
    if (entry.isFile() && /\.(mjs|js|css|html)$/.test(entry.name)) {
      await copyTree(path.join(REPO, 'pose-studio', entry.name), path.join(game, 'pose-studio', entry.name), { textRe: GAME_TEXT, rewrite: gameRewrite });
    }
  }
  // Scoped authoring review: nested module and its feature-local draft sources.
  for (const dir of ['pose-studio/enemy-back-proposals', 'art/enemy-back-proposals', 'art/enemy-back-motion']) {
    const source = dir.startsWith('art/') ? compositeSourcePath(dir,{root:REPO,assetRoot:ART_CHECKOUT}) : path.join(REPO, dir);
    if (existsSync(source)) await copyTree(source, path.join(game, dir), { textRe: GAME_TEXT, rewrite: gameRewrite });
    if (dir === 'pose-studio/enemy-back-proposals' && existsSync(path.join(game, dir, 'index.html'))) {
      const page = path.join(game, dir, 'index.html');
      await fs.writeFile(page, (await fs.readFile(page, 'utf8')).replace('../../workbench/index.html#mod=assets', `${base}index.html#mod=assets`));
    }
  }
  if (art) {
    let light;
    try {light=artDir('assets-mobile',{root:REPO}).dir;}catch{light=null;}
    if (light && existsSync(light)) await copyTree(light, path.join(game, 'assets'));
    else warnings.push('assets-mobile/ is missing: game/assets/ was not written');
    await copyGameFonts(game);
    // The Asset Gallery loads its display art from ${base}asset-file/<repo path>. The light art is
    // not copied again: the gallery reads it from game/assets/ (ASHEN_ASSET_URL in static-api.mjs).
    let display;
    try {display=artDir('assets-display',{root:REPO}).dir;}catch{display=null;}
    if (display && existsSync(display)) await copyTree(display, path.join(out, 'asset-file', 'assets-display'));
    else warnings.push('pinned common assets-display/ is missing: fetch the common art pack before publishing the gallery');
    // Only the retained metadata comes from the game tree. Do not copy stale
    // local image originals over the verified common pack.
    const metadata=path.join(REPO,'assets-display');
    async function copyMetadata(dir){
      for(const entry of await fs.readdir(dir,{withFileTypes:true})){
        const source=path.join(dir,entry.name);
        if(entry.isDirectory())await copyMetadata(source);
        else if(entry.isFile()&&/\.(json|md)$/.test(entry.name))await copyTree(source,path.join(out,'asset-file','assets-display',path.relative(metadata,source)));
      }
    }
    if(existsSync(metadata))await copyMetadata(metadata);
  }

  const bytes = await treeBytes(out);
  for (const w of warnings) console.warn(`workbench-static: warning: ${w}`);
  console.log(`workbench-static: ${files} files in the snapshot, ${(bytes / 1048576).toFixed(1)} MB in ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`workbench-static: ${err.message}`);
    process.exitCode = 1;
  });
}
