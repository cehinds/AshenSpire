import test from 'node:test';
import assert from 'node:assert/strict';
import { imageBounds, warmImageBounds, warmImageBoundsWhenIdle } from '../src/ui/artBounds.js';

// A 4x4 image whose only opaque pixel is (2, 1).
function fakeDocument(reads) {
  return { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    drawImage() {},
    getImageData(_x, _y, w, h) { reads.n++; const data = new Uint8ClampedArray(w * h * 4); data[(1 * w + 2) * 4 + 3] = 255; return { data }; },
  }) }) };
}
const image = (src, complete = true) => ({ src, currentSrc: src, complete, naturalWidth: complete ? 4 : 0, naturalHeight: 4, addEventListener() {} });

test('an image is read once and its opaque box kept by source', () => {
  const reads = { n: 0 }; globalThis.document = fakeDocument(reads);
  try {
    assert.deepEqual(imageBounds(image('a.webp'), () => {}), { x0: 2, y0: 1, x1: 2, y1: 1 });
    imageBounds(image('a.webp'), () => {});
    assert.equal(reads.n, 1);
  } finally { delete globalThis.document; }
});

test('warming reads a loaded image early and leaves a loading one alone', () => {
  const reads = { n: 0 }; globalThis.document = fakeDocument(reads);
  try {
    warmImageBounds(image('b.webp', false)); assert.equal(reads.n, 0);
    warmImageBounds(image('b.webp')); assert.equal(reads.n, 1);
    imageBounds(image('b.webp'), () => {}); assert.equal(reads.n, 1, 'the later use finds the box already kept');
  } finally { delete globalThis.document; }
});

test('idle warming without requestIdleCallback reads nothing', () => {
  const reads = { n: 0 }; globalThis.document = fakeDocument(reads);
  try {
    assert.equal(typeof requestIdleCallback, 'undefined');
    warmImageBoundsWhenIdle(image('c.webp')); assert.equal(reads.n, 0);
  } finally { delete globalThis.document; }
});

test('idle warming reads one image per idle slot', () => {
  const reads = { n: 0 }; globalThis.document = fakeDocument(reads);
  const slots = []; globalThis.requestIdleCallback = fn => slots.push(fn) && slots.length;
  try {
    warmImageBoundsWhenIdle(image('d.webp')); warmImageBoundsWhenIdle(image('e.webp'));
    assert.equal(reads.n, 0); assert.equal(slots.length, 1);
    slots.shift()(); assert.equal(reads.n, 1); assert.equal(slots.length, 1);
    slots.shift()(); assert.equal(reads.n, 2); assert.equal(slots.length, 0);
  } finally { delete globalThis.document; delete globalThis.requestIdleCallback; }
});
