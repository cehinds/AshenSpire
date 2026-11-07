import { gameContent } from './gameProfile.js';
import {
  slotHand, fitsSlot, HANDS, EQUIPMENT_ROLES, ARMAMENT_INTRINSIC_STAT_FIELDS,
  armamentIntrinsicStatProblems, pieceHand,
} from './loadout/hands.js';
import {
  equipmentRequirementReceipt, startingHandsRequirementFailure, previewCompatibleHands,
  cardEquipmentCompatibility,
} from './loadout/requirements.js';
import {
  ownership, fromDropPool, OWNERSHIP_GATES, addToStorage, carriedIds,
} from './loadout/ownership.js';
import {
  openedSets, SLOT_RUNG_KIND, slotRungs, visibleSets, rungFor, setCellState,
} from './loadout/slotLadder.js';
import { buildEquippedWeaponCardPlan, WeaponDeckCompositionService } from './loadout/weaponPlan.js';
import { gripRefusal, GRIP_MODES, gripOf, GRIP_TAGS, gripTags } from './loadout/grip.js';
import { parseMod, modEffectLines, modEffectLine } from './loadout/modStrings.js';
import {
  CARD_MOD_APPLIES, EQUIPMENT_POOL_FIELDS, RUN_MOD_APPLIES, moveEquipmentPool,
} from './loadout/applyVocab.js';
import {
  createLoadout, createEquipmentProfileRuleSnapshot, restoreEquipmentProfileRuleSnapshot,
} from './loadout/shape.js';
import { equippedIn, equippedPieces, figureSpec, loadoutTags } from './loadout/equipped.js';
import { equipmentRoleSource, equipmentKitPlan, equipmentKitReceipt } from './loadout/kit.js';
import {
  isEquipmentComposedInstance, WeaponCardPackageModel, applyEquippedWeaponCardPlan,
} from './loadout/weaponPackages.js';
import {
  BOUND_GRANT_TAG, boundGrantProblems, boundGrantCardIds, sortBySourceOrder,
} from './loadout/grantSources.js';
import {
  ITEM_OWNED_ROLES, isItemOwned, pieceItemRef, reconcileGrantedCards, isCurrentEquipmentGrant,
  itemMountInstances, reconcileGrantedCardsInCombat, ownerItemRef,
} from './loadout/grants.js';
import { startingDeckPlan } from './loadout/deckPlan.js';
import {
  startingDeckProblems, startingDeckWarnings, startingDeckRefs, orderStartingDeck,
} from './loadout/startingDeck.js';
import { cardMods, runMods, reconcileRunLoadoutHp } from './loadout/cardMods.js';
import { applyCardMods } from './loadout/applyCardMods.js';
import { stampDeck } from './loadout/stampDeck.js';
import {
  SWAP_COST_BASES, swapCostRules, resolveSwapCostRule, swapCostFor,
} from './loadout/swapCost.js';
import { validateEquipment } from './loadout/validate.js';

// src/model/loadout.js — what you carry, and what it does to your cards.
// (Being split into src/model/loadout/*.js; the remainder is below.)


/**
 * healMissingSlotCells(registries, loadout) → the ids of the slots whose cells
 * were absent and are now present, empty. A save written before a slot row
 * existed (phase 3b added head, hands and feet) carries no cells for it, so
 * the Armoury drew no position and equipPiece refused the slot; this gives it
 * what createLoadout gives a fresh run, and nothing else. The load door
 * calls it (save.js loadRun, which notes it on the ledger).
 */
export function healMissingSlotCells(registries, loadout) {
  if (!loadout || typeof loadout !== 'object') return [];
  loadout.sets = loadout.sets || {};
  loadout.active = loadout.active || {};
  const added = [];
  for (const slot of (((registries || {}).equipment || {}).slots || [])) {
    if (Array.isArray(loadout.sets[slot.id])) continue;
    loadout.sets[slot.id] = new Array(Math.max(1, slot.sets || 1)).fill(null);
    loadout.active[slot.id] = 0;
    added.push(slot.id);
  }
  return added;
}

/**
 * trimExtraSets(registries, loadout) → [{ slotId, setIndex, id }] for every
 * armament that sat in a set the slot no longer has. A hand carried three sets
 * until 2026-11-01 and carries one now (equipSlots.csv `sets`), so an older
 * save can hold a weapon in MH2/MH3 or OH2/OH3 and an `active` index past the
 * last set. Each such piece moves to `loadout.storage` (never deleted, and never
 * duplicated if storage already lists it), the array is cut to the slot's
 * `sets`, and `active` is reset to set 1 if it pointed past the cut. Works on any slot whose
 * cap shrinks, not only the hands. The load door calls it and notes the result.
 */
