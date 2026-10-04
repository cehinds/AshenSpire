import test from 'node:test';
import assert from 'node:assert/strict';
import { settingsRow, settingsRowHtml, allResettableKeys, resetKeys } from '../src/ui/screens/settings.js';

test('Reset all settings is a visible button row under Display', () => {
  const row = settingsRow('resetAllSettings');
  assert.ok(row, 'row exists');
  assert.equal(row.cat, 'Display');
  assert.equal(row.type, 'button');
  assert.match(settingsRowHtml({}, row), /data-btn="resetAllSettings"/);
});

test('Reset all covers every stored key and never the control rows', () => {
  const keys = allResettableKeys();
  assert.ok(keys.length > 10);
  assert.ok(!keys.includes('resetAllSettings'), 'the button row stores nothing');
  assert.ok(!keys.includes('commandLog'), 'other button rows store nothing');
  assert.ok(keys.includes('reduceFlashes'));
});

test('resetting every key clears a changed value and offers it back', () => {
  const settings = { reduceFlashes: true };
  const saved = [];
  const snapshot = resetKeys(settings, (changes) => { saved.push(changes); return { ok: true }; }, allResettableKeys(), 'All settings reset', { promoted: {} });
  assert.equal(settings.reduceFlashes, undefined);
  assert.equal(snapshot.reduceFlashes, true);
  assert.equal(saved.length, 1);
});
