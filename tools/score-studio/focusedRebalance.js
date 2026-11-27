// Pure focused editing: reuse the quota tuner's search, but opt out of its
// automatic drawbacks and shape changes. Reports always measure the result.
import { scoring as defaultScoring } from '../../src/content/generated/scoring.js';
import { TuneCardToTarget, TuneCardToTargetAsync, TuneItemToTarget } from '../../src/model/autoBalance.js';
import { GenerateCard, RankBand, RIDER_EFFECTS, GENERATOR_STANCES, SeededRandom } from '../../src/model/cardGenerator.js';
import { ScoreGeneratedItem } from '../../src/model/itemGenerator.js';
import { CardDefinitionToScoreFace } from '../../src/model/cardUpgradeCp.js';
import { ScoreCard, CombatPower, RankOf, CardName } from '../../src/model/combatPower.js';
import { EffectiveTier, ZeroCostUnlocked, NumericCeilingAtTier, StatusUnlocked, StatusMinTier, StatusStackCapAtTier, ElementUnlocked, ElementMinTier, HybridUnlocked, UpgradeKindUnlocked } from '../../src/model/tierUnlocks.js';
import { RefreshSubclassCard, SubclassCardText } from '../../src/model/subclassCardGenerator.js';
import { constantFormulaValue } from '../../src/model/formulas.js';
import { ProjectCardMechanicalValues } from '../../src/model/cardMechanicalProjection.js';

export const FOCUSED_EFFECTS = RIDER_EFFECTS;
export const FOCUSED_STANCES = GENERATOR_STANCES;
const clone = value => structuredClone(value);
const number = value => typeof value === 'number' && Number.isFinite(value);
const unique = values => [...new Set(Array.isArray(values) ? values : [])];
const OPS = { damage: 'damage', block: 'block', poise: 'poiseDamage', draw: 'draw', heal: 'heal', cleanse: 'removeStatus', restoreSp: 'restoreStamina', restoreMp: 'restoreMana', move: 'moveEngagement' };
const safeText = card => SubclassCardText(card.effects || [], card.keywords || []).replace(/Remove \{undefined\} ([\w-]+)/g, 'Remove $1');
const spell = card => card.camp === 'spell' || card.tags?.some(t => ['camp:spell', 'source:spell', 'maneuver:casting'].includes(t)) || card.damageSchool && card.damageSchool !== 'physical';
const title = word => word[0].toUpperCase() + word.slice(1);
const statusOf = id => typeof id === 'string' && id.startsWith('status:') ? id.slice(7) : null;
const matchesPreference = (effect, id) => statusOf(id) ? effect.op === 'applyStatus' && effect.status === statusOf(id) : effect.op === OPS[id];

/** Dynamic UI choices come only from the existing scored status catalog. */
export function focusedEffectOptions(scoring = defaultScoring) {
  const labels = { poise: 'Poise damage', restoreSp: 'Restore stamina', restoreMp: 'Restore mana' };
  return [...RIDER_EFFECTS.map(id => ({ id, label: labels[id] || title(id), kind: 'effect' })),
    ...Object.keys(scoring.statuses || {}).sort().map(id => ({ id: `status:${id}`, label: scoring.statuses[id].label || title(id.replace(/([a-z])([A-Z])/g, '$1 $2')), kind: 'status' }))];
}

function requestedMechanicGates(card, rank, scoring) {
  const tier = EffectiveTier(rank, card.rarity, scoring), reasons = [];
  for (const tag of card.tags || []) if (tag.startsWith('school:')) {
    const school = tag.slice(7), minimum = ElementMinTier(school, scoring);
    if (tier < minimum) reasons.push(`${title(school)} school requires effective tier ${minimum}; requested rank and rarity give tier ${tier}. Raise rank or rarity, or change the school.`);
  }
  for (const effect of [...(card.effects || []), ...(card.onTurnEndInHand || []), ...(card.effectVariants || []).flatMap(v => v.effects)]) {
    const status = effect.op === 'applyStatus' ? effect.status : effect.op === 'grantCardCharge' ? effect.buildupStatus : null;
    if (status && tier < StatusMinTier(status, scoring)) reasons.push(`${title(status)} requires effective tier ${StatusMinTier(status, scoring)}; requested rank and rarity give tier ${tier}.`);
  }
  if (card.magicShare > 0 && !HybridUnlocked(tier, scoring)) reasons.push(`Hybrid damage is unavailable at requested effective tier ${tier}.`);
  return unique(reasons);
}

