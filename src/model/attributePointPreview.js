// src/model/attributePointPreview.js — what ONE more point of an attribute buys.
//
// Owner, 2026-10-31: "when leveling up stats, a short list of the largest
// increase to a stat should be shown, e.g. STR +1 AR, DEX +1 DR, CON +10 HP,
// WIS +1 Perception, INT +1 PR". Nothing here is a table of numbers: every gain
// is the live formula run twice, at the attribute's current value and one
// higher, the way ProgressionInspectionModel compares an attribute with itself
// at zero. The rows are the run's own stat rows (`statRow` / `statRowValue`),
// plus the three FixCore numbers that are not stat rows: Evasion and Precision
// are read through the combat engine's own functions on a throwaway entity, and
// Perception's roll bonus is the observer's Wisdom (rollKnowledgeRead).
import { statRowValue } from './derivedStats.js';
import { statRow } from './statRows.js';
import { fixCoreEnabled, fixCoreWardDisabled } from './fixCoreMechanics.js';
import { effectiveEvasion, precisionStatMix } from '../engine/stanceHit.js';
import { configuredCombat, profileHandSize } from '../engine/gameProfileCombat.js';
import { effectiveAshenBlightAttributes } from './ashenBlight.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';
import { runHandRules, handSizeReceipts } from './handRules.js';
import { t } from '../ui/strings.js';

/** Pool stats are compared by delta / POOL_SCALE against rating stats by delta, so +10 HP ties +1 Poise. */
export const POOL_SCALE = 10;
const POOLS = new Set(['hp', 'mana', 'stamina']);
// Tie-break order, best first. It only decides exact score ties, e.g. CON in Core 2 (+10 HP and +1 Poise both score 1, HP first).
// WIS reads "+1 Perception" on magnitude, not order: +1 MP scores 0.1 after the pool scale, +1 Perception scores 1.
export const GAIN_ORDER = Object.freeze(['hp', 'perception', 'mana', 'stamina', 'energy', 'ar', 'dr', 'pr', 'draw', 'openingHand', 'handSize', 'poise', 'ward', 'evasion', 'precision']);
const ROW_IDS = Object.freeze(['hp', 'stamina', 'energy', 'mana', 'ar', 'pr', 'dr', 'poise', 'ward']);
const LABEL_KEYS = Object.freeze({
  energy: 'progression.gain.label.energy', hp: 'progression.gain.label.hp', mana: 'progression.gain.label.mana', stamina: 'progression.gain.label.stamina',
  ar: 'progression.gain.label.ar', dr: 'progression.gain.label.dr', pr: 'progression.gain.label.pr',
  openingHand: 'progression.gain.label.openingHand', handSize: 'progression.gain.label.handSize', draw: 'progression.gain.label.draw', poise: 'progression.gain.label.poise',
  evasion: 'progression.gain.label.evasion', precision: 'progression.gain.label.precision',
  perception: 'progression.gain.label.perception',
});
const round = (n) => Math.round(n * 100) / 100;

function previewContext(registries, run, attributes) {
  const entity = { id: 'player', kind: 'player', attributes, level: run.level, classId: run.class };
  const ctx = {
    registries, player: entity, loadout: run.loadout, attributes, characterLevel: run.level?.level,
    combatExpansionVersion: run.combatExpansionVersion, gameProfile: run.gameProfile || registries.gameProfile,
  };
  return { ctx, entity };
}

