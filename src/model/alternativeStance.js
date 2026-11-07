import { cardPreparationCategory } from './cardClassification.js';
import { combatProfileFor } from './combatCardProfile.js';

export const STANCE_FAMILIES = Object.freeze(['offensive', 'defensive', 'casting']);
const defensive = new Set(['defend', 'defending']);
const offensive = new Set(['attack', 'smash', 'sweep', 'ranged', 'attacking', 'smashing', 'sweeping']);

function withTagIds(card = {}) {
  card ??= {};
  const resolvedTags = card.cardTags ?? card.tags;
  return resolvedTags ? { ...card, cardTags: resolvedTags.map(tag => typeof tag === 'string' ? tag : tag.id) } : card;
}

/** The player's authored action profile (maneuver and camp) for a confirmed card. */
export function kindForCard(card = {}) {
  card = withTagIds(card);
  const profile = combatProfileFor(card);
  // The glyph follows the figure's stance, so the two always agree: a spell with
  // an offensive maneuver is held as casting and shows prepare, and an untagged
  // attack or block card takes the figure's fallback.
  const stance = stanceForCard(card);
  // Casting (prepare) carries no maneuver: the glyph's own fallback is prepare.
  const maneuver = stance === 'casting' ? null
    : stance === 'defensive' ? 'defend'
    : stance === 'offensive' ? (['attack', 'smash', 'ranged'].includes(profile.maneuver) ? profile.maneuver : 'attack')
    : stance || profile.maneuver;
  return maneuver === profile.maneuver ? profile : { ...profile, maneuver };
}

/** Presentation only. The resolved card, including equipment-projected tags, owns identity. */
export function stanceForCard(card = {}) {
  card = withTagIds(card);
  const profile = combatProfileFor(card);
  if (cardPreparationCategory(card)) return 'casting';
  // Player-only reviewed counter/sweep families; public enemy intent stays broad.
  if (profile.maneuver === 'counter') return 'counter';
  if (defensive.has(profile.maneuver)) return 'defensive';
  if (profile.camp === 'spell') return 'casting';
  if (profile.maneuver === 'sweep') return 'sweep';
  // Owner (2026-10-12): smash holds its own painted wind-up, not the offensive frame.
  if (profile.maneuver === 'smash') return 'smash';
  if (offensive.has(profile.maneuver)) return 'offensive';
  const tags = new Set(card.cardTags ?? card.tags ?? []);
  if (tags.has('source:spell') || card.abilityKind === 'spell' || card.type === 'spell') return 'casting';
  if (tags.has('guard') || tags.has('block')) return 'defensive';
  if (card.type === 'attack') return 'offensive';
  // Prepare: spells and any card with no attack/smash/sweep/defend/counter maneuver.
  return 'casting';
}

/** Accept ONLY previewIntent()/coopEnemyIntent() output, never an enemy or private move. */
export function stanceForPublicIntent(intent = {}) {
  intent ??= {};
  // The public broad stance survives concealment. Do not inspect damage, moveId,
  // tags, effects, schools, targets, or pendingMove to infer anything else.
  if (defensive.has(intent.stance)) return 'defensive';
  if (intent.stance === 'casting') return 'casting';
  if (offensive.has(intent.stance)) return 'offensive';
  return null;
}

/** Each seat keeps its last confirmed card until its next confirmed card (only combatStarted clears). Failed/preparing plays do nothing. */
/**
 * Whether the engine still holds a chosen stance for this entity. A Staggered stance is forced and temporary,
 * and ends when its owner's next turn begins, leaving none. The figure's held-card ledgers must not outlive the real stance.
 */
export function holdsChosenStance(entity) {
  const maneuver = entity?.combatStance?.maneuver;
  return !!maneuver && maneuver !== 'staggered' && maneuver !== 'neutral';
}

export function createStanceLedger(classify = stanceForCard) {
  const actors = new Map();
  return Object.freeze({
    accept(receipt, resolvedCard) {
      const actorId = receipt?.playerId || receipt?.sourceId || 'player';
      if (receipt?.type === 'combatStarted') { actors.clear(); return null; }
      if (receipt?.type !== 'cardPlayed') return actors.get(actorId) ?? null;
      const stance = classify(resolvedCard || { id: receipt.cardId, type: receipt.cardType, cardTags: receipt.cardTags });
      actors.set(actorId, stance); return stance;
    },
    // Rebuild each actor's last confirmed card from a restored event log (a loaded save starts with an empty ledger).
    // resolve(receipt) may return the resolved card; a missing or throwing resolver falls back to the receipt's own fields.
    replay(events = [], resolve) {
      for (const receipt of events) {
        let card;
        try { card = resolve?.(receipt); } catch { card = undefined; }
        this.accept(receipt, card);
      }
    },
    get(actorId = 'player') { return actors.get(actorId) ?? null; },
    reset(actorId) { actorId === undefined ? actors.clear() : actors.delete(actorId); },
    snapshot() { return Object.fromEntries(actors); },
  });
}

/** No alias or default-class substitution for an unpainted canonical cell. */
export function stanceArtFor(catalog, actorId, stance) {
  if (!STANCE_FAMILIES.includes(stance)) return null;
  return catalog.actors?.[actorId]?.frames?.[stance] ?? null;
}
