// tests/settings-regroup.test.mjs — the settings regroup (owner, 2026-11-20).
// Combat: the five millisecond dials sit behind a collapsed "More" toggle, and Range left for Advanced.
import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryHtml, generalGroups, SettingsMoreOpen } from '../src/ui/screens/settings.js';

const MORE_KEYS = ['combatStepPause', 'animationStepDuration', 'enemyAttackMs', 'enemyFloaterIntervalMs', 'combatPacingPreset'];
const rowKeys = (html) => [...html.matchAll(/data-row-key="([^"]+)"/g)].map((m) => m[1]);

test('Combat shows the five millisecond dials only inside a collapsed More toggle', () => {
  const html = categoryHtml('General', { settingsGeneralCategory: 'Combat' }, null);
  const more = html.match(/<details class="set-more" data-more-topic="autoCombat">([\s\S]*?)<\/details>/);
  assert.ok(more, 'the More toggle is drawn, collapsed (no open attribute)');
  assert.deepEqual(rowKeys(more[1]), MORE_KEYS, 'it holds exactly the five dials');
  const outside = rowKeys(html.replace(more[0], ''));
  for (const key of MORE_KEYS) assert.ok(!outside.includes(key), `${key} is not drawn outside More`);
  assert.ok(outside.includes('animSpeed') && outside.includes('autoCombat'), 'the player-facing pacing rows stay in view');
});

test('the More toggle opens where this device left it open, and storage failure reads as closed', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map([['ashenspire.settings.more.autoCombat', '1']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } });
  try {
    assert.equal(SettingsMoreOpen('autoCombat'), true);
    assert.match(categoryHtml('General', { settingsGeneralCategory: 'Combat' }, null), /<details class="set-more" data-more-topic="autoCombat" open>/);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.equal(SettingsMoreOpen('autoCombat'), false);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage;
  }
});

test('Combat has no Range topic; Range is an Advanced group', () => {
  const topics = [...generalGroups('Combat').values()].flat().map((row) => row.key);
  assert.ok(!topics.some((key) => key.startsWith('range')), 'no Range row is left in Combat');
});

test('Advanced: Map and Developer are groups; release builds keep Map, never Range or Developer', async () => {
  const { visibleAdvancedGroups, RELEASE_ADVANCED_GROUP_IDS, categoryHandler } = await import('../src/ui/screens/settings.js');
  const { advancedSection } = await import('../src/ui/models/AdvancedSettingsGroups.js');
  const debug = visibleAdvancedGroups(true).map((group) => group.id);
  for (const id of ['Map', 'Range', 'Developer']) assert.ok(debug.includes(id), id);
  assert.ok(!debug.includes('Wireframes'), 'Wireframes folded into Developer');
  assert.deepEqual(visibleAdvancedGroups(false).map((group) => group.id), [...RELEASE_ADVANCED_GROUP_IDS]);
  assert.ok(!RELEASE_ADVANCED_GROUP_IDS.includes('Developer') && !RELEASE_ADVANCED_GROUP_IDS.includes('Range'), 'Range is dev and test only (owner, 2026-11-20)');
  const rows = categoryHandler('Advanced').rows;
  const section = (key) => advancedSection(rows.find((row) => row.key === key));
  for (const key of ['walkedFade', 'mapFreePan', 'mapHeaderDensity', 'mapHeaderRelics']) assert.equal(section(key), 'Map', key);
  for (const key of ['cardWidth_glance', 'cardSizeExport', 'wireframeModalWidth', 'creationAutoAdvance', 'uprightGate']) assert.equal(section(key), 'Developer', key);
  const { settingsRows } = await import('../src/ui/screens/settings.js');
  assert.equal(settingsRows().find((row) => row.key === 'ambient').advancedGroup, 'Interface', 'Ambient stays (owner declined the move)');
});

test('a group modal button summarises its rows, and search still finds a row inside it', async () => {
  const { SettingsGroupButtonRow, SettingsGroupRows, settingsSearchHits } = await import('../src/ui/screens/settings.js');
  const button = SettingsGroupButtonRow('wireframes');
  assert.equal(SettingsGroupRows('wireframes').length, 6);
  assert.equal(button.btn({}), 'All default');
  const [first] = SettingsGroupRows('wireframes');
  const other = first.choices.find((choice) => choice !== first.def);
  assert.equal(button.btn({ [first.key]: other }), '1 changed');
  const hit = settingsSearchHits(String(first.label), true, {}).find((entry) => entry.row.key === first.key);
  assert.ok(hit, 'search reaches the row behind the button');
  assert.equal(hit.where, 'Developer › Wireframes', 'filed as group › window');
});

test('Text, Interface, Card sizes and Export each open their own window; search files their rows as group › window', async () => {
  const { categoryHandler, AdvancedTopicRowsHtml, SettingsGroupRows, SettingsGroupModalHtml, SettingsGroupButtonRow, settingsSearchHits } = await import('../src/ui/screens/settings.js');
  const { advancedSubgroups } = await import('../src/ui/models/AdvancedSettingsGroups.js');
  const rows = categoryHandler('Advanced').rows;
  const cases = [['Text', 'text', 6], ['Interface', 'interface', 7], ['Export', 'export', 6], ['Developer', 'cardSize', 5]];
  for (const [section, id, count] of cases) {
    const windowRows = SettingsGroupRows(id);
    assert.equal(windowRows.length, count, `${id} holds ${count} rows`);
    const panel = advancedSubgroups(rows, section).map((sub) => AdvancedTopicRowsHtml({}, sub.rows, section, sub.id)).join('');
    assert.equal(panel.split(`data-btn="groupModal.${id}"`).length - 1, 1, `${section} draws one ${id} button`);
    for (const row of windowRows) assert.ok(!panel.includes(`data-row-key="${row.key}"`), `${row.key} is drawn only in its window`);
    const body = SettingsGroupModalHtml({}, id);
    for (const row of windowRows) assert.ok(body.includes(`data-row-key="${row.key}"`), `${row.key} is in the ${id} window`);
    assert.equal(SettingsGroupButtonRow(id).btn({}), 'All default');
    const probe = windowRows.find((row) => !row.modal);
    const hit = settingsSearchHits(String(probe.label), true, {}).find((entry) => entry.row.key === probe.key && !entry.where.startsWith('General'));
    assert.ok(hit, `search reaches ${probe.key}`);
    assert.equal(hit.where.split(' › ').length, 2, `${hit.where} is group › window`);
  }
  // Card sizes: number fields, so the window draws their steppers.
  assert.match(SettingsGroupModalHtml({}, 'cardSize'), /num-wrap/);
});
