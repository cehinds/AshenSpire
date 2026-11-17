// tests/ui-selection.test.mjs — the shared selected-state, Enter/Space and arrow-key helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivateOnKey, MarkSelected, RovingList } from '../src/ui/selection.js';

function fakeElement(name = '')
{
    const listeners = new Map();
    const element = {
        name,
        children: [],
        attributes: new Map(),
        classes: new Set(),
        tabIndex: 0,
        focusCount: 0,
        clickCount: 0,
        classList: {
            toggle: (className, isOn) => (isOn ? element.classes.add(className) : element.classes.delete(className)),
        },
        setAttribute: (key, value) => element.attributes.set(key, String(value)),
        getAttribute: (key) => (element.attributes.has(key) ? element.attributes.get(key) : null),
        removeAttribute: (key) => element.attributes.delete(key),
        addEventListener: (type, handler) => listeners.set(type, [...(listeners.get(type) || []), handler]),
        removeEventListener: (type, handler) => listeners.set(type, (listeners.get(type) || []).filter((entry) => entry !== handler)),
        contains: (other) => other === element || element.children.some((child) => child.contains(other)),
        focus: () => { element.focusCount += 1; },
        click: () => { element.clickCount += 1; },
        dispatchKey: (key, target = element) =>
        {
            const event = {
                key,
                target,
                isDefaultPrevented: false,
                isPropagationStopped: false,
                preventDefault: () => { event.isDefaultPrevented = true; },
                stopPropagation: () => { event.isPropagationStopped = true; },
            };
            for (const handler of listeners.get('keydown') || []) handler(event);
            return event;
        },
    };
    return element;
}

function fakeList(count)
{
    const list = fakeElement('list');
    list.children = Array.from({ length: count }, (_, index) => fakeElement(`item-${index}`));
    return list;
}

test('MarkSelected toggles the class and the aria state on each node', () =>
{
    const list = fakeList(3);
    MarkSelected(list.children, (node) => node.name === 'item-1', { className: 'on', ariaAttribute: 'aria-selected', ariaCurrent: 'true' });
    assert.deepEqual(list.children.map((node) => node.getAttribute('aria-selected')), ['false', 'true', 'false']);
    assert.deepEqual(list.children.map((node) => node.classes.has('on')), [false, true, false]);
    assert.deepEqual(list.children.map((node) => node.getAttribute('aria-current')), [null, 'true', null]);
});

test('MarkSelected takes one node, several classes, and no aria attribute', () =>
{
    const node = fakeElement();
    MarkSelected(node, true, { className: ['selected', 'is-chosen'], ariaAttribute: null });
    assert.deepEqual([...node.classes], ['selected', 'is-chosen']);
    assert.equal(node.attributes.size, 0);
    MarkSelected(node, false, { className: null });
    assert.deepEqual([...node.classes], ['selected', 'is-chosen']);
    assert.equal(node.getAttribute('aria-pressed'), 'false');
});

test('ActivateOnKey answers Enter and Space once, honours canActivate, and disarms', () =>
{
    const node = fakeElement();
    const seen = [];
    const disarm = ActivateOnKey(node, (event) => seen.push(event.key), { canActivate: (event) => event.target === node, shouldStopPropagation: true });
    const enter = node.dispatchKey('Enter');
    assert.equal(enter.isDefaultPrevented, true);
    assert.equal(enter.isPropagationStopped, true);
    node.dispatchKey(' ');
    node.dispatchKey('a');
    node.dispatchKey('Enter', fakeElement());
    assert.deepEqual(seen, ['Enter', ' ']);
    disarm();
    node.dispatchKey('Enter');
    assert.deepEqual(seen, ['Enter', ' ']);
});

test('ActivateOnKey without a handler clicks the element', () =>
{
    const node = fakeElement();
    const event = (ActivateOnKey(node), node.dispatchKey(' '));
    assert.equal(node.clickCount, 1);
    assert.equal(event.isPropagationStopped, false);
});

test('RovingList wraps, steps a grid row, and ignores keys from outside the list', () =>
{
    const list = fakeList(6);
    const moves = [];
    RovingList(list, { columns: 3, onMove: (target) => moves.push(target.name) });
    list.dispatchKey('ArrowRight', list.children[5]);
    list.dispatchKey('ArrowLeft', list.children[0]);
    list.dispatchKey('ArrowDown', list.children[1]);
    list.dispatchKey('ArrowUp', list.children[1]);
    const outside = list.dispatchKey('ArrowDown', fakeElement());
    assert.deepEqual(moves, ['item-0', 'item-5', 'item-4', 'item-4']);
    assert.equal(outside.isDefaultPrevented, false);
});

test('RovingList honours orientation, Home/End and startIndex', () =>
{
    const list = fakeList(3);
    const moves = [];
    const disarm = RovingList(list, {
        orientation: () => 'vertical',
        hasHomeEnd: true,
        startIndex: 0,
        shouldStopPropagation: true,
        onMove: (target) => moves.push(target.name),
    });
    assert.equal(list.dispatchKey('ArrowRight', list.children[0]).isDefaultPrevented, false);
    const down = list.dispatchKey('ArrowDown', list);
    assert.equal(down.isPropagationStopped, true);
    list.dispatchKey('End', list.children[0]);
    list.dispatchKey('Home', list.children[2]);
    assert.deepEqual(moves, ['item-1', 'item-2', 'item-0']);
    disarm();
    list.dispatchKey('ArrowDown', list.children[0]);
    assert.equal(moves.length, 3);
});

test('RovingList focuses the target without scrolling the page by default', () =>
{
    const list = fakeList(2);
    RovingList(list);
    list.dispatchKey('ArrowDown', list.children[0]);
    assert.equal(list.children[1].focusCount, 1);
});
