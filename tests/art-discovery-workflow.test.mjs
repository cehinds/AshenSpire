import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {execFileSync} from 'node:child_process';

// Source-art authoring and its Python schema dependencies moved to AshenSpire-art.
// Game discovery still owns the Pillow conversion checks and shipped runtime layers;
// its sparse checkout must exclude the original PNGs rather than re-import that work.
for (const [workflow, job] of [['tests', 'discovered'], ['ci', 'test-discovered']]) {
  const source = readFileSync(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), 'utf8');
  const body = source.split(`\n  ${job}:`)[1]?.split(/\n  [\w-]+:/)[0];
  test(`${workflow} discovery retains its card encoder without depending on migrated authoring requirements`, () => {
    assert.ok(body, 'the discovery job exists');
    assert.match(body, /"[^"\n]*python" -m pip install Pillow==11\.1\.0(?:\r?\n|$)/);
    assert.doesNotMatch(body, /art\/map-battlefield-drafts\/requirements\.txt/);
  });
  test(`${workflow} discovery excludes source PNGs while retaining runtime WebP and card layers`, () => {
    const patterns = body?.match(/sparse-checkout: \|\n((?:            .+\n)+)/)?.[1].split('\n').filter(Boolean).map(line => line.slice(12)).join('\n');
    assert.ok(patterns, 'use the actual workflow checkout patterns');
    const root = mkdtempSync(join(tmpdir(), 'art-discovery-'));
    const required = ['assets-display/layered/fixture.webp', 'assets-display/card-cutouts/fixture.png', 'assets-mobile/environments/fixture.webp', 'assets-mobile/card-art/fixture.webp', 'docs/design/new-card-art/cutouts.html', 'docs/design/new-card-art/cutouts-data.js', 'src/content/layeredEnvironments.js'];
    const excluded = ['art/map-battlefield-drafts/batch-06-settlements/ashen-crown/ground-market-cobbles.png', 'art/map-battlefield-drafts/technical-map-icons/fixture.png', 'art/unrelated/fixture.png', 'docs/fixture.png'];
    const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']});
    try {
      for (const path of [...required, ...excluded, 'README.md']) {
        mkdirSync(dirname(join(root, path)), {recursive: true});
        writeFileSync(join(root, path), 'tracked checkout fixture');
      }
      git('init'); git('add', '.');
      git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture');
      execFileSync('git', ['sparse-checkout', 'set', '--no-cone', '--stdin'], {cwd: root, input: patterns, stdio: 'pipe'});
      for (const path of required) assert.equal(existsSync(join(root, path)), true, path);
      for (const path of excluded) assert.equal(existsSync(join(root, path)), false, path);
    } finally { rmSync(root, {recursive: true, force: true}); }
  });
}

// The published source PR owns authoring; the game must retain each shipped export.
test('the authoring sources are not tracked here; the runtime exports are', () => {
  assert.equal(existsSync(new URL('../art/map-battlefield-drafts', import.meta.url)), false);
  const manifest = JSON.parse(readFileSync(new URL('../assets-display/layered/manifest.json', import.meta.url), 'utf8'));
  const ids = Object.keys(manifest.assets);
  assert.equal(ids.length, 95);
  for (const id of ids) assert.equal(existsSync(new URL(`../${id}`, import.meta.url)), true, id);
});
