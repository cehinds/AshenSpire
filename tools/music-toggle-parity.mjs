#!/usr/bin/env node
// Issue #230: music-only preference and Quick Menu/Settings parity.
// The runtime door is the real audio engine over the shared WebAudio graph
// stub. The source door checks the one-owner wiring and semantic markup that a
// headless audio graph cannot observe. --selftest plants the named regression
// classes into copied real files and reruns this whole tool.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const code = await doorSelftest({
    tool: 'music-toggle-parity.mjs',
    timeoutMs: 180000,
    plants: [
      {
        name: 'global-mute-alias', file: 'src/ui/audio.js',
        find: '    ? settings.musicEnabled',
        replace: '    ? settings.muteAudio !== true',
        expectRed: /explicit Music off resolves off/,
      },
      {
        name: 'volume-zero-loses-level', file: 'src/ui/audio.js',
        find: '    ? settings.musicEnabled',
        replace: '    ? Number(settings.musicVolume) > 0',
        expectRed: /volume 0 remains enabled/,
      },
      {
        name: 'quicknav-second-owner', file: 'src/ui/components/quicknav.js',
        find: "import { menuRows } from '../uiContent.js';",
        replace: "import { menuRows } from '../uiContent.js';\n// planted second owner\nconst saveMeta = () => {};",
        expectRed: /Quick Menu contains no persistence owner/,
      },
      {
        name: 'disabled-procedural-timers', file: 'src/ui/audio.js',
        find: 'if (!state.musicEnabled || state.muted || state.context !== context) return; // Music owns procedural scheduling.',
        replace: '/* planted: procedural timers bypass Music */',
        expectRed: /procedural scheduling is gated by musicEnabled/,
      },
      {
        name: 'same-context-reenable-noop', file: 'src/ui/audio.js',
        find: 'else if (state.context && (!wasMusicEnabled || musicVolume != null || muteAudio != null)) {',
        replace: 'else if (state.context && wasMusicEnabled && (musicVolume != null || muteAudio != null)) {',
        expectRed: /same-context re-enable restarts playback/,
      },
      {
        name: 'unmute-restarts-disabled-music', file: 'src/ui/audio.js',
        find: 'if (state.muted || !state.musicEnabled) stopMusic(0.3);',
        replace: 'if (state.muted) stopMusic(0.3);',
        expectRed: /disable and global mute share the stop-only branch/,
      },
      {
        name: 'disabled-external-keeps-playing', file: 'src/ui/audio.js',
        find: '        el.pause();', replace: '        /* planted: external media keeps playing */',
        expectRed: /disabling Music pauses external media/,
      },
      {
        name: 'restore-drops-setting', file: 'src/main.js',
        find: 'applyDisplaySettings(settings); // display + the complete resolved audio bag',
        replace: 'applyDisplaySettings({ ...settings, musicEnabled: true }); // planted: restore drops the preference',
        expectRed: /restore applies the complete settings bag/,
      },
      {
        name: 'overlay-settings-stale', file: 'src/ui/components/overlay.js',
        find: "if (currentTab === 'settings' && result?.changed) panelFor('settings')(body, ctx);",
        replace: '/* planted: Settings panel stays stale after Quick Menu Music */',
        expectRed: /overlay refreshes Settings after a Quick Menu music change/,
      },
      {
        name: 'quarantine-settings-reader', file: 'src/main.js',
        find: 'if (!saves.profileStatus().quarantined) {',
        replace: 'if (true) { // planted: quarantine reloads the rejected profile',
        expectRed: /quarantine keeps the applied settings in session memory/,
      },
      {
        name: 'quicknav-dead-launcher', file: 'src/ui/components/quicknav.js',
        find: "const launchers = document.querySelectorAll('#ov-quicknav, #ov-switch');",
        replace: '// planted: an open overlay launcher stays live after Quick Menu OFF',
        expectRed: /Quick Menu OFF hides open overlay launchers/,
      },
      {
        name: 'overlay-fullscreen-refusal-silent', file: 'src/ui/components/overlay.js',
        find: "document.addEventListener('fullscreenerror', announceFullscreenError);",
        replace: "/* planted: fullscreen refusal is silent */",
        expectRed: /overlay announces fullscreen refusal/,
      },
      {
        name: 'overlay-fullscreen-listener-leak', file: 'src/ui/components/overlay.js',
        find: 'else stopListeningForQuickFullscreen();',
        replace: 'else { /* planted: settings listeners survive tab exit */ }',
        expectRed: /overlay releases fullscreen listeners/,
      },
      {
        name: 'quick-exit-bypasses-save', file: 'src/ui/components/overlay.js',
        find: '(onQuit || onExit)();', replace: '(onExit || onQuit)();',
        expectRed: /Save & Quit prefers the persistence callback/,
      },
      {
        name: 'aria-state-stale', file: 'src/ui/components/menuComponents.js',
        find: "button.setAttribute('aria-checked', String(row.checked));",
        replace: "button.setAttribute('aria-checked', 'false');",
        expectRed: /switch renderer reflects checked state/,
      },
      {
        name: 'fallback-bypasses-disable', file: 'src/ui/audio.js',
        find: 'if (!state.musicEnabled || state.muted || state.context !== context) return; // Music owns fallback scheduling.',
        replace: '/* planted: fallback bypasses Music */',
        expectRed: /fallback is gated by musicEnabled/,
      },
    ],
  });
  if (code === 0) console.log('music-toggle-parity-selftest: OK — 16 checks passed');
  process.exit(code);
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = (path) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');
let checks = 0;
let failures = 0;
function check(ok, message) {
  checks += 1;
  if (!ok) { failures += 1; console.error(`FAIL  ${message}`); }
}

