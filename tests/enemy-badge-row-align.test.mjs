// Playtest 2026-11-17: an enemy's status badges line up with its HP and Poise bars. The row used to grow leftwards past the
// Block shield where the bar is narrow (a phone), so its first icon sat well left of the bar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/combat-mini-hud.css', import.meta.url), 'utf8');
const enemyRow = css.match(/\.combatant:not\(\.player\) > \.target-hud-overhead-meters \.combat-health-row > \.combat-health-badges \{([^}]*)\}/)?.[1] ?? '';

test('the enemy badge row starts on the bar\'s left edge and grows rightwards', () => {
  assert.ok(enemyRow, 'the enemy badge row rule exists');
  assert.match(enemyRow, /margin-inline-start: 0 !important/);
  assert.match(enemyRow, /justify-content: flex-start/);
  assert.match(enemyRow, /width: calc\(var\(--mh-bar-w\) \+ var\(--mh-value-w\)\)/);
  assert.doesNotMatch(enemyRow, /calc\(var\(--mh-bar-w\) - /, 'no negative start pulls the row left of the bar');
});
