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
  // A8 — THE PRESENTATION HALF OF HIS SWAP-COST ASK. KEEP, AND THIS IS THE
  // REASON THAT HOLDS.
  // His words, D15, 2026-08-08: "switching sets should cost actions. PERHAPS
  // THIS ACTION COSTS MORE OR LESS DEPENDING ON TALISMAN or starting relic, or
  // some other reason. let's default to costing 2 actions... that way I can try
  // each." The base price shipped (`balance.swapCost: 2`); this row is the half
  // that shows him the "depending on Talisman" clause when a comparison changes
  // it. The mechanism is `runMods().swapCostDelta` — see the long note at
  // `model/loadout.js` runMods, which is the truth home for WHY the value
  // exists; this comment is the truth home for why the ROW exists.
  //
  // WHY IT IS KEPT: THIS ROW IS THE ONLY TRACE OF A8 ON A SCREEN. It is the one
  // place a player could ever meet the rung he asked to TRY and to FEEL — "that
  // way I can try each" — and a rung with perfect code and no surface fails his
  // ask while every test in this repo is green.
  //   DISCHARGE CONDITION: this reason dies the day the rung gets a surface
  //   somewhere else — any shipped screen that shows a player what a swap costs
  //   with the talisman/relic delta applied. On that day this row is ordinary
  //   code, judged on its own merits and deletable like any other.
  //   DO NOT KEEP IT BECAUSE IT IS THE LAST TRACE OF A REQUEST HE MADE. That was
  //   the reason first recorded here and IT IS FALSE — the ask has at least five
  //   traces and four are executable: the `gear` row in
  //   `balance.equipment.swapCostRules`, `swapCostFor()`'s gearOn/gearDelta/
  //   gearIgnored rungs, engine test 28b, engine test 28c, plus his sentence
  //   quoted verbatim in `content/balance.js`. One grep discharges it, and the
  //   reader careful enough to run that grep is handed an argument for the
  //   deletion this comment exists to prevent. A false reason for a right keep
  //   is an invitation. Falsified by Sten, 2026-08-15; corrected here.
  //
  // IT HAS NEVER RENDERED, AND THAT IS TWO PREMISES, NOT A BUG. Written out so
  // the next reader deletes neither by mistake:
  //   1. NO CONTENT AUTHORS IT. Zero rows in `content/` or `src/content/` carry
  //      a `self.swapCost` mod or a `swapCostDelta` relic passive. The talisman
  //      slot ships ahead of its content on purpose — `equipSlots.csv`, "Empty
  //      until talismans are authored." So both mods are always 0 and the
  //      inequality above is always false.
  //   2. THE SHIPPED RULE IGNORES THE RUNG ANYWAY. `balance.swapCostRule` is
  //      'flat', and 'flat' is `gear: false`. Only the 'gear' rule takes the
  //      talisman/relic delta.
  //
  // WAKE CONDITION (development.md, *The wake condition*) — the premises die
  // SEPARATELY, and premise 1 dying alone makes this row LIE: the first
  // authored talisman renders "Active-set swap Actions 0 -> 2" while a 'flat'
  // run charges 2 flat and discards the delta. So: the day a `self.swapCost`
  // mod or a `swapCostDelta` passive is authored, this row must either move
  // behind the active rule's `gear` flag or say what the rule declined
  // (`swapCostFor().gearIgnored` already computes it — see engine test 28b).
  // THAT REMEDY ANSWERS THE TALISMAN CHANNEL ONLY, and the limit is deliberate:
  // this row compares before/after `runMods().swapCostDelta`, which is the WORN
  // channel, correctly, because a relic does not change when you swap a weapon
  // and its delta cancels in the comparison. So a `swapCostDelta` RELIC passive
  // authored tomorrow moves nothing here, lies about nothing, and shows nothing
  // — silent, not wrong, which is the harder failure and NOT this row's job to
  // answer. It needs a surface that does not exist; carded separately, and do
  // not let it ride this row's fix (Sten's finding, 2026-08-15).
  // NO WAKE RED EXISTS FOR THIS ONE. Four sibling refusals got theirs in #172
  // (flaskgrowth, gracerefill, hudbars, player-poise-threshold); this is the
  // fifth and it is uncovered. Carded, not built — Saga, 2026-08-15.
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
