// Spike probe — injected as a Tauri initialization script (main world,
// before page scripts). Mirrors the Electron preload probe check-for-check.
// The game file itself ships byte-identical.
(function () {
  const T0 = window.__SPIKE_T0 || 0;
  const MODE = window.__SPIKE_MODE || 'write';
  const SENTINEL = 'rune-spike-sentinel';

  function inv(cmd, args) { return window.__TAURI__.core.invoke(cmd, args || {}); }
  function report(p) { return inv('spike_report', { payload: JSON.stringify(p) }); }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function playableNow() {
    if (document.readyState === 'loading') return false;
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const t = (b.textContent || '').trim();
      if (/climb|continue|new/i.test(t) && b.offsetParent !== null) return true;
    }
    return false;
  }

  async function measure() {
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
      result.persist_survived = result.persist_read === SENTINEL;
    }
    await report(result);

    // Fullscreen — both edges: enter and leave, verified Rust-side.
    const before = { w: innerWidth, h: innerHeight };
    const on = await inv('spike_fullscreen', { on: true });
    await sleep(800);
    const during = { w: innerWidth, h: innerHeight };
    const off = await inv('spike_fullscreen', { on: false });
    await sleep(800);
    const after = { w: innerWidth, h: innerHeight };
    await report({
      event: 'fullscreen',
      enter_ok: on === true,
      leave_ok: off === false,
      inner_before: before,
      inner_during: during,
      inner_after: after,
    });

    await report({ event: 'quitting', quit_requested_at: Date.now() });
    await inv('spike_quit');
  }

  function start() {
    let fired = false;
    const iv = setInterval(() => {
      if (fired || !playableNow()) return;
      fired = true;
      clearInterval(iv);
      measure().catch((e) => report({ event: 'error', message: String(e) }));
    }, 16);
    setTimeout(() => {
      if (fired) return;
      clearInterval(iv);
      report({
        event: 'timeout',
        readyState: document.readyState,
        button_count: document.querySelectorAll('button').length,
      }).then(() => inv('spike_quit'));
    }, 30000);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
