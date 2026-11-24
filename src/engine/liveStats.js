// Live stats (owner, 2026-11-14, W25-L): an attribute change in a fight takes effect at once on everything derived from it, for the
// player and for enemies, and every attribute and derived value returns to its pre-fight value when the fight ends.
//
// ONE FORMULA. Nothing here restates a stat rule: each derived stat is priced by the same row formula the fight start and the
// character sheet use (model/derivedStats.js `statRowValue`, rows read through model/statRows.js `statRow`, so a run's own snapshot is
// the authority). The change is applied as a DELTA: the stat's value at the new attributes minus its value at the fight-start
// attributes, added to the value the fight began with. Equipment, relics, statuses and level terms therefore stay exactly as they
// were, and the whole recompute runs once per change, never per frame.
//
// STATE (plain JSON, so a saved fight keeps its boosts): `entity.liveStats = { base, boosts, turnBoosts }`.
//   base        what the entity started the fight with (attributes, ratings, pools, Poise and Ward maxima, hand and draw)
//   boosts      net attribute change, by attribute, for the rest of the fight (turn boosts included)
//   turnBoosts  the part of `boosts` that leaves again at the end of the owner's turn
// The run's own attributes are never written: combat holds its own copies.
import { persistentPoiseMaximum } from '../model/combatRatings.js';
import { ChannelRowValue } from '../model/channelRowValue.js';
import { SpellScalingValue, SpellTraditionsActive } from '../model/spellTraditions.js';
import { handRow, scaledCards } from '../model/handRules.js';
import { configuredCombat, profileHandSize } from './gameProfileCombat.js';

export const LIVE_ATTRIBUTE_IDS = Object.freeze(['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']);
const RATING_IDS = ['ar', 'dr', 'pr', 'ward', 'poise'];
const POOLS = [['hp', 'maxHp'], ['stamina', 'maxStamina'], ['mana', 'maxMana']];

/** The per-attribute scale of each element's stat-scaled numbers (owner, 2026-11-14), read from the attacker's CURRENT attributes. */
export const ELEMENT_STAT_SCALING = Object.freeze({
  fire: Object.freeze({ ids: ['wisdom', 'intelligence'], mode: 'sum' }), // Poise ignored per WIS + INT
  lightning: Object.freeze({ ids: ['intelligence', 'wisdom'], mode: 'max' }), // Shock per max(INT, WIS)
  frost: Object.freeze({ ids: ['intelligence'], mode: 'sum' }), // Chill scales INT
  divine: Object.freeze({ ids: ['wisdom'], mode: 'sum' }), // heal and cleanse per WIS
  necrotic: Object.freeze({ ids: ['intelligence'], mode: 'sum' }), // build-up per INT
  force: Object.freeze({ ids: ['strength', 'intelligence'], mode: 'sum' }), // Poise damage scales STR + INT
});

/** LiveAttribute(entity, id) -> the entity's attribute as it stands now in the fight (boosts included). */
export function LiveAttribute(entity, id) {
  const value = Number(entity?.attributes?.[id]);
  return Number.isFinite(value) ? value : 0;
}

/** StatScaledNumber(entity, ids, mode) -> the sum (or the highest) of the entity's CURRENT attributes `ids`: the one reader every stat-scaled number uses. */
export function StatScaledNumber(entity, ids, mode = 'sum') {
  const values = ids.map(id => LiveAttribute(entity, id));
  return mode === 'max' ? Math.max(0, ...values) : values.reduce((sum, value) => sum + value, 0);
}

/** ElementStatScale(entity, element) -> the attacker's live stat number an element's rule scales by (0 for an element with no stat scale). */
export function ElementStatScale(entity, element, ctx = null) {
  const rule = ELEMENT_STAT_SCALING[element];
  if (!rule) return 0;
  return SpellTraditionsActive(ctx) ? SpellScalingValue(entity?.attributes || {}, { school: element })
    : StatScaledNumber(entity, rule.ids, rule.mode);
}

