// src/model/locations.js — where a run stops, read as a property carrier
// (docs/proposal-progression-and-property-system.md §7.4, plan phase 7)
//
// A location — the classic map's shrine, the Unknown node's field camp, an
// atlas rest service (an inn, a chapel), or one atlas node by id — is a
// CARRIER: content/source/tagging.csv hands it property tags under the
// `location` family, and what the place restores is the sum of those tags'
// rules on the two events the visit emits (`arrived`, `rested`). The mount,
// the emissions and the write-back are the engine's (engine/locations.js);
// this file is the model half — which ids a location may have, which tags a
// location holds, what the tag set means for the screen, and the refusals.
//
// THE ID IS THE MAP'S, NEVER A SECOND VOCABULARY. A location id is one of:
//   - the classic node type the door visits (`shrine`; a fight or a merchant
//     node opens no visit, so tagging one is refused),
//   - `camp`, the Unknown node's rest outcome (the classic map has no node
//     type for it — an event resolves to it),
//   - an atlas service TYPE id whose handler is `rest` (`inn`, `chapel`):
//     every point of that type shares the tag set, so eleven inns are one
//     row each, not eleven,
//   - an atlas node id that offers such a service, for the one place that
//     wants its own set.
// A shop, a smith, a fight node opens no visit, so tagging one is refused
// rather than becoming inert content.
// resolveLocationId picks the most specific of a point's candidates that
// tagging.csv actually names, so a node row overrides its service type.
//
// Headless: no document/window/localStorage/timers.

import { NODE_TYPES } from './floorplan.js';
import { ATLAS } from './worldAtlas.js';

export const LOCATION_FAMILY = 'location';

/** The Unknown node's rest outcome (proposal §7.4: the field camp). */
export const CAMP_LOCATION = 'camp';

/**
 * `restMana` restores by the configured mode (balance.rest.mana.mode); a
 * location that wants another amount carries the fixed-mode tag instead.
 * The door resolves the default tag to its mode's tag at carrier build
 * (locationRestTags), so the rules themselves stay one per tag.
 */
export const REST_MANA_TAG = 'restMana';
export const REST_MANA_MODES = Object.freeze(['flat', 'floorOrFull', 'full']);
export const REST_MANA_TAG_BY_MODE = Object.freeze({
  flat: 'restManaFlat',
  floorOrFull: 'restManaFloor',
  full: 'restManaFull',
});

/** The tags that are SERVICES the location screen offers rather than rules. */
export const SERVICE_TAGS = Object.freeze({
  smith: 'smith',
  levelUp: 'levelUp',
  flasks: 'restFlasks',
});

/** The classic node types the door opens a visit at (main.js enterNode). */
export const VISITED_NODE_TYPES = Object.freeze(NODE_TYPES.filter((type) => type === 'shrine'));

/** Every id a `location` tagging row may name (see the file comment). */
export function locationIds(atlas = ATLAS) {
  const ids = new Set([...VISITED_NODE_TYPES, CAMP_LOCATION]);
  const serviceTypes = (atlas && atlas.serviceTypes) || {};
  const restTypes = new Set(Object.keys(serviceTypes).filter((id) => serviceTypes[id] && serviceTypes[id].handlerId === 'rest'));
  for (const id of restTypes) ids.add(id);
  const services = (atlas && atlas.services) || {};
  for (const [nodeId, rows] of Object.entries((atlas && atlas.nodeServices) || {})) {
    if (rows.some((row) => services[row.serviceId] && restTypes.has(services[row.serviceId].serviceTypeId))) ids.add(nodeId);
  }
  return ids;
}

/** The tags tagging.csv hands a location, in file order; [] for an untagged id. */
export function locationTags(registries, locationId) {
  const rows = Array.isArray(registries.tagging) ? registries.tagging : [];
  return rows
    .filter((row) => row && row.family === LOCATION_FAMILY && row.objectId === locationId)
    .map((row) => row.tagId);
}

/**
 * resolveLocationId(registries, { nodeId, serviceTypeId, nodeType }) → the
 * most specific candidate tagging.csv names, or null when none is a location.
 */
export function resolveLocationId(registries, { nodeId = null, serviceTypeId = null, nodeType = null } = {}) {
  for (const id of [nodeId, serviceTypeId, nodeType]) {
    if (id && locationTags(registries, id).length) return id;
  }
  return null;
}

