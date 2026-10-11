// workbench/ui/kit/canvas-panels.mjs — the layers panel and the inspector over a
// createCanvas() controller. Re-exported from canvas.mjs. No DOM at import time.
import * as M from './canvas-model.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TOP_KEYS = ['x', 'y', 'w', 'h', 'rot', 'label', 'locked', 'hidden', 'z'];

// ---------------------------------------------------------------------------
// Layers panel
// ---------------------------------------------------------------------------

/**
 * createLayersPanel(el, canvas) → { refresh, destroy }.
 * Top layer first. Eye and lock toggles, drag a row onto the upper or lower
 * half of another to restack, right-click for duplicate, delete, group,
 * ungroup, bring forward, send backward, and drill into / exit a group.
 */
export function createLayersPanel(el, canvas) {
  const doc0 = globalThis.document;
  el.classList.add('ck-layers');
  el.innerHTML = '<div class="ck-panel-head"><span>Layers</span><button type="button" class="ck-exit" hidden></button></div>'
    + '<ol class="ck-layer-list"></ol><div class="ck-menu" role="menu" hidden></div>';
  const list = el.querySelector('.ck-layer-list');
  const menu = el.querySelector('.ck-menu');
  const exitBtn = el.querySelector('.ck-exit');
  let dragId = null;
  let menuFor = null;

  function paint() {
    const doc = canvas.getDoc();
    const sel = new Set(canvas.getSelection());
    const scope = canvas.getScope();
    exitBtn.hidden = scope === null;
    if (scope !== null) exitBtn.textContent = `Exit group ${scope}`;
    const rows = M.sortedByZ(doc).reverse().filter((it) => scope === null || it.group === scope);
    list.textContent = '';
    for (const it of rows) {
      const li = doc0.createElement('li');
      li.className = `ck-layer${sel.has(it.id) ? ' selected' : ''}${it.hidden ? ' is-hidden' : ''}${it.locked ? ' is-locked' : ''}`;
      li.dataset.id = it.id;
      li.draggable = true;
      li.innerHTML = `<button type="button" class="ck-tog" data-act="vis" aria-pressed="${!it.hidden}">${it.hidden ? 'Hidden' : 'Shown'}</button>`
        + `<button type="button" class="ck-tog" data-act="lock" aria-pressed="${it.locked}">${it.locked ? 'Locked' : 'Free'}</button>`
        + '<span class="ck-name"></span>'
        + (it.group ? `<span class="ck-badge">${esc(it.group)}</span>` : '');
      li.querySelector('.ck-name').textContent = it.label;
      list.append(li);
    }
  }

  function hideMenu() { menu.hidden = true; menuFor = null; }

  function showMenu(id, x, y) {
    if (!M.byId(canvas.getDoc(), id)) return;
    const it = M.byId(canvas.getDoc(), id);
    const scope = canvas.getScope();
    const items = [['duplicate', 'Duplicate'], ['remove', 'Delete'], ['group', 'Group'], ['ungroup', 'Ungroup'], ['forward', 'Bring forward'], ['backward', 'Send backward']];
    if (it.group && scope === null) items.push(['drill', `Drill into group ${it.group}`]);
    if (scope !== null) items.push(['exit', 'Exit group']);
    menu.innerHTML = items.map(([cmd, label]) => `<button type="button" role="menuitem" data-cmd="${cmd}">${esc(label)}</button>`).join('');
    const box = el.getBoundingClientRect();
    menu.style.left = `${Math.max(0, x - box.left)}px`;
    menu.style.top = `${Math.max(0, y - box.top)}px`;
    menu.hidden = false;
    menuFor = id;
  }

  const COMMANDS = {
    duplicate: () => canvas.duplicate(),
    remove: () => canvas.remove(),
    group: () => canvas.group(),
    ungroup: () => canvas.ungroup(),
    forward: () => canvas.reorder('forward'),
    backward: () => canvas.reorder('backward'),
    drill: (id) => { const it = M.byId(canvas.getDoc(), id); if (it && it.group) canvas.drill(it.group); },
    exit: () => canvas.drill(null),
  };

  const rowOf = (target) => (target && target.closest ? target.closest('.ck-layer') : null);

  function onClick(e) {
    const exit = e.target.closest ? e.target.closest('.ck-exit') : null;
    if (exit) { canvas.drill(null); return; }
    const row = rowOf(e.target);
    if (!row) return;
    const id = row.dataset.id;
    const it = M.byId(canvas.getDoc(), id);
    if (!it) return;
    const act = e.target.dataset ? e.target.dataset.act : null;
    if (act === 'vis') { canvas.update([id], { hidden: !it.hidden }, it.hidden ? 'Show layer' : 'Hide layer'); return; }
    if (act === 'lock') { canvas.update([id], { locked: !it.locked }, it.locked ? 'Unlock layer' : 'Lock layer'); return; }
    canvas.select([id], { add: e.shiftKey });
  }

  function onContext(e) {
    const row = rowOf(e.target);
    if (!row) return;
    e.preventDefault();
    const id = row.dataset.id;
    if (!canvas.getSelection().includes(id)) canvas.select([id]);
    showMenu(id, e.clientX, e.clientY);
  }

  function onMenuClick(e) {
    const btn = e.target.closest ? e.target.closest('[data-cmd]') : null;
    if (!btn) return;
    const id = menuFor;
    hideMenu();
    const fn = COMMANDS[btn.dataset.cmd];
    if (fn) fn(id);
  }

  function onDragStart(e) {
    const row = rowOf(e.target);
    if (!row) return;
    dragId = row.dataset.id;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', dragId);
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  const placementFor = (e, row) => (e.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? 'above' : 'below');

  function clearDropMarks() {
    for (const r of list.querySelectorAll('.drop-above, .drop-below')) r.classList.remove('drop-above', 'drop-below');
  }

  function onDragOver(e) {
    const row = rowOf(e.target);
    if (!dragId || !row || row.dataset.id === dragId) return;
    e.preventDefault();
    clearDropMarks();
    row.classList.add(placementFor(e, row) === 'above' ? 'drop-above' : 'drop-below');
  }

  function onDrop(e) {
    const row = rowOf(e.target);
    if (!dragId || !row) return;
    e.preventDefault();
    const target = row.dataset.id;
    const placement = placementFor(e, row);
    const from = dragId;
    dragId = null;
    clearDropMarks();
    if (from !== target) canvas.stackMove(from, target, placement);
  }

  function onDragEnd() { dragId = null; clearDropMarks(); }

  const onDocDown = (e) => { if (!menu.contains(e.target)) hideMenu(); };
  const onKey = (e) => { if (e.key === 'Escape') hideMenu(); };

  el.addEventListener('click', onClick);
  el.addEventListener('contextmenu', onContext);
  el.addEventListener('dragstart', onDragStart);
  el.addEventListener('dragover', onDragOver);
  el.addEventListener('drop', onDrop);
  el.addEventListener('dragend', onDragEnd);
  menu.addEventListener('click', onMenuClick);
  doc0.addEventListener('pointerdown', onDocDown);
  doc0.addEventListener('keydown', onKey);
  const off = canvas.subscribe(paint);
  paint();

  return {
    refresh: paint,
    destroy() {
      off();
      el.removeEventListener('click', onClick);
      el.removeEventListener('contextmenu', onContext);
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('dragend', onDragEnd);
      menu.removeEventListener('click', onMenuClick);
      doc0.removeEventListener('pointerdown', onDocDown);
      doc0.removeEventListener('keydown', onKey);
      el.innerHTML = '';
    },
  };
}

// ---------------------------------------------------------------------------
// Inspector
// ---------------------------------------------------------------------------

const GEOM_FIELDS = [
  { key: 'x', label: 'X', type: 'number' },
  { key: 'y', label: 'Y', type: 'number' },
  { key: 'w', label: 'Width', type: 'number', min: 1 },
  { key: 'h', label: 'Height', type: 'number', min: 1 },
  { key: 'rot', label: 'Rotation', type: 'number', step: 1 },
];
const FLAG_FIELDS = [
  { key: 'label', label: 'Name', type: 'text' },
  { key: 'locked', label: 'Locked', type: 'check' },
  { key: 'hidden', label: 'Hidden', type: 'check' },
];

/**
 * createInspector(el, canvas, fields) → { refresh, destroy }.
 * fields: [{ key, label, type: 'text'|'number'|'check'|'select', options?: [value,label][]|string[], top?: true }]
 * A custom key lives in item.data[key] unless top:true (then it is an item property).
 * Multi-select shows shared values; mixed values are blank with a placeholder.
 * Each edit is one canvas.update() call, so one change per commit.
 */
export function createInspector(el, canvas, fields = []) {
  el.classList.add('ck-inspector');
  const custom = fields.map((f) => ({ ...f, type: f.type || 'text' }));
  const specs = [...GEOM_FIELDS, ...FLAG_FIELDS, ...custom];
  const isTop = (spec) => TOP_KEYS.includes(spec.key) || spec.top === true;
  const read = (it, spec) => (isTop(spec) ? it[spec.key] : (it.data ? it.data[spec.key] : undefined));
  const round = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

  function fieldHtml(spec, items) {
    const vals = items.map((it) => read(it, spec));
    const same = vals.every((v) => v === vals[0]);
    const shown = same ? vals[0] : undefined;
    const key = esc(spec.key);
    const label = esc(spec.label || spec.key);
    if (spec.type === 'check') {
      return `<label class="ck-field ck-check"><input type="checkbox" data-key="${key}"${shown === true ? ' checked' : ''}${same ? '' : ' data-mixed="1"'}> ${label}</label>`;
    }
    if (spec.type === 'select') {
      const opts = (spec.options || []).map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}"${same && shown === v ? ' selected' : ''}>${esc(l)}</option>`;
      }).join('');
      return `<label class="ck-field"><span>${label}</span><select data-key="${key}">${same ? '' : '<option value="" selected>Mixed</option>'}${opts}</select></label>`;
    }
    const isNum = spec.type === 'number';
    const value = same && shown !== undefined && shown !== null ? esc(round(shown)) : '';
    const min = spec.min !== undefined ? ` min="${spec.min}"` : '';
    const step = isNum ? ` step="${spec.step ?? 'any'}"` : '';
    return `<label class="ck-field"><span>${label}</span><input type="${isNum ? 'number' : 'text'}" data-key="${key}" value="${value}"${same ? '' : ' placeholder="Mixed"'}${min}${step}></label>`;
  }

  function paint() {
    const doc = canvas.getDoc();
    const items = canvas.getSelection().map((id) => M.byId(doc, id)).filter(Boolean);
    if (!items.length) {
      el.innerHTML = '<p class="ck-hint">Select an item to edit it. Shift-click adds to the selection.</p>';
      return;
    }
    const head = items.length === 1 ? esc(items[0].label) : `${items.length} selected · mixed values are blank`;
    el.innerHTML = `<div class="ck-panel-head"><span>${head}</span></div>`
      + `<div class="ck-grid2">${GEOM_FIELDS.map((s) => fieldHtml(s, items)).join('')}</div>`
      + FLAG_FIELDS.map((s) => fieldHtml(s, items)).join('')
      + custom.map((s) => fieldHtml(s, items)).join('');
  }

  function onChange(e) {
    const input = e.target;
    const key = input.dataset ? input.dataset.key : null;
    if (!key) return;
    const spec = specs.find((s) => s.key === key);
    if (!spec) return;
    let value;
    if (input.type === 'checkbox') value = input.checked;
    else if (input.type === 'number') {
      if (input.value === '') return;
      value = Number(input.value);
      if (!Number.isFinite(value)) { paint(); return; }
    } else {
      if (spec.type === 'select' && input.value === '') return;
      value = input.value;
    }
    const patch = isTop(spec) ? { [key]: value } : { data: { [key]: value } };
    canvas.update(canvas.getSelection(), patch, `Set ${spec.label || key}`);
  }

  el.addEventListener('change', onChange);
  const off = canvas.subscribe(paint);
  paint();
  return {
    refresh: paint,
    destroy() {
      off();
      el.removeEventListener('change', onChange);
      el.innerHTML = '';
    },
  };
}
