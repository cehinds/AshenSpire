// src/model/mapknowledge.js — HOW MUCH THE PLAYER KNOWS ABOUT A MAP NODE,
// derived, on one ladder, for every map mode.
//
// WHY THIS FILE EXISTS, and it is Viki's collapse rather than my feature.
// Constantine asked for fog of war. The obvious build is a fourth flag on the
// map screen beside the three it already had, and that build is wrong:
//
//   n.type vs shownType   an `event` node draws `?` — "there is a place here,
//                         I do not know what kind"
//   `revealed`            the Sealstone Key resolves that `?` into its real kind
//   `visited` / `current` where the player has already stood
//
// Three spellings of ONE question — *how much do you know about this node* — and
// fog is a fourth spelling of the same question, not a new subject. So the flag
// does not get built. The question gets a ladder:
//
//   hidden   you do not know the place is there. NOTHING is drawn.
//   placed   you know a place is there, not what it is. The `?` mark.
//   known    you know what it is. Its own icon.
//
// WHAT THAT BUYS, and it is the test of whether the collapse was real: the
// Sealstone Key STOPS BEING A SPECIAL CASE. It is no longer "a relic the map
// screen checks for"; it is the one operator that lifts a node from `placed` to
// `known`, and it reads identically in both map modes because it always answered
// a different question from fog. Viki measured the trap before I built it:
//
//   `revealUnknown` answers WHAT KIND OF PLACE IS THAT about a node already
//   drawn. Fog answers IS IT DRAWN AT ALL. Two axes, not one lever.
//
// So fog moves a node between `hidden` and the rest; the relic moves it between
// `placed` and `known`; and neither knows the other exists. The cost is real and
// is a BALANCE finding, not a defect: over 300 seeds the relic goes from 7.56
// actionable nodes to 1.30 under fog (Viki). Fog starves it. That number is
// handed to the checking and player-experience seats, not answered here — see
// the note on `revealUnknown` below.
//
// NOT THE COMPENDIUM'S LADDER, deliberately. The compendium has a reveal ladder
// that is rung-for-rung the same shape over a different subject (what the
// PROFILE has met, across runs, forever) and Viki's ruling is that nothing
// between them must ever agree: a shared home would tie an act's fog to a
// player's lifetime bestiary the first time either grew a rung. Same Pattern,
// two homes, on purpose. Do not merge them.
//
// PURE AND HEADLESS on purpose — no document, no settings object beyond the one
// it is handed — so `tools/mapfog.mjs --selftest` can turn it red without a
// browser, and so the map screen and that instrument cannot disagree about what
// the player was shown.

/* ------------------------------------------------------------- the ladder -- */

export const HIDDEN = 'hidden';
export const PLACED = 'placed';
export const KNOWN = 'known';

/** Low to high. Index into this IS the rung's height; nothing else orders them. */
export const RUNGS = Object.freeze([HIDDEN, PLACED, KNOWN]);

/** rungHeight('placed') → 1. Used by the corpus to assert fog only ever LOWERS. */
export function rungHeight(rung) {
  return RUNGS.indexOf(rung);
}

/* --------------------------------------------------------------- the mode -- */

/**
 * The two map modes. `fog` IS THE GAME NOW — Constantine, 2026-08-08: "ok, the
 * fog needs to be the default".
 *
 * WHAT THIS TOKEN USED TO SAY, AND WHY IT WAS WRONG IN EXACTLY ONE WAY. It said
 * `path`, and the reasoning under it was Sunna's and mine and it was sound:
 * NOBODY'S FIRST RUN IS THE EXPERIMENT, and an A/B needs a control. It is also
 * precisely how he came to open a build, see every node, and be told the fog was
 * done. A default is not a neutral position — it is the only reading most runs
 * will ever get, and we shipped the one he had asked us to replace.
 *
 * SO ONE THING MOVED AND THE REST STANDS. His word closes the DEFAULT. It does
 * not close Ruling 1: `path` stays a real, reachable value of the setting and
 * must keep working byte-for-byte, because the comparison is still the thing he
 * is judging — it is now reached by choosing it rather than by doing nothing.
 *
 * THE COMPARISON IS STILL THE DELIVERABLE. The toggle lives in Settings →
 * Display rather than in Custom Climb — Marina's ruling, on the argument that
 * Settings is the only surface reachable WHILE YOU ARE LOOKING AT THE THING YOU
 * ARE JUDGING. Custom Climb gets nothing new: fog cannot be A/B'd mid-run,
 * because once you have seen the map you cannot unsee it, so the A/B is its
 * existing seed field plus this toggle.
 */
