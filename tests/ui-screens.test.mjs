// UI SMOKE — every screen in src/ui/screens mounted from a real game state in a
// fake DOM, in ONE test. It replaces the per-screen wireframe-*, settings,
// tooltip, hud, confirmation-modal, reward-confirm and card-removal tests with
// one broad claim per screen: it mounts without throwing, it shows no raw
// string key or unfilled {token}, every button it draws is wired, the shared
// confirmation modal and the reward confirm flow both confirm and cancel, and
// the reduced-motion setting stops the animation code paths. Co-op screens are
// covered by their own tests (coop.js is skipped here).
//
// The fake DOM below is test-local on purpose: tests/helpers/reward-dom.mjs is
// a smaller fixture that other tests rely on, and this one needs text nodes,
// a selector engine, focus, timers on a controllable clock and Web Animations.
import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Fake clock: setTimeout / setInterval / requestAnimationFrame / performance.now
// all run on one virtual timeline so paced combat playback can be advanced.
// ---------------------------------------------------------------------------
function fakeClock() {
  let now = 0, seq = 0;
  const timers = new Map();
  const add = (fn, ms, args, interval) => {
    const id = ++seq;
    timers.set(id, { fn, at: now + Math.max(0, Number(ms) || 0), args, interval: interval ? Math.max(1, Number(ms) || 0) : 0 });
    return id;
  };
  const clear = (id) => { timers.delete(id); };
  const flushMicro = () => new Promise((resolve) => setImmediate(resolve));
  async function advance(ms) {
    const target = now + ms;
    for (let guard = 0; guard < 20000; guard++) {
      let next = null;
      for (const [id, t] of timers) if (t.at <= target && (!next || t.at < next[1].at || (t.at === next[1].at && id < next[0]))) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      now = Math.max(now, t.at);
      if (t.interval) t.at = now + t.interval; else timers.delete(id);
      if (typeof t.fn === 'function') t.fn(...(t.args || []));
      await flushMicro();
    }
    now = target;
    await flushMicro();
  }
  return {
    get now() { return now; },
    pending: () => timers.size,
    clearAll: () => timers.clear(),
    advance,
    flushMicro,
    setTimeout: (fn, ms, ...args) => add(fn, ms, args, false),
    setInterval: (fn, ms, ...args) => add(fn, ms, args, true),
    clearTimeout: clear,
    clearInterval: clear,
    requestAnimationFrame: (fn) => add(() => fn(now), 16, [], false),
    cancelAnimationFrame: clear,
  };
}

