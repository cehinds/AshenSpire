// workbench/modules/review/index.mjs — Visual Review: the game's screens captured at
// three device sizes (the Visual capture job, tools/screenshot.mjs), compared with the
// baselines a person accepted. The pure logic is in model.mjs; the captures and
// baselines are read through the Workbench API (core/review.mjs).

import { SCREENS, DEVICES, deviceById } from './model.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const POLL_MS = 1200;

export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/review/review.css"><div class="rv">
      <div class="rv-bar">
        <details class="rv-pick">
          <summary>Screens <span class="rv-pick-n"></span></summary>
          <div class="rv-pick-panel">
            <div class="rv-pick-acts"><button type="button" data-pick="all">All</button><button type="button" data-pick="none">None</button></div>
            <div class="rv-pick-list">${SCREENS.map((s) => `<label><input type="checkbox" value="${s.id}" checked> ${esc(s.label)}</label>`).join('')}</div>
          </div>
        </details>
        <div class="rv-seg" role="group" aria-label="Device">${DEVICES.map((d) => `<button type="button" data-device="${d.id}" aria-pressed="false">${esc(d.label)} ${d.width}×${d.height}</button>`).join('')}</div>
        <button type="button" class="rv-run primary">Capture</button>
        <span class="rv-job" role="status"></span>
      </div>
      <div class="rv-main"><p class="rv-empty">Loading the captures…</p></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const pick = $('.rv-pick'), runBtn = $('.rv-run'), jobLine = $('.rv-job');
    const st = {
      device: deviceById(ctx.settings.get('device', 'desk')) ? ctx.settings.get('device', 'desk') : 'desk',
      screens: new Set(SCREENS.map((s) => s.id)),
      runId: null,
      pollTimer: 0,
    };

    // ---------- capture panel ----------
    function paintPick() {
      $('.rv-pick-n').textContent = `(${st.screens.size} of ${SCREENS.length})`;
      el.querySelectorAll('.rv-pick-list input').forEach((box) => { box.checked = st.screens.has(box.value); });
      el.querySelectorAll('[data-device]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.device === st.device)));
      runBtn.disabled = !st.screens.size || Boolean(st.runId);
    }
    el.querySelector('.rv-pick-list').addEventListener('change', (ev) => {
      const box = ev.target;
      if (!(box instanceof HTMLInputElement)) return;
      if (box.checked) st.screens.add(box.value); else st.screens.delete(box.value);
      paintPick();
    });
    el.querySelector('.rv-pick-acts').addEventListener('click', (ev) => {
      const which = ev.target?.dataset?.pick;
      if (!which) return;
      st.screens = which === 'all' ? new Set(SCREENS.map((s) => s.id)) : new Set();
      paintPick();
    });
    el.querySelector('.rv-seg').addEventListener('click', (ev) => {
      const id = ev.target?.dataset?.device;
      if (!id) return;
      st.device = id;
      ctx.settings.set('device', id);
      paintPick();
    });
    runBtn.addEventListener('click', () => startCapture());

    async function startCapture() {
      if (!st.screens.size || st.runId) return;
      const screens = SCREENS.map((s) => s.id).filter((id) => st.screens.has(id));
      try {
        const run = await ctx.api('jobs', { id: 'review-capture', params: { device: st.device, screens } });
        st.runId = run.runId;
        st.expected = screens.length;
        paintPick();
        pollRun();
      } catch (err) {
        ctx.toast({ kind: 'error', title: 'The capture did not start', detail: err.message });
      }
    }

    // A capture run prints one "✓ name" line per screen it photographed; the progress line counts them.
    async function pollRun() {
      clearTimeout(st.pollTimer);
      if (!st.runId) return;
      let run;
      try { run = await ctx.api(`jobs/runs/${st.runId}`); } catch (err) {
        jobLine.textContent = `Lost the capture run: ${err.message}`;
        st.runId = null; paintPick();
        return;
      }
      const log = run.log || '';
      const done = (log.match(/^\s+✓ /gm) || []).length;
      const failed = (log.match(/^\s+✗ /gm) || []).length;
      if (run.status === 'running') {
        jobLine.textContent = `Capturing ${done} of ${st.expected}${failed ? `, ${failed} failed` : ''}…`;
        st.pollTimer = setTimeout(pollRun, POLL_MS);
        return;
      }
      st.runId = null;
      paintPick();
      jobLine.textContent = run.status === 'passed'
        ? `Captured ${done} of ${st.expected}.`
        : `${run.status === 'cancelled' ? 'Cancelled' : 'Failed'}: ${done} of ${st.expected} captured${failed ? `, ${failed} failed` : ''}. ${run.message || ''}`.trim();
      ctx.toast({ kind: run.status === 'passed' ? 'success' : 'error', title: run.status === 'passed' ? 'Capture finished' : 'Capture did not finish', detail: jobLine.textContent, record: false });
      onCaptured();
    }

    // Set by the grid once it exists; a finished capture reloads the rows.
    let onCaptured = () => {};

    paintPick();
    return {
      onShow() { paintPick(); },
      onHide() {},
      unmount() { clearTimeout(st.pollTimer); },
      commands: () => [
        { title: 'Capture the chosen screens', sub: 'Visual Review', run: () => startCapture() },
      ],
    };
  },
};
