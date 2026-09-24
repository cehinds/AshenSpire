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
//
// Anything else — the site root (main's tree), an unrecognised file — is
// treated as `main`: an unknown page never opens debug on its own. An unknown
// file can still be opened with `?debug=1` (remembered on this device); main
// and release never can.

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
  if (/^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/.test(host)) return 'dev';
  if (protocol === 'file:') return 'unknown';
  return 'main';
}

/**
 * debugEnabled(channel, { search, storage }) → true when debug-only settings
 * and tools are shown. dev/test: always. main/release: never. unknown: only
 * when `?debug=1` was passed (remembered) — `?debug=0` forgets it.
 */
export function debugEnabled(channel = buildChannel(), { search = globalThis.location?.search || '', storage = safeStorage() } = {}) {
  if (DEBUG_CHANNELS.has(channel)) return true;
  if (LOCKED_CHANNELS.has(channel)) return false;
  const flag = new URLSearchParams(search).get('debug');
  try {
    if (flag === '1' || flag === 'true') storage?.setItem(DEBUG_STORAGE_KEY, '1');
    if (flag === '0' || flag === 'false') storage?.removeItem(DEBUG_STORAGE_KEY);
    return storage?.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch { return flag === '1' || flag === 'true'; }
}

function safeStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

let cached = null;
/** The page's own answer, computed once. Tests call the two functions above. */
export function pageDebug() {
  if (cached === null) cached = debugEnabled(buildChannel());
  return cached;
}
/** Test seam: force the page's answer (null recomputes). */
export function setPageDebugForTests(value) { cached = value; }
