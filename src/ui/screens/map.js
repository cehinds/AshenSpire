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
import { veilIsOpen } from '../components/veil.js';
import { matchAction, actionDestinationForEvent, isEngaged, focusFirst } from '../input.js';
import { hintBarHtml } from '../components/hints.js';
import { nodeBlurb, actTitle, legendEntries, MENU } from '../uiContent.js';
import { mountMapBoard } from '../components/mapboard.js';
import { resolveMapMode } from '../../model/mapknowledge.js';
import { actRouteStripHtml } from '../components/actRouteStrip.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { popover, row } from '../kit/index.js';

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
      ${runHudHtml({ registries, run, meta, place: 'map', headerClass: 'map-header' })}
      ${actRouteStripHtml({ title: actTitle(run.actNumber) })}
    </div>`;
  // ---- THE HUD, AND IT IS THE COMBAT HUD ---------------------------------
  // Bars, relics, flasks, Armoury and Menu: components/runHud.js fills the
  // band for every room, so the map cannot drift from the merchant or the
  // Shrine any more than it could from combat (E9 / #254).
  wireRunHud(app, {
    registries, run, meta, onArmoury, onMenu, onLoad, onSave, onQuit, onQuitWithoutSave, quickControls, onSettingsChange,
    remount: () => mountMap(app, { registries, run, meta, onPick, onSave, onQuit, onLoad, onQuitWithoutSave, onSettings, onSettingsChange, onMenu, onArmoury, quickControls }),
  });

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
  // The legend belongs to the corner it opens from — the ? in the zoom bar — so
  // it is mounted with the board's chrome, not on the HUD.
  const board = mountMapBoard(app.querySelector('.mapscreen'), {
    act: { seedString: run.seedString, nodes: map.nodes, columns: map.columns, actNumber: run.actNumber, startIds: map.startIds, bossId: map.bossId, bossIds: map.bossIds },
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
      onPick,
      tooltip: (n, { shownType, revealed }) => nodeTooltip(shownType, n, revealed),
    },
    chromeHtml: hintBarHtml('map'),
  });

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
