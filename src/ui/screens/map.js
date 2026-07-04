// src/ui/screens/map.js — the act map (SPEC §7.1, mockup: map-screen.svg)
//
// Full act visible; only edge-connected nodes from the current position are
// clickable; traveled path in gold. With the Stonesword Key passive, '?'
// nodes render their pre-rolled resolution (dashed ring marks a reveal).

import { passiveFlag } from '../../model/registries.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { openPileModal } from '../components/piles.js';

const ICONS = {
  monster: '⚔',
  event: '?',
  elite: '☠',
  shrine: '♨',
  merchant: '⚖',
  treasure: '▣',
  boss: '👁',
  fight: '⚔',
};

const COL_X = 95;
const ROW_H = 46;

const ACT_NAMES = {
  1: 'ACT I — THE FALLOW MARCHES',
  2: 'ACT II — THE GRAFTED COURT',
  3: 'ACT III — THE ASHEN CROWN',
};

// Map zoom levels (%) selectable in-view and defaulted from settings.
const ZOOM_STEPS = [1, 1.15, 1.3, 1.5, 1.75, 2];
function defaultZoom(meta) {
  const pct = Number(((meta && meta.settings) || {}).mapZoom);
  const z = pct ? pct / 100 : 1.15;
  // Snap to the nearest step so +/- stays on the ladder.
  return ZOOM_STEPS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a), 1.15);
}

export function mountMap(app, { registries, run, meta, onPick, onSave, onSettings }) {
  const map = run.mapGraph;
  const nodes = Object.values(map.nodes);
  const maxFloor = Math.max(...nodes.map((n) => n.floor));
  const width = 7 * COL_X + 60;
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

  app.innerHTML = `
    <div class="mapscreen">
      <div class="map-scroll">
        <div class="map-canvas">
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <text x="${width / 2}" y="24" text-anchor="middle" fill="var(--gold)" font-size="17" letter-spacing="4" font-family="Georgia,serif">${ACT_NAMES[run.actNumber] || `ACT ${run.actNumber}`}</text>
            ${edgeSvg}
            <g id="map-nodes"></g>
          </svg>
        </div>
        <div class="map-zoom">
          <button class="zbtn" id="zoom-out" title="Zoom out">−</button>
          <button class="zbtn" id="zoom-reset" title="Reset / center">⊙</button>
          <button class="zbtn" id="zoom-in" title="Zoom in">+</button>
        </div>
      </div>
      <aside class="map-side">
        <h2>THE CLIMB</h2>
        <div class="hud-line"><span>HP</span><b>${run.hp} / ${run.maxHp}</b></div>
        <div class="hud-line"><span>Runes</span><b style="color:var(--gold)">${run.runes}</b></div>
        <div class="hud-line"><span>Act</span><b>${run.actNumber} / 3</b></div>
        <div class="hud-line"><span>Floor</span><b>${run.floor} / ${map.floors}</b></div>
        <div class="hud-line"><span>Seed</span><b style="font-family:monospace">${esc(run.seedString)}</b></div>
        <div class="hud-line"><span>Flasks</span><b>${run.flasks.map((f) => registries.flasks.get(f.flaskId).icon).join(' ') || '—'}</b></div>
        <div class="relic-strip"></div>
        <div class="legend">
          <div><span class="ic">⚔</span>Monster</div>
          <div><span class="ic">?</span>Unknown</div>
          <div><span class="ic" style="color:var(--ember)">☠</span>Elite</div>
          <div><span class="ic" style="color:var(--gold)">♨</span>Shrine of Grace</div>
          <div><span class="ic" style="color:var(--grace)">⚖</span>Merchant</div>
          <div><span class="ic" style="color:var(--gold)">▣</span>Treasure</div>
        </div>
        <div class="map-buttons">
          <button class="subtle deck-btn" id="view-deck">View deck (${run.deck.length})</button>
          <button class="subtle deck-btn" id="save-run">Save</button>
          <button class="subtle deck-btn" id="map-settings">Settings</button>
        </div>
      </aside>
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
    el.innerHTML = `${halo}<circle cx="${x(n.col)}" cy="${y(n.floor)}" r="${r}"/><text x="${x(n.col)}" y="${y(n.floor)}">${ICONS[shownType] || '?'}</text>`;
    if (isReachable) el.addEventListener('click', () => onPick(n.id));
    attachTooltip(el, () => nodeTooltip(shownType, n, revealed));
    g.appendChild(el);
  }

  const strip = app.querySelector('.relic-strip');
  for (const rid of run.relics) {
    const def = registries.relics.get(rid);
    const el = document.createElement('div');
    el.className = 'relic';
    el.textContent = def.icon || '◆';
    attachTooltip(el, () => `<div class="tt-title">${esc(def.name)}</div>${esc(def.textTemplate.replace(/[{}]/g, ''))}`);
    strip.appendChild(el);
  }

  app.querySelector('#view-deck').addEventListener('click', () => {
    openPileModal(registries, 'Your deck', run.deck);
  });

  app.querySelector('#save-run').addEventListener('click', () => {
    const slot = onSave ? onSave() : null;
    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.textContent = slot ? `Saved to Slot ${slot}` : 'Saved';
    app.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  });

  if (onSettings) app.querySelector('#map-settings').addEventListener('click', onSettings);

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
    if (ev.target.closest('.map-node.reachable') || ev.target.closest('.map-zoom')) return;
    panning = true;
    sx = ev.clientX;
    sy = ev.clientY;
    sl = scroll.scrollLeft;
    st = scroll.scrollTop;
    scroll.classList.add('grabbing');
  });
  addEventListener('pointermove', (ev) => {
    if (!panning) return;
    scroll.scrollLeft = sl - (ev.clientX - sx);
    scroll.scrollTop = st - (ev.clientY - sy);
  });
  addEventListener('pointerup', () => {
    panning = false;
    scroll.classList.remove('grabbing');
  });

  applyZoom(false);
  // Center once the flex container actually has a measured height. A rAF can
  // fire before layout settles (clientHeight 0), so observe the box and center
  // on its first non-zero size, then stop.
  if (scroll.clientHeight > 0) {
    centerOnCurrent();
  } else if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      if (scroll.clientHeight > 0) {
        centerOnCurrent();
        ro.disconnect();
      }
    });
    ro.observe(scroll);
  } else {
    setTimeout(centerOnCurrent, 60);
  }
}

function nodeTooltip(type, node, revealed) {
  const names = {
    monster: 'Monster — a fight, runes, and a card reward.',
    event: 'Unknown — an event, a fight, a shrine… who can say.',
    elite: 'Elite — dangerous. Drops a relic.',
    shrine: 'Shrine of Grace — rest (heal) or smith (upgrade a card).',
    merchant: 'Merchant — cards, relics, flasks, card removal.',
    treasure: 'Treasure — a relic, free.',
    boss: 'The Watchful Omen. He has been waiting.',
    fight: 'An ambush revealed by the Stonesword Key.',
  };
  let t = `<div class="tt-title">Floor ${node.floor}</div>${names[type] || ''}`;
  if (revealed) t += '<br><i>Revealed by the Stonesword Key.</i>';
  return t;
}
