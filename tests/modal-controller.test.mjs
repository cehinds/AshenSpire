// tests/modal-controller.test.mjs — the shell's lifecycle for a modal that
// builds its own DOM (src/ui/components/modalController.js), and OpenModal's
// onDismiss / onBackdrop hooks.
//
//   node --test tests/modal-controller.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withModalDom } from './helpers/dom.mjs';
import { resetModalState, openModals, modalOpen } from '../src/ui/modalManager.js';
import { ModalController } from '../src/ui/components/modalController.js';
import { OpenModal } from '../src/ui/components/modalShell.js';

function buildDoor(document)
{
    const opener = document.createElement('button');
    const veil = document.createElement('div');
    const panel = document.createElement('section');
    const inside = document.createElement('button');
    panel.setAttribute('aria-modal', 'true');
    panel.appendChild(inside);
    veil.appendChild(panel);
    document.body.append(opener, veil);
    return { opener, veil, panel, inside };
}

function pressVeil(dom, veil, target = veil)
{
    const press = new dom.Event('pointerdown');
    Object.defineProperty(press, 'target', { value: target });
    veil.dispatchEvent(press);
    const click = new dom.Event('click');
    Object.defineProperty(click, 'target', { value: target });
    veil.dispatchEvent(click);
}

test('Escape backs out through the manager: close, then onBack, focus returned', () => withModalDom((dom, win) =>
{
    resetModalState();
    const { opener, veil, panel, inside } = buildDoor(dom.document);
    const log = [];
    const controller = new ModalController({
        name: 'door',
        veil,
        panel,
        returnFocus: opener,
        onClosing: () => log.push('closing'),
        onBack: () => log.push(`back:${veil.isConnected}:${modalOpen()}`),
    }).Open();
    inside.focus();
    assert.equal(openModals().length, 1, 'registered with the manager');

    const event = win.press('Escape', { cancelable: true });

    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(log, ['closing', 'back:false:false'], 'closed and released before onBack');
    assert.equal(dom.document.activeElement, opener, 'focus returned to the opener');
    assert.equal(controller.IsClosed(), true);
    controller.Close();
    assert.deepEqual(log, ['closing', 'back:false:false'], 'a second close does nothing');
}));

test('a backdrop press that began on the veil backs out; one that began inside does not', () => withModalDom((dom) =>
{
    resetModalState();
    const { veil, panel } = buildDoor(dom.document);
    let backs = 0;
    new ModalController({ name: 'door', veil, panel, onBack: () => { backs += 1; } }).Open();

    pressVeil(dom, veil, panel);
    assert.equal(backs, 0, 'a press inside the panel is not a backdrop click');

    pressVeil(dom, veil);
    assert.equal(backs, 1);
    assert.equal(veil.isConnected, false);
}));

test('BackOut runs onBack once; a second BackOut does nothing', () => withModalDom((dom) =>
{
    resetModalState();
    const { veil, panel } = buildDoor(dom.document);
    let backs = 0;
    const controller = new ModalController({ name: 'door', veil, panel, onBack: () => { backs += 1; } }).Open();

    controller.BackOut();
    controller.BackOut();

    assert.equal(backs, 1);
    assert.equal(controller.IsClosed(), true);
}));

test('Close({ restoreFocus: false }) keeps focus where it is and skips onBack', () => withModalDom((dom) =>
{
    resetModalState();
    const { opener, veil, panel, inside } = buildDoor(dom.document);
    let backs = 0;
    const seen = [];
    const controller = new ModalController({
        name: 'door',
        veil,
        panel,
        returnFocus: opener,
        onBack: () => { backs += 1; },
        onClosing: (options) => seen.push(options),
    }).Open();
    inside.focus();

    controller.Close({ restoreFocus: false, keepParent: true });

    assert.equal(backs, 0);
    assert.deepEqual(seen, [{ restoreFocus: false, keepParent: true }], 'onClosing hears the close options');
    assert.notEqual(dom.document.activeElement, opener);
    assert.equal(openModals().length, 0);
}));

test('OpenModal: onDismiss and onBackdrop replace the default close', () => withModalDom((dom, win) =>
{
    resetModalState();
    const log = [];
    const shell = OpenModal({
        title: 'Hooks',
        onDismiss: () => log.push('escape'),
        onBackdrop: () => log.push('backdrop'),
    });

    win.press('Escape', { cancelable: true });
    pressVeil(dom, shell.veil);

    assert.deepEqual(log, ['escape', 'backdrop']);
    assert.equal(shell.veil.isConnected, true, 'the hooks decide whether the door closes');
    shell.close();
    assert.equal(shell.veil.isConnected, false);
}));
