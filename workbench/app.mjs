// workbench/app.mjs — the Workbench page: rail, tool frames, preview dock,
// library, engine export, jobs, settings, palette, toasts and shortcuts.
// Talks to workbench/server.mjs; DOM-free helpers live in ui/logic.mjs.
import { fuzzyFilter, DEVICES, fitDevice, clamp, duration, ago, manifestTables, manifestSummary, EXPORT_FORMAT } from './ui/logic.mjs';
import { icon } from './ui/icons.mjs';
import { MODULES } from './modules/index.mjs';
import { createModulePrefs, parseHash, hashFor, withPreviewOverrides } from './modules/host.mjs';
import { History } from './ui/kit/history.mjs';
import { shortcuts, comboFromEvent, comboLabel } from './ui/kit/shortcuts.mjs';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS_KEY = 'ashenspire.workbench.layout';
const store = {
  get() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* private window: layout is not remembered */ } },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const MODULE_VIEW = (id) => `mod:${id}`;
const VIEWS = [
  { id: 'home', label: 'Home', icon: 'home', group: null },
  ...MODULES.map((m) => ({ id: MODULE_VIEW(m.id), label: m.label, icon: m.icon, group: m.group, module: m.id })),
  { id: 'library', label: 'Library', icon: 'library', group: 'Project' },
  { id: 'export', label: 'Engine Export', icon: 'cube', group: 'Project' },
  { id: 'jobs', label: 'Build & Checks', icon: 'checks', group: 'Project' },
];
// The old tool studios: off the rail, reachable from the Library's Legacy group.
const LEGACY_VIEWS = [
  { id: 'editor', label: 'Content Editor', icon: 'table', tool: 'editor', group: null },
  { id: 'ui-studio', label: 'UI Studio', icon: 'layout', tool: 'ui-studio', group: null },
  { id: 'pose', label: 'Pose & FX', icon: 'figure', tool: 'pose', group: null },
];
const ALL_VIEWS = [...VIEWS, ...LEGACY_VIEWS];
const moduleOf = (view) => (typeof view === 'string' && view.startsWith('mod:') ? view.slice(4) : null);
const moduleDef = (id) => MODULES.find((m) => m.id === id);
const KINDS = [['all', 'All'], ['studio', 'Studios'], ['editor', 'Editors'], ['viewer', 'Viewers'], ['exporter', 'Exporters'], ['qa', 'QA']];
const saved = store.get();
const validView = (v) => v === 'settings' || VIEWS.some((x) => x.id === v);
const state = {
  session: null, tools: [], git: null, jobs: { defs: [], runs: [] }, library: null, settings: null, manifest: null, exportQ: '',
  view: validView(saved.view) ? saved.view : 'home',
  dockW: Number(saved.dockW) || 460, device: DEVICES.some((d) => d.id === saved.device) ? saved.device : 'fill',
  collapsed: Boolean(saved.collapsed), auto: saved.auto !== false,
  lib: { q: '', kind: 'all', live: saved.liveThumbs !== false, external: saved.showExternal !== false },
  dockEntry: null, pageEntry: null, toolFrames: new Map(), openRuns: new Set(), logs: new Map(),
  notes: [], unread: 0, connected: false,
};
const persist = () => store.set({ view: state.view, dockW: state.dockW, device: state.device, collapsed: state.collapsed, auto: state.auto, liveThumbs: state.lib.live, showExternal: state.lib.external });
const tool = (id) => state.tools.find((t) => t.id === id);
const gameBase = () => { const g = tool('game'); return g && g.status === 'up' ? g.url.replace(/\/?$/, '/') : null; };

