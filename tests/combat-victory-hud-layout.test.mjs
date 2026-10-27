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
const hud = read('src/ui/components/combatTargetHud.js');
const combat = read('src/ui/screens/combat.js');
const css = read('styles/combat-target-responsive.css');

test('releasing the target HUD at fight end keeps the layout mode the battlefield is drawn in', () => {
  const release = hud.slice(hud.indexOf('    release('), hud.indexOf('    release(') + 1500);
  assert.match(release, /release\(\{ keepLayout = false \} = \{\}\)/);
  assert.match(release, /if \(!keepLayout\) delete combat\.dataset\.targetHud;/);
  assert.doesNotMatch(release.replace(/if \(!keepLayout\) delete combat\.dataset\.targetHud;/, ''), /delete combat\.dataset\.targetHud/,
    'no unconditional delete of data-target-hud may remain in release()');
});

test('combat.js releases with keepLayout when the fight is over and fully when the screen unmounts', () => {
  const over = combat.slice(combat.indexOf('fightOver = true;'), combat.indexOf('fightOver = true;') + 120);
  assert.match(over, /targetHud\.release\(\{ keepLayout: true \}\);/);
  const unmount = combat.indexOf('targetHud.release();\n        battlefieldStage.release();');
  assert.ok(unmount > 0, 'the unmount still releases the target HUD completely');
});

test('a fallen combatant takes its overhead HP bar with it under the target HUD', () => {
  const rule = css.match(/\.combat\[data-target-hud='true'\] \.combatant\.dead > \.target-hud-overhead-meters \{[^}]*\}/);
  assert.ok(rule, 'a rule hides the dead combatant\'s overhead rack');
  assert.match(rule[0], /visibility:hidden/);
  assert.match(rule[0], /opacity:0/);
});
