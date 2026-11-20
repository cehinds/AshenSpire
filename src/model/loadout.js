// src/model/loadout.js — what you carry, and what it does to your cards.
//
// The design rule (SPEC §3.1(2)) is that equipment may not add behaviour the
// engine doesn't already have. So a piece never ships an effect: it ships
// NUMBERS aimed at the cards you already start with. A dagger doesn't give you
// a dagger card — it turns Strike into 3 damage twice. A greatsword turns the
// same Strike into one heavy, expensive swing. The deck size never changes,
// and the engine never learns the word "dagger".
//
// Three tables do all the deciding, none of them in this file:
//   equipSlots.csv    what slots exist, how many sets each carries, swap rules
//   equipMods.csv     which fields a mod may name and how each one applies
//   equipTargets.csv  which card each mod prefix rewrites, per class
//
// Everything here is headless and pure: no document, no timers, no randomness.
//
// The code lives in src/model/loadout/*.js, one file per concern; this file
// is the one door every importer uses, so none of them moved. The bundler
// reads only static `import { }` / `export { }` forms, so this is spelled out
// rather than `export * from` (tests/loadout-split.test.mjs keeps it in step).

import {
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
  healMissingSlotCells,
  trimExtraSets,
  deckMinimum,
  loadoutLeaveRefusal,
  loadoutSignature,
  canSwap,
  COMBAT_EQUIPMENT_CHANGE_DISABLED,
  canEquip,
  cycleSet,
  normalizeArmamentLocations,
  equipTransitionReceipt,
  applyEquipTransition,
  equipPiece,
} from './loadout/index.js';

export { parseMod, modEffectLines, modEffectLine, HANDS, EQUIPMENT_ROLES };
export { ARMAMENT_INTRINSIC_STAT_FIELDS, armamentIntrinsicStatProblems, slotHand, pieceHand };
export { fitsSlot, CARD_MOD_APPLIES, EQUIPMENT_POOL_FIELDS, RUN_MOD_APPLIES, moveEquipmentPool };
export { equipmentRequirementReceipt, startingHandsRequirementFailure, previewCompatibleHands };
export { cardEquipmentCompatibility, fromDropPool, OWNERSHIP_GATES, ownership, addToStorage };
export { carriedIds, SLOT_RUNG_KIND, slotRungs, openedSets, visibleSets, rungFor, setCellState };
export { createLoadout, createEquipmentProfileRuleSnapshot, restoreEquipmentProfileRuleSnapshot };
export { equippedIn, equippedPieces, figureSpec, loadoutTags, equipmentRoleSource };
export { equipmentKitPlan, equipmentKitReceipt, isEquipmentComposedInstance };
export { WeaponCardPackageModel, applyEquippedWeaponCardPlan, BOUND_GRANT_TAG, boundGrantProblems };
export { boundGrantCardIds, sortBySourceOrder, ITEM_OWNED_ROLES, isItemOwned, pieceItemRef };
export { reconcileGrantedCards, isCurrentEquipmentGrant, itemMountInstances };
export { reconcileGrantedCardsInCombat, ownerItemRef, startingDeckPlan };
export { buildEquippedWeaponCardPlan, WeaponDeckCompositionService, startingDeckProblems };
export { startingDeckWarnings, startingDeckRefs, orderStartingDeck, cardMods, runMods };
export { reconcileRunLoadoutHp, applyCardMods, stampDeck, GRIP_MODES, gripOf, GRIP_TAGS, gripTags };
export { gripRefusal, SWAP_COST_BASES, swapCostRules, resolveSwapCostRule, swapCostFor };
export { validateEquipment, healMissingSlotCells, trimExtraSets, deckMinimum, loadoutLeaveRefusal };
export { loadoutSignature, canSwap, COMBAT_EQUIPMENT_CHANGE_DISABLED, canEquip, cycleSet };
export { normalizeArmamentLocations, equipTransitionReceipt, applyEquipTransition, equipPiece };
