// workbench/modules/motion/index.mjs — Motion Studio: poses, effects, the timeline and the
// animation sets, shown with the game's own presentation model. It replaces Pose Studio,
// the renewal and stances tools and the prologue studio's sequence mode (docs/workbench/CONSOLIDATION.md).
//
// Left: the library (every class, outfit, stance and animation set) with search and filters.
// Centre: the stage, a render page on the game server (render.html), and the transport and
// timeline. Right: the inspector for the open file and the selected effect.
// Narrow (the module under 1100px): the library and inspector are overlays.
// Save goes through the shared file service (/api/files) with a line diff to review.

import { createCanvas } from '../../ui/kit/canvas.mjs';
import { saveFailure } from '../../ui/logic.mjs';
import {
  LIBRARY_KINDS, SPEEDS, FACINGS, SIZES, BACKGROUNDS, REF,
  clampTime, poseIndexAt, poseStart, stepFrame, stepPose, advance, onionNeighbours, poseTicks, clipBar,
  parseMotionLink, libraryEntries, filterLibrary, parsePoseFile, isDirty, isGenerated, GENERATED_NOTE,
  setClipFields, setAnchor, canvasDocOf, applyCanvasDoc, serializePoseFile, addClip, removeClip, bindingRows,
  rebaseOnConflicts, viewOf, selectionGate, isDirtyFile, dirtyPathsOf, keepDrafts, saveChangesOf,
  isMissingOnDisk, forgetDeletedFile, sourceFrameOf, connectPlan, gameStartOf,
} from './model.mjs';

// The painted frames sit on a 640px canvas whose floor is at 600px; the figure is drawn 90% of the stage high.
const FRAME_FLOOR = 600 / 640;
const FIGURE_SCALE = 0.9;
const clone = (v) => JSON.parse(JSON.stringify(v));

