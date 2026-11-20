import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { arrangeMerchantOffer } from '../src/ui/components/merchantOffer.js';
import { BindMerchantItemArtFit, ItemArtBounds } from '../src/ui/components/merchantItemArtFit.js';

function pixels(width, height, rect = null) {
  const data = new Uint8ClampedArray(width * height * 4);
  if (rect) for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) data[(y * width + x) * 4 + 3] = 255;
  return { data, width, height };
}

test('item alpha bounds ignore transparent canvas and faint fringe while preserving a centered margin', () => {
  const sample = pixels(100, 80, { x: 35, y: 20, width: 20, height: 40 });
  sample.data[3] = 8; // Almost invisible export fringe must not stretch the crop.
  assert.deepEqual(ItemArtBounds(sample, 1000, 800), { x: 342, y: 184, width: 216, height: 432 });
  assert.equal(ItemArtBounds(pixels(10, 10)), null, 'transparent art keeps the normal fallback');
});

function canvasFixture(document, { fail = false } = {}) {
  const create = document.createElement.bind(document);
  let reads = 0, largestSample = 0;
  document.createElement = tag => {
    const node = create(tag);
    if (tag === 'canvas') node.getContext = () => ({
      drawImage() {},
      getImageData(x, y, width, height) {
        reads++; largestSample = Math.max(largestSample, width, height);
        if (fail) throw new Error('tainted canvas');
        return pixels(width, height, { x: Math.floor(width / 4), y: Math.floor(height / 4), width: Math.max(1, Math.floor(width / 2)), height: Math.max(1, Math.floor(height / 2)) });
      },
    });
    return node;
  };
  return { reads: () => reads, largestSample: () => largestSample };
}

function itemImage(document, url, width = 1024, height = 512) {
  const well = document.createElement('span'); well.className = 'epc-art';
  const image = document.createElement('img'); image.setAttribute('src', url);
  image.naturalWidth = width; image.naturalHeight = height; image.complete = true;
  well.append(image); document.body.append(well);
  return { image, well };
}

test('loaded item art fits its visible pixels with one bounded alpha read per URL', () => withKitDom(({ document }) => {
  const canvas = canvasFixture(document);
  const first = itemImage(document, 'fit-cache-test.png');
  const second = itemImage(document, 'fit-cache-test.png');
  BindMerchantItemArtFit(first.image); BindMerchantItemArtFit(second.image);
  assert.equal(canvas.reads(), 1);
  assert.equal(canvas.largestSample(), 512);
  assert.equal(first.image.hidden, true);
  const svg = first.well.querySelector('.merchant-item-art-fit');
  assert.equal(svg.getAttribute('preserveAspectRatio'), 'xMidYMid meet');
  assert.equal(svg.getAttribute('viewBox'), '235.52 117.76 552.96 276.48');
  assert.equal(svg.querySelector('image').getAttribute('href'), 'fit-cache-test.png');
  assert.equal(svg.querySelector('image').getAttribute('width'), '1024', 'source raster stays intact');
  assert.ok(second.well.querySelector('.merchant-item-art-fit'));
}));

test('tainted-canvas failure retains the item image and stale loads cannot insert a fitted image', () => withKitDom(({ document, Event }) => {
  const canvas = canvasFixture(document, { fail: true });
  const failed = itemImage(document, 'fit-tainted-test.png');
  BindMerchantItemArtFit(failed.image);
  assert.equal(failed.image.hidden, false);
  assert.equal(failed.well.querySelector('svg'), null);
  let current = true;
  const stale = itemImage(document, 'fit-stale-test.png'); stale.image.complete = false;
  BindMerchantItemArtFit(stale.image, { isCurrent: () => current });
  current = false;
  stale.image.dispatchEvent(new Event('load'));
  assert.equal(stale.well.querySelector('svg'), null);
  assert.equal(canvas.reads(), 1, 'stale nodes never read or draw');
}));

