// tests/knowledge-door.test.mjs — the shared list/detail door behind the Bestiary and the Compendium.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withKitDom } from './helpers/dom.mjs';
import { MountKnowledgeDoor, ResolveKnowledgeDoorConfig } from '../src/ui/components/knowledgeDoor.js';
import { uiConfig } from '../src/config/generated/ui.js';
import { t } from '../src/ui/strings.js';

const ENTRIES = [{ id: 'ash', name: 'Ash' }, { id: 'bone', name: 'Bone' }, { id: 'cinder', name: 'Cinder' }];

function mountDoor(document, options = {})
{
    const app = document.createElement('main');
    document.body.append(app);
    const painted = [];
    const door = MountKnowledgeDoor(app, {
        screen: 'bestiary',
        entries: ENTRIES,
        buildEntry: (entry) => Object.assign(document.createElement('button'), { textContent: entry.name }),
        renderDetail: (entry) =>
        {
            painted.push(entry.id);
            return [Object.assign(document.createElement('p'), { textContent: entry.name })];
        },
        ...options,
    });
    return { app, door, painted };
}

const shownText = (node) => [node.textContent, ...node.children.map(shownText)].join('');
const selectedNames = (app) => [...app.querySelectorAll('.cp-list button[aria-pressed="true"]')].map((node) => node.textContent);

test('every configured door resolves through base and names only real strings', () =>
{
    for (const screen of Object.keys(uiConfig.screens.knowledgeDoor.components).filter((name) => name !== 'base'))
    {
        const config = ResolveKnowledgeDoorConfig(screen);
        assert.equal(config.extends, undefined, `${screen}: extends is resolved away`);
        for (const key of ['eyebrowKey', 'titleKey', 'closeLabelKey', 'listLabelKey', 'listEmptyKey', 'detailLabelKey', 'detailEmptyKey'])
        {
            if (config[key]) assert.ok(t(config[key], { held: 0, total: 0 }), `${screen}.${key}`);
        }
    }
    assert.throws(() => ResolveKnowledgeDoorConfig('base'), /unknown knowledge door/);
    assert.throws(() => ResolveKnowledgeDoorConfig('nowhere'), /unknown knowledge door/);
});

test('picking an entry repaints the detail and the mark, never the list', () => withKitDom(({ document }) =>
{
    const { app, painted } = mountDoor(document);
    const controls = [...app.querySelectorAll('.cp-list button')];
    assert.deepEqual(selectedNames(app), ['Ash'], 'the first entry is selected on open');
    assert.equal(shownText(app.querySelector('#bestiary-facts')), 'Ash');

    controls[2].click();
    assert.deepEqual(selectedNames(app), ['Cinder'], 'exactly one entry is selected');
    assert.equal(shownText(app.querySelector('#bestiary-facts')), 'Cinder');
    assert.deepEqual([...app.querySelectorAll('.cp-list button')], controls, 'the list nodes are the same nodes');
    assert.deepEqual(painted, ['ash', 'cinder']);
    for (const control of controls) assert.equal(control.getAttribute('aria-controls'), 'bestiary-facts');
}));

test('an update replaces the list and keeps a selection that is still shown', () => withKitDom(({ document }) =>
{
    const { app, door } = mountDoor(document, { selectedId: 'bone' });
    assert.deepEqual(selectedNames(app), ['Bone']);
    door.update({ entries: ENTRIES.slice(1), selectedId: 'bone', listLabel: 'Bones' });
    assert.deepEqual(selectedNames(app), ['Bone']);
    assert.equal(app.querySelector('.cp-list .as-options').getAttribute('aria-label'), 'Bones');
    door.update({ entries: ENTRIES.slice(2), selectedId: 'bone' });
    assert.deepEqual(selectedNames(app), ['Cinder'], 'a selection no longer shown falls to the first entry');
}));

test('an empty door shows the configured empty copy in the list and the detail', () => withKitDom(({ document }) =>
{
    const { app } = mountDoor(document, { entries: [] });
    assert.equal(shownText(app.querySelector('.cp-list')), t('knowledge.empty'));
    assert.equal(shownText(app.querySelector('#bestiary-facts')), t('knowledge.empty.help'));
    assert.equal(document.activeElement, app.querySelector('#bestiary-back'), 'focus lands on Back');
}));

test('Back is the one data-back exit, it leaves once, and the door adds no Escape of its own', () => withKitDom(({ document }, win) =>
{
    let backs = 0;
    const { app } = mountDoor(document, { onBack: () => { backs += 1; } });
    const back = app.querySelector('#bestiary-back');
    assert.equal(back.getAttribute('data-back'), '');
    assert.equal(app.querySelectorAll('[data-back]').length, 1);
    app.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(backs, 0, 'Escape is input.js\'s shared [data-back] rule, not the door\'s');
    back.click();
    back.click();
    assert.equal(backs, 1);
}));

test('the compact split shares are config, written as one custom property', () => withKitDom(({ document }) =>
{
    const written = new Map();
    const createElement = document.createElement;
    document.createElement = (tag) =>
    {
        const node = createElement(tag);
        node.style.setProperty = (name, value) => written.set(name, value);
        return node;
    };
    const { app } = mountDoor(document);
    assert.equal(app.querySelector('.knowledge-door').dataset.surface, 'bestiary');
    assert.equal(written.get('--knowledge-compact-rows'), 'minmax(0, 7fr) minmax(0, 13fr)');
}));
