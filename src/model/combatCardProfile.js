import { objectTagIds, resolve } from '../content/tags.js';
import { tagService } from './tagService.js';

const CAMP = new Set(['physical', 'spell']);
const MANEUVER = new Set(['attack', 'defend', 'counter', 'sweep', 'ranged', 'smash']);
const SCHOOL = new Set(['frost', 'fire', 'lightning', 'force', 'alteration', 'illusion', 'divine', 'decay']);
const COUNTER = new Set(['melee', 'ranged', 'spell']);

function identity(tags, prefix, allowed, name) {
  const values = [...new Set(tags.filter(tag => tag.startsWith(prefix)).map(tag => tag.slice(prefix.length)))];
  if (values.length > 1) throw new Error(`${name} carries conflicting ${prefix} tags`);
  if (values.length && allowed && !allowed.has(values[0])) throw new Error(`${name} carries unknown ${prefix} tag '${values[0]}'`);
  return values[0] || null;
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
  return { camp, maneuver, school, damageType: types.length === 1 ? types[0] : null, counterMode };
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
  ].filter(Boolean);
  // Runtime surfaces must describe the active bundle, including intentionally
  // absent metadata. Static authoring callers can still use shipped labels.
  return registries ? tagService(registries).resolve(ids) : resolve(ids);
}
