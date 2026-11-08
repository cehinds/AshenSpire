// src/model/loadout/index.js — the barrel: every public name of the loadout parts, one place.
// Parts import each other directly (never through here) so there is no cycle.
// Spelled import-then-export, not `export * from`: the bundler reads only that form.

import { parseMod, modEffectLines, modEffectLine } from './modStrings.js';
import {
  HANDS, EQUIPMENT_ROLES, ARMAMENT_INTRINSIC_STAT_FIELDS, armamentIntrinsicStatProblems,
  slotHand, pieceHand, fitsSlot,
} from './hands.js';
import {
  CARD_MOD_APPLIES, EQUIPMENT_POOL_FIELDS, RUN_MOD_APPLIES, moveEquipmentPool,
} from './applyVocab.js';
import {
  equipmentRequirementReceipt, startingHandsRequirementFailure, previewCompatibleHands,
  cardEquipmentCompatibility,
} from './requirements.js';
import { fromDropPool, OWNERSHIP_GATES, ownership, addToStorage, carriedIds } from './ownership.js';
import {
  SLOT_RUNG_KIND, slotRungs, openedSets, visibleSets, rungFor, setCellState,
} from './slotLadder.js';
import {
  createLoadout, createEquipmentProfileRuleSnapshot, restoreEquipmentProfileRuleSnapshot,
} from './shape.js';
import { equippedIn, equippedPieces, figureSpec, loadoutTags } from './equipped.js';
import { equipmentRoleSource, equipmentKitPlan, equipmentKitReceipt } from './kit.js';
import {
  isEquipmentComposedInstance, WeaponCardPackageModel, applyEquippedWeaponCardPlan,
} from './weaponPackages.js';
import {
  BOUND_GRANT_TAG, boundGrantProblems, boundGrantCardIds, sortBySourceOrder,
} from './grantSources.js';
import {
  ITEM_OWNED_ROLES, isItemOwned, pieceItemRef, reconcileGrantedCards, isCurrentEquipmentGrant,
  itemMountInstances, reconcileGrantedCardsInCombat, ownerItemRef,
} from './grants.js';
import { startingDeckPlan } from './deckPlan.js';
import { buildEquippedWeaponCardPlan, WeaponDeckCompositionService } from './weaponPlan.js';
import {
  startingDeckProblems, startingDeckWarnings, startingDeckRefs, orderStartingDeck,
} from './startingDeck.js';
import { cardMods, runMods, reconcileRunLoadoutHp } from './cardMods.js';
import { applyCardMods } from './applyCardMods.js';
import { stampDeck } from './stampDeck.js';
import { GRIP_MODES, gripOf, GRIP_TAGS, gripTags, gripRefusal } from './grip.js';
import { SWAP_COST_BASES, swapCostRules, resolveSwapCostRule, swapCostFor } from './swapCost.js';
import { validateEquipment } from './validate.js';
import {
  healMissingSlotCells, trimExtraSets, deckMinimum, loadoutLeaveRefusal, loadoutSignature,
  canSwap, COMBAT_EQUIPMENT_CHANGE_DISABLED, canEquip, cycleSet, normalizeArmamentLocations,
  equipTransitionReceipt, applyEquipTransition, equipPiece,
} from './equipChange.js';

// One-line `export { }` statements: the bundler reads them line by line.
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
