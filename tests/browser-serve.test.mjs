// tests/browser-serve.test.mjs — the serve half of tools/browser.mjs in the core
// suite (docs/EXTERNAL-ASSETS-PLAN.md step 8d).
//
// `node tools/browser.mjs --selftest --serve-only` runs check S: buildPageUrl()
// leaves an inline file on file://, serves a pack-shaped build under the
// channel its file reads, streams bodies and ranges, sends no body for HEAD,
// and refuses paths and symlinks that leave the folder. It needs no browser,
// so it runs here on every pull request rather than only by hand.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChannel, debugEnabled } from '../src/ui/buildChannel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('browser.mjs check S holds (buildPageUrl / serveDir, no browser)', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'browser.mjs'), '--selftest', '--serve-only'], { encoding: 'utf8', timeout: 60000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  assert.equal(r.status, 0, out);
  assert.match(out, /^PASS {2}S {2}buildPageUrl \/ serveDir \((\d+) checks, no browser\)/m, out);
  assert.doesNotMatch(out, /RED /, out);
  // The checks that answer the review findings must still be among them.
  for (const name of [/reads the file's channel/, /stale packs\/ folder stays on file/, /invalid range/, /sent to the slash/, /symlink inside the folder/, /HEAD sends the length and no body/, /byte range answers 206/]) {
    assert.match(out, name, `check S no longer covers ${name}`);
  }
});

test('a build served under /unknown/latest/ reads the channel its file reads', () => {
  const at = (href) => { const u = new URL(href); return { pathname: u.pathname, hostname: u.hostname, protocol: u.protocol }; };
  const file = buildChannel(at('file:///home/p/dist/AshenSpire.html'), 'standalone file');
  const served = buildChannel(at('http://127.0.0.1:41234/unknown/latest/AshenSpire.html'), 'standalone file');
  assert.equal(file, 'unknown');
  assert.equal(served, file);
  assert.equal(debugEnabled(served, { search: '', storage: null }), debugEnabled(file, { search: '', storage: null }));
  // The control: the same page at the bare loopback root is a developer's seat.
  assert.equal(buildChannel(at('http://127.0.0.1:41234/AshenSpire.html'), 'standalone file'), 'dev');
});

test('an /unknown/ path is a channel only on this machine', () => {
  const at = (href) => { const u = new URL(href); return { pathname: u.pathname, hostname: u.hostname, protocol: u.protocol }; };
  // A download saved under a folder that happens to be called unknown/1 keeps
  // the channel its name carries.
  assert.equal(buildChannel(at('file:///home/p/unknown/1/AshenSpire-test-0.7.1.9.html'), 'standalone file'), 'test');
  assert.equal(buildChannel(at('file:///home/p/unknown/1/AshenSpire.html'), 'standalone file'), 'unknown');
  // Pages keeps its four channels: /unknown/ there is just the site's tree.
  assert.equal(buildChannel(at('https://cehinds.github.io/AshenSpire/unknown/1/'), 'standalone file'), 'main');
  assert.equal(buildChannel(at('http://localhost:8080/unknown/latest/AshenSpire.html'), 'standalone file'), 'unknown');
});

// THE WINDOWS RED (ci.yml run 36981774214, tests (windows-latest)): every check
// that serves a body answered 403. The runner's TMPDIR is an 8.3 short name
// (C:\Users\RUNNER~1\...). The JS realpathSync() does not expand short names;
// the native realpath (fs/promises, realpathSync.native) does. serveDir took the
// folder's real path from one and each file's from the other, so no file was
// ever "inside" its own folder. Linux has no short names, so this simulates one:
// `alias` is a symlink to the folder, which the JS realpathSync is made to leave
// as typed (as it leaves a short name on Windows) while the native realpath
// resolves it to the long name. Not named RUNNER~1: on NTFS that IS the real
// short name of `runneradmin`, so the symlink would collide with it (EEXIST).
test('serveDir serves a folder named by an alias the JS realpathSync keeps (Windows 8.3 short names)', async () => {
  const fs = (await import('node:fs')).default;
  const { syncBuiltinESMExports } = await import('node:module');
  const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } = fs;
  const { tmpdir } = await import('node:os');
  const td = fs.realpathSync.native(mkdtempSync(join(tmpdir(), 'bsv83-')));
  const long = join(td, 'runneradmin');
  const short = join(td, 'alias');
  mkdirSync(long);
  writeFileSync(join(long, 'AshenSpire.html'), 'served');
  // A junction on Windows needs no admin rights or developer mode, as a 'dir'
  // symlink does; elsewhere the type is ignored.
  symlinkSync(long, short, process.platform === 'win32' ? 'junction' : 'dir');
  const jsRealpathSync = fs.realpathSync;
  const shortName = (p) => (p === short || p.startsWith(short + sep) ? p : jsRealpathSync(p));
  shortName.native = jsRealpathSync.native;
  fs.realpathSync = shortName;
  syncBuiltinESMExports();
  try {
    const { serveDir } = await import('../tools/browser.mjs');
    const s = await serveDir(short, { prefix: 'unknown/latest' });
    try {
      const res = await fetch(s.url('AshenSpire.html'));
      assert.equal(res.status, 200, 'the folder\'s own file is refused: root and file real paths came from two realpath implementations');
      assert.equal(await res.text(), 'served');
    } finally { await s.close(); }
  } finally {
    fs.realpathSync = jsRealpathSync;
    syncBuiltinESMExports();
    rmSync(td, { recursive: true, force: true });
  }
});
