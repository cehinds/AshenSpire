// workbench/static/static-api.mjs — answers the Workbench's /api/... calls from a
// published snapshot, so the Workbench runs as a static site (GitHub Pages) with
// no server. Reads come from the snapshot; saves and diffs stay in this browser's
// localStorage as an overlay on top of it.
//
// Node can import this module (tests do): nothing touches window or document
// unless the module runs in a browser page, where it installs the fetch and
// EventSource shims and the snapshot banner.
import { lineDiff } from '../lib/line-diff.mjs';

export const LOCAL = 'This needs the Workbench on your computer: node workbench/server.mjs. The published Workbench reads a snapshot and keeps your edits in this browser.';

const overlayKey = (base) => 'wb-static-overlay:' + base;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readOverlay(storage, base) {
  try { return JSON.parse(storage.getItem(overlayKey(base)) || '{}') || {}; } catch { return {}; }
}

/**
 * The static API. `handle(url, init)` takes a URL and a fetch-style init and
 * returns a Promise<Response>. `onChange(count)` is optional and runs after each save.
 */
export function createStaticApi({ base, origin, fetchImpl, storage, onChange }) {
  const API = base + 'api/';
  let snapP = null;
  const snapshot = () => (snapP ||= fetchImpl(base + 'static-api/snapshot.json').then((r) => r.json()));

  async function publishedFile(s, path) {
    if (!has(s.index, path)) return null;
    const r = await fetchImpl(base + 'static-api/files/' + path + '.json');
    return r.ok ? r.json() : null;
  }

  async function handleGet(s, p, q) {
    if (p === 'session') return json(200, { token: 'static', root: '(published snapshot)', repo: '', port: 0, children: false, watching: {}, static: true });
    if (p === 'tools') {
      return json(200, s.snap.tools.body.map((t) => (t.id === 'game'
        ? { ...t, status: 'up', url: origin + base + 'game/' }
        : { ...t, status: 'down', conflict: LOCAL })));
    }
    if (p === 'files/read') {
      const path = q.get('path') || '';
      const o = readOverlay(storage, base)[path];
      const f = await publishedFile(s, path);
      if (o) return json(200, { ...(f || { path, kind: 'text' }), text: o.text, hash: o.hash });
      return f ? json(200, f) : json(404, { error: `${path}: not in the published snapshot` });
    }
    if (p === 'files/list') {
      const dir = (q.get('dir') || '').replace(/\/+$/, '');
      const exts = (q.get('ext') || '').split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
      const suffixes = exts.map((e) => '.' + e);
      const all = new Set([...Object.keys(s.index), ...Object.keys(readOverlay(storage, base))]);
      const files = [...all]
        .filter((f) => (!dir || f.startsWith(dir + '/')) && (!suffixes.length || suffixes.some((x) => f.toLowerCase().endsWith(x))))
        .sort();
      return json(200, { dir, files, truncated: false });
    }
    if (has(s.snap, p)) return json(s.snap[p].status, s.snap[p].body);
    return json(404, { error: LOCAL });
  }

  async function handlePost(s, p, init) {
    let body;
    try { body = init && init.body ? JSON.parse(init.body) : {}; } catch { return json(400, { error: 'The request body is not JSON.' }); }
    if (p === 'files/save') {
      const changes = Array.isArray(body.changes) ? body.changes : [];
      if (changes.some((c) => !c || typeof c.path !== 'string' || typeof c.text !== 'string')) {
        return json(400, { error: 'Each change needs a path and text.' });
      }
      const o = readOverlay(storage, base);
      const files = [];
      for (const c of changes) {
        const hash = await sha256Hex(c.text);
        o[c.path] = { text: c.text, hash };
        files.push({ path: c.path, hash });
      }
      storage.setItem(overlayKey(base), JSON.stringify(o));
      if (onChange) onChange(Object.keys(o).length);
      return json(200, { backup: null, files, static: true });
    }
    if (p === 'files/diff') {
      const path = body.path;
      const o = readOverlay(storage, base)[path];
      const pub = o ? null : await publishedFile(s, path);
      const oldText = o ? o.text : (pub ? pub.text : '');
      const exists = Boolean(o) || has(s.index, path);
      return json(200, { path, exists, ...lineDiff(oldText, String(body.text ?? '')) });
    }
    return json(501, { error: LOCAL });
  }

  async function handle(url, init) {
    const s = await snapshot();
    const p = url.pathname.slice(API.length);
    const method = ((init && init.method) || 'GET').toUpperCase();
    return method === 'GET' ? handleGet(s, p, url.searchParams) : handlePost(s, p, init);
  }

  return { handle, snapshot };
}

