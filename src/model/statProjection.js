// One read model for character stats on every non-combat comparison surface.
// It exposes calculation receipts; screens choose layout, never redo formulas.

import { deriveStat } from './derivedStats.js';
import { equippedPieces, runMods } from './loadout.js';
import { passiveSum } from './registries.js';

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
  const pieces = equippedPieces(registries, run.loadout, run.class);
  const pieceSources = pieces.map((piece) => ({
    kind: 'equipment',
    id: piece.id,
    classId: piece.kind === 'armor' ? piece.classId : null,
    value: piece.poiseThreshold,
  }));
  const relicSources = (run.relics || [])
    .map((id) => registries.relics.get(id))
    .filter((relic) => relic.passives && Number.isFinite(relic.passives.poiseThresholdAdd))
    .map((relic) => ({ kind: 'relic', id: relic.id, value: relic.passives.poiseThresholdAdd }));
  const equipment = pieceSources.reduce((sum, source) => sum + source.value, 0);
  const relic = passiveSum(registries, run.relics || [], 'poiseThresholdAdd');
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