// ---------------------------------------------------------------------------
// Server talk
// ---------------------------------------------------------------------------
async function api(path, body) {
  const res = await fetch(`/api/${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-studio-token': state.session?.token || '', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw Error(data.error || `HTTP ${res.status}`);
  return data;
}
const refreshGit = async () => { try { state.git = await api('git'); } catch { state.git = null; } renderChips(); if (state.view === 'home') renderHome(); };
const refreshJobs = async () => { try { state.jobs = await api('jobs'); } catch { /* keep the last list */ } renderChips(); renderRail(); if (state.view === 'jobs') renderJobs(); if (state.view === 'home') renderHome(); };
async function refreshLibrary() {
  try { state.library = await api('library'); } catch (e) { state.library = { error: e.message, entries: [], areas: [] }; }
  libraryBuilt = false;
  if (state.view === 'library') renderLibrary();
}

// ---------------------------------------------------------------------------
// Toasts and notifications
// ---------------------------------------------------------------------------
const KIND_ICON = { info: 'info', success: 'success', warn: 'warn', error: 'error' };
function toast({ kind = 'info', title, detail = '', actions = [], timeout, record = true }) {
  const persistent = kind === 'error' || timeout === 0;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(KIND_ICON[kind], `kind-icon kind-${kind}`)}<div class="t-body"><div class="t-title">${esc(title)}</div>${detail ? `<div class="t-detail">${esc(detail)}</div>` : ''}${actions.length ? `<div class="t-actions">${actions.map((a, i) => `<button class="btn btn-sm${i === 0 ? ' btn-primary' : ''}" type="button" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div><button class="icon-btn icon-btn-sm" type="button" aria-label="Dismiss">${icon('close')}</button>`;
  const dismiss = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 220); };
  el.querySelector('[aria-label="Dismiss"]').onclick = dismiss;
  $$('[data-i]', el).forEach((b) => { b.onclick = () => { actions[Number(b.dataset.i)].run(); dismiss(); }; });
  (kind === 'error' ? $('#toasts-alert') : $('#toasts')).append(el);
  const stack = $$('.toast', $('#toasts')); if (stack.length > 4) stack[0].remove();
  if (!persistent) {
    let left = timeout || 4500; let t0 = Date.now(); let timer = setTimeout(dismiss, left);
    el.onmouseenter = () => { clearTimeout(timer); left -= Date.now() - t0; };
    el.onmouseleave = () => { t0 = Date.now(); timer = setTimeout(dismiss, Math.max(1200, left)); };
  }
  if (record) {
    state.notes.unshift({ kind, title, detail, at: Date.now() }); state.notes.length = Math.min(state.notes.length, 150);
    if ($('#notes').hidden) state.unread += 1;
    renderNotes();
  }
  return dismiss;
}
function renderNotes() {
  const badge = $('#notes-badge');
  badge.hidden = !state.unread; badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
  $('#open-notes').setAttribute('aria-label', state.unread ? `Notifications (${state.unread} unread)` : 'Notifications');
  $('#notes-list').innerHTML = state.notes.length
    ? state.notes.map((n) => `<li class="note-item">${icon(KIND_ICON[n.kind], `kind-icon kind-${n.kind}`)}<div class="n-body"><div class="n-title">${esc(n.title)}</div>${n.detail ? `<div class="n-detail">${esc(n.detail)}</div>` : ''}</div><time datetime="${new Date(n.at).toISOString()}" title="${esc(new Date(n.at).toLocaleString())}">${esc(new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</time></li>`).join('')
    : `<li class="empty">${icon('bell')}<p>No notifications yet. Reloads, job results and errors collect here.</p></li>`;
}
function openNotes() { closeOverlays(); $('#notes').hidden = false; state.unread = 0; renderNotes(); $('#notes [data-close]').focus(); }

// ---------------------------------------------------------------------------
// Header chips
// ---------------------------------------------------------------------------
function renderChips() {
  const g = state.git;
  $('#chip-branch .chip-text').textContent = g ? (g.repo ? g.branch : 'Not a git checkout') : '…';
  $('#chip-branch').title = g && g.head ? `Branch ${g.branch} at ${g.head}` : 'Current branch';
  const dirty = $('#chip-dirty');
  dirty.classList.toggle('is-dirty', Boolean(g && g.dirty));
  dirty.classList.toggle('is-clean', Boolean(g && g.repo && !g.dirty));
  $('.chip-text', dirty).textContent = !g ? '…' : !g.repo ? 'no git' : g.dirty ? `${g.dirty} changed file${g.dirty === 1 ? '' : 's'}` : 'Clean';
  dirty.hidden = Boolean(g && !g.repo);
  const last = state.jobs.runs[0];
  const chip = $('#chip-job');
  $('.dot', chip).className = `dot ${last ? last.status : ''}`;
  $('.chip-text', chip).textContent = last ? `${last.label} · ${last.status === 'running' ? 'running…' : `${last.status} ${ago(last.endedAt || last.startedAt)}`}` : 'No jobs yet';
}

// ---------------------------------------------------------------------------
// Rail and views
// ---------------------------------------------------------------------------
function renderRail() {
  let group;
  const items = [];
  VIEWS.forEach((v, i) => {
    if (v.group !== group) { group = v.group; if (group) items.push(`<li class="rail-group" aria-hidden="true">${esc(group)}</li>`); }
    const t = v.tool && tool(v.tool);
    const running = v.id === 'jobs' && state.jobs.runs.some((r) => r.status === 'running');
    const dot = t ? `<span class="dot ${t.status}" title="${esc(t.status)}"></span>` : running ? '<span class="dot running" title="A job is running"></span>' : '';
    const label = t ? `${v.label}, ${t.status}` : v.label;
    const key = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
    items.push(`<li><button class="rail-item" type="button" data-view="${v.id}" aria-label="${esc(label)}"${state.view === v.id ? ' aria-current="page"' : ''}><span class="rail-icon">${icon(v.icon)}</span><span class="rail-label">${esc(v.label)}</span>${dot}<span class="rail-key" aria-hidden="true">${key}</span></button></li>`);
  });
  $('#rail-list').innerHTML = items.join('');
  $('#rail-settings').toggleAttribute('aria-current', state.view === 'settings');
  if (state.view === 'settings') $('#rail-settings').setAttribute('aria-current', 'page');
}

function show(view, { focus = false } = {}) {
  const next = moduleOf(view);
  if (activeModule && activeModule !== next) modules.get(activeModule)?.instance?.onHide?.();
  activeModule = next;
  state.view = view; persist();
  if (!next && location.hash.startsWith('#mod=')) history.replaceState(null, '', `${location.pathname}${location.search}`);  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  renderRail();
  const def = ALL_VIEWS.find((v) => v.id === view);
  document.title = `${def ? def.label : view === 'page' ? (state.pageEntry?.title || 'Page') : 'Settings'} · AshenSpire Workbench`;
  if (next) openModuleView(next);
  else if (def && def.tool) renderTool(def.tool, true);
  else if (view === 'home') renderHome();
  else if (view === 'library') { renderLibrary(); if (!state.library) refreshLibrary(); }
  else if (view === 'export') { renderExport(); loadManifest(); }
  else if (view === 'jobs') renderJobs();
  else if (view === 'settings') renderSettings();
  else if (view === 'page') renderPage();
  if (focus) $('#main').focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Native modules — one section each; mounted on first visit, kept alive after
// ---------------------------------------------------------------------------
const modules = new Map(); // id -> { def, section, body, history, params, instance, mounting, offs, ctx }
let activeModule = null;
let previewShow = null; // a module's preview.showUrl(); null shows the game or a Library page
const previewOverrides = {};
const prefsStore = () => { try { return localStorage; } catch { return null; } };

function modRecord(id) {
  if (modules.has(id)) return modules.get(id);
  const def = moduleDef(id);
  const section = document.createElement('section');
  section.className = 'view view-tool view-mod';
  section.dataset.view = MODULE_VIEW(id); section.id = `view-mod-${id}`;
  section.innerHTML = `<div class="toolbar"><h1>${esc(def.label)}</h1><span class="url" title="${esc(def.blurb)}">${esc(def.blurb)}</span><div class="actions"><button class="btn btn-sm btn-ghost" type="button" data-mod-undo>${icon('undo')}Undo</button><button class="btn btn-sm btn-ghost" type="button" data-mod-redo>${icon('redo')}Redo</button></div></div><div class="mod-body"></div>`;
  $('#main').append(section);
  const rec = { def, section, body: $('.mod-body', section), history: new History(), params: {}, instance: null, mounting: false, offs: [] };
  rec.history.onChange(() => historyButtons(rec));
  $('[data-mod-undo]', section).onclick = () => stepHistory(rec, 'undo');
  $('[data-mod-redo]', section).onclick = () => stepHistory(rec, 'redo');
  rec.ctx = moduleContext(rec);
  historyButtons(rec);
  modules.set(id, rec);
  return rec;
}

function moduleContext(rec) {
  const id = rec.def.id;
  return {
    id,
    api,
    toast,
    history: rec.history,
    shortcuts: { register: (combo, label, handler, opts) => { const off = shortcuts.register(id, combo, label, handler, opts); rec.offs.push(off); return off; } },
    preview: {
      reload: () => reloadPreview(),
      showUrl: (url) => { previewShow = url || null; if (previewShow) state.dockEntry = null; renderDock(); },
      setOverride: (key, value) => { if (value === undefined || value === null) delete previewOverrides[key]; else previewOverrides[key] = value; renderDock(); },
    },
    settings: createModulePrefs(id, prefsStore()),
    openModule: (mid, params) => openModuleById(mid, params),
    get params() { return rec.params; },
  };
}

function historyButtons(rec) {
  const undo = $('[data-mod-undo]', rec.section); const redo = $('[data-mod-redo]', rec.section);
  const items = rec.history.list(); const done = items.filter((e) => e.done); const undone = items.filter((e) => !e.done);
  undo.disabled = !rec.history.canUndo; redo.disabled = !rec.history.canRedo;
  undo.title = done.length ? `Undo ${done[done.length - 1].label}` : 'Nothing to undo';
  redo.title = undone.length ? `Redo ${undone[0].label}` : 'Nothing to redo';
}

/** Undo or redo in a module's own history; false when there is nothing to step (the key then goes to the page). */
function stepHistory(rec, dir) {
  const entry = dir === 'undo' ? rec.history.undo() : rec.history.redo();
  if (entry) toast({ title: `${dir === 'undo' ? 'Undid' : 'Redid'} ${entry.label}`, record: false, timeout: 1600 });
  return Boolean(entry);
}

function openModuleView(id) {
  const rec = modRecord(id);
  if (rec.instance) { rec.instance.onShow?.(); return; }
  mountModule(rec);
}

async function mountModule(rec) {
  if (rec.mounting) return;
  rec.mounting = true;
  try {
    const mod = await rec.def.load();
    const impl = mod && mod.default;
    if (!impl || typeof impl.mount !== 'function') throw Error('the module exports no mount()');
    rec.instance = impl.mount(rec.body, rec.ctx) || {};
    if (activeModule === rec.def.id) rec.instance.onShow?.();
  } catch (e) {
    rec.body.innerHTML = emptyState({ kind: 'is-error', iconName: 'error', title: `${rec.def.label} could not load`, body: esc(e.message) });
    toast({ kind: 'error', title: `${rec.def.label} could not load`, detail: e.message });
  } finally { rec.mounting = false; }
}

/** Opens a module with deep-link params (#mod=<id>&…); the hash is kept in step with the view. */
function openModuleById(id, params = {}) {
  if (!moduleDef(id)) { toast({ kind: 'warn', title: `No module called “${id}”`, record: false }); return; }
  modRecord(id).params = { ...params };
  show(MODULE_VIEW(id), { focus: true });
  history.replaceState(null, '', hashFor(id, params));
}

// ---------------------------------------------------------------------------
// Tool views — frames are created on first visit and kept alive
// ---------------------------------------------------------------------------
function emptyState({ kind = '', iconName = 'info', title, body = '', pre = '', actions = '' }) {
  return `<div class="empty fill-empty ${kind}"><div class="empty-icon">${icon(iconName)}</div><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}${pre ? `<pre>${esc(pre)}</pre>` : ''}${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
const restartBtn = (id, primary = true) => `<button class="btn${primary ? ' btn-primary' : ''}" type="button" data-restart="${id}">${icon('restart')}Restart</button>`;
const windowBtn = (url) => `<button class="btn" type="button" data-window="${esc(url)}">${icon('external')}Open in window</button>`;

function renderTool(id, visiting = false) {
  const section = $(`#view-${id}`);
  const t = tool(id); const def = ALL_VIEWS.find((v) => v.tool === id);
  if (!section.dataset.built) {
    section.dataset.built = '1';
    section.innerHTML = `<div class="toolbar"><span class="dot" data-dot></span><h1>${esc(def.label)}</h1><span class="url" data-url></span><div class="actions"><button class="btn btn-sm btn-ghost" type="button" data-reload-frame>${icon('reload')}Reload</button><button class="btn btn-sm btn-ghost" type="button" data-window-tool>${icon('external')}Open in window</button><button class="btn btn-sm btn-ghost" type="button" data-restart="${id}">${icon('restart')}Restart server</button></div></div><div class="frame-host" data-host></div>`;
    $('[data-reload-frame]', section).onclick = () => { const f = state.toolFrames.get(id); if (f) { f.src = f.src; toast({ title: `${def.label} reloaded`, record: false, timeout: 1800 }); } };
    $('[data-window-tool]', section).onclick = () => { const x = tool(id); if (x) window.open(x.url, '_blank', 'noopener'); };
  }
  $('[data-dot]', section).className = `dot ${t ? t.status : ''}`;
  $('[data-url]', section).textContent = t ? `${t.url} · ${t.message || t.status}` : '';
  const host = $('[data-host]', section);
  const frame = state.toolFrames.get(id);
  const live = t && t.status === 'up' && t.embeddable;
  if (live) {
    if (!frame && (visiting || state.view === def.id)) {
      host.innerHTML = '';
      const f = document.createElement('iframe');
      f.title = def.label; f.src = t.url; f.allow = 'clipboard-read; clipboard-write; fullscreen';
      host.append(f); state.toolFrames.set(id, f);
    } else if (frame && !host.contains(frame)) { host.innerHTML = ''; host.append(frame); }
    return;
  }
  if (frame) { frame.remove(); state.toolFrames.delete(id); }
  if (!t) { host.innerHTML = emptyState({ kind: 'is-wait', iconName: 'plug', title: 'Connecting to the Workbench…' }); return; }
  if (!state.session.children && t.status === 'down') {
    host.innerHTML = emptyState({ iconName: 'plug', title: `${def.label} is not started`, body: `The Workbench was started with <code>--no-children</code>. Start it yourself, or restart the Workbench without that flag.`, actions: windowBtn(t.url) });
  } else if (t.status === 'starting') {
    host.innerHTML = emptyState({ kind: 'is-wait', iconName: 'server', title: `Starting ${def.label}…`, body: `Waiting for <code>${esc(t.url)}</code> to answer.`, pre: t.log.slice(-6).join('\n') });
  } else if (t.status === 'up') {
    host.innerHTML = emptyState({ kind: 'is-error', iconName: 'warn', title: `${def.label} can't be shown here`, body: esc(t.message), actions: windowBtn(t.url) + restartBtn(id, false) });
  } else {
    host.innerHTML = emptyState({ kind: 'is-error', iconName: 'error', title: `${def.label} is not running`, body: esc(t.message || 'It stopped or never started.'), pre: t.log.slice(-8).join('\n'), actions: restartBtn(id) });
  }
}

async function restartTool(id) {
  const t = tool(id); const name = t ? t.name : id;
  toast({ title: `Restarting ${name}…`, record: false, timeout: 2000 });
  try { const next = await api(`tools/${id}/restart`, {}); updateTool(next); }
  catch (e) { toast({ kind: 'error', title: `Could not restart ${name}`, detail: e.message }); }
}

function updateTool(next) {
  const i = state.tools.findIndex((t) => t.id === next.id);
  if (i >= 0) state.tools[i] = next; else state.tools.push(next);
}

function onTools(list) {
  const before = new Map(state.tools.map((t) => [t.id, t.status]));
  state.tools = list;
  for (const t of list) {
    const was = before.get(t.id);
    if (was && was !== t.status) {
      if (t.status === 'down' && was === 'up') toast({ kind: 'error', title: `${t.name} stopped`, detail: t.message, actions: [{ label: 'Restart', run: () => restartTool(t.id) }] });
      if (t.status === 'up' && was !== 'up') toast({ kind: 'success', title: `${t.name} is running`, timeout: 2500 });
    }
  }
  renderRail();
  for (const v of LEGACY_VIEWS) renderTool(v.tool);
  renderDock();
  if (before.get('game') !== tool('game')?.status) { libraryBuilt = false; if (state.view === 'library') renderLibrary(); }
  if (state.view === 'home') renderHome();
  if (state.view === 'page') renderPage();
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
function statusText(t) { return t ? ({ up: 'Running', starting: 'Starting…', down: 'Stopped' }[t.status] || t.status) : '…'; }
function renderHome() {
  const s = state.session || {};
  const cards = [
    ...MODULES.map((m) => `<article class="card tool-card"><div class="tool-card-head"><span class="tool-card-icon">${icon(m.icon)}</span><h3>${esc(m.label)}</h3></div><p>${esc(m.blurb)}</p><div class="tool-card-foot"><span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" data-go="${MODULE_VIEW(m.id)}">Open</button></div></article>`),
    ...['game'].map((id) => {
      const t = tool(id); const v = ALL_VIEWS.find((x) => x.tool === id);
      const ic = { game: 'sparkle' }[id];
      const open = id === 'game' ? `<button class="btn btn-sm" type="button" data-window="${esc(t ? t.url : '')}"${t && t.status === 'up' ? '' : ' disabled'}>${icon('external')}Play in window</button>` : `<button class="btn btn-sm btn-primary" type="button" data-go="${v.id}">Open</button>`;
      return `<article class="card tool-card"><div class="tool-card-head"><span class="tool-card-icon">${icon(ic)}</span><h3>${esc(t ? t.name : (v ? v.label : id))}</h3></div><p>${esc(t ? t.blurb : '')}</p><div class="tool-card-foot"><span class="status"><span class="dot ${t ? t.status : ''}"></span><span class="status-text">${esc(statusText(t))}</span></span><span class="spacer"></span>${t && t.status === 'down' && s.children ? restartBtn(id, false).replace('class="btn"', 'class="btn btn-sm"') : ''}${open}</div></article>`;
    }),
    `<article class="card tool-card"><div class="tool-card-head"><span class="tool-card-icon">${icon('library')}</span><h3>Library</h3></div><p>Every editor, viewer, exporter and QA page in the project${state.library ? ` — ${state.library.entries.length} pages` : ''}, with live thumbnails.</p><div class="tool-card-foot"><span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" data-go="library">Browse</button></div></article>`,
    `<article class="card tool-card"><div class="tool-card-head"><span class="tool-card-icon">${icon('cube')}</span><h3>Engine Export</h3></div><p>Export the game data as JSON tables and schemas for Unity and Unreal.</p><div class="tool-card-foot"><span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" data-go="export">Open</button></div></article>`,
    `<article class="card tool-card"><div class="tool-card-head"><span class="tool-card-icon">${icon('checks')}</span><h3>Build &amp; Checks</h3></div><p>Content and config builds, the bundle, the engine export and the tool tests, with logs and history.</p><div class="tool-card-foot"><span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" data-go="jobs">Open</button></div></article>`,
  ];
  const runs = state.jobs.runs.slice(0, 5);
  const g = state.git;
  $('#view-home').innerHTML = `<div class="page">
    <div class="page-head"><div><h1 id="h-home">Workbench</h1><p>${esc(s.root || '')}${g && g.repo ? ` · <b>${esc(g.branch)}</b> @ ${esc(g.head)}` : ''}</p></div>
      <div class="actions"><button class="btn" type="button" data-palette>${icon('search')}Search everything <kbd>Ctrl K</kbd></button></div></div>
    <div class="grid grid-tools">${cards.join('')}</div>
    <div class="two-col section">
      <div><div class="section-head"><h2>Recent jobs</h2><span class="count">${state.jobs.runs.length ? `${state.jobs.runs.length} in history` : ''}</span><div class="actions"><button class="btn btn-sm btn-ghost" type="button" data-go="jobs">All jobs</button></div></div>
        <div class="card">${runs.length ? `<ul class="rows">${runs.map((r) => `<li class="row"><span class="dot ${r.status}"></span><div class="row-main"><div class="row-title">${esc(r.label)}</div><div class="row-sub">${esc(r.status)} · ${esc(ago(r.startedAt))}${r.durationMs != null ? ` · ${esc(duration(r.durationMs))}` : ''}</div></div><button class="btn btn-sm btn-ghost" type="button" data-run="${esc(r.id)}"${r.status === 'running' ? ' disabled' : jobOff(r.id)}>${icon('restart')}Run again</button></li>`).join('')}</ul>` : emptyState({ iconName: 'checks', title: 'No jobs run yet', body: 'Run a build or the tool tests from Build &amp; Checks, or use a quick action.' })}</div></div>
      <div><div class="section-head"><h2>Quick actions</h2></div>
        <div class="card" style="padding:16px"><div class="quick">
          <button class="btn" type="button" data-run="tool-tests">${icon('play')}Run tool tests</button>
          <button class="btn" type="button" data-run="content-build">${icon('play')}Content build</button>
          <button class="btn" type="button" data-run="config-build">${icon('play')}Config build</button>
          <button class="btn" type="button" data-run="engine-export"${jobOff('engine-export')}>${icon('cube')}Engine export</button>
          <button class="btn" type="button" data-action="reload-preview">${icon('reload')}Reload preview</button>
          <button class="btn" type="button" data-action="toggle-dock">${icon('dock')}${state.collapsed ? 'Show' : 'Hide'} preview</button>
          <button class="btn" type="button" data-action="help">${icon('keyboard')}Shortcuts</button>
          <button class="btn" type="button" data-go="settings">${icon('gear')}Settings</button>
        </div>
        <p class="faint" style="margin-top:12px">Live reload is ${state.auto ? '<b>on</b>' : '<b>off</b>'}: edits under content/, src/ and styles/ rebuild what they need and ${state.auto ? 'reload' : 'offer to reload'} the preview.</p></div></div>
    </div></div>`;
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------
let libraryBuilt = false; let thumbObserver = null;
function entryUrl(e) {
  if (e.servedBy === 'workbench-child') { const t = tool(e.toolId); return t && t.status === 'up' ? t.url : null; }
  if (e.external) return e.exists ? e.url : null;
  if (!e.exists) return null;
  const base = gameBase();
  return base ? base + e.path.split('/').map(encodeURIComponent).join('/') : null;
}
function entryProblem(e) {
  if (e.source === 'art-checkout') return e.configured ? { title: 'Not in the art checkout', body: `${e.path} was not found in the art checkout set in Settings (with or without its art/ prefix).`, settings: true } : { title: 'Art checkout not set', body: 'Point Settings at a cehinds/AshenSpire-art checkout to open these pages.', settings: true };
  if (e.source === 'editor-repo') return { title: 'Editor app not running', body: `Nothing answers at ${e.url || 'its URL'}. In the AshenedSpire-Editor checkout run <code>npm install</code> then <code>npm run dev</code>, or set its URL in Settings.`, settings: true, folder: Boolean(e.checkout) };
  if (e.servedBy === 'workbench-child') return { title: `${tool(e.toolId)?.name || 'The studio'} is not running`, body: 'Restart it from its page.', restart: e.toolId };
  if (!e.exists) return { title: 'File missing', body: `${e.path} is not in this project.` };
  return { title: 'Game server is not running', body: 'The Library pages are served by the game server.', restart: 'game' };
}
const kindLabel = { studio: 'Studio', editor: 'Editor', viewer: 'Viewer', exporter: 'Exporter', qa: 'QA' };

function libCard(e) {
  const url = entryUrl(e);
  const problem = url ? null : entryProblem(e);
  const thumbable = url && e.kind !== 'studio' && e.servedBy !== 'workbench-child' && e.source !== 'editor-repo';
  const tags = [`<span class="tag tag-kind">${esc(kindLabel[e.kind] || e.kind)}</span>`,
    ...(e.external ? ['<span class="tag tag-ext">External</span>'] : []),
    ...(e.unregistered ? ['<span class="tag tag-new" title="Add it to workbench/tools.json">Unregistered</span>'] : []),
    ...(e.status === 'legacy' ? ['<span class="tag tag-legacy">Legacy</span>'] : []),
    ...(e.outputs || []).map((o) => `<span class="tag tag-out" title="Output">${esc(o)}</span>`)];
  const ph = problem
    ? `<div class="thumb-ph"><div>${icon(e.external ? 'plug' : 'warn')}<span>${esc(problem.title)}</span>${problem.settings ? '<button class="btn btn-sm" type="button" data-go="settings">Set path in Settings</button>' : ''}${problem.restart && state.session.children ? `<button class="btn btn-sm" type="button" data-restart="${problem.restart}">Restart</button>` : ''}</div></div>`
    : `<div class="thumb-ph"><div>${icon(e.kind === 'studio' ? 'brush' : 'file')}<span>${e.kind === 'studio' ? 'Studio' : state.lib.live ? 'Loading preview…' : 'Live thumbnails off'}</span></div></div>`;
  const dis = url ? '' : ' disabled';
  return `<article class="card lib-card" data-entry="${esc(e.id)}" data-kind="${esc(e.kind)}" data-search="${esc(`${e.title} ${e.path} ${e.area} ${e.kind} ${(e.outputs || []).join(' ')} ${e.notes || ''}`.toLowerCase())}">
    <div class="thumb"${thumbable && state.lib.live ? ` data-thumb="${esc(url)}"` : ''}>${ph}${url ? `<button class="thumb-open" type="button" data-open="${esc(e.id)}" aria-label="Open ${esc(e.title)}"></button>` : ''}</div>
    <div class="lib-body"><div class="lib-title">${esc(e.title)}</div><div class="lib-path" title="${esc(e.path)}">${esc(e.source === 'editor-repo' ? `editor app · ${e.url || 'URL not set'}` : e.source ? `art checkout · ${e.path}` : e.path)}</div><div class="tags">${tags.join('')}</div>${e.notes ? `<div class="lib-notes">${esc(e.notes)}</div>` : ''}
    <div class="lib-actions"><button class="btn btn-sm" type="button" data-open="${esc(e.id)}"${dis} title="Open in the Workbench">${icon('open')}Open</button><button class="btn btn-sm" type="button" data-pane="${esc(e.id)}"${dis} title="Open in the preview pane">${icon('pane')}Pane</button><button class="btn btn-sm" type="button" data-newwin="${esc(e.id)}"${dis} title="Open in a new window">${icon('external')}Window</button></div></div></article>`;
}

function renderLibrary() {
  const section = $('#view-library');
  if (!state.library) { section.innerHTML = `<div class="page">${emptyState({ kind: 'is-wait', iconName: 'library', title: 'Loading the Library…' })}</div>`; return; }
  if (state.library.error) { section.innerHTML = `<div class="page">${emptyState({ kind: 'is-error', iconName: 'error', title: 'The Library could not be read', body: esc(state.library.error), actions: '<button class="btn btn-primary" type="button" data-action="refresh-library">Try again</button>' })}</div>`; return; }
  if (!libraryBuilt) {
    libraryBuilt = true;
    const entries = state.library.entries;
    const areas = [...state.library.areas, ...new Set(entries.map((e) => e.area).filter((a) => !state.library.areas.includes(a)))];
    const groups = areas.map((area) => {
      const list = entries.filter((e) => e.area === area);
      if (!list.length) return '';
      const current = list.filter((e) => e.status !== 'legacy'); const legacy = list.filter((e) => e.status === 'legacy');
      return `<details class="lib-area" data-area="${esc(area)}" open><summary>${icon('chevron', 'chev')}<h2>${esc(area)}</h2><span class="count faint" data-count></span></summary>
        <div class="grid grid-lib">${current.map(libCard).join('')}</div>
        ${legacy.length ? `<details class="lib-area lib-legacy" style="margin:12px 0 0"><summary>${icon('chevron', 'chev')}<span class="muted">Legacy</span><span class="count faint" data-count></span></summary><div class="grid grid-lib">${legacy.map(libCard).join('')}</div></details>` : ''}
      </details>`;
    }).join('');
    const total = entries.length; const ext = entries.filter((e) => e.external).length;
    section.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Library</h1><p>${total} pages — studios, editors, viewers, exporters and QA pages${ext ? `, ${ext} from external checkouts` : ''}. Registered in <code>workbench/tools.json</code>.</p></div><div class="actions"><button class="btn" type="button" data-action="refresh-library">${icon('reload')}Refresh</button></div></div>
      <div class="lib-controls">
        <div class="search-wrap">${icon('search', 'search-icon')}<input class="input input-search" id="lib-q" type="search" placeholder="Filter pages…" aria-label="Filter the Library" value="${esc(state.lib.q)}"></div>
        <div class="segmented" role="group" aria-label="Kind" id="lib-kinds">${KINDS.map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="${state.lib.kind === k}">${l}</button>`).join('')}</div>
        <span class="spacer"></span>
        <label class="toggle"><input type="checkbox" id="lib-external"${state.lib.external ? ' checked' : ''}><span class="toggle-track"></span><span>External</span></label>
        <label class="toggle" title="Load each page in its card (pages load as you scroll)"><input type="checkbox" id="lib-live"${state.lib.live ? ' checked' : ''}><span class="toggle-track"></span><span>Live thumbnails</span></label>
      </div>
      <div id="lib-groups">${groups}</div>
      <div id="lib-none" hidden>${emptyState({ iconName: 'search', title: 'Nothing matches', body: 'Try fewer letters, another kind, or turn External back on.', actions: '<button class="btn" type="button" data-action="clear-lib">Clear filters</button>' })}</div>
    </div>`;
    $('#lib-q').oninput = (ev) => { state.lib.q = ev.target.value; filterLibrary(); };
    $$('#lib-kinds button').forEach((b) => { b.onclick = () => { state.lib.kind = b.dataset.kind; $$('#lib-kinds button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); filterLibrary(); }; });
    $('#lib-external').onchange = (ev) => { state.lib.external = ev.target.checked; persist(); filterLibrary(); };
    $('#lib-live').onchange = (ev) => { state.lib.live = ev.target.checked; persist(); libraryBuilt = false; renderLibrary(); };
    observeThumbs();
  }
  filterLibrary();
}

function filterLibrary() {
  const q = state.lib.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const byId = new Map((state.library?.entries || []).map((e) => [e.id, e]));
  let shown = 0;
  for (const card of $$('#view-library .lib-card')) {
    const e = byId.get(card.dataset.entry);
    const ok = (state.lib.kind === 'all' || card.dataset.kind === state.lib.kind) && (state.lib.external || !e.external) && q.every((w) => card.dataset.search.includes(w));
    card.hidden = !ok; if (ok) shown += 1;
  }
  for (const area of $$('#view-library details.lib-area')) {
    const n = $$(':scope > .grid > .lib-card:not([hidden])', area).length;
    const nested = $$('.lib-card:not([hidden])', area).length;
    area.hidden = nested === 0;
    const count = $(':scope > summary [data-count]', area);
    if (count) count.textContent = area.classList.contains('lib-legacy') ? `${n}` : `${nested}`;
    if (q.length && area.classList.contains('lib-legacy') && n) area.open = true;
  }
  const none = $('#lib-none'); if (none) none.hidden = shown > 0;
  layoutThumbs();
}

function layoutThumbs() { for (const f of $$('#view-library .thumb iframe')) { const w = f.parentElement.clientWidth; if (w) f.style.transform = `scale(${w / 1280})`; } }
function observeThumbs() {
  thumbObserver?.disconnect();
  if (!('IntersectionObserver' in window)) return;
  thumbObserver = new IntersectionObserver((items) => {
    for (const it of items) {
      if (!it.isIntersecting) continue;
      const thumb = it.target; thumbObserver.unobserve(thumb);
      const f = document.createElement('iframe');
      f.src = thumb.dataset.thumb; f.tabIndex = -1; f.setAttribute('aria-hidden', 'true'); f.loading = 'lazy'; f.title = '';
      f.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      f.onload = () => { const ph = $('.thumb-ph', thumb); if (ph) ph.remove(); };
      thumb.prepend(f);
      const w = thumb.clientWidth; if (w) f.style.transform = `scale(${w / 1280})`;
    }
  }, { root: $('#view-library'), rootMargin: '200px' });
  for (const t of $$('#view-library [data-thumb]')) thumbObserver.observe(t);
}

function findEntry(id) { return state.library?.entries.find((e) => e.id === id); }
function openEntry(e, where = 'here') {
  if (!e) return;
  if (where === 'here' && e.servedBy === 'workbench-child') return show(ALL_VIEWS.find((v) => v.tool === e.toolId).id, { focus: true });
  const url = entryUrl(e);
  if (where === 'window') { if (url) window.open(url, '_blank', 'noopener'); return; }
  if (where === 'pane') { if (state.collapsed) toggleDock(); state.dockEntry = url ? e : null; renderDock(); return; }
  state.pageEntry = e; show('page', { focus: true });
}

// The page view: one Library entry full size, or why it can't be shown.
let pageFrameUrl = '';
function renderPage() {
  const section = $('#view-page'); const e = state.pageEntry;
  if (!e) { section.innerHTML = `<div class="page">${emptyState({ iconName: 'library', title: 'Nothing open', body: 'Open a page from the Library or the command palette.', actions: '<button class="btn btn-primary" type="button" data-go="library">Browse the Library</button>' })}</div>`; pageFrameUrl = ''; return; }
  const url = entryUrl(e);
  if (url && pageFrameUrl === url && $('iframe', section)) return;
  pageFrameUrl = url || '';
  const problem = url ? null : entryProblem(e);
  section.innerHTML = `<div class="toolbar"><span class="tag tag-kind">${esc(kindLabel[e.kind] || e.kind)}</span><h1>${esc(e.title)}</h1><span class="url">${esc(url || e.path)}</span><div class="actions">
    ${url ? `<button class="btn btn-sm btn-ghost" type="button" data-reload-page>${icon('reload')}Reload</button><button class="btn btn-sm btn-ghost" type="button" data-pane="${esc(e.id)}">${icon('pane')}Preview pane</button><button class="btn btn-sm btn-ghost" type="button" data-newwin="${esc(e.id)}">${icon('external')}Open in window</button>` : ''}
    <button class="btn btn-sm btn-ghost" type="button" data-go="library">${icon('library')}Library</button></div></div>
    <div class="frame-host">${url ? `<iframe title="${esc(e.title)}" src="${esc(url)}" allow="clipboard-read; clipboard-write; fullscreen"></iframe>` : emptyState({ kind: 'is-error', iconName: e.external ? 'plug' : 'warn', title: problem.title, body: problem.body,
      actions: [problem.settings ? '<button class="btn btn-primary" type="button" data-go="settings">Set path in Settings</button>' : '', problem.folder ? '<button class="btn" type="button" data-folder="editorCheckout">Open folder</button>' : '', problem.restart && state.session.children ? restartBtn(problem.restart) : '', e.source ? '<button class="btn" type="button" data-action="refresh-library">Check again</button>' : ''].join('') })}</div>`;
  const reload = $('[data-reload-page]', section); if (reload) reload.onclick = () => { const f = $('iframe', section); f.src = f.src; };
}

// ---------------------------------------------------------------------------
// Preview dock
// ---------------------------------------------------------------------------
let dockFrame = null; let dockFrameUrl = '';
function dockUrl() {
  const base = state.dockEntry ? entryUrl(state.dockEntry) : previewShow || gameBase();
  return base ? withPreviewOverrides(base, previewOverrides) : base;
}
function renderDevices() {
  $('#devices').innerHTML = DEVICES.map((d) => `<button type="button" data-device="${d.id}" aria-pressed="${state.device === d.id}" title="${d.width ? `${d.label} ${d.width}×${d.height}` : 'Fill the pane'}">${d.label}</button>`).join('');
}
function renderDock() {
  const app = $('#app');
  app.classList.toggle('dock-collapsed', state.collapsed);
  app.style.setProperty('--dock-w', `${state.dockW}px`);
  $('#toggle-dock').setAttribute('aria-pressed', String(!state.collapsed));
  $('#dock-auto').checked = state.auto;
  renderDevices();
  const splitter = $('#splitter');
  splitter.setAttribute('aria-valuenow', String(state.dockW)); splitter.setAttribute('aria-valuemin', '300'); splitter.setAttribute('aria-valuemax', String(maxDock()));
  const g = tool('game');
  $('#dock-dot').className = `dot ${state.dockEntry ? 'up' : g ? g.status : ''}`;
  $('#dock-label').textContent = state.dockEntry ? state.dockEntry.title : previewShow ? 'Module preview' : 'Game preview';
  $('#dock-back').hidden = !state.dockEntry && !previewShow;
  const url = dockUrl(); const stage = $('#dock-stage');
  $('#dock-pop').disabled = !url; $('#dock-reload').disabled = !url;
  if (state.collapsed) return;
  if (!url) {
    if (dockFrame) { dockFrame.remove(); dockFrame = null; dockFrameUrl = ''; }
    $$('.empty', stage).forEach((n) => n.remove());
    const children = state.session && state.session.children;
    stage.insertAdjacentHTML('beforeend', !g ? emptyState({ kind: 'is-wait', iconName: 'plug', title: 'Connecting…' })
      : g.status === 'starting' ? emptyState({ kind: 'is-wait', iconName: 'server', title: 'Starting the game server…', body: `Waiting for ${esc(g.url)}.` })
        : emptyState({ kind: 'is-error', iconName: 'error', title: 'Game server is not running', body: esc(children ? g.message || 'It stopped.' : 'The Workbench was started with --no-children; run node tools/serve.mjs --port 4320 yourself.'), pre: g.log.slice(-5).join('\n'), actions: children ? restartBtn('game') : '' }));
    $('#dock-size').textContent = '';
    return;
  }
  $$('.empty', stage).forEach((n) => n.remove());
  if (!dockFrame) { dockFrame = document.createElement('iframe'); dockFrame.title = 'Game preview'; dockFrame.allow = 'autoplay; fullscreen; clipboard-write; gamepad'; stage.append(dockFrame); }
  if (dockFrameUrl !== url) { dockFrame.src = url; dockFrameUrl = url; }
  fitDock();
}
function fitDock() {
  if (!dockFrame) return;
  const stage = $('#dock-stage'); const d = DEVICES.find((x) => x.id === state.device);
  const fit = fitDevice(d, { width: stage.clientWidth, height: stage.clientHeight });
  stage.classList.toggle('is-device', Boolean(d.width));
  Object.assign(dockFrame.style, { width: `${fit.width}px`, height: `${fit.height}px`, left: `${fit.left}px`, top: `${fit.top}px`, transform: d.width ? `scale(${fit.scale})` : 'none' });
  $('#dock-size').textContent = d.width ? `${d.width}×${d.height} · ${Math.round(fit.scale * 100)}%` : `${stage.clientWidth}×${stage.clientHeight}`;
}
function reloadPreview(quiet = false) {
  if (!dockFrame || !dockFrameUrl) { if (!quiet) toast({ kind: 'warn', title: 'Nothing to reload', detail: 'The game server is not running.', record: false }); return false; }
  dockFrame.src = dockFrameUrl;
  return true;
}
const maxDock = () => Math.max(320, window.innerWidth - 208 - 440);
function setDockW(w) { state.dockW = Math.round(clamp(w, 300, maxDock())); renderDock(); persist(); }
function toggleDock() { state.collapsed = !state.collapsed; persist(); renderDock(); if (state.view === 'home') renderHome(); }
function setDevice(id) { state.device = id; persist(); renderDock(); }

function initSplitter() {
  const s = $('#splitter');
  s.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    s.setPointerCapture(ev.pointerId); $('#app').classList.add('resizing');
    const move = (e) => setDockW(window.innerWidth - e.clientX - 3);
    const up = () => { $('#app').classList.remove('resizing'); s.removeEventListener('pointermove', move); s.removeEventListener('pointerup', up); s.removeEventListener('pointercancel', up); };
    s.addEventListener('pointermove', move); s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
  });
  s.addEventListener('dblclick', () => setDockW(460));
  s.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 96 : 32;
    if (ev.key === 'ArrowLeft') setDockW(state.dockW + step);
    else if (ev.key === 'ArrowRight') setDockW(state.dockW - step);
    else if (ev.key === 'Home') setDockW(300);
    else if (ev.key === 'End') setDockW(maxDock());
    else if (ev.key === 'Enter') toggleDock();
    else return;
    ev.preventDefault();
  });
}

// ---------------------------------------------------------------------------
// Engine export
// ---------------------------------------------------------------------------
async function loadManifest() { try { state.manifest = await api('export/manifest'); } catch (e) { state.manifest = { error: e.message }; } if (state.view === 'export') renderExport(); }
/** ` disabled title="…"` for a job whose script is not in this checkout (the engine exporter on older branches). */
function jobOff(id) { const d = state.jobs.defs.find((x) => x.id === id); return d && !d.available ? ` disabled title="${esc(d.note)}"` : ''; }
function filterExport() {
  const q = state.exportQ.trim().toLowerCase(); let shown = 0;
  $$('#view-export tbody tr').forEach((tr) => { const hit = !q || tr.dataset.name.includes(q); tr.hidden = !hit; shown += hit; });
  const c = $('#export-shown'); if (c) c.textContent = q ? `· ${shown} shown` : '';
}
function renderExport() {
  const def = state.jobs.defs.find((d) => d.id === 'engine-export');
  const run = state.jobs.runs.find((r) => r.id === 'engine-export');
  const running = run && run.status === 'running';
  const m = state.manifest;
  const tables = m && m.manifest ? manifestTables(m.manifest) : [];
  const sum = m && m.manifest ? manifestSummary(m.manifest) : null;
  // Manifest paths are relative to the export folder; /export/ serves that folder read-only.
  const link = (p, label) => p ? `<a href="/export/${esc(p.replace(/^\/+/, '').replace(/^build\/engine-export\//, '').split('/').map(encodeURIComponent).join('/'))}" target="_blank" rel="noopener">${esc(label || p.split('/').pop())}</a>` : '<span class="faint">—</span>';
  let body;
  if (!m) body = emptyState({ kind: 'is-wait', iconName: 'cube', title: 'Reading the export…' });
  else if (m.error) body = emptyState({ kind: 'is-error', iconName: 'error', title: 'The manifest could not be read', body: esc(m.error) });
  else if (!m.exists) body = emptyState({ iconName: 'cube', title: 'No export yet', body: def && !def.available ? esc(def.note) : 'Run the export to write JSON tables and their schemas to <code>build/engine-export/</code>.', actions: def && def.available ? `<button class="btn btn-primary" type="button" data-run="engine-export"${running ? ' disabled' : ''}>${icon('play')}Run export</button>` : '' });
  else if (!tables.length) body = emptyState({ iconName: 'warn', title: 'The manifest lists no tables', body: 'build/engine-export/manifest.json was found but names no tables.', actions: '<a class="btn" href="/export/manifest.json" target="_blank" rel="noopener">Open manifest.json</a>' });
  else body = `<div class="table-wrap export-tables"><table class="table"><thead><tr><th>Table</th><th class="num">Rows</th><th>Schema</th><th>Data</th></tr></thead><tbody>${tables.map((t) => `<tr data-name="${esc(t.name.toLowerCase())}"><td><b>${esc(t.name)}</b>${t.description ? `<div class="faint">${esc(t.description)}</div>` : ''}${t.omitted ? ` <span class="faint" title="Functions cannot be exported; the manifest lists their paths in omittedFunctions">· ${t.omitted} function${t.omitted === 1 ? '' : 's'} left out</span>` : ''}</td><td class="num">${t.rows ?? '—'}</td><td>${link(t.schema, 'schema')}</td><td>${link(t.json, 'json')}</td></tr>`).join('')}</tbody></table></div>`;
  const facts = sum && tables.length ? [
    sum.version && `v${esc(sum.version)}`, sum.buildOrdinal != null && `build ${esc(sum.buildOrdinal)}`, sum.gitSha && `<code>${esc(sum.gitSha)}</code>`,
    `${sum.rows.toLocaleString()} rows`, `${sum.config} config`, `${sum.art} art files`,
  ].filter(Boolean).join(' · ') : '';
  $('#view-export').innerHTML = `<div class="page">
    <div class="page-head"><div><h1>Engine Export</h1><p>Game data as JSON tables with JSON Schemas, for importing into Unity or Unreal. Written to <code>build/engine-export/</code> (not committed).</p></div>
      <div class="actions"><button class="btn" type="button" data-action="reload-manifest">${icon('reload')}Refresh</button>${running ? `<button class="btn btn-danger" type="button" data-cancel="${esc(run.runId)}">${icon('stop')}Cancel</button>` : `<button class="btn btn-primary" type="button" data-run="engine-export"${jobOff('engine-export')}>${icon('play')}Run export</button>`}</div></div>
    ${def && !def.available ? `<p class="note" style="margin-bottom:16px">${icon('warn', 'kind-icon')} ${esc(def.note)}</p>` : ''}
    ${run ? `<p class="muted" style="margin-bottom:12px">Last run: <b class="run-status ${run.status}">${esc(run.status)}</b> ${esc(ago(run.startedAt))}${run.durationMs != null ? ` · ${esc(duration(run.durationMs))}` : ''}${run.message ? ` — ${esc(run.message)}` : ''} · <button class="link-btn" type="button" data-showrun="${esc(run.runId)}">Show log</button></p>` : ''}
    ${sum && sum.format && !sum.known ? `<p class="note" style="margin-bottom:16px">${icon('warn', 'kind-icon')} manifest.json says format <code>${esc(sum.format)}</code>; this page reads <code>${esc(EXPORT_FORMAT)}</code>, so some columns may be empty.</p>` : ''}
    <div class="section-head"><h2>Tables</h2><span class="count">${tables.length ? `${tables.length} tables${m.modified ? ` · exported ${esc(ago(m.modified))}` : ''}` : ''}</span><span class="count" id="export-shown"></span>${m && m.exists ? `<div class="actions">${tables.length ? `<div class="search-wrap">${icon('search', 'search-icon')}<input class="input input-search" id="export-q" type="search" placeholder="Filter tables…" aria-label="Filter the exported tables" value="${esc(state.exportQ)}"></div>` : ''}<a class="btn btn-sm btn-ghost" href="/export/manifest.json" target="_blank" rel="noopener">manifest.json</a></div>` : ''}</div>
    ${facts ? `<p class="faint export-facts">${facts}</p>` : ''}
    <div class="card">${body}</div>
    <div class="section"><div class="section-head"><h2>Importing into an engine</h2><div class="actions"><button class="btn btn-sm" type="button" data-doc="docs/ENGINE-EXPORT.md">${icon('doc')}Read docs/ENGINE-EXPORT.md</button></div></div>
      <div class="card"><div class="howto"><h3>Unity</h3><ol><li>Copy <code>docs/engine-export/unity/AshenSpireTable.cs</code> into a runtime folder and <code>AshenSpireExportImporter.cs</code> into an <code>Editor/</code> folder.</li><li>Run <b>AshenSpire → Import Export Folder…</b> and pick <code>build/engine-export/</code>: one <code>AshenSpireTable</code> asset per table.</li><li>Or copy the folder to <code>Assets/StreamingAssets/AshenSpire/</code> and read the JSON at runtime. Each row's key is its <code>Name</code>.</li></ol></div>
      <div class="howto"><h3>Unreal</h3><ol><li>Create a <code>USTRUCT</code> deriving from <code>FTableRowBase</code> whose fields match the table's schema (<code>Name</code> is the row name, not a field).</li><li>Drag <code>tables/&lt;id&gt;.json</code> into the Content Browser and choose the struct, or use the Python importer in the docs.</li><li>Reimport after each export to pick up changes.</li></ol></div></div>
    </div></div>`;
  const q = $('#export-q'); if (q) { q.oninput = (ev) => { state.exportQ = ev.target.value; filterExport(); }; filterExport(); }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
async function runJob(id) {
  const def = state.jobs.defs.find((d) => d.id === id);
  if (def && !def.available) return toast({ kind: 'warn', title: `${def.label} is not available`, detail: def.note });
  try { const run = await api('jobs', { id }); onJob(run); toast({ title: `${run.label} started`, record: false, timeout: 2000 }); }
  catch (e) { toast({ kind: e.message.includes('already running') ? 'warn' : 'error', title: `Could not start ${id}`, detail: e.message }); }
}
async function cancelRun(runId) { try { onJob(await api(`jobs/runs/${runId}/cancel`, {})); } catch (e) { toast({ kind: 'error', title: 'Could not cancel', detail: e.message }); } }
function onJob(run) {
  const runs = state.jobs.runs; const i = runs.findIndex((r) => r.runId === run.runId);
  const prev = i >= 0 ? runs[i] : null;
  if (i >= 0) runs[i] = run; else runs.unshift(run);
  runs.length = Math.min(runs.length, 30);
  state.jobs.defs.forEach((d) => { d.running = runs.some((r) => r.id === d.id && r.status === 'running'); });
  if (prev && prev.status === 'running' && run.status !== 'running') {
    const show = { label: 'Show log', run: () => showRun(run.runId) };
    if (run.status === 'passed') toast({ kind: 'success', title: `${run.label} passed`, detail: duration(run.durationMs) });
    else if (run.status === 'failed') toast({ kind: 'error', title: `${run.label} failed`, detail: run.message, actions: [show, { label: 'Run again', run: () => runJob(run.id) }] });
    else toast({ kind: 'warn', title: `${run.label} cancelled` });
    refreshGit();
    if (run.id === 'engine-export') loadManifest();
  }
  renderChips(); renderRail();
  if (state.view === 'jobs') renderJobs();
  if (state.view === 'home') renderHome();
  if (state.view === 'export') renderExport();
}
function onJobLog({ runId, text }) {
  if (!state.logs.has(runId)) return;
  state.logs.set(runId, (state.logs.get(runId) + text).slice(-400000));
  const pre = $(`#view-jobs [data-log="${CSS.escape(runId)}"]`);
  if (pre) { const stick = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 24; pre.innerHTML = colorLog(state.logs.get(runId)); if (stick) pre.scrollTop = pre.scrollHeight; }
}
function colorLog(text) {
  return esc(text).split('\n').map((l) => /^(&gt; node|> node)/.test(l) ? `<span class="log-cmd">${l}</span>` : /^(not ok|✖|# fail [1-9]|Error|error:)/.test(l.trim()) ? `<span class="log-fail">${l}</span>` : /^(ok |✔|# pass)/.test(l.trim()) ? `<span class="log-pass">${l}</span>` : l).join('\n');
}
async function toggleRun(runId, open) {
  if (open) {
    state.openRuns.add(runId);
    if (!state.logs.has(runId)) { state.logs.set(runId, ''); try { const full = await api(`jobs/runs/${runId}`); state.logs.set(runId, full.log || ''); } catch (e) { state.logs.set(runId, `Could not load the log: ${e.message}`); } }
  } else state.openRuns.delete(runId);
  renderJobs();
  const pre = $(`#view-jobs [data-log="${CSS.escape(runId)}"]`); if (pre) pre.scrollTop = pre.scrollHeight;
}
function showRun(runId) { show('jobs'); toggleRun(runId, true); }
function renderJobs() {
  const { defs, runs } = state.jobs;
  const lastOf = (id) => runs.find((r) => r.id === id);
  const scroll = $('#view-jobs').scrollTop;
  $('#view-jobs').innerHTML = `<div class="page">
    <div class="page-head"><div><h1>Build &amp; Checks</h1><p>Allowlisted jobs only. One run per job at a time; output streams live; the last 30 runs are kept.</p></div></div>
    <div class="grid grid-jobs">${defs.map((d) => { const last = lastOf(d.id); const running = last && last.status === 'running'; return `<article class="card job-card"><h3><span class="dot ${last ? last.status : ''}"></span>${esc(d.label)}</h3><p>${esc(d.description)}</p>${d.commands.map((c) => `<code>${esc(c.length > 140 ? `${c.slice(0, 140)}…` : c)}</code>`).join('')}${!d.available ? `<div class="note">${esc(d.note)}</div>` : ''}<div class="foot"><span class="faint">${last ? `${esc(last.status)} ${esc(ago(last.endedAt || last.startedAt))}${last.durationMs != null ? ` · ${esc(duration(last.durationMs))}` : ''}` : 'Never run'}</span><span class="spacer"></span>${running ? `<button class="btn btn-sm btn-danger" type="button" data-cancel="${esc(last.runId)}">${icon('stop')}Cancel</button>` : `<button class="btn btn-sm btn-primary" type="button" data-run="${esc(d.id)}"${jobOff(d.id)}>${icon('play')}Run</button>`}</div></article>`; }).join('')}</div>
    <div class="section"><div class="section-head"><h2>History</h2><span class="count">${runs.length ? `${runs.length} run${runs.length === 1 ? '' : 's'}` : ''}</span></div>
      <div class="card">${runs.length ? `<ol class="runs">${runs.map((r) => { const open = state.openRuns.has(r.runId); return `<li class="run${open ? ' open' : ''}"><div class="run-head"><button class="run-toggle" type="button" data-toggle-run="${esc(r.runId)}" aria-expanded="${open}">${icon('chevron', 'chev')}<span class="dot ${r.status}"></span><span class="run-status ${r.status}">${esc(r.status)}</span><span class="run-label">${esc(r.label)}</span><span class="run-meta">${esc(new Date(r.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}${r.durationMs != null ? ` · ${esc(duration(r.durationMs))}` : ''}${r.message ? ` · ${esc(r.message)}` : ''}</span></button>${r.status === 'running' ? `<button class="btn btn-sm btn-danger" type="button" data-cancel="${esc(r.runId)}">${icon('stop')}Cancel</button>` : `<button class="btn btn-sm btn-ghost" type="button" data-run="${esc(r.id)}"${jobOff(r.id)}>${icon('restart')}Re-run</button>`}</div>${open ? `<pre class="run-log" data-log="${esc(r.runId)}" tabindex="0" aria-label="${esc(r.label)} log">${colorLog(state.logs.get(r.runId) || (r.status === 'running' ? 'Waiting for output…' : '(no output)'))}</pre>` : ''}</li>`; }).join('')}</ol>` : emptyState({ iconName: 'checks', title: 'No runs yet', body: 'Run a job above; its output streams here.' })}</div></div></div>`;
  $('#view-jobs').scrollTop = scroll;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function renderSettings() {
  const section = $('#view-settings');
  if (!state.settings) { section.innerHTML = `<div class="page">${emptyState({ kind: 'is-wait', iconName: 'gear', title: 'Loading settings…' })}</div>`; try { state.settings = await api('settings'); } catch (e) { section.innerHTML = `<div class="page">${emptyState({ kind: 'is-error', iconName: 'error', title: 'Settings could not be read', body: esc(e.message) })}</div>`; return; } }
  const s = state.settings; const ses = state.session || {};
  const envHint = (k) => s.env && s.env[k] ? `Default from ${k}: <code>${esc(s.env[k])}</code>` : `Defaults from the ${k} environment variable when set.`;
  section.innerHTML = `<div class="page">
    <div class="page-head"><div><h1>Settings</h1><p>Saved on this machine in <code>workbench/.state/settings.json</code> (not committed).</p></div></div>
    <form class="card form" id="settings-form" autocomplete="off">
      <div class="field"><label for="set-art">Art checkout</label><div class="control"><input class="input" id="set-art" name="artCheckout" placeholder="D:\\repos\\AshenSpire-art" value="${esc(s.artCheckout)}"><button class="btn" type="button" data-folder="artCheckout"${s.artCheckout ? '' : ' disabled'}>${icon('folder')}Open folder</button></div><div class="hint">A cehinds/AshenSpire-art checkout. Its pages appear in the Library with an External badge and are served read-only. ${envHint('ASHEN_ART_CHECKOUT')}</div></div>
      <div class="field"><label for="set-editor">Editor app checkout</label><div class="control"><input class="input" id="set-editor" name="editorCheckout" placeholder="D:\\repos\\AshenedSpire-Editor" value="${esc(s.editorCheckout)}"><button class="btn" type="button" data-folder="editorCheckout"${s.editorCheckout ? '' : ' disabled'}>${icon('folder')}Open folder</button></div><div class="hint">The separate AshenedSpire-Editor app. Start it there with <code>npm install</code> and <code>npm run dev</code>. ${envHint('ASHEN_EDITOR_CHECKOUT')}</div></div>
      <div class="field"><label for="set-url">Editor app URL</label><div class="control"><input class="input" id="set-url" name="editorUrl" placeholder="http://127.0.0.1:5173" value="${esc(s.editorUrl)}"><button class="btn" type="button" data-window="${esc(s.editorUrl)}">${icon('external')}Open URL</button></div><div class="hint">Where its dev server answers. The Workbench embeds it when it is reachable (local addresses only).</div></div>
      <div class="form-foot"><button class="btn btn-primary" type="submit">Save settings</button></div>
    </form>
    <div class="section" id="shortcut-settings" aria-labelledby="shortcut-title"></div>
    <div class="section"><div class="section-head"><h2>This Workbench</h2></div><div class="card"><dl class="facts">
      <dt>Project</dt><dd>${esc(ses.root)} <button class="link-btn" type="button" data-folder="project">Open folder</button></dd>
      <dt>Address</dt><dd>${esc(location.origin)}</dd>
      <dt>Live reload</dt><dd>${esc(Object.entries(ses.watching || {}).map(([d, m]) => `${d}/ (${m === 'watch' ? 'file events' : 'polling'})`).join(', ') || 'off')}</dd>
      <dt>Child tools</dt><dd>${ses.children ? state.tools.map((t) => `${t.name} — ${t.url}`).join('<br>') : 'Not started (--no-children)'}</dd>
    </dl></div></div></div>`;
  renderShortcutSettings();
  $('#shortcut-settings').onclick = onShortcutSettingsClick;
  $('#settings-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(ev.target).entries());
    try { state.settings = { ...state.settings, ...(await api('settings', data)) }; toast({ kind: 'success', title: 'Settings saved' }); renderSettings(); refreshLibrary(); }
    catch (e) { toast({ kind: 'error', title: 'Settings not saved', detail: e.message }); }
  };
}

// ---------------------------------------------------------------------------
// Command palette
// ---------------------------------------------------------------------------
// Settings → Shortcuts: click a row, press the new keys (Esc cancels), or reset.
let capturingShortcut = null;
function renderShortcutSettings() {
  const box = $('#shortcut-settings'); if (!box) return;
  const all = shortcuts.list();
  const scopes = ['global', ...MODULES.map((m) => m.id)].filter((s) => all.some((a) => a.scope === s));
  box.innerHTML = `<div class="section-head"><h2 id="shortcut-title">Shortcuts</h2><span class="count">${all.length} actions</span><div class="actions"><button class="btn btn-sm btn-ghost" type="button" data-reset-shortcuts="all">${icon('restart')}Reset all</button></div></div>
    <div class="card"><p class="faint" style="padding:12px 16px 0">Click a shortcut, then press the new keys. Esc cancels. A combo already used in the same scope, or by a Workbench action, is refused.</p>
    ${scopes.map((scope) => `<div class="key-scope"><h3>${esc(SCOPE_TITLE(scope))}</h3>${all.filter((a) => a.scope === scope).map((a) => {
      const capturing = capturingShortcut === a.id;
      return `<div class="key-row key-edit"><span>${esc(a.label)}${a.overridden ? ' <span class="tag tag-new">Changed</span>' : ''}</span><span class="key-keys"><button class="btn btn-sm${capturing ? ' btn-primary' : ''}" type="button" data-remap="${esc(a.id)}">${capturing ? 'Press keys… (Esc cancels)' : a.combos.length ? a.combos.map((c) => comboLabel(c)).join(' or ') : 'Not set'}</button>${a.overridden ? `<button class="btn btn-sm btn-ghost" type="button" data-reset-shortcuts="${esc(a.id)}">Reset</button>` : ''}</span></div>`;
    }).join('')}</div>`).join('')}</div>`;
}
function onShortcutSettingsClick(ev) {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.dataset.remap) startShortcutCapture(b.dataset.remap);
  else if (b.dataset.resetShortcuts === 'all') { shortcuts.resetAll(); toast({ title: 'Shortcuts reset to the defaults', record: false, timeout: 2000 }); renderShortcutSettings(); }
  else if (b.dataset.resetShortcuts) { shortcuts.resetCombo(b.dataset.resetShortcuts); renderShortcutSettings(); }
}
function startShortcutCapture(id) {
  capturingShortcut = id; renderShortcutSettings();
  const finish = () => { window.removeEventListener('keydown', onCapture, true); capturingShortcut = null; renderShortcutSettings(); };
  function onCapture(ev) {
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (ev.key === 'Escape') return finish();
    const combo = comboFromEvent(ev); if (!combo) return;
    const res = shortcuts.setCombo(id, combo);
    if (res.ok) toast({ title: `Shortcut set to ${comboLabel(res.combo)}`, record: false, timeout: 1800 });
    else toast({ kind: 'warn', title: 'That combo is already in use', detail: `${res.label} uses it. Pick another.`, record: false });
    finish();
  }
  window.addEventListener('keydown', onCapture, true);
}

let paletteItems = []; let paletteShown = []; let paletteIndex = 0; let lastFocus = null;
function commands() {
  const items = [];
  VIEWS.forEach((v) => items.push({ group: 'Go to', title: v.label, sub: shortcuts.labelOf(navShortcutId(v)), icon: v.icon, run: () => show(v.id, { focus: true }) }));
  items.push({ group: 'Go to', title: 'Settings', sub: shortcuts.labelOf('global:Settings'), icon: 'gear', run: () => show('settings', { focus: true }) });
  for (const rec of modules.values()) {
    for (const c of rec.instance?.commands?.() || []) items.push({ group: rec.def.label, title: c.title, sub: c.sub, icon: 'play', run: c.run });
  }
  items.push(
    { group: 'Preview', title: state.collapsed ? 'Show game preview' : 'Hide game preview', sub: shortcuts.labelOf('global:Show or hide the preview'), icon: 'dock', run: toggleDock },
    { group: 'Preview', title: 'Reload preview', sub: shortcuts.labelOf('global:Reload the preview'), icon: 'reload', run: () => reloadPreview() },
    { group: 'Preview', title: `${state.auto ? 'Turn off' : 'Turn on'} auto-reload`, icon: 'reload', run: () => setAuto(!state.auto) },
    ...DEVICES.map((d) => ({ group: 'Preview', title: `Device: ${d.label}`, sub: d.width ? `${d.width}×${d.height}` : 'fill the pane', icon: 'device', run: () => { if (state.collapsed) toggleDock(); setDevice(d.id); } })),
    { group: 'Preview', title: 'Pop out preview', sub: 'new window', icon: 'pop', run: popOut },
    { group: 'Preview', title: 'Show the game in the preview', icon: 'sparkle', run: () => { state.dockEntry = null; previewShow = null; if (state.collapsed) toggleDock(); renderDock(); } },
  );
  for (const d of state.jobs.defs) items.push({ group: 'Jobs', title: `Run: ${d.label}`, sub: d.available ? d.commands[0].slice(0, 48) : 'unavailable', icon: 'play', run: () => runJob(d.id) });
  for (const t of state.tools) items.push({ group: 'Tools', title: `Restart ${t.name}`, sub: t.status, icon: 'restart', run: () => restartTool(t.id) });
  items.push(
    { group: 'Workbench', title: 'Keyboard shortcuts', sub: '?', icon: 'keyboard', run: openHelp },
    { group: 'Workbench', title: 'Notifications', icon: 'bell', run: openNotes },
    { group: 'Workbench', title: 'Refresh the Library', icon: 'library', run: refreshLibrary },
  );
  for (const e of state.library?.entries || []) items.push({ group: 'Library', title: e.title, sub: `${e.area} · ${kindLabel[e.kind] || e.kind}${e.external ? ' · external' : ''}${e.status === 'legacy' ? ' · legacy' : ''}`, icon: e.kind === 'studio' ? 'brush' : 'file', key: `${e.title} ${e.path} ${e.area}`, run: () => openEntry(e) });
  return items;
}
function openPalette() {
  closeOverlays(); lastFocus = document.activeElement;
  paletteItems = commands(); $('#palette').hidden = false;
  const input = $('#palette-input'); input.value = ''; paletteIndex = 0; renderPalette(); input.focus();
}
function renderPalette() {
  const q = $('#palette-input').value;
  paletteShown = q.trim() ? fuzzyFilter(paletteItems, q, (x) => x.key || `${x.title} ${x.sub || ''}`).slice(0, 60) : paletteItems.filter((x) => x.group !== 'Library' && x.group !== 'Tools');
  paletteIndex = clamp(paletteIndex, 0, Math.max(0, paletteShown.length - 1));
  let group = null; const html = [];
  paletteShown.forEach((x, i) => {
    if (!q.trim() && x.group !== group) { group = x.group; html.push(`<li class="palette-group" role="presentation">${esc(group)}</li>`); }
    html.push(`<li class="palette-item" role="option" id="pi-${i}" data-i="${i}" aria-selected="${i === paletteIndex}"><span class="p-icon">${icon(x.icon)}</span><span class="p-title">${esc(x.title)}</span>${q.trim() ? `<span class="p-sub">${esc(x.group)}${x.sub ? ` · ${esc(x.sub)}` : ''}</span>` : x.sub ? `<span class="p-sub">${esc(x.sub)}</span>` : ''}</li>`);
  });
  $('#palette-list').innerHTML = html.join('') || `<li class="palette-empty">No match for “${esc(q)}”. Try a tool, a page title, a job or “device”.</li>`;
  $('#palette-input').setAttribute('aria-activedescendant', paletteShown.length ? `pi-${paletteIndex}` : '');
  const sel = $(`#pi-${paletteIndex}`); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function runPalette(i) { const x = paletteShown[i]; if (!x) return; closePalette(false); x.run(); }
function closePalette(restore = true) { $('#palette').hidden = true; if (restore && lastFocus && lastFocus.focus) lastFocus.focus(); }

// ---------------------------------------------------------------------------
// Help, docs, overlays
// ---------------------------------------------------------------------------
const SCOPE_TITLE = (scope) => (scope === 'global' ? 'Workbench' : moduleDef(scope)?.label || scope);
// Keys the registry does not own: the splitter takes arrows and Enter when focused.
const FIXED_KEYS = [['Preview', [[['←', '→'], 'Resize (with the splitter focused; Shift for bigger steps)'], [['Enter'], 'Collapse (with the splitter focused)']]]];
function openHelp() {
  closeOverlays(); lastFocus = document.activeElement;
  const k = (combo) => combo.split('+').map((x) => `<kbd>${esc(x === 'Mod' ? 'Ctrl' : x)}</kbd>`).join('');
  const all = shortcuts.list();
  const groups = new Map();
  for (const a of all) {
    if (a.scope === 'global' && a.label.startsWith('Go to ')) continue; // listed under Navigate
    if (!groups.has(a.scope)) groups.set(a.scope, []);
    groups.get(a.scope).push(a);
  }
  const rows = (list) => list.map((a) => `<div class="key-row"><span>${esc(a.label)}</span><span class="key-keys">${a.combos.length ? k(a.combos[0]) : '<span class="faint">none</span>'}</span></div>`).join('');
  const nav = all.filter((a) => a.scope === 'global' && a.label.startsWith('Go to '));
  const sections = [['Workbench', groups.get('global') || []], ['Navigate', nav], ...[...groups].filter(([s]) => s !== 'global').map(([s, list]) => [SCOPE_TITLE(s), list])];
  const fixed = FIXED_KEYS.map(([title, list]) => `<h3>${esc(title)}</h3>${list.map(([keys, what]) => `<div class="key-row"><span>${esc(what)}</span><span class="key-keys">${keys.map((x) => `<kbd>${esc(x)}</kbd>`).join('')}</span></div>`).join('')}`).join('');
  $('#help-body').innerHTML = `<div class="keys">${sections.filter(([, l]) => l.length).map(([title, list]) => `<h3>${esc(title)}</h3>${rows(list)}`).join('')}${fixed}<p class="keys-note">On macOS use ⌘ for Ctrl. Alt+1…9 also switch views. Remap any shortcut in Settings → Shortcuts. Ctrl+K and Ctrl+\ also work inside the frames of the legacy studios; every other key there is the studio's own, so click the rail or header first.</p></div>`;
  $('#help').hidden = false; $('#help [data-close]').focus();
}
async function openDoc(rel) {
  closeOverlays(); lastFocus = document.activeElement;
  $('#docview-title').textContent = rel; $('#docview-text').textContent = 'Loading…'; $('#docview').hidden = false; $('#docview [data-close]').focus();
  try { $('#docview-text').textContent = (await api(`doc?path=${encodeURIComponent(rel)}`)).text; }
  catch (e) { $('#docview-text').textContent = `${rel} could not be read (${e.message}).\n\nThe steps on the Engine Export page cover the import.`; }
}
function showGitFiles() {
  const g = state.git; if (!g || !g.repo) return;
  closeOverlays(); lastFocus = document.activeElement;
  $('#docview-title').textContent = g.dirty ? `${g.dirty} changed file${g.dirty === 1 ? '' : 's'} on ${g.branch}` : `${g.branch} is clean`;
  $('#docview-text').textContent = g.dirty ? `${g.files.join('\n')}${g.dirty > g.files.length ? `\n… and ${g.dirty - g.files.length} more` : ''}` : 'No uncommitted changes.';
  $('#docview').hidden = false; $('#docview [data-close]').focus();
}
function anyOverlay() { return !$('#palette').hidden || !$('#help').hidden || !$('#docview').hidden || !$('#notes').hidden; }
function closeOverlays() { $('#palette').hidden = true; $('#help').hidden = true; $('#docview').hidden = true; $('#notes').hidden = true; }
function popOut() { const url = dockUrl(); if (!url) return toast({ kind: 'warn', title: 'Nothing to pop out', detail: 'The game server is not running.', record: false }); const d = DEVICES.find((x) => x.id === state.device); window.open(url, 'ashenspire-preview', d.width ? `popup,width=${d.width},height=${d.height}` : 'popup,width=1280,height=800'); }
function setAuto(on) { state.auto = on; persist(); $('#dock-auto').checked = on; toast({ title: `Auto-reload ${on ? 'on' : 'off'}`, record: false, timeout: 1600 }); }

// ---------------------------------------------------------------------------
// Events: clicks, keys, server stream
// ---------------------------------------------------------------------------
function onClick(ev) {
  const b = ev.target.closest('button, a[data-go]'); if (!b) return;
  const d = b.dataset;
  if (d.view) return show(d.view, { focus: false });
  if (d.go) { closeOverlays(); return show(d.go, { focus: true }); }
  if (d.restart) return restartTool(d.restart);
  if (d.window) { if (d.window) window.open(d.window, '_blank', 'noopener'); return; }
  if (d.run) return runJob(d.run);
  if (d.cancel) return cancelRun(d.cancel);
  if (d.toggleRun) return toggleRun(d.toggleRun, !state.openRuns.has(d.toggleRun));
  if (d.showrun) return showRun(d.showrun);
  if (d.open) return openEntry(findEntry(d.open), 'here');
  if (d.pane) return openEntry(findEntry(d.pane), 'pane');
  if (d.newwin) return openEntry(findEntry(d.newwin), 'window');
  if (d.device) return setDevice(d.device);
  if (d.doc) return openDoc(d.doc);
  if (d.palette !== undefined) return openPalette();
  if (d.folder) return api('open-folder', { which: d.folder }).then((r) => toast({ title: 'Opened folder', detail: r.dir, record: false }), (e) => toast({ kind: 'error', title: 'Could not open the folder', detail: e.message }));
  if (d.close !== undefined) { closeOverlays(); if (lastFocus && lastFocus.focus) lastFocus.focus(); return; }
  if (d.action === 'reload-page') return location.reload();
  if (d.action === 'reload-preview') return reloadPreview();
  if (d.action === 'toggle-dock') return toggleDock();
  if (d.action === 'help') return openHelp();
  if (d.action === 'refresh-library') return refreshLibrary().then(() => { if (state.view === 'page') renderPage(); toast({ title: 'Library refreshed', record: false, timeout: 1500 }); });
  if (d.action === 'reload-manifest') { state.manifest = null; renderExport(); return loadManifest(); }
  if (d.action === 'clear-lib') { state.lib.q = ''; state.lib.kind = 'all'; state.lib.external = true; libraryBuilt = false; return renderLibrary(); }
}

function onKey(ev) {
  if (!$('#palette').hidden && ev.target.id === 'palette-input') {
    if (ev.key === 'ArrowDown') { paletteIndex = Math.min(paletteShown.length - 1, paletteIndex + 1); renderPalette(); ev.preventDefault(); return; }
    if (ev.key === 'ArrowUp') { paletteIndex = Math.max(0, paletteIndex - 1); renderPalette(); ev.preventDefault(); return; }
    if (ev.key === 'Enter') { runPalette(paletteIndex); ev.preventDefault(); return; }
  }
  if (ev.key === 'Escape' && anyOverlay()) { closeOverlays(); if (lastFocus && lastFocus.focus) lastFocus.focus(); ev.preventDefault(); return; }
  shortcuts.dispatch(ev, activeModule || 'global');
}

const navShortcutId = (v) => `global:Go to ${v.label}`;
/** Global shortcuts, on the registry so Settings → Shortcuts can remap them. */
function registerShortcuts() {
  const g = (combo, label, handler, opts) => shortcuts.register('global', combo, label, handler, opts);
  g(['Mod+K'], 'Command palette', () => { if ($('#palette').hidden) openPalette(); else closePalette(); }, { inInput: true });
  g(['Mod+\\'], 'Show or hide the preview', () => toggleDock(), { inInput: true });
  g(['Mod+R'], 'Reload the preview', () => { if (reloadPreview()) toast({ title: 'Preview reloaded', record: false, timeout: 1400 }); return true; }, { inInput: true });
  g(['Mod+,'], 'Settings', () => { closeOverlays(); show('settings', { focus: true }); }, { inInput: true });
  g(['?'], 'Keyboard shortcuts', () => openHelp(), { inInput: false });
  g(['Mod+Z'], 'Undo', () => stepActiveHistory('undo'), { inInput: false });
  g(['Mod+Shift+Z', 'Mod+Y'], 'Redo', () => stepActiveHistory('redo'), { inInput: false });
  VIEWS.forEach((v, i) => {
    const digit = i < 9 ? i + 1 : i === 9 ? 0 : null;
    if (digit === null) return;
    g([`Mod+${digit}`, `Alt+${digit}`], `Go to ${v.label}`, () => { closeOverlays(); show(v.id, { focus: true }); }, { inInput: true });
  });
}
/** Undo or redo in the module that is showing; false lets the browser handle the key. */
function stepActiveHistory(dir) {
  const rec = activeModule && modules.get(activeModule);
  return rec ? stepHistory(rec, dir) : false;
}

// Shortcuts typed inside a tool's frame. A same-origin frame is hooked
// directly: Ctrl+K, Ctrl+\ and ? (outside a text field) reach the Workbench.
// The studios run on their own ports (cross-origin), so they post
// {type: 'ashenspire-workbench-key', key: 'k' | '\\'} instead; a message is
// honoured only from a frame of this page, and carries no data back.
const FRAME_KEY = 'ashenspire-workbench-key';
const FRAME_COMBO = { k: 'Mod+K', '\\': 'Mod+\\', '?': '?' };
function frameShortcut(key) {
  if (key === '?' && anyOverlay()) return;
  if (FRAME_COMBO[key]) shortcuts.run(FRAME_COMBO[key], 'global');
}
function hookFrame(f) {
  let doc = null; try { doc = f.contentDocument; } catch { /* cross-origin */ }
  if (!doc || doc.__workbenchKeys) return;
  doc.__workbenchKeys = true;
  doc.addEventListener('keydown', (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    const typing = ev.target.closest && ev.target.closest('input, textarea, select, [contenteditable="true"]');
    const key = mod && !ev.altKey && !ev.shiftKey && ev.key.toLowerCase() === 'k' ? 'k' : mod && ev.key === '\\' ? '\\' : !mod && !typing && ev.key === '?' ? '?' : '';
    if (key) { ev.preventDefault(); frameShortcut(key); }
  }, true);
}
function onFrameMessage(ev) {
  if (!ev.data || ev.data.type !== FRAME_KEY || !['k', '\\'].includes(ev.data.key)) return;
  if (!$$('iframe').some((f) => f.contentWindow === ev.source)) return;
  frameShortcut(ev.data.key);
}

let events = null; let banner = null;
function connectEvents() {
  events = new EventSource(`/api/events?token=${encodeURIComponent(state.session.token)}`);
  events.onopen = () => { state.connected = true; $('#chip-conn').hidden = true; };
  events.onerror = async () => {
    state.connected = false;
    if (events.readyState === EventSource.CLOSED) {
      // The server restarted (new token) or stopped: the page must reload to reconnect.
      if (banner) return;
      banner = document.createElement('div'); banner.className = 'banner'; banner.setAttribute('role', 'alert');
      banner.innerHTML = `${icon('error', 'kind-icon kind-error')}<span>The Workbench server restarted or stopped.</span><button class="btn btn-sm btn-primary" type="button">Reload Workbench</button>`;
      $('button', banner).onclick = () => location.reload();
      document.body.append(banner);
    } else $('#chip-conn').hidden = false;
  };
  const on = (name, fn) => events.addEventListener(name, (e) => { try { fn(JSON.parse(e.data)); } catch (err) { console.error(name, err); } });
  on('tools', onTools);
  on('job', onJob);
  on('job-log', onJobLog);
  on('settings', (s) => { state.settings = { ...state.settings, ...s }; refreshLibrary(); });
  let building = null;
  on('building', (b) => { building = toast({ title: 'Rebuilding…', detail: `${b.steps.map((s) => s.replace(/^tools\//, '')).join(', ')} for ${b.files.length} changed file${b.files.length === 1 ? '' : 's'}`, record: false, timeout: 15000 }); });
  on('reload', (r) => {
    if (building) { building(); building = null; }
    const detail = `${r.files.slice(0, 3).join('\n')}${r.files.length > 3 ? `\n+${r.files.length - 3} more` : ''}${r.built.length ? `\nRebuilt with ${r.built.map((s) => s.replace(/^tools\//, '')).join(', ')}` : ''}`;
    const n = `${r.count} file${r.count === 1 ? '' : 's'}`;
    if (state.auto && reloadPreview(true)) toast({ kind: 'success', title: `Game reloaded (${n})`, detail, timeout: 3500 });
    else toast({ title: `${n} changed`, detail, actions: dockFrame ? [{ label: 'Reload preview', run: () => reloadPreview() }] : [], timeout: 6000 });
    refreshGit();
  });
  on('reload-failed', (r) => {
    if (building) { building(); building = null; }
    const title = r.step ? `${r.step.replace(/^tools\//, '')} failed — preview not reloaded` : 'Preview not reloaded — another build is still running';
    toast({ kind: 'error', title, detail: String(r.output || '').split('\n').filter(Boolean).slice(-8).join('\n'), actions: [{ label: 'Open Build & Checks', run: () => show('jobs') }] });
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  for (const el of $$('[class^="i-"], [class*=" i-"]')) { const name = [...el.classList].find((c) => c.startsWith('i-')).slice(2); el.innerHTML = icon(name); }
  for (const el of $$('.search-icon')) if (!el.innerHTML) el.innerHTML = icon('search');
  renderRail(); renderNotes(); renderDock();
  registerShortcuts();
  for (const m of MODULES) modRecord(m.id);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('load', (ev) => { if (ev.target.tagName === 'IFRAME') hookFrame(ev.target); }, true);
  window.addEventListener('message', onFrameMessage);
  $('#open-palette').onclick = openPalette;
  $('#open-help').onclick = openHelp;
  $('#open-notes').onclick = () => ($('#notes').hidden ? openNotes() : closeOverlays());
  $('#notes-clear').onclick = () => { state.notes = []; state.unread = 0; renderNotes(); };
  $('#toggle-dock').onclick = toggleDock;
  $('#dock-collapse').onclick = toggleDock;
  $('#dock-reload').onclick = () => reloadPreview();
  $('#dock-pop').onclick = popOut;
  $('#dock-back').onclick = () => { state.dockEntry = null; previewShow = null; renderDock(); };
  $('#dock-auto').onchange = (ev) => setAuto(ev.target.checked);
  $('#chip-job').onclick = () => show('jobs', { focus: true });
  $('#chip-dirty').onclick = showGitFiles;
  $('#palette').addEventListener('mousedown', (ev) => { if (ev.target.id === 'palette') closePalette(); });
  for (const o of ['#help', '#docview']) $(o).addEventListener('mousedown', (ev) => { if (ev.target === $(o)) { closeOverlays(); } });
  $('#palette-input').oninput = () => { paletteIndex = 0; renderPalette(); };
  $('#palette-list').addEventListener('mousemove', (ev) => { const li = ev.target.closest('[data-i]'); if (li && Number(li.dataset.i) !== paletteIndex) { paletteIndex = Number(li.dataset.i); $$('#palette-list [aria-selected="true"]').forEach((x) => x.setAttribute('aria-selected', 'false')); li.setAttribute('aria-selected', 'true'); } });
  $('#palette-list').addEventListener('click', (ev) => { const li = ev.target.closest('[data-i]'); if (li) runPalette(Number(li.dataset.i)); });
  initSplitter();
  new ResizeObserver(() => fitDock()).observe($('#dock-stage'));
  window.addEventListener('resize', () => { if (state.dockW > maxDock()) setDockW(maxDock()); layoutThumbs(); });

  try { state.session = await (await fetch('/api/session')).json(); if (!state.session.token) throw Error('no session'); }
  catch {
    $('#main').innerHTML = `<div class="page">${emptyState({ kind: 'is-error', iconName: 'plug', title: 'The Workbench server is not answering', body: 'Start it with <code>node workbench/server.mjs</code> (or Start Workbench.cmd), then reload this page.', actions: '<button class="btn btn-primary" type="button" data-action="reload-page">Reload</button>' })}</div>`;
    return;
  }
  connectEvents();
  const [tools] = await Promise.all([api('tools').catch(() => []), refreshGit(), refreshJobs(), refreshLibrary()]);
  state.tools = tools;
  const deep = parseHash(location.hash);
  if (deep && moduleDef(deep.mod)) openModuleById(deep.mod, deep.params);
  else show(state.view);
  window.addEventListener('hashchange', () => { const d = parseHash(location.hash); if (d && moduleDef(d.mod)) openModuleById(d.mod, d.params); });
  onTools(tools);
  setInterval(refreshGit, 20000);
  setInterval(renderChips, 30000);
}

boot();
