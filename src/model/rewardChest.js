// src/model/rewardChest.js — the elite chest's grant (SPEC §3.8.1).
//
// The roll lives in engine/encounters.js (rollEliteChest, seeded); this file
// is the other half: what taking ONE option does to the run. One home, so the
// reward screen's tap, its auto-collect and any tool grant the same thing.
// It grants exactly the option handed in — nothing else in the chest moves.

import { isItemOwned } from './loadout.js';
import { sourceArmamentId } from './smithing.js';
import { rewardPlan, resolveContinue } from './rewardplan.js';

/** The chest's closed category set, in the order the chest lays them out (SPEC §3.8.1). */
export const CHEST_CATEGORIES = Object.freeze(['relic', 'upgrade', 'armament', 'cinders']);

const isId = (value) => typeof value === 'string' && value.length > 0;
const isCount = (value) => Number.isInteger(value) && value >= 0;

/**
 * chestOptionShapeProblems(option, path) → problems with one saved chest
 * option's SHAPE, by field (the save's shape door; no registry needed). Each
 * category carries exactly the payload its row in SPEC §3.8.1 names.
 */
export function chestOptionShapeProblems(option, path = 'option') {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return [`${path} must be an object`];
  if (!CHEST_CATEGORIES.includes(option.category)) return [`${path}.category must be one of ${CHEST_CATEGORIES.join(', ')}`];
  const problems = [];
  switch (option.category) {
    case 'relic':
      if (!isId(option.relicId)) problems.push(`${path}.relicId must be a non-empty string`);
      break;
    case 'upgrade':
      if (!['owned', 'rare'].includes(option.mode)) problems.push(`${path}.mode must be owned or rare`);
      if (!isId(option.cardId)) problems.push(`${path}.cardId must be a non-empty string`);
      if (option.mode === 'owned' && !isId(option.instanceId)) problems.push(`${path}.instanceId must be a non-empty string`);
      break;
    case 'armament':
      if (isId(option.armamentId) === isId(option.weaponArtId)) problems.push(`${path} must carry exactly one of armamentId or weaponArtId`);
      break;
    case 'cinders':
      if (!isCount(option.cinders)) problems.push(`${path}.cinders must be a non-negative integer`);
      if (!isCount(option.smithingStones)) problems.push(`${path}.smithingStones must be a non-negative integer`);
      break;
    default:
  }
  return problems;
}

/**
 * chestOptionReferenceProblems(registries, option) → the ids a (well-shaped)
 * chest option names that the registries do not hold (the load door's
 * reference check, engine/save.js).
 */
export function chestOptionReferenceProblems(registries, option) {
  if (!option || typeof option !== 'object') return [];
  const problems = [];
  if (option.category === 'relic' && option.relicId && !registries.relics.has(option.relicId)) problems.push(`chest relic '${option.relicId}' is unknown`);
  if (option.category === 'upgrade' && option.cardId && !registries.cards.has(option.cardId)) problems.push(`chest upgrade card '${option.cardId}' is unknown`);
  if (option.category === 'armament') {
    if (option.weaponArtId && !registries.cards.has(option.weaponArtId)) problems.push(`chest weapon art '${option.weaponArtId}' is unknown`);
    if (option.armamentId && !(registries.equipment.armaments || []).some((piece) => piece.id === option.armamentId)) {
      problems.push(`chest armament '${option.armamentId}' is unknown`);
    }
  }
  return problems;
}

/**
 * True for a deck instance an elite chest may upgrade in place: an ordinary
 * run-owned card, not already upgraded, whose def authors an upgrade. An
 * item-owned or equipment-bound card upgrades through the smith, not here
 * (the applySkillUpgrades boundary, model/skills.js).
 */
export function chestUpgradeable(registries, run, inst) {
  if (!inst || inst.upgraded || isItemOwned(inst) || inst.equipmentRole || inst.sourceArmamentId) return false;
  if (sourceArmamentId(registries, run, inst)) return false;
  const def = registries.cards.has(inst.cardId) ? registries.cards.get(inst.cardId) : null;
  return !!(def && def.upgrade);
}

