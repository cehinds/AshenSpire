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

import { resolveCard } from './registries.js';
import { tagService } from './tagService.js';
import { computeTokenBindings, cardTokenEffects } from './validate.js';
import { balance } from '../content/balance.js';
import { combatProfileFor } from './combatCardProfile.js';
import { cardSigilIdentity } from '../content/combatSigils.js';
import { resolve as resolveTags } from '../content/tags.js';
import { constantFormulaValue, describeFormula } from './formulas.js';

const freeze = (value) => Object.freeze(value);

/** Actual damage labels; a spell's school never substitutes for its damage. */
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
  return (service ? service.resolve(ids) : resolveTags(ids)).map(tag => tag.label).join('/');
}

export function combatCardType(def) {
  const p = combatProfileFor(def);
  if (def.type === 'power') return 'Power';
  if (['status', 'curse'].includes(def.type)) return 'Status';
  if (def.type === 'skill' && !p.maneuver) return 'Skill';
  if (p.maneuver === 'counter') return 'Counter';
  if (p.maneuver === 'defend') return 'Defend';
  if (p.camp === 'spell') return 'Spell';
  return p.maneuver && p.maneuver !== 'casting' ? p.maneuver[0].toUpperCase() + p.maneuver.slice(1)
    : def.type[0].toUpperCase() + def.type.slice(1);
}

