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

  createTextNode(text) { return new FakeNode('#text', this, String(text)); }

  addEventListener(type, listener) { this.docListeners.set(type, [...(this.docListeners.get(type) || []), listener]); }

  removeEventListener(type, listener) { this.docListeners.set(type, (this.docListeners.get(type) || []).filter((c) => c !== listener)); }
}

const STACK = [{ name: 'Second Strike' }, { name: 'Guard Counter' }];
const OPTIONS = [{ id: 'opt-a', name: 'Riposte', staminaCost: 1, play: {} }];

// Installs the fake DOM for the modal; the returned restore puts globals back.
function installDom() {
  const saved = { document: globalThis.document, window: globalThis.window, HTMLElement: globalThis.HTMLElement, addEventListener: globalThis.addEventListener };
  const document = new FakeDocument();
  globalThis.document = document;
  globalThis.window = new FakeNode('window', document);
  globalThis.HTMLElement = FakeNode;
  // tooltip.js wires a window resize listener when it loads.
  globalThis.addEventListener = () => {};
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
  return { document, restore };
}

async function openWith(extra) {
  const { document, restore } = installDom();
  try {
    const { openReactionChoiceModal } = await import('../src/ui/components/reactionChoiceModal.js');
    const answers = [];
    const shell = openReactionChoiceModal({
      pending: { id: 'root:e1:0', options: OPTIONS },
      onAnswer: (intent) => answers.push(intent),
      ...extra,
    });
    return { document, shell, answers, restore };
  } catch (error) {
    restore();
    throw error;
  }
}

test('committedReactionStack returns this root\'s entries, top first', async () => {
  const { restore } = installDom();
  try {
    const { committedReactionStack } = await import('../src/ui/components/reactionChoiceModal.js');
    const reactionStack = { groupKey: 'root-1', entries: [{ cardInstanceId: 'a' }, { cardInstanceId: 'b' }] };
    assert.deepEqual(committedReactionStack(reactionStack, 'root-1').map((entry) => entry.cardInstanceId), ['b', 'a']);
    assert.deepEqual(committedReactionStack(reactionStack, 'root-2'), [], 'another root has no stack to show');
    assert.deepEqual(committedReactionStack(undefined, 'root-1'), []);
    assert.deepEqual(committedReactionStack(reactionStack, undefined), [], 'no pending offer, no stack');
  } finally {
    restore();
  }
});

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

test('options render as vertical rows with the card name, effect line and direction', async () => {
  const summaries = {
    'opt-a': { id: 'opt-a', name: 'Counter', costs: ['1 SP'], line: [
      { label: 'Def', before: 'Def ', after: '', value: 9, base: 7, dir: 'up' },
      { label: 'Return', before: 'Return ', after: '', value: 2, base: 4, dir: 'down' },
      { label: 'Dmg', before: 'Dmg ', after: '', value: 5, base: 5, dir: null }] },
  };
  const opened = await openWith({ summarize: option => summaries[option.id] });
  try {
    const tile = opened.shell.body.querySelector('[data-reaction-option="opt-a"]');
    assert.ok(tile.classes.has('option-row'));
    assert.ok(tile.parentNode.classes.has('option-row-list'), 'rows sit in one vertical list');
    assert.equal(tile.tagName, 'BUTTON');
    assert.equal(tile.querySelector('.option-row-name').textContent, 'Counter');
    assert.equal(tile.querySelector('.option-row-chip').textContent, 'Reaction');
    assert.equal(tile.querySelector('.option-row-art'), null, 'no resolvable art: no art cell and no placeholder text');
    assert.ok(!tile.textContent.includes('cards'), 'no placeholder glyph text');
    assert.equal(tile.querySelector('.co-effect').textContent, 'Def 9\u25b2 raised · Return 2\u25bc lowered · Dmg 5', 'changed numbers carry an arrow and words, not colour alone');
    assert.deepEqual(tile.querySelectorAll('.co-arrow').map(node => node.textContent), ['\u25b2', '\u25bc']);
    assert.deepEqual(tile.querySelectorAll('.co-sr').map(node => node.textContent.trim()), ['raised', 'lowered']);
    assert.deepEqual(tile.querySelectorAll('.val.up').map(node => node.textContent), ['9'], 'a raised number is green');
    assert.deepEqual(tile.querySelectorAll('.val.down').map(node => node.textContent), ['2'], 'a lowered number is red');
    assert.equal(tile.querySelectorAll('.co-part').map(node => node.getAttribute('data-dir')).join(), 'up,down,none');
    assert.equal(tile.querySelector('.co-chip').textContent, '1 SP');
    const play = opened.document.querySelectorAll('button').find(node => node.textContent === 'Play');
    assert.equal(play.disabled, true);
    tile.click();
    assert.equal(tile.getAttribute('aria-pressed'), 'true');
    assert.equal(play.disabled, false);
    play.click();
    assert.deepEqual(opened.answers, [{ offerId: 'root:e1:0', optionId: 'opt-a' }]);
  } finally {
    opened.restore();
  }
});

