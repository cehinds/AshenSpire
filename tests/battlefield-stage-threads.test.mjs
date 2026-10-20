import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

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
  assert.match(stage, /const poseObserver = new MutationObserver\(mutations => \{[\s\S]*?if \(reducedMotionRequested\(\)\) \{[\s\S]*?centerTargetOverheads\(\);[\s\S]*?return;[\s\S]*?if \(!trackingRequest\) trackingRequest = requestAnimationFrame\(trackPlayerHud\);/);
  assert.match(stage, /reducedMedia\?\.addEventListener\('change', reconcileReducedMotion\);/);
  assert.match(stage, /reducedSettingObserver\.observe\(document\.body, \{ attributes: true, attributeFilter: \['class'\] \}\);/);
  assert.match(stage, /cancelAnimationFrame\(trackingRequest\);\n\s*trackingRequest = 0;\n\s*schedule\(\);\n\s*if \(!next\) trackingRequest = requestAnimationFrame\(trackPlayerHud\);/);
  assert.match(stage, /reducedMedia\?\.removeEventListener\('change', reconcileReducedMotion\);/);
  assert.match(stage, /reducedSettingObserver\.disconnect\(\);/);
});

test('HUD tracker stops after a bounded pose window instead of running every frame', () => {
  assert.match(stage, /const TRACK_WINDOW_MS = \d+;/);
  assert.match(stage, /function trackPlayerHud\(\) \{[\s\S]*?performance\.now\(\) < trackUntil[\s\S]*?\? requestAnimationFrame\(trackPlayerHud\) : 0;/);
  assert.match(stage, /extendTracking\(\);\s*if \(!trackingRequest\) trackingRequest = requestAnimationFrame\(trackPlayerHud\);/);
});

function poseProbe(reduced = false) {
  const calls = { tracked: 0, scheduled: 0, centered: 0 };
  const begin = stage.indexOf('  const poseObserver = new MutationObserver(');
  const end = stage.indexOf('  // Both accessibility inputs', begin);
  assert.ok(begin >= 0 && end > begin);
  const api = runInNewContext('let trackingRequest = 0;\n' + stage.slice(begin, end) + '\nposeObserver', {
    MutationObserver: class {
      constructor(callback) { this.deliver = callback; }
      observe(_field, options) { this.options = options; }
    },
    field: { closest: () => ({ dataset: { targetHud: 'true' } }) },
    reducedMotionRequested: () => reduced,
    centerTargetOverheads: () => calls.centered++,
    extendTracking: () => calls.tracked++, trackPlayerHud() {},
    requestAnimationFrame: () => { calls.scheduled++; return 1; },
  });
  return { calls, api };
}
const mutation = (attributeName, oldValue, current, body = true) => ({ attributeName, oldValue,
  target: { getAttribute: () => current, matches: () => body } });

for (const reduced of [false, true]) test(`pose tracking ignores no-op and nested HUD mutations (reduced=${reduced})`, () => {
  const probe = poseProbe(reduced);
  assert.equal(probe.api.options.attributeOldValue, true);
  probe.api.deliver([
    mutation('class', 'combatant player', 'combatant player'),
    mutation('src', 'idle.webp', 'idle.webp'),
    mutation('data-pose', 'guard', 'guard'),
    mutation('class', 'badge', 'badge active', false),
  ]);
  assert.deepEqual(probe.calls, { tracked: 0, scheduled: 0, centered: 0 });
  probe.api.deliver([mutation('data-pose', 'idle', 'guard', false)]);
  assert.deepEqual(probe.calls, reduced ? { tracked: 0, scheduled: 0, centered: 1 }
    : { tracked: 1, scheduled: 1, centered: 0 }, 'a real pose still updates its overheads');
});

test('batched A→B→A body mutations retain the genuine last change and one pending tracker', () => {
  const probe = poseProbe();
  probe.api.deliver([mutation('class', 'sprite', 'sprite'), mutation('class', 'sprite hit', 'sprite')]);
  probe.api.deliver([mutation('src', 'idle.webp', 'guard.webp')]);
  assert.deepEqual(probe.calls, { tracked: 2, scheduled: 1, centered: 0 });
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

test('responsive formation keeps every rank readout above its body', () => {
  assert.match(stage, /const hudBelow = \(\) => false;/);
});
