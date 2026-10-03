// src/ui/buildChannel.js — WHICH BRANCH DREW THIS PAGE, AND WHETHER DEBUG IS OPEN.
//
// Owner, 2026-09-24: "most of the advanced features probably should be locked
// behind a debug flag that should only appear in dev and test builds. main
// should not have them."
//
// THE CHANNEL CANNOT BE STAMPED INTO THE BUNDLE. The single-file builds are
// committed, and `dev → release → main` carries them byte-identical: a stamp
// written on dev would still say "dev" on main. So the channel is read from
// WHERE the page was served or saved, which is the one place the branch is
// written down by the time a player opens it:
//
//   https://…/AshenSpire/dev/449/          pages-builds: /<branch>/<ordinal>/
//   https://…/AshenSpire/test/latest/      pages-builds alias
//   file:///…/AshenSpire-dev-0.7.1.449.html        a download from that site
//   file:///…/AshenSpire-mobile-test-0.7.1.1.html  the mobile download
//   http://localhost:8080/                 tools/serve.mjs (the source tree)
//   http://127.0.0.1:N/unknown/latest/     tools/browser.mjs serving a build
//                                          with the channel its file reads
//
// Anything else — the site root (main's tree) — is treated as `main`; an
// unrecognised file is `unknown` and never opens debug on its own.
//
// Owner, 2026-09-27: "Make dev tools a toggle and hidden on the 1.0 release
// version". Settings → Advanced → Developer tools is a switch on dev, test
// and unknown builds (on by default for dev/test, off for unknown; `?debug=1`
// and `?debug=0` write the same remembered answer). On main and release — the
// 1.0 release builds — the switch is not drawn and the tools stay off.

import { RUN_PATH } from '../buildversion.js';

export const CHANNELS = Object.freeze(['dev', 'test', 'release', 'main', 'unknown']);
const DEBUG_CHANNELS = new Set(['dev', 'test']);
const LOCKED_CHANNELS = new Set(['main', 'release']);
export const DEBUG_STORAGE_KEY = 'ashenspire.debug';

/**
 * buildChannel({ pathname, hostname, protocol }, runPath) → one of CHANNELS.
 * Pure: every input is passed in, so tests need no window.
 */
export function buildChannel(loc = globalThis.location, runPath = RUN_PATH) {
  // No page at all (Node: the test suite, the tools) is a developer's seat.
  if (!loc || runPath === 'source tree') return 'dev';
  let path = String(loc?.pathname || '');
  try { path = decodeURIComponent(path); } catch { /* a malformed %-escape: read it raw */ }
  const host = String(loc?.hostname || '');
  const protocol = String(loc?.protocol || '');
  const served = path.match(/\/(dev|test|release|main)\/(?:\d+|latest)(?:\/|$)/);
  if (served) return served[1];
  const saved = path.match(/AshenSpire-(?:mobile-)?(dev|test|release|main)-[^/]*\.html$/i);
  if (saved) return saved[1].toLowerCase();
  const loopback = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/.test(host);
  // `/unknown/<n|latest>/` on THIS machine only: how a local tool
  // (tools/browser.mjs buildPageUrl) serves a build over http while keeping the
  // channel the same file reads by double-click. Never a Pages path.
  if (loopback && /\/unknown\/(?:\d+|latest)(?:\/|$)/.test(path)) return 'unknown';
  if (loopback) return 'dev';
  // A private-network host is a workstation serving the dev preview to a
  // phone on the same Wi-Fi (tools/serve-preview.mjs): released builds are
  // only ever served from the Pages site or opened as files.
  if (/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)$/i.test(host)) return 'dev';
  if (protocol === 'file:') return 'unknown';
  return 'main';
}

/**
 * debugEnabled(channel, { search, storage }) → true when debug-only settings
 * and tools are shown. main/release (the 1.0 release builds): never.
 * dev/test: ON unless switched off on this device. unknown: OFF unless
 * switched on. The Developer tools switch and `?debug=1` / `?debug=0` both
 * write the same remembered answer ('1' on, '0' off).
 */
export function debugEnabled(channel = buildChannel(), { search = globalThis.location?.search || '', storage = safeStorage() } = {}) {
  if (LOCKED_CHANNELS.has(channel)) return false;
  const byDefault = DEBUG_CHANNELS.has(channel);
  const raw = new URLSearchParams(search).get('debug');
  const flag = raw === '1' || raw === 'true' ? '1' : raw === '0' || raw === 'false' ? '0' : null;
  // No storage (a sandboxed or private file view): the flag still counts for
  // this page, it just cannot be remembered.
  if (!storage) return flag ? flag === '1' : byDefault;
  try {
    if (flag) storage.setItem(DEBUG_STORAGE_KEY, flag);
    const stored = storage.getItem(DEBUG_STORAGE_KEY);
    return stored === '1' ? true : stored === '0' ? false : byDefault;
  } catch { return flag ? flag === '1' : byDefault; }
}

function safeStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

/**
 * debugSwitch(channel, { search, storage }) → { on, hidden, note } — the
 * Developer tools switch at the top of Settings → Advanced (owner,
 * 2026-09-27: "Make dev tools a toggle and hidden on the 1.0 release
 * version"). A toggle on every build but the release builds, where the row is
 * not drawn at all and the tools stay off.
 */
export function debugSwitch(channel = buildChannel(), options = {}) {
  if (LOCKED_CHANNELS.has(channel)) return { on: false, hidden: true, note: '' };
  // With no options this is the page's own answer — the cache setDebugEnabled
  // writes — so the switch never disagrees with the sections on screen (a
  // browser with no storage, or a `?debug=1` page switched off).
  const on = options.search === undefined && options.storage === undefined ? pageDebug() : debugEnabled(channel, options);
  const storage = options.storage === undefined ? safeStorage() : options.storage;
  const what = 'Shows tuning, rules, layout, import/export and diagnostics sections.';
  const where = DEBUG_CHANNELS.has(channel) ? ` On by default in ${channel} builds.` : '';
  return { on, hidden: false, note: `${what}${where} ${storage ? 'Remembered on this device.' : 'This browser cannot remember it past this page.'}` };
}

/**
 * setDebugEnabled(on, { channel, storage }) → the page's new answer. The
 * release builds stay off whatever is asked.
 */
export function setDebugEnabled(on, { channel = buildChannel(), storage = safeStorage() } = {}) {
  if (LOCKED_CHANNELS.has(channel)) return pageDebug();
  try { storage?.setItem(DEBUG_STORAGE_KEY, on ? '1' : '0'); } catch { /* unwritable storage: the answer still holds for this page */ }
  cached = !!on;
  return cached;
}

/**
 * promotionDebug(channel) → whether this BUILD applies the debug-only promoted
 * defaults (src/content/settingsDefaults.js): dev and test do, every other
 * build does not. Deliberately not the Developer tools switch, which only
 * decides which sections are SHOWN — hiding them must never change what the
 * game plays by after a reload (Codex, #1393).
 */
export function promotionDebug(channel = buildChannel()) {
  return DEBUG_CHANNELS.has(channel);
}

let cached = null;
/** The page's own answer, computed once. Tests call the two functions above. */
export function pageDebug() {
  if (cached === null) cached = debugEnabled(buildChannel());
  return cached;
}
/** Test seam: force the page's answer (null recomputes). */
export function setPageDebugForTests(value) { cached = value; }
