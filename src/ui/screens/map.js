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
 * THE HALO'S OWN REACH, in SVG units — the pulsing ring a reachable node wears
 * (`r + HALO_PAD`), and the breathing room the entrance frame leaves around the
 * two ends so that ring is not sliced by the screen edge. One home, because the
 * two are the same number for the same reason: the second one exists to keep
 * the first one on screen.
 */
const HALO_PAD = 6;

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
  // `mapFogForks` USED TO BE READ HERE — the shot flag that posed the other
  // reading of his sentence for the camera. He answered on 2026-08-08 (a fork
  // stays lit once you are past it), so the flag and its constant are deleted
  // rather than parked: an option nobody chose is a second behaviour nothing
  // tests. The losing reading survives as a mutant in tools/mapfog.mjs.
  const know = mapKnowledge({ graph: map, run, mode, reveal });
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
      <!-- THE LANTERN, and it needs a frame to hang in. The vignette has to sit
           OVER the map and STAY WITH THE SCREEN while the map scrolls under it,
           which is three things CSS cannot give a scroll container by itself: a
           background paints under the content, an inset shadow paints under it
           too, and an absolutely positioned child of a scroller scrolls with the
           content. So .map-frame is the positioned box and the overlay is its
           sibling, laid out over the scrollport and nothing else.

           IT IS pointer-events: none AND THAT IS NOT A DETAIL. The last thing
           put over this pannable canvas took two map nodes with it at 412x915 —
           visible, untappable, on dev and every branch (EldenSpire#28, the
           comment below). This one cannot: it takes no clicks, and
           tools/mapreach.mjs is the machine that says so rather than this
           sentence. It is also fog-only, so path mode is the screen that
           shipped, unchanged.

           (No backticks in here either. I wrote one around the word path, the
           template literal closed on it, and the map screen went blank — the
           exact defect the comment forty lines down already warns about, walked
           into by the person quoting it. It cost one run of actends, which
           reported NOTHING SWEPT rather than a pass, which is the only reason
           this sentence is a note and not a shipped blank screen.) -->
      <div class="map-frame">
      <div class="map-scroll${fog ? ` ${parchmentClass(run.actNumber)}` : ''}" data-map-mode="${mode}">
        <div class="map-canvas">
          <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            ${groundSvg}
            <text class="map-act-title" x="${width / 2}" y="24" text-anchor="middle" fill="var(--gold)" font-size="17" letter-spacing="4" font-family="Georgia,serif">${actTitle(run.actNumber)}</text>
            ${edgeSvg}
            <g id="map-nodes"></g>
          </svg>
        </div>
      </div>
        ${fog ? '<div class="map-vignette" aria-hidden="true"></div>' : ''}
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
    const halo = isReachable ? `<circle class="node-halo" cx="${x(n.col)}" cy="${y(n.floor)}" r="${r + HALO_PAD}"/>` : '';
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

  // WHAT THE PLAYER CAN SCROLL TO IS DERIVED FROM WHAT IS PAINTED — the ink,
  // never the column grid. Two of Constantine's instructions land on this one
  // expression, and they had the same cause from opposite sides.
  //
  //   "the current node should be centered on the screen both vertically and
  //    horizontally"
  //   "for mobile, I should only be scrolling up and down, rarely left and
  //    right … rearrange things to keep everything visible in the vertical
  //    dimension"
  //
  // MEASURED AT dev (cd3da94), 390x844, the shipped default zoom: the scrollport
  // is 433x756 local px and the canvas was 834x775 — 401 px of scroll ACROSS,
  // the axis he has just banned, and 19 px DOWN, the axis he wants centred. The
  // vertical camera was not merely inaccurate, it was arithmetically impossible:
  // the entrance sits 293 px below the viewport centre and there were 19 px of
  // travel to close it with. Clamping (#…, my own last commit) made that
  // failure REPORTABLE. It could not make it succeed.
  //
  // BOTH NUMBERS COME FROM ONE MISTAKE: the scrollable area was `columns * COL_X
  // + 60` tall and wide — the shape of the ACT — while the shape of what is
  // DRAWN is 259 px wide under fog and the full 623 px of the climb tall. So the
  // player was given a canvas whose empty half was pannable and whose full half
  // was not.
  //
  // THE RULE, one sentence: the scrollable content is the painted ink, grown by
  // half a viewport on every side so that ANY painted point can be brought to
  // the centre — and nothing beyond it. That makes the scroll extents exactly
  // the ink extents on both axes (`overflow = ink`).
  //
  // ~~so the map scrolls the axis the act is long on and stops scrolling the one
  // it is not.~~ STRUCK 2026-08-08 by Sunna, and struck rather than reworded,
  // because it is the sentence a reader would cite as Law 5 coverage. IT IS NOT
  // TRUE. Measured on this branch, `.map-scroll` horizontal travel, 390x844,
  // shipped zoom, headless Chromium on one Linux box:
  //
  //   fog, entrance      65  (SHOWCASE)  ..  385  (VIRA4, BJORN1, SAGA11)
  //   fog, mid-climb    166  ..  385     (4 seeds x floors 1/4/7/10, 16 cells)
  //   path, entrance    704  (SHOWCASE)
  //
  // For scale, Law 5's own known-bad is this same container at 401 px on `dev`
  // cd3da94 — so the entrance improved on ONE seed and the shipped `path` mode
  // got worse. The two fog-entrance numbers are the same code on two seeds:
  // travel across is `inkWidth * zoom` AND NOTHING ELSE, because the ink is
  // grown by a full viewport whether or not it already fits inside one. A door
  // and a boss in the same column give 65; three columns apart give 385.
  //
  // A number that swings 320 px on the seed is not an axis the layout has
  // stopped scrolling — it is one nobody is measuring. Law 5 clause 1 wants
  // ZERO and clause 2 says a threshold is not an exemption. So the honest state
  // of this expression: the VERTICAL axis was the defect it was written to fix
  // and it fixed it (19 -> 692 px of travel, which is what makes centring
  // possible at all), and the HORIZONTAL axis is unpaid. `tools/axisfit.mjs` is
  // the machine that owns that number; it is not this comment's to claim, and
  // the entrance aim below does not move it — aiming changes where the camera
  // looks, never how far the content reaches.
  //
  // IT IS THE viewBox, NOT PADDING, AND THAT IS DELIBERATE. #24 padded
  // `.map-canvas` to clear the zoom buttons and the fix only held at the scroll
  // offset it was measured at (see styles/map.css). Padding moves the content
  // inside the scrollport; this moves the SCROLLPORT'S IDEA OF THE CONTENT, so
  // there is no offset at which it disagrees with itself. Node coordinates are
  // untouched — the viewBox carries the origin — so every rect, edge and label
  // in the markup is where it always was.
  const titleEl = svgEl.querySelector('.map-act-title');
  const inkBox = framingBox(nodes.filter((n) => isDrawn(n.id)), height) || { x0: 0, y0: 0, x1: width, y1: height };
  // The content box last APPLIED to the element, in SVG units. Read by the
  // camera and by `report`, so the three cannot disagree about where zero is.
  let content = { x0: 0, y0: 0, w: width, h: height };
  // TWICE, ON PURPOSE, and this is the one non-obvious line in the change.
  // Applying a content box can add or remove a CLASSIC scrollbar (this
  // scrollport asks for `scrollbar-width: thin`, not overlay), and a scrollbar
  // takes layout width — which is the very number the pads were computed from.
  // One pass would centre against a viewport that no longer exists by the time
  // it lands, off by the scrollbar, on desktop only, silently. The second pass
  // reads the settled viewport; a third has nothing left to change, because the
  // pad is linear in the viewport and a scrollbar is a two-state thing.
  function sizeSvg() { apply(); apply(); }
  function apply() {
    // Before the first layout the viewport is 0 and there is no half-viewport to
    // grow by; the plain canvas is the honest fallback and the ResizeObserver
    // below re-runs this the moment a real size exists.
    const padX = scroll.clientWidth > 0 ? scroll.clientWidth / (2 * zoom) : 0;
    const padY = scroll.clientHeight > 0 ? scroll.clientHeight / (2 * zoom) : 0;
    const x0 = inkBox.x0 - padX;
    const y0 = inkBox.y0 - padY;
    const w = (inkBox.x1 - inkBox.x0) + 2 * padX;
    const h = (inkBox.y1 - inkBox.y0) + 2 * padY;
    content = { x0, y0, w, h };
    svgEl.setAttribute('viewBox', `${x0} ${y0} ${w} ${h}`);
    svgEl.style.width = `${w * zoom}px`;
    svgEl.style.height = `${h * zoom}px`;
    // THE GROUND IS THE VIEWBOX, not the act's canvas. The wash and the act
    // plate were sized `0 0 width height`; grown content would have ended the
    // parchment in the middle of the screen with the scrollport's background
    // carrying on in the same tone — invisible today, and a seam the day Freja's
    // plates land. One `<rect>` is the home; the plate copies it (attachParchment).
    for (const el of svgEl.querySelectorAll('.map-fog-ground > rect, .map-fog-ground > image')) {
      el.setAttribute('x', String(x0));
      el.setAttribute('y', String(y0));
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(h));
    }
    // The act title rides the CONTENT's centre line, not the act's — the camera
    // moves it to the column the player is standing in a moment later
    // (`centerOnCurrent`), and this is the value it holds before the first
    // centring. Under fog a door and a boss can share one column: the ink is
    // then ~57 SVG units wide, and a title pinned to `width / 2` would have
    // fallen outside the viewBox and simply not drawn.
    if (titleEl) titleEl.setAttribute('x', String(x0 + w / 2));
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

  // THE ENTRANCE FRAME — the ONE position where the aim is not a node the player
  // is standing on, because there isn't one yet.
  //
  //   "when the act starts it show the start node and the end node"
  //                                        — Constantine, quoted in mapknowledge.js
  //
  // THE FOG ALREADY OBEYED THAT SENTENCE AND THE CAMERA THEN UNDID IT. The boss
  // is lit from the first frame — `mapfog --selftest` holds that property and
  // has watched it go red — and the camera aimed at the door, which put the
  // boss 261 px above the top of a 390x844 screen on 12 of 12 seeds. Both
  // halves were doing their job. Nothing owned the sentence they add up to,
  // and `tools/actends.mjs` is the check that can now say so out loud: 0 of 24
  // cells at 89ec151, and — this is the part that is not about one branch —
  // 0 of 12 DESKTOP cells on `dev` before the camera changed at all.
  //
  // WHY THIS IS AIM AND NOT ZOOM. My own gate note said the two ends "span 692
  // local px against a 680 px port" and therefore needed ~2% of zoom-out on top
  // of the aim. THAT WAS A UNIT ERROR AND THE FIX IS SMALLER THAN I SAID: 692 is
  // LOCAL px (the map's own space, past `--ui-zoom`) and 680 is DEVICE px. In one
  // space it is 692 local against a 756-local port at 390x844 — it fits, with 64
  // px to spare, and aiming is the whole of it. Nothing here touches the zoom, so
  // the player's ladder is never overridden and no tap target shrinks.
  //
  // 1200x730 IS NOT THE SAME CAUSE AND IS DELIBERATELY NOT FIXED HERE. Same aim
  // defect, plus a second one underneath it: that port is 549 local px and the
  // ends span 692, so no aim can show both. Nor can any legal zoom — the ladder
  // floors at 100%, which still spans 603 px, and the zoom that WOULD fit (0.79)
  // delivers a 34 px map node against a 44 px tap floor. Showing both ends on a
  // 730-tall window is a LAYOUT question (that screen spends 165 px on chrome),
  // not a camera one, and it wants its own card rather than a camera that
  // quietly breaks the tap floor. So when the pair does not fit, this returns to
  // the shipped behaviour — the door centred — and SAYS SO in `data-entrance-*`
  // rather than failing the way it used to, which was silently.
  //
  // It is not in tension with "the current node should be centered on the screen
  // both vertically and horizontally": at the entrance there IS no current node.
  // The doors stand in for it, and the moment the player takes one step `cur`
  // exists and this function is never called again for that act.
  // AND THE ACT'S NAME IS PART OF THE ESTABLISHING SHOT, not a decoration on top
  // of it. My first draft framed the two ends and left `ACT I — THE FALLOW
  // MARCHES` HALF CUT BY THE TOP EDGE — photographed, 390x844, every seed: the
  // title's own band is y 99..119 device and the scrollport starts at 110. A
  // clipped word is worse than an absent one, and it is the same complaint that
  // put this whole task on the board. So the frame is chosen from a PREFERENCE
  // LADDER, widest first, and each rung is taken only if it fits at this zoom:
  //
  //   1. the title, the doors and the far end     the act, named, both ends
  //   2. the doors and the far end                his sentence, no caption
  //   3. the doors                                the shipped behaviour
  //
  // Rung 3 is what 1200x730 lands on and it is not a failure mode bolted on — it
  // is today's frame, unchanged, plus a camera that now says it missed.
  function entranceFrame(fs, box) {
    const starts = fs.filter((n) => (map.startIds || []).includes(n.id));
    const doorNodes = starts.length ? starts : fs;
    const doors = framingBox(doorNodes, height) || box;
    // The far end of the climb, and only if it is PAINTED — `isDrawn` is the same
    // predicate the node loop, the edges and the look-ahead use, so the camera
    // can never frame a node nobody drew.
    const end = nodes.find((n) => n.type === 'boss' && isDrawn(n.id));
    if (!end) return { aim: doors, end: null };
    const endBox = framingBox([end], height);
    const ends = framingBox([...doorNodes, end], height);
    const fits = (b) => b.w * zoom <= scroll.clientWidth && b.h * zoom <= scroll.clientHeight;
    // THE MARGIN IS WHAT THE HALO PAINTS, NOT WHAT IT MEASURES, and my first
    // draft got that wrong in a way only a machine caught: I padded by HALO_PAD
    // and tools/mapreach.mjs went red at 3 cells that were green at 89ec151.
    // The ring pulses to `--halo-peak` (styles/map.css) eight times a second, so
    // its painted reach past a node's own edge is `(r + HALO_PAD) * peak - r` —
    // 15.6 units at the door's radius, not 6. The peak is READ from the
    // stylesheet that animates it rather than retyped here.
    // ONLY THE HALO-WEARERS ARE ASKED. `.reachable` is what puts a ring on a
    // node (see the node loop), and at the entrance that is the doors and never
    // the boss — so padding by the boss's radius would buy margin for a ring
    // nothing paints. It is not free: it costs 2.5 units, and at 390x844 the
    // title rung fits by THREE, so the generous version silently dropped the act
    // title on every seed. Measured, not reasoned about.
    const reach = (n) => {
      const r = nodeRadius(n.type);
      return Math.max(0, (r + HALO_PAD) * haloPeak() - r);
    };
    const pad = Math.max(0, ...doorNodes.map(reach));
    const grow = (b, top) => {
      const g = { x0: b.x0 - pad, y0: b.y0 - top, x1: b.x1 + pad, y1: b.y1 + pad };
      g.w = g.x1 - g.x0;
      g.h = g.y1 - g.y0;
      return g;
    };
    // MEASURED, NOT ASSUMED. The title is `<text>` at a fixed SVG font-size, so
    // its band is whatever the font actually renders — asking the element is one
    // call and a literal here would be a second copy of a metric nothing syncs.
    let band = null;
    try {
      const b = titleEl && titleEl.getBBox();
      if (b && b.height > 0) band = { y0: b.y, y1: b.y + b.height };
    } catch { /* not laid out yet — rung 1 simply isn't offered */ }
    if (band) {
      // The title's own band caps the top: text carries its own margin, and the
      // halo pad above it would only push a rung that already fits by 3 px off
      // the ladder.
      const titled = grow(ends, pad);
      titled.y0 = Math.min(titled.y0, band.y0);
      titled.h = titled.y1 - titled.y0;
      if (fits(titled)) { showTitle(true); return { aim: titled, end: endBox }; }
    }
    // AND WHEN THE TITLE DOES NOT FIT IT IS HIDDEN, NOT LEFT HALF IN. This is
    // the whole reason the rung exists. The frame is centred, so a box smaller
    // than the port leaves margin on both sides, and the title sits in exactly
    // that margin — which is how it came to be sliced at y 99..119 against a
    // port starting at 110. A word cut in half is worse than a word that is not
    // there, and "sometimes sliced, depending on the shape" is worse than
    // either. Mid-climb is untouched: `cur` exists, this function is not called,
    // and the title's visibility is restored the moment it is.
    showTitle(false);
    const both = grow(ends, pad);
    return { aim: fits(both) ? both : doors, end: endBox };
  }
  // One home for "is the act's name on the board", so the two callers cannot
  // disagree about whose turn it is to put it back.
  function showTitle(on) {
    if (titleEl) titleEl.style.visibility = on ? '' : 'hidden';
  }
  // The widest the reachable halo ever paints, read from the stylesheet that
  // animates it (`--halo-peak`, styles/map.css). A number retyped here would be
  // a second copy of a keyframe — and it would be the copy that goes stale,
  // because nothing on screen changes when the camera's idea of the halo is
  // wrong; only mapreach notices.
  function haloPeak() {
    const v = parseFloat(getComputedStyle(scroll).getPropertyValue('--halo-peak'));
    return Number.isFinite(v) && v >= 1 ? v : 1;
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
  //
  // AND WHAT CHANGED TONIGHT — Constantine, 2026-08-08: "the current node should
  // be centered on the screen both vertically and horizontally." The aim was the
  // BOX of the decision (current + every step out of it), which is the right
  // frame and is not what he asked for: the box centre sits about half a row
  // above the node the player is standing on, and at the entrance row the box IS
  // the door, so the camera aimed at a point the player was not. THE AIM IS NOW
  // THE CURRENT NODE ITSELF, and the entrances only stand in for it before the
  // first move, when there is no current node to aim at.
  //
  // It is exact on both axes now because `sizeSvg` gives it the travel (above),
  // not because the arithmetic here got smarter. The two halves are one change
  // and neither works alone.
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
      if (Math.abs(z - zoom) > 0.0005) zoom = z;
    }
    // ALWAYS, not only when the zoom moved: the content box is a function of the
    // viewport as well as the zoom, and this is the first call after a resize.
    sizeSvg();
    const box = framingBox(fs, height);
    // THE AIM. The node under the player's feet; before the first move, the
    // centre of the doors — which `entries: 1` has made a single door, so on a
    // new game this is one node and not an average of several.
    const cur = run.mapNodeId && map.nodes[run.mapNodeId] ? map.nodes[run.mapNodeId] : null;
    // Past the first step the act's name goes back on the board unconditionally
    // — mid-climb framing is not this change's subject and must be byte-for-byte
    // what it was.
    if (cur) showTitle(true);
    const entrance = cur ? null : entranceFrame(fs, box);
    const aim = cur ? framingBox([cur], height) : entrance.aim;
    // Local px from the CONTENT origin, which is no longer the canvas origin.
    const aimX = (aim.x0 + aim.x1) / 2;
    // THE ACT TITLE FOLLOWS THE AIM, and this is a fix for something that was
    // already broken rather than for something I broke. `ACT I · THE FALLOW
    // MARCHES` was pinned to the middle of the act's canvas while the camera
    // looked wherever the player was, so it arrived cut off at a screen edge —
    // "ALLOW MARCHES" in the shot of `dev` I took before touching any of this.
    // The camera knows where it is pointing; the title is one attribute away
    // from being centred over it, and it costs nothing now that the content box
    // is wide enough to hold it.
    if (titleEl) titleEl.setAttribute('x', String(aimX));
    const cx = (aimX - content.x0) * zoom;
    const cy = ((aim.y0 + aim.y1) / 2 - content.y0) * zoom;
    let left = cx - scroll.clientWidth / 2;
    let top = cy - scroll.clientHeight / 2;

    // CENTRED UNLESS CENTRING WOULD HIDE THE CHOICE — and this clause exists
    // because the first draft of tonight's change did exactly that, measured.
    // Aiming at the current node instead of the decision box is right almost
    // everywhere and wrong at the top of the act, where the last floors fan in
    // from columns three apart: at floor 11, walked, 390x844, the node was dead
    // centre and the step out of it was off screen — 0 of 30 such cells on dev,
    // several on my own branch. His instruction and Bjorn's hidden-step defect
    // pointed opposite ways for one cell in ten, and the camera said `clipped`,
    // which is how I found it rather than how he would have.
    //
    // So the centre is a TARGET and the decision is a FLOOR: nudge by the
    // smallest amount that puts the framing box back on screen, and only when it
    // fits at this zoom — when it cannot fit, nothing here can save it, the node
    // under the player's feet stays centred, and `report` says so.
    const bl = (box.x0 - content.x0) * zoom;
    const br = (box.x1 - content.x0) * zoom;
    const bt = (box.y0 - content.y0) * zoom;
    const bb = (box.y1 - content.y0) * zoom;
    if (br - bl <= scroll.clientWidth) left = Math.min(bl, Math.max(br - scroll.clientWidth, left));
    if (bb - bt <= scroll.clientHeight) top = Math.min(bt, Math.max(bb - scroll.clientHeight, top));

    const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollLeft = Math.min(maxLeft, Math.max(0, left));
    scroll.scrollTop = Math.min(maxTop, Math.max(0, top));
    report(box, fs.length);
    reportEntrance(entrance);
  }

  // THE CAMERA SAYS WHETHER THE ACT'S FAR END IS ON SCREEN, and it is a SECOND
  // confession rather than a wider first one on purpose. `data-framing` answers
  // "is the DECISION on screen" and tools/mapfit.mjs cross-checks it against a
  // photograph on 120 framings; folding a different promise into that one field
  // would have moved a number three instruments read. This one is additive:
  // absent before, `n/a` past the first step, and at the entrance `fit` or
  // `clipped` with the miss in local px beside it — the same idiom, one field
  // over. Measured after the scroll has landed, from the same scrollTop the
  // browser now holds, so it is a reading and not a prediction.
  function reportEntrance(entrance) {
    const d = scroll.dataset;
    if (!entrance) { d.entranceEnds = 'n/a'; d.entranceMiss = '0'; return; }
    if (!entrance.end) { d.entranceEnds = 'none'; d.entranceMiss = '0'; return; }
    const e = entrance.end;
    const l = (e.x0 - content.x0) * zoom;
    const r = (e.x1 - content.x0) * zoom;
    const t = (e.y0 - content.y0) * zoom;
    const b = (e.y1 - content.y0) * zoom;
    const over = Math.max(
      0,
      scroll.scrollLeft - l,
      r - (scroll.scrollLeft + scroll.clientWidth),
      scroll.scrollTop - t,
      b - (scroll.scrollTop + scroll.clientHeight)
    );
    d.entranceEnds = over > 0.5 ? 'clipped' : 'fit';
    d.entranceMiss = String(Math.round(over));
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
    // EVERY TERM IS RELATIVE TO THE CONTENT ORIGIN, which stopped being the
    // canvas origin when the scroll extent became the ink (see `sizeSvg`).
    // Leaving these as `box.x0 * zoom` would have made the confession wrong by
    // exactly the pad — a camera lying in a new direction — and
    // `tools/mapfit.mjs`'s cross-check is what would have caught it.
    const l = (box.x0 - content.x0) * zoom;
    const r = (box.x1 - content.x0) * zoom;
    const t = (box.y0 - content.y0) * zoom;
    const b = (box.y1 - content.y0) * zoom;
    const over = Math.max(
      0,
      scroll.scrollLeft - l,
      r - (scroll.scrollLeft + scroll.clientWidth),
      scroll.scrollTop - t,
      b - (scroll.scrollTop + scroll.clientHeight)
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
  // One reader for both outcomes, so "which scrollport am I reporting on" is
  // answered once rather than twice.
  const port = () => (host.closest ? host.closest('.map-scroll') : null);
  probe.onload = () => {
    const sc = port();
    if (sc) sc.dataset.mapPlate = 'ok';
    if (!host.isConnected) return; // the player left the map while it loaded
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    el.setAttribute('href', path);
    // THE PLATE COPIES THE WASH, and the fallback is the act's canvas. The wash
    // rect is sized to the live viewBox by `sizeSvg` (the scroll extent is the
    // ink now, not the column grid), and a plate that arrives 40 ms later must
    // land on the same ground rather than on the geometry this function was
    // handed at mount — one home, and the plate is its second reader.
    const bg = host.querySelector('rect');
    el.setAttribute('x', bg ? bg.getAttribute('x') : '0');
    el.setAttribute('y', bg ? bg.getAttribute('y') : '0');
    el.setAttribute('width', bg ? bg.getAttribute('width') : String(w));
    el.setAttribute('height', bg ? bg.getAttribute('height') : String(h));
    el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    host.appendChild(el);
  };
  // ~~No `onerror` handler on purpose: the absent plate is the SHIPPING state
  // today … a missing one is a 404 in the network panel, which is the loud
  // channel Law 1 clause 5 wants and the one a person actually looks at when art
  // does not appear.~~ STRUCK 2026-08-08 by Sunna.
  //
  // IT WAS TRUE AND IT WAS ALSO THE HOLE. The plates were absent for the whole
  // life of this hook and the loud channel was a network panel nobody had open,
  // on a screen that renders the miss as "fine, just flat". Weeks. The clause
  // says fail loud and NAME THE ENTRY; a 404 in devtools names it only to
  // whoever is already looking, which is the definition of the failure being
  // invisible.
  //
  // THREE CHANNELS NOW, one per kind of reader, and none of them is the player:
  //   console.error   — the person with the build open, with the path in it
  //   data-map-plate  — the DOM, so a screenshot tool or probe can see it
  //   the unit suite  — tests/engine.test.js, which is the one that FAILS,
  //                     because a channel nobody is required to read is the
  //                     same defect one layer up
  //
  // THE PLAYER STILL GETS THE WASH. Law 1 clause 4 wants a missing asset to
  // degrade visibly but gracefully, and clause 5 wants it loud; those are not in
  // tension once you notice they address different people. Nothing here draws a
  // broken-image glyph — that was measured and it was unusable (see `groundSvg`).
  probe.onerror = () => {
    const sc = port();
    if (sc) { sc.dataset.mapPlate = 'missing'; sc.dataset.mapPlatePath = path; }
    console.error(
      `[map] act plate missing: ${path} — the fog is drawing its placeholder wash instead. `
      + 'Run `node tools/parchment.mjs` to regenerate the plates, or drop the authored art at that exact path.'
    );
  };
  probe.src = path;
}

function nodeTooltip(type, node, revealed) {
  let t = `<div class="tt-title">Floor ${node.floor}</div>${nodeBlurb(type)}`;
  if (revealed) t += '<br><i>Revealed by the Sealstone Key.</i>';
  return t;
}