export const MAP_MODES = Object.freeze(['path', 'fog']);
export const MAP_MODE_DEFAULT = 'fog';

/**
 * resolveMapMode(meta) → 'path' | 'fog'.
 *
 * Unset, or a value this build cannot read, is the SHIPPING DEFAULT — the same
 * rule `savedZoom` and `resolveTapSize` use one screen away, and for the same
 * reason: a hand-edited save or an older build's value must behave exactly as an
 * absent one. The settings row reads `MAP_MODES` and `MAP_MODE_DEFAULT` from
 * here, so the row and this resolver cannot disagree about what exists.
 */
export function resolveMapMode(meta) {
  const m = ((meta && meta.settings) || {}).mapMode;
  return MAP_MODES.includes(m) ? m : MAP_MODE_DEFAULT;
}

/**
 * THE SHRINE LANE — one setting, and the row reads its default from here for
 * the same reason `mapMode` does: a row and a resolver that carry the same
 * default separately are one fact written twice.
 *
 * Constantine scoped this himself — "(make this toggleable in the settings)" —
 * so the switch exists whether or not the glow is judged to need one. ON is the
 * shipping default because the glow is the thing he asked for; the row turns it
 * OFF.
 */
export const SHRINE_GLOW_DEFAULT = true;

/** resolveShrineGlow(meta) → boolean. Unset, or unreadable, is the default. */
export function resolveShrineGlow(meta) {
  const v = ((meta && meta.settings) || {}).shrinePathGlow;
  return typeof v === 'boolean' ? v : SHRINE_GLOW_DEFAULT;
}

/* --------------------------------------------------- the nearest shrine -- */

/**
 * nearestShrine({ graph, from }) → { id, path, distance } | null
 *
 * ONE COMPUTATION, TWO ASKS, and that is why it lives in this file rather than
 * in either caller. Constantine asked for two things on 2026-08-16:
 *
 *   "strines should unfog the next nearest shine node"
 *   "as new paths open, the path to the nearest shrine should have a glowing
 *    effect"
 *
 * Both are the same question — *which shrine is nearest, walking forward from
 * here, and what is the walk* — asked from two different `from`s. The unfog
 * asks it from every shrine the player has STOOD ON; the glow asks it from
 * where the player is standing NOW. Two answers, one function: a second
 * traversal would be the second copy that lets the lit shrine and the glowing
 * lane disagree about which shrine is next.
 *
 * (The third ask of that message — levelling at a shrine — shares the SUBJECT
 * and shares nothing else. It is `model/levelup.js`, and it needs no graph.)
 *
 * FORWARD ONLY. `next` is a one-way edge and the climb is one-way, so this is
 * a plain BFS with no back-edges: a shrine you have already climbed past is
 * not a shrine you can reach.
 *
 * THE SOURCE IS NEVER THE ANSWER. Standing on a shrine, the nearest shrine is
 * the NEXT one — which is what both asks mean and is why there is no
 * `includeSource` option to get wrong.
 *
 * DETERMINISTIC AT EVERY TIE, and it is a property this file's instrument
 * asserts rather than a habit. Two shrines at equal distance are settled by
 * the smaller node id, and every frontier is walked in sorted order, so the
 * answer does not depend on object key order or on which walker laid the edge
 * down first. A glow that picks a different lane on a re-mount is a glow the
 * player cannot follow.
 *
 * `from` may be one id or an array of them — the array is what the entrance
 * needs, where the player is standing on nothing and every door is a source.
 */
