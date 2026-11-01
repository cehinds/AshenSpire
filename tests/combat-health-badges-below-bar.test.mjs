import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Owner 2026-11-01: the defense/status badges jumped ABOVE the HP bar when a wrapped-row rule gave the badges order:0 and the
// meter order:1. The badge row sits below the bar (the bar owns a full-width line, the row grows downward); no rule scoped to a
// row holding Counter/Reflect/stance badges may reorder the meter or the badges.
test('no rule reorders the HP meter or badges in a row that holds stack badges', () => {
  const css = readdirSync(new URL('../styles/', import.meta.url)).filter(f => f.endsWith('.css'))
    .map(f => readFileSync(new URL(`../styles/${f}`, import.meta.url), 'utf8')).join('\n');
  const rules = css.match(/[^{}]+\{[^{}]*\}/g) || [];
  const bad = rules.filter(r => /:has\([^)]*combat-health-(counter|reflect|stance)/.test(r)
    && /combat-health-(meter|badge)\b/.test(r.split('{')[0]) && /(^|[;\s])order\s*:\s*(?!-)/.test(r.split('{')[1]));
  assert.deepEqual(bad.map(r => r.split('{')[0].trim()), []);
});
