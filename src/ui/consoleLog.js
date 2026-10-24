// Bounded, session-only console capture. Leaf: only the leaf strings table is imported.
import { t, tFull } from './strings.js';
export const CONSOLE_MAX_ENTRIES = 300;
export const CONSOLE_MAX_TEXT = 8192;
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'];

/** Snapshot values without invoking getters or walking an unbounded object. */
export function consoleValueText(value) {
  let budget = 120;
  const seen = new WeakSet();
  const visit = (item, depth) => {
    if (--budget < 0) return '[Truncated]';
    if (typeof item === 'string') return item.slice(0, CONSOLE_MAX_TEXT);
    if (typeof item === 'function') return '[Function]';
    if (item === null || typeof item !== 'object') return String(item);
    if (seen.has(item)) return '[Circular]';
    seen.add(item);
    if (item instanceof Error) {
      const dataText = (key, fallback) => {
        let owner = item;
        for (let i = 0; owner && i < 5; i++, owner = Object.getPrototypeOf(owner)) {
          const descriptor = Object.getOwnPropertyDescriptor(owner, key);
          if (descriptor) return 'value' in descriptor && typeof descriptor.value === 'string' ? descriptor.value : '[Getter]';
        }
        return fallback;
      };
      // Browser stacks are usually own data. Lazy/accessor stacks are omitted:
      // even a native lazy stack getter may evaluate custom name/message hooks.
      const stack = Object.getOwnPropertyDescriptor(item, 'stack');
      return stack && 'value' in stack && typeof stack.value === 'string'
        ? stack.value.slice(0, CONSOLE_MAX_TEXT)
        : `${dataText('name', 'Error')}: ${dataText('message', '')}`.slice(0, CONSOLE_MAX_TEXT);
    }
    if (depth >= 4) return '[Object]';
    const values = [];
    let count = 0;
    // for-in lets us stop enumerating large objects early; descriptors avoid getters.
    for (const key in item) {
      if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
      if (count++ >= 30 || budget <= 0) { values.push('…'); break; }
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      values.push(`${key.slice(0, 120)}: ${descriptor && 'value' in descriptor ? visit(descriptor.value, depth + 1) : '[Getter]'}`);
    }
    return `${Array.isArray(item) ? '[' : '{'}${values.join(', ')}${Array.isArray(item) ? ']' : '}'}`;
  };
  try { return visit(value, 0).slice(0, CONSOLE_MAX_TEXT); }
  catch { return '[Uninspectable value]'; }
}

export function createConsoleRecorder() {
  const entries = [];
  const listeners = new Set();
  let recording = false;
  const append = (level, ...args) => {
    if (recording) return;
    recording = true;
    try {
      let text = '';
      for (const value of args.slice(0, 20)) {
        text += (text ? ' ' : '') + consoleValueText(value);
        if (text.length >= CONSOLE_MAX_TEXT) break;
      }
      entries.push(Object.freeze({ time: new Date().toISOString(), level, text: text.slice(0, CONSOLE_MAX_TEXT) }));
      if (entries.length > CONSOLE_MAX_ENTRIES) entries.splice(0, entries.length - CONSOLE_MAX_ENTRIES);
      for (const listener of listeners) { try { listener(); } catch { /* Diagnostics must never break a console call. */ } }
    } finally { recording = false; }
  };
  const install = (target) => {
    const installed = [];
    for (const level of LEVELS) {
      try {
        const native = target[level];
        if (typeof native !== 'function') continue;
        const wrapper = function (...args) {
          try { return Reflect.apply(native, this, args); }
          finally { try { append(level, ...args); } catch { /* Preserve native behavior. */ } }
        };
        target[level] = wrapper;
        installed.push({ level, native, wrapper });
      } catch { /* Some hosts expose read-only console methods. */ }
    }
    return () => { for (const { level, native, wrapper } of installed) if (target[level] === wrapper) target[level] = native; };
  };
  return Object.freeze({ append, install, getEntries: () => entries.slice(), subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } });
}

export const consoleRecorder = createConsoleRecorder();
// Imported through debuglog during boot, regardless of whether the shortcut is on.
if (typeof window !== 'undefined' && window.console) consoleRecorder.install(window.console);

/** Metadata is supplied by chrome, keeping this module free of game imports. */
export function consoleLogText(metadata = {}) {
  return [t('debugChrome.consoleExportTitle'), ...Object.entries(metadata).map(([key, value]) => `${key}: ${value}`),
    t('debugChrome.consoleExportTime', { time: new Date().toISOString() }), tFull('debugChrome.consoleRetention', { max: CONSOLE_MAX_ENTRIES }),
    tFull('debugChrome.consoleExportBoundary'),
    tFull('debugChrome.consoleExportPrivacy'), '---',
    ...consoleRecorder.getEntries().map(entry => `${entry.time} [${entry.level}] ${entry.text}`)].join('\n');
}
