import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolveArtifactBytes } from './git-artifact.mjs';

const html = Buffer.from('<!doctype html><title>Offline game</title>');
const pointer = Buffer.from(`version https://git-lfs.github.com/spec/v1\noid sha256:${createHash('sha256').update(html).digest('hex')}\nsize ${html.length}\n`);
assert.equal(resolveArtifactBytes(html, () => assert.fail('Legacy blobs need no hydration')), html);
assert.equal(resolveArtifactBytes(pointer, value => { assert.equal(value, pointer); return html; }), html);
assert.throws(() => resolveArtifactBytes(pointer, () => pointer), /does not match/);
assert.throws(() => resolveArtifactBytes(pointer, () => Buffer.alloc(html.length)), /does not match/);
assert.throws(() => resolveArtifactBytes(Buffer.from('version https://git-lfs.github.com/spec/v1\nsize 3\n'), () => html), /Malformed/);
assert.throws(() => resolveArtifactBytes(pointer, () => { throw new Error('download unavailable'); }), /download unavailable/);
console.log('PASS git artifact: legacy bytes, hydrated pointers, hash/size validation, malformed and unavailable objects');
