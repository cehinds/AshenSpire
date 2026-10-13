import { objectTagIds, resolve } from '../content/tags.js';
import { tagService } from './tagService.js';
import { dominantDamageType } from './attackTags.js';

const CAMP = new Set(['physical', 'spell']);
const MANEUVER = new Set(['attack', 'defend', 'counter', 'sweep', 'ranged', 'smash', 'casting']);
const SCHOOL = new Set(['frost', 'fire', 'lightning', 'force', 'alteration', 'illusion', 'divine', 'decay', 'earth']);
const COUNTER = new Set(['melee', 'ranged', 'spell']);
const REACH = new Set(['contact', 'near', 'far']);
const TARGETING = new Set(['single', 'area']);

function identity(tags, prefix, allowed, name) {
  const values = [...new Set(tags.filter(tag => tag.startsWith(prefix)).map(tag => tag.slice(prefix.length)))];
  if (values.length > 1) throw new Error(`${name} carries conflicting ${prefix} tags`);
  if (values.length && allowed && !allowed.has(values[0])) throw new Error(`${name} carries unknown ${prefix} tag '${values[0]}'`);
  return values[0] || null;
}

/**
 * THE ONE SPELL TEST: a Spell is the spell CAMP, nothing else. Mana cost and
 * magical school do not make a card a Spell; only its camp does. Gainers of
 * Barrier (actions.js gainBarrier) and the card face ("Gain N Ward") both read it.
 */
export function isSpellCard(card) {
  if (!card) return false;
  const tags = card.tags || card.cardTags;
  return card.combatProfile?.camp === 'spell' || (Array.isArray(tags) && tags.includes('camp:spell'));
}

/**
 * spellCostSurcharge(entity) → the extra Stamina (SP) a spell-camp action costs
 * this entity: one per Silenced stack (owner, 2026-10-13, expanded combat).
 * The one helper every SP pricing reads; spellCardCostSurcharge applies it to a card or move.
 */
export function spellCostSurcharge(entity) {
  return silencedStacks(entity);
}

/** silencedStacks(entity) → the Silenced stacks an entity carries (0 without the status). */
export function silencedStacks(entity) {
  const stacks = Number(entity?.statuses?.silenced?.stacks);
  return Number.isFinite(stacks) && stacks > 0 ? Math.floor(stacks) : 0;
}

/** The surcharge on one card or enemy move: spell camp only; a strike or technique pays none. */
export function spellCardCostSurcharge(entity, card) {
  if (!card) return 0;
  const spell = card.combatProfile ? card.combatProfile.camp === 'spell' : (isSpellCard(card) || combatProfileFor(card).camp === 'spell');
  return spell ? spellCostSurcharge(entity) : 0;
}

/** Resolve authored identity; card names and spell damage never choose a camp. */
export function combatProfileFor(carrier = {}) {
  carrier ??= {};
  if (typeof carrier === 'string') carrier = { id: carrier };
  const enemyId = carrier.enemyId || carrier.enemyDefinitionId;
  const id = carrier.moveId || carrier.cardId || carrier.id || carrier.abilityFamily || '';
  const authored = objectTagIds(enemyId ? 'enemyMove' : 'card', id, enemyId || '');
  // Resolved registries and equipment projections remain authoritative,
  // including an explicitly empty tag list in a custom content bundle.
  // Equipment projections retain the base definition's tags alongside their
  // replacement cardTags. The replacement is the resolved action identity.
  const tags = carrier.cardTags ?? carrier.tags ?? authored;
  const camp = identity(tags, 'camp:', CAMP, id);
  const maneuver = identity(tags, 'maneuver:', MANEUVER, id);
  const school = identity(tags, 'school:', SCHOOL, id);
  const counterMode = identity(tags, 'counter:', COUNTER, id);
  const components = carrier.attack?.components;
  const types = [...new Set((components?.map(component => component.type)
    || (carrier.attack?.damageType ? [carrier.attack.damageType] : tags.filter(tag => tag.startsWith('damage:')).map(tag => tag.slice(7))))
    .filter(Boolean))];
  const profile = { camp, maneuver, school, damageType: types.length === 1 ? types[0] : null, counterMode };
  // A mixed hit keeps its weighted parts; its label is the heaviest part.
  if (components && types.length > 1) {
    profile.damageType = dominantDamageType(components);
    profile.damageComponents = components.map(({ type, weight }) => ({ type, weight }));
  }
  const reach = identity(tags, 'reach:', REACH, id);
  const targeting = identity(tags, 'targeting:', TARGETING, id);
  if (reach) profile.reach = reach;
  if (targeting) profile.targeting = targeting;
  const traits = [...new Set(tags.filter(tag => tag.startsWith('trait:')).map(tag => tag.slice(6)))];
  if (traits.length) profile.traits = traits;
  // These are authored payloads, not guessed from a card's name or damage type.
  for (const key of ['reach', 'targeting', 'traits', 'projectile', 'counterCoverage', 'counterPayload',
    'evade', 'upcast', 'stanceTrigger', 'stanceExpiry', 'schoolEffect', 'caster', 'breakPoiseBonus', 'pronePoiseBonus', 'traitValues']) {
    if (carrier[key] !== undefined) profile[key] = structuredClone(carrier[key]);
  }
  return profile;
}

/** Reaction rules v2: the Impact and Flux chips read "Impact 2" and "Flux 1". */
export function numberedTraitRow(row, traitValues = null) {
  const values = traitValues || {};
  const n = row.id === 'trait:impact' ? values.impact : row.id === 'trait:flux' ? values.flux : undefined;
  return n ? { ...row, label: `${row.label} ${n}` } : row;
}

/** The face's trait line, e.g. "Reaction. Counterstrike. Impact 2." ('' when no trait applies). */
export function traitLine(traitValues = null) {
  const values = traitValues || {};
  const parts = [values.reaction && 'Reaction', values.counterstrike && 'Counterstrike',
    values.impact && `Impact ${values.impact}`, values.flux && `Flux ${values.flux}`].filter(Boolean);
  return parts.length ? `${parts.join('. ')}.` : '';
}

/** Registry labels and blurbs stay shared across card chips and enemy intents. */
export function combatProfileTags(carrier = {}, registries = null) {
  carrier ??= {};
  const profile = carrier.camp ? carrier : combatProfileFor(carrier);
  const ids = [
    profile.camp && `camp:${profile.camp}`,
    profile.maneuver && `maneuver:${profile.maneuver}`,
    profile.school && `school:${profile.school}`,
    profile.damageType && `damage:${profile.damageType}`,
    profile.counterMode && `counter:${profile.counterMode}`,
    profile.reach && `reach:${profile.reach}`,
    profile.targeting && `targeting:${profile.targeting}`,
    ...(profile.traits || []).map(trait => `trait:${trait}`),
  ].filter(Boolean);
  // Runtime surfaces must describe the active bundle, including intentionally
  // absent metadata. Static authoring callers can still use shipped labels.
  const rows = registries ? tagService(registries).resolve(ids) : resolve(ids);
  return rows.map(row => numberedTraitRow(row, profile.traitValues));
}
