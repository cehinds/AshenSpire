// Band edges are half-open: no width falls between two bands. A condition goes
// to a band only when its whole range lies inside it (see bands.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bandOf } from './bands.mjs';

const cases = [
  ['(min-width:600.5px) and (max-width:900px)', 'tablet'],
  ['(min-width:601px) and (max-width:1023px)', 'tablet'],
  // Covers 600px, a phone width, so it straddles mobile and tablet: other.
  ['(min-width:600px) and (max-width:1023px)', 'other'],
  ['(min-width:1023.5px) and (max-width:1200px)', 'desktop'],
  ['(min-width:1439.5px)', 'wide'],
  ['(max-width:600px)', 'mobile'],
];

for (const [condition, band] of cases) {
  test(`${condition} is ${band}`, () => {
    assert.equal(bandOf(condition), band);
  });
}
