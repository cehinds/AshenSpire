import assert from 'node:assert/strict';
import test from 'node:test';
import { combatLogPalette, COMBAT_LOG_PALETTE_DEFAULTS, hasCombatLogColorContrast } from '../src/ui/models/CombatLogPaletteModel.js';
import { openCombatLogModal } from '../src/ui/components/combatLogModal.js';
import { resetModalState } from '../src/ui/modalState.js';
import { withModalDom } from './helpers/modal-dom.mjs';
import { settingsSearchHits, allResettableKeys, settingsRows } from '../src/ui/screens/settings.js';

test('log actor segments render as escaped text with player and enemy roles', () => {
  withModalDom((dom) => {
    resetModalState();
    const text = '<b>Reaver</b> hit <img src=x onerror=alert(1)>. unseen';
    const log = openCombatLogModal({ opener: dom.document.body, entries: [{
      id: 1, round: 1, text,
      segments: [
        { text: '<b>' }, { id: 'p1', text: 'Reaver', side: 'player' }, { text: '</b> hit ' },
        { id: 'e1', text: '<img src=x onerror=alert(1)>', side: 'enemy' }, { text: '.' },
        { id: 'unknown', text: ' unseen', side: 'other' },
      ],
    }] });
    const row = log.panel.querySelector('li');
    assert.equal([...row.children].map(node => node.textContent).join(''), text);
    assert.equal(row.querySelectorAll('img').length, 0, 'names enter the DOM through text, never markup');
    assert.deepEqual([...row.querySelectorAll('.combat-log-actor')].map(node => node.getAttribute('data-combat-log-side')),
      ['player', 'enemy']);
    assert.deepEqual([...log.panel.querySelectorAll('.combat-log-role')].map(node => node.children.at(-1).textContent), ['Player', 'Enemy']);
    assert.equal(log.panel.querySelector('.combat-log-modal-entries').getAttribute('style'),
      `--combat-log-player-color:${COMBAT_LOG_PALETTE_DEFAULTS.player};--combat-log-enemy-color:${COMBAT_LOG_PALETTE_DEFAULTS.enemy}`);
    log.close();
  });
});

test('custom palette keeps readable hex colors and falls back for invalid or low-contrast values', () => {
  assert.equal(hasCombatLogColorContrast('#73bdff'), true);
  assert.equal(hasCombatLogColorContrast('#111111'), false);
  assert.deepEqual(combatLogPalette({ combatLogPlayerColor: '#73bdff', combatLogEnemyColor: '#ffaaa0' }),
    { player: '#73bdff', enemy: '#ffaaa0' });
  assert.deepEqual(combatLogPalette({ combatLogPlayerColor: '#111111', combatLogEnemyColor: 'red' }),
    COMBAT_LOG_PALETTE_DEFAULTS);
});

test('player and enemy colors are ordinary resettable settings', () => {
  const rows = settingsRows();
  for (const [key, role, color] of [
    ['combatLogPlayerColor', 'Player', COMBAT_LOG_PALETTE_DEFAULTS.player],
    ['combatLogEnemyColor', 'Enemy', COMBAT_LOG_PALETTE_DEFAULTS.enemy],
  ]) {
    const row = rows.find(candidate => candidate.key === key);
    assert.ok(row, `${role} palette setting is present`);
    assert.equal(row.type, 'color');
    assert.equal(row.def, color);
    assert.ok(allResettableKeys().includes(key), `${role} palette setting follows standard settings persistence and reset`);
  }
});

test('Console is an ordinary Combat toggle available with developer tools off', () => {
  const row = settingsRows().find(row => row.key === 'combatLogConsole');
  assert.equal(row.cat, 'Combat'); assert.equal(row.type, 'toggle'); assert.equal(row.def, false);
  assert.equal(row.debugTopic, undefined);
  assert.ok(allResettableKeys().includes(row.key));
  assert.ok(settingsSearchHits('Console button', false, {}).some(hit => hit.row.key === row.key));
});
