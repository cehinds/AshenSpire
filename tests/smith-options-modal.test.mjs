// tests/smith-options-modal.test.mjs — the Blacksmith's option dialogs use the reaction modal's design (owner,
// 2026-11-14): rows from optionRowList, a Cancel exit and ONE primary button that stays disabled until a row is
// selected. A tap selects and never commits; the primary commits the selected option id as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/option-modal-dom.mjs';

const buttons = (document, label) => document.querySelectorAll('button').filter((node) => node.textContent === label);

test('smith options: rows, primary disabled until a row is selected, commit passes the id', async () => {
  const { document, restore } = installDom();
  try {
    const { OpenSmithOptionsModal } = await import('../src/ui/components/smithOptionsModal.js');
    const chosen = [];
    const shell = OpenSmithOptionsModal({ title: 'Sharpen', price: '3 stones', opener: null, onChoose: (id) => chosen.push(id),
      options: [{ id: 'a', name: 'Keen', text: '+1 damage' }, { id: 'b', name: 'Heavy', text: '+2 weight', disabled: true }, { id: 'c', name: 'Light', text: '-1 weight' }] });
    const rows = shell.body.querySelectorAll('[data-smith-option]');
    assert.deepEqual(rows.map((row) => row.getAttribute('data-smith-option')), ['a', 'b', 'c']);
    assert.ok(rows.every((row) => row.classes.has('option-row')), 'rows come from optionRowList');
    assert.ok(rows[0].parentNode.classes.has('option-row-list'));
    assert.equal(rows[1].disabled, true, 'a disabled option stays a disabled row');
    assert.equal(rows[0].querySelector('.option-row-name').textContent, 'Keen');
    assert.equal(rows[0].querySelector('.co-effect').textContent, '+1 damage');
    const [commit] = buttons(document, 'Choose');
    assert.equal(commit.disabled, true, 'nothing selected yet');
    rows[0].click();
    assert.deepEqual(chosen, [], 'a tap selects and never commits');
    assert.equal(rows[0].getAttribute('aria-pressed'), 'true');
    assert.equal(commit.disabled, false);
    rows[2].click();
    assert.deepEqual(rows.map((row) => row.getAttribute('aria-pressed')), ['false', 'false', 'true']);
    commit.click();
    assert.deepEqual(chosen, ['c']);
  } finally { restore(); }
});

test('smith options: Cancel commits nothing even with a row selected', async () => {
  const { document, restore } = installDom();
  try {
    const { OpenSmithOptionsModal } = await import('../src/ui/components/smithOptionsModal.js');
    const chosen = [];
    const shell = OpenSmithOptionsModal({ title: 'Sharpen', opener: null, onChoose: (id) => chosen.push(id), options: [{ id: 'a', name: 'Keen' }] });
    shell.body.querySelector('[data-smith-option]').click();
    buttons(document, 'Cancel')[0].click();
    assert.deepEqual(chosen, []);
  } finally { restore(); }
});

test('smith keep: rows toggle up to the limit, the quote gates the primary, confirm passes the kept keys', async () => {
  const { document, restore } = installDom();
  try {
    const { OpenSmithKeepModal } = await import('../src/ui/components/smithOptionsModal.js');
    const confirmed = [];
    const quoteFor = (keys) => ({ ok: keys.length > 0, reason: 'Keep at least one.', newProperties: [{ text: `new ${keys.length}` }] });
    const shell = OpenSmithKeepModal({ title: 'Reforge', price: '5 stones', limit: 2, opener: null, onConfirm: (keys) => confirmed.push(keys), quoteFor,
      rows: [{ key: 'p1', text: 'Keen' }, { key: 'p2', text: 'Heavy' }, { key: 'p3', text: 'Light' }] });
    const rows = shell.body.querySelectorAll('[data-smith-keep]');
    assert.ok(rows.every((row) => row.classes.has('option-row')), 'rows come from optionRowList');
    const [confirm] = buttons(document, 'Reforge');
    assert.ok(confirm, 'one primary Reforge button');
    assert.deepEqual(rows.map((row) => row.getAttribute('aria-pressed')), ['true', 'false', 'false'], 'the first property starts kept');
    rows[0].click();
    assert.equal(confirm.disabled, true, 'nothing kept: the primary is disabled');
    rows[1].click(); rows[2].click(); rows[0].click();
    assert.deepEqual(rows.map((row) => row.getAttribute('aria-pressed')), ['false', 'true', 'true'], 'the limit holds: the third pick over 2 is ignored');
    assert.equal(confirm.disabled, false);
    confirm.click();
    assert.deepEqual(confirmed, [['p2', 'p3']]);
  } finally { restore(); }
});
