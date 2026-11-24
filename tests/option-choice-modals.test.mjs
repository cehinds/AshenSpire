// tests/option-choice-modals.test.mjs — the card choice (stance), the discard choice and the armoury slot choice
// use the reaction modal's design (owner, 2026-11-14): optionRowList rows, an exit and ONE primary commit button that
// stays disabled until a selection; a tap selects and never commits; the commit passes the selected id(s) as before.
// The armoury slot choice is the exception (docs/ARMOURY-LAYOUT-BRIEF.md, Armaments List): a slot press goes straight
// on to the equip confirmation, with no separate Choose button, so only that later Confirm changes the loadout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/option-modal-dom.mjs';

const buttons = (document, label) => document.querySelectorAll('button').filter((node) => node.textContent === label);

test('card choice: rows, Choose disabled until a row is selected, the active stance is a disabled row', async () => {
  const { document, restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const chosen = [];
    const shell = openCardChoiceModal({ cardName: 'Warrior\'s Vow', opener: null, onChoose: (id) => chosen.push(id),
      plan: { kind: 'stance', options: [{ id: 'bear', name: 'Bear', tooltip: 'Block more' }, { id: 'wolf', name: 'Wolf', tooltip: 'Hit more', active: true }, { id: 'hawk', name: 'Hawk', tooltip: 'See more' }] } });
    const rows = shell.body.querySelectorAll('[data-choice]');
    assert.deepEqual(rows.map((row) => row.getAttribute('data-choice')), ['bear', 'wolf', 'hawk']);
    assert.ok(rows.every((row) => row.classes.has('option-row')));
    assert.equal(rows[1].disabled, true);
    assert.equal(rows[0].querySelector('.co-effect').textContent, 'Block more');
    const [commit] = buttons(document, 'Choose');
    assert.equal(commit.disabled, true);
    rows[2].click();
    assert.deepEqual(chosen, [], 'a tap selects only');
    assert.equal(commit.disabled, false);
    commit.click();
    assert.deepEqual(chosen, ['hawk']);
  } finally { restore(); }
});

test('card choice: Cancel plays nothing', async () => {
  const { document, restore } = installDom();
  try {
    const { openCardChoiceModal } = await import('../src/ui/components/cardChoiceModal.js');
    const chosen = [];
    const shell = openCardChoiceModal({ cardName: 'Vow', opener: null, onChoose: (id) => chosen.push(id), plan: { kind: 'stance', options: [{ id: 'bear', name: 'Bear' }] } });
    shell.body.querySelector('[data-choice]').click();
    buttons(document, 'Cancel')[0].click();
    assert.deepEqual(chosen, []);
  } finally { restore(); }
});

test('discard choice: rows toggle up to the count, the primary enables at exactly the count and passes the ids', async () => {
  const { document, restore } = installDom();
  try {
    const { openDiscardChoiceModal } = await import('../src/ui/components/discardChoiceModal.js');
    const answers = [];
    const shell = openDiscardChoiceModal({ count: 2, cardName: 'Sift', ordered: true, onChoose: (ids) => answers.push(ids),
      cards: [{ instanceId: 'c1', name: 'Strike' }, { instanceId: 'c2', name: 'Guard' }, { instanceId: 'c3', name: 'Dodge' }] });
    const rows = shell.body.querySelectorAll('[data-discard-id]');
    assert.ok(rows.every((row) => row.classes.has('option-row')), 'rows come from optionRowList');
    const [commit] = buttons(document, 'Discard 2');
    assert.equal(commit.disabled, true);
    rows[2].click();
    assert.equal(commit.disabled, true, 'one of two is not enough');
    rows[0].click(); rows[1].click();
    assert.deepEqual(rows.map((row) => row.getAttribute('aria-pressed')), ['true', 'true', 'false'], 'a third pick over the count swaps out the earliest');
    assert.equal(commit.disabled, false);
    assert.deepEqual(rows[1].querySelectorAll('.co-order').map((node) => node.textContent), ['2'], 'an ordered pick shows its position');
    commit.click();
    assert.deepEqual(answers, [['c1', 'c2']]);
  } finally { restore(); }
});

test('discard choice: a count of 0 opens with the primary disabled until a row is tapped', async () => {
  const { document, restore } = installDom();
  try {
    const { openDiscardChoiceModal } = await import('../src/ui/components/discardChoiceModal.js');
    const shell = openDiscardChoiceModal({ count: 0, onChoose: () => {}, cards: [{ instanceId: 'c1', name: 'Strike' }] });
    const [commit] = buttons(document, 'Discard 0');
    assert.equal(commit.disabled, true, 'starts disabled, as before the shared choice modal');
    shell.body.querySelectorAll('[data-discard-id]')[0].click();
    assert.equal(commit.disabled, false, 'a tap with nothing to pick enables it');
  } finally { restore(); }
});

test('slot choice: rows, a locked position is a disabled row, a press passes the slot on after closing, with no Choose', async () => {
  const { document, restore } = installDom();
  try {
    const { OpenSlotChoiceModal } = await import('../src/ui/components/armouryEquipModals.js');
    const chosen = [];
    let backs = 0;
    const shell = OpenSlotChoiceModal({ opener: null, onChoose: (id) => chosen.push(id), onBack: () => backs++,
      options: [{ id: 'main:0', label: 'Main hand · 1', sub: 'Active · Empty' }, { id: 'main:1', label: 'Main hand · 2', sub: 'Reserve', disabled: true, hint: 'Unlocks at 3' }, { id: 'off:0', label: 'Off hand · 1', sub: 'Active · Empty' }] });
    const rows = shell.body.querySelectorAll('[data-slot-option]');
    assert.ok(rows.every((row) => row.classes.has('option-row')));
    assert.ok(rows.every((row) => row.classes.has('equip-slot-option')));
    assert.equal(rows[1].disabled, true);
    assert.equal(rows[1].querySelector('.co-effect').textContent, 'Unlocks at 3');
    assert.deepEqual(buttons(document, 'Choose'), [], 'no separate Choose button');
    assert.equal(buttons(document, 'Back').length, 1, 'one Back exit');
    rows[2].click();
    assert.deepEqual(chosen, ['off:0'], 'the press passes the slot on to the equip confirmation');
    assert.equal(backs, 0, 'a press is not a dismissal');
    rows[0].click();
    assert.deepEqual(chosen, ['off:0'], 'a second press after closing passes nothing');
  } finally { restore(); }
});
