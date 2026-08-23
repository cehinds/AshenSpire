// src/ui/screens/map.js — the act map SCREEN (SPEC §7.1, mockup: map-screen.svg)
//
// THE BOARD IS NOT HERE ANY MORE. Geometry, edges, nodes, fog, the camera, the
// zoom ladder and the delivered-tap-size note live in ONE renderer,
// `ui/components/mapboard.js`, because there were two of them: this file and a
// second, independent one inside `ui/screens/coop.js` with its own `ROW_H = 46`
// and its own `r = boss ? 20 : 15`. Read that file's header for the ruling —
// the co-op map is the SAME MAP with a second player on it, so what varies is
// the VIEWER and never the act.
//
// WHAT IS STILL THIS FILE'S: the chrome a solo run needs and a co-op client does
// not — the hero header, the relic and flask strip, the legend, the quick-nav,
// the hint bar, and this screen's own keyboard handler.
//
// TWO MODES, and the toggle is Settings → Display · Map reveal:
//
//   path  the game as it shipped — the whole act drawn, only edge-connected
//         nodes from the current position clickable, traveled path in gold.
//   fog   the doors, the boss, the trail behind you and the split in front of
//         you. Everything else is unlit parchment.
//
// WHAT IS DRAWN IS NOT WHAT IS CLICKABLE. `reachable` governs CLICKS; fog governs
// DRAWING, and it asks a different question of a different set — the ladder in
// model/mapknowledge.js. The Sealstone Key is not a case this screen checks for:
// it is the operator that lifts a node from `placed` to `known`.

import { passiveFlag } from '../../model/registries.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { veilIsOpen } from '../components/veil.js';
import { matchAction, isEngaged, focusFirst, actionHint } from '../input.js';
import { hintBarHtml } from '../components/hints.js';
import { classGlyph, tintCss } from '../assets.js';
import { nodeBlurb, actTitle, legendEntries, MENU } from '../uiContent.js';
import { openQuickNav, quickNavMode, saveAction } from '../components/quicknav.js';
import { mountMapBoard } from '../components/mapboard.js';
import { flaskActionPlan } from '../../model/flaskActions.js';
import { flaskPresentation, mountFlaskActionMenu } from '../components/flask.js';
import { resolveMapMode } from '../../model/mapknowledge.js';
import { buildStampHtml } from '../components/buildstamp.js';
import { resourceBarPlan, resourceDomains } from '../../model/resources.js';
import { resourceBars, markFlooredBars } from '../components/resbars.js';

/**
 * THE MAP'S KEY HANDLER, AND ONLY ONE OF IT — #22's lifecycle, applied to the
 * one listener that was left out of it.
 *
 * The handler below removes itself when `.mapscreen` is gone. That is correct
 * for map → combat → map and WRONG for map → map: the second mount puts a
 * `.mapscreen` back, so the first handler's guard passes forever and both run.
 * `+` steps the zoom twice, and the stale one drives a detached `<svg>`.
 *
 * It was latent before tonight (nothing re-mounted the map in place) and it is a
 * live path now: flipping Map reveal in Settings redraws the map underneath the
 * still-open overlay, which is the entire point of putting the toggle there. So
 * the mount owns the teardown rather than the handler guessing at it.
 */
let liveMapKeys = null;
// AND THE BOARD IT DROVE. The board holds a ResizeObserver and a timeout that
// re-centre a scrollport this mount is about to replace; leaving them running is
// the same leak the handler above was written for, one object over.
let liveMapBoard = null;

