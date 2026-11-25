import { ApplyGearCardRules, GearAlwaysOn } from './gearEffects.js';
import { t } from './strings.js';
import { projectGameCard } from './gameProfile.js';
import { configuredModule } from './profileModule.js';
import { CardSpellTraditions, SpellTraditionLabel } from './spellTraditions.js';
import { FaceCostProfile } from './faceCosts.js';
import { evadeStackGainPhrase } from './fixCoreMechanics.js';
import { core2MultiHitRulesEnabled } from './core2ActionPolicy.js';
import { SpellScalingValue, SpellTraditionsActive } from './spellTraditions.js';
// src/model/playingCard.js — what a playing card IS, with no opinion about
// how it looks.
//
// WHY THIS EXISTS, AND WHY IT IS THIS SHAPE. Equipment has had a model since
// its face was built: `src/model/equipmentCard.js` projects a piece into
// `{ id, name, type, facts, bonuses, tags, flavor, requirement, rarity }` and
// `renderEquipmentCard` draws that and nothing else. The playing card — the
// most-drawn object in the game, and the one on every surface the card series
// has been correcting — never got the same treatment. `renderCard` resolved
// the definition, the tag junction, the cost profile, the type presentation
// and the class tint INSIDE the function that writes innerHTML, so the answer
// to "what is this card" existed only as a side effect of drawing one.
//
// That is why five renderers could not share anything: there was nothing to
// share. A view can be swapped; a projection tangled into a view cannot.
//
// THE LINE THIS FILE HOLDS: the model says WHAT A CARD IS, the view says HOW
// IT READS. So the filled text template — which escapes, wraps changed numbers
// in `.val.up` / `.val.down`, and colours keywords — stays in the view where
// the other HTML lives; this file hands over the TOKENS that fill it and the
// base to compare against, which is the data half of that same job. The same
// line is why `accent`, `color` and `radius` appear here as VALUES and never
// as CSS: a number a designer authored is data; the property it is assigned to
// is presentation.
//
// PURE AND FROZEN, like every model beside it: no DOM, no callbacks, no live
// run object retained. Everything is read at call time and the result is deep
// frozen, so a renderer cannot quietly make the model its scratch space.

import { cardTagExplanation } from './cardTagExplanation.js';
import { coreSmashClause } from './smashClause.js';
import { cardClassification } from './cardClassification.js';
import { resolveCard } from './registries.js';
import { applyCombatExpansionCard } from '../content/combatExpansionCards.js';
import { applyCardTraits } from '../content/traitProjection.js';
import { tagService } from './tagService.js';
import { ParseUpgradeTag, UpgradeTagLabel } from './combatPower.js';
import { computeTokenBindings, cardTokenEffects } from './validate.js';

/** A stance as it reads in a condition: "Idle", "in Defense", "in Prepared". */
const STANCE_WORDS = Object.freeze({ idle: 'Idle', casting: 'in Prepared', prepared: 'in Prepared', defend: 'in Defense', defense: 'in Defense' });
const stanceWords = stance => STANCE_WORDS[stance] || `in ${stance}`;

/** A card's `playIf` as a short face line ("Only at Reach"), or null when the face has no words for it. */
export function PlayConditionPhrase(pred) {
  if (pred?.p === 'atRange') return `Only at ${pred.range[0].toUpperCase()}${pred.range.slice(1)}`;
  if (pred?.p === 'inStance') return `Only ${['target', 'enemy'].includes(pred.of) ? 'while the target is' : 'while'} ${stanceWords(pred.stance)}`;
  return null;
}
import { wardReadsAsPoise, poiseMergeGroups } from './wardOffCardText.js';
import { balance } from '../content/balance.js';
import { combatProfileFor, isSpellCard, ScaleCardBaseDamage, ScalePhysicalDamage } from './combatCardProfile.js';
import { spellDefenseSplit } from './spellDefense.js';
import { uiStrings } from '../content/generated/uiStrings.js';
import { effectiveD20Percent } from './d20Chance.js';
import { canonicalDamageType, isMagicDamageType, isPhysicalDamageType, magicDamageTypeOf, magicShareOf, PacketSplit, PacketWeights, splitContactParts, splitDamageTypesOf, BarrierPoisePerStack, BarrierPoiseFactor, IsFinesseHit } from './combatRatings.js';
import { cardSigilIdentity } from '../content/combatSigils.js';
import { resolve as resolveTags } from '../content/tags.js';
import { constantFormulaValue, describeFormula } from './formulas.js';
import { gameProfileEffectiveAttributes } from './gameProfileGear.js';
import { cardIsMagical } from './attackCardDamage.js';
import { ChannelWeight } from './damageChannels.js';
import { ResolveCarrierDamageType } from './carrierDamageType.js';

const freeze = (value) => Object.freeze(value);
const HOSTILE_HP_LOSS = Object.freeze({
  enemy: 'Target loses', allEnemies: 'All enemies lose', randomEnemy: 'A random enemy loses',
  otherEnemy: 'Another enemy loses', otherEnemies: 'Other enemies lose',
});

/** Shared wording and polarity for HP loss on a card face or in its summary. */
export function CardHpLossWording(effect, amount) {
  const hostile = HOSTILE_HP_LOSS[effect.target];
  if (hostile) return { hostile: true, text: `${hostile} ${amount} HP (ignores Block)` };
  const prefix = effect.target === 'allAllies' ? 'All allies lose'
    : effect.target === 'ally' ? 'Ally loses' : effect.offering ? 'Offer' : 'Pay';
  const suffix = effect.nonlethal && effect.offering ? ' (leave at least 1 HP)' : '';
  return { hostile: false, text: `${prefix} ${amount} HP${suffix}` };
}

/** Actual damage labels; a spell's school never substitutes for its damage. */
// A uiStrings row with its {tokens} filled in. The row is the only copy of the sentence.
function uiText(id, tokens) {
  const row = uiStrings.find(entry => entry.id === id);
  if (!row || !row.short) throw new Error(`uiStrings row '${id}' has no short form`);
  return row.short.replace(/\{(\w+)\}/g, (match, key) => (key in tokens ? String(tokens[key]) : match));
}

