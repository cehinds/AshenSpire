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
import { withModalDom } from './helpers/dom.mjs';
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

test('setOpener moves focus return to the button that replaced the opener', () => {
  withModalDom((dom) => {
    resetModalState();
    const first = openerButton(dom);
    const log = openCombatLogModal({ entries, opener: first });
    const second = dom.document.createElement('button');
    dom.document.body.appendChild(second);
    log.setOpener(second);
    log.close();
    assert.equal(dom.document.activeElement, second, 'focus lands on the new Full log button');
    assert.notEqual(dom.document.activeElement, first);
  });
});

test('touching the full log never skips the attack playing underneath it', () => {
  withModalDom((dom) => {
    resetModalState();
    const log = openCombatLogModal({ entries, opener: openerButton(dom) });
    // fx.js playTimeline ignores pointer presses under [data-combat-read-only].
    assert.ok(log.panel.closest('[data-combat-read-only]'), 'the modal is inside a combat-read-only subtree');
    log.close();
  });
});

test('full detail shows shared damage receipts and can return to compact reading', () => {
  withModalDom(dom => {
    resetModalState();
    const receipt = { version: 1, hits: [{incoming:20,hpLoss:15,poiseReduced:5,sources:[{id:'armor',label:'Iron Cuirass',amount:3}]}],totalDamage:15 };
    const log = openCombatLogModal({entries:[{id:1,round:1,text:'Strike hit.',damageReceipt:receipt}],opener:openerButton(dom)});
    assert.match(log.panel.querySelector('.combat-log-calculation').textContent,/Iron Cuirass: \+3/);
    assert.match(log.panel.querySelector('.combat-log-calculation').textContent,/Poise absorbed 5/);
    [...log.panel.querySelectorAll('button')].find(node=>node.textContent==='Compact log').click();
    assert.equal(log.panel.querySelector('.combat-log-calculation'),null);
    [...log.panel.querySelectorAll('button')].find(node=>node.textContent==='Full detail').click();
    assert.ok(log.panel.querySelector('.combat-log-calculation'));
    log.close();
  });
});

test('full detail itemises a roll under its row; compact reading hides it', () => {
  withModalDom(dom => {
    resetModalState();
    const rollReceipt = { kind: 'accuracy', die: 'd20', dice: [14], mode: 'normal', success: true,
      parts: [{ label: 'Precision', value: 4, note: 'mix 2 + stacks 2' }], total: 18, dcParts: [{ label: 'Evasion', value: 9 }], dc: 9 };
    const log = openCombatLogModal({ entries: [{ id: 1, round: 1, text: 'Strike: 18 vs 9 · hit', rollReceipt }], opener: openerButton(dom) });
    assert.match(log.panel.querySelector('.combat-log-roll').textContent, /d20 \[14\]\n\+ Precision 4 \(mix 2 \+ stacks 2\)\n= 18\nvs Evasion 9\nlands/);
    [...log.panel.querySelectorAll('button')].find(node => node.textContent === 'Compact log').click();
    assert.equal(log.panel.querySelector('.combat-log-roll'), null);
    log.close();
  });
});

function withClipboard(clipboard, run) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } });
  try { return run(); }
  finally {
    if (saved) Object.defineProperty(globalThis, 'navigator', saved);
    else delete globalThis.navigator;
  }
}

test('Copy uses the latest entries, round headings and the selected level of detail', async () => {
  const copied = [], pending = [];
  const damageReceipt = { version: 1, hits: [{incoming:20,hpLoss:15,poiseReduced:5,sources:[{id:'armor',label:'Iron Cuirass',amount:3}]}],totalDamage:15 };
  const rollReceipt = { kind: 'accuracy', die: 'd20', dice: [14], mode: 'normal', success: true,
    parts: [{ label: 'Precision', value: 4 }], total: 18, dcParts: [{ label: 'Evasion', value: 9 }], dc: 9 };
  const latest = [entries[0], { id: 2, round: 2, text: 'old text', segments: [{text:'Reaver '},{text:'hit Soldier.'}], damageReceipt, rollReceipt }];
  withClipboard({ writeText(text) { copied.push(text); return Promise.resolve(); } }, () => {
    withModalDom(dom => {
      for (const detailed of [true, false]) {
        resetModalState();
        const log = openCombatLogModal({ entries, opener: openerButton(dom), detailed });
        log.setEntries(latest);
        const copy = log.panel.querySelector('[data-combat-log-copy]');
        pending.push(copy.listeners.get('click')[0]());
        assert.equal(copy.disabled, true, 'copy cannot be submitted twice while pending');
        log.close();
      }
    });
  });
  await Promise.all(pending);
  assert.match(copied[0], /^Round 1\nReaver played Guard Counter\.\n\nRound 2\nReaver hit Soldier\./);
  assert.match(copied[0], /Iron Cuirass: \+3/);
  assert.match(copied[0], /d20 \[14\]/);
  assert.equal(copied[1], 'Round 1\nReaver played Guard Counter.\n\nRound 2\nReaver hit Soldier.');
});

test('blocked clipboard access selects the log for manual copy without claiming success', async () => {
  let pending;
  const savedSelection = globalThis.getSelection;
  withClipboard(undefined, () => withModalDom(dom => {
    resetModalState();
    let selected = null, cleared = false;
    const range = { selectNodeContents(node) { selected = node; } };
    dom.document.createRange = () => range;
    globalThis.getSelection = () => ({ removeAllRanges() { cleared = true; }, addRange(value) { assert.equal(value, range); } });
    try {
      const log = openCombatLogModal({ entries, opener: openerButton(dom) });
      const copy = log.panel.querySelector('[data-combat-log-copy]');
      pending = copy.listeners.get('click')[0]();
      assert.equal(selected, log.panel.querySelector('.combat-log-modal-entries'));
      assert.equal(cleared, true);
      assert.equal(copy.textContent, 'Text selected');
      assert.equal(copy.disabled, false);
      log.close();
    } finally {
      if (savedSelection === undefined) delete globalThis.getSelection;
      else globalThis.getSelection = savedSelection;
    }
  }));
  await pending;
});

test('a clipboard result after closing leaves the closed button untouched', async () => {
  let resolveCopy, pending, copy;
  withClipboard({ writeText() { return new Promise(resolve => { resolveCopy = resolve; }); } }, () => withModalDom(dom => {
    resetModalState();
    const log = openCombatLogModal({ entries, opener: openerButton(dom) });
    copy = log.panel.querySelector('[data-combat-log-copy]');
    pending = copy.listeners.get('click')[0]();
    log.close();
  }));
  resolveCopy();
  await pending;
  assert.equal(copy.textContent, 'Copy');
});

test('footer action counts include Copy with and without the optional console', () => {
  withModalDom(dom => {
    resetModalState();
    const log = openCombatLogModal({ entries, opener: openerButton(dom) });
    const actions = log.panel.querySelector('.modal-foot-actions');
    assert.equal(actions.dataset.actionCount, '3');
    log.setConsoleEnabled(true);
    assert.equal(actions.dataset.actionCount, '4');
    log.setConsoleEnabled(false);
    assert.equal(actions.dataset.actionCount, '3');
    log.close();
  });
});