export function focusedCardMetrics(card, { scoring = defaultScoring, faceOf } = {}) {
  const face = faceOf ? faceOf(card) : CardDefinitionToScoreFace(card, { scoring });
  const raw = ScoreCard(face, scoring).raw;
  const cp = CombatPower(raw, card.rarity || 'common', scoring);
  return { cp, rank: RankOf(cp, scoring), rarity: card.rarity || 'common', raw };
}

export function focusedChanges(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => !key.startsWith('_') && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(field => ({ field, before: clone(before[field]), after: clone(after[field]) }));
}

function settingsFor(entry, settings, metrics, scoring) {
  const rank = Number.isInteger(settings.targetRank) ? settings.targetRank : metrics.rank;
  const rarity = settings.targetRarity && settings.targetRarity !== 'keep' ? settings.targetRarity : entry.rarity || 'common';
  const errors = [];
  if (rank < 0 || rank > scoring.rank.maxRank) errors.push(`Rank ${rank} is outside 0..${scoring.rank.maxRank}.`);
  if (!(rarity in scoring.rarity.discount)) errors.push(`Unknown rarity '${rarity}'.`);
  for (const key of ['sp', 'mp']) if (settings[key] != null && (!Number.isInteger(settings[key]) || settings[key] < 0 || settings[key] > 3)) errors.push(`${key.toUpperCase()} must be an integer from 0 to 3.`);
  if (settings.effectCount != null && (!Number.isInteger(settings.effectCount) || settings.effectCount < 1 || settings.effectCount > 4)) errors.push('Effect count must be from 1 to 4.');
  if (settings.targetCp != null && !number(settings.targetCp)) errors.push('Combat Power must be a finite number.');
  const band = errors.length ? { min: metrics.cp, max: metrics.cp } : RankBand(rank, scoring);
  const rand = SeededRandom(`${settings.seed ?? 1}|${entry.id || entry.key}|${settings.reroll ?? 0}`);
  // Rerolls explore a rank's real CP band; an explicit CP remains fixed.
  const targetCp = number(settings.targetCp) ? settings.targetCp
    : settings.reroll > 0 ? band.min + Math.floor(rand() * (band.max - band.min + 1))
    : Number.isInteger(settings.targetRank) ? band.max : metrics.cp;
  return { rank, rarity, band, targetCp, errors, rand };
}

