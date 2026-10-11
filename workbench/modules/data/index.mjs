// workbench/modules/data/index.mjs — Data Studio: the content tables as grids.
//
// Left: the tables (content/source csv and json, content/framework json), grouped,
// with a dirty dot. Centre: the selected table in the grid kit. Right: the Row
// form for the active row, and the Check panel for the grid's issues. The file
// text is parsed by model.mjs; nothing here writes files until Review & save.

import { createGrid, createCheckPanel } from '../../ui/kit/grid.mjs';
import * as G from '../../ui/kit/grid-model.mjs';
import { icon } from '../../ui/icons.mjs';
import { listTables, parseTable, serializeTable, isDirty, tableRules, keyColumnOf, changeFor } from './model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const basename = (p) => p.split('/').pop();



export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/data/data.css"><div class="ds">
      <aside class="ds-list" aria-label="Tables"><input type="search" class="ds-find" placeholder="Find a table…" aria-label="Find a table"><div class="ds-groups"></div></aside>
      <section class="ds-main">
        <div class="ds-toolbar">
          <button type="button" data-act="add">Add row</button>
          <button type="button" data-act="dup">Duplicate</button>
          <button type="button" data-act="del">Delete</button>
          <button type="button" data-act="import">Import CSV/JSON</button>
          <button type="button" data-act="export">Export</button>
          <button type="button" data-act="review" class="primary">Review &amp; save (0)</button>
          <input type="file" class="ds-file-in" accept=".csv,.json,.tsv,.txt" hidden>
          <span class="ds-file"></span>
        </div>
        <div class="ds-grid"><div class="ds-note">Loading tables…</div></div>
      </section>
      <aside class="ds-side">
        <div class="ds-tabs" role="tablist"><button type="button" role="tab" data-tab="row" aria-selected="true">Row</button><button type="button" role="tab" data-tab="check" aria-selected="false">Check</button></div>
        <div class="ds-panel-row"></div>
        <div class="ds-panel-check ds-hidden"></div>
      </aside></div>`;
    const $ = (s) => el.querySelector(s);
    const groupsEl = $('.ds-groups'), gridEl = $('.ds-grid'), fileEl = $('.ds-file'), rowPanel = $('.ds-panel-row'), checkPanel = $('.ds-panel-check');
    const fileIn = $('.ds-file-in');

    const state = { tables: [], parsed: new Map(), drafts: new Map(), selected: null, grid: null, activeRow: null, tab: 'row', filter: '' };

    // ---------- loading ----------
    async function parsedOf(path) {
      if (state.parsed.has(path)) return state.parsed.get(path);
      const file = await ctx.api(`files/read?path=${encodeURIComponent(path)}`);
      const table = parseTable(path, file.text, { hash: file.hash });
      state.parsed.set(path, table);
      return table;
    }

    async function loadList() {
      const [src, fw] = await Promise.all([
        ctx.api('files/list?dir=content/source&ext=csv,json'),
        ctx.api('files/list?dir=content/framework&ext=json'),
      ]);
      const found = listTables([...src.files, ...fw.files]);
      const tables = [];
      for (const t of found) {
        // A JSON file is a table only when it is an array of objects.
        if (t.format === 'json') {
          try { await parsedOf(t.path); } catch { continue; }
        }
        tables.push(t);
      }
      state.tables = tables;
      renderList();
    }

    // ---------- the table list ----------
    function dirtyOf(path) {
      const table = state.parsed.get(path), draft = state.drafts.get(path);
      return Boolean(table && draft && isDirty(table, draft));
    }
    function renderList() {
      const q = state.filter.trim().toLowerCase();
      const shown = state.tables.filter((t) => !q || t.name.toLowerCase().includes(q) || t.path.toLowerCase().includes(q));
      let html = '';
      for (const group of ['Source', 'Framework']) {
        const items = shown.filter((t) => t.group === group);
        if (!items.length) continue;
        html += `<div class="ds-group">${group}</div>`;
        html += items.map((t) => `<button type="button" class="ds-table" data-path="${esc(t.path)}" aria-current="${t.path === state.selected}" title="${esc(t.path)}"><span class="ds-name">${esc(t.name)}</span><span class="ds-dot${dirtyOf(t.path) ? ' on' : ''}" aria-label="${dirtyOf(t.path) ? 'Unsaved changes' : ''}"></span></button>`).join('');
      }
      groupsEl.innerHTML = html || '<p class="ds-muted">No tables match.</p>';
    }

    // ---------- grid ----------
    function ensureGrid() {
      if (state.grid) return state.grid;
      gridEl.innerHTML = '';
      state.grid = createGrid(gridEl, { columns: [], rows: [], rules: [], onChange: (ev) => onGridChange(ev) });
      state.grid.subscribe(() => syncActiveRow());
      createCheckPanel(checkPanel, state.grid);
      return state.grid;
    }
    function syncActiveRow() {
      const active = gridEl.querySelector('.gk-active');
      if (active && active.dataset.r !== undefined) { state.activeRow = Number(active.dataset.r); renderRow(); }
    }
    // Every edit the grid commits is one History step; undo and redo put the snapshot back for its own table.
    function onGridChange(ev) {
      const path = state.selected;
      if (!path) return;
      state.drafts.set(path, state.grid.getData());
      if (ev.change) ctx.history.pushChange(ev.change, (snap) => applyDoc(path, snap));
      refresh();
    }
    function applyDoc(path, snap) {
      const doc = { columns: snap.columns, rows: snap.rows };
      state.drafts.set(path, doc);
      if (path === state.selected) { state.grid.setRules(tableRules(doc.columns)); state.grid.setData(doc); }
      refresh();
    }
    function refresh() { renderList(); showFile(); renderRow(); renderReviewCount(); }
    function renderReviewCount() {
      el.querySelector('[data-act="review"]').textContent = `Review & save (${changedPaths().length})`;
    }
    const changedPaths = () => [...state.drafts.keys()].filter(dirtyOf);

    // ---------- review and save ----------
    const dlg = document.createElement('dialog');
    dlg.className = 'ds-review';
    el.appendChild(dlg);
    const close = () => { if (dlg.open) dlg.close(); };
    dlg.addEventListener('click', (ev) => { if (ev.target === dlg) close(); });

    /** Opens the review dialog: one line diff per changed table; Save posts them all with their baseHash. */
    async function openReview() {
      const paths = changedPaths();
      if (!paths.length) { ctx.toast({ kind: 'info', title: 'Nothing to save', detail: 'No table has changes.' }); return; }
      const changes = paths.map((p) => changeFor(state.parsed.get(p), state.drafts.get(p)));
      const diffs = await Promise.all(changes.map((c) => ctx.api('files/diff', { path: c.path, text: c.text })
        .catch((e) => ({ path: c.path, error: e.message, hunks: [], added: 0, removed: 0 }))));
      dlg.innerHTML = `<div class="ds-review-body"><h2>Review changes (${changes.length})</h2>${diffs.map(diffHtml).join('')}<div class="ds-review-status" role="status"></div><div class="ds-review-actions"><button type="button" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save ${changes.length} file${changes.length === 1 ? '' : 's'}</button></div></div>`;
      dlg.querySelector('[data-cancel]').onclick = close;
      dlg.querySelector('[data-save]').onclick = () => save(changes);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    }
    function diffHtml(d) {
      if (d.error) return `<section class="ds-diff"><h3>${esc(d.path)}</h3><p class="ds-bad">${esc(d.error)}</p></section>`;
      const body = d.hunks.map((h) => `<div class="ds-hunk">@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@</div>${h.lines.map((l) => `<div class="ds-line ds-${l.op === '+' ? 'add' : l.op === '-' ? 'del' : 'ctx'}">${esc(l.op)}${esc(l.text)}</div>`).join('')}`).join('');
      return `<section class="ds-diff"><h3>${esc(d.path)} <span class="ds-count">+${d.added} −${d.removed}</span></h3><pre class="ds-lines">${body || '<span class="ds-muted">No line changes.</span>'}</pre></section>`;
    }
    async function save(changes) {
      const status = dlg.querySelector('.ds-review-status');
      try {
        const res = await ctx.api('files/save', { changes });
        close();
        for (const f of res.files) { state.parsed.delete(f.path); state.drafts.delete(f.path); }
        if (state.selected && res.files.some((f) => f.path === state.selected)) await select(state.selected);
        refresh();
        ctx.toast({ kind: 'success', title: `Saved ${res.files.length} file${res.files.length === 1 ? '' : 's'}` });
        ctx.preview.reload();
      } catch (e) {
        if (/changed/i.test(e.message)) return conflicts(changes, status);
        if (/do not validate/i.test(e.message)) status.innerHTML = `<p class="ds-bad">Nothing saved. ${esc(e.message)}. Fix the rows the Check panel names, then save again.</p>`;
        else status.innerHTML = `<p class="ds-bad">Not saved: ${esc(e.message)}</p>`;
      }
    }
    /** Files that changed on disk since they were read: Reload takes the disk copy; Overwrite keeps the drafts. */
    async function conflicts(changes, status) {
      const now = await Promise.all(changes.map((c) => ctx.api(`files/read?path=${encodeURIComponent(c.path)}`).then((f) => ({ c, hash: f.hash }), () => ({ c, hash: null }))));
      const moved = now.filter(({ c, hash }) => hash !== c.baseHash);
      const names = moved.map(({ c }) => esc(c.path)).join(', ') || 'a file';
      status.innerHTML = `<p class="ds-bad">Changed on disk since it was opened: ${names}.</p><div class="ds-review-actions"><button type="button" data-reload>Reload from disk</button><button type="button" data-overwrite class="primary">Overwrite with my changes</button></div>`;
      status.querySelector('[data-reload]').onclick = async () => {
        for (const { c } of moved) { state.parsed.delete(c.path); state.drafts.delete(c.path); }
        close();
        if (state.selected && moved.some(({ c }) => c.path === state.selected)) await select(state.selected);
        refresh();
      };
      status.querySelector('[data-overwrite]').onclick = () => save(changes.map((c) => {
        const found = now.find((n) => n.c.path === c.path);
        return found && found.hash ? { ...c, baseHash: found.hash } : c;
      }));
    }

    function showFile() {
      if (!state.selected) return;
      const doc = state.drafts.get(state.selected) ?? { rows: [] };
      fileEl.textContent = `${state.selected} · ${doc.rows.length} rows${dirtyOf(state.selected) ? ' · unsaved changes' : ''}`;
    }
    // The grid's own Undo, Redo and keys go through the module's History instead, so one stack covers every table.
    gridEl.addEventListener('keydown', (ev) => {
      if (ev.target.tagName === 'INPUT') return;
      const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
      if (!mod || !['z', 'y'].includes(k)) return;
      ev.preventDefault(); ev.stopPropagation();
      if (k === 'y' || ev.shiftKey) ctx.history.redo(); else ctx.history.undo();
    }, true);
    gridEl.addEventListener('click', (ev) => {
      const b = ev.target.closest('.gk-undo, .gk-redo');
      if (!b) return;
      ev.preventDefault(); ev.stopPropagation();
      if (b.classList.contains('gk-redo')) ctx.history.redo(); else ctx.history.undo();
    }, true);

    async function select(path) {
      const table = await parsedOf(path).catch((e) => { ctx.toast({ kind: 'error', title: `Cannot open ${basename(path)}`, detail: e.message }); return null; });
      if (!table) return;
      const grid = ensureGrid();
      if (state.selected && state.selected !== path) state.drafts.set(state.selected, grid.getData());
      state.selected = path;
      const doc = state.drafts.get(path) ?? { columns: table.columns, rows: table.rows };
      state.activeRow = null;
      grid.setRules(tableRules(doc.columns));
      grid.setData({ columns: doc.columns, rows: doc.rows });
      refresh();
    }

    // ---------- the Row form ----------
    function renderRow() {
      const data = state.grid?.getData();
      const r = state.activeRow;
      if (!data || r == null || !data.rows[r]) { rowPanel.innerHTML = '<p class="ds-muted">Click a row to edit it here.</p>'; return; }
      const key = keyColumnOf(data.columns);
      rowPanel.innerHTML = `<h3>Row ${r + 1}</h3><div class="ds-form">${data.columns.map((c, i) => `<label><span>${esc(c.label)} <em>${esc(c.type)}${key && key.key === c.key ? ' · key' : ''}</em></span><input data-c="${i}" value="${esc(G.formatValue(data.rows[r][c.key], c.type))}" aria-label="${esc(c.label)} row ${r + 1}"></label>`).join('')}</div>`;
    }
    rowPanel.addEventListener('change', (ev) => {
      const input = ev.target.closest('input[data-c]');
      if (!input || state.activeRow == null) return;
      const data = state.grid.getData();
      const c = Number(input.dataset.c), col = data.columns[c];
      try {
        const value = G.parseValue(input.value, col.type);
        state.grid.apply(G.setCells(data, [{ r: state.activeRow, c }], value, `Edit ${col.key}`));
      } catch (e) {
        input.setCustomValidity(e.message); input.reportValidity(); renderRow();
      }
    });

    // ---------- toolbar ----------
    const activeIndex = () => (state.activeRow != null && state.grid?.getData().rows[state.activeRow] ? state.activeRow : null);
    function needTable() {
      if (!state.selected) { ctx.toast({ kind: 'info', title: 'Open a table first' }); return false; }
      return true;
    }
    el.querySelector('.ds-toolbar').addEventListener('click', (ev) => {
      const act = ev.target.closest('[data-act]')?.dataset.act;
      if (!act || !needTable()) return;
      const grid = state.grid, data = grid.getData();
      if (act === 'add') {
        const at = activeIndex();
        grid.addRow(at == null ? data.rows.length : at + 1);
        state.activeRow = at == null ? data.rows.length : at + 1;
      } else if (act === 'dup') {
        const at = activeIndex();
        if (at == null) return ctx.toast({ kind: 'info', title: 'Click a row to duplicate it' });
        grid.apply(G.duplicateRows(data, [at]));
      } else if (act === 'del') {
        const at = activeIndex();
        if (at == null) return ctx.toast({ kind: 'info', title: 'Click a row to delete it' });
        grid.deleteRows([at]); state.activeRow = null; renderRow();
      } else if (act === 'import') fileIn.click();
      else if (act === 'export') exportTable();
      else if (act === 'review') openReview();
    });
    fileIn.addEventListener('change', async () => {
      const file = fileIn.files?.[0]; fileIn.value = '';
      if (!file || !needTable()) return;
      try {
        const key = keyColumnOf(state.grid.getData().columns);
        state.grid.importText(await file.text(), { format: 'auto', mode: key ? 'merge' : 'append', key: key ? key.key : null });
        ctx.toast({ kind: 'success', title: `Imported ${basename(file.name)}`, detail: key ? `Merged by ${key.key}.` : 'Rows appended.' });
      } catch (e) { ctx.toast({ kind: 'error', title: 'Import refused', detail: e.message }); }
    });
    function exportTable() {
      const table = state.parsed.get(state.selected);
      const text = serializeTable(table, state.grid.getData());
      const url = URL.createObjectURL(new Blob([text], { type: table.format === 'csv' ? 'text/csv' : 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = basename(state.selected); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ---------- lists and tabs ----------
    el.querySelector('.ds-find').addEventListener('input', (ev) => { state.filter = ev.target.value; renderList(); });
    groupsEl.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-path]'); if (b) select(b.dataset.path);
    });
    el.querySelector('.ds-tabs').addEventListener('click', (ev) => {
      const tab = ev.target.closest('[data-tab]')?.dataset.tab; if (!tab) return;
      state.tab = tab;
      el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      rowPanel.classList.toggle('ds-hidden', tab !== 'row');
      checkPanel.classList.toggle('ds-hidden', tab !== 'check');
    });

    ctx.shortcuts.register('Mod+S', 'Review & save', () => { openReview(); }, { inInput: true });
    loadList().then(() => {
      const first = state.tables[0];
      if (first) select(first.path);
      else gridEl.innerHTML = '<div class="ds-note">No tables found.</div>';
    }).catch((e) => { gridEl.innerHTML = `<div class="ds-note">${esc(e.message)}</div>`; });

    return {
      commands: () => [],
    };
  },
};
