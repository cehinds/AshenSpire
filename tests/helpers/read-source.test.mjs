import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSourceText, readSourceText, readSourceTextSync } from './read-source.mjs';

test('source text reads normalize CRLF while preserving authored content', async () => {
  const root = mkdtempSync(join(tmpdir(), 'read-source-'));
  try {
    const lf = join(root, 'lf.txt');
    const crlf = join(root, 'crlf.txt');
    writeFileSync(lf, 'first\nsecond\n', 'utf8');
    writeFileSync(crlf, 'first\r\nsecond\r\n', 'utf8');
    assert.equal(readSourceTextSync(lf), 'first\nsecond\n');
    assert.equal(readSourceTextSync(crlf), readSourceTextSync(lf));
    assert.equal(await readSourceText(crlf), readSourceTextSync(lf));
    assert.equal(normalizeSourceText('one\r\ntwo\n'), 'one\ntwo\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
