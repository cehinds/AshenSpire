// tests/ui-selection.test.mjs — the shared selected-state, Enter/Space and arrow-key helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkSelected } from '../src/ui/selection.js';

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