/**
 * locationRestTags(registries, tags) → the tag set with `restMana` replaced by
 * the tag the configured mode names. A fixed-mode tag already on the carrier
 * is kept as authored; `restMana` beside it is dropped rather than doubled.
 */
export function locationRestTags(registries, tags) {
  return resolveRestTags(registries.balance.rest.mana.mode, tags);
}

/** The same resolution from a bare mode, for the validator that has only the bundle. */
export function resolveRestTags(mode, tags) {
  const fixed = REST_MANA_TAG_BY_MODE[mode];
  if (!fixed) throw new Error(`balance.rest.mana.mode '${mode}' names no rest tag (one of ${REST_MANA_MODES.join(', ')})`);
  const out = [];
  for (const tag of tags || []) {
    const resolved = tag === REST_MANA_TAG ? fixed : tag;
    if (!out.includes(resolved)) out.push(resolved);
  }
  return out;
}

/** Which services the screen offers at a place carrying `tags`. */
export function locationServices(registries, tags) {
  const held = new Set(tags || []);
  return Object.freeze({
    smith: held.has(SERVICE_TAGS.smith),
    levelUp: held.has(SERVICE_TAGS.levelUp),
    flasks: held.has(SERVICE_TAGS.flasks),
  });
}

/**
 * restDeniedBy(registries, run, tags) → the id of the relic whose `restDenied`
 * passive forbids resting at a place carrying `tags`, or null. `true` denies
 * every rest; a list denies a place whose set holds one of its tags.
 */
export function restDeniedBy(registries, run, tags) {
  const held = new Set(tags || []);
  for (const id of (run && run.relics) || []) {
    const passives = registries.relics.get(id).passives;
    const denied = passives && passives.restDenied;
    if (denied === true) return id;
    if (Array.isArray(denied) && denied.some((tag) => held.has(tag))) return id;
  }
  return null;
}

/**
 * locationTaggingProblems(bundle) → [{ path, message }]: a `location` tagging
 * row naming an id the map does not have, a rest-mana mode tag no rule
 * exists for, and a `restDenied` filter naming a tag no location EFFECTIVELY
 * carries — the set a visit mounts, with `restMana` resolved to the shipped
 * mode's tag, since that is the set restDeniedBy reads (a filter naming
 * `restMana` itself would match nothing and is refused).
 */
export function locationTaggingProblems(bundle, atlas = ATLAS) {
  const problems = [];
  const b = bundle || {};
  const ids = locationIds(atlas);
  const authored = new Map();
  for (const row of Array.isArray(b.tagging) ? b.tagging : []) {
    if (!row || row.family !== LOCATION_FAMILY) continue;
    if (!authored.has(row.objectId)) authored.set(row.objectId, []);
    authored.get(row.objectId).push(row.tagId);
    if (!ids.has(row.objectId)) {
      problems.push({
        path: `tagging.${LOCATION_FAMILY}.${row.objectId}`,
        message: `'${row.objectId}' is not a location — a classic node type the door visits (${VISITED_NODE_TYPES.join(', ')}), '${CAMP_LOCATION}', an atlas rest service's type or an atlas point offering one`,
      });
    }
  }
  const rules = new Set((Array.isArray(b.propertyRules) ? b.propertyRules : []).map((r) => r && r.tag));
  if (rules.size) {
    for (const [mode, tag] of Object.entries(REST_MANA_TAG_BY_MODE)) {
      if (!rules.has(tag)) problems.push({ path: `propertyRules.${tag}`, message: `rest-mana mode '${mode}' resolves to '${tag}', which has no property rule` });
    }
  }
  const mode = b.balance && b.balance.rest && b.balance.rest.mana ? b.balance.rest.mana.mode : null;
  const carried = new Set();
  for (const tags of authored.values()) {
    for (const tag of REST_MANA_TAG_BY_MODE[mode] ? resolveRestTags(mode, tags) : tags) carried.add(tag);
  }
  for (const relic of Array.isArray(b.relics) ? b.relics : []) {
    const denied = relic && relic.passives && relic.passives.restDenied;
    if (!Array.isArray(denied)) continue;
    for (const tag of denied) {
      if (!carried.has(tag)) problems.push({ path: `relics.${relic.id}.passives.restDenied`, message: `names '${tag}', which no location carries once its rest tags resolve (content/source/tagging.csv; restMana resolves to the mode's tag, so name that)` });
    }
  }
  return problems;
}
