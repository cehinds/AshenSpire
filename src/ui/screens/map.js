// src/ui/screens/map.js — the act map (SPEC §7.1, mockup: map-screen.svg)
//
// Full act visible; only edge-connected nodes from the current position are
// clickable; traveled path in gold. With the Sealstone Key passive, '?'
// nodes render their pre-rolled resolution (dashed ring marks a reveal).

import { passiveFlag } from '../../model/registries.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { veilIsOpen } from '../components/veil.js';
import { matchAction, isEngaged, focusFirst } from '../input.js';
import { hintBarHtml } from '../components/hints.js';
import { classGlyph, tintCss } from '../assets.js';
import { nodeIcon, nodeBlurb, actTitle, legendEntries, MENU } from '../uiContent.js';
import { openQuickNav, quickNavMode, saveAction } from '../components/quicknav.js';
import { trackGesture } from '../gesture.js';

const COL_X = 95;
const ROW_H = 46;

// Map zoom levels (%) selectable in-view and defaulted from settings.
const ZOOM_STEPS = [1, 1.15, 1.3, 1.5, 1.75, 2];
function defaultZoom(meta) {
  const pct = Number(((meta && meta.settings) || {}).mapZoom);
  const z = pct ? pct / 100 : 1.15;
  // Snap to the nearest step so +/- stays on the ladder.
  return ZOOM_STEPS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a), 1.15);
}

