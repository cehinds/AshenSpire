// ui-studio/app.mjs — the studio page. State, rendering, pointer and keyboard
// handling, and the talk to server.mjs. Everything that can be computed
// without a DOM lives in model.mjs; everything that draws the wireframe
// lives in canvas.mjs.
import * as M from './model.mjs';
import { canvasSvg, pointerToDevice } from './canvas.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = { settings: 'ui-studio.settings', drafts: 'ui-studio.drafts', sketch: 'ui-studio.sketch', view: 'ui-studio.view' };
const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: nothing persists, the page still works */ } },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  api: null, // { token, root, branch } when server.mjs answers; null when opened as a plain page
  settings: M.clone(M.DEFAULT_SETTINGS),
  mode: 'config', tab: 'selection', tool: 'select',
  wireframeId: 'w4a', deviceId: 'desk-1280', orientation: 'auto', zoom: 'fit', freeSize: { width: 1024, height: 768 },
  files: new Map(), // rel → { text, hash, history }
  sketch: new M.History(M.newSketch()), sketchName: '', sketchHash: null, sketches: [],
  scope: 'base', // 'base' | 'breakpoint' — where a sketch edit lands
  selection: new Set(), guides: [], marquee: null, drag: null,
  search: '', raw: false, compile: null, validation: null, backups: [],
};

const wireframe = () => state.settings.wireframes.find((w) => w.id === state.wireframeId) || state.settings.wireframes[0];
const device = () => state.settings.devices.find((d) => d.id === state.deviceId) || state.settings.devices[0];
function orientationFor(d) { return state.orientation === 'auto' ? M.naturalOrientation(d) : state.orientation; }
function viewport() {
  const d = device();
  if (d.resizable) return M.viewportFor({ ...d, width: state.freeSize.width, height: state.freeSize.height }, state.orientation === 'auto' ? (state.freeSize.width >= state.freeSize.height ? 'landscape' : 'portrait') : state.orientation);
  return M.viewportFor(d, orientationFor(d));
}
const layoutFor = (vp) => M.gameLayoutFor(vp, state.settings.gameLayout);
const breakpointFor = (vp) => M.breakpointFor(state.settings.breakpoints, vp);
// A sketch carries its own breakpoints (they travel with the file), so its
// overrides resolve against those, never against the studio's current list.
const sketchBreakpointFor = (vp) => M.breakpointFor(state.sketch.present.breakpoints || [], vp);
const fileOf = (rel) => state.files.get(rel);
const activeRel = () => wireframe().file;
const activeFile = () => fileOf(activeRel());
const tokens = () => { const t = fileOf('ui/tokens.json'); return (t && t.history.present.vars) || {}; };
const proposedText = (file) => M.formatJson(file.history.present, { original: file.text });
const isDirty = (file) => proposedText(file) !== file.text.replace(/\r\n/g, '\n');
const dirtyFiles = () => [...state.files.entries()].filter(([, f]) => isDirty(f));
function regions() {
  const file = activeFile();
  if (!file) return [];
  const wf = wireframe();
  const parent = wf.parent && fileOf(wf.parent) ? fileOf(wf.parent).history.present : null;
  return M.regionsFor(wf, file.history.present, viewport(), { parent, tokens: tokens(), layoutMode: layoutFor(viewport()).mode, screens: state.settings.screens });
}
function sketchBoxesPx(vp = viewport()) {
  const s = state.sketch.present, bp = sketchBreakpointFor(vp);
  return s.boxes.map((b) => { const r = M.resolveBox(b, bp && bp.id); return { ...r, ...M.boxToPx(r, s.unit, vp) }; });
}
function scaleFor(vp, host) {
  if (state.zoom !== 'fit') return Number(state.zoom);
  const R = state.settings.canvas.showRulers !== false ? 20 : 0;
  const w = Math.max(200, host.clientWidth - 56 - R), h = Math.max(200, host.clientHeight - 56 - R);
  return Math.min(w / vp.width, h / vp.height, 2);
}

