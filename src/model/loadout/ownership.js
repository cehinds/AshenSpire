// src/model/loadout/ownership.js — what is yours: one predicate, one home; plus the carried-id helpers.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

//
// Constantine: *"as for weapons, I should only see an inventory of the weapons
// I've collected for that character's profile. so, if I only have my starting
// weapon and a scimitar, I should only see those options."*
//
// The armoury was a CATALOGUE PRETENDING TO BE AN INVENTORY: the right-hand
// picker opened 17 chips with 16 of them locked, and the only act available on
// turn one was "Bare". The fix is not a better lock icon. It is that a thing you
// do not have is not an option.
//
// THE COLLAPSE, which is why this lives here and not in the screen. "May I have
// this?" was answered THREE TIMES, all three inside one function in a UI file,
// with three different renderings:
//
//   unlock + meta.unlocked           → a locked chip with the unlock's hint
//   unlock + reveal:'hidden'         → dropped from the list
//   drops.requireFound + meta.found  → a locked chip with a sentence hardcoded
//                                      in the screen
//
// One fact — is this piece mine — written three ways, none of them where the
// MUTATION lives. So the picker was the only thing enforcing it, and it enforced
// it by not attaching a click handler. Measured at 77a02b9, before this change:
//
//     equipPiece(R, createLoadout(R,'reaver'), 'rightHand', 0, 'greatsword')
//     → true, on a profile that has never found a greatsword.
//
// A gate only a view holds is not a gate — the same sentence already written
// above equipPiece, about the same function, for a different check. Filtering
// the chip out WITHOUT this would have made ownership LESS enforced while
// looking stricter, because absence would be the only guard left. That is the
// direction my seat is meant to fail in and it is named rather than discovered.
//
// TWO ROUTES, AND THEY ARE NOT A TEST ON `kind`. A piece is yours because you
// EARNED it (a condition — `unlock`) or because you FOUND it (a pickup —
// `drops.requireFound`). Which route applies is a fact about where the piece
// comes from: only pieces the drop table can produce can be found, and the drop
// table draws from armaments. The screen used to ask `piece.kind !== 'armor'`
// directly, which is an `if` on a content value below the content layer (Law 1
// clause 3) that happens to be correct today because every one of the 16
// armaments has `unlock: ''` and every armour row has one. A coincidence of the
// data, not a rule — so it is written here as the pool question it actually is.

/** Can this piece turn up as a drop? Only the drop pool answers to requireFound. */
export function fromDropPool(piece) {
  return !!piece && piece.kind !== 'armor';
}

// TWO QUESTIONS, ONE LADDER OF IFS — added when the Compendium arrived (#90
// sibling). `has()` answers *is this piece yours*; a screen that draws what is
// NOT yours needs a second thing — *which of the two routes withheld it* — so
// it can say why without guessing. Freja's `pieceReveal` derived that route a
// second time, off `piece.kind` and a caller-built `available` set, and the
// second derivation agreed with this one only by coincidence of today's data.
//
// So the route is returned FROM HERE, by the same `if` ladder that decides the
// boolean. `has` is `why(piece) === null` and cannot disagree with it — not
// "checked to agree", unable to differ. A third route tomorrow is one branch in
// one function, and OWNERSHIP_GATES below is what makes the screens notice it.
//
// The set is CLOSED and DECLARED, and the test asserts every member of it has a
// sentence in LOCK_COPY — the same declared-and-handled join #88 uses. A route
// with no words is the "graceful" empty tooltip my card warns about.

/** Why a piece is not yours. Closed; every member needs a sentence in LOCK_COPY. */
export const OWNERSHIP_GATES = Object.freeze(['unearned', 'unfound']);

/**
 * ownership(registries, { meta, loadout }) → { has(piece), why(piece) }
 *
 * IN A RUN, AN ARMOUR SET IS OWNED BY THE RUN, NOT BY THE PROFILE (owner,
 * 2026-11-05; SPEC §14.2/§14.3). A set with an `unlock` is owned when it is the
 * creation grant, in `loadout.boughtArmour`, or already worn in `loadout.sets`
 * (saves from before this rule keep what they wear). `meta.unlocked` does NOT
 * make it owned there: the profile wardrobe must not fill a fresh run's
 * inventory. `profileWardrobe: true` is the one explicit way to ask the
 * wardrobe question instead ("is this set unlocked on the profile?"), for the
 * Compendium, which has no run. Hand armaments and relics are unchanged.
 *
 * The one predicate. A PIECE, not an id: armour ids repeat across classes
 * ("`id` is unique per class, not globally"), so an id set would say the Reaver
 * owns the Starseer's habit.
 */
