import { rewardDom } from './reward-dom.mjs';

export function withModalDom(fn) {
  const dom = rewardDom();
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.focus = function focus() { dom.document.activeElement = this; this.dispatchEvent(new dom.Event('focus')); };
  proto.replaceChildren = function replaceChildren(...nodes) { this.innerHTML = ''; this.append(...nodes); };
  // Native <details>.open reflects its boolean attribute. The layout-free
  // fixture needs that reflection to exercise collapsed-group focus routing.
  Object.defineProperty(proto, 'open', {
    configurable: true,
    get() { return this.hasAttribute('open'); },
    set(value) { if (value) this.setAttribute('open', ''); else this.removeAttribute('open'); },
  });
  Object.defineProperty(proto, 'hidden', {
    configurable: true,
    get() { return this.hasAttribute('hidden'); },
    set(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); },
  });
  proto.insertBefore = function insertBefore(node, next) {
    node.remove();
    const at = this.children.indexOf(next);
    if (at < 0) return this.appendChild(node);
    this.children.splice(at, 0, node); node.parentNode = this; return node;
  };
  // The fixture keeps `dataset` and the data-* attributes apart; the kit writes
  // `dataset`, so selectors read it back through the attribute methods.
  const dataKey = (key) => key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const { getAttribute, hasAttribute } = proto;
  proto.getAttribute = function get(key) {
    const own = getAttribute.call(this, key);
    return own === null && key.startsWith('data-') && this.dataset[dataKey(key)] !== undefined ? String(this.dataset[dataKey(key)]) : own;
  };
  proto.insertAdjacentHTML = function insert(_where, markup) {
    const holder = dom.document.createElement('div');
    holder.innerHTML = markup;
    for (const child of [...holder.children]) this.appendChild(child);
  };
  // Markup builders (the kit's html()) read outerHTML; a plain serializer.
  Object.defineProperty(proto, 'outerHTML', {
    configurable: true,
    get() {
      if (this.tagName === 'TEXT') return this.textContent;
      const attrs = new Map(this.attributes);
      for (const [k, v] of Object.entries(this.dataset)) attrs.set(`data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v);
      const open = [this.tagName.toLowerCase(), ...[...attrs].map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)].join(' ');
      return `<${open}>${this.textContent || ''}${this.children.map((c) => c.outerHTML).join('')}</${this.tagName.toLowerCase()}>`;
    },
  });
  proto.hasAttribute = function hasIt(key) {
    return hasAttribute.call(this, key) || (key.startsWith('data-') && this.dataset[dataKey(key)] !== undefined);
  };
  // What the Tab wrap (modalShell.bindModalDismiss) reads off a control.
  proto.contains = function contains(node) { for (let at = node; at; at = at.parentNode) if (at === this) return true; return false; };
  proto.getClientRects = function rects() { return this.isConnected ? [{}] : []; };
  Object.defineProperty(proto, 'tabIndex', { configurable: true, get() { return this.hasAttribute('tabindex') ? Number(this.getAttribute('tabindex')) : ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1; }, set(value) { this.setAttribute('tabindex', String(value)); } });
  const { matches } = proto;
  proto.matches = function match(selector) {
    if (selector === ':disabled') return !!this.disabled;
    if (selector === '[inert]') return this.hasAttribute('inert');
    const child = selector.lastIndexOf(' > ');
    if (child >= 0) return this.matches(selector.slice(child + 3)) && !!this.parentNode?.matches(selector.slice(0, child));
    return matches.call(this, selector);
  };
  const listeners = new Map();
  const docListeners = new Map();
  const add = (map) => (type, listener) => map.set(type, [...(map.get(type) || []), listener]);
  const drop = (map) => (type, listener) => map.set(type, (map.get(type) || []).filter((l) => l !== listener));
  dom.document.addEventListener = add(docListeners);
  dom.document.removeEventListener = drop(docListeners);
  dom.document.getElementById = (id) => dom.document.body.querySelector(`#${id}`);
  dom.document.activeElement = dom.document.body;
  const win = {
    ...dom,
    addEventListener: add(listeners),
    removeEventListener: drop(listeners),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); return true; },
    KeyboardEvent: dom.Event,
    MouseEvent: dom.Event,
    PointerEvent: dom.Event,
    innerWidth: 390,
    // A key press as a browser delivers it: window capture (input.js), then
    // document capture (the modal shell), then window bubble, unless stopped.
    press(key, extra = {}) {
      const event = new dom.Event('keydown', { key, bubbles: true, target: dom.document.activeElement, ...extra });
      const [first, ...rest] = listeners.get('keydown') || [];
      const run = (fnList) => { for (const l of fnList) { if (event.immediatePropagationStopped) return; l(event); } };
      if (first) run([first]);
      if (!event.immediatePropagationStopped) run(docListeners.get('keydown') || []);
      if (!event.immediatePropagationStopped && !event.propagationStopped) run(rest);
      return event;
    },
  };
  const saved = Object.fromEntries(Object.keys(win).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, win);
  try { return fn(dom, win, listeners); } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}