export function trimExtraSets(registries, loadout) {
  if (!loadout || typeof loadout !== 'object' || !loadout.sets) return [];
  loadout.active = loadout.active || {};
  loadout.storage = Array.isArray(loadout.storage) ? loadout.storage : [];
  const moved = [];
  for (const slot of (((registries || {}).equipment || {}).slots || [])) {
    const ids = loadout.sets[slot.id];
    if (!Array.isArray(ids)) continue;
    const cap = Math.max(1, Number(slot.sets) || 1);
    if (ids.length > cap) {
      for (let setIndex = cap; setIndex < ids.length; setIndex += 1) {
        const id = ids[setIndex];
        if (!id) continue;
        moved.push({ slotId: slot.id, setIndex, id });
        if (!loadout.storage.includes(id) && !ids.slice(0, cap).includes(id)) loadout.storage.push(id);
      }
      loadout.sets[slot.id] = ids.slice(0, cap);
      // Only a slot that really lost cells has its active set reset: an
      // out-of-range index on a slot of the right size is a corrupt save, and
      // the load door's shape check still refuses it by name.
      if (loadout.active[slot.id] !== 0) {
        if (Number.isInteger(loadout.active[slot.id]) && loadout.active[slot.id] >= cap) moved.push({ slotId: slot.id, setIndex: loadout.active[slot.id], id: null });
        if (!Number.isInteger(loadout.active[slot.id]) || loadout.active[slot.id] >= cap) loadout.active[slot.id] = 0;
      }
    }
  }
  return moved;
}

/**
 * deckMinimum(registries, run) → the fewest cards a run may leave the Armoury
 * with (plan phase 3b, proposal §5). balance.deck is the one home of the
 * numbers; character level (phase 6) is read as 0 until it exists.
 */
export function deckMinimum(registries, run) {
  const cfg = (((registries || {}).balance || {}).deck) || {};
  // The character level is the ledger's (plan phase 6, `run.level.level`;
  // a fresh run is level 1); `characterLevel` is the field the floor read
  // before the ledger existed, kept for a caller that still names it.
  const ledger = run && run.level && Number.isInteger(run.level.level) && run.level.level > 0 ? run.level.level : null;
  const level = ledger !== null ? ledger
    : (run && Number.isInteger(run.characterLevel) && run.characterLevel > 0 ? run.characterLevel : 0);
  const step = Number.isInteger(cfg.minimumStepLevels) && cfg.minimumStepLevels > 0 ? cfg.minimumStepLevels : 1;
  const base = Number.isInteger(cfg.minimum) ? cfg.minimum : 0;
  const perStep = Number.isInteger(cfg.minimumPerStep) ? cfg.minimumPerStep : 0;
  return base + Math.floor(level / step) * perStep;
}

/**
 * loadoutLeaveRefusal(registries, run, { enteredWith }) → '' when the player
 * may leave the Armoury, else the sentence that says why not.
 *
 * THE FLOOR GATES THE DOOR, NOT THE ACT: unequipping is always allowed (the
 * player may be mid-swap), and what is refused is LEAVING with the deck under
 * `deckMinimum`. `enteredWith` is the deck size when the screen opened: a run
 * that was already under the floor when it arrived (a shop removal took it
 * there; nothing in this screen did) may leave, because a door that traps a
 * player over a state it did not create is a defect, not a rule.
 */
export function loadoutLeaveRefusal(registries, run, { enteredWith } = {}) {
  const held = Array.isArray(run && run.deck) ? run.deck.length : 0;
  const floor = deckMinimum(registries, run);
  if (held >= floor) return '';
  if (Number.isInteger(enteredWith) && enteredWith < floor) return '';
  const short = floor - held;
  return `Your deck holds ${held} card${held === 1 ? '' : 's'} and the floor is ${floor}. Equip something that carries ${short} more, or put back what you took off, before you leave.`;
}

/** A short string that changes whenever the worn set does — for cache keys. */
export function loadoutSignature(loadout) {
  if (!loadout) return '';
  return Object.keys(loadout.sets || {})
    .sort()
    .map((k) => `${k}:${(loadout.sets[k] || [])[(loadout.active || {})[k] || 0] || '-'}`)
    .join('|');
}

