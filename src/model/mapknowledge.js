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
 * The two map modes, and `path` is the default — the game exactly as it shipped.
 *
 * THE COMPARISON IS THE DELIVERABLE, NOT THE ANSWER. Constantine asked for "a
 * debug mode to toggle between the current path mode and the suggested adventurer
 * fog of war node approach so I can try each and decide", and the toggle lives in
 * Settings → Display rather than in Custom Climb — Marina's ruling, reversed from
 * Custom Climb on the argument that Settings is the only surface reachable WHILE
 * YOU ARE LOOKING AT THE THING YOU ARE JUDGING. Custom Climb gets nothing new:
 * fog cannot be A/B'd mid-run, because once you have seen the map you cannot
 * unsee it, so the A/B is its existing seed field plus this toggle.
 */
export const MAP_MODES = Object.freeze(['path', 'fog']);
export const MAP_MODE_DEFAULT = 'path';

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
 * TWO READINGS OF ONE SENTENCE, AND CONSTANTINE PICKS — not me, and not by
 * argument. This is the only thing about the fog that is genuinely undecided,
 * so it is one boolean with both answers photographed rather than a choice made
 * quietly in a function.
 *
 *   `false` — HIS WORDS, ASKED FOR BY NAME: "only next node and all previous
 *             nodes." The trail behind you, the split in front of you, the doors
 *             and the boss. A fork you stood at three floors ago closes again
 *             once you are past it, because its siblings were never *previous
 *             nodes* — you looked at them and did not go.
 *   `true`  — the wider reading of "previously visited locations remain
 *             revealed": everything that has EVER been lit stays lit, so the
 *             known ground widens into a cone behind the frontier. Elden Ring's
 *             undiscovered map behaves this way.
 *
 * BOTH KEEP THE TRAIL. Neither ever re-fogs a node the player stood on; they
 * differ only about the roads not taken. `tools/mapfog.mjs --selftest` asserts
 * the trail clause against both and the wider clause only against `true`, which
 * is the honest shape — asserting one-wayness over everything would have been an
 * instrument enforcing my reading of his sentence.
 *
 * NOT ON THE SETTINGS DIAL, deliberately: he asked for one A/B (path vs fog) and
 * a second dial would make the first one harder to judge. It is reachable for
 * the camera as `?shotSettings={"mapMode":"fog","mapFogForks":true}`, and the
 * day he picks one this constant and the flag both DIE — the loser is deleted,
 * not left as an option nobody chose.
 */
export const FOG_KEEP_FORKS = false;

/**
 * litNodes({ graph, run, keepForks }) → Set of ids the fog is not covering.
 *
 * THE TRAIL IS STICKY, AND THAT IS THE FIXED PART OF THIS FUNCTION.
 *
 *   "flashlight is nice but previously visited locations remain revealed"
 *
 * The "but" is the instruction: a pure flashlight — dark the moment you step
 * past — is the thing being corrected. So a node the player has STOOD ON never
 * goes dark again, under either reading of `keepForks`, and this function is
 * monotone over `run.path` by construction rather than by promise.
 *
 * FOUR SOURCES, each one clause of the ask:
 *
 *   the trail        every node in `run.path`. Where you have been.
 *   the split        `next` of the node you are standing on. "the path splits and
 *                    the player only sees those next options." Exactly one step —
 *                    no penumbra, which is the ask read literally. A penumbra is
 *                    a second argument to this function and nothing else; the
 *                    ladder already holds the rung for it (`placed`).
 *                    With `keepForks`, the splits of every EARLIER path node too.
 *   the doors        every entrance, for the whole act. Before the first move
 *                    they ARE the split.
 *   the end          the boss. "when the act starts it show the start node and
 *                    the end node." The shrine below it is not a landmark and
 *                    stays fogged until it is reached — the boss is what the
 *                    climb is aimed at; the shrine is a stop on the way.
 *
 * NOTHING IS STORED, and the stickiness is why that is worth saying twice. A
 * cumulative reveal is the obvious candidate for a `run.seen` array, and a
 * `run.seen` would be a SECOND COPY OF THE TRAIL — the day it disagreed with
 * `run.path` the map would lie about where the player had been, and it would
 * need a migration for every save written before it existed. Instead the whole
 * history is replayed from `run.path`, which already persists: fog survives a
 * save/load with no new field, no migration, and nothing to drift.
 */
export function litNodes({ graph, run, keepForks = FOG_KEEP_FORKS }) {
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

  for (const id of (graph.startIds || [])) add(id);
  add(graph.bossId);
  const path = (run && run.path) || [];
  for (const id of path) { if (keepForks) shine(id); else add(id); }
  // Belt and braces: in play `mapNodeId` is always the last element of `path`
  // (`enterNode` pushes it), but `?shotAt` poses a node without a history and a
  // hand-edited save could too. Standing somewhere always lights it AND its split.
  if (run && run.mapNodeId) shine(run.mapNodeId);
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
export function mapKnowledge({ graph, run, mode = MAP_MODE_DEFAULT, reveal = false, keepForks = FOG_KEEP_FORKS }) {
  const rung = new Map();
  const drawn = new Set();
  const counts = { hidden: 0, placed: 0, known: 0 };
  if (!graph || !graph.nodes) return { mode, rung, drawn, counts };

  const fog = mode === 'fog';
  const lit = fog ? litNodes({ graph, run, keepForks }) : null;

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