/** A deck instance id not yet used in this run. */
function freshInstanceId(run, prefix, cardId) {
  let n = 1;
  while ((run.deck || []).some((c) => c.instanceId === `${prefix}:${n}:${cardId}`)) n++;
  return `${prefix}:${n}:${cardId}`;
}

/**
 * applyChestOption(registries, run, option, { collectArmament }) → boolean.
 * Grants the one option. An armament goes through the caller's collector
 * (the reward screen's storage + meta.found door); without one, or when it
 * refuses, nothing lands and the answer is false.
 */
export function applyChestOption(registries, run, option, { collectArmament = null } = {}) {
  if (!option) return false;
  switch (option.category) {
    case 'relic':
      if (!option.relicId || run.relics.includes(option.relicId)) return false;
      run.relics.push(option.relicId);
      return true;
    case 'upgrade':
      if (option.mode === 'owned') {
        const inst = run.deck.find((c) => c.instanceId === option.instanceId);
        if (!chestUpgradeable(registries, run, inst)) return false;
        inst.upgraded = true;
        return true;
      }
      if (!registries.cards.has(option.cardId)) return false;
      run.deck.push({ instanceId: freshInstanceId(run, 'chest', option.cardId), cardId: option.cardId, upgraded: true });
      return true;
    case 'armament':
      if (option.weaponArtId) {
        if (!registries.cards.has(option.weaponArtId)) return false;
        run.deck.push({ instanceId: freshInstanceId(run, 'chest-art', option.weaponArtId), cardId: option.weaponArtId, upgraded: false });
        return true;
      }
      return collectArmament ? collectArmament(option.armamentId) !== false : false;
    case 'cinders':
      run.cinders += option.cinders || 0;
      run.smithingStones = (run.smithingStones || 0) + (option.smithingStones || 0);
      return true;
    default:
      return false;
  }
}

/**
 * landChestPick(row, grant) → the option index that landed, or null.
 * An auto-collected chest row tries its seeded pick (`row.optionIndex`)
 * first; when that grant fails (the bag filled after the plan was drawn, a
 * collector refused a duplicate), each other TAKEABLE option in row order is
 * tried instead, so the chest is never dropped while it holds anything that
 * can land. `grant(index)` is the caller's apply; it answers true when it landed.
 */
export function landChestPick(row, grant) {
  if (!row || !Array.isArray(row.options)) return null;
  const order = [row.optionIndex, ...row.options.map((_, i) => i).filter((i) => i !== row.optionIndex)];
  for (const i of order) {
    if (!Number.isInteger(i) || !row.takeable?.[i]) continue;
    if (grant(i)) return i;
  }
  return null;
}

/**
 * autoTakeChest(registries, run, chest, pick, { armamentSlotsFree, collectArmament })
 * → the option granted, or null. A player-less elite door (simulators, bots):
 * the chest goes through the reward plan and its auto-collect exactly as the
 * reward screen's Continue does — `pick(n)` chooses among the TAKEABLE
 * options (an armament piece needs a free bag slot), then applyChestOption
 * grants it. The caller supplies the seeded pick (the game's is
 * `rng.int('cardRewards', 0, n - 1)`).
 */
export function autoTakeChest(registries, run, chest, pick, { armamentSlotsFree = 0, collectArmament = null } = {}) {
  if (!chest) return null;
  const plan = rewardPlan({ chest }, { flaskSlotsFree: 0, armamentSlotsFree });
  const row = resolveContinue(plan, {}, 'auto', pick).take.find((r) => r.kind === 'chest');
  if (!row) return null;
  const landed = landChestPick(row, (i) => applyChestOption(registries, run, row.options[i], { collectArmament }));
  return landed === null ? null : row.options[landed];
}
