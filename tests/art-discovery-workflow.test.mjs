import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

// The map and battlefield authoring sources live in cehinds/AshenSpire-art
// (art/map-battlefield-drafts/, AshenSpire-art PR #26). This repository ships only the
// native-size runtime exports under assets-display/layered/, so no CI lane may depend on the sources.
const url = path => new URL(`../${path}`, import.meta.url);

for (const workflow of ['tests', 'ci']) {
  test(`${workflow}.yml does not check out or install anything from the map authoring sources`, () => {
    const source = readFileSync(url(`.github/workflows/${workflow}.yml`), 'utf8');
    assert.doesNotMatch(source, /map-battlefield-drafts/);
  });
}

test('the authoring sources are not tracked here; the runtime exports are', () => {
  assert.equal(existsSync(url('art/map-battlefield-drafts')), false, 'sources belong in AshenSpire-art');
  const manifest = JSON.parse(readFileSync(url('assets-display/layered/manifest.json'), 'utf8'));
  const ids = Object.keys(manifest.assets);
  assert.equal(ids.length, 95);
  for (const id of ids) assert.equal(existsSync(url(id)), true, id);
});
