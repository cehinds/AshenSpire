// Effects off keeps the action travel and drops the brightness / drop-shadow flash on sprite hosts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
const keyframes = name => (css.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}|@keyframes ${name} \\{([^\\n]*)\\}`)) || []).slice(1).join('');

test('every action keyframe applied to a sprite host under Effects off animates no filter', () => {
  const applied = new Map();
  for (const m of css.matchAll(/(:root\[data-effects='off'\] [^{@]*?\.sprite[^{]*\.act-(?:attack|move)[^{]*)\{\s*animation-name:\s*([\w-]+)/g)) applied.set(m[1].trim(), m[2]);
  assert.ok(applied.size >= 7, 'attack and move, generic and per family, are all overridden');
  const named = new Set([...applied.values()].filter(n => n !== 'none'));
  assert.ok(named.size >= 5);
  for (const name of named) {
    const body = keyframes(name);
    assert.ok(body, `${name} exists`);
    assert.doesNotMatch(body, /filter|brightness|drop-shadow/, `${name} must not flash`);
    assert.match(body, /translate:/, `${name} keeps its travel`);
  }
  // every filter-animating action family has an override (a name or none) for both attack and move hosts
  for (const family of ['sweep', 'lunge', 'impact', 'release']) assert.ok([...applied.keys()].some(k => k.includes(`"${family}"`)), family);
  for (const motion of ['cast', 'brace']) assert.equal(applied.get([...applied.keys()].find(k => k.includes(`"${motion}"`))), 'none', `${motion} has only a flash, so it plays nothing`);
  assert.ok(![...applied.keys()].some(k => k.includes('"sidestep"')) && ![...applied.keys()].some(k => /act-move\[data-action-motion\]$/.test(k)), 'the sidestep is not silenced');
  assert.match(keyframes('family-dodge'), /opacity/);
  assert.doesNotMatch(keyframes('family-dodge'), /filter/);
  assert.match(css, /\.sprite\.act-move\[data-action-motion="sidestep"\] \{ animation-name: family-dodge; \}/, 'the dodge opacity dip is still named under Effects off');
});

test('Attack lunge off still removes the travel under Effects off', () => {
  assert.match(css, /:root\[data-effects='off'\] body\.motion-attack-off \.sprite\[data-action-motion\]\.act-attack/);
  assert.ok(css.lastIndexOf("body.motion-attack-off .sprite.act-attack") > css.lastIndexOf('family-strike-nofx { 0%'), 'it comes after the overrides');
});

test('Reduced motion still beats the Effects-off overrides with a full animation: none shorthand', () => {
  assert.match(css, /\.reduced-motion \.sprite\.act-attack,\s*\.reduced-motion \.sprite\.act-move \{ animation: none; \}/);
  const at = css.lastIndexOf(":root[data-effects='off'] .reduced-motion .sprite.act-attack,");
  assert.ok(at > css.lastIndexOf('family-strike-nofx { 0%') && at > css.lastIndexOf(".sprite.act-attack[data-action-motion=\"impact\"] { animation-name: family-strike-nofx"), 'repeated after the overrides');
  assert.match(css.slice(at, at + 400), /animation: none;/);
});
