// tests/art-intake.test.mjs — which pull-request files belong to the art repository.
// Pure functions only (no git, no network): fast enough for every PR into dev.
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, destinationFor, intake, parseNameStatus, selftest } from '../tools/art-intake.mjs';

test('a high-tier file migrates to the art repository hd/ tree', () => {
  assert.deepEqual(classify('assets/bg/town.webp'), { verdict: 'migrate', dest: 'hd/assets/bg/town.webp' });
  assert.equal(destinationFor('assets/sfx/click.ogg'), 'hd/assets/sfx/click.ogg');
});

test('a font migrates to the common pack, not the high tier', () => {
  assert.deepEqual(classify('assets/fonts/Inter.woff2'), { verdict: 'migrate', dest: 'common/assets/fonts/Inter.woff2' });
});

test('a file under assets-mobile/ (the light tier) stays tracked here', () => {
  assert.deepEqual(classify('assets-mobile/bg/town.webp'), { verdict: 'stays', dest: null });
  assert.equal(destinationFor('assets-mobile/bg/town.webp'), null);
});

test('a source file is ignored, not an art file', () => {
  assert.deepEqual(classify('src/ui/assetmap.js'), { verdict: 'ignored', dest: null });
  assert.deepEqual(classify('asset-data/fonts/OFL.txt'), { verdict: 'ignored', dest: null });
  assert.deepEqual(classify('assetsx/a.webp'), { verdict: 'ignored', dest: null });
});

test('score renders and the music manifest migrate; the score source stays here', () => {
  assert.deepEqual(classify('music/town/theme.mp3'), { verdict: 'migrate', dest: 'common/music/town/theme.mp3' });
  assert.deepEqual(classify('music/manifest.json'), { verdict: 'migrate', dest: 'common/music/manifest.json' });
  assert.deepEqual(classify('music/score/theme.mjs'), { verdict: 'stays', dest: null });
});

test('map tiles and authoring art migrate to their art-repository homes', () => {
  assert.equal(destinationFor('map-detail/r1/t.webp'), 'common/map-detail/r1/t.webp');
  assert.equal(destinationFor('art/poses/a.png'), 'art/poses/a.png');
});

test('the diff parser keeps added and modified files and drops deletions and renames', () => {
  const diff = '\0M\0assets/bg/a.webp\0A\0src/x.js\0D\0gone.webp\0A\0music/town.mp3\0';
  assert.deepEqual(parseNameStatus(diff), [
    { status: 'M', path: 'assets/bg/a.webp' },
    { status: 'A', path: 'src/x.js' },
    { status: 'A', path: 'music/town.mp3' },
  ]);
});

test('intake sorts migrations by path and names the light files it keeps', () => {
  const r = intake([
    { status: 'A', path: 'music/town.mp3' },
    { status: 'M', path: 'assets-mobile/a.webp' },
    { status: 'A', path: 'assets/a.webp' },
    { status: 'A', path: 'src/x.js' },
  ]);
  assert.deepEqual(r.migrate, [
    { path: 'assets/a.webp', dest: 'hd/assets/a.webp' },
    { path: 'music/town.mp3', dest: 'common/music/town.mp3' },
  ]);
  assert.deepEqual(r.stays, ['assets-mobile/a.webp']);
});

test('the tool selftest passes', () => {
  assert.equal(selftest(), 0);
});