// ---------------------------------------------------------------------------
// Fake DOM
// ---------------------------------------------------------------------------
function fakeDom(clock) {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', times: '×', hellip: '…', rarr: '→', larr: '←', uarr: '↑', darr: '↓', minus: '−', copy: '©', bull: '•', thinsp: ' ', zwj: '‍', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°', plusmn: '±', divide: '÷', check: '✓', star: '★' };
  const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? m));
  const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const stats = { animate: 0, listeners: 0 };
  // Any structural or attribute change bumps the version; query results are
  // cached per root and selector until it moves (screens query in loops).
  let version = 0;
  let document;
  const registry = new Map();
  const customElements = {
    define(name, cls) { if (registry.has(name)) throw new Error(`${name} already defined`); registry.set(name, cls); cls.__tag = name; },
    get: (name) => registry.get(name),
    whenDefined: () => Promise.resolve(),
  };
  const connected = (node) => {
    if (!registry.size) return;
    const visit = (n) => { if (n.nodeType === 1) { n.connectedCallback?.(); n.childNodes.forEach(visit); } };
    visit(node);
  };

  class DomEvent {
    constructor(type, init = {}) {
      this.type = type; this.bubbles = !!init.bubbles; this.cancelable = init.cancelable !== false; this.composed = !!init.composed;
      this.defaultPrevented = false; this.target = null; this.currentTarget = null; this.timeStamp = clock.now; this.isTrusted = false;
      this.eventPhase = 0;
      for (const [k, v] of Object.entries(init)) if (!(k in this) || ['bubbles', 'cancelable'].includes(k) === false) this[k] = v;
      this.detail = init.detail ?? null;
      this.button ??= 0; this.buttons ??= 0; this.clientX ??= 0; this.clientY ??= 0; this.pointerId ??= 1; this.pointerType ??= 'mouse';
      this.key ??= ''; this.code ??= ''; this.shiftKey ??= false; this.ctrlKey ??= false; this.altKey ??= false; this.metaKey ??= false; this.repeat ??= false;
    }
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
    stopPropagation() { this.propagationStopped = true; }
    stopImmediatePropagation() { this.immediatePropagationStopped = true; this.propagationStopped = true; }
    composedPath() { return this._path || []; }
    get returnValue() { return !this.defaultPrevented; }
    get srcElement() { return this.target; }
  }

  class EventTargetBase {
    constructor() { this._listeners = new Map(); }
    addEventListener(type, fn, opts) {
      if (!fn) return;
      const capture = typeof opts === 'boolean' ? opts : !!opts?.capture;
      const list = this._listeners.get(type) || [];
      if (list.some((l) => l.fn === fn && l.capture === capture)) return;
      const entry = { fn, capture, once: !!opts?.once };
      list.push(entry); this._listeners.set(type, list); stats.listeners++;
      opts?.signal?.addEventListener?.('abort', () => this.removeEventListener(type, fn, opts));
    }
    removeEventListener(type, fn, opts) {
      const capture = typeof opts === 'boolean' ? opts : !!opts?.capture;
      const list = this._listeners.get(type); if (!list) return;
      this._listeners.set(type, list.filter((l) => !(l.fn === fn && l.capture === capture)));
    }
    _fire(event, phase) {
      const list = this._listeners.get(event.type) || [];
      event.currentTarget = this;
      for (const l of [...list]) {
        if (phase === 'capture' && !l.capture) continue;
        if (phase === 'bubble' && l.capture) continue;
        if (l.once) this.removeEventListener(event.type, l.fn, { capture: l.capture });
        try { typeof l.fn === 'function' ? l.fn.call(this, event) : l.fn.handleEvent(event); }
        catch (error) { (globalThis.__uiErrors ||= []).push(error); }
        if (event.immediatePropagationStopped) return;
      }
      const prop = this[`on${event.type}`];
      if (phase !== 'capture' && typeof prop === 'function') {
        try { if (prop.call(this, event) === false) event.preventDefault(); } catch (error) { (globalThis.__uiErrors ||= []).push(error); }
      }
    }
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      const path = [];
      for (let n = this; n; n = n.parentNode || (n === document ? globalThis.window : null)) path.push(n);
      event._path = path;
      for (let i = path.length - 1; i >= 1 && !event.propagationStopped; i--) path[i]._fire(event, 'capture');
      if (!event.propagationStopped) this._fire(event, 'target');
      if (event.bubbles) for (let i = 1; i < path.length && !event.propagationStopped; i++) path[i]._fire(event, 'bubble');
      event.currentTarget = null;
      return !event.defaultPrevented;
    }
  }

  class Node extends EventTargetBase {
    constructor(nodeType) { super(); this.nodeType = nodeType; this.parentNode = null; this.childNodes = []; }
    get ownerDocument() { return document; }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === document; }
    get firstChild() { return this.childNodes[0] || null; }
    get lastChild() { return this.childNodes.at(-1) || null; }
    get nextSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) + 1] || null : null; }
    get previousSibling() { const s = this.parentNode?.childNodes; return s ? s[s.indexOf(this) - 1] || null : null; }
    get nodeName() { return this.tagName || (this.nodeType === 3 ? '#text' : this.nodeType === 8 ? '#comment' : '#document-fragment'); }
    getRootNode() { let n = this; while (n.parentNode) n = n.parentNode; return n; }
    hasChildNodes() { return this.childNodes.length > 0; }
    contains(other) { for (let n = other; n; n = n.parentNode) if (n === this) return true; return false; }
    remove() { if (this.parentNode) { version++; const s = this.parentNode.childNodes; s.splice(s.indexOf(this), 1); this.parentNode = null; } }
    _adopt(child) {
      if (child.nodeType === 11) return [...child.childNodes].map((c) => this._adopt(c)).flat();
      child.remove(); child.parentNode = this; return [child];
    }
    _toNode(x) { return typeof x === 'string' ? document.createTextNode(x) : x; }
    appendChild(child) { version++; const nodes = this._adopt(child); for (const c of nodes) this.childNodes.push(c); if (this.isConnected) nodes.forEach(connected); return child; }
    insertBefore(child, ref) {
      if (!ref) return this.appendChild(child);
      version++; const nodes = this._adopt(child); const i = this.childNodes.indexOf(ref);
      this.childNodes.splice(i < 0 ? this.childNodes.length : i, 0, ...nodes); if (this.isConnected) nodes.forEach(connected); return child;
    }
    removeChild(child) { child.remove(); return child; }
    replaceChild(next, old) { this.insertBefore(next, old); old.remove(); return old; }
    append(...xs) { for (const x of xs) this.appendChild(this._toNode(x)); }
    prepend(...xs) { const first = this.firstChild; for (const x of xs) this.insertBefore(this._toNode(x), first); }
    before(...xs) { const p = this.parentNode; if (p) for (const x of xs) p.insertBefore(this._toNode(x), this); }
    after(...xs) { const p = this.parentNode; if (!p) return; let ref = this.nextSibling; for (const x of xs) p.insertBefore(this._toNode(x), ref); }
    replaceWith(...xs) { const p = this.parentNode; if (!p) return; const ref = this.nextSibling; this.remove(); for (const x of xs) p.insertBefore(this._toNode(x), ref); }
    replaceChildren(...xs) { for (const c of [...this.childNodes]) c.remove(); this.append(...xs); }
    get textContent() { return this.childNodes.map((c) => c.nodeType === 8 ? '' : c.textContent).join(''); }
    set textContent(v) { for (const c of [...this.childNodes]) c.remove(); if (v !== '' && v != null) this.appendChild(document.createTextNode(String(v))); }
  }
  class Text extends Node {
    constructor(data) { super(3); this.data = String(data); }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
    get nodeValue() { return this.data; }
    set nodeValue(v) { this.data = String(v); }
    get wholeText() { return this.data; }
    cloneNode() { return new Text(this.data); }
    splitText(offset) { const rest = new Text(this.data.slice(offset)); this.data = this.data.slice(0, offset); this.after(rest); return rest; }
  }
  class Comment extends Node {
    constructor(data) { super(8); this.data = String(data); }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
    cloneNode() { return new Comment(this.data); }
  }
  class DocumentFragment extends Node {
    constructor() { super(11); }
    get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
    get firstElementChild() { return this.children[0] || null; }
    querySelectorAll(sel) { return querySelectorAll(this, sel); }
    querySelector(sel) { return querySelectorAll(this, sel, true)[0] || null; }
    getElementById(id) { return this.querySelector(`#${id}`); }
    cloneNode(deep) { const f = new DocumentFragment(); if (deep) for (const c of this.childNodes) f.appendChild(c.cloneNode(true)); return f; }
    get innerHTML() { return this.childNodes.map(serialize).join(''); }
  }

  function makeStyle() {
    const props = new Map();
    const target = {
      setProperty(k, v) { if (v == null || v === '') props.delete(k); else props.set(k, String(v)); },
      getPropertyValue(k) { return props.get(k) ?? ''; },
      removeProperty(k) { const v = props.get(k) ?? ''; props.delete(k); return v; },
      get cssText() { return [...props].map(([k, v]) => `${k}: ${v};`).join(' '); },
      set cssText(text) { props.clear(); for (const part of String(text).split(';')) { const i = part.indexOf(':'); if (i > 0) props.set(part.slice(0, i).trim(), part.slice(i + 1).trim()); } },
      get length() { return props.size; },
      item(i) { return [...props.keys()][i]; },
    };
    return new Proxy(target, {
      get(t, k) { if (k in t || typeof k === 'symbol') return t[k]; return props.get(kebab(k)) ?? ''; },
      set(t, k, v) { if (k === 'cssText') { t.cssText = v; return true; } if (v == null || v === '') props.delete(kebab(k)); else props.set(kebab(k), String(v)); return true; },
    });
  }

  const clsOf = (el) => el._cls || (el._cls = (el._attrs.get('class') || '').split(/\s+/).filter(Boolean));
  function makeClassList(el) {
    const read = () => clsOf(el);
    const write = (list) => el.setAttribute('class', list.join(' '));
    const api = {
      add: (...n) => { const l = read(); for (const x of n) if (!l.includes(x)) l.push(x); write(l); },
      remove: (...n) => { write(read().filter((x) => !n.includes(x))); },
      contains: (n) => read().includes(n),
      toggle: (n, force) => { const on = force === undefined ? !read().includes(n) : !!force; on ? api.add(n) : api.remove(n); return on; },
      replace: (a, b) => { const l = read(); const i = l.indexOf(a); if (i < 0) return false; l[i] = b; write(l); return true; },
      item: (i) => read()[i] ?? null,
      forEach: (fn) => read().forEach(fn),
      get length() { return read().length; },
      get value() { return read().join(' '); },
      toString: () => read().join(' '),
      [Symbol.iterator]: () => read()[Symbol.iterator](),
      supports: () => true,
    };
    return api;
  }

  const canvasContext = () => new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (k === 'getImageData' || k === 'createImageData') return (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
      if (k === 'canvas') return null;
      if (typeof k === 'symbol') return undefined;
      return () => ({ addColorStop() {} });
    },
    set(t, k, v) { t[k] = v; return true; },
  });

  class Animation extends EventTargetBase {
    constructor(el, keyframes, options) {
      super();
      const duration = typeof options === 'number' ? options : Number(options?.duration) || 0;
      this.effect = { target: el, getKeyframes: () => keyframes, getComputedTiming: () => ({ progress: 0 }), updateTiming() {} };
      this.playState = 'running'; this.currentTime = 0; this.playbackRate = 1; this.onfinish = null; this.oncancel = null; this.id = options?.id || '';
      this._el = el;
      this.finished = new Promise((resolve, reject) => { this._resolve = resolve; this._reject = reject; });
      this.finished.catch(() => {});
      this.ready = Promise.resolve(this);
      const iterations = options?.iterations === Infinity ? Infinity : 1;
      if (iterations !== Infinity) this._timer = clock.setTimeout(() => this.finish(), duration + (Number(options?.delay) || 0));
    }
    finish() { if (this.playState === 'finished') return; clock.clearTimeout(this._timer); this.playState = 'finished'; this._drop(); this._resolve(this); this.onfinish?.({ target: this }); this.dispatchEvent(new DomEvent('finish')); }
    cancel() { if (this.playState === 'idle') return; clock.clearTimeout(this._timer); this.playState = 'idle'; this._drop(); this._reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })); this.oncancel?.({ target: this }); }
    _drop() { const list = this._el._animations; const i = list.indexOf(this); if (i >= 0) list.splice(i, 1); }
    play() { this.playState = 'running'; } pause() { this.playState = 'paused'; } reverse() {} persist() {} commitStyles() {} updatePlaybackRate() {}
  }

  class Element extends Node {
    constructor(tag, ns = null) {
      super(1);
      tag ??= new.target.__tag;
      this.localName = ns ? tag : tag.toLowerCase();
      this._lname = this.localName.toLowerCase();
      this.tagName = ns ? tag : tag.toUpperCase();
      this.namespaceURI = ns || 'http://www.w3.org/1999/xhtml';
      this._attrs = new Map();
      this.style = makeStyle();
      this.classList = makeClassList(this);
      this._animations = [];
      this.scrollTop = 0; this.scrollLeft = 0;
      this.dataset = new Proxy({}, {
        get: (_, k) => typeof k === 'string' ? (this.getAttribute(`data-${kebab(k)}`) ?? undefined) : undefined,
        set: (_, k, v) => { this.setAttribute(`data-${kebab(k)}`, v); return true; },
        deleteProperty: (_, k) => { this.removeAttribute(`data-${kebab(k)}`); return true; },
        has: (_, k) => this.hasAttribute(`data-${kebab(k)}`),
        ownKeys: () => [...this._attrs.keys()].filter((k) => k.startsWith('data-')).map((k) => camel(k.slice(5))),
        getOwnPropertyDescriptor: (_, k) => this.hasAttribute(`data-${kebab(k)}`) ? { enumerable: true, configurable: true, value: this.getAttribute(`data-${kebab(k)}`) } : undefined,
      });
      if (this.localName === 'template') this.content = new DocumentFragment();
      if (this.localName === 'canvas') { this.width = 300; this.height = 150; }
    }
    get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
    get childElementCount() { return this.children.length; }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children.at(-1) || null; }
    get nextElementSibling() { const s = this.parentNode?.childNodes || []; for (let i = s.indexOf(this) + 1; i < s.length; i++) if (s[i].nodeType === 1) return s[i]; return null; }
    get previousElementSibling() { const s = this.parentNode?.childNodes || []; for (let i = s.indexOf(this) - 1; i >= 0; i--) if (s[i].nodeType === 1) return s[i]; return null; }
    get attributes() { return [...this._attrs].map(([name, value]) => ({ name, value })); }
    getAttributeNames() { return [...this._attrs.keys()]; }
    getAttribute(k) { return this._attrs.has(k) ? this._attrs.get(k) : null; }
    setAttribute(k, v) {
      k = String(k).toLowerCase() === k ? k : (this.namespaceURI.includes('svg') ? k : k.toLowerCase());
      const value = String(v);
      if (this._attrs.get(k) === value) return;
      version++;
      this._attrs.set(k, value);
      if (k === 'class') this._cls = null;
      if (k === 'style') this.style.cssText = String(v);
      if (k === 'value' && !this._valueSet) this._value = String(v);
      if (k === 'checked') this._checked = true;
    }
    setAttributeNS(_ns, k, v) { this.setAttribute(k, v); }
    removeAttribute(k) { if (!this._attrs.has(k)) return; version++; this._attrs.delete(k); if (k === 'class') this._cls = null; if (k === 'style') this.style.cssText = ''; }
    hasAttribute(k) { return this._attrs.has(k); }
    toggleAttribute(k, force) { const on = force === undefined ? !this.hasAttribute(k) : !!force; on ? this.setAttribute(k, '') : this.removeAttribute(k); return on; }
    get id() { return this.getAttribute('id') || ''; } set id(v) { this.setAttribute('id', v); }
    get className() { return this.getAttribute('class') || ''; } set className(v) { this.setAttribute('class', v); }
    get hidden() { return this.hasAttribute('hidden'); } set hidden(v) { this.toggleAttribute('hidden', !!v); }
    get disabled() { return this.hasAttribute('disabled'); } set disabled(v) { this.toggleAttribute('disabled', !!v); }
    get inert() { return this.hasAttribute('inert'); } set inert(v) { this.toggleAttribute('inert', !!v); }
    get open() { return this.hasAttribute('open'); } set open(v) { this.toggleAttribute('open', !!v); }
    get required() { return this.hasAttribute('required'); } set required(v) { this.toggleAttribute('required', !!v); }
    get readOnly() { return this.hasAttribute('readonly'); } set readOnly(v) { this.toggleAttribute('readonly', !!v); }
    get multiple() { return this.hasAttribute('multiple'); } set multiple(v) { this.toggleAttribute('multiple', !!v); }
    get draggable() { return this.getAttribute('draggable') === 'true'; } set draggable(v) { this.setAttribute('draggable', String(!!v)); }
    get tabIndex() { const v = this.getAttribute('tabindex'); return v == null ? (['button', 'a', 'input', 'select', 'textarea', 'summary'].includes(this.localName) ? 0 : -1) : Number(v); }
    set tabIndex(v) { this.setAttribute('tabindex', v); }
    get title() { return this.getAttribute('title') || ''; } set title(v) { this.setAttribute('title', v); }
    get type() { return this.getAttribute('type') || (this.localName === 'button' ? 'submit' : this.localName === 'input' ? 'text' : ''); } set type(v) { this.setAttribute('type', v); }
    get name() { return this.getAttribute('name') || ''; } set name(v) { this.setAttribute('name', v); }
    get href() { return this.getAttribute('href') || ''; } set href(v) { this.setAttribute('href', v); }
    get src() { return this.getAttribute('src') || ''; } set src(v) { this.setAttribute('src', v); if (this.localName === 'img') clock.setTimeout(() => { this.complete = true; this.naturalWidth = 64; this.naturalHeight = 64; this.dispatchEvent(new DomEvent('load')); }, 0); }
    get alt() { return this.getAttribute('alt') || ''; } set alt(v) { this.setAttribute('alt', v); }
    get htmlFor() { return this.getAttribute('for') || ''; } set htmlFor(v) { this.setAttribute('for', v); }
    get placeholder() { return this.getAttribute('placeholder') || ''; } set placeholder(v) { this.setAttribute('placeholder', v); }
    get role() { return this.getAttribute('role'); } set role(v) { this.setAttribute('role', v); }
    get lang() { return this.getAttribute('lang') || ''; } set lang(v) { this.setAttribute('lang', v); }
    get min() { return this.getAttribute('min') || ''; } set min(v) { this.setAttribute('min', v); }
    get max() { return this.getAttribute('max') || ''; } set max(v) { this.setAttribute('max', v); }
    get step() { return this.getAttribute('step') || ''; } set step(v) { this.setAttribute('step', v); }
    get ariaLabel() { return this.getAttribute('aria-label'); } set ariaLabel(v) { this.setAttribute('aria-label', v); }
    get ariaPressed() { return this.getAttribute('aria-pressed'); } set ariaPressed(v) { this.setAttribute('aria-pressed', v); }
    get ariaExpanded() { return this.getAttribute('aria-expanded'); } set ariaExpanded(v) { this.setAttribute('aria-expanded', v); }
    get ariaHidden() { return this.getAttribute('aria-hidden'); } set ariaHidden(v) { this.setAttribute('aria-hidden', v); }
    get value() {
      if (this.localName === 'select') { const o = this.options.find((x) => x.selected) || this.options[0]; return o ? o.value : ''; }
      if (this.localName === 'option') return this.getAttribute('value') ?? this.textContent;
      if (this.localName === 'textarea' && !this._valueSet) return this.textContent;
      return this._value ?? (this.getAttribute('value') ?? (this.localName === 'input' && this.type === 'checkbox' ? 'on' : ''));
    }
    set value(v) {
      if (this.localName === 'select') { for (const o of this.options) o._selected = o.value === String(v); version++; return; }
      if (this.localName === 'option') { this.setAttribute('value', v); return; }
      this._valueSet = true; this._value = String(v);
    }
    get valueAsNumber() { return Number(this.value); } set valueAsNumber(v) { this.value = String(v); }
    get checked() { return this._checked ?? false; } set checked(v) { this._checked = !!v; version++; }
    get defaultChecked() { return this.hasAttribute('checked'); }
    get selected() { return this._selected ?? this.hasAttribute('selected'); } set selected(v) { if (v && this.closest('select')) for (const o of this.closest('select').options) o._selected = false; this._selected = !!v; }
    get options() { return this.querySelectorAll('option'); }
    get selectedIndex() { return this.options.findIndex((o) => o.selected); } set selectedIndex(i) { this.options.forEach((o, j) => { o._selected = j === i; }); }
    get selectedOptions() { return this.options.filter((o) => o.selected); }
    get form() { return this.closest('form'); }
    get elements() { return this.querySelectorAll('input, select, textarea, button'); }
    get labels() { return this.id ? document.querySelectorAll(`label[for="${this.id}"]`) : []; }
    get validity() { return { valid: true }; }
    get isContentEditable() { return false; }
    checkValidity() { return true; } reportValidity() { return true; } setCustomValidity() {}
    select() {} setSelectionRange() {}
    get innerHTML() { return this.childNodes.map(serialize).join(''); }
    set innerHTML(html) {
      const target = this.localName === 'template' ? this.content : this;
      for (const c of [...target.childNodes]) c.remove();
      parseInto(target, String(html ?? ''));
    }
    get outerHTML() { return serialize(this); }
    set outerHTML(html) { const f = document.createDocumentFragment(); parseInto(f, html); this.replaceWith(f); }
    get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
    insertAdjacentHTML(pos, html) { const f = document.createDocumentFragment(); parseInto(f, html); this._insertAdjacent(pos, f); }
    insertAdjacentElement(pos, el) { this._insertAdjacent(pos, el); return el; }
    insertAdjacentText(pos, text) { this._insertAdjacent(pos, document.createTextNode(text)); }
    _insertAdjacent(pos, node) {
      switch (String(pos).toLowerCase()) {
        case 'beforebegin': this.before(node); break;
        case 'afterbegin': this.insertBefore(node, this.firstChild); break;
        case 'beforeend': this.appendChild(node); break;
        case 'afterend': this.after(node); break;
        default: throw new Error(`bad position ${pos}`);
      }
    }
    cloneNode(deep) {
      const el = new Element(this.tagName, this.namespaceURI.includes('svg') ? this.namespaceURI : null);
      for (const [k, v] of this._attrs) el.setAttribute(k, v);
      if (deep) for (const c of this.childNodes) el.appendChild(c.cloneNode(true));
      return el;
    }
    matches(sel) { return matchesSelector(this, sel); }
    webkitMatchesSelector(sel) { return this.matches(sel); }
    closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.matches(sel)) return n; return null; }
    querySelectorAll(sel) { return querySelectorAll(this, sel); }
    querySelector(sel) { return querySelectorAll(this, sel, true)[0] || null; }
    getElementsByTagName(tag) { return this.querySelectorAll(tag); }
    getElementsByClassName(c) { return this.querySelectorAll(c.split(/\s+/).map((x) => `.${x}`).join('')); }
    getBoundingClientRect() { const r = this._rect || layoutOf(this); return { x: r.left, y: r.top, left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height, toJSON() { return this; } }; }
    getClientRects() { return [this.getBoundingClientRect()]; }
    get clientWidth() { return this.getBoundingClientRect().width; } get clientHeight() { return this.getBoundingClientRect().height; }
    get offsetWidth() { return this.getBoundingClientRect().width; } get offsetHeight() { return this.getBoundingClientRect().height; }
    get scrollWidth() { return this.getBoundingClientRect().width; } get scrollHeight() { return this.getBoundingClientRect().height; }
    get offsetTop() { return 0; } get offsetLeft() { return 0; } get clientTop() { return 0; } get clientLeft() { return 0; }
    get offsetParent() { return this.parentElement; }
    scrollIntoView() {} scrollTo() {} scrollBy() {} scroll() {}
    focus() {
      if (!this.isConnected) return;
      const prev = document._active;
      if (prev === this) return;
      document._active = this; version++;
      prev?.dispatchEvent(new DomEvent('blur')); prev?.dispatchEvent(new DomEvent('focusout', { bubbles: true, relatedTarget: this }));
      this.dispatchEvent(new DomEvent('focus')); this.dispatchEvent(new DomEvent('focusin', { bubbles: true, relatedTarget: prev }));
    }
    blur() { if (document._active === this) { document._active = null; version++; this.dispatchEvent(new DomEvent('blur')); this.dispatchEvent(new DomEvent('focusout', { bubbles: true })); } }
    click() {
      if (this.disabled) return;
      const ev = new DomEvent('click', { bubbles: true, cancelable: true, detail: 1 });
      const isCheck = this.localName === 'input' && ['checkbox', 'radio'].includes(this.type);
      const before = this.checked;
      if (isCheck) this.checked = this.type === 'radio' ? true : !this.checked;
      const ok = this.dispatchEvent(ev);
      if (isCheck) {
        if (!ok) this.checked = before;
        else { this.dispatchEvent(new DomEvent('input', { bubbles: true })); this.dispatchEvent(new DomEvent('change', { bubbles: true })); }
      }
      if (ok && this.localName === 'button' && this.type === 'submit' && this.form) this.form.requestSubmit(this);
      if (ok && this.hasAttribute('popovertarget')) document.getElementById(this.getAttribute('popovertarget'))?.togglePopover();
      if (ok && this.localName === 'label') { const c = this.htmlFor ? document.getElementById(this.htmlFor) : this.querySelector('input'); c?.click(); }
      if (ok && this.localName === 'summary' && this.parentNode?.localName === 'details') { this.parentNode.open = !this.parentNode.open; this.parentNode.dispatchEvent(new DomEvent('toggle')); }
    }
    requestSubmit() { this.dispatchEvent(new DomEvent('submit', { bubbles: true, cancelable: true })); }
    submit() {} reset() {}
    animate(keyframes, options) { stats.animate++; const a = new Animation(this, keyframes, options); this._animations.push(a); return a; }
    getAnimations() { return [...this._animations]; }
    setPointerCapture(id) { this._capture = id; } releasePointerCapture() { this._capture = null; } hasPointerCapture(id) { return this._capture === id; }
    getContext() { return canvasContext(); }
    toDataURL() { return 'data:image/png;base64,'; } toBlob(cb) { cb?.(null); }
    showPopover() { this._popoverOpen = true; version++; this.dispatchEvent(new DomEvent('toggle', { newState: 'open' })); }
    hidePopover() { if (!this._popoverOpen) return; this._popoverOpen = false; version++; this.dispatchEvent(new DomEvent('toggle', { newState: 'closed' })); }
    togglePopover(force) { const on = force ?? !this._popoverOpen; on ? this.showPopover() : this.hidePopover(); return on; }
    get popover() { return this.getAttribute('popover'); } set popover(v) { this.setAttribute('popover', v); }
    showModal() { this.open = true; } show() { this.open = true; } close() { this.open = false; this.dispatchEvent(new DomEvent('close')); }
    requestFullscreen() { return Promise.reject(new Error('unsupported')); }
    attachShadow() { this.shadowRoot = new DocumentFragment(); return this.shadowRoot; }
    play() { return Promise.resolve(); } pause() {} load() {}
    get ownerSVGElement() { for (let n = this.parentNode; n && n.nodeType === 1; n = n.parentNode) if (n.localName === 'svg') return n; return null; }
    getScreenCTM() { return null; } getCTM() { return null; }
    createSVGPoint() { return { x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }; }
    get viewBox() { const v = (this.getAttribute('viewBox') || '0 0 0 0').split(/[\s,]+/).map(Number); return { baseVal: { x: v[0], y: v[1], width: v[2], height: v[3] } }; }
    getBBox() { return { x: 0, y: 0, width: 100, height: 20 }; }
    getTotalLength() { return 100; } getPointAtLength() { return { x: 0, y: 0 }; }
    get isFakeElement() { return true; }
  }

  // A coarse layout: the page fills the viewport, a scene window sits under
  // the HUD band (a real layout never gives it the whole frame), and any other
  // box is a card-sized 200×100.
  const VIEW = { left: 0, top: 0, width: 1280, height: 800 };
  function layoutOf(el) {
    if (el._lname === 'html' || el._lname === 'body' || el._lname === 'main' || el.id === 'app') return VIEW;
    if (clsOf(el).includes('dialogue-scene')) return { left: 0, top: 96, width: 1280, height: 520 };
    return { left: 0, top: 0, width: 200, height: 100 };
  }
  function serialize(n) {
    if (n.nodeType === 3) return escText(n.data);
    if (n.nodeType === 8) return `<!--${n.data}-->`;
    if (n.nodeType === 11) return n.childNodes.map(serialize).join('');
    const attrs = [...n._attrs].map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
    if (VOID.has(n.localName)) return `<${n.localName}${attrs}>`;
    return `<${n.localName}${attrs}>${n.childNodes.map(serialize).join('')}</${n.localName}>`;
  }

  function parseInto(root, html) {
    const stack = [root];
    const re = /<!--([\s\S]*?)-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<\/\s*([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
    let last = 0, m;
    const text = (s) => { if (s) stack.at(-1).appendChild(new Text(decode(s))); };
    while ((m = re.exec(html))) {
      text(html.slice(last, m.index)); last = re.lastIndex;
      if (m[1] !== undefined) { stack.at(-1).appendChild(new Comment(m[1])); continue; }
      if (m[2]) {
        const tag = m[2].toLowerCase();
        for (let i = stack.length - 1; i > 0; i--) if (stack[i].localName === tag || stack[i].tagName === m[2]) { stack.length = i; break; }
        continue;
      }
      if (!m[3]) continue;
      const rawTag = m[3];
      const inSvg = rawTag.toLowerCase() === 'svg' || stack.some((s) => s.namespaceURI?.includes('svg'));
      const el = inSvg ? new Element(rawTag, 'http://www.w3.org/2000/svg') : document.createElement(rawTag);
      for (const a of m[4].matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        el.setAttribute(inSvg ? a[1] : a[1].toLowerCase(), decode(a[2] ?? a[3] ?? a[4] ?? ''));
      }
      const tag = el.localName.toLowerCase();
      // Implicit closes for the common auto-closing cases.
      if (['p', 'li', 'option'].includes(tag) && stack.at(-1).localName === tag) stack.pop();
      stack.at(-1).appendChild(el);
      if (tag === 'template') { /* children go into content */ }
      if (VOID.has(tag) || m[5]) continue;
      if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'title') {
        const close = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        const end = close < 0 ? html.length : close;
        const body = html.slice(re.lastIndex, end);
        if (body) el.appendChild(new Text(tag === 'textarea' || tag === 'title' ? decode(body) : body));
        const gt = close < 0 ? html.length : html.indexOf('>', close) + 1;
        re.lastIndex = gt; last = gt; continue;
      }
      stack.push(tag === 'template' ? el.content : el);
    }
    text(html.slice(last));
  }

  // --------------------------- selector engine -----------------------------
  const splitTop = (s, sep) => {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const ch of s) {
      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (depth === 0 && ch === sep) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur); return out;
  };
  const cache = new Map();
  function parseSelector(sel) {
    if (cache.has(sel)) return cache.get(sel);
    const list = splitTop(sel, ',').map((part) => {
      const tokens = []; let i = 0; const s = part.trim(); let cur = '';
      let depth = 0, quote = null;
      const pushCompound = () => { if (cur.trim()) tokens.push({ compound: cur.trim() }); cur = ''; };
      for (; i < s.length; i++) {
        const ch = s[i];
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (depth === 0 && (ch === '>' || ch === '+' || ch === '~' || /\s/.test(ch))) {
          pushCompound();
          let comb = /\s/.test(ch) ? ' ' : ch;
          while (i + 1 < s.length && /[\s>+~]/.test(s[i + 1])) { i++; if (s[i] !== ' ' && !/\s/.test(s[i])) comb = s[i]; }
          if (tokens.length && !tokens.at(-1).comb) tokens.push({ comb });
          else if (!tokens.length) tokens.push({ comb, leading: true });
          continue;
        }
        cur += ch;
      }
      pushCompound();
      return tokens.map((t) => t.compound !== undefined ? { compound: parseCompound(t.compound) } : t);
    });
    cache.set(sel, list); return list;
  }
  function parseCompound(c) {
    const parts = []; let i = 0;
    const tag = c.match(/^(\*|[a-zA-Z][\w-]*)/);
    if (tag) { if (tag[1] !== '*') parts.push({ type: 'tag', v: tag[1].toLowerCase() }); i = tag[0].length; }
    while (i < c.length) {
      const ch = c[i];
      if (ch === '#' || ch === '.') {
        const m = c.slice(i + 1).match(/^(?:\\.|[\w-])+/); parts.push({ type: ch === '#' ? 'id' : 'class', v: m[0].replace(/\\(.)/g, '$1') }); i += 1 + m[0].length;
      } else if (ch === '[') {
        let depth = 0, j = i; for (; j < c.length; j++) { if (c[j] === '[') depth++; if (c[j] === ']' && --depth === 0) break; }
        const body = c.slice(i + 1, j); i = j + 1;
        const m = body.match(/^\s*([\w:-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*(i)?)?\s*$/);
        parts.push({ type: 'attr', name: m[1], op: m[2], v: m[3] ?? m[4] ?? m[5], ci: !!m[6] });
      } else if (ch === ':') {
        const m = c.slice(i).match(/^::?([\w-]+)/); i += m[0].length;
        let arg = null;
        if (c[i] === '(') { let depth = 0, j = i; for (; j < c.length; j++) { if (c[j] === '(') depth++; if (c[j] === ')' && --depth === 0) break; } arg = c.slice(i + 1, j); i = j + 1; }
        parts.push({ type: 'pseudo', v: m[1], arg });
      } else throw new Error(`fake DOM: unsupported selector '${c}'`);
    }
    const rank = { tag: 0, id: 1, class: 2, attr: 3, pseudo: 4 };
    return parts.sort((a, b) => rank[a.type] - rank[b.type]);
  }
  const nth = (expr, idx) => {
    expr = expr.replace(/\s/g, '');
    if (expr === 'odd') return idx % 2 === 1; if (expr === 'even') return idx % 2 === 0;
    const m = expr.match(/^([+-]?\d*)n([+-]\d+)?$/);
    if (!m) return idx === Number(expr);
    const a = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]); const b = Number(m[2] || 0);
    return a === 0 ? idx === b : (idx - b) / a >= 0 && (idx - b) % a === 0;
  };
  function matchCompound(el, parts, scope) {
    for (const p of parts) {
      switch (p.type) {
        case 'tag': if (el._lname !== p.v) return false; break;
        case 'id': if (el._attrs.get('id') !== p.v) return false; break;
        case 'class': if (!clsOf(el).includes(p.v)) return false; break;
        case 'attr': {
          const v = el._attrs.get(p.name); if (v == null) return false; if (!p.op) break;
          const a = p.ci ? v.toLowerCase() : v, b = p.ci ? p.v.toLowerCase() : p.v;
          if (p.op === '=' && a !== b) return false;
          if (p.op === '~=' && !a.split(/\s+/).includes(b)) return false;
          if (p.op === '^=' && !a.startsWith(b)) return false;
          if (p.op === '$=' && !a.endsWith(b)) return false;
          if (p.op === '*=' && !a.includes(b)) return false;
          if (p.op === '|=' && !(a === b || a.startsWith(`${b}-`))) return false;
          break;
        }
        case 'pseudo': {
          const sib = () => el.parentNode ? el.parentNode.childNodes.filter((n) => n.nodeType === 1) : [el];
          switch (p.v) {
            case 'not': if (splitTop(p.arg, ',').some((s) => matchesSelector(el, s, scope))) return false; break;
            case 'is': case 'where': case 'matches': if (!matchesSelector(el, p.arg, scope)) return false; break;
            case 'has': if (!splitTop(p.arg, ',').some((s) => querySelectorAll(el, /^\s*[>+~]/.test(s) ? `:scope ${s}` : s, true, el).length)) return false; break;
            case 'scope': if (el !== scope) return false; break;
            case 'root': if (el !== document.documentElement) return false; break;
            case 'first-child': if (sib()[0] !== el) return false; break;
            case 'last-child': if (sib().at(-1) !== el) return false; break;
            case 'only-child': if (sib().length !== 1) return false; break;
            case 'first-of-type': if (sib().filter((n) => n.localName === el.localName)[0] !== el) return false; break;
            case 'last-of-type': if (sib().filter((n) => n.localName === el.localName).at(-1) !== el) return false; break;
            case 'nth-child': if (!nth(p.arg, sib().indexOf(el) + 1)) return false; break;
            case 'nth-last-child': { const s = sib(); if (!nth(p.arg, s.length - s.indexOf(el))) return false; break; }
            case 'nth-of-type': if (!nth(p.arg, sib().filter((n) => n.localName === el.localName).indexOf(el) + 1)) return false; break;
            case 'empty': if (el.childNodes.some((n) => n.nodeType === 1 || (n.nodeType === 3 && n.data))) return false; break;
            case 'checked': if (!(el.checked || el.selected)) return false; break;
            case 'disabled': if (!el.disabled) return false; break;
            case 'enabled': if (el.disabled) return false; break;
            case 'focus': if (document.activeElement !== el) return false; break;
            case 'focus-within': if (!el.contains(document.activeElement)) return false; break;
            case 'focus-visible': case 'hover': case 'active': case 'visited': case 'invalid': case 'placeholder-shown': case 'modal': case 'fullscreen': return false;
            case 'link': case 'any-link': if (!(el.localName === 'a' && el.hasAttribute('href'))) return false; break;
            case 'defined': case 'valid': break;
            case 'popover-open': if (!el._popoverOpen) return false; break;
            default: throw new Error(`fake DOM: unsupported pseudo ':${p.v}'`);
          }
          break;
        }
        default: return false;
      }
    }
    return true;
  }
  function matchTokens(el, tokens, idx, scope) {
    const t = tokens[idx];
    if (!matchCompound(el, t.compound, scope)) return false;
    if (idx === 0) return true;
    const comb = tokens[idx - 1];
    if (comb.leading) return comb.comb === '>' ? el.parentNode === scope : comb.comb === ' ' ? !!scope?.contains(el) && el !== scope : true;
    const prev = idx - 2;
    if (prev < 0) return true;
    switch (comb.comb) {
      case '>': return !!el.parentElement && matchTokens(el.parentElement, tokens, prev, scope);
      case ' ': for (let p = el.parentElement; p; p = p.parentElement) if (matchTokens(p, tokens, prev, scope)) return true; return false;
      case '+': { const s = el.previousElementSibling; return !!s && matchTokens(s, tokens, prev, scope); }
      case '~': for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (matchTokens(s, tokens, prev, scope)) return true; return false;
      default: return false;
    }
  }
  function matchesSelector(el, sel, scope = null) {
    return parseSelector(sel).some((tokens) => matchTokens(el, tokens, tokens.length - 1, scope));
  }
  function querySelectorAll(root, sel, firstOnly = false, scopeOverride = null) {
    if (scopeOverride) return queryUncached(root, sel, firstOnly, scopeOverride);
    const cache = root._qcache && root._qcache.version === version ? root._qcache : (root._qcache = { version, all: new Map(), first: new Map() });
    const bucket = firstOnly ? cache.first : cache.all;
    let hit = bucket.get(sel);
    if (!hit) { hit = queryUncached(root, sel, firstOnly, null); bucket.set(sel, hit); }
    return hit.slice();
  }
  function queryUncached(root, sel, firstOnly, scopeOverride) {
    const out = []; const scope = scopeOverride || root;
    const lists = parseSelector(sel);
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        if (lists.some((tokens) => matchTokens(c, tokens, tokens.length - 1, scope))) { out.push(c); if (firstOnly) return true; }
        if (walk(c)) return true;
      }
      return false;
    };
    walk(root);
    return out;
  }

  // ------------------------------ document ---------------------------------
  class Document extends Node {
    constructor() {
      super(9);
      this.documentElement = new Element('html'); this.documentElement.parentNode = this; this.childNodes.push(this.documentElement);
      this.head = new Element('head'); this.body = new Element('body');
      this.documentElement.appendChild(this.head); this.documentElement.appendChild(this.body);
      this._active = null; this.title = 'AshenSpire'; this.hidden = false; this.visibilityState = 'visible'; this.readyState = 'complete';
      this.fullscreenElement = null; this.fullscreenEnabled = false; this.baseURI = 'http://localhost/';
      this.fonts = { ready: Promise.resolve(), load: () => Promise.resolve([]), check: () => true, add() {}, addEventListener() {}, status: 'loaded' };
    }
    get ownerDocument() { return null; }
    get isConnected() { return true; }
    get activeElement() { return this._active && this._active.isConnected ? this._active : this.body; }
    set activeElement(v) { this._active = v; }
    get defaultView() { return globalThis.window; }
    get scrollingElement() { return this.documentElement; }
    get scrollHeight() { return 800; }
    createElement(tag) { const cls = registry.get(String(tag).toLowerCase()); return cls ? new cls() : new Element(tag); }
    createElementNS(ns, tag) { return new Element(tag, ns?.includes('svg') ? ns : null); }
    createTextNode(t) { return new Text(t); }
    createComment(t) { return new Comment(t); }
    createDocumentFragment() { return new DocumentFragment(); }
    createEvent() { return new DomEvent(''); }
    getElementById(id) { return querySelectorAll(this.documentElement, `#${CSS.escape(id)}`, true)[0] || null; }
    querySelectorAll(sel) { return [...(this.documentElement.matches(sel) ? [this.documentElement] : []), ...querySelectorAll(this.documentElement, sel)]; }
    querySelector(sel) { return this.documentElement.matches(sel) ? this.documentElement : querySelectorAll(this.documentElement, sel, true)[0] || null; }
    getElementsByTagName(tag) { return this.querySelectorAll(tag); }
    getElementsByClassName(c) { return this.documentElement.getElementsByClassName(c); }
    elementFromPoint() { return null; } elementsFromPoint() { return []; }
    getSelection() { return { removeAllRanges() {}, addRange() {}, toString: () => '', rangeCount: 0 }; }
    createRange() { return { selectNodeContents() {}, setStart() {}, setEnd() {}, collapse() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }), getClientRects: () => [] }; }
    createTreeWalker(root, what = 0xFFFFFFFF, filter = null) {
      const nodes = []; const visit = (n) => { for (const c of n.childNodes) { if ((c.nodeType === 3 && (what & 4)) || (c.nodeType === 1 && (what & 1))) { const ok = !filter || (typeof filter === 'function' ? filter(c) : filter.acceptNode(c)) === 1; if (ok) nodes.push(c); } visit(c); } };
      visit(root); let i = -1;
      return { root, get currentNode() { return i < 0 ? root : nodes[i]; }, nextNode() { i++; return nodes[i] || null; } };
    }
    exitFullscreen() { return Promise.resolve(); }
    hasFocus() { return true; }
    execCommand() { return false; }
  }
  document = new Document();

  const mediaQuery = (q) => ({
    media: q,
    get matches() { return /prefers-reduced-motion/.test(q) ? false : /min-width:\s*(\d+)/.test(q) ? Number(q.match(/min-width:\s*(\d+)/)[1]) <= 1280 : /orientation:\s*landscape/.test(q) || /hover:\s*hover|pointer:\s*fine/.test(q); },
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null,
  });
  class Observer { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  class Storage {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k, v) { this.map.set(k, String(v)); }
    removeItem(k) { this.map.delete(k); }
    clear() { this.map.clear(); }
    key(i) { return [...this.map.keys()][i] ?? null; }
    get length() { return this.map.size; }
  }
  class Audio extends EventTargetBase { constructor(src) { super(); this.src = src; this.volume = 1; this.loop = false; this.paused = true; this.currentTime = 0; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } load() {} cloneNode() { return new Audio(this.src); } }
  const Image = function Image(w, h) { const el = new Element('img'); if (w) el.width = w; if (h) el.height = h; return el; };
  const CSS = { supports: () => false, escape: (s) => String(s).replace(/([^\w-])/g, '\\$1'), registerProperty() {} };
  const clsEvent = (name) => ({ [name]: class extends DomEvent {} })[name];

  class FormData {
    constructor(form) { this.entries = []; if (form) for (const f of form.querySelectorAll('input, select, textarea')) { if (!f.name || f.disabled) continue; if (['checkbox', 'radio'].includes(f.type) && !f.checked) continue; this.entries.push([f.name, f.value]); } }
    get(k) { return this.entries.find(([n]) => n === k)?.[1] ?? null; }
    getAll(k) { return this.entries.filter(([n]) => n === k).map(([, v]) => v); }
    has(k) { return this.entries.some(([n]) => n === k); }
    set(k, v) { this.entries = this.entries.filter(([n]) => n !== k); this.entries.push([k, String(v)]); }
    append(k, v) { this.entries.push([k, String(v)]); }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  const windowTarget = new EventTargetBase();
  const globals = {
    document, Node, Element, HTMLElement: Element, SVGElement: Element, HTMLInputElement: Element, HTMLButtonElement: Element, HTMLCanvasElement: Element, HTMLImageElement: Element, HTMLDialogElement: Element,
    Text, Comment, DocumentFragment, Document,
    Event: DomEvent, CustomEvent: clsEvent('CustomEvent'), KeyboardEvent: clsEvent('KeyboardEvent'), MouseEvent: clsEvent('MouseEvent'), PointerEvent: clsEvent('PointerEvent'),
    FocusEvent: clsEvent('FocusEvent'), WheelEvent: clsEvent('WheelEvent'), TouchEvent: clsEvent('TouchEvent'), UIEvent: clsEvent('UIEvent'), InputEvent: clsEvent('InputEvent'), AnimationEvent: clsEvent('AnimationEvent'), TransitionEvent: clsEvent('TransitionEvent'),
    NodeFilter: { SHOW_ALL: 0xFFFFFFFF, SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
    innerWidth: 1280, innerHeight: 800, outerWidth: 1280, outerHeight: 800, devicePixelRatio: 1, scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0, screen: { width: 1280, height: 800, orientation: { type: 'landscape-primary', addEventListener() {} } },
    visualViewport: Object.assign(new EventTargetBase(), { width: 1280, height: 800, scale: 1, offsetTop: 0, offsetLeft: 0 }),
    matchMedia: mediaQuery,
    getComputedStyle: (el) => new Proxy({ getPropertyValue: (k) => el?.style?.getPropertyValue?.(k) || '' }, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' ? (el?.style?.[k] || '') : undefined) }),
    ResizeObserver: Observer, IntersectionObserver: Observer, MutationObserver: Observer, PerformanceObserver: Observer,
    localStorage: new Storage(), sessionStorage: new Storage(),
    location: { href: 'http://localhost/index.html', search: '', hash: '', pathname: '/index.html', protocol: 'http:', hostname: 'localhost', host: 'localhost', origin: 'http://localhost', port: '', reload() {}, assign() {}, replace() {} },
    history: { pushState() {}, replaceState() {}, back() {}, state: null, length: 1 },
    Audio, Image, CSS, customElements, FormData,
    getSelection: () => document.getSelection(),
    scrollTo() {}, scrollBy() {}, open() { return null; }, close() {}, alert() {}, confirm: () => true, prompt: () => null, print() {}, focus() {}, blur() {},
    addEventListener: (...a) => windowTarget.addEventListener(...a),
    removeEventListener: (...a) => windowTarget.removeEventListener(...a),
    dispatchEvent: (e) => { windowTarget._fire(e, 'target'); return !e.defaultPrevented; },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval,
    requestAnimationFrame: clock.requestAnimationFrame, cancelAnimationFrame: clock.cancelAnimationFrame,
    requestIdleCallback: (fn) => clock.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 10 }), 1), cancelIdleCallback: clock.clearTimeout,
    fetch: () => Promise.reject(new Error('offline test')),
  };
  windowTarget._fire = windowTarget._fire.bind(windowTarget);
  // The window is the last hop of every bubbling event.
  globals.window = globalThis;
  const navigatorStub = { userAgent: 'node-test', language: 'en', languages: ['en'], platform: 'test', maxTouchPoints: 0, onLine: true, getGamepads: () => [], vibrate: () => false, clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') }, userActivation: { isActive: true, hasBeenActive: true }, hardwareConcurrency: 4, storage: { persist: () => Promise.resolve(false), persisted: () => Promise.resolve(false), estimate: () => Promise.resolve({}) }, serviceWorker: undefined };
  return { globals, navigatorStub, windowTarget, document, stats, DomEvent };
}

