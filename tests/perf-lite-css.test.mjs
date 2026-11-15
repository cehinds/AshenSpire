// tests/perf-lite-css.test.mjs — styles/perf-lite.css is the Lite rendering budget
// (no filters, blends or backdrop filters). It must be wired in last, so it beats
// the other sheets, and it must stay Lite-only so Full is untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { stripCssComments } from '../tools/css-strip.mjs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const hrefs = [...index.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi)].map((m) => m[1]);
const css = stripCssComments(readFileSync(new URL('../styles/perf-lite.css', import.meta.url), 'utf8'));

test('perf-lite.css exists and is the last stylesheet before the generated HUD sheet, which stays last', () => {
  assert.ok(existsSync(new URL('../styles/perf-lite.css', import.meta.url)));
  assert.deepEqual(hrefs.slice(-2), ['styles/perf-lite.css', 'styles/hud-layout.generated.css']);
  assert.equal(hrefs.filter((h) => h === 'styles/perf-lite.css').length, 1);
});

test('every rule in perf-lite.css is scoped to Lite AND to a phone layout (desktop Lite is unchanged)', () => {
  const rules = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
  assert.ok(rules.length > 10);
  for (const selectorList of rules) {
    for (const selector of selectorList.split(/,\s*(?![^()]*\))/)) {
      const sel = selector.trim();
      assert.match(sel, /^:root(:root)?\[data-performance='lite'\]/, `not Lite-scoped: ${sel}`);
      assert.ok(sel.includes(":is([data-layout='narrow'], [data-form-factor='mobile'])"), `not phone-scoped: ${sel}`);
    }
  }
});

test('perf-lite.css never adds a filter, backdrop filter or blend of its own', () => {
  for (const m of css.matchAll(/(^|[;{\s])(filter|backdrop-filter|mix-blend-mode)\s*:\s*([^;}]+)/g)) {
    const value = m[3].replace(/!important/, '').trim();
    assert.ok(value === 'none' || value === 'normal', `${m[2]}: ${value}`);
  }
});
