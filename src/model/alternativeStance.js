import { combatProfileFor } from './combatCardProfile.js';

export const STANCE_FAMILIES = Object.freeze(['offensive', 'defensive', 'casting']);
const defensive = new Set(['defend', 'defending']);
const offensive = new Set(['attack', 'smash', 'sweep', 'ranged', 'attacking', 'smashing', 'sweeping']);

/** Presentation only. The resolved card, including equipment-projected tags, owns identity. */
export function stanceForCard(card = {}) {
  card ??= {};
  const resolvedTags = card.cardTags ?? card.tags;
  if (resolvedTags) card = { ...card, cardTags: resolvedTags.map(tag => typeof tag === 'string' ? tag : tag.id) };
  const profile = combatProfileFor(card);
  // Counter artwork is a separate owner pass; retain its existing presentation.
  if (profile.maneuver === 'counter') return null;
  if (defensive.has(profile.maneuver)) return 'defensive';
  if (profile.camp === 'spell') return 'casting';
  if (offensive.has(profile.maneuver)) return 'offensive';
  const tags = new Set(card.cardTags ?? card.tags ?? []);
  if (tags.has('source:spell') || card.abilityKind === 'spell' || card.type === 'spell') return 'casting';
  if (tags.has('guard') || tags.has('block')) return 'defensive';
  if (card.type === 'attack') return 'offensive';
  return null;
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

/** Each seat keeps its last confirmed card until its next turn. Failed/preparing plays do nothing. */
export function createStanceLedger() {
  const actors = new Map();
  return Object.freeze({
    accept(receipt, resolvedCard) {
      const actorId = receipt?.playerId || receipt?.sourceId || 'player';
      if (receipt?.type === 'combatStarted') { actors.clear(); return null; }
      if (receipt?.type === 'playerTurnStart') {
        actors.delete(actorId); return null;
      }
      if (receipt?.type !== 'cardPlayed') return actors.get(actorId) ?? null;
      const stance = stanceForCard(resolvedCard || { id: receipt.cardId, type: receipt.cardType, cardTags: receipt.cardTags });
      actors.set(actorId, stance); return stance;
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
