// tests/sfx-voices.test.mjs — the SFX presentation layer in ui/audio.js:
// pitch variance on synthesized tones, the 8-voice cap, the 40 ms per-id
// dedupe, and the heavy hit's 60 Hz thump (content/sfx.js).
//
// Driven through the real initAudio() over the shared WebAudio stub; the
// stub's context is captured so a test can move the audio clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { installWebAudioStub, stubGraph } = await import('../tools/webaudio-stub.mjs');
installWebAudioStub();
const graph = stubGraph();

// Capture the context initAudio() builds so the clock can be driven.
const BaseCtx = window.AudioContext;
let ctx = null;
window.AudioContext = class extends BaseCtx { constructor() { super(); ctx = this; } };
// No sample is ever available here; the synth is what plays.
globalThis.fetch = async () => ({ ok: false, status: 404 });

const { initAudio, sfxVariance } = await import('../src/ui/audio.js');
const { SFX_RECIPES } = await import('../src/content/sfx.js');

const isVoice = (n) => n.kind === 'osc' || n.kind === 'buffersource';
const voiceCount = () => graph.nodes.filter(isVoice).length;
const live = () => graph.nodes.filter((n) => isVoice(n) && typeof n.onended === 'function').length;
const oscs = () => graph.nodes.filter((n) => n.kind === 'osc');
const fresh = () => {
  graph.nodes.length = 0;
  graph.reset();
  return initAudio({ musicVolume: 100, sfxVolume: 100, muteAudio: false });
};
const endAll = () => graph.nodes.filter(isVoice).forEach((n) => n.onended?.());
const withRng = (value, fn) => {
  const old = sfxVariance.rng;
  sfxVariance.rng = () => value;
  try { return fn(); } finally { sfxVariance.rng = old; }
};

test('tone pitch is scaled by 1 +/- 4 %', () => {
  const recipe = SFX_RECIPES.hit_light.find((l) => l.kind === 'tone');
  const heard = (rng) => withRng(rng, () => {
    const engine = fresh();
    ctx.currentTime = 100;
    engine.sfx('hit_light');
    return oscs()[0].frequency.value;
  });
  assert.equal(heard(0.5), recipe.freq, 'the midpoint draw leaves the pitch alone');
  assert.ok(Math.abs(heard(1) - recipe.freq * 1.04) < 1e-9, 'top of the range is +4 %');
  assert.ok(Math.abs(heard(0) - recipe.freq * 0.96) < 1e-9, 'bottom of the range is -4 %');
});

test('one pitch draw per cue: the layers of a multi-tone cue share the factor', () => {
  const id = Object.keys(SFX_RECIPES).find((k) => SFX_RECIPES[k].filter((l) => l.kind !== 'noise').length >= 2);
  assert.ok(id, 'a recipe with two or more tone layers exists');
  const recipe = SFX_RECIPES[id].filter((l) => l.kind !== 'noise');
  const draws = [1, 0, 1, 0, 1, 0];
  const old = sfxVariance.rng;
  sfxVariance.rng = () => draws.shift() ?? 0.5;
  try {
    const engine = fresh();
    ctx.currentTime = 100;
    engine.sfx(id);
    const made = oscs();
    assert.equal(made.length, recipe.length);
    const factors = made.map((o, i) => o.frequency.value / recipe[i].freq);
    for (const f of factors) assert.ok(Math.abs(f - factors[0]) < 1e-9, `every layer carries the one draw (${factors.join(', ')})`);
  } finally { sfxVariance.rng = old; }
});

test('a cue whose sample is still warming reserves its synth layers, not one voice', () => {
  const engine = fresh();
  const id = Object.keys(SFX_RECIPES).find((k) => SFX_RECIPES[k].length >= 3);
  assert.ok(id, 'a recipe with three or more layers exists');
  const layers = SFX_RECIPES[id].length;
  let t = 30;
  // Fill to 8 - layers + 1 live voices with single-layer cues, then the
  // multi-layer cue must be refused: its sample is not ready, so it is a synth.
  const single = Object.keys(SFX_RECIPES).find((k) => SFX_RECIPES[k].length === 1);
  assert.ok(single, 'a one-layer recipe exists');
  while (live() < 8 - layers + 1) { t += 0.1; ctx.currentTime = t; engine.sfx(single); }
  const before = voiceCount();
  t += 0.1; ctx.currentTime = t; engine.sfx(id);
  assert.equal(voiceCount(), before, `the ${layers}-layer cue is refused on ${live()} live voices`);
  endAll();
});

