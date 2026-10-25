import test from 'node:test';
import assert from 'node:assert/strict';
import { withModalDom } from './helpers/modal-dom.mjs';
import { resetModalState } from '../src/ui/modalState.js';
import { consoleRecorder } from '../src/ui/consoleLog.js';
import { dlog, openConsoleLog, registerConsoleSnapshot } from '../src/ui/debuglog.js';
import { settingsRows } from '../src/ui/screens/settings.js';
import { mountCombatTools, closeCombatFullLog } from '../src/ui/components/combatTools.js';
import { mountCombatDebugButton } from '../src/ui/components/combatDebugButton.js';
import { combatToolsModel } from '../src/ui/models/CombatToolsModel.js';

function withDom(fn) {
  return withModalDom((dom, win) => {
    const saved = { ResizeObserver: globalThis.ResizeObserver, MutationObserver: globalThis.MutationObserver, innerHeight: globalThis.innerHeight };
    globalThis.ResizeObserver = class { observe() {} disconnect() {} };
    globalThis.MutationObserver = class { observe() {} disconnect() {} };
    globalThis.innerHeight = 800;
    try { return fn(dom, win); } finally {
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    }
  });
}

test('dlog lines are mirrored into the session console as debug entries', () => {
  dlog('ignored', 'enemy tap e1', 'dead target');
  dlog('input', 'plain');
  const texts = consoleRecorder.getEntries().map(e => JSON.stringify(e));
  assert.ok(texts.some(t => t.includes('[ignored] enemy tap e1 dead target') && t.includes('debug')));
  assert.ok(texts.some(t => t.includes('[input] plain')));
});

test('the snapshot line is recorded when the console opens, and a failing snapshot cannot block it', () => {
  registerConsoleSnapshot(() => 'combat input: phase=player');
  openConsoleLog();
  assert.ok(consoleRecorder.getEntries().some(e => JSON.stringify(e).includes('[snapshot] combat input: phase=player')));
  registerConsoleSnapshot(() => { throw new Error('boom'); });
  assert.doesNotThrow(() => openConsoleLog());
  registerConsoleSnapshot(null);
});

test('the debugMode row exists, defaults off and sits in the Diagnostics group', () => {
  const row = settingsRows().find(r => r.key === 'debugMode');
  assert.ok(row);
  assert.equal(row.def, false);
  assert.equal(row.cat, 'Advanced');
  assert.equal(row.debugTopic, true);
  assert.match(row.note, /Console button during combat/);
});

test('debugMode shows the combat log Console button without combatLogConsole', () => {
  withDom(dom => {
    resetModalState();
    const combatEl = dom.document.createElement('section'); dom.document.body.appendChild(combatEl);
    const state = { open: false, size: 'Medium', followLatest: true };
    let settings = {}, tools;
    const paint = () => tools.update(combatToolsModel({ supported: true, enabled: true, entries: [], ...state }));
    tools = mountCombatTools(combatEl, { state, readSettings: () => settings, onViewChange: paint, onToggle() {} }); paint();
    combatEl.querySelector('[data-combat-tool="log"]').click();
    const shortcut = state.drawerLog.panel.querySelector('[data-console-shortcut]');
    assert.equal(shortcut.hidden, true);
    settings = { combatLogConsole: false, debugMode: true }; paint(); assert.equal(shortcut.hidden, false);
    settings = {}; paint(); assert.equal(shortcut.hidden, true);
    closeCombatFullLog(state); tools.release();
  });
});

test('the in-combat Console button renders only while debugMode is on', () => {
  withDom(dom => {
    const combatEl = dom.document.createElement('section'); dom.document.body.appendChild(combatEl);
    let settings = {};
    const button = mountCombatDebugButton(combatEl, { readSettings: () => settings });
    assert.equal(combatEl.querySelector('[data-combat-debug="console"]'), null);
    assert.equal(combatEl.children.length, 0, 'no node when off');
    settings = { debugMode: true }; button.sync();
    assert.ok(combatEl.querySelector('[data-combat-debug="console"]'));
    button.sync(); assert.equal(combatEl.querySelectorAll('[data-combat-debug]').length, 1);
    settings = { debugMode: false }; button.sync();
    assert.equal(combatEl.querySelector('[data-combat-debug]'), null);
  });
});

test('ERROR dlog lines are not mirrored, since the window handlers append errors themselves', () => {
  const before = consoleRecorder.getEntries().length;
  dlog('ERROR', 'boom-unique-7f', 'trace');
  assert.ok(!consoleRecorder.getEntries().slice(before).some(e => JSON.stringify(e).includes('boom-unique-7f')));
});

test('a stale combat releasing its snapshot reader does not clear its successor', () => {
  const releaseOld = registerConsoleSnapshot(() => 'old-combat');
  const releaseNew = registerConsoleSnapshot(() => 'new-combat-9c');
  releaseOld();
  openConsoleLog();
  assert.ok(consoleRecorder.getEntries().some(e => JSON.stringify(e).includes('[snapshot] new-combat-9c')));
  releaseNew();
  const before = consoleRecorder.getEntries().length;
  openConsoleLog();
  assert.ok(!consoleRecorder.getEntries().slice(before).some(e => JSON.stringify(e).includes('[snapshot]')));
});
