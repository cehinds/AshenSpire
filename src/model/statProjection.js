// One read model for character stats on every non-combat comparison surface.
// It exposes calculation receipts; screens choose layout, never redo formulas.

import { deriveStat } from './derivedStats.js';
import { equippedPieces, runMods } from './loadout.js';
import { passiveSum } from './registries.js';
import { resolveUpgradedRelic } from './itemUpgrades.js';

// The labels and the order used to be a frozen map right here — a second home
// for a fact the content table should own, and the reason "add a derived stat"
// meant editing this file (D26, Law 0 clause 1). They are READ from
// derivedStatRules.presentation now, which the content door validates row for
// row against the rules themselves. Nothing about a derived stat's name or its
// place in the list lives in src/model any more.
function presentationRows(registries) {
  const table = (registries.derivedStatRules || {}).presentation;
  if (!table) throw new Error('statProjection requires derivedStatRules.presentation');
  return Object.entries(table)
    .map(([id, row]) => ({ id, ...row }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Pure player-Poise threshold projection. Equipment and relics state the
 * threshold; since 2026-08-14 the combat entity STAMPS it as the HUD vessel's
 * max (engine/combat.js — D10.4's skinny bar, D17 q5's "should also effect
 * player too"). That is a DISPLAY consumer only: no combat rule reads it, no
 * writer moves the vessel's value, and Poise damage is still dealt to enemies
 * alone. `active` stays false until a combat rule consumes it — the day the
 * player-poise mechanics land, that flip is theirs to make, with the note.
 */
export function playerPoiseThresholdReceipt(registries, run) {
  if (!run || !run.loadout) throw new Error('playerPoiseThresholdReceipt requires a run loadout');
  const levels = run.itemUpgradeLevels || {};
  const pieces = equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: levels });
  const pieceSources = pieces.map((piece) => ({
    kind: 'equipment',
    id: piece.id,
    classId: piece.kind === 'armor' ? piece.classId : null,
    value: piece.poiseThreshold,
  }));
  const relicSources = (run.relics || [])
    .map((id) => resolveUpgradedRelic(registries, `relic/${id}`, levels[`relic/${id}`] || 0))
    .filter((relic) => relic.passives && Number.isFinite(relic.passives.poiseThresholdAdd))
    .map((relic) => ({ kind: 'relic', id: relic.id, value: relic.passives.poiseThresholdAdd }));
  const equipment = pieceSources.reduce((sum, source) => sum + source.value, 0);
  const relic = passiveSum(registries, run.relics || [], 'poiseThresholdAdd', levels);
  const raw = equipment + relic;
  return {
    id: 'poiseThreshold',
    label: 'Poise threshold',
    sources: [...pieceSources, ...relicSources],
    equipment,
    relic,
    raw,
    value: raw,
    active: false,
    note: 'Display consumer only: the combat entity stamps this as the HUD vessel\'s max. No combat consumer — Poise damage is not dealt to players. Player Poise is not the enemy Poise meter.',
  };
}

/**
 * Pure equip-load projection (framework contract: Weight Class). The
 * DECISION — capacity, load percent, class row and word — is the framework's
 * (bridge.weightClass over framework/weight.js and mechanics.json). This
 * model owns only WHICH weights count:
 *   - armaments: the authored `weight` column (weapons.csv; bound to the
 *     authored poiseThreshold by armamentIntrinsicStatProblems)
 *   - armour: no weight column is authored. This branch adopts the same
 *     identity for armour — weight = poiseThreshold — as the A-SIDE of the
 *     Weight Class A/B (docs/framework-migration-checklist.md §C). The
 *     B-side treats armour as weightless.
 *   - talismans/relics: nothing authored; 0.
 * `active` stays false until a combat rule consumes the class (the dodge
 * roll) — today this is a readout on the Armoury, and nothing else.
 */
export const ARMOUR_WEIGHT_RULE = 'poiseThreshold';

/**
 * The weight ONE piece contributes to the equip load — the single home of the
 * rule, so the Armoury's item card and the load total can never disagree:
 * armour weighs its poise threshold (the A-side rule above), an armament its
 * authored weight, anything else nothing.
 */
export function pieceWeight(piece) {
  if (!piece) return 0;
  if (piece.kind === 'armor') return ARMOUR_WEIGHT_RULE === 'poiseThreshold' ? (piece.poiseThreshold || 0) : 0;
  return Number.isInteger(piece.weight) ? piece.weight : 0;
}

export function playerLoadReceipt(registries, run, { capacityBonus = 0 } = {}) {
  if (!run || !run.loadout) throw new Error('playerLoadReceipt requires a run loadout');
  if (!run.attributes) throw new Error('playerLoadReceipt requires run attributes');
  const levels = run.itemUpgradeLevels || {};
  const pieces = equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: levels });
  const sources = pieces.map((piece) => ({
    kind: 'equipment',
    id: piece.id,
    classId: piece.kind === 'armor' ? piece.classId : null,
    value: pieceWeight(piece),
  }));
  const armour = sources.filter((s) => s.classId != null).reduce((sum, s) => sum + s.value, 0);
  const hands = sources.filter((s) => s.classId == null).reduce((sum, s) => sum + s.value, 0);
  const decided = registries.framework.weightClass({
    attributes: run.attributes,
    bonuses: capacityBonus,
    weights: { mainHandWeight: hands, offHandWeight: 0, armorWeight: armour, otherCountedWeight: 0 },
  });
  return {
    id: 'equipLoad',
    label: 'Equip load',
    sources,
    hands,
    armour,
    load: decided.load,
    capacity: decided.capacity,
    percent: decided.percent,
    classId: decided.weightClass.id,
    word: decided.word,
    active: false,
    note: `Capacity ${decided.capacity} = base + Constitution and Strength; ${decided.percent}% loaded — ${decided.word}. Readout only until the dodge roll consumes the class.`,
  };
}

