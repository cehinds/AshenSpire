// src/ui/components/mapboard.js â€” THE ACT MAP. One renderer, mounted twice.
//
// WHY THIS FILE EXISTS, and it is a collapse and not a repair.
//
// There were two act-map renderers in this tree: `ui/screens/map.js` and, eighty
// lines inside `ui/screens/coop.js`, a second one with its own `ROW_H = 46`, its
// own `y(floor)` and its own `r = boss ? 20 : 15` â€” the literals every other map
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
// counted eight times, and the fix is not eight repairs â€” it is that the second
// copy stops existing.
//
// THE RULING THIS FILE IS SHAPED BY â€” ask what the predicate's subject is.
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
//      and nothing should â€” a partner panning my map is not a feature.
//   3. WHO DECIDES WHAT I KNOW. In solo the client derives its own fog, because
//      the client IS the authority. In co-op the server is, and a client may
//      never widen what it was sent â€” which is why the snapshot ships `unknown`
//      instead of `event` and why this file never tries to lift that rung.
//      Same ladder, different hand on it, deliberately.
//
// Everything else is one home. Turn `ROW_H`, the tap default or the zoom ladder
// and both screens move together, which is the whole point: the act map is being
// re-laid for a phone next, and a re-layout that has to be done twice is a
// re-layout that will be done once.
//
// WHAT THIS FILE DOES NOT OWN. The chrome around the board â€” headers, party
// bars, hint bars, relic strips, the leave button â€” stays with its screen. This
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
 * A PERCENTAGE IS THE DEFAULT AND `Fit` IS THE OPT-IN â€” Sunna's ruling on #107.
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
 * is a row and not a cleared preference, and `âŠ™` returns to it once chosen.
 */
