// src/model/cardFields.js — HOW MUCH A CARD SAYS, and who decides.
//
// WHY THIS FILE EXISTS. A card face rendered every region it had, always, and
// the stylesheet then cut whatever did not fit (`text-overflow: ellipsis`, the
// `-webkit-line-clamp` on `.epc-bonus`). So "how much a card says" was decided
// by AVAILABLE PIXELS rather than by intent, and the three places that wanted
// to say less each invented their own mechanism:
//
//   * kit.css hid `.card-info-button` on unfocused picker chips with a
//     hand-rolled `:not(.choice-focused)` rule — one flag, one screen, in CSS;
//   * the inspect modal reached "show everything" by rendering a SECOND
//     element beside the face (`equipmentDetails`) rather than by the face
//     itself saying more;
//   * everywhere else, the face said everything and the clip decided.
//
// Three mechanisms, no shared vocabulary, nothing authored. The owner's ask
// names the missing one out loud (Constantine, 2026-09-18): *"what shows on
// cards are controlled by flags that are configurable in the different views
// available. for instance, A card that's in my hand but not focused may only
// show the title, cost, and main effect, but when focused it may show the
// name, cost, and all the effects and then when I inspect it shows everything
// to include tags."*
//
// THREE LEVELS, AND THE VOCABULARY IS THE ONE THAT ALREADY EXISTS.
//
//   glance    not chosen. Title, cost, main effect — what you need to tell
//             this card from the one beside it.
//   focus     lit. What the card does, in full.
//   inspect   the reading door. Everything, tags included.
//
// The region KEYS are `balance.ui.equipmentCard.regions` verbatim, not a
// second list that looks like it (Law 1: one home, no second copy). A new
// region added to the face joins this vocabulary by existing; a manifest that
// names a region the face does not have is refused by the gate, because a
// silent drift there is a row the face quietly loses.
//
// LEVEL IS DERIVED, NEVER DECLARED BY A SCREEN. `src/ui/components/cardSelection.js`
// already owns which card is lit; asking it is the whole point. What a caller
// MAY set is the FLOOR — the least a surface is willing to say — and selection
// promotes from there. That is one argument, `level`, and it is deliberately
// one: it also drives how big the card is drawn, so a second level-ish
// parameter would be two homes for one fact.
//
// PURE AND HEADLESS, like every model beside it: no DOM, no callbacks, no
// live selection read. The caller asks cardSelection and hands the answer in.

import { balance } from '../content/balance.js';
import { uiConfig } from '../config/generated/ui.js';

const freeze = (value) => Object.freeze(value);

/** Least to most. The order IS the ranking: `promote` and `atLeast` read it. */
export const LEVELS = freeze(['glance', 'focus', 'inspect']);

/**
 * The region vocabulary, in the face's own visual order.
 *
 * This is `balance.ui.equipmentCard.regions` read at call time rather than a
 * copied array, so a region added to the face is in the vocabulary the moment
 * it is authored. `name` is NOT here and must not be: it is absolutely
 * positioned over the art (kit.css `.epc-frame > .epc-name`), takes no grid
 * row, and is therefore never a thing a level can withhold — the title shows
 * at every level, which is also what the owner asked for.
 */
export function regionOrder(config = balance.ui.equipmentCard) {
  return freeze(Object.keys(config.regions));
}

/** The authored manifest: content/config/ui/components/card.json, behavior.fields. */
export function fieldManifest(config = uiConfig) {
  return config.components.card.behavior.fields;
}

const rank = (level) => LEVELS.indexOf(level);

/** The higher of two levels. An unknown level is refused rather than guessed. */
export function promote(a, b) {
  const left = rank(a), right = rank(b);
  if (left < 0) throw new Error(`cardFields: unknown level '${a}' — levels are ${LEVELS.join(', ')}`);
  if (right < 0) throw new Error(`cardFields: unknown level '${b}' — levels are ${LEVELS.join(', ')}`);
  return left >= right ? a : b;
}

/**
 * resolveCardLevel({ floor, lit, inspecting }) → the level to draw at.
 *
 * `floor` is the least this surface is willing to say (a view mode's choice,
 * or `glance`). `lit` is cardSelection's answer for THIS card. `inspecting` is
 * true only inside the reading door.
 *
 * Promotion, never replacement: a picker already showing `focus` in list view
 * does not fall back to `glance` when a card is lit, and a card lit in grid
 * view rises to `focus` rather than staying at the view's floor. That is why
 * this is a max and not an if/else chain.
 */
export function resolveCardLevel({ floor = 'glance', lit = false, inspecting = false } = {}) {
  if (inspecting) return 'inspect';
  return lit ? promote(floor, 'focus') : promote(floor, floor);
}

/**
 * The level a picker's view mode SELECTS. A view does not own a field set —
 * that would be views x levels x surfaces tables to keep in step. It picks one
 * of the three levels that already exist, and the manifest stays one table.
 */
export function levelForView(view) {
  return view === 'list' ? 'focus' : 'glance';
}

/**
 * cardFields(level, { surface, manifest, config }) →
 *   { level, surface, visible: [...regionKeys], omit: [...regionKeys] }
 *
 * `visible` is in the face's own region order, so a renderer can walk it and
 * emit rows that line up with the solver's `--epc-rows`. `omit` is its
 * complement and is what `equipmentCardTokens` is handed: a region that is not
 * drawn must not hold a row either, or the pixels it was never going to use
 * stay spent and a glance card is the same card with holes in it.
 *
 * A surface patch is SPARSE — `{ add, drop }` against the base level, never a
 * full second table. An unknown surface is not an error: it simply has no
 * patch, which is the honest answer for a place nobody has had an opinion
 * about yet.
 */
export function cardFields(level, { surface = 'none', manifest = fieldManifest(), config = balance.ui.equipmentCard } = {}) {
  if (rank(level) < 0) throw new Error(`cardFields: unknown level '${level}' — levels are ${LEVELS.join(', ')}`);
  const order = regionOrder(config);
  const base = manifest.levels[level] || [];
  const patch = (manifest.surfaces && manifest.surfaces[surface] && manifest.surfaces[surface][level]) || {};
  const set = new Set(base);
  for (const key of patch.add || []) set.add(key);
  for (const key of patch.drop || []) set.delete(key);
  const visible = order.filter((key) => set.has(key));
  return freeze({
    level, surface,
    visible: freeze(visible),
    omit: freeze(order.filter((key) => !set.has(key))),
  });
}
