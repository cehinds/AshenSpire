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

test('Reset all also clears stored keys of the retired legacy groups, which have no row left', () => {
  const settings = { 'recovery.hp.afterCombat': 50, 'gameConfig.balance.xp.combatWin': 9, 'gameConfig.presentation.formationGap': 20, reduceFlashes: true };
  const keys = allResettableKeys(settings);
  assert.ok(keys.includes('recovery.hp.afterCombat') && keys.includes('gameConfig.balance.xp.combatWin'));
  resetKeys(settings, () => ({ ok: true }), keys, 'All settings reset', { promoted: {} });
  assert.equal(settings['recovery.hp.afterCombat'], undefined);
  assert.equal(settings['gameConfig.balance.xp.combatWin'], undefined);
  assert.equal(settings.reduceFlashes, undefined);
});
