// THE THREE DAMAGE CHANNELS (owner, 2026-11-18: "str dex and int is more intuitive").
//
// AR, DR and PR are not stats any more. Physical damage adds STR, Block adds DEX and magic damage adds max(INT, WIS), each at the per-point
// weight the effects module states (`strengthDamageWeight`, `dexterityBlockWeight`, `magicStatWeight`, 1 each). The three ids `ar`, `dr`
// and `pr` survive only as the INTERNAL names of those channels: the key of an entity's `ratings`, of a rating source row and of a card's
// `ratingId`. No player-facing text names them: every label comes from here.
//
// A save from before this ruling may still carry `ar`, `dr` or `pr` in an item pick or a property's stat points; `channelAttribute` is the
// one place that reads them as the attribute they now are.

/** The attribute each channel is fed by (`pr` is max(INT, WIS) wherever the run reads it: fixCoreMechanics.PrAttributeView). */
export const CHANNEL_ATTRIBUTE = Object.freeze({ ar: 'strength', dr: 'dexterity', pr: 'intelligence' });

/** The channel an attribute feeds (the inverse of CHANNEL_ATTRIBUTE; Wisdom feeds the magic channel through max(INT, WIS)). */
export const ATTRIBUTE_CHANNEL = Object.freeze({ strength: 'ar', dexterity: 'dr', intelligence: 'pr', wisdom: 'pr' });

/** The short word a player reads for a channel. */
export const CHANNEL_LABEL = Object.freeze({ ar: 'STR', dr: 'DEX', pr: 'INT/WIS' });

/** The effects-module weight a channel is read at. */
export const CHANNEL_WEIGHT_KEY = Object.freeze({ ar: 'strengthDamageWeight', dr: 'dexterityBlockWeight', pr: 'magicStatWeight' });

export const isChannelId = (id) => Object.hasOwn(CHANNEL_ATTRIBUTE, id);

/** channelLabel(id) → 'STR' | 'DEX' | 'INT/WIS'; any other id (Poise, Ward) keeps its own capitalised name. */
export function channelLabel(id) {
  if (isChannelId(id)) return CHANNEL_LABEL[id];
  const text = String(id ?? '');
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** channelAttribute(stat) → the attribute a legacy `ar` / `dr` / `pr` stat key now means; any other key is returned as it is. */
export function channelAttribute(stat) {
  return isChannelId(stat) ? CHANNEL_ATTRIBUTE[stat] : stat;
}

/** channelWeight(effects, id) → the per-point weight of a channel in an effects module (0 when the module states none, as before). */
export function channelWeight(effects, id) {
  const value = effects?.[CHANNEL_WEIGHT_KEY[id]];
  return Number.isFinite(value) ? value : 0;
}
