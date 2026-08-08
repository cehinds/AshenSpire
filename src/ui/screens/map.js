// src/ui/screens/map.js — the act map (SPEC §7.1, mockup: map-screen.svg)
//
// TWO MODES, and the toggle is Settings → Display · Map reveal:
//
//   path  the game as it shipped — the whole act drawn, only edge-connected
//         nodes from the current position clickable, traveled path in gold.
//   fog   the doors, the boss, the trail behind you and the split in front of
//         you. Everything else is unlit parchment.
//
// WHAT IS DRAWN IS NOT WHAT IS CLICKABLE, and keeping those two apart is the
// whole of this change. `reachable` has always governed CLICKS and still does,
// untouched. Fog governs DRAWING, and it asks a different question of a
// different set — the ladder in model/mapknowledge.js. Read that file's header
// before touching either: collapsing them is the trap it was written to close.
//
// The Sealstone Key is no longer a case this screen checks for. It is the
// operator that lifts a node from `placed` to `known`, in both modes, and it
// lives with the ladder.

import { passiveFlag } from '../../model/registries.js';
import { attachTooltip, esc } from '../components/tooltip.js';
import { relicText } from '../components/card.js';
import { veilIsOpen } from '../components/veil.js';
import { matchAction, isEngaged, focusFirst } from '../input.js';
import { hintBarHtml } from '../components/hints.js';
import { classGlyph, tintCss } from '../assets.js';
import { assetUrl } from '../assetmap.js';
import { nodeIcon, nodeBlurb, actTitle, legendEntries, MENU, parchmentAsset, parchmentClass } from '../uiContent.js';
import { openQuickNav, quickNavMode, saveAction } from '../components/quicknav.js';
import { trackGesture } from '../gesture.js';
import {
  mapKnowledge, nodeReading, resolveMapMode, HIDDEN, KNOWN,
} from '../../model/mapknowledge.js';
// GEOMETRY AND THE LADDER LIVE IN model/mapview.js NOW, with the arithmetic that
// turns them into "does this act fit on a phone" — read by this screen, by the
// boot validator, and by tools/mapfit.mjs. Read its header before changing a
// number here: `columns` refuses at boot against these same values.
import {
  ZOOM_STEPS, ZOOM_MIN, MAP_ZOOM_DEFAULT,
  clampZoom, framingBox, fitZoom, nodeRadius, nodeX, nodeY, svgWidth, svgHeight,
  NODE_R, TAP_TARGET_DEFAULT, deliveredNodePx,
} from '../../model/mapview.js';

/**
 * The player's zoom as a NUMBER, or null when they asked the map to compute one.
 *
 * A PERCENTAGE IS THE DEFAULT AND `Fit` IS THE OPT-IN — Sunna's ruling on #107,
 * and the reversal of what this file said for one night. The machinery below is
 * unchanged and correct: given a viewport it finds the zoom at which the current
 * node and everything it connects to are on screen, which is what Constantine
 * asked for. Her hold is about what that zoom LOOKS like when it arrives alone.
 *
 * Measured, `mapfit --only 390x844`, 60 cells: 52 sit on a ladder bound, and
 * 43 of 48 MID-CLIMB cells sit at 1.968-2.000. Mid-climb the decision is two or
 * three nodes, so "fit the decision" is arithmetic for "maximum zoom": 8-9 of 13
 * floors, 2-3 of 7 columns, and THE BOSS IS NEVER ON SCREEN — against 13 of 13
 * floors and the boss on every mid-climb cell at 115%, same code, same cells.
 *
 *   "It reads as a map that has been CROPPED, and nothing on screen says the
 *    crop was a choice. The camera arrived without the dark."   — Sunna
 *
 * Fog and parchment are what make a close frame read as intended and they are
 * not on this branch, so the A/B Constantine asked for cannot be run yet and
 * NOBODY'S FIRST RUN IS THE EXPERIMENT. Flip `def` in the settings row when the
 * fog lands, or on his word — one token, and this comment is the reason.
 *
 * `Fit` stays a REAL VALUE of the setting rather than an absence, so choosing it
 * is a row and not a cleared preference, and `⊙` returns to it once chosen.
 */
