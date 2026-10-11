// ON-CHARACTER CALLOUTS (owner, 2026-10-11; ui/fx.js callout). A short word —
// STAGGERED, COUNTERED, EVADED, CRITICAL, GUARD BREAK — rises from above the
// fighter it happened to. Two on one fighter stack, at most two show at once,
// and a click-skip ends them.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { callout, clearCallouts, CALLOUT_KINDS } from '../src/ui/fx.js';
import { t } from '../src/ui/strings.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const callouts = (layer) => layer.children.filter((node) => node.dataset?.calloutFor !== undefined);

test('every callout kind has a localized word', () => {
  for (const [kind, def] of Object.entries(CALLOUT_KINDS)) {
    assert.match(t(def.string), /^[A-Z ]+$/, `${kind} is a short uppercase word`);
  }
  assert.equal(t(CALLOUT_KINDS.guardBreak.string), 'GUARD BREAK');
});

test('a callout names its fighter, stacks a second, keeps at most two, and skips a repeat', (t2) => {
  t2.mock.timers.enable({ apis: ['setTimeout'] });
  withKitDom((dom) => {
    const layer = dom.document.createElement('div');
    const anchor = dom.document.createElement('div');
    const first = callout(layer, anchor, 'e1', 'staggered');
    assert.equal(first.textContent, 'STAGGERED');
    assert.equal(first.dataset.calloutFor, 'e1');
    assert.equal(first.dataset.calloutSlot, '0');
    assert.match(first.className, /\bfx-callout\b.*\bgold\b/);
    assert.equal(callout(layer, anchor, 'e1', 'staggered'), null, 'the same word is not repeated on one fighter');
    const second = callout(layer, anchor, 'e1', 'critical');
    assert.equal(second.dataset.calloutSlot, '1', 'the second stacks above the first');
    assert.match(second.className, /\bred\b/);
    const other = callout(layer, anchor, 'player', 'evaded');
    assert.equal(other.dataset.calloutSlot, '0', 'another fighter has its own stack');
    callout(layer, anchor, 'e1', 'guardBreak');
    const e1 = callouts(layer).filter((node) => node.dataset.calloutFor === 'e1');
    assert.equal(e1.length, 2, 'at most two per fighter');
    assert.deepEqual(e1.map((node) => node.dataset.calloutKind).sort(), ['critical', 'guardBreak'], 'the oldest gives way');
    assert.deepEqual(e1.map((node) => node.dataset.calloutSlot).sort(), ['0', '1'], 'no two share a slot');
    t2.mock.timers.tick(900);
    assert.equal(callouts(layer).length, 0, 'each fades out after its life');
    callout(layer, anchor, 'e1', 'countered');
    clearCallouts(layer);
    assert.equal(callouts(layer).length, 0, 'a skip ends them');
  });
});

test('callout CSS: larger than a float, HUD text shadow, reduced motion and Reduce flashes', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  assert.match(css, /\.fx-callout \{[^}]*text-shadow: var\(--hud-text-shadow/s);
  assert.match(css, /\.reduced-motion \.fx-callout \{ animation: callout-fade/, 'reduced motion: in place, no rise');
  assert.match(css, /\.reduce-flashes \.fx-callout \{ animation: callout-rise var\(--fx-callout-ms, 900ms\) ease-out forwards; \}/, 'reduce flashes: no glow pulse');
});
