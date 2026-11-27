// Plain words and a worked example for each Weights tab row, so every number reads as a sentence:
// "[1] pts per [3] damage" with "6 damage = 2 pts" under it. The examples use the scorer's own math
// (src/model/combatPower.js), so they never print a number the scorer would not.
import { BaseFace, ScoreCard, CombatPower, RankOf, RankName, RankRange, UpgradeTagSurcharge } from '../../src/model/combatPower.js';

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
      return { before: '', mid: `${multiplied(scoring, 'costs', id) ? '× P' : 'pts'} per ${String(id).toUpperCase()}`, after: '' };
    case 'effects':
      return { before: '', mid: `${multiplied(scoring, 'effects', id) ? '× P' : 'pts'} per`, after: effectUnit(id, label) };
    case 'statuses':
      if (!multiplied(scoring, 'statuses', id)) return { before: '', mid: 'pts per stack', after: '' };
      return { before: '', mid: FORMULA_STATUSES.has(id) ? '× P per formula pt' : '× P per stack', after: '' };
    case 'keywords':
      return scoring.keywords?.[id]?.flat !== undefined
        ? { before: 'adds', mid: 'pts', after: '' }
        : { before: 'adds', mid: '× positive score', after: '' };
    case 'rarity':
      return { before: '', mid: `pts off a ${id} card`, after: '' };
    case 'rank':
      return rankSentence(id, scoring);
    case 'categories':
      return scoring.categories?.[id]?.multiplier
        ? { before: '×', mid: 'positive score', after: '' }
        : { before: 'adds', mid: 'pts', after: '' };
    case 'tags':
      return tagSentence(scoring.tags?.[id]);
    case 'upgradeTags':
      return upgradeTagSentence(id, scoring);
    case 'items':
      return itemParamSentence(id);
    case 'gearFields':
      return { before: '', mid: 'pts per stack / point', after: '' };
    default:
      return { before: '', mid: '', after: '' };
  }
}

function itemParamSentence(id)
{
  switch (id)
  {
    case 'weaponPoiseDamage.perPoint': return { before: '', mid: 'pts per inherent Poise dmg', after: '' };
    case 'weaponPoiseDamage.baseline': return { before: 'Free up to', mid: 'Poise dmg', after: '' };
    case 'poiseThreshold.perPoint': return { before: '', mid: 'pts per armour Poise', after: '' };
    case 'poiseThreshold.baseline': return { before: 'Free up to', mid: 'armour Poise', after: '' };
    case 'plays.weaponArt': return { before: '×', mid: 'weapon art raw score', after: '' };
    case 'range.reach': return { before: 'Reach weapon adds', mid: 'pts', after: '' };
    case 'range.ranged': return { before: 'Ranged weapon adds', mid: 'pts', after: '' };
    case 'conditionFactor': return { before: 'Conditional trait ×', mid: '', after: '' };
    case 'attributeBudgetCost': return { before: 'Each +1 gear stat costs', mid: 'ratings / Poise budget', after: '' };
    default: return { before: '', mid: 'pts', after: '' };
  }
}

function upgradeTagSentence(id, scoring)
{
  if (id === 'improved.effectMultPerStack') return { before: '×', mid: 'compounding per stack', after: '' };
  const rule = scoring.upgradeTags?.[id];
  if (rule?.mode === 'multiplicative') return { before: 'adds', mid: '× positive score (compounding/stack)', after: '' };
  return { before: 'starts at', mid: 'pts (doubles per stack)', after: '' };
}

