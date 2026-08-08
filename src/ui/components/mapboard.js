// src/ui/components/mapboard.js — THE ACT MAP. One renderer, mounted twice.
//
// WHY THIS FILE EXISTS, and it is a collapse and not a repair.
//
// There were two act-map renderers in this tree: `ui/screens/map.js` and, eighty
// lines inside `ui/screens/coop.js`, a second one with its own `ROW_H = 46`, its
// own `y(floor)` and its own `r = boss ? 20 : 15` — the literals every other map
// number was derived away from on 2026-08-08. It imported neither map module, so
// none of that work reached it. Measured at dev `cd3da94`, 390x844, `?shot=`:
//
//                                        solo          co-op
//   node diameter, device px             44.09         27
//   at 320x640                           36.25         22.2
//   the tap-size setting 44 -> 24        (honest note) nothing moves
//   zoom controls                        3             0
//   camera                               fit + centre  scrollLeft 0
//   nodes off the side of the viewport   0 of 44       13 of 44
//   says what it drew (`data-framing`)   yes           no
//
// EVERY ROW OF THAT TABLE IS ONE FACT WRITTEN TWICE. Not a bug each: one bug,
// counted eight times, and the fix is not eight repairs — it is that the second
// copy stops existing.
//
// THE RULING THIS FILE IS SHAPED BY — ask what the predicate's subject is.
// "Is the co-op map a different map, or the same map with a second player on
// it?" It is the SAME MAP. The graph, the geometry, the radii solved from the
// tap floor, the zoom ladder, the camera, the fog rule and the act title are
// properties of THE ACT. They are not properties of who is looking at it.
//
// So the arguments are two, and the split is the ruling:
//
//   act     WHAT THE MAP IS.    Two clients that disagree about this are broken.
//   viewer  WHO IS LOOKING.     Two clients MUST disagree about this.
//
// WHAT MUST NEVER AGREE, said out loud because a collapse that does not name its
// exceptions is how a distinction gets lost:
//
//   1. `me`. Which vote is mine, which seat is mine, which node wears `my-vote`.
//      Two clients rendering the SAME snapshot must draw DIFFERENT pixels, or
//      the marking is a lie about whose choice it shows.
//   2. The camera. My zoom and my scroll position are mine. Nothing syncs them
//      and nothing should — a partner panning my map is not a feature.
//   3. WHO DECIDES WHAT I KNOW. In solo the client derives its own fog, because
//      the client IS the authority. In co-op the server is, and a client may
//      never widen what it was sent — which is why the snapshot ships `unknown`
//      instead of `event` and why this file never tries to lift that rung.
//      Same ladder, different hand on it, deliberately.
//
// Everything else is one home. Turn `ROW_H`, the tap default or the zoom ladder
// and both screens move together, which is the whole point: the act map is being
// re-laid for a phone next, and a re-layout that has to be done twice is a
// re-layout that will be done once.
//
// WHAT THIS FILE DOES NOT OWN. The chrome around the board — headers, party
// bars, hint bars, relic strips, the leave button — stays with its screen. This
// is the board, not the screen.

import { attachTooltip } from './tooltip.js';
import { assetUrl } from '../assetmap.js';
import { nodeIcon, actTitle, parchmentAsset, parchmentClass } from '../uiContent.js';
import { trackGesture } from '../gesture.js';
import {
  mapKnowledge, nodeReading, resolveMapMode, HIDDEN, KNOWN, MAP_MODE_DEFAULT,
} from '../../model/mapknowledge.js';
import {
  ZOOM_STEPS, ZOOM_MIN, MAP_ZOOM_DEFAULT,
  clampZoom, framingBox, fitZoom, nodeRadius, nodeX, nodeY, svgWidth, svgHeight,
  NODE_R, TAP_TARGET_DEFAULT, deliveredNodePx,
} from '../../model/mapview.js';

