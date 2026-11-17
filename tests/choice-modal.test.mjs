import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/option-modal-dom.mjs';

function findButtons(document, label)
{
    return document.querySelectorAll('button').filter((node) => node.textContent === label);
}

function findPanel(document)
{
    return document.querySelector('section');
}

test('choice modal: the kind supplies classes, id attribute, row class, body class and an exit', async () =>
{
    const { document, restore } = installDom();

    try
    {
        const { OpenChoiceModal } = await import('../src/ui/components/choiceModal.js');
        const events = [];
        const shell = OpenChoiceModal({
            kind: 'slotChoice',
            rows: [
                { id: 'a', name: 'A' },
                { id: 'b', name: 'B', disabled: true },
            ],
            title: 'Pick',
            opener: null,
            onClosed: () => events.push('closed'),
            onCommit: (rowId) => events.push(`commit:${rowId}`),
            onCancelled: () => events.push('cancelled'),
        });
        const panel = findPanel(document);
        assert.ok(panel.classes.has('option-choice'));
        assert.ok(panel.classes.has('equip-slot-choice'));
        assert.equal(panel.dataset.modalKind, 'slotChoice');
        assert.ok(shell.body.classes.has('as-pane'), 'every choice dialog wears the same body pane');
        const rows = shell.body.querySelectorAll('[data-slot-option]');
        assert.ok(rows.every((row) => row.classes.has('equip-slot-option')));
        assert.equal(findButtons(document, 'Back').length, 1, 'one Back exit');
        const [commit] = findButtons(document, 'Choose');
        assert.equal(commit.getAttribute('data-focusable'), 'true');
        rows[0].click();
        commit.click();
        assert.deepEqual(events, ['closed', 'commit:a'], 'onClosed runs first, then the commit');
    }
    finally
    {
        restore();
    }
});

test('choice modal: Cancel runs onClosed then onCancelled, never the commit', async () =>
{
    const { document, restore } = installDom();

    try
    {
        const { OpenChoiceModal } = await import('../src/ui/components/choiceModal.js');
        const events = [];
        OpenChoiceModal({
            kind: 'cardChoice',
            title: 'Pick',
            rows: [{ id: 'a', name: 'A' }],
            opener: null,
            onClosed: () => events.push('closed'),
            onCommit: () => events.push('commit'),
            onCancelled: () => events.push('cancelled'),
        });
        document.querySelector('[data-choice]').click();
        findButtons(document, 'Cancel')[0].click();
        assert.deepEqual(events, ['closed', 'cancelled']);
    }
    finally
    {
        restore();
    }
});

test('choice modal: an empty kind with empty text shows it and keeps the commit disabled', async () =>
{
    const { document, restore } = installDom();

    try
    {
        const { OpenChoiceModal } = await import('../src/ui/components/choiceModal.js');
        const shell = OpenChoiceModal({
            kind: 'rankUpCard',
            title: 'Pick',
            rows: [],
            opener: null,
        });
        assert.equal(shell.body.querySelectorAll('[data-rank-up-card]').length, 0);
        assert.equal(shell.body.querySelectorAll('p').length, 1);
        const commit = document.querySelectorAll('button').find((node) => node.getAttribute('data-focusable') === 'true' && node.disabled);
        assert.ok(commit, 'the commit stays disabled');
    }
    finally
    {
        restore();
    }
});

test('choice modal: a selected discard can be deselected, and a pick at the limit swaps out the earliest', async () =>
{
    const { document, restore } = installDom();

    try
    {
        const { OpenChoiceModal } = await import('../src/ui/components/choiceModal.js');
        const answers = [];
        OpenChoiceModal({
            kind: 'discardChoice',
            title: 'Pick',
            rows: [
                { id: 'a', name: 'A' },
                { id: 'b', name: 'B' },
            ],
            commitLabel: 'Drop 1',
            selectionLimit: 1,
            opener: null,
            onCommit: (ids) => answers.push(ids),
        });
        const rows = document.querySelectorAll('[data-discard-id]');
        const [commit] = findButtons(document, 'Drop 1');
        rows[0].click();
        assert.equal(rows[0].getAttribute('aria-pressed'), 'true');
        rows[0].click();
        assert.equal(rows[0].getAttribute('aria-pressed'), 'false', 'a second tap deselects');
        assert.equal(commit.disabled, true, 'nothing chosen, nothing to commit');
        rows[0].click();
        rows[1].click();
        assert.equal(rows[0].getAttribute('aria-pressed'), 'false', 'the earlier pick is swapped out');
        assert.equal(rows[1].getAttribute('aria-pressed'), 'true');
        commit.click();
        assert.deepEqual(answers, [['b']]);
    }
    finally
    {
        restore();
    }
});

test('choice modal: a multi-select kind toggles up to the limit and commits the ids in pick order', async () =>
{
    const { document, restore } = installDom();

    try
    {
        const { OpenChoiceModal } = await import('../src/ui/components/choiceModal.js');
        const answers = [];
        OpenChoiceModal({
            kind: 'discardChoice',
            title: 'Pick',
            rows: [
                { id: 'a', name: 'A' },
                { id: 'b', name: 'B' },
                { id: 'c', name: 'C' },
            ],
            commitLabel: 'Drop 2',
            selectionLimit: 2,
            opener: null,
            onCommit: (ids) => answers.push(ids),
        });
        assert.equal(findButtons(document, 'Cancel').length, 0, 'the discard choice has no Cancel');
        const rows = document.querySelectorAll('[data-discard-id]');
        rows[1].click();
        rows[0].click();
        rows[2].click();
        findButtons(document, 'Drop 2')[0].click();
        assert.deepEqual(answers, [['a', 'c']], 'the third pick swaps out the earliest (b)');
    }
    finally
    {
        restore();
    }
});

// Review on #2814: the swap at the limit is the hand discard's alone (item 26); every other multi-select kind, the
// Smith keep among them, still ignores a pick past its limit.
test('choice modal: only the discard kind swaps at the limit', async () =>
{
    const { ModalModelFor } = await import('../src/ui/models/ModalModel.js');
    assert.equal(ModalModelFor('discardChoice').swapsAtLimit, true);
    assert.equal(ModalModelFor('smithKeep').swapsAtLimit, false);
    assert.equal(ModalModelFor('cardChoice').swapsAtLimit, false);
});