function equipmentChangedPayload(reason, before, after) {
  const changedPositions = [];
  const slotIds = new Set([...Object.keys((before || {}).sets || {}), ...Object.keys((after || {}).sets || {})]);
  for (const slotId of [...slotIds].sort()) {
    const beforeIds = ((before || {}).sets || {})[slotId] || [];
    const afterIds = ((after || {}).sets || {})[slotId] || [];
    const count = Math.max(beforeIds.length, afterIds.length);
    for (let setIndex = 0; setIndex < count; setIndex++) {
      const beforeItemId = beforeIds[setIndex] || null;
      const afterItemId = afterIds[setIndex] || null;
      const beforeActive = (((before || {}).active || {})[slotId] || 0) === setIndex;
      const afterActive = (((after || {}).active || {})[slotId] || 0) === setIndex;
      if (beforeItemId !== afterItemId || beforeActive !== afterActive) {
        changedPositions.push({ slotId, setIndex, beforeItemId, afterItemId, beforeActive, afterActive });
      }
    }
  }
  return {
    reason,
    beforeLoadoutSignature: loadoutSignature(before),
    afterLoadoutSignature: loadoutSignature(after),
    changedPositions,
  };
}

function emitEquipmentChanged(ctx, reason, before, after) {
  if (ctx && typeof ctx.onEquipmentChanged === 'function') {
    ctx.onEquipmentChanged(equipmentChangedPayload(reason, before, after));
  }
}


/**
 * canSwap(registries, slotId, { inCombat }) → { ok, word, reason }.
 * The rule lives in equipSlots.csv (`swap`): hands may be changed mid-fight at
 * a price, armour and talismans may not.
 *
 * `word` IS THE BADGE, AND IT LIVES HERE BECAUSE THE COLLISION DID (#98, Bjorn).
 * The screen used to type the literal 'sealed' into the slot header while this
 * function supplied only the tooltip — so the one word a player actually reads
 * had no home, and nothing could compare it to anything. It collided: the
 * ARMOUR header said "sealed" (this function, about the ACTIVE SET) while two
 * rows below the picker said "Right Hand is sealed in combat" (canEquip, about
 * a set's CONTENTS), on a Right Hand carrying no badge at all. Both sentences
 * were true. **One word carrying two facts, with the copies visibly
 * disagreeing** — his framing, and it is worse than a second copy, because a
 * second copy at least says the same thing twice.
 *
 * So the badge word sits beside the reason it belongs to, and test 31d asserts
 * canEquip's sentence contains neither this word nor any slot label. A future
 * edit that reintroduces the collision goes red, which is the point: the
 * brittleness IS the check. The wording is Sunna's whenever she wants it —
 * both strings are one line each and neither is derived from the other.
 */