/**
 * The player's zoom as a NUMBER, or null when they asked the map to compute one.
 *
 * A PERCENTAGE IS THE DEFAULT AND `Fit` IS THE OPT-IN — Sunna's ruling on #107.
 * Given a viewport the machinery below finds the zoom at which the current node
 * and everything it connects to are on screen, which is what Constantine asked
 * for; her hold is about what that zoom LOOKS like arriving alone, without the
 * fog and parchment that make a close frame read as intended.
 *
 * IT LIVES HERE BECAUSE THE ZOOM IS THE VIEWER'S, NOT THE MAP'S. Two players
 * looking at one act have two zooms and that is correct. Moved out of
 * `ui/screens/map.js` unchanged so the co-op board honours the same preference
 * from the same key rather than opening at a literal.
 *
 * `Fit` stays a REAL VALUE of the setting rather than an absence, so choosing it
 * is a row and not a cleared preference, and `⊙` returns to it once chosen.
 */
export function savedZoom(meta) {
  const stored = ((meta && meta.settings) || {}).mapZoom;
  // Unset, OR A VALUE THIS LADDER CANNOT READ, is the SHIPPING DEFAULT and never
  // the computed frame. MAP_ZOOM_DEFAULT is the one home for which that is — the
  // settings row reads the same const for its `def`, so the two cannot disagree.
  //
  // THE SECOND CLAUSE USED TO BE A LIE — Vira, #107. The comment said unreadable
  // input lands on the shipping default; the code returned `ZOOM_MIN`, which is
  // 100% and not the 115% that ships. Both roads led somewhere legal, so nothing
  // would ever have failed. Fixed by making the CODE match the sentence.
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
 * ONE GRAPH SHAPE, AND THE CONVERSION HAPPENS ONCE, HERE.
 *
 * The solo run carries `mapGraph.nodes` as an OBJECT keyed by id; the co-op
 * snapshot carries `map.nodes` as an ARRAY. That is the same second copy one
 * level down — and it is not cosmetic: `litNodes` (the fog light) does
 * `graph.nodes[id]`, which is an index on one shape and a subscript on the
 * other, so the fog ladder can physically only read one of the two.
 *
 * So the board speaks ONE shape and converts at the boundary the other arrives
 * at, rather than every reader learning to accept both.
 */
function indexNodes(nodes) {
  if (!nodes) return {};
  if (Array.isArray(nodes)) {
    const by = {};
    for (const n of nodes) by[n.id] = n;
    return by;
  }
  return nodes;
}

/**
 * mountMapBoard(host, { act, viewer, chromeHtml }) → board
 *
 * `act` — WHAT THE MAP IS. `{ nodes, columns, actNumber, startIds, bossId }`.
 *   `nodes` may be the run's object or the snapshot's array (see `indexNodes`).
 *   `columns` absent falls back to the widest column in use AND SAYS SO — a
 *   silent fallback here re-opens the class of defect it was added to close.
 *
 * `viewer` — WHO IS LOOKING. Every field is legitimately different per client:
 *   `meta`      the viewer's own settings (map zoom, map reveal). May be absent.
 *   `reachable` Set of ids this viewer may act on.
 *   `current`   the id being stood on, or null.
 *   `path`      the ids already travelled, in order. Feeds the fog light.
 *   `mode`      'fog' | 'path'; omitted, it is read from `meta`.
 *   `reveal`    the Sealstone Key.
 *   `keepForks` the undecided half of the fog sentence (mapknowledge.js).
 *   `mark`      (node) → extra SVG inside the node's <g>. Vote pips live here.
 *   `classes`   (node) → extra classes. `my-vote` lives here.
 *   `tooltip`   (node, reading) → html.
 *   `onPick`    (id) → void, fired only for reachable nodes.
 *
 * `chromeHtml` is emitted BETWEEN the scrollport and the tap note, and the
 * position is a fix rather than a preference: `.hint-bar` is fixed to the bottom
 * of the viewport, so once the zoom bar stopped floating the two claimed one
 * band and the hint pill sat on top of the − and the ⊙ (map.css:47).
 *
 * Returns `{ scroll, svg, counts, recenter, stepZoom, resetFraming, teardown }`.
 * KEYS ARE NOT OWNED HERE. Each screen wires its own — the solo map's handler
 * carries a veil guard and a re-mount singleton that are the screen's business,
 * and a second listener living in here would be the third thing stepping the
 * zoom twice.
 */
export function mountMapBoard(host, { act, viewer = {}, chromeHtml = '' }) {
  const byId = indexNodes(act.nodes);
  const nodes = Object.values(byId);
  const maxFloor = Math.max(...nodes.map((n) => n.floor));

  // COLUMNS COME FROM THE GRAPH, not from a literal. This was `7 * COL_X + 60`
  // in both renderers, so an act tuned to 6 or 9 columns drew its SVG at 7
  // regardless — a tunable map whose view ignores the tuning is not tunable.
  //
  // AND THE CO-OP HALF OF THAT FIX WAS ONE-SIDED AT dev cd3da94, which is
  // exactly what one home makes visible: `coop.js` was taught to read
  // `map.columns` from the snapshot, and `tools/session.mjs`'s `snapshot()` sent
  // `{ floors, startIds, bossId, nodes }` and never `columns` — so the warning
  // below was the SHIPPING path in every real co-op session, while
  // `?shot=coopmap` handed a canned snapshot that DID carry the field. The
  // harness was green about a value no host had ever sent. Fixed at the
  // producer in the same commit; the warning stays for an older host.
  let columns = act.columns;
  if (typeof columns !== 'number') {
    columns = Math.max(...nodes.map((n) => n.col)) + 1;
    console.warn(`[mapboard] no \`columns\` on this graph; drawing ${columns} derived from the nodes in use.`);
  }

  const width = svgWidth(columns);
  const height = svgHeight(maxFloor);
  const x = (col) => nodeX(col);
  const y = (floor) => nodeY(floor, height);

  const reachable = viewer.reachable instanceof Set ? viewer.reachable : new Set(viewer.reachable || []);
  const traveled = viewer.traveled instanceof Set ? viewer.traveled : new Set(viewer.path || []);
  const current = viewer.current || null;
  const reveal = !!viewer.reveal;

  // WHAT THE VIEWER KNOWS, derived once and read by everything below — the node
  // loop, the edges, and the camera's look-ahead. Deriving it twice is how a
  // camera comes to frame a node nobody painted.
  const mode = viewer.mode || (viewer.meta ? resolveMapMode(viewer.meta) : MAP_MODE_DEFAULT);
  const fog = mode === 'fog';
  const know = mapKnowledge({
    graph: { nodes: byId, startIds: act.startIds, bossId: act.bossId },
    run: { path: viewer.path || [], mapNodeId: current },
    mode,
    reveal,
    keepForks: !!viewer.keepForks,
  });
  const isDrawn = (id) => know.drawn.has(id);

  // ---- edges (a traveled edge = consecutive pair in the path) ----
  //
  // AN EDGE NEEDS BOTH ITS ENDS. Under fog the nodes one step past the split are
  // hidden, so their edges are not drawn either — the line stops where the light
  // does. In `path` mode nothing is hidden and this filter is the identity.
  let edgeSvg = '';
  const path = viewer.path || [];
  for (const n of nodes) {
    if (!isDrawn(n.id)) continue;
    for (const toId of n.next || []) {
      if (!isDrawn(toId)) continue;
      const to = byId[toId];
      if (!to) continue;
      const ia = path.indexOf(n.id);
      const isTraveled = ia >= 0 && path[ia + 1] === toId;
      edgeSvg += `<line class="map-edge${isTraveled ? ' traveled' : ''}" x1="${x(n.col)}" y1="${y(n.floor)}" x2="${x(to.col)}" y2="${y(to.floor)}"/>`;
    }
  }

  // ---- the undiscovered ground -------------------------------------------
  //
  // THE PLATE IS NOT IN THIS MARKUP, AND THAT IS A BUG FIX, NOT A STYLE. With
  // the three plates absent — the state this ships in — headless Chromium
  // painted its own missing-image graphic across the whole canvas and the map
  // was drawn on top of it. Every check still passed. So the plate is ATTACHED
  // ON A SUCCESSFUL LOAD and never before (`attachParchment`).
  const groundSvg = fog
    ? `<g class="map-fog-ground" aria-hidden="true"><rect x="0" y="0" width="${width}" height="${height}"/></g>`
    : '';

  // The per-act parchment tone rides the SCROLLPORT, not the <g> inside the SVG:
  // a custom property inherits DOWN, and both the ground rect and the
  // scrollport's own background need to read it.
  host.insertAdjacentHTML('beforeend', `
    <div class="map-scroll${fog ? ` ${parchmentClass(act.actNumber)}` : ''}" data-map-mode="${mode}">
      <div class="map-canvas">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${groundSvg}
          <text x="${width / 2}" y="24" text-anchor="middle" fill="var(--gold)" font-size="17" letter-spacing="4" font-family="Georgia,serif">${actTitle(act.actNumber)}</text>
          ${edgeSvg}
          <!-- BOTH AN ID AND A CLASS, and the id is not decoration: two
               instruments key on the ids map-nodes, zoom-in, zoom-out and
               zoom-reset (tools/mapreach.mjs, tools/seedrefuses.mjs). They are
               this board's public handles. The class is what the board queries
               itself by, scoped to its own host, so nothing here depends on
               there being exactly one map in the document: the id is the
               contract, the class is the mechanism.
               NO BACKTICKS IN THIS BLOCK. It sits inside a template literal and
               I put four in on the first draft; the string closed, the screen
               stopped mounting, node --check said the file was fine, and every
               instrument reported did-not-mount rather than a syntax error.
               map.js warned about exactly this, three comments running, and I
               read the warning and did it anyway. -->
          <g id="map-nodes" class="map-nodes"></g>
        </svg>
      </div>
    </div>
    ${chromeHtml}
    <!-- THE DELIVERED TAP SIZE, SAID WHERE THE PLAYER IS — and SILENT whenever
         the promise is kept. Sunna's rule, in her own words about her own
         proposal: "a line that says the same thing every time you open the
         screen is not a warning, it is decoration with a worried face."
         Every number in it is READ, never typed. -->
    <p class="map-tapnote" hidden></p>
    <!-- OUTSIDE the scrollport, and that is the whole fix (EldenSpire#28).
         These three buttons used to be the last child of .map-scroll,
         absolutely positioned over it, so they covered a piece of the pannable
         canvas. WHICH piece is a coincidence of shape x map zoom x pan offset x
         seed, and at 412x915 the coincidence was two map nodes a player could
         see and could not tap. A sibling is laid out in the flow beside the
         scrollport, so the scrollport is smaller by exactly the bar and there is
         no offset left for a node to be trapped at. Still no backticks. -->
    <div class="map-zoom">
      <button class="zbtn zoom-out" id="zoom-out" title="Zoom out">−</button>
      <button class="zbtn zoom-reset" id="zoom-reset" title="Reset / center">⊙</button>
      <button class="zbtn zoom-in" id="zoom-in" title="Zoom in">+</button>
    </div>`);

  const scroll = host.querySelector('.map-scroll');
  const svgEl = scroll.querySelector('svg');
  const g = scroll.querySelector('.map-nodes');
  const tapNote = host.querySelector('.map-tapnote');

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
    // to place a node that is not an `event`, its true kind cannot leak through.
    const rd = nodeReading(n, { reveal });
    const shownType = rung === KNOWN ? rd.shownType : 'event';
    const revealed = rung === KNOWN && rd.revealed;
    const extra = viewer.classes ? viewer.classes(n) : '';
    const cls = [
      'map-node',
      shownType,
      `k-${rung}`,
      traveled.has(n.id) || n.id === current ? 'visited' : '',
      n.id === current ? 'current' : '',
      isReachable ? 'reachable' : '',
      revealed ? 'revealed' : '',
      extra,
    ].filter(Boolean).join(' ');
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.setAttribute('class', cls);
    // The node's id on the element — so an instrument can compare the SET the
    // page drew against the set the ladder says it should have. It leaks nothing
    // a fogged player must not have: only DRAWN nodes get an element, and the id
    // is a floor and a column, never a type.
    el.dataset.node = n.id;
    // THE RADIUS IS SOLVED FROM THE TAP FLOOR (model/mapview.js), and it is the
    // node's own in every mode and on every screen: fog changes WHICH nodes are
    // drawn and never HOW BIG one is, and neither does having a partner.
    const r = nodeRadius(n.type);
    const halo = isReachable ? `<circle class="node-halo" cx="${x(n.col)}" cy="${y(n.floor)}" r="${r + 6}"/>` : '';
    // The per-viewer mark rides LAST so it draws over the node, and it is given
    // the geometry rather than left to re-derive it — a second copy of `y()` is
    // how this whole file came to be needed.
    const mark = viewer.mark ? viewer.mark(n, { x: x(n.col), y: y(n.floor), r }) : '';
    el.innerHTML = `${halo}<circle cx="${x(n.col)}" cy="${y(n.floor)}" r="${r}"/><text x="${x(n.col)}" y="${y(n.floor)}">${nodeIcon(shownType)}</text>${mark || ''}`;
    if (isReachable && viewer.onPick) el.addEventListener('click', () => viewer.onPick(n.id));
    if (viewer.tooltip) attachTooltip(el, () => viewer.tooltip(n, { shownType, revealed, reachable: isReachable }));
    g.appendChild(el);
  }

  // THE SCREEN SAYS WHAT IT DREW — a fog that cannot report its own census
  // cannot be caught covering the wrong thing. The count is the DOM's, counted
  // while appending, never re-derived from the ladder it is meant to check.
  if (fog) attachParchment(scroll.querySelector('.map-fog-ground'), assetUrl(parchmentAsset(act.actNumber)), width, height);
  scroll.dataset.nodesDrawn = String(drawnCount);
  scroll.dataset.nodesTotal = String(nodes.length);
  scroll.dataset.nodesHidden = String(know.counts.hidden);
  scroll.dataset.nodesPlaced = String(know.counts.placed);

  // ---- zoom + centering (SPEC §7.1 map UX) ----
  const saved = savedZoom(viewer.meta);
  let framing = saved == null ? 'fit' : 'saved';
  let zoom = saved == null ? ZOOM_MIN : saved;

  // The svg scales by setting its pixel width/height (viewBox unchanged), so the
  // scroll container grows and native scrollbars appear.
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
    const cur = current && byId[current] ? byId[current] : null;
    return cur ? [cur, ...rs] : rs;
  }

  // ONE FLOOR OF LOOK-AHEAD — where each of those choices leads. Fitting the
  // decision ALONE is correct and reads like a microscope. This set is a
  // PREFERENCE, never a promise: the zoom fits it when it can, and the guarantee
  // stays the framing set, because the zoom that fits a superset always fits the
  // set inside it. Under fog the look-ahead is empty by construction — aiming at
  // nodes the fog covers would frame blank parchment.
  function contextNodes() {
    const fs = framingNodes();
    const seen = new Set(fs.map((n) => n.id));
    const out = [...fs];
    for (const n of fs) {
      for (const id of n.next || []) {
        if (!seen.has(id) && byId[id] && isDrawn(id)) { seen.add(id); out.push(byId[id]); }
      }
    }
    return out;
  }

  // Scroll so the framing set sits in the middle of the viewport, and — when the
  // zoom is computed — pick the zoom that makes it fit first.
  //
  //   1. FIT, THEN CENTRE. The centroid was never wrong; nothing fitted the
  //      framing to the content. A box centre also beats a centroid.
  //   2. CLAMP OURSELVES, THEN SAY WHETHER IT WORKED. The old shape assigned
  //      `Math.max(0, …)`, the browser clamped the high end silently, and the
  //      function had no way to know: a write it cannot read back is a camera
  //      that cannot miss.
  function centerOnCurrent() {
    const fs = framingNodes();
    if (!fs.length) { report(null, null); return; }
    if (framing === 'fit' && scroll.clientWidth > 0 && scroll.clientHeight > 0) {
      const zDecision = fitZoom(framingBox(fs, height), scroll.clientWidth, scroll.clientHeight);
      const zContext = fitZoom(framingBox(contextNodes(), height), scroll.clientWidth, scroll.clientHeight);
      const z = clampZoom(Math.min(zDecision, zContext));
      if (Math.abs(z - zoom) > 0.0005) { zoom = z; sizeSvg(); }
    }
    const box = framingBox(fs, height);
    // Aim at the wider box when it fits at this zoom, and fall back to the
    // decision box the moment it does not.
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

  // THE CAMERA SAYS WHETHER IT MISSED. `data-framing` is `fit` or `clipped`,
  // with the overflow in local px beside it, so a player-facing warning, a
  // screenshot and tools/mapfit.mjs all read one fact instead of three
  // re-derivations.
  let warnedClipped = false;
  function report(box, count) {
    const d = scroll.dataset;
    if (!box) { d.framing = 'none'; d.framingMiss = '0'; reportTapSize(); return; }
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
      console.warn(`[mapboard] the framing does not fit: ${count} node(s) of choice need `
        + `${Math.round(box.w)}x${Math.round(box.h)} local px, the map viewport is `
        + `${scroll.clientWidth}x${scroll.clientHeight}, and the zoom ladder floors at ${ZOOM_MIN}x — `
        + `${Math.round(over)} px of the choice is off screen and only panning reaches it. `
        + `This act is ${columns} columns wide.`);
    }
    reportTapSize();
  }

  // WHAT A MAP NODE ACTUALLY DELIVERS TO A THUMB, at this zoom on this screen.
  // The radius is solved at ONE reference — the tap default at the default map
  // zoom on a 390x844 phone — so it cannot be a promise at every shape, and the
  // honest thing is the screen saying the number where the player is, and saying
  // NOTHING when the floor is met. Both values are READ rather than recomputed.
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
    // A hand on the ladder is an override, and it OUTLIVES the next re-centre.
    framing = 'manual';
    zoom = clampZoom(next);
    applyZoom(keepCenter);
  }
  // ⊙ — "Reset / center", and it means it: back to the computed frame from
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
  host.querySelector('.map-zoom .zoom-in').addEventListener('click', () => stepZoom(1));
  host.querySelector('.map-zoom .zoom-out').addEventListener('click', () => stepZoom(-1));
  host.querySelector('.map-zoom .zoom-reset').addEventListener('click', () => resetFraming());

  // Ctrl/⌘ + wheel zooms; plain wheel scrolls.
  scroll.addEventListener('wheel', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    stepZoom(ev.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  // Drag-to-pan (in addition to scrollbars). #22's lifecycle, same helper as the
  // cards: listeners live on the scroller and die with it, and cancel ends the
  // pan exactly as release does.
  let panning = false;
  let sx = 0; let sy = 0; let sl = 0; let st = 0;
  scroll.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('.map-node.reachable')) return;
    panning = true;
    sx = ev.clientX; sy = ev.clientY;
    sl = scroll.scrollLeft; st = scroll.scrollTop;
    scroll.classList.add('grabbing');
    trackGesture(ev, {
      onMove: (mv) => {
        if (!panning) return;
        scroll.scrollLeft = sl - (mv.clientX - sx);
        scroll.scrollTop = st - (mv.clientY - sy);
      },
      onEnd: () => { panning = false; scroll.classList.remove('grabbing'); },
    });
  });

  // The flex container may report height 0 until layout settles, so centre on
  // the first non-zero size via a ResizeObserver, with a timeout backstop.
  let ro = null;
  let backstop = null;
  function recenter(onSettled) {
    const run = () => { centerOnCurrent(); if (onSettled) onSettled(); };
    applyZoom(false);
    if (scroll.clientHeight > 0) run();
    else if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (scroll.clientHeight > 0) { run(); ro.disconnect(); ro = null; }
      });
      ro.observe(scroll);
    }
    // Backstop in case the observer never fires. Cheap and idempotent.
    backstop = setTimeout(run, 120);
  }

  function teardown() {
    if (ro) { ro.disconnect(); ro = null; }
    if (backstop) { clearTimeout(backstop); backstop = null; }
  }

  return {
    scroll, svg: svgEl, counts: know.counts, know, columns, width, height,
    recenter, resetFraming, stepZoom, teardown,
    get zoom() { return zoom; },
  };
}

/**
 * attachParchment(host, path, w, h) — put the act's plate on the ground layer,
 * but ONLY once the file has actually decoded.
 *
 * The load is probed with a plain `Image`, not by inserting the `<image>` and
 * hoping: a decode failure then costs nothing, because nothing was ever added to
 * the document. Fire-and-forget by design — a plate that arrives 40 ms after the
 * map does is a background fading in; a map that waits for one is a map that
 * never opens when the file is absent.
 *
 * No `onerror` on purpose: the absent plate is the SHIPPING state today, and a
 * console warning per map mount would be noise about a thing everyone knows. The
 * moment the files exist, a missing one is a 404 in the network panel.
 */
export function attachParchment(host, path, w, h) {
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
  probe.src = path;
}
