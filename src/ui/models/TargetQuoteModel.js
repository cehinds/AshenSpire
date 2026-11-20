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
    // The quote is the HP THIS enemy loses (owner, 2026-11-14): the row's own per-enemy hits, not the face figure, which is the attacker side.
    const sequence = row.perTargetHitDamages?.[targetId] ?? (row.target === 'allEnemies' ? undefined : row.hitDamages);
    for (const amount of sequence || []) hits.push(Math.floor(Number(amount) || 0));
  }
  return hits;
}

/**
 * TargetQuotePoise(preview, targetId) → { removed, breaks }: the Poise the play takes from that enemy and whether it empties the bar (Wave 3: a break is
 * the payoff, so the quote says so). The previews carry it per target; rows that hit nobody add nothing.
 */
export function TargetQuotePoise(preview, targetId) {
  let removed = 0, breaks = false;
  for (const row of preview?.values || []) {
    if (!['damage', 'poiseDamage', 'wardDamage'].includes(row.op) || (row.target && !ENEMY_DAMAGE_TARGETS.has(row.target))) continue;
    const entry = row.perTargetPoise?.[targetId];
    if (!entry) continue;
    removed += Math.max(0, Math.floor(Number(entry.removed) || 0));
    breaks = breaks || !!entry.breaks;
  }
  return { removed, breaks };
}

/** The sequence in the card face's form: `N`, `N × M` when the hits are equal, else each hit in order. */
const hitsBody = hits => {
  const list = hits.map(String);
  return list.length > 1 && hits.every(amount => amount === hits[0]) ? t('combat.quote.times', { amount: hits[0], count: hits.length }) : list.join(', ');
};
export function TargetQuoteHitsText(hits) {
  return t('combat.quote.hp', { hits: hitsBody(hits) });
}

/**
 * TargetQuoteSplashHits(reference, targetId) → the HP a Sweep's splash takes from that enemy when the reference enemy is the one aimed at, in order (Wave 2.5:
 * a Sweep also strikes every other enemy in range at half damage); empty when the card has none. The splash rows ride on the reference preview.
 */
export function TargetQuoteSplashHits(reference, targetId) {
  const hits = [];
  for (const row of reference?.values || []) if (row.op === 'damage') for (const amount of row.splashHitDamages?.[targetId] || []) hits.push(Math.floor(Number(amount) || 0));
  return hits;
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
  // Another enemy is the aimed one: this enemy also takes the Sweep's splash, as an extra line under its own quote.
  const splashHits = reference && reference !== quote ? TargetQuoteSplashHits(reference, targetId) : [];
  const splash = splashHits.length ? { splash: splashHits, splashText: t('combat.quote.splash', { hits: hitsBody(splashHits) }), splashLabel: t('combat.quote.splashAria', { hits: splashHits.join(', ') }) } : {};
  const refusal = refusalFor(combat, quote);
  if (refusal) return { kind: 'refusal', hits, text: refusal, label: refusal, ...cost };
  if (hits.every(amount => amount === 0)) {
    const word = hitPreview && TargetQuoteEvaded(hitPreview) ? t('combat.callout.evaded') : t('combat.callout.blocked');
    return { kind: 'cause', hits, text: word, label: word, ...cost, ...splash };
  }
  const text = TargetQuoteHitsText(hits);
  const { removed, breaks } = TargetQuotePoise(quote, targetId);
  const poise = breaks ? t('combat.callout.poiseBreak') : removed > 0 ? t('combat.quote.poise', { amount: removed }) : null;
  const poiseLabel = breaks ? t('combat.quote.breakAria') : removed > 0 ? t('combat.quote.poiseAria', { amount: removed }) : null;
  return { kind: 'hp', hits, text, label: [t('combat.quote.hpAria', { hits: hits.join(', ') }), poiseLabel].filter(Boolean).join('. '), poise, poiseBreaks: breaks, ...cost, ...splash };
}