export function savedZoom(meta) {
  const stored = ((meta && meta.settings) || {}).mapZoom;
  // Unset, OR A VALUE THIS LADDER CANNOT READ, is the SHIPPING DEFAULT and never
  // the computed frame. MAP_ZOOM_DEFAULT is the one home for which that is â€” the
  // settings row reads the same const for its `def`, so the two cannot disagree.
  //
  // THE SECOND CLAUSE USED TO BE A LIE â€” Vira, #107. The comment said unreadable
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
 * level down â€” and it is not cosmetic: `litNodes` (the fog light) does
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
 * mountMapBoard(host, { act, viewer, chromeHtml }) â†’ board
 *
 * `act` â€” WHAT THE MAP IS. `{ nodes, columns, actNumber, startIds, bossId }`.
 *   `nodes` may be the run's object or the snapshot's array (see `indexNodes`).
 *   `columns` absent falls back to the widest column in use AND SAYS SO â€” a
 *   silent fallback here re-opens the class of defect it was added to close.
 *
 * `viewer` â€” WHO IS LOOKING. Every field is legitimately different per client:
 *   `meta`      the viewer's own settings (map zoom, map reveal). May be absent.
 *   `reachable` Set of ids this viewer may act on.
 *   `current`   the id being stood on, or null.
 *   `path`      the ids already travelled, in order. Feeds the fog light.
 *   `mode`      'fog' | 'path'; omitted, it is read from `meta`.
 *   `reveal`    the Sealstone Key.
 *   `shrineGlow` OPTIONAL override for the shrine-lane setting. Omitted, it is
 *              read from `meta` â€” the setting is the player's, and this exists
 *              so a harness can pose both answers without writing a profile.
 *   `mark`      (node) â†’ extra SVG inside the node's <g>. Vote pips live here.
 *   `classes`   (node) â†’ extra classes. `my-vote` lives here.
 *   `tooltip`   (node, reading) â†’ html.
 *   `onPick`    (id) â†’ void, fired only for reachable nodes.
 *
 * `chromeHtml` is emitted BETWEEN the scrollport and the tap note, and the
 * position is a fix rather than a preference: `.hint-bar` is fixed to the bottom
 * of the viewport, so once the zoom bar stopped floating the two claimed one
 * band and the hint pill sat on top of the âˆ’ and the âŠ™ (map.css:47).
 *
 * Returns `{ scroll, svg, counts, recenter, stepZoom, resetFraming, teardown }`.
 * KEYS ARE NOT OWNED HERE. Each screen wires its own â€” the solo map's handler
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
  // regardless â€” a tunable map whose view ignores the tuning is not tunable.
  //
  // AND THE CO-OP HALF OF THAT FIX WAS ONE-SIDED AT dev cd3da94, which is
  // exactly what one home makes visible: `coop.js` was taught to read
  // `map.columns` from the snapshot, and `tools/session.mjs`'s `snapshot()` sent
  // `{ floors, startIds, bossId, nodes }` and never `columns` â€” so the warning
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

  // WHAT THE VIEWER KNOWS, derived once and read by everything below â€” the node
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
  // effect. (make this toggleable in the settings)" â€” Constantine, 2026-08-16.
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
  // â€” the same rule the edge loop below already applies, for the same reason.
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
  // hidden, so their edges are not drawn either â€” the line stops where the light
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
  // the three plates absent â€” the state this ships in â€” headless Chromium
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
         carried the exemption 'the act map is a horizontal route' (1c227ec) â€”
         a sentence D17 message 4 contradicts in Constantine's own words: "not
         require any scrollign left or right." The route is a CLIMB and it ×^õêÚ$z{-®éÜj×&"Ò†&÷‚ç“Ò6öçFVçBç“’¢¦ööÓ°Ð¢–b†&"Ò'BÃÒ67&öÆÂæ6Æ–VçD†V–v‡B’F÷ÒÖF‚æÖ–â†'BÂÖF‚æÖ‚†&"Ò67&öÆÂæ6Æ–VçD†V–v‡BÂF÷’“°Ð Ð¢6öç7BÖ…F÷ÒÖF‚æÖ‚ƒÂ67&öÆÂç67&öÆÄ†V–v‡BÒ67&öÆÂæ6Æ–VçD†V–v‡B“°Ð¢òò67&öÆÄÆVgB—2w&—GFVâöæ6RÂFò¦W&òÂ27FFVÖVçB&F†W"F†â&W—# Ð¢òò–bF†—2Æ–æRWfW"Ö÷fW2—†VÂÂF†R†÷&—¦öçFÂW‡FVçB†26öÖR&6²æ@Ð¢òò†—6f—Bv–ÆÂ6’6ò&Vf÷&Rç’Æ–W"FöW2àÐ¢67&öÆÂç67&öÆÄÆVgBÒ°Ð¢67&öÆÂç67&öÆÅF÷ÒÖF‚æÖ–â†Ö…F÷ÂÖF‚æÖ‚ƒÂF÷’“°Ð¢&W÷'B†&÷‚Âg2æÆVæwF‚“°Ð¢&W÷'DVçG&æ6R†VçG&æ6R“°Ð¢ÐÐ Ð¢òòD„R4ÔU$4•2t„UD„U"D„R5Bu2d"TäB•2ôâ45$TTâÂæB—B—24T4ôä@Ð¢òò6öæfW76–öâ&F†W"F†âv–FW"f—'7BöæRöâW'÷6RâFFÖg&Ö–ævç7vW'0Ð¢òò&—2F†RDT4•4”ôâöâ67&VVâ"æBFööÇ2öÖf—BæÖ§27&÷72Ö6†V6·2—Bv–ç7BÐ¢òò†÷Föw&‚öâ#g&Ö–æw3²föÆF–ærF–ffW&VçB&öÖ—6R–çFòF†BöæRf–VÆ@Ð¢òòv÷VÆB†fRÖ÷fVBçVÖ&W"F‡&VR–ç7G'VÖVçG2&VBâF†—2öæR—2FF—F—fS Ð¢òò'6VçB&Vf÷&RÂâö7BF†Rf—'7B7FWÂæBBF†RVçG&æ6Rf—F÷ Ð¢òò6Æ—VFv—F‚F†RÖ—72–âÆö6Â‚&W6–FR—B(	BF†R6ÖR–F–öÒÂöæRf–VÆ@Ð¢òò÷fW"âÖV7W&VBgFW"F†R67&öÆÂ†2ÆæFVBÂg&öÒF†R6ÖR67&öÆÅF÷F†PÐ¢òò'&÷w6W"æ÷r†öÆG2Â6ò—B—2&VF–æræBæ÷B&VF–7F–öâàÐ¢gVæ7F–öâ&W÷'DVçG&æ6R†VçG&æ6R’°Ð¢6öç7BBÒ67&öÆÂæFF6WC°Ð¢–b‚VçG&æ6R’²BæVçG&æ6TVæG2Òvâös²BæVçG&æ6TÖ—72Òss²&WGW&ã²ÐÐ¢–b‚VçG&æ6RæVæB’²BæVçG&æ6TVæG2ÒvæöæRs²BæVçG&æ6TÖ—72Òss²&WGW&ã²ÐÐ¢6öç7BRÒVçG&æ6RæVæC°Ð¢6öç7BÂÒ†RçƒÒ6öçFVçBçƒ’¢¦ööÓ°Ð¢6öç7B"Ò†RçƒÒ6öçFVçBçƒ’¢¦ööÓ°Ð¢6öç7BBÒ†Rç“Ò6öçFVçBç“’¢¦ööÓ°Ð¢6öç7B"Ò†Rç“Ò6öçFVçBç“’¢¦ööÓ°Ð¢6öç7B÷fW"ÒÖF‚æÖ‚€Ð¢ÀÐ¢67&öÆÂç67&öÆÄÆVgBÒÂÀÐ¢"Ò‡67&öÆÂç67&öÆÄÆVgB²67&öÆÂæ6Æ–VçEv–GF‚’ÀÐ¢67&öÆÂç67&öÆÅF÷ÒBÀÐ¢"Ò‡67&öÆÂç67&öÆÅF÷²67&öÆÂæ6Æ–VçD†V–v‡BÐ¢“°Ð¢BæVçG&æ6TVæG2Ò÷fW"âãRòv6Æ—VBr¢vf—Bs°Ð¢BæVçG&æ6TÖ—72Ò7G&–ær„ÖF‚ç&÷VæB†÷fW"’“°Ð¢ÐÐ Ð¢òòD„R4ÔU$4•2t„UD„U"•BÔ•54TBâF†—2—2F†R†ÆbF†BæWfW"W†—7FVC¢F†PÐ¢òòg&Ö–ær6÷VÆBf–Âöâ’öb"6VVG2B3“ƒƒCBæBWfW'’Æ–æRöb6öFPÐ¢òò–çföÇfVB&W÷'FVB7V66W72âFFÖg&Ö–æv—2f—F÷"6Æ—VFÂv—F‚F†PÐ¢òò÷fW&fÆ÷r–âÆö6Â‚&W6–FR—BÂ6òÆ–W"Öf6–ærv&æ–ærÂ67&VVç6†÷Bæ@Ð¢òòFööÇ2öÖf—BæÖ§2ÆÂ&VBöæRf7B–ç7FVBöbF‡&VR&RÖFW&—fF–öç2àÐ¢ÆWBv&æVD6Æ—VBÒfÇ6S°Ð¢gVæ7F–öâ&W÷'B†&÷‚Â6÷VçB’°Ð¢6öç7BBÒ67&öÆÂæFF6WC°Ð¢–b‚&÷‚’°Ð¢Bæg&Ö–ærÒvæöæRs²Bæg&Ö–ætÖ—72Òss°Ð¢–b†6Æ—æ÷FR’²6Æ—æ÷FRæ†–FFVâÒG'VS²6Æ—æ÷FRçFW‡D6öçFVçBÒrs²ÐÐ¢&WGW&ã°Ð¢ÐÐ¢òòUdU%’DU$Ò•2$TÄD•dRDòD„R4ôåDTåBõ$”t”âÂv†–6‚7F÷VB&V–ærF†PÐ¢òò6çf2÷&–v–âv†VâF†R67&öÆÂW‡FVçB&V6ÖRF†R–æ²‡6VR6—¦U7fv’àÐ¢òòÆVf–ærF†W6R2&÷‚çƒ¢¦ööÖv÷VÆB†fRÖFRF†R6öæfW76–öâw&öær'Ð¢òòW†7FÇ’F†RB(	B6ÖW&Ç––ær–âæWrF—&V7F–öâ(	Bæ@Ð¢òòFööÇ2öÖf—BæÖ§6w27&÷72Ö6†V6²—2v†Bv÷VÆB†fR6Vv‡B—BàÐ¢6öç7BÂÒ†&÷‚çƒÒ6öçFVçBçƒ’¢¦ööÓ°Ð¢6öç7B"Ò†&÷‚çƒÒ6öçFVçBçƒ’¢¦ööÓ°Ð¢6öç7BBÒ†&÷‚ç“Ò6öçFVçBç“’¢¦ööÓ°Ð¢6öç7B"Ò†&÷‚ç“Ò6öçFVçBç“’¢¦ööÓ°Ð¢òòD„REtò„U2$REtòD”ddU$TåBd”ÅU$U2äõrÂæBF†W’&R¶WB'BöàÐ¢òòW'÷6S¢fW'F–6ÂÖ—726â7F–ÆÂ&R67&öÆÆVBFò‡F†RF‡VÖ"w2†—2’ÂÐ¢òò†÷&—¦öçFÂÖ—726ææ÷B(	BF†R6ÖW&÷vç2‚‡6—¦U7fr’æBF†RàÐ¢òò†æFÆW"w2†÷&—¦öçFÂw&—FR—2–æW'Bâ6òF†R†÷&—¦öçFÂ÷fW&fÆ÷rfVVG2F†PÐ¢òòÆ–W"Öf6–æræ÷FR&VÆ÷rÂv†–ÆR÷fW&¶VW2—G2öæR¦ö#¢F†R6öæfW76–öàÐ¢òò†FFÖg&Ö–æv’F†BF‡&VR–ç7G'VÖVçG2Ç&VG’&VBÂVæ6†ævVB–àÐ¢òòÖVæ–æràÐ¢6öç7B„÷fW$ÂÒÖF‚æÖ‚ƒÂ67&öÆÂç67&öÆÄÆVgBÒÂ“°Ð¢6öç7B„÷fW%"ÒÖF‚æÖ‚ƒÂ"Ò‡67&öÆÂç67&öÆÄÆVgB²67&öÆÂæ6Æ–VçEv–GF‚’“°Ð¢6öç7B÷fW"ÒÖF‚æÖ‚€Ð¢ÀÐ¢„÷fW$ÂÀÐ¢„÷fW%"ÀÐ¢67&öÆÂç67&öÆÅF÷ÒBÀÐ¢"Ò‡67&öÆÂç67&öÆÅF÷²67&öÆÂæ6Æ–VçD†V–v‡BÐ¢“°Ð¢Bæg&Ö–ærÒ÷fW"âãRòv6Æ—VBr¢vf—Bs°Ð¢Bæg&Ö–ætÖ—72Ò7G&–ær„ÖF‚ç&÷VæB†÷fW"’“°Ð¢Bæg&Ö–æu¦ööÒÒ¦ööÒçFôf—†VBƒ2“°Ð¢Bæg&Ö–æt6÷VçBÒ7G&–ær†6÷VçB“°Ð¢òòD„RÔU$5’Ä”äR(	BF†RFæ÷FRw2'VÆRÂ–âF†R6ÖRv÷&G3¢Æ–æRF†B6—0Ð¢òòF†R6ÖRF†–ærWfW'’F–ÖR—2FV6÷&F–öâÂ6òF†—2öæRW†—7G2ôäÅ’v†VâÐ¢òò6†ö–6R—2öfb67&VVâ4”DUt•2ÂF†RöæRF—&V7F–öâæòvW7GW&R&V6†W2â—@Ð¢òòæÖW2F†R&V6÷fW'’F†R67&VVâ7GVÆÇ’öffW'2Ž(‰"æB(©’&RGvò'WGFöç0Ð¢òòv’Â–âF†RfÆ÷r&VÆ÷r’Â&V6W6RF†RÆ–W"w2G&–æVBç7vW"(	BG&pÐ¢òòF÷v&B—B(	BÖ÷fW2æ÷F†–æröâF†—2†—2æB&VG227GV6²67&VVâàÐ¢òòG&—fVâg&öÒF†R6ÖRçVÖ&W'22F†R6öæfW76–öâÂ6òF†RGvò6ææ÷BG&–gBàÐ¢–b†6Æ—æ÷FR’°Ð¢6öç7B„6Æ—VBÒÖF‚æÖ‚†„÷fW$ÂÂ„÷fW%"’âãS°Ð¢6Æ—æ÷FRæ†–FFVâÒ„6Æ—VC°Ð¢6Æ—æ÷FRçFW‡D6öçFVçBÒ„6Æ—VBòrpÐ¢¢F‚'Vç2öfb67&VVâFòF†RG¶„÷fW%"ãÒ„÷fW$Âòw&–v‡Br¢vÆVgBwÒ(	B¦ööÒ÷WBŽ(‰"’÷"&W72(©’Fò'&–ær—B&6²æ°Ð¢ÐÐ¢–b†÷fW"âãRbbv&æVD6Æ—VB’°Ð¢v&æVD6Æ—VBÒG'VS°Ð¢6öç6öÆRçv&â†¶ÖÒF†Rg&Ö–ærFöW2æ÷Bf—C¢G¶6÷VçGÒæöFR‡2’öb6†ö–6RæVVB Ð¢²G´ÖF‚ç&÷VæB†&÷‚çr—×‚G´ÖF‚ç&÷VæB†&÷‚æ‚—ÒÆö6Â‚ÂF†RÖf–Ww÷'B—2 Ð¢²G·67&öÆÂæ6Æ–VçEv–GF‡×‚G·67&öÆÂæ6Æ–VçD†V–v‡GÒÂæBF†R¦ööÒÆFFW"fÆö÷'2BGµ¤ôôÕôÔ”ç×‚(	B Ð¢²G´ÖF‚ç&÷VæB†÷fW"—Ò‚öbF†R6†ö–6R—2öfb67&VVââ†÷&—¦öçFÂÖ—72†2æòâFò&V6‚—B Ð¢²‡F†R6ÖW&÷vç2F†B†—3²¦ööÒ÷WB÷"(©’&V6÷fW'2—BÂæBF†R67&VVâæ÷r6—26ò“² Ð¢²fW'F–6ÂÖ—727F–ÆÂ67&öÆÇ2âF†—27B—2G¶6öÇVÖç7Ò6öÇVÖç2v–FRæ“°Ð¢ÐÐ¢&W÷'EF6—¦R‚“°Ð¢ÐÐ Ð¢òòt„BÔäôDR5ETÄÅ’DTÄ•dU%2DòD…TÔ"ÂBF†—2¦ööÒöâF†—267&VVâàÐ¢òðÐ¢òòF†R&F—W2—2æ÷r6öÇfVBg&öÒF†RFfÆö÷"&F†W"F†âG&vâæB†÷VBf÷ Ð¢òò†ÖöFVÂöÖf–Wræ§2’ÂæB—B—26öÇfVBBôäR&VfW&Væ6R(	BCB‚BF†RFVfVÇ@Ð¢òòÖ¦ööÒöâ3“ƒƒCB†öæRâ—B6ææ÷B&R&öÖ—6RBWfW'’6†RÂæBF†PÐ¢òò†öæW7BF†–ær—2æ÷B6öÖÖVçB6Æ–Ö–ær÷F†W'v—6S¢—B—2F†R67&VVâ6––æpÐ¢òòF†RçVÖ&W"v†W&RF†RÆ–W"—2ÂæB6––æräõD„”ärv†VâF†RfÆö÷"—2ÖWBàÐ¢òðÐ¢òò&÷F‚fÇVW2&R$TB&F†W"F†â&V6ö×WFVBâÒ×V’×¦ööÖæBÒ×F×F&vWF Ð¢òò&Rv†BF†R7GVÆÇ’Æ–VB†Ö–âæ§2Ç•V•66ÆRòÇ•F6—¦R’Â6ðÐ¢òò–bV—F†W"WfW"7F÷2&V–ærw&—GFVâÂF†—2Æ–æR&W÷'G2F†RG'WF‚&÷WBF†PÐ¢òò'&ö¶Vâ7FFR–ç7FVBöb&RÖFW&—fF–öâF†Bw&VW2v—F‚—G6VÆbàÐ¢gVæ7F–öâ&W÷'EF6—¦R‚’°Ð¢6öç7B72ÒvWD6ö×WFVE7G–ÆR†Fö7VÖVçBæFö7VÖVçDVÆVÖVçB“°Ð¢6öç7BV•¦ööÒÒçVÖ&W"†72ævWE&÷W'G•fÇVR‚rÒ×V’×¦ööÒr’’ÇÂ°Ð¢6öç7BF&vWBÒ'6TfÆöB†72ævWE&÷W'G•fÇVR‚rÒ×F×F&vWBr’’ÇÂDõD$tUEôDTdTÅC°Ð¢6öç7B‚ÒFVÆ—fW&VDæöFU‚„äôDUõ"Â¦ööÒÂV•¦ööÒ“°Ð¢67&öÆÂæFF6WBææöFU‚Ò‚çFôf—†VBƒ“°Ð¢67&öÆÂæFF6WBçFF&vWBÒ7G&–ær‡F&vWB“°Ð¢–b‚Fæ÷FR’&WGW&ã°Ð¢6öç7BÖVWG2Ò‚²ãRãÒF&vWC°Ð¢Fæ÷FRæ†–FFVâÒÖVWG3°Ð¢Fæ÷FRçFW‡D6öçFVçBÒÖVWG2òrpÐ¢¢ÖæöFW2&RG´ÖF‚ç&÷VæB‡‚—Ò‚†W&R(	BVæFW"–÷W"G·F&vWGÒ‚Ö–æ–×VÒF6—¦Râ¦ööÒ–â‚²’Fòw&÷rF†VÒæ°Ð¢ÐÐ Ð¢gVæ7F–öâ6WE¦ööÒ†æW‡BÂ¶VW6VçFW"ÒG'VR’°Ð¢òò†æBöâF†RÆFFW"—2â÷fW'&–FRÂæB—BõUDÄ•dU2F†RæW‡B&RÖ6VçG&R(	@Ð¢òò÷F†W'v—6RF†R6ö×WFVBg&ÖRv÷VÆBV–WFÇ’VæFòF†RÆ–W"w2÷vâ6†ö–6PÐ¢òòF†Rf—'7BF–ÖRç—F†–ær6ÆÆVB6VçFW$öä7W'&VçB‚’v–âàÐ¢g&Ö–ærÒvÖçVÂs°¢¦ööÒÒ6Æ×¦ööÒ†æW‡B“°¢Ç•¦ööÒ†¶VW6VçFW"“°¢VÖ—Ef–Wu7FFR‡G'VR“°¢ÐÐ¢òò(©’(	B%&W6WBò6VçFW""ÂæBæ÷r—BÖVç2—C¢&6²FòF†R6ö×WFVBg&ÖRg&öÐÐ¢òòv†W&WfW"F†RÆFFW"ÂF†Rv†VVÂ÷"F†R6fVB6WGF–ærÆVgBW2àÐ¢gVæ7F–öâ&W6WDg&Ö–ær‚’°¢g&Ö–ærÒvf—Bs°¢6VçFW$öä7W'&VçB‚“°¢VÖ—Ef–Wu7FFR‡G'VR“°¢Ð¢6öç7B7FW¦ööÒÒ†F—"’Óâ°Ð¢6öç7B’Ò¤ôôÕõ5DU2æf–æD–æFW‚‚‡¢’ÓâÖF‚æ'2‡¢Ò¦ööÒ’Âã“°Ð¢6öç7Bæ’ÒÖF‚æÖ–â…¤ôôÕõ5DU2æÆVæwF‚ÒÂÖF‚æÖ‚ƒÂ†’Âò¢’’²F—"’“°Ð¢6WE¦ööÒ…¤ôôÕõ5DU5¶æ•Ò“°Ð¢Ó°Ð¢çVW'•6VÆV7F÷"‚r7¦ööÒÖ–âr’æFDWfVçDÆ—7FVæW"‚v6Æ–6²rÂ‚’Óâ7FW¦ööÒƒ’“°Ð¢çVW'•6VÆV7F÷"‚r7¦ööÒÖ÷WBr’æFDWfVçDÆ—7FVæW"‚v6Æ–6²rÂ‚’Óâ7FW¦ööÒ‚Ó’“°Ð¢çVW'•6VÆV7F÷"‚r7¦ööÒ×&W6WBr’æFDWfVçDÆ—7FVæW"‚v6Æ–6²rÂ‚’Óâ&W6WDg&Ö–ær‚’“°Ð Ð¢òò7G&Âþ(É‚²v†VVÂ¦öö×2F÷v&BF†Rö–çFW"Ö—6‚6VçFW#²Æ–âv†VVÂ67&öÆÇ2àÐ¢67&öÆÂæFDWfVçDÆ—7FVæW"€Ð¢wv†VVÂrÀÐ¢†Wb’Óâ°Ð¢–b‚†Wbæ7G&Ä¶W’ÇÂWbæÖWF¶W’’’&WGW&ã°Ð¢Wbç&WfVçDFVfVÇB‚“°Ð¢7FW¦ööÒ†WbæFVÇF’Âò¢Ó“°Ð¢ÒÀÐ¢²76—fS¢fÇ6RÐÐ¢“°Ð Ð¢òòG&r×Fò×â†–âFF—F–öâFò67&öÆÆ&'2’àÐ¢ÆWBææ–ærÒfÇ6S°Ð¢ÆWB7‚Ò°Ð¢ÆWB7’Ò°Ð¢ÆWB6ÂÒ°Ð¢ÆWB7BÒ°Ð¢67&öÆÂæFDWfVçDÆ—7FVæW"‚wö–çFW&F÷vârÂ†Wb’Óâ°Ð¢òòF†RæÖ×¦ööÖ†ÆböbF†—2wV&BvVçBv—F‚F†R÷fW&Æ’„VÆFVå7—&R3#‚’àÐ¢òòF†—2Æ—7FVæW"—2öâæÖ×67&öÆÂæBF†R'WGFöç2&RæòÆöævW"–ç6–FR—BÀÐ¢òò6ò&W72öâöæR6ææ÷B&V6‚†W&RFò&RW†6ÇVFVBâÆVgB–âÂ—Bv÷VÆB&PÐ¢òòÆ–æRF†B&VG2Æ–¶R&÷FV7F–öâæB6âæWfW"'Vâ(	BæBF†RæW‡B&VFW Ð¢òòv÷VÆBF¶R—B2Wf–FVæ6RF†R'WGFöç2&R7F–ÆÂ–âF†R67&öÆÇ÷'BàÐ¢–b†WbçF&vWBæ6Æ÷6W7B‚ræÖÖæöFRç&V6†&ÆRr’’&WGW&ã°Ð¢ææ–ærÒG'VS°Ð¢7‚ÒWbæ6Æ–VçEƒ°Ð¢7’ÒWbæ6Æ–VçE“°Ð¢6ÂÒ67&öÆÂç67&öÆÄÆVgC°Ð¢7BÒ67&öÆÂç67&öÆÅF÷°Ð¢67&öÆÂæ6Æ74Æ—7BæFB‚vw&&&–ærr“°Ð¢òò3#"w2Æ–fV7–6ÆRÂ6ÖR†VÇW"2F†R6&G2‡7&2÷V’övW7GW&Ræ§2’âF†RöÆ@Ð¢òò6†RFFVBD…$TRÆ—7FVæW'2Fòv–æF÷rW"ÔõTåBæB&VÖ÷fVBæöæR(	BàÐ¢òò6ÆVçW&âöæÇ’öâö–çFW'WF†B&V6†VBv–æF÷rÂ6ò6æ6VÆÆVBàÐ¢òòÆVgBæw&&&–æv7GV6²æBF†R7FÆRÖ÷fW'27F6¶VBW"f—6—B…f—&w0Ð¢òòF&ÆR’âÆ—7FVæW'2æ÷rÆ—fRöâF†R67&öÆÆW"æBF–Rv—F‚—C²6æ6VÂVæG0Ð¢òòF†RâW†7FÇ’2&VÆV6RFöW2(	Bâ†2æ÷F†–ærFò&æFöâàÐ¢G&6´vW7GW&R†WbÂ°Ð¢öäÖ÷fS¢†×b’Óâ°Ð¢–b‚ææ–ær’&WGW&ã°Ð¢òòF†R†÷&—¦öçFÂw&—FR—2”äU%B%’4ôå5E%T5D”ôâÂ¶WBf÷"F†RF’Ð¢òòv–FRÆ–÷WBV&ç2†÷&—¦öçFÂW‡FVçB&6³¢67&öÆÅv–GF‚WVÇ0Ð¢òò6Æ–VçEv–GF‚öâWfW'’6†Ræ÷r‡6VRÇ’’Â6òF†R'&÷w6W"6Æ×0Ð¢òòF†—2FòæB6–FWv—2G&rÖ÷fW2æ÷F†–ærâF†B—2F†RFW6–vâÂæ÷@Ð¢òò&Vw&W76–öâ(	BF†R6ÖW&÷vç2‚ÂF†RF‡VÖ"÷vç2’„ÆrRÂCr’àÐ¢67&öÆÂç67&öÆÄÆVgBÒ6ÂÒ†×bæ6Æ–VçE‚Ò7‚“°Ð¢67&öÆÂç67&öÆÅF÷Ò7BÒ†×bæ6Æ–VçE’Ò7’“°Ð¢ÒÀÐ¢öäVæC¢‚’Óâ°¢ææ–ærÒfÇ6S°¢67&öÆÂæ6Æ74Æ—7Bç&VÖ÷fR‚vw&&&–ærr“°¢VÖ—Ef–Wu7FFR‡G'VR“°¢ÒÀ¢Ò“°¢Ò“° ¢òòv†VVÂ÷67&öÆÆ&"ææ–ær†2æòö–çFW"ÖVæB6ÆÆ&6²âFV&÷Væ6RF†R&VÀ¢òò67&öÆÆW"w2WfVçB6òvW7GW&R&V6öÖW2öæRGW&&ÆR'Vâw&—FRÂæ÷BöæRw&—FP¢òòW"—†VÂâ&öw&ÖÖF–26VçG&–ærÖ’Ç6òVÖ—C²F†B6–×Ç’&V6÷&G2F†P¢òòW†7Bf–WrF†RÆ–W"—2Æöö¶–ærBà¢67&öÆÂæFDWfVçDÆ—7FVæW"‚w67&öÆÂrÂ‚’Óâ°¢–b‡f–Wt6öÖÖ—EF–ÖW"’6ÆV%F–ÖV÷WB‡f–Wt6öÖÖ—EF–ÖW"“°¢f–Wt6öÖÖ—EF–ÖW"Ò6WEF–ÖV÷WB‚‚’Óâ°¢f–Wt6öÖÖ—EF–ÖW"ÒçVÆÃ°¢VÖ—Ef–Wu7FFR‡G'VR“°¢ÒÂƒ“°¢ÒÂ²76—fS¢G'VRÒ“° Ð¢òòF†RfÆW‚6öçF–æW"Ö’&W÷'B†V–v‡BVçF–ÂÆ–÷WB6WGFÆW2Â6ò6VçG&RöàÐ¢òòF†Rf—'7Bæöâ×¦W&ò6—¦Rf–&W6—¦Tö'6W'fW"Âv—F‚F–ÖV÷WB&6·7F÷àÐ¢ÆWB&òÒçVÆÃ°¢ÆWB&6·7F÷ÒçVÆÃ°¢gVæ7F–öâ&V6VçFW"†öå6WGFÆVB’°¢ÆWB6WGFÆVBÒfÇ6S°¢6öç7B6WGFÆRÒ‚’Óâ°¢–b‡6WGFÆVB’&WGW&ã°¢6WGFÆVBÒG'VS°¢–b‡&W7F÷&UVæF–ær’°¢&W7F÷&UVæF–ærÒfÇ6S°¢6—¦U7fr‚“°¢67&öÆÂç67&öÆÄÆVgBÒÖF‚æÖ–â„ÖF‚æÖ‚ƒÂ67&öÆÂç67&öÆÅv–GF‚Ò67&öÆÂæ6Æ–VçEv–GF‚’Â&W7F÷&VBç67&öÆÄÆVgB“°¢67&öÆÂç67&öÆÅF÷ÒÖF‚æÖ–â„ÖF‚æÖ‚ƒÂ67&öÆÂç67&öÆÄ†V–v‡BÒ67&öÆÂæ6Æ–VçD†V–v‡B’Â&W7F÷&VBç67&öÆÅF÷“°¢–b‡F—FÆTVÂ’F—FÆTVÂç6WDGG&–'WFR‚w‚rÂ7G&–ær†–Õ‚’“°¢6öç7Bg2Òg&Ö–ætæöFW2‚“°¢6öç7B&÷‚Òg2æÆVæwF‚òg&Ö–æt&÷‚†g2Â†V–v‡B’¢çVÆÃ°¢&W÷'B†&÷‚Âg2æÆVæwF‚“°¢6öç7B7W'&VçDæöFRÒ'VâæÖæöFT–BbbÖææöFW5·'VâæÖæöFT–EÒòÖææöFW5·'VâæÖæöFT–EÒ¢çVÆÃ°¢&W÷'DVçG&æ6R†7W'&VçDæöFRÇÂ&÷‚òçVÆÂ¢VçG&æ6Tg&ÖR†g2Â&÷‚’“°¢&W÷'EF6—¦R‚“°¢ÒVÇ6R°¢6VçFW$öä7W'&VçB‚“°¢Ð¢VÖ—Ef–Wu7FFR†fÇ6R“°¢–b†öå6WGFÆVB’öå6WGFÆVB‚“°¢Ó°¢Ç•¦ööÒ†fÇ6R“°¢–b‡67&öÆÂæ6Æ–VçD†V–v‡Bâ’6WGFÆR‚“°¢VÇ6R–b‡G—Vöb&W6—¦Tö'6W'fW"ÓÒwVæFVf–æVBr’°¢&òÒæWr&W6—¦Tö'6W'fW"‚‚’Óâ°¢–b‡67&öÆÂæ6Æ–VçD†V–v‡Bâ’²6WGFÆR‚“²&òæF—66öææV7B‚“²&òÒçVÆÃ²Ð¢Ò“°¢&òæö'6W'fR‡67&öÆÂ“°¢Ð¢òò&6·7F÷–â66RF†Rö'6W'fW"æWfW"f—&W2â6†VæB–FV×÷FVçBà¢&6·7F÷Ò6WEF–ÖV÷WB‡6WGFÆRÂ#“°¢Ð Ð¢gVæ7F–öâFV&F÷vâ‚’°Ð¢–b‡&ò’²&òæF—66öææV7B‚“²&òÒçVÆÃ²Ð¢–b†&6·7F÷’²6ÆV%F–ÖV÷WB†&6·7F÷“²&6·7F÷ÒçVÆÃ²Ð¢–b‡f–Wt6öÖÖ—EF–ÖW"’²6ÆV%F–ÖV÷WB‡f–Wt6öÖÖ—EF–ÖW"“²f–Wt6öÖÖ—EF–ÖW"ÒçVÆÃ²Ð¢Ð Ð¢&WGW&â°Ð¢67&öÆÂÂ7fs¢7ftVÂÂ6÷VçG3¢¶æ÷ræ6÷VçG2Â¶æ÷rÂ6öÇVÖç2Âv–GF‚Â†V–v‡BÀÐ¢&V6VçFW"Â&W6WDg&Ö–ærÂ7FW¦ööÒÂFV&F÷vâÀÐ¢vWB¦ööÒ‚’²&WGW&â¦ööÓ²ÒÀÐ¢Ó°Ð§ÐÐ Ð¢ò¢ Ð¢¢GF6…&6†ÖVçB††÷7BÂF‚ÂrÂ‚’(	BWBF†R7Bw2ÆFRöâF†Rw&÷VæBÆ–W"ÀÐ¢¢'WBôäÅ’öæ6RF†Rf–ÆR†27GVÆÇ’FV6öFVBàÐ¢ Ð¢¢F†RÆöB—2&ö&VBv—F‚Æ–â–ÖvVÂæ÷B'’–ç6W'F–ærF†RÆ–ÖvSææ@Ð¢¢†÷–æs¢FV6öFRf–ÇW&RF†Vâ6÷7G2æ÷F†–ærÂ&V6W6Ræ÷F†–ærv2WfW"FFVBFðÐ¢¢F†RFö7VÖVçBâf—&RÖæBÖf÷&vWB'’FW6–vâ(	BÆFRF†B'&—fW2C×2gFW"F†PÐ¢¢ÖFöW2—2&6¶w&÷VæBfF–ær–ã²ÖF†Bv—G2f÷"öæR—2ÖF†@Ð¢¢æWfW"÷Vç2v†VâF†Rf–ÆR—2'6VçBàÐ¢ Ð¢¢æòöæW'&÷&öâW'÷6S¢F†R'6VçBÆFR—2F†R4„•”är7FFRFöF’ÂæBÐ¢¢6öç6öÆRv&æ–ærW"ÖÖ÷VçBv÷VÆB&Ræö—6R&÷WBF†–ærWfW'–öæR¶æ÷w2âF†PÐ¢¢ÖöÖVçBF†Rf–ÆW2W†—7BÂÖ—76–æröæR—2CB–âF†RæWGv÷&²æVÂàÐ¢¢ðÐ¦W‡÷'BgVæ7F–öâGF6…&6†ÖVçB††÷7BÂF‚ÂrÂ‚’°Ð¢–b‚†÷7BÇÂG—Vöb–ÖvRÓÓÒwVæFVf–æVBr’&WGW&ã°Ð¢6öç7B&ö&RÒæWr–ÖvR‚“°Ð¢6öç7B÷'BÒ‚’Óâ††÷7Bæ6Æ÷6W7Bò†÷7Bæ6Æ÷6W7B‚ræÖ×67&öÆÂr’¢çVÆÂ“°Ð¢&ö&RæöæÆöBÒ‚’Óâ°Ð¢6öç7B62Ò÷'B‚“°Ð¢–b‡62’62æFF6WBæÖÆFRÒvö²s°Ð¢–b‚†÷7Bæ—46öææV7FVB’&WGW&ã²òòF†RÆ–W"ÆVgBF†RÖv†–ÆR—BÆöFV@Ð¢6öç7BVÂÒFö7VÖVçBæ7&VFTVÆVÖVçDå2‚v‡GG¢ò÷wwrçs2æ÷&ró#÷7frrÂv–ÖvRr“°Ð¢VÂç6WDGG&–'WFR‚v‡&VbrÂF‚“°Ð¢VÂç6WDGG&–'WFR‚w‚rÂsr“°Ð¢VÂç6WDGG&–'WFR‚w’rÂsr“°Ð¢VÂç6WDGG&–'WFR‚wv–GF‚rÂ7G&–ær‡r’“°Ð¢VÂç6WDGG&–'WFR‚v†V–v‡BrÂ7G&–ær†‚’“°Ð¢VÂç6WDGG&–'WFR‚w&W6W'fT7V7E&F–òrÂw„Ö–E”Ö–B6Æ–6Rr“°Ð¢†÷7BæVæD6†–ÆB†VÂ“°Ð¢Ó°Ð¢&ö&RæöæW'&÷"Ò‚’Óâ°Ð¢6öç7B62Ò÷'B‚“°Ð¢–b‡62’²62æFF6WBæÖÆFRÒvÖ—76–ærs²62æFF6WBæÖÆFUF‚ÒFƒ²ÐÐ¢6öç6öÆRæW'&÷"€Ð¢¶ÖÒ7BÆFRÖ—76–æs¢G·F‡Ò(	BF†Rför—2G&v–ær—G2Æ6V†öÆFW"v6‚–ç7FVBâ Ð¢²u'VâæöFRFööÇ2÷&6†ÖVçBæÖ§6Fò&VvVæW&FRF†RÆFW2Â÷"G&÷F†RWF†÷&VB'BBF†BW†7BF‚âpÐ¢“°Ð¢Ó°Ð¢&ö&Rç7&2ÒFƒ°Ð§ÐÐ