/** Plain complete effect text. Numeric values come from the resolved preview. */
export function combatCardSummary(def, preview = null, registries = null) {
  const bindings = computeTokenBindings(def.effects || []), tokens = staticCardTokens(def);
  const value = (effect, index, field = 'amount') => {
    const token = bindings.find(row => row.index === index && row.field === field)?.token;
    const live = preview?.values?.[index];
    return preview?.tokens?.[token] ?? (live?.op === effect.op ? live.value : undefined)
      ?? tokens[token] ?? (typeof effect[field] === 'number' ? effect[field] : '?');
  };
  const title = id => registries?.statuses?.has(id) ? registries.statuses.get(id).name : id[0].toUpperCase() + id.slice(1);
  const condition = pred => {
    if (!pred) return '';
    if (pred.p === 'hasStatus') return `${pred.of === 'self' ? 'you have' : pred.of === 'allEnemies' ? 'an enemy has' : 'the target has'} ${title(pred.status)}`;
    if (pred.p === 'hasBlock') return `${pred.of === 'self' ? 'you' : 'the target'} ${pred.of === 'self' ? 'have' : 'has'} Block${pred.snapshot === 'beforePlay' ? ' before this card' : ''}`;
    if (pred.p === 'hpBelowPct') return `${pred.of === 'self' ? 'your' : 'target'} HP is at most ${pred.pct}%`;
    if (pred.p === 'firstCardThisTurn') return 'this is your first card this turn';
    if (pred.p === 'inStance') return `you are in ${pred.stance}`;
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
  const p = combatProfileFor(def), parts = [];
  for (const [index, effect] of (def.effects || []).entries()) {
    const n = value(effect, index), area = effect.target === 'allEnemies' ? ' to all enemies'
      : effect.target === 'randomEnemy' ? ' to a random enemy' : '';
    let text;
    switch (effect.op) {
      case 'damage': {
        const live = preview?.values?.[index], hits = live?.hits ?? effect.hits ?? 1;
        if (typeof hits !== 'number') return null;
        const sequence = live?.hitDamages;
        const unequal = sequence?.length > 1 && sequence.some(amount => amount !== sequence[0]);
        const type = combatCardDamageLabel(def, preview, registries, index);
        const word = `${type ? `${type} ` : ''}damage`;
        const damage = unequal ? `${sequence.join(' + ')} ${word} (${live.totalDamage} total across ${sequence.length} hits)`
          : `${n} ${word}${hits !== 1 ? ` ×${hits}` : ''}`;
        text = `${p.maneuver === 'counter' ? 'Return' : 'Deal'} ${damage}${area}`; break;
      }
      case 'block': text = `${effect.target === 'ally' ? 'Ally gains' : 'Gain'} ${n} Block`; break;
      case 'gainBarrier': text = `Gain ${n} Barrier`; break;
      case 'gainWard': text = `Restore ${n} Ward${effect.oncePerCombat ? ' once per combat' : ''}`; break;
      case 'gainPoise': text = `Gain ${n} Poise guard`; break;
      case 'buildup': text = `Add ${n} ${title(effect.status)} buildup${area}${effect.chance !== undefined && effect.chance < 100 ? ` (${effect.chance}%)` : ''}`; break;
      case 'applyStatus': {
        if (['invulnerability', 'decoy', 'grounded', 'sleep'].includes(effect.status)) return null;
        if (effect.duration !== undefined && typeof effect.duration !== 'number') return null;
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
      case 'loseHp': text = `${effect.offering ? 'Offer' : 'Pay'} ${n} HP${effect.nonlethal ? ' (leave at least 1 HP)' : ''}`; break;
      case 'gainEnergy': text = `Gain ${n} SP`; break;
      case 'restoreMana': text = `Restore ${n} Mana`; break;
      case 'restoreStamina': text = `Restore ${n} SP`; break;
      case 'poiseDamage': text = `${p.maneuver === 'counter' ? 'Return' : 'Deal'} ${n} Poise${area}`; break;
      case 'wardDamage': text = `${p.maneuver === 'counter' ? 'Return' : 'Deal'} ${n} Ward impact${area}`; break;
      case 'retain': text = `Retain ${n}`; break;
      case 'grantRollMode': text = `Next ${effect.roll}: ${effect.advantage ? 'Advantage' : 'Disadvantage'}`; break;
      case 'enterStance': text = effect.choose ? 'Choose a stance' : `Enter ${registries?.stances?.has(effect.stance) ? registries.stances.get(effect.stance).name : effect.stance}`; break;
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
    for (const [key, label, op] of [['hp', 'damage', 'damage'], ['poise', 'Poise', 'poiseDamage'], ['ward', 'Ward', 'wardDamage']]) {
      if (def.effects.some(effect => effect.op === op)) continue;
      const live = preview?.values?.find(row => row.op === op)?.value;
      const amount = live ?? payload[key];
      const type = key === 'hp' ? combatCardDamageLabel(def, preview, registries) : '';
      if (typeof amount === 'number' && amount > 0) returns.push(`${amount} ${type ? `${type} ` : ''}${label}`);
    }
    if (returns.length) parts.push(`Return ${returns.join(' + ')}`);
    if (def.pronePoiseBonus) parts.push(`+${def.pronePoiseBonus} Poise while Prone`);
  }
  if (def.evade) parts.push(`${def.evade.whileStatus ? `While ${title(def.evade.whileStatus)}: ` : ''}Prepare one Evade${def.evade.advantage ? ' with Advantage' : ''}`);
  if (def.comboHook) return null;
  if (def.usableWhile?.length) parts.unshift(`Usable through ${def.usableWhile.map(title).join(', ')}`);
  for (const keyword of def.keywords || []) if (['exhaust', 'retain', 'ethereal', 'innate'].includes(keyword)) parts.push(keyword[0].toUpperCase() + keyword.slice(1));
  return parts.length ? `${parts.join('. ')}.` : null;
}

/**
 * The numbers a card's own template substitutes, before any live preview.
 * The body is the renderer's `staticTokens` verbatim — it reads the definition
 * through the shared token binder and nothing else, which is what makes it a
 * projection rather than a step of drawing.
 *
 * `card.js` keeps exporting `staticTokens` as a re-export of this, because
 * five files import that name and a rename would be churn that proves nothing.
 */
export function staticCardTokens(def) {
  const tokens = {};
  const effects = cardTokenEffects(def);
  // Rank composition wraps constant stacks in add formulas. Resolve only
  // constant sums here; state-dependent values still belong to live preview.
  const constant = value => {
    if (typeof value === 'number') return value;
    if (value?.f !== 'add' || !Array.isArray(value.args)) return undefined;
    const args = value.args.map(constant);
    return args.every(Number.isFinite) ? args.reduce((sum, item) => sum + item, 0) : undefined;
  };
  for (const binding of computeTokenBindings(effects)) {
    const raw = (effects[binding.index] || {})[binding.field];
    const value = constant(raw);
    if (typeof value === 'number') tokens[binding.token] = value;
    else {
      const authored = constantFormulaValue(raw) ?? describeFormula(raw);
      if (authored !== undefined) tokens[binding.token] = authored;
    }
  }
  return tokens;
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
export function playingCardModel(registries, ref, { preview = null } = {}) {
  const def = preview?.resolvedDefinition || resolveCard(registries, ref);
  const base = staticCardTokens(def);

  // Type presentation is authored data (balance.ui.cardTypes): corner radii
  // carry the type (attack squarest → power roundest) and each type owns its
  // banner colour. A type with no row keeps the card drawable.
  const typeRow = balance.ui.cardTypes[def.type] || null;

  // The class motif hue is authored on the class (`cardTint`). Colourless
  // cards have no owning class and fall back to the neutral frame, which is
  // an ABSENT tint rather than a default one — the view decides what neutral
  // looks like.
  const owner = registries.classes.has(def.class) ? registries.classes.get(def.class) : null;

  // COSTS. A preview has already resolved its own numbers; without one the
  // framework's cost profile is the authority. Both paths land in one record
  // so the badge and the tooltip cannot drift, which they could before —
  // each computed its own.
  const profile = preview ? null : registries.framework.costProfile(def);
  const costs = freeze({
    variable: preview ? !!preview.costIsX : !!profile.variable,
    action: preview ? preview.cost : profile.action,
    mana: preview ? preview.manaCost : profile.mana,
    stamina: preview ? (preview.staminaCost || 0) : (profile.stamina || 0),
    ...(preview?.costIsEstimate ? { estimated: true } : {}),
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
  const resolved = liveTagRows.length
    ? service.resolve([...new Set(liveTagRows.flatMap((row) => row.tags))])
    : def.cardTags != null
      ? service.resolve(def.cardTags)
      : service.tagsOf('card', def);
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
      blurb: tag.blurb,
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

  return freeze({
    id: def.id,
    instanceId: ref.instanceId || null,
    name: def.name,
    icon: def.icon || '❖',
    rarity: def.rarity,
    classId: def.class,
    upgraded: !!ref.upgraded,
    // SPEC §13.4o: the rank the face was resolved at (1 when unranked).
    rank: legacyRank,
    abilityRank,
    rankBadge,
    rankHelp,
    type: freeze({
      id: def.type,
      label: abilityLabel || (typeRow && typeRow.label) || def.type.toUpperCase(),
      subtype: abilityLabel && weaponArt ? 'Weapon Art' : null,
      glyph: abilityLabel ? def.abilityKind === 'spell' ? '✦' : weaponArt ? '⚔' : '◆' : null,
      help: abilityLabel ? `${abilityLabel}${weaponArt ? ' · Weapon Art' : ''}. ${rankHelp}` : '',
    }),
    costs,
    tags,
    sigils: cardSigilIdentity(combatCardType(def), combatProfileFor(def)),
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
    + ` cls-${model.classId} type-${model.type.id}${model.upgraded ? ' upgraded' : ''}`;
}
