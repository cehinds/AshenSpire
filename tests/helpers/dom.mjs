// The one fake-DOM module for tests (docs/reviews/CODE-REVIEW-DEV-2026-11-06.md, Low:
// "39 tests assign globalThis.document and 29 hand-roll classList"). It merges the
// former reward-dom, kit-dom, modal-dom and card-markup-dom fixtures, which now
// re-export from here so their import paths keep working. No layout or
// trusted-input claims.
//
//   rewardDom()        base element/event fixture (classList, dataset, style,
//                      attributes, children, selectors, add/dispatchEvent)
//   withKitDom(fn)     rewardDom plus the deck-editor kit extras, installed on globalThis
//   withModalDom(fn)   rewardDom plus the modal-shell extras, installed on globalThis
//   cardMarkupDom()    rewardDom that records renderer-authored innerHTML
//   installDom(dom?)   sets globalThis.document/window (and the fixture's other
//                      globals) and returns a restore function

export function rewardDom() {
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
      this.dataset = new Proxy({}, { set: (data, key, value) => { data[key] = String(value); this.attributes.set('data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), String(value)); return true; } }); this.style = { setProperty() {}, getPropertyValue() { return ''; }, removeProperty() {} }; this.listeners = new Map();
      this.parentNode = null; this.disabled = false; this.hidden = false; this.textContent = '';
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(x => !names.includes(x)).join(' '); },
        toggle: (name, force) => { const on = force ?? !this.classList.contains(name); this.classList[on ? 'add' : 'remove'](name); return on; },
      };
    }
    get className() { return this.getAttribute('class') || ''; }
    set className(value) { this.setAttribute('class', value); }
    get id() { return this.getAttribute('id'); }
    set id(value) { this.setAttribute('id', value); }
    get firstElementChild() { return this.children[0] || null; }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    hasAttribute(key) { return this.attributes.has(key); }
    removeAttribute(key) { this.attributes.delete(key); }
    appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
    replaceWith(child) { const parent = this.parentNode; child.parentNode = parent; parent.children.splice(parent.children.indexOf(this), 1, child); this.parentNode = null; }
    after(child) { const parent = this.parentNode; child.parentNode = parent; parent.children.splice(parent.children.indexOf(this) + 1, 0, child); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); this.parentNode = null; }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(s => this.matches(s.trim()));
      if (selector === ':focus-visible') return false;
      for (const [, excluded] of selector.matchAll(/:not\(([^)]+)\)/g)) if (this.matches(excluded)) return false;
      selector = selector.replace(/:not\([^)]+\)/g, '');
      const parts = selector.trim().split(/\s+/);
      if (parts.length > 1) { const last = parts.pop(); return this.matches(last) && !!this.parentNode?.closest(parts.join(' ')); }
      const attributes = [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
      for (const [, key, value] of attributes) if (!this.hasAttribute(key) || (value !== undefined && this.getAttribute(key) !== value)) return false;
      const base = selector.replace(/\[[^\]]*\]/g, '');
      const tag = base.match(/^[\w-]+/)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      if ([...base.matchAll(/\.([\w-]+)/g)].some(([, name]) => !this.classList.contains(name))) return false;
      const id = base.match(/#([\w-]+)/)?.[1];
      return !id || this.id === id;
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    set innerHTML(html) {
      this.children.forEach(child => { child.parentNode = null; }); this.children = [];
      const stack = [this];
      for (const token of html.matchAll(/<\/?[\w-]+\b[^>]*>/g)) {
        const text = token[0];
        if (text.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        const tag = text.match(/^<([\w-]+)/)[1]; const child = new Element(tag);
        for (const [, key, quoted, single, bare] of text.slice(tag.length + 1, -1).matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) child.setAttribute(key, quoted ?? single ?? bare ?? '');
        stack.at(-1).appendChild(child);
        if (!['br','img','input','hr','meta','link'].includes(tag) && !text.endsWith('/>')) stack.push(child);
      }
    }
    // Repainting a card replaces only its frame; sibling controls keep their
    // nodes and listeners. Match outerHTML's replacement and detach behavior.
    set outerHTML(html) {
      if (!this.parentNode) return;
      const holder = document.createElement('div'); holder.innerHTML = String(html);
      const parent = this.parentNode;
      const replacements = [...holder.children];
      for (const node of replacements) node.parentNode = parent;
      parent.children.splice(parent.children.indexOf(this), 1, ...replacements);
      holder.children = [];
      this.parentNode = null;
    }
    getBoundingClientRect() { return this.box || {left:0,top:0,width:140,height:196}; }
    cloneNode(deep) { const node = new Element(this.tagName); for (const [key,value] of this.attributes) node.setAttribute(key,value); Object.assign(node.dataset,this.dataset); if(deep) this.children.forEach(child=>node.appendChild(child.cloneNode(true))); return node; }
    addEventListener(type, listener) { const list = this.listeners.get(type) || []; list.push(listener); this.listeners.set(type, list); }
    removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter(x => x !== listener)); }
    dispatchEvent(event) {
      event.target ||= this; event.currentTarget = this;
      for (const listener of [...(this.listeners.get(event.type) || [])]) { listener(event); if (event.immediatePropagationStopped) break; }
      if (event.bubbles && !event.propagationStopped) this.parentNode?.dispatchEvent(event);
      return !event.defaultPrevented;
    }
    click() { if (!this.disabled) this.dispatchEvent(new DomEvent('click', { bubbles: true })); }
  }
  class DomEvent {
    constructor(type, options = {}) { this.type = type; this.cancelable = false; this.defaultPrevented = false; Object.assign(this, options); }
    // As in a browser: preventDefault() on an event built without
    // `cancelable: true` is a no-op (a synthesized pad key once relied on it).
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
    stopPropagation() { this.propagationStopped = true; }
    stopImmediatePropagation() { this.immediatePropagationStopped = true; this.stopPropagation(); }
  }
  const document = { createElement: tag => new Element(tag), createElementNS: (namespace,tag) => { const el=new Element(tag);el.namespaceURI=namespace;return el; }, createTextNode: text => { const el = new Element('text'); el.textContent = text; return el; } };
  document.body = new Element('body');
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.querySelector = selector => document.body.querySelector(selector);
  return { document, getComputedStyle: () => ({ getPropertyValue: () => '' }), Event: DomEvent, CustomEvent: DomEvent, window: new Element('window'), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener() {}, removeEventListener() {} };
}