function installDom(clock) {
  const dom = fakeDom(clock);
  const saved = new Map();
  const define = (key, value) => {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true, enumerable: false });
  };
  for (const [k, v] of Object.entries(dom.globals)) define(k, v);
  define('navigator', dom.navigatorStub);
  // window._fire lets bubbling reach window listeners.
  globalThis._fire = (e, phase) => dom.windowTarget._fire(e, phase);
  saved.set('_fire', undefined);
  const realPerfNow = performance.now.bind(performance);
  const realDateNow = Date.now;
  const epoch = realDateNow();
  performance.now = () => clock.now;
  Date.now = () => epoch + clock.now;
  const restore = () => {
    performance.now = realPerfNow; Date.now = realDateNow;
    for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; }
  };
  return { ...dom, restore };
}


const SRC = new URL('../src/', import.meta.url).href;
const load = (path) => import(SRC + path);

test('UI smoke: every screen mounts from a real game state, reads cleanly and is wired', { timeout: 120000 }, async () => {
  const clock = fakeClock();
  const dom = installDom(clock);
  globalThis.__uiErrors = [];
  const consoleError = console.error, consoleWarn = console.warn;
  const logged = [];
  console.error = (...a) => logged.push(['error', a.map(String).join(' ')]);
  console.warn = (...a) => logged.push(['warn', a.map(String).join(' ')]);
  try {
    await runSmoke(clock, dom);
    // Warnings are allowed (the coarse fake layout makes the map's framing
    // warn); an error logged by any screen is a failure.
    assert.deepEqual(logged.filter(([kind]) => kind === 'error').map(([, m]) => m.slice(0, 300)), [], 'no screen logged an error');
  } finally {
    clock.clearAll();
    console.error = consoleError; console.warn = consoleWarn;
    dom.restore();
    delete globalThis.__uiErrors;
  }
});