/** Return actionable gate failures using the candidate's measured rank. */
export function focusedCardConstraints(card, metrics, scoring = defaultScoring) {
  card = ProjectCardMechanicalValues(card).card;
  const tier = EffectiveTier(metrics.rank, card.rarity, scoring), errors = [];
  const sp = Number(card.staminaCost ?? card.cost ?? 0), mp = Number(card.manaCost ?? 0);
  if (!Number.isInteger(sp) || sp < 0 || sp > 3 || !Number.isInteger(mp) || mp < 0 || mp > 3) errors.push('Costs must be integers from 0 to 3.');
  if (sp === 0 && mp === 0 && !ZeroCostUnlocked(tier, scoring)) errors.push(`Zero total cost is locked at tier ${tier}.`);
  if (!spell(card) && mp > 0) errors.push('A martial card cannot gain a Mana cost.');
  const upper = value => {
    if (value === undefined) return 0;
    const constant = constantFormulaValue(value);
    if (number(constant)) return Math.max(0, constant);
    // An authored explicit max is a proven bound. Unbounded actor-dependent
    // formulas cannot be certified against a finite static tier ceiling.
    return number(value?.max) ? Math.max(0, value.max) : Infinity;
  };
  const payloads = [[...(card.effects || []), ...(card.onTurnEndInHand || [])], ...(card.effectVariants || []).map(variant => [...variant.effects, ...(card.onTurnEndInHand || [])])];
  for (const effects of payloads) {
    const totals = { damage: 0, block: 0 };
    for (const effect of effects) {
      if (effect.op in totals) totals[effect.op] += upper(effect.amount) * (effect.op === 'damage' ? Math.max(1, effect.hits || 1) : 1) * Math.max(1, upper(effect.repeat ?? 1));
      if (effect.op === 'grantCardCharge') for (const op of ['damage', 'block']) totals[op] += upper(effect[op]);
      if (effect.op === 'applyStatus' && (!StatusUnlocked(effect.status, tier, scoring) || upper(effect.stacks ?? 1) > StatusStackCapAtTier(effect.status, tier, scoring))) errors.push(`${effect.status} or its stack count is locked at tier ${tier}.`);
      if (effect.op === 'grantCardCharge' && effect.buildupStatus && upper(effect.buildup) > StatusStackCapAtTier(effect.buildupStatus, tier, scoring)) errors.push(`${effect.buildupStatus} charge exceeds its tier cap.`);
    }
    for (const op of ['damage', 'block']) if (totals[op] > NumericCeilingAtTier(op, tier, scoring)) errors.push(`${op} exceeds the tier ${tier} ceiling${Number.isFinite(totals[op]) ? '' : ' (dynamic formula has no finite authored maximum)'}.`);
  }
  for (const tag of card.tags || []) if (tag.startsWith('school:') && !ElementUnlocked(tag.slice(7), tier, scoring)) errors.push(`${tag} is locked at tier ${tier}.`);
  if (card.magicShare > 0 && !HybridUnlocked(tier, scoring)) errors.push(`Hybrid damage is locked at tier ${tier}.`);
  for (const keyword of card.keywords || []) if (['retain', 'innate'].includes(keyword) && !UpgradeKindUnlocked(`fx:${keyword}`, tier, scoring)) errors.push(`${keyword} is locked at tier ${tier}.`);
  return unique(errors);
}

function rider(card, id, seed, scoring) {
  // Generate the existing portable rider, then compose it with this card's
  // authored primary. High rank prevents the materializer dropping a rider.
  const generated = GenerateCard({ rank: Math.min(5, scoring.rank.maxRank), rarity: 'rare', cls: card.class || 'colorless', camp: spell(card) ? 'spell' : 'physical', type: card.type === 'attack' ? 'attack' : 'skill', seed, riders: [id], sp: 3, mp: spell(card) ? 3 : 0 }, { scoring, applyNaming: false });
  return generated.effects.find((effect, index) => index > 0 && matchesPreference(effect, id));
}