export function canSwap(registries, slotId, { inCombat = false } = {}) {
  const slot = ((registries.equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, word: 'unknown', reason: `No slot '${slotId}'` };
  // THE WORDING IS MINE (Sunna, #98). Two changes, and the second is the reason
  // for the first.
  //
  // `sealed` → `fastened`. Not a synonym swap. "Sealed" is an ABSOLUTE word over
  // a PARTIAL rule — it says *shut*, while the fact it carries is only that THIS
  // slot cannot change its active set, and two slots beside it can. A total word
  // over a partial fact is how it collided with the screen-wide seal in the first
  // place, and re-keying the string without changing its register would leave the
  // reader in the same place Bjorn found them. "Fastened" is a STATE, not a
  // verdict: it says the armour is done up, which is why it cannot come off, and
  // it cannot be read as the re-arm rule below.
  //
  // AND IT HAS TO STAND ALONE, which is the part I could not fix here. This badge
  // carries its reason in a `title=`, and Law 3 clause 4 is explicit that a native
  // title alone does not satisfy — a touch or pad player never sees it. Measured
  // at 390x844: the badge renders 23.6-33.1 px wide with NO reachable explanation
  // at any text size. So the word is the whole message on the shape Constantine
  // just made the priority, and I picked one that survives being alone. The
  // reason wants to be on the glass; that is markup, not a string, and it is
  // filed rather than smuggled in here.
  if (inCombat && slot.swap !== 'combat') {
    return { ok: false, word: 'fastened', reason: `${slot.label} stays fastened until the fight ends.` };
  }
  return { ok: true, word: '', reason: '' };
}

/**
 * canEquip(registries, slotId, { inCombat }) → { ok, reason }.
 *
 * MAY WHAT IS IN THIS SET CHANGE RIGHT NOW — the sibling question to canSwap.
 * `canSwap` asks whether the ACTIVE set may change; this asks whether a set's
 * CONTENTS may. The combat answer is data-owned by allowChangesInCombat so the
 * Armoury, mutation, and engine all read one rule.
 *
 * This is intentionally one combat-wide balance switch rather than another
 * per-slot column. Which prepared set may become active remains a property of
 * the slot (`canSwap`); whether carried gear may replace, move, or leave a
 * position is one fight rule for every position (`allowChangesInCombat`).
 *
 * The context is required and must contain a boolean. Silence never means
 * permission: malformed callers fail closed even when the shipped rule is on.
 */
/** One shared refusal sentence for model, engine, and Armoury. */
export const COMBAT_EQUIPMENT_CHANGE_DISABLED = 'Equipment changes are disabled during combat.';

export function canEquip(registries, slotId, ctx) {
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: `No slot '${slotId}'` };
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `canEquip('${slotId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. This line is the defect, not the refusal.`
    );
    return { ok: false, reason: COMBAT_EQUIPMENT_CHANGE_DISABLED };
  }
  const cfg = (((registries || {}).balance || {}).equipment || {});
  if (ctx.inCombat && cfg.allowChangesInCombat !== true) {
    return { ok: false, reason: COMBAT_EQUIPMENT_CHANGE_DISABLED };
  }
  // THE GRIP THE HANDS WOULD BE LEFT IN (plan phase 3c). Asked only when the
  // caller says what it is about to put where — equipPiece does; a bare
  // "may this slot change at all" question keeps its old answer.
  if (ctx.loadout && ctx.itemId !== undefined) {
    const refusal = gripRefusal(registries, ctx.loadout, ctx.classId || null, slotId, ctx.setIndex, ctx.itemId);
    if (refusal) return { ok: false, reason: refusal };
  }
  // THE ATTRIBUTE GATE (plan phase 9), BESIDE THE GRIP'S. equipPiece has
  // enforced these minima on the mutation for as long as they have existed;
  // what this adds is the ANSWER, early and in words, to a caller that asks
  // "may this go here" before acting — the equipment screen's seal, which
  // could previously only find out by trying. Asked when the caller names
  // both the candidate and the attributes to judge it by; a bare "may this
  // slot change" question keeps its old answer, and the mutation's own check
  // remains the gate of record.
  if (ctx.itemId && ctx.attributes) {
    // BOTH HALVES OF THE WARDROBE. equipmentRequirements.csv carries armour
    // rows (the plate asks Strength, the vestments Wisdom) as well as
    // armaments, and a gate that searched only the weapons would have left
    // every armour minimum unenforced while reading as though it enforced
    // them — worse than no gate, because the table says otherwise.
    // ARMOUR IDS REPEAT PER CLASS (outfits.csv carries four `wayfarerPlate`
    // rows), so the armour half is resolved against the run's own class when
    // the caller names one; without a class the first row still answers, as
    // equipPiece's own read does.
    const eq = registries.equipment || {};
    const piece = (eq.armaments || []).find((row) => row.id === ctx.itemId)
      || (eq.armour || []).find((row) => row.id === ctx.itemId && (!ctx.classId || row.classId === ctx.classId))
      || (eq.armour || []).find((row) => row.id === ctx.itemId);
    if (piece) {
      // THE SAME INPUTS THE MUTATION'S OWN CHECK USES. equipPiece has read
      // these minima since before this gate existed; this one runs FIRST and
      // short-circuits, so a narrower copy here would overrule the wider one
      // and refuse an item whose requirement an upgrade had lowered.
      const receipt = equipmentRequirementReceipt(registries, piece, ctx.attributes, {
        itemUpgradeLevels: ctx.itemUpgradeLevels || {},
        armamentLevels: ctx.armamentLevels || {},
      });
      if (!receipt.ok) {
        const shortOf = receipt.failures[0];
        const label = (registries.attributes.get(shortOf.attributeId) || {}).shortLabel || shortOf.attributeId;
        // An absent attribute is UNKNOWN, not zero: a caller that hands in a
        // partial allocation is not a character with nothing in that stat.
        const have = shortOf.actual === null ? 'unknown' : shortOf.actual;
        return { ok: false, reason: `${piece.name || piece.id} requires ${label} ${shortOf.required} (you have ${have})` };
      }
    }
  }
  return { ok: true, reason: '' };
}

