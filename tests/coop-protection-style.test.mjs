import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Coordinator review (2026-10-11): co-op's protection readout ("Ward 0/0 ·
// Barrier 0 · Attack", screens/coop.js) had no style at all and painted as
// large wrapping body text over both fighters.
const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');
const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');

test('co-op still writes the protection readout this style targets', () => {
  assert.match(coop, /className = 'combat-expansion-protection'/);
});

test('the protection readout is one compact HUD line, folded away at rest', () => {
  const rule = css.match(/:root \.combat \.combat-expansion-protection \{([^}]*)\}/);
  assert.ok(rule, 'a rule styles .combat-expansion-protection');
  for (const part of [/font: 600 calc\(10px \/ var\(--ui-zoom,1\)\)/, /white-space: nowrap/, /text-overflow: ellipsis/, /var\(--hud-details-label-color/])
    assert.match(rule[1], part);
  assert.match(css, /\.combatant:not\(\.context-selected\) \.combat-expansion-protection \{ display: none; \}/);
});
