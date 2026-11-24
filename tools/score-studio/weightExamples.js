// Plain words and a worked example for each Weights tab row, so every number reads as a sentence:
// "[1] pts per [3] damage" with "6 damage = 2 pts" under it. The examples use the scorer's own math
// (src/model/combatPower.js), so they never print a number the scorer would not.
import { BaseFace, ScoreCard, CombatPower, RankOf, RankName, RankRange } from '../../src/model/combatPower.js';

// The thing an effect's "per" counts. Anything not listed falls back to the effect's own label.
const EFFECT_UNITS = Object.freeze({
  damage: 'damage',
  block: 'Block',
  ward: 'Ward HP',
  gainBarrier: 'Bonus Poise stacks',
  poiseDamage: 'Poise',
  restorePoise: 'Poise',
  heal: 'HP healed',
  loseHp: 'HP lost',
  draw: 'cards drawn',
  discard: 'cards discarded',
  addCard: 'cards added',
  restoreMana: 'MP',
  restoreStamina: 'SP',
  gainEnergy: 'energy',
  applyReflect: 'Reflect stacks',
  evadeStack: 'Evade stacks',
  counterStack: 'Counter stacks',
  buildup: 'buildup',
  removeStatus: 'debuffs removed',
  pullEnemy: 'pulls',
  swapRows: 'swaps',
  moveEngagement: 'moves',
});

// Effects the scorer counts once per effect, whatever the amount (see cardDefToFace in studio.js).
const COUNTED_ONCE_EFFECTS = new Set(['removeStatus', 'pullEnemy', 'swapRows', 'moveEngagement']);
// Effects cardDefToFace (studio.js) scores with another row's weight (EFFECT_SCORE_KEYS there): their own box does nothing.
const BORROWED_EFFECT_WEIGHTS = Object.freeze({ ward: 'block', restorePoise: 'block', gainEnergy: 'restoreStamina', swapRows: 'pullEnemy' });
// Effects the scorer never reads; Evade stacks score through the evade status row, and gainBarrier through barrier.
const UNREAD_EFFECTS = Object.freeze({ evadeStack: 'Not scored here: Evade uses the evade status row', gainBarrier: 'Not scored here: Bonus Poise uses the barrier status row', addCard: 'Not scored yet', buildup: 'Not scored yet' });
// Statuses ScoreCard values with a fixed formula that ignores the weight (exactStatus in combatPower.js).
const FORMULA_STATUSES = new Set(['burn', 'venom', 'shock', 'chill']);
// A round positive score for the multiplier examples.
const EXAMPLE_POSITIVE_SCORE = 20;
const EXAMPLE_RAW_SCORE = 10;
const EXAMPLE_STACKS = 3;
const EXAMPLE_EFFECTS = 3;
const EXAMPLE_HITS = 3;

export function effectUnit(id, label)
{
  return EFFECT_UNITS[id] || label || id;
}

