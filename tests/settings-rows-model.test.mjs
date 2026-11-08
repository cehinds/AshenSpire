// The settings row table lives in src/ui/models/SettingsRowsModel.js and the
// row markup goes through the kit's string builder. Neither move may change a
// byte: every row's HTML, drawn from default settings, hashes to what
// origin/dev drew before the move (fixtures/settings-rows-html.sha256.json,
// keyed "<cat>/<key>").
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { settingsRows, settingsRowHtml } from '../src/ui/screens/settings.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./fixtures/settings-rows-html.sha256.json', import.meta.url), 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex');

test('every settings row draws byte-identical markup to the pre-move snapshot', () => {
  const rows = settingsRows();
  const seen = new Set();
  const drifted = [];
  for (const row of rows) {
    const id = `${row.cat}/${row.key}`;
    seen.add(id);
    if (sha(settingsRowHtml({}, row)) !== SNAPSHOT[id]) drifted.push(id);
  }
  assert.deepEqual(drifted, [], 'rows whose markup changed');
  assert.deepEqual(Object.keys(SNAPSHOT).filter((id) => !seen.has(id)), [], 'snapshot rows that no longer exist');
  assert.equal(seen.size, Object.keys(SNAPSHOT).length);
});
