// One read model for equipment-facing comparison surfaces. Character creation
// and the Armoury render this receipt; neither screen redoes kit, requirement,
// resource, or inert player-Poise arithmetic.

import {
  equipmentKitReceipt,
  equipmentRequirementReceipt,
  equippedIn,
  equippedPieces,
  parseMod,
  resolveSwapCostRule,
  runMods,
  swapCostFor,
} from './loadout.js';
import { passiveSum } from './registries.js';
import { playerPoiseThresholdReceipt } from './statProjection.js';

function pieceFor(registries, classId, pieceId, slot) {
  if (!pieceId) return null;
  const equipment = registries.equipment || {};
  return slot.kinds.includes('armor')
    ? (equipment.armour || []).find((row) => row.classId === classId && row.id === pieceId) || null
    : (equipment.armaments || []).find((row) => row.id === pieceId) || null;
}

function requirementsFor(registries, run, pieces) {
  return pieces
    .map((piece) => {
      const receipt = equipmentRequirementReceipt(registries, piece, run.attributes);
      return {
        ...receipt,
        pieceName: piece.name,
        requirements: receipt.requirements.map((row) => ({
          ...row,
          label: registries.attributes.get(row.attributeId).shortLabel,
        })),
        failures: receipt.failures.map((row) => ({
          ...row,
          label: registries.attributes.get(row.attributeId).shortLabel,
        })),
      };
    })
    .filter((row) => row.requirements.length);
}

function rolesFor(registries, run) {
  const copies = registries.balance.equipment.roleCopies;
  return equipmentKitReceipt(
    registries,
    run.loadout,
    run.class,
    run.attributes,
    run.equipmentProfileRuleSnapshot,
  ).map((row) => ({ ...row, copies: copies[row.role] }));
}

function explicitEffects(registries, beforePiece, afterPiece) {
  const before = new Set((beforePiece && beforePiece.mods) || []);
  const fields = (registries.equipment || {}).modFields || {};
  return ((afterPiece && afterPiece.mods) || [])
    .filter((raw) => !before.has(raw))
    .map((raw) => {
      const mod = parseMod(raw);
      const field = mod && fields[mod.field];
      if (!mod || !field) throw new Error(`${afterPiece.id}: unknown explicit effect '${raw}'`);
      return {
        raw,
        target: mod.prefix,
        field: mod.field,
        label: `${field.label} ${mod.mode === 'add' && mod.value >= 0 ? '+' : ''}${mod.value}`,
      };
    });
}

// ---------------------------------------------------------------------------
// WHAT A SWAP WOULD COST — read from the price, never re-derived (Viki, MR-41)
// ---------------------------------------------------------------------------
//
// THE DEFECT THIS REPLACES, MEASURED RATHER THAN ARGUED. This row used to be
// `beforeMods.swapCostDelta → afterMods.swapCostDelta` under the label
// *"Active-set swap Actions"* — a DELTA wearing a PRICE's name, and a second
// home for a fact `swapCostFor()` already owns. With one talisman authored
// (`self.swapCost=+2`, a CSV row and no code) it renders **0 → 2** while the
// engine charges:
//
//   flat (the shipped default)  2 → 2, and the +2 DISCARDED (gearIgnored 2)
//   gear                        2 → 4
//   category                    2 → 2, and the +2 DISCARDED (gearIgnored 2)
//
// Wrong under all three, and loudest under the default. The trigger is a
// content author adding a row and touching no code — the exact act Law 0 exists
// to make easy — so it is a mine under the content pipeline, not a cosmetic
// slip. `swapCostFor()` is the ONE place that knows the base, the rule, the
// category and the two gear channels; this reads its answer and does no
// arithmetic of its own. That is the whole fix: one fact, one home.
//
// SAME SET, BEFORE AND AFTER. Each combat-swappable slot is priced at the SAME
// set index in both loadouts — the candidate's own set for its own slot, the
// active set for the others — so the two numbers differ by this piece and
// nothing else. Pricing "your current set" against "the candidate's set" would
// fold a set change into a piece comparison and the row could move for a reason
// the player did not choose.
//
// WHY ONLY `swap === 'combat'` SLOTS. There is no mid-fight price for a slot
// you cannot change mid-fight. A talisman or an outfit still shows up here —
// it is WORN, so it moves the hands' price — and the row names the hand rather
// than implying you pay to change the charm.
//
// `gearIgnored` IS CONSULTED, WHICH IS THE POINT. A gear-off rule declines the
// talisman/relic delta; `swapCostFor` returns the declined amount precisely so
// "a talisman doing nothing says so instead of looking broken" (its own header).
// The row renders when the PRICE moves or when the DECLINED amount moves, so
// under `flat` the charm reads `2 → 2` with a sentence saying the rule refused
// its +2. Silence there would be the same defect one step quieter.
//
function swapPriceChanges(registries, run, beforeLoadout, afterLoadout, meta, candidateSlotId, candidateSetIndex) {
  const rule = resolveSwapCostRule(registries, meta);
  const relicDelta = passiveSum(registries, run.relics || [], 'swapCostDelta');
  const rows = [];
  for (const slot of (registries.equipment.slots || [])) {
    if (slot.swap !== 'combat') continue;
    const setIndex = slot.id === candidateSlotId
      ? candidateSetIndex
      : Number((afterLoadout.active || {})[slot.id]) || 0;
    const priceIn = (loadout) => swapCostFor(registries, {
      rule, loadout, classId: run.class, slotId: slot.id, setIndex, relicDelta,
    });
    const before = priceIn(beforeLoadout);
    const after = priceIn(afterLoadout);
    const declined = after.gearIgnored - before.gearIgnored;
    if (before.cost === after.cost && declined === 0) continue;
    rows.push({
      id: `swapCost:${slot.id}`,
      // Actions, not Energy (D17 message 3) — the same resource, the same
      // rename, and a comparison row that kept the old noun would be the one
      // place a player met both words in one session.
      label: `${slot.label} swap Actions`,
      before: before.cost,
      after: after.cost,
      ruleId: after.ruleId,
      note: declined === 0 ? '' : `${(rule && rule.label) || 'This rule'} does not charge gear`
        + ` — ${declined > 0 ? '+' : ''}${declined} not applied.`,
    });
  }
  return rows;
}

