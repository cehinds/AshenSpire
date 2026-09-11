import test from 'node:test';
import assert from 'node:assert/strict';
import { tooltipHelp } from '../src/content/tooltipHelp.js';
import { resolveTooltipSettings, tooltipSettingsRows, helpText } from '../src/model/tooltipSettings.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

test('sparse and invalid stored preferences use authored defaults', () => {
  const defaults = resolveTooltipSettings();
  assert.equal(defaults.open, 1000);
  assert.equal(defaults.focus, 500);
  assert.equal(defaults.hoverEnabled, true);
  assert.deepEqual(resolveTooltipSettings({ tooltipDelay: -1, tooltipCloseDelay: 'toString', hoverTooltips: 'false' }), defaults);
});
test('opening and handover share the selected delay; focus and closing are independent', () => {
  const resolved = resolveTooltipSettings({ tooltipDelay: '1.5s', tooltipCloseDelay: '0.25s', hoverTooltips: false });
  assert.deepEqual([resolved.open, resolved.handover, resolved.focus, resolved.close, resolved.hoverEnabled], [1500, 1500, 500, 250, false]);
});
test('editing authored options and defaults updates both the resolver and settings controls', () => {
  const policy = structuredClone(tooltipHelp);
  policy.delays['2s'] = 2000;
  policy.settings.find(row => row.key === 'tooltipDelay').def = '2s';
  assert.equal(resolveTooltipSettings({}, policy).open, 2000);
  assert(tooltipSettingsRows(policy).find(row => row.key === 'tooltipDelay').choices.includes('2s'));
  assert.equal(tooltipSettingsRows(policy).find(row => row.key === 'tooltipDelay').def, '2s');
});
test('help copy and live substitutions are authored separately from rendering', () => {
  assert.equal(helpText('cost', { amount: 3, card: 'Guard' }), '3 required to play Guard.');
  assert.equal(helpText('cost', { amount: 7 }, { cost: 'Spend {amount}.' }), 'Spend 7.');
  assert.throws(() => helpText('cost', {}), /Missing help value/);
  assert.throws(() => helpText('unknown'), /Unknown help message/);
});
test('preferences survive a profile save and reload', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const meta = saves.loadMeta();
  meta.settings = { ...meta.settings, hoverTooltips: false, tooltipDelay: '1s', tooltipCloseDelay: '0.25s' };
  assert.notEqual(saves.saveMeta(meta)?.ok, false);
  const restored = createSaveManager(storage).loadMeta();
  assert.equal(resolveTooltipSettings(restored.settings).open, 1000);
  assert.equal(resolveTooltipSettings(restored.settings).hoverEnabled, false);
});
