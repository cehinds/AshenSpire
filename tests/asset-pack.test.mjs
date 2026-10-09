// tests/asset-pack.test.mjs — the pack format (tools/asset-pack.mjs) is
// byte-stable, and its check catches what the plan says it must.
//
// docs/EXTERNAL-ASSETS-PLAN.md §3 and step 2: objects named by their sha256,
// one index per pack with a .js twin carrying its exact text, and a font
// sidecar. Every test builds a throwaway tree; the real one is only planned
// (read, never written), so the suite writes no 230 MB store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildManifest, serialize, MANIFEST_PATH } from '../tools/art-manifest.mjs';
import { guardOut, planPacks, renderPacks, verifyPacks, writePacks, objectPath, PACKS, withRearPlayerArt } from '../tools/asset-pack.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// A minimal VP8L WebP header (see tests/art-manifest.test.mjs).
function webp(width, height, salt = 0) {
  const buf = Buffer.alloc(40);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(32, 4); buf.write('WEBP', 8, 'ascii');
  buf.write('VP8L', 12, 'ascii'); buf.writeUInt32LE(20, 16); buf[20] = 0x2f;
  buf.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21);
  buf[39] = salt;
  return buf;
}

const SVG = '<svg width="4" height="4">\n<rect/>\n</svg>\n';
const FILES = {
  'assets/bg/a.webp': webp(1536, 1024),
  'assets-mobile/bg/a.webp': webp(614, 410),
  'assets/bg/a-copy.webp': webp(1536, 1024), // byte-identical: one object
  'assets-mobile/bg/a-copy.webp': webp(614, 410),
  'assets/ui/i.svg': SVG,
  'assets-mobile/ui/i.svg': SVG,
  'assets/ui/B.webp': webp(64, 64, 1), // upper case sorts before lower in byte order
  'assets-mobile/ui/B.webp': webp(32, 32, 1),
  'assets/fonts/f-400-normal.woff2': Buffer.from('wOF2-face-one'),
  'assets-mobile/fonts/f-400-normal.woff2': Buffer.from('wOF2-face-one'),
  'asset-data/fonts/OFL.txt': 'SIL OPEN FONT LICENSE\nVersion 1.1\n',
  'music/manifest.json': '{\n  "tracks": ["title"]\n}\n',
  'music/title/title.mp3': Buffer.from('ID3-title'),
  'music/README.md': 'authoring, not packed\n',
  'map-detail/abc/256/0-0.webp': webp(256, 256, 2),
};

function tree(files, { crlf = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'asset-pack-'));
  for (const [rel, data] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), crlf && typeof data === 'string' ? data.replace(/\n/g, '\r\n') : data);
  }
  writeFileSync(join(root, MANIFEST_PATH), serialize(buildManifest(root)));
  return root;
}

