import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner report 2026-10-27: "the map changes after all enemies are dead and the
// lingering health bar at the end of combat". Measured in a real browser: when
// the last enemy fell, combat.js called targetHud.release(), which deleted
// `data-target-hud` from the .combat root. That flipped the whole battlefield
// back to the legacy HUD for the ~0.8 s until the spoils veil mounted: the field
// re-fitted and every combat-health-row jumped to a strip at the top. The screen
// is about to be torn down anyway, so the fight-over release keeps the mode.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const hudSource = read('src/ui/components/combatTargetHud.js');
const combat = read('src/ui/screens/combat.js');
const css = read('styles/combat-target-responsive.css');

test('combat.js restores the target-HUD layout mode right after releasing the HUD at fight end', () => {
  const at = combat.indexOf('fightOver = true;');
  const over = combat.slice(at, at + 1200);
  const hud = over.indexOf('const hudMode = combatEl.dataset.targetHud;');
  const rel = over.indexOf('targetHud.release();');
  const back = over.indexOf('if (hudMode != null) combatEl.dataset.targetHud = hudMode;');
  assert.ok(hud > 0 && rel > hud && back > rel, 'read the mode, release, then put the mode back');
});

test('the target HUD still drops its own layout mode on a full release (screen unmount)', () => {
  assert.match(hudSource, /release\(\) \{[\s\S]{0,900}delete combat\.dataset\.targetHud;/);
  assert.ok(combat.indexOf('targetHud.release();\n        battlefieldStage.release();') > 0, 'the unmount still releases the target HUD');
});

test('a fallen combatant takes its overhead HP bar with it under the target HUD', () => {
  const rule = css.match(/\.combat\[data-target-hud='true'\] \.combatant\.dead > \.target-hud-overhead-meters \{[^}]*\}/);
  assert.ok(rule, 'a rule hides the dead combatant\'s overhead rack');
  assert.match(rule[0], /visibility:hidden/);
  assert.match(rule[0], /opacity:0/);
});