// The split of a hit of `amount` from this card, or null when the card is whole magic or whole physical:
// its magic share strictly between 0 and 1 (a carrier's own, else the configured damage type's, else its camp).
// `ratings` is the run's configured combat ratings (registries.balance.combatRatings), the rules combat reads.
// `live` is the previewed value: its splitBase and ratingBonus split the amount exactly as the contacts do
// (the card's own damage, then the rating bonus typed by its category). Without them the whole amount splits.
export function splitOf(def, profile, amount, ratings = null, live = null) {
  const carrier = { ...profile, magicShare: def.magicShare, physicalDamageType: def.physicalDamageType ?? live?.physicalDamageType };
  const share = magicShareOf(carrier, ratings);
  if (!(share > 0 && share < 1) || !Number.isFinite(amount)) return null;
  const parts = splitContactParts({ amount, base: live?.splitBase ?? amount, ratingBonus: live?.ratingBonus ?? 0,
    ratingPart: live?.ratingPart ?? null, share, primary: profile.camp === 'spell' ? 'magic' : 'physical' });
  return { magic: parts.magic, physical: parts.physical, types: splitDamageTypesOf(carrier) };
}

export function combatCardDamageLabel(def, preview = null, registries = null, index = null) {
  const service = registries && tagService(registries);
  let contacts = index === null ? (def.effects || []).flatMap((effect, at) =>
    effect.op === 'damage' ? [{ effect, live: preview?.values?.[at] }] : [])
    : [{ effect: def.effects?.[index], live: preview?.values?.[index] }];
  if (!contacts.length) contacts = (preview?.values || []).filter(row => row.op === 'damage').map(live => ({ live }));
  if (!contacts.length) contacts = [{}];
  const authored = def.cardTags ?? def.tags ?? (service ? service.idsOf('card', def)
      : combatProfileFor(def).damageType ? [`damage:${combatProfileFor(def).damageType}`] : []);
  const tags = contacts.flatMap(({ effect, live }) => {
    if (live?.op === 'damage' && Array.isArray(live.tags)) return live.tags;
    const attack = effect?.attack ?? def.attack;
    return attack?.components ? attack.components.map(component => `damage:${component.type}`)
      : attack?.damageType ? [`damage:${attack.damageType}`] : authored;
  });
  const ids = [...new Set(tags.filter(tag => tag.startsWith('damage:')))];
  const resolve = list => (service ? service.resolve(list) : resolveTags(list)).map(tag => tag.label);
  // A hit that is all magic but carries a physical damage tag (lightning with piercing) names both: its magic type, then the physical.
  const carrier = { ...combatProfileFor(def), magicShare: def.magicShare, physicalDamageType: def.physicalDamageType };
  const magicType = magicDamageTypeOf(carrier);
  const typeOf = id => canonicalDamageType(id.slice('damage:'.length));
  const physical = ids.filter(id => isPhysicalDamageType(typeOf(id)));
  if (magicType && physical.length && !ids.some(id => isMagicDamageType(typeOf(id)))
    && magicShareOf(carrier, registries?.balance?.combatRatings ?? null) >= 1) {
    return uiText('combat.card.magicPhysicalDamage', { magic: resolve([`damage:${magicType}`]).join(''), physical: resolve(physical).join('/') });
  }
  return resolve(ids).join('/');
}

export function combatCardType(def) {
  const classification = cardClassification(def);
  const type = (classification.stanceType !== 'prepare' && classification.stanceType) || (classification.cardCategory === 'curse' ? 'status' : classification.cardCategory);
  return type[0].toUpperCase() + type.slice(1);
}

/** The same profile-aware type identity for a card face and compact list rows. */
export function CardPresentationSigils(def, { registries = null, rules = null, preview = null } = {}) {
  // Saved profiles retain their historical shared scaling and generic label.
  // A catalog without a selected profile describes the current rules.
  const context = CardPresentationContext(def, preview, rules);
  const presentationRules = context?.gameProfile || context?.fixCoreRules ? context
    : registries?.gameProfile ? { gameProfile: registries.gameProfile } : null;
  const profile = combatProfileFor(def);
  const identity = cardSigilIdentity(combatCardType(def), profile);
  if (presentationRules && !SpellTraditionsActive(presentationRules)
    || identity.action !== 'spell' && profile.camp !== 'spell') return identity;
  const card = { ...def, combatProfile: profile };
  return freeze({ ...identity, traditions: freeze(CardSpellTraditions(card)), displayLabel: SpellTraditionLabel(card) });
}

/** Live saved policy plus the matching quote's detached baseline metadata. */
export function CardPresentationContext(def, preview = null, rules = null) {
  const face = preview?.faceRules;
  if (!rules) return face ?? null;
  if (!face?.faceDefinition || face.faceDefinition.id !== def.id) return rules;
  // The live host owns saved policy. The matching quote owns its detached,
  // pre-Gear baseline, including the selected branch, rank and always-on stats.
  const context = { ...rules };
  for (const key of ['faceDefinition', 'faceAttributes', 'gearRules', 'gearState']) {
    if (Object.hasOwn(face, key)) context[key] = face[key];
  }
  return context;
}

/**
 * The shared read of one card for its text: the numbers a preview or the authored
 * definition gives each effect (`value`), the status display name (`title`), the
 * predicate phrase (`condition`), the combat profile, the token bindings and the
 * static tokens. Every card-face text model reads through this one context.
 */
