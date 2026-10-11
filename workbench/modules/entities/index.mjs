// workbench/modules/entities/index.mjs — Entity Browser: every game object, drawn
// by the game's own renderers. The grid and the detail drawer are iframes of the
// render page (render.html), served by the game server, because this page cannot
// import /src/*. The two talk over postMessage, origin-checked both ways.
//
// Left: the filters (search, class, type, tag, rarity, sort, density, layout).
// Centre: the grid of the kind. Right: the drawer for the selected entity, with
// tabs Card | Inventory | Worn by class | Tooltip | Data | Try in fight.

import {
  KINDS, SORTS, DENSITIES, LAYOUTS, DEFAULT_KIND, parseDeepLink, deepLinkOf, filterEntries,
  facetsOf, chipCounts, renderUrl, tryFightUrl, gameBaseOf, sourceTableFor, kindOf,
} from './model.mjs';

const RENDER_SOURCE = 'ashen-entities';
const MODULE_SOURCE = 'ashen-entities-module';
const POSES = [['idle', 'Standing'], ['guard', 'Guarding'], ['attack2', 'Attacking'], ['power2', 'Casting'], ['hit', 'Hurt'], ['defeated', 'Defeated'], ['prepared', 'Prepared'], ['bloodRite', 'Blood Rite']];
const TABS = [['card', 'Card', 'detail'], ['inventory', 'Inventory', 'inventory'], ['worn', 'Worn by class', 'worn'], ['tooltip', 'Tooltip', 'tooltip'], ['data', 'Data', 'data'], ['try', 'Try in fight', null]];
const FILTERS = ['class', 'type', 'tag', 'rarity'];
const LABELS = { class: 'All classes', type: 'All types', tag: 'All tags', rarity: 'All rarities' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/entities/entities.css"><div class="ent">
      <nav class="ent-chips" aria-label="Kinds"></nav>
      <div class="ent-body">
        <aside class="ent-filters" aria-label="Filters">
          <label class="ent-field">Search<input type="search" class="ent-q" placeholder="Name, id, tag or type" autocomplete="off"></label>
          <label class="ent-field">Class<select data-f="class"></select></label>
          <label class="ent-field">Type<select data-f="type"></select></label>
          <label class="ent-field">Tag<select data-f="tag"></select></label>
          <label class="ent-field">Rarity<select data-f="rarity"></select></label>
          <label class="ent-field">Sort<select data-f="sort">${SORTS.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select></label>
          <label class="ent-field">Density<select data-f="density">${DENSITIES.map((d) => `<option value="${d}">${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select></label>
          <div class="ent-field"><span>Layout</span><div class="ent-seg" role="group" aria-label="Layout">${LAYOUTS.map((l) => `<button type="button" data-layout="${l}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}</div></div>
          <p class="ent-count" role="status"></p>
          <button type="button" class="ent-reset">Clear filters</button>
        </aside>
        <section class="ent-center" aria-label="Entities">
          <div class="ent-setup" hidden></div>
          <iframe class="ent-frame" title="Entities rendered by the game"></iframe>
        </section>
        <aside class="ent-drawer" aria-label="Selected entity">
          <div class="ent-drawer-head"><h2 class="ent-title">Select an entity</h2><p class="ent-sub"></p></div>
          <div class="ent-tabs" role="tablist" aria-label="Detail views">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${esc(label)}</button>`).join('')}</div>
          <div class="ent-pane">
            <div class="ent-pose" hidden><label>Pose <select class="ent-pose-sel">${POSES.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></label></div>
            <iframe class="ent-drawer-frame" title="Selected entity rendered by the game"></iframe>
            <form class="ent-try" hidden>
              <p class="ent-sub">Opens a fresh fight in the game preview dock with these kits. Ordinary saves are untouched.</p>
              <label class="ent-field">Class<select name="class"></select></label>
              <label class="ent-field">Main hand<select name="mainHand"></select></label>
              <label class="ent-field">Off hand<select name="offHand"></select></label>
              <button type="submit" class="primary">Start fight in the dock</button>
            </form>
          </div>
          <div class="ent-drawer-foot"><button type="button" class="ent-ds">Edit in Data Studio</button></div>
        </aside>
      </div></div>`;
    const $ = (s) => el.querySelector(s);
    const chips = $('.ent-chips'), center = $('.ent-center iframe'), drawer = $('.ent-drawer-frame');
    const setup = $('.ent-setup'), count = $('.ent-count'), tryForm = $('.ent-try'), poseWrap = $('.ent-pose');
    const dsBtn = $('.ent-ds'), q = $('.ent-q');

    const prefs = { density: ctx.settings.get('density', 'comfortable'), layout: ctx.settings.get('layout', 'grid') };
    // mainHand and offHand start null (not chosen yet); '' is a chosen empty hand.
    const st = { ...parseDeepLink({}), density: prefs.density, layout: prefs.layout, pose: 'idle', tab: 'card', classId: 'reaver', mainHand: null, offHand: null };
    const game = { base: null, origin: null };
    let seenParams = null;
    let counts = {}, index = [], classes = [], armaments = [], files = null;

    // ---------- the game server ----------
    async function connect() {
      setup.hidden = true;
      try {
        const base = gameBaseOf(await ctx.api('tools'));
        if (!base) throw new Error('The game server is not running.');
        game.base = base;
        game.origin = new URL(base).origin;
        center.src = renderUrl(base, { parentOrigin: location.origin });
        drawer.src = renderUrl(base, { parentOrigin: location.origin, kind: st.kind, view: 'detail' });
      } catch (err) {
        setup.hidden = false;
        setup.innerHTML = `<p>${esc(err.message)} The entities are drawn by the game server, so start it from the Library or Home, then <button type="button" class="ent-retry">Try again</button>.</p>`;
        setup.querySelector('.ent-retry').onclick = connect;
      }
    }

    // ---------- messages ----------
    const post = (frame, msg) => frame?.contentWindow && game.origin && frame.contentWindow.postMessage({ source: MODULE_SOURCE, ...msg }, game.origin);
    const viewOf = (tab) => TABS.find(([id]) => id === tab)?.[2] || 'detail';
    function sendCenter() {
      post(center, { type: 'set', params: { kind: st.kind, view: 'grid', q: st.q, sort: st.sort, class: st.class, type: st.type, tag: st.tag, rarity: st.rarity, density: st.density, layout: st.layout } });
    }
    function sendDrawer() {
      if (st.tab === 'try') return;
      post(drawer, { type: 'set', params: { kind: st.kind, view: viewOf(st.tab), id: st.id, pose: st.pose } });
    }
    function onMessage(ev) {
      if (!game.origin || ev.origin !== game.origin) return;
      const d = ev.data;
      if (!d || d.source !== RENDER_SOURCE) return;
      const fromCenter = ev.source === center.contentWindow;
      const fromDrawer = ev.source === drawer.contentWindow;
      if (!fromCenter && !fromDrawer) return;
      switch (d.type) {
        case 'ready':
          if (fromCenter) sendCenter(); else sendDrawer();
          break;
        case 'counts':
          if (!fromCenter) break;
          counts = d.counts || {}; classes = d.classes || []; armaments = d.armaments || [];
          renderChips(); renderTry();
          break;
        case 'index':
          if (fromCenter && d.kind === st.kind) { index = d.entries || []; renderFacets(); renderCount(); }
          break;
        case 'select':
          if (fromCenter && d.kind === st.kind) select(d.id);
          break;
        default: break;
      }
    }
    const onWindowMessage = (ev) => onMessage(ev);
    window.addEventListener('message', onWindowMessage);

    // ---------- chips, facets, count ----------
    function renderChips() {
      const list = chipCounts(counts);
      chips.innerHTML = list.map((c) => `<button type="button" role="tab" data-kind="${c.id}" aria-selected="${c.id === st.kind}"><span>${esc(c.label)}</span><span class="ent-n">${Object.keys(counts).length ? c.count : '–'}</span></button>`).join('');
    }
    function renderFacets() {
      const f = facetsOf(index);
      const opts = { class: f.classes, type: f.types, tag: f.tags, rarity: f.rarities };
      for (const name of FILTERS) {
        const sel = el.querySelector(`[data-f="${name}"]`);
        const values = opts[name];
        if (!values.some((v) => v.value === st[name])) st[name] = '';
        sel.innerHTML = `<option value="">${LABELS[name]}</option>` + values.map((v) => `<option value="${esc(v.value)}">${esc(v.value)} (${v.count})</option>`).join('');
        sel.value = st[name];
      }
      el.querySelector('[data-f="sort"]').value = st.sort;
      el.querySelector('[data-f="density"]').value = st.density;
      el.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === st.layout)));
      q.value = st.q;
    }
    function renderCount() {
      const shown = filterEntries(index, st).length;
      count.textContent = index.length ? `${shown} of ${index.length} ${kindOf(st.kind)?.label.toLowerCase() || ''}` : '';
    }
    function renderTabs() {
      el.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
      const isTry = st.tab === 'try';
      drawer.hidden = isTry;
      tryForm.hidden = !isTry;
      poseWrap.hidden = st.tab !== 'worn';
      if (isTry) renderTry();
    }
    function renderTitle() {
      const entry = index.find((e) => e.id === st.id);
      $('.ent-title').textContent = entry ? entry.name : st.id || 'Select an entity';
      $('.ent-sub').textContent = st.id ? `${kindOf(st.kind)?.singular || ''} · ${st.id}` : `${kindOf(st.kind)?.label || ''}: choose one in the grid`;
      const table = sourceTableFor(st.kind, files);
      dsBtn.disabled = !table || !st.id;
      dsBtn.title = !table ? 'No content/source table defines this kind; it is authored in src/content.' : !st.id ? 'Select an entity first.' : `Open ${table} in Data Studio`;
    }

    // ---------- try in fight ----------
    function renderTry() {
      const cls = tryForm.elements.class, main = tryForm.elements.mainHand, off = tryForm.elements.offHand;
      if (!classes.length) return;
      if (!cls.options.length) cls.innerHTML = classes.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
      const hands = [['', 'Empty hand'], ...armaments.map((a) => [a.id, a.name])];
      if (!main.options.length) { main.innerHTML = hands.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join(''); off.innerHTML = main.innerHTML; }
      const pick = (v, fallback) => (v !== null && hands.some(([id]) => id === v) ? v : fallback);
      st.classId = cls.value || st.classId;
      if (st.kind === 'armaments' && st.id) st.mainHand = st.id;
      st.mainHand = pick(st.mainHand, 'straightSword');
      st.offHand = pick(st.offHand, 'roundShield');
      cls.value = classes.some((c) => c.id === st.classId) ? st.classId : classes[0]?.id;
      main.value = st.mainHand; off.value = st.offHand;
    }

    // ---------- state changes ----------
    // The hash names the state a reader needs to come back to it: kind, entity, filters and tab.
    function writeHash() {
      try { history.replaceState(null, '', deepLinkOf(st)); } catch { /* the hash is a convenience */ }
    }
    function setKind(kind, { keepFilters = false } = {}) {
      const next = kindOf(kind) ? kind : DEFAULT_KIND;
      if (next !== st.kind) {
        st.kind = next; st.id = null; index = [];
        if (!keepFilters) { st.class = ''; st.type = ''; st.tag = ''; st.rarity = ''; }
        renderChips(); sendCenter(); sendDrawer();
      }
      renderFacets(); renderCount(); renderTitle(); writeHash();
    }
    function select(id) {
      st.id = id || null;
      renderTitle(); sendDrawer(); renderTry(); writeHash();
    }
    function setTab(tab) {
      st.tab = tab; renderTabs(); renderTitle();
      if (tab !== 'try') sendDrawer();
      writeHash();
    }
    /** A deep link (#mod=entities&…) or a Browse command: the state it names, drawn. */
    function applyParams(p) {
      const next = parseDeepLink(p);
      // The kind first: setKind clears the entity when the kind changes, so the link's entity is set after it.
      setKind(next.kind, { keepFilters: true });
      Object.assign(st, { q: next.q, sort: next.sort, class: next.class, type: next.type, tag: next.tag, rarity: next.rarity, id: next.id, tab: next.tab });
      sendCenter(); sendDrawer(); renderChips(); renderTabs(); renderFacets(); renderCount(); renderTitle(); writeHash();
    }

    // ---------- events ----------
    chips.addEventListener('click', (ev) => { const b = ev.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });
    el.querySelectorAll('[data-f]').forEach((sel) => sel.addEventListener('change', () => {
      const name = sel.dataset.f;
      if (name === 'density') { st.density = sel.value; ctx.settings.set('density', st.density); sendCenter(); return; }
      if (name === 'sort') { st.sort = sel.value; sendCenter(); renderCount(); writeHash(); return; }
      st[name] = sel.value; sendCenter(); renderCount(); writeHash();
    }));
    let qTimer = 0;
    q.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { st.q = q.value.trim(); sendCenter(); renderCount(); writeHash(); }, 120); });
    el.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => { st.layout = b.dataset.layout; ctx.settings.set('layout', st.layout); renderFacets(); sendCenter(); }));
    $('.ent-reset').addEventListener('click', () => { Object.assign(st, { q: '', class: '', type: '', tag: '', rarity: '', sort: 'name' }); renderFacets(); sendCenter(); renderCount(); writeHash(); });
    el.querySelector('.ent-tabs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
    el.querySelector('.ent-pose-sel').addEventListener('change', (ev) => { st.pose = ev.target.value; sendDrawer(); });
    tryForm.addEventListener('change', () => {
      const f = tryForm.elements;
      Object.assign(st, { classId: f.class.value, mainHand: f.mainHand.value, offHand: f.offHand.value });
    });
    tryForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = tryForm.elements;
      if (!game.base) { ctx.toast({ kind: 'error', title: 'The game server is not running', detail: 'Start it, then try again.' }); return; }
      if (f.mainHand.value && f.mainHand.value === f.offHand.value) { ctx.toast({ kind: 'error', title: 'Choose different armaments for the two hands.' }); return; }
      ctx.preview.showUrl(tryFightUrl(game.base, { classId: f.class.value, mainHand: f.mainHand.value, offHand: f.offHand.value }));
    });
    dsBtn.addEventListener('click', () => {
      const table = sourceTableFor(st.kind, files);
      if (table && st.id) ctx.openModule('data', { table, row: st.id });
    });

    // ---------- start ----------
    ctx.api('files/list?dir=content/source&ext=csv,json').then((r) => {
      files = (r.files || []).map((f) => (typeof f === 'string' ? f : f.path));
      renderTitle();
    }).catch(() => { files = null; });
    renderChips(); renderTabs(); renderTitle(); renderFacets(); renderCount();
    connect();
    return {
      // The host calls onShow after mount, and again each time the module is opened. It keeps a
      // fresh params object per open, so a link or command applies once and a plain return keeps the state.
      onShow() {
        const p = ctx.params;
        if (!p || p === seenParams) return;
        seenParams = p;
        if (Object.keys(p).length) applyParams(p);
      },
      commands: () => [
        ...KINDS.map((k) => ({ title: `Browse ${k.label}`, sub: 'Entity Browser', run: () => { ctx.openModule('entities', { kind: k.id }); } })),
        { title: 'Clear entity filters', sub: 'Entity Browser', run: () => { Object.assign(st, { q: '', class: '', type: '', tag: '', rarity: '', sort: 'name' }); renderFacets(); sendCenter(); renderCount(); writeHash(); } },
      ],
    };
  },
};
