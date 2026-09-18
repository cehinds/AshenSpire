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
// not — the hero header, the relic strip, the legend, the quick-nav, the map
// tray (hint bar, Potions, the selected node and Back / Enter), and this
// screen's own keyboard handler.
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
import { wireframeUi } from '../../content/wireframeUi.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { veilIsOpen } from '../components/veil.js';
import { matchAction, actionDestinationForEvent, isEngaged, focusFirst, focusElement } from '../input.js';
import { hintBarHtml } from '../components/hints.js';
import { nodeBlurb, actTitle, legendEntries, MENU } from '../uiContent.js';
import { mountMapBoard } from '../components/mapboard.js';
import { resolveMapMode } from '../../model/mapknowledge.js';
import { actRouteStripHtml } from '../components/actRouteStrip.js';
import { seatNameOf } from '../components/runHud.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { mountRunPotions } from '../components/runPotions.js';
import { button, el, popover, row } from '../kit/index.js';
import { t } from '../strings.js';
import { pickMapNode, projectMapContext } from '../models/MapSelectionModel.js';
import { MAP_HEADER_LAYOUT, sizeMapHeader } from '../components/mapHeader.js';
import { reducedMotionRequested } from '../motion.js';

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
let liveMapViewportRelease = null;

export function mountMap(app, { registries, run, meta, onPick, onSave, onQuit, onLoad, onQuitWithoutSave, onSettings, onSettingsChange, onMenu, onArmoury, quickControls = {} }) {
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
  liveMapViewportRelease?.();
  liveMapViewportRelease = null;
  const remount = () => mountMap(app, { registries, run, meta, onPick, onSave, onQuit, onLoad, onQuitWithoutSave, onSettings, onSettingsChange, onMenu, onArmoury, quickControls });
  const map = run.mapGraph;
  // WHAT THIS RUN KNOWS AND MAY DO — the viewer's half, and the only half this
  // screen still computes. Geometry, drawing and the camera are the board's
  // (ui/components/mapboard.js).
  const reachable = new Set(run.mapNodeId ? map.nodes[run.mapNodeId].next : map.startIds);
  const reveal = passiveFlag(registries, run.relics, 'revealUnknown');
  const mode = resolveMapMode(meta);
  const fog = mode === 'fog';

  const atEntrance = !run.mapNodeId;
  // THE LEGEND IS THE KIT'S POPOVER: one Row per node kind, its icon the Row's
  // Glyph in the kind's own tint. It hangs off the ? in the zoom bar and is
  // read, never chosen — so the Rows are static.
  const legendPopover = () => popover({
    caption: 'Map legend',
    className: 'map-legend-pop',
    attrs: { hidden: '' },
    groups: [legendEntries().map((e) => {
      const legendRow = row({ glyph: e.icon, label: e.name, tag: 'div', className: 'static' });
      const g = legendRow.querySelector('.as-glyph');
      g.classList.add('ic');
      if (e.tint) g.style.color = e.tint;
      return legendRow;
    })],
  });

  app.innerHTML = `
    <div class="mapscreen${fog ? ' map-fog' : ''}${atEntrance ? ' map-entrance' : ''}">
      <!-- ONE HUD SHELL: the same band combat, the merchant, the Shrine and an event mount (components/runHud.js). -->
      <!-- W4b: in its 10 vh map context, with the route strip laid out inside it (components/mapHeader.js). -->
      ${runHudHtml({
        registries, run, meta, place: 'map', headerClass: 'map-header', layout: MAP_HEADER_LAYOUT,
        orientationHtml: actRouteStripHtml({ title: actTitle(run.actNumber, run.journey ? null : seatNameOf(registries, run)) }),
      })}
    </div>`;
  // ---- THE HUD, AND IT IS THE COMBAT HUD ---------------------------------
  // Bars, relics, Armoury and Menu: components/runHud.js fills the band for
  // every room, so the map cannot drift from the merchant or the Shrine any
  // more than it could from combat (E9 / #254).
  wireRunHud(app, {
    registries, run, meta, onArmoury, onMenu, onLoad, onSave, onQuit, onQuitWithoutSave, quickControls, onSettingsChange, remount,
  });
  // W4b's 10 vh header takes its height NOW, before the board mounts: the
  // board checks a saved fit camera against the scene's height (see below).
  sizeMapHeader(app);

  // ---- THE BOARD -------------------------------------------------------
  //
  // ONE RENDERER, and this is the whole of the map on this screen. Everything
  // it draws — the SVG, the edges, the fog ground, every node, the camera, the
  // zoom bar and the delivered-tap-size note — is the same code the co-op
  // client mounts. Read ui/components/mapboard.js's header for why.
  //
  // ---- THE MAP TRAY (owner, 2026-09-14) -------------------------------------
  //
  // One row at the foot of the map: the zoom bar left, the hint bar centred,
  // Potions in the corner where combat's footer keeps it. The row is the only
  // part of the tray that takes layout height, so the scene's height, and the
  // camera framed against it, never change while the tray works.
  //
  // Picking a lit node OPENS the tray: after a beat it slides up over the foot
  // of the map, never higher than today's bottom band reached, and shows the
  // node's context with Back and Enter centred clear of Potions. The camera
  // recentres the picked node in the map still visible above it. Back, or a
  // tap anywhere on the map but a lit node, closes it and the camera recentres
  // on the whole map. The footer's Recenter went with the old footer: it did
  // exactly what the zoom bar's ⊙ does.
  //
  // The tray and the hint bar are built BEFORE the board mounts: the board
  // checks a saved fit camera against the scene's height, so everything that
  // takes height must already have it, or every remount would discard the
  // player's pan. The zoom bar, which is the board's, joins the row once it
  // exists; it is no taller than Potions, so that changes no height.
  const screen = app.querySelector('.mapscreen');
  let selection = { selectedId: null };
  const readings = new Map();
  const context = el('section', { class: 'map-context', 'aria-label': t('map.context.aria') });
  const backButton = button({ label: t('map.back'), id: 'map-back', className: 'map-back' });
  const enterButton = button({ label: t('map.enter'), weight: 'primary', id: 'map-enter', className: 'map-enter', disabled: true });
  const trayReveal = el('div', { class: 'map-tray-reveal' }, [context, el('div', { class: 'map-tray-pair' }, [backButton, enterButton])]);
  trayReveal.inert = true;
  const potionsHost = el('div', { class: 'map-potions' });
  const trayRow = el('div', { class: 'map-tray-row' });
  trayRow.insertAdjacentHTML('beforeend', hintBarHtml('map'));
  trayRow.appendChild(potionsHost);
  const tray = el('div', { class: 'map-tray', dataset: { open: 'false', shown: 'false' } }, [trayReveal, trayRow]);
  mountRunPotions(potionsHost, { registries, run, meta, onChange: () => { onSave?.(); remount(); } });
  screen.append(tray);
  renderSelection();
  const board = mountMapBoard(screen, {
    act: { seedString: run.seedString, nodes: map.nodes, columns: map.columns, actNumber: run.actNumber, seatName: seatNameOf(registries, run), startIds: map.startIds, bossId: map.bossId, bossIds: map.bossIds },
    showLegendControl: true,
    viewer: {
      meta, reachable, mode, reveal,
      current: run.mapNodeId || null,
      path: run.path || [],
      viewState: run.mapView,
      onViewStateChange: (viewState, { commit } = {}) => {
        run.mapView = viewState;
        if (commit && onSave) onSave();
      },
      // W4b: a pick selects; Enter, or picking the selected node again, travels.
      onPick: (id, reading) => selectNode(id, reading),
      tooltip: (n, { shownType, revealed }) => nodeTooltip(shownType, n, revealed),
    },
  });
  const zoomBar = app.querySelector('.map-zoom');
  if (zoomBar) trayRow.prepend(zoomBar);
  // Below the board and its notes; moving it changes no height.
  screen.append(tray);
  // Live only after the resting text is in place: a mount announces nothing.
  context.setAttribute('aria-live', 'polite');

  // ---- W4b: SELECT, THEN ENTER — in the tray ------------------------------
  const trayTiming = wireframeUi.map.tray;
  let trayTimer = 0;
  const reduced = () => reducedMotionRequested();
  const wait = (ms, fn) => { clearTimeout(trayTimer); trayTimer = setTimeout(fn, reduced() ? 0 : ms); };
  const glideMs = () => (reduced() ? 0 : trayTiming.cameraMs);
  function openTray() {
    if (tray.dataset.open === 'true') {
      // Already open (or closing): stay open, and recentre on the new pick.
      clearTimeout(trayTimer);
      tray.dataset.shown = 'true';
      trayReveal.inert = false;
      board.centerOnNode(selection.selectedId, { inset: trayReveal.scrollHeight, glideMs: glideMs() });
      return;
    }
    wait(trayTiming.openDelayMs, () => {
      const height = trayReveal.scrollHeight;
      tray.dataset.open = 'true';
      trayReveal.inert = false;
      trayReveal.style.height = `${height}px`;
      board.centerOnNode(selection.selectedId, { inset: height, glideMs: glideMs() });
      wait(trayTiming.slideMs, () => {
        tray.dataset.shown = 'true';
        if (isEngaged() && !enterButton.disabled) focusElement(enterButton);
      });
    });
  }
  function closeTray() {
    clearTimeout(trayTimer);
    if (tray.dataset.open !== 'true') return;
    tray.dataset.shown = 'false';
    trayReveal.inert = true;
    wait(trayTiming.fadeMs, () => {
      tray.dataset.open = 'false';
      trayReveal.style.height = '0px';
      board.resetFraming({ glideMs: glideMs() });
    });
  }
  backButton.addEventListener('click', () => clearSelection());
  enterButton.addEventListener('click', () => {
    if (selection.selectedId && reachable.has(selection.selectedId)) onPick(selection.selectedId);
  });
  // A tap on the map away from the lit nodes closes the tray; a mouse drag
  // that pans the board is not a tap.
  let pressAt = null;
  board.scroll.addEventListener('pointerdown', (ev) => { pressAt = { x: ev.clientX, y: ev.clientY }; });
  board.scroll.addEventListener('click', (ev) => {
    const moved = pressAt ? Math.hypot(ev.clientX - pressAt.x, ev.clientY - pressAt.y) : 0;
    pressAt = null;
    if (moved > 6 || ev.target.closest('.map-node.reachable')) return;
    clearSelection();
  });
  function selectNode(id, reading) {
    if (reading) readings.set(id, reading);
    const next = pickMapNode(selection, id, reachable, { now: performance.now(), repeatDelayMs: wireframeUi.map.repeatPickDelayMs });
    if (next.enter) { onPick(id); return; }
    selection = next;
    renderSelection();
    if (selection.selectedId) openTray();
  }
  function clearSelection() {
    if (!selection.selectedId) return;
    selection = { selectedId: null };
    renderSelection();
    closeTray();
  }
  function renderSelection() {
    for (const node of app.querySelectorAll('.map-node.selected')) node.classList.remove('selected');
    const id = selection.selectedId;
    if (id) app.querySelector(`.map-node[data-node="${id}"]`)?.classList.add('selected');
    const view = projectMapContext({ node: id ? map.nodes[id] : null, reading: readings.get(id), reachable: !!id && reachable.has(id) });
    context.replaceChildren(...(view.empty
      ? [el('p', { class: 'map-context-line', text: t('map.context.empty') })]
      : [
        el('p', { class: 'as-eyebrow', text: t('map.context.floor', { floor: view.floor }) }),
        el('h2', { class: 'map-context-title', text: view.kindName }),
        ...[view.blurb, view.destination, view.revealed ? t('map.context.revealed') : '']
          .filter(Boolean).map((text) => el('p', { class: 'map-context-line', text })),
      ]));
    enterButton.disabled = !view.canEnter;
    enterButton.textContent = view.canEnter ? t('map.enterNamed', { name: view.kindName }) : t('map.enter');
  }

  // The legend hangs off the ? IN THE ZOOM BAR, so it is mounted inside that
  // Band — the Band is its containing block, which is how `bottom: 100%` means
  // "above the bar" at every shape (Law 2: a positioned thing names its box).
  app.querySelector('.map-zoom').appendChild(legendPopover());

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

  // Law 3 clause 4 — a real tooltip, hover AND focus cursor, with its text from
  // the same MENU table the rows read. `title=` alone (what these carried) is
  // invisible to touch and to a pad.
  {
    const legendRow = (MENU.map || []).find((r) => r.act === 'legend');
    if (legendRow) attachTooltip(legendBtn, () => `<div class="tt-title">${esc(legendRow.label)}</div>${esc(legendRow.tip)}`);
  }

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
    const armouryAction = actionDestinationForEvent(ev);
    if (matchAction(ev, 'menu')) {
      if (onMenu) onMenu('settings');
    } else if (armouryAction) {
      if (onArmoury) onArmoury(armouryAction);
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
  let frameA = 0;
  let frameB = 0;
  const recenterAfterSettle = () => {
    // The header follows the viewport first, so the camera settles against
    // the scene height it will actually have.
    if (app.querySelector('.mapscreen')) sizeMapHeader(app);
    cancelAnimationFrame(frameA);
    cancelAnimationFrame(frameB);
    frameA = requestAnimationFrame(() => {
      frameB = requestAnimationFrame(() => {
        if (app.querySelector('.mapscreen')) board.recenter();
      });
    });
  };
  const viewport = window.visualViewport;
  window.addEventListener('resize', recenterAfterSettle);
  for (const type of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(type, recenterAfterSettle);
  viewport?.addEventListener('resize', recenterAfterSettle);
  liveMapViewportRelease = () => {
    cancelAnimationFrame(frameA); cancelAnimationFrame(frameB);
    clearTimeout(trayTimer);
    window.removeEventListener('resize', recenterAfterSettle);
    for (const type of ['fullscreenchange', 'webkitfullscreenchange']) document.removeEventListener(type, recenterAfterSettle);
    viewport?.removeEventListener('resize', recenterAfterSettle);
  };
  liveMapBoard = board;
}

function nodeTooltip(type, node, revealed) {
  let t = `<div class="tt-title">Floor ${node.floor}</div>${nodeBlurb(type)}`;
  if (type === 'boss' && node.destinationLabel) t += `<br><strong>${esc(node.destinationLabel)}</strong>`;
  if (revealed) t += '<br><i>Revealed by the Sealstone Key.</i>';
  return t;
}