export function withKitDom(fn) {
  const dom = rewardDom();
  // SVG artwork participates in DOM structure checks; real browsers validate
  // its rendering. Keep the namespace so namespace assertions remain useful.
  dom.document.createElementNS = (namespaceURI, name) => {
    const node = dom.document.createElement(name);
    node.namespaceURI = namespaceURI;
    return node;
  };
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.focus = function focus() { dom.document.activeElement = this; this.dispatchEvent(new dom.Event('focus')); };
  proto.replaceChildren = function replaceChildren(...nodes) { this.innerHTML = ''; this.append(...nodes.filter(Boolean)); };
  proto.prepend = function prepend(...nodes) {
    for (const node of nodes.filter(Boolean).reverse()) { node.remove(); node.parentNode = this; this.children.unshift(node); }
  };
  proto.before = function before(node) { const parent = this.parentNode; node.remove(); node.parentNode = parent; parent.children.splice(parent.children.indexOf(this), 0, node); };
  proto.insertBefore = function insertBefore(node, ref) {
    if (!ref) return this.appendChild(node);
    node.remove(); node.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, node); return node;
  };
  Object.defineProperty(proto, 'childNodes', { configurable: true, get() { return this.children; } });
  Object.defineProperty(proto, 'firstChild', { configurable: true, get() { return this.children[0] || null; } });
  Object.defineProperty(proto, 'nextSibling', { configurable: true, get() { const s = this.parentNode?.children || []; return s[s.indexOf(this) + 1] || null; } });
  proto.scrollIntoView = function scrollIntoView() {};
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return 1200; } });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return 730; } });
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
  Object.defineProperty(proto, 'tabIndex', {
    configurable: true,
    get() { return this.hasAttribute('tabindex') ? Number(this.getAttribute('tabindex')) : ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1; },
    set(value) { this.setAttribute('tabindex', value); },
  });
  const { matches } = proto;
  proto.matches = function match(selector) {
    if (selector === ':disabled') return !!this.disabled;
    if (selector === '[inert]') return this.hasAttribute('inert');
    if (selector === '[data-page-locked]') return this.hasAttribute('data-page-locked');
    if (selector.includes(', ')) return selector.split(', ').some((part) => this.matches(part));
    return matches.call(this, selector);
  };
  const listeners = new Map();
  const docListeners = new Map();
  const add = (map) => (type, listener) => map.set(type, [...(map.get(type) || []), listener]);
  const drop = (map) => (type, listener) => map.set(type, (map.get(type) || []).filter((l) => l !== listener));
  dom.document.addEventListener = add(docListeners);
  dom.document.removeEventListener = drop(docListeners);
  dom.document.getElementById = (id) => dom.document.body.querySelector(`#${id}`);
  // The fixture represents text as element content, without native Text nodes.
  dom.document.createTreeWalker = () => ({ nextNode: () => false, currentNode: null });
  dom.document.activeElement = dom.document.body;
  // Custom elements are registered and never upgraded: the fixture has no
  // connection lifecycle, so a registered tag builds a plain element.
  const registry = new Map();
  const win = {
    ...dom,
    HTMLElement: dom.document.body.constructor,
    Node: dom.document.body.constructor,
    NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: class { observe() {} disconnect() {} },
    customElements: { get: (name) => registry.get(name), define: (name, ctor) => { registry.set(name, ctor); } },
    addEventListener: add(listeners),
    removeEventListener: drop(listeners),
    dispatchEvent: (event) => { for (const listener of listeners.get(event.type) || []) listener(event); return true; },
    KeyboardEvent: dom.Event,
    MouseEvent: dom.Event,
    PointerEvent: dom.Event,
    matchMedia: query => ({ media: query, matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    innerWidth: 390,
    innerHeight: 844,
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


export function withModalDom(fn) {
  const dom = rewardDom();
  const proto = Object.getPrototypeOf(dom.document.body);
  proto.focus = function focus() {
    dom.document.activeElement = this;
    this.dispatchEvent(new dom.Event('focus'));
    // focusin reaches the document in capture order, as in a browser.
    for (const listener of docListeners.get('focusin') || []) listener({ type: 'focusin', target: this });
  };
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
  const { removeAttribute } = proto;
  proto.removeAttribute = function removeIt(key) {
    removeAttribute.call(this, key);
    if (key.startsWith('data-')) delete this.dataset[dataKey(key)];
  };
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
    if (selector === '[data-page-locked]') return this.hasAttribute('data-page-locked');
    if (selector.includes(', ')) return selector.split(', ').some((part) => this.matches(part));
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


// Record renderer-authored markup while allowing the appearance pass to query
// and decorate real fixture nodes. This does not serialize later DOM mutations
// or make layout claims; browser QA covers the resulting painted card.
export function cardMarkupDom(){
  const dom=rewardDom(),create=dom.document.createElement;
  dom.document.createElement=tag=>{
    const el=create(tag),parse=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'innerHTML').set;
    let markup='';
    Object.defineProperty(el,'innerHTML',{get:()=>markup,set(value){markup=value;parse.call(this,value);}});
    el.insertAdjacentHTML=(_where,value)=>{el.innerHTML+=value;};
    return el;
  };
  return dom;
}

// Install a fixture's globals (document, window, Event, ...) on globalThis and
// return a function that restores what was there before.
export function installDom(dom = rewardDom()) {
  const saved = Object.fromEntries(Object.keys(dom).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  return function restore() {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  };
}
