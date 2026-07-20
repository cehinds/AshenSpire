// src/ui/uiContent.js — shared UI presentation data.
//
// The map, combat, and co-op screens all draw the same things — map node
// types, act titles, enemy intents. These used to be hardcoded (and drifting)
// in each screen. This is the single source so their icons, labels, and prose
// can't diverge. Pure presentation data + tiny pure helpers, no game state.

// ---- map node types ---------------------------------------------------------
export const NODE_TYPES = {
  monster: { icon: '⚔', name: 'Monster', blurb: 'A fight — cinders and a card reward.' },
  fight: { icon: '⚔', name: 'Monster', blurb: 'A fight — cinders and a card reward.' },
  elite: { icon: '☠', name: 'Elite', blurb: 'A hard fight. Drops a relic.' },
  boss: { icon: '👁', name: 'Boss', blurb: 'The act boss.' },
  shrine: { icon: '♨', name: 'Shrine of Emberlight', blurb: 'Rest (heal), smith (upgrade a card), or mend an ally.' },
  merchant: { icon: '⚖', name: 'Merchant', blurb: 'Cards, relics, flasks, card removal.' },
  treasure: { icon: '▣', name: 'Treasure', blurb: 'A relic, free.' },
  event: { icon: '?', name: 'Unknown', blurb: 'An event, a fight, a shrine… who can say.' },
  unknown: { icon: '?', name: 'Unknown', blurb: 'An event, a fight, a shrine… who can say.' },
};
export const nodeIcon = (type) => (NODE_TYPES[type] || {}).icon || '?';
export const nodeName = (type) => (NODE_TYPES[type] || {}).name || String(type);
export const nodeBlurb = (type) => (NODE_TYPES[type] || {}).blurb || '';

// ---- act titles -------------------------------------------------------------
export const ACT_NAMES = {
  1: 'ACT I — THE FALLOW MARCHES',
  2: 'ACT II — THE STITCHED COURT',
  3: 'ACT III — THE ASHEN CROWN',
};
// Endless Spire: acts past 3 reuse the act 1-3 names with a "· CYCLE n" marker.
export function actTitle(actNumber) {
  const base = ACT_NAMES[((actNumber - 1) % 3) + 1] || `ACT ${actNumber}`;
  const loop = Math.floor((actNumber - 1) / 3);
  return loop > 0 ? `${base} · CYCLE ${loop + 1}` : base;
}

// ---- enemy intents ----------------------------------------------------------
// `iv` is a preview/snapshot intent:
//   { kind, moveId?, damage?, hits?, block?, delayed?, pending?, totalDamage? }
export const INTENT_ICONS = { attack: '⚔', block: '🛡', buff: '↑', debuff: '☾', staggered: '✦', unknown: '?' };

// Solo (previewIntent) supplies { kind, damage, hits, block, delayed, pending,
// totalDamage } and marks unknown via kind:'unknown'; the co-op snapshot intent
// supplies the same fields plus moveId (null when unknown). These helpers key on
// kind + field presence so both shapes render identically.
const isUnknownIntent = (iv) => !iv || iv.kind === 'unknown' || iv.moveId === null;

/** The badge shown over an enemy → { cls, html }. */
export function intentBadge(iv) {
  if (isUnknownIntent(iv)) return { cls: 'unknown', html: '?' };
  if (iv.kind === 'staggered') return { cls: 'staggered', html: '✦ STAGGERED' };
  if (iv.damage != null) {
    const n = iv.hits > 1 ? `${iv.damage}×${iv.hits}` : `${iv.damage}`;
    return { cls: `attack${iv.delayed ? ' delayed' : ''}`, html: `<span class="ic">${INTENT_ICONS.attack}</span>${n}${iv.delayed ? ' ⌛' : ''}` };
  }
  if (iv.block != null) return { cls: 'block', html: `<span class="ic">${INTENT_ICONS.block}</span>` };
  if (iv.kind === 'buff') return { cls: 'buff', html: `<span class="ic">${INTENT_ICONS.buff}</span>` };
  if (iv.kind === 'debuff') return { cls: 'debuff', html: `<span class="ic">${INTENT_ICONS.debuff}</span>` };
  return { cls: iv.kind || 'unknown', html: '?' };
}

/** Intent hover tooltip. `victim` names who attacks/debuffs hit ('you' solo,
 *  'each hero' in co-op). Reads totalDamage/pending when the caller has them. */
export function intentTooltip(iv, { victim = 'you' } = {}) {
  if (isUnknownIntent(iv)) return '<div class="tt-title">Intent: Unknown</div>';
  if (iv.kind === 'staggered') return `<div class="tt-title">Staggered</div>Poise broken — this enemy's turn is skipped and it takes +50% damage.`;
  if (iv.damage != null) {
    const total = iv.totalDamage != null && iv.hits > 1 ? ` (${iv.totalDamage} total)` : '';
    let t = `<div class="tt-title">Intent: Attack</div>Attacking ${victim} for <b>${iv.damage}${iv.hits > 1 ? ` × ${iv.hits}${total}` : ''}</b> damage (modifiers included).`;
    if (iv.pending) t += '<br><b>Committed:</b> this delayed attack lands this coming turn — Stagger cancels it.';
    else if (iv.delayed) t += '<br><b>Delayed:</b> it holds this turn and strikes the next. Stagger cancels it.';
    return t;
  }
  if (iv.block != null) return '<div class="tt-title">Intent: Defend</div>Gaining Block.';
  if (iv.kind === 'buff') return '<div class="tt-title">Intent: Buff</div>Strengthening itself.';
  if (iv.kind === 'debuff') return `<div class="tt-title">Intent: Debuff</div>Hindering ${victim}.`;
  return '<div class="tt-title">Intent: Unknown</div>';
}
