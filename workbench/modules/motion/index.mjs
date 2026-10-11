// workbench/modules/motion/index.mjs — Motion Studio: poses, effects, the timeline and the
// animation sets, shown with the game's own presentation model. It replaces Pose Studio,
// the renewal and stances tools and the prologue studio's sequence mode (docs/workbench/CONSOLIDATION.md).
//
// Left: the library (every class, outfit, stance and animation set) with search and filters.
// Centre: the stage, a render page on the game server (render.html), and the transport and
// timeline. Right: the inspector for the open file and the selected effect.
// Narrow (the module under 1100px): the library and inspector are overlays.
// Save goes through the shared file service (/api/files) with a line diff to review.

import {
  LIBRARY_KINDS, SPEEDS, FACINGS, SIZES, BACKGROUNDS,
  clampTime, poseIndexAt, poseStart, stepFrame, stepPose, advance, onionNeighbours, poseTicks, clipBar,
  parseMotionLink, libraryEntries, filterLibrary, parsePoseFile, isDirty,
} from './model.mjs';

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
          <button type="button" class="btn btn-sm mo-undo" disabled>Undo</button>
          <button type="button" class="btn btn-sm mo-redo" disabled>Redo</button>
          <button type="button" class="btn btn-sm mo-toggle" data-overlay="insp" aria-expanded="false">Inspector</button>
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
          </div>
          <div class="mo-stagewrap">
            <div class="mo-frame-box"><iframe class="mo-frame" title="Figure rendered by the game"></iframe><p class="mo-setup" hidden></p></div>
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
    const undoBtn = $('.mo-undo'), redoBtn = $('.mo-redo'), scrim = $('.mo-scrim');

    // ---------- state ----------
    const st = {
      game: { origin: null, base: null, ready: false },
      index: { classes: [], outfits: [], outfitClass: {}, frames: {}, cues: null, effects: [], labels: {} },
      sets: new Map(), // path -> { path, name, actor, poses, duration, stance }
      setsListed: false,
      filter: { q: '', kind: 'all', classId: '' },
      outfit: null,
      file: null, // { path, kind, hash, original, project, problems }
      time: 0, playing: false, speed: 1, loop: true, facing: 'right', size: 'medium', background: 'checker',
      onion: { prev: false, next: false },
      selected: null, // { kind: 'clip', id } | { kind: 'anchor', name }
      narrow: false, overlay: null,
    };
    let rafId = 0, lastTick = 0, pendingLink = null, mounted = true;

    // ---------- the game server (the render page) ----------
    function setSetup(message) {
      setup.hidden = !message;
      setup.textContent = message || '';
    }
    async function connectGame() {
      let base = null;
      try { base = gameUrlOf(await ctx.api('tools')); } catch { base = null; }
      if (!base) {
        st.game.ready = false;
        frame.removeAttribute('src');
        setSetup('The game server is not running. Start it from the Library or Home, then try again.');
        return;
      }
      st.game.base = base;
      st.game.origin = new URL(base).origin;
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
      const p = st.file?.project;
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
      list.innerHTML = shown.map((e) => {
        const current = (e.kind === 'outfit' && st.outfit === e.id) || ((e.kind === 'animation' || e.kind === 'stance') && st.file?.path === e.id);
        return `<li><button type="button" class="mo-item" data-kind="${e.kind}" data-id="${esc(e.id)}" aria-current="${current ? 'true' : 'false'}"><span class="mo-item-label">${esc(e.label)}</span><span class="mo-item-sub">${esc(e.sub)}</span></button></li>`;
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
    async function openFile(path) {
      let r;
      try { r = await ctx.api(`files/read?path=${encodeURIComponent(path)}`); } catch (err) {
        ctx.toast({ kind: 'error', title: `Could not open ${path}`, detail: err.message, record: false });
        return;
      }
      const parsed = parsePoseFile(r.text);
      st.file = { path, kind: r.kind, hash: r.hash, original: r.text, project: parsed.project, problems: parsed.problems };
      st.time = 0;
      st.selected = null;
      st.playing = false;
      ctx.history.clear();
      if (parsed.project?.actor && st.index.outfits.includes(parsed.project.actor) && !st.outfit) st.outfit = parsed.project.actor;
      fileEl.textContent = path;
      sendLoad();
      renderAll();
      if (pendingLink?.frame != null) { applyFrame(pendingLink.frame); }
    }
    function applyFrame(index) {
      const p = st.file?.project;
      if (!p) return;
      st.time = poseStart(p.poses.length, p.duration, index);
      pendingLink = pendingLink && { ...pendingLink, frame: null };
      renderAll();
    }

    // ---------- transport and timeline ----------
    function duration() { return st.file?.project?.duration || 0; }
    function seek(t) {
      st.time = clampTime(t, duration());
      renderTransport();
      sendView();
    }
    function renderTransport() {
      const p = st.file?.project;
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
    }
    function renderTimeline() {
      const p = st.file?.project;
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
      const p = st.file?.project;
      const cls = st.filter.classId || p?.actor || '';
      const outfitKey = st.outfit || cls;
      const frames = st.index.frames[outfitKey] || st.index.frames[cls] || {};
      const pose = p ? p.poses[poseIndexAt(p.poses.length, p.duration, st.time)] : null;
      const frameFile = pose ? (p?.assets?.[`pose:${pose}`] ? null : frames[pose] || null) : null;
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
        ${problems.length ? `<div class="mo-problems"><p>This file does not match the game format:</p><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${clip ? clipInspector(clip) : ''}
        ${p ? `<h3>Anchors</h3><ul class="mo-anchors">${Object.entries(p.anchors).map(([k, v]) => `<li><span>${esc(k)}</span> ${v[0].toFixed(3)}, ${v[1].toFixed(3)}</li>`).join('')}</ul>` : ''}
        <h3>Links</h3>
        <div class="mo-links">
          ${cls ? `<button type="button" class="btn btn-sm mo-x-entities" data-class="${esc(cls)}">Open in Entity Browser</button>` : ''}
          ${frameFile ? `<button type="button" class="btn btn-sm mo-x-assets" data-path="${esc(frameFile)}">Open source frames in Asset Gallery</button>` : ''}
        </div>`;
      insp.querySelector('.mo-x-entities')?.addEventListener('click', (e) => ctx.openModule('entities', { kind: 'classes', id: e.currentTarget.dataset.class }));
      insp.querySelector('.mo-x-assets')?.addEventListener('click', (e) => ctx.openModule('assets', { path: e.currentTarget.dataset.path }));
    }
    function clipInspector(c) {
      return `<h3>Effect · ${esc(c.effect)}</h3>
        <dl class="mo-meta">
          <dt>Cue</dt><dd>${esc(c.cue)}${c.offset >= 0 ? ' +' : ' '}${c.offset} ms</dd>
          <dt>Anchor</dt><dd>${esc(c.anchor)}</dd>
          <dt>Position</dt><dd>${c.x}, ${c.y} px</dd>
          <dt>Size</dt><dd>${c.size}</dd>
          <dt>Opacity</dt><dd>${c.opacity}</dd>
          <dt>Layer</dt><dd>${esc(c.layer)}${c.travel ? ' · travels to target' : ''}${c.muted ? ' · muted' : ''}</dd>
        </dl>`;
    }
    function renderAll() {
      renderLibrary();
      renderTransport();
      renderTimeline();
      renderInspector();
      sendView();
      el.querySelector('.mo-review')?.toggleAttribute('disabled', !st.file || !isDirty(st.file.original, st.file.project));
    }

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
    const poseCount = () => st.file?.project?.poses.length || 0;
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