export function nearestShrine({ graph, from }) {
  if (!graph || !graph.nodes) return null;
  const sources = (Array.isArray(from) ? from : [from]).filter((id) => id && graph.nodes[id]);
  if (!sources.length) return null;
  const prev = new Map();
  const seen = new Set(sources);
  let frontier = [...seen].sort();
  let distance = 0;
  while (frontier.length) {
    distance++;
    const step = [];
    for (const id of frontier) {
      for (const to of graph.nodes[id].next || []) {
        if (!graph.nodes[to] || seen.has(to)) continue;
        seen.add(to);
        prev.set(to, id);
        step.push(to);
      }
    }
    step.sort();
    const hit = step.find((id) => graph.nodes[id].type === 'shrine');
    if (hit) {
      const path = [hit];
      let at = hit;
      while (prev.has(at)) { at = prev.get(at); path.unshift(at); }
      return { id: hit, path, distance };
    }
    frontier = step;
  }
  return null;
}

/**
 * shrineLane({ graph, run }) → the ids of the walk to the nearest shrine,
 * source first, shrine last. `[]` when no shrine is reachable ahead.
 *
 * "AS NEW PATHS OPEN" IS WHY NOTHING IS STORED. The lane is recomputed from
 * where the player is standing every time the board mounts, so stepping to a
 * new node re-aims it — which is the whole of his "as new paths open" with no
 * event, no cache and nothing to invalidate.
 *
 * THE LANE IS NOT THE LIGHT. This returns the whole walk, including nodes the
 * fog is covering; the board draws the glow only where the node is already
 * drawn, exactly as it already draws an edge only when both its ends are. A
 * lane that painted through the fog would be a fog leak wearing a highlight,
 * and it is the one thing this feature could break that the player could never
 * un-see. `tools/mapfog.mjs --selftest` asserts the containment.
 */
export function shrineLane({ graph, run }) {
  if (!graph || !graph.nodes) return [];
  const from = (run && run.mapNodeId) ? run.mapNodeId : (graph.startIds || []);
  const found = nearestShrine({ graph, from });
  return found ? found.path : [];
}

/* ------------------------------------------------------- the type reading -- */

/**
 * nodeReading(node, { reveal }) → { shownType, revealed, knowsType }
 *
 * The `placed → known` axis ALONE. Byte-for-byte the rule the map screen carried
 * inline before this file existed, including its quiet corner: with the Sealstone
 * Key, an `event` node whose pre-roll resolved to an actual EVENT still reads `?`,
 * because "it is an event" is what `?` already said. Only a resolution into a
 * fight, a shrine or a treasure is new knowledge.
 *
 * `revealed` is the dashed ring — "you are seeing this because of a relic" — and
 * is presentation, kept here so the screen never re-derives it.
 */
export function nodeReading(node, { reveal = false } = {}) {
  if (!node) return { shownType: 'event', revealed: false, knowsType: false };
  if (node.type !== 'event') return { shownType: node.type, revealed: false, knowsType: true };
  if (reveal && node.resolved && node.resolved.kind !== 'event') {
    return { shownType: node.resolved.kind, revealed: true, knowsType: true };
  }
  return { shownType: 'event', revealed: false, knowsType: false };
}

/* ------------------------------------------------------------- the light -- */