function rankSentence(id, scoring)
{
  switch (id)
  {
    case 'unrankedMax': return { before: 'Unranked up to', mid: 'CP', after: '' };
    case 'width': return { before: 'Each rank spans', mid: 'CP', after: '' };
    case 'maxRank': return { before: 'Highest rank', mid: '', after: '' };
    case 'effectCount': return { before: '', mid: `${scoring?.effectCount?.multiplier === true ? '× P' : 'pts'} per extra effect`, after: '' };
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

// A cost, effect or status in multiplier form (owner, 2026-11-27): it scores P x weight per unit.
const multiplied = (scoring, section, id) => scoring?.[section]?.[id]?.multiplier === true;

// "Positive score 20" or, for the card in hand, "Strike (positive score 14)".
function positiveLead(example)
{
  return example.name ? `${example.name} (positive score ${num(example.positive)})` : `Positive score ${num(example.positive)}`;
}

/**
 * One short line showing what the row's numbers do to a card, worked out with the scorer's math.
 * `card` ({name, positive}) is the card the multiplier-form examples use; without it they use positive score 20.
 */
export function weightExample(groupKey, id, scoring, label, card = null)
{
  const example = Number.isFinite(card?.positive) ? { name: card.name || '', positive: card.positive } : { name: '', positive: EXAMPLE_POSITIVE_SCORE };
  switch (groupKey)
  {
    case 'costs':
      return costExample(id, scoring, example);
    case 'effects':
      return effectExample(id, scoring, label, example);
    case 'statuses':
      return statusExample(id, scoring, example);
    case 'keywords':
      return keywordExample(id, scoring);
    case 'rarity':
      return rarityExample(id, scoring);
    case 'rank':
      return rankExample(id, scoring, example);
    case 'categories':
      return categoryExample(id, scoring, label);
    case 'tags':
      return tagExample(id, scoring);
    case 'upgradeTags':
      return upgradeTagExample(id, scoring);
    case 'items':
      return itemParamExample(id, scoring);
    case 'gearFields':
      return gearFieldExample(id, scoring, label);
    default:
      return '';
  }
}

function itemParamExample(id, scoring)
{
  const items = scoring.items || {};
  switch (id)
  {
    case 'weaponPoiseDamage.perPoint':
    case 'weaponPoiseDamage.baseline':
    {
      const base = Number(items.weaponPoiseDamage?.baseline ?? 1);
      const per = Number(items.weaponPoiseDamage?.perPoint ?? 1);
      return `Poise dmg 3 weapon (e.g. Hammer) = ${signedPts((3 - base) * per)}`;
    }
    case 'poiseThreshold.perPoint':
    case 'poiseThreshold.baseline':
    {
      const base = Number(items.poiseThreshold?.baseline ?? 0);
      const per = Number(items.poiseThreshold?.perPoint ?? 0.5);
      return `Armour Poise 6 (Plate) = ${signedPts(Math.max(0, 6 - base) * per)}`;
    }
    case 'plays.weaponArt':
      return `Weapon art raw 12 = ${signedPts(12 * (Number(items.plays?.weaponArt ?? 0.25)))}`;
    case 'range.reach':
      return `Spear / Staff = ${signedPts(Number(items.range?.reach ?? 2))}`;
    case 'range.ranged':
      return `Bow / Crossbow = ${signedPts(Number(items.range?.ranged ?? 3))}`;
    case 'conditionFactor':
      return `Trait worth 4 pts with @stance = ${signedPts(4 * (Number(items.conditionFactor ?? 0.65)))}`;
    case 'attributeBudgetCost':
      return `+1 flat attribute on armour trims ${num(items.attributeBudgetCost ?? 3)} pts from its Poise / ratings pool`;
    default:
      return '';
  }
}

function upgradeTagExample(id, scoring)
{
  if (id === 'improved.effectMultPerStack')
  {
    const m = Math.max(1, Number(scoring.upgradeTags?.improved?.effectMultPerStack) || 1.1);
    return `Stacks: ×${num(m)} / ×${num(m * m)} / ×${num(m * m * m)} (10 dmg → ${Math.round(10 * m)} / ${Math.round(10 * m * m)} / ${Math.round(10 * m * m * m)})`;
  }
  const rule = scoring.upgradeTags?.[id];
  if (!rule) return '';
  if (rule.surchargeEnabled === false) return 'Surcharge disabled (0 pts)';
  const s1 = UpgradeTagSurcharge(rule, 1, EXAMPLE_POSITIVE_SCORE);
  const s2 = UpgradeTagSurcharge(rule, 2, EXAMPLE_POSITIVE_SCORE);
  const s3 = UpgradeTagSurcharge(rule, 3, EXAMPLE_POSITIVE_SCORE);
  if (rule.mode === 'multiplicative')
  {
    return `Positive score ${EXAMPLE_POSITIVE_SCORE}: stack 1 ${signedPts(s1)} · stack 2 (+) ${signedPts(s2)} · stack 3 (+2) ${signedPts(s3)}`;
  }
  return `Stack 1: ${signedPts(s1)} · Stack 2 (+): ${signedPts(s2)} · Stack 3 (+2): ${signedPts(s3)}`;
}

function gearFieldExample(id, scoring, label)
{
  const field = scoring.items?.gearFields?.[id];
  if (!field) return '';
  const w = Number(field.weight) || 0;
  return `+1 ${field.label || label || id} (always-on) = ${signedPts(w)}; conditional = ${signedPts(w * (Number(scoring.items?.conditionFactor ?? 0.65)))}`;
}

function costExample(id, scoring, example)
{
  const weight = Number(scoring.costs?.[id]?.weight) || 0;
  if (multiplied(scoring, 'costs', id)) return `${positiveLead(example)}: 2 ${String(id).toUpperCase()} = ${pts(example.positive * weight * 2)}`;
  return `2 ${String(id).toUpperCase()} = ${pts(weight * 2)}`;
}

// ScoreCard's effect value: weight x amount / per (ew in combatPower.js), times P in multiplier form.
function effectExample(id, scoring, label, example)
{
  if (UNREAD_EFFECTS[id]) return UNREAD_EFFECTS[id];
  const source = BORROWED_EFFECT_WEIGHTS[id];
  if (source) return `Not this box: scored with the ${source} row (${effectExample(source, scoring, source, example).replace(effectUnit(source, source), effectUnit(id, label))})`;
  const entry = scoring.effects?.[id];
  if (!entry) return '';
  const per = Math.max(1, Number(entry.per) || 1);
  const weight = Number(entry.weight) || 0;
  const mult = multiplied(scoring, 'effects', id);
  const scale = mult ? example.positive : 1;
  const lead = mult ? `${positiveLead(example)}: ` : '';
  if (COUNTED_ONCE_EFFECTS.has(id)) return `${lead}Counted once per card: ${signedPts(scale * weight / per)}`;
  if (id === 'counterStack') return `${lead}Any Counter card: ${signedPts(scale * weight / per)}`;
  const amount = per * 2;
  return `${lead}${amount} ${effectUnit(id, label)} = ${pts(scale * weight * amount / per)}`;
}

// The scorer's real value for a few stacks, so capped and formula statuses show what they score.
// In multiplier form the units are the flat form at weight 1 (the formula value for a formula status), times P x weight.
function statusExample(id, scoring, example)
{
  const status = scoring.statuses?.[id];
  if (!status) return '';
  const target = status.target === 'self' ? 'self' : 'enemy';
  const face = { ...BaseFace(), statuses: [[id, EXAMPLE_STACKS, target]] };
  const decayNote = (scoring.cardModel?.decayOneStatuses || []).includes(id) ? ` (counts at most ${scoring.model?.R} stacks)` : '';
  if (multiplied(scoring, 'statuses', id))
  {
    const unitScoring = { ...scoring, statuses: { ...scoring.statuses, [id]: { ...status, weight: 1, multiplier: false } } };
    const units = ScoreCard(face, unitScoring).parts[id] || 0;
    const note = FORMULA_STATUSES.has(id) ? ` (${num(units)} formula pts)` : decayNote;
    return `${positiveLead(example)}: ${EXAMPLE_STACKS} stacks = ${pts(example.positive * (Number(status.weight) || 0) * units)}${note}`;
  }
  const value = ScoreCard(face, scoring).parts[id] || 0;
  const note = FORMULA_STATUSES.has(id) ? ' (set by a formula, not this box)' : decayNote;
  return `${EXAMPLE_STACKS} stacks = ${pts(value)}${note}`;
}

// ScoreCard's keyword value: flat, or the positive score times the multiplier, either held to `min`.
function keywordExample(id, scoring)
{
  const keyword = scoring.keywords?.[id];
  if (!keyword) return '';
  if (keyword.surchargeEnabled === false) return 'Surcharge disabled (0 pts)';
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

function rankExample(id, scoring, example)
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
      if (scoring.effectCount?.surchargeEnabled === false) return 'Surcharge disabled (0 pts)';
      const extra = Math.max(0, EXAMPLE_EFFECTS - (scoring.effectCount?.skipFirst ? 1 : 0));
      const weight = Number(scoring.effectCount?.weight) || 0;
      if (scoring.effectCount?.multiplier === true) return `${positiveLead(example)}: ${EXAMPLE_EFFECTS} effects = ${pts(example.positive * weight * extra)}`;
      return `${EXAMPLE_EFFECTS} effects = ${pts(weight * extra)}`;
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
  if (category.surchargeEnabled === false) return 'Surcharge disabled (0 pts)';
  const weight = Number(category.weight) || 0;
  if (category.multiplier) return `Positive score ${EXAMPLE_POSITIVE_SCORE}: ${signedPts(EXAMPLE_POSITIVE_SCORE * (weight - 1))}`;
  return `${label || id} card: ${signedPts(weight)}`;
}

// ScoreCard's tag value: weight once, or once per hit; multiplier tags scale the positive score.
function tagExample(id, scoring)
{
  const tag = scoring.tags?.[id];
  if (!tag) return '';
  if (tag.surchargeEnabled === false) return 'Surcharge disabled (0 pts)';
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

/**
 * Switch a cost, effect or status between flat (weight per unit) and multiplier form (P x weight per unit). On starts at weight 0
 * (no change); off goes back to the repo's flat weight, else 0. Off drops the flag unless the repo spells it out.
 */
export function SetWeightForm(entry, repoEntry, multiply)
{
  if (multiply)
  {
    entry.multiplier = true;
    entry.weight = 0;
    return;
  }
  if (repoEntry && 'multiplier' in repoEntry) entry.multiplier = false;
  else delete entry.multiplier;
  entry.weight = repoEntry && repoEntry.multiplier !== true && Number.isFinite(repoEntry.weight) ? repoEntry.weight : 0;
}

/** Switch a tag between flat (adds `weight`) and its multiplier: 'multiplier' starts at 1 (x1), 'pMultiplier' at 0. */
export function SetTagForm(tag, multKey, multiply)
{
  delete tag.multiplier;
  delete tag.pMultiplier;
  tag.weight = 0;
  if (multiply) tag[multKey] = multKey === 'multiplier' ? 1 : 0;
}