const MODULE_SOURCE = 'ashen-motion-module';
const RENDER_SOURCE = 'ashen-motion';
const NARROW_PX = 1100;
const SETS_DIRS = [['pose-studio/renewal', false], ['pose-studio/stances', true]];
const KIND_LABEL = { all: 'All', class: 'Classes', outfit: 'Outfits', stance: 'Stances', animation: 'Animation sets' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMs = (ms) => `${(ms / 1000).toFixed(2)} s`;

/** The class an outfit key belongs to: its prefix when that prefix is itself a key, else the key. */
export function classOfOutfit(key, keys) {
  const i = key.indexOf('-');
  const head = i > 0 ? key.slice(0, i) : key;
  return keys.includes(head) ? head : key;
}

/** The game server's base URL from the Workbench's tools listing, or null when it is down. */
export function gameUrlOf(tools = []) {
  const list = Array.isArray(tools) ? tools : tools?.tools || [];
  const game = list.find((t) => t && t.id === 'game');
  return game && game.status === 'up' && game.url ? String(game.url).replace(/\/?$/, '/') : null;
}

export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/motion/motion.css"><div class="mo">
      <header class="mo-head">
        <div class="mo-title"><h2 class="mo-name">Motion Studio</h2><span class="mo-file"></span><span class="mo-dirty" hidden>Unsaved</span></div>
        <div class="mo-head-actions">
          <button type="button" class="btn btn-sm mo-toggle" data-overlay="lib" aria-expanded="false">Library</button>
          <button type="button" class="btn btn-sm mo-toggle" data-overlay="insp" aria-expanded="false">Inspector</button>
          <button type="button" class="btn btn-sm btn-primary mo-review" disabled>Review and save</button>
        </div>
      </header>
      <div class="mo-body">
        <aside class="mo-lib" aria-label="Library">
          <label class="mo-field">Search<input type="search" class="mo-q" placeholder="Class, outfit, stance or set" autocomplete="off"></label>
          <div class="mo-kinds" role="group" aria-label="Kind">${LIBRARY_KINDS.map((k) => `<button type="button" class="btn btn-sm" data-kind="${k}" aria-pressed="${k === 'all'}">${esc(KIND_LABEL[k])}</button>`).join('')}</div>
          <label class="mo-field">Class<select class="mo-class"><option value="">All classes</option></select></label>
          <p class="mo-count" role="status"></p>
          <ul class="mo-list" aria-label="Library entries"></ul>
        </aside>
        <section class="mo-main" aria-label="Stage">
          <div class="mo-stagebar">
            <div class="mo-seg" role="group" aria-label="Facing">${FACINGS.map((f) => `<button type="button" class="btn btn-sm" data-facing="${f}" aria-pressed="false">Facing ${f}</button>`).join('')}</div>
            <div class="mo-seg" role="group" aria-label="Size">${Object.keys(SIZES).map((s) => `<button type="button" class="btn btn-sm" data-size="${s}" aria-pressed="false">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
            <label class="mo-field mo-inline">Background<select class="mo-bg">${BACKGROUNDS.map((b) => `<option value="${b}">${b[0].toUpperCase() + b.slice(1)}</option>`).join('')}</select></label>
            <label class="mo-check"><input type="checkbox" class="mo-onion-prev"> Onion: previous</label>
            <label class="mo-check"><input type="checkbox" class="mo-onion-next"> Onion: next</label>
            <div class="mo-seg" role="group" aria-label="Mode"><button type="button" class="btn btn-sm" data-mode="stage" aria-pressed="true">Stage</button><button type="button" class="btn btn-sm" data-mode="edit" aria-pressed="false">Edit positions</button></div>
            <label class="mo-check mo-edit-only" hidden><input type="checkbox" class="mo-snap" checked> Snap</label>
            <label class="mo-check mo-edit-only" hidden><input type="checkbox" class="mo-grid"> Grid</label>
          </div>
          <div class="mo-stagewrap">
            <div class="mo-problems mo-banner" role="alert" hidden></div>
            <div class="mo-frame-box"><iframe class="mo-frame" title="Figure rendered by the game"></iframe><p class="mo-setup" hidden></p></div>
            <div class="mo-edit" hidden aria-label="Position editor. Drag anchors and effects; arrow keys nudge."></div>
          </div>
          <div class="mo-transport">
            <button type="button" class="btn btn-sm mo-play">Play</button>
            <button type="button" class="btn btn-sm mo-pprev" title="Previous pose">Previous pose</button>
            <button type="button" class="btn btn-sm mo-fprev" title="Back one frame (1/30 s)">Frame back</button>
            <button type="button" class="btn btn-sm mo-fnext" title="Forward one frame (1/30 s)">Frame forward</button>
            <button type="button" class="btn btn-sm mo-pnext" title="Next pose">Next pose</button>
            <input type="range" class="mo-scrub" min="0" max="1000" step="1" value="0" aria-label="Scrub timeline">
            <span class="mo-time" aria-live="off">0.00 s</span>
            <label class="mo-field mo-inline">Speed<select class="mo-speed">${SPEEDS.map((s) => `<option value="${s}"${s === 1 ? ' selected' : ''}>${s}x</option>`).join('')}</select></label>
            <label class="mo-check"><input type="checkbox" class="mo-loop" checked> Loop</label>
          </div>
          <div class="mo-timeline" aria-label="Timeline">
            <div class="mo-track"><div class="mo-ticks"></div><div class="mo-clips"></div><div class="mo-playhead"></div></div>
          </div>
        </section>
        <aside class="mo-insp" aria-label="Inspector"></aside>
      </div>
      <div class="mo-scrim" hidden></div>
    </div>`;
    const $ = (s) => el.querySelector(s);
    const root = $('.mo'), frame = $('.mo-frame'), setup = $('.mo-setup'), list = $('.mo-list');
    const insp = $('.mo-insp'), track = $('.mo-track'), ticks = $('.mo-ticks'), clipsEl = $('.mo-clips'), playhead = $('.mo-playhead');
    const scrub = $('.mo-scrub'), timeEl = $('.mo-time'), playBtn = $('.mo-play'), loopEl = $('.mo-loop');
    const speedEl = $('.mo-speed'), bgEl = $('.mo-bg'), prevEl = $('.mo-onion-prev'), nextEl = $('.mo-onion-next');
    const classEl = $('.mo-class'), qEl = $('.mo-q'), countEl = $('.mo-count'), fileEl = $('.mo-file'), dirtyEl = $('.mo-dirty');
    const reviewBtn = $('.mo-review'), banner = $('.mo-banner');
    const scrim = $('.mo-scrim'), editEl = $('.mo-edit'), snapEl = $('.mo-snap'), gridEl = $('.mo-grid');
    let canvas = null;

    // ---------- state ----------
    const st = {
      game: { origin: null, base: null, ready: false, serverId: null },
      index: { classes: [], outfits: [], outfitClass: {}, frames: {}, cues: null, effects: [], labels: {} },
      sets: new Map(), // path -> { path, name, actor, poses, duration, stance }
      setsListed: false,
      filter: { q: '', kind: 'all', classId: '' },
      outfit: null,
      file: null, // the open draft: { path, kind, hash, original, project, problems }
      drafts: new Map(), // path -> draft, for each open file that is dirty (and the one open)
      time: 0, playing: false, speed: 1, loop: true, facing: 'right', size: 'medium', background: 'checker',
      onion: { prev: false, next: false },
      selected: null, // { kind: 'clip', id } | { kind: 'anchor', name }
      narrow: false, overlay: null, mode: 'stage',
    };
    let rafId = 0, lastTick = 0, pendingLink = null, mounted = true;

    // ---------- the game server (the render page) ----------
    function setSetup(message) {
      setup.hidden = !message;
      setup.textContent = message || '';
    }
    // Resolves the game server on mount, on show, and on a game start or content reload. The render page
    // loads again only when connectPlan says so. The file, drafts and playhead live in st, so they survive.
    let gameRuns = 0;
    async function connectGame({ force = false } = {}) {
      const run = ++gameRuns;
      let tools = [], base = null;
      try { tools = await ctx.api('tools'); base = gameUrlOf(tools); } catch { base = null; }
      if (run !== gameRuns || !mounted) return; // a later connect has taken over, or the module is gone
      const serverId = gameStartOf(tools);
      const plan = connectPlan({ base, currentOrigin: st.game.origin, ready: st.game.ready, force, serverId, currentServerId: st.game.serverId });
      if (plan === 'keep') return;
      if (plan === 'setup') {
        st.game.ready = false; st.game.origin = null; st.game.serverId = null;
        frame.removeAttribute('src');
        setSetup('The game server is not running. Start it from the Library or Home, then try again.');
        return;
      }
      st.game.base = base;
      st.game.origin = new URL(base).origin;
      st.game.serverId = serverId;
      st.game.ready = false;
      setSetup('Loading the game renderer…');
      frame.src = `${base}workbench/modules/motion/render.html?po=${encodeURIComponent(location.origin)}`;
    }
    function sendToStage(type, payload) {
      if (!st.game.ready || !frame.contentWindow || !st.game.origin) return;
      frame.contentWindow.postMessage({ source: MODULE_SOURCE, type, ...payload }, st.game.origin);
    }
    function sendLoad() {
      sendToStage('load', { project: st.file?.project || null, outfit: st.outfit || null });
    }
    function sendView() {
      const { prev, next } = onionIndexes();
      sendToStage('set', { state: { time: st.time, facing: st.facing, background: st.background, onion: { prev, next } } });
    }
    function onionIndexes() {
      const p = viewProject();
      if (!p) return { prev: null, next: null };
      const n = onionNeighbours(p.poses.length, p.duration, st.time);
      return { prev: st.onion.prev ? n.prev : null, next: st.onion.next ? n.next : null };
    }
    function onMessage(ev) {
      if (ev.origin !== st.game.origin || !frame.contentWindow || ev.source !== frame.contentWindow) return;
      const d = ev.data;
      if (!d || d.source !== RENDER_SOURCE) return;
      if (d.type === 'ready') {
        st.game.ready = true;
        setSetup('');
        sendLoad();
        sendView();
      } else if (d.type === 'index') {
        applyIndex(d);
      } else if (d.type === 'error') {
        setSetup(`The game renderer could not draw this file: ${d.message}`);
      } else if (d.type === 'shown') {
        setSetup('');
      }
    }
    function applyIndex(d) {
      const keys = Array.isArray(d.outfits) ? d.outfits : [];
      st.index.outfits = keys;
      st.index.outfitClass = Object.fromEntries(keys.map((k) => [k, classOfOutfit(k, keys)]));
      st.index.classes = keys.filter((k) => st.index.outfitClass[k] === k);
      st.index.frames = d.frames || {};
      st.index.cues = d.cues || null;
      st.index.effects = Array.isArray(d.effects) ? d.effects : [];
      st.index.labels = d.effectLabels || {};
      classEl.innerHTML = '<option value="">All classes</option>' + st.index.classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      classEl.value = st.filter.classId;
      renderLibrary();
      renderTimeline();
      renderInspector();
    }

    // ---------- the library ----------
    function entries() {
      return libraryEntries({
        classes: st.index.classes.map((id) => ({ id, label: id })),
        outfits: st.index.outfits.filter((k) => st.index.outfitClass[k] !== k).map((id) => ({ id, classId: st.index.outfitClass[id] })),
        sets: [...st.sets.values()],
      });
    }
    function renderLibrary() {
      const all = entries();
      const shown = filterLibrary(all, st.filter);
      countEl.textContent = `${shown.length} of ${all.length}${st.setsListed ? '' : ' (animation sets still loading)'}`;
      const dirty = new Set(dirtyPathsOf(st.drafts));
      list.innerHTML = shown.map((e) => {
        const current = (e.kind === 'outfit' && st.outfit === e.id) || ((e.kind === 'animation' || e.kind === 'stance') && st.file?.path === e.id);
        return `<li><button type="button" class="mo-item" data-kind="${e.kind}" data-id="${esc(e.id)}" aria-current="${current ? 'true' : 'false'}"><span class="mo-item-label">${esc(e.label)}</span>${dirty.has(e.id) ? '<span class="mo-item-dirty">Unsaved</span>' : ''}<span class="mo-item-sub">${esc(e.sub)}</span></button></li>`;
      }).join('') || '<li class="mo-empty">Nothing matches. Clear the search or the filters.</li>';
      el.querySelectorAll('.mo-kinds [data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === st.filter.kind)));
    }
    function pickEntry(kind, id) {
      if (kind === 'class') { st.filter.classId = id; classEl.value = id; st.outfit = id; }
      else if (kind === 'outfit') { st.outfit = id; st.filter.classId = st.index.outfitClass[id] || ''; classEl.value = st.filter.classId; }
      else if (kind === 'animation' || kind === 'stance') {
        const s = st.sets.get(id);
        if (s?.actor) { st.filter.classId = s.actor; classEl.value = s.actor; if (st.index.outfits.includes(s.actor)) st.outfit = s.actor; }
        openFile(id);
        return;
      }
      sendLoad();
      renderLibrary();
      renderInspector();
    }

    // ---------- files ----------
    async function listSets() {
      const found = [];
      for (const [dir, stance] of SETS_DIRS) {
        try {
          const out = await ctx.api(`files/list?dir=${encodeURIComponent(dir)}&ext=.json`);
          for (const path of out.files || []) if (/\.pose\.json$/.test(path)) found.push({ path, stance });
        } catch { /* a checkout without the folder shows fewer sets */ }
      }
      for (const { path, stance } of found) {
        if (!st.sets.has(path)) st.sets.set(path, { path, name: path.split('/').pop().replace(/\.pose\.json$/, ''), actor: null, poses: null, duration: null, stance });
      }
      st.setsListed = true;
      renderLibrary();
      // Read each set once for its name, class and pose count; the list fills in as they arrive.
      for (const { path } of found) {
        if (!mounted) return;
        try {
          const r = await ctx.api(`files/read?path=${encodeURIComponent(path)}`);
          const p = parsePoseFile(r.text).project;
          if (p) Object.assign(st.sets.get(path), { name: p.name || path, actor: p.actor || null, poses: Array.isArray(p.poses) ? p.poses.length : null, duration: p.duration ?? null });
        } catch { /* unreadable sets stay listed by file name */ }
        renderLibrary();
      }
    }
    // Each pick takes a generation; a read that a newer pick overtook is dropped, so it cannot install over that pick.
    const selection = selectionGate();
    /** Resolves 'deleted' when the file is gone from disk (its read was a 404), otherwise nothing. */
    async function openFile(path) {
      const gen = selection.begin();
      // A file with unsaved edits comes back as it was left: its draft, not a second read of the disk.
      const held = st.drafts.get(path);
      if (isDirtyFile(held)) { showFile(held, false); return; }
      let r;
      try { r = await ctx.api(`files/read?path=${encodeURIComponent(path)}`); } catch (err) {
        if (isMissingOnDisk(err)) { forgetDeleted(path); return 'deleted'; }
        if (selection.current(gen)) ctx.toast({ kind: 'error', title: `Could not open ${path}`, detail: err.message, record: false });
        return;
      }
      if (!selection.current(gen)) return;
      const parsed = parsePoseFile(r.text);
      showFile({ path, kind: r.kind, hash: r.hash, original: r.text, project: parsed.project, problems: parsed.problems }, true);
    }
    /**
     * A pose file deleted on disk: its draft, its library entry and, when it was open, the open
     * file, its history and its stage go (the stage shows nothing). The user is told once.
     */
    function forgetDeleted(path) {
      const next = forgetDeletedFile({ file: st.file, drafts: st.drafts, sets: st.sets, selected: st.selected }, path);
      st.file = next.file; st.drafts = next.drafts; st.sets = next.sets; st.selected = next.selected;
      if (next.closed) {
        st.time = 0;
        st.playing = false;
        ctx.history.clear();
        fileEl.textContent = '';
        sendLoad();
      }
      renderAll();
      ctx.toast({ kind: 'warn', title: `${path} was deleted on disk`, detail: 'Its edits to that file were dropped.' });
    }
    /**
     * Makes a draft the open file. Dirty drafts of the other files stay; clean ones go. Undo steps
     * belong to one file, so they are cleared on a switch.
     */
    function showFile(rec, fresh) {
      st.drafts = keepDrafts(st.drafts, rec.path);
      st.drafts.set(rec.path, rec);
      st.file = rec;
      keepConflicts = null;
      conflictList = [];
      st.time = 0;
      st.selected = null;
      st.playing = false;
      ctx.history.clear();
      if (fresh && rec.project?.actor && st.index.outfits.includes(rec.project.actor) && !st.outfit) st.outfit = rec.project.actor;
      fileEl.textContent = rec.path;
      sendLoad();
      renderAll();
      if (pendingLink?.frame != null) { applyFrame(pendingLink.frame); }
    }
    function applyFrame(index) {
      const p = viewProject();
      if (!p) return;
      st.time = poseStart(p.poses.length, p.duration, index);
      pendingLink = pendingLink && { ...pendingLink, frame: null };
      renderAll();
    }

    // ---------- transport and timeline ----------
    function duration() { return st.file?.project?.duration || 0; }
    /** What the stage and inspector draw: the open project with its lists filled in. Never saved. */
    function viewProject() { return st.file ? viewOf(st.file.project) : null; }
    /** The problems parsePoseFile found, always on the stage (the inspector may be closed). */
    function renderBanner() {
      const problems = st.file?.problems || [];
      banner.hidden = !problems.length;
      banner.innerHTML = problems.length ? `<p>This file does not match the game format:</p><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    }
    function seek(t) {
      st.time = clampTime(t, duration());
      renderTransport();
      sendView();
    }
    function renderTransport() {
      const p = viewProject();
      const d = duration();
      scrub.max = String(d || 1000);
      scrub.value = String(Math.round(st.time));
      scrub.disabled = !p;
      timeEl.textContent = p ? `${fmtMs(st.time)} / ${fmtMs(d)} · pose ${poseIndexAt(p.poses.length, d, st.time) + 1} of ${p.poses.length}` : 'No file open';
      playBtn.textContent = st.playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', String(st.playing));
      playhead.style.left = d ? `${(st.time / d) * 100}%` : '0';
      speedEl.value = String(st.speed);
      loopEl.checked = st.loop;
      bgEl.value = st.background;
      prevEl.checked = st.onion.prev;
      nextEl.checked = st.onion.next;
      el.querySelectorAll('[data-facing]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.facing === st.facing)));
      el.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === st.size)));
      frame.parentElement.style.setProperty('--mo-scale', String(SIZES[st.size]));
      root.classList.toggle('is-empty', !p);
      el.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
      el.querySelectorAll('.mo-edit-only').forEach((x) => { x.hidden = st.mode !== 'edit'; });
      el.querySelector('.mo-frame-box').hidden = st.mode === 'edit';
      editEl.hidden = st.mode !== 'edit';
    }
    function renderTimeline() {
      const p = viewProject();
      const d = duration();
      if (!p) { ticks.innerHTML = ''; clipsEl.innerHTML = ''; return; }
      ticks.innerHTML = poseTicks(p.poses.length, d).map((t) => `<button type="button" class="mo-tick" style="left:${t.at * 100}%" data-pose="${t.index}" title="Pose ${t.index + 1}: ${esc(p.poses[t.index])}" aria-label="Pose ${t.index + 1}, ${esc(p.poses[t.index])}"><span>${esc(p.poses[t.index])}</span></button>`).join('');
      clipsEl.innerHTML = p.clips.map((c) => {
        const bar = clipBar(c, d, st.index.cues || {});
        const sel = st.selected?.kind === 'clip' && st.selected.id === c.id;
        return `<button type="button" class="mo-clip${sel ? ' is-selected' : ''}${c.muted ? ' is-muted' : ''}" data-clip="${esc(c.id)}" style="left:${bar.left * 100}%;width:${bar.width * 100}%" title="${esc(c.effect)} · ${esc(c.cue)} ${c.offset >= 0 ? '+' : ''}${c.offset} ms" aria-pressed="${sel}"><span>${esc(c.effect)}</span></button>`;
      }).join('') || '';
    }
    function renderInspector() {
      const p = viewProject();
      const cls = st.filter.classId || p?.actor || '';
      const outfitKey = st.outfit || cls;
      const frames = st.index.frames[outfitKey] || st.index.frames[cls] || {};
      const pose = p ? p.poses[poseIndexAt(p.poses.length, p.duration, st.time)] : null;
      const source = p ? sourceFrameOf({ project: p, pose, frames }) : null;
      const problems = st.file?.problems || [];
      const sel = st.selected;
      const clip = sel?.kind === 'clip' ? p?.clips.find((c) => c.id === sel.id) : null;
      insp.innerHTML = `
        <h2 class="mo-insp-title">${p ? esc(p.name || st.file.path) : 'Pick a file'}</h2>
        ${p ? `<dl class="mo-meta">
          <dt>Class</dt><dd>${esc(p.actor)}</dd>
          <dt>Outfit</dt><dd>${esc(outfitKey || '—')}</dd>
          <dt>Duration</dt><dd>${fmtMs(p.duration)}</dd>
          <dt>Poses</dt><dd>${p.poses.map((x, i) => `<span class="mo-chip${i === poseIndexAt(p.poses.length, p.duration, st.time) ? ' is-on' : ''}">${i + 1}. ${esc(x)}</span>`).join(' ')}</dd>
          <dt>Effects</dt><dd>${p.clips.length} · bindings ${p.bindings.length}</dd>
          <dt>Source</dt><dd><code>${esc(st.file.path)}</code></dd>
        </dl>` : '<p class="mo-note">Choose an animation set, stance or outfit in the library. Stances and sets open here; an outfit alone shows its painted frames.</p>'}
        ${p && isGenerated(st.file.path) ? `<p class="mo-note mo-generated">${esc(GENERATED_NOTE)}</p>` : ''}
        ${problems.length ? `<div class="mo-problems"><p>This file does not match the game format:</p><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${clip ? clipInspector(clip) : ''}
        ${p ? anchorInspector(p) : ''}
        ${p ? effectsInspector() : ''}
        ${p ? bindingsInspector(p) : ''}
        <h3>Links</h3>
        <div class="mo-links">
          ${cls ? `<button type="button" class="btn btn-sm mo-x-entities" data-class="${esc(cls)}">Open in Entity Browser</button>` : ''}
          ${p ? (source.file
            ? `<button type="button" class="btn btn-sm mo-x-assets" data-path="${esc(source.file)}">Open source frames in Asset Gallery</button>`
            : `<button type="button" class="btn btn-sm mo-x-assets" disabled title="${esc(source.reason)}">Open source frames in Asset Gallery</button>`) : ''}
        </div>`;
      insp.querySelector('.mo-x-entities')?.addEventListener('click', (e) => ctx.openModule('entities', { kind: 'classes', id: e.currentTarget.dataset.class }));
      insp.querySelector('.mo-x-assets')?.addEventListener('click', (e) => ctx.openModule('assets', { path: e.currentTarget.dataset.path }));
    }
    const num = (v) => (Number.isFinite(v) ? v : 0);
    /** Generated files show their values but take no input: the attribute disables every control. */
    const lockAttr = () => (isGenerated(st.file?.path) ? ' disabled' : '');
    const field = (label, key, value, attrs = '') => `<label class="mo-field">${esc(label)}<input type="number" step="1" data-clip-field="${key}" value="${num(value)}" ${attrs}${lockAttr()}></label>`;
    function clipInspector(c) {
      return `<h3>Effect · ${esc(c.effect)}</h3>
        <div class="mo-fields" data-clip="${esc(c.id)}">
          <p class="mo-note">Cue ${esc(c.cue)}, ${c.offset >= 0 ? '+' : ''}${c.offset} ms, anchor ${esc(c.anchor)}.</p>
          ${field('Offset (ms)', 'offset', c.offset)}
          ${field('Duration (ms)', 'duration', c.duration, 'min="60" max="30000"')}
          ${field('X (px)', 'x', c.x)}
          ${field('Y (px)', 'y', c.y)}
          ${field('Size', 'size', c.size, 'min="20" max="800"')}
          ${field('Rotation (deg)', 'rotation', c.rotation)}
          <label class="mo-field">Opacity<input type="number" step="0.05" min="0" max="1" data-clip-field="opacity" value="${num(c.opacity)}"${lockAttr()}></label>
          <label class="mo-field">Layer<select data-clip-field="layer"${lockAttr()}>${['front', 'behind', 'aura'].map((l) => `<option value="${l}"${l === c.layer ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="mo-check"><input type="checkbox" data-clip-field="travel"${c.travel ? ' checked' : ''}${lockAttr()}> Travels to target</label>
          <label class="mo-check"><input type="checkbox" data-clip-field="muted"${c.muted ? ' checked' : ''}${lockAttr()}> Muted</label>
          <p><button type="button" class="btn btn-sm" data-remove-clip="${esc(c.id)}"${lockAttr()}>Remove effect</button></p>
        </div>`;
    }
    function effectsInspector() {
      const effects = st.index.effects || [];
      return `<h3>Add effect</h3><div class="mo-add">
        <label class="mo-field">Effect<select class="mo-effect-pick"${lockAttr()}>${effects.map((e) => `<option value="${esc(e)}">${esc(st.index.labels[e] || e)}</option>`).join('')}</select></label>
        <button type="button" class="btn btn-sm" data-add-effect${effects.length && !lockAttr() ? '' : ' disabled'}>Add on the contact cue</button>
      </div>`;
    }
    function bindingsInspector(p) {
      const rows = bindingRows(p);
      return `<h3>Bindings</h3>${rows.length ? `<ul class="mo-bindings">${rows.map((b) => `<li><strong>${esc(b.name)}</strong> <span class="mo-note">${esc(b.provider)} · ${esc(b.kind)}${b.objectId ? ` ${esc(b.objectId)}` : ''} · ${esc(b.event)} · priority ${b.priority}${b.enabled ? '' : ' · disabled'}</span>${b.tags.length ? `<div class="mo-chips">${b.tags.map((t) => `<span class="mo-chip">${esc(t)}</span>`).join(' ')}</div>` : ''}</li>`).join('')}</ul>` : '<p class="mo-note">No bindings. Binding a card or object to this animation is set in the Connect tab of the game build, not here yet.</p>'}`;
    }
    function onInspClick(e) {
      const p = st.file?.project;
      if (!p) return;
      const add = e.target.closest('[data-add-effect]');
      if (add) {
        const effect = insp.querySelector('.mo-effect-pick')?.value;
        if (!effect) return;
        const made = addClip(p, effect);
        commitProject(made.project, `Add ${effect}`);
        st.selected = { kind: 'clip', id: made.id };
        renderTimeline();
        renderInspector();
        return;
      }
      const rm = e.target.closest('[data-remove-clip]');
      if (rm) {
        commitProject(removeClip(p, rm.dataset.removeClip), 'Remove effect');
        st.selected = null;
        renderTimeline();
        renderInspector();
      }
    }
    insp.addEventListener('click', onInspClick);
    function anchorInspector(p) {
      return `<h3>Anchors</h3><div class="mo-fields">${Object.entries(p.anchors).map(([k, v]) => `<fieldset class="mo-anchor" data-anchor="${esc(k)}"><legend>${esc(k)}</legend>
        <label class="mo-field">X<input type="number" step="0.001" min="0" max="1" data-axis="0" value="${num(v[0])}"${lockAttr()}></label>
        <label class="mo-field">Y<input type="number" step="0.001" min="0" max="1" data-axis="1" value="${num(v[1])}"${lockAttr()}></label></fieldset>`).join('')}</div>`;
    }

    // ---------- edits: one History step per change, through the host's undo ----------
    /** Sets the open file's draft, redraws the stage and inspector. */
    function setProject(next) { st.file.project = next; sendLoad(); renderAll(); }
    function commitProject(next, label) {
      const before = st.file?.project;
      if (!before || isGenerated(st.file.path) || JSON.stringify(before) === JSON.stringify(next)) return;
      const undo = clone(before), redo = clone(next);
      ctx.history.pushChange({ label, undo, redo }, (snap) => { if (st.file) setProject(clone(snap)); });
      setProject(redo);
    }
    function onInspChange(e) {
      const p = st.file?.project;
      if (!p) return;
      const anchor = e.target.closest('.mo-anchor');
      if (anchor) {
        const name = anchor.dataset.anchor;
        const xy = [...p.anchors[name]];
        const axis = Number(e.target.dataset.axis);
        xy[axis] = Number(e.target.value);
        if (!Number.isFinite(xy[axis])) return;
        commitProject(setAnchor(p, name, xy), `Move ${name} anchor`);
        return;
      }
      const key = e.target.dataset.clipField;
      const fields = e.target.closest('.mo-fields[data-clip]');
      if (!key || !fields) return;
      const id = fields.dataset.clip;
      const raw = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      if (typeof raw === 'number' && !Number.isFinite(raw)) return;
      commitProject(setClipFields(p, id, { [key]: raw }), `Set ${key}`);
    }
    insp.addEventListener('change', onInspChange);

    // ---------- the position editor (canvas kit) ----------
    /** The figure as the stage draws it, so the handles sit over it. Locked: it is the reference, not an edit. */
    function editDoc() {
      const p = viewProject();
      const doc = canvasDocOf(p);
      // A generated file's handles show where the anchors and effects sit but cannot be dragged.
      if (isGenerated(st.file.path)) for (const item of doc.items) item.locked = true;
      const pose = p.poses[poseIndexAt(p.poses.length, p.duration, st.time)];
      const side = Math.round(REF.height * FIGURE_SCALE);
      const feet = (p.anchors.feet?.[1] ?? 0.85) * REF.height;
      const torso = (p.anchors.torso?.[0] ?? 0.3) * REF.width;
      const src = p.assets?.[`pose:${pose}`] || frameUrl(pose);
      doc.items.unshift({ id: 'figure', x: torso - side / 2, y: feet - side * FRAME_FLOOR, w: side, h: side, z: 0, locked: true, label: pose, data: { kind: 'figure', src } });
      return doc;
    }
    function frameUrl(pose) {
      const cls = st.filter.classId || st.file?.project?.actor || '';
      const file = (st.index.frames[st.outfit || cls] || st.index.frames[cls] || {})[pose];
      // A page can redirect art URLs (see assetUrl in modules/assets/model.mjs); the default is unchanged.
      if (!file) return null;
      return typeof globalThis.ASHEN_ASSET_URL === 'function' ? globalThis.ASHEN_ASSET_URL(file) : `/asset-file/${file}`;
    }
    function ensureCanvas() {
      if (canvas) return canvas;
      canvas = createCanvas(editEl, {
        doc: { width: REF.width, height: REF.height, items: [] },
        snap: snapEl.checked,
        grid: { size: 10, show: gridEl.checked },
        rulers: true,
        onChange: (doc, change) => { if (st.file) commitProject(applyCanvasDoc(st.file.project, doc), change?.label || 'Move'); },
        onSelect: (ids) => {
          const id = ids[0] || '';
          st.selected = id.startsWith('anchor:') ? { kind: 'anchor', name: id.slice(7) } : id.startsWith('clip:') ? { kind: 'clip', id: id.slice(5) } : null;
          renderTimeline();
          renderInspector();
        },
        renderItem: (node, item) => {
          if (item.data?.kind !== 'figure') return;
          node.replaceChildren();
          if (!item.data.src) return;
          const img = document.createElement('img');
          img.alt = '';
          img.src = item.data.src;
          img.draggable = false;
          img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;opacity:0.9';
          node.append(img);
        },
      });
      // Fit the page to the editor (and again when the module resizes), so the whole figure shows.
      const fit = () => { if (canvas && editEl.clientWidth) canvas.fit(); };
      new ResizeObserver(fit).observe(editEl);
      requestAnimationFrame(fit);
      return canvas;
    }
    function syncCanvas() {
      if (st.mode !== 'edit' || !st.file) return;
      ensureCanvas().setDoc(editDoc());
    }
    function setMode(mode) {
      st.mode = mode;
      if (mode === 'edit') { setPlaying(false); syncCanvas(); }
      renderTransport();
    }
    el.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    snapEl.addEventListener('change', () => canvas?.setSnap(snapEl.checked));
    gridEl.addEventListener('change', () => canvas?.setGrid(gridEl.checked));

    function renderAll() {
      renderLibrary();
      renderBanner();
      renderTransport();
      renderTimeline();
      renderInspector();
      if (st.mode === 'edit') syncCanvas();
      renderDirty();
      sendView();
    }

    // ---------- review and save: the shared file service (/api/files), the same path as Layout Studio ----------
    const dlg = document.createElement('dialog');
    dlg.className = 'mo-dlg';
    dlg.innerHTML = '<div class="mo-dlg-head"><h2>Review changes</h2><button type="button" class="btn btn-sm" data-dlg="close">Close</button></div><div class="mo-dlg-body"></div>';
    root.append(dlg);
    const dlgBody = () => dlg.querySelector('.mo-dlg-body');
    dlg.addEventListener('click', onDlgClick);
    dlg.addEventListener('close', () => { dlgBody().innerHTML = ''; });
    reviewBtn.addEventListener('click', () => openReview());
    let saving = false;
    // The 409 files of the last save, and the disk hashes "Keep my version" saves them against.
    let conflictList = [], keepConflicts = null;
    /** Every draft whose project differs from the bytes read: the same text a save would write, for each file. */
    function dirtyChanges() {
      return saveChangesOf([...st.drafts.values()].filter((f) => !isGenerated(f.path)), keepConflicts || []);
    }
    function renderDirty() {
      const dirty = dirtyChanges().length > 0;
      dirtyEl.hidden = !dirty;
      reviewBtn.disabled = !dirty;
    }
    function hunksHtml(d) {
      if (!d.hunks || !d.hunks.length) return '<p class="mo-note">No line changes.</p>';
      return d.hunks.map((h) => `<div class="mo-hunk"><div class="mo-hunk-head">@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@</div>${h.lines.map((l) => `<div class="mo-ln ${l.op === '+' ? 'is-add' : l.op === '-' ? 'is-del' : ''}"><span class="mo-op">${esc(l.op)}</span>${esc(l.text)}</div>`).join('')}</div>`).join('');
    }
    async function openReview(notice = '') {
      const changes = dirtyChanges();
      if (!changes.length) { ctx.toast({ kind: 'info', title: 'Nothing to save', record: false }); return; }
      if (!dlg.open) dlg.showModal();
      dlgBody().innerHTML = `${notice}<p class="mo-note">Building the diff…</p>`;
      let diffs;
      try {
        diffs = await Promise.all(changes.map((c) => ctx.api('files/diff', { path: c.path, text: c.text })));
      } catch (err) {
        dlgBody().innerHTML = `${notice}<p class="mo-problems">Could not build the diff: ${esc(err.message)}</p>`;
        return;
      }
      dlgBody().innerHTML = notice + diffs.map((d) => `<section class="mo-dfile"><h3>${esc(d.path)} <span class="mo-stat">+${d.added} −${d.removed}</span></h3>${hunksHtml(d)}</section>`).join('')
        + `<div class="mo-dlg-actions"><button type="button" class="btn btn-sm" data-dlg="close">Cancel</button><button type="button" class="btn btn-sm btn-primary" data-dlg="save"${saving ? ' disabled' : ''}>Save ${changes.length} file(s)</button></div>`;
    }
    async function save() {
      const changes = dirtyChanges();
      if (!changes.length || saving) return;
      saving = true;
      let data;
      try {
        data = await ctx.api('files/save', { changes });
      } catch (err) {
        saving = false;
        const failure = saveFailure(err);
        if (failure.kind === 'problems') {
          const list = failure.problems.map((p) => `<li><code>${esc(p.path)}</code> ${esc(p.message)}</li>`).join('');
          await openReview(`<div class="mo-problems"><p><strong>Nothing saved.</strong> The checks found problems:</p><ul>${list}</ul></div>`);
        } else if (failure.kind === 'conflicts') {
          conflictList = failure.conflicts;
          await openReview('<div class="mo-problems is-conflict"><p><strong>Changed on disk since it was opened.</strong></p><p class="mo-note">Reload drops your edits to this file. Keep my version overwrites the change made on disk.</p><p><button type="button" class="btn btn-sm" data-dlg="reload">Reload from disk</button> <button type="button" class="btn btn-sm" data-dlg="keep">Keep my version</button></p></div>');
        } else {
          await openReview(`<div class="mo-problems"><p><strong>Not saved:</strong> ${esc(failure.message)}. Your edits are still here; try again.</p></div>`);
        }
        return;
      }
      saving = false;
      keepConflicts = null;
      conflictList = [];
      const sent = new Map(changes.map((c) => [c.path, c.text]));
      // Each saved draft now matches its file on disk: its bytes and hash become the new base.
      for (const saved of data.files || []) {
        const draft = st.drafts.get(saved.path);
        if (draft) { draft.original = sent.get(saved.path); draft.hash = saved.hash; }
      }
      dlg.close();
      renderAll();
      ctx.toast({ kind: 'success', title: `Saved ${(data.files || []).length} file(s)`, detail: data.backup ? `Backup ${data.backup}` : '', record: false });
    }
    async function onDlgClick(e) {
      const btn = e.target.closest('[data-dlg]');
      if (!btn || !st.file) return;
      const act = btn.dataset.dlg;
      if (act === 'close') { dlg.close(); return; }
      if (act === 'save') { await save(); return; }
      if (act === 'reload') {
        // The conflicting files' drafts go, so each reads the disk copy; the open file is read again if it conflicted.
        const path = st.file.path;
        const changed = conflictList.map((c) => c.path);
        dlg.close();
        for (const p of changed) st.drafts.delete(p);
        keepConflicts = null;
        conflictList = [];
        const gone = changed.includes(path) ? await openFile(path) : null;
        if (gone === 'deleted') return;
        renderAll();
        ctx.toast({ kind: 'warn', title: 'Reloaded from disk', detail: 'Your edits to the changed files were dropped.', record: false });
        return;
      }
      if (act === 'keep') {
        // The 409 already reports each file's hash on disk (null when deleted): save against those.
        keepConflicts = conflictList;
        await openReview();
      }
    }
    ctx.shortcuts.register('Mod+S', 'Review and save motion changes', () => { if (!dirtyChanges().length) return false; openReview(); return undefined; }, { inInput: true });

    function tick(now) {
      rafId = 0;
      if (!st.playing || !mounted) return;
      const dt = lastTick ? now - lastTick : 0;
      lastTick = now;
      const adv = advance(st.time, dt, { duration: duration(), speed: st.speed, loop: st.loop });
      st.time = adv.time;
      if (adv.ended) st.playing = false;
      renderTransport();
      sendView();
      if (st.playing) rafId = requestAnimationFrame(tick);
    }
    function setPlaying(on) {
      if (on && !st.file) return;
      st.playing = on;
      lastTick = 0;
      if (on && !rafId) rafId = requestAnimationFrame(tick);
      renderTransport();
    }

    // ---------- overlays below 1100px ----------
    function setOverlay(name) {
      st.overlay = st.overlay === name ? null : name;
      root.classList.toggle('lib-open', st.overlay === 'lib');
      root.classList.toggle('insp-open', st.overlay === 'insp');
      scrim.hidden = !st.overlay;
      el.querySelectorAll('.mo-toggle').forEach((b) => b.setAttribute('aria-expanded', String(b.dataset.overlay === st.overlay)));
    }
    const resizer = typeof ResizeObserver === 'function' ? new ResizeObserver((entries0) => {
      const w = entries0[0]?.contentRect?.width ?? el.clientWidth;
      st.narrow = w < NARROW_PX;
      root.classList.toggle('is-narrow', st.narrow);
      if (!st.narrow && st.overlay) setOverlay(st.overlay);
    }) : null;
    resizer?.observe(root);

    // ---------- events ----------
    el.querySelectorAll('.mo-kinds [data-kind]').forEach((b) => b.addEventListener('click', () => { st.filter.kind = b.dataset.kind; renderLibrary(); }));
    qEl.addEventListener('input', () => { st.filter.q = qEl.value; renderLibrary(); });
    classEl.addEventListener('change', () => { st.filter.classId = classEl.value; renderLibrary(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('.mo-item');
      if (b) { pickEntry(b.dataset.kind, b.dataset.id); if (st.narrow) setOverlay(null); }
    });
    el.querySelectorAll('[data-facing]').forEach((b) => b.addEventListener('click', () => { st.facing = b.dataset.facing; renderTransport(); sendView(); }));
    el.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => { st.size = b.dataset.size; renderTransport(); }));
    bgEl.addEventListener('change', () => { st.background = bgEl.value; sendView(); });
    prevEl.addEventListener('change', () => { st.onion.prev = prevEl.checked; sendView(); });
    nextEl.addEventListener('change', () => { st.onion.next = nextEl.checked; sendView(); });
    speedEl.addEventListener('change', () => { st.speed = Number(speedEl.value) || 1; renderTransport(); });
    loopEl.addEventListener('change', () => { st.loop = loopEl.checked; });
    playBtn.addEventListener('click', () => setPlaying(!st.playing));
    scrub.addEventListener('input', () => { setPlaying(false); seek(Number(scrub.value)); });
    const poseCount = () => viewProject()?.poses.length || 0;
    $('.mo-pprev').addEventListener('click', () => { setPlaying(false); seek(stepPose(poseCount(), duration(), st.time, -1)); });
    $('.mo-pnext').addEventListener('click', () => { setPlaying(false); seek(stepPose(poseCount(), duration(), st.time, 1)); });
    $('.mo-fprev').addEventListener('click', () => { setPlaying(false); seek(stepFrame(st.time, -1, duration())); });
    $('.mo-fnext').addEventListener('click', () => { setPlaying(false); seek(stepFrame(st.time, 1, duration())); });
    ticks.addEventListener('click', (e) => {
      const b = e.target.closest('.mo-tick');
      if (!b) return;
      setPlaying(false);
      seek(poseStart(st.file.project.poses.length, duration(), Number(b.dataset.pose)));
    });
    track.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.mo-clip,.mo-tick') || !st.file) return;
      const r = track.getBoundingClientRect();
      setPlaying(false);
      seek(((e.clientX - r.left) / r.width) * duration());
    });
    clipsEl.addEventListener('click', (e) => {
      const b = e.target.closest('.mo-clip');
      if (!b) return;
      st.selected = { kind: 'clip', id: b.dataset.clip };
      renderTimeline();
      renderInspector();
    });
    el.querySelectorAll('.mo-toggle').forEach((b) => b.addEventListener('click', () => setOverlay(b.dataset.overlay)));
    scrim.addEventListener('click', () => setOverlay(null));
    root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && st.overlay) setOverlay(null); });

    window.addEventListener('message', onMessage);
    ctx.shortcuts.register('Space', 'Play or pause the timeline', () => { if (!st.file) return false; setPlaying(!st.playing); }, {});
    ctx.shortcuts.register(',', 'Back one frame', () => { if (!st.file) return false; setPlaying(false); seek(stepFrame(st.time, -1, duration())); return undefined; }, {});
    ctx.shortcuts.register('.', 'Forward one frame', () => { if (!st.file) return false; setPlaying(false); seek(stepFrame(st.time, 1, duration())); return undefined; }, {});

    // ---------- start ----------
    connectGame();
    // The content was rebuilt (a forced reload), or the game server came up or restarted (the plan decides).
    const offReload = ctx.onReload((ev) => connectGame({ force: ev?.kind === 'reload' }));
    listSets();
    renderAll();
    renderLibrary();

    function applyLink(link) {
      if (!link) return;
      if (link.class) { st.filter.classId = link.class; classEl.value = link.class; }
      if (link.outfit) st.outfit = link.outfit;
      pendingLink = { ...link };
      if (link.anim) {
        pendingLink.frame = link.frame;
        openFile(link.anim);
        return;
      }
      sendLoad();
      if (link.frame != null) applyFrame(link.frame);
      renderAll();
    }

    return {
      onShow() {
        // The game may have stopped, restarted or moved while the module was away: resolve it again.
        connectGame();
        // A fresh params object is a new visit: its link applies once, a plain return keeps the state.
        const p = ctx.params;
        if (p && Object.keys(p).length && p !== st.seenParams) {
          st.seenParams = p;
          applyLink(parseMotionLink(p));
        }
        renderLibrary();
      },
      onHide() {
        setPlaying(false);
      },
      unmount() {
        mounted = false;
        offReload();
        window.removeEventListener('message', onMessage);
        resizer?.disconnect();
        cancelAnimationFrame(rafId);
      },
      commands: () => [
        { title: 'Motion: play or pause', sub: 'Space', run: () => setPlaying(!st.playing) },
        ...LIBRARY_KINDS.filter((k) => k !== 'all').map((k) => ({ title: `Motion: show ${KIND_LABEL[k].toLowerCase()}`, sub: 'Motion Studio', run: () => { st.filter.kind = k; renderLibrary(); } })),
      ],
    };
  },
};
