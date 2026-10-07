// tests/motion-probe-boundary.test.mjs — tools/motion-probe.mjs states what its
// script-motion observer cannot see, and the statement matches the observer.
//
// #1475 review (Codex): a timer or rAF loop that moves an element by toggling
// classes makes no Animation object and writes no inline style or src, so the
// REDUCED-SCRIPT observer never hears it. No combat code moves that way, and
// watching `class` would read every ordinary state toggle as motion, so the
// limit is recorded as a BOUNDARY rather than widened. This test fails if the
// observer starts watching `class` while the BOUNDARY still says it does not,
// or if the BOUNDARY line is dropped while the observer still ignores it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../tools/motion-probe.mjs', import.meta.url), 'utf8');

test('the script-motion observer watches style and src only', () => {
  const filter = /attributeFilter:\s*\[([^\]]*)\]/.exec(SOURCE);
  assert.ok(filter, 'the MutationObserver attributeFilter is gone');
  const watched = [...filter[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(watched, ['src', 'style'], `the observer now watches ${watched.join(', ')}; update the BOUNDARY and this test together`);
});

test('the BOUNDARY names class-toggled motion as unseen', () => {
  const header = SOURCE.slice(0, SOURCE.indexOf('\nimport '));
  assert.match(header, /BOUNDARY:[\s\S]*toggling CLASSES[\s\S]*\/\/ not seen\./,
    'the header no longer says class-toggled script motion is outside the probe');
});
