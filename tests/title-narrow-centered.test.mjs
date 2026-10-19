// The phone title menu is centred in the space under the wordmark band, not
// pushed to the foot of the screen (owner, 2026-10-18: "main menu buttons are at
// the bottom now"; COMPONENT-CATALOG title-menu: centered).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/player-polish.css', import.meta.url), 'utf8');

test('every narrow .title-screen rule centres the menu, none uses flex-end', () => {
  const rules = [...css.matchAll(/:root\[data-layout='narrow'\] \.title-screen \{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(rules.length >= 1, 'a narrow title-screen rule must exist');
  for (const body of rules) assert.doesNotMatch(body, /justify-content\s*:\s*flex-end/);
  assert.ok(rules.some((b) => /justify-content\s*:\s*center/.test(b)));
});
