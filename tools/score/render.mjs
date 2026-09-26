#!/usr/bin/env node
// tools/score/render.mjs — render the written score into the shipped tracks.
//
//   node tools/score/render.mjs                 # every score in music/score/
//   node tools/score/render.mjs map-pale-marches boss
//
// Each music/score/<id>.mjs exports `context` (the manifest key it plays under)
// and `default` (a Score). The render lands at music/<folder>/<id>.mp3, where
// <folder> is the context with `map-` regions filed under map/. Encoding needs
// ffmpeg: FFMPEG=/path/to/ffmpeg, else `ffmpeg` on PATH. manifest.json is
// rewritten from what rendered, so the manifest always names exactly the files
// the scores produce.
//
// The score source is the asset; the MP3s are its build output, committed so
// the game can stream them without this tool.

import { readdirSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { render, wav } from './synth.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCORES = join(ROOT, 'music/score');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const wanted = process.argv.slice(2);
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
  const score = mod.default.toJSON();
  const { left, right, seconds } = render(score);
  const tmp = join(tmpdir(), `score-${id}-${process.pid}.wav`);
  writeFileSync(tmp, wav(left, right));
  const out = join(ROOT, 'music', rel);
  mkdirSync(dirname(out), { recursive: true });
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', '160k', out]);
  rmSync(tmp, { force: true });
  console.log(`render: ${id.padEnd(20)} ${context.padEnd(20)} ${seconds.toFixed(1).padStart(5)} s  ${score.events.length} notes  ${((Date.now() - t0) / 1000).toFixed(1)} s → music/${rel}`);
}

// The manifest names exactly what the scores produce (every score, rendered
// this run or before), keyed by context.
const manifestPath = join(ROOT, 'music/manifest.json');
const old = JSON.parse(readFileSync(manifestPath, 'utf8'));
const next = { _comment: old._comment };
for (const key of Object.keys(old)) if (key !== '_comment') next[key] = [];
for (const r of rendered) (next[r.context] ??= []).push(r.rel);
writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
console.log(`render: manifest.json lists ${rendered.length} track(s)`);
