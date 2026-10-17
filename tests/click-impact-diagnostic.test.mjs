// Diagnostic-helper branch only; never merge into production.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../tools/click-impact-diagnostic.mjs', import.meta.url), 'utf8');
const guards = source.slice(source.indexOf('const PLAYS ='), source.indexOf('\nconst wait ='));
const validate = (plays, seed) => runInNewContext(guards, {
  argOf: flag => flag === '--plays' ? plays : seed,
  CORE_ENTRY_SEED: '4', // The native fixture intentionally exports a string.
});

test('bounded diagnostics accept the exact native string seed after numeric parsing', () => {
  assert.doesNotThrow(() => validate('3', null));
  assert.doesNotThrow(() => validate('3', '4'));
});

test('diagnostics reject a different seed or a play count beyond the bounded capture', () => {
  assert.throws(() => validate('3', '5'), /exactly three plays/);
  assert.throws(() => validate('4', null), /exactly three plays/);
});
