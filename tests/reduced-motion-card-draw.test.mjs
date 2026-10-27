import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner approval 2026-10-27: under reduced motion the HUD must hold still while
// cards are drawn. Measured in a browser (setting and OS preference, Alternative
// and Classic, a full turn and the opening draw): no HUD element animates or is
// tweened during a draw under reduced motion; the only drawn-card feedback is the
// `card-drawn` arrival and the `pile-received` glow, and both are switched off by
// all three guards below. This pins the guards so a new draw cue cannot ship
// without them.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('styles/combat.css');
const base = read('styles/base.css');
const hand = read('src/ui/components/hand.js');
const combat = read('src/ui/screens/combat.js');

test('the card-draw arrival and pile glow are off for the setting and for the OS preference', () => {
  assert.match(css, /\.reduced-motion \.hand \.card\.card-drawn,\s*\.reduced-motion \.combat \.pile\.spent\.pile-received \{ animation: none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.hand \.card\.card-drawn, \.combat \.pile\.spent\.pile-received \{ animation: none; \}/);
});

test('the script side never starts the draw arrival or the pile glow under reduced motion', () => {
  assert.match(hand, /drawn\.has\(entry\.inst\.instanceId\) && !reducedMotionRequested\(\)/);
  assert.match(combat, /if \(animate && !reducedMotionRequested\(\)\) \{[\s\S]{0,500}pile-received/);
});

test('every transition and animation is switched off, not shortened, under reduced motion', () => {
  assert.match(base, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{[^}]*transition: none !important;/);
  assert.match(base, /\.reduced-motion, \.reduced-motion \*, \.reduced-motion \*::before, \.reduced-motion \*::after \{[^}]*transition: none !important;/);
});
