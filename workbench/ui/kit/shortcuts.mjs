// workbench/ui/kit/shortcuts.mjs — one registry for every keyboard shortcut.
//
// Actions are registered per scope: 'global' (the Workbench) or a module id.
// A key press runs the active module's action first, then the global one.
// Combos are written 'Mod+Shift+Z' (Mod = Ctrl or ⌘), 'Alt+1', '?', 'Mod+\\'.
// Users can remap an action; overrides live in localStorage 'wb.shortcuts'.
// The module is DOM-free apart from comboFromEvent (which reads a KeyboardEvent-like object).

export const GLOBAL = 'global';
const STORE_KEY = 'wb.shortcuts';
// Any contenteditable except "false" (so "", "true" and "plaintext-only") counts as typing.
export const TYPING_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const TYPING = TYPING_SELECTOR;
const MODIFIER_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'OS', 'AltGraph'];
const MOD_NAMES = { mod: 'Mod', ctrl: 'Mod', control: 'Mod', cmd: 'Mod', meta: 'Mod', alt: 'Alt', option: 'Alt', shift: 'Shift' };

/** 'ctrl+k' / 'Mod+K' -> 'Mod+K'; returns '' for an empty or key-less combo. */
export function normalizeCombo(text) {
  let mod = false; let alt = false; let shift = false; let key = '';
  for (const raw of String(text || '').split('+')) {
    const part = raw.trim();
    if (!part) continue;
    const name = MOD_NAMES[part.toLowerCase()];
    if (name === 'Mod') mod = true;
    else if (name === 'Alt') alt = true;
    else if (name === 'Shift') shift = true;
    else key = part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
  }
  if (!key) return '';
  return [mod && 'Mod', alt && 'Alt', shift && 'Shift', key].filter(Boolean).join('+');
}

/** The normalized combo a key event makes, or '' for a lone modifier key. */
export function comboFromEvent(ev) {
  const k = ev && ev.key;
  if (!k || MODIFIER_KEYS.includes(k)) return '';
  const named = k.length > 1;
  const letter = /^[A-Za-z]$/.test(k);
  let key = k === ' ' ? 'Space' : letter ? k.toUpperCase() : k;
  // Shift is part of a combo only for named keys and letters; '?' or '!' already say it.
  const shift = Boolean(ev.shiftKey) && (named || letter);
  return [(ev.ctrlKey || ev.metaKey) && 'Mod', ev.altKey && 'Alt', shift && 'Shift', key].filter(Boolean).join('+');
}

/** 'Mod+Shift+Z' -> 'Ctrl+Shift+Z' for display. */
export function comboLabel(combo) {
  return String(combo || '').split('+').map((p) => (p === 'Mod' ? 'Ctrl' : p)).join('+');
}

function readOverrides(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(STORE_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' && normalizeCombo(v)).map(([k, v]) => [k, normalizeCombo(v)]));
  } catch { return {}; }
}

export class ShortcutRegistry {
  #entries = new Map();
  #overrides;
  #storage;
  #listeners = new Set();

  /** storage: anything with getItem/setItem (localStorage, or a stub in tests). */
  constructor({ storage = null } = {}) {
    this.#storage = storage;
    this.#overrides = readOverrides(storage);
  }

  /**
   * Register an action. combo is one combo or an array (the first is shown).
   * inInput: whether it also fires while typing in a field. Defaults to false,
   * so Mod+Z, Mod+A, Mod+C and the like never take keys from a text field
   * unless the registration says inInput: true. Returns an unregister function.
   */
  register(scope, combo, label, handler, { inInput } = {}) {
    const defaults = (Array.isArray(combo) ? combo : [combo]).map(normalizeCombo).filter(Boolean);
    const id = `${scope}:${label}`;
    // Off by default: while typing, an action fires only when it asks for it.
    const entry = { id, scope, label, defaults, handler, inInput: inInput === true };
    this.#entries.set(id, entry);
    this.#emit();
    return () => { if (this.#entries.get(id) === entry) { this.#entries.delete(id); this.#emit(); } };
  }

  /** Effective combos of an action: its override, else its defaults. */
  combos(id) {
    const e = this.#entries.get(id);
    if (!e) return [];
    return this.#overrides[id] ? [this.#overrides[id]] : e.defaults;
  }

  /** Display label of the first combo, e.g. 'Ctrl+K', or ''. */
  labelOf(id) { const c = this.combos(id)[0]; return c ? comboLabel(c) : ''; }

  /**
   * The action a combo runs in this scope, the global one as fallback. Handlers
   * may return false to pass the key on (for example, nothing to undo).
   * Returns true when a handler took the key.
   */
  run(combo, scope = GLOBAL, { typing = false } = {}) {
    for (const e of this.#candidates(combo, scope)) {
      if (typing && !e.inInput) continue;
      if (e.handler() !== false) return true;
    }
    return false;
  }

  /** Run the matching action for a key event; calls preventDefault when one took it. */
  dispatch(ev, scope = GLOBAL) {
    const combo = comboFromEvent(ev);
    if (!combo) return false;
    const typing = Boolean(ev.target && ev.target.closest && ev.target.closest(TYPING));
    const took = this.run(combo, scope, { typing });
    if (took && ev.preventDefault) ev.preventDefault();
    return took;
  }

  /**
   * Give an action a new combo. Refuses (ok false, with the clashing label) when
   * another action in the same scope, or a global one, already uses it.
   */
  setCombo(id, combo) {
    const e = this.#entries.get(id);
    if (!e) return { ok: false, reason: 'unknown' };
    const c = normalizeCombo(combo);
    if (!c) return { ok: false, reason: 'empty' };
    for (const other of this.#entries.values()) {
      if (other.id === id) continue;
      if (other.scope !== e.scope && other.scope !== GLOBAL && e.scope !== GLOBAL) continue;
      if (this.combos(other.id).includes(c)) return { ok: false, reason: 'conflict', label: other.label, scope: other.scope };
    }
    this.#overrides[id] = c;
    this.#save();
    return { ok: true, combo: c };
  }

  resetCombo(id) { if (id in this.#overrides) { delete this.#overrides[id]; this.#save(); } }

  resetAll() { this.#overrides = {}; this.#save(); }

  isOverridden(id) { return id in this.#overrides; }

  /** Every registered action in registration order, for the help overlay and the settings list. */
  list() {
    return [...this.#entries.values()].map((e) => ({
      id: e.id, scope: e.scope, label: e.label, combos: this.combos(e.id), defaults: e.defaults, overridden: this.isOverridden(e.id),
    }));
  }

  /** fn() runs after a registration or a remap. Returns an unsubscribe. */
  onChange(fn) { this.#listeners.add(fn); return () => this.#listeners.delete(fn); }

  #candidates(combo, scope) {
    const found = [];
    for (const s of scope && scope !== GLOBAL ? [scope, GLOBAL] : [GLOBAL]) {
      for (const e of this.#entries.values()) if (e.scope === s && this.combos(e.id).includes(combo)) found.push(e);
    }
    return found;
  }

  #save() {
    try { this.#storage?.setItem(STORE_KEY, JSON.stringify(this.#overrides)); } catch { /* private window: remaps last this page only */ }
    this.#emit();
  }

  #emit() { for (const fn of [...this.#listeners]) fn(); }
}

function browserStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/** The Workbench's registry, remaps kept in this browser's localStorage. */
export const shortcuts = new ShortcutRegistry({ storage: browserStorage() });
