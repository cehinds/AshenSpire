import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { artRecord } from '../tools/art-source.mjs';
import { contentBundle } from '../src/content/index.js';
import { questChains } from '../src/content/events.js';
import { eventArtAsset } from '../src/content/eventArt.js';
import { speakerPortraitAsset } from '../src/content/speakerArt.js';
import { KEEPSAKES } from '../src/content/keepsakes.js';
import { keepsakeArtAsset } from '../src/content/keepsakeArt.js';

function shipped(path) {
  assert.ok(path, 'registered path');
  const record = artRecord(path);
  assert.ok(record?.high, `${path} high release`);
  assert.ok(record?.light, `${path} light release`);
  assert.ok(existsSync(new URL('../' + path.replace('assets/', 'assets-mobile/'), import.meta.url)), `${path} mobile`);
}

test('every flask has a high release record and local light illustration', () => {
  for (const flask of contentBundle.flasks) shipped(flask.artAsset);
});

test('every one-off event has a high release record and local light vignette', () => {
  const steps = new Set(Object.values(questChains).flatMap(chain => chain.steps));
  const oneOffs = contentBundle.events.filter(event => !steps.has(event.id));
  assert.equal(oneOffs.length, 20);
  for (const event of oneOffs) shipped(eventArtAsset(event));
  assert.equal(eventArtAsset('../unknown'), null);
});

test('the Road Warden portrait ships independently of enemy poses', () => {
  shipped(speakerPortraitAsset('roadWarden'));
  assert.equal(speakerPortraitAsset('unknown'), null);
});

test('three keepsakes reuse shipped item art and Nothing remains empty', () => {
  for (const keepsake of KEEPSAKES) {
    if (keepsake.id === 'none') assert.equal(keepsakeArtAsset(keepsake), null);
    else shipped(keepsakeArtAsset(keepsake));
  }
});
