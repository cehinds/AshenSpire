import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner (2026-10-12), desktop only: Combat log in the bottom-left corner, the
// reaction switch in the bottom-right, level with the card bottoms; the hand
// reserves no tool row above the cards there.
const tools = readFileSync(new URL('../src/ui/components/combatTools.js', import.meta.url), 'utf8');
const hand = readFileSync(new URL('../src/ui/components/hand.js', import.meta.url), 'utf8');

test('desktop combat tools sit in the screen corners, level with the card bottoms', () => {
  assert.match(tools, /const corners = globalThis\.document\?\.documentElement\?\.dataset\.formFactor === 'desktop' && handBox;/);
  assert.match(tools, /corners \? handBox\.bottom - root\.getBoundingClientRect\(\)\.height/);
  assert.match(tools, /root\.style\.left = `\$\{CORNER_INSET\}px`;\s*root\.style\.right = `\$\{CORNER_INSET\}px`;/);
});

test('the desktop hand reserves no tool row while the tools are in the corners', () => {
  assert.match(hand, /cornerTools \? 0 :/);
});
