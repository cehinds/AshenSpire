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
  mapKnowledge, nodeReading, resolveMapMode, resolveShrineGlow, shrineLane,
  HIDDEN, KNOWN, MAP_MODE_DEFAULT,
} from '../../model/mapknowledge.js';
import {
  ZOOM_STEPS, ZOOM_MIN, MAP_ZOOM_DEFAULT,
  clampZoom, framingBox, fitZoom, nodeRadius, nodeX, nodeY, svgWidth, svgHeight,
  NODE_R, TAP_TARGET_DEFAULT, deliveredNodePx,
} from '../../model/mapview.js';

const HALO_PAD = 6;

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
 * mountMapBoard(host, { act, viewer, chromeHtml, showLegendControl }) → board
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
 *   `shrineGlow` OPTIONAL override for the shrine-lane setting. Omitted, it is
 *              read from `meta` — the setting is the player's, and this exists
 *              so a harness can pose both answers without writing a profile.
 *   `mark`      (node) → extra SVG inside the node's <g>. Vote pips live here.
 *   `classes`   (node) → extra classes. `my-vote` lives here.
 *   `tooltip`   (node, reading) → html.
 *   `onPick`    (id) → void, fired only for reachable nodes.
 *
 * `chromeHtml` is emitted BETWEEN the scrollport and the tap note, and the
 * position is a fix rather than a preference: `.hint-bar` is fixed to the bottom
 * of the viewport, so once the zoom bar stopped floating the two claimed one
 * band and the hint pill sat on top of the − and the ⊙ (map.css:47).
 * `showLegendControl` adds the solo map's help control to the bottom row. Co-op
 * omits it because that screen has no matching legend popover.
 *
 * Returns `{ scroll, svg, counts, recenter, stepZoom, resetFraming, teardown }`.
 * KEYS ARE NOT OWNED HERE. Each screen wires its own — the solo map's handler
 * carries a veil guard and a re-mount singleton that are the screen's business,
 * and a second listener living in here would be the third thing stepping the
 * zoom twice.
 */