export function ownership(registries, { meta = {}, loadout = null, profileWardrobe = false } = {}) {
  const cfg = ((registries || {}).balance || {}).equipment || {};
  const drops = cfg.drops || {};
  const unlocked = new Set(meta.unlocked || []);
  // `persistence` decides what counts as found: what this run picked up, what
  // the profile has ever held, or both (the default — a climb that ends badly
  // still widens the wardrobe).
  const found = new Set([
    ...(cfg.persistence !== 'perRun' ? meta.found || [] : []),
    ...(cfg.persistence !== 'unlocked' ? carriedIds(loadout) : []),
  ]);
  const creationArmourGrant = loadout && loadout.creationArmourGrant;
  // A THIRD ROUTE, AND IT IS THE RUN'S (SPEC §14.3): an armour set bought at
  // a market is this run's own, whatever the profile has earned. Recorded on
  // the loadout beside the creation grant, as `{ classId, id }` because armour
  // ids repeat across classes.
  const boughtArmour = loadout && Array.isArray(loadout.boughtArmour) ? loadout.boughtArmour : [];
  // A missing piece resolves to 'unearned' rather than to a fourth value: there
  // is no row to read a hint from, and 'unearned' is the route whose sentence is
  // generic. 'unfound' would promise the player it turns up in treasure, which
  // is a lie about a piece that does not exist. `has(null)` stays false either
  // way, which is the behaviour every caller already had.
  // A FEW BASIC WEAPONS FOR ALL (A7). Constantine: *"everything else is profile
  // specific but maybe a few basic weapons become available for all."*
  //
  // IT ANSWERS THE FOUND GATE AND ONLY THAT, which is why it is inside the
  // `requireFound` branch rather than a fourth `if` at the top. A piece is not
  // yours for two independent reasons — earned (`unlock`) and found (the drop
  // pool) — and a tag that short-circuited BOTH would make one word able to
  // unlock content, which is not what "basic" means and not what he asked for.
  // The two gates compose; a row wearing both is refused by name at validation,
  // so this order is not a tiebreak, it is the absence of a tie.
  const basicTag = cfg.basicTag;
  const isBasic = (piece) => !!basicTag && (piece.tags || []).includes(basicTag);
  const wornIds = new Set(carriedIds(loadout));
  const why = (piece) => {
    if (!piece) return 'unearned';
    if (creationArmourGrant
      && creationArmourGrant.classId === piece.classId
      && creationArmourGrant.id === piece.id) return null;
    if (boughtArmour.some((row) => row && row.classId === piece.classId && row.id === piece.id)) return null;
    if (piece.unlock !== '' && piece.unlock != null) {
      if (piece.kind === 'armor' && !profileWardrobe) {
        return loadout && wornIds.has(piece.id) ? null : 'unearned';
      }
      return unlocked.has(piece.unlock) ? null : 'unearned';
    }
    if (fromDropPool(piece) && drops.requireFound) {
      return isBasic(piece) || found.has(piece.id) ? null : 'unfound';
    }
    return null;
  };
  return {
    why,
    has(piece) { return !!piece && why(piece) === null; },
  };
}

/**
 * addToStorage(loadout, itemId, cap) → true when it went in.
 *
 * Where a found armament lands. Storage is what you are carrying but not
 * holding. During combat, moving an item from storage into a position must route
 * through the priced `changeEquipment` engine intent.
 * A duplicate is refused rather than stacking — you either have a Katana or
 * you don't.
 */
export function addToStorage(loadout, itemId, cap = 8) {
  if (!loadout || !itemId) return false;
  loadout.storage = loadout.storage || [];
  if (loadout.storage.includes(itemId)) return false;
  if (loadout.storage.length >= cap) return false;
  loadout.storage.push(itemId);
  return true;
}

/** Every armament this run has access to: carried, plus whatever is slotted. */
export function carriedIds(loadout) {
  if (!loadout) return [];
  const out = [...(loadout.storage || [])];
  for (const ids of Object.values(loadout.sets || {})) {
    for (const id of ids) if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
