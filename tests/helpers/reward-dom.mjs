// Event/markup fixture for production reward handlers. No layout or trusted-input claims.
export function rewardDom() {
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
      this.dataset = {}; this.style = { setProperty() {}, getPropertyValue() { return ''; }, removeProperty() {} }; this.listeners = new Map();
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
    constructor(type, options = {}) { this.type = type; Object.assign(this, options); }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this.propagationStopped = true; }
    stopImmediatePropagation() { this.immediatePropagationStopped = true; this.stopPropagation(); }
  }
  const document = { createElement: tag => new Element(tag), createTextNode: text => { const el = new Element('text'); el.textContent = text; return el; } };
  document.body = new Element('body');
  document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  document.querySelector = selector => document.body.querySelector(selector);
  return { document, getComputedStyle: () => ({ getPropertyValue: () => '' }), Event: DomEvent, CustomEvent: DomEvent, window: new Element('window'), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener() {}, removeEventListener() {} };
}