// ---------------------------------------------------------------------------
// Server talk (falls back to the page alone)
// ---------------------------------------------------------------------------
async function api(pathname, body) {
  if (!state.api) throw Error('No local server: open the studio with node ui-studio/server.mjs to save into the checkout');
  const res = await fetch(`/api/${pathname}`, { method: body ? 'POST' : 'GET', headers: { 'x-studio-token': state.api.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw Error(data.error || `HTTP ${res.status}`);
  return data;
}
function toast(text, bad = false) {
  const t = $('#toast'); t.textContent = text; t.hidden = false; t.classList.toggle('bad', bad);
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 2800);
  $('#status').textContent = text;
}
function dialog(html) { $('#dialog-body').innerHTML = html; $('#dialog').showModal(); }

async function boot() {
  const view = store.get(LS.view, {});
  Object.assign(state, { mode: view.mode || 'config', wireframeId: view.wireframeId || 'w4a', deviceId: view.deviceId || 'desk-1280', orientation: view.orientation || 'auto', zoom: view.zoom || 'fit', freeSize: view.freeSize || state.freeSize, scope: view.scope || 'base' });
  try {
    const session = await (await fetch('/api/session')).json();
    if (session.token) state.api = session;
  } catch { /* opened without the server */ }
  if (state.api) {
    state.settings = M.mergeSettings(M.DEFAULT_SETTINGS, await api('settings'));
    for (const e of await api('config')) loadFile(e);
    state.sketches = await api('sketches');
    $('#project').textContent = `${state.api.root} · ${state.api.branch}`;
  } else {
    state.settings = M.mergeSettings(M.DEFAULT_SETTINGS, store.get(LS.settings, {}));
    $('#project').textContent = 'No local server — files load and save through your browser (Save panel)';
    await tryStaticConfig();
  }
  const drafts = store.get(LS.drafts, {});
  for (const [rel, draft] of Object.entries(drafts)) { const f = fileOf(rel); if (f && draft.hash === f.hash) f.history = new M.History(draft.data); }
  const sketch = store.get(LS.sketch);
  if (sketch && !M.sketchProblems(sketch.sketch).length) { state.sketch = new M.History(sketch.sketch); state.sketchName = sketch.name || ''; state.sketchHash = sketch.hash || null; state.sketchSaved = sketch.saved || null; }
  else state.sketchSaved = M.clone(state.sketch.present);
  if (!state.settings.wireframes.some((w) => w.id === state.wireframeId)) state.wireframeId = state.settings.wireframes[0].id;
  if (!state.settings.devices.some((d) => d.id === state.deviceId)) state.deviceId = state.settings.devices[0].id;
  bindChrome();
  renderAll();
  new ResizeObserver(() => { if (state.zoom === 'fit') renderStage(); }).observe($('#stage-body'));
}
function loadFile({ rel, text, hash }) { state.files.set(rel, { text, hash, history: new M.History(JSON.parse(text)) }); }
async function tryStaticConfig() {
  // Served from the checkout by any static server: read the catalog's files relative to this page.
  const rels = [...new Set(['ui/tokens.json', ...state.settings.wireframes.flatMap((w) => [w.file, w.parent].filter(Boolean))])];
  await Promise.all(rels.map(async (rel) => { try { const res = await fetch(`../content/config/${rel}`); if (res.ok) loadFile({ rel, text: await res.text(), hash: null }); } catch { /* not served */ } }));
}
function persistView() { store.set(LS.view, { mode: state.mode, wireframeId: state.wireframeId, deviceId: state.deviceId, orientation: state.orientation, zoom: state.zoom, freeSize: state.freeSize, scope: state.scope }); }
function persistDrafts() {
  const drafts = {};
  for (const [rel, f] of state.files) if (isDirty(f)) drafts[rel] = { hash: f.hash, data: f.history.present };
  store.set(LS.drafts, drafts);
  store.set(LS.sketch, { sketch: state.sketch.present, name: state.sketchName, hash: state.sketchHash, saved: state.sketchSaved || null });
}
async function persistSettings() {
  const problems = M.settingsProblems(state.settings);
  if (problems.length) { toast(problems[0], true); return false; }
  if (state.api) { try { await api('settings', state.settings); } catch (e) { toast(e.message, true); return false; } }
  else store.set(LS.settings, state.settings);
  return true;
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------
function commitFile(rel, data) { const f = fileOf(rel); if (!f) return; f.history.push(data); persistDrafts(); renderAll(); }
function setValue(rel, path, value) { const f = fileOf(rel); if (f) commitFile(rel, M.setPath(f.history.present, path, value)); }
function commitSketch(next) { state.sketch.push(next); persistDrafts(); renderAll(); }
function undo() {
  if (state.mode === 'sketch') state.sketch.undo(); else { const f = activeFile(); if (f) f.history.undo(); }
  persistDrafts(); renderAll();
}
function redo() {
  if (state.mode === 'sketch') state.sketch.redo(); else { const f = activeFile(); if (f) f.history.redo(); }
  persistDrafts(); renderAll();
}
function sketchScope() { const bp = sketchBreakpointFor(viewport()); return { breakpointId: bp && bp.id, scope: state.scope === 'breakpoint' && bp ? 'breakpoint' : 'base' }; }
function selectedBoxes() { return state.sketch.present.boxes.filter((b) => state.selection.has(b.id)); }
function deleteSelection() {
  if (state.mode !== 'sketch' || !state.selection.size) return;
  const s = M.clone(state.sketch.present); s.boxes = s.boxes.filter((b) => !state.selection.has(b.id) || b.locked);
  state.selection.clear(); commitSketch(s);
}
function duplicateSelection() {
  if (state.mode !== 'sketch' || !state.selection.size) return;
  const s = M.clone(state.sketch.present); const ids = [];
  for (const b of selectedBoxes()) { const c = { ...M.clone(b), id: M.newId(), label: `${b.label} copy`, x: b.x + 2, y: b.y + 2 }; s.boxes.push(c); ids.push(c.id); }
  state.selection = new Set(ids); commitSketch(s);
}
function nudge(dx, dy) {
  if (state.mode !== 'sketch' || !state.selection.size) return;
  const vp = viewport(), unit = state.sketch.present.unit, sc = sketchScope();
  let s = state.sketch.present;
  for (const b of selectedBoxes()) {
    if (b.locked) continue;
    const r = M.boxToPx(M.resolveBox(b, sc.breakpointId), unit, vp);
    s = M.applyResolvedRect(s, b.id, { ...r, x: r.x + dx, y: r.y + dy }, vp, sc);
  }
  commitSketch(s);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderAll() { renderTop(); renderLeft(); renderStage(); renderRight(); renderFoot(); }

function renderTop() {
  const wf = $('#wireframe');
  wf.innerHTML = state.settings.wireframes.map((w) => `<option value="${esc(w.id)}"${w.id === state.wireframeId ? ' selected' : ''}>${esc(w.label)}${fileOf(w.file) && isDirty(fileOf(w.file)) ? ' ●' : ''}${fileOf(w.file) ? '' : ' (not loaded)'}</option>`).join('');
  const dv = $('#device');
  const groups = ['desktop', 'tablet', 'phone', 'responsive', 'other'];
  dv.innerHTML = groups.map((g) => {
    const items = state.settings.devices.filter((d) => (d.category || 'other') === g && (d.enabled !== false || d.id === state.deviceId));
    return items.length ? `<optgroup label="${esc(g)}">${items.map((d) => `<option value="${esc(d.id)}"${d.id === state.deviceId ? ' selected' : ''}>${esc(d.label)} · ${d.width}×${d.height}</option>`).join('')}</optgroup>` : '';
  }).join('');
  const d = device();
  $('#responsive-size').hidden = !d.resizable;
  $('#free-w').value = state.freeSize.width; $('#free-h').value = state.freeSize.height;
  $('#zoom').value = String(state.zoom);
  $('#orientation').textContent = `⟳ ${orientationFor(d) === 'landscape' ? 'Landscape' : 'Portrait'}${state.orientation === 'auto' ? ' (auto)' : ''}`;
  $$('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.mode));
  const h = state.mode === 'sketch' ? state.sketch : (activeFile() || {}).history;
  $('#undo').disabled = !(h && h.canUndo); $('#redo').disabled = !(h && h.canRedo);
  const n = dirtyFiles().length + (state.mode === 'sketch' && sketchDirty() ? 1 : 0);
  $('#dirty-count').textContent = String(n);
}
function sketchDirty() { return JSON.stringify(state.sketch.present) !== JSON.stringify(state.sketchSaved || null); }

function renderLeft() {
  const left = $('#left');
  if (state.mode === 'sketch') {
    const s = state.sketch.present, bp = sketchBreakpointFor(viewport());
    const sameList = JSON.stringify(s.breakpoints || []) === JSON.stringify(state.settings.breakpoints);
    left.innerHTML = `
      <section><h3>Tools</h3><div class="tools">
        <button data-tool="select" class="${state.tool === 'select' ? 'active' : ''}" title="Select (V)">↖ Select</button>
        <button data-tool="box" class="${state.tool === 'box' ? 'active' : ''}" title="Draw box (B)">▭ Box</button>
        <button data-tool="pan" class="${state.tool === 'pan' ? 'active' : ''}" title="Pan (H)">✋ Pan</button>
      </div>
      <div class="tools" style="margin-top:6px">
        <button data-act="add-box" title="Add a box at the centre">+ Add</button>
        <button data-act="dup" ${state.selection.size ? '' : 'disabled'} title="Duplicate (Ctrl+D)">⧉</button>
        <button data-act="del" ${state.selection.size ? '' : 'disabled'} title="Delete (Del)" class="danger">🗑</button>
      </div></section>
      <section><h3>Sketch</h3>
        <div class="row"><input class="grow" id="sketch-title" value="${esc(s.name)}" aria-label="Sketch title"></div>
        <div class="row"><label>Units</label><select id="sketch-unit"><option value="percent"${s.unit === 'percent' ? ' selected' : ''}>% of viewport (responsive)</option><option value="px"${s.unit === 'px' ? ' selected' : ''}>px (fixed)</option></select></div>
        <div class="row"><label>Edits go to</label><select id="sketch-scope"><option value="base"${state.scope === 'base' ? ' selected' : ''}>every size (base)</option><option value="breakpoint"${state.scope === 'breakpoint' ? ' selected' : ''}>this breakpoint only${bp ? ` (${esc(bp.label)})` : ''}</option></select></div>
        <div class="hint">Current breakpoint: <strong>${esc(bp ? bp.label : 'none matches')}</strong> (the sketch's own list: ${(s.breakpoints || []).map((b) => esc(b.id)).join(', ') || 'none'}). A box edited for one breakpoint keeps its base geometry elsewhere.${sameList ? '' : ' <button class="small" data-act="adopt-breakpoints">Use the studio\'s breakpoints</button>'}</div>
      </section>
      <section><h3>Boxes <span class="dim">(${s.boxes.length}, top last)</span></h3><ul class="list" id="box-list">${[...s.boxes].reverse().map((b) => {
        const r = M.resolveBox(b, bp && bp.id);
        return `<li data-box="${esc(b.id)}" class="${state.selection.has(b.id) ? 'selected' : ''}"><span>${b.hidden ? '◌' : '●'}</span><span class="grow">${esc(b.label)}</span><span class="dim">${r.overridden ? '⤷ override' : ''}${b.locked ? ' 🔒' : ''}</span></li>`;
      }).join('') || '<li class="dim">Draw a box with the Box tool, or press + Add.</li>'}</ul></section>
      <section><h3>Saved sketches</h3><ul class="list">${state.sketches.map((k) => `<li data-sketch="${esc(k.name)}"><span class="grow">${esc(k.title || k.name)}</span><span class="dim">${k.boxes ?? '?'} boxes</span></li>`).join('') || '<li class="dim">None saved yet.</li>'}</ul>
        <div class="row"><button data-act="new-sketch">New sketch</button><button data-act="open-json">Open JSON…</button></div>
      </section>`;
    return;
  }
  const groups = { scenes: [], components: [], screens: [], presentation: [], root: [] };
  for (const rel of [...state.files.keys()].sort()) { const g = rel.split('/')[1]; (groups[g && rel.split('/').length === 3 ? g : 'root'] || groups.root).push(rel); }
  left.innerHTML = `
    <section><h3>Wireframes</h3><ul class="list">${state.settings.wireframes.map((w) => `<li data-wireframe="${esc(w.id)}" class="${w.id === state.wireframeId ? 'selected' : ''}${fileOf(w.file) && isDirty(fileOf(w.file)) ? ' dirty' : ''}"><span class="grow">${esc(w.label)}</span><span class="dim">${esc(w.draw)}</span></li>`).join('')}</ul>
    <div class="hint">Every config file is also editable on the right, under Values; a file without a wireframe draws as a plain viewport.</div></section>
    <section><h3>Config files</h3>${Object.entries(groups).map(([g, rels]) => rels.length ? `<h3>${esc(g)}</h3><ul class="list">${rels.map((rel) => `<li data-file="${esc(rel)}" class="${rel === activeRel() ? 'selected' : ''}${isDirty(fileOf(rel)) ? ' dirty' : ''}"><span class="grow mono">${esc(rel.replace(/^ui\//, '').replace(/\.json$/, ''))}</span></li>`).join('')}</ul>` : '').join('')}</section>`;
}

function renderStage() {
  const head = $('#stage-head'), body = $('#stage-body');
  const vp = viewport(), lay = layoutFor(vp), bp = breakpointFor(vp), d = device();
  const layoutText = state.settings.canvas.showGameLayout !== false ? ` · game: <span class="badge ${lay.mode}">${lay.mode}</span> zoom ${lay.zoom} (local ${lay.localWidth}×${lay.localHeight}${lay.short ? ', SHORT — the upright gate shows' : ''})` : '';
  if (state.mode === 'compare') {
    head.innerHTML = `Every enabled device, ${state.mode === 'compare' && state.sketch.present.boxes.length && !activeFile() ? 'sketch' : esc(wireframe().label)} — click one to open it.`;
    const items = state.settings.devices.filter((x) => x.enabled !== false && !x.resizable);
    body.innerHTML = `<div class="compare">${items.flatMap((dev) => {
      const orientations = dev.category === 'phone' || dev.category === 'tablet' ? ['portrait', 'landscape'] : [M.naturalOrientation(dev)];
      return orientations.map((o) => {
        const v = M.viewportFor(dev, o), l = layoutFor(v), b = breakpointFor(v);
        const wf = wireframe(), file = fileOf(wf.file);
        const regs = file ? M.regionsFor(wf, file.history.present, v, { parent: wf.parent && fileOf(wf.parent) ? fileOf(wf.parent).history.present : null, tokens: tokens(), layoutMode: l.mode, screens: state.settings.screens }) : [];
        const svg = canvasSvg({ viewport: v, scale: Math.min(230 / v.width, 250 / v.height), grid: state.settings.grid, canvas: state.settings.canvas, regions: regs, boxes: sketchBoxesPx(v), selection: new Set(), compact: true });
        return `<figure data-device="${esc(dev.id)}" data-orientation="${o}"><figcaption><span>${esc(dev.label)} ${o === 'landscape' ? '⟷' : '↕'}</span><span>${v.width}×${v.height} · <span class="badge ${l.mode}">${l.mode}</span> ${l.zoom}× · ${esc(b ? b.id : '—')}</span></figcaption>${svg}</figure>`;
      });
    }).join('')}</div>`;
    return;
  }
  if (state.mode === 'game') {
    const wf = wireframe();
    if (!state.api) { head.innerHTML = 'The live game needs the local server.'; body.innerHTML = '<p class="hint" style="padding:20px">Run <code>node ui-studio/server.mjs</code> and open the address it prints; the game then loads here at the chosen device size.</p>'; return; }
    const scale = scaleFor(vp, body);
    const shotName = wf.shot || 'combat';
    head.innerHTML = `Live game at ${vp.width}×${vp.height} (${Math.round(scale * 100)}%)${layoutText} · <code>?shot=${esc(shotName)}</code> <button class="small" data-act="reload-game">Reload</button> <span class="hint">Saved and compiled config only: an unsaved edit is not on this screen.</span>`;
    // The frame is rebuilt only when the fixture or the size changes (or Reload
    // asks); a re-render for a resize just rescales it, so the game is not
    // reloaded — and its first navigation not aborted — by the stage settling.
    const existing = body.querySelector('iframe[title="Live game"]');
    const key = `${shotName}@${vp.width}x${vp.height}`;
    if (existing && existing.dataset.key === key && !state.reloadGame) {
      existing.style.transform = `scale(${scale})`;
      Object.assign(existing.parentElement.style, { width: `${vp.width * scale}px`, height: `${vp.height * scale}px` });
      return;
    }
    state.reloadGame = false;
    body.innerHTML = `<div class="game-frame"><div class="frame-box" style="width:${vp.width * scale}px;height:${vp.height * scale}px"><iframe title="Live game" data-key="${esc(key)}" src="${esc(location.origin.replace('127.0.0.1', 'localhost'))}/game/index.html?shot=${encodeURIComponent(shotName)}&shotStamp=${Date.now()}" width="${vp.width}" height="${vp.height}" style="transform:scale(${scale})"></iframe></div></div>`;
    return;
  }
  const scale = scaleFor(vp, body);
  const name = d.resizable ? `${vp.width}×${vp.height}` : `${esc(d.label)} ${vp.width}×${vp.height}`;
  head.innerHTML = `${name} · ${Math.round(scale * 100)}%${layoutText} · breakpoint <strong>${esc(bp ? bp.label : 'none')}</strong>
    <span class="spacer"></span>
    <label class="field"><input type="checkbox" data-grid="show" ${state.settings.grid.show ? 'checked' : ''}> Grid (G)</label>
    <label class="field"><input type="checkbox" data-grid="snap" ${state.settings.grid.snap ? 'checked' : ''}> Snap (S)</label>
    <label class="field"><input type="checkbox" data-grid="snapToEdges" ${state.settings.grid.snapToEdges ? 'checked' : ''}> Guides</label>
    <label class="field">Step <input type="number" data-grid="sizePx" min="1" max="200" value="${state.settings.grid.sizePx}" style="width:4em"> px</label>`;
  const view = { viewport: vp, scale, grid: state.settings.grid, canvas: state.settings.canvas, tool: state.mode === 'sketch' ? state.tool : null, selection: state.selection, guides: state.guides, marquee: state.marquee,
    regions: state.mode === 'config' ? regions() : [], boxes: state.mode === 'sketch' ? sketchBoxesPx(vp) : (state.settings.canvas.showSketchOverConfig ? sketchBoxesPx(vp) : []) };
  body.innerHTML = `<div class="canvas-wrap">${canvasSvg(view)}</div>`;
}

function renderFoot() {
  const vp = viewport(), lay = layoutFor(vp);
  const b = $('#layout-badge'); b.className = `badge ${lay.mode}`; b.textContent = `${vp.width}×${vp.height} → ${lay.mode}, zoom ${lay.zoom}`;
}

function renderRight() {
  $$('#right-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  const body = $('#right-body');
  if (state.tab === 'selection') body.innerHTML = state.mode === 'sketch' ? selectionSketchHtml() : selectionConfigHtml();
  else if (state.tab === 'values') body.innerHTML = valuesHtml();
  else if (state.tab === 'settings') body.innerHTML = settingsHtml();
  else body.innerHTML = filesHtml();
}

function numberInput(path, value, { step = 'any', attrs = '' } = {}) {
  const unit = M.unitOf(path);
  return `<span><input type="number" step="${step}" data-path="${esc(path)}" data-kind="number" value="${esc(value)}" ${attrs}><span class="unit">${esc(unit)}</span></span>`;
}
function leafInput(path, value, kind, vars) {
  switch (kind) {
    case 'number': return numberInput(path, value);
    case 'boolean': return `<input type="checkbox" data-path="${esc(path)}" data-kind="boolean" ${value ? 'checked' : ''}>`;
    case 'ref': return `<span><select data-path="${esc(path)}" data-kind="ref">${vars.map((v) => `<option value="$${esc(v.name)}"${`$${v.name}` === value ? ' selected' : ''}>$${esc(v.name)} = ${esc(v.value)}</option>`).join('')}</select> <button class="small" data-unref="${esc(path)}" title="Replace the variable with its number">#</button></span>`;
    case 'fraction': return `<span class="frac"><input type="number" step="any" data-path="${esc(path)}.numerator" data-kind="number" value="${esc(value.numerator)}"> / <input type="number" step="any" data-path="${esc(path)}.denominator" data-kind="number" value="${esc(value.denominator)}"> <span class="unit">= ${esc(M.round(value.numerator / value.denominator, 4))}</span></span>`;
    case 'list': return `<input type="text" data-path="${esc(path)}" data-kind="list" value="${esc(value.map((v) => JSON.stringify(v)).join(', '))}" title="Comma-separated JSON values">`;
    case 'null': return `<input type="text" data-path="${esc(path)}" data-kind="json" value="null">`;
    default: return `<input type="text" data-path="${esc(path)}" data-kind="string" value="${esc(value)}">`;
  }
}
function varsFor(file) {
  // The file's own vars first, then the tokens: the compiler's lookup order,
  // so `#` and the picker name the number the game will use.
  const out = [];
  for (const [name, value] of Object.entries((file && file.history.present.vars) || {})) out.push({ name, value, from: 'file' });
  for (const [name, value] of Object.entries(tokens())) if (!out.some((v) => v.name === name)) out.push({ name, value, from: 'tokens' });
  return out;
}

function selectionConfigHtml() {
  const file = activeFile(); const wf = wireframe();
  if (!file) return `<p class="hint">${esc(wf.file)} is not loaded. With the server running every config file loads; without it, use Save → Open JSON.</p>`;
  const regs = regions(); const sel = regs.filter((r) => state.selection.has(r.id));
  const vp = viewport(); const lay = layoutFor(vp);
  const original = JSON.parse(file.text);
  let html = `<h3>${esc(wf.label)}</h3><div class="hint mono">${esc(wf.file)}${wf.parent ? ` · parent ${esc(wf.parent)}` : ''}</div>`;
  html += `<div class="hint">Drag a band edge or a dashed edge on the canvas; values snap to ${state.settings.grid.bandStepPercent}% (Settings → Grid). Layout drawn for the game's <strong>${lay.mode}</strong> mode.</div>`;
  if (!sel.length) html += '<p class="hint">Click a region to edit its numbers here. The whole file is under Values.</p>';
  for (const r of sel) {
    html += `<section style="padding:8px 0"><h3>${esc(r.label)}</h3>`;
    if (r.band != null) {
      const path = (r.edit && r.edit.path) || (regs.find((x) => x.edit && x.edit.kind === 'bandEdge') || { edit: { path: 'sizing.bands' } }).edit.path;
      const bands = M.getPath(file.history.present, path) || {};
      html += `<div class="hint">Bands of <code>${esc(path)}</code> always sum to 100: the slack moves to the next band.</div>`;
      for (const [id, pct] of Object.entries(bands)) html += `<div class="row"><label>${esc(id)}</label><input type="range" min="0" max="100" step="${state.settings.grid.bandStepPercent}" value="${pct}" data-band="${esc(id)}" data-bands-path="${esc(path)}" class="grow"><input type="number" min="0" max="100" step="${state.settings.grid.bandStepPercent}" value="${pct}" data-band="${esc(id)}" data-bands-path="${esc(path)}"> <span class="unit">${M.round(vp.height * pct / 100, 0)}px</span></div>`;
    } else if (r.edit && r.edit.kind === 'path') {
      for (const p of [r.edit.path, r.edit.pathH].filter(Boolean)) {
        const v = M.getPath(file.history.present, p); const kind = M.leafKind(v);
        html += `<div class="values"><div class="leaf${JSON.stringify(v) !== JSON.stringify(M.getPath(original, p)) ? ' changed' : ''}"><span class="path">${esc(p)}</span>${leafInput(p, v, kind, varsFor(file))}</div></div>`;
      }
    } else html += '<div class="hint">This region is derived from other values; edit them under Values.</div>';
    html += `<div class="hint">${M.round(r.w, 0)}×${M.round(r.h, 0)}px at ${M.round(r.x, 0)},${M.round(r.y, 0)}</div></section>`;
  }
  return html;
}

function selectionSketchHtml() {
  const s = state.sketch.present, sel = selectedBoxes(), vp = viewport(), sc = sketchScope();
  const bp = sketchBreakpointFor(vp);
  let html = `<h3>${sel.length ? `${sel.length} selected` : 'Nothing selected'}</h3>`;
  if (!sel.length) return `${html}<p class="hint">Click a box, drag a marquee, or draw a new one with the Box tool (B). Shift-click adds to the selection.</p><p class="hint">Arrow keys nudge by ${state.settings.grid.nudgePx}px, Shift+arrows by ${state.settings.grid.nudgeLargePx}px. Ctrl+D duplicates, Delete removes.</p>`;
  html += `<div class="tools"><button data-align="left" title="Align left">⇤</button><button data-align="hcenter" title="Centre horizontally">↔</button><button data-align="right" title="Align right">⇥</button><button data-align="top" title="Align top">⤒</button><button data-align="vcenter" title="Centre vertically">↕</button><button data-align="bottom" title="Align bottom">⤓</button></div>
    <div class="hint">${sel.length > 1 ? 'Aligns the selection to its own bounds.' : 'Aligns to the viewport.'}</div>
    <div class="tools" style="margin-top:6px"><button data-order="-Infinity" title="Send to back">⇊</button><button data-order="-1" title="Send backward">↓</button><button data-order="1" title="Bring forward">↑</button><button data-order="Infinity" title="Bring to front">⇈</button></div>`;
  for (const b of sel) {
    const r = M.resolveBox(b, bp && bp.id);
    html += `<section style="padding:8px 0"><div class="row"><input class="grow" data-box-field="label" data-box="${esc(b.id)}" value="${esc(b.label)}" aria-label="Label"></div>
      <div class="row"><label>x</label><input type="number" step="any" data-box-geom="x" data-box="${esc(b.id)}" value="${r.x}"><label>y</label><input type="number" step="any" data-box-geom="y" data-box="${esc(b.id)}" value="${r.y}"></div>
      <div class="row"><label>w</label><input type="number" step="any" data-box-geom="w" data-box="${esc(b.id)}" value="${r.w}"><label>h</label><input type="number" step="any" data-box-geom="h" data-box="${esc(b.id)}" value="${r.h}"> <span class="unit">${s.unit === 'percent' ? '% of viewport' : 'px'}</span></div>
      <div class="hint">= ${M.round(M.boxToPx(r, s.unit, vp).w, 0)}×${M.round(M.boxToPx(r, s.unit, vp).h, 0)}px here${r.overridden ? ` · <strong>overridden for ${esc(bp.label)}</strong> <button class="small" data-clear-override="${esc(b.id)}">reset to base</button>` : ''}${sc.scope === 'breakpoint' ? ' · edits go to this breakpoint' : ''}</div>
      <div class="row"><label><input type="checkbox" data-box-field="locked" data-box="${esc(b.id)}" ${b.locked ? 'checked' : ''}> locked</label><label><input type="checkbox" data-box-field="hidden" data-box="${esc(b.id)}" ${r.hidden ? 'checked' : ''}> hidden${sc.scope === 'breakpoint' ? ' here' : ''}</label></div>
      <div class="row"><label>Note</label><input class="grow" data-box-field="note" data-box="${esc(b.id)}" value="${esc(b.note || '')}" placeholder="what this box is for"></div></section>`;
  }
  return html;
}

function valuesHtml() {
  const file = activeFile();
  if (!file) return '<p class="hint">No file loaded for this wireframe.</p>';
  const data = file.history.present, original = JSON.parse(file.text);
  if (state.raw) return `<div class="row"><button data-act="raw-off">Back to fields</button><button data-act="raw-apply" class="primary">Apply JSON</button></div><textarea class="raw" id="raw-json" spellcheck="false">${esc(proposedText(file))}</textarea><div class="problems" id="raw-problems"></div>`;
  const leaves = M.flattenConfig(data).filter((l) => !state.search || l.path.toLowerCase().includes(state.search.toLowerCase()));
  const vars = varsFor(file);
  const groups = {};
  for (const l of leaves) (groups[l.section] ||= []).push(l);
  return `<input class="search" id="search" placeholder="Filter by path (e.g. hand.min, footer)" value="${esc(state.search)}">
    <div class="row"><button data-act="raw-on" class="small">Edit as JSON</button><button data-act="add-value" class="small">+ Add value</button><span class="hint">${leaves.length} values · <code>$name</code> reads a variable · <code>{numerator, denominator}</code> is a fraction</span></div>
    <div class="values">${Object.entries(groups).map(([section, ls]) => `<div class="group"><h3>${esc(section)}</h3>${ls.map((l) => `<div class="leaf${JSON.stringify(l.value) !== JSON.stringify(M.getPath(original, l.path)) ? ' changed' : ''}"><span class="path" title="${esc(l.path)}">${esc(l.path.replace(`${section}.`, ''))}</span>${leafInput(l.path, l.value, l.kind, vars)}</div>`).join('')}</div>`).join('')}</div>`;
}

function settingsHtml() {
  const s = state.settings, g = s.grid, c = s.canvas;
  const dev = (d, i) => `<tr data-device-row="${i}"><td><input type="checkbox" data-dev="enabled" ${d.enabled !== false ? 'checked' : ''}></td><td><input type="text" data-dev="label" value="${esc(d.label)}"></td><td><input type="number" data-dev="width" value="${d.width}"></td><td><input type="number" data-dev="height" value="${d.height}"></td><td><select data-dev="category">${['desktop', 'tablet', 'phone', 'responsive', 'other'].map((k) => `<option${(d.category || 'other') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></td><td><input type="number" data-dev="safeTop" value="${(d.safe || {}).top || 0}"></td><td><input type="number" data-dev="safeBottom" value="${(d.safe || {}).bottom || 0}"></td><td><button class="small" data-dev-act="dup" title="Duplicate">⧉</button><button class="small danger" data-dev-act="del" title="Remove">✕</button></td></tr>`;
  const bpr = (b, i) => `<tr data-bp-row="${i}"><td><input type="text" data-bp="id" value="${esc(b.id)}" style="width:6em"></td><td><input type="text" data-bp="label" value="${esc(b.label)}"></td><td><input type="number" data-bp="minWidth" value="${b.minWidth ?? ''}" placeholder="any"></td><td><input type="number" data-bp="maxWidth" value="${b.maxWidth ?? ''}" placeholder="any"></td><td><input type="number" data-bp="maxHeight" value="${b.maxHeight ?? ''}" placeholder="any"></td><td><button class="small danger" data-bp-act="del">✕</button></td></tr>`;
  const wfr = (w, i) => `<tr data-wf-row="${i}"><td><input type="text" data-wf="label" value="${esc(w.label)}"></td><td><input type="text" data-wf="file" value="${esc(w.file)}" class="mono"></td><td><select data-wf="draw">${['bands', 'dialogue', 'map', 'choiceBody', 'armoury', 'shop', 'smith', 'card', 'generic'].map((k) => `<option${w.draw === k ? ' selected' : ''}>${k}</option>`).join('')}</select></td><td><input type="text" data-wf="shot" value="${esc(w.shot || '')}" style="width:6em"></td><td><button class="small danger" data-wf-act="del">✕</button></td></tr>`;
  return `<h3>Grid & snapping</h3>
    <div class="row"><label>Grid step</label><input type="number" min="1" max="200" data-setting="grid.sizePx" value="${g.sizePx}"> px <label>subdivisions</label><input type="number" min="1" max="10" data-setting="grid.subdivisions" value="${g.subdivisions}"></div>
    <div class="row"><label>Snap distance</label><input type="number" min="0" max="50" data-setting="grid.thresholdPx" value="${g.thresholdPx}"> px</div>
    <div class="row"><label>Band step</label><input type="number" min="0.1" max="50" step="0.1" data-setting="grid.bandStepPercent" value="${g.bandStepPercent}"> % (config drags round to this)</div>
    <div class="row"><label>Nudge</label><input type="number" min="1" data-setting="grid.nudgePx" value="${g.nudgePx}"> px, with Shift <input type="number" min="1" data-setting="grid.nudgeLargePx" value="${g.nudgeLargePx}"> px</div>
    <div class="row"><label><input type="checkbox" data-setting="grid.show" ${g.show ? 'checked' : ''}> show grid</label><label><input type="checkbox" data-setting="grid.snap" ${g.snap ? 'checked' : ''}> snap to grid</label></div>
    <div class="row"><label><input type="checkbox" data-setting="grid.snapToEdges" ${g.snapToEdges ? 'checked' : ''}> viewport edges & centre</label><label><input type="checkbox" data-setting="grid.snapToBoxes" ${g.snapToBoxes ? 'checked' : ''}> other boxes</label><label><input type="checkbox" data-setting="grid.snapToSafeArea" ${g.snapToSafeArea ? 'checked' : ''}> safe area</label></div>
    <h3>Canvas</h3>
    <div class="row"><label><input type="checkbox" data-setting="canvas.showRulers" ${c.showRulers !== false ? 'checked' : ''}> rulers</label><label><input type="checkbox" data-setting="canvas.showSafeArea" ${c.showSafeArea !== false ? 'checked' : ''}> safe area</label><label><input type="checkbox" data-setting="canvas.showLabels" ${c.showLabels !== false ? 'checked' : ''}> labels</label></div>
    <div class="row"><label><input type="checkbox" data-setting="canvas.showGameLayout" ${c.showGameLayout !== false ? 'checked' : ''}> game layout badge</label><label><input type="checkbox" data-setting="canvas.showSketchOverConfig" ${c.showSketchOverConfig ? 'checked' : ''}> sketch boxes over config</label></div>
    <h3>Devices <span class="hint">(${s.devices.filter((d) => d.enabled !== false).length} enabled — Compare shows the enabled ones)</span></h3>
    <table class="grid"><thead><tr><th>on</th><th>label</th><th>w</th><th>h</th><th>kind</th><th>safe ▲</th><th>safe ▼</th><th></th></tr></thead><tbody>${s.devices.map(dev).join('')}</tbody></table>
    <div class="row"><button data-act="add-device">+ Add device</button><button data-act="reset-devices">Reset to defaults</button></div>
    <div class="hint">Sizes are CSS px of the viewport (what the game sees), not hardware pixels. Phones and tablets are drawn in both orientations under Compare.</div>
    <h3>Breakpoints</h3>
    <table class="grid"><thead><tr><th>id</th><th>label</th><th>min w</th><th>max w</th><th>max h</th><th></th></tr></thead><tbody>${s.breakpoints.map(bpr).join('')}</tbody></table>
    <div class="row"><button data-act="add-bp">+ Add breakpoint</button></div>
    <div class="hint">The first matching breakpoint wins. Sketch boxes may carry an override per breakpoint. The defaults follow the game: narrow at or below ${s.gameLayout.narrowMax}px, compact below the ${esc(String((tokens().compactBelowPx) || 768))}px token.</div>
    <h3>Game layout decision</h3>
    <div class="row">${['designW', 'designH', 'narrowW', 'narrowH', 'narrowMax', 'gateBelowH', 'shortWideMinH', 'min', 'max'].map((k) => `<label>${k}</label><input type="number" step="any" data-setting="gameLayout.${k}" value="${s.gameLayout[k]}">`).join('')}</div>
    <div class="hint">Read from <code>balance.ui.uiScale</code> when the server runs; the badge on every device uses the same rule as <code>src/main.js</code>. Change these only to ask "what if".</div>
    <div class="row"><label>Armoury phone at or below</label><input type="number" data-setting="screens.armouryBreakpointPx" value="${s.screens.armouryBreakpointPx}"> px <span class="hint">(<code>content/source/armouryUi.json</code> layout.responsive.breakpoint, read by the server)</span></div>
    <h3>Wireframe catalog</h3>
    <table class="grid"><thead><tr><th>label</th><th>file</th><th>draw</th><th>?shot</th><th></th></tr></thead><tbody>${s.wireframes.map(wfr).join('')}</tbody></table>
    <div class="row"><button data-act="add-wf">+ Add wireframe</button><button data-act="reset-wf">Reset catalog</button></div>
    <h3>Studio settings file</h3>
    <div class="row"><button data-act="export-settings">Download settings JSON</button><button data-act="import-settings">Import settings JSON…</button><button data-act="reset-settings" class="danger">Reset everything</button></div>
    <div class="hint">${state.api ? 'Saved to <code>ui-studio/workspace/settings.json</code> as you change them.' : 'Saved in this browser as you change them.'}</div>`;
}

function filesHtml() {
  const dirty = dirtyFiles();
  const v = state.validation;
  let html = `<h3>Config changes (${dirty.length})</h3>`;
  html += dirty.length ? `<ul class="list">${dirty.map(([rel, f]) => `<li data-diff="${esc(rel)}"><span class="grow mono">${esc(rel)}</span><span class="dim">${diffLines(f.text, proposedText(f))} lines · view diff</span><button class="small" data-revert="${esc(rel)}">revert</button></li>`).join('')}</ul>` : '<p class="hint">Nothing changed. Edits appear here with a diff before they are written.</p>';
  html += `<div class="row"><button data-act="validate" ${dirty.length && state.api ? '' : 'disabled'}>Validate with the game compiler</button><button data-act="save-config" class="primary" ${dirty.length && state.api ? '' : 'disabled'}>Save to checkout</button></div>`;
  if (v) html += v.errors.length ? `<div class="problems">${esc(v.errors.join('\n'))}</div>` : `<div class="ok">✓ ${v.files} files compile clean.</div>`;
  html += `<div class="row"><label><input type="checkbox" data-setting="save.compileAfterSave" ${state.settings.save.compileAfterSave ? 'checked' : ''}> run <code>tools/config-build.mjs</code> after saving (so Live game sees it)</label></div>`;
  if (state.compile) html += `<div class="hint">Compiler: <strong class="${state.compile.status === 'failed' ? 'problems' : 'ok'}">${esc(state.compile.status)}</strong> <button class="small" data-act="compile">Run again</button></div><pre class="output">${esc(state.compile.output || '')}</pre>`;
  else html += `<div class="row"><button class="small" data-act="compile" ${state.api ? '' : 'disabled'}>Compile now</button></div>`;
  html += `<h3>Without the server</h3><div class="row"><button data-act="download-config" ${dirty.length ? '' : 'disabled'}>Download changed JSON</button><button data-act="download-all">Download all loaded JSON</button><button data-act="open-json">Open JSON…</button></div>
    <div class="hint">Downloads are the exact files to drop into <code>content/config/</code>; then run <code>node tools/config-build.mjs</code>. Opening a JSON file replaces the loaded copy of the file it names (by its <code>ui/…</code> path in the file name) or, for a sketch, the current sketch.</div>`;
  html += `<h3>Sketch</h3><div class="row"><input id="sketch-name" placeholder="file name (a-z, 0-9, dashes)" value="${esc(state.sketchName)}" class="grow"><button data-act="save-sketch" ${state.api ? '' : 'disabled'}>Save sketch</button><button data-act="download-sketch">Download</button></div>
    <div class="hint">${state.api ? 'Saved to <code>ui-studio/workspace/sketches/&lt;name&gt;.json</code>.' : 'Downloads the sketch JSON.'}</div>`;
  html += `<h3>Backups</h3><div class="row"><button class="small" data-act="load-backups" ${state.api ? '' : 'disabled'}>List</button></div>`;
  if (state.backups.length) html += `<ul class="list">${state.backups.map((b) => `<li data-backup="${esc(b.id)}"><span class="grow">${esc(new Date(Number(b.id.split('-')[0])).toLocaleString())}</span><span class="dim">${b.files.length} file(s) · stage restore</span></li>`).join('')}</ul>`;
  html += '<div class="hint">A backup is staged as an edit for review; nothing is written until you save.</div>';
  return html;
}
function diffLines(a, b) { const x = a.split('\n'), y = b.split('\n'); let n = 0; for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) n++; return n; }
function diffHtml(a, b) {
  const x = a.split('\n'), y = b.split('\n');
  const out = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) out.push(`  ${esc(x[i] ?? '')}`);
    else { if (x[i] !== undefined) out.push(`<span class="del">- ${esc(x[i])}</span>`); if (y[i] !== undefined) out.push(`<span class="add">+ ${esc(y[i])}</span>`); }
  }
  return `<div class="diff">${out.join('\n')}</div>`;
}

// ---------------------------------------------------------------------------
// Chrome events
// ---------------------------------------------------------------------------
function bindChrome() {
  $('#modes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.mode = b.dataset.mode; state.selection.clear(); if (state.tab === 'values' && state.mode === 'sketch') state.tab = 'selection'; persistView(); renderAll(); });
  $('#wireframe').addEventListener('change', (e) => { state.wireframeId = e.target.value; state.selection.clear(); state.validation = null; persistView(); renderAll(); });
  $('#device').addEventListener('change', (e) => { state.deviceId = e.target.value; persistView(); renderAll(); });
  $('#orientation').addEventListener('click', () => { const cur = orientationFor(device()); state.orientation = cur === 'landscape' ? 'portrait' : 'landscape'; persistView(); renderAll(); });
  $('#orientation').addEventListener('dblclick', () => { state.orientation = 'auto'; persistView(); renderAll(); });
  $('#zoom').addEventListener('change', (e) => { state.zoom = e.target.value === 'fit' ? 'fit' : Number(e.target.value); persistView(); renderStage(); });
  for (const k of ['w', 'h']) $(`#free-${k}`).addEventListener('change', (e) => { state.freeSize[k === 'w' ? 'width' : 'height'] = M.clamp(Number(e.target.value) || 200, 200, 8192); persistView(); renderAll(); });
  $('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
  $('#save').addEventListener('click', () => { state.tab = 'files'; renderRight(); if (state.api && dirtyFiles().length) saveConfig(); });
  $('#right-tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; state.tab = b.dataset.tab; renderRight(); });
  $('#open-json').addEventListener('change', openJsonFiles);
  $('#left').addEventListener('click', onLeftClick);
  $('#left').addEventListener('change', onLeftChange);
  $('#right-body').addEventListener('change', onRightChange);
  $('#right-body').addEventListener('input', (e) => { if (e.target.matches('input[type="range"][data-band]')) onBandInput(e.target); if (e.target.id === 'search') { state.search = e.target.value; const pos = e.target.selectionStart; renderRight(); const s = $('#search'); s.focus(); s.setSelectionRange(pos, pos); } });
  $('#right-body').addEventListener('click', onRightClick);
  $('#stage-head').addEventListener('change', (e) => { const k = e.target.dataset.grid; if (!k) return; state.settings.grid[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value); persistSettings(); renderAll(); });
  $('#stage-head').addEventListener('click', (e) => { if (e.target.dataset.act === 'reload-game') { state.reloadGame = true; renderStage(); } });
  $('#stage-body').addEventListener('click', (e) => { const fig = e.target.closest('figure[data-device]'); if (fig) { state.deviceId = fig.dataset.device; state.orientation = fig.dataset.orientation; state.mode = state.sketch.present.boxes.length && !activeFile() ? 'sketch' : 'config'; persistView(); renderAll(); } });
  $('#stage-body').addEventListener('pointerdown', onPointerDown);
  $('#stage-body').addEventListener('dblclick', (e) => { const hit = e.target.dataset.hit || ''; if (hit.startsWith('box:')) { state.tab = 'selection'; renderRight(); const i = $('#right-body input[data-box-field="label"]'); if (i) { i.focus(); i.select(); } } });
  document.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', persistDrafts);
}

function onLeftClick(e) {
  const li = e.target.closest('li'); const b = e.target.closest('button');
  if (li && li.dataset.wireframe) { state.wireframeId = li.dataset.wireframe; state.selection.clear(); persistView(); renderAll(); return; }
  if (li && li.dataset.file) {
    const rel = li.dataset.file;
    let w = state.settings.wireframes.find((x) => x.file === rel);
    if (!w) { w = { id: `file-${rel.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, label: rel.replace(/^ui\//, ''), file: rel, draw: 'generic', shot: 'combat' }; state.settings.wireframes.push(w); persistSettings(); }
    state.wireframeId = w.id; state.selection.clear(); state.tab = 'values'; persistView(); renderAll(); return;
  }
  if (li && li.dataset.box) {
    const id = li.dataset.box;
    if (e.shiftKey) { if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id); } else state.selection = new Set([id]);
    state.tab = 'selection'; renderAll(); return;
  }
  if (li && li.dataset.sketch) { openSketch(li.dataset.sketch); return; }
  if (!b) return;
  if (b.dataset.tool) { state.tool = b.dataset.tool; renderAll(); }
  const act = b.dataset.act;
  if (act === 'add-box') { const s = M.clone(state.sketch.present); const box = M.newBox({ label: `Box ${s.boxes.length + 1}`, x: 35, y: 40, w: 30, h: 20 }); if (s.unit === 'px') { const vp = viewport(); Object.assign(box, M.pxToBox({ x: vp.width * 0.35, y: vp.height * 0.4, w: vp.width * 0.3, h: vp.height * 0.2 }, 'px', vp)); } s.boxes.push(box); state.selection = new Set([box.id]); commitSketch(s); }
  if (act === 'dup') duplicateSelection();
  if (act === 'del') deleteSelection();
  if (act === 'adopt-breakpoints') { const s = M.clone(state.sketch.present); s.breakpoints = M.clone(state.settings.breakpoints); const ids = new Set(s.breakpoints.map((b) => b.id)); for (const b of s.boxes) for (const k of Object.keys(b.overrides || {})) if (!ids.has(k)) delete b.overrides[k]; commitSketch(s); }
  if (act === 'new-sketch') { if (sketchDirty() && !confirm('Discard the current sketch?')) return; state.sketch = new M.History(M.newSketch({ breakpoints: state.settings.breakpoints })); state.sketchName = ''; state.sketchHash = null; state.sketchSaved = M.clone(state.sketch.present); state.selection.clear(); persistDrafts(); renderAll(); }
  if (act === 'open-json') $('#open-json').click();
}
function onLeftChange(e) {
  const t = e.target;
  if (t.id === 'sketch-title') { const s = M.clone(state.sketch.present); s.name = t.value; commitSketch(s); }
  if (t.id === 'sketch-unit') {
    const s = M.clone(state.sketch.present), vp = viewport(), from = s.unit, to = t.value;
    for (const b of s.boxes) { Object.assign(b, M.pxToBox(M.boxToPx(b, from, vp), to, vp)); for (const k of Object.keys(b.overrides || {})) { const o = b.overrides[k]; const full = M.pxToBox(M.boxToPx({ x: o.x ?? b.x, y: o.y ?? b.y, w: o.w ?? b.w, h: o.h ?? b.h }, from, vp), to, vp); for (const g of ['x', 'y', 'w', 'h']) if (o[g] != null) o[g] = full[g]; } }
    s.unit = to; commitSketch(s);
  }
  if (t.id === 'sketch-scope') { state.scope = t.value; persistView(); renderAll(); }
}

function onBandInput(input) {
  const f = activeFile(); if (!f) return;
  // The first movement of a slider remembers the state before it, so the
  // change event can record one undo step from there (a live slider must not
  // push a step per pixel, and a push of an equal state records nothing).
  if (!state.bandEditStart) state.bandEditStart = { rel: activeRel(), data: f.history.present };
  const path = input.dataset.bandsPath; const bands = M.getPath(f.history.present, path);
  const next = M.setBand(bands, input.dataset.band, Number(input.value));
  f.history.replace(M.setPath(f.history.present, path, next));
  renderStage();
  $$(`#right-body [data-band]`).forEach((el) => { if (el !== input) el.value = next[el.dataset.band]; });
}
function onRightChange(e) {
  const t = e.target;
  if (t.dataset.setting) {
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value;
    state.settings = M.setPath(state.settings, t.dataset.setting, v);
    persistSettings().then(() => renderAll());
    return;
  }
  if (t.dataset.band) {
    onBandInput(t);
    const f = activeFile(); const now = f.history.present; const start = state.bandEditStart; state.bandEditStart = null;
    if (start && start.rel === activeRel()) f.history.replace(start.data);
    commitFile(activeRel(), now); return;
  }
  if (t.dataset.path) { setLeaf(t); return; }
  if (t.dataset.box && t.dataset.boxGeom) {
    const s = state.sketch.present; const sc = sketchScope(); const vp = viewport();
    const box = s.boxes.find((b) => b.id === t.dataset.box); if (!box) return;
    const shown = M.resolveBox(box, sc.breakpointId);
    const next = M.boxToPx({ ...shown, [t.dataset.boxGeom]: Number(t.value) }, s.unit, vp);
    commitSketch(M.applyResolvedRect(s, box.id, next, vp, sc)); return;
  }
  if (t.dataset.box && t.dataset.boxField) {
    const s = M.clone(state.sketch.present); const b = s.boxes.find((x) => x.id === t.dataset.box); if (!b) return;
    const k = t.dataset.boxField; const sc = sketchScope();
    if (k === 'hidden' && sc.scope === 'breakpoint') { b.overrides ||= {}; b.overrides[sc.breakpointId] = { ...(b.overrides[sc.breakpointId] || {}), hidden: t.checked }; }
    else b[k] = t.type === 'checkbox' ? t.checked : t.value;
    commitSketch(s); return;
  }
  const row = t.closest('tr');
  if (row && t.dataset.dev) {
    const d = state.settings.devices[Number(row.dataset.deviceRow)]; const k = t.dataset.dev;
    if (k === 'enabled') d.enabled = t.checked; else if (k === 'safeTop' || k === 'safeBottom') { d.safe = d.safe || {}; d.safe[k === 'safeTop' ? 'top' : 'bottom'] = Number(t.value) || 0; } else d[k] = t.type === 'number' ? Number(t.value) : t.value;
    persistSettings().then((ok) => { if (ok) renderAll(); }); return;
  }
  if (row && t.dataset.bp) {
    const b = state.settings.breakpoints[Number(row.dataset.bpRow)]; const k = t.dataset.bp;
    if (t.type === 'number') { if (t.value === '') delete b[k]; else b[k] = Number(t.value); } else b[k] = t.value.trim();
    persistSettings().then((ok) => { if (ok) renderAll(); }); return;
  }
  if (row && t.dataset.wf) {
    const w = state.settings.wireframes[Number(row.dataset.wfRow)]; w[t.dataset.wf] = t.value.trim();
    persistSettings().then((ok) => { if (ok) renderAll(); });
  }
}
function setLeaf(input) {
  const f = activeFile(); if (!f) return;
  const path = input.dataset.path, kind = input.dataset.kind;
  let value;
  try {
    if (kind === 'number') { value = Number(input.value); if (!Number.isFinite(value)) throw Error('not a number'); }
    else if (kind === 'boolean') value = input.checked;
    else if (kind === 'ref') value = input.value;
    else if (kind === 'list') value = input.value.trim() ? JSON.parse(`[${input.value}]`) : [];
    else if (kind === 'json') value = JSON.parse(input.value);
    else value = input.value;
  } catch (e) { toast(`${path}: ${e.message}`, true); return; }
  setValue(activeRel(), path, value);
}
function onRightClick(e) {
  const b = e.target.closest('button'); const li = e.target.closest('li');
  if (li && li.dataset.diff && !b) { const f = fileOf(li.dataset.diff); dialog(`<h3 class="mono">${esc(li.dataset.diff)}</h3>${diffHtml(f.text, proposedText(f))}`); return; }
  if (li && li.dataset.backup && !b) { stageBackup(li.dataset.backup); return; }
  if (!b) return;
  if (b.dataset.revert) { const f = fileOf(b.dataset.revert); f.history.push(JSON.parse(f.text)); persistDrafts(); renderAll(); return; }
  if (b.dataset.unref) { const f = activeFile(); const v = M.getPath(f.history.present, b.dataset.unref); const name = v.slice(1); const value = varsFor(f).find((x) => x.name === name); if (value) setValue(activeRel(), b.dataset.unref, value.value); return; }
  if (b.dataset.align) { commitSketch(M.alignBoxes(state.sketch.present, [...state.selection], b.dataset.align, viewport(), sketchScope())); return; }
  if (b.dataset.order) { let s = state.sketch.present; for (const id of state.selection) s = M.reorderBox(s, id, Number(b.dataset.order)); commitSketch(s); return; }
  if (b.dataset.clearOverride) { const sc = sketchScope(); commitSketch(M.clearOverride(state.sketch.present, b.dataset.clearOverride, sc.breakpointId)); return; }
  const row = b.closest('tr');
  if (b.dataset.devAct && row) {
    const i = Number(row.dataset.deviceRow);
    if (b.dataset.devAct === 'del') { if (state.settings.devices.length <= 1) return; state.settings.devices.splice(i, 1); }
    else { const d = M.clone(state.settings.devices[i]); d.id = `${d.id}-${Date.now().toString(36)}`; d.label = `${d.label} copy`; state.settings.devices.splice(i + 1, 0, d); }
    persistSettings().then(() => renderAll()); return;
  }
  if (b.dataset.bpAct === 'del' && row) { state.settings.breakpoints.splice(Number(row.dataset.bpRow), 1); persistSettings().then(() => renderAll()); return; }
  if (b.dataset.wfAct === 'del' && row) {
    if (state.settings.wireframes.length <= 1) { toast('Keep at least one wireframe', true); return; }
    state.settings.wireframes.splice(Number(row.dataset.wfRow), 1);
    if (!state.settings.wireframes.some((w) => w.id === state.wireframeId)) state.wireframeId = state.settings.wireframes[0].id;
    persistSettings().then(() => renderAll()); return;
  }
  const act = b.dataset.act;
  if (act === 'add-device') { state.settings.devices.push({ id: `device-${Date.now().toString(36)}`, label: 'New device', width: 800, height: 600, category: 'other', enabled: true }); persistSettings().then(() => renderAll()); }
  if (act === 'reset-devices') { state.settings.devices = M.clone(M.DEFAULT_DEVICES); persistSettings().then(() => renderAll()); }
  if (act === 'add-bp') { state.settings.breakpoints.push({ id: `bp${state.settings.breakpoints.length + 1}`, label: 'New breakpoint' }); persistSettings().then(() => renderAll()); }
  if (act === 'add-wf') { state.settings.wireframes.push({ id: `wf-${Date.now().toString(36)}`, label: 'New wireframe', file: 'ui/scenes/w4.json', draw: 'generic', shot: 'combat' }); persistSettings().then(() => renderAll()); }
  if (act === 'reset-wf') { state.settings.wireframes = M.clone(M.DEFAULT_WIREFRAMES); persistSettings().then(() => renderAll()); }
  if (act === 'reset-settings') { if (!confirm('Reset every studio setting to its default?')) return; state.settings = M.clone(M.DEFAULT_SETTINGS); persistSettings().then(() => renderAll()); }
  if (act === 'export-settings') download('ui-studio-settings.json', `${JSON.stringify(state.settings, null, 2)}\n`);
  if (act === 'import-settings') { state.pendingImport = 'settings'; $('#open-json').click(); }
  if (act === 'raw-on') { state.raw = true; renderRight(); }
  if (act === 'raw-off') { state.raw = false; renderRight(); }
  if (act === 'raw-apply') { try { const data = JSON.parse($('#raw-json').value); state.raw = false; commitFile(activeRel(), data); } catch (err) { $('#raw-problems').textContent = err.message; } }
  if (act === 'add-value') addValuePrompt();
  if (act === 'validate') validateConfig();
  if (act === 'save-config') saveConfig();
  if (act === 'compile') compile();
  if (act === 'download-config') for (const [rel, f] of dirtyFiles()) download(rel.replace(/\//g, '__'), proposedText(f));
  if (act === 'download-all') for (const [rel, f] of state.files) download(rel.replace(/\//g, '__'), proposedText(f));
  if (act === 'open-json') $('#open-json').click();
  if (act === 'save-sketch') saveSketch();
  if (act === 'download-sketch') download(`${state.sketchName || 'wireframe'}.sketch.json`, `${JSON.stringify(state.sketch.present, null, 2)}\n`);
  if (act === 'load-backups') api('backups').then((b) => { state.backups = b; renderRight(); }).catch((err) => toast(err.message, true));
}
function addValuePrompt() {
  const path = prompt('New value path (section.group.key), e.g. sizing.hand.minimumHeightPx');
  if (!path) return;
  const [section] = path.split('.');
  if (!['sizing', 'positioning', 'layering', 'motion', 'components', 'behavior', 'vars'].includes(section)) { toast(`"${section}" is not a config section`, true); return; }
  const raw = prompt('Value as JSON (a number, true/false, "text", "$var", or {"numerator":1,"denominator":3})', '0');
  if (raw == null) return;
  try { setValue(activeRel(), path, JSON.parse(raw)); } catch (e) { toast(e.message, true); }
}

// ---------------------------------------------------------------------------
// Pointer state machine on the canvas
// ---------------------------------------------------------------------------
function onPointerDown(e) {
  const svg = e.target.closest('svg.canvas'); if (!svg || e.button !== 0) return;
  const hit = (e.target.dataset.hit || 'bg').split(':');
  const at = pointerToDevice(svg, e);
  const vp = viewport();
  // Renders during a drag replace the SVG, so the listeners live on the window
  // and every coordinate is read against whichever canvas is on the stage now.
  const live = () => $('#stage-body svg.canvas') || svg;
  const point = (ev) => pointerToDevice(live(), ev);
  e.preventDefault();
  const finish = (fn) => { const up = (ev) => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); fn(ev); }; window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); };
  let move = () => {};
  if (state.mode === 'config') {
    const regs = regions();
    if (hit[0] === 'region') { state.selection = new Set([hit[1]]); state.tab = 'selection'; renderAll(); return; }
    const region = hit[0] === 'bandEdge' ? regs.find((r) => r.id === hit[2]) : hit[0] === 'edge' ? regs.find((r) => r.id === hit[1]) : null;
    if (!region) { state.selection.clear(); renderAll(); return; }
    const f = activeFile(); const start = f.history.present; const axis = hit[0] === 'edge' ? hit[2] : 'h';
    const editFor = axis === 'h' && region.edit.pathH ? { ...region.edit, path: region.edit.pathH, unit: region.edit.unitH, axis: 'h' } : region.edit;
    state.selection = new Set([region.id]); state.tab = 'selection';
    move = (ev) => { const p = point(ev); const delta = axis === 'w' ? p.x - at.x : p.y - at.y; f.history.replace(M.applyRegionDrag(start, { ...region, edit: editFor }, delta, vp, { grid: state.settings.grid, regions: regs })); renderStage(); renderRight(); };
    window.addEventListener('pointermove', move);
    finish(() => { const now = f.history.present; f.history.replace(start); f.history.push(now); persistDrafts(); renderAll(); });
    return;
  }
  if (state.mode !== 'sketch') return;
  const s = state.sketch.present; const sc = sketchScope(); const unit = s.unit;
  if (state.tool === 'pan') {
    const host = $('#stage-body'); const sx = host.scrollLeft, sy = host.scrollTop;
    move = (ev) => { host.scrollLeft = sx - (ev.clientX - e.clientX); host.scrollTop = sy - (ev.clientY - e.clientY); };
    window.addEventListener('pointermove', move); finish(() => {}); return;
  }
  if (state.tool === 'box') {
    const box = M.newBox({ label: `Box ${s.boxes.length + 1}` });
    let rect = { x: at.x, y: at.y, w: 1, h: 1 };
    move = (ev) => { const p = point(ev); const snapped = M.snapRect({ x: Math.min(at.x, p.x), y: Math.min(at.y, p.y), w: Math.abs(p.x - at.x), h: Math.abs(p.y - at.y) }, { grid: state.settings.grid, ...guideSets(vp, [], s), mode: 'se' }); rect = snapped.rect; state.guides = snapped.guides; const draft = M.clone(s); draft.boxes.push({ ...box, ...M.pxToBox(rect, unit, vp) }); state.sketch.replace(draft); state.selection = new Set([box.id]); renderStage(); };
    window.addEventListener('pointermove', move);
    finish(() => { state.guides = []; state.sketch.replace(s); if (rect.w > 4 && rect.h > 4) { const next = M.clone(s); next.boxes.push({ ...box, ...M.pxToBox(rect, unit, vp) }); state.selection = new Set([box.id]); state.tool = 'select'; commitSketch(next); } else renderAll(); });
    return;
  }
  // select tool
  if (hit[0] === 'grip' || hit[0] === 'box') {
    const id = hit[1];
    if (hit[0] === 'box') { if (e.shiftKey) { if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id); } else if (!state.selection.has(id)) state.selection = new Set([id]); }
    const moving = s.boxes.filter((b) => state.selection.has(b.id) && !b.locked);
    if (!moving.length) { renderAll(); return; }
    const starts = new Map(moving.map((b) => [b.id, M.boxToPx(M.resolveBox(b, sc.breakpointId), unit, vp)]));
    const mode = hit[0] === 'grip' ? hit[2] : 'move';
    const primary = hit[0] === 'grip' ? moving.find((b) => b.id === id) : moving[0];
    let moved = false;
    move = (ev) => {
      const p = point(ev); const dx = p.x - at.x, dy = p.y - at.y; if (!moved && Math.hypot(dx, dy) < 2) return; moved = true;
      const others = s.boxes.filter((b) => !state.selection.has(b.id) && !b.hidden).map((b) => M.boxToPx(M.resolveBox(b, sc.breakpointId), unit, vp));
      const r0 = starts.get(primary.id);
      const proposed = mode === 'move' ? { ...r0, x: r0.x + dx, y: r0.y + dy } : resized(r0, mode, dx, dy);
      const snapped = ev.altKey ? { rect: proposed, guides: [] } : M.snapRect(proposed, { grid: state.settings.grid, ...guideSets(vp, others, s), mode });
      state.guides = snapped.guides;
      let draft = s;
      const sdx = snapped.rect.x - r0.x, sdy = snapped.rect.y - r0.y;
      for (const b of moving) { const r = starts.get(b.id); const next = mode === 'move' ? { ...r, x: r.x + sdx, y: r.y + sdy } : b.id === primary.id ? snapped.rect : r; draft = M.applyResolvedRect(draft, b.id, next, vp, sc); }
      state.sketch.replace(draft); renderStage();
    };
    window.addEventListener('pointermove', move);
    finish(() => { state.guides = []; const now = state.sketch.present; state.sketch.replace(s); if (moved) commitSketch(now); else renderAll(); });
    return;
  }
  // marquee on the background
  if (!e.shiftKey) state.selection.clear();
  const before = new Set(state.selection);
  move = (ev) => { const p = point(ev); state.marquee = { x0: at.x, y0: at.y, x1: p.x, y1: p.y }; const mx = Math.min(at.x, p.x), my = Math.min(at.y, p.y), mw = Math.abs(p.x - at.x), mh = Math.abs(p.y - at.y); state.selection = new Set(before); for (const b of sketchBoxesPx(vp)) if (!b.hidden && b.x < mx + mw && b.x + b.w > mx && b.y < my + mh && b.y + b.h > my) state.selection.add(b.id); renderStage(); };
  window.addEventListener('pointermove', move);
  finish(() => { state.marquee = null; renderAll(); });
}
function resized(r, mode, dx, dy) {
  let { x, y, w, h } = r;
  if (mode.includes('e')) w += dx; if (mode.includes('s')) h += dy;
  if (mode.includes('w')) { x += dx; w -= dx; } if (mode.includes('n')) { y += dy; h -= dy; }
  return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
}
function guideSets(vp, others, s) {
  const g = state.settings.grid; const x = [], y = [];
  if (g.snapToEdges) { const v = M.viewportGuides(vp, { safeArea: g.snapToSafeArea }); x.push(...v.x); y.push(...v.y); }
  if (g.snapToBoxes) { const b = M.boxGuides(others); x.push(...b.x); y.push(...b.y); }
  void s;
  return { guidesX: x, guidesY: y };
}

function onKey(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (state.mode === 'sketch' && state.api) saveSketch(); else if (state.api && dirtyFiles().length) saveConfig(); else { state.tab = 'files'; renderRight(); } return; }
  if (typing) return;
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelection(); return; }
  if (e.key === 'Escape') { state.selection.clear(); state.tool = 'select'; renderAll(); return; }
  if (state.mode === 'sketch') {
    const step = e.shiftKey ? state.settings.grid.nudgeLargePx : state.settings.grid.nudgePx;
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-step, 0); } if (e.key === 'ArrowRight') { e.preventDefault(); nudge(step, 0); }
    if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -step); } if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, step); }
    if (e.key === 'v' || e.key === 'V') { state.tool = 'select'; renderAll(); } if (e.key === 'b' || e.key === 'B') { state.tool = 'box'; renderAll(); } if (e.key === 'h' || e.key === 'H') { state.tool = 'pan'; renderAll(); }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); state.selection = new Set(state.sketch.present.boxes.map((b) => b.id)); renderAll(); }
  }
  if (e.key === 'g' || e.key === 'G') { state.settings.grid.show = !state.settings.grid.show; persistSettings(); renderStage(); }
  if (e.key === 's' || e.key === 'S') { state.settings.grid.snap = !state.settings.grid.snap; persistSettings(); renderStage(); toast(`Snap ${state.settings.grid.snap ? 'on' : 'off'}`); }
}

// ---------------------------------------------------------------------------
// Files: validate, save, compile, sketches, downloads, uploads
// ---------------------------------------------------------------------------
const changes = () => dirtyFiles().map(([rel, f]) => ({ rel, text: proposedText(f), hash: f.hash }));
async function validateConfig() {
  try { state.validation = await api('validate', { changes: changes() }); toast(state.validation.errors.length ? `${state.validation.errors.length} problem(s)` : 'Compiles clean'); }
  catch (e) { toast(e.message, true); }
  renderRight();
}
async function saveConfig() {
  const list = changes(); if (!list.length) return;
  try {
    const result = await api('save', { changes: list });
    for (const saved of result.files) { const f = fileOf(saved.rel); f.text = proposedText(f); f.hash = saved.hash; f.history = new M.History(f.history.present); }
    state.validation = null; persistDrafts();
    toast(`Saved ${result.files.length} file(s) (backup ${result.backup})`);
    if (state.settings.save.compileAfterSave) await compile();
  } catch (e) {
    const lines = e.message.split('\n');
    state.validation = { errors: lines.length > 1 ? lines.slice(1) : [e.message], files: 0 };
    toast(lines[0], true);
  }
  renderAll();
}
async function compile() {
  try {
    await api('compile', {});
    state.compile = { status: 'running', output: '' }; renderRight();
    for (let i = 0; i < 200; i++) { await new Promise((r) => setTimeout(r, 300)); state.compile = await api('compile'); if (state.compile.status !== 'running') break; }
    toast(`Compiler ${state.compile.status}`, state.compile.status === 'failed');
    if (state.mode === 'game') renderStage();
  } catch (e) { toast(e.message, true); }
  renderRight();
}
async function saveSketch() {
  const name = ($('#sketch-name') ? $('#sketch-name').value : state.sketchName).trim().toLowerCase() || prompt('Sketch file name (a-z, 0-9, dashes)') || '';
  if (!name) return;
  try { const r = await api('sketch', { name, sketch: state.sketch.present }); state.sketchName = r.name; state.sketchHash = r.hash; state.sketchSaved = M.clone(state.sketch.present); state.sketches = await api('sketches'); persistDrafts(); toast(`Sketch saved as ${r.name}.json`); renderAll(); }
  catch (e) { toast(e.message, true); }
}
async function openSketch(name) {
  if (sketchDirty() && !confirm('Discard the current sketch?')) return;
  try { const r = await api(`sketch?name=${encodeURIComponent(name)}`); loadSketch(r.sketch, r.name, r.hash); } catch (e) { toast(e.message, true); }
}
function loadSketch(sketch, name = '', hash = null) {
  const problems = M.sketchProblems(sketch);
  if (problems.length) { toast(problems[0], true); return; }
  state.sketch = new M.History(sketch); state.sketchName = name; state.sketchHash = hash; state.sketchSaved = M.clone(sketch); state.selection.clear(); state.mode = 'sketch'; persistDrafts(); persistView(); renderAll();
}
async function stageBackup(id) {
  try {
    const r = await api('backup', { id });
    for (const c of r.changes) { const f = fileOf(c.rel); if (f) f.history.push(JSON.parse(c.text)); }
    persistDrafts(); toast(`Staged ${r.changes.length} file(s) from the backup — review under Save`); renderAll();
  } catch (e) { toast(e.message, true); }
}
function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function openJsonFiles(e) {
  const files = [...e.target.files]; e.target.value = '';
  for (const file of files) {
    let data; const text = await file.text();
    try { data = JSON.parse(text); } catch (err) { toast(`${file.name}: ${err.message}`, true); continue; }
    if (state.pendingImport === 'settings') { state.pendingImport = null; const merged = M.mergeSettings(M.DEFAULT_SETTINGS, data); const p = M.settingsProblems(merged); if (p.length) { toast(p[0], true); continue; } state.settings = merged; await persistSettings(); renderAll(); continue; }
    if (data && data.schema === M.SKETCH_SCHEMA) { loadSketch(data, file.name.replace(/\.sketch\.json$|\.json$/, '')); continue; }
    const m = /^(ui__(?:tokens|(?:scenes|components|screens|presentation)__[\w-]+)\.json)$/.exec(file.name) || /(ui\/(?:tokens|(?:scenes|components|screens|presentation)\/[\w-]+)\.json)$/.exec(file.name);
    const rel = m ? m[1].replace(/__/g, '/') : null;
    if (rel) { if (fileOf(rel)) { fileOf(rel).history.push(data); } else loadFile({ rel, text, hash: null }); toast(`Loaded ${rel}`); const w = state.settings.wireframes.find((x) => x.file === rel); if (w) state.wireframeId = w.id; renderAll(); continue; }
    if (data && data.sizing || data && data.vars) { const rel = prompt(`Which config file is ${file.name}? (ui/scenes/w4a-combat.json, ui/tokens.json, …)`); if (rel && /^ui\//.test(rel)) { if (fileOf(rel)) fileOf(rel).history.push(data); else loadFile({ rel, text, hash: null }); renderAll(); } continue; }
    toast(`${file.name}: not a config file or a sketch`, true);
  }
  persistDrafts();
}

boot().catch((e) => { console.error(e); $('#status').textContent = `Failed to start: ${e.message}`; });