function candidateReceipt(registries, run, candidate, beforeRoles, meta) {
  const slot = (registries.equipment.slots || []).find((row) => row.id === candidate.slotId);
  if (!slot) throw new Error(`Unknown comparison slot '${candidate.slotId}'`);
  const setIndex = Number(candidate.setIndex);
  if (!Number.isInteger(setIndex) || setIndex < 0) throw new Error('Equipment comparison needs a non-negative set index');
  const piece = pieceFor(registries, run.class, candidate.pieceId, slot);
  if (candidate.pieceId && !piece) throw new Error(`Unknown comparison piece '${candidate.pieceId}'`);

  const loadout = structuredClone(run.loadout);
  if (!Array.isArray(loadout.sets[slot.id]) || setIndex >= loadout.sets[slot.id].length) {
    throw new Error(`${slot.id}: comparison set ${setIndex} does not exist`);
  }
  const beforePiece = equippedIn(registries, run.loadout, run.class, slot.id);
  loadout.sets[slot.id][setIndex] = piece ? piece.id : null;
  loadout.active[slot.id] = setIndex;
  const comparedRun = { ...run, loadout };
  const afterRoles = rolesFor(registries, comparedRun);
  const beforeByRole = new Map(beforeRoles.map((row) => [row.role, row]));
  const beforeMods = runMods(registries, run.loadout, run.class);
  const afterMods = runMods(registries, loadout, run.class);
  const resourceChanges = [];
  if (beforeMods.maxHp !== afterMods.maxHp) {
    resourceChanges.push({
      id: 'maxHp',
      label: 'Max HP',
      before: run.maxHp,
      after: run.maxHp + afterMods.maxHp - beforeMods.maxHp,
    });
  }
  resourceChanges.push(...swapPriceChanges(registries, run, run.loadout, loadout, meta, slot.id, setIndex));
  const beforePoise = playerPoiseThresholdReceipt(registries, run);
  const afterPoise = playerPoiseThresholdReceipt(registries, comparedRun);
  return {
    slotId: slot.id,
    setIndex,
    pieceId: piece && piece.id,
    pieceName: piece ? piece.name : 'Bare',
    requirement: piece ? requirementsFor(registries, run, [piece])[0] || {
      itemId: piece.id, pieceName: piece.name, requirements: [], failures: [], ok: true,
    } : null,
    roles: afterRoles.map((after) => ({
      role: after.role,
      beforeName: beforeByRole.get(after.role).profile.displayName,
      afterName: after.profile.displayName,
      beforeValue: beforeByRole.get(after.role).receipt.value,
      afterValue: after.receipt.value,
      afterSchool: after.profile.damageSchool,
      afterTags: after.profile.tags || [],
    })),
    addedEffects: explicitEffects(registries, beforePiece, piece),
    resourceChanges,
    poise: {
      before: beforePoise.value,
      after: afterPoise.value,
      active: false,
      note: afterPoise.note,
    },
  };
}

// `meta` is the profile whose `settings.swapCostRule` picks the live price rule
// — the SAME resolver `createCombat` uses, so the screen and the engine cannot
// disagree about which rule is on. An absent `meta` resolves to the shipping
// default exactly as `createCombat(…, { swapCostRule: null })` does; the rule
// that actually priced each row is returned on the row (`ruleId`) so a screen
// that forgot to hand its settings over is readable rather than plausible.
export function equipmentSurfaceReceipt(registries, run, { candidate = null, meta = null } = {}) {
  if (!run || !run.loadout) throw new Error('equipmentSurfaceReceipt requires a run loadout');
  const roleCopies = { ...registries.balance.equipment.roleCopies };
  const roles = rolesFor(registries, run);
  const signatureId = registries.classes.get(run.class).startingSignatureCard;
  const receipt = {
    roleCopies,
    roles,
    signature: {
      cardId: signatureId,
      name: registries.cards.get(signatureId).name,
      copies: roleCopies.signature,
    },
    requirements: requirementsFor(registries, run, equippedPieces(registries, run.loadout, run.class)),
    poise: playerPoiseThresholdReceipt(registries, run),
  };
  if (candidate) receipt.candidate = candidateReceipt(registries, run, candidate, roles, meta);
  return receipt;
}
