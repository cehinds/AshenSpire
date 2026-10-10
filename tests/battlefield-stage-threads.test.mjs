import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stage = readFileSync(new URL('../src/ui/components/battlefieldStage.js', import.meta.url), 'utf8');
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
  assert.match(stage, /function trackPlayerHud\(\) \{\n\s*\/\/[^\n]*\n\s*placePlayerHud\(false, settledTargetCores\);/);
  assert.doesNotMatch(stage, /function trackPlayerHud\(\) \{\n\s*placePlayerHud\(\);/);
});

test('combat-layer QA probe validates the sprite pseudo-element shadows, not the removed layer', () => {
  assert.doesNotMatch(qa, /combat-ground-shadow/);
  assert.match(qa, /document\.querySelectorAll\('\.combatant \.sprite'\)\.length >= 1/);
  assert.match(qa, /getComputedStyle\(el, '::before'\)/);
});

test('dead combat-ground-shadow rules are removed from combat-layers.css', () => {
  assert.doesNotMatch(css, /combat-ground-shadow/);
});
