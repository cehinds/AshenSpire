import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { retryArtStateExpression } from '../tools/external-play-art-state.mjs';

const source = readFileSync(new URL('../tools/external-play.mjs', import.meta.url), 'utf8');
const listenerSource = source.slice(source.indexOf('cdp.on((m) => {'), source.indexOf('\nconst ev ='));

// Run the production CDP listener, including its request-ID URL bookkeeping.
// The launcher is optional for a file launch, but missing assets remain errors.
function failedRequest(url, fileMode = true) {
  const failures = [];
  let listener;
  runInNewContext(listenerSource, {
    cdp: { on(callback) { listener = callback; } }, failures, thrown: [], urls: new Map(), screenLog: [],
    rel: value => value, FILE_MODE: fileMode, removedIndex: () => false, sfxProbe404: () => false,
  });
  listener({ method: 'Network.requestWillBeSent', params: { requestId: 'request', loaderId: 'page', request: { url } } });
  listener({ method: 'Network.loadingFailed', params: { requestId: 'request', errorText: 'net::ERR_FAILED' } });
  return failures;
}

test('file launches exempt only optional local launcher LAN paths, including Windows drives', () => {
  for (const url of ['file:///api/lan/info', 'file:///D:/api/lan/info', 'file:///c:/api/lan/info?fresh=1']) {
    assert.deepEqual(failedRequest(url), [], url);
  }
});

test('the file launcher exemption preserves strict failures for remote hosts and other paths', () => {
  for (const url of [
    'file://server/api/lan/info', 'file:////server/api/lan/info',
    'file:///D:/objects/ab/missing.webp', 'file:///D:/assets-display/alternative/graveWisp.webp',
    'file:///D:/nested/api/lan/info', 'file:///D:/api/lantern/info',
    'file:///D:/api/other/info', 'file:///D:/API/LAN/info',
    'https://example.test/api/lan/info', 'http://localhost:8317/api/lan/info',
  ]) {
    assert.deepEqual(failedRequest(url), [`net::ERR_FAILED ${url}`], url);
  }
});

test('the local file-path exemption is active only for a file-launch probe', () => {
  assert.deepEqual(failedRequest('file:///D:/api/lan/info', false), ['net::ERR_FAILED file:///D:/api/lan/info']);
});

test('the blocked-index gate requires a visible, laid-out fallback', () => {
  const fallback = {
    hidden: false,
    style: { display: 'flex', visibility: 'visible', opacity: '1' },
    box: { width: 190, height: 190 },
    getBoundingClientRect() { return this.box; },
  };
  const failedImage = {
    complete: true,
    naturalWidth: 512,
    hidden: false,
    style: { display: 'block', visibility: 'hidden', opacity: '1' },
    box: { width: 190, height: 190 },
    getBoundingClientRect() { return this.box; },
    getAttribute() { return 'objects/failed.webp'; },
  };
  const sprite = {
    hasAttribute: key => key === 'data-art-placeholder',
    querySelectorAll(selector) { return selector === 'img' ? [failedImage] : selector === '[role="img"]' ? [fallback] : []; },
  };
  const expression = retryArtStateExpression('.sprite');
  const state = () => runInNewContext(expression, {
    document: { querySelectorAll: selector => selector === '.sprite' ? [sprite] : selector === '.combat .hand .card' ? [{}] : [] },
    getComputedStyle: node => node.style,
  });

  assert.deepEqual({ ...state() }, { n: 1, placeholders: 1, drawn: 0, hand: 1 });
  fallback.style.display = 'none';
  assert.equal(state().placeholders, 0, 'a hidden fallback cannot satisfy the gate');
  fallback.style.display = 'flex';
  fallback.box.width = 0;
  assert.equal(state().placeholders, 0, 'a fallback without layout cannot satisfy the gate');
});
