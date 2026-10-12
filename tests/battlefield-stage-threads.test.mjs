import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
const coop = readFileSync(new URL('../src/ui/screens/coop.js', import.meta.url), 'utf8');
const qa = readFileSync(new URL('../tools/combat-layer-qa.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/combat-layers.css', import.meta.url), 'utf8');

test('stage selects the Classic or alternative composition per fit, not at import', () => {
  assert.doesNotMatch(stage, /alternativeCombatComposition as combatComposition/);
  assert.match(stage, /combatComposition as classicCombatComposition/);
  assert.match(stage, /const combatComposition = classicAppearance\(\) \? classicCombatComposition : alternativeCombatComposition;/);
  // The choice sits inside fitFormation, so an appearance change takes effect on refit.
  const fit = stage.indexOf('const fitFormation = () =>');
  const select = stage.indexOf('const combatComposition = classicAppearance()');
  assert.ok(fit > 0 && select > fit, 'composition choice must be made inside fitFormation');
});

test('tracking pass reserves the same settled target cores as the main placement', () => {
  assert.match(stage, /let settledTargets = \[\], settledFooterSize = 44, settledTargetCores = \[\];/);
  assert.match(stage, /const targetCores = boxes\.flatMap\(/);
  assert.match(stage, /targetCores,\n\s*\}\);/);
  assert.match(stage, /settledTargetCores = targetCores;/);
  assert.match(stage, /function trackPlayerHud\(\) \{[\s\S]*?placePlayerHud\(false, settledTargetCores, true\);/);
  assert.doesNotMatch(stage, /function trackPlayerHud\(\) \{\n\s*placePlayerHud\(\);/);
});

test('reduced motion never starts or continues the frame-by-frame HUD tracker', () => {
  assert.match(stage, /function trackPlayerHud\(\) \{[\s\S]*?if \(reducedMotionRequested\(\)\) \{ trackingRequest = 0; return; \}/);
  assert.match(stage, /const poseObserver = new MutationObserver\(\(\) => \{\n\s*if \(!reducedMotionRequested\(\) && !trackingRequest\) trackingRequest = requestAnimationFrame\(trackPlayerHud\);/);
  assert.match(stage, /reducedMedia\?\.addEventListener\('change', reconcileReducedMotion\);/);
  assert.match(stage, /reducedSettingObserver\.observe\(document\.body, \{ attributes: true, attributeFilter: \['class'\] \}\);/);
  assert.match(stage, /cancelAnimationFrame\(trackingRequest\);\n\s*trackingRequest = 0;\n\s*schedule\(\);\n\s*if \(!next\) trackingRequest = requestAnimationFrame\(trackPlayerHud\);/);
  assert.match(stage, /reducedMedia\?\.removeEventListener\('change', reconcileReducedMotion\);/);
  assert.match(stage, /reducedSettingObserver\.disconnect\(\);/);
});

test('combat-layer QA probe validates the sprite pseudo-element shadows, not the removed layer', () => {
  assert.doesNotMatch(qa, /combat-ground-shadow/);
  assert.match(qa, /document\.querySelectorAll\('\.combatant \.sprite'\)\.length >= 1/);
  assert.match(qa, /getComputedStyle\(el, '::before'\)/);
});

test('dead combat-ground-shadow rules are removed from combat-layers.css', () => {
  assert.doesNotMatch(css, /combat-ground-shadow/);
});

test('enemy Inspect expands to a complete 44px target while stopping at the intent', () => {
  assert.match(css, /\.enemy \.combatant-leading > \.combatant-info::before\s*\{[\s\S]*?inset:\s*calc\(-18px \/ var\(--ui-zoom,1\)\) calc\(-11px \/ var\(--ui-zoom,1\)\) calc\(-4px \/ var\(--ui-zoom,1\)\);/);
});

test('co-op grid cells and intents share the selected-card target action', () => {
  assert.match(coop, /const activateEnemyTarget = enemyId => \{[\s\S]*?t: 'playCard'[\s\S]*?targetId: enemyId/);
  assert.match(coop, /intentEl\(readEnemyIntent\(e, def\), \(\) => activateEnemyTarget\(e\.id\)\)/);
  assert.match(coop, /box\.addEventListener\('click', \(\) => \{[\s\S]*?if \(!activateEnemyTarget\(e\.id\)\) render\(\);/);
});

test('co-op enemy frames mark a readied hostile card\'s hover target, as solo does', () => {
  assert.match(coop, /box\.addEventListener\('pointerenter', \(\) => \{[\s\S]*?cardNeedsEnemyTarget\(cardDef\(selected\)\)\) box\.classList\.add\('hover-target'\);/);
  assert.match(coop, /box\.addEventListener\('pointerleave', \(\) => box\.classList\.remove\('hover-target'\)\);/);
});

test('a front-rank enemy readout hangs below its feet, never beside it', () => {
  assert.match(stage, /const hudBelow = actor => !classicAppearance\(\) && actor\.side === 'enemy' && actor\.slot\.rank === 1;/);
  assert.match(stage, /if \(hudBelow\(actor\)\) \{[\s\S]*?const overheadX = anchor\?\.x \?\? x;[\s\S]*?leadingHost\.style\.left = `\$\{overheadLocal\.left\}px`;[\s\S]*?ground \+ overheadGap - above \+ \(anchor\?\.offsetY \?\? 0\)/);
});