/**
 * Where an art file's URL points on the published site. The light art (assets-mobile/) is
 * published once, at game/assets/, so the Asset Gallery and Motion Studio read it from there;
 * every other game path is under asset-file/. Each path segment is encoded.
 */
export function assetUrlFor(base, path) {
  const enc = (s) => s.split('/').map(encodeURIComponent).join('/');
  const light = 'assets-mobile/';
  if (path.startsWith(light)) return base + 'game/assets/' + enc(path.slice(light.length));
  return base + 'asset-file/' + enc(path);
}

/** The user's saved edits: { [path]: text }. */
export function changedFiles(storage, base) {
  return Object.fromEntries(Object.entries(readOverlay(storage, base)).map(([path, o]) => [path, o.text]));
}

/** Drops every saved edit for this site. */
export function discardChanges(storage, base) {
  storage.removeItem(overlayKey(base));
}

// ---------------------------------------------------------------------------
// Browser install. Runs only inside a page; node imports stop above.

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}

function pickStorage() {
  try { const s = window.localStorage; s.getItem('wb-static-probe'); return s; } catch { return memoryStorage(); }
}

function showBanner(api, storage, base) {
  const el = document.createElement('div');
  el.className = 'static-banner';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483000;display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:6px 12px;background:#1d1b19;color:#f2efe9;font:12px/1.4 system-ui,sans-serif;box-sizing:border-box;';
  const text = document.createElement('span');
  const count = document.createElement('span');
  const button = (label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'font:inherit;color:inherit;background:#3a3631;border:1px solid #5a544c;border-radius:4px;padding:2px 8px;cursor:pointer;';
    return b;
  };
  const setCount = (n) => { count.textContent = `${n} changed file${n === 1 ? '' : 's'}`; };
  const download = button('Download changes');
  download.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(changedFiles(storage, base), null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workbench-changes.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  const discard = button('Discard');
  discard.addEventListener('click', () => {
    if (!confirm('Discard every edit saved in this browser for this Workbench?')) return;
    discardChanges(storage, base);
    location.reload();
  });
  el.append(text, count, download, discard);
  document.body.insertBefore(el, document.body.firstChild);
  const pad = () => { document.body.style.paddingTop = el.offsetHeight + 'px'; };
  window.addEventListener('resize', pad);
  api.snapshot().then((s) => {
    const m = s.meta || {};
    text.textContent = `Published Workbench · snapshot of ${m.branch || 'unknown'} @ ${m.head || 'unknown'} · edits stay in this browser`;
    pad();
  }, () => {
    text.textContent = 'Published Workbench · snapshot unavailable · edits stay in this browser';
    pad();
  });
  setCount(Object.keys(changedFiles(storage, base)).length);
  return setCount;
}

function install() {
  const base = new URL('../', import.meta.url).pathname;
  const origin = location.origin;
  const realFetch = window.fetch.bind(window);
  const storage = pickStorage();
  // The Asset Gallery and Motion Studio read art through this (see assetUrl in modules/assets/model.mjs).
  window.ASHEN_ASSET_URL = (p) => assetUrlFor(base, p);
  let setCount = () => {};
  const api = createStaticApi({ base, origin, fetchImpl: realFetch, storage, onChange: (n) => setCount(n) });

  window.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith(base + 'api/')) return api.handle(url, init);
    return realFetch(input, init);
  };

  const RealEventSource = window.EventSource;
  class StaticEventSource extends EventTarget {
    constructor(u, opts) {
      super();
      const url = new URL(String(u), location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith(base + 'api/')) return new RealEventSource(u, opts);
      this.url = String(u);
      this.readyState = StaticEventSource.OPEN;
      this.onopen = null; this.onmessage = null; this.onerror = null;
      setTimeout(() => {
        const ev = new Event('open');
        if (this.onopen) this.onopen(ev);
        this.dispatchEvent(ev);
      }, 0);
    }
    close() { this.readyState = StaticEventSource.CLOSED; }
  }
  StaticEventSource.CONNECTING = 0;
  StaticEventSource.OPEN = 1;
  StaticEventSource.CLOSED = 2;
  window.EventSource = StaticEventSource;

  const start = () => { setCount = showBanner(api, storage, base); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') install();
