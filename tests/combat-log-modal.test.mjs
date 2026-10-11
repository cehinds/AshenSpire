// tests/combat-log-modal.test.mjs — the Full log door (src/ui/components/combatLogModal.js).
//
// The door lists every public entry of the combat, grouped by round, newest
// last. Escape and its Close button dismiss it, and focus returns to the
// button that opened it. The drawer's header holds that button outside the
// scrolling list. Visibility on the drawer and real focus/touch behaviour are
// driven in a browser (tools/combat-log-touch-qa.mjs), not in this fixture.
//
//   node --test tests/combat-log-modal.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { withModalDom } from './helpers/modal-dom.mjs';
import { openCombatLogModal } from '../src/ui/components/combatLogModal.js';
import { resetModalState, modalOpen } from '../src/ui/modalState.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

const entries = [
  { id: 1, round: 1, text: 'Reaver played Guard Counter.' },
  { id: 2, round: 1, text: 'Soldier used Slash.' },
  { id: 3, round: 2, text: 'Reaver dealt 9 damage to Soldier (1 blocked).' },
  { id: 4, round: 3, text: 'Soldier fell.' },
];

function openerButton(dom) {
  const opener = dom.document.createElement('button');
  opener.setAttribute('data-combat-tool', 'full-log');
  dom.document.body.appendChild(opener);
  return opener;
}

test('the full log lists every entry, grouped by round, newest last', () => {
  withModalDom((dom) => {
    resetModalState();
    const log = openCombatLogModal({ entries, opener: openerButton(dom) });
    assert.equal(log.panel.getAttribute('aria-modal'), 'true');
    assert.equal(log.panel.getAttribute('aria-labelledby'), 'combat-log-modal-title');
    assert.ok(log.panel.className.split(/\s+/).includes('combat-log-modal'));
    assert.deepEqual([...log.panel.querySelectorAll('li')].map(row => row.textContent), entries.map(entry => entry.text));
    assert.deepEqual([...log.panel.querySelectorAll('h3')].map(heading => heading.textContent), ['Round 1', 'Round 2', 'Round 3']);
    assert.equal(modalOpen(), true);
    log.close();
  });
});

test('an empty combat says so instead of showing a blank list', () => {
  withModalDom((dom) => {
    resetModalState();
    const log = openCombatLogModal({ entries: [], opener: openerButton(dom) });
    assert.equal(log.panel.querySelectorAll('li').length, 0);
    const notes = log.panel.querySelectorAll('p');
    assert.equal(notes.length, 1, 'one empty-state line');
    assert.match(notes[0].textContent, /Actions will appear here as the round unfolds\./);
    log.close();
  });
});

test('setEntries redraws the open log with the newest entries', () => {
  withModalDom((dom) => {
    resetModalState();
    const log = openCombatLogModal({ entries: entries.slice(0, 2), opener: openerButton(dom) });
    log.setEntries(entries);
    assert.equal(log.panel.querySelectorAll('li').length, entries.length);
    log.close();
  });
});

test('Escape closes the full log and returns focus to the button that opened it', () => {
  withModalDom((dom, win) => {
    resetModalState();
    const opener = openerButton(dom);
    const log = openCombatLogModal({ entries, opener });
    win.press('Escape');
    assert.equal(log.panel.isConnected, false, 'the door is gone');
    assert.equal(modalOpen(), false);
    assert.equal(dom.document.activeElement, opener, 'focus is back on Full log');
  });
});

test('the Close button closes the full log and returns focus to the opener', () => {
  withModalDom((dom) => {
    resetModalState();
    const opener = openerButton(dom);
    const log = openCombatLogModal({ entries, opener });
    const close = [...log.panel.querySelectorAll('button')].find(node => node.textContent === 'Close');
    assert.ok(close, 'a footer Close button');
    close.click();
    assert.equal(log.panel.isConnected, false);
    assert.equal(dom.document.activeElement, opener);
  });
});

test('the Full log button is in the drawer header, outside the scrolling entries', () => {
  const source = read('src/ui/components/combatTools.js');
  assert.match(source, /head\.append\(title, fullLog\)/);
  assert.match(source, /panel\.append\(head, list\)/);
  assert.doesNotMatch(source, /list\.append\([^)]*fullLog/);
});
