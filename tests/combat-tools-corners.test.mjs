import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner (2026-10-12), desktop only: Combat log in the bottom-left corner, the
// reaction switch in the bottom-right, level with the card bottoms; the hand
// reserves no tool row above the cards there.
const tools = readFileSync(new URL('../src/ui/components/combatTools.js', import.meta.url), 'utf8');
const hand = readFileSync(new URL('../src/ui/components/hand.js', import.meta.url), 'utf8');

test('combat tools use screen-edge corners and independently measured footer geometry on every form factor', () => {
  assert.match(tools, /const split = combatEl.dataset.desktopFooter === 'true';/);
  assert.match(tools, /getPropertyValue\('--desktop-tools-top'\)/);
  assert.match(tools, /footerControls\?\.getBoundingClientRect\(\)\.top \?\? dockTop/);
  assert.match(tools, /root.dataset.toolsPlacement = 'corners';/);
});

test('the fan does not reserve a second tools band above its cards', () => {
  assert.match(hand, /const toolsHeight = 0;/);
  assert.match(hand, /height: handEl.clientHeight - toolsHeight/);
});
