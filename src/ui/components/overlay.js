// src/ui/components/overlay.js — the in-run tabbed overlay menu (SPEC §7.2).
//
// One overlay hosts every in-run menu as a tab: Deck, Relics & Flasks, Stats
// (run telemetry), and Settings. Opened from a button or hotkey on the map and
// in combat; combat is turn-based, so it needs no real "pause". Esc / the ✕ /
// clicking the veil closes it.

import { renderCard } from './card.js';
import { renderSettings } from '../screens/settings.js';
import { renderControls } from '../screens/controls.js';
import { attachTooltip, esc } from './tooltip.js';
import { relicText } from './card.js';
import { isEngaged, focusFirst, setTabRing } from '../input.js';
import { menuTabs } from '../uiContent.js';
import { openQuickNav, closeQuickNav, quickNavIsOpen, quickNavMode, quickNavFolds, saveAction } from './quicknav.js';
import { statProjection } from '../../model/statProjection.js';

let openVeil = null;
let escHandler = null;

// ---- the panels: ONE name per tab, not two (#78) ---------------------------
//
// `selectTab` was `if (id === 'deck') … else if (id === 'relics') …`, which made
// the if-chain a second, implicit home of WHICH TABS RENDER. MENU_TABS is the
// home of the tab LIST; a row added there got a button, a bumper stop and a
// quick-nav entry, and then showed an empty body — every derived thing worked
// and the one thing that mattered was silent (Law 0 clause 5).
//
// Now the row's `id` IS the key into this table. There is no second list to
// disagree with: a tab either has a panel here or it fails by name at boot
// (assertSurfaces, src/ui/surfaces.js) — never at the click.
//
// A panel is CODE and that is the honest edge of the promise: a new tab costs a
// row AND a function. What it no longer costs is a chance to forget the second
// one. Each takes (container, ctx) — the same bag openOverlay builds once — so
// they can live at module scope where the check can see them.
const PANELS = {
  deck: (host, ctx) => renderDeck(host, ctx),
  relics: (host, ctx) => renderRelics(host, ctx),
  stats: (host, ctx) => renderStats(host, ctx),
  save: (host, ctx) => renderSave(host, ctx),
  settings: (host, ctx) => renderSettings(host, {
    settings: ctx.settings,
    onChange: ctx.onSettingsChange || (() => {}),
    saves: ctx.saves,
    onProfileRestored: ctx.onProfileRestored,
  }),
  controls: (host, ctx) => renderControls(host, {
    settings: ctx.settings,
    onChange: ctx.onSettingsChange || (() => {}),
  }),
};

/** panelFor(id) → the renderer for a tab, or undefined. The one join. */
export function panelFor(id) {
  return PANELS[id];
}

// ---- the panel bodies, at module scope so PANELS can name them -------------
// Each takes (container, ctx) and reads the bag openOverlay builds once. They
// used to be closures inside openOverlay, which is where the if-chain could
// hide: a function only reachable through a comparison on an id.

function renderDeck(container, ctx) {
  const grid = document.createElement('div');
  grid.className = 'grid';
  if (!ctx.run.deck.length) {
    grid.innerHTML = '<div style="color:var(--muted);padding:20px">Empty.</div>';
  } else {
    for (const inst of ctx.run.deck) grid.appendChild(renderCard(ctx.registries, inst, { small: true }));
  }
  container.appendChild(grid);
}

