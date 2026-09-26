// tests/fetch-art.test.mjs — tools/zip.mjs and tools/fetch-art.mjs, with known-bads.
//
// The zip module is shared byte for byte with cehinds/AshenSpire-art, which
// packs the releases this tool unpacks; the pinned vector below is the same one
// that repository's tests pin, so the two cannot drift apart silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, readZip, writeZip } from '../tools/zip.mjs';
import { fetchArt, readPin, verifyRelease, PIN_PATH, MANIFEST_PATH } from '../tools/fetch-art.mjs';

const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const tmp = () => mkdtempSync(join(tmpdir(), 'fetch-art-'));

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('the shared zip writer produces the vector cehinds/AshenSpire-art pins', () => {
  const dir = tmp();
  try {
    const out = join(dir, 'v.zip');
    writeZip(out, [{ name: 'b/two.txt', data: Buffer.from('two\n') }, { name: 'a.txt', data: Buffer.from('one\n') }]);
    const buf = readFileSync(out);
    assert.equal(sha(buf), 'dbe718937523d5bf1e635265ef5521109f596ec2e6762d8f01977032ea52c67c');
    assert.deepEqual(readZip(buf).map((e) => e.name), ['a.txt', 'b/two.txt']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the committed pin is well formed, and says so plainly while no release is pinned', () => {
  const pin = JSON.parse(readFileSync(new URL(`../${PIN_PATH}`, import.meta.url), 'utf8'));
  assert.equal(pin.repo, 'cehinds/AshenSpire-art');
  if (pin.tag === null) assert.throws(() => readPin(), /pins no release yet/);
  else assert.match(readPin().sha256, /^[0-9a-f]{64}$/);
});

// A throwaway repo root: a manifest listing two ids, a release zip made the way
// cehinds/AshenSpire-art's tools/pack.mjs makes one, and a pin for it.
function fixture({ tamper = null } = {}) {
  const root = tmp();
  const files = { 'assets/bg/a.webp': Buffer.from('high-a'), 'assets/ui/b.webp': Buffer.from('high-b') };
  const record = (id) => ({ high: { path: id, bytes: files[id].length, sha256: sha(files[id]) } });
  const manifest = { schema: 1, count: 2, assets: Object.fromEntries(Object.keys(files).map((id) => [id, record(id)])) };
  writeFileSync(join(root, MANIFEST_PATH), JSON.stringify(manifest));
  let entries = [{ name: 'art-manifest.json', data: Buffer.from(JSON.stringify(manifest)) },
    ...Object.entries(files).map(([name, data]) => ({ name, data }))];
  if (tamper) entries = tamper(entries);
  const zip = join(root, 'hd-assets-v1.zip');
  writeZip(zip, entries);
  const pin = { repo: 'cehinds/AshenSpire-art', tag: 'hd-assets-v1', zip: 'hd-assets-v1.zip', sha256: sha(readFileSync(zip)) };
  writeFileSync(join(root, PIN_PATH), JSON.stringify(pin));
  return { root, zip, pin, manifest };
}

test('a matching release is verified, unpacked into .art-cache/<tag>/, then reused', async () => {
  const { root, zip } = fixture();
  try {
    const first = await fetchArt({ root, from: zip });
    assert.equal(first.count, 2);
    assert.equal(readFileSync(join(first.dir, 'assets/bg/a.webp'), 'utf8'), 'high-a');
    assert.match(first.dir, /\.art-cache[\\/]hd-assets-v1$/);
    const again = await fetchArt({ root });
    assert.equal(again.reused, true, 'a verified cache is reused without a download');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a zip whose sha256 is not the pinned one is refused before it is read', () => {
  const { root, zip, pin, manifest } = fixture();
  try {
    const buf = readFileSync(zip);
    buf[buf.length - 1] ^= 1;
    assert.match(verifyRelease(buf, pin, manifest).problems[0], /sha256 is .* pins/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('known-bad: a changed, missing or extra file is refused and leaves no cache', async () => {
  const cases = [
    [(e) => e.map((x) => (x.name === 'assets/bg/a.webp' ? { ...x, data: Buffer.from('other') } : x)), /assets\/bg\/a\.webp: the release's file differs/],
    [(e) => e.filter((x) => x.name !== 'assets/ui/b.webp'), /assets\/ui\/b\.webp: not in the release/],
    [(e) => [...e, { name: 'assets/extra.webp', data: Buffer.from('x') }], /assets\/extra\.webp: in the release, not in/],
  ];
  for (const [tamper, want] of cases) {
    const { root, zip } = fixture({ tamper });
    try {
      await assert.rejects(fetchArt({ root, from: zip }), (e) => { assert.match(e.problems.join('\n'), want); return true; });
      assert.ok(!existsSync(join(root, '.art-cache/hd-assets-v1')), 'nothing is unpacked from a release that failed');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('known-bad: --recheck finds a cached file edited after it was verified', async () => {
  const { root, zip } = fixture();
  try {
    const { dir } = await fetchArt({ root, from: zip });
    mkdirSync(join(dir, 'assets/bg'), { recursive: true });
    writeFileSync(join(dir, 'assets/bg/a.webp'), 'edited');
    await assert.rejects(fetchArt({ root, recheck: true }), (e) => { assert.match(e.problems.join('\n'), /assets\/bg\/a\.webp: the cached file changed/); return true; });
    assert.ok(!existsSync(dir), 'a cache that no longer matches is removed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
