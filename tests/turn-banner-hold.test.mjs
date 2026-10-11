// A turn banner must be gone by the time the next beat starts, at every pace.
// The timeline waits turnBannerHoldMs(pace) after a banner beat; the banner's
// display time and fade are set from that same hold (ui/fx.js banner, lifeMs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIM_SPEEDS, COMBAT_TIMING, turnBannerHoldMs } from '../src/ui/animationPace.js';
import { banner } from '../src/ui/fx.js';

// The holds the three paced presets produce today, hard-coded.
const EXPECTED_HOLD = { slow: 420, normal: 240, fast: 156 };

// A minimal DOM shim: enough for banner() to build an element, attach it to a
// layer and record its inline custom property. Timers are recorded, not run.
function withBannerShim(fn) {
  const saved = { document: globalThis.document, setTimeout: globalThis.setTimeout };
  const timers = [];
  const layer = { children: [], appendChild(el) { this.children.push(el); return el; } };
  globalThis.document = {
    createElement: () => ({
      className: '', textContent: '', removed: false,
      style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
      remove() { this.removed = true; },
    }),
  };
  globalThis.setTimeout = (fn2, ms) => { timers.push({ fn: fn2, ms }); return timers.length; };
  try { return fn({ layer, timers }); } finally {
    globalThis.document = saved.document;
    globalThis.setTimeout = saved.setTimeout;
  }
}

for (const [name, speed] of Object.entries(ANIM_SPEEDS)) {
  if (!speed) continue;
  const hold = turnBannerHoldMs(speed);
  assert.equal(hold, Math.max(COMBAT_TIMING.turnBannerFloorMs, speed.beatMs), `${name}: hold is max(floor, beatMs)`);
  assert.equal(hold, EXPECTED_HOLD[name], `${name}: hard-coded hold ${EXPECTED_HOLD[name]} ms`);
  withBannerShim(({ layer, timers }) => {
    banner(layer, 'YOUR TURN', 'turn', hold);
    const el = layer.children[0];
    assert.equal(el.style.props['--fx-banner-ms'], `${hold}ms`, `${name}: banner fade is the hold`);
    const removal = timers.find(t => t.ms === hold);
    assert.ok(removal, `${name}: banner removal is scheduled at exactly the hold (${hold} ms)`);
    removal.fn();
    assert.equal(el.removed, true, `${name}: the banner is removed when its hold elapses`);
  });
}

// The source-text wiring: the turn banner passes the timeline hold, and the timeline waits it.
const fx = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
assert.match(fx, /export function banner\(layer, text, cls = '', lifeMs = null\)/, 'banner takes its display time as lifeMs');
assert.match(fx, /setTimeout\(\(\) => el\.remove\(\), lifeMs > 0 \? lifeMs : 320\)/, 'banner is removed after lifeMs');
assert.match(fx, /banner\(ctx\.layer, beat\.banner, 'turn', hold\)/, 'the turn banner passes the timeline hold');
assert.match(fx, /schedule\(nextBeat, hold\)/, 'the timeline waits that same hold after a turn banner');

const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
assert.match(css, /\.fx-banner \{[^}]*animation: banner-pop var\(--fx-banner-ms, 300ms\)/s, 'the banner fade follows --fx-banner-ms');