test('focus waits for the next frame, then lands on the first option', async () => {
  const savedRaf = globalThis.requestAnimationFrame;
  const frames = [];
  globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
  const opened = await openWith({});
  try {
    const tile = opened.shell.body.querySelector('[data-reaction-option]');
    assert.notEqual(opened.document.activeElement, tile, 'opening forces no layout: focus is not set in the opening frame');
    assert.equal(frames.length, 1, 'one frame callback places focus');
    frames.forEach(fn => fn());
    assert.equal(opened.document.activeElement, tile, 'the default control takes focus once painted');
  } finally {
    if (savedRaf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = savedRaf;
    opened.restore();
  }
});

test('without a frame scheduler focus lands on the first option at once', async () => {
  const opened = await openWith({});
  try {
    assert.equal(opened.document.activeElement, opened.shell.body.querySelector('[data-reaction-option]'));
  } finally {
    opened.restore();
  }
});

test('several options are rows of one list; arrows move focus, selecting enables Play, Back answers null', async () => {
  const opened = await openWith({ pending: { id: 'root:e1:0', options: [
    { id: 'a', name: 'Riposte', play: {} }, { id: 'b', name: 'Parry', play: {} }, { id: 'c', name: 'Dodge', play: {} }] } });
  try {
    const rows = opened.shell.body.querySelectorAll('[data-reaction-option]');
    assert.deepEqual(rows.map(row => row.getAttribute('data-reaction-option')), ['a', 'b', 'c']);
    assert.ok(rows.every(row => row.classes.has('option-row') && row.parentNode === rows[0].parentNode));
    const list = rows[0].parentNode;
    list.listeners.get('keydown')[0]({ key: 'ArrowDown', target: rows[0], preventDefault() {} });
    assert.equal(opened.document.activeElement, rows[1], 'ArrowDown moves to the next row');
    rows[1].click();
    assert.deepEqual(rows.map(row => row.getAttribute('aria-pressed')), ['false', 'true', 'false']);
    const play = opened.document.querySelectorAll('button').find(node => node.textContent === 'Play');
    assert.equal(play.disabled, false);
    opened.document.querySelectorAll('button').find(node => node.textContent === 'Back').click();
    assert.deepEqual(opened.answers, [{ offerId: 'root:e1:0', optionId: null }], 'Back answers null even with a row selected');
  } finally {
    opened.restore();
  }
});

test('an option with a Core card id takes its art from the card-face resolver', async () => {
  const registries = { cards: new Map([['core.counter', { id: 'core.counter', name: 'Counter', type: 'skill', tags: [] }]]) };
  const opened = await openWith({ registries, pending: { id: 'r', options: [{ id: 'o', cardId: 'core.counter', name: 'Counter', play: {} }] } });
  try {
    const { reactionOptionArt } = await import('../src/ui/components/reactionChoiceModal.js');
    const path = reactionOptionArt({ cardId: 'core.counter' }, registries);
    assert.equal(typeof path, 'string', 'the resolver yields an image path');
    const tile = opened.shell.body.querySelector('[data-reaction-option="o"]');
    const art = tile.querySelector('.option-row-art');
    assert.ok(art, 'an art well leads the row');
    assert.ok(art.querySelector('img'), 'the well holds an image, not the placeholder glyph');
  } finally {
    opened.restore();
  }
});

test('selecting a row marks it pressed and leaves focus on it', async () => {
  const opened = await openWith({ pending: { id: 'r', options: [{ id: 'a', name: 'A', play: {} }, { id: 'b', name: 'B', play: {} }] } });
  try {
    const rows = opened.shell.body.querySelectorAll('[data-reaction-option]');
    rows[1].click();
    assert.equal(rows[1].getAttribute('aria-pressed'), 'true');
    assert.equal(opened.document.activeElement, rows[1], 'the tapped row holds focus');
    rows[0].click();
    assert.deepEqual(rows.map(row => row.getAttribute('aria-pressed')), ['true', 'false']);
    assert.equal(opened.document.activeElement, rows[0]);
  } finally {
    opened.restore();
  }
});