export function mountMap(app, { registries, run, meta, onPick, onSave, onQuit, onSettings, onMenu, onArmoury }) {
  const map = run.mapGraph;
  const nodes = Object.values(map.nodes);
  const maxFloor = Math.max(...nodes.map((n) => n.floor));
  // COLUMNS COME FROM THE GRAPH, not from a literal. This read `7 * COL_X + 60`,
  // so an act tuned to 6 or 9 columns drew its SVG at 7 regardless — a tunable
  // map whose view ignores the tuning is not tunable (Marina made this a
  // precondition of the config rework, not a footnote). generateActMap now puts
  // `columns` on the graph, so the view and the generator read one value.
  // A graph saved before that field existed falls back to the widest column it
  // actually uses, and SAYS SO — a silent fallback here would re-open exactly
  // the class of defect this change closes.
  let columns = map.columns;
  if (typeof columns !== 'number') {
    columns = Math.max(...nodes.map((n) => n.col)) + 1;
    console.warn(`[map] this run's graph predates \`columns\` on the map; drawing ${columns} derived from the nodes in use.`);
  }
  const width = columns * COL_X + 60;
  const height = (maxFloor + 1) * ROW_H + 30;
  const x = (col) => 60 + col * COL_X;
  const y = (floor) => height - floor * ROW_H;
  let zoom = defaultZoom(meta);

  const reachable = new Set(run.mapNodeId ? map.nodes[run.mapNodeId].next : map.startIds);
  const traveled = new Set(run.path || []);
  const reveal = passiveFlag(registries, run.relics, 'revealUnknown');

  // ---- edges (a traveled edge = consecutive pair in run.path) ----
  let edgeSvg = '';
  const path = run.path || [];
  for (const n of nodes) {
    for (const toId of n.next) {
      const to = map.nodes[toId];
      const ia = path.indexOf(n.id);
      const isTraveled = ia >= 0 && path[ia + 1] === toId;
      edgeSvg += `<line class="map-edge${isTraveled ? ' traveled' : ''}" x1="${x(n.col)}" y1="${y(n.floor)}" x2="${x(to.col)}" y2="${y(to.floor)}"/>`;
    }
  }

  const cz = run.customization || {};
  const hpPct = Math.max(0, Math.min(100, Math.round((run.hp / Math.max(1, run.maxHp)) * 100)));
  const className = registries.classes.get(run.class).name;
  const heroName = (cz.name || className).toUpperCase();
  const hasRelics = run.relics.length > 0;
  const hasFlasks = run.flasks.length > 0;

  app.innerHTML = `
    <div class="mapscreen">
      <header class="topbar map-header">
        <div class="portrait" style="border-color:${tintCss(cz.tint)}">${esc(cz.glyph || classGlyph(run.class))}</div>
        <div class="who">
          <span class="nm">${esc(heroName)} · ${esc(className.toUpperCase())}</span>
          <div class="bar hpbar"><div class="fill" style="width:${hpPct}%"></div><div class="label">HP ${run.hp} / ${run.maxHp}</div></div>
        </div>
        <span class="mh-stat cinders">⛁ ${run.cinders}</span>
        <span class="mh-stat mh-prog">${run.actNumber > 3 ? `Act ${run.actNumber}` : `Act ${run.actNumber} / 3`} · Floor ${run.floor} / ${map.floors}</span>
        <span class="mh-stat mh-seed" title="Run seed">SEED ${esc(run.seedString)}</span>
        <div class="mh-actions">
          <button class="topbar-btn" id="open-armoury" title="Armoury">⚒</button>
          <button class="topbar-btn" id="map-legend" title="Map legend">?</button>
          <button class="topbar-btn" id="open-menu" title="Menu (M)">☰</button>
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
      <div class="map-scroll">
        <div class="map-canvas">
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <text x="${width / 2}" y="24" text-anchor="middle" fill="var(--gold)" font-size="17" letter-spacing="4" font-family="Georgia,serif">${actTitle(run.actNumber)}</text>
            ${edgeSvg}
            <g id="map-nodes"></g>
          </svg>
        </div>
      </div>
      <!-- OUTSIDE .map-scroll, and that is the whole fix (EldenSpire#28).
           These three buttons used to be the last child of the scrollport,
           absolutely positioned over it, so they covered a piece of the
           pannable canvas. WHICH piece is a coincidence of shape x map zoom x
           pan offset x seed, and at 412x915 the coincidence was two map nodes a
           player could see and could not tap. A sibling of .map-scroll is laid
           out in the flow beside it, so the scrollport is smaller by exactly
           the bar and there is no offset left for a node to be trapped at.
           (No backticks in here: this block is inside a template literal, and
           the first draft of it closed the string and took the screen down.) -->
      <!-- The hint bar is ABOVE the zoom bar here, and the order is the fix for
           a defect the first draft of this change introduced. .hint-bar is
           position: fixed to the bottom of the VIEWPORT and centred, so once the
           zoom buttons stopped floating and took the bottom of the map, the two
           claimed the same band: at 390x844 and 412x915 the hint pill sat on top
           of the − and the ⊙ and made them unreadable. It is pointer-events:
           none, so nothing was unpressable and the reach sweep was right to stay
           green — this was only ever visible to an eye. Both are in the flow
           here (see .mapscreen .hint-bar in map.css), so the map's bottom chrome
           is one stack with no reserved height anywhere. -->
      ${hintBarHtml('map')}
      <div class="map-zoom">
        <button class="zbtn" id="zoom-out" title="Zoom out">−</button>
        <button class="zbtn" id="zoom-reset" title="Reset / center">⊙</button>
        <button class="zbtn" id="zoom-in" title="Zoom in">+</button>
      </div>
    </div>`;

  const g = app.querySelector('#map-nodes');
  for (const n of nodes) {
    const isReachable = reachable.has(n.id);
    let shownType = n.type;
    let revealed = false;
    if (n.type === 'event' && reveal && n.resolved) {
      shownType = n.resolved.kind === 'event' ? 'event' : n.resolved.kind;
      revealed = n.resolved.kind !== 'event';
    }
    const cls = [
      'map-node',
      shownType,
      traveled.has(n.id) || n.id === run.mapNodeId ? 'visited' : '',
      n.id === run.mapNodeId ? 'current' : '',
      isReachable ? 'reachable' : '',
      revealed ? 'revealed' : '',
    ].filter(Boolean).join(' ');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', cls);
    const r = n.type === 'boss' ? 20 : 15;
    // Reachable nodes get a rhythmic pulsing halo so the next choices read at
    // a glance; the halo is inert when reduced-motion is set (CSS handles it).
    const halo = isReachable ? `<circle class="node-halo" cx="${x(n.col)}" cy="${y(n.floor)}" r="${r + 6}"/>` : '';
    el.innerHTML = `${halo}<circle cx="${x(n.col)}" cy="${y(n.floor)}" r="${r}"/><text x="${x(n.col)}" y="${y(n.floor)}">${nodeIcon(shownType)}</text>`;
    if (isReachable) el.addEventListener('click', () => onPick(n.id));
    attachTooltip(el, () => nodeTooltip(shownType, n, revealed));
    g.appendChild(el);
  }

  const strip = app.querySelector('.mh-relics');
  for (const rid of run.relics) {
    const def = registries.relics.get(rid);
    const el = document.createElement('div');
    el.className = 'relic';
    el.textContent = def.icon || '◆';
    attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(relicText(def))}`);
    strip.appendChild(el);
  }

  const flaskWrap = app.querySelector('.mh-flasks');
  for (const f of run.flasks) {
    const def = registries.flasks.get(f.flaskId);
    const el = document.createElement('span');
    el.className = 'mh-flask';
    el.textContent = def.icon || '🧪';
    attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate || '')}`);
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

  // ---- zoom + centering (SPEC §7.1 map UX) ----
  const scroll = app.querySelector('.map-scroll');
  const svgEl = app.querySelector('.map-scroll svg');

  // The svg scales by setting its pixel width/height (viewBox unchanged), so
  // the scroll container grows and native scrollbars appear.
  function applyZoom(center) {
    svgEl.style.width = `${width * zoom}px`;
    svgEl.style.height = `${height * zoom}px`;
    if (center) centerOnCurrent();
  }

  // Scroll so the current node sits in the middle of the viewport. At run
  // start there is no current node yet, so frame the reachable start nodes
  // (their centroid) — the requested default framing.
  function centerOnCurrent() {
    let fx;
    let fy;
    if (run.mapNodeId && map.nodes[run.mapNodeId]) {
      const f = map.nodes[run.mapNodeId];
      fx = x(f.col);
      fy = y(f.floor);
    } else {
      const rs = nodes.filter((n) => reachable.has(n.id));
      if (!rs.length) return;
      fx = rs.reduce((a, n) => a + x(n.col), 0) / rs.length;
      fy = rs.reduce((a, n) => a + y(n.floor), 0) / rs.length;
    }
    scroll.scrollTop = Math.max(0, fy * zoom - scroll.clientHeight / 2);
    scroll.scrollLeft = Math.max(0, fx * zoom - scroll.clientWidth / 2);
  }

  function setZoom(next, keepCenter = true) {
    zoom = Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], next));
    applyZoom(keepCenter);
  }
  const stepZoom = (dir) => {
    const i = ZOOM_STEPS.findIndex((z) => Math.abs(z - zoom) < 0.001);
    const ni = Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir));
    setZoom(ZOOM_STEPS[ni]);
  };
  app.querySelector('#zoom-in').addEventListener('click', () => stepZoom(1));
  app.querySelector('#zoom-out').addEventListener('click', () => stepZoom(-1));
  app.querySelector('#zoom-reset').addEventListener('click', () => centerOnCurrent());

  // Ctrl/⌘ + wheel zooms toward the pointer-ish center; plain wheel scrolls.
  scroll.addEventListener(
    'wheel',
    (ev) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      ev.preventDefault();
      stepZoom(ev.deltaY < 0 ? 1 : -1);
    },
    { passive: false }
  );

  // Drag-to-pan (in addition to scrollbars).
  let panning = false;
  let sx = 0;
  let sy = 0;
  let sl = 0;
  let st = 0;
  scroll.addEventListener('pointerdown', (ev) => {
    // The `.map-zoom` half of this guard went with the overlay (EldenSpire#28).
    // This listener is on .map-scroll and the buttons are no longer inside it,
    // so a press on one cannot reach here to be excluded. Left in, it would be
    // a line that reads like protection and can never run — and the next reader
    // would take it as evidence the buttons are still in the scrollport.
    if (ev.target.closest('.map-node.reachable')) return;
    panning = true;
    sx = ev.clientX;
    sy = ev.clientY;
    sl = scroll.scrollLeft;
    st = scroll.scrollTop;
    scroll.classList.add('grabbing');
    // #22's lifecycle, same helper as the cards (src/ui/gesture.js). The old
    // shape added THREE listeners to window per MOUNT and removed none — pan
    // cleanup ran only on a pointerup that reached window, so a cancelled pan
    // left `.grabbing` stuck and the stale movers stacked per visit (Vira's
    // table). Listeners now live on the scroller and die with it; cancel ends
    // the pan exactly as release does — a pan has nothing to abandon.
    trackGesture(ev, {
      onMove: (mv) => {
        if (!panning) return;
        scroll.scrollLeft = sl - (mv.clientX - sx);
        scroll.scrollTop = st - (mv.clientY - sy);
      },
      onEnd: () => {
        panning = false;
        scroll.classList.remove('grabbing');
      },
    });
  });

  // Keyboard: M opens the menu overlay; + / − / 0 zoom; a standing veil owns
  // the keys while it is up. Removed when the screen is torn down (app.innerHTML
  // replaced). This guard read `overlayIsOpen()` — one veil of six — so zoom and
  // the menu keys stayed live under the settings modal and the quick-nav list.
  // Not the hand-losing one, and the same defect: components/veil.js.
  const mapKeys = (ev) => {
    if (!app.querySelector('.mapscreen')) {
      removeEventListener('keydown', mapKeys);
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
      stepZoom(1);
    } else if (ev.key === '-' || ev.key === '_') {
      stepZoom(-1);
    } else if (ev.key === '0') {
      centerOnCurrent();
    }
  };
  addEventListener('keydown', mapKeys);

  applyZoom(false);
  // Auto-center the camera on the current node. The flex container may report
  // height 0 until layout settles (the header/sub-strip above it size first), so
  // center on the first non-zero size via a ResizeObserver, with a timeout
  // backstop. Smart default: land the cursor on a reachable next node (only once
  // the player is using keyboard/gamepad, so mouse players get no stray ring).
  function centerAndFocus() {
    centerOnCurrent();
    if (isEngaged()) focusFirst('.map-node.reachable');
  }
  if (scroll.clientHeight > 0) {
    centerAndFocus();
  } else if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (scroll.clientHeight > 0) {
        centerAndFocus();
        ro.disconnect();
      }
    });
    ro.observe(scroll);
  }
  // Backstop in case the observer never fires (e.g. instant layout): re-center
  // shortly after mount. Cheap and idempotent.
  setTimeout(centerAndFocus, 120);
}

function nodeTooltip(type, node, revealed) {
  let t = `<div class="tt-title">Floor ${node.floor}</div>${nodeBlurb(type)}`;
  if (revealed) t += '<br><i>Revealed by the Sealstone Key.</i>';
  return t;
}
