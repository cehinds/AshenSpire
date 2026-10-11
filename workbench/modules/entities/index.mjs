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
  facetsOf, chipCounts, renderUrl, tryFightUrl, gameBaseOf, sourceTableFor, kindOf, escHtml, handChoices, handsFor,
  RENDER_PROTOCOL, settleFilters, tableRowOf, connectPlan,
} from './model.mjs';

const RENDER_SOURCE = 'ashen-entities';
const MODULE_SOURCE = 'ashen-entities-module';
const POSES = [['idle', 'Standing'], ['guard', 'Guarding'], ['attack2', 'Attacking'], ['power2', 'Casting'], ['hit', 'Hurt'], ['defeated', 'Defeated'], ['prepared', 'Prepared'], ['bloodRite', 'Blood Rite']];
const TABS = [['card', 'Card', 'detail'], ['inventory', 'Inventory', 'inventory'], ['worn', 'Worn by class', 'worn'], ['tooltip', 'Tooltip', 'tooltip'], ['data', 'Data', 'data'], ['try', 'Try in fight', null]];
const FILTERS = ['class', 'type', 'tag', 'rarity'];
const LABELS = { class: 'All classes', type: 'All types', tag: 'All tags', rarity: 'All rarities' };

const esc = escHtml;

export default {
  mount(el, ctx) {
    el.innerHTML = `<link rel="stylesheet" href="/modules/entities/entities.css"><div class="ent">
      <nav class="ent-chips" aria-label="Kinds"></nav>
      <div class="ent-narrowbar"><button type="button" class="ent-filter-toggle" aria-expanded="false" aria-controls="ent-filters-pane">Filters</button></div>
      <div class="ent-body">
        <aside class="ent-filters" id="ent-filters-pane" aria-label="Filters">
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
          <div class="ent-drawer-head"><div class="ent-drawer-top"><h2 class="ent-title">Select an entity</h2><button type="button" class="ent-drawer-close" aria-label="Close the detail panel">Close</button></div><p class="ent-sub"></p></div>
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
    // Below 1100px the filters and the detail drawer are overlays (entities.css): these classes open them.
    const root = $('.ent'), filterToggle = $('.ent-filter-toggle');
    const setFilters = (open) => { root.classList.toggle('filters-open', open); filterToggle.setAttribute('aria-expanded', String(open)); };
    const setDrawer = (open) => root.classList.toggle('drawer-open', open);
    filterToggle.addEventListener('click', () => setFilters(!root.classList.contains('filters-open')));
    $('.ent-drawer-close').addEventListener('click', () => setDrawer(false));
    root.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { setDrawer(false); setFilters(false); } });

    const prefs = { density: ctx.settings.get('density', 'comfortable'), layout: ctx.settings.get('layout', 'grid') };
    // mainHand and offHand start null (not chosen yet); '' is a chosen empty hand.
    const st = { ...parseDeepLink({}), density: prefs.density, layout: prefs.layout, pose: 'idle', tab: 'card', classId: 'reaver', mainHand: null, offHand: null };
    const game = { base: null, origin: null, ready: false };
    let seenParams = null;
    let counts = {}, index = [], indexKind = null, classes = [], armaments = [], files = null;
    let tryFor = undefined; // the entity the Try in fight hands were last set for

    // ---------- the game server ----------
    const CHECKOUT_MESSAGE = "This project's checkout has no Entity Browser render page, or an older one. Update that checkout to this branch.";
    const SERVER_HINT = 'The entities are drawn by the game server, so start it from the Library or Home, then';
    const READY_WAIT_MS = 15000;
    const ANSWER_WAIT_MS = 10000;
    let readyTimer = 0, answerTimer = 0;
    function showSetup(message, detail = '') {
      setup.hidden = false;
      setup.innerHTML = `<p>${esc(message)}${detail ? ` ${esc(detail)}` : ''} <button type="button" class="ent-retry">Try again</button></p>`;
      setup.querySelector('.ent-retry').onclick = () => connect();
    }
    // A grid that was sent but never reported its state back means the page has stopped answering.
    function expectAnswer() {
      clearTimeout(answerTimer);
      answerTimer = setTimeout(() => { if (game.ready) connect({ force: true }); }, ANSWER_WAIT_MS);
    }
    // A render page that never says ready is either missing from this checkout or the server has stopped.
    function awaitReady() {
      clearTimeout(readyTimer);
      readyTimer = setTimeout(async () => {
        if (game.ready) return;
        let up = false;
        try { up = !!gameBaseOf(await ctx.api('tools')); } catch { up = false; }
        if (game.ready) return;
        if (up) showSetup(CHECKOUT_MESSAGE);
        else showSetup('The game server stopped answering.', SERVER_HINT);
      }, READY_WAIT_MS);
    }
    // Resolves the game server the same way at mount, on show and on Try again. The frames load again
    // unless the same origin is already answering; `force` reloads them anyway.
    let runs = 0;
    async function connect({ force = false } = {}) {
      const run = ++runs;
      let base = null, failure = null;
      try {
        base = gameBaseOf(await ctx.api('tools'));
        if (!base) throw new Error('The game server is not running.');
      } catch (err) { failure = err; }
      if (run !== runs) return; // a later connect has taken over
      if (failure) {
        clearTimeout(readyTimer); clearTimeout(answerTimer);
        game.origin = null; game.ready = false;
        showSetup(failure.message, SERVER_HINT);
        return;
      }
      setup.hidden = true;
      if (connectPlan({ base, currentOrigin: game.origin, ready: game.ready, force }) === 'keep') return;
      game.base = base; game.origin = new URL(base).origin; game.ready = false;
      center.src = renderUrl(base, { parentOrigin: location.origin });
      drawer.src = renderUrl(base, { parentOrigin: location.origin, kind: st.kind, view: 'detail' });
      awaitReady();
    }

    // ---------- messages ----------
    const post = (frame, msg) => frame?.contentWindow && game.origin && frame.contentWindow.postMessage({ source: MODULE_SOURCE, ...msg }, game.origin);
    const viewOf = (tab) => TABS.find(([id]) => id === tab)?.[2] || 'detail';
    function sendCenter() {
      post(center, { type: 'set', params: { kind: st.kind, view: 'grid', q: st.q, sort: st.sort, class: st.class, type: st.type, tag: st.tag, rarity: st.rarity, density: st.density, layout: st.layout } });
      expectAnswer();
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
          // A page from another checkout may be older or newer: it is not drawn, and the reader is told why.
          if (d.protocol !== RENDER_PROTOCOL) { clearTimeout(readyTimer); showSetup(CHECKOUT_MESSAGE); break; }
          game.ready = true; clearTimeout(readyTimer); setup.hidden = true;
          if (fromCenter) sendCenter(); else sendDrawer();
          break;
        case 'counts':
          if (!fromCenter) break;
          counts = d.counts || {}; classes = d.classes || []; armaments = d.armaments || [];
          renderChips(); renderTry();
          break;
        case 'shown':
          if (fromCenter) clearTimeout(answerTimer);
          break;
        case 'index':
          if (fromCenter && d.kind === st.kind) {
            index = d.entries || []; indexKind = d.kind;
            // The grid was sent with the pending filters; resend it only when the index dropped one.
            if (renderFacets()) { sendCenter(); writeHash(); }
            renderCount();
          }
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
    // Returns true when a filter value was dropped, so the grid must be sent again.
    function renderFacets() {
      const f = indexKind === st.kind ? facetsOf(index) : null;
      const opts = f ? { class: f.classes, type: f.types, tag: f.tags, rarity: f.rarities } : {};
      const settled = settleFilters(st, f);
      let dropped = false;
      for (const name of FILTERS) {
        const sel = el.querySelector(`[data-f="${name}"]`);
        if (st[name] !== settled[name]) { st[name] = settled[name]; dropped = true; }
        // While the index is loading, the pending value is the only option; its count is not known yet.
        const values = f ? opts[name] : (st[name] ? [{ value: st[name], count: null }] : []);
        sel.innerHTML = `<option value="">${LABELS[name]}</option>` + values.map((v) => `<option value="${esc(v.value)}">${esc(v.value)}${v.count == null ? '' : ` (${v.count})`}</option>`).join('');
        sel.value = st[name];
      }
      el.querySelector('[data-f="sort"]').value = st.sort;
      el.querySelector('[data-f="density"]').value = st.density;
      el.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === st.layout)));
      q.value = st.q;
      return dropped;
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
      const hands = handChoices(armaments);
      if (!main.options.length) { main.innerHTML = hands.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join(''); off.innerHTML = main.innerHTML; }
      st.classId = cls.value || st.classId;
      // The main hand follows the selected armament, once per selection: switching tabs keeps the reader's hands.
      if (st.id !== tryFor) {
        tryFor = st.id;
        if (st.kind === 'armaments' && st.id) st.mainHand = st.id;
        if (st.offHand && st.offHand === st.mainHand) st.offHand = null;
      }
      Object.assign(st, handsFor({ mainHand: st.mainHand, offHand: st.offHand }, armaments.map((a) => a.id)));
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
        st.kind = next; st.id = null; index = []; indexKind = null;
        if (!keepFilters) { st.class = ''; st.type = ''; st.tag = ''; st.rarity = ''; }
        renderChips(); sendCenter(); sendDrawer();
      }
      renderFacets(); renderCount(); renderTitle(); writeHash();
    }
    function select(id) {
      st.id = id || null;
      setDrawer(Boolean(st.id)); // a selection slides the drawer in (an overlay below 1100px)
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
      // The facets settle the filters first, so the grid is sent the values the column shows.
      renderFacets(); sendCenter(); sendDrawer(); renderChips(); renderTabs(); renderCount(); renderTitle(); writeHash();
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
      if (table && st.id) ctx.openModule('data', { table, row: tableRowOf(st.kind, st.id) });
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
        // The game may have restarted or moved port while the module was away: resolve it again.
        connect();
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
