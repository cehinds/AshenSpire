// tests/music-score.test.mjs — the written score, its renders and the manifest agree.
//
// The shipped music is code (music/score/*.mjs) rendered to MP3 by
// tools/score/render.mjs. This holds the three homes to each other: every
// score plays under a context the engine knows, the manifest names exactly one
// render per score and nothing else, every named file exists, and the
// synthesizer is deterministic (the same score renders the same samples), so a
// committed render can always be reproduced from its source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { BEDS } = await import('../src/content/music.js');
const { Score, chord } = await import('../tools/score/compose.mjs');
const { render } = await import('../tools/score/synth.mjs');

const scoreIds = readdirSync(join(ROOT, 'music/score')).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).map((f) => f.replace(/\.mjs$/, ''));
const manifest = JSON.parse(readFileSync(join(ROOT, 'music/manifest.json'), 'utf8'));

test('every score plays under a context the engine has a bed for', async () => {
  assert.ok(scoreIds.length > 0, 'music/score/ holds at least one score');
  for (const id of scoreIds) {
    const mod = await import(pathToFileURL(join(ROOT, 'music/score', `${id}.mjs`)).href);
    assert.ok(mod.context in BEDS, `${id}: context '${mod.context}' is not a BEDS key`);
    assert.ok(mod.default instanceof Score, `${id}: default export is a Score`);
    assert.ok(mod.default.events.length > 0, `${id}: has notes`);
  }
});

test('the manifest names exactly one existing render per score', async () => {
  const listed = Object.entries(manifest).filter(([k]) => k !== '_comment').flatMap(([, v]) => v);
  for (const rel of listed) assert.ok(existsSync(join(ROOT, 'music', rel)), `manifest names a missing file: ${rel}`);
  const expected = [];
  for (const id of scoreIds) {
    const { context } = await import(pathToFileURL(join(ROOT, 'music/score', `${id}.mjs`)).href);
    const rel = `${context.startsWith('map-') ? 'map' : context}/${id}.mp3`;
    expected.push(rel);
    assert.ok((manifest[context] ?? []).includes(rel), `${id}: manifest['${context}'] lists ${rel}`);
  }
  assert.deepEqual([...listed].sort(), expected.sort(), 'the manifest lists renders of the scores and nothing else');
});

test('the synthesizer is deterministic and loops without a gap', () => {
  const make = () => {
    const s = new Score({ bpm: 90, bars: 2, seed: 3 });
    s.pad('strings', [[chord('D3', 'm'), 2]]);
    s.note('harp', 0, 1, 'A4');
    s.note('taiko', 2, 1, 'D2');
    return render(s.toJSON());
  };
  const a = make(), b = make();
  assert.equal(a.left.length, Math.round(a.seconds * 48000));
  assert.deepEqual(a.left, b.left);
  assert.deepEqual(a.right, b.right);
  // The folded tail means the first samples carry sound from the end.
  let head = 0;
  for (let i = 0; i < 4800; i++) head += Math.abs(a.left[i]);
  assert.ok(head > 0, 'the loop start carries the tail of the end');
});

test('the alt cut swaps cello for bass and brings the heartbeat forward', async () => {
  const { altScore } = await import('../tools/score/alt.mjs');
  const { inGameBeat } = await import('../music/score/_motifs.mjs');
  for (const context of ['map', 'combat']) {
    const s = new Score({ bpm: 60, bars: 2, seed: 1 });
    inGameBeat(s, context);
    s.note('cello', 0, 2, 'D4');
    const alt = altScore(s.toJSON());
    assert.ok(!alt.events.some((e) => e.inst === 'cello' || e.inst === 'gamethump'), `${context}: no cello or bare thump left`);
    assert.ok(alt.events.some((e) => e.inst === 'bass' && e.midi === 62 - 12), `${context}: the cello lead drops an octave onto the bass`);
    assert.ok(alt.events.filter((e) => e.inst === 'heart').length >= 8, `${context}: a heartbeat on every in-game note`);
    assert.ok(render(alt).left.length > 0);
  }
});