const whole = value => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

const rowValue = ChannelRowValue;

function attributeRow(entity) {
  return (entity.ratingSources || []).find(row => row.kind === 'attribute') || null;
}

function snapshot(ctx, entity) {
  const isPlayer = entity === ctx.player;
  return {
    attributes: { ...(entity.attributes || {}) },
    ratings: { ...(entity.ratings || {}) },
    attributeRow: attributeRow(entity) ? Object.fromEntries(RATING_IDS.map(id => [id, Number(attributeRow(entity)[id]) || 0])) : null,
    maxHp: entity.maxHp, maxStamina: entity.maxStamina, maxMana: entity.maxMana, energyMax: entity.energyMax,
    drawPerTurn: entity.drawPerTurn,
    persistentPoiseMax: Number.isFinite(entity.persistentPoise?.max) ? Math.max(0, entity.persistentPoise.max - (entity.persistentPoise.barrierBonus || 0)) : entity.persistentPoise?.max, persistentWardMax: entity.persistentWard?.max, poiseMeterMax: entity.poiseMeter?.max,
    ...(isPlayer ? { handMax: ctx.handMax, combatDrawPerTurn: ctx.drawPerTurn } : {}),
  };
}

function ensure(ctx, entity) {
  if (!entity.liveStats) entity.liveStats = { base: snapshot(ctx, entity), boosts: {}, turnBoosts: {} };
  return entity.liveStats;
}

const clamp = (value, max) => Math.max(0, Math.min(max, value));

function resize(entity, field, max, currentFields) {
  const before = entity[field];
  if (!Number.isFinite(max)) return;
  entity[field] = max;
  const growth = max - (Number.isFinite(before) ? before : max);
  for (const current of currentFields) if (Number.isFinite(entity[current])) entity[current] = clamp(entity[current] + (growth > 0 ? growth : 0), max);
}

/**
 * RecomputeLiveStats(ctx, entity) — re-derive every attribute-driven value of `entity` from its fight-start values and its current
 * boosts. Called when a boost changes and when the fight ends (with no boosts left, which restores the fight-start values).
 * HP keeps the damage taken and is only trimmed to a lowered maximum; Stamina and Mana move with their maxima.
 */