/** attributePointGains(registries, run, attributeId, { settings }) → [{ statId, label, before, after, delta, text }] for +1 of that attribute. */
export function attributePointGains(registries, run, attributeId, { settings = {} } = {}) {
  // The same transforms rederivePools (model/levelup.js) applies before pricing a
  // pool: a constant blight or gear bonus moves which floored point crosses a threshold.
  const effective = (attributes) => { const probe = { ...run, attributes, allocatedAttributes: undefined }; return gameProfileEffectiveAttributes(registries, probe, effectiveAshenBlightAttributes(probe)); };
  const rawNow = { ...run.attributes };
  const current = effective(rawNow);
  const raised = effective({ ...rawNow, [attributeId]: (Number(rawNow[attributeId]) || 0) + 1 });
  const level = run.level?.level;
  const classDef = registries.classes?.get?.(run.class);
  const gains = [];
  const push = (statId, before, after) => {
    const delta = round(after - before);
    if (!delta) return;
    // Ward's word is the stat table's own presentation label (no second copy of it in uiStrings).
    const label = LABEL_KEYS[statId] ? t(LABEL_KEYS[statId]) : registries.derivedStatRules?.presentation?.[statId]?.label || statId;
    gains.push({ statId, label, before: round(before), after: round(after), delta,
      text: t('progression.gain.item', { amount: `${delta > 0 ? '+' : ''}${delta}`, label }) });
  };
  const { ctx, entity } = previewContext(registries, run, current);
  const fixCore = fixCoreEnabled(ctx);
  for (const statId of ROW_IDS) {
    if (statId === 'ward' && fixCoreWardDisabled(ctx)) continue;
    // Under combatExpansionVersion 2 energy is stamina (rederivePools skips it); only a legacy run has its own pool.
    if (statId === 'energy' && run.combatExpansionVersion === 2) continue;
    const rule = statRow(registries, run, statId, { settings });
    if (!rule || !rule[attributeId]) continue;
    const value = (attributes) => statRowValue(rule, { attributes, classDef, level, statId, lenientAttributes: true }).value;
    push(statId, value(current), value(raised));
  }
  const after = previewContext(registries, run, raised);
  if (configuredCombat(ctx)) {
    // A configured (Core 2) fight deals handBase + INT for the opening hand, every turn draw and the capacity
    // (turnDrawCount -> profileHandSize); the hand rows below are not read. Call the engine's own function.
    const dealt = [profileHandSize(ctx), profileHandSize(after.ctx)];
    for (const statId of ['draw', 'openingHand', 'handSize']) push(statId, dealt[0], dealt[1]);
  } else {
    // THE HAND IS WHAT IS DEALT, NOT WHAT THE ROWS SAY: handDrawCount caps the opening hand and the turn draw
    // at hand capacity (and fill mode draws up to capacity), so these three go through the same receipts
    // the fight reads, before and after, and show only cards the player will actually receive.
    const hand = runHandRules(registries, run, settings);
    const handBefore = handSizeReceipts(hand, current, level), handAfter = handSizeReceipts(hand, raised, level);
    push('draw', handBefore.turn.value, handAfter.turn.value);
    push('openingHand', handBefore.opening.value, handAfter.opening.value);
    push('handSize', handBefore.capacity.value, handAfter.capacity.value);
  }
  push('evasion', effectiveEvasion(ctx, entity), effectiveEvasion(after.ctx, after.entity));
  if (fixCore) {
    push('precision', precisionStatMix(ctx, entity), precisionStatMix(after.ctx, after.entity));
    // rollKnowledgeRead: the observer rolls d20 + own Wisdom, so a point of Wisdom is a point of Perception.
    // (push skips a zero delta, so only the +1 that raises Wisdom shows.)
    push('perception', Number(current.wisdom) || 0, Number(raised.wisdom) || 0);
  }
  return gains;
}

const score = (gain) => Math.abs(gain.delta) / (POOLS.has(gain.statId) ? POOL_SCALE : 1);
const rank = (statId) => { const i = GAIN_ORDER.indexOf(statId); return i < 0 ? GAIN_ORDER.length : i; };

/** The gains, largest first (pools weighed at delta / 10; ties by GAIN_ORDER). */
export function sortedAttributeGains(gains) {
  return [...gains].sort((a, b) => score(b) - score(a) || rank(a.statId) - rank(b.statId));
}

/** largestAttributeGain(registries, run, attributeId, { settings }) → the single biggest gain row, or null. */
export function largestAttributeGain(registries, run, attributeId, options = {}) {
  return sortedAttributeGains(attributePointGains(registries, run, attributeId, options))[0] || null;
}

/** "+10 HP, +1 Poise, +0.5 SP" — every gain, largest first, for a title or tooltip. */
export function attributeGainSummary(gains) {
  return t('progression.gain.summary', { list: sortedAttributeGains(gains).map((gain) => gain.text).join(', ') });
}
