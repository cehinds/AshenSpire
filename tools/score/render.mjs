#!/usr/bin/env node
// tools/score/render.mjs — render the written score into the shipped tracks.
//
//   node tools/score/render.mjs --out /tmp/r    # every score in music/score/, to /tmp/r
//   node tools/score/render.mjs --out /tmp/r map-pale-marches boss
//   node tools/score/render.mjs --alt --out /tmp/alt   # the alt cut (alt.mjs)
//
// Each music/score/<id>.mjs exports `context` (the manifest key it plays under)
// and `default` (a Score). The render lands at music/<folder>/<id>.mp3, where
// <folder> is the context with `map-` regions filed under map/. Encoding needs
// ffmpeg: FFMPEG=/path/to/ffmpeg, else `ffmpeg` on PATH. manifest.json is
// rewritten from what rendered, so the manifest always names exactly the files
// the scores produce.
//
// The score source is the asset; the MP3s are its build output, shipped so
// the game can stream them without this tool. SINCE docs/EXTERNAL-ASSETS-PLAN.md
// STEP 13 the shipped renders and music/manifest.json live in the art
// repository's common pack (cehinds/AshenSpire-art common/music, rendered there
// by its own tools/score/), not in this checkout, where music/*.mp3 and
// music/manifest.json are ignored. So a render here needs --out <dir> (an
// audition, which leaves any manifest alone); without it the tool says where
// the shipped renders are made and exits 2. The score source (music/score/*.mjs)
// stays here: tests/music-score.test.mjs holds it to the shipped manifest.

import { readdirSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { render, wav } from './synth.mjs';
import { altScore } from './alt.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCORES = join(ROOT, 'music/score');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const argv = process.argv.slice(2);
const ALT = argv.includes('--alt');
const outAt = argv.indexOf('--out');
if (outAt >= 0 && !argv[outAt + 1]) { console.error('render: --out needs a directory'); process.exit(1); }
// The alt cut never overwrites the shipped renders: it must be sent elsewhere.
if (ALT && outAt < 0) { console.error('render: --alt needs --out <dir> (it must not replace the shipped renders in music/)'); process.exit(1); }
if (outAt < 0) { console.error('render: the shipped renders and music/manifest.json are made in cehinds/AshenSpire-art (common/music, its tools/score/render.mjs) since docs/EXTERNAL-ASSETS-PLAN.md step 13 — here, pass --out <dir> to audition a render'); process.exit(2); }
const OUT = resolve(argv[outAt + 1]);
const wanted = argv.filter((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1));
const files = readdirSync(SCORES).filter((f) => f.endsWith('.mjs') && !f.startsWith('_'));
const ids = files.map((f) => f.replace(/\.mjs$/, ''));
for (const w of wanted) if (!ids.includes(w)) { console.error(`render: no score music/score/${w}.mjs`); process.exit(1); }

const folderOf = (context) => (context.startsWith('map-') ? 'map' : context);
const rendered = [];
for (const id of ids) {
  const mod = await import(pathToFileURL(join(SCORES, `${id}.mjs`)).href);
  const context = mod.context;
  const rel = `${folderOf(context)}/${id}.mp3`;
  rendered.push({ id, context, rel });
  if (wanted.length && !wanted.includes(id)) continue;
  const t0 = Date.now();
  const score = ALT ? altScore(mod.default.toJSON()) : mod.default.toJSON();
  const { left, right, seconds } = render(score);
  const tmp = join(tmpdir(), `score-${id}-${process.pid}.wav`);
  writeFileSync(tmp, wav(left, right));
  const out = join(OUT, rel);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', '160k', out]);
  rmSync(tmp, { force: true });
  console.log(`render: ${id.padEnd(20)} ${context.padEnd(20)} ${seconds.toFixed(1).padStart(5)} s  ${score.events.length} notes  ${((Date.now() - t0) / 1000).toFixed(1)} s → ${join(OUT, rel)}`);
}

// The manifest names exactly what the scores produce (every score, rendered
// this run or before), keyed by context. An alt or out-of-tree render leaves
// it alone.
if (ALT || outAt >= 0) process.exit(0);
const manifestPath = join(ROOT, 'music/manifest.json');
const old = JSON.parse(readFileSync(manifestPath, 'utf8'));
const next = { _comment: old._comment };
for (const key of Object.keys(old)) if (key !== '_comment') next[key] = [];
for (const r of rendered) (next[r.context] ??= []).push(r.rel);
writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`render: manifest.json lists ${rendered.length} track(s)`);
