// src/model/validate/balanceRows.js — flask capacity and the balance rows read by loadout, level, rest and mana-floor code.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { handRulesDefaults } from '../../content/handRules.js';
import { deckRules as shippedDeckRules } from '../../content/deckRules.js';
import { shops as shippedShops } from '../../content/shops.js';
import { shopsTableProblems, masterTableProblems } from '../shopKinds.js';
import { marketAdditionTableProblems, blacksmithTableProblems } from '../marketStock.js';
import { REST_MANA_MODES } from '../locations.js';
import { presetGearProblems } from '../attributes.js';
import { normalizeSmithingRules } from '../smithingRules.js';
import { deckRulesTableProblems } from './deckRulesTable.js';

export function balanceRowProblems(b, err, ctx) {
  const flaskCapacity = b.balance && b.balance.flaskCapacity;
  if (!Number.isInteger(flaskCapacity) || flaskCapacity <= 0) err('balance.flaskCapacity', 'must be a positive integer');
  try {
    normalizeSmithingRules(b.balance && b.balance.smithing);
  } catch (error) {
    err('balance.smithing', error?.message || 'must be a complete Smithing economy block');
  }
  // Card mounts: the block is optional (a bundle without it composes as it
  // always did) but when authored it must be whole, and the tag it names as
  // "extractable" must be a registered card-domain tag — otherwise nothing
  // could ever carry it and every mount would be sealed in silence.
  // The deck's floor (plan phase 3b): balance.deck is read by model/loadout.js
  // deckMinimum and nowhere else; the shape is held here so a retune that
  // types a fraction or a negative is refused by name, never clamped.
  // The character level (plan phase 6): the curve, the awards and what a
  // level grants — each a closed set, each number refused by name.
  // What a rest restores (plan phase 7): the location rules read these rows
  // through their variable bindings, the door reads the mode. A retune that
  // names an unknown mode or a percent off the scale is refused by name.
  // The block is REQUIRED: the location rules bind to balance.rest, so a bundle
  // without it would pass here and throw there.
  if (b.balance) {
    const rest = b.balance.rest;
    if (!rest || typeof rest !== 'object' || Array.isArray(rest)) err('balance.rest', 'must be an object { hpSmallPct, hpPartialPct, mana } — the location rules read it (plan phase 7)');
    else {
      for (const key of Object.keys(rest)) if (!['hpSmallPct', 'hpPartialPct', 'mana'].includes(key)) err(`balance.rest.${key}`, 'Unknown field');
      for (const key of ['hpSmallPct', 'hpPartialPct']) {
        if (!(Number.isInteger(rest[key]) && rest[key] >= 0 && rest[key] <= 100)) err(`balance.rest.${key}`, `must be an integer percent 0–100, got ${JSON.stringify(rest[key])}`);
      }
      const mana = rest.mana;
      if (!mana || typeof mana !== 'object' || Array.isArray(mana)) err('balance.rest.mana', 'must be an object { mode, flat, floorPct }');
      else {
        for (const key of Object.keys(mana)) if (!['mode', 'flat', 'floorPct'].includes(key)) err(`balance.rest.mana.${key}`, 'Unknown field');
        if (!REST_MANA_MODES.includes(mana.mode)) err('balance.rest.mana.mode', `must be one of ${REST_MANA_MODES.join(', ')}, got ${JSON.stringify(mana.mode)}`);
        if (!(Number.isInteger(mana.flat) && mana.flat >= 0)) err('balance.rest.mana.flat', `must be a non-negative integer, got ${JSON.stringify(mana.flat)}`);
        if (!(Number.isInteger(mana.floorPct) && mana.floorPct >= 0 && mana.floorPct <= 100)) err('balance.rest.mana.floorPct', `must be an integer percent 0–100, got ${JSON.stringify(mana.floorPct)}`);
      }
    }
  }
  // Plan phase 8: the Mana cost floor, the player stagger's payload and the
  // player poise coefficient — each required, each number refused by name.
  if (b.balance) {
    const mana = b.balance.mana;
    if (!mana || typeof mana !== 'object' || Array.isArray(mana)) err('balance.mana', 'must be an object { minActionCost, minStaminaCost } — the card cost rule reads it (plan phase 8)');
    else {
      for (const key of Object.keys(mana)) if (!['minActionCost', 'minStaminaCost', 'focusManaDiscount', 'focusItemType'].includes(key)) err(`balance.mana.${key}`, 'Unknown field');
      if (!(Number.isInteger(mana.focusManaDiscount) && mana.focusManaDiscount >= 0)) err('balance.mana.focusManaDiscount', `must be a non-negative integer, got ${JSON.stringify(mana.focusManaDiscount)}`);
      if (typeof mana.focusItemType !== 'string' || !mana.focusItemType) err('balance.mana.focusItemType', 'must be an item-type tag id');
      for (const key of ['minActionCost', 'minStaminaCost']) {
        if (!(Number.isInteger(mana[key]) && mana[key] >= 0)) err(`balance.mana.${key}`, `must be a non-negative integer, got ${JSON.stringify(mana[key])}`);
      }
    }
    const stagger = b.balance.stagger;
    const player = stagger && typeof stagger === 'object' && !Array.isArray(stagger) ? stagger.player : undefined;
    if (!stagger || typeof stagger !== 'object' || Array.isArray(stagger)) err('balance.stagger', 'must be an object { player } — the player poise meter reads it (plan phase 8)');
    else {
      for (const key of Object.keys(stagger)) if (!['player'].includes(key)) err(`balance.stagger.${key}`, 'Unknown field');
      if (!player || typeof player !== 'object' || Array.isArray(player)) err('balance.stagger.player', 'must be an object { actionLoss, statuses }');
      else {
        for (const key of Object.keys(player)) if (!['actionLoss', 'statuses'].includes(key)) err(`balance.stagger.player.${key}`, 'Unknown field');
        if (!(Number.isInteger(player.actionLoss) && player.actionLoss >= 0)) err('balance.stagger.player.actionLoss', `must be a non-negative integer, got ${JSON.stringify(player.actionLoss)}`);
        if (!player.statuses || typeof player.statuses !== 'object' || Array.isArray(player.statuses)) err('balance.stagger.player.statuses', 'must be an object { <statusId>: stacks }');
        else {
          const statusIds = new Set((Array.isArray(b.statuses) ? b.statuses : []).map((s) => s && s.id));
          for (const [status, stacks] of Object.entries(player.statuses)) {
            if (!statusIds.has(status)) err(`balance.stagger.player.statuses.${status}`, `unknown status '${status}'`);
            if (!(Number.isInteger(stacks) && stacks > 0)) err(`balance.stagger.player.statuses.${status}`, `must be a positive integer, got ${JSON.stringify(stacks)}`);
          }
        }
      }
    }
    // A PRESET MUST BE ABLE TO HOLD ITS OWN CLASS'S STARTING GEAR (plan
    // phase 9). The rule and its wording live in model/attributes.js so the
    // Advanced settings door asks the same question of an edited preset
    // (review, #1217); this door asks it of the authored content.
    for (const problem of presetGearProblems({
      presets: (b.attributeRules || {}).presets,
      defaultMode: (b.attributeRules || {}).defaultMode,
      startingKits: ((b.equipment || {}).startingKits) || [],
      equipmentRequirements: ((b.equipment || {}).equipmentRequirements) || [],
      creationClasses: ((b.characterCreation || {}).classes) || {},
    })) err(problem.path, problem.msg);
    const poise = b.balance.poise;
    if (!poise || typeof poise !== 'object' || Array.isArray(poise)) err('balance.poise', 'must be an object { growthMult, onFill, playerImpactPerHit } — the poise meters read it (plan phase 8); the Constitution term is the derived-stat row (plan phase 9)');
    else {
      if (!(Number.isInteger(poise.playerImpactPerHit) && poise.playerImpactPerHit >= 0)) err('balance.poise.playerImpactPerHit', `must be a non-negative integer, got ${JSON.stringify(poise.playerImpactPerHit)}`);
      if (poise.playerPerConstitution !== undefined) err('balance.poise.playerPerConstitution', 'was retired in plan phase 9: the Poise coefficient is derivedStatRules.rules.poise, and a copy here is a second home for one number');
    }
    // RULESET 7 RETIRED THREE HOMES FOR ONE NUMBER EACH. A copy returning to
    // any of them is refused by name, as `playerPerConstitution` is above:
    // the hand size, the rating formula and its multiplier, and the hand
    // rules' counts are rows of derivedStatRules now.
    if (b.balance.handMax !== undefined) err('balance.handMax', 'was retired in derived-stat ruleset 7: the hand size is derivedStatRules.rules.handSize, and a copy here is a second home for one number');
    if (b.balance.combatRatings !== undefined && b.balance.combatRatings !== null && typeof b.balance.combatRatings === 'object') {
      if (b.balance.combatRatings.multiplier !== undefined) err('balance.combatRatings.multiplier', 'was retired in derived-stat ruleset 7: each rating is a derivedStatRules row whose weights are the whole formula');
    }
    // The hand's shipped behaviour options (content/handRules.js) are the
    // other place a count could creep back; a bundle may carry its own too.
    // #1294's per-class opening hand (`startingByClass`) is the openingHand
    // row's per-class form (`byClass`) since ruleset 7.
    const retiredHand = { starting: 'openingHand', startingByClass: 'openingHand.byClass', turn: 'draw', capacity: 'handSize' };
    for (const [group, row] of Object.entries(retiredHand)) {
      if (handRulesDefaults[group] !== undefined) err(`handRulesDefaults.${group}`, `was retired in derived-stat ruleset 7: the count is derivedStatRules.rules.${row}`);
      if (b.handRules && b.handRules[group] !== undefined) err(`handRules.${group}`, `was retired in derived-stat ruleset 7: the count is derivedStatRules.rules.${row}, and a copy here is a second home for one number`);
    }
    // The deck editor's rules (content/deckRules.js, SPEC §14.1) are data the
    // editor reads at use; a malformed table is refused here, by name, at boot.
    deckRulesTableProblems(b.deckRules || shippedDeckRules, b.cards, err, b.nodes);
    // The shop kinds (content/shops.js, SPEC §14.2): the guaranteed minimum,
    // the offerings, a [NOTE] beside every number, and no weight for a kind
    // whose screen has not shipped.
    shopsTableProblems(b.shops || shippedShops, err, b);
    marketAdditionTableProblems(b.shops || shippedShops, err);
    blacksmithTableProblems(b.shops || shippedShops, err);
    masterTableProblems(b.shops || shippedShops, err, b);
    const exposure = b.balance.exposure;
    if (exposure && typeof exposure === 'object' && !Array.isArray(exposure)) {
      for (const key of ['foldScale', 'staggerBreakImpact']) if (!Number.isFinite(exposure[key]) || exposure[key] < 0) err(`balance.exposure.${key}`, 'must be finite and non-negative');
      const payoff = exposure.defaultPayoff;
      if (!payoff || !(b.statuses || []).some(status => status.id === payoff.status)) err('balance.exposure.defaultPayoff.status', 'must name a status');
      if (!Number.isInteger(payoff?.value) || payoff.value < 0) err('balance.exposure.defaultPayoff.value', 'must be a non-negative integer');
      if (!Number.isInteger(payoff?.duration) || payoff.duration <= 0) err('balance.exposure.defaultPayoff.duration', 'must be a positive integer');
      if (!(Number.isInteger(exposure.buildupPerManaSpell) && exposure.buildupPerManaSpell >= 0)) err('balance.exposure.buildupPerManaSpell', `must be a non-negative integer, got ${JSON.stringify(exposure.buildupPerManaSpell)}`);
      if (!(Number.isInteger(exposure.resonanceSpreadPct) && exposure.resonanceSpreadPct >= 0 && exposure.resonanceSpreadPct <= 100)) err('balance.exposure.resonanceSpreadPct', `must be an integer percent 0–100, got ${JSON.stringify(exposure.resonanceSpreadPct)}`);
    }
  }
  ctx.flaskCapacity = flaskCapacity;
}