/**
 * OUR DEFAULT, WEARING OUR OWN NAME — the fork question is OPEN: a fork stays
 * lit once you are past it. The wide reading of "previously visited locations
 * remain revealed": everything that has EVER been lit stays lit, so the known
 * ground widens into a cone behind the frontier, the way Elden Ring's
 * undiscovered map behaves.
 *
 * THIS HEADING USED TO SAY "HE PICKED — Constantine, 2026-08-08", AND THAT WAS
 * FALSE. Asked straight on 2026-08-13 he answered "idk about hte forks part" —
 * an honest idk, not an answer, of record in commons/decisions/directions.md
 * D19 (claude-family). The attribution is stripped on his own word: what ships
 * below is the family's default, not his ruling, and the question returns to
 * him later as two pictures — the door that has answered better than any
 * sentence.
 *
 * WHAT USED TO BE HERE was `FOG_KEEP_FORKS`, one boolean holding both readings
 * of his sentence with both answers photographed, and a `mapFogForks` shot flag
 * to reach the other one. Both were deleted under the false record above. The
 * DELETION stands anyway: a shipped game carries one default, and resurrecting
 * the toggle would be the third state the original deletion refused — an
 * option nobody chose, kept warm. This paragraph is the receipt.
 *
 * THE UNSHIPPED READING IS NOT LOST, IT IS DEMOTED. It lives on in
 * `tools/mapfog.mjs` as a MUTANT — "the trail, but the roads not taken re-fog" —
 * where it used to be a legal cell of the sweep. That is the right home for a
 * reading we deliberately do not ship: something the instrument must catch, not
 * something the game can be talked into. If he ever picks it, that is a design
 * change with a row in this file's history, not a revert.
 *
 * WHAT MAKES THE PROMISE BELOW TRUE, and it is structure rather than a value:
 * `run.path` only grows, and `litNodes` shines every node in it, so the lit set
 * is monotone BY CONSTRUCTION. `--selftest` asserts that unconditionally now
 * (it used to assert it only on the `+forks` half of the corpus), so the
 * sentence has a check that can go red rather than a boolean it agrees with.
 */

/**
 * FOG_TRAIL_CLAUSE — the ONE sentence the Map-reveal row may promise about what
 * stays lit, homed beside the function whose behaviour it describes.
 *
 * THE ROW WAS LYING, IN PROSE, ON THE SHIPPED BUILD. It read "Fog never closes
 * behind you — somewhere you have seen stays seen": the wide reading, typed by
 * hand into a settings string, beside code running the narrow one. Bjorn
 * measured that promise FALSE on 144 of 156 screens. A sentence and a rule that
 * disagree is the second copy this house exists to catch, and it survived
 * because prose is not compiled and nothing could fail on it.
 *
 * The wide default makes the sentence TRUE — the derivation is what keeps it
 * true, not what makes it true (Sunna's ruling, 2026-08-08 — hers, about the
 * mechanism; the default itself is ours, question open, see the D19 note
 * above). It is one home, one reader,
 * and the monotone property in `--selftest` is the thing that can falsify it.
 * It matters tonight rather than eventually: fog is the DEFAULT now, so this is
 * the first thing a new player reads about the mode they are already in.
 */
export const FOG_TRAIL_CLAUSE = 'Fog never closes behind you — anywhere you have seen stays seen.';

/**
 * litNodes({ graph, run }) → Set of ids the fog is not covering.
 *
 * THE TRAIL IS STICKY, AND THAT IS THE FIXED PART OF THIS FUNCTION.
 *
 *   "flashlight is nice but previously visited locations remain revealed"
 *
 * The "but" is the instruction: a pure flashlight — dark the moment you step
 * past — is the thing being corrected. So a node the player has STOOD ON never
 * goes dark again, and neither does anything that node ever lit: `run.path` only
 * grows and every element of it is shone, so this function is monotone by
 * CONSTRUCTION rather than by promise. That is what makes `FOG_TRAIL_CLAUSE`
 * true above, and `--selftest` asserts it over the whole corpus.
 *
 * FOUR SOURCES, each one clause of the ask:
 *
 *   the trail        every node in `run.path`. Where you have been.
 *   the split        `next` of the node you are standing on. "the path splits and
 *                    the player only sees those next options." Exactly one step —
 *                    no penumbra, which is the ask read literally. A penumbra is
 *                    a second argument to this function and nothing else; the
 *                    ladder already holds the rung for it (`placed`).
 *                    And the splits of every EARLIER path node too — the wide
 *                    default (ours, not his ruling; D19 note above), so the
 *                    known ground widens into a cone behind the frontier
 *                    instead of closing at the forks.
 *   the doors        every entrance, for the whole act. Before the first move
 *                    they ARE the split.
 *   the end          the boss. "when the act starts it show the start node and
 *                    the end node." The shrine below it is not a landmark and
 *                    stays fogged until it is reached — the boss is what the
 *                    climb is aimed at; the shrine is a stop on the way.
 *   the next shrine  "strines should unfog the next nearest shine node"
 *                    (Constantine, 2026-08-16). For every shrine the player has
 *                    STOOD ON, the nearest shrine ahead of it (nearestShrine
 *                    above). The NODE, not the walk to it — his sentence names
 *                    a node, and lighting the walk would hand over the shape of
 *                    an act nobody has climbed.
 *
 * ARRIVAL, NOT THE REST BUTTON, and the difference is named rather than
 * discovered. This fires when the player REACHES a shrine, because reaching one
 * is what `run.path` records; "did they press Rest" is not in the run at all,
 * and adding a `run.rested` to carry it would be the second copy of the trail
 * that the paragraph below refuses. A player who walks into a shrine and smiths
 * instead of resting has still seen the shrine, and the light says so.
 *
 * NOTHING IS STORED, and the stickiness is why that is worth saying twice. A
 * cumulative reveal is the obvious candidate for a `run.seen` array, and a
 * `run.seen` would be a SECOND COPY OF THE TRAIL — the day it disagreed with
 * `run.path` the map would lie about where the player had been, and it would
 * need a migration for every save written before it existed. Instead the whole
 * history is replayed from `run.path`, which already persists: fog survives a
 * save/load with no new field, no migration, and nothing to drift.
 */
