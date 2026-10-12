// tests/reaction-choice-modal-stack.test.mjs — the reaction modal shows what is
// already on the stack, and Back then reads Resolve.
//
// Version 1 (no stack, or an empty one) must render the same markup it always
// did: the help sentence, the option list, and a Back button. With entries, the
// modal lists them top first above the options, swaps the help sentence for the
// stacked one and labels the exit button Resolve. The exit still answers null.
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tagName, ownerDocument, text = null) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.style = {};
    this.disabled = false;
    this.hidden = false;
    this.tabIndex = 0;
    this.isConnected = false;
    this.text = text;
    this.classes = new Set();
  }

  get className() { return [...this.classes].join(' '); }
  set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); }

  get classList() {
    const node = this;
    return {
      add: (...names) => names.forEach((name) => node.classes.add(name)),
      remove: (...names) => names.forEach((name) => node.classes.delete(name)),
      contains: (name) => node.classes.has(name),
    };
  }

  get textContent() {
    if (this.text !== null) return this.text;
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this.text = String(value);
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeNode('#text', this.ownerDocument, node) : node;
      child.parentNode = this;
      child.setConnected(this.isConnected);
      this.children.push(child);
    }
  }

  appendChild(node) { this.append(node); return node; }

  prepend(...nodes) {
    for (const node of [...nodes].reverse()) {
      node.parentNode = this;
      node.setConnected(this.isConnected);
      this.children.unshift(node);
    }
  }

  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentNode = null; });
    this.children = [];
    this.append(...nodes);
  }

  setConnected(connected) {
    this.isConnected = connected;
    this.children.forEach((child) => child.setConnected(connected));
  }

  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
    this.setConnected(false);
  }

  get firstElementChild() { return this.children[0] || null; }

  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((candidate) => candidate !== listener));
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener({ ...event, target: this, preventDefault() {}, stopPropagation() {} });
    return true;
  }

  click() { this.dispatchEvent({ type: 'click' }); }

  focus() { this.ownerDocument.activeElement = this; }

  contains(candidate) { return candidate === this || this.children.some((child) => child.contains(candidate)); }

  closest() { return null; }

  matches(selector) {
    const tokens = [...selector.matchAll(/([a-zA-Z][\w-]*)|\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)];
    return tokens.length > 0 && tokens.every(([, tag, cls, attr, value]) => {
      if (tag) return this.tagName === tag.toUpperCase();
      if (cls) return this.classes.has(cls);
      if (!this.attributes.has(attr)) return false;
      return value === undefined || this.attributes.get(attr) === value;
    });
  }

  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }

  querySelectorAll(selector) { return this.descendants().filter((node) => node.matches(selector)); }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

class FakeDocument extends FakeNode {
  constructor() {
    super('html', null);
    this.ownerDocument = this;
    this.body = new FakeNode('body', this);
    this.append(this.body);
    this.setConnected(true);
    this.activeElement = this.body;
    this.docListeners = new Map();
  }

  createElement(tagName) { return new FakeNode(tagName, this); }

  addEventListener(type, listener) { this.docListeners.set(type, [...(this.docListeners.get(type) || []), listener]); }

  removeEventListener(type, listener) { this.docListeners.set(type, (this.docListeners.get(type) || []).filter((c) => c !== listener)); }
}

const STACK = [{ name: 'Second Strike' }, { name: 'Guard Counter' }];
const OPTIONS = [{ id: 'opt-a', name: 'Riposte', staminaCost: 1, play: {} }];

async function openWith(extra) {
  const saved = { document: globalThis.document, window: globalThis.window, HTMLElement: globalThis.HTMLElement, addEventListener: globalThis.addEventListener };
  const document = new FakeDocument();
  globalThis.document = document;
  globalThis.window = new FakeNode('window', document);
  globalThis.HTMLElement = FakeNode;
  // tooltip.js wires a window resize listener when it loads.
  globalThis.addEventListener = () => {};
  try {
    const { openReactionChoiceModal } = await import('../src/ui/components/reactionChoiceModal.js');
    const answers = [];
    const shell = openReactionChoiceModal({
      pending: { id: 'root:e1:0', options: OPTIONS },
      onAnswer: (intent) => answers.push(intent),
      ...extra,
    });
    return { document, shell, answers, restore: () => {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    } };
  } catch (error) {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
    throw error;
  }
}

test('no stack renders the version 1 modal with a Back button', async () => {
  const opened = await openWith({});
  try {
    const { shell } = opened;
    const body = shell.body;
    assert.equal(body.querySelector('[data-reaction-stack]'), null, 'no stack list without entries');
    assert.equal(body.querySelector('.reaction-stack-label'), null);
    assert.equal(body.querySelector('p').textContent, 'Choose a card to play before this action resolves. Back skips this reaction.');
    const exits = opened.document.querySelectorAll('button').filter((node) => node.textContent === 'Back');
    assert.ok(exits.length >= 1, 'a button reads Back');
    assert.equal(opened.document.querySelectorAll('button').filter((node) => node.textContent === 'Resolve').length, 0, 'no Resolve label without a stack');
    assert.equal(body.querySelectorAll('[data-reaction-option]').length, 1);
  } finally {
    opened.restore();
  }
});

test('an empty stack renders exactly the same body as no stack', async () => {
  const plain = await openWith({});
  const empty = await openWith({ stack: [] });
  try {
    assert.equal(empty.shell.body.children.map((c) => c.tagName + c.textContent).join('|'),
      plain.shell.body.children.map((c) => c.tagName + c.textContent).join('|'));
  } finally {
    plain.restore();
    empty.restore();
  }
});

test('a stack of two lists the top first and labels the exit Resolve', async () => {
  const opened = await openWith({ stack: STACK });
  try {
    const { shell, document } = opened;
    const items = shell.body.querySelectorAll('[data-reaction-stack-entry]').map((node) => node.textContent);
    assert.deepEqual(items, ['Second Strike', 'Guard Counter'], 'top entry first');
    assert.equal(shell.body.querySelector('[data-reaction-stack]').getAttribute('data-reaction-stack'), '2');
    assert.equal(shell.body.querySelector('p').textContent,
      'Choose another card to add on top, or Resolve to play the stack, last card first.');
    assert.equal(document.querySelectorAll('button').filter((node) => node.textContent === 'Resolve').length, 1, 'exit reads Resolve');
    assert.equal(document.querySelectorAll('button').filter((node) => node.textContent === 'Back').length, 0, 'Back is replaced on the exit');
    assert.equal(shell.body.querySelectorAll('[data-reaction-option]').length, 1, 'options are still offered');
  } finally {
    opened.restore();
  }
});

test('Resolve still answers with no option chosen', async () => {
  const opened = await openWith({ stack: STACK });
  try {
    const exit = opened.document.querySelectorAll('button').find((node) => node.textContent === 'Resolve');
    exit.click();
    opened.shell.close();
    assert.deepEqual(opened.answers, [{ offerId: 'root:e1:0', optionId: null }]);
  } finally {
    opened.restore();
  }
});
