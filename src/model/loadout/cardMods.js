// src/model/loadout/cardMods.js — collecting mods from the equipped pieces (card mods, run mods, run HP).
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

import { gameProfileEquipmentReceipt, gameProfileEffectiveAttributes } from '../gameProfileGear.js';
import { gameModule } from '../gameProfile.js';
import { deriveStat } from '../derivedStats.js';
import { effectiveAshenBlightAttributes, ashenBlightBonuses } from '../ashenBlight.js';
import { note } from '../healLedger.js';
import { parseMod } from './modStrings.js';
import { EQUIPMENT_POOL_FIELDS, EQUIPMENT_POOL_CURRENT, moveEquipmentPool } from './applyVocab.js';
import { WeaponCardPackageModel } from './weaponPackages.js';
import { equippedPieces } from './equipped.js';

/**
 * cardMods(registries, loadout, classId) → Map(cardId → ['damage=+4', ...]).
 * The prefix is dropped because it has already done its job (choosing the
 * card); order is slot order, and the applier honours it.
 */
export function cardMods(registries, loadout, classId, { attackSourceWeaponId = undefined } = {}) {
  const eq = registries.equipment || {};
  const fields = eq.modFields || {};
  const out = new Map();
  for (const piece of equippedPieces(registries, loadout, classId)) {
    const packageModel = WeaponCardPackageModel.fromPiece(registries, piece);
    if (attackSourceWeaponId !== undefined && packageModel && piece.id !== attackSourceWeaponId) continue;
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      const spec = mod && fields[mod.field];
      if (!spec || spec.scope !== 'card') continue;
      const cardId = cardForTarget(eq, mod.prefix, classId);
      if (!cardId) continue;
      const list = out.get(cardId) || [];
      list.push(`${mod.field}=${mod.mode === 'add' ? (mod.value >= 0 ? '+' : '') : ''}${mod.value}`);
      out.set(cardId, list);
    }
  }
  return out;
}

function cardForTarget(eq, target, classId) {
  const rows = eq.targets || [];
  const exact = rows.find((t) => t.target === target && t.classId === classId);
  if (exact) return exact.cardId;
  const any = rows.find((t) => t.target === target && t.classId === '*');
  return any ? any.cardId : null;
}

/**
 * runMods(registries, loadout, classId)
 *   → { maxHp, maxMana, maxStamina, swapCostDelta, startStatuses }
 * The `self.*` half of the vocabulary: things a piece does to you rather than
 * to a card. startStatuses are handed straight to createCombat's existing
 * playerStatuses hook, so the engine needs no equipment code to honour them.
 *
 * `swapCostDelta` is the TALISMAN half of A8 — *"perhaps this action costs more
 * or less depending on Talisman"* — and it arrives as one `apply` value rather
 * than a new field on a piece, because a talisman already says what it does in
 * the same `mods` column every other piece uses (`self.swapCost=+1`). It is
 * SIGNED and it is a DELTA, never a price: the price is derived in
 * `swapCostFor` below, which is the only place that knows the base.
 *
 * NOTHING IS AUTHORED FOR IT YET AND THAT IS A CONTENT FACT, NOT A GAP. The
 * talisman slot has zero rows (equipSlots.csv ships it ahead of its content),
 * so today this returns 0 for every real loadout — and the day a talisman row
 * exists it works with no code, which test 28b measures with a piece it
 * authors itself rather than waiting for one.
 */
export function runMods(registries, loadout, classId, run = null) {
  const subject = run || {gameProfile:registries.gameProfile,loadout,class:classId};
  const gear = gameProfileEquipmentReceipt(registries,subject);
  const resolvedRefs = new Set(gear.sources.map(source=>source.sourceId));
  const fields = (registries.equipment || {}).modFields || {};
  const stacks = new Map();
  const pools = Object.fromEntries(EQUIPMENT_POOL_FIELDS.map((field) => [field, 0]));
  let swapCostDelta = 0;
  for (const piece of equippedPieces(registries, loadout, classId)) {
    const resolvedPiece = resolvedRefs.has(piece.kind === 'armor' ? `armor/${classId}/${piece.id}` : `armament/${piece.id}`);
    for (const raw of piece.mods || []) {
      const mod = parseMod(raw);
      const spec = mod && fields[mod.field];
      if (!spec || spec.scope !== 'run') continue;
      // Resolved gear replaces pool stats; independent swap/status effects remain.
      if (resolvedPiece && EQUIPMENT_POOL_FIELDS.includes(spec.apply)) continue;
      if (EQUIPMENT_POOL_FIELDS.includes(spec.apply)) {
        pools[spec.apply] = mod.mode === 'add' ? pools[spec.apply] + mod.value : mod.value;
      } else if (spec.apply === 'swapCost') {
        swapCostDelta = mod.mode === 'add' ? swapCostDelta + mod.value : mod.value;
      } else if (spec.apply === 'startStatus') {
        const prev = stacks.get(spec.status) || 0;
        stacks.set(spec.status, mod.mode === 'add' ? prev + mod.value : mod.value);
      }
    }
  }
  pools.maxHp += gear.totals.hp; pools.maxMana += gear.totals.mp; pools.maxStamina += gear.totals.sp;
  return {
    ...pools,
    swapCostDelta,
    startStatuses: [...stacks].filter(([, n]) => n > 0).map(([status, n]) => ({ status, stacks: n })),
  };
}