export function statProjection(registries, run) {
  const snapshot = run && run.derivedStatRuleSnapshot;
  if (!snapshot || !snapshot.rules) throw new Error('statProjection requires a run with a derived-stat rules snapshot');
  const classDef = registries.classes.get(run.class);
  const attributes = registries.attributes.all()
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((def) => ({ ...def, value: run.attributes[def.id] }));
  const derived = presentationRows(registries).map((presentation) => {
    const id = presentation.id;
    const receipt = deriveStat(snapshot.rules, id, { attributes: run.attributes, classDef });
    const equipmentBonus = id === 'hp' ? runMods(registries, run.loadout, run.class).maxHp : 0;
    const adjustment = id === 'hp' ? (run.maxHpAdjustment || 0) : 0;
    const value = id === 'hp' ? Math.max(1, receipt.value + equipmentBonus + adjustment) : receipt.value;
    return {
      ...receipt,
      label: presentation.label,
      // The short-form fields travel WITH the projection so no surface has to
      // go and fetch a second table to know how a row reads (D26).
      faceLabel: presentation.faceLabel || presentation.label,
      disclosure: presentation.disclosure,
      sense: presentation.sense,
      order: presentation.order,
      value,
      equipmentBonus,
      adjustment,
      formula: `${receipt.base} + ${receipt.tier} tier × ${receipt.gainPerTier}`
        + `${equipmentBonus ? ` + ${equipmentBonus} gear` : ''}`
        + `${adjustment ? ` ${adjustment > 0 ? '+' : '-'} ${Math.abs(adjustment)} permanent` : ''} = ${value}`,
      note: id === 'stamina' ? 'No current consumer' : id === 'draw' ? 'The current engine uses this for turn 1 and every later turn.' : '',
    };
  });
  return { classId: run.class, rulesetVersion: snapshot.rulesetVersion, attributes, derived };
}