async function runSmoke(clock, dom) {
  const { contentBundle } = await load('content/index.js');
  const { createRegistries } = await load('model/registries.js');
  const { configureTooltipGlossary } = await load('ui/components/tooltipGlossary.js');
  const { createSaveManager, createMemoryStorage } = await load('engine/save.js');
  const { createRunState, createDeck, createIdGen } = await load('model/state.js');
  const { createRng, seedFromString, seedToString } = await load('engine/rng.js');
  const { buildActMap, drawSeatOrder } = await load('engine/actmap.js');
  const { seatAtTier } = await load('model/seats.js');

  const registries = createRegistries(contentBundle);
  configureTooltipGlossary(registries);
  const saves = createSaveManager(createMemoryStorage());
  saves.ensureProfile?.();
  const meta = saves.loadMeta();
  meta.settings = { ...(meta.settings || {}), seenTutorial: true };
  const calls = [];
  const spy = (name, ret) => (...args) => { calls.push(name); return typeof ret === 'function' ? ret(...args) : ret; };

  function newRun(classId = 'reaver', seedString = 'SHOWCASE') {
    const seed = seedFromString(seedString);
    const run = createRunState({ seed, classId, registries, profileMeta: meta });
    run.seedString = seedToString(seed);
    run.customization = { name: 'Forsaken', glyph: '⚔', tint: 'gold' };
    run.custom = { ascension: 0, mods: {}, deckMode: 'standard' };
    run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
    run.path = []; run.seenEvents = []; run.lastEncounters = [];
    const rng = createRng(seed);
    run.seatOrder = drawSeatOrder(registries, rng, {});
    run.mapGraph = buildActMap(registries, rng, seatAtTier(run.seatOrder, run.actNumber), run.actNumber, null, { history: run.history });
    return { run, rng };
  }

  // ---- the per-screen audit --------------------------------------------------
  const RAW_KEY = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/;
  const TOKEN = /\{[a-zA-Z_][\w.]*\}/;
  // A quoted "undefined" is prose about the word (the changelog has one).
  const JUNK = /(?<!")\bundefined\b(?!")|\bNaN\b|\[object Object\]/;
  const HANDLER_EVENTS = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'change', 'input', 'submit', 'contextmenu'];
  const hidden = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) if (n.hidden || n.getAttribute('aria-hidden') === 'true' || n.inert || n.style.display === 'none') return true; return false; };
  const DOCUMENT_DELEGATED = ['.hint-bar .hint[data-action]'];
  const hasHandler = (el) => {
    // Declarative platform wiring (a native popover toggle) needs no script.
    if (el.hasAttribute('popovertarget') || el.hasAttribute('commandfor')) return true;
    // Controls whose press is delegated at the document by their component
    // (hints.js binds the hint-bar chips there so a press always ends).
    if (DOCUMENT_DELEGATED.some((sel) => el.matches(sel)) && (document._listeners.get('pointerdown') || []).length) return true;
    for (let n = el; n && n !== document.body; n = n.parentNode) {
      if (HANDLER_EVENTS.some((t) => (n._listeners.get(t) || []).length || typeof n[`on${t}`] === 'function')) return true;
    }
    return false;
  };
  const CONTROLS = 'button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="radio"], [role="checkbox"], [role="switch"], a[href], input, select, textarea, summary';
  const off = (n) => n.hidden || n.style.display === 'none';
  const controls = (root) => root.querySelectorAll(CONTROLS).filter((c) => !hidden(c) && !c.disabled && c.getAttribute('aria-disabled') !== 'true');
  const where = (el) => `${el.localName}${el.id ? `#${el.id}` : ''}${el.className ? `.${String(el.className).split(/\s+/).join('.')}` : ''}`;
  const LABELS = ['aria-label', 'title', 'placeholder', 'alt'];
  // What is on screen: text and labels outside hidden subtrees. Editable
  // fields hold the player's (or author's) own text, not the UI's.
  const texts = (root) => {
    const out = [];
    const walk = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { const t = c.data.trim(); if (t) out.push([t, n]); continue; }
        if (c.nodeType !== 1 || off(c) || c._lname === 'script' || c._lname === 'style' || c._lname === 'textarea') continue;
        for (const k of LABELS) { const v = c._attrs.get(k); if (v) out.push([v.trim(), c, k]); }
        walk(c);
      }
    };
    walk(root);
    return out;
  };
  const audited = [];
  function audit(name, root = document.body, { minControls = 1 } = {}) {
    const words = texts(root);
    assert.ok(words.length > 0, `${name}: renders text`);
    for (const [t, node, attr] of words) {
      const at = () => `${where(node)}${attr ? `[${attr}]` : ''}`;
      if (RAW_KEY.test(t)) assert.fail(`${name}: raw string key on screen: ${JSON.stringify(t)} in ${at()}`);
      // Help text that teaches the author the tokens ("Use {name} for…") is not a leak.
      if (TOKEN.test(t) && !/\buse \{|\{\w+\} (uses|is|means)\b/i.test(t)) assert.fail(`${name}: unfilled token on screen: ${JSON.stringify(t)} in ${at()}`);
      if (JUNK.test(t)) assert.fail(`${name}: junk value on screen: ${JSON.stringify(t)} in ${at()}`);
    }
    const list = controls(root);
    assert.ok(list.length >= minControls, `${name}: has at least ${minControls} control(s), found ${list.length}`);
    // Form fields may be read when their form commits, and links and
    // <summary> are native; the controls that must carry script are the rest.
    const unwired = list.filter((c) => !['input', 'select', 'textarea', 'summary', 'a'].includes(c.localName)).filter((c) => !hasHandler(c) && !(c.type === 'submit' && c.form && hasHandler(c.form)));
    assert.deepEqual(unwired.map((c) => c.outerHTML.slice(0, 160)), [], `${name}: every control is wired`);
    assertNoErrors(name);
    audited.push(name);
  }
  function assertNoErrors(name) {
    const errors = globalThis.__uiErrors.splice(0);
    const brief = (e) => `${e?.name}: ${e?.message} @ ${(String(e?.stack).split('\n').find((l) => l.includes('/src/')) || '').trim()}`;
    assert.deepEqual([...new Set(errors.map(brief))], [], `${name}: no handler threw`);
  }
  // Presses every live control once (a fresh snapshot each pass), letting
  // time run between presses; overlays opened by a press are cleared.
  async function pressAll(name, root, { skip = () => false, keepOverlays = false } = {}) {
    const base = new Set(document.body.children);
    let pressed = 0;
    for (const c of controls(root)) {
      if (!c.isConnected || hidden(c) || c.disabled || skip(c)) continue;
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      c.click();
      pressed++;
      await clock.advance(40);
      if (!keepOverlays) for (const extra of [...document.body.children]) if (!base.has(extra)) extra.remove();
    }
    await clock.advance(1000);
    assertNoErrors(`${name} (press all)`);
    return pressed;
  }
  function freshApp() {
    for (const c of [...document.body.childNodes]) c.remove();
    document.body.className = '';
    const app = document.createElement('main'); app.id = 'app';
    document.body.append(app);
    return app;
  }

  // ---- title ----------------------------------------------------------------
  {
    const { mountTitle } = await load('ui/screens/title.js');
    const titleOpts = (slots) => ({ slots, meta, registries, ...Object.fromEntries(['onContinue', 'onNew', 'onDelete', 'onHistory', 'onProfile', 'onSettings', 'onOffline', 'onSettingsChange', 'onCollapse', 'onQuit', 'onCustom', 'onLan', 'onCompendium'].map((k) => [k, spy(`title.${k}`)])) });
    let app = freshApp();
    mountTitle(app, titleOpts([1, 2, 3].map((slot) => ({ slot, summary: null }))));
    await clock.advance(500);
    audit('title (empty slots)');
    await pressAll('title', app);
    app = freshApp();
    const { run, rng } = newRun();
    saves.saveRun(run, rng, 1);
    const slots = saves.listSlots().map(({ slot, summary }) => ({ slot, summary: summary && { ...summary, className: registries.classes.get(summary.class)?.name ?? summary.class } }));
    mountTitle(app, titleOpts(slots));
    await clock.advance(500);
    audit('title (a saved climb)');
    await pressAll('title (saved)', app);
  }

  // ---- character creation, custom climb, draft ---------------------------------
  {
    const { mountCustomize } = await load('ui/screens/customize.js');
    let app = freshApp();
    mountCustomize(app, { registries, meta, defaultSeedString: 'SHOWCASE', onBack: spy('create.back'), onStart: spy('create.start'), slot: 1 });
    await clock.advance(500);
    audit('create');
    await pressAll('create', app);
    // Begin refuses until the gated flow is complete…
    app.querySelector('#cz-start').click();
    assert.ok(!calls.includes('create.start'), 'create: Begin refuses an unchosen flow');
    audit('create (Begin refused)');
    app = freshApp();
    mountCustomize(app, { registries, meta, defaultSeedString: 'SHOWCASE', onBack: spy('create.back'), onStart: spy('create.start'), catalog: true });
    await clock.advance(200);
    audit('create (component catalogue)');
    // …and the preselected catalogue begins at once, naming the class.
    let started = null;
    app = freshApp();
    mountCustomize(app, { registries, meta, defaultSeedString: 'SHOWCASE', onBack: spy('create.back'), onStart: (config) => { started = config; }, catalog: true });
    app.querySelector('#cz-start').click();
    assert.equal(started?.classId, registries.classes.all()[0].id, 'create: Begin hands the chosen class to the climb');
    assert.equal(started?.seedString, 'SHOWCASE');

    const { mountCustomRun } = await load('ui/screens/customRun.js');
    app = freshApp();
    mountCustomRun(app, { registries, defaultSeedString: 'SHOWCASE', onBack: spy('custom.back'), onStart: spy('custom.start') });
    await clock.advance(200);
    audit('custom climb');
    await pressAll('custom climb', app);

    const { mountDraft } = await load('ui/screens/draft.js');
    app = freshApp();
    let picks = null;
    mountDraft(app, { registries, classId: 'reaver', rng: createRng(seedFromString('DRAFT')), rounds: 2, onDone: (p) => { picks = p; } });
    audit('draft');
    for (let i = 0; i < 6 && !picks; i++) {
      const card = app.querySelector('.card, [data-card-id], .draft-choice');
      card?.click(); await clock.advance(20);
      card?.click(); await clock.advance(20);
      app.querySelectorAll('button').find((b) => !b.disabled && /confirm|take|pick|choose/i.test(b.textContent))?.click();
      await clock.advance(50);
    }
    assert.ok(Array.isArray(picks) && picks.length === 2, 'draft: two rounds pick two cards');
    assertNoErrors('draft');
  }

  // ---- menus reached from the title -------------------------------------------
  {
    const { mountHistory } = await load('ui/screens/history.js');
    let app = freshApp();
    mountHistory(app, { meta: { ...meta, results: [
      { victory: true, class: 'reaver', floor: 12, act: 3, seed: 'SHOWCASE', at: Date.now(), fightsWon: 11 },
      { victory: false, class: 'reaver', floor: 4, act: 1, seed: 'ABC', at: Date.now(), custom: { ascension: 1 } },
    ] }, onBack: spy('history.back') });
    audit('history');
    await pressAll('history', app);
    app = freshApp();
    mountHistory(app, { meta, onBack: spy('history.back') });
    audit('history (empty)');

    const { mountCompendium } = await load('ui/screens/compendium.js');
    app = freshApp();
    mountCompendium(app, { registries, meta, onBack: spy('compendium.back') });
    await clock.advance(200);
    audit('compendium');
    await pressAll('compendium', app);

    const { renderAboutSection, renderChangelogSection } = await load('ui/screens/about.js');
    app = freshApp();
    renderAboutSection(app, {});
    const log = document.createElement('div'); app.append(log);
    renderChangelogSection(log, {});
    audit('about', app, { minControls: 0 });

    const { renderControls } = await load('ui/screens/controls.js');
    app = freshApp();
    const changed = [];
    renderControls(app, { settings: { ...meta.settings }, onChange: (c) => changed.push(c) });
    audit('controls');
    await pressAll('controls', app);

    const { mountLobby } = await load('ui/screens/lobby.js');
    app = freshApp();
    mountLobby(app, { registries, meta, defaultSeedString: 'SHOWCASE', onBack: spy('lobby.back'), onStart: spy('lobby.start') });
    await clock.advance(200);
    audit('lobby');
    await pressAll('lobby', app);

    const { openProfileArchive } = await load('ui/screens/profileArchive.js');
    freshApp();
    openProfileArchive({ saves, onRestored: spy('profile.restored') });
    await clock.advance(200);
    audit('profile archive');
    await pressAll('profile archive', document.body, { keepOverlays: true });

    const { mountProfileNotice } = await load('ui/screens/profileNotice.js');
    for (const state of ['newer', 'corrupt']) {
      app = freshApp();
      mountProfileNotice(app, { saves, status: { ...saves.profileStatus(), state, quarantined: true }, onContinue: spy('notice.continue') });
      audit(`profile notice (${state})`);
      await pressAll(`profile notice (${state})`, app);
    }

    const { mountPrologue } = await load('ui/screens/prologue.js');
    app = freshApp();
    let finished = false;
    const stop = mountPrologue(app, { settings: meta.settings, run: newRun().run, onFinish: () => { finished = true; }, onSettings: spy('prologue.settings') });
    await clock.advance(1500);
    audit('prologue');
    const buttons = () => app.querySelectorAll('.prologue-controls button');
    for (let i = 0; i < 6 && !finished; i++) { buttons().at(-1).click(); await clock.advance(1200); }
    buttons().find((b) => /skip/i.test(b.textContent))?.click();
    await clock.advance(500);
    assert.ok(finished, 'prologue: Continue and Skip reach the end');
    if (typeof stop === 'function') stop();
    assertNoErrors('prologue (played through)');
  }

  // ---- settings ------------------------------------------------------------------
  const settingsModule = await load('ui/screens/settings.js');
  {
    const { openSettings, renderSettings, settingsCategories } = settingsModule;
    freshApp();
    const changes = [];
    const settingsMeta = { ...meta, settings: { ...meta.settings } };
    openSettings({ meta: settingsMeta, onChange: (c) => { changes.push(c); Object.assign(settingsMeta.settings, c); return { ok: true }; }, saves, onOffline: spy('settings.offline') });
    await clock.advance(300);
    audit('settings');
    // Every category and group tab paints its rows without a raw key.
    const tabs = () => document.body.querySelectorAll('[role="tab"], .as-rail-item, .category-nav button').filter((b) => !hidden(b));
    const seenTabs = new Set();
    for (let pass = 0; pass < 3; pass++) {
      for (const tabButton of tabs()) {
        const label = tabButton.textContent.trim();
        if (seenTabs.has(label) || !tabButton.isConnected) continue;
        seenTabs.add(label);
        tabButton.click();
        await clock.advance(60);
        audit(`settings › ${label}`);
      }
    }
    assert.ok(seenTabs.size >= settingsCategories().length, `settings: every category is reachable (${[...seenTabs].join(', ')})`);
    // Flip every toggle/checkbox on the current page: each commits a change.
    // General: every section × option group, flipping each switch and
    // choosing each dropdown's other value — each commits through onChange.
    const before = changes.length;
    const choose = async (select, value) => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); await clock.advance(30); };
    let flipped = 0;
    for (const page of ['General', 'Accessibility']) {
      tabs().find((b) => b.textContent.trim() === page).click(); await clock.advance(60);
      const sections = document.body.querySelector('[data-general-select]')?.options.map((o) => o.value) || [null];
      for (const section of sections) {
        if (section) await choose(document.body.querySelector('[data-general-select]'), section);
        for (const topic of (document.body.querySelector('[data-general-topic]')?.options || []).map((o) => o.value)) {
          await choose(document.body.querySelector('[data-general-topic]'), topic);
          audit(`settings › ${page} › ${section ? `${section} › ` : ''}${topic}`, document.body, { minControls: 0 });
          for (const box of document.body.querySelectorAll('.as-toggle[data-key]:not([data-action])').filter((b) => !hidden(b) && !b.disabled && b.dataset.key !== 'reducedMotion')) { box.click(); flipped++; await clock.advance(5); }
          for (const select of document.body.querySelectorAll('select.set-choice-select').filter((b) => !hidden(b))) { const other = select.options.find((o) => !o.selected); if (other) await choose(select, other.value); }
        }
      }
    }
    assert.ok(flipped > 5 && changes.length > before + flipped / 2, `settings: switches and dropdowns commit through onChange (${flipped} switches, ${changes.length - before} changes)`);
    assertNoErrors('settings toggles');
    // Reduced motion is an Accessibility switch that commits the setting the
    // shell turns into the body class (asserted against combat below).
    tabs().find((b) => /accessibility/i.test(b.textContent)).click(); await clock.advance(60);
    await choose(document.body.querySelector('[data-general-topic]'), document.body.querySelector('[data-general-topic]').options.find((o) => /motion/i.test(o.value)).value);
    const reduced = document.body.querySelector('.as-toggle[data-key="reducedMotion"]');
    assert.ok(reduced && !hidden(reduced), 'settings: Reduced motion is on the Accessibility page');
    const wasReduced = settingsMeta.settings.reducedMotion === true;
    reduced.click(); await clock.advance(30);
    assert.equal(changes.at(-1)?.reducedMotion, !wasReduced, 'settings: the Reduced motion switch commits reducedMotion');
    // The inline render (the title's own settings pane) paints the same rows.
    const app = freshApp();
    renderSettings(app, { settings: { ...meta.settings }, onChange: () => ({ ok: true }), saves });
    audit('settings (inline)');
    await pressAll('settings (inline)', app);
  }

  // ---- the act map, the world atlas and a legacy dungeon -------------------------------
  const hudCallbacks = (prefix) => ({
    onMenu: spy(`${prefix}.menu`), onArmoury: spy(`${prefix}.armoury`), onLoad: spy(`${prefix}.load`), onQuitWithoutSave: spy(`${prefix}.quitNoSave`),
    onSettingsChange: spy(`${prefix}.settingsChange`, { ok: true }), onSave: spy(`${prefix}.save`, { ok: true }), onQuit: spy(`${prefix}.quit`),
    quickControls: {
      fullscreen: { read: () => ({ checked: false, disabled: true, condition: 'Unavailable in this browser.' }), activate: spy(`${prefix}.fullscreen`, {}) },
      music: { read: () => ({ checked: true, condition: 'Music on.' }), activate: spy(`${prefix}.music`, { changed: { musicEnabled: false } }) },
    },
  });
  {
    const { mountMap, releaseMapScreen } = await load('ui/screens/map.js');
    const { run } = newRun();
    let picked = null;
    let app = freshApp();
    mountMap(app, { registries, run, meta, onPick: (id) => { picked = id; }, onSettings: spy('map.settings'), ...hudCallbacks('map') });
    await clock.advance(1500);
    audit('map');
    // Pick an entrance node: select, then commit (the two-beat choice).
    const start = run.mapGraph.startIds[0];
    for (let i = 0; i < 4 && !picked; i++) {
      const node = app.querySelector(`[data-node-id="${start}"], [data-id="${start}"], [data-node="${start}"]`);
      assert.ok(node, 'map: the entrance node is drawn');
      node.click(); await clock.advance(200);
      app.querySelectorAll('button').find((b) => !hidden(b) && !b.disabled && /travel|enter|go|confirm|continue/i.test(b.textContent))?.click();
      await clock.advance(200);
    }
    assert.equal(picked, start, 'map: selecting and committing an entrance picks it');
    await pressAll('map', app, { skip: (c) => /quit|load/i.test(c.textContent) });
    // Mid-climb: stand two floors up with a path behind.
    app = freshApp();
    const next = run.mapGraph.nodes[start].next?.[0] ?? run.mapGraph.nodes[start].edges?.[0];
    run.path = [start, ...(next ? [next] : [])]; run.mapNodeId = run.path.at(-1); run.floor = run.path.length;
    mountMap(app, { registries, run, meta, onPick: spy('map.pick'), onSettings: spy('map.settings'), ...hudCallbacks('map') });
    await clock.advance(1500);
    audit('map (mid-climb)');
    releaseMapScreen?.();

    const { ATLAS, generateJourney, journeyGraph } = await load('model/worldAtlas.js');
    const { mountWorldAtlas } = await load('ui/screens/worldAtlas.js');
    const atlasRun = newRun().run;
    atlasRun.journey = generateJourney(atlasRun.seedString, 'wanderer', ATLAS, { townsPerActMax: registries.balance.atlas.townsPerActMax });
    atlasRun.mapGraph = journeyGraph(atlasRun.journey);
    const j = atlasRun.journey;
    atlasRun.mapNodeId = j.currentNodeId; atlasRun.path = j.visitedNodeIds.slice();
    atlasRun.floor = atlasRun.mapGraph.nodes[j.currentNodeId].floor; atlasRun.actNumber = ATLAS.world[j.currentNodeId].difficultyAct;
    app = freshApp();
    mountWorldAtlas(app, { run: atlasRun, registries, serviceContext: { healMult: 1, refillCounts: settingsModule.resolveGraceRefill({}).counts, rng: createRng(1) },
      onTravel: spy('atlas.travel'), onAction: spy('atlas.action'), onSave: spy('atlas.save'), onMenu: spy('atlas.menu'), onArmoury: spy('atlas.armoury'), onQuit: spy('atlas.quit') });
    await clock.advance(1500);
    audit('world atlas');
    await pressAll('world atlas', app, { skip: (c) => /quit/i.test(c.textContent) });

    const { LEGACY_DUNGEONS, beginDungeon } = await load('model/legacyDungeon.js');
    const { mountLegacyDungeon } = await load('ui/screens/legacyDungeon.js');
    const dungeonRun = newRun().run;
    const parent = Object.values(dungeonRun.mapGraph.nodes).find((n) => n.type === 'boss');
    dungeonRun.mapNodeId = parent.id; dungeonRun.floor = parent.floor; dungeonRun.path = [parent.id];
    beginDungeon(dungeonRun, LEGACY_DUNGEONS[0], parent.id);
    app = freshApp();
    mountLegacyDungeon(app, { run: dungeonRun, registries, meta, hud: hudCallbacks('dungeon'), onTravel: spy('dungeon.travel'), onInspect: spy('dungeon.inspect'), onLeave: spy('dungeon.leave') });
    await clock.advance(1500);
    audit('legacy dungeon');
    await pressAll('legacy dungeon', app, { skip: (c) => /quit/i.test(c.textContent) });
    releaseMapScreen?.();
  }

  // ---- combat: paced playback of a real card play and a real enemy turn --------------
  const { createCombat } = await load('engine/combat.js');
  const { resolveHandRules } = await load('model/handRules.js');
  const { runMods, resolveSwapCostRule } = await load('model/loadout.js');
  const { rollEncounter } = await load('engine/encounters.js');
  const { mountCombat } = await load('ui/screens/combat.js');
  const { reducedMotionRequested } = await load('ui/motion.js');
  function startFight({ pool = 'normal', seed = 'SHOWCASE', enemyHp = null } = {}) {
    const { run, rng } = newRun('reaver', seed);
    const seat = seatAtTier(run.seatOrder, run.actNumber);
    const enc = registries.encounters.get(rollEncounter(registries, rng, { pool, seat }));
    const combat = createCombat({
      ratingsRules: registries.balance.combatRatings || null,
      handRules: resolveHandRules(meta.settings, contentBundle.attributes),
      registries, rng,
      player: {
        classId: run.class, attributes: run.attributes, derivedStatRuleSnapshot: run.derivedStatRuleSnapshot, skills: run.skills, coreTags: run.coreTags,
        maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
        energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, damageBySchoolAdd: run.damageBySchoolAdd,
        equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot, equipmentAttackSlotCount: run.equipmentAttackSlotCount,
        removedAttackSlotIds: run.removedAttackSlotIds, equipmentPoolDeficits: run.equipmentPoolDeficits, itemUpgradeLevels: run.itemUpgradeLevels,
        itemMounts: run.itemMounts, armamentLevels: run.armamentLevels, deck: run.deck, relicIds: run.relics,
        flasks: [{ flaskId: 'crimsonFlask' }, { flaskId: 'blightCoating' }], flaskCharges: run.flaskCharges, loadout: run.loadout,
      },
      enemyIds: enc.enemies, hpMult: 1, enemyStatuses: [],
      swapCostRule: resolveSwapCostRule(registries, meta),
      playerStatuses: [...runMods(registries, run.loadout, run.class).startStatuses],
    });
    if (enemyHp != null) for (const enemy of combat.enemies) if (enemy.alive) enemy.hp = Math.min(enemy.hp, enemyHp);
    return { run, combat, enc };
  }
  function mountFight(app, fight, extra = {}) {
    const ended = [];
    mountCombat(app, {
      registries, run: fight.run, combat: fight.combat, meta, readSettings: () => meta.settings,
      onEnd: (result) => ended.push(result), onSettings: spy('combat.settings'), showTutorial: false, onTutorialDone: spy('combat.tutorialDone'),
      ...hudCallbacks('combat'), ...extra,
    });
    return ended;
  }
  // The hand's first affordable card that targets an enemy, played by the
  // two-beat tap: select the card, then the enemy it lands on.
  async function playAttack(app, combat) {
    const target = combat.enemies.find((e) => e.alive);
    const cards = app.querySelectorAll('.hand .card, .hand-list .card, [data-instance-id]').filter((c) => !hidden(c));
    assert.ok(cards.length > 0, 'combat: the hand is drawn');
    const handBefore = combat.piles.hand.length;
    for (const card of cards) {
      if (card.classList.contains('unplayable') || card.getAttribute('aria-disabled') === 'true') continue;
      const tap = (el) => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true })); el.click(); };
      tap(card); await clock.advance(30);
      const box = app.querySelector(`[data-eid="${target.id}"]`);
      if (box) { tap(box); await clock.advance(30); }
      if (combat.piles.hand.length < handBefore) return true;
      tap(card); await clock.advance(30); // a self card confirms on the second tap
      if (combat.piles.hand.length < handBefore) return true;
      app.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    return false;
  }
  const confirmTap = async (button) => {
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true }));
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', isPrimary: true }));
    button.click();
    await clock.advance(100);
  };
  {
    let app = freshApp();
    const fight = startFight();
    const ended = mountFight(app, fight);
    await clock.advance(1500);
    audit('combat');
    const hpBefore = fight.combat.enemies.reduce((sum, e) => sum + e.hp, 0);
    const animateBefore = dom.stats.animate;
    assert.ok(await playAttack(app, fight.combat), 'combat: a real card play resolves from the hand');
    await clock.advance(4000); // paced playback: swing, hit-stop, floaters, ghost bars
    assert.ok(dom.stats.animate > animateBefore, 'combat: the play is animated at full motion');
    assert.ok(fight.combat.enemies.reduce((sum, e) => sum + e.hp, 0) <= hpBefore, 'combat: the card landed');
    audit('combat (after a card)');
    // End Turn reviews first: Back leaves the turn alone, END TURN commits it.
    const turn = fight.combat.turn;
    await confirmTap(app.querySelector('.end-turn'));
    const cancel = document.body.querySelector('.confirmation-cancel');
    assert.ok(cancel, 'combat: End Turn opens its review');
    audit('combat › end turn review', document.body.querySelector('.confirmation-modal'));
    await confirmTap(cancel); await clock.advance(800);
    assert.equal(document.body.querySelector('.confirmation-modal'), null, 'confirmation: Back closes the review');
    assert.equal(fight.combat.turn, turn, 'confirmation: Back commits nothing');
    await confirmTap(app.querySelector('.end-turn'));
    await clock.advance(800); // past the input shield
    await confirmTap(document.body.querySelector('.confirmation-confirm'));
    await clock.advance(8000); // the enemies' turn plays out, paced
    assert.ok(fight.combat.turn > turn || fight.combat.result, 'confirmation: END TURN commits the enemy turn');
    assert.equal(fight.combat.phase === 'player' || !!fight.combat.result, true, 'combat: control returns after the enemy turn');
    audit('combat (next turn)');
    assert.equal(ended.length, fight.combat.result ? 1 : 0, 'combat: onEnd fires only when the fight ends');
    await pressAll('combat', app, { skip: (c) => c.matches('.end-turn') || /quit|load/i.test(c.textContent) });

    // A killing blow: the kill cam and the victory hand-off.
    app = freshApp();
    const killFight = startFight({ seed: 'KILLCAM', enemyHp: 1 });
    const killEnded = mountFight(app, killFight);
    await clock.advance(1500);
    for (let i = 0; i < 4 && !killFight.combat.result; i++) { await playAttack(app, killFight.combat); await clock.advance(3000); }
    await clock.advance(10000);
    assert.equal(killFight.combat.result, 'victory', 'combat: one-HP enemies fall to real card plays');
    assert.deepEqual(killEnded, ['victory'], 'combat: the victory is handed off once');
    assertNoErrors('combat (kill cam)');

    // A boss fight opens with its board, the same audit.
    app = freshApp();
    const boss = startFight({ pool: 'boss', seed: 'BOSS' });
    mountFight(app, boss, { showTutorial: true });
    await clock.advance(1500);
    audit('combat (boss, first-fight tutorial)');
    await pressAll('combat tutorial', document.body, { keepOverlays: true, skip: (c) => c.matches('.end-turn') || /quit|load/i.test(c.textContent) || !c.closest('.tutorial, [class*="tutorial"]') });

    // REDUCED MOTION: the setting is a class on <body>; with it on, the same
    // real card play runs no Web Animation at all.
    app = freshApp();
    document.body.classList.add('reduced-motion');
    assert.ok(reducedMotionRequested(), 'reduced motion: the body class is the setting');
    const still = startFight({ seed: 'STILL' });
    mountFight(app, still);
    await clock.advance(1500);
    const stillBefore = dom.stats.animate;
    assert.ok(await playAttack(app, still.combat), 'reduced motion: the card still plays');
    await clock.advance(4000);
    assert.equal(dom.stats.animate - stillBefore, 0, 'reduced motion: no animation runs');
    document.body.classList.remove('reduced-motion');
    assert.ok(!reducedMotionRequested());
    assertNoErrors('combat (reduced motion)');
  }

  // ---- rewards: the card confirm flow, the elite chest, the boss relic chooser --------------
  {
    const { mountRewards } = await load('ui/screens/reward.js');
    const { grantSmithingReward } = await load('model/smithing.js');
    const { rollBossRelicChoices, rollEliteChest } = await load('engine/encounters.js');
    const rewardRun = () => {
      const { run, rng } = newRun();
      run.level = { xp: 40, level: 3, unspentPoints: 0 };
      run.skills = { 'item:blade': { xp: 18, level: 2, pendingDrafts: 0 }, [`class:${run.class}`]: { xp: 20, level: 1, pendingDrafts: 0 }, ...(run.skills || {}) };
      return { run, rng };
    };
    // A full victory: cinders, a three-card choice, a flask, an armament and a relic.
    let app = freshApp();
    let { run, rng } = rewardRun();
    const pool = registries.classes.get(run.class).cardPool;
    const checkpoint = { states: {}, chosenCardId: null };
    let persisted = 0, done = 0;
    mountRewards(app, {
      registries, run, saves, rng, checkpoint,
      onCollectArmament: () => true, onPersist: () => { persisted++; },
      rewards: { title: 'VICTORY', cinders: 32, cardIds: pool.slice(0, 3), flaskId: 'crimsonFlask', relicId: 'forsakenMedallion', armamentId: 'greatsword',
        smithingStoneReceipt: grantSmithingReward(registries, run, 'elite', 'smoke:reward'),
        xpGains: { level: 24, tracks: { 'item:blade': 18, [`class:${run.class}`]: 10 }, levelUps: 1 } },
      onDone: () => { done++; },
    });
    await clock.advance(300);
    audit('reward');
    // Card: open the row, a selection never collects, Back keeps it, Confirm takes it once.
    app.querySelector('[data-kind="card"]').click(); await clock.advance(50);
    audit('reward › card choice');
    const confirm = () => app.querySelector('#reward-card-confirm');
    assert.equal(confirm().disabled, true, 'reward confirm: nothing selected cannot confirm');
    const deckBefore = run.deck.length;
    app.querySelectorAll('.reward-row .card')[1].click(); await clock.advance(30);
    assert.equal(confirm().disabled, false, 'reward confirm: a selection enables Confirm');
    assert.equal(run.deck.length, deckBefore, 'reward confirm: selecting never collects');
    app.querySelector('#reward-back').click(); await clock.advance(30);
    assert.equal(run.deck.length, deckBefore, 'reward cancel: Back collects nothing');
    app.querySelector('[data-kind="card"]').click(); await clock.advance(30);
    assert.equal(app.querySelectorAll('.reward-selected').length, 1, 'reward cancel: Back keeps the selection');
    const take = confirm(); take.click(); take.click(); await clock.advance(30);
    assert.equal(run.deck.length, deckBefore + 1, 'reward confirm: Confirm takes exactly one card');
    assert.equal(checkpoint.states.card, 'taken');
    audit('reward (card taken)');
    await pressAll('reward', app);
    assert.ok(persisted > 0, 'reward: takes persist');

    // Elite: the chest's three options, one opened.
    app = freshApp();
    ({ run, rng } = rewardRun());
    const chest = rollEliteChest(registries, rng, run, {});
    assert.ok(chest?.options?.length >= 2, 'elite chest: several options roll');
    const chestCheckpoint = { states: {}, chosenCardId: null };
    mountRewards(app, { registries, run, saves, rng, checkpoint: chestCheckpoint, onPersist: () => {}, onCollectArmament: () => true,
      rewards: { title: 'ELITE FELLED', cinders: 40, cardIds: pool.slice(3, 6), chest }, onDone: spy('reward.done') });
    await clock.advance(200);
    audit('reward (elite)');
    app.querySelector('[data-kind="chest"]').click(); await clock.advance(30);
    audit('reward › elite chest');
    const options = app.querySelectorAll('.reward-row .reward-chest-option');
    assert.equal(options.length, chest.options.length, 'elite chest: every option is drawn');
    options.at(-1).click(); await clock.advance(30);
    app.querySelector('#reward-card-confirm').click(); await clock.advance(30);
    assert.equal(chestCheckpoint.states.chest, 'taken', 'elite chest: the chosen option is taken');
    await pressAll('reward (elite)', app);

    // Boss: a choice of three boss relics; Skip leaves them all, a pick takes one.
    for (const pick of [false, true]) {
      app = freshApp();
      ({ run, rng } = rewardRun());
      const relicIds = rollBossRelicChoices(registries, rng, run.relics);
      const relicsBefore = [...run.relics];
      const bossCheckpoint = { states: {}, chosenCardId: null };
      mountRewards(app, { registries, run, saves, rng, checkpoint: bossCheckpoint, onPersist: () => {}, rewards: { title: 'BOSS DEFEATED', cinders: 90, relicIds }, onDone: spy('reward.done') });
      await clock.advance(200);
      app.querySelector('[data-kind="relic"]').click(); await clock.advance(30);
      audit(`reward › boss relic chooser`);
      const tiles = app.querySelectorAll('.reward-row .reward-relic');
      assert.deepEqual(tiles.map((t) => t.dataset.relicId), relicIds, 'boss relics: one tile per offered relic');
      if (pick) {
        tiles[2].click(); await clock.advance(30);
        app.querySelector('#reward-card-confirm').click(); await clock.advance(30);
        assert.deepEqual(run.relics, [...relicsBefore, relicIds[2]], 'boss relics: exactly the chosen relic');
      } else {
        app.querySelector('#reward-relic-skip').click(); await clock.advance(30);
        assert.deepEqual(run.relics, relicsBefore, 'boss relics: Skip takes none');
      }
      audit('reward (boss, answered)');
    }
    // The empty door: a bare Continue.
    app = freshApp();
    mountRewards(app, { registries, run: rewardRun().run, rewards: { title: 'VICTORY' }, onDone: spy('reward.empty.done') });
    audit('reward (empty)');
    await pressAll('reward (empty)', app);
  }

  // ---- rooms: merchant, shrine (rest, level up, smith), event, dialogue, quest board -------
  const roomRun = () => {
    const made = newRun();
    made.run.floor = 8;
    made.run.deck.push(...createDeck(registries.classes.get(made.run.class).cardPool.slice(0, 10), createIdGen('smoke')));
    return made;
  };
  {
    const { mountShop } = await load('ui/screens/shop.js');
    const { buildShopStock } = await load('engine/encounters.js');
    const { run, rng } = roomRun();
    run.cinders = 999;
    run.flasks.push({ flaskId: 'crimsonFlask' });
    run.shopStock = buildShopStock(registries, rng, run);
    const app = freshApp();
    const changed = [];
    mountShop(app, { registries, run, meta, hud: hudCallbacks('shop'), onChanged: () => changed.push(run.cinders), onArmamentPurchased: spy('shop.armament'), onLeave: spy('shop.leave') });
    await clock.advance(300);
    audit('merchant');
    // A purchase reviews in the shared confirmation modal: Back spends nothing,
    // the named buy spends the named price.
    const offer = app.querySelectorAll('[data-beat-action]').find((b) => !hidden(b) && !b.disabled && /buy|purchase/i.test(b.dataset.beatAction));
    assert.ok(offer, 'merchant: an offer is armed through the second-beat door');
    const cinders = run.cinders;
    await confirmTap(offer);
    audit('merchant › purchase review', document.body.querySelector('.confirmation-modal'));
    await confirmTap(document.body.querySelector('.confirmation-cancel'));
    assert.equal(run.cinders, cinders, 'merchant: Back spends nothing');
    await confirmTap(app.querySelectorAll('[data-beat-action]').find((b) => b.dataset.beatAction === offer.dataset.beatAction && !b.disabled && !hidden(b)));
    await clock.advance(800);
    await confirmTap(document.body.querySelector('.confirmation-confirm'));
    await clock.advance(800);
    assert.ok(run.cinders < cinders, 'merchant: the confirmed purchase is paid for');
    assert.ok(changed.length > 0, 'merchant: the purchase persists');
    audit('merchant (after a purchase)');
    await pressAll('merchant', app, { skip: (c) => /quit|load/i.test(c.textContent) });
  }
  {
    const { mountRest } = await load('ui/screens/rest.js');
    const { createLocationVisit, arriveAt } = await load('engine/locations.js');
    const { smithServicesAt } = await load('model/cardExtraction.js');
    for (const openPanel of [null, 'level', 'smith', 'flask']) {
      const { run, rng } = roomRun();
      run.level.unspentPoints = 5;
      run.smithingStones = 2;
      run.hp = Math.max(1, run.hp - 20);
      const visit = createLocationVisit({ run, registries, rng }, 'shrine', { healMult: 1, refillCounts: settingsModule.resolveGraceRefill({}).counts });
      arriveAt(visit);
      const app = freshApp();
      let left = false;
      const hpBefore = run.hp;
      mountRest(app, { registries, run, visit, hud: hudCallbacks('rest'), openPanel, healMult: 1, refill: visit.refill, meta,
        services: visit.services.smith ? smithServicesAt(registries, 'shrine', rng) : null,
        onReallocate: spy('rest.reallocate'), onLevelUp: spy('rest.levelUp'), multiUse: openPanel === 'level', onDone: () => { left = true; } });
      await clock.advance(300);
      audit(`shrine${openPanel ? ` › ${openPanel}` : ''}`, document.body);
      if (!openPanel) {
        // Rest heals through its review; the shrine then leaves.
        const rest = app.querySelectorAll('[data-beat-action]').find((b) => /rest/i.test(b.dataset.beatAction) && !b.disabled && !hidden(b));
        assert.ok(rest, 'shrine: Rest is armed');
        await confirmTap(rest);
        await clock.advance(800);
        const yes = document.body.querySelector('.confirmation-confirm');
        if (yes) await confirmTap(yes);
        await clock.advance(1500);
        assert.ok(run.hp > hpBefore || left, 'shrine: resting heals');
      }
      await pressAll(`shrine ${openPanel || 'menu'}`, document.body, { skip: (c) => /quit|load/i.test(c.textContent) });
    }
  }
  {
    const { mountEvent } = await load('ui/screens/event.js');
    for (const eventId of ['graveOfTheNameless', registries.events.all().find((e) => e.id !== 'graveOfTheNameless')?.id, 'lastLantern']) {
      const { run, rng } = roomRun();
      const app = freshApp();
      let done = false;
      mountEvent(app, { registries, run, hud: hudCallbacks('event'), meta, rng, eventId, onDone: () => { done = true; } });
      await clock.advance(1200);
      audit(`event ${eventId}`);
      // Read through the speech, then answer the last choice (Leave, where
      // there is one) through its review; whatever follows is read to the end.
      let answered = 0;
      for (let i = 0; i < 20 && !done; i++) {
        const choice = app.querySelectorAll('[data-beat-action="eventChoice"]').filter((b) => !hidden(b) && !b.disabled).at(-1);
        if (choice && answered < 3) {
          answered++;
          await confirmTap(choice);
          await clock.advance(800);
          const yes = document.body.querySelector('.confirmation-confirm');
          if (yes) { await confirmTap(yes); await clock.advance(800); }
          continue;
        }
        const next = app.querySelector('#dialogue-continue:not([disabled])') || app.querySelectorAll('button').find((b) => !hidden(b) && !b.disabled && /continue|leave|done/i.test(b.textContent));
        if (!next) break;
        next.click();
        await clock.advance(800);
      }
      assert.ok(answered > 0, `event ${eventId}: a choice is offered and answered`);
      assert.ok(done, `event ${eventId}: a choice resolves and the room is left`);
      assertNoErrors(`event ${eventId}`);
    }
  }
  {
    const { mountQuestBoard } = await load('ui/screens/questBoard.js');
    const { questBoardModel } = await load('ui/models/QuestBoardModel.js');
    const { ATLAS, generateJourney, journeyGraph } = await load('model/worldAtlas.js');
    const { run } = newRun('reaver', 'QUESTS');
    run.journey = generateJourney(run.seedString, 'wanderer', ATLAS, { townsPerActMax: registries.balance.atlas.townsPerActMax });
    run.mapGraph = journeyGraph(run.journey);
    const owner = Object.keys(run.mapGraph.nodes).find((id) => { try { return questBoardModel({ registries, run, ownerNodeId: id }).offers.some((o) => o.actionable); } catch { return false; } });
    assert.ok(owner, 'quest board: a town on the journey posts an open quest');
    const app = freshApp();
    mountQuestBoard(app, { registries, run, meta, ownerNodeId: owner, hud: hudCallbacks('quests'), onOpen: spy('quests.open'), onDone: spy('quests.done') });
    await clock.advance(300);
    audit('quest board');
    await pressAll('quest board', app, { skip: (c) => /quit|load/i.test(c.textContent) });
    assert.ok(calls.includes('quests.open'), 'quest board: an offer opens its exchange');
  }

  // ---- the smith's mount services, the Armoury, the end of a climb, the combat test build ----
  {
    const { openMountService, mountServiceOffer, mountReceiptLine } = await load('ui/screens/smithServices.js');
    for (const service of ['install', 'extract']) {
      const { run } = roomRun();
      run.smithingStones = 3;
      const offer = mountServiceOffer(registries, run, service);
      assert.equal(offer.service, service);
      const app = freshApp();
      openMountService(app, { service, registries, run, meta, returnFocusElement: app, place: 'shrine', onCommitted: spy(`smith.${service}.committed`), onBack: spy(`smith.${service}.back`) });
      await clock.advance(300);
      audit(`smith › ${service}`, document.body, { minControls: 1 });
      await pressAll(`smith › ${service}`, document.body);
    }
    assert.equal(mountReceiptLine(null), '');
    assert.match(mountReceiptLine({ service: 'extract', cardName: 'Cleave', itemName: 'Longsword', spent: 1 }), /Extracted Cleave from Longsword\. Spent 1 Stone\./);
  }
  {
    const { mountEquipment, viewIds, resetArmouryTraySession } = await load('ui/screens/equipment.js');
    for (const [view, destination] of [...viewIds().map((v) => [v, '']), [null, 'cards'], [null, 'character']]) {
      resetArmouryTraySession();
      const { run } = roomRun();
      freshApp();
      const armouryMeta = { ...meta, settings: { ...meta.settings, ...(view ? { equipView: view } : {}) } };
      const panel = mountEquipment(document.body, { registries, run, meta: armouryMeta, destination, inCombat: false,
        onChange: (loadout, settingChange) => { run.loadout = loadout; if (settingChange) Object.assign(armouryMeta.settings, settingChange); },
        onClose: spy('armoury.close') });
      assert.ok(panel, `armoury ${view || destination}: mounts`);
      await clock.advance(300);
      audit(`armoury ${view || destination}`);
      if (view === viewIds()[0]) await pressAll(`armoury ${view}`, document.body, { keepOverlays: true, skip: (c) => /close|done/i.test(c.textContent + (c.getAttribute('aria-label') || '')) });
      panel.close?.();
      await clock.advance(100);
    }
  }
  {
    const { mountGameOver } = await load('ui/screens/gameover.js');
    for (const victory of [false, true]) {
      const { run } = newRun();
      run.floor = victory ? run.mapGraph.floors ?? 12 : 4;
      run.stats = { fightsWon: victory ? 11 : 3, damageDealt: 640, damageTaken: 212 };
      if (!victory) run.hp = 0;
      const app = freshApp();
      mountGameOver(app, { registries, game: run, victory, earned: victory ? [{ name: 'Twinblade', kind: 'armament' }] : [], onTitle: spy('gameover.title'), onHistory: spy('gameover.history') });
      await clock.advance(1500);
      audit(`game over (${victory ? 'victory' : 'defeat'})`);
      await pressAll(`game over (${victory ? 'victory' : 'defeat'})`, app);
    }
    assert.ok(calls.includes('gameover.title'), 'game over: the way back to the title is wired');
  }
  {
    const { mountCombatTest } = await load('ui/screens/combatTest.js');
    const app = freshApp();
    mountCombatTest(app, { params: new URLSearchParams('build=bleed&encounter=basic'), meta });
    audit('combat test build (setup)');
    app.querySelector('form').requestSubmit();
    await clock.advance(1500);
    audit('combat test build (fight)');
    document.body.classList.remove('combat-test');
  }
  // Every screen module (co-op aside) was mounted and audited above.
  for (const screen of ['title', 'create', 'custom climb', 'draft', 'history', 'compendium', 'about', 'controls', 'lobby', 'profile archive', 'profile notice', 'prologue',
    'settings', 'map', 'world atlas', 'legacy dungeon', 'combat', 'reward', 'merchant', 'shrine', 'event', 'quest board', 'smith', 'armoury', 'game over', 'combat test build']) {
    assert.ok(audited.some((name) => name === screen || name.startsWith(`${screen} `)), `audited: ${screen}`);
  }
  assert.ok(dom.stats.animate > 0, 'the fake DOM saw real Web Animations');
}
