// What each enemy shows while a card is selected (owner, 2026-11-14, Wave 2 "make a turn plannable and quick"): the HP it will lose from the
// play, the cause word when the play takes none, and the Stamina or Mana the play charges against THAT enemy when that differs from the
// card face. The numbers are the card face's own (previewCard with the target id), read once per target from the memoised preview, so the quote
// is the face the card would wear if that enemy were aimed. Headless: no DOM, no rolls (a preview runs on a detached copy of the fight).
import { t } from '../strings.js';
import { rangeHitLabel } from './CombatRangeActionModel.js';

const ENEMY_DAMAGE_TARGETS = new Set(['enemy', 'allEnemies']);

/**
 * TargetQuoteHits(preview, targetId) → the HP each hit of the play takes from that enemy, in order, whole numbers.
 * A card that strikes every enemy reads that enemy's own row; a single-target effect reads the aimed one (the preview was taken against it).
 */
export function TargetQuoteHits(preview, targetId) {
  const hits = [];
  for (const row of preview?.values || []) {
    if (row.op !== 'damage' || !ENEMY_DAMAGE_TARGETS.has(row.target)) continue;
    const sequence = row.target === 'allEnemies' ? row.perTargetHitDamages?.[targetId] : (row.hitDamages ?? row.perTargetHitDamages?.[targetId]);
    for (const amount of sequence || []) hits.push(Math.floor(Number(amount) || 0));
  }
  return hits;
}

/** The sequence in the card face's form: `N`, `N × M` when the hits are equal, else each hit in order. */
export function TargetQuoteHitsText(hits) {
  const list = hits.map(String);
  const body = list.length > 1 && hits.every(amount => amount === hits[0]) ? t('combat.quote.times', { amount: hits[0], count: hits.length }) : list.join(', ');
  return t('combat.quote.hp', { hits: body });
}

/** True when an Evade stack on the enemy cancels the play (the hit label the hit-chance badge always read, now the only miss). */
export function TargetQuoteEvaded(hitPreview) {
  return rangeHitLabel(hitPreview, { certainHits: true }) === t('combat.range.evaded');
}

// The reason a play cannot be made against this enemy, in the words the route chooser already uses; null when it can.
function refusalFor(combat, preview) {
  const range = preview?.range;
  const route = range?.routes?.find(row => row.id === range.selectedRoute);
  if (route && route.available === false) return t('combat.range.unavailable');
  const player = combat.player;
  const affordable = player.energy >= (preview.costIsX ? 0 : preview.cost) && player.mana >= (preview.manaCost || 0)
    && player.stamina >= (preview.staminaCost || 0);
  return !affordable || route?.affordable === false ? t('combat.range.insufficient') : null;
}

/**
 * TargetQuote({ preview, combat, instanceId, targetId, reference, ranks, hitPreview }) → the quote for one enemy, or null (nothing to say).
 *   preview(combat, instanceId, targetId, ranks): the screen's memoised previewCard.
 *   reference: the preview of the card face as it stands (the reference enemy), so a cost is quoted only when it differs from it.
 *   hitPreview: previewCardHit's result for this enemy (an Evade stack reads as the Evade word).
 * Result: { kind: 'hp' | 'cause' | 'refusal', hits, text, label, stamina, mana }; `stamina` and `mana` are the cost against this
 * enemy when it differs from the face's, else null. A card that does not hit an enemy has no hits and so no quote.
 */
export function TargetQuote({ preview, combat, instanceId, targetId, reference = null, ranks, hitPreview = null }) {
  const quote = preview(combat, instanceId, targetId, ranks);
  const hits = TargetQuoteHits(quote, targetId);
  if (!hits.length) return null;
  const stamina = quote.staminaCost || 0, mana = quote.manaCost || 0;
  const cost = {
    stamina: reference && stamina !== (reference.staminaCost || 0) ? stamina : null,
    mana: reference && mana !== (reference.manaCost || 0) ? mana : null,
  };
  const refusal = refusalFor(combat, quote);
  if (refusal) return { kind: 'refusal', hits, text: refusal, label: refusal, ...cost };
  if (hits.every(amount => amount === 0)) {
    const word = hitPreview && TargetQuoteEvaded(hitPreview) ? t('combat.callout.evaded') : t('combat.callout.blocked');
    return { kind: 'cause', hits, text: word, label: word, ...cost };
  }
  const text = TargetQuoteHitsText(hits);
  return { kind: 'hp', hits, text, label: t('combat.quote.hpAria', { hits: hits.join(', ') }), ...cost };
}