test('fitted SVG errors restore the original image and invoke its established fallback', () => withKitDom(({ document, Event }) => {
  canvasFixture(document);
  const { image, well } = itemImage(document, 'fit-error-test.png');
  let failures = 0;
  image.addEventListener('error', () => { failures++; });
  BindMerchantItemArtFit(image);
  well.querySelector('svg image').dispatchEvent(new Event('error'));
  assert.equal(failures, 1);
  assert.equal(image.hidden, false);
  assert.equal(well.querySelector('svg'), null);
}));

test('merchant clones the artwork well and its layers, forwarding missing cutouts to the renderer fallback', () => withKitDom(({ document, Event }) => {
  const visual = document.createElement('article');
  visual.innerHTML = '<img src="decorative-frame.png"><span class="ic-image"><img class="playing-card-art" src="background.png"><span data-card-art-layers><img data-card-art-component="sword" src="sword.png"></span></span>';
  const background = visual.querySelector('.playing-card-art');
  const component = visual.querySelector('[data-card-art-component]');
  component.addEventListener('error', () => {
    visual.querySelector('[data-card-art-layers]').remove();
    background.setAttribute('src', 'complete-fallback.png');
  });
  const tile = document.createElement('div');
  document.body.append(tile);
  arrangeMerchantOffer({ tile, visual, name: 'Test sword', desc: '', price: '', avail: { available: true },
    action: { kind: 'buy', label: 'Buy', enabled: true } });
  assert.equal(tile.querySelector('.merchant-thumbnail img')?.getAttribute('src'), 'background.png');
  assert.equal(tile.querySelectorAll('[data-card-art-component]').length, 1);
  tile.querySelector('[data-card-art-component]').dispatchEvent(new Event('error'));
  assert.equal(tile.querySelector('.playing-card-art')?.getAttribute('src'), 'complete-fallback.png');
  assert.equal(tile.querySelector('[data-card-art-layers]'), null);
}));

test('late errors from a replaced thumbnail cannot consume the next live artwork fallback', () => withKitDom(({ document, Event }) => {
  const visual = document.createElement('article');
  visual.innerHTML = '<span class="ic-image"><img class="playing-card-art" src="initial-background.png"><span data-card-art-layers><img data-card-art-component="sword" src="missing-cutout.png"></span></span>';
  const background = visual.querySelector('.playing-card-art');
  const fallbacks = ['first-fallback.png', 'second-fallback.png'];
  background.addEventListener('error', () => {
    visual.querySelector('[data-card-art-layers]')?.remove();
    background.setAttribute('src', fallbacks.shift());
  });
  visual.querySelector('[data-card-art-component]').addEventListener('error', () => background.dispatchEvent(new Event('error')));
  const tile = document.createElement('div'); document.body.append(tile);
  arrangeMerchantOffer({ tile, visual, name: 'Sword', desc: '', price: '', avail: { available: true },
    action: { kind: 'buy', label: 'Buy', enabled: true } });
  const staleBackground = tile.querySelector('.playing-card-art');
  const staleComponent = tile.querySelector('[data-card-art-component]');
  staleComponent.dispatchEvent(new Event('error'));
  const currentBackground = tile.querySelector('.playing-card-art');
  assert.notEqual(currentBackground, staleBackground, 'the fallback paints a fresh thumbnail');
  assert.equal(currentBackground.getAttribute('src'), 'first-fallback.png');
  staleBackground.dispatchEvent(new Event('error'));
  assert.equal(tile.querySelector('.playing-card-art'), currentBackground, 'a detached request cannot replace current art');
  assert.equal(background.getAttribute('src'), 'first-fallback.png');
  assert.deepEqual(fallbacks, ['second-fallback.png'], 'the next fallback remains available');
  currentBackground.dispatchEvent(new Event('error'));
  assert.equal(tile.querySelector('.playing-card-art').getAttribute('src'), 'second-fallback.png', 'the live request may still advance');
}));