function num(value)
{
  const rounded = Math.round(Number(value) * 10) / 10;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function pts(value)
{
  const text = num(value);
  return `${text} ${text === '1' || text === '-1' ? 'pt' : 'pts'}`;
}

function signedPts(value)
{
  const text = pts(value);
  return Number(value) > 0 ? `+${text}` : text;
}

function tagKind(tag)
{
  if (!tag) return 'flat';
  if (tag.multiplier !== undefined) return 'times';
  if (tag.pMultiplier !== undefined) return 'share';
  if (tag.per !== undefined) return 'per';
  return 'flat';
}

/**
 * The words around a row's boxes: before the weight box, between it and the per box, and after.
 * `scoring` is the config the row shows (staged or applied).
 */
export function weightSentence(groupKey, id, scoring, label)
{
  switch (groupKey)
  {
    case 'costs':
      return { before: '', mid: `pts per ${String(id).toUpperCase()}`, after: '' };
    case 'effects':
      return { before: '', mid: 'pts per', after: effectUnit(id, label) };
    case 'statuses':
      return { before: '', mid: 'pts per stack', after: '' };
    case 'keywords':
      return scoring.keywords?.[id]?.flat !== undefined
        ? { before: 'adds', mid: 'pts', after: '' }
        : { before: 'adds', mid: '× positive score', after: '' };
    case 'rarity':
      return { before: '', mid: `pts off a ${id} card`, after: '' };
    case 'rank':
      return rankSentence(id);
    case 'categories':
      return scoring.categories?.[id]?.multiplier
        ? { before: '×', mid: 'positive score', after: '' }
        : { before: 'adds', mid: 'pts', after: '' };
    case 'tags':
      return tagSentence(scoring.tags?.[id]);
    default:
      return { before: '', mid: '', after: '' };
  }
}

function rankSentence(id)
{
  switch (id)
  {
    case 'unrankedMax': return { before: 'Unranked up to', mid: 'CP', after: '' };
    case 'width': return { before: 'Each rank spans', mid: 'CP', after: '' };
    case 'maxRank': return { before: 'Highest rank', mid: '', after: '' };
    case 'effectCount': return { before: '', mid: 'pts per extra effect', after: '' };
    default: return { before: '', mid: '', after: '' };
  }
}

function tagSentence(tag)
{
  switch (tagKind(tag))
  {
    case 'times': return { before: '×', mid: 'positive score', after: '' };
    case 'share': return { before: 'adds', mid: '× positive score', after: '' };
    case 'per': return { before: '', mid: 'pts per', after: '' };
    default: return { before: 'adds', mid: 'pts', after: '' };
  }
}

/** One short line showing what the row's numbers do to a card, worked out with the scorer's math. */
export function weightExample(groupKey, id, scoring, label)
{
  switch (groupKey)
  {
    case 'costs':
      return costExample(id, scoring);
    case 'effects':
      return effectExample(id, scoring, label);
    case 'statuses':
      return statusExample(id, scoring);
    case 'keywords':
      return keywordExample(id, scoring);
    case 'rarity':
      return rarityExample(id, scoring);
    case 'rank':
      return rankExample(id, scoring);
    case 'categories':
      return categoryExample(id, scoring, label);
    case 'tags':
      return tagExample(id, scoring);
    default:
      return '';
  }
}

function costExample(id, scoring)
{
  const weight = Number(scoring.costs?.[id]?.weight) || 0;
  return `2 ${String(id).toUpperCase()} = ${pts(weight * 2)}`;
}

// ScoreCard's effect value: weight x amount / per (ew in combatPower.js).
function effectExample(id, scoring, label)
{
  if (UNREAD_EFFECTS[id]) return UNREAD_EFFECTS[id];
  const source = BORROWED_EFFECT_WEIGHTS[id];
  if (source) return `Not this box: scored with the ${source} row (${effectExample(source, scoring, source).replace(effectUnit(source, source), effectUnit(id, label))})`;
  const entry = scoring.effects?.[id];
  if (!entry) return '';
  const per = Math.max(1, Number(entry.per) || 1);
  const weight = Number(entry.weight) || 0;
  if (COUNTED_ONCE_EFFECTS.has(id)) return `Counted once per card: ${signedPts(weight / per)}`;
  if (id === 'counterStack') return `Any Counter card: ${signedPts(weight / per)}`;
  const amount = per * 2;
  return `${amount} ${effectUnit(id, label)} = ${pts(weight * amount / per)}`;
}

// The scorer's real value for a few stacks, so capped and formula statuses show what they score.
function statusExample(id, scoring)
{
  const status = scoring.statuses?.[id];
  if (!status) return '';
  const target = status.target === 'self' ? 'self' : 'enemy';
  const face = { ...BaseFace(), statuses: [[id, EXAMPLE_STACKS, target]] };
  const value = ScoreCard(face, scoring).parts[id] || 0;
  let note = '';
  if (FORMULA_STATUSES.has(id)) note = ' (set by a formula, not this box)';
  else if ((scoring.cardModel?.decayOneStatuses || []).includes(id)) note = ` (counts at most ${scoring.model?.R} stacks)`;
  return `${EXAMPLE_STACKS} stacks = ${pts(value)}${note}`;
}

// ScoreCard's keyword value: flat, or the positive score times the multiplier, either held to `min`.
function keywordExample(id, scoring)
{
  const keyword = scoring.keywords?.[id];
  if (!keyword) return '';
  const flat = keyword.flat !== undefined;
  let value = flat ? Number(keyword.flat) || 0 : EXAMPLE_POSITIVE_SCORE * (Number(keyword.multiplier) || 0);
  // ScoreCard holds either form to `min` (at least min, or at most a negative min).
  if (keyword.min !== undefined) value = keyword.min < 0 ? Math.min(value, keyword.min) : Math.max(value, keyword.min);
  return flat ? `Any card with it: ${signedPts(value)}` : `Positive score ${EXAMPLE_POSITIVE_SCORE}: ${signedPts(value)}`;
}

function rarityExample(id, scoring)
{
  const cp = CombatPower(EXAMPLE_RAW_SCORE, id, scoring);
  return `Score ${EXAMPLE_RAW_SCORE} = CP ${num(cp)} = ${RankName(RankOf(cp, scoring))}`;
}

function rankExample(id, scoring)
{
  const rank = scoring.rank || {};
  switch (id)
  {
    case 'unrankedMax':
      return `CP ${num(rank.unrankedMax)} = Unranked, CP ${num(rank.unrankedMax + 1)} = ${RankName(RankOf(rank.unrankedMax + 1, scoring))}`;
    case 'width':
    {
      const cp = Math.max(rank.width * 2 + 1, rank.unrankedMax + 1);
      return `CP ${num(cp)} = ${RankName(RankOf(cp, scoring))}`;
    }
    case 'maxRank':
      return `Rank ${num(rank.maxRank)} covers CP ${RankRange(rank.maxRank, scoring)}`;
    case 'effectCount':
    {
      const extra = Math.max(0, EXAMPLE_EFFECTS - (scoring.effectCount?.skipFirst ? 1 : 0));
      return `${EXAMPLE_EFFECTS} effects = ${pts((Number(scoring.effectCount?.weight) || 0) * extra)}`;
    }
    default:
      return '';
  }
}

// ScoreCard's category value: the flat weight, or with multiplier on, positive score x (weight - 1).
function categoryExample(id, scoring, label)
{
  const category = scoring.categories?.[id];
  if (!category) return '';
  const weight = Number(category.weight) || 0;
  if (category.multiplier) return `Positive score ${EXAMPLE_POSITIVE_SCORE}: ${signedPts(EXAMPLE_POSITIVE_SCORE * (weight - 1))}`;
  return `${label || id} card: ${signedPts(weight)}`;
}

// ScoreCard's tag value: weight once, or once per hit; multiplier tags scale the positive score.
function tagExample(id, scoring)
{
  const tag = scoring.tags?.[id];
  if (!tag) return '';
  switch (tagKind(tag))
  {
    case 'times':
    {
      // ScoreCard reads a tag multiplier only for the Counterstrike tag; the area tag instead scores damage, Poise
      // and enemy statuses once per enemy (model.ENEMIES); any other multiplier tag is not scored.
      const model = scoring.cardModel || {};
      if (id === model.areaTag) return `Not this box: area effects count once per enemy (${num(scoring.model?.ENEMIES)} enemies)`;
      if (id !== model.counterstrikeTag) return 'Not scored yet';
      return `Positive score ${EXAMPLE_POSITIVE_SCORE}: ${signedPts(EXAMPLE_POSITIVE_SCORE * ((Number(tag.multiplier) || 0) - 1))}`;
    }
    case 'share':
      return `Positive score ${EXAMPLE_POSITIVE_SCORE}: ${signedPts(EXAMPLE_POSITIVE_SCORE * (Number(tag.pMultiplier) || 0))}`;
    case 'per':
      return tag.per === 'hit'
        ? `${EXAMPLE_HITS} hits = ${pts((Number(tag.weight) || 0) * EXAMPLE_HITS)}`
        : `Any card with it: ${signedPts(tag.weight)}`;
    default:
      if (tag.perN !== undefined && id === scoring.cardModel?.honedTag) return `Any card with it: ${signedPts((Number(tag.weight) || 0) + (Number(tag.perN) || 0))}`;
      return `Any card with it: ${signedPts(tag.weight)}`;
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Flat or multiplier: the "multiply instead" switch on keyword and multiplier-tag rows (owner, 2026-11-24). Unchecked stores the
// flat form, checked the multiplier form; switching resets the number to the no-change value, as the category switch does.
// ---------------------------------------------------------------------------------------------------------------------------------

/** The multiplier field a tag row switches to: 'multiplier' or 'pMultiplier' (the tag's own, else the repo's), or null for a flat-only tag. */
export function TagMultiplierKey(tag, repoTag)
{
  for (const source of [tag, repoTag])
  {
    if (source?.pMultiplier !== undefined) return 'pMultiplier';
    if (source?.multiplier !== undefined) return 'multiplier';
  }
  return null;
}

/** Switch a keyword between flat (adds `flat`) and multiplier (adds positive score x `multiplier`); both start at 0. */
export function SetKeywordForm(keyword, multiply)
{
  if (multiply)
  {
    delete keyword.flat;
    keyword.multiplier = 0;
  }
  else
  {
    delete keyword.multiplier;
    keyword.flat = 0;
  }
}

/** Switch a tag between flat (adds `weight`) and its multiplier: 'multiplier' starts at 1 (x1), 'pMultiplier' at 0. */
export function SetTagForm(tag, multKey, multiply)
{
  delete tag.multiplier;
  delete tag.pMultiplier;
  tag.weight = 0;
  if (multiply) tag[multKey] = multKey === 'multiplier' ? 1 : 0;
}