export function mountMapBoard(host, { act, viewer = {}, chromeHtml = '', showLegendControl = false }) {
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
  const map = { nodes: byId, startIds: act.startIds || [], bossId: act.bossId };
  const run = { mapNodeId: current, path: viewer.path || [] };
  const app = host;
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
  });
  const isDrawn = (id) => know.drawn.has(id);

  // ---- the shrine lane ---------------------------------------------------
  //
  // "as new paths open, the path to the nearest shrine should have a glowing
  // effect. (make this toggleable in the settings)" — Constantine, 2026-08-16.
  //
  // THE LANE IS THE VIEWER'S, NOT THE ACT'S, which is why it is computed here
  // beside the knowledge and not handed in by the screen: it is aimed from
  // where THIS viewer is standing, and two players on one act have two lanes.
  //
  // CLIPPED TO WHAT IS DRAWN, and the clip is the whole safety of the feature.
  // Under fog the walk to the nearest shrine runs through nodes the player has
  // not earned; painting the lane over them would leak the act's shape through
  // a highlight, and it would be the one thing here a player could not un-see.
  // So a node glows only if it is drawn, and an edge only if BOTH its ends are
  // — the same rule the edge loop below already applies, for the same reason.
  const glowOn = viewer.shrineGlow !== undefined
    ? !!viewer.shrineGlow
    : resolveShrineGlow(viewer.meta);
  const lane = glowOn
    ? shrineLane({ graph: { nodes: byId, startIds: act.startIds, bossId: act.bossId }, run })
    : [];
  const laneNodes = new Set(lane.filter(isDrawn));
  const laneEdge = new Set();
  for (let i = 0; i + 1 < lane.length; i++) {
    if (isDrawn(lane[i]) && isDrawn(lane[i + 1])) laneEdge.add(`${lane[i]}>${lane[i + 1]}`);
  }

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
      const isLane = laneEdge.has(`${n.id}>${toId}`);
      edgeSvg += `<line class="map-edge${isTraveled ? ' traveled' : ''}${isLane ? ' shrine-lane' : ''}" x1="${x(n.col)}" y1="${y(n.floor)}" x2="${x(to.col)}" y2="${y(to.floor)}"/>`;
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
    <div class="map-frame">
    <!-- NO data-scroll-axis HERE, AND THE ABSENCE IS THE FACT. This container
         carried the exemption 'the act map is a horizontal route' (1c227ec) —
         a sentence D17 message 4 contradicts in Constantine's own words: "not
         require any scrollign left or right." The route is a CLIMB and it runs
         UP. The exemption died with the travel: the camera now owns the
         horizontal axis through the viewBox (see sizeSvg), horizontal travel is
         zero by construction, and axisfit's A4 ratchet would fail a declaration
         with no travel under it — correctly. -->
    <div class="map-scroll${fog ? ` ${parchmentClass(act.actNumber)}` : ''}" data-map-mode="${mode}">
      <div class="map-canvas">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${groundSvg}
          <text class="map-act-title" x="${width / 2}" y="24" text-anchor="middle" fill="var(--gold)" font-size="17" letter-spacing="4" font-family="Georgia,serif">${actTitle(act.actNumber)}</text>
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
      ${fog ? '<div class="map-vignette" aria-hidden="true"></div>' : ''}
    </div>
    ${chromeHtml}
    <!-- THE DELIVERED TAP SIZE, SAID WHERE THE PLAYER IS — and SILENT whenever
         the promise is kept. Sunna's rule, in her own words about her own
         proposal: "a line that says the same thing every time you open the
         screen is not a warning, it is decoration with a worried face."
         Every number in it is READ, never typed. -->
    <p class="map-tapnote" hidden></p>
    <!-- THE OFF-SCREEN CHOICE, SAID WHERE THE PLAYER IS — the tap note's
         sibling, same discipline: SILENT whenever the promise is kept. It
         exists because the camera owns the horizontal axis now (sizeSvg): a
         choice clipped sideways at a player-chosen zoom cannot be dragged to —
         the trained gesture died with the travel — and the only recovery is
         the ladder (−) or ⊙. Measured before this note existed (Sunna,
         2026-08-14, 40 seeds x both phone shapes): at manual 200% every
         floor-11 edge column ships its ONLY next step wholly off screen with
         nothing but a line of edge ink to say so. report() drives it from
         the same overflow the confession reads, so the note and data-framing
         cannot disagree. Still no backticks. -->
    <p class="map-clipnote" hidden></p>
    <!-- OUTSIDE the scrollport, and that is the whole fix (EldenSpire#28).
         The zoom controls used to be the last child of .map-scroll,
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
      ${showLegendControl ? '<button class="zbtn map-legend-btn" id="map-legend" title="Map legend" aria-label="Map legend">?</button>' : ''}
    </div>`);

  const scroll = host.querySelector('.map-scroll');
  const svgEl = scroll.querySelector('svg');
  const g = scroll.querySelector('.map-nodes');
  const tapNote = host.querySelector('.map-tapnote');
  const clipNote = host.querySelector('.map-clipnote');

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
      laneNodes.has(n.id) ? 'shrine-lane' : '',
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
  // WHAT THE BOARD SAYS IT GLOWED — the same discipline as the fog census one
  // line up, and for the same reason: a lane that cannot report itself cannot
  // be caught painting through the fog. This is the CLIPPED lane, i.e. exactly
  // the set that should carry `.shrine-lane` in the DOM, so an instrument can
  // compare two sets rather than trust one count. The full walk is deliberately
  // NOT published: it names nodes the player has not earned.
  scroll.dataset.shrineLane = [...laneNodes].join(',');

  // Settings owns the DEFAULT. The run owns what the player subsequently did
  // with the on-map ladder and camera. A changed Settings value invalidates the
  // old live view explicitly, so the Settings control never looks dead.
  const setting = String((((viewer.meta || {}).settings || {}).mapZoom) ?? MAP_ZOOM_DEFAULT);
  const candidate = viewer.viewState;
  // Fit is a viewport promise, not a portable camera coordinate. A fit solved
  // on desktop must be recomputed when that run opens on a phone; manual and
  // saved views remain exact because they are deliberate player choices.
  const fitViewportMatches = candidate && candidate.framing === 'fit'
    ? Number.isFinite(candidate.viewportWidth)
      && Number.isFinite(candidate.viewportHeight)
      && Math.abs(candidate.viewportWidth - scroll.clientWidth) <= 1
      && Math.abs(candidate.viewportHeight - scroll.clientHeight) <= 1
    : true;
  const restored = candidate && candidate.actNumber === act.actNumber
    && candidate.nodeId === (run.mapNodeId || null)
    && candidate.setting === setting
    && Number.isFinite(candidate.zoom) && candidate.zoom > 0
    && ['fit', 'saved', 'manual'].includes(candidate.framing)
    && Number.isFinite(candidate.scrollLeft) && candidate.scrollLeft >= 0
    && Number.isFinite(candidate.scrollTop) && candidate.scrollTop >= 0
    && Number.isFinite(candidate.aimX)
    && fitViewportMatches
    ? candidate : null;
  const saved = restored ? clampZoom(restored.zoom) : savedZoom(viewer.meta);
  let framing = restored ? restored.framing : (saved == null ? 'fit' : 'saved');
  let zoom = saved == null ? ZOOM_MIN : saved;

  // ---- zoom + centering (SPEC §7.1 map UX) ----
  // `scroll` and `svgEl` were scoped to this board above.

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
  // THE RULE, one sentence per axis, because the two axes answer two different
  // masters. VERTICAL — the thumb's axis, D17's "the edges need to be longer
  // and more in the verticle axis": the scrollable content is the painted ink,
  // grown by half a viewport above and below so that ANY painted point can be
  // brought to the centre (`overflow = ink`). HORIZONTAL — the camera's axis,
  // Law 5 clause 1 and D17's "not require any scrollign left or right": the
  // content box is EXACTLY the viewport, centred on the camera's aim, so the
  // scrollport never has a horizontal overflow to give a finger. Travel across
  // is ZERO BY CONSTRUCTION — not clamped, not small: there is no extent.
  // Centring still works on both axes; what moved is WHO does the horizontal
  // half — the viewBox origin (aimX, below), never scrollLeft.
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
  // of this expression WAS: the VERTICAL axis was the defect it was written to
  // fix and it fixed it (19 -> 692 px of travel, which is what makes centring
  // possible at all), and the HORIZONTAL axis was unpaid.
  //
  // THE HORIZONTAL AXIS IS NOW PAID, and the payment is structural, not a
  // clamp. Measured at dev = acb8ffe before this change, the shipped bundle,
  // default settings (fog, Fit), 12 seeds x entrance/walk3/walk6 x 390x844 +
  // 320x640: travel across ran 114..835 px and was zero on 0 of 72 cells,
  // while `data-framing` said `fit/0` on ALL 72 — the promise never needed the
  // axis it was hoarding. The fix follows from that measurement: the camera
  // keeps the decision framed, so the horizontal freedom belongs to the camera
  // (the viewBox aim), and the scroller's horizontal extent is the viewport
  // itself. `tools/axisfit.mjs` still owns the number; this comment claims
  // only the mechanism.
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
  // WHERE THE CAMERA POINTS ON THE HORIZONTAL AXIS, in SVG units — the ONLY
  // horizontal position this board has, because scrollLeft has no extent to
  // hold one. Written by `centerOnCurrent` (the current node's column, or the
  // entrance aim's centre, nudged so a fitting decision box is never cut);
  // read by `apply`, which centres the viewBox on it. Before the first
  // centring it is the ink's own centre, the honest place to stand when
  // nothing has been aimed at yet.
  let aimX = restored ? restored.aimX : (inkBox.x0 + inkBox.x1) / 2;
  let restorePending = !!restored;
  let viewCommitTimer = null;
  let pendingViewCommit = null;

  scroll.dataset.cameraRestore = restored ? 'restored' : (candidate ? 'recomputed' : 'new');

  function viewSnapshot() {
    return {
      actNumber: act.actNumber,
      nodeId: run.mapNodeId || null,
      setting,
      zoom,
      framing,
      scrollLeft: scroll.scrollLeft,
      scrollTop: scroll.scrollTop,
      aimX,
      viewportWidth: scroll.clientWidth,
      viewportHeight: scroll.clientHeight,
    };
  }

  function emitViewState(commit = false, snapshot = viewSnapshot()) {
    if (!scroll.isConnected) return; // the player left the map while a commit was pending
    if (viewer.onViewStateChange) viewer.onViewStateChange(snapshot, { commit });
  }
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
    const padY = scroll.clientHeight > 0 ? scroll.clientHeight / (2 * zoom) : 0;
    // HORIZONTAL: the content box IS the viewport, centred on the camera's aim.
    // `w * zoom` lands exactly on `clientWidth`, so scrollWidth == clientWidth
    // and horizontal travel is zero with nothing left to clamp. Ink outside
    // [x0, x0+w] is clipped by the viewBox — deliberately: it is history and
    // context the centring promise does not cover, and D17 asks for the current
    // and next nodes focused, not a pannable panorama. The pre-layout fallback
    // is the bare ink, same honesty as the vertical branch.
    const w = scroll.clientWidth > 0 ? scroll.clientWidth / zoom : (inkBox.x1 - inkBox.x0);
    const x0 = aimX - w / 2;
    const y0 = inkBox.y0 - padY;
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

    // THE HORIZONTAL HALF HAPPENS IN SVG UNITS, BEFORE THE VIEWBOX IS SIZED,
    // because the viewBox is where it lands: `apply()` centres the content box
    // on `aimX`, so writing the aim and then sizing IS the horizontal centring.
    // There is no scrollLeft arithmetic to do afterwards — no extent exists.
    //
    // CENTRED UNLESS CENTRING WOULD HIDE THE CHOICE — the clause survives the
    // axis moving house, verbatim in its logic: the centre is a TARGET and the
    // decision is a FLOOR. Nudge the aim by the smallest amount that keeps the
    // framing box wholly inside the viewport-wide content box, and only when it
    // fits at this zoom — when it cannot fit, nothing here can save it, the
    // node under the player's feet stays centred, and `report` says so.
    aimX = (aim.x0 + aim.x1) / 2;
    const half = (scroll.clientWidth > 0 ? scroll.clientWidth / zoom : (inkBox.x1 - inkBox.x0)) / 2;
    if (box.x1 - box.x0 <= 2 * half) {
      aimX = Math.min(box.x0 + half, Math.max(box.x1 - half, aimX));
    }

    // ALWAYS, not only when the zoom moved: the content box is a function of
    // the viewport as well as the zoom, this is the first call after a resize —
    // and the viewBox now carries the horizontal aim, so sizing must follow it.
    sizeSvg();
    // THE ACT TITLE FOLLOWS THE AIM, and this is a fix for something that was
    // already broken rather than for something I broke. `ACT I · THE FALLOW
    // MARCHES` was pinned to the middle of the act's canvas while the camera
    // looked wherever the player was, so it arrived cut off at a screen edge —
    // "ALLOW MARCHES" in the shot of `dev` I took before touching any of this.
    // The camera knows where it is pointing; the title is one attribute away
    // from being centred over it.
    if (titleEl) titleEl.setAttribute('x', String(aimX));

    // THE VERTICAL HALF IS THE SCROLLER'S, unchanged in its logic: centre the
    // aim, nudge so a fitting decision box stays on screen, clamp to the real
    // extent, and let `report` measure what landed.
    const cy = ((aim.y0 + aim.y1) / 2 - content.y0) * zoom;
    let top = cy - scroll.clientHeight / 2;
    const bt = (box.y0 - content.y0) * zoom;
    const bb = (box.y1 - content.y0) * zoom;
    if (bb - bt <= scroll.clientHeight) top = Math.min(bt, Math.max(bb - scroll.clientHeight, top));

    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    // scrollLeft is written once, to zero, as a statement rather than a repair:
    // if this line ever moves a pixel, the horizontal extent has come back and
    // axisfit will say so before any player does.
    scroll.scrollLeft = 0;
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
    if (!box) {
      d.framing = 'none'; d.framingMiss = '0';
      if (clipNote) { clipNote.hidden = true; clipNote.textContent = ''; }
      return;
    }
    // EVERY TERM IS RELATIVE TO THE CONTENT ORIGIN, which stopped being the
    // canvas origin when the scroll extent became the ink (see `sizeSvg`).
    // Leaving these as `box.x0 * zoom` would have made the confession wrong by
    // exactly the pad — a camera lying in a new direction — and
    // `tools/mapfit.mjs`'s cross-check is what would have caught it.
    const l = (box.x0 - content.x0) * zoom;
    const r = (box.x1 - content.x0) * zoom;
    const t = (box.y0 - content.y0) * zoom;
    const b = (box.y1 - content.y0) * zoom;
    // THE TWO AXES ARE TWO DIFFERENT FAILURES NOW, and they are kept apart on
    // purpose: a vertical miss can still be scrolled to (the thumb's axis), a
    // horizontal miss cannot — the camera owns X (sizeSvg) and the pan
    // handler's horizontal write is inert. So the horizontal overflow feeds the
    // player-facing note below, while `over` keeps its one job: the confession
    // (`data-framing`) that three instruments already read, unchanged in
    // meaning.
    const hOverL = Math.max(0, scroll.scrollLeft - l);
    const hOverR = Math.max(0, r - (scroll.scrollLeft + scroll.clientWidth));
    const over = Math.max(
      0,
      hOverL,
      hOverR,
      scroll.scrollTop - t,
      b - (scroll.scrollTop + scroll.clientHeight)
    );
    d.framing = over > 0.5 ? 'clipped' : 'fit';
    d.framingMiss = String(Math.round(over));
    d.framingZoom = zoom.toFixed(3);
    d.framingCount = String(count);
    // THE MERCY LINE — the tap note's rule, in the same words: a line that says
    // the same thing every time is decoration, so this one exists ONLY when a
    // choice is off screen SIDEWAYS, the one direction no gesture reaches. It
    // names the recovery the screen actually offers (− and ⊙ are two buttons
    // away, in the flow below), because the player's trained answer — drag
    // toward it — moves nothing on this axis and reads as a stuck screen.
    // Driven from the same numbers as the confession, so the two cannot drift.
    if (clipNote) {
      const hClipped = Math.max(hOverL, hOverR) > 0.5;
      clipNote.hidden = !hClipped;
      clipNote.textContent = !hClipped ? ''
        : `A path runs off screen to the ${hOverR >= hOverL ? 'right' : 'left'} — zoom out (−) or press ⊙ to bring it back.`;
    }
    if (over > 0.5 && !warnedClipped) {
      warnedClipped = true;
      console.warn(`[map] the framing does not fit: ${count} node(s) of choice need `
        + `${Math.round(box.w)}x${Math.round(box.h)} local px, the map viewport is `
        + `${scroll.clientWidth}x${scroll.clientHeight}, and the zoom ladder floors at ${ZOOM_MIN}x — `
        + `${Math.round(over)} px of the choice is off screen. A horizontal miss has no pan to reach it `
        + `(the camera owns that axis; zoom out or ⊙ recovers it, and the screen now says so); `
        + `a vertical miss still scrolls. This act is ${columns} columns wide.`);
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
    emitViewState(true);
  }
  // ⊙ — "Reset / center", and now it means it: back to the computed frame from
  // wherever the ladder, the wheel or the saved setting left us.
  function resetFraming() {
    framing = 'fit';
    centerOnCurrent();
    emitViewState(true);
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
  let activeMousePointerId = null;
  scroll.addEventListener('pointerdown', (ev) => {
    // Touch and pen belong to the browser's native vertical scroll path. If
    // this handler captures either one, native pan and our scrollTop writes
    // race each other. A second mouse pointer also cannot replace the origin
    // of the gesture already in flight.
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || activeMousePointerId !== null) return;
    // The `.map-zoom` half of this guard went with the overlay (EldenSpire#28).
    // This listener is on .map-scroll and the buttons are no longer inside it,
    // so a press on one cannot reach here to be excluded. Left in, it would be
    // a line that reads like protection and can never run — and the next reader
    // would take it as evidence the buttons are still in the scrollport.
    if (ev.target.closest('.map-node.reachable')) return;
    activeMousePointerId = ev.pointerId;
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
        if (!panning || mv.pointerId !== activeMousePointerId) return;
        // The horizontal write is INERT BY CONSTRUCTION, kept for the day a
        // wide layout earns a horizontal extent back: scrollWidth equals
        // clientWidth on every shape now (see apply), so the browser clamps
        // this to 0 and a sideways drag moves nothing. That is the design, not
        // a regression — the camera owns X, the thumb owns Y (Law 5, D17).
        scroll.scrollLeft = sl - (mv.clientX - sx);
        scroll.scrollTop = st - (mv.clientY - sy);
      },
      onEnd: (end) => {
        if (end.pointerId !== activeMousePointerId) return;
        activeMousePointerId = null;
        panning = false;
        scroll.classList.remove('grabbing');
        emitViewState(true);
      },
    });
  });

  // Wheel/scrollbar panning has no pointer-end callback. Debounce the real
  // scroller's event so a gesture becomes one durable run write, not one write
  // per pixel. Programmatic centring may also emit; that simply records the
  // exact view the player is looking at.
  scroll.addEventListener('scroll', () => {
    if (viewCommitTimer) clearTimeout(viewCommitTimer);
    // Freeze both the camera and its node identity NOW. The live run may enter
    // a reachable node before this debounce fires; reading it in the callback
    // would mislabel the detached board's old camera as belonging to that node.
    pendingViewCommit = viewSnapshot();
    // Keep the in-memory run camera current synchronously. Save & Quit may land
    // before the durable debounce below, so its ordinary save door must see the
    // final pan. `commit:false` updates run.mapView without adding a storage
    // write; the timer remains the single durable connected-board commit.
    emitViewState(false, pendingViewCommit);
    viewCommitTimer = setTimeout(() => {
      viewCommitTimer = null;
      const snapshot = pendingViewCommit;
      pendingViewCommit = null;
      if (snapshot) {
        scroll.dataset.committedViewNode = snapshot.nodeId || 'entrance';
        emitViewState(true, snapshot);
      }
    }, 80);
  }, { passive: true });

  // The flex container may report height 0 until layout settles, so centre on
  // the first non-zero size via a ResizeObserver, with a timeout backstop.
  let ro = null;
  let backstop = null;
  function recenter(onSettled) {
    let settled = false;
    const settle = () => {
      // A timeout is only a request to settle. A zero-height scrollport has no
      // real camera geometry yet, so it must not consume the one settled pass;
      // keep the observer alive until layout supplies a usable viewport.
      if (settled || scroll.clientHeight <= 0) return false;
      settled = true;
      if (restorePending) {
        restorePending = false;
        sizeSvg();
        scroll.scrollLeft = Math.min(Math.max(0, scroll.scrollWidth - scroll.clientWidth), restored.scrollLeft);
        scroll.scrollTop = Math.min(Math.max(0, scroll.scrollHeight - scroll.clientHeight), restored.scrollTop);
        if (titleEl) titleEl.setAttribute('x', String(aimX));
        const fs = framingNodes();
        const box = fs.length ? framingBox(fs, height) : null;
        report(box, fs.length);
        const currentNode = run.mapNodeId && map.nodes[run.mapNodeId] ? map.nodes[run.mapNodeId] : null;
        reportEntrance(currentNode || !box ? null : entranceFrame(fs, box));
        reportTapSize();
      } else {
        centerOnCurrent();
      }
      emitViewState(false);
      if (onSettled) onSettled();
      return true;
    };
    applyZoom(false);
    if (scroll.clientHeight > 0) settle();
    else if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (settle()) { ro.disconnect(); ro = null; }
      });
      ro.observe(scroll);
    }
    // Backstop in case the observer never fires. Cheap and idempotent.
    backstop = setTimeout(settle, 120);
  }

  function teardown() {
    if (ro) { ro.disconnect(); ro = null; }
    if (backstop) { clearTimeout(backstop); backstop = null; }
    if (viewCommitTimer) { clearTimeout(viewCommitTimer); viewCommitTimer = null; }
    pendingViewCommit = null;
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
  const port = () => (host.closest ? host.closest('.map-scroll') : null);
  probe.onload = () => {
    const sc = port();
    if (sc) sc.dataset.mapPlate = 'ok';
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
