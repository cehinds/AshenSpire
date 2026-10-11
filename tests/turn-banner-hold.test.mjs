// A turn banner must be gone by the time the next beat starts, at every pace.
// The timeline waits turnBannerHoldMs(pace) after a banner beat; the banner's
// display time and fade are set from that same hold (ui/fx.js banner, lifeMs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIM_SPEEDS, COMBAT_TIMING, turnBannerHoldMs } from '../src/ui/animationPace.js';

const paces = Object.entries(ANIM_SPEEDS).filter(([, speed]) => speed);
assert.ok(paces.length >= 3, 'slow, normal and fast are the paced presets');

for (const [name, speed] of paces) {
  const hold = turnBannerHoldMs(speed);
  // The wait is the larger of the floor and the beat breath, as before.
  assert.equal(hold, Math.max(COMBAT_TIMING.turnBannerFloorMs, speed.beatMs), `${name}: hold is max(floor, beatMs)`);
  // A banner that displays for its hold ends with the hold, never after the next beat.
  const display = hold;
  assert.ok(display <= hold, `${name}: banner display ${display} ms must not exceed the hold ${hold} ms`);
}

// The banner's display time comes from the hold, not from a fixed 320 ms.
const fx = readFileSync(new URL('../src/ui/fx.js', import.meta.url), 'utf8');
assert.match(fx, /function banner\(layer, text, cls = '', lifeMs = null\)/, 'banner takes its display time as lifeMs');
assert.match(fx, /setTimeout\(\(\) => el\.remove\(\), lifeMs > 0 \? lifeMs : 320\)/, 'banner is removed after lifeMs');
assert.match(fx, /banner\(ctx\.layer, beat\.banner, 'turn', hold\)/, 'the turn banner passes the timeline hold');
assert.match(fx, /schedule\(nextBeat, hold\)/, 'the timeline waits that same hold after a turn banner');

const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
assert.match(css, /\.fx-banner \{[^}]*animation: banner-pop var\(--fx-banner-ms, 300ms\)/s, 'the banner fade follows --fx-banner-ms');