/** Every file under dir → its sha256, by relative path. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const abs = join(d, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else out[relative(dir, abs).split(/[\\/]/g).join('/')] = sha(readFileSync(abs));
    }
  };
  walk(dir);
  return out;
}

function withPacks(fn, files = FILES) {
  const root = tree(files);
  const out = mkdtempSync(join(tmpdir(), 'asset-pack-out-'));
  try {
    writePacks({ source: 'trees', root, out });
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
    return fn({ root, out, manifest });
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
}

const packFile = (out, re) => readdirSync(join(out, 'packs')).find((f) => re.test(f));

test('rear player art joins the common pack and rejects modified source bytes', () => {
  const image = webp(512, 512);
  const catalog = 'export const alternativeCardAnimations = ' + JSON.stringify({ hashes: { 'rear-ready.webp': sha(image) } }) + ';';
  withPacks(({ root, out, manifest }) => {
    const combined = withRearPlayerArt(manifest, root);
    assert.deepEqual(verifyPacks(out, { manifest: combined }), []);
    const plan = planPacks(root, ['common'], { source: 'trees' });
    assert.deepEqual(plan.problems, []);
    assert(plan.packs.common.entries['assets-alternative/rear-ready.webp']);
    writeFileSync(join(root, 'assets-alternative/rear-ready.webp'), webp(512, 512, 1));
    assert.throws(() => withRearPlayerArt(manifest, root), /hash mismatch/);
  }, { ...FILES, 'src/content/alternativeCardAnimations.js': catalog, 'assets-alternative/rear-ready.webp': image });
});

test('a clean write verifies green, with the layout the plan names', () => {
  withPacks(({ out, manifest }) => {
    assert.deepEqual(verifyPacks(out, { manifest }), []);
    const files = readdirSync(join(out, 'packs')).sort();
    for (const pack of PACKS) {
      assert.ok(files.some((f) => new RegExp(`^${pack}-[0-9a-f]{12}\\.json$`).test(f)), `${pack} index`);
      assert.ok(files.some((f) => new RegExp(`^${pack}-[0-9a-f]{12}\\.js$`).test(f)), `${pack} twin`);
    }
    assert.ok(files.some((f) => /^fonts-[0-9a-f]{12}\.js$/.test(f)), 'font sidecar');
    assert.equal(files.length, 7);
    const light = JSON.parse(readFileSync(join(out, 'packs', packFile(out, /^light-.*\.json$/)), 'utf8'));
    assert.deepEqual(Object.keys(light), ['assets/bg/a-copy.webp', 'assets/bg/a.webp', 'assets/ui/B.webp', 'assets/ui/i.svg'], 'byte order, art ids only');
    assert.equal(light['assets/bg/a.webp'][0], light['assets/bg/a-copy.webp'][0], 'identical bytes are one object');
    assert.deepEqual(light['assets/ui/i.svg'].slice(1), [Buffer.byteLength(SVG), 'image/svg+xml']);
    const common = JSON.parse(readFileSync(join(out, 'packs', packFile(out, /^common-.*\.json$/)), 'utf8'));
    assert.deepEqual(Object.keys(common), ['assets/fonts/f-400-normal.woff2', 'licenses/OFL.txt', 'map-detail/abc/256/0-0.webp', 'music/manifest.json', 'music/title/title.mp3']);
    assert.equal(common['licenses/OFL.txt'][2], 'text/plain');
    assert.equal(common['music/manifest.json'][2], 'application/json');
    const [s, bytes] = common['music/title/title.mp3'];
    assert.equal(readFileSync(join(out, objectPath(s, 'music/title/title.mp3'))).length, bytes);
    // The twin is exactly window.__ashenPack(name, text).
    const name = packFile(out, /^common-.*\.json$/).slice(0, -5);
    const text = readFileSync(join(out, 'packs', `${name}.json`), 'utf8');
    assert.equal(readFileSync(join(out, 'packs', `${name}.js`), 'utf8'), `window.__ashenPack(${JSON.stringify(name)}, ${JSON.stringify(text)});\n`);
    assert.equal(sha(Buffer.from(text)).slice(0, 12), name.slice(-12), 'the name is the digest of the text');
  });
});

test('determinism: two writes, and an LF and a CRLF checkout, give identical bytes', () => {
  const lf = tree(FILES);
  const crlf = tree(FILES, { crlf: true });
  const outs = [0, 1, 2].map(() => mkdtempSync(join(tmpdir(), 'asset-pack-out-')));
  try {
    writePacks({ source: 'trees', root: lf, out: outs[0] });
    writePacks({ source: 'trees', root: lf, out: outs[1] });
    writePacks({ source: 'trees', root: crlf, out: outs[2] });
    const a = snapshot(outs[0]);
    assert.ok(Object.keys(a).length > 10);
    assert.deepEqual(snapshot(outs[1]), a, 'a second run writes the same tree');
    assert.deepEqual(snapshot(outs[2]), a, 'a CRLF checkout writes the same tree');
    // A rewrite over an old tree leaves nothing of the old one behind.
    writeFileSync(join(outs[0], 'packs', 'light-000000000000.json'), '{}\n');
    writePacks({ source: 'trees', root: lf, out: outs[0] });
    assert.deepEqual(snapshot(outs[0]), a);
  } finally {
    for (const d of [lf, crlf, ...outs]) rmSync(d, { recursive: true, force: true });
  }
});

test('known-bad: an object whose bytes do not hash to its name is caught', () => {
  withPacks(({ out, manifest }) => {
    const common = JSON.parse(readFileSync(join(out, 'packs', packFile(out, /^common-.*\.json$/)), 'utf8'));
    const [s] = common['map-detail/abc/256/0-0.webp'];
    const obj = join(out, objectPath(s, 'map-detail/abc/256/0-0.webp'));
    const buf = readFileSync(obj); buf[buf.length - 1] ^= 1;
    writeFileSync(obj, buf);
    assert.match(verifyPacks(out, { manifest }).join('\n'), /map-detail\/abc\/256\/0-0\.webp: .* does not hash to its name/);
  });
});

test('known-bad: an index whose recorded hash disagrees with the manifest, or a source that does, is caught', () => {
  withPacks(({ root, out, manifest }) => {
    const wrong = { ...manifest, assets: { ...manifest.assets } };
    const id = 'assets/ui/B.webp';
    wrong.assets[id] = { ...wrong.assets[id], high: { ...wrong.assets[id].high, sha256: '0'.repeat(64) } };
    assert.match(verifyPacks(out, { manifest: wrong }).join('\n'), /high: assets\/ui\/B\.webp: disagrees with art-manifest\.json/);
    // The writer refuses a source that no longer matches its record, and writes nothing.
    writeFileSync(join(root, 'assets/ui/B.webp'), webp(64, 64, 9));
    assert.match(planPacks(root, PACKS, { source: 'trees' }).problems.join('\n'), /assets\/ui\/B\.webp: the high file does not match art-manifest\.json/);
    const out2 = mkdtempSync(join(tmpdir(), 'asset-pack-out-'));
    try {
      assert.throws(() => writePacks({ source: 'trees', root, out: out2 }), /nothing was written/);
      assert.deepEqual(readdirSync(out2), []);
    } finally { rmSync(out2, { recursive: true, force: true }); }
  });
});

test('known-bad: a stray object, a stray pack file and a second index are caught', () => {
  withPacks(({ out, manifest }) => {
    const data = Buffer.from('not listed');
    const s = sha(data);
    mkdirSync(join(out, 'objects', s.slice(0, 2)), { recursive: true });
    writeFileSync(join(out, 'objects', s.slice(0, 2), `${s}.webp`), data);
    writeFileSync(join(out, 'objects', 'README.txt'), 'x');
    writeFileSync(join(out, 'packs', 'notes.json'), '{}');
    const second = '{}\n';
    const d12 = sha(Buffer.from(second)).slice(0, 12);
    writeFileSync(join(out, 'packs', `light-${d12}.json`), second);
    const problems = verifyPacks(out, { manifest }).join('\n');
    assert.match(problems, new RegExp(`objects/${s.slice(0, 2)}/${s}\\.webp: stray \\(no index lists it\\)`));
    assert.match(problems, /objects\/README\.txt: stray/);
    assert.match(problems, /packs\/notes\.json: stray/);
    assert.match(problems, /a second light index/);
  });
});

test('known-bad: a twin whose string does not match its index is caught', () => {
  withPacks(({ out, manifest }) => {
    const name = packFile(out, /^high-.*\.json$/).slice(0, -5);
    const twin = join(out, 'packs', `${name}.js`);
    const text = readFileSync(join(out, 'packs', `${name}.json`), 'utf8');
    // A stale twin: the right shape and name, an older index's text.
    writeFileSync(twin, `window.__ashenPack(${JSON.stringify(name)}, ${JSON.stringify(text.replace('image/webp', 'image/png'))});\n`);
    assert.match(verifyPacks(out, { manifest }).join('\n'), new RegExp(`${name}\\.js: the twin does not match its index`));
    // Not a twin at all.
    writeFileSync(twin, 'alert(1);\n');
    assert.match(verifyPacks(out, { manifest }).join('\n'), new RegExp(`${name}\\.js: not a window\\.__ashenPack`));
    // Missing.
    rmSync(twin);
    assert.match(verifyPacks(out, { manifest }).join('\n'), new RegExp(`${name}\\.js: the twin is missing`));
  });
});

test('known-bad: a font sidecar face that differs from its common record is caught', () => {
  withPacks(({ out, manifest }) => {
    const file = join(out, 'packs', packFile(out, /^fonts-.*\.js$/));
    const name = packFile(out, /^fonts-.*\.js$/).slice(0, -3);
    const text = `{\n"assets/fonts/f-400-normal.woff2":${JSON.stringify(Buffer.from('other').toString('base64'))}\n}\n`;
    writeFileSync(file, `__ashenFonts(${JSON.stringify(name)}, ${JSON.stringify(text)});\n`);
    const problems = verifyPacks(out, { manifest }).join('\n');
    assert.match(problems, /f-400-normal\.woff2 does not match its common record/);
    assert.match(problems, /its text hashes to/);
  });
});

test('the real tree plans cleanly: the common pack holds the 15 faces, the licence, the score and the tiles', () => {
  const plan = planPacks(undefined, ['common']);
  assert.deepEqual(plan.problems, []);
  const ids = Object.keys(plan.packs.common.entries);
  assert.equal(ids.filter((id) => id.startsWith('assets/fonts/')).length, 15);
  assert.ok(ids.includes('licenses/OFL.txt'));
  assert.ok(ids.includes('music/manifest.json'));
  assert.ok(ids.some((id) => /^music\/.+\.mp3$/.test(id)));
  assert.ok(ids.some((id) => /^map-detail\/.+\.webp$/.test(id)));
  assert.equal(Object.keys(plan.fonts).length, 15);
  const { summary } = renderPacks(plan);
  assert.match(summary.packs.common.index, /^packs\/common-[0-9a-f]{12}\.json$/);
  assert.match(summary.fonts.file, /^packs\/fonts-[0-9a-f]{12}\.js$/);
});

test('--out: a directory inside the checkout named like `..cache` is refused, a real parent is not', () => {
  const root = join(tmpdir(), 'asset-pack-root');
  assert.throws(() => guardOut(join(root, '..cache'), root), /write under build\/ or dist\//, '`..cache` is inside the checkout');
  assert.throws(() => guardOut(join(root, '..cache', 'packs'), root), /write under build\/ or dist\//);
  assert.throws(() => guardOut(join(root, 'src'), root), /write under build\/ or dist\//);
  assert.throws(() => guardOut(root, root), /not the repository root/);
  assert.doesNotThrow(() => guardOut(join(root, 'build', 'asset-pack'), root));
  assert.doesNotThrow(() => guardOut(join(root, '..', 'elsewhere'), root));
  assert.doesNotThrow(() => guardOut(join(root, '..'), root));
});

test('known-bad: a tree missing a whole pack is not green; a partial write checks green against its own selection', () => {
  withPacks(({ out, manifest }) => {
    const name = packFile(out, /^high-.*\.json$/).slice(0, -5);
    rmSync(join(out, 'packs', `${name}.json`));
    rmSync(join(out, 'packs', `${name}.js`));
    const problems = verifyPacks(out, { manifest });
    assert.ok(problems.some((p) => /no high index/.test(p)), problems.join('\n'));
  });
  const root = tree(FILES);
  const out = mkdtempSync(join(tmpdir(), 'asset-pack-out-'));
  try {
    writePacks({ source: 'trees', root, out, packs: ['light'] });
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
    assert.deepEqual(verifyPacks(out, { manifest, packs: ['light'] }), []);
    assert.match(verifyPacks(out, { manifest }).join('\n'), /no high index[\s\S]*no common index/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('known-bad: a symlinked --out, or a symlinked packs/ inside it, never clears a tracked directory', (t) => {
  const root = tree(FILES);
  const tracked = join(root, 'src');
  mkdirSync(tracked, { recursive: true });
  writeFileSync(join(tracked, 'keep.js'), 'tracked\n');
  mkdirSync(join(tracked, 'packs'), { recursive: true });
  writeFileSync(join(tracked, 'packs', 'keep.txt'), 'tracked\n');
  try {
    mkdirSync(join(root, 'build'), { recursive: true });
    try { symlinkSync(tracked, join(root, 'build', 'out'), 'dir'); } catch (e) { t.skip(`symlinks unavailable here (${e.code})`); return; }
    assert.throws(() => writePacks({ source: 'trees', root, out: join(root, 'build', 'out') }), /--out src: write under build\/ or dist\//);
    mkdirSync(join(root, 'build', 'real'), { recursive: true });
    symlinkSync(join(tracked, 'packs'), join(root, 'build', 'real', 'packs'), 'dir');
    assert.throws(() => writePacks({ source: 'trees', root, out: join(root, 'build', 'real') }), /is a symlink/);
    assert.equal(readFileSync(join(tracked, 'keep.js'), 'utf8'), 'tracked\n');
    assert.equal(readFileSync(join(tracked, 'packs', 'keep.txt'), 'utf8'), 'tracked\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: an unmarked --out with its own packs/ or objects/ is refused, never cleared', () => {
  const root = tree(FILES);
  const out = mkdtempSync(join(tmpdir(), 'asset-pack-out-'));
  try {
    mkdirSync(join(out, 'objects'), { recursive: true });
    writeFileSync(join(out, 'objects', 'theirs.bin'), 'not ours\n');
    assert.throws(() => writePacks({ source: 'trees', root, out }), /objects is not empty and \.asset-pack is not beside it/);
    assert.equal(readFileSync(join(out, 'objects', 'theirs.bin'), 'utf8'), 'not ours\n');
    assert.ok(!readdirSync(out).includes('.asset-pack'), 'a refused run writes no marker');
    // A same-named file that asset-pack did not write proves nothing.
    writeFileSync(join(out, '.asset-pack'), '');
    assert.throws(() => writePacks({ source: 'trees', root, out }), /was not written by asset-pack/);
    assert.equal(readFileSync(join(out, 'objects', 'theirs.bin'), 'utf8'), 'not ours\n');
    assert.equal(readFileSync(join(out, '.asset-pack'), 'utf8'), '', 'a foreign marker is left as it was');
    rmSync(join(out, '.asset-pack'));
    // Empty directories are fine; the write then marks the tree as its own.
    rmSync(join(out, 'objects', 'theirs.bin'));
    mkdirSync(join(out, 'packs'), { recursive: true });
    writePacks({ source: 'trees', root, out });
    assert.ok(readdirSync(out).includes('.asset-pack'));
    // A marked tree is cleared and rewritten, strays included.
    writeFileSync(join(out, 'objects', 'stray.bin'), 'x');
    writePacks({ source: 'trees', root, out });
    const manifest = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8'));
    assert.deepEqual(verifyPacks(out, { manifest }), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('known-bad: --check reports a symlink under packs/ or objects/ instead of following it', (t) => {
  withPacks(({ out, manifest }) => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'asset-pack-elsewhere-'));
    try {
      const common = JSON.parse(readFileSync(join(out, 'packs', packFile(out, /^common-.*\.json$/)), 'utf8'));
      const [s] = common['music/title/title.mp3'];
      const obj = join(out, objectPath(s, 'music/title/title.mp3'));
      // The same bytes, reached through a link: following it would read green.
      writeFileSync(join(elsewhere, 'title.mp3'), readFileSync(obj));
      rmSync(obj);
      try { symlinkSync(join(elsewhere, 'title.mp3'), obj); } catch (e) { t.skip(`symlinks unavailable here (${e.code})`); return; }
      symlinkSync(elsewhere, join(out, 'packs', 'linked'), 'dir');
      const problems = verifyPacks(out, { manifest }).join('\n');
      assert.match(problems, new RegExp(`objects/${s.slice(0, 2)}/${s}\\.mp3: a symlink`));
      assert.match(problems, /packs\/linked: a symlink/);
    } finally { rmSync(elsewhere, { recursive: true, force: true }); }
  });
});

test('known-bad: --out or --pack without a value is refused before anything is written', () => {
  const tool = fileURLToPath(new URL('../tools/asset-pack.mjs', import.meta.url));
  for (const argv of [['--out'], ['--out', '--check'], ['--pack'], ['--pack', '--json'], ['--check', '--out']]) {
    const r = spawnSync(process.execPath, [tool, ...argv], { encoding: 'utf8' });
    assert.equal(r.status, 2, `${argv.join(' ')}: ${r.stderr}`);
    assert.match(r.stderr, /needs a value/);
  }
});

test('known-bad: a .asset-pack marker that is a symlink or a directory is refused, and nothing is written through it', (t) => {
  const root = tree(FILES);
  const out = mkdtempSync(join(tmpdir(), 'asset-pack-out-'));
  const elsewhere = mkdtempSync(join(tmpdir(), 'asset-pack-elsewhere-'));
  try {
    writeFileSync(join(elsewhere, 'precious.txt'), 'keep\n');
    mkdirSync(join(out, '.asset-pack'));
    assert.throws(() => writePacks({ source: 'trees', root, out }), /\.asset-pack exists and is not a regular file/);
    rmSync(join(out, '.asset-pack'), { recursive: true });
    try { symlinkSync(join(elsewhere, 'precious.txt'), join(out, '.asset-pack')); } catch (e) { t.skip(`symlinks unavailable here (${e.code})`); return; }
    assert.throws(() => writePacks({ source: 'trees', root, out }), /\.asset-pack exists and is not a regular file/);
    assert.equal(readFileSync(join(elsewhere, 'precious.txt'), 'utf8'), 'keep\n');
    assert.ok(!readdirSync(out).includes('packs'), 'nothing was written');
  } finally {
    for (const d of [root, out, elsewhere]) rmSync(d, { recursive: true, force: true });
  }
});

test('.gitignore keeps the store and its marker out of git at any depth under build/ and dist/', (t) => {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const paths = ['build/asset-pack/.asset-pack', 'build/web/packs/light-000000000000.json', 'build/a/b/objects/aa/x.webp', 'build/a/.asset-pack',
    'dist/packs/light-000000000000.json', 'dist/objects/aa/x.webp', 'dist/.asset-pack', 'dist/staging/packs/x.json', 'dist/staging/objects/aa/x.webp', 'dist/staging/.asset-pack',
    // The step-8e tree: the light single file under download/, the base file
    // beside the game file, and the version-stamped copy.
    'build/download/AshenSpire.html', 'dist/download/AshenSpire.html', 'build/asset-base.json', 'dist/asset-base.json', 'dist/AshenSpire-0.7.1.1.html', 'AshenSpire.html'];
  const r = spawnSync('git', ['check-ignore', '--no-index', ...paths], { cwd: repo, encoding: 'utf8' });
  if (r.error || r.status === 128) { t.skip(`git unavailable here (${r.error?.code || r.stderr.trim()})`); return; }
  assert.deepEqual(r.stdout.split('\n').filter(Boolean).sort(), [...paths].sort(), 'every path is ignored');
  const kept = spawnSync('git', ['check-ignore', '--no-index', 'src/packs/x.js', 'dist/README.md'], { cwd: repo, encoding: 'utf8' });
  assert.equal(kept.stdout, '', 'source directories named packs/ and dist/README.md stay tracked');
});
