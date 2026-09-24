// One read model for character stats on every non-combat comparison surface.
// It exposes calculation receipts; screens choose layout, never redo formulas.

import { deriveStat, deriveStatIncrease, isStatRowRuleset, levelBonus, resolvedRuleRow, ruleWeights } from './derivedStats.js';

const RATING_ONLY = new Set(['ar', 'dr', 'pr', 'ward']);
import { equippedPieces, runMods } from './loadout.js';
import { passiveSum } from './registries.js';
import { resolveUpgradedRelic } from './itemUpgrades.js';
import { ratingReceipt } from './combatRatings.js';
import { ratingsConfigFor, statRow } from './statRows.js';
import { mechanics } from '../framework/data/mechanics.js';

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
// Phase 8's player Poise: Constitution × balance.poise.playerPerConstitution,
// shipped as 1. The rule a run born before derived-stat ruleset 5 keeps,
// written in ruleset 6's words: one Poise per point of Constitution.
const LEGACY_PLAYER_POISE_RULE = Object.freeze({ base: 0, constitution: 1, perLevel: 0 });

export function playerPoiseThresholdReceipt(registries, run) {
  if (!run || !run.loadout) throw new Error('playerPoiseThresholdReceipt requires a run loadout');
  if (registries.balance?.combatRatings?.enabled) {
    const receipt = ratingReceipt(registries, run, ratingsConfigFor(registries, run));
    return { id: 'poiseThreshold', label: 'Poise & Ward', value: receipt.totals.poise,
      raw: receipt.totals.poise, active: true, attribute: receipt.sources[0].poise,
      equipment: receipt.totals.poise - receipt.sources[0].poise, relic: 0, sources: [],
      ratings: receipt.totals, ratingSources: receipt.sources, ratingAttributes: receipt.attributeReceipts,
      note: 'Poise resists physical attacks and stagger. Ward resists magical attacks and disruption. Status resistance follows each effect’s configured weights.' };
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
  // forbids.
  // THE RUN'S OWN SNAPSHOT IS THE AUTHORITY, and the live table only the
  // fallback for a caller that carries no snapshot at all (a headless
  // fixture, a creation preview). A run born under an Advanced tier-size
  // override records that override in its snapshot, and reading the authored
  // row instead would price its meter by numbers that run never agreed to
  // (Codex, #1217).
  // ONE EVALUATOR, NOT A SECOND COPY OF THE FORMULA. The snapshot's row is
  // ruleset-6 shaped whatever table the run was born under (model/
  // derivedStats.js normalizes at the door), so the Poise vessel is priced by
  // the same arithmetic every other row is — weights included, which is what
  // lets the row answer to more than Constitution the day it is authored to.
  // A SNAPSHOT WITHOUT THE ROW IS AN ANSWER, NOT A GAP. Poise joined the
  // derived table in ruleset 5; a run born under 1–4 was priced by phase 8's
  // `balance.poise.playerPerConstitution`, which shipped as 1 — Constitution
  // one-for-one. That coefficient is frozen here as the rule such a run was
  // born under, so its meter neither loses the Constitution term nor follows
  // the live row when that row is retuned (review, #1217 and #1255).
  const ownSnapshot = run.derivedStatRuleSnapshot?.rules;
  const poiseRule = ownSnapshot?.rules
    ? resolvedRuleRow(ownSnapshot, 'poise') || LEGACY_PLAYER_POISE_RULE
    : statRow(registries, run, 'poise');
  // A run handed without attributes (a headless fixture) has no attribute term,
  // so every attribute the row names reads 0 rather than refusing the fixture.
  const poiseAttributes = Object.fromEntries(ruleWeights(poiseRule || {})
    .map(([id]) => [id, Number.isFinite(run.attributes?.[id]) ? run.attributes[id] : 0]));
  // THE LEVEL TERM TOO, or "Poise pool — Per level" would move the number on
  // the sheet (statProjection below prices every row at the run's level) while
  // the meter this receipt stamps stayed at level 1 (Codex, #1253).
  const level = Number.isInteger(run.level?.level) && run.level.level >= 1 ? run.level.level : 1;
  const attribute = poiseRule
    ? (Number.isFinite(poiseRule.base) ? poiseRule.base : 0)
      + deriveStatIncrease(poiseRule, { attributes: poiseAttributes, statId: 'poise' }).value
      + levelBonus(poiseRule, level)
    : 0;
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
      // THE ATTRIBUTES THE ROW ACTUALLY ANSWERS TO. This named Constitution
      // outright while a row could only have one source stat; since ruleset 6
      // it may be weighted across several, and a receipt that names the wrong
      // one is worse than a receipt that names none.
      ...(attribute > 0 ? [{ kind: 'attribute', id: ruleWeights(poiseRule || {}).map(([id]) => id).join('+') || 'attributes', value: attribute }] : []),
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
  const authored = piece.kind === 'armor'
    ? (ARMOUR_WEIGHT_RULE === 'poiseThreshold' ? (piece.poiseThreshold || 0) : 0)
    : (Number.isInteger(piece.weight) ? piece.weight : 0);
  // Authored weights are on the pre-lean attribute scale; capacity is not.
  // One data knob (mechanics.weight.itemWeightScale) rescales every piece, to
  // a tenth, so load and capacity are measured in the same units.
  return Math.round(authored * mechanics.weight.itemWeightScale * 10) / 10;
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
  const tenth = (n) => Math.round(n * 10) / 10;
  const armour = tenth(sources.filter((s) => s.classId != null).reduce((sum, s) => sum + s.value, 0));
  const hands = tenth(sources.filter((s) => s.classId == null).reduce((sum, s) => sum + s.value, 0));
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
  // THE COMBAT RATINGS ARE NOT PROJECTED HERE. They are rows of the same
  // table (ruleset 7), but a rating is only its attribute part until armour,
  // weapons and relics are added, and `ratingReceipt` — which reads these
  // same rows — is the surface that shows the whole of it.
  const derived = presentationRows(registries).filter((presentation) => (
    !RATING_ONLY.has(presentation.id)
    && snapshot.rules && snapshot.rules.rules && Object.hasOwn(snapshot.rules.rules, presentation.id)
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
      // THE ONE FORMAT, READ BACK: base, then each attribute's own floored
      // term by its short label ("30 + 12 CON"), exactly as a rating receipt
      // reads. A run born under ruleset 5 or earlier still carries a tier and
      // its gain (model/derivedStats.js), and is shown the way it is priced.
      formula: `${receipt.base} + ${receipt.pointsPerIncrease === 1 && receipt.gain === 1
        ? (Object.entries(receipt.terms).map(([attrId, term]) => `${term} ${registries.attributes.get(attrId)?.shortLabel || attrId}`).join(' + ') || '0')
        : `${receipt.tier} × ${receipt.gain}`}`
        + `${receipt.levelBonus ? ` + ${receipt.levelBonus} level` : ''}`
        + `${equipmentBonus ? ` + ${equipmentBonus} gear` : ''}`
        + `${adjustment ? ` ${adjustment > 0 ? '+' : '-'} ${Math.abs(adjustment)} permanent` : ''}`
        + `${receipt.raw !== receipt.value ? `, held to ${receipt.value === receipt.min ? `at least ${receipt.min}` : `at most ${receipt.value}`}` : ''} = ${value}`,
      note: id === 'stamina' ? 'Spent by cards that ask for it (the dodge roll among them); an idle turn recovers some.' : id === 'draw' && !isStatRowRuleset(snapshot.rulesetVersion) ? 'This run was born before the hand rows: solo fights draw by its hand rules, co-op by this value.' : '',
    };
  });
  return { classId: run.class, rulesetVersion: snapshot.rulesetVersion, attributes, derived };
}