test('the same id inside 40 ms plays once; a different id in that window still plays', () => {
  const engine = fresh();
  ctx.currentTime = 10;
  engine.sfx('cardDraw');
  const first = voiceCount();
  assert.ok(first > 0, 'the first cue sounds');
  ctx.currentTime = 10.03;
  engine.sfx('cardDraw');
  assert.equal(voiceCount(), first, 'a repeat 30 ms later is dropped');
  engine.sfx('cardDiscard');
  assert.ok(voiceCount() > first, 'a different id in the same window still plays');
  const before = voiceCount();
  ctx.currentTime = 10.05;
  engine.sfx('cardDraw');
  assert.ok(voiceCount() > before, 'the same id 50 ms after the first plays again');
});

test('at most 8 voices are live; a refused cue is dropped silently; ended voices free the cap', () => {
  const engine = fresh();
  let t = 20;
  const cue = () => { t += 0.1; ctx.currentTime = t; engine.sfx('cardDraw'); };
  cue();
  const perCue = live();
  assert.ok(perCue >= 1 && perCue <= 8);
  for (let i = 0; i < 20; i++) cue();
  assert.ok(live() <= 8 && live() > 8 - perCue, `the cap is hard: a cue that would pass 8 is refused whole (live ${live()}, per cue ${perCue})`);
  const made = voiceCount();
  cue();
  assert.equal(voiceCount(), made, 'a cue past the cap makes no sound');
  endAll();
  assert.equal(live(), 0, 'every ended voice is released');
  cue();
  assert.ok(voiceCount() > made, 'once voices end, cues play again');
});

test('hit_heavy carries an 80 ms 60 Hz sine thump from t0 0', () => {
  const thump = SFX_RECIPES.hit_heavy.find((l) => l.kind === 'tone' && l.freq === 60);
  assert.ok(thump, 'hit_heavy has a 60 Hz tone row');
  assert.equal(thump.type, 'sine');
  assert.equal(thump.dur, 0.08);
  assert.equal(thump.t0 ?? 0, 0);
  assert.ok(thump.peak >= 0.4 && thump.peak <= 0.6);
  assert.ok(SFX_RECIPES.hit_heavy.length >= 4, 'the existing layers are still there');
});

test('the hold phrase: every tick sounds, even twice at the same instant', () => {
  const tick = SFX_RECIPES.holdTick.length;
  const engine = fresh();
  ctx.currentTime = 40;
  engine.sfx('holdTick');
  const once = voiceCount();
  assert.equal(once, tick, 'the first tick sounds its recipe layers');
  engine.sfx('holdTick');
  assert.equal(voiceCount(), 2 * tick, 'a second tick at the same instant still sounds');

  const other = fresh();
  ctx.currentTime = 50;
  other.sfx('cardDraw');
  const drawn = voiceCount();
  assert.ok(drawn > 0, 'the first cardDraw sounds');
  other.sfx('cardDraw');
  assert.equal(voiceCount(), drawn, 'a repeat cardDraw at the same instant is still deduped');
});

test('the hold phrase stays on the score pitch; other cues still take the pitch draw', () => {
  const tick = SFX_RECIPES.holdTick.find((l) => l.kind === 'tone');
  const commit = SFX_RECIPES.holdCommit.find((l) => l.kind === 'tone');
  const hit = SFX_RECIPES.hit_light.find((l) => l.kind === 'tone');
  withRng(1, () => {
    const engine = fresh();
    ctx.currentTime = 60;
    engine.sfx('holdTick');
    assert.equal(oscs()[0].frequency.value, tick.freq, 'holdTick is exactly on its score note');
  });
  withRng(1, () => {
    const engine = fresh();
    ctx.currentTime = 61;
    engine.sfx('holdCommit');
    assert.equal(oscs()[0].frequency.value, commit.freq, 'holdCommit first layer is exactly on its score note');
  });
  withRng(1, () => {
    const engine = fresh();
    ctx.currentTime = 62;
    engine.sfx('hit_light');
    assert.ok(Math.abs(oscs()[0].frequency.value - hit.freq * 1.04) < 1e-9, 'hit_light is still scaled by the draw');
  });
});