function renderRelics(container, ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'ov-relics';
  const rTitle = document.createElement('h3');
  rTitle.className = 'set-cat';
  rTitle.textContent = `Relics (${ctx.run.relics.length})`;
  wrap.appendChild(rTitle);
  const rGrid = document.createElement('div');
  rGrid.className = 'ov-relic-grid';
  for (const rid of ctx.run.relics) {
    const def = ctx.registries.relics.get(rid);
    const el = document.createElement('div');
    el.className = 'ov-relic';
    el.innerHTML = `<span class="ov-relic-ic">${esc(def.icon || '◆')}</span><div><b>${esc(def.name)}</b><p>${esc(relicText(def))}</p></div>`;
    rGrid.appendChild(el);
  }
  if (!ctx.run.relics.length) rGrid.innerHTML = '<div style="color:var(--muted)">None yet.</div>';
  wrap.appendChild(rGrid);

  const fTitle = document.createElement('h3');
  fTitle.className = 'set-cat';
  fTitle.textContent = `Flasks (${ctx.run.flasks.length})`;
  wrap.appendChild(fTitle);
  const fGrid = document.createElement('div');
  fGrid.className = 'ov-relic-grid';
  for (const f of ctx.run.flasks) {
    const def = ctx.registries.flasks.get(f.flaskId);
    const el = document.createElement('div');
    el.className = 'ov-relic';
    el.innerHTML = `<span class="ov-relic-ic">${esc(def.icon || '🧪')}</span><div><b>${esc(def.name)}</b><p>${esc(def.textTemplate || '')}</p></div>`;
    fGrid.appendChild(el);
  }
  if (!ctx.run.flasks.length) fGrid.innerHTML = '<div style="color:var(--muted)">None.</div>';
  wrap.appendChild(fGrid);
  container.appendChild(wrap);
}

// Save tab: save to the current slot, save-and-quit to title, or quit the app.
// (In-run slot switching is intentionally left to the title's Continue.)
function renderSave(container, ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'ov-save-tab';
  wrap.innerHTML = `
    <h3 class="set-cat">Save</h3>
    <p class="set-note" style="max-width:420px">Your climb is written to its save slot. You can resume it later from the title screen's Continue.</p>
    <div class="ov-save-actions">
      ${ctx.onSave ? '<button class="subtle" id="ovs-save">Save now</button>' : ''}
      ${ctx.onQuit ? '<button class="subtle" id="ovs-quit">Save &amp; Quit to Title</button>' : ''}
      ${ctx.onExit ? '<button class="subtle danger" id="ovs-exit">Quit Game</button>' : ''}
    </div>`;
  container.appendChild(wrap);
  const s = wrap.querySelector('#ovs-save');
  if (s && ctx.onSave) {
    s.addEventListener('click', () => {
      const slot = ctx.onSave();
      s.textContent = slot ? `Saved · Slot ${slot}` : 'Saved';
      setTimeout(() => (s.textContent = 'Save now'), 1500);
    });
  }
  const q = wrap.querySelector('#ovs-quit');
  if (q && ctx.onQuit) q.addEventListener('click', () => { closeOverlay(); ctx.onQuit(); });
  const e = wrap.querySelector('#ovs-exit');
  if (e && ctx.onExit) e.addEventListener('click', () => { closeOverlay(); ctx.onExit(); });
}

export function hybridStatsPlan(ctx) {
  const s = ctx.run.stats || {};
  const cls = ctx.registries.classes.get(ctx.run.class);
  const projection = statProjection(ctx.registries, ctx.run);
  const attributes = projection.attributes.map((def) => [def.shortLabel, def.value]);
  const derived = projection.derived.flatMap((row) => [
    [row.label, row.formula],
    ...(row.note ? [[`${row.label} note`, row.note]] : []),
  ]);
  return [
    ['Forsaken', (ctx.run.customization && ctx.run.customization.name) || cls.name],
    ['Class', cls.name],
    ...attributes,
    ['Seed', ctx.run.seedString],
    ['Act', ctx.run.actNumber > 3 ? `${ctx.run.actNumber} (endless)` : `${ctx.run.actNumber} / 3`],
    ['Floor', ctx.run.floor],
    ...derived,
    ['Cinders', ctx.run.cinders],
    ['Fights won', s.fightsWon || 0],
    ['Damage dealt', s.damageDealt || 0],
    ['Damage taken', s.damageTaken || 0],
    ['Deck size', ctx.run.deck.length],
    ['Relics', ctx.run.relics.length],
  ];
}

