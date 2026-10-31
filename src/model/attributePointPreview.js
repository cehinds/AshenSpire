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
import { effectiveAshenBlightAttributes } from './ashenBlight.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';
import { t } from '../ui/strings.js';

/** Pool stats are compared by delta / POOL_SCALE against rating stats by delta, so +10 HP ties +1 Poise. */
export const POOL_SCALE = 10;
const POOLS = new Set(['hp', 'mana', 'stamina']);
// Tie-break order, best first (owner: Perception ahead of MP so WIS reads "+1 Perception").
export const GAIN_ORDER = Object.freeze(['hp', 'perception', 'mana', 'stamina', 'ar', 'dr', 'pr', 'draw', 'handSize', 'poise', 'ward', 'evasion', 'precision']);
const ROW_IDS = Object.freeze(['hp', 'stamina', 'mana', 'ar', 'pr', 'dr', 'handSize', 'draw', 'poise', 'ward']);
const LABEL_KEYS = Object.freeze({
  hp: 'progression.gain.label.hp', mana: 'progression.gain.label.mana', stamina: 'progression.gain.label.stamina',
  ar: 'progression.gain.label.ar', dr: 'progression.gain.label.dr', pr: 'progression.gain.label.pr',
  handSize: 'progression.gain.label.handSize', draw: 'progression.gain.label.draw', poise: 'progression.gain.label.poise',
  ward: 'progression.gain.label.ward', evasion: 'progression.gain.label.evasion', precision: 'progression.gain.label.precision',
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
    const label = t(LABEL_KEYS[statId]);
    gains.push({ statId, label, before: round(before), after: round(after), delta,
      text: t('progression.gain.item', { amount: `${delta > 0 ? '+' : ''}${delta}`, label }) });
  };
  const { ctx, entity } = previewContext(registries, run, current);
  const fixCore = fixCoreEnabled(ctx);
  for (const statId of ROW_IDS) {
    if (statId === 'ward' && fixCoreWardDisabled(ctx)) continue;
    const rule = statRow(registries, run, statId, { settings });
    if (!rule || !rule[attributeId]) continue;
    const value = (attributes) => statRowValue(rule, { attributes, classDef, level, statId, lenientAttributes: true }).value;
    push(statId, value(current), value(raised));
  }
  const after = previewContext(registries, run, raised);
  push('evasion', effectiveEvasion(ctx, entity), effectiveEvasion(after.ctx, after.entity));
  if (fixCore) {
    push('precision', precisionStatMix(ctx, entity), precisionStatMix(after.ctx, after.entity));
    // rollKnowledgeRead: the observer rolls d20 + own Wisdom, so a point of Wisdom is a point of Perception.
    if (attributeId === 'wisdom') push('perception', Number(current.wisdom) || 0, Number(raised.wisdom) || 0);
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
