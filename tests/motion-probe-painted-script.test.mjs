import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../tools/motion-probe.mjs', import.meta.url), 'utf8');
const noteSource = source.slice(source.indexOf('  const note = (el, what) => {'), source.indexOf('  new MutationObserver'));
function sampler() {
  return runInNewContext(`let frames = 0; const changes = new Map();
    ${noteSource}
    ({ next: () => frames++, note, changes });`, { performance: { now: () => 1 } });
}

test('nonpainting layout churn never counts as reduced-motion animation', () => {
  const probe = sampler();
  for (const reason of ['display-none name', 'display-none ancestor', 'detached node']) {
    const element = { reason, getClientRects: () => [] };
    for (let i = 0; i < 6; i++) { probe.next(); probe.note(element, 'style'); }
    assert.equal(probe.changes.has(element), false, reason);
  }
});

test('visible, transparent, transformed and offscreen boxes retain script-motion detection', () => {
  const probe = sampler();
  for (const reason of ['visible style', 'transparent fade', 'zero-scale transform', 'offscreen travel', 'image src', 'canvas pixels']) {
    const element = { reason, getClientRects: () => [{ width: 0, height: 0 }] };
    for (let i = 0; i < 4; i++) { probe.next(); probe.note(element, reason); }
    assert.equal(probe.changes.get(element).frames.size, 4, reason);
  }
});

test('revealing a hidden element restores detection immediately without resetting the sampler', () => {
  const probe = sampler();
  let rendered = false;
  const element = { getClientRects: () => rendered ? [{}] : [] };
  for (let i = 0; i < 5; i++) { probe.next(); probe.note(element, 'style'); }
  rendered = true;
  for (let i = 0; i < 3; i++) { probe.next(); probe.note(element, 'style'); }
  assert.equal(probe.changes.get(element).frames.size, 3);
  probe.note(element, 'src');
  assert.equal(probe.changes.get(element).times.length, 3, 'same-frame writes still count only once');
});
