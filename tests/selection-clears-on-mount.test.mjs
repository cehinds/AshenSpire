// A SPENT BEAT BELONGS TO THE SCREEN THAT SPENT IT.
//
// src/ui/components/cardSelection.js is a PAGE-WIDE store: one lit card, and
// how many of its two beats are spent. That is deliberate and unchanged — every
// screen was built against a selection that unlights whatever was lit before.
//
// What was NOT deliberate is that nothing ever emptied it. `clearSelection` and
// `resetSelection` existed from the day the store was written (#1002) and were
// called by exactly one thing: this suite. So a card whose `i` had been read
// kept its first beat FOR THE LIFE OF THE PAGE, and meeting the same logical id
// on a later surface handed that surface a card already one beat in — its first
// touch reaching the buy, burn or choose handler instead of selecting.
//
// That is the same defect #980 and #987 were each corrected for, arriving by a
// third route: not a beat spent too early, but a beat that outlived its screen.
// Found by a review bot reading the promotion diff, not by any check here.
//
// THE RULE THIS FILE HOLDS: every screen that draws cards empties the store when
// it mounts. Not when it tears down — a screen cannot be relied on to be torn
// down, and the arriving screen is the one that must not inherit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strip = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

let checks = 0;
const ok = (cond, what) => { checks++; assert.ok(cond, what); };

// The screens that put a card on the glass. A screen added to this list without
// the call fails here; a screen that stops drawing cards should leave the list.
const SCREENS = ['combat', 'coop', 'customize', 'draft', 'equipment', 'reward', 'shop'];

for (const screen of SCREENS) {
  const source = strip(read(`src/ui/screens/${screen}.js`));
  ok(/from '\.\.\/components\/cardSelection\.js'/.test(source),
    `${screen}.js imports the selection store`);
  ok(/clearSelection\(\)/.test(source), `${screen}.js clears the selection`);
  // It has to be the FIRST thing the mount does, not a line buried in a branch
  // that a particular run may not reach.
  const mount = source.match(/export function mount\w+[^\n]*\n([\s\S]{0,400})/);
  ok(!!mount, `${screen}.js has a mount whose opening lines can be read`);
  ok(/clearSelection\(\);/.test(mount[1]),
    `${screen}.js clears the selection in the opening lines of its mount, not deeper in`);
}

// And the store still offers the door these call. A rename that left the
// screens calling a function that no longer exists would be caught by linkcheck,
// but the EXPORT being deleted as "unused" is the failure this line names.
const store = strip(read('src/ui/components/cardSelection.js'));
ok(/export function clearSelection\(\)/.test(store), 'the store still exports clearSelection');
ok(/export function beatsSpent\(/.test(store), 'the store still answers how many beats are spent');

// The store stays headless. It is the reason this fix lives in the screens
// rather than in the store asking whether a card is still in the document.
for (const forbidden of ['document', 'window', 'querySelector', 'isConnected']) {
  ok(!new RegExp(`\\b${forbidden}\\b`).test(store),
    `the selection store names no ${forbidden}`);
}

console.log(`PASS ${checks}/${checks}; every card screen empties the selection store when it mounts`);