function renderStats(container, ctx) {
  const rows = hybridStatsPlan(ctx);
  const el = document.createElement('div');
  el.className = 'ov-stats';
  el.innerHTML = rows
    .map(([k, v]) => `<div class="ov-stat"><span>${esc(String(k))}</span><b>${esc(String(v))}</b></div>`)
    .join('');
  container.appendChild(el);
}

// `overlayIsOpen()` USED TO LIVE HERE and is deleted rather than widened.
//
// It read this module's own `openVeil` handle, so it answered for ONE of the
// game's six veils — and combat.js, map.js and tutorial.js all called it meaning
// "is ANY veil standing". With the draw pile open, E ended the turn: hand 5 -> 0.
// Widening it would have made this module the home of a fact about five veils it
// does not own, so the predicate moved out instead: components/veil.js,
// `veilIsOpen()`, asked of the DOM the way input.js's scopeRoot() always did.
//
// `openVeil` below is NOT that fact and stays — it is this overlay's handle on
// its own element, which is how closeOverlay() knows what to remove.

export function closeOverlay() {
  if (openVeil) {
    openVeil.remove();
    openVeil = null;
    closeQuickNav(); // the mirrored list has nothing behind it any more
    setTabRing(null); // the bumpers go back to their global bindings
  }
  if (escHandler) {
    removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
}

/**
 * openOverlay({ registries, run, meta, onSettingsChange, onSave, initialTab })
 * onSave (optional) → returns the slot number saved to (adds a Save action).
 */
export function openOverlay({ registries, run, meta, saves = null, onSettingsChange, onProfileRestored, onSave, onQuit, onExit, initialTab = 'deck' }) {
  closeOverlay();
  closeQuickNav(); // opened FROM the list on map/combat: it has done its job
  const settings = meta.settings || (meta.settings = {});

  const hasSave = !!(onSave || onQuit || onExit);
  // The strip is DERIVED, not restated. It and the quick-nav dropdown are two
  // presentations of one table (uiContent.js MENU_TABS) — the hardcoded list
  // that used to live here is exactly the second copy Law 1 catches.
  const TABS = menuTabs({ hasSave, counts: { deck: run.deck.length } });
  // Variant B, and the fold test is `data-layout` — the mode autoLayout()
  // already chose. A width threshold of its own would be a second decider of
  // what "narrow" means, which is the defect #24 was (Law 2).
  const folded = quickNavFolds();
  const mirrored = quickNavMode() === 'mirror';

  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal overlay-modal">
      <div class="overlay-head">
        <div class="overlay-tabs" data-surface="overlayTab"${folded ? ' hidden' : ''}>
          ${TABS.map((t) => `<button class="ov-tab" data-member="${t.id}">${esc(t.label)}</button>`).join('')}
        </div>
        ${folded ? '<button class="ov-switch" id="ov-switch" aria-haspopup="menu"></button>' : ''}
        <div class="overlay-actions">
          ${mirrored ? '<button class="subtle" id="ov-quicknav" title="Go to…">☰</button>' : ''}
          <button class="subtle" id="ov-close" title="Close (Esc)">✕</button>
        </div>
      </div>
      <div class="overlay-body"></div>
    </div>`;
  document.body.appendChild(veil);
  openVeil = veil;

  const body = veil.querySelector('.overlay-body');
  let currentTab = null;

  // ONE bag, built once, handed to whichever panel the tab names. Everything a
  // panel could need is in it — so a panel is a plain function of (host, ctx)
  // and can sit at module scope where the boot check can find it.
  //
  // `saves` IS passed now, and I am reversing my own earlier decision here
  // rather than quietly leaving it (#67, Sunna's D18). I withheld it so the
  // Profile section would not render mid-run, on the grounds that restoring a
  // profile three floors into a climb is not a calm moment. Two things
  // changed: replacePrimaryWith now archives whatever it replaces, so the
  // hazard I was guarding against is recoverable rather than final; and
  // withholding the manager silently broke the quarantine feedback on this
  // door, which is the worse harm and the one a player actually meets. One
  // surface, one sentence, both doors — that is Sunna's call and she is right
  // that two strings is how they drift. A restore here does not touch the run
  // save: runs live in their own slot keys.
  const ctx = {
    registries, run, meta, settings, saves,
    onSettingsChange, onProfileRestored, onSave, onQuit, onExit,
  };

  function selectTab(id) {
    currentTab = id;
    veil.querySelectorAll('.ov-tab').forEach((b) => b.classList.toggle('on', b.dataset.member === id));
    const sw = veil.querySelector('#ov-switch');
    if (sw) {
      const t = TABS.find((x) => x.id === id);
      sw.textContent = `${t ? t.label : id} \u25be`;
    }
    body.innerHTML = '';
    // NO if-chain, and no trailing `else` that quietly renders nothing. A tab
    // declared in MENU_TABS with no entry in PANELS names itself here, and
    // assertSurfaces() has already failed the boot, so a player never meets it.
    const panel = panelFor(id);
    if (!panel) {
      console.error(`[ui] menu tab ${JSON.stringify(id)} is declared in MENU_TABS`
        + ' and has no panel in PANELS (src/ui/components/overlay.js) \u2014 the tab is'
        + ' the declaration, the panel is the handler, and one of them is missing.');
      body.innerHTML = `<div class="ov-dead">The <b>${esc(id)}</b> tab is declared and has no panel.</div>`;
      return;
    }
    panel(body, ctx);
  }

  veil.querySelectorAll('.ov-tab').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.member)));
  veil.querySelector('#ov-close').addEventListener('click', closeOverlay);
  veil.addEventListener('click', (e) => {
    if (e.target === veil) closeOverlay();
  });

  // Law 3 clauses 1 + 1a: RB → next, LB → previous, WRAP AT BOTH ENDS, over the
  // same set in the same order whether the strip is visible, wrapped to two rows,
  // or folded into the switcher. The ring is the TABS array — one order, and the
  // widget is not consulted.
  const step = (d) => {
    const i = TABS.findIndex((t) => t.id === currentTab);
    const at = i < 0 ? 0 : i;
    selectTab(TABS[(at + d + TABS.length) % TABS.length].id);
  };
  setTabRing({ prev: () => step(-1), next: () => step(1) });

  // The quick-nav list, mirrored (A) or folded-into (B). Both open the SAME list
  // over the SAME table; only which control opens it differs, which is the whole
  // difference between the two variants at this one screen.
  const openHere = (anchor) =>
    openQuickNav(anchor, 'overlay', {
      counts: { deck: run.deck.length },
      current: currentTab,
      hasSave,
      actions: {
        close: () => closeOverlay(),
        tab: (id) => selectTab(id),
        ...(onSave ? { save: saveAction(onSave) } : {}),
        ...(onQuit ? { quit: () => { closeOverlay(); onQuit(); } } : {}),
      },
    });
  const qnBtn = veil.querySelector('#ov-quicknav');
  if (qnBtn) qnBtn.addEventListener('click', (e) => { e.stopPropagation(); openHere(qnBtn); });
  const swBtn = veil.querySelector('#ov-switch');
  if (swBtn) swBtn.addEventListener('click', (e) => { e.stopPropagation(); openHere(swBtn); });

  // Esc closes the overlay, captured before screen-level key handlers see it.
  escHandler = (ev) => {
    if (ev.key === 'Escape') {
      // Esc peels ONE layer. With the mirrored list open over the overlay, the
      // list is the layer the player is looking at; closing both would take away
      // a screen they never asked to leave.
      if (quickNavIsOpen()) return;
      ev.preventDefault();
      ev.stopPropagation();
      closeOverlay();
    }
  };
  addEventListener('keydown', escHandler, true);

  selectTab(TABS.some((t) => t.id === initialTab) ? initialTab : 'deck');

  // Smart default (keyboard/gamepad): land on the active tab so arrows can move
  // to its content or across tabs, rather than leaving focus nowhere.
  if (isEngaged()) setTimeout(() => focusFirst('.ov-tab.on') || focusFirst('.ov-tab'), 0);

  return veil;
}
