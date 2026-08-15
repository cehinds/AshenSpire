// One read model for equipment-facing comparison surfaces. Character creation
// and the Armoury render this receipt; neither screen redoes kit, requirement,
// resource, or inert player-Poise arithmetic.

import {
  equipmentKitReceipt,
  equipmentRequirementReceipt,
  equippedIn,
  equippedPieces,
  parseMod,
  runMods,
} from './loadout.js';
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

function candidateReceipt(registries, run, candidate, beforeRoles) {
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
  if (beforeMods.swapCostDelta !== afterMods.swapCostDelta) {
    resourceChanges.push({
      id: 'swapCost',
      // Actions, not Energy (D17 message 3) — the same resource, the same
      // rename, and a comparison row that kept the old noun would be the one
      // place a player met both words in one session.
      label: 'Active-set swap Actions',
      before: beforeMods.swapCostDelta,
      after: afterMods.swapCostDelta,
    });
  }
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

export function equipmentSurfaceReceipt(registries, run, { candidate = null } = {}) {
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
  if (candidate) receipt.candidate = candidateReceipt(registries, run, candidate, roles);
  return receipt;
}
