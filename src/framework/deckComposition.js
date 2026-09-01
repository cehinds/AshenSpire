// src/framework/deckComposition.js — the framework's ADOPTED deck composer
// (owner ruling, 2026-09-01, recorded in docs/framework-cutover-report.md).
//
// The ruling: the shipped composition — WeaponDeckCompositionService for the
// attack slots, the role plan (equipmentKitPlan → startingDeckRefs, restamped
// by stampDeck) for guard/technique replacement — IS the framework's
// composition implementation. src/framework/deck.js remains its executable
// SPECIFICATION and the home of the contract-new outputs still to be built on
// top of this adoption (granted cards, installed weapon arts, the unarmed
// Evasive Guard / Dodge Roll package).
//
// This module is the framework door consumers compose through. It re-exports
// the adopted service rather than copying it: one implementation, one home,
// with the authority boundary (which module consumers may import) moved to
// the framework.

export {
  WeaponDeckCompositionService,
  buildEquippedWeaponCardPlan,
  applyEquippedWeaponCardPlan,
  WeaponCardPackageModel,
  startingDeckRefs,
  stampDeck,
} from '../model/loadout.js';