/**
 * cycleSet(registries, loadout, slotId, index, { meta }) → mutates the active
 * set index. Returns false when the slot, the index, or the LADDER says no.
 *
 * VIRA'S GATE OF #90, AND SHE IS RIGHT THAT IT IS THE SAME DEFECT. `equipPiece`
 * above carried a comment claiming the gate was on the mutation; #90 proved that
 * sentence was about `fitsSlot` and had never been true of ownership, and moved
 * the gate. **This function was three functions below it, in the same file, in
 * the same commit, still bounding on `ids.length` — the raw array — while
 * `openedSets()` shipped directly above it already knowing the answer.** So the
 * ladder's gate was in the screen: the exact arrangement the commit spent itself
 * disproving. A truth function written in the same act is not a follow-up.
 *
 * Measured at `c43c908`, her falsifier, before this change: fresh profile,
 * `openedSets 1 · cycleSet accepts 3` on every multi-set slot — **6 of 13
 * (slot, index) pairs.**
 *
 * THE BOUND IS `openedSets()` AND NEVER `1 + rungs earned`, which is her edge 2
 * and the reason this is not "just add a comparison". A save from before today
 * has `sets` full-width with pieces already in the last cell and no rungs
 * earned; `openedSets` raises its floor to what the loadout is already holding,
 * on purpose. A bound that recomputed the ladder from the rungs alone would
 * strand a legacy player's weapon behind a lock that did not exist when they put
 * it there — worse than the defect. **One truth function, two consumers**: the
 * screen draws what `openedSets` opens and this refuses what it does not, so the
 * two cannot disagree about a cell.
 *
 * THE SWAP RULE IS ASKED HERE NOW, AND THAT IS THE WHOLE CHANGE (#104, Vira,
 * found while gating #98 and carded as its own act). This signature used to have
 * no `inCombat` at all, so the question was never whether it CHECKED the swap
 * rule but whether it COULD: `canSwap` was enforced by both callers and by
 * neither of them structurally. **A second copy fails by divergence; an
 * unenforced gate fails by bypass** — different defects, and only the second one
 * was here. It had a live cell: `talisman` (`swap=outOfCombat`, `sets=3`) MOVED
 * mid-fight, against its own data, and every test of this function used
 * `rightHand`, where the missing gate is vacuous — which is why nothing was red.
 * Dormant only because talismans are unauthored: one CSV row under Law 1 clause 1
 * wakes it, so this is a content fact away from live, not a hypothetical.
 *
 * IT ASKS `canSwap`; IT DOES NOT RESTATE IT. The rule keeps its one home — no
 * `slot.swap` comparison is written in this function, and the sentence a player
 * reads is not typed here. `doSwapArmament` still calls `canSwap` itself because
 * it needs the REASON to throw before it charges the price; that is the same
 * function answering two questions (may I / what do I tell them), not two copies
 * of the rule. Both callers and the mutation now agree by construction.
 *
 * `inCombat` IS REQUIRED AND FAILS CLOSED, exactly as `equipPiece`'s is and for
 * the reason written there: a context defaulting to "not in combat" makes
 * SILENCE MEAN PERMISSION, which is how every hole in this module got in. The
 * check is on the VALUE, not the key — `{ inCombat: undefined }` is what a caller
 * produces by forwarding a variable that was never set, and it refuses too.
 *
 * WHAT THIS DOES NOT OWN: the PRICE. `balance.equipment.swapCost` is charged in
 * the combat intent, outside this function. Direct model calls remain useful for
 * previews and fixtures; player actions must route through the engine.
 *
 * `registries` moves to the front like everything else in this module, which is
 * also what makes a call site left on the old signature fail CLOSED: the old
 * first argument was a loadout, `registries.equipment.slots` is then undefined,
 * the slot does not resolve, and it cycles nothing and says so.
 */
