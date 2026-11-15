// tests/helpers/option-modal-dom.mjs — a small fake DOM that mounts the kit modal shell (the one tests/reaction-choice-modal-stack.test.mjs
// uses), shared by the option-modal tests. installDom() returns { document, restore }; selectors are tag, .class and [attr] / [attr="v"] only.
export class FakeNode {
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

  insertBefore(node, next) {
    node.parentNode = this;
    node.setConnected(this.isConnected);
    const at = this.children.indexOf(next);
    if (at < 0) this.children.push(node); else this.children.splice(at, 0, node);
    return node;
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

export class FakeDocument extends FakeNode {
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

// Installs the fake DOM for the modal; the returned restore puts globals back.
export function installDom() {
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