export function mountMap(app, { registries, run, meta, onPick, onSave, onQuit, onSettings, onMenu, onArmoury }) {
  // Before anything is drawn: the previous mount's keyboard handler, if this is
  // a re-mount. See `liveMapKeys` above.
  if (liveMapKeys) {
    removeEventListener('keydown', liveMapKeys);
    liveMapKeys = null;
  }
  if (liveMapBoard) {
    liveMapBoard.teardown();
    liveMapBoard = null;
  }
  const map = run.mapGraph;
  // WHAT THIS RUN KNOWS AND MAY DO — the viewer's half, and the only half this
  // screen still computes. Geometry, drawing and the camera are the board's
  // (ui/components/mapboard.js).
  const reachable = new Set(run.mapNodeId ? map.nodes[run.mapNodeId].next : map.startIds);
  const reveal = passiveFlag(registries, run.relics, 'revealUnknown');
  const mode = resolveMapMode(meta);
  const fog = mode === 'fog';

  const cz = run.customization || {};
  const className = registries.classes.get(run.class).name;
  const heroName = (cz.name || className).toUpperCase();
  const hasRelics = run.relics.length > 0;
  const hasFlasks = run.flasks.length > 0;
  const atEntrance = !run.mapNodeId;
  const entranceStart = atEntrance && map.startIds.length ? map.nodes[map.startIds[0]] : null;
  const entranceBoss = atEntrance ? Object.values(map.nodes).find((n) => n.type === 'boss') : null;
  const entranceOrientation = entranceStart && entranceBoss
    ? `<div class="map-entrance-orientation" data-composition="orientation-strip" role="note" aria-label="${esc(actTitle(run.actNumber))} orientation: entrance to boss">
        <strong>${esc(actTitle(run.actNumber))}</strong>
        <span class="map-orientation-progress" aria-hidden="true">
          <small data-role="start">ENTRANCE</small><span class="map-orientation-rail"></span><small data-role="boss">BOSS</small>
        </span>
      </div>`
    : '';

  app.innerHTML = `
    <div class="mapscreen${fog ? ' map-fog' : ''}${atEntrance ? ' map-entrance' : ''}">
      <header class="topbar combat-hud map-header">
        <!-- E9 / #254 - ONE HUD. The entire top row now has the same structure
             as combat: the shared resource host, Armoury, Menu. This used to be
             a hand-written div.bar.hpbar at its own 15rem width; its first E9
             replacement reused the renderer but gave the map a full-width row,
             so 320x640 could still show a solid proportional pool while combat
             showed the same pool as a dashed floored stub. Same plan, different
             truth. Sharing the row geometry removes that last second HUD.
             (No backticks here: this block lives inside a template literal.) -->
        <div class="hud-top">
          <div class="resbars-host"></div>
          <button class="topbar-btn" id="open-armoury" title="Armoury">⚒</button>
          <button class="topbar-btn" id="open-menu" data-action-hint="menu" title="${esc(actionHint('menu'))}" aria-label="${esc(actionHint('menu'))}">☰</button>
        </div>
        <div class="hud-bottom">
          <div class="portrait" style="border-color:${tintCss(cz.tint)}">${esc(cz.glyph || classGlyph(run.class))}</div>
          <div class="who"><span class="nm">${esc(heroName)} · ${esc(className.toUpperCase())}</span></div>
          <span class="mh-stat cinders">⛁ ${run.cinders}</span>
          <span class="mh-stat mh-prog">${run.actNumber > 3 ? `Act ${run.actNumber}` : `Act ${run.actNumber} / 3`} · Floor ${run.floor} / ${map.floors}</span>
          <span class="mh-stat mh-seed" title="Run seed">SEED ${esc(run.seedString)}</span>
          ${buildStampHtml('map')}
          <button class="topbar-btn" id="map-legend" title="Map legend">?</button>
        </div>
        <div class="map-legend-pop" hidden>
          ${legendEntries().map((e) => `<div><span class="ic"${e.tint ? ` style="color:${e.tint}"` : ''}>${esc(e.icon)}</span>${esc(e.name)}</div>`).join('')}
        </div>
      </header>
      <div class="map-substrip${hasFlasks ? '' : ' no-flasks'}"${hasRelics || hasFlasks ? '' : ' hidden'}>
        <div class="mh-flasks"></div>
        ${hasFlasks && hasRelics ? '<span class="mh-div"></span>' : ''}
        <div class="relics mh-relics"></div>
      </div>
    </div>`;
  app.querySelector('.mapscreen').insertAdjacentHTML('beforeend', entranceOrientation);

  // ---- THE HUD, AND IT IS THE COMBAT HUD ---------------------------------
  //
  // E9 / #254, his words: "I'd like the hud to look the same both combat and
  // map". ONE renderer for both — ui/components/resbars.js — fed by the one
  // plan builder, model/resources.js `resourceBarPlan(…, 'main', …)`, which is
  // the identical call combat.js:435 and coop.js:460 make. So:
  //
  //   · WHICH rows appear is content/resources.js's business, not this
  //     screen's. HP, then the Mana/Stamina band, then poise — the map does
  //     not get its own list and cannot drift from combat's.
  //   · TROUGH LENGTH is `scale(max)/scale(reference)` against the SAME
  //     reference table (HUD_REFERENCE_MAX, his 500/50), so a pool's length
  //     means the same thing on both screens.
  //   · The `run` IS the view and the entity here, exactly as it is in
  //     tools/hybridstats.mjs — the readers take current/max off it and a row
  //     whose reader returns null is ABSENT, never a lying 0/0 trough. That is
  //     why POISE does not draw on the map: outside a fight there is no poise
  //     meter, and the refusal path is the right answer rather than a bar with
  //     nothing behind it. Measured and held by tools/hudparity.mjs P1,
  //     which excuses exactly this one row and reds on any other difference.
  //   · markFlooredBars() runs here for the same reason it runs in combat: the
  //     minimum-width floor is a RENDERED fact, and a floored trough must wear
  //     the dashed broken-axis mark on this screen too or the map would show a
  //     bar that is no longer to scale and does not say so.
  const resHost = app.querySelector('.map-header .resbars-host');
  if (resHost) {
    const mapPlan = resourceBarPlan(registries, 'main', run, run, resourceDomains(registries));
    resHost.appendChild(resourceBars(mapPlan, { surface: 'main' }));
    markFlooredBars(resHost);
  }

  // ---- THE BOARD -------------------------------------------------------
  //
  // ONE RENDERER, and this is the whole of the map on this screen. Everything
  // it draws — the SVG, the edges, the fog ground, every node, the camera, the
  // zoom bar and the delivered-tap-size note — is the same code the co-op
  // client mounts. Read ui/components/mapboard.js's header for why.
  //
  // The hint bar goes in as `chromeHtml` so it lands BETWEEN the scrollport and
  // the zoom bar, and the order is a fix rather than a preference: `.hint-bar`
  // is fixed to the bottom of the VIEWPORT, so once the zoom buttons stopped
  // floating and took the bottom of the map, the two claimed the same band and
  // the hint pill sat on top of the − and the ⊙ (map.css, `.mapscreen
  // .hint-bar`). It was never unpressable, so the reach sweep was right to stay
  // green — this was only ever visible to an eye.
  const board = mountMapBoard(app.querySelector('.mapscreen'), {
    act: { nodes: map.nodes, columns: map.columns, actNumber: run.actNumber, startIds: map.startIds, bossId: map.bossId },
    viewer: {
      meta, reachable, mode, reveal,
      current: run.mapNodeId || null,
      path: run.path || [],
      viewState: run.mapView,
      onViewStateChange: (viewState, { commit } = {}) => {
        run.mapView = viewState;
        if (commit && onSave) onSave();
      },
      onPick,
      tooltip: (n, { shownType, revealed }) => nodeTooltip(shownType, n, revealed),
    },
    chromeHtml: hintBarHtml('map'),
  });

  const strip = app.querySelector('.mh-relics');
  for (const rid of run.relics) {
    const def = registries.relics.get(rid);
    const el = document.createElement('div');
    el.className = 'relic';
    el.textContent = def.icon || '◆';
    attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def, registries))}`);
    strip.appendChild(el);
  }

  const flaskWrap = app.querySelector('.mh-flasks');
  for (const f of run.flasks) {
    const def = registries.flasks.get(f.flaskId);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'mh-flask';
    el.appendChild(flaskPresentation(def, { showName: false }));
    attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate || '')}`);
    el.addEventListener('click', () => {
      const plan = flaskActionPlan({
        context: 'run',
        canUse: false,
        useReason: 'Flasks can only be used in combat',
        canDrop: true,
      });
      mountFlaskActionMenu(el, {
        def,
        plan,
        onCancel: () => {},
        onAction: (actionId) => {
          if (actionId !== 'drop') return;
          const at = run.flasks.indexOf(f);
          if (at >= 0) run.flasks.splice(at, 1);
          el.remove();
        },
      });
    });
    flaskWrap.appendChild(el);
  }

  const armouryBtn = app.querySelector('#open-armoury');
  if (onArmoury) armouryBtn.addEventListener('click', () => onArmoury());
  else armouryBtn.remove();

  // Legend "?" popover: opens on click; a one-shot outside-click listener closes
  // it (added only while open, so it never leaks across screens). Lifted out of
  // the listener so the quick-nav's "Map legend" row opens the SAME popover
  // rather than growing a second copy of it.
  const legendBtn = app.querySelector('#map-legend');
  const legendPop = app.querySelector('.map-legend-pop');
  function toggleLegend() {
    const opening = legendPop.hidden;
    legendPop.hidden = !opening;
    if (opening) {
      const off = (ev) => {
        if (ev.target !== legendBtn && !legendPop.contains(ev.target)) {
          legendPop.hidden = true;
          document.removeEventListener('click', off, true);
        }
      };
      document.addEventListener('click', off, true);
    }
  }
  legendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLegend();
  });

  // ☰ — today it opens the overlay at Deck; under the quick-nav experiment it
  // opens the list of everywhere this screen can go. Every row below calls a
  // handler that already exists, so nothing here decides navigation state.
  const menuBtn = app.querySelector('#open-menu');
  if (onMenu) {
    menuBtn.addEventListener('click', (e) => {
      if (quickNavMode() === 'off') return onMenu('deck');
      e.stopPropagation();
      openQuickNav(menuBtn, 'map', {
        counts: { deck: run.deck.length },
        hasSave: !!(onSave || onQuit),
        actions: {
          tab: (id) => onMenu(id),
          ...(onArmoury ? { armoury: () => onArmoury() } : {}),
          legend: () => toggleLegend(),
          ...(onSave ? { save: saveAction(onSave) } : {}),
          ...(onQuit ? { quit: () => onQuit() } : {}),
        },
      });
    });
  }

  // Law 3 clause 4 — a real tooltip, hover AND focus cursor, with its text from
  // the same MENU table the rows read. `title=` alone (what these carried) is
  // invisible to touch and to a pad.
  for (const [sel, ctxAct] of [['#open-armoury', 'armoury'], ['#map-legend', 'legend']]) {
    const el = app.querySelector(sel);
    const row = (MENU.map || []).find((r) => r.act === ctxAct);
    if (el && row) attachTooltip(el, () => `<div class="tt-title">${esc(row.label)}</div>${esc(row.tip)}`);
  }
  attachTooltip(menuBtn, () =>
    `<div class="tt-title">Menu</div>${esc(quickNavMode() === 'off'
      ? 'Deck, relics, stats, settings and saving.'
      : 'Everywhere you can go from here.')}`);

  // Keyboard: M opens the menu overlay; + / − / 0 zoom; a standing veil owns
  // the keys while it is up. Removed when the screen is torn down (app.innerHTML
  // replaced). This guard read `overlayIsOpen()` — one veil of six — so zoom and
  // the menu keys stayed live under the settings modal and the quick-nav list.
  // Not the hand-losing one, and the same defect: components/veil.js.
  const mapKeys = (ev) => {
    // Still a backstop for map → anywhere-else, where nothing calls mountMap
    // again to do the tidying. The re-mount case is owned at the top of this
    // function; this branch can no longer be reached by a second map.
    if (!app.querySelector('.mapscreen')) {
      removeEventListener('keydown', mapKeys);
      if (liveMapKeys === mapKeys) liveMapKeys = null;
      return;
    }
    if (veilIsOpen()) return;
    const tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (matchAction(ev, 'menu') || matchAction(ev, 'deck')) {
      if (onMenu) onMenu('deck');
    } else if (matchAction(ev, 'relics')) {
      if (onMenu) onMenu('relics');
    } else if (matchAction(ev, 'stats')) {
      if (onMenu) onMenu('stats');
    } else if (ev.key === '+' || ev.key === '=') {
      board.stepZoom(1);
    } else if (ev.key === '-' || ev.key === '_') {
      board.stepZoom(-1);
    } else if (ev.key === '0') {
      board.resetFraming();
    }
  };
  addEventListener('keydown', mapKeys);
  liveMapKeys = mapKeys;

  // The camera settles on the board's own ResizeObserver + backstop; the focus
  // cursor lands once it has (only when the player is using keyboard/gamepad, so
  // mouse players get no stray ring).
  board.recenter(() => { if (isEngaged()) focusFirst('.map-node.reachable'); });
  liveMapBoard = board;
}

function nodeTooltip(type, node, revealed) {
  let t = `<div class="tt-title">Floor ${node.floor}</div>${nodeBlurb(type)}`;
  if (revealed) t += '<br><i>Revealed by the Sealstone Key.</i>';
  return t;
}
