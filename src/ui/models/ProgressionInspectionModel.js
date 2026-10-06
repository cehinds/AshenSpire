import { t } from '../strings.js';
import { statRowValue } from '../../model/derivedStats.js';
import { statProjection, handResourceRows } from '../../model/statProjection.js';
import { ratingReceipt } from '../../model/combatRatings.js';
import { ratingsConfigFor, statRow } from '../../model/statRows.js';
import { runHandRules, handSizeReceipts } from '../../model/handRules.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { skillSchools, trackSkillFeats, skillFeatById } from '../../model/skills.js';
import { featById, featStacks } from '../../model/feats.js';

/** Presentation only: all values retain the run's own calculation receipts. */
export function progressionStats(registries, run, settings = {}) {
  const projection = statProjection(registries, run);
  const ratings = ratingReceipt(registries, run, ratingsConfigFor(registries, run, registries.balance?.combatRatings || {}));
  const hand = runHandRules(registries, run, settings);
  const handReceipts = handSizeReceipts(hand, run.attributes, run.level?.level);
  const resources = handResourceRows(registries, run, settings);
  const derived = (id, label) => ({ ...projection.derived.find(row => row.id === id), faceLabel: label });
  const rows = [derived('hp', 'HP'), derived('stamina', 'SP'), derived('mana', 'MP'),
    ...['ar', 'pr', 'dr'].map(id => ({ id, label: id.toUpperCase(), faceLabel: id.toUpperCase(), value: ratings.totals[id],
      formula: ratings.sources.map(source => `${source.name}: ${source[id] || 0}`).join(' + ') })),
    { id: 'handSize', label: t('statsPreview.overview.handSize'), faceLabel: 'HandSize', value: handReceipts.capacity.value,
      formula: `Maximum cards held: ${handReceipts.capacity.value}` },
    { ...resources.find(row => row.id === 'draw'), faceLabel: 'Draw' }];
  const attributes = attributeCardModels(registries, run.attributes, {
    projection, equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles, hand,
  });
  // Compare against the same formula with this attribute at zero. This also
  // respects retired pooled rounding, configured gain, and shared caps.
  for (const attr of attributes) {
    const without = { ...run.attributes, [attr.id]: 0 };
    const lesserHand = handSizeReceipts(hand, without, run.level?.level);
    const contributions = [];
    for (const row of [...rows, { id: 'poise', faceLabel: t('statsPreview.overview.poise') }, { id: 'ward', faceLabel: 'Ward' }]) {
      const rule = statRow(registries, run, row.id, { settings });
      if (!rule || !rule[attr.id]) continue;
      const value = attributes => statRowValue(rule, { attributes, classDef: registries.classes.get(run.class), level: run.level?.level, statId: row.id }).value;
      const contribution = row.id === 'draw' ? handReceipts.turn.value - lesserHand.turn.value
        : row.id === 'handSize' ? handReceipts.capacity.value - lesserHand.capacity.value
        : value(run.attributes) - value(without);
      contributions.push(`${row.faceLabel}: ${contribution >= 0 ? '+' : ''}${contribution}`);
    }
    attr.face = { ...attr.face, compact: true, summary: contributions.join(' · ') || t('progression.noBonus') };
    attr.tooltip = `Expand ${attr.reveal.title} for bonuses and scaling.`;
  }
  return { rows, attributes, projection };
}

export function featInspection(registries, run, id) {
  const feat = featById(id) || skillFeatById(id);
  if (!feat) return null;
  const tags = [...new Set([...(feat.tags || []), ...(feat.crit?.tags || []), ...(feat.passive?.tags || [])])];
  return { ...feat, tags, owned: featStacks(run, id) || (run.skillFeats || []).filter(owned => owned === id).length };
}

export function ownedFeatInspections(registries, run) {
  return [...new Set([...(run.feats || []), ...(run.skillFeats || [])])]
    .map(id => featInspection(registries, run, id)).filter(Boolean);
}

export function skillInspection(registries, run, track) {
  const cls = registries.classes.get(run.class);
  const tags = skillSchools(registries, run.loadout, track.id);
  const pool = (cls?.cardPool || []).map(id => registries.cards.get(id));
  const cards = track.kind === 'class' ? pool : pool.filter(card => (card.tags || []).some(tag => tags.includes(tag)));
  const feats = trackSkillFeats(track.id, !!run.classMasteryState)
    .map(feat => featInspection(registries, run, feat.id)).filter(Boolean);
  const tagIds = track.kind === 'class' ? [...new Set(cards.flatMap(card => card.tags || []))] : tags;
  return { cards, feats, tags: tagIds, requiresEquipment: ['weapon', 'focus', 'dual'].includes(track.kind) && !tags.length };
}
