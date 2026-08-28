// Spike probe — runs in Electron's isolated preload world.
// Shares DOM + localStorage with the page but never touches the game's JS scope,
// so dist/AshenSpire.html ships byte-identical.
const { ipcRenderer } = require('electron');

const T0 = Number(process.env.SPIKE_T0 || 0);
const MODE = process.env.SPIKE_MODE || 'write'; // write = first run, read = restart run
const SENTINEL = 'rune-spike-sentinel';

function report(payload) {
  ipcRenderer.send('spike-report', payload);
}

function playableNow() {
  if (document.readyState === 'loading') return false;
  // Title screen is playable when a rendered menu button exists (Climb / Continue / New).
  const btns = document.querySelectorAll('button');
  for (const b of btns) {
    const t = (b.textContent || '').trim();
    if (/climb|continue|new/i.test(t) && b.offsetParent !== null) return true;
  }
  return false;
}

if (!process.env.SPIKE_T0) return; // normal launch: no probe, no writes

window.addEventListener('DOMContentLoaded', () => {
  const iv = setInterval(() => {
    if (!playableNow()) return;
    clearInterval(iv);
    const now = Date.now();
    const result = {
      event: 'playable',
      boot_to_playable_ms: T0 ? now - T0 : null,
      page_perf_ms: Math.round(performance.now()),
      gamepad_api: typeof navigator.getGamepads === 'function',
      gamepad_events: 'ongamepadconnected' in window,
      fullscreen_dom_enabled: !!document.fullscreenEnabled,
      mode: MODE,
      localStorage_keys: Object.keys(localStorage).sort(),
    };
    if (MODE === 'write') {
      localStorage.setItem('spike_persist', SENTINEL);
      result.persist_written = SENTINEL;
    } else {
      result.persist_read = localStorage.getItem('spike_persist');
      result.persist_survived = localStorage.getItem('spike_persist') === SENTINEL;
    }
    report(result);
  }, 16);
  setTimeout(() => {
    clearInterval(iv);
    report({
      event: 'timeout',
      readyState: document.readyState,
      button_count: document.querySelectorAll('button').length,
    });
  }, 30000);
});
