// workbench/modules/review/index.mjs — Visual Review: the game's screens captured at
// three device sizes (the Visual capture job, tools/screenshot.mjs), compared with the
// baselines a person accepted. The pure logic is in model.mjs; the pixels are decoded
// in pixels.mjs; the captures and baselines come through the Workbench API.

import {
  SCREENS, DEVICES, deviceById, screenById, rowsFor, filterRows, summarizeRows, judge, percentLabel,
  diffPixels, diffImage, DEFAULT_TOLERANCE, DEFAULT_THRESHOLD,
} from './model.mjs';
import { rgbaOf, pngUrlOf } from './pixels.mjs';

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
        </div>
        <div class="rv-view"><div class="rv-stage"></div></div>
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
      main().innerHTML = `<div class="rv-filters" role="group" aria-label="Filters">
          <label class="rv-check"><input type="checkbox" data-f="changedOnly"> Changed only</label>
          <label>Screen <select data-f="screen"><option value="">All screens</option>${screenOpts}</select></label>
          <label>Device <select data-f="device"><option value="">All devices</option>${deviceOpts}</select></label>
          <label>Tolerance <input type="number" min="0" max="255" step="1" data-f="tolerance" title="How far a channel may move (0-255) before a pixel counts as changed"></label>
          <label>Threshold % <input type="number" min="0" max="100" step="0.01" data-f="threshold" title="The share of pixels that must change before a screen counts as changed"></label>
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
      if (key === 'screen' || key === 'device') { st.filter[key] = t.value; paintRows(); paintSummary(); return; }
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
        <td class="rv-acts"><button type="button" data-view="${r.key}">View</button></td>
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
        t.cur = URL.createObjectURL(await ctx.apiBlob(`review/image?set=captures&file=${encodeURIComponent(r.file)}`));
        if (r.hasBaseline) {
          t.base = URL.createObjectURL(await ctx.apiBlob(`review/image?set=baselines&file=${encodeURIComponent(r.file)}`));
          const [a, b] = await Promise.all([fetchRgba('baselines', r.file), fetchRgba('captures', r.file)]);
          const pic = diffImage(a, b, { tolerance: st.tolerance });
          if (pic) t.diff = await pngUrlOf(pic);
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
      while (thumbs.size > THUMB_CAP) {
        const [oldKey, old] = thumbs.entries().next().value;
        thumbs.delete(oldKey);
        for (const url of Object.values(old)) URL.revokeObjectURL(url);
      }
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
    const dstate = { row: null, mode: ctx.settings.get('mode', 'side'), pos: 50, opacity: 50, urls: {}, token: 0 };
    const stage = () => detail.querySelector('.rv-stage');
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
      stage().innerHTML = msg('Loading…');
      try {
        const u = {};
        if (row.hasBaseline) u.base = URL.createObjectURL(await ctx.apiBlob(`review/image?set=baselines&file=${encodeURIComponent(row.file)}`));
        if (row.hasCapture) u.cur = URL.createObjectURL(await ctx.apiBlob(`review/image?set=captures&file=${encodeURIComponent(row.file)}`));
        if (row.hasBaseline && row.hasCapture) {
          const [a, b] = await Promise.all([fetchRgba('baselines', row.file), fetchRgba('captures', row.file)]);
          const pic = diffImage(a, b, { tolerance: st.tolerance });
          if (pic) u.diff = await pngUrlOf(pic);
        }
        if (token !== dstate.token) { for (const url of Object.values(u)) URL.revokeObjectURL(url); return; }
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
    }

    function revokeDetail() {
      for (const url of Object.values(dstate.urls)) URL.revokeObjectURL(url);
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
      detail.querySelector('.rv-accept').disabled = !r.hasCapture;
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
      if (!r.hasBaseline) { s.innerHTML = msg('No baseline yet, so there is nothing to compare. Accept this capture to make one.'); return; }
      if (mode === 'diff') { s.innerHTML = u.diff ? img(u.diff, 'Diff: changed pixels in red') : msg('The two images differ in size, so no pixel lines up.'); return; }
      if (mode === 'swipe') {
        s.innerHTML = `<div class="rv-layer">${img(u.base, 'Baseline')}</div>`
          + `<div class="rv-layer rv-clip" style="clip-path: inset(0 0 0 ${pos}%)">${img(u.cur, 'Current')}</div>`
          + `<div class="rv-divider" style="left: ${pos}%"></div>`;
        return;
      }
      s.innerHTML = `<div class="rv-layer">${img(u.base, 'Baseline')}</div><div class="rv-layer" style="opacity: ${opacity / 100}">${img(u.cur, 'Current')}</div>`;
    }

    detail.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('.rv-back')) return closeDetail();
      if (t.closest('.rv-prev')) return stepDetail(-1);
      if (t.closest('.rv-next')) return stepDetail(1);
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
      const key = ev.target.closest?.('[data-view]')?.dataset.view;
      if (key) openDetail(key);
    });

    // ---------- mount ----------
    paintPick();
    loadState();
    return {
      onShow() { paintPick(); },
      onHide() {},
      unmount() { clearTimeout(st.pollTimer); io?.disconnect(); },
      commands: () => [
        { title: 'Capture the chosen screens', sub: 'Visual Review', run: () => startCapture() },
        { title: 'Show only changed screens', sub: 'Visual Review', run: () => { st.filter.changedOnly = true; ctx.settings.set('changedOnly', true); paintRows(); paintSummary(); } },
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