export function cardSummaryContext(def, preview = null, registries = null, rules = null) {
  const bindings = computeTokenBindings(def.effects || []), tokens = staticCardTokens(def, registries, CardPresentationContext(def, preview, rules));
  const value = (effect, index, field = 'amount') => {
    const token = bindings.find(row => row.index === index && row.field === field)?.token;
    const live = preview?.values?.[index];
    // Barrier stacks read as the Poise they give (owner, 2026-11-15): tokens are already scaled, live values and literals are not.
    const factor = BarrierPoiseFactor(effect, registries), scale = amount => typeof amount === 'number' ? amount * factor : amount;
    return preview?.tokens?.[token] ?? scale(live?.op === effect.op ? live.value : undefined)
      ?? tokens[token] ?? scale(typeof effect[field] === 'number' ? effect[field] : '?');
  };
  const defenseValue = (effect, index) => {
    const live = preview?.values?.[index];
    if (live?.defenseSplit) return live.defenseSplit;
    const token = bindings.find(row => row.index === index && row.field === 'amount')?.token;
    const block = preview?.tokens?.[token + '.block'], ward = preview?.tokens?.[token + '.ward'];
    return Number.isFinite(block) && Number.isFinite(ward) ? { block, ward } : null;
  };
  const title = id => registries?.statuses?.has(id) ? registries.statuses.get(id).name : id[0].toUpperCase() + id.slice(1);
  const condition = pred => {
    if (!pred) return '';
    if (pred.p === 'hasStatus') return `${pred.of === 'self' ? 'you have' : pred.of === 'allEnemies' ? 'an enemy has' : 'the target has'} ${title(pred.status)}`;
    if (pred.p === 'hasBlock') return `${pred.of === 'self' ? 'you' : 'the target'} ${pred.of === 'self' ? 'have' : 'has'} Block${pred.snapshot === 'beforePlay' ? ' before this card' : ''}`;
    if (pred.p === 'hpBelowPct') return `${pred.of === 'self' ? 'your' : 'target'} HP is at most ${pred.pct}%`;
    if (pred.p === 'firstCardThisTurn') return 'this is your first card this turn';
    if (pred.p === 'inStance') return `${['target', 'enemy'].includes(pred.of) ? 'the target is' : 'you are'} ${stanceWords(pred.stance)}`;
    if (pred.p === 'atRange') return `the target is at ${title(pred.range)}`;
    if (pred.p === 'turnMetric') {
      const names = { cardsPlayed: 'cards played', attacksPlayed: 'attacks played', manaSpent: 'Mana spent', hpLostSinceTurnStart: 'HP lost', discarded: 'cards discarded', offeringsPaid: 'offerings paid', previousSpell: 'previous Spell', sameCardPlays: 'plays of this card', cardPlaysCombat: 'cards played this combat' };
      const threshold = [pred.atLeast !== undefined ? `at least ${pred.atLeast}` : '', pred.atMost !== undefined ? `at most ${pred.atMost}` : ''].filter(Boolean).join(' and ');
      if (!threshold) return '';
      if (pred.metric === 'sameCardPlays' && pred.cardId && pred.cardId !== def.id) return '';
      if (pred.metric === 'turnStartHpPct') return `you began this turn with HP ${threshold}%`;
      if (pred.metric === 'hpLostSinceTurnStart') return `HP lost ${threshold} since your previous turn began`;
      const name = names[pred.metric] || (['tagPlays', 'distinctTagPlays'].includes(pred.metric) && pred.tag
        ? `${pred.metric === 'distinctTagPlays' ? 'distinct ' : ''}${pred.tag} card${pred.metric === 'distinctTagPlays' ? ' IDs' : 's'} played` : null);
      if (!name) return '';
      if (pred.metric === 'previousSpell' && pred.atLeast === 1) return 'your previous card this turn was a Spell';
      return `${name} ${threshold}${pred.metric === 'cardPlaysCombat' ? '' : ' this turn'}`;
    }
    if (pred.p === 'chargeAvailable') return 'its prepared charge is available';
    if (pred.p === 'not') { const text = condition(pred.pred); return text ? `not (${text})` : ''; }
    if (['all', 'any'].includes(pred.p)) { const parts = pred.preds.map(condition); return parts.every(Boolean) ? parts.join(pred.p === 'all' ? ' and ' : ' or ') : ''; }
    return '';
  };
  // Ward off (Core 2): Ward damage reads as Poise damage, merged with the card's other Poise damage (wardOffCardText.js).
  const poiseMerge = wardReadsAsPoise(registries) ? poiseMergeGroups(def.effects) : null;
  return { value, defenseValue, title, condition, profile: combatProfileFor(def), bindings, tokens, poiseMerge };
}

/**
 * The per-hit [min, max] HP loss across every living enemy for a card that strikes them all, or null when the card does not,
 * has one living enemy, or every enemy loses the same on every hit (the face then states one number).
 */
export function AllEnemySpread(live) {
  const rows = live?.faceTargetHitDamages;
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const hits = Math.max(...rows.map(row => row.length));
  if (!(hits > 0)) return null;
  const ranges = Array.from({ length: hits }, (_, at) => { const column = rows.map(row => row[at] ?? 0); return [Math.min(...column), Math.max(...column)]; });
  return ranges.every(range => range[0] === range[1]) && rows.every(row => row.every((amount, at) => amount === rows[0][at])) ? null : ranges;
}

