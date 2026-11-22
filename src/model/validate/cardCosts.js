// src/model/validate/cardCosts.js — card grade profiles and secondary cost bounds.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { validateAttack } from '../combatRules.js';

export function cardCostProblems(b, err, ctx) {
  // Secondary costs are semantic bounds, not merely integer shapes. A negative
  // cost would mint the resource when a card is played.
  // Core cards carry their tags in the tagging relation, not on the row.
  const manaOnlyIds = new Set((Array.isArray(b.tagging) ? b.tagging : []).filter(row => row?.family === 'card' && row.tagId === 'cost.manaOnly').map(row => row.objectId));
  for (const card of Array.isArray(b.cards) ? b.cards : []) {
    if (card?.gradeProfiles) {
      if (!['spell','maneuver'].includes(card.abilityKind)) err(`cards.${card.id}.abilityKind`,'graded card requires authored spell/maneuver identity');
      const ranks = card.gradeProfiles.map(row => row.rank).sort((a,b)=>a-b);
      if (JSON.stringify(ranks) !== '[0,1,2,3,4,5]') err(`cards.${card.id}.gradeProfiles`,'must author exactly the six ranks 0..5');
      for (const profile of card.gradeProfiles) {
        const wholePrices = Number.isSafeInteger(profile.actionCost) && Number.isSafeInteger(profile.manaCost);
        // Fixed grades author the previously resolved price, rather than the
        // grade number used by formula-priced recipes. Keep the established
        // six-grade maximum and reject fractional or resource-minting prices.
        const validPrices = profile.traits?.costRule === 'fixed'
          ? wholePrices && profile.actionCost >= 1 && profile.actionCost <= 5 && profile.manaCost >= 0 && profile.manaCost <= 5
          : wholePrices && profile.manaCost === profile.rank && profile.actionCost >= 1 && profile.actionCost <= [3,1,2,3,4,5][profile.rank];
        if (!validPrices) err(`cards.${card.id}.gradeProfiles.${profile.rank}`,'Actions/Mana costs are outside the ability grade contract');
      }
      if (!Number.isInteger(card.abilityRank) || card.abilityRank < 0 || card.abilityRank > 5) err(`cards.${card.id}.abilityRank`,'default grade must be 0..5');
    }
    if (card?.attack !== undefined) {
      try { validateAttack(card.attack); } catch (e) { err(`cards.${card.id}.attack`, e.message); }
    }
    if (card && card.manaCost != null && Number.isInteger(card.manaCost) && card.manaCost < 0) {
      err(`cards.${card.id || '?'}.manaCost`, 'must be >= 0');
    }
    // A cantrip costs at most 1 Mana (owner, 2026-11-22; was 0 from 2026-11-01, SPEC card upgrades): a card tagged rank.cantrip, base or authored upgrade.
    if (card && [...(card.tags || []), ...(card.cardTags || [])].includes('rank.cantrip')) {
      if (Number.isInteger(card.manaCost) && card.manaCost > 1) err(`cards.${card.id || '?'}.manaCost`, 'a cantrip costs at most 1 Mana');
      if (card.upgrade && Number.isInteger(card.upgrade.manaCost) && card.upgrade.manaCost > 1) err(`cards.${card.id || '?'}.upgrade.manaCost`, 'a cantrip costs at most 1 Mana');
    }
    if (card && card.staminaCost != null && Number.isInteger(card.staminaCost) && card.staminaCost < 0) {
      err(`cards.${card.id || '?'}.staminaCost`, 'must be >= 0');
    }
    // MANA IS THE THIRD COST LINE (plan phase 8, proposal §7.1): a card that
    // costs Mana costs at least balance.mana.minActionCost action and
    // minStaminaCost stamina — base and upgrade alike, each field inheriting
    // the base's when the upgrade leaves it unsaid. Refused BY NAME.
    // A card tagged cost.manaOnly (owner, 2026-11-15) is the one exception: it spends Mana alone, 0 Stamina (engine/spellCosts.js).
    const manaFloor = b.balance && b.balance.mana;
    const manaOnly = !!card && ([...(card.tags || []), ...(card.cardTags || [])].includes('cost.manaOnly') || manaOnlyIds.has(card.id));
    if (card && !manaOnly && manaFloor && Number.isInteger(manaFloor.minActionCost) && Number.isInteger(manaFloor.minStaminaCost)) {
      const faces = [['', card], ['.upgrade', card.upgrade ? { cost: card.cost, manaCost: card.manaCost, staminaCost: card.staminaCost, ...card.upgrade } : null]];
      for (const [suffix, face] of faces) {
        if (!face || !(Number.isInteger(face.manaCost) && face.manaCost > 0)) continue;
        const action = face.cost === 'X' ? Infinity : face.cost;
        const stamina = Number.isInteger(face.staminaCost) ? face.staminaCost : 0;
        if (!(Number.isFinite(action) ? action >= manaFloor.minActionCost : true)) err(`cards.${card.id || '?'}${suffix}.cost`, `'${card.name || card.id}' costs Mana, so it costs at least ${manaFloor.minActionCost} action (balance.mana.minActionCost); it costs ${face.cost}`);
        if (stamina < manaFloor.minStaminaCost) err(`cards.${card.id || '?'}${suffix}.staminaCost`, `'${card.name || card.id}' costs Mana, so it costs at least ${manaFloor.minStaminaCost} stamina (balance.mana.minStaminaCost); it costs ${stamina}`);
      }
    }
  }
}