function preferredShape(card, settings, context, scoring, errors, warnings) {
  const effects = unique(settings.preferredEffects), stances = unique(settings.preferredStances);
  const requestedTier = EffectiveTier(context.rank, context.rarity, scoring);
  const eligible = [];
  for (const id of effects) {
    const status = statusOf(id);
    if (!RIDER_EFFECTS.includes(id) && !(status && Object.hasOwn(scoring.statuses || {}, status))) errors.push(`Unsupported preferred effect '${id}'.`);
    else if (status && !StatusUnlocked(status, requestedTier, scoring)) warnings.push(`${title(status)} requires effective tier ${StatusMinTier(status, scoring)}; requested rank and rarity give tier ${requestedTier}. Excluded from this reroll's palette.`);
    else eligible.push(id);
  }
  if (effects.length && !eligible.length && !errors.length) errors.push('No preferred effect is unlocked at the requested tier.');
  for (const id of stances) if (!GENERATOR_STANCES.includes(id)) errors.push(`Unsupported preferred stance '${id}'.`);
  if (errors.length) return false;
  const originalCount = card.effects.length, targetCount = settings.effectCount ?? originalCount;
  const countChanged = targetCount !== originalCount;
  let changed = false;
  if (targetCount < card.effects.length) { card.effects = card.effects.slice(0, targetCount); changed = true; }
  const reserved = (effect, index) => index === 0 || !countChanged && (effect.if || ['grantCardCharge', 'removeStatus'].includes(effect.op));
  const stancePool = stances.filter(stance => !['counter', 'evade', 'prepared'].includes(stance)
    || StatusUnlocked(stance, requestedTier, scoring) && (card.effects.some(e => e.op === 'applyStatus' && e.status === stance && e.target === 'self')
      || card.effects.length < targetCount || card.effects.some((effect, index) => !reserved(effect, index))));
  const selectedStances = stancePool.length ? [stancePool[Math.floor(context.rand() * stancePool.length)]] : [];
  if (stances.length && !stancePool.length) warnings.push('No preferred stance fits the current tier and protected effect slots; the current form is preserved.');
  else if (stances.length > 1) warnings.push(`This reroll selected ${selectedStances[0]} from ${stances.length} preferred stance options.`);
  const used = new Set();
  const nextSlot = () => {
    const index = card.effects.findIndex((effect, i) => !reserved(effect, i) && !used.has(i) && !selectedStances.includes(effect.status));
    return index >= 0 ? index : card.effects.length < targetCount ? card.effects.length : -1;
  };
  function place(effect, index) {
    if (!effect) { errors.push('The requested rider could not be materialized with existing mechanics.'); return; }
    card.effects[index] = clone(effect); used.add(index); changed = true;
  }
  for (const stance of selectedStances) if (['counter', 'evade', 'prepared'].includes(stance) && !card.effects.some(e => e.op === 'applyStatus' && e.status === stance && e.target === 'self')) {
    const index = nextSlot();
    if (index < 0) errors.push('Effect count leaves no secondary slot for the requested stance.');
    else place({ op: 'applyStatus', target: 'self', status: stance, stacks: 1 }, index);
  }
  const palette = eligible.filter(id => !card.effects.some((effect, i) => reserved(effect, i) && matchesPreference(effect, id)));
  let selected = 0;
  while (palette.length) {
    const index = nextSlot(); if (index < 0) break;
    const id = palette.splice(Math.floor(context.rand() * palette.length), 1)[0];
    const effect = rider(card, id, `${settings.seed ?? 1}:${settings.reroll ?? 0}:${id}`, scoring);
    if (effect?.op === 'applyStatus') effect.stacks = Math.min(effect.stacks, StatusStackCapAtTier(effect.status, requestedTier, scoring));
    place(effect, index); selected++;
  }
  if (eligible.length && selected < eligible.length) warnings.push(`Used ${selected} of ${eligible.length} preferred effect options; the remaining options stay in the reroll palette. Primary and unchanged signature slots are preserved.`);
  if (selectedStances.length) {
    const maneuver = selectedStances.find(s => !['evade', 'prepared'].includes(s));
    if (maneuver) { card.tags = [...(card.tags || []).filter(t => !t.startsWith('maneuver:')), `maneuver:${maneuver}`]; changed = true; }
    if (selectedStances.includes('evade')) { card.stanceTrigger = { stance: 'evade' }; changed = true; }
    else if (card.stanceTrigger?.stance === 'evade') { delete card.stanceTrigger; changed = true; }
  }
  const pool = RIDER_EFFECTS.filter(id => !card.effects.some(e => e.op === OPS[id]));
  while (card.effects.length < targetCount && pool.length) {
    const id = pool.splice(Math.floor(context.rand() * pool.length), 1)[0];
    place(rider(card, id, `${settings.seed ?? 1}:${settings.reroll ?? 0}:${id}`, scoring), card.effects.length);
  }
  return changed;
}

