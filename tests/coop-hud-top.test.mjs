// tests/coop-hud-top.test.mjs — the no-browser half of tools/coop-hud-top.mjs
// (#1368, D29 in docs/FINISH.md). The browser half runs in
// .github/workflows/coop-hud.yml on every pull request into dev.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { judge, selftest, VIEWPORTS } from '../tools/coop-hud-top.mjs';

test('the co-op HUD top judge catches its own known-bad corpus', () => {
  assert.equal(selftest(), 0);
});

test('the judge measures the three owner viewports, compact band one row', () => {
  assert.deepEqual(VIEWPORTS.map((v) => `${v.width}x${v.height}`), ['390x844', '844x390', '1280x800']);
  assert.deepEqual(VIEWPORTS.filter((v) => v.singleRow).map((v) => v.height <= 500), [true]);
  assert.match(judge({ mounted: false }, 'x')[0], /did not mount/);
});

test('the co-op formation HUD-top row is still there, with its reason beside it', () => {
  const css = readFileSync(new URL('../styles/combat.css', import.meta.url), 'utf8');
  const at = css.indexOf(":root .combat.coop[data-layout='formation'] .topbar .hud-top { display:flex;");
  assert.ok(at > 0, 'co-op compact-band row missing from styles/combat.css');
  assert.match(css.slice(Math.max(0, at - 900), at), /INTENDED[\s\S]*tools\/coop-hud-top\.mjs/);
});