export function cycleSet(registries, loadout, slotId, index, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || index < 0 || index >= ids.length) return false;
  const slot = (((registries || {}).equipment || {}).slots || []).find((s) => s.id === slotId);
  if (!slot) {
    console.error(
      `cycleSet('${slotId}', ${index}): no such slot in registries.equipment — refusing.`
      + ' Call it as cycleSet(registries, loadout, slotId, index, { meta, inCombat }).'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `cycleSet('${slotId}', ${index}): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. Pass { meta, inCombat } so the bound is`
      + ' openedSets() and the seal is canSwap(). This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!canSwap(registries, slotId, { inCombat: ctx.inCombat }).ok) return false;
  if (index >= openedSets(registries, slot, { meta: ctx.meta || {}, loadout })) return false;
  const before = structuredClone(loadout);
  loadout.active[slotId] = index;
  try {
    buildEquippedWeaponCardPlan(registries, loadout, ctx.classId || null);
  } catch (error) {
    loadout.active[slotId] = before.active[slotId];
    console.error(`cycleSet('${slotId}', ${index}): ${error.message} — refusing.`);
    return false;
  }
  emitEquipmentChanged(ctx, 'swapSet', before, loadout);
  return true;
}

/**
 * Normalize saves written while one owned armament could occupy several hand
 * sets. Keep an active occurrence when one exists (slot order breaks ties),
 * clear the others, and remove an equipped survivor from shared Inventory.
 * Returns a receipt for the load-door ledger; an empty array means no change.
 */
export function normalizeArmamentLocations(registries, loadout) {
  if (!loadout || !loadout.sets) return [];
  const eq = (registries || {}).equipment || {};
  const handSlots = (eq.slots || []).filter((slot) => slotHand(slot));
  const armamentIds = new Set((eq.armaments || []).map((piece) => piece.id));
  const occurrences = new Map();
  for (const slot of handSlots) {
    const ids = loadout.sets[slot.id] || [];
    for (let setIndex = 0; setIndex < ids.length; setIndex++) {
      const id = ids[setIndex];
      if (!id || !armamentIds.has(id)) continue;
      const rows = occurrences.get(id) || [];
      rows.push({ slotId: slot.id, setIndex, active: setIndex === ((loadout.active || {})[slot.id] || 0) });
      occurrences.set(id, rows);
    }
  }

  const changes = [];
  const storage = [...new Set(loadout.storage || [])];
  for (const [id, rows] of occurrences) {
    const kept = rows.find((row) => row.active) || rows[0];
    // Configured class packs may explicitly own two same-definition weapons
    // (the Rogue's dagger/dagger kit). Preserve only its two active hand
    // occurrences; legacy and unrelated duplicate locations still normalize.
    const authoredPair = registries.gameProfile?.foundation?.mode === 'configured'
      && gameContent(registries, 'classes')?.some(row => row.loadout?.rightHand === id && row.loadout?.leftHand === id);
    const retained = authoredPair ? rows.filter(row => row.active).slice(0, 2) : [kept];
    if (!retained.length) retained.push(kept);
    const cleared = rows.filter((row) => !retained.includes(row));
    for (const row of cleared) loadout.sets[row.slotId][row.setIndex] = null;
    const removedFromStorage = storage.includes(id);
    if (removedFromStorage) storage.splice(storage.indexOf(id), 1);
    if (cleared.length || removedFromStorage) changes.push({ id, kept, cleared, removedFromStorage });
  }
  if (storage.length !== (loadout.storage || []).length || changes.length) loadout.storage = storage;
  return changes;
}

/**
 * Apply the storage/location half of an equipment mutation. Both the real
 * mutation and comparison preview call this function, so a preview cannot
 * invent a duplicate object the committed action would move away.
 */
function equipTransitionPlan(registries, loadout, slotId, setIndex, itemId) {
  const ids = ((loadout || {}).sets || {})[slotId];
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((candidate) => candidate.id === slotId);
  if (!slot || !ids || setIndex < 0 || setIndex >= ids.length) {
    return { ok: false, reason: 'That equipment location is no longer available.' };
  }

  const previousId = ids[setIndex] || null;
  if (!slotHand(slot)) {
    return { ok: true, slot, ids, previousId, nextStorage: loadout.storage || [], storesPrevious: false };
  }

  const cap = Number.isInteger(((registries.balance || {}).equipment || {}).storageSlots)
    ? registries.balance.equipment.storageSlots
    : 8;
  const nextStorage = [...new Set(loadout.storage || [])].filter((id) => id !== itemId);
  const storesPrevious = previousId && previousId !== itemId && !nextStorage.includes(previousId);
  if (storesPrevious && nextStorage.length >= cap) {
    return {
      ok: false,
      reason: `Inventory is full (${nextStorage.length}/${cap}). Make room before ${itemId ? 'moving this item' : 'unequipping this item'}.`,
    };
  }
  return { ok: true, slot, ids, previousId, nextStorage, storesPrevious };
}

/** A mutation-free capacity verdict for the Armoury's action feedback. */
export function equipTransitionReceipt(registries, loadout, slotId, setIndex, itemId) {
  const plan = equipTransitionPlan(registries, loadout, slotId, setIndex, itemId);
  return { ok: plan.ok, reason: plan.reason || '' };
}

export function applyEquipTransition(registries, loadout, slotId, setIndex, itemId) {
  const plan = equipTransitionPlan(registries, loadout, slotId, setIndex, itemId);
  if (!plan.ok) return false;
  const { slot, ids, nextStorage, previousId, storesPrevious } = plan;
  if (!slotHand(slot)) {
    ids[setIndex] = itemId || null;
    return true;
  }

  const eq = (registries || {}).equipment || {};
  const handSlotIds = new Set((eq.slots || []).filter((candidate) => slotHand(candidate)).map((candidate) => candidate.id));
  if (itemId) {
    for (const [otherSlotId, otherIds] of Object.entries(loadout.sets || {})) {
      if (!handSlotIds.has(otherSlotId)) continue;
      for (let i = 0; i < otherIds.length; i++) {
        if (otherIds[i] === itemId && (otherSlotId !== slotId || i !== setIndex)) otherIds[i] = null;
      }
    }
  }
  if (storesPrevious) nextStorage.push(previousId);
  loadout.storage = nextStorage;
  ids[setIndex] = itemId || null;
  return true;
}

/**
 * equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) → boolean.
 * Put a piece id into a specific set of a slot; `null` clears it.
 *
 * The gate is HERE, on the mutation, and not in the screen that calls it. The
 * picker used to be the only thing deciding what may go where, so every other
 * way into a slot — a save file, a drop, a future drag, a gamepad path nobody
 * has written yet — walked straight past it. A caller that must remember to
 * check is not a gate (`bundle.mjs`, same week, same lesson). `registries` is
 * the first argument like everything else in this module, which is also what
 * makes a call site left on the old signature fail CLOSED — it equips nothing
 * and the suite says so — rather than quietly skip the new check.
 *
 * `owned` is that same sentence, one check later, and the reason it is REQUIRED
 * rather than optional (#90). Whether the piece FITS was gated here; whether it
 * is YOURS was gated only by the picker declining to attach a click handler to
 * a locked chip. #90 removes those chips, so an optional argument would have
 * left ownership enforced by nothing at all while the screen looked stricter.
 * Missing `owned` refuses and says so — the same fail-closed shape as the
 * `registries` argument above, for the same reason.
 *
 * Clearing a slot needs no ownership, but it still asks the combat-change rule.
 * The permission is checked before the `!itemId` return so disabling combat
 * equipment changes also disables combat unequip.
 *
 * `ctx` — `{ inCombat }` — is REQUIRED, for the reason the two arguments above
 * it are (#95). A context that defaults to "not in combat" fails OPEN: every
 * call site written after today would equip mid-fight by saying nothing, which
 * is how the ownership hole survived #90 in the first place. `cycleSet` above
 * already takes a required trailing context for the ladder, so this is that
 * pattern, not a new one.
 *
 * THE CHECK IS ON THE VALUE, NOT THE KEY (#98, Vira). It read `'inCombat' in
 * ctx`, which answers whether the key was TYPED — so `{ inCombat: undefined }`
 * and `{ inCombat: null }` were taken, and both are what a caller produces by
 * forwarding a variable that was never set. That is the same defect one notch
 * quieter than the one this argument exists to close: absent read as permission.
 * A boolean, or it refuses and prints what it was actually handed.
 */
export function equipPiece(registries, loadout, slotId, setIndex, itemId, owned, ctx) {
  const ids = ((loadout || {}).sets || {})[slotId];
  if (!ids || setIndex < 0 || setIndex >= ids.length) return false;
  if (!ctx || typeof ctx !== 'object' || typeof ctx.inCombat !== 'boolean') {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): no boolean \`inCombat\` in the context — refusing.`
      + ` Got ${JSON.stringify(ctx)}. Pass { inCombat } as the seventh argument.`
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  // THE GATE IS HERE, ON THE MUTATION, and the screen no longer holds a copy of
  // it. Before #95 the only thing stopping a mid-fight re-arm was the armoury
  // declining to open its picker — a screen, not a gate, so a save file, a drop,
  // a drag, a gamepad path or a second surface walked straight past it. Measured
  // at 98fedde: equipPiece on a live combat loadout returned true.
  // Passed through, NOT coerced. `!!ctx.inCombat` would turn a value this
  // function had just refused into a legal one, so if the check above is ever
  // loosened canEquip's own check is a real second gate rather than an echo.
  const permission = canEquip(registries, slotId, {
    inCombat: ctx.inCombat, loadout, classId: ctx.classId || null, setIndex, itemId,
    // The attribute gate judges only when the caller hands in what to judge
    // by, and then by the same levels this function's own check uses.
    ...(ctx.attributes ? {
      attributes: ctx.attributes,
      itemUpgradeLevels: ctx.itemUpgradeLevels,
      armamentLevels: ctx.armamentLevels,
    } : {}),
  });
  if (!permission.ok) return false;
  const eq = (registries || {}).equipment || {};
  const slot = (eq.slots || []).find((s) => s.id === slotId);
  if (!slot) return false;
  const before = structuredClone(loadout);
  const appearedElsewhere = itemId && Object.entries(loadout.sets || {}).some(([otherSlotId, values]) => (
    values.some((value, index) => value === itemId && (otherSlotId !== slotId || index !== setIndex))
  ));
  const reason = !itemId ? 'unequip' : appearedElsewhere ? 'move' : 'equip';
  if (!itemId) {
    const changed = applyEquipTransition(registries, loadout, slotId, setIndex, null);
    if (changed) emitEquipmentChanged(ctx, reason, before, loadout);
    return changed;
  }
  // Armour ids repeat across classes; the class gate is armourById's, and this
  // one only asks whether the piece may live in this slot at all. The row it
  // reads is still the WEARER's when the caller names a class, as canEquip's
  // is: the requirement receipt keys an outfit's smithing level by
  // `armor/<classId>/<id>`, and reading another class's row would price the
  // act differently from the seal (review, #1255).
  const piece = slot.kinds.includes('armor')
    ? ((eq.armour || []).find((o) => o.id === itemId && ctx.classId && o.classId === ctx.classId)
      || (eq.armour || []).find((o) => o.id === itemId))
    : (eq.armaments || []).find((a) => a.id === itemId);
  if (!piece || !fitsSlot(slot, piece)) return false;
  if (!owned || typeof owned.has !== 'function') {
    console.error(
      `equipPiece('${slotId}', '${itemId}'): called with no ownership — refusing.`
      + ' Pass ownership(registries, { meta, loadout }) as the sixth argument.'
      + ' This line is the defect, not the refusal.'
    );
    return false;
  }
  if (!owned.has(piece)) return false;
  if (!equipmentRequirementReceipt(registries, piece, ctx.attributes, { itemUpgradeLevels: ctx.itemUpgradeLevels, armamentLevels: ctx.armamentLevels }).ok) return false;
  const next = structuredClone(loadout);
  if (!applyEquipTransition(registries, next, slotId, setIndex, itemId)) return false;
  try {
    buildEquippedWeaponCardPlan(registries, next, ctx.classId || null);
  } catch (error) {
    console.error(`equipPiece('${slotId}', '${itemId}'): ${error.message} — refusing.`);
    return false;
  }
  loadout.sets = next.sets;
  loadout.active = next.active;
  loadout.storage = next.storage;
  emitEquipmentChanged(ctx, reason, before, loadout);
  return true;
}

export {
  parseMod,
  modEffectLines,
  modEffectLine,
  HANDS,
  EQUIPMENT_ROLES,
  ARMAMENT_INTRINSIC_STAT_FIELDS,
  armamentIntrinsicStatProblems,
  slotHand,
  pieceHand,
  fitsSlot,
  CARD_MOD_APPLIES,
  EQUIPMENT_POOL_FIELDS,
  RUN_MOD_APPLIES,
  moveEquipmentPool,
  equipmentRequirementReceipt,
  startingHandsRequirementFailure,
  previewCompatibleHands,
  cardEquipmentCompatibility,
  fromDropPool,
  OWNERSHIP_GATES,
  ownership,
  addToStorage,
  carriedIds,
  SLOT_RUNG_KIND,
  slotRungs,
  openedSets,
  visibleSets,
  rungFor,
  setCellState,
  createLoadout,
  createEquipmentProfileRuleSnapshot,
  restoreEquipmentProfileRuleSnapshot,
  equippedIn,
  equippedPieces,
  figureSpec,
  loadoutTags,
  equipmentRoleSource,
  equipmentKitPlan,
  equipmentKitReceipt,
  isEquipmentComposedInstance,
  WeaponCardPackageModel,
  applyEquippedWeaponCardPlan,
  BOUND_GRANT_TAG,
  boundGrantProblems,
  boundGrantCardIds,
  sortBySourceOrder,
  ITEM_OWNED_ROLES,
  isItemOwned,
  pieceItemRef,
  reconcileGrantedCards,
  isCurrentEquipmentGrant,
  itemMountInstances,
  reconcileGrantedCardsInCombat,
  ownerItemRef,
  startingDeckPlan,
  buildEquippedWeaponCardPlan,
  WeaponDeckCompositionService,
  startingDeckProblems,
  startingDeckWarnings,
  startingDeckRefs,
  orderStartingDeck,
  cardMods,
  runMods,
  reconcileRunLoadoutHp,
  applyCardMods,
  stampDeck,
  GRIP_MODES,
  gripOf,
  GRIP_TAGS,
  gripTags,
  gripRefusal,
  SWAP_COST_BASES,
  swapCostRules,
  resolveSwapCostRule,
  swapCostFor,
  validateEquipment,
};