/**
 * Reconcile all run pools after an out-of-combat loadout mutation. The derived
 * snapshot, persisted equipment contribution, and HP adjustment remain the
 * authorities; each current pool keeps its absolute deficit as its vessel
 * grows or shrinks. Partial combat stamping records are deliberately ignored.
 */
export function reconcileRunLoadoutHp(registries, run, { adoptEquipmentBonuses = false } = {}) {
  if (!run || !run.derivedStatRuleSnapshot || !run.derivedStatRuleSnapshot.rules
    || !EQUIPMENT_POOL_FIELDS.every((maxField) => {
      const currentField = maxField === 'maxHp' ? 'hp' : maxField.slice(3).toLowerCase();
      return Number.isFinite(run[maxField]) && Number.isFinite(run[currentField]);
    })) return null;
  if (!Number.isInteger(run.maxHpAdjustment)) {
    throw new Error('reconcileRunLoadoutHp requires integer maxHpAdjustment');
  }
  const classDef = registries.classes.get(run.class);
  const liveMods = runMods(registries, run.loadout, run.class, run);
  const priorBonuses = run.equipmentPoolBonuses || Object.fromEntries(
    EQUIPMENT_POOL_FIELDS.map((field) => [field, liveMods[field]]),
  );
  const bonuses = (adoptEquipmentBonuses || gameModule(run,'gear')?.armorBudget)
    ? Object.fromEntries(EQUIPMENT_POOL_FIELDS.map((field) => [field, liveMods[field]]))
    : priorBonuses;
  const results = {};
  const applyPool = (maxField, currentField, derivedValue, equipmentBonus, nextMax, adjustment = 0) => {
    const was = run[maxField];
    const deficit = moveEquipmentPool(run, maxField, nextMax, run.equipmentPoolDeficits && run.equipmentPoolDeficits[currentField]);
    results[maxField] = { derived: derivedValue, equipmentBonus, adjustment, max: nextMax, deficit, was };
  };

  // Keep this named composition explicit: three independent instruments pin
  // the exact HP addends at creation and load. Mana/Stamina use the same
  // persisted-equipment rule below without weakening that historical witness.
  // The character level rides the derivation (plan phase 6): the snapshot's
  // `perLevel` rows move with it, and a run whose snapshot has none reads 0.
  const level = run.level && Number.isInteger(run.level.level) && run.level.level >= 1 ? run.level.level : 1;
  const expanded = run.combatExpansionVersion === 2;
  const attributes = gameProfileEffectiveAttributes(registries,run,effectiveAshenBlightAttributes(run));
  const staminaPenalty = expanded ? ashenBlightBonuses(run).maxStaminaPenalty : 0;
  const derived = deriveStat(run.derivedStatRuleSnapshot.rules, 'hp', {
    attributes,
    classDef,
    level,
  });
  const equipmentBonus = bonuses.maxHp;
  const nextMax = Math.max(1, derived.value + equipmentBonus + run.maxHpAdjustment);
  applyPool('maxHp', 'hp', derived.value, equipmentBonus, nextMax, run.maxHpAdjustment);
  for (const [maxField, statId] of [['maxMana', 'mana'], ['maxStamina', 'stamina']]) {
    const poolDerived = deriveStat(run.derivedStatRuleSnapshot.rules, statId, {
      attributes,
      classDef,
      level,
    });
    const poolMax = Math.max(0, poolDerived.value + bonuses[maxField] - (statId === 'stamina' ? staminaPenalty : 0));
    applyPool(maxField, statId, poolDerived.value, bonuses[maxField], poolMax);
  }
  run.equipmentPoolBonuses = { ...bonuses };
  if (expanded) {
    run.energyMax = run.maxStamina;
    run.ashenBlightBasePools = Object.fromEntries([['maxHp', 'hp'], ['maxMana', 'mana'], ['maxStamina', 'stamina']].map(([field, stat]) => [field,
      Math.max(field === 'maxHp' ? 1 : 0, deriveStat(run.derivedStatRuleSnapshot.rules, stat, { attributes: run.attributes, classDef, level }).value + bonuses[field] + (field === 'maxHp' ? run.maxHpAdjustment : 0))]));
  }
  run.equipmentPoolDeficits = Object.fromEntries(
    EQUIPMENT_POOL_FIELDS.map((field) => [EQUIPMENT_POOL_CURRENT[field], results[field].deficit]),
  );
  // MAX-HP HOME 3 of 3, and THE LAST WRITER AT RUN CREATION — createRunState
  // ends with stampDeck(), which begins with this call. That is why Sten's
  // planted double-count went green: whatever the earlier writers put in the
  // field, this one replaced it, and nothing recorded the replacement. It still
  // replaces it. It no longer does so silently.
  note(run, {
    kind: 'overwrite',
    field: 'maxHp',
    site: 'loadout.js:reconcileRunLoadoutHp',
    was: results.maxHp.was,
    now: results.maxHp.max,
    why: `max-HP home 3 of 3 and the last writer at the door — derived ${results.maxHp.derived} + equipment ${results.maxHp.equipmentBonus} + adjustment ${run.maxHpAdjustment}; deficit ${results.maxHp.deficit} carried`,
  });
  return {
    derived: results.maxHp.derived,
    equipmentBonus: results.maxHp.equipmentBonus,
    adjustment: run.maxHpAdjustment,
    maxHp: results.maxHp.max,
    deficit: results.maxHp.deficit,
    pools: results,
  };
}
