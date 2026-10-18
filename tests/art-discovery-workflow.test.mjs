import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {execFileSync} from 'node:child_process';

for (const [workflow, job] of [['tests', 'discovered'], ['ci', 'test-discovered']]) {
  const source = readFileSync(new URL(`../.github/workflows/${workflow}.yml`, import.meta.url), 'utf8');
  const body = source.split(`\n  ${job}:`)[1]?.split(/\n  [\w-]+:/)[0];
  test(`${workflow} discovery installs schema validation into its test Python environment`, () => {
    assert.ok(body, 'the discovery job exists');
    assert.match(body, /"[^"\n]*python" -m pip install Pillow==11\.1\.0 -r art\/map-battlefield-drafts\/requirements\.txt/);
  });
  test(`${workflow} discovery includes map-module artwork but retains unrelated sparse exclusions`, () => {
    const patterns = body?.match(/sparse-checkout: \|\n((?:            .+\n)+)/)?.[1].split('\n').filter(Boolean).map(line => line.slice(12)).join('\n');
    assert.ok(patterns, 'use the actual workflow checkout patterns');
    const root = mkdtempSync(join(tmpdir(), 'art-discovery-'));
    const required = ['art/map-battlefield-drafts/batch-06-settlements/ashen-crown/ground-market-cobbles.png', 'art/map-battlefield-drafts/technical-map-icons/fixture.png'];
    const excluded = ['art/unrelated/fixture.png', 'docs/fixture.png'];
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