const { installWebAudioStub, stubGraph } = await import('./webaudio-stub.mjs');
const gains = installWebAudioStub();
window.addEventListener = () => {};
const manifest = { combat: ['combat.ogg'] };
globalThis.fetch = async (url) => String(url).endsWith('/manifest.json')
  ? { ok: true, json: async () => manifest }
  : { ok: false };
const { initAudio, resolveMusicEnabled } = await import('../src/ui/audio.js');
const { musicEnabledCondition, settingsRowHtml } = await import('../src/ui/screens/settings.js');
const { resolveQuickNavMode } = await import('../src/ui/components/quicknav.js');
const { menuRows } = await import('../src/ui/uiContent.js');

check(resolveMusicEnabled({}) === true, 'absent Music resolves enabled without a volume inference');
check(resolveMusicEnabled({ muteMusic: true }) === false && resolveMusicEnabled({ muteMusic: false }) === true,
  'legacy muteMusic profiles migrate to the equivalent Music state');
check(resolveMusicEnabled({ musicEnabled: false, muteAudio: false }) === false, 'explicit Music off resolves off');
check(resolveMusicEnabled({ musicEnabled: 'broken' }) === true, 'invalid Music heals through the default resolver');
check(resolveMusicEnabled({ musicEnabled: true, musicVolume: 0 }) === true, 'volume 0 remains enabled');
check(/all audio muted/.test(musicEnabledCondition({ musicEnabled: true, muteAudio: true })), 'global mute copy stays distinct from Music off');
check(/sound effects unchanged/.test(musicEnabledCondition({ musicEnabled: false, muteAudio: false })), 'Music-off copy preserves SFX meaning');

const engine = initAudio({ musicEnabled: false, musicVolume: 35, sfxVolume: 75, muteAudio: false });
gains.length = 0;
check(engine.music('combat') === 'disabled' && !gains.some((v) => v > 0.0001), 'disabled Music schedules no sound');
engine.setVolumes({ musicEnabled: true });
check(gains.some((v) => v > 0.0001), 'same-context re-enable restarts playback');
engine.setVolumes({ musicEnabled: false });
gains.length = 0;
engine.setVolumes({ musicEnabled: false, muteAudio: true });
engine.setVolumes({ musicEnabled: false, muteAudio: false });
check(!gains.some((v) => v > 0.0001), 'global unmute cannot restart Music while disabled');
gains.length = 0;
engine.sfx('cardPlay');
check(gains.some((v) => v > 0.0001), 'Music off leaves SFX scheduling intact');