export function RecomputeLiveStats(ctx, entity) {
  const live = entity.liveStats;
  if (!live) return;
  const { base, boosts } = live;
  const attributes = Object.fromEntries(Object.entries(base.attributes).map(([id, value]) => [id, Math.max(0, value + (boosts[id] || 0))]));
  for (const id of Object.keys(boosts)) if (!(id in attributes)) attributes[id] = Math.max(0, boosts[id]);
  const delta = id => rowValue(ctx, entity, id, attributes) - rowValue(ctx, entity, id, base.attributes);
  entity.attributes = attributes;
  if (entity === ctx.player && ctx.attributes) {
    ctx.attributes = { ...ctx.attributes, ...attributes };
  }
  // Ratings, and the attribute row the per-source readers sum.
  if (entity.ratings) for (const id of RATING_IDS) if (Number.isFinite(base.ratings[id])) entity.ratings[id] = whole(base.ratings[id] + delta(id));
  const source = attributeRow(entity);
  if (source && base.attributeRow) for (const id of RATING_IDS) source[id] = whole(base.attributeRow[id] + delta(id));
  if (Number.isFinite(base.poiseMeterMax) && entity.poiseMeter) entity.poiseMeter.max = whole(base.poiseMeterMax + delta('poise'));
  // Temporary in-combat attribute boosts do NOT change HP, Stamina, or Mana maxima/pools.
  // Poise and Ward pools move by the same rating delta their maxima were priced from at the fight start.
  if (entity.persistentPoise && Number.isFinite(base.persistentPoiseMax)) {
    // Barrier and Ward stacks add their Poise on top (persistentPoise.barrierBonus, SPEC 4.1a). With a rating table the maximum comes from the
    // same source syncPoiseMaximum uses (rating maximum + bonus), so the stored base format (a fight saved by 0.7.4.216 holds the bonus in it)
    // no longer matters; otherwise the fight-start base plus the rating delta, plus the bonus.
    const bonus = entity.persistentPoise.barrierBonus || 0;
    const max = (entity.ratings && ctx.combatExpansionVersion === 2 ? persistentPoiseMaximum(ctx, entity) : whole(base.persistentPoiseMax + delta('poise'))) + bonus;
    entity.persistentPoise.value = clamp(entity.persistentPoise.value + Math.max(0, max - entity.persistentPoise.max), max);
    entity.persistentPoise.max = max;
  }
  if (entity.persistentWard && Number.isFinite(base.persistentWardMax) && base.persistentWardMax > 0) {
    const max = whole(base.persistentWardMax + delta('ward'));
    entity.persistentWard.value = clamp(entity.persistentWard.value + Math.max(0, max - entity.persistentWard.max), max);
    entity.persistentWard.max = max;
  }
  // Hand size and draw (the player's).
  if (entity === ctx.player) {
    if (configuredCombat(ctx)) ctx.handMax = profileHandSize(ctx);
    else if (ctx.handRules) ctx.handMax = scaledCards(handRow(ctx.handRules, 'handSize'), ctx.attributes, ctx.characterLevel);
    if (ctx.registries && Number.isFinite(base.drawPerTurn)) {
      const draw = Math.max(0, base.drawPerTurn + delta('draw'));
      entity.drawPerTurn = draw;
      ctx.drawPerTurn = Number.isFinite(base.combatDrawPerTurn) ? Math.max(0, base.combatDrawPerTurn + delta('draw')) : ctx.drawPerTurn;
    }
  }
}

/**
 * ChangeAttribute(ctx, entity, id, amount, { thisTurn }) — add `amount` (negative lowers) to one attribute of `entity` for the rest of
 * the fight, or until the end of its turn with `thisTurn`, and re-derive everything that reads it at once. Stacks per call.
 */
export function ChangeAttribute(ctx, entity, id, amount, { thisTurn = false } = {}) {
  if (!entity || !LIVE_ATTRIBUTE_IDS.includes(id) || !Number.isFinite(amount) || amount === 0) return false;
  const live = ensure(ctx, entity);
  live.boosts[id] = (live.boosts[id] || 0) + amount;
  if (thisTurn) live.turnBoosts[id] = (live.turnBoosts[id] || 0) + amount;
  RecomputeLiveStats(ctx, entity);
  ctx.emit?.('attributeChanged', { targetId: entity.id, attribute: id, amount, value: LiveAttribute(entity, id), thisTurn });
  return true;
}

/** ClearTurnAttributeBoosts(ctx, entity) — the end of the owner's turn takes back the boosts made `thisTurn`. */
export function ClearTurnAttributeBoosts(ctx, entity) {
  const live = entity?.liveStats;
  if (!live || !Object.keys(live.turnBoosts).length) return;
  for (const [id, amount] of Object.entries(live.turnBoosts)) live.boosts[id] = (live.boosts[id] || 0) - amount;
  live.turnBoosts = {};
  RecomputeLiveStats(ctx, entity);
}

/**
 * RestoreLiveStats(ctx) — the fight is over: every entity's attributes and derived values return to what the fight began with
 * (HP keeps the damage taken but is trimmed to the restored maximum). Idempotent.
 */
export function RestoreLiveStats(ctx) {
  for (const entity of [ctx.player, ...(ctx.enemies || [])]) {
    if (!entity?.liveStats) continue;
    entity.liveStats.boosts = {};
    entity.liveStats.turnBoosts = {};
    RecomputeLiveStats(ctx, entity);
    delete entity.liveStats;
  }
}
