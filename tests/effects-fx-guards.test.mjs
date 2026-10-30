// EFFECTS OFF (owner, 2026-10-30): no sparks, slashes, glyphs, flares, proc flashes
// or shake — but the damage number (and fighter motion classes) still play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playTimeline, setAnimSpeed } from '../src/ui/fx.js';
import { registerStage } from '../src/ui/services/PoseAnimator.js';
import { withKitDom } from './helpers/kit-dom.mjs';
import { haptic } from '../src/ui/haptics.js';
import { setCombatPacing } from '../src/ui/animationPace.js';
import { effectsOff, motionOff } from '../src/ui/performance.js';
setCombatPacing({ combatSpeed: 1 });

function play(t, effects) {
  let out;
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
  t.mock.method(globalThis.performance, 'now', () => Date.now());
  withKitDom((dom) => {
    const priorRoot = dom.document.documentElement;
    dom.document.documentElement = { dataset: { effects: effects ? 'on' : 'off' } };
    const actor = dom.document.createElement('div');
    const target = dom.document.createElement('div');
    const layer = dom.document.createElement('div');
    const combatEl = dom.document.createElement('div');
    actor.className = target.className = 'sprite';
    const oldSink = haptic.sink; haptic.sink = () => {};
    registerStage(target, { play: () => true, hold() {}, settle() {} });
    const ctx = { layer, combatEl, anchorFor: (id) => id === 'enemy' ? actor : target,
      animateActor: () => ({ impactMs: 100, totalMs: 800, hold() {}, cancel() {} }),
      onFlush() {}, onBeatApplied() {}, maxHpFor: () => 50 };
    try {
      playTimeline([{ type: 'enemyMoveStarted', sourceId: 'enemy', kind: 'attack' },
        { type: 'damageDealt', sourceId: 'enemy', targetId: 'player', amount: 20 }], ctx, () => {});
      const seen = new Set();
      for (let i = 0; i < 3000; i++) { t.mock.timers.tick(1); for (const c of layer.children) seen.add(String(c.className)); }
      out = { classes: [...seen], shaken: combatEl.classList.contains('shake') };
    } finally { haptic.sink = oldSink; setAnimSpeed('normal'); dom.document.documentElement = priorRoot; }
  });
  t.mock.timers.reset();
  return out;
}

test('Effects off drops the sparks and the shake; Effects on plays them', (t) => {
  const off = play(t, false);
  assert.equal(off.shaken, false, 'no screen shake with Effects off');
  assert.ok(!off.classes.some(c => /fx-(slash|spark|shatter|glyph)/.test(c)), 'no impact particles');
  const on = play(t, true);
  assert.ok(on.classes.some(c => /fx-slash/.test(c)), 'Effects on spawns the slash: ' + on.classes.join('|'));
  assert.equal(on.shaken, true, 'and shakes');
});

test('Effects off still shows the damage number', (t) => {
  const off = play(t, false);
  const on = play(t, true);
  assert.ok(on.classes.some(c => /dmg|float/.test(c)), 'the number plays with Effects on: ' + on.classes.join('|'));
  assert.ok(off.classes.some(c => /dmg|float/.test(c)), 'and with it off');
  assert.equal(off.classes.some(c => /dmg|float/.test(c)), on.classes.some(c => /dmg|float/.test(c)), 'the number is untouched by Effects');
});

test('the root helpers read the attributes main.js writes', () => {
  assert.equal(effectsOff(), false, 'no document: not off');
  assert.equal(motionOff('attack'), false);
});

test('Effects-off CSS never blanks a figure\'s filter: focus ring, skill-selected and target outlines survive', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
  const off = rules.filter(r => /data-effects=['"]off['"]/.test(r.sel) && /(^|[;\s])filter\s*:/.test(r.body));
  for (const r of off) {
    for (const part of r.sel.split(',').map(s => s.trim())) {
      assert.ok(!/\.sprite(\s|$|:)/.test(part.replace(/\.sprite\s+(img|\.facing)/, '')) || !/data-effects/.test(part),
        `an Effects-off rule sets filter on a .sprite host: ${part}`);
      assert.ok(!/\.sprite\s+(img|\.facing)/.test(part), `an Effects-off rule sets filter on the aura layer: ${part}`);
    }
  }
  // the three states that must stay visible are still defined, unconditionally
  assert.match(css, /\.combat \.combatant:focus-visible \.sprite \{ filter: drop-shadow/);
  assert.doesNotMatch(css, /data-performance='lite'\]:not\(\[data-effects='off'\]\)/, 'the unreachable lite selector is gone');
});

test('image figures draw only the held stance glow with Effects off (no casting pulse)', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/ui/paintedOutfits.js', import.meta.url), 'utf8');
  assert.match(src, /effectsOff\(\) \? auraFilter\('ready', resting, \[\], false\)/);
  const fx = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
  assert.match(fx, /timing\.scale === 0 \|\| effectsOff\(\) \? 0/, 'the hit-stop duration itself is 0 with Effects off');
  assert.match(fx, /holdFor = \(event\) => \(!effectsOff\(\) &&/);
});

test('idle motion off stops resting swaps but lets every action pose through', async () => {
  const { createPoseStage } = await import('../src/ui/services/PoseAnimator.js');
  const dom = (await import('./helpers/reward-dom.mjs')).rewardDom();
  const saved = { document: globalThis.document, Image: globalThis.Image };
  globalThis.document = dom.document; globalThis.Image = class { set src(v) { this._s = v; } };
  dom.document.body.classList.add('motion-idle-off');
  try {
    const stage = createPoseStage('reaver', 'gold');
    assert.ok(stage, 'the class has a pose stage');
    for (const pose of ['attack', 'guard', 'hit']) if (stage.poses.includes(pose)) assert.equal(stage.play(pose, 100), true, `${pose} plays`);
    assert.equal(stage.play('guard', 100), true, 'guard (what fx.js plays for non-attack actions) plays');
    assert.equal(stage.play('idle', 100), false, 'an idle swap is refused');
  } finally { globalThis.document = saved.document; globalThis.Image = saved.Image; }
});

test('with Effects off the figure hit keyframes keep the recoil and drop the red tint', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const frames = name => { const m = css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}|@keyframes ${name} \\{([^\\n]*)\\}`)); return (m && (m[1] || m[2])) || ''; };
  const names = new Map();
  for (const m of css.matchAll(/(:root\[data-effects='off'\][^{]*\.sprite\.hitflash[^{]*>\s*:first-child)\s*\{\s*animation-name:\s*([\w-]+)/g)) names.set(m[1], m[2]);
  assert.equal(names.size, 5, 'generic, enemy, player and both heavy variants are overridden');
  for (const name of new Set(names.values())) {
    const body = frames(name);
    assert.match(body, /translateX/, `${name} keeps the recoil`);
    assert.doesNotMatch(body, /filter/, `${name} carries no tint`);
  }
  assert.match(css, /:root\[data-effects='off'\] body\.motion-hit-off \.sprite\.hitflash > :first-child/, 'motionHit off still removes the recoil');
});