await engine.configureMusic({ folder: '/music' });
const externalBefore = stubGraph().elements.length;
engine.music('combat');
check(stubGraph().elements.length === externalBefore, 'disabled Music starts no external stream');

const controls = menuRows('map', { fixedEnds: false, hasSave: true });
check(controls[0]?.act === 'fullscreen' && controls[1]?.act === 'music', 'Fullscreen and Music stay the first Quick Menu rows');
check(controls.at(-2)?.act === 'save' && controls.at(-1)?.act === 'quit', 'Save and Save & Quit stay the final rows');
check(resolveQuickNavMode() === 'mirror' && resolveQuickNavMode('broken') === 'mirror'
  && resolveQuickNavMode('off') === 'off' && resolveQuickNavMode('switcher') === 'switcher',
  'Quick Menu defaults to Mirror and preserves explicit legacy choices');

const switchHtml = settingsRowHtml({ musicEnabled: true }, {
  cat: 'Audio', key: 'musicEnabled', def: true, resolve: resolveMusicEnabled,
  label: 'Music', note: musicEnabledCondition,
});
check(/role="switch"/.test(switchHtml) && /aria-checked="true"/.test(switchHtml), 'Settings exposes a named Music switch with live ARIA state');

const quick = source('src/ui/components/quicknav.js');
const renderer = source('src/ui/components/menuComponents.js');
const overlay = source('src/ui/components/overlay.js');
const audio = source('src/ui/audio.js');
const main = source('src/main.js');
check(!/saveMeta|localStorage|META_KEY/.test(quick), 'Quick Menu contains no persistence owner');
check(renderer.includes("button.setAttribute('aria-checked', String(row.checked));"), 'switch renderer reflects checked state');
check(overlay.includes('controls: quickControls,'), 'overlay forwards the shared controls');
check(overlay.includes("if (currentTab === 'settings' && result?.changed) panelFor('settings')(body, ctx);"),
  'overlay refreshes Settings after a Quick Menu music change');
check(overlay.includes("document.addEventListener('fullscreenerror', announceFullscreenError);")
  && overlay.includes("settingsAnnouncement.textContent = result.announcement;"),
  'overlay announces fullscreen refusal');
check(overlay.includes('else stopListeningForQuickFullscreen();')
  && overlay.includes('overlayCleanup.push(stopListeningForQuickFullscreen);'),
  'overlay releases fullscreen listeners');
check(overlay.includes('(onQuit || onExit)();'), 'Save & Quit prefers the persistence callback');
check(audio.includes('if (!state.musicEnabled || state.muted || state.context !== context) return; // Music owns fallback scheduling.'), 'fallback is gated by musicEnabled');
check(audio.includes('if (!state.musicEnabled || state.muted || state.context !== context) return; // Music owns procedural scheduling.'), 'procedural scheduling is gated by musicEnabled');
check(audio.includes('else if (state.context && (!wasMusicEnabled || musicVolume != null || muteAudio != null)) {'), 're-enable clears same-context no-op before restart');
check(audio.includes('if (state.muted || !state.musicEnabled) stopMusic(0.3);'), 'disable and global mute share the stop-only branch');
check(audio.includes('        el.pause();'), 'disabling Music pauses external media');
check(main.includes('applyDisplaySettings(settings); // display + the complete resolved audio bag'), 'restore applies the complete settings bag');
check(main.includes('if (!saves.profileStatus().quarantined) {') && main.includes('const settings = activeSettings;'),
  'quarantine keeps the applied settings in session memory');
check(quick.includes("const launchers = document.querySelectorAll('#ov-quicknav, #ov-switch');")
  && quick.includes("button.hidden = mode === 'off';"),
  'Quick Menu OFF hides open overlay launchers');

if (failures) {
  console.error(`music-toggle-parity: ${checks - failures} passed, ${failures} failed`);
  process.exit(1);
}
console.log(`music-toggle-parity: OK — ${checks} checks passed`);
