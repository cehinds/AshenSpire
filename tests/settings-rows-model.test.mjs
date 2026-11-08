// The settings row table lives in src/ui/models/SettingsRowsModel.js and the
// row markup goes through the kit's string builder. Neither move may change a
// byte: every row's HTML, drawn from default settings, hashes to what
// origin/dev drew before the move (fixtures/settings-rows-html.sha256.json,
// keyed "<cat>/<key>"). The one allowed difference is a label's own special
// characters, which the row now escapes ("Download & saves" -> "&amp;"): the
// test writes the escaped label back before hashing, so everything else in the
// row is still held byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { settingsRows, settingsRowHtml, settingsRow } from '../src/ui/screens/settings.js';
import { esc } from '../src/ui/kit/index.js';

const SNAPSHOT = JSON.parse(readFileSync(new URL('./fixtures/settings-rows-html.sha256.json', import.meta.url), 'utf8'));
const sha = (text) => createHash('sha256').update(text).digest('hex');

test('every settings row draws byte-identical markup to the pre-move snapshot', () => {
  const rows = settingsRows();
  const seen = new Set();
  const drifted = [];
  for (const row of rows) {
    const id = `${row.cat}/${row.key}`;
    seen.add(id);
    const label = String(row.label);
    const markup = settingsRowHtml({}, row);
    const asBefore = label === esc(label) ? markup : markup.replaceAll(esc(label), label);
    if (sha(asBefore) !== SNAPSHOT[id]) drifted.push(id);
  }
  assert.deepEqual(drifted, [], 'rows whose markup changed');
  assert.deepEqual(Object.keys(SNAPSHOT).filter((id) => !seen.has(id)), [], 'snapshot rows that no longer exist');
  assert.equal(seen.size, Object.keys(SNAPSHOT).length);
});

test('a label is escaped wherever a row prints it', () => {
  const nasty = '<b>&"';
  for (const key of ['reduceFlashes', 'combatLogPlayerColor', 'tapFloor']) {
    const row = settingsRow(key);
    assert.ok(row, key);
    const markup = settingsRowHtml({}, { ...row, label: nasty });
    assert.ok(markup.includes('&lt;b&gt;&amp;&quot;'), `${key}: the label is printed escaped`);
    assert.ok(!markup.includes(nasty), `${key}: the raw label never reaches the markup`);
  }
});
