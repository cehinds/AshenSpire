import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiConfig } from '../src/config/generated/ui.js';
import {
    ResolveModalConfig,
    ModalModelFor,
    ModalModel,
    ChoiceModalModel,
    RewardModalModel,
    OptionChoiceModalModel,
} from '../src/ui/models/ModalModel.js';

const KINDS = uiConfig.components.modal.components;

function fakePanel()
{
    const props = {};
    return {
        dataset: {},
        props,
        style: { setProperty: (name, value) => { props[name] = value; } },
    };
}

test('every kind resolves and reaches base', () =>
{
    for (const kind of Object.keys(KINDS))
    {
        const config = ResolveModalConfig(kind);
        assert.equal(config.extends, undefined, kind);
        assert.equal(config.panelInsetRem, KINDS.base.panelInsetRem, kind);
    }
});

test('merge order is base, then parent, then child', () =>
{
    const table = {
        base: { aRem: 1, bRem: 1, cRem: 1 },
        mid: { extends: 'base', bRem: 2, cRem: 2 },
        leaf: { extends: 'mid', cRem: 3 },
    };
    assert.deepEqual(ResolveModalConfig('leaf', table), { aRem: 1, bRem: 2, cRem: 3 });
});

test('a child override does not leak to its siblings', () =>
{
    const table = {
        base: { gapPx: 4 },
        choice: { extends: 'base', showNameButton: true },
        reward: { extends: 'choice', showNameButton: false, gapPx: 2 },
        compare: { extends: 'choice' },
    };
    assert.equal(ModalModelFor('reward', table).showNameButton, false);
    assert.equal(ModalModelFor('compare', table).showNameButton, true);
    assert.equal(ResolveModalConfig('compare', table).gapPx, 4);
});

test('refuses an unknown kind, an unknown parent, a cycle and a root other than base', () =>
{
    assert.throws(() => ResolveModalConfig('nope'), /unknown modal kind "nope"/);
    assert.throws(() => ResolveModalConfig('a', { base: {}, a: { extends: 'ghost' } }), /unknown parent "ghost"/);
    assert.throws(() => ResolveModalConfig('a', { base: {}, a: { extends: 'b' }, b: { extends: 'a' } }), /cycle/);
    assert.throws(() => ResolveModalConfig('a', { base: {}, a: {} }), /does not extend "base"/);
});

test('cssProperties carries the unit and drops it from the name', () =>
{
    const model = new ModalModel('x', { gridGapPx: 12, optionGapRem: 0.6, showNameButton: true, label: 'n' });
    assert.deepEqual(model.cssProperties(), { '--modal-grid-gap': '12px', '--modal-option-gap': '0.6rem' });
});

test('defaults match the CSS literals they replace', () =>
{
    const choice = ModalModelFor('compare').cssProperties();
    assert.equal(choice['--modal-panel-inset'], '1.4rem');
    assert.equal(choice['--modal-panel-inset-phone'], '1rem');
    assert.equal(choice['--modal-grid-gap'], '12px');
    assert.equal(choice['--modal-grid-gap-phone'], '8px');
    assert.equal(choice['--modal-option-gap'], '0.6rem');
    assert.equal(choice['--modal-option-gap-phone'], '0.4rem');
    assert.equal(choice['--modal-name-button-basis'], '3.5rem');
    // The reward door halves the gap between cards and trims the room between rows (playtest 2026-11-17 item 45); the
    // room above keeps the choice grid's 64 px lane, where the chosen card's (i) stands (owner, 2026-11-20).
    const reward = ModalModelFor('reward').cssProperties();
    assert.equal(reward['--modal-grid-gap'], '6px');
    assert.equal(reward['--modal-grid-gap-phone'], '4px');
    assert.equal(reward['--modal-grid-pad-top'], '64px');
    assert.equal(reward['--modal-grid-row-gap'], '24px');
});

test('the class follows the nearest ancestor with one', () =>
{
    assert.ok(ModalModelFor('reward') instanceof RewardModalModel);
    assert.ok(ModalModelFor('cardUpgrade') instanceof ChoiceModalModel);
    assert.ok(!(ModalModelFor('cardUpgrade') instanceof RewardModalModel));
    assert.ok(!(ModalModelFor('confirm') instanceof ChoiceModalModel));
    assert.ok(ModalModelFor() instanceof ModalModel);
});

test('apply tags the panel and sets the properties', () =>
{
    const panel = fakePanel();
    ModalModelFor('reward').apply(panel);
    assert.equal(panel.dataset.modalKind, 'reward');
    assert.equal(panel.dataset.nameButton, 'hidden', 'the reward door has no name button (playtest 2026-11-17 item 43)');
    assert.equal(panel.props['--modal-grid-gap'], '6px', 'the gap between reward cards is halved (playtest 2026-11-17 item 45)');
    const confirm = fakePanel();
    ModalModelFor('confirm').apply(confirm);
    assert.equal(confirm.dataset.nameButton, undefined);
});

test('option choice kinds resolve their dialog settings and refuse bad config', () =>
{
    for (const kind of Object.keys(KINDS))
    {
        const model = ModalModelFor(kind);

        if (model instanceof OptionChoiceModalModel)
        {
            assert.match(model.idAttribute, /^data-/, kind);
            assert.equal(typeof model.isMultiSelect, 'boolean', kind);
        }
    }

    const table = {
        base: {},
        choice: { extends: 'base' },
        optionChoice: {
            extends: 'choice',
            size: 'md',
            footSize: 'short',
            className: 'option-choice',
            selection: 'single',
            idAttribute: 'data-pick',
            commitLabelKey: 'common.choose',
            cancelLabelKey: 'common.cancel',
            hasCancelButton: true,
        },
        typo: { extends: 'optionChoice', idAtribute: 'data-x' },
        badMode: { extends: 'optionChoice', selection: 'some' },
        badColumns: { extends: 'optionChoice', columns: 0 },
    };
    assert.equal(ModalModelFor('optionChoice', table).idAttribute, 'data-pick');
    assert.equal(ModalModelFor('optionChoice', table).closeLabelKey, 'common.cancel');
    assert.throws(() => ModalModelFor('typo', table), /unknown key "idAtribute"/);
    assert.throws(() => ModalModelFor('badMode', table), /"selection" must be one of/);
    assert.throws(() => ModalModelFor('badColumns', table), /"columns" must be a positive whole number/);
});