function savedZoom(meta) {
  const stored = ((meta && meta.settings) || {}).mapZoom;
  // Unset, OR A VALUE THIS LADDER CANNOT READ, is the SHIPPING DEFAULT and never
  // the computed frame. MAP_ZOOM_DEFAULT is the one home for which that is — the
  // settings row reads the same const for its `def`, so the two cannot disagree
  // and the flip described above is one token in model/mapview.js.
  //
  // THE SECOND CLAUSE USED TO BE A LIE — Vira, #107. The comment said unreadable
  // input lands on the shipping default; the code returned `ZOOM_MIN`, which is
  // 100% and not the 115% that ships. A false comment over correct-looking code
  // is the worse half of that pair: the code was defensible and the sentence
  // above it sent the next reader somewhere else. Both roads led somewhere
  // legal, so nothing would ever have failed. Fixed by making the CODE match the
  // sentence rather than the sentence match the code, because a hand-edited save
  // or an older build's value should behave exactly as an absent one — which is
  // `resolveTapSize`'s rule for the same situation, one screen away.
  const raw = stored == null ? MAP_ZOOM_DEFAULT : stored;
  if (raw === 'Fit') return null;
  const z = Number(raw) / 100;
  if (!Number.isFinite(z) || z <= 0) {
    if (MAP_ZOOM_DEFAULT === 'Fit') return null;
    const d = Number(MAP_ZOOM_DEFAULT) / 100;
    return Number.isFinite(d) && d > 0 ? snapToLadder(d) : ZOOM_MIN;
  }
  // Snap to the nearest step so +/- stays on the ladder.
  return snapToLadder(z);
}

function snapToLadder(z) {
  return ZOOM_STEPS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a), ZOOM_MIN);
}

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