function scaleChoice(card) {
  // Keep the entire payload/condition; tune one existing numeric field.
  for (const op of ['damage', 'block', 'poiseDamage', 'heal', 'grantCardCharge', 'applyStatus', 'draw', 'restoreMana', 'restoreStamina']) {
    const index = card.effects.findIndex(e => e.op === op && (number(e.amount) || number(e.stacks) || op === 'grantCardCharge'));
    if (index < 0) continue;
    const effect = card.effects[index];
    const field = op === 'grantCardCharge' ? ['damage', 'block', 'heal', 'break', 'buildup', 'manaDiscount'].find(k => number(effect[k])) : op === 'applyStatus' ? 'stacks' : 'amount';
    if (field) return { index, field };
  }
  return null;
}

/** Both entry points share preparation, candidate order, and final reports. */
export function rebalanceCard(original, settings = {}, options = {}) {
  const flow = rebalanceCardFlow(original, settings, options);
  let step = flow.next();
  while (!step.done) step = flow.next(TuneCardToTarget(step.value.card, step.value.options));
  return step.value;
}

export async function rebalanceCardAsync(original, settings = {}, options = {}) {
  if (options.signal?.aborted || options.shouldCancel?.()) { const error = new Error('Rebalance cancelled'); error.name = 'AbortError'; throw error; }
  const flow = rebalanceCardFlow(original, settings, options);
  let step = flow.next();
  while (!step.done) step = flow.next(await TuneCardToTargetAsync(step.value.card, step.value.options, options));
  return step.value;
}

function* rebalanceCardFlow(original, settings = {}, { scoring = defaultScoring, faceOf } = {}) {
  const before = focusedCardMetrics(original, { scoring, faceOf }), context = settingsFor(original, settings, before, scoring);
  const errors = context.errors, warnings = [], base = clone(original);
  const requested = Number.isInteger(settings.targetRank) || settings.targetRarity && settings.targetRarity !== 'keep' || settings.targetCp != null || settings.effectCount != null || settings.sp != null || settings.mp != null || settings.preferredEffects?.length || settings.preferredStances?.length || settings.reroll > 0;
  let card = base;
  if (!errors.length && requested) {
    base.rarity = context.rarity;
    const shapeChanged = preferredShape(base, settings, context, scoring, errors, warnings);
    // Structural school/status gates cannot be solved by changing numbers or
    // costs. Stop before hundreds of combat previews for an impossible tier.
    errors.push(...requestedMechanicGates(base, context.rank, scoring));
    if (!errors.length) {
      const scaleField = scaleChoice(base);
      const tuned = yield { card: base, options: { targetRank: context.rank, targetRarity: context.rarity, targetCp: context.targetCp, fixedSp: settings.sp, fixedMp: settings.mp,
        scoring, faceOf: c => faceOf ? faceOf(c) : CardDefinitionToScoreFace(c, { scoring }), scaleField, magnitudeMax: 240, searchBudget: 320, maxManaCost: 3, coarseCostSearch: true,
        candidateBias: settings.reroll > 0 ? c => SeededRandom(`${settings.seed ?? 1}|${settings.reroll}|${JSON.stringify(c.effects)}|${c.staminaCost}|${c.manaCost}`)() * 3 : null,
        allowExtraEffects: false, allowHpDrawback: false,
        searchAllowed: c => !focusedCardConstraints(c, { rank: context.rank }, scoring).length,
        candidateAllowed: (c, score) => !focusedCardConstraints(c, { rank: score.rank }, scoring).length } };
      card = tuned.card;
      if (!tuned.legalCandidate) errors.push('No legal candidate satisfies the fixed shape and cost constraints.');
      if (shapeChanged) {
        try { card.textTemplate = safeText(card); delete card.faceTemplate; }
        catch { errors.push('This card has an authored effect whose text cannot be safely regenerated.'); }
      }
      if (original.id?.startsWith('subclass.')) card = RefreshSubclassCard(card, { scoring, rebuildText: true });
      else if (original.upgrade?.effects && !shapeChanged) {
        // Keep authored upgrade deltas aligned when only a base number changes.
        card.upgrade = clone(original.upgrade);
        for (let i = 0; i < (original.effects || []).length; i++) {
          if (card.upgrade.effects[i]?.op !== original.effects[i].op) continue;
          for (const [key, value] of Object.entries(card.effects[i] || {})) if (number(value) && number(original.effects[i][key]) && number(card.upgrade.effects[i][key])) card.upgrade.effects[i][key] += value - original.effects[i][key];
        }
      } else if (original.upgrade?.effects && shapeChanged) warnings.push('Authored upgrade effects were preserved; review them after changing the effect layout.');
    }
  }
  if ((card.effects || []).some(effect => ['amount', 'stacks', 'damage', 'block', 'buildup', 'heal', 'break'].some(field => effect[field] && typeof effect[field] === 'object'))) warnings.push('CP uses the authoring projection; state-dependent formula values still depend on combat context.');
  if (settings.generateNames && !errors.length) {
    card.name = CardName(faceOf ? faceOf(card) : CardDefinitionToScoreFace(card, { scoring }), 0, scoring); card._autoName = true;
    if (card.upgrade?.name) card.upgrade.name = `${card.name}+`;
  } else card.name = original.name;
  const metrics = focusedCardMetrics(card, { scoring, faceOf });
  errors.push(...focusedCardConstraints(card, metrics, scoring));
  if (metrics.rank !== context.rank) errors.push(`Measured Rank ${metrics.rank}; requested Rank ${context.rank}.`);
  if (number(settings.targetCp) && metrics.cp !== settings.targetCp) errors.push(`Measured CP ${metrics.cp}; requested CP ${settings.targetCp}.`);
  if (settings.effectCount != null && card.effects?.length !== settings.effectCount) errors.push(`Measured ${card.effects?.length || 0} effects; requested ${settings.effectCount}.`);
  for (const [setting, field] of [['sp', 'staminaCost'], ['mp', 'manaCost']]) if (settings[setting] != null && Number(card[field] ?? (setting === 'sp' ? card.cost : 0)) !== settings[setting]) errors.push(`${setting.toUpperCase()} differs from the fixed requested cost.`);
  if (metrics.cp !== context.targetCp && !number(settings.targetCp)) warnings.push(`Closest measured CP is ${metrics.cp}; search target was ${context.targetCp}.`);
  if (errors.length) errors.push(...requestedMechanicGates(card, context.rank, scoring));
  return { card, metrics, changes: focusedChanges(original, card), warnings, feasible: !errors.length, constraintErrors: unique(errors) };
}