export function litNodes({ graph, run }) {
  const lit = new Set();
  if (!graph || !graph.nodes) return lit;
  const add = (id) => { if (id && graph.nodes[id]) lit.add(id); };
  // A node, and one step past it — the light as it stood when the player was there.
  const shine = (id) => {
    const n = graph.nodes[id];
    if (!n) return;
    lit.add(id);
    for (const to of n.next || []) add(to);
  };

  // A shrine the player has stood on lights the next shrine ahead of it. The
  // set of shrines stood on can only grow (`run.path` only grows), so this
  // source is monotone by the same construction as the trail itself — which is
  // what keeps FOG_TRAIL_CLAUSE true with a fifth source in the light.
  const shrineAhead = (id) => {
    const n = graph.nodes[id];
    if (!n || n.type !== 'shrine') return;
    const found = nearestShrine({ graph, from: id });
    if (found) add(found.id);
  };

  for (const id of (graph.startIds || [])) add(id);
  add(graph.bossId);
  const path = (run && run.path) || [];
  for (const id of path) { shine(id); shrineAhead(id); }
  // Belt and braces: in play `mapNodeId` is always the last element of `path`
  // (`enterNode` pushes it), but `?shotAt` poses a node without a history and a
  // hand-edited save could too. Standing somewhere always lights it AND its split.
  if (run && run.mapNodeId) { shine(run.mapNodeId); shrineAhead(run.mapNodeId); }
  return lit;
}

/* -------------------------------------------------------------- the join -- */

/**
 * mapKnowledge({ graph, run, mode, reveal }) → {
 *   mode, rung: Map(id → rung), drawn: Set(ids), counts: { hidden, placed, known }
 * }
 *
 * The ONE derivation the map screen, the framing camera and the instrument all
 * read. Two callers deriving "is this drawn" separately is how a camera comes to
 * frame a node nobody painted.
 *
 * In `path` mode NOTHING is hidden, and that is not a special case in the code —
 * the light is simply every node. So the shipped screen is this ladder with its
 * bottom rung empty, which is the proof the collapse was real rather than a
 * branch wearing a ladder's name (Bjorn's criterion, from the legend).
 */
export function mapKnowledge({ graph, run, mode = MAP_MODE_DEFAULT, reveal = false }) {
  const rung = new Map();
  const drawn = new Set();
  const counts = { hidden: 0, placed: 0, known: 0 };
  if (!graph || !graph.nodes) return { mode, rung, drawn, counts };

  const fog = mode === 'fog';
  const lit = fog ? litNodes({ graph, run }) : null;

  for (const node of Object.values(graph.nodes)) {
    let r;
    if (fog && !lit.has(node.id)) {
      r = HIDDEN;
    } else {
      r = nodeReading(node, { reveal }).knowsType ? KNOWN : PLACED;
    }
    rung.set(node.id, r);
    counts[r]++;
    if (r !== HIDDEN) drawn.add(node.id);
  }
  return { mode, rung, drawn, counts };
}
