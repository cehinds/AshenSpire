// One read model for character stats on every non-combat comparison surface.
// It exposes calculation receipts; screens choose layout, never redo formulas.

import { deriveStat } from './derivedStats.js';
import { equippedPieces, runMods } from './loadout.js';
import { passiveSum } from './registries.js';
import { resolveUpgradedRelic } from './itemUpgrades.js';
import { ratingReceipt } from './combatRatings.js';

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
  if (registries.balance?.combatRatings?.enabled) {
    const receipt = ratingReceipt(registries, run, registries.balance.combatRatings);
    const layeredDefence = (registries.balance.combatRatings.version ?? 1) >= 2;
    return { id: 'poiseThreshold', label: 'Poise & Ward', value: receipt.totals.poise,
      raw: receipt.totals.poise, active: true, attribute: receipt.sources[0].poise,
      equipment: receipt.totals.poise - receipt.sources[0].poise, relic: 0, sources: [],
      ratings: receipt.totals, ratingSources: receipt.sources, ratingAttributes: receipt.attributeReceipts,
      note: layeredDefence
        ? 'Defence subtracts flat damage first. Poise then reduces every hit and stagger; Ward adds magical-only reduction and resists disruption. Status resistance follows each effect’s configured weights.'
        : 'Poise resists physical attacks and stagger. Ward resists magical attacks and disruption. Status resistance follows each effect’s configured weights.' };
  }
  const levels = run.itemUpgradeLevels || {};
  // THE VESSEL'S THREE SOURCES (plan phase 8, proposal §7.3): the derived
  // Poise row read against Constitution, the worn BODY ARMOUR's threshold (a
  // weapon's poiseThreshold is its weight, not the wearer's footing), and the
  // relics' poiseThresholdAdd. A run handed without attributes (a headless
  // fixture) has no attribute term.
  // THE COEFFICIENT HAS ONE HOME, AND SINCE RULESET 5 IT IS THE DERIVED-STAT
  // TABLE (plan phase 9). Phase 8 kept it in balance because the rebase had
  // not been written yet; reading it from two places would be the copy Law 1
  // forbids. A run whose own snapshot predates the row falls through to the
  // live table, which is what a headless fixture and a creation preview need;
  // a run that HAS the row is priced by its own, below.
  // THE RUN'S OWN SNAPSHOT IS THE AUTHORITY, and the live table only the
  // fallback for a caller that carries no run (a headless fixture, a
  // creation preview). A run born under an Advanced tier-size override
  // records that override in its snapshot, and reading the authored row
  // instead would price its meter by numbers that run never agreed to
  // (Codex, #1217).
  const poiseRule = run.derivedStatRuleSnapshot?.rules?.rules?.poise
    || registries.derivedStatRules?.rules?.poise;
  const perTier = Number.isFinite(poiseRule?.pointsPerTier) ? poiseRule.pointsPerTier
    : (Number.isFinite(registries.derivedStatRules?.defaults?.pointsPerTier) ? registries.derivedStatRules.defaults.pointsPerTier : 1);
  const gain = Number.isFinite(poiseRule?.gainPerTier) ? poiseRule.gainPerTier : 0;
  const poiseBase = Number.isFinite(poiseRule?.base) ? poiseRule.base : 0;
  const con = run.attributes && Number.isFinite(run.attributes.constitution) ? run.attributes.constitution : 0;
  const attribute = poiseRule ? poiseBase + Math.floor(con / (perTier || 1)) * gain : 0;
  const pieces = equippedPieces(registries, run.loadout, run.class, { itemUpgradeLevels: levels }).filter((piece) => piece.kind === 'armor');
  const pieceSources = pieces.map((piece) => ({
    kind: 'equipment',
    id: piece.id,
    classId: piece.classId,
    value: piece.poiseThreshold,
  }));
  const relicSources = (run.relics || [])
    .map((id) => resolveUpgradedRelic(registries, `relic/${id}`, levels[`relic/${id}`] || 0))
    .filter((relic) => relic.passives && Number.isFinite(relic.passives.poiseThresholdAdd))
    .map((relic) => ({ kind: 'relic', id: relic.id, value: relic.passives.poiseThresholdAdd }));
  const equipment = pieceSources.reduce((sum, source) => sum + source.value, 0);
  const relic = passiveSum(registries, run.relics || [], 'poiseThresholdAdd', levels);
  const raw = attribute + equipment + relic;
  return {
    id: 'poiseThreshold',
    label: 'Poise threshold',
    sources: [
      ...(attribute > 0 ? [{ kind: 'attribute', id: 'constitution', value: attribute }] : []),
      ...pieceSources, ...relicSources,
    ],
    attribute,
    equipment,
    relic,
    raw,
    value: raw,
    active: true,
    note: 'The combat entity stamps this as the player Poise meter\'s max; impact fills it and a fill Staggers the player (SPEC §13.4k). Player Poise is not the enemy Poise meter.',
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
 * `active` is true when the composed deck holds a dodge roll — the rule that
 * consumes the class (its check and the pure dodge's price); otherwise the
 * Armoury shows the readout and says so.
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
  // The class is CONSUMED the moment the composed deck holds a dodge roll
  // (the unarmed package's Evasive Guard / Dodge Roll, or any card authored
  // with the opcode): the roll's check and the pure dodge's price read it.
  const active = (run.deck || []).some((card) => {
    const def = card && registries.cards.has(card.cardId) ? registries.cards.get(card.cardId) : null;
    return !!def && (def.effects || []).some((eff) => eff.op === 'dodgeRoll');
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
    active,
    note: `Capacity ${decided.capacity} = base + Constitution and Strength; ${decided.percent}% loaded — ${decided.word}. `
      + (active ? 'Your dodge roll is checked and priced by this class.' : 'Readout only until a dodge roll enters your deck.'),
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
  // A ROW THE RUN'S SNAPSHOT NEVER HAD IS NOT PROJECTED. The presentation
  // table is the LIVE one and grows with the content — Poise joined it in
  // ruleset 5 (plan phase 9) — while a run keeps the rules it was born
  // under. Asking a version-3 snapshot for a Poise receipt threw by name and
  // took every stat surface down with it (Codex, #1217). The pairing the
  // content door enforces is between the live table's halves; across a
  // version boundary the snapshot decides.
  const derived = presentationRows(registries).filter((presentation) => (
    snapshot.rules && snapshot.rules.rules && Object.hasOwn(snapshot.rules.rules, presentation.id)
  )).map((presentation) => {
    const id = presentation.id;
    const receipt = deriveStat(snapshot.rules, id, { attributes: run.attributes, classDef, level: run.level && Number.isInteger(run.level.level) ? run.level.level : 1 });
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
      // Every term the value has, so the arithmetic shown equals the result
      // shown: the level's own term (plan phase 6) joins once it is non-zero.
      formula: `${receipt.base} + ${receipt.tier} tier × ${receipt.gainPerTier}`
        + `${receipt.levelBonus ? ` + ${receipt.levelBonus} level` : ''}`
        + `${equipmentBonus ? ` + ${equipmentBonus} gear` : ''}`
        + `${adjustment ? ` ${adjustment > 0 ? '+' : '-'} ${Math.abs(adjustment)} permanent` : ''} = ${value}`,
      note: id === 'stamina' ? 'Spent by cards that ask for it (the dodge roll among them); an idle turn recovers some.' : id === 'draw' ? 'Legacy draw value for LAN and older saved fights. New solo fights use Advanced → Stats → Draw & hand.' : '',
    };
  });
  return { classId: run.class, rulesetVersion: snapshot.rulesetVersion, attributes, derived };
}
