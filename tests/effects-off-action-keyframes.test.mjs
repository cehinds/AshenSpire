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
  assert.ok([...applied.keys()].some(k => /act-move\[data-action-motion\]/.test(k)), 'cast / brace move hosts');
});

test('Attack lunge off still removes the travel under Effects off', () => {
  assert.match(css, /:root\[data-effects='off'\] body\.motion-attack-off \.sprite\[data-action-motion\]\.act-attack/);
  assert.ok(css.lastIndexOf("body.motion-attack-off .sprite.act-attack") > css.lastIndexOf('family-strike-nofx { 0%'), 'it comes after the overrides');
});