export function mountMap(app, { registries, run, meta, onPick, onSave, onQuit, onSettings, onMenu, onArmoury }) {
  // Before anything is drawn: the previous mount's keyboard handler, if this is
  // a re-mount. See `liveMapKeys` above.
  if (liveMapKeys) {
    removeEventListener('keydown', liveMapKeys);
    liveMapKeys = null;
  }
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
  const width = svgWidth(columns);
  const height = svgHeight(maxFloor);
  const x = (col) => nodeX(col);
  const y = (floor) => nodeY(floor, height);
  // `null` here means "the frame decides", and it is resolved on the first
  // layout that has a non-zero viewport — never from the device width, because
  // `--ui-zoom` sits between the device and this canvas.
  const saved = savedZoom(meta);
  let framing = saved == null ? 'fit' : 'saved';
  let zoom = saved == null ? ZOOM_MIN : saved;

  const reachable = new Set(run.mapNodeId ? map.nodes[run.mapNodeId].next : map.startIds);
  const traveled = new Set(run.path || []);
  const reveal = passiveFlag(registries, run.relics, 'revealUnknown');

  // WHAT THE PLAYER KNOWS, derived once and read by everything below — the node
  // loop, the edges, and the camera's look-ahead. Deriving it twice is how a
  // camera comes to frame a node nobody painted.
  const mode = resolveMapMode(meta);
  const fog = mode === 'fog';
  // `mapFogForks` is the UNDECIDED half and is deliberately NOT a settings row —
  // see FOG_KEEP_FORKS in model/mapknowledge.js. It is read here so the camera
  // can photograph both readings of his sentence for him to choose between; the
  // day he chooses, this expression and that constant both go.
  const keepForks = ((meta && meta.settings) || {}).mapFogForks === true;
  const know = mapKnowledge({ graph: map, run, mode, reveal, keepForks });
  const isDrawn = (id) => know.drawn.has(id);

  // ---- edges (a traveled edge = consecutive pair in run.path) ----
  //
  // AN EDGE NEEDS BOTH ITS ENDS. Under fog the nodes one step past the split are
  // hidden, so their edges are not drawn either — the line stops where the light
  // does, which is what makes the screen read as a path running into fog rather
  // than as a lattice with holes punched in it. In `path` mode nothing is hidden
  // and this filter is the identity, so the shipped screen is byte-identical.
  let edgeSvg = '';
  const path = run.path || [];
  for (const n of nodes) {
    if (!isDrawn(n.id)) continue;
    for (const toId of n.next) {
      if (!isDrawn(toId)) continue;
      const to = map.nodes[toId];
      const ia = path.indexOf(n.id);
      const isTraveled = ia >= 0 && path[ia + 1] === toId;
      edgeSvg += `<line class="map-edge${isTraveled ? ' traveled' : ''}" x1="${x(n.col)}" y1="${y(n.floor)}" x2="${x(to.col)}" y2="${y(to.floor)}"/>`;
    }
  }

  // ---- the undiscovered ground -------------------------------------------
  //
  // THREE AUTHORED LOOKS, ONE PER ACT, BOUND BY NAME (uiContent.js
  // `parchmentAsset`).
  //
  // THE PLATE IS NOT IN THIS MARKUP, AND THAT IS A BUG FIX, NOT A STYLE.
  // The first draft emitted `<image href="assets/map/parchment_act1.webp">`
  // straight into the SVG on the reasoning that SVG "draws no broken-image
  // glyph". PHOTOGRAPHED, IT DOES: with the three plates absent — which is the
  // state this commit ships in — headless Chromium painted its own missing-image
  // graphic across the entire 725x674 canvas, a blurred hillside under a sky,
  // and the act map was drawn on top of it. Every node still rendered, every
  // check still passed, and the screen was unusable. Law 1 clause 4 asks a
  // missing asset to degrade "visibly but gracefully"; that was visible and the
  // opposite of graceful, and only a screenshot could say so.
  //
  // So the plate is ATTACHED ON A SUCCESSFUL LOAD and never before (see
  // `attachParchment` below): no file, no element, and the wash beneath it
  // stands alone. Freja can drop a `.webp` into `assets/map/` and reload.
  //
  // THE WASH IS A PLACEHOLDER AND THIS COMMENT IS NOT WHERE THAT IS SAID —
  // `.map-fog-ground` in styles/map.css carries it, next to the colour it
  // describes. It is deliberately NOT drawn from the graph: art derived from
  // `mapgen` would move the day Constantine turns `floors` to shorten a run
  // (Law 0 clause 5). FREJA OWNS THE ACTUAL LOOK; this ships the structure.
  const groundSvg = fog
    ? `<g class="map-fog-ground" aria-hidden="true">`
      + `<rect x="0" y="0" width="${width}" height="${height}"/>`
      + `</g>`
    : '';

  const cz = run.customization || {};
  const hpPct = Math.max(0, Math.min(100, Math.round((run.hp / Math.max(1, run.maxHp)) * 100)));
  const className = registries.classes.get(run.class).name;
  const heroName = (cz.name || className).toUpperCase();
  const hasRelics = run.relics.length > 0;
  const hasFlasks = run.flasks.length > 0;

  app.innerHTML = `
    <div class="mapscreen${fog ? ' map-fog' : ''}">
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
      <!-- The per-act parchment tone rides the SCROLLPORT, not the <g> inside
           the SVG: a custom property inherits DOWN, and both the ground rect and
           the scrollport's own background need to read it. One home for the
           tone, two readers, no second literal. -->
      <div class="map-scroll${fog ? ` ${parchmentClass(run.actNumber)}` : ''}" data-map-mode="${mode}">
        <div class="map-canvas">
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${groundSvg}
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
      <!-- THE DELIVERED TAP SIZE, SAID WHERE THE PLAYER IS — and SILENT whenever
           the promise is kept. Sunna's rule, in her own words about her own
           proposal: "a line that says the same thing every time you open the
           screen is not a warning, it is decoration with a worried face." So
           this is empty and hidden at 390x844, where a node delivers 44.1 px
           against a 44 px floor, and it appears at 320x640, where the same
           radius delivers 36.3 and the floor is not met.
           Every number in it is READ, never typed: the radius from
           model/mapview.js, the zoom from this screen, and the two custom
           properties the app applied (ui-zoom, tap-target) off the document.
           Nothing here restates a constant, so nothing here can disagree with
           one. (And no backticks in this block either — the warning four
           comments up is not decoration. I put two in here, they closed the
           template literal, and the tree stopped linking. node --check said the
           file was fine; tools/linkcheck.mjs, which landed in dev tonight, is
           what caught it.)
           NOT the zoom buttons — those are Sunna's #117 and are not touched. -->
      <p class="map-tapnote" hidden></p>
      <div class="map-zoom">
        <button class="zbtn" id="zoom-out" title="Zoom out">−</button>
        <button class="zbtn" id="zoom-reset" title="Reset / center">⊙</button>
        <button class="zbtn" id="zoom-in" title="Zoom in">+</button>
      </div>
    </div>`;

  const g = app.querySelector('#map-nodes');
  let drawnCount = 0;
  for (const n of nodes) {
    // HIDDEN IS NOT `display:none` — the element is never created. A node the
    // player is not meant to know exists must not be in the DOM for a curious
    // one to read, and an absent element cannot be un-hidden by a stylesheet.
    const rung = know.rung.get(n.id);
    if (rung === HIDDEN) continue;
    drawnCount++;
    const isReachable = reachable.has(n.id);
    // PRESENTATION KEYS ON THE RUNG, NEVER ON THE TYPE. A `placed` node draws the
    // unknown mark whatever it actually is, so the day the ladder gains a reason
    // to place a node that is not an `event` — a penumbra, a map fragment — its
    // true kind cannot leak through the icon or the tooltip by omission.
    const rd = nodeReading(n, { reveal });
    const shownType = rung === KNOWN ? rd.shownType : 'event';
    const revealed = rung === KNOWN && rd.revealed;
    const cls = [
      'map-node',
      shownType,
      `k-${rung}`,
      traveled.has(n.id) || n.id === run.mapNodeId ? 'visited' : '',
      n.id === run.mapNodeId ? 'current' : '',
      isReachable ? 'reachable' : '',
      revealed ? 'revealed' : '',
    ].filter(Boolean).join(' ');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', cls);
    // The node's id on the element — so an instrument can compare the SET the
    // page drew against the set the ladder says it should have, rather than
    // comparing two counts and calling that agreement. It leaks nothing a fogged
    // player must not have: only DRAWN nodes get an element at all, and the id is
    // a floor and a column, never a type.
    el.dataset.node = n.id;
    // THE RADIUS IS STILL THE NODE'S OWN, and that is a promise, not an
    // oversight: fog changes WHICH nodes are drawn and never HOW BIG one is, so
    // the tap floor, both map margins and `mapplan --selftest`'s census are the
    // same numbers in both modes. A fogged node with a different radius would
    // have quietly forked every one of them.
    const r = nodeRadius(n.type);
    // Reachable nodes get a rhythmic pulsing halo so the next choices read at
    // a glance; the halo is inert when reduced-motion is set (CSS handles it).
    const halo = isReachable ? `<circle class="node-halo" cx="${x(n.col)}" cy="${y(n.floor)}" r="${r + 6}"/>` : '';
    el.innerHTML = `${halo}<circle cx="${x(n.col)}" cy="${y(n.floor)}" r="${r}"/><text x="${x(n.col)}" y="${y(n.floor)}">${nodeIcon(shownType)}</text>`;
    if (isReachable) el.addEventListener('click', () => onPick(n.id));
    attachTooltip(el, () => nodeTooltip(shownType, n, revealed));
    g.appendChild(el);
  }

  // THE SCREEN SAYS WHAT IT DREW, in the same idiom as `data-framing` two
  // hundred lines down and for the same reason: a fog that cannot report its own
  // census cannot be caught covering the wrong thing. `tools/mapfog.mjs` reads
  // these against the ladder's own answer, and a disagreement between the two is
  // a finding in its own right — the count here is the DOM's, counted while
  // appending, never re-derived from the ladder it is meant to check.
  const scrollEl = app.querySelector('.map-scroll');
  if (fog) {
    attachParchment(app.querySelector('.map-fog-ground'), assetUrl(parchmentAsset(run.actNumber)), width, height);
  }
  scrollEl.dataset.nodesDrawn = String(drawnCount);
  scrollEl.dataset.nodesTotal = String(nodes.length);
  scrollEl.dataset.nodesHidden = String(know.counts.hidden);
  scrollEl.dataset.nodesPlaced = String(know.counts.placed);

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
  function sizeSvg() {
    svgEl.style.width = `${width * zoom}px`;
    svgEl.style.height = `${height * zoom}px`;
  }
  function applyZoom(center) {
    sizeSvg();
    if (center) centerOnCurrent();
  }

  // THE FRAMING SET — the decision on this screen, and nothing else. The node
  // the player stands on, plus every node they can move to. At run start there
  // is no current node, so it is the entrances themselves.
  function framingNodes() {
    const rs = nodes.filter((n) => reachable.has(n.id));
    const cur = run.mapNodeId && map.nodes[run.mapNodeId] ? map.nodes[run.mapNodeId] : null;
    return cur ? [cur, ...rs] : rs;
  }

  // ONE FLOOR OF LOOK-AHEAD — where each of those choices leads. Fitting the
  // decision ALONE is correct and reads like a microscope: mid-climb the framing
  // set is two or three nodes, so the fit pins the ladder at its 2x ceiling and
  // the act stops looking like a climb. This set is a PREFERENCE, never a
  // promise: the zoom fits it when it can, and the guarantee stays the framing
  // set, because the zoom that fits a superset always fits the set inside it.
  //
  // AND UNDER FOG THE LOOK-AHEAD IS EMPTY, BY CONSTRUCTION AND ON PURPOSE. The
  // nodes one step past the split are exactly the ones the fog is covering, so
  // aiming the camera at them would frame blank parchment and push the decision
  // off centre — a camera that knows more than the screen does. `isDrawn` is the
  // same predicate the node loop and the edges use, so there is one answer to
  // "is this on screen" rather than three. In `path` mode nothing is hidden and
  // the filter is the identity: the shipped framing is unchanged, which is what
  // keeps `tools/mapfit.mjs`'s numbers comparable across this commit.
  function contextNodes() {
    const fs = framingNodes();
    const seen = new Set(fs.map((n) => n.id));
    const out = [...fs];
    for (const n of fs) {
      for (const id of n.next) {
        if (!seen.has(id) && map.nodes[id] && isDrawn(id)) { seen.add(id); out.push(map.nodes[id]); }
      }
    }
    return out;
  }

  // Scroll so the framing set sits in the middle of the viewport, and — when the
  // zoom is computed — pick the zoom that makes it fit first.
  //
  // WHAT CHANGED AND WHY, because the old shape was correct-looking and broken.
  // It framed a CENTROID and assigned `Math.max(0, …)`: the low end was clamped,
  // NOTHING clamped the high end, and the browser clamped that silently. Asked
  // for scrollTop 263 it got 1, on 39 of 39 nodes at both shapes (Bjorn) — and
  // the function had no way to know, because a write it cannot read back is a
  // camera that cannot miss. Two fixes, and the second is the one that matters:
  //
  //   1. FIT, THEN CENTRE. The centroid was never wrong; the canvas was 834 px
  //      against a 390 viewport and nothing fitted the framing to the content.
  //      A box centre also beats a centroid — a centroid drifts toward whichever
  //      side has more nodes and pushes the lonely one off the edge.
  //   2. CLAMP OURSELVES, THEN SAY WHETHER IT WORKED. We compute the legal range
  //      and land inside it, so the browser has nothing left to correct, and
  //      then we measure the framing box against what is actually on screen and
  //      publish the answer (see `report`).
  function centerOnCurrent() {
    const fs = framingNodes();
    if (!fs.length) { report(null, null); return; }
    if (framing === 'fit' && scroll.clientWidth > 0 && scroll.clientHeight > 0) {
      // The decision must fit; the look-ahead is fitted too when it costs
      // nothing, and `min` is what makes that safe — the context box contains
      // the decision box, so the zoom that fits it fits the decision as well.
      const zDecision = fitZoom(framingBox(fs, height), scroll.clientWidth, scroll.clientHeight);
      const zContext = fitZoom(framingBox(contextNodes(), height), scroll.clientWidth, scroll.clientHeight);
      const z = clampZoom(Math.min(zDecision, zContext));
      if (Math.abs(z - zoom) > 0.0005) { zoom = z; sizeSvg(); }
    }
    const box = framingBox(fs, height);
    // Aim at the wider box when it fits at this zoom — the look-ahead then sits
    // in frame instead of half off the top — and fall back to the decision box
    // the moment it does not, which is what a hand on the ladder does.
    const ctx = framingBox(contextNodes(), height);
    const aim = (ctx.w * zoom <= scroll.clientWidth && ctx.h * zoom <= scroll.clientHeight) ? ctx : box;
    const cx = ((aim.x0 + aim.x1) / 2) * zoom;
    const cy = ((aim.y0 + aim.y1) / 2) * zoom;
    const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollLeft = Math.min(maxLeft, Math.max(0, cx - scroll.clientWidth / 2));
    scroll.scrollTop = Math.min(maxTop, Math.max(0, cy - scroll.clientHeight / 2));
    report(box, fs.length);
  }

  // THE CAMERA SAYS WHETHER IT MISSED. This is the half that never existed: the
  // framing could fail on 9 of 12 seeds at 390x844 and every line of code
  // involved reported success. `data-framing` is `fit` or `clipped`, with the
  // overflow in local px beside it, so a player-facing warning, a screenshot and
  // tools/mapfit.mjs all read one fact instead of three re-derivations.
  let warnedClipped = false;
  function report(box, count) {
    const d = scroll.dataset;
    if (!box) { d.framing = 'none'; d.framingMiss = '0'; return; }
    const over = Math.max(
      0,
      scroll.scrollLeft - box.x0 * zoom,
      box.x1 * zoom - (scroll.scrollLeft + scroll.clientWidth),
      scroll.scrollTop - box.y0 * zoom,
      box.y1 * zoom - (scroll.scrollTop + scroll.clientHeight)
    );
    d.framing = over > 0.5 ? 'clipped' : 'fit';
    d.framingMiss = String(Math.round(over));
    d.framingZoom = zoom.toFixed(3);
    d.framingCount = String(count);
    if (over > 0.5 && !warnedClipped) {
      warnedClipped = true;
      console.warn(`[map] the framing does not fit: ${count} node(s) of choice need `
        + `${Math.round(box.w)}x${Math.round(box.h)} local px, the map viewport is `
        + `${scroll.clientWidth}x${scroll.clientHeight}, and the zoom ladder floors at ${ZOOM_MIN}x — `
        + `${Math.round(over)} px of the choice is off screen and only panning reaches it. `
        + `This act is ${columns} columns wide.`);
    }
    reportTapSize();
  }

  // WHAT A MAP NODE ACTUALLY DELIVERS TO A THUMB, at this zoom on this screen.
  //
  // The radius is now solved from the tap floor rather than drawn and hoped for
  // (model/mapview.js), and it is solved at ONE reference — 44 px at the default
  // map zoom on a 390x844 phone. It cannot be a promise at every shape, and the
  // honest thing is not a comment claiming otherwise: it is the screen saying
  // the number where the player is, and saying NOTHING when the floor is met.
  //
  // Both values are READ rather than recomputed. `--ui-zoom` and `--tap-target`
  // are what the app actually applied (main.js applyUiScale / applyTapSize), so
  // if either ever stops being written, this line reports the truth about the
  // broken state instead of a re-derivation that agrees with itself.
  const tapNote = app.querySelector('.map-tapnote');
  function reportTapSize() {
    const cs = getComputedStyle(document.documentElement);
    const uiZoom = Number(cs.getPropertyValue('--ui-zoom')) || 1;
    const target = parseFloat(cs.getPropertyValue('--tap-target')) || TAP_TARGET_DEFAULT;
    const px = deliveredNodePx(NODE_R, zoom, uiZoom);
    scroll.dataset.nodePx = px.toFixed(1);
    scroll.dataset.tapTarget = String(target);
    if (!tapNote) return;
    const meets = px + 0.5 >= target;
    tapNote.hidden = meets;
    tapNote.textContent = meets ? ''
      : `Map nodes are ${Math.round(px)} px here — under your ${target} px minimum tap size. Zoom in (+) to grow them.`;
  }

  function setZoom(next, keepCenter = true) {
    // A hand on the ladder is an override, and it OUTLIVES the next re-centre —
    // otherwise the computed frame would quietly undo the player's own choice
    // the first time anything called centerOnCurrent() again.
    framing = 'manual';
    zoom = clampZoom(next);
    applyZoom(keepCenter);
  }
  // ⊙ — "Reset / center", and now it means it: back to the computed frame from
  // wherever the ladder, the wheel or the saved setting left us.
  function resetFraming() {
    framing = 'fit';
    centerOnCurrent();
  }
  const stepZoom = (dir) => {
    const i = ZOOM_STEPS.findIndex((z) => Math.abs(z - zoom) < 0.001);
    const ni = Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir));
    setZoom(ZOOM_STEPS[ni]);
  };
  app.querySelector('#zoom-in').addEventListener('click', () => stepZoom(1));
  app.querySelector('#zoom-out').addEventListener('click', () => stepZoom(-1));
  app.querySelector('#zoom-reset').addEventListener('click', () => resetFraming());

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
      stepZoom(1);
    } else if (ev.key === '-' || ev.key === '_') {
      stepZoom(-1);
    } else if (ev.key === '0') {
      resetFraming();
    }
  };
  addEventListener('keydown', mapKeys);
  liveMapKeys = mapKeys;

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

