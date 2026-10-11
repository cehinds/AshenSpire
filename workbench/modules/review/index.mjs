// workbench/modules/review/index.mjs — Visual Review: the game's screens captured at
// three device sizes (the Visual capture job, tools/screenshot.mjs), compared with the
// baselines a person accepted. The pure logic is in model.mjs; the pixels are decoded
// in pixels.mjs; the captures and baselines come through the Workbench API.

import {
  SCREENS, DEVICES, deviceById, screenById, rowsFor, filterRows, summarizeRows, acceptPlan, judge, percentLabel,
  diffPixels, diffImage, parseDeepLink, deepLinkOf, DEFAULT_TOLERANCE, DEFAULT_THRESHOLD,
} from './model.mjs';
import { rgbaOf, dataUrlOf, pngDataUrlOf } from './pixels.mjs';
import { hashFor } from '../host.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const POLL_MS = 1200;
const THUMB_CAP = 80; // object URLs kept for thumbnails; the oldest is revoked past this
const MODES = [['side', 'Side by side'], ['swipe', 'Swipe'], ['onion', 'Onion skin'], ['diff', 'Diff highlight']];

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
        <button type="button" class="rv-filter-toggle" aria-expanded="false" aria-controls="rv-filters">Filters</button>
      </div>
      <div class="rv-main"><p class="rv-empty">Loading the captures…</p></div>
      <section class="rv-detail" aria-label="Screen detail" hidden>
        <header class="rv-dhead">
          <button type="button" class="rv-back">Back to the grid</button>
          <div class="rv-dname"><h2 class="rv-dtitle"></h2><span class="rv-dsub"></span></div>
          <span class="rv-badge"></span><span class="rv-dpx rv-num"></span>
          <div class="rv-dnav"><button type="button" class="rv-prev" aria-label="Previous screen">‹ Previous</button><button type="button" class="rv-next" aria-label="Next screen">Next ›</button></div>
        </header>
        <div class="rv-dtools">
          <div class="rv-seg" role="group" aria-label="View mode">${MODES.map(([id, label]) => `<button type="button" data-mode="${id}" aria-pressed="false">${label}</button>`).join('')}</div>
          <label class="rv-ctl rv-swipe-ctl">Position <input type="range" min="0" max="100" data-ctl="pos"></label>
          <label class="rv-ctl rv-onion-ctl">Current opacity <input type="range" min="0" max="100" data-ctl="opacity"></label>
          <div class="rv-zoom" role="group" aria-label="Zoom"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="fit">Fit</button><button type="button" data-zoom="100">100%</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button><span class="rv-zl" aria-live="polite"></span></div>
        </div>
        <div class="rv-view" tabindex="0" aria-label="Pictures: drag to pan, wheel or + and − to zoom, 0 to fit"><div class="rv-stage"></div></div>
        <footer class="rv-dfoot"><button type="button" class="rv-accept primary">Accept as baseline</button><button type="button" class="rv-layout">Open in Layout Studio</button></footer>
      </section>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const runBtn = $('.rv-run'), jobLine = $('.rv-job');
    const st = {
      device: deviceById(ctx.settings.get('device', 'desk')) ? ctx.settings.get('device', 'desk') : 'desk',
      screens: new Set(SCREENS.map((s) => s.id)),
      runId: null, pollTimer: 0, expected: 0,
      rows: [], dirs: null, gen: 0,
      tolerance: clampInt(ctx.settings.get('tolerance', DEFAULT_TOLERANCE), 0, 255, DEFAULT_TOLERANCE),
      threshold: clampNum(ctx.settings.get('threshold', DEFAULT_THRESHOLD), 0, 100, DEFAULT_THRESHOLD),
      filter: { changedOnly: Boolean(ctx.settings.get('changedOnly', false)), screen: '', device: '' },
    };
    const compareCache = new Map(); // compareKey → diff summary
    const thumbs = new Map(); // compareKey → { base, cur, diff } object URLs
    let repaintQueued = false;
    let io = null;

    // ---------- capture panel ----------
    function paintPick() {
      $('.rv-pick-n').textContent = `(${st.screens.size} of ${SCREENS.length})`;
      el.querySelectorAll('.rv-pick-list input').forEach((box) => { box.checked = st.screens.has(box.value); });
      el.querySelectorAll('[data-device]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.device === st.device)));
      runBtn.disabled = !st.screens.size || Boolean(st.runId);
      paintCaptureLock();
    }

    /** The Accept controls follow the capture: none is offered while a run is writing the captures. */
    function paintCaptureLock() {
      paintSummary();
      if (dstate.row) paintDetailHead();
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
      const ok = run.status === 'passed';
      jobLine.textContent = ok
        ? `Captured ${done} of ${st.expected}.`
        : `${run.status === 'cancelled' ? 'Cancelled' : 'Failed'}: ${done} of ${st.expected} captured${failed ? `, ${failed} failed` : ''}. ${run.message || ''}`.trim();
      ctx.toast({ kind: ok ? 'success' : 'error', title: ok ? 'Capture finished' : 'Capture did not finish', detail: jobLine.textContent, record: false });
      loadState();
    }

    // ---------- the grid: rows, compare queue, thumbnails ----------
    const rowsOf = () => rowsFor().map((r) => {
      const cap = st.captures?.get(r.file) || null;
      const base = st.baselines?.get(r.file) || null;
      return { ...r, hasCapture: Boolean(cap), hasBaseline: Boolean(base), cap, base, summary: null, changed: null, status: '', error: '' };
    });

    /** Reads the captures and baselines folders, then compares every row that has both. */
    async function loadState() {
      st.gen++;
      try {
        const state = await ctx.api('review/state');
        st.dirs = state.dirs;
        st.captures = new Map(state.captures.map((f) => [f.file, f]));
        st.baselines = new Map(state.baselines.map((f) => [f.file, f]));
        st.rows = rowsOf();
      } catch (err) {
        st.rows = [];
        main().innerHTML = `<p class="rv-empty">The captures could not be read: ${esc(err.message)}</p>`;
        return;
      }
      buildGrid();
      compareAll(st.gen);
      if (st.pendingOpen) { const key = st.pendingOpen; st.pendingOpen = null; openDetail(key); }
    }

    const compareKey = (r) => `${r.file}|${r.cap.mtime}|${r.cap.size}|${r.base.mtime}|${r.base.size}|${st.tolerance}`;
    const fetchRgba = async (set, file) => rgbaOf(await ctx.apiBlob(`review/image?set=${set}&file=${encodeURIComponent(file)}`));

    function applyRow(r, summary) {
      r.summary = summary;
      const v = judge(summary, { thresholdPercent: st.threshold });
      r.changed = v.changed;
      r.status = v.status;
    }

    async function compareAll(gen) {
      for (const r of st.rows) {
        if (gen !== st.gen) return;
        if (!r.hasCapture || !r.hasBaseline || r.summary) continue;
        try {
          const key = compareKey(r);
          let sum = compareCache.get(key);
          if (!sum) {
            const [a, b] = await Promise.all([fetchRgba('baselines', r.file), fetchRgba('captures', r.file)]);
            sum = diffPixels(a, b, { tolerance: st.tolerance });
            compareCache.set(key, sum);
          }
          if (gen !== st.gen) return;
          applyRow(r, sum);
        } catch (err) {
          r.error = err.message;
        }
        scheduleRepaint();
      }
      scheduleRepaint();
    }

    /** A new threshold re-judges the compared rows; a new tolerance changes the keys, so the rows compare again. */
    function rejudge() {
      for (const r of st.rows) if (r.summary) applyRow(r, r.summary);
      refreshCells();
      paintSummary();
    }

    /** Results arrive one row at a time: only the badges and pixel counts change, so the thumbnails stay put. */
    function scheduleRepaint() {
      if (repaintQueued) return;
      repaintQueued = true;
      requestAnimationFrame(() => { repaintQueued = false; refreshCells(); paintSummary(); });
    }

    function refreshCells() {
      const tbody = main().querySelector('tbody');
      if (!tbody) return;
      for (const tr of tbody.querySelectorAll('tr[data-key]')) paintRow(tr.__row, tr);
    }

    // ---------- the table ----------
    const main = () => el.querySelector('.rv-main');
    function buildGrid() {
      const screenOpts = SCREENS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('');
      const deviceOpts = DEVICES.map((d) => `<option value="${d.id}">${esc(d.label)}</option>`).join('');
      main().innerHTML = `<div class="rv-filters" id="rv-filters" role="group" aria-label="Filters">
          <label class="rv-check"><input type="checkbox" data-f="changedOnly"> Changed only</label>
          <label>Screen <select data-f="screen"><option value="">All screens</option>${screenOpts}</select></label>
          <label>Device <select data-f="device"><option value="">All devices</option>${deviceOpts}</select></label>
          <label>Tolerance <input type="number" min="0" max="255" step="1" data-f="tolerance" title="How far a channel may move (0-255) before a pixel counts as changed"></label>
          <label>Threshold % <input type="number" min="0" max="100" step="0.01" data-f="threshold" title="The share of pixels that must change before a screen counts as changed"></label>
          <span class="rv-accept-bar">
            <button type="button" class="rv-acc-screen" title="Make the current captures of this screen, on every device, the baselines">Accept this screen</button>
            <button type="button" class="rv-acc-all" title="Make every changed capture, and every capture with no baseline, the baseline">Accept all changed</button>
          </span>
        </div>
        <p class="rv-summary" role="status"></p>
        <div class="rv-table-wrap"><table class="rv-table">
          <thead><tr><th scope="col">Screen</th><th scope="col">Device</th><th scope="col">Baseline</th><th scope="col">Current</th><th scope="col">Diff</th><th scope="col">Result</th><th scope="col">Pixels</th><th scope="col"><span class="rv-sr">Open</span></th></tr></thead>
          <tbody></tbody>
        </table></div>`;
      const f = (name) => main().querySelector(`[data-f="${name}"]`);
      f('changedOnly').checked = st.filter.changedOnly;
      f('screen').value = st.filter.screen;
      f('device').value = st.filter.device;
      f('tolerance').value = String(st.tolerance);
      f('threshold').value = String(st.threshold);
      main().querySelector('.rv-filters').addEventListener('change', onFilter);
      main().querySelector('.rv-accept-bar').addEventListener('click', (ev) => {
        if (ev.target.closest('.rv-acc-all')) acceptAll();
        else if (ev.target.closest('.rv-acc-screen')) acceptScreen();
      });
      io?.disconnect();
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) ensureThumbs(e.target.__row);
      }, { root: main().querySelector('.rv-table-wrap'), rootMargin: '200px 0px' });
      paintRows();
      paintSummary();
    }

    const visible = () => filterRows(st.rows, st.filter);

    function onFilter(ev) {
      const t = ev.target;
      const key = t.dataset.f;
      if (key === 'changedOnly') { st.filter.changedOnly = t.checked; ctx.settings.set('changedOnly', t.checked); paintRows(); paintSummary(); return; }
      if (key === 'screen' || key === 'device') { st.filter[key] = t.value; paintRows(); paintSummary(); writeHash(); return; }
      if (key === 'tolerance') {
        st.tolerance = clampInt(t.value, 0, 255, DEFAULT_TOLERANCE);
        t.value = String(st.tolerance);
        ctx.settings.set('tolerance', st.tolerance);
        st.gen++;
        for (const r of st.rows) { r.summary = null; r.changed = null; r.status = ''; }
        paintRows(); paintSummary();
        compareAll(st.gen);
        return;
      }
      if (key === 'threshold') {
        st.threshold = clampNum(t.value, 0, 100, DEFAULT_THRESHOLD);
        t.value = String(st.threshold);
        ctx.settings.set('threshold', st.threshold);
        rejudge();
      }
    }

    function badgeOf(r) {
      if (!r.hasCapture) return { cls: 'none', label: 'No capture' };
      if (!r.hasBaseline) return { cls: 'new', label: 'No baseline' };
      if (r.error) return { cls: 'bad', label: 'Error' };
      if (!r.summary) return { cls: 'wait', label: 'Comparing…' };
      if (r.status === 'size') return { cls: 'changed', label: 'Size changed' };
      return r.changed ? { cls: 'changed', label: 'Changed' } : { cls: 'same', label: 'Unchanged' };
    }
    const pixelsOf = (r) => (r.summary ? (r.summary.sizeMismatch ? '—' : percentLabel(r.summary.percent)) : '');

    function rowHtml(r) {
      const s = screenById(r.screen);
      const d = deviceById(r.device);
      const slot = (which, text) => `<span class="rv-ph" data-slot="${which}">${esc(text)}</span>`;
      return `<tr data-key="${r.key}">
        <th scope="row">${esc(s.label)}</th>
        <td>${esc(d.label)} <span class="rv-dim">${d.width}×${d.height}</span></td>
        <td class="rv-thumb">${slot('base', r.hasBaseline ? '…' : 'No baseline')}</td>
        <td class="rv-thumb">${slot('cur', r.hasCapture ? '…' : 'No capture')}</td>
        <td class="rv-thumb">${slot('diff', r.hasBaseline && r.hasCapture ? '…' : '—')}</td>
        <td><span class="rv-badge"></span></td>
        <td class="rv-num"></td>
        <td class="rv-acts"><button type="button" data-open="${r.key}">View</button></td>
      </tr>`;
    }

    /** Builds the visible rows (the grid's filters), then fills each row's badge and thumbnails. */
    function paintRows() {
      const tbody = main().querySelector('tbody');
      if (!tbody) return;
      const rows = visible();
      io?.disconnect();
      tbody.innerHTML = rows.map(rowHtml).join('');
      const trs = tbody.querySelectorAll('tr');
      rows.forEach((r, i) => {
        const tr = trs[i];
        tr.__row = r;
        paintRow(r, tr);
        const cached = thumbs.get(compareKeyOrNull(r));
        if (cached) paintThumbs(tr, cached);
        else io?.observe(tr);
      });
      if (!rows.length) tbody.innerHTML = `<tr><td colspan="8" class="rv-none">${st.rows.length ? 'No rows match these filters.' : 'No captures yet. Pick screens and a device, then Capture.'}</td></tr>`;
    }

    function paintRow(r, tr = el.querySelector(`tr[data-key="${r.key}"]`)) {
      if (!tr) return;
      const b = badgeOf(r);
      const badge = tr.querySelector('.rv-badge');
      badge.className = `rv-badge rv-b-${b.cls}`;
      badge.textContent = b.label;
      tr.querySelector('.rv-num').textContent = pixelsOf(r);
    }

    function paintSummary() {
      const s = summarizeRows(st.rows);
      const pending = st.rows.filter((r) => r.hasCapture && r.hasBaseline && !r.summary && !r.error).length;
      const shown = visible().length;
      const parts = [`${s.total} rows`, `${s.changed} changed`, `${s.unchanged} unchanged`, `${s.noBaseline} without a baseline`, `${s.noCapture} without a capture`];
      if (pending) parts.push(`comparing ${pending}`);
      if (shown !== s.total) parts.push(`showing ${shown}`);
      const line = main().querySelector('.rv-summary');
      if (line) line.textContent = parts.join(' · ');
      const all = acceptPlan(st.rows, { all: true }).items.length;
      const allBtn = main().querySelector('.rv-acc-all');
      if (allBtn) { allBtn.textContent = `Accept all changed (${all})`; allBtn.disabled = all === 0 || Boolean(st.runId); }
      const screenBtn = main().querySelector('.rv-acc-screen');
      if (screenBtn) screenBtn.disabled = Boolean(st.runId) || !st.filter.screen ||acceptPlan(st.rows, { screen: st.filter.screen }).items.length === 0;
    }

    // ---------- accept as baseline ----------
    /** Copies the chosen captures over their baselines on the server, then reloads the rows (and the open detail). */
    async function acceptItems(items, what) {
      if (st.runId) {
        ctx.toast({ kind: 'warn', title: 'A capture is running', detail: 'Accept the baselines when it finishes.', record: false });
        return;
      }
      if (!items.length) {
        ctx.toast({ kind: 'warn', title: 'Nothing to accept', detail: 'Only a capture that exists can become a baseline.', record: false });
        return;
      }
      let res;
      try { res = await ctx.api('review/accept', { items }); } catch (err) {
        ctx.toast({ kind: 'error', title: 'The baseline was not accepted', detail: err.message });
        return;
      }
      const n = res.accepted.length;
      const notes = [what, res.missing.length ? `${res.missing.length} had no capture` : ''].filter(Boolean).join(' · ');
      ctx.toast({ kind: 'success', title: `Accepted ${n} baseline${n === 1 ? '' : 's'}`, detail: notes, record: false });
      const reopen = dstate.row?.key;
      await loadState();
      if (reopen && st.rows.some((r) => r.key === reopen)) openDetail(reopen);
    }

    async function acceptAll() {
      const plan = acceptPlan(st.rows, { all: true });
      if (plan.items.length > 1 && !window.confirm(`Accept ${plan.items.length} captures as their baselines? The old baselines for them are replaced.`)) return;
      await acceptItems(plan.items, 'changed and new screens');
    }

    async function acceptScreen() {
      const plan = acceptPlan(st.rows, { screen: st.filter.screen });
      if (plan.items.length > 1 && !window.confirm(`Accept ${plan.items.length} captures of ${screenById(st.filter.screen).label} as their baselines? The old baselines are replaced.`)) return;
      await acceptItems(plan.items, screenById(st.filter.screen).label);
    }

    /** The thumbnails of one row: its baseline, its capture and the diff picture. Fetched once a row scrolls into view. */
    async function ensureThumbs(r) {
      if (!r || !r.hasCapture) return;
      const key = compareKeyOrNull(r);
      if (!key) return;
      if (thumbs.has(key)) return paintThumbs(el.querySelector(`tr[data-key="${r.key}"]`), thumbs.get(key));
      io?.unobserve(el.querySelector(`tr[data-key="${r.key}"]`));
      try {
        const t = {};
        t.cur = await dataUrlOf(await ctx.apiBlob(`review/image?set=captures&file=${encodeURIComponent(r.file)}`));
        if (r.hasBaseline) {
          t.base = await dataUrlOf(await ctx.apiBlob(`review/image?set=baselines&file=${encodeURIComponent(r.file)}`));
          const [a, b] = await Promise.all([fetchRgba('baselines', r.file), fetchRgba('captures', r.file)]);
          const pic = diffImage(a, b, { tolerance: st.tolerance });
          if (pic) t.diff = pngDataUrlOf(pic);
        }
        rememberThumbs(key, t);
        paintThumbs(el.querySelector(`tr[data-key="${r.key}"]`), t);
      } catch (err) {
        r.error = err.message;
        paintRow(r);
      }
    }

    function rememberThumbs(key, t) {
      thumbs.set(key, t);
      while (thumbs.size > THUMB_CAP) thumbs.delete(thumbs.keys().next().value);
    }

    function paintThumbs(tr, t) {
      if (!tr) return;
      for (const which of ['base', 'cur', 'diff']) {
        const slot = tr.querySelector(`[data-slot="${which}"]`);
        if (!slot || !t[which]) continue;
        const img = document.createElement('img');
        img.className = 'rv-img';
        img.alt = '';
        img.loading = 'lazy';
        img.src = t[which];
        slot.replaceWith(img);
      }
    }

    /** The compare key of a row whose both images exist, else null (no thumbnails to keep). */
    function compareKeyOrNull(r) {
      return r.hasCapture ? `${r.hasBaseline ? compareKey(r) : `nobase|${r.file}|${r.cap.mtime}|${r.cap.size}|${st.tolerance}`}` : null;
    }

    // ---------- detail view ----------
    const detail = el.querySelector('.rv-detail');
    const dstate = { row: null, mode: ctx.settings.get('mode', 'side'), pos: 50, opacity: 50, urls: {}, token: 0, view: { s: 1, x: 12, y: 12 }, needFit: false };
    const stage = () => detail.querySelector('.rv-stage');
    const viewEl = () => detail.querySelector('.rv-view');

    // Zoom and pan move the one stage every mode draws into, so the panes in every mode stay in step.
    function applyView() {
      const s = stage();
      if (s) s.style.transform = `translate(${dstate.view.x}px, ${dstate.view.y}px) scale(${dstate.view.s})`;
      const zl = detail.querySelector('.rv-zl');
      if (zl) zl.textContent = `${Math.round(dstate.view.s * 100)}%`;
    }
    /** Shows the whole picture, never enlarged past 100%, centred across. Needs the images' sizes, so it waits for them. */
    function fitView() {
      const v = viewEl(); const s = stage();
      const cw = s.offsetWidth; const ch = s.offsetHeight;
      if (!cw || !ch) return;
      const k = Math.min(1, (v.clientWidth - 24) / cw, (v.clientHeight - 24) / ch);
      dstate.view = { s: k, x: Math.max(12, (v.clientWidth - cw * k) / 2), y: 12 };
      applyView();
    }
    function zoomAt(factor, cx, cy) {
      const { s, x, y } = dstate.view;
      const ns = Math.min(8, Math.max(0.1, s * factor));
      const r = ns / s;
      dstate.view = { s: ns, x: cx - (cx - x) * r, y: cy - (cy - y) * r };
      applyView();
    }
    function zoomCentre(factor) { const v = viewEl(); zoomAt(factor, v.clientWidth / 2, v.clientHeight / 2); }
    function zoomTo(scale) { const v = viewEl(); const { s } = dstate.view; zoomAt(scale / s, v.clientWidth / 2, v.clientHeight / 2); }

    let drag = null;
    detail.addEventListener('pointerdown', (ev) => {
      const v = ev.target.closest?.('.rv-view');
      if (!v || ev.button !== 0) return;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
      v.setPointerCapture(ev.pointerId);
      v.classList.add('dragging');
    });
    detail.addEventListener('pointermove', (ev) => {
      if (!drag || drag.id !== ev.pointerId) return;
      dstate.view.x += ev.clientX - drag.x;
      dstate.view.y += ev.clientY - drag.y;
      drag.x = ev.clientX; drag.y = ev.clientY;
      applyView();
    });
    const endDrag = (ev) => {
      if (!drag || drag.id !== ev.pointerId) return;
      drag = null;
      viewEl()?.classList.remove('dragging');
    };
    detail.addEventListener('pointerup', endDrag);
    detail.addEventListener('pointercancel', endDrag);
    detail.addEventListener('wheel', (ev) => {
      const v = ev.target.closest?.('.rv-view');
      if (!v) return;
      ev.preventDefault();
      const r = v.getBoundingClientRect();
      zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top);
    }, { passive: false });
    detail.addEventListener('keydown', (ev) => {
      if (!ev.target.closest?.('.rv-view')) return;
      if (ev.key === '+' || ev.key === '=') zoomCentre(1.25);
      else if (ev.key === '-') zoomCentre(1 / 1.25);
      else if (ev.key === '0') fitView();
      else if (ev.key === '1') zoomTo(1);
      else return;
      ev.preventDefault();
    });
    const msg = (text) => `<p class="rv-empty">${esc(text)}</p>`;

    async function openDetail(key) {
      const row = st.rows.find((r) => r.key === key);
      if (!row) return;
      revokeDetail();
      dstate.row = row;
      const token = ++dstate.token;
      main().hidden = true;
      detail.hidden = false;
      paintDetailHead();
      writeHash();
      dstate.needFit = true;
      stage().innerHTML = msg('Loading…');
      try {
        const u = {};
        if (row.hasBaseline) u.base = await dataUrlOf(await ctx.apiBlob(`review/image?set=baselines&file=${encodeURIComponent(row.file)}`));
        if (row.hasCapture) u.cur = await dataUrlOf(await ctx.apiBlob(`review/image?set=captures&file=${encodeURIComponent(row.file)}`));
        if (row.hasBaseline && row.hasCapture) {
          const [a, b] = await Promise.all([fetchRgba('baselines', row.file), fetchRgba('captures', row.file)]);
          const pic = diffImage(a, b, { tolerance: st.tolerance });
          if (pic) u.diff = pngDataUrlOf(pic);
        }
        if (token !== dstate.token) return;
        dstate.urls = u;
        paintStage();
      } catch (err) {
        if (token === dstate.token) stage().innerHTML = msg(`The images could not be read: ${err.message}`);
      }
    }

    function closeDetail() {
      revokeDetail();
      dstate.row = null;
      dstate.token++;
      detail.hidden = true;
      main().hidden = false;
      refreshCells();
      writeHash();
    }

    function revokeDetail() {
      dstate.urls = {};
    }

    function stepDetail(dir) {
      const list = visible();
      const at = list.findIndex((r) => r.key === dstate.row?.key);
      const next = list[at + dir];
      if (next) openDetail(next.key);
    }

    function paintDetailHead() {
      const r = dstate.row;
      if (!r) return;
      const s = screenById(r.screen);
      const d = deviceById(r.device);
      detail.querySelector('.rv-dtitle').textContent = s.label;
      detail.querySelector('.rv-dsub').textContent = `${d.label} ${d.width}×${d.height}`;
      const b = badgeOf(r);
      const badge = detail.querySelector('.rv-dhead .rv-badge');
      badge.className = `rv-badge rv-b-${b.cls}`;
      badge.textContent = b.label;
      detail.querySelector('.rv-dpx').textContent = pixelsOf(r);
      detail.querySelector('.rv-accept').disabled = !r.hasCapture || Boolean(st.runId);
      const layout = detail.querySelector('.rv-layout');
      layout.hidden = !s.layout;
      const list = visible();
      const at = list.findIndex((x) => x.key === r.key);
      detail.querySelector('.rv-prev').disabled = at <= 0;
      detail.querySelector('.rv-next').disabled = at < 0 || at >= list.length - 1;
    }

    /** The picture for the current mode. Layers are stacked images, so each mode is a different arrangement of the same two. */
    function paintStage() {
      const r = dstate.row;
      if (!r) return;
      const { mode, pos, opacity, urls: u } = dstate;
      detail.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      detail.querySelector('.rv-swipe-ctl').hidden = mode !== 'swipe';
      detail.querySelector('.rv-onion-ctl').hidden = mode !== 'onion';
      detail.querySelector('[data-ctl="pos"]').value = String(pos);
      detail.querySelector('[data-ctl="opacity"]').value = String(opacity);
      const s = stage();
      s.dataset.mode = mode;
      const img = (src, alt) => `<img class="rv-full" alt="${esc(alt)}" draggable="false" src="${src}">`;
      if (mode === 'side') {
        s.innerHTML = `<div class="rv-pane"><span class="rv-cap">Baseline</span>${u.base ? img(u.base, 'Baseline') : msg('No baseline yet. Accept this capture to make one.')}</div>`
          + `<div class="rv-pane"><span class="rv-cap">Current</span>${u.cur ? img(u.cur, 'Current') : msg('No capture for this screen and device.')}</div>`;
        return;
      }
      if (!r.hasBaseline) s.innerHTML = msg('No baseline yet, so there is nothing to compare. Accept this capture to make one.');
      else if (mode === 'diff') s.innerHTML = u.diff ? img(u.diff, 'Diff: changed pixels in red') : msg('The two images differ in size, so no pixel lines up.');
      else if (mode === 'swipe') {
        s.innerHTML = `<div class="rv-layer">${img(u.base, 'Baseline')}</div>`
          + `<div class="rv-layer rv-clip" style="clip-path: inset(0 0 0 ${pos}%)">${img(u.cur, 'Current')}</div>`
          + `<div class="rv-divider" style="left: ${pos}%"></div>`;
      } else {
        s.innerHTML = `<div class="rv-layer">${img(u.base, 'Baseline')}</div><div class="rv-layer" style="opacity: ${opacity / 100}">${img(u.cur, 'Current')}</div>`;
      }
      if (dstate.needFit) {
        dstate.needFit = false;
        const first = s.querySelector('img');
        if (first?.complete && first.naturalWidth) fitView();
        else first?.addEventListener('load', fitView, { once: true });
      }
      applyView();
    }

    detail.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('.rv-back')) return closeDetail();
      if (t.closest('.rv-layout') && dstate.row) {
        // Layout Studio does not select a screen from this link yet; it opens the studio.
        return ctx.openModule('layout', { screen: dstate.row.screen });
      }
      if (t.closest('.rv-accept') && dstate.row) {
        const r = dstate.row;
        return acceptItems([{ device: r.device, screen: r.screen }], `${screenById(r.screen).label}, ${deviceById(r.device).label}`);
      }
      if (t.closest('.rv-prev')) return stepDetail(-1);
      if (t.closest('.rv-next')) return stepDetail(1);
      const zoom = t.closest('[data-zoom]')?.dataset.zoom;
      if (zoom) {
        if (zoom === 'in') zoomCentre(1.25);
        else if (zoom === 'out') zoomCentre(1 / 1.25);
        else if (zoom === 'fit') fitView();
        else zoomTo(1);
        return;
      }
      const mode = t.closest('[data-mode]')?.dataset.mode;
      if (mode) { dstate.mode = mode; ctx.settings.set('mode', mode); paintStage(); }
    });
    detail.addEventListener('input', (ev) => {
      const ctl = ev.target.dataset?.ctl;
      if (ctl === 'pos') dstate.pos = clampInt(ev.target.value, 0, 100, 50);
      if (ctl === 'opacity') dstate.opacity = clampInt(ev.target.value, 0, 100, 50);
      if (ctl) paintStage();
    });
    el.querySelector('.rv-main').addEventListener('click', (ev) => {
      // data-view belongs to the host's navigation, so this module's rows use data-open.
      const key = ev.target.closest?.('[data-open]')?.dataset.open;
      if (key) openDetail(key);
    });

    // ---------- deep link: #mod=review&screen=…&device=… ----------
    // A screen and a device open that row's detail; one of them sets the matching filter.
    /** The link names the open row, or else the filters, so the hash always says what is on screen. */
    function writeHash() {
      const link = dstate.row ? { screen: dstate.row.screen, device: dstate.row.device } : { screen: st.filter.screen, device: st.filter.device };
      try { history.replaceState(null, '', hashFor('review', deepLinkOf(link))); } catch { /* a sandboxed page keeps the hash as it is */ }
    }
    /** Applies one link's params: the filters at once, and the detail once the rows exist. */
    function applyLink(p) {
      const { screen, device } = parseDeepLink(p);
      st.filter.screen = screen || '';
      st.filter.device = device || '';
      if (screen && device) st.pendingOpen = `${device}/${screen}`;
      if (st.rows.length) {
        const key = st.pendingOpen; st.pendingOpen = null;
        if (dstate.row) closeDetail();
        buildGrid();
        if (key) openDetail(key);
      }
      writeHash();
    }
    let seenParams = null;

    // ---------- narrow width: the filters become an overlay below 1100px (review.css) ----------
    const root = el.querySelector('.rv');
    const filterToggle = el.querySelector('.rv-filter-toggle');
    const setFilters = (open) => { root.classList.toggle('filters-open', open); filterToggle.setAttribute('aria-expanded', String(open)); };
    filterToggle.addEventListener('click', () => setFilters(!root.classList.contains('filters-open')));
    root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') setFilters(false); });

    // ---------- mount ----------
    paintPick();
    loadState();
    return {
      onShow() {
        paintPick();
        // The host gives a fresh params object for each open, so a link applies once and a plain return keeps the state.
        const p = ctx.params;
        if (p && p !== seenParams) { seenParams = p; if (Object.keys(p).length) applyLink(p); }
      },
      onHide() {},
      unmount() { clearTimeout(st.pollTimer); io?.disconnect(); },
      commands: () => [
        { title: 'Capture the chosen screens', sub: 'Visual Review', run: () => startCapture() },
        { title: 'Show only changed screens', sub: 'Visual Review', run: () => { st.filter.changedOnly = true; ctx.settings.set('changedOnly', true); paintRows(); paintSummary(); } },
        { title: 'Clear the Visual Review filters', sub: 'Visual Review', run: () => { st.filter = { changedOnly: false, screen: '', device: '' }; ctx.settings.set('changedOnly', false); buildGrid(); writeHash(); } },
        { title: 'Accept all changed captures', sub: 'Visual Review', run: () => acceptAll() },
      ],
    };
  },
};

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}
function clampNum(v, lo, hi, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}
