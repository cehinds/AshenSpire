// tests/workbench-static.test.mjs — the static Workbench build for GitHub Pages.
//
// Runs tools/workbench-static.mjs into a temporary directory with a non-root
// base and no art, then checks what the GitHub Pages site would load: the page
// and its stylesheet under the base, the static-api module ahead of app.mjs
// (when the module exists in the checkout), the snapshot of the Workbench API,
// the game mirror, and the --no-art switch. docs/design/ must never be in it.
// The tool boots the real Workbench server, so this takes a while.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = path.join(REPO, 'tools', 'workbench-static.mjs');
const BASE = '/x/wb/';
const SHIM_SOURCE = path.join(REPO, 'workbench', 'static', 'static-api.mjs');

describe('workbench static build', () => {
  let tmp;
  let out;
  let run;

  before(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'wbs-test-'));
    out = path.join(tmp, 'out');
    run = spawnSync(process.execPath, [TOOL, '--out', out, '--base', BASE, '--no-art'], { timeout: 180000, encoding: 'utf8' });
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('exits 0 and prints a one-line summary', () => {
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /files in the snapshot, [\d.]+ MB/);
  });

  it('loads the static-api module before app.mjs and moves the stylesheet under the base', () => {
    const html = readFileSync(path.join(out, 'index.html'), 'utf8');
    assert.ok(html.includes(`href="${BASE}shared/tokens.css"`), 'stylesheet href is under the base');
    const appAt = html.indexOf(`src="${BASE}app.mjs"`);
    assert.ok(appAt > 0, 'index.html loads app.mjs under the base');
    if (existsSync(SHIM_SOURCE)) {
      const shimAt = html.indexOf(`src="${BASE}static/static-api.mjs"`);
      assert.ok(shimAt >= 0 && shimAt < appAt, 'static-api.mjs is loaded before app.mjs');
      assert.ok(existsSync(path.join(out, 'static', 'static-api.mjs')), 'the module is copied to static/');
    }
  });

  it('rewrites the absolute API paths in app.mjs under the base', () => {
    assert.ok(readFileSync(path.join(out, 'app.mjs'), 'utf8').includes(`${BASE}api/`));
  });

  it('writes a snapshot with meta, the API answers and an index of the files', () => {
    const snapshot = JSON.parse(readFileSync(path.join(out, 'static-api', 'snapshot.json'), 'utf8'));
    assert.equal(typeof snapshot.meta.head, 'string');
    assert.ok(snapshot.meta.head.length > 0, 'meta.head is the checkout HEAD');
    assert.ok(snapshot.snap && snapshot.snap.tools, 'the API answers are recorded');
    const paths = Object.keys(snapshot.index);
    assert.ok(paths.some((p) => p.startsWith('content/config/ui/')), 'content/config/ui/ files are indexed');
    assert.ok(!paths.some((p) => p.startsWith('docs/design/')), 'docs/design/ is never indexed');
  });

  it('stores each indexed file as JSON with its text', () => {
    const snapshot = JSON.parse(readFileSync(path.join(out, 'static-api', 'snapshot.json'), 'utf8'));
    const [first] = Object.keys(snapshot.index);
    const body = JSON.parse(readFileSync(path.join(out, 'static-api', 'files', `${first}.json`), 'utf8'));
    assert.equal(typeof body.text, 'string');
  });

  it('mirrors the game entry page', () => {
    assert.ok(existsSync(path.join(out, 'game', 'index.html')));
  });

  it('moves the game module paths under the base', () => {
    const render = readFileSync(path.join(out, 'game', 'workbench', 'modules', 'entities', 'render.html'), 'utf8');
    assert.ok(render.includes(`${BASE}game/workbench/modules/`));
  });

  it('writes no game/assets when --no-art is given', () => {
    assert.equal(existsSync(path.join(out, 'game', 'assets')), false);
  });
});
