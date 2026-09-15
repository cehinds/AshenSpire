// src/services/cardActions.js — the only answer to "what can I do with this
// card, on this surface, right now?"
//
// WHY THIS FILE EXISTS. Until now that question had no home, and the shape of
// its absence was a default: `card.js` handed every inspect door
// `() => ({ enabled: false, reason: 'Play cards from your combat hand.' })`,
// and exactly ONE call site in the whole tree overrode it (combat.js). So the
// spoils screen, the merchant, the draft, the Smith and the compendium all
// opened a card and offered a dead button wearing combat's verb — on the
// spoils screen, the one surface where the player had come specifically to
// TAKE the card they were reading.
//
// A default is what a missing abstraction looks like from the inside. It is
// always SOME surface's answer, frozen and served to every other surface.
//
// THE LAYER, STATED SO IT IS DECLARED RATHER THAN SMUGGLED. This is a
// SERVICE in the sense docs/COMPONENT-MODEL-ARCHITECTURE.md means: pure,
// headless, DOM-free, no mutation. It sits between the domain (src/model,
// src/engine) and the presentation layers, and it answers questions — it does
// not perform. The existing contract's table has no row for it because until
// now nothing needed one; the row is added in that document by the same
// change that adds this file.
//
// WHAT IT RETURNS, AND WHAT IT DELIBERATELY DOES NOT.
//
//   IT RETURNS: which verbs a surface offers for a card, whether each is
//   available, and the sentence explaining a refusal.
//
//   IT DOES NOT RETURN CALLBACKS. This is the same rule `behaviorModel`
//   already holds every Component Model to — a record names an interaction,
//   it never carries the function. So an action here is `{ id, verb, enabled,
//   reason }` and the screen supplies `commands = { [id]: fn }` at the door.
//   That keeps this file serializable and testable with no browser, and it
//   keeps the commit where the state lives.
//
// ON REASONS. A refusal without a sentence is a dead button by another name,
// which is the defect this file exists to end. So `enabled: false` REQUIRES a
// `reason`, and the export below throws on a row that forgets one rather than
// letting a silent grey button reach a player.

/**
 * The surfaces a card can stand on. A surface is a PLACE IN THE GAME, not a
 * screen file: the merchant's shelf and its burn grid are one surface asking
 * two questions, while the Armoury asks its own even though the shop mounts it.
 *
 * `none` is the honest answer for a card you are only reading — the compendium,
 * a Smith preview, a starting-kit sample. It is a real surface with a real
 * empty answer, not a fallback, which is the whole point.
 */
export const SURFACES = Object.freeze([
  'combat', 'reward', 'draft', 'shop', 'smith', 'mount', 'armoury', 'none',
]);

/**
 * Verbs, authored once. A surface names the ids it offers; the words live
 * here so two screens cannot call the same act by two names, and so a copy
 * pass can find every one of them in a single file.
 *
 * These read as commands — what happens when you press it — because the kit's
 * own rule for a button is that its label says the act, not the category.
 */
const VERBS = Object.freeze({
  play: 'Play card',
  choose: 'Choose this card',
  take: 'Take it',
  buy: 'Buy it',
  burn: 'Burn it',
  upgrade: 'Choose for upgrade',
  seat: 'Choose this mount',
  equip: 'Equip it',
  unequip: 'Unequip it',
});

/**
 * Which verbs each surface can offer, in the order they should appear. The
 * FIRST id is the surface's primary — what a second tap on the card, and the
 * green button, both mean. Anything after it is secondary.
 *
 * A surface not listed here is a defect, not a default: `cardActions` throws
 * on an unknown surface rather than quietly returning nothing, because
 * "quietly returning combat's verb" is exactly how this went wrong before.
 */
const OFFERS = Object.freeze({
  combat: Object.freeze(['play']),
  reward: Object.freeze(['choose']),
  draft: Object.freeze(['take']),
  shop: Object.freeze(['buy', 'burn']),
  smith: Object.freeze(['upgrade']),
  mount: Object.freeze(['seat']),
  armoury: Object.freeze(['equip', 'unequip']),
  none: Object.freeze([]),
});

const freezeAction = (action) => Object.freeze({ ...action });

/**
 * cardActions(surface, subject, ctx) → frozen list of `{ id, verb, enabled, reason }`.
 *
 * `subject` is whatever the surface already holds for the card — an instance,
 * a definition, a shop row. This function never reaches into it; the surface
 * has already decided availability and passes it in `ctx.availability`, a map
 * of `{ [id]: true }` or `{ [id]: 'the sentence' }`. That is deliberate:
 * putting "can you afford it" in here would mean this file importing the
 * economy, the loadout and the combat rules, and it would then be a second
 * home for answers `src/model/` already owns.
 *
 * So the division is: THE MODEL decides whether an act is legal, THIS decides
 * which acts a surface offers at all and what they are called. A surface that
 * passes no availability for an id it offers gets that id enabled — a verb
 * with nothing standing in its way.
 */
export function cardActions(surface, subject = null, ctx = {}) {
  const offers = OFFERS[surface];
  if (!offers) {
    throw new Error(
      `cardActions: unknown surface '${surface}'. Add it to OFFERS with the verbs it offers,`
      + ` or pass 'none' for a card that is only being read.`
    );
  }
  const availability = (ctx && ctx.availability) || {};
  const only = ctx && Array.isArray(ctx.only) ? ctx.only : null;
  const rows = [];
  for (const id of offers) {
    // `only` lets one screen with two shelves — the merchant buys on one and
    // burns on the other — narrow its own surface without needing two surface
    // names for one place in the game.
    if (only && !only.includes(id)) continue;
    if (!(id in availability) && only === null && offers.length > 1) continue;
    const state = availability[id];
    if (state === undefined) { rows.push(freezeAction({ id, verb: VERBS[id], enabled: true, reason: '' })); continue; }
    if (state === true) { rows.push(freezeAction({ id, verb: VERBS[id], enabled: true, reason: '' })); continue; }
    if (state === false) {
      throw new Error(
        `cardActions: '${surface}' refused '${id}' with no reason. A refusal without a sentence`
        + ` is a dead button; pass the sentence instead of false.`
      );
    }
    rows.push(freezeAction({ id, verb: VERBS[id], enabled: false, reason: String(state) }));
  }
  return Object.freeze(rows);
}

/** The verb a surface's primary act wears, for a label outside the door. */
export function primaryVerb(surface) {
  const offers = OFFERS[surface];
  if (!offers) throw new Error(`primaryVerb: unknown surface '${surface}'`);
  return offers.length ? VERBS[offers[0]] : '';
}

/** Exported for the test and for a copy pass; never mutate the returned map. */
export function verbs() { return VERBS; }
