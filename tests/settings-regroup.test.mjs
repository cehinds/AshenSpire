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
