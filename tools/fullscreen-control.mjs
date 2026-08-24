#!/usr/bin/env node
// Deterministic controller checks for Settings > Fullscreen. No browser claims:
// fake documents exercise API absence, standard/WebKit support, enter/exit, and
// a rejected request so every capability state has a named result.

import { fullscreenCapability, isFullscreen, toggleFullscreen } from '../src/ui/screens/settings.js';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const selftestCode = await doorSelftest({
    tool: 'fullscreen-control.mjs',
    timeoutMs: 120000,
    plants: [
      {
        name: 'missing fullscreen methods are reported as supported again',
        file: 'src/ui/screens/settings.js',
        find: 'supported: !!(root && request && exit && enabled !== false),',
        replace: 'supported: true,',
        expectRed: /missing API should be unsupported/,
      },
      {
        name: 'exit stops invoking the browser API',
        file: 'src/ui/screens/settings.js',
        find: 'if (isFullscreen(doc)) await capability.exit.call(doc);',
        replace: 'if (isFullscreen(doc)) await Promise.resolve();',
        expectRed: /standard exit should leave/,
      },
      {
        name: 'a rejected request loses its refusal state',
        file: 'src/ui/screens/settings.js',
        find: "reason: 'refused',",
        replace: "reason: 'unsupported',",
        expectRed: /rejected request should return a visible refusal state/,
      },
    ],
  });
  if (selftestCode === 0) console.log('fullscreen-control-selftest: OK — 3 checks passed');
  process.exit(selftestCode);
}

let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}

const unsupported = { documentElement: {}, fullscreenEnabled: false };
check(fullscreenCapability(unsupported).supported === false, 'missing API should be unsupported');
check((await toggleFullscreen(unsupported)).reason === 'unsupported', 'unsupported toggle should explain itself');

const standard = {
  documentElement: {
    async requestFullscreen() { standard.fullscreenElement = standard.documentElement; },
  },
  async exitFullscreen() { standard.fullscreenElement = null; },
  fullscreenEnabled: true,
  fullscreenElement: null,
};
check(fullscreenCapability(standard).supported === true, 'standard API should be supported');
check((await toggleFullscreen(standard)).ok && isFullscreen(standard), 'standard request should enter');
check((await toggleFullscreen(standard)).ok && !isFullscreen(standard), 'standard exit should leave');

const webkit = {
  documentElement: {
    async webkitRequestFullscreen() { webkit.webkitFullscreenElement = webkit.documentElement; },
  },
  async webkitExitFullscreen() { webkit.webkitFullscreenElement = null; },
  webkitFullscreenEnabled: true,
  webkitFullscreenElement: null,
};
check(fullscreenCapability(webkit).supported === true, 'WebKit API should be supported');
check((await toggleFullscreen(webkit)).ok && isFullscreen(webkit), 'WebKit request should enter');
check((await toggleFullscreen(webkit)).ok && !isFullscreen(webkit), 'WebKit exit should leave');

const refused = {
  documentElement: { async requestFullscreen() { throw new Error('gesture refused'); } },
  async exitFullscreen() {},
  fullscreenEnabled: true,
};
const refusal = await toggleFullscreen(refused);
check(refusal.ok === false && refusal.reason === 'refused' && /gesture refused/.test(refusal.error),
  'a rejected request should return a visible refusal state');

console.log(`fullscreen-control: OK — ${checks} checks passed`);