export function rebalanceItem(original, settings = {}, { scoring = defaultScoring, rules = {} } = {}) {
  const before = ScoreGeneratedItem(original, scoring, rules);
  const context = settingsFor(original, settings, { cp: before.cp, rank: before.rank }, scoring), errors = context.errors, warnings = [];
  let item = clone(original);
  if (!errors.length && (settings.targetRank !== 'keep' && Number.isInteger(settings.targetRank) || settings.targetRarity && settings.targetRarity !== 'keep' || number(settings.targetCp) || settings.reroll > 0)) {
    item = TuneItemToTarget(original, { targetRank: context.rank, targetRarity: context.rarity, targetCp: context.targetCp, applyNaming: !!settings.generateNames, scoring, rules }).entry;
  }
  if (!settings.generateNames) {
    item.name = original.name;
    if (item.raw && original.raw) { if (Object.hasOwn(original.raw, 'name')) item.raw.name = original.raw.name; else delete item.raw.name; }
  }
  const measured = ScoreGeneratedItem(item, scoring, rules), metrics = { cp: measured.cp, rank: measured.rank, rarity: item.rarity || 'common', raw: measured.raw };
  if (settings.generateNames && !errors.length) { item.name = measured.convention.name; if (item.raw) item.raw.name = item.name; }
  if (metrics.rank !== context.rank) errors.push(`Measured Rank ${metrics.rank}; requested Rank ${context.rank}.`);
  if (number(settings.targetCp) && metrics.cp !== settings.targetCp) errors.push(`Measured CP ${metrics.cp}; requested CP ${settings.targetCp}.`);
  return { item, metrics, changes: focusedChanges(original, item), warnings, feasible: !errors.length, constraintErrors: unique(errors) };
}