/** Plain complete effect text. Numeric values come from the resolved preview. */
export function combatCardSummary(def, preview = null, registries = null, rules = null) {
  const { value, defenseValue, title, condition, profile: p, poiseMerge } = cardSummaryContext(def, preview, registries, rules);
  const ratings = registries?.balance?.combatRatings ?? null, parts = [];
  for (const [index, effect] of (def.effects || []).entries()) {
    // A card with named modes (model/cardChoices.js) says its modes once, where its first moded effect stands.
    if (effect.mode && def.choiceModes?.length) {
      if (index === def.effects.findIndex(row => row.mode)) parts.push(`Choose: ${def.choiceModes.map(mode => mode.name).join(' or ')}`);
      continue;
    }
    const n = value(effect, index), area = effect.target === 'allEnemies' ? ' to all enemies'
      : effect.target === 'randomEnemy' ? ' to a random enemy' : effect.target === 'otherEnemy' ? ' to another enemy' : '';
    let text;
    switch (effect.op) {
      case 'damage': {
        const live = preview?.values?.[index], hits = live?.hits ?? effect.hits ?? 1;
        if (typeof hits !== 'number') return null;
        const sequence = live?.faceHitDamages && hits > 0 ? live.faceHitDamages : live?.hitDamages;
        const sequenceTotal = sequence === live?.hitDamages ? live?.totalDamage : sequence?.reduce((sum, amount) => sum + amount, 0);
        const unequal = sequence?.length > 1 && sequence.some(amount => amount !== sequence[0]);
        const spread = AllEnemySpread(live);
        const type = combatCardDamageLabel(def, preview, registries, index);
        const word = `${type ? `${type} ` : ''}damage`;
        // A hit part magic and part physical reads both parts, the physical first, and keeps its hit count.
        const split = !unequal && !spread ? splitOf(def, p, n, ratings, live) : null;
        const range = r => r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`;
        const damage = spread ? (spread.every(r => range(r) === range(spread[0])) ? `${range(spread[0])} ${word}${spread.length !== 1 ? ` ×${spread.length}` : ''}` : `${spread.map(range).join(' + ')} ${word}`)
          : split ? uiText('combat.card.splitDamage', { amount: n, physical: split.physical, physicalType: split.types.physical, magic: split.magic, magicType: split.types.magic }) + (hits !== 1 ? ` ×${hits}` : '')
          : unequal ? `${sequence.join(' + ')} ${word} (${sequenceTotal} total across ${sequence.length} hits)`
          : `${n} ${word}${hits !== 1 ? ` ×${hits}` : ''}`;
        text = `${p.maneuver === 'counter' ? 'Return' : 'Deal'} ${damage}${area}`; break;
      }
      case 'block': {
        const verb = effect.target === 'ally' ? 'Ally gains' : 'Gain';
        const defense = def.defenseRulesVersion === 2 || def.minCombatExpansionVersion === 2
          ? (defenseValue(effect, index) || spellDefenseSplit({ ...def, combatProfile: p }, n)) : null;
        const split = defense || splitOf(def, p, n, ratings);
        text = split ? uiText('combat.card.splitBlock', { verb, block: defense ? defense.block : split.physical, ward: defense ? defense.ward : split.magic }) : `${verb} ${n} Block`;
        break;
      }
      // Barrier is a stacked status (SPEC 4.1a): the figure is its stacks.
      case 'gainBarrier': {
        text = `${effect.target === 'ally' ? 'Ally gains' : 'Gain'} ${n} Poise`;
        break;
      }
      case 'gainWard': text = `Restore ${n} Ward${effect.oncePerCombat ? ' once per combat' : ''}`; break;
      case 'gainPoise': text = `Gain ${n} Poise guard`; break;
      case 'buildup': text = `Add ${n} ${title(effect.status)} buildup${area}${effect.chance !== undefined && effectiveD20Percent(effect.chance) > 0 && effectiveD20Percent(effect.chance) < 100 ? ` (${effectiveD20Percent(effect.chance)}%)` : ''}`; break;
      case 'applyStatus': {
        if (['invulnerability', 'decoy', 'grounded', 'sleep'].includes(effect.status)) return null;
        if (effect.duration !== undefined && typeof effect.duration !== 'number') return null;
        if (effect.status === 'barrier' && effect.target === 'self') { const stacks = value(effect, index, 'stacks'); text = `Gain ${stacks} Poise`; break; }
        text = `${effect.target === 'self' ? 'Gain' : 'Apply'} ${value(effect, index, 'stacks')} ${title(effect.status)}${effect.target === 'enemy' ? ' to target' : effect.target === 'ally' ? ' to an ally' : area}${effect.duration !== undefined ? ` for ${effect.duration} turns` : ''}`;
        if (effect.status === 'concealed') {
          const explanation = registries?.statuses?.has(effect.status) && registries.statuses.get(effect.status).tooltip;
          if (!explanation) return null;
          text += `. ${explanation.replace(/\.$/, '')}`;
        }
        break;
      }
      case 'removeStatus': text = `Remove ${effect.amount === undefined ? 'all' : n} ${title(effect.status)}${effect.target === 'enemy' ? ' from target' : effect.target === 'ally' ? ' from an ally' : area}`; break;
      case 'draw': text = `Draw ${n}`; break;
      case 'discard': text = `${effect.choose ? 'Choose and discard' : 'Discard'} ${n}${effect.random ? ' at random' : ''}`; break;
      case 'heal': text = `Heal ${effect.target === 'ally' ? 'an ally for ' : ''}${n} HP`; break;
      case 'loseHp': text = CardHpLossWording(effect, n).text; break;
      case 'gainEnergy': text = `Gain ${n} Stamina`; break;
      case 'restoreMana': text = `Restore ${n} Mana`; break;
      case 'restoreStamina': text = `Restore ${n} Stamina`; break;
      case 'restorePoise': text = `Restore ${n} Poise`; break;
      case 'applyReflect': text = `Gain ${n} Reflect`; break;
      case 'poiseDamage': case 'wardDamage': {
        const merged = poiseMerge?.get(index);
        if (merged && !merged.leader) continue; // its figure is in the leader's combined Poise
        const figure = merged ? merged.indices.map(i => value(def.effects[i], i)) : [n];
        if (figure.some(amount => typeof amount !== 'number')) return null;
        text = `${p.maneuver === 'counter' ? 'Return' : 'Deal'} ${figure.reduce((sum, amount) => sum + amount, 0)} ${merged || effect.op === 'poiseDamage' ? 'Poise' : 'Ward impact'}${area}`; break;
      }
      case 'retain': text = `Retain ${n}`; break;
      case 'grantRollMode': text = `Next ${effect.roll}: ${effect.advantage ? 'Advantage' : 'Disadvantage'}`; break;
      case 'enterStance': text = effect.choose ? 'Choose a stance' : `Enter ${registries?.stances?.has(effect.stance) ? registries.stances.get(effect.stance).name : effect.stance}`; break;
      case 'swapRows': text = 'Swap its row with the nearest enemy in the other row'; break;
      case 'pullEnemy': text = 'Remove a Retreat stack from it; with none left it comes forward to the front row'; break;
      case 'moveEngagement': {
        if (![-1, 1].includes(effect.bands) || !['enemy', 'pendingAttacker', 'self'].includes(effect.target)
          || Object.keys(effect).some(key => !['op', 'target', 'bands', 'if'].includes(key))) return null;
        if (effect.target === 'self') { text = effect.bands < 0 ? 'Advance' : 'Retreat foes'; break; }
        const target = effect.target === 'pendingAttacker' ? 'attacker' : 'target';
        text = effect.bands < 0 ? `Close 1 band toward ${target}` : `Retreat 1 band from ${target}`;
        break;
      }
      case 'addCard': text = `Add ${effect.count || 1} ${registries?.cards?.has(effect.card) ? registries.cards.get(effect.card).name : effect.card} to ${effect.pile || 'hand'}`; break;
      case 'grantCardCharge': {
        const bonuses = Object.entries({ damage: 'damage', block: 'Block', heal: 'healing', break: 'Poise', buildup: `${effect.buildupStatus || ''} buildup`, manaDiscount: 'Mana discount' })
          .filter(([key]) => effect[key] !== undefined).map(([key, label]) => key === 'manaDiscount'
            ? `${value(effect, index, key)} less Mana (min 0)` : `+${value(effect, index, key)} ${label}`);
        const match = [effect.cardType, effect.abilityKind, effect.cardTag].filter(Boolean).join(' ');
        text = `Next ${match || 'matching card'} this turn: ${bonuses.join(', ')}; cannot stack with itself`; break;
      }
      default: return null; // Keep authored descriptions for complex effects.
    }
    if (effect.if) { const prefix = condition(effect.if); if (!prefix) return null; text = `If ${prefix}: ${text[0].toLowerCase() + text.slice(1)}`; }
    if (text.includes('?')) return null; // Unresolved formulas keep their authored tokens.
    if (effect.oncePerTurn) text += ' once per turn per family';
    parts.push(text);
  }
  if (p.maneuver === 'counter') {
    const payload = def.counterPayload || {}, returns = [];
    const wardOff = Boolean(poiseMerge);
    let poiseReturn = 0;
    for (const [key, label, op] of [['hp', 'damage', 'damage'], ['poise', 'Poise', 'poiseDamage'], ['ward', 'Ward', 'wardDamage']]) {
      if (def.effects.some(effect => effect.op === op)) continue;
      const live = preview?.values?.find(row => row.op === op)?.value;
      const amount = live ?? payload[key];
      const type = key === 'hp' ? combatCardDamageLabel(def, preview, registries) : '';
      if (wardOff && key !== 'hp') { if (typeof amount === 'number' && amount > 0) poiseReturn += amount; continue; } // Ward drains Poise
      if (typeof amount === 'number' && amount > 0) returns.push(`${amount} ${type ? `${type} ` : ''}${label}`);
    }
    if (poiseReturn > 0) returns.push(`${poiseReturn} Poise`);
    if (returns.length) parts.push(`Return ${returns.join(' + ')}`);
    if (def.pronePoiseBonus) parts.push(`+${def.pronePoiseBonus} Poise while Prone`);
  }
  if (def.evade) parts.push(`${def.evade.whileStatus ? `While ${title(def.evade.whileStatus)}: ` : ''}Prepare one Evade${def.evade.advantage ? ' with Advantage' : ''}`);
  const smashClause = coreSmashClause(def, registries, rules ?? preview?.faceRules ?? null);
  if (smashClause) parts.push(smashClause.replace(/\.$/, ''));
  if (def.comboHook) return null;
  if (def.usableWhile?.length) parts.unshift(`Usable through ${def.usableWhile.map(title).join(', ')}`);
  if (PlayConditionPhrase(def.playIf)) parts.unshift(PlayConditionPhrase(def.playIf));
  for (const keyword of def.keywords || []) if (['exhaust', 'retain', 'ethereal', 'innate'].includes(keyword)) parts.push(keyword[0].toUpperCase() + keyword.slice(1));
  return parts.length ? `${parts.join('. ')}.` : null;
}

/**
 * The numbers a card's own template substitutes, before any live preview.
 * The shared token binder reads the definition. A supplied run profile
 * supplies the applicable base-damage scale.
 *
 * `card.js` keeps exporting `staticTokens` as a re-export of this, because
 * five files import that name and a rename would be churn that proves nothing.
 */
// `rules` is the run's snapshotted rules (run.gameProfile) for faces outside combat; it wins over the current registries' profile.
/** The always-on attributes for a static face: `rules` is the run (deck + profile pin), a combat (its player's base live stats), or a preview's faceRules; none otherwise. */
function faceAttributes(registries, rules) {
  if (rules?.faceAttributes) return rules.faceAttributes;
  // A combat (e.g. the draw or spent pile viewer) carries the player's always-on attributes on its live stats, as previewCard's faceRules do.
  if (rules?.gameProfile && rules.player && !Array.isArray(rules.deck)) return rules.player.liveStats?.base?.attributes ?? rules.player.attributes ?? null;
  if (!rules?.gameProfile || !Array.isArray(rules.deck) || !registries) return null;
  try { return gameProfileEffectiveAttributes(registries, rules); } catch { return null; }
}
/** The card's combat profile with an untyped damage type resolved from the face holder's wielded armament (run or combat loadout). */
function faceDamageProfile(def, registries, rules) {
  const profile = { ...(combatProfileFor(def) || {}), ...(def?.combatProfile || {}) };
  const loadout = rules?.loadout;
  if (!loadout || !registries) return profile;
  const classId = rules.classId ?? (Array.isArray(rules.deck) ? rules.class : rules.player?.classId);
  const carrier = { tags: def.cardTags ?? def.tags, attack: def.attack, damageSchool: def.damageSchool, sourceArmamentId: def.sourceArmamentId,
    sourceHand: def.sourceHand, combatProfile: profile };
  try { return ResolveCarrierDamageType(carrier, registries, loadout, classId).combatProfile; } catch { return profile; }
}
export function staticCardTokens(def, registries = null, rules = null) {
  const tokens = {};
  // A live definition already contains combat Gear and charged effects. Compare it with
  // the same selected card before that projection, retaining its rank and upgrades.
  if (rules?.faceDefinition && rules.faceDefinition.id === def.id) def = rules.faceDefinition;
  // Owner, 2026-11-18: always-on gear (a Sword's +1, a Heavy set's Block) is in the baseline face; triggered gear is not (it colours in the fight).
  const gear = rules?.gearRules ? { rules: rules.gearRules, state: rules.gearState || {} } : rules?.loadout ? GearAlwaysOn(registries, rules) : null;
  if (gear?.rules.length) def = ApplyGearCardRules(gear.rules, def, gear.state);
  // Keep any saved combat policy with the always-on attributes; an explicit profile pin wins over the registries' own.
  const holder = rules?.gameProfile ? rules : rules?.faceAttributes && registries?.gameProfile ? { ...rules, gameProfile: registries.gameProfile } : null;
  const effects = cardTokenEffects(def);
  const baseDamageMultiplier = holder ? configuredModule(holder, 'effects')?.baseDamageMultiplier : undefined;
  // Owner, 2026-11-18: the player's side scale (`effects.playerDamageMultiplier`) shows on the face too: floored, never 0 for a positive hit (the receipt's side-damage-scale stage).
  const playerMultiplier = holder ? configuredModule(holder, 'effects')?.playerDamageMultiplier : undefined;
  // A Counter's damage is its armed base: its return is final damage and takes no side scale (the receipt's flat-return rule).
  const counterCard = combatProfileFor(def)?.maneuver === 'counter';
  // Owner, 2026-11-18: `effects.physicalDamageMultiplier` cuts the physical share of the figure first (the receipt's physical-damage-scale stage), then the side scale.
  const faceEffects = holder ? configuredModule(holder, 'effects') : null;
  const physicalMultiplier = faceEffects?.physicalDamageMultiplier;
  // Codex review on PR #2835: an untyped card takes its wielded armament's type before the split, as tacticalCarrier resolves it in combat
  // (a Herald's Arcane Spark is Arcane, half magic), so the face and the receipt cut the same physical share.
  const faceProfile = holder ? faceDamageProfile(def, registries, rules) : (combatProfileFor(def) || {});
  const physicalFraction = 1 - Math.min(1, Math.max(0, magicShareOf(faceProfile) || 0));
  // Owner, 2026-11-18: a face outside combat carries the run character's always-on attribute bonus, as a normal neutral-stance hit does:
  // physical damage adds STR, a finesse hit DEX, and magic its saved tradition's attribute (legacy: max(INT, WIS)), each at its effects weight; Block adds DEX. No stance, status or enemy defence.
  // A profile that predates the balance rules (no `baseDamageMultiplier`) keeps its authored faces.
  const attributes = Number.isFinite(baseDamageMultiplier) ? faceAttributes(registries, rules) : null;
  const faceShare = magicShareOf(faceProfile) || 0;
  const magicHit = faceProfile.camp === 'spell' || faceShare > 0 || cardIsMagical(def);
  const actionVersion = rules?.player || Object.hasOwn(rules || {}, 'core2ActionRulesVersion')
    ? rules.core2ActionRulesVersion : faceEffects?.core2ActionRulesVersion;
  const finesseSource = core2MultiHitRulesEnabled({
    gameProfile: holder?.gameProfile, fixCoreRules: holder?.fixCoreRules,
    combatExpansionVersion: holder?.combatExpansionVersion ?? 2, core2ActionRulesVersion: actionVersion,
  }) && IsFinesseHit({ registries, loadout: rules?.loadout }, rules?.player, { ...def, combatProfile: faceProfile });
  const finesseHit = !magicHit && finesseSource;
  const magicStat = attributes && SpellTraditionsActive(holder) ? SpellScalingValue(attributes, { ...def, combatProfile: faceProfile })
    : Math.max(attributes?.intelligence || 0, attributes?.wisdom || 0);
  const damageStat = attributes ? (magicHit ? magicStat : (attributes[finesseHit ? 'dexterity' : 'strength'] || 0)) : 0;
  // A finesse hit reads DEX but stays on the physical-damage channel (its weight), as profileDamageReceiptCore resolves it.
  const damageBonus = damageStat * ChannelWeight(faceEffects, magicHit ? 'pr' : 'ar');
  const blockBonus = attributes ? (attributes.dexterity || 0) * ChannelWeight(faceEffects, 'dr') : 0;
  const blockMultiplier = faceEffects?.blockGainMultiplier;
  const sideScale = (value, scaled) => {
    if (!scaled || counterCard || !(value > 0)) return value;
    const hasSide = Number.isFinite(playerMultiplier) && playerMultiplier !== 1;
    if (damageBonus > 0) {
      const raw = value + damageBonus;
      const split = splitContactParts({ amount: raw, base: value, ratingBonus: damageBonus, share: faceShare, ratingPart: magicHit ? 'magic' : 'physical', primary: faceShare >= 1 ? 'magic' : 'physical' });
      const fraction = split.physical + split.magic > 0 ? split.physical / (split.physical + split.magic) : 0;
      let boosted = ScalePhysicalDamage(raw, fraction, physicalMultiplier);
      if (hasSide) boosted = Math.max(boosted >= 1 && playerMultiplier > 0 ? 1 : 0, boosted * playerMultiplier);
      return Math.max(0, Math.floor(boosted));
    }
    let chain = ScalePhysicalDamage(value, physicalFraction, physicalMultiplier);
    if (hasSide) chain = Math.max(chain >= 1 && playerMultiplier > 0 ? 1 : 0, chain * playerMultiplier);
    return chain === value ? value : Math.max(0, Math.floor(chain));
  };
  // Block: (authored + DEX) x blockGainMultiplier, floored, as the configured Block gain computes it. A face with no run keeps the authored number.
  const blockScale = (value, isBlock) => {
    if (!isBlock || value < 0 || !faceEffects || !attributes) return value;
    const scale = Number.isFinite(blockMultiplier) && blockMultiplier >= 0 ? blockMultiplier : 1;
    return scale === 1 && !blockBonus ? value : Math.max(0, Math.floor((value + blockBonus) * scale));
  };
  // Rank composition wraps constant stacks in add formulas. Resolve only
  // constant sums here; state-dependent values still belong to live preview.
  const constant = value => {
    if (typeof value === 'number') return value;
    if (value?.f !== 'add' || !Array.isArray(value.args)) return undefined;
    const args = value.args.map(constant);
    return args.every(Number.isFinite) ? args.reduce((sum, item) => sum + item, 0) : undefined;
  };
  for (const binding of computeTokenBindings(effects)) {
    const effect = effects[binding.index] || {};
    const raw = effect[binding.field];
    const value = constant(raw);
    // Owner, 2026-11-15: Barrier stacks are printed as the Poise they give.
    const barrierScale = effect.op === 'gainBarrier' || (effect.op === 'applyStatus' && effect.status === 'barrier') ? BarrierPoisePerStack(registries) : 1;
    const damageScale = effect.op === 'damage' && binding.field === 'amount' ? baseDamageMultiplier : undefined;
    if (typeof value === 'number') tokens[binding.token] = blockScale(sideScale(ScaleCardBaseDamage(value * barrierScale, damageScale), effect.op === 'damage' && binding.field === 'amount'), effect.op === 'block' && binding.field === 'amount');
    else {
      // Evade's gain is configured (accuracy.evadeStackBase/Dex, card overrides included), so its phrase reads the rules, not a literal.
      // A combat's snapshotted fixCoreRules win over the profile's, so a resumed fight's face matches what the card grants.
      const configured = raw?.f === 'metric' && raw.metric === 'evadeStackGain' && raw.of === 'self' && (raw.per === undefined || (Number.isInteger(raw.per) && raw.per > 0))
        && Object.keys(raw).every(key => ['f', 'metric', 'of', 'per'].includes(key))
        ? evadeStackGainPhrase({ combatExpansionVersion: 2, fixCoreRules: rules?.fixCoreRules, gameProfile: rules?.gameProfile ?? registries?.gameProfile }, def, raw.per ?? 1) : undefined;
      const authored = configured ?? constantFormulaValue(raw) ?? describeFormula(raw);
      if (authored !== undefined) tokens[binding.token] = typeof authored === 'number' ? blockScale(sideScale(ScaleCardBaseDamage(authored, damageScale), effect.op === 'damage' && binding.field === 'amount'), effect.op === 'block' && binding.field === 'amount') : authored;
      // Weapon-scaled attacks have a static authored multiplier even though
      // their resolved damage depends on the equipped weapon. Keep that
      // multiplier visible on non-combat faces without guessing a damage
      // value from a runtime loadout.
      else if (raw?.f === 'metric' && raw.metric === 'weaponDamage'
          && raw.of === 'self'
          && Number.isFinite(raw.per) && raw.per > 0
          && Object.keys(raw).every(key => ['f', 'metric', 'of', 'per'].includes(key))
          && effect.attack?.source === 'weapon') {
        tokens[binding.token] = `${raw.per}×`;
      }
    }
  }
  // An element packet hit (owner, 2026-11-19; a physical card with a magic share and no rating of its own) prints its physical part in {damage} and
  // its magic part in {packet}: STR on the first, INT / Power on the second, the same two stages the receipt reads.
  const packetIndex = effects.findIndex(effect => effect.op === 'damage' && typeof constant(effect.amount) === 'number');
  if (packetIndex >= 0 && def.ratingId === undefined && faceProfile.camp === 'physical' && Number.isFinite(def.magicShare) && faceShare > 0 && faceShare < 1) {
    const token = computeTokenBindings(effects).find(binding => binding.index === packetIndex && binding.field === 'amount')?.token;
    if (token && typeof tokens[token] === 'number') {
      const base = ScaleCardBaseDamage(constant(effects[packetIndex].amount), baseDamageMultiplier);
      const physicalBonus = attributes ? (attributes[finesseSource ? 'dexterity' : 'strength'] || 0) * ChannelWeight(faceEffects, 'ar') : 0;
      const magicBonus = attributes ? magicStat * ChannelWeight(faceEffects, 'pr') : 0;
      // The receipt's order: the physical-damage scale cuts the physical part alone, the side scale takes the whole hit, the amount is floored ONCE,
      // then the same PacketSplit (same weights) divides that amount. Flooring parts separately would drift a point from the hit.
      const cut = Number.isFinite(physicalMultiplier) && physicalMultiplier >= 0 ? physicalMultiplier : 1;
      // The card's own share (`magicShare`) rules a packet, as the receipt reads it; the face profile alone would give the configured Technique share.
      const weights = PacketWeights({ base, share: def.magicShare, physicalBonus, magicBonus });
      const whole = weights.physical * cut + weights.magic;
      const sided = Number.isFinite(playerMultiplier) && playerMultiplier !== 1 ? Math.max(whole >= 1 && playerMultiplier > 0 ? 1 : 0, whole * playerMultiplier) : whole;
      const parts = PacketSplit({ base, share: def.magicShare, physicalBonus, magicBonus, physicalMultiplier: cut, total: sided });
      tokens[token] = parts.physical;
      tokens.packet = parts.magic;
    }
  }
  return tokens;
}

/** Resolve the rules shared by non-combat faces; live previews remain authoritative. */
export function playingCardDefinition(registries, ref, { preview = null, definition = null, rules = null } = {}) {
  if (preview?.resolvedDefinition) return preview.resolvedDefinition;
  if (definition) return definition;
  const configured = projectGameCard(rules?.gameProfile ? rules : registries, ref);
  if (configured) return configured;
  const def = rules?.breakMeterVersion == null
    ? resolveCard(registries, ref, undefined, rules || registries) : resolveCard(registries, ref, rules.breakMeterVersion, rules || registries);
  if (rules?.combatExpansionVersion !== 2) return def;
  const expanded = applyCombatExpansionCard(def);
  return rules.reactionRulesVersion === 2 ? applyCardTraits(expanded, rules.reactionRules) : expanded;
}


/**
 * playingCardModel(registries, ref, { preview }) → a frozen record.
 *
 * `ref` is `{ cardId, upgraded, instanceId? }` — the same shape `renderCard`
 * has always taken. `preview` is combat's live resolution when the card is in
 * a hand; without one the card reads its authored numbers.
 *
 * WHAT THE CALLER GETS, AND WHY EACH PIECE IS HERE RATHER THAN IN THE VIEW:
 *
 *   identity   id, instanceId, name, icon, rarity, classId, upgraded
 *              — what the card is. The instrument hooks (`data-card-id`,
 *              `data-instance-id`) are these, so they stop being re-derived.
 *
 *   type       id and label. The label used to be computed inline as
 *              `(ty && ty.label) || def.type.toUpperCase()`, which meant an
 *              authored type with no row silently changed case.
 *
 *   costs      action / mana / stamina / variable, from the framework profile
 *              or the preview's already-resolved numbers. One answer, so the
 *              face badge and the tooltip cost line cannot disagree — they
 *              computed it separately before.
 *
 *   tags       resolved through the ACTIVE registries, with the legacy-school
 *              duplicate filtered and the inheritance sources attached. This
 *              is the most tangled derivation in the old renderer and the one
 *              most worth having somewhere testable.
 *
 *   paint      authored colours and radii as values. See the line above.
 *
 *   tokens     what fills the text template, and `base` to compare against so
 *              a raised number can be marked as raised.
 */

export function playingCardModel(registries, ref, { preview = null, definition = null, rules = null } = {}) {
  const def = playingCardDefinition(registries, ref, { preview, definition, rules });
  // Owner, 2026-11-18: the colour baseline is the same card's face outside combat (always-on attributes and gear included), so a live number is
  // green or red only when something in the fight raised or lowered it.
  const base = staticCardTokens(def, registries, CardPresentationContext(def, preview, rules));

  // Type presentation is authored data (balance.ui.cardTypes): corner radii
  // carry the type (attack squarest → power roundest) and each type owns its
  // banner colour. A type with no row keeps the card drawable.
  const classification = cardClassification(def);
  const typeRow = balance.ui.cardTypes[classification.cardCategory] || balance.ui.cardTypes[def.type] || null;

  // The class motif hue is authored on the class (`cardTint`). Colourless
  // cards have no owning class and fall back to the neutral frame, which is
  // an ABSENT tint rather than a default one — the view decides what neutral
  // looks like.
  const owner = registries.classes.has(def.class) ? registries.classes.get(def.class) : null;

  // COSTS. A preview has already resolved its own numbers; self-funded restores
  // supply the full display price separately from the net payment. Without a
  // preview the framework's cost profile is the authority. Both paths land in one record
  // so the badge and the tooltip cannot drift, which they could before —
  // each computed its own.
  const profile = preview ? null : FaceCostProfile(registries, def);
  const costs = freeze({
    variable: preview ? !!preview.costIsX : !!profile.variable,
    action: preview ? (preview.displayCosts?.action ?? preview.cost) : profile.action,
    mana: preview ? (preview.displayCosts?.mana ?? preview.manaCost) : profile.mana,
    stamina: preview ? (preview.displayCosts?.stamina ?? preview.staminaCost ?? 0) : (profile.stamina || 0),
    ...(preview?.costIsEstimate ? { estimated: true } : {}),
    ...(preview?.costShift ? { shift: preview.costShift } : {}),
  });

  // TAGS, resolved against the ACTIVE registries in all three branches.
  // Equipment-generated cards carry their profile's tags on `cardTags`;
  // authored cards resolve through the junction; a card in play carries the
  // live rows its preview resolved. The authored branch used to reach a
  // module-global resolver, so a bundle that changed a card's tags changed
  // what combat did with them and not what the card showed.
  const service = tagService(registries);
  const liveTagRows = (preview?.values || []).filter((row) => Array.isArray(row.tags));
  const inheritedBy = new Map();
  for (const row of liveTagRows) {
    for (const id of row.inheritedTags || []) {
      const sources = inheritedBy.get(id) || new Set();
      sources.add(row.sourceName);
      inheritedBy.set(id, sources);
    }
  }
  const baseResolved = liveTagRows.length
    ? service.resolve([...new Set(liveTagRows.flatMap((row) => row.tags))])
    : def.cardTags != null
      ? service.resolve(def.cardTags)
      : def.traitValues && Array.isArray(def.tags)
        ? service.resolve(def.tags)
        : service.tagsOf('card', def);
  const resolvedIds = new Set(baseResolved.map((tag) => tag.id));
  const upgradeTagRows = (Array.isArray(def.tags) ? def.tags : [])
    .filter((id) => typeof id === 'string' && id.startsWith('upgrade:') && !resolvedIds.has(id))
    .map((id) => {
      const parsed = ParseUpgradeTag(id);
      if (!parsed) return null;
      const label = UpgradeTagLabel(id);
      const blurb = parsed.family === 'efficient'
        ? `${label}: reduced SP/MP cost (${parsed.stacks} stack${parsed.stacks === 1 ? '' : 's'}); doubles efficiency CP surcharge per stack.`
        : parsed.family === 'improved'
          ? `${label}: strengthened effect by +10% compounding per stack (×${Math.pow(1.1, parsed.stacks).toFixed(2)}).`
          : `${label}: card upgrade tier (${parsed.stacks} stack${parsed.stacks === 1 ? '' : 's'}).`;
      return { id, domain: 'upgrade', label, glyph: '', color: '', blurb };
    })
    .filter(Boolean);
  const resolved = [...baseResolved, ...upgradeTagRows];
  // Keep legacy schools for compatibility, but do not print Blood/Heavy twice
  // when the categorized theme/technique is the same visible word.
  const categorized = new Set(
    resolved.filter((tag) => ['theme', 'technique'].includes(tag.domain))
      .map((tag) => tag.label.toLowerCase())
  );
  const tags = freeze(resolved
    .filter((tag) => tag.domain !== 'card' || !categorized.has(tag.label.toLowerCase()))
    .map((tag) => freeze({
      id: tag.id,
      label: tag.label,
      glyph: tag.glyph,
      color: tag.color,
      blurb: cardTagExplanation(def, tag, registries),
      // An array rather than a Set: a model is serializable, and a Set is not.
      inheritedFrom: freeze([...(inheritedBy.get(tag.id) || [])]),
    })));

  // A matched tag-scoped vulnerability lights the card's boosted number in the
  // status row's own tint. Absence means no bonus — never a "+0%" badge.
  const boost = (preview?.values || []).find((row) => row.boostTint) || null;
  const abilityRank = Array.isArray(def.gradeProfiles) && Number.isInteger(def.abilityRank)
    && !(ref.rank !== undefined && ref.abilityRank === undefined) ? def.abilityRank : null;
  const weaponBound = def.tags?.includes('source:weapon') || def.cardTags?.includes('source:weapon');
  const weaponArt = abilityRank > 0 && registries.framework.costProfile(def).mana > 0 && weaponBound;
  const abilityLabel = abilityRank === null ? null : def.abilityKind === 'spell'
    ? abilityRank === 0 ? 'Cantrip' : 'Spell'
    : abilityRank === 0 ? 'Technique' : 'Combat Maneuver';
  const legacyRank = Number.isInteger(def.rank) && def.rank > 1 ? def.rank : 1;
  const visibleRank=abilityRank??(legacyRank>1||Number.isInteger(ref.rank)&&ref.rank>0?legacyRank:0);
  const rankBadge = visibleRank > 0 ? `Rank ${visibleRank}` : null;
  const rankHelp = abilityRank !== null ? `Rank ${abilityRank}: authored ${abilityLabel.toLowerCase()} profile. Actions and Mana are charged separately.`
    : rankBadge || '';
  const sigils = CardPresentationSigils(def, { registries, rules, preview });
  const traditionType = sigils.displayLabel || null;

  return freeze({
    id: def.id,
    instanceId: ref.instanceId || null,
    name: def.name,
    icon: def.icon || 'unknown',
    rarity: def.rarity,
    classId: def.class,
    upgraded: !!ref.upgraded,
    // SPEC §13.4o: the rank the face was resolved at (1 when unranked).
    rank: legacyRank,
    abilityRank,
    rankBadge,
    rankHelp,
    type: freeze({
      id: classification.cardCategory,
      label: traditionType ? traditionType.toUpperCase() : classification.cardCategory.toUpperCase(),
      subtype: traditionType ? classification.cardCategory === 'power' ? t('deckEditor.stance.power') : null
        : classification.stanceType ? classification.stanceType[0].toUpperCase() + classification.stanceType.slice(1) : null,
      abilityLabel: traditionType ? abilityRank === 0 ? t('deckEditor.rank.cantrip') : null : abilityLabel,
      weaponArt: weaponArt ? 'Weapon Art' : null,
      glyph: abilityLabel ? def.abilityKind === 'spell' ? 'skill' : weaponArt ? 'attack' : 'actions' : null,
      help: abilityLabel ? `${abilityLabel}${weaponArt ? ' · Weapon Art' : ''}. ${rankHelp}` : '',
    }),
    ...classification,
    legacyType: def.type,
    costs,
    tags,
    sigils,
    paint: freeze({
      typeColor: typeRow ? typeRow.color : null,
      radiusPx: typeRow ? typeRow.radius : null,
      artRadiusPx: typeRow ? typeRow.art : null,
      tint: (owner && owner.cardTint) || null,
      boostTint: boost ? boost.boostTint : null,
    }),
    // The text template's own data. The view fills and escapes it; `base` is
    // what a live number is compared against to be marked raised or lowered.
    tokens: freeze(preview ? { ...base, ...preview.tokens } : { ...base }),
    baseTokens: freeze({ ...base }),
    damageSequences: freeze((preview?.damageSequences || []).map(sequence => freeze({ ...sequence,
      hitDamages: freeze([...(sequence.hitDamages || [])]) }))),
    hasPreview: !!preview,
  });
}

/**
 * The face's class list, derived once from the model. The old renderer built
 * this string inline; every tool in the repo reads these hooks, so deriving
 * them in one place is what lets a second renderer exist without the hooks
 * drifting apart.
 */
export function playingCardClasses(model) {
  return `card as-card playing-poker-card rarity-${model.rarity}`
    + ` cls-${model.classId} type-${model.type.id}${model.legacyType && model.legacyType !== model.type.id ? ` type-${model.legacyType}` : ''}${model.upgraded ? ' upgraded' : ''}`;
}