/**
 * attachParchment(host, path, w, h) — put the act's plate on the ground layer,
 * but ONLY once the file has actually decoded.
 *
 * The load is probed with a plain `Image`, not by inserting the `<image>` and
 * hoping: a decode failure then costs nothing, because nothing was ever added to
 * the document. See the note at `groundSvg` for what the eager version did to
 * the screen when the plate was missing — which is the state this ships in, and
 * the reason this function exists at all rather than three lines of markup.
 *
 * Fire-and-forget by design. A plate that arrives 40 ms after the map does is a
 * background fading in; a map that waits for one is a map that never opens when
 * the file is absent.
 */
function attachParchment(host, path, w, h) {
  if (!host || typeof Image === 'undefined') return;
  const probe = new Image();
  probe.onload = () => {
    if (!host.isConnected) return; // the player left the map while it loaded
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    el.setAttribute('href', path);
    el.setAttribute('x', '0');
    el.setAttribute('y', '0');
    el.setAttribute('width', String(w));
    el.setAttribute('height', String(h));
    el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    host.appendChild(el);
  };
  // No `onerror` handler on purpose: the absent plate is the SHIPPING state
  // today, and a console warning per map mount would be noise about a thing
  // everyone already knows. The moment the three files exist, a missing one is
  // a 404 in the network panel, which is the loud channel Law 1 clause 5 wants
  // and the one a person actually looks at when art does not appear.
  probe.src = path;
}

function nodeTooltip(type, node, revealed) {
  let t = `<div class="tt-title">Floor ${node.floor}</div>${nodeBlurb(type)}`;
  if (revealed) t += '<br><i>Revealed by the Sealstone Key.</i>';
  return t;
}
