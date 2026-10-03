import test from 'node:test';
import assert from 'node:assert/strict';
import { selectionEffect, selectionGlowFilter, selectionRevealDelayMs } from '../src/ui/models/SelectionEffectModel.js';
import { wireframeUi } from '../src/content/wireframeUi.js';

test('one shared glow: the reference drop-shadow in the theme gold, sized in reference rems', () => {
  assert.equal(selectionGlowFilter(), 'drop-shadow(0 0 calc(0.35 * max(16px / var(--ui-zoom, 1), 1rem)) var(--gold))');
  assert.ok(Object.isFrozen(selectionEffect()));
});

test('the inspect control reveals after the accepted one-second delay', () => {
  assert.equal(selectionRevealDelayMs(), 1000);
  assert.equal(selectionRevealDelayMs({ ...wireframeUi.selection, revealDelayMs: 0 }), 0);
});

test('a glow or delay that cannot be drawn is refused', () => {
  const bad = (patch) => ({ ...wireframeUi.selection, ...patch });
  assert.throws(() => selectionGlowFilter(bad({ glowRem: 0 })), /glowRem/);
  assert.throws(() => selectionGlowFilter(bad({ glowRem: '1rem' })), /glowRem/);
  assert.throws(() => selectionRevealDelayMs(bad({ revealDelayMs: -1 })), /revealDelayMs/);
});
