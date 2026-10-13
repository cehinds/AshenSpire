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
// /assets/ with the light twin.
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

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_PREFIX = 'docs/design/';
const UI_NAMES = ['index.html', 'app.mjs', 'workbench.css', 'shared', 'ui', 'modules', 'lib'];
const UI_REWRITE = /(["'`(])\/(api|shared|ui|modules|lib|static|export|asset-file|app\.mjs|workbench\.css)\b/g;
const GAME_REWRITE = /(["'`(])\/(workbench|styles|src|assets|pose-studio)\//g;
const PREVIEW_PAGE = /^([\w.-]+-preview|tooltip-review[\w.-]*)\.html$/;
const UI_TEXT = /\.(html|mjs|js|css)$/;
const GAME_TEXT = /\.(html|mjs|js|css|json|svg)$/;
const SNAPSHOT_DIRS = ['content', 'docs/tag-model', 'pose-studio/renewal', 'pose-studio/stances', 'workbench/workspace', 'ui-studio/workspace'];
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
  if (rewrite && textRe && textRe.test(src)) await fs.writeFile(dst, (await fs.readFile(src, 'utf8')).replace(rewrite.re, rewrite.to));
  else await fs.copyFile(src, dst);
}

async function treeBytes(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    total += entry.isDirectory() ? await treeBytes(abs) : (await fs.stat(abs)).size;
  }
  return total;
}

// Boots the Workbench on a free port and records what its read-only API answers.
async function buildSnapshot(out) {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wbs-'));
  let app = null;
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
      await writeOut(out, `static-api/files/${file}.json`, JSON.stringify(res.body));
      read += 1;
    }

    const git = snap.git?.body || {};
    const meta = { branch: git.branch || '', head: git.head || '', builtAt: new Date().toISOString() };
    await writeOut(out, 'static-api/snapshot.json', JSON.stringify({ meta, snap, index }));
    return read;
  } finally {
    if (app) await app.close();
    await fs.rm(stateDir, { recursive: true, force: true });
  }
}

async function main() {
  const { out: outArg, base, art } = parseArgs(process.argv.slice(2));
  const out = path.resolve(outArg);
  const warnings = [];
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });

  const files = await buildSnapshot(out);

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
  const gameRewrite = { re: GAME_REWRITE, to: `$1${base}game/$2/` };
  const game = path.join(out, 'game');
  await copyTree(path.join(REPO, 'index.html'), path.join(game, 'index.html'), { textRe: GAME_TEXT, rewrite: gameRewrite });
  // The root preview pages the Entity Browser and Library open from the game server.
  for (const entry of await fs.readdir(REPO, { withFileTypes: true })) {
    if (entry.isFile() && PREVIEW_PAGE.test(entry.name)) {
      await copyTree(path.join(REPO, entry.name), path.join(game, entry.name), { textRe: GAME_TEXT, rewrite: gameRewrite });
    }
  }
  for (const dir of ['src', 'styles']) await copyTree(path.join(REPO, dir), path.join(game, dir), { textRe: GAME_TEXT, rewrite: gameRewrite });
  await copyTree(path.join(REPO, 'workbench', 'modules'), path.join(game, 'workbench', 'modules'), { textRe: GAME_TEXT, rewrite: gameRewrite });
  for (const entry of await fs.readdir(path.join(REPO, 'pose-studio'), { withFileTypes: true })) {
    if (entry.isFile() && /\.(mjs|js|css|html)$/.test(entry.name)) {
      await copyTree(path.join(REPO, 'pose-studio', entry.name), path.join(game, 'pose-studio', entry.name), { textRe: GAME_TEXT, rewrite: gameRewrite });
    }
  }
  if (art) {
    const light = path.join(REPO, 'assets-mobile');
    if (existsSync(light)) await copyTree(light, path.join(game, 'assets'));
    else warnings.push('assets-mobile/ is missing: game/assets/ was not written');
  }

  const bytes = await treeBytes(out);
  for (const w of warnings) console.warn(`workbench-static: warning: ${w}`);
  console.log(`workbench-static: ${files} files in the snapshot, ${(bytes / 1048576).toFixed(1)} MB in ${out}`);
}

main().catch((err) => {
  console.error(`workbench-static: ${err.message}`);
  process.exitCode = 1;
});
