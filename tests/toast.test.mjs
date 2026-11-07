// The shared toast (src/ui/components/toast.js): shows for about 3 s, then
// fades out (or just hides under reduced motion); a polite live region.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

function fakeNode() {
  const node = {
    className: '', hidden: true, textContent: '', attrs: {}, parent: null, classes: new Set(),
    setAttribute(k, v) { this.attrs[k] = v; },
    remove() { this.parent = null; },
    classList: null,
  };
  node.classList = {
    add: (c) => node.classes.add(c), remove: (c) => node.classes.delete(c), contains: (c) => node.classes.has(c),
  };
  return node;
}
globalThis.document = { createElement: fakeNode };
const { createToast, TOAST_MS, TOAST_FADE_MS } = await import('../src/ui/components/toast.js');
const parent = () => ({ children: [], appendChild(n) { n.parent = this; this.children.push(n); } });

test('a toast announces politely, shows for about three seconds, then fades and is removed', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const toast = createToast({ reduced: () => false });
    const host = parent();
    const node = toast.show('Goldbough Branch equipped in Off Hand.', host);
    assert.equal(node.attrs['aria-live'], 'polite');
    assert.equal(node.attrs.role, 'status');
    assert.equal(node.hidden, false);
    assert.equal(node.textContent, 'Goldbough Branch equipped in Off Hand.');
    assert.equal(TOAST_MS, 3000);
    mock.timers.tick(TOAST_MS - 1);
    assert.equal(node.hidden, false, 'still showing just before the timeout');
    assert.equal(node.classList.contains('is-leaving'), false);
    mock.timers.tick(1);
    assert.equal(node.classList.contains('is-leaving'), true, 'fading out at the timeout');
    mock.timers.tick(TOAST_FADE_MS);
    assert.equal(node.hidden, true);
    assert.equal(node.parent, null, 'removed from the screen after the fade');
  } finally { mock.timers.reset(); }
});

test('reduced motion hides at the timeout with no fade', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const toast = createToast({ reduced: () => true });
    const node = toast.show('Equipped.', parent());
    mock.timers.tick(TOAST_MS);
    assert.equal(node.classList.contains('is-leaving'), false);
    assert.equal(node.hidden, true);
    assert.equal(node.parent, null);
  } finally { mock.timers.reset(); }
});

test('a newer toast replaces the last and restarts the clock; attach restores a live toast after a redraw', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const toast = createToast({ reduced: () => true });
    const host = parent();
    toast.show('first', host);
    mock.timers.tick(2000);
    const node = toast.show('second', host);
    mock.timers.tick(2000);
    assert.equal(node.hidden, false, 'the clock restarted with the second');
    assert.equal(node.textContent, 'second');
    const redrawn = parent();
    toast.attach(redrawn);
    assert.equal(node.parent, redrawn);
    mock.timers.tick(1000);
    assert.equal(node.hidden, true);
    const after = parent();
    toast.attach(after);
    assert.equal(after.children.length, 0, 'nothing to restore once it is gone');
  } finally { mock.timers.reset(); }
});
