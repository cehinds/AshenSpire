// Saved trigger lineages describe a finite, already paid action envelope.
// This module validates data only; it never discovers triggers or samples RNG.
import { TRIGGER_EVENTS } from './schemas.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const count = value => Number.isSafeInteger(value) && value >= 0;
const fields = (value, allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key));
const signature = value => `${value.type}\0${value.status ?? ''}`;
const eventValid = value => fields(value, ['type', 'status']) && TRIGGER_EVENTS.includes(value.type)
  && (value.status === undefined || text(value.status));
const deliveryValid = value => fields(value, ['coverage', 'weapon', 'throwCapable', 'bypass', 'sourceWeaponId'])
  && Number.isInteger(value.coverage) && value.coverage >= 0 && value.coverage <= 2
  && ['weapon', 'throwCapable', 'bypass'].every(key => typeof value[key] === 'boolean')
  && (value.weapon ? text(value.sourceWeaponId) : value.sourceWeaponId === null)
  && (!value.throwCapable || value.weapon);
const deliveryMatches = (delivery, contact) => ['coverage', 'weapon', 'throwCapable', 'bypass', 'sourceWeaponId']
  .every(key => delivery[key] === contact[key]);

export const RANGE_LINEAGE_LIMITS = Object.freeze({ sites: 2048, edges: 2048, depth: 16 });

export function rangeLineagePlanProblems(plan, rangePlan, actorKeys) {
  const problems = [];
  const known = new Set(actorKeys || []);
  if (!fields(plan, ['version', 'rootId', 'sourceKey', 'sites', 'edges']) || plan.version !== 1
    || !text(plan.rootId) || plan.rootId !== rangePlan?.rootId
    || !known.has(plan.sourceKey) || plan.sourceKey !== rangePlan?.sourceKey
    || !Array.isArray(plan.sites) || !plan.sites.length || plan.sites.length > RANGE_LINEAGE_LIMITS.sites
    || !Array.isArray(plan.edges) || !plan.edges.length || plan.edges.length > RANGE_LINEAGE_LIMITS.edges) return ['Invalid frozen range lineage plan'];
  const sites = new Map(), edges = new Map();
  for (const site of plan.sites) {
    if (!fields(site, ['id', 'targetKey', 'parentId', 'events', 'delivery']) || !text(site.id)
      || sites.has(site.id) || !known.has(site.targetKey)
      || !(site.parentId === null || text(site.parentId))
      || !Array.isArray(site.events) || site.events.some(event => !eventValid(event))
      || new Set(site.events.map(signature)).size !== site.events.length || !deliveryValid(site.delivery)) {
      problems.push('Invalid frozen range lineage site'); continue;
    }
    sites.set(site.id, site);
  }
  const children = new Set(), contactIds = new Set();
  for (const edge of plan.edges) {
    if (!fields(edge, ['id', 'parentId', 'event', 'status', 'triggerKey', 'effectIndex', 'targets'])
      || !text(edge.id) || edges.has(edge.id) || !text(edge.parentId)
      || !eventValid({ type: edge.event, ...(edge.status !== undefined ? { status: edge.status } : {}) })
      || !text(edge.triggerKey) || !count(edge.effectIndex) || !Array.isArray(edge.targets)
      || edge.targets.length > RANGE_LINEAGE_LIMITS.sites) {
      problems.push('Invalid frozen range lineage edge'); continue;
    }
    edges.set(edge.id, edge);
    const parent = sites.get(edge.parentId);
    if (!parent || !parent.events.some(event => signature(event) === signature({ type: edge.event, status: edge.status }))) problems.push('Range lineage edge is outside its parent event');
    for (const target of edge.targets) {
      if (!fields(target, ['targetKey', 'siteId', 'contactId', 'batch']) || !known.has(target.targetKey)
        || !text(target.siteId) || !(target.contactId === null || text(target.contactId)) || !count(target.batch)) {
        problems.push('Invalid frozen range lineage target'); continue;
      }
      const child = sites.get(target.siteId);
      if (!child || child.parentId !== edge.parentId || child.targetKey !== target.targetKey || children.has(target.siteId)) problems.push('Range lineage target does not match its child site');
      children.add(target.siteId);
      if (target.contactId !== null) {
        const contact = Array.isArray(rangePlan?.targets) && rangePlan.targets.find(row => row?.contactId === target.contactId);
        if (contactIds.has(target.contactId) || !contact || contact.targetKey !== target.targetKey || !child || !deliveryMatches(child.delivery, contact)) problems.push('Range lineage target is outside its paid contact envelope');
        contactIds.add(target.contactId);
      }
    }
  }
  for (const site of sites.values()) {
    if (site.parentId !== null && (!sites.has(site.parentId) || !children.has(site.id))) problems.push('Range lineage site requires its declaring parent edge');
    const seen = new Set([site.id]);
    let parentId = site.parentId, depth = 0;
    while (parentId !== null && sites.has(parentId)) {
      if (seen.has(parentId) || ++depth > RANGE_LINEAGE_LIMITS.depth) {
        problems.push('Range lineage exceeds its finite ancestry'); break;
      }
      seen.add(parentId); parentId = sites.get(parentId).parentId;
    }
  }
  return [...new Set(problems)];
}

export function rangeLineageProblems(lineage, plan) {
  return fields(lineage, ['version', 'rootId', 'edgeId']) && lineage.version === 1
    && text(lineage.rootId) && lineage.rootId === plan?.rootId && text(lineage.edgeId)
    && Array.isArray(plan?.edges) && plan.edges.some(edge => edge?.id === lineage.edgeId)
    ? [] : ['Invalid inherited range lineage reference'];
}

export function rangeSiteBatchesProblems(batches, plan, { edgeId = null } = {}) {
  if (!Array.isArray(batches) || batches.length > RANGE_LINEAGE_LIMITS.sites
    || !Array.isArray(plan?.sites)) return ['Invalid frozen range site batches'];
  const sites = new Map(plan.sites.filter(record).map(site => [site.id, site]));
  const edge = edgeId === null || !Array.isArray(plan.edges) ? null : plan.edges.find(edge => edge?.id === edgeId);
  const problems = [], allSites = new Set();
  for (const [batchIndex, batch] of batches.entries()) {
    if (!Array.isArray(batch) || batch.length > RANGE_LINEAGE_LIMITS.sites) { problems.push('Invalid frozen range site batch'); continue; }
    const seen = new Set();
    for (const ref of batch) {
      const targetKey = ref?.playerId ? `player:${ref.playerId}` : ref?.id === 'player' ? 'player:player' : `enemy:${ref?.id}`;
      const site = sites.get(ref?.siteId);
      if (!fields(ref, ['id', 'playerId', 'siteId']) || !text(ref.id) || !text(ref.siteId)
        || !(ref.playerId === undefined || ref.playerId === null || text(ref.playerId))
        || seen.has(ref.siteId) || allSites.has(ref.siteId) || !site || site.targetKey !== targetKey
        || (edgeId === null ? site.parentId !== null : (!Array.isArray(edge?.targets) || !edge.targets.some(target =>
          target?.siteId === ref.siteId && target.targetKey === targetKey && target.batch === batchIndex)))) problems.push('Range site batch is outside its frozen lineage');
      seen.add(ref?.siteId);
      allSites.add(ref?.siteId);
    }
  }
  if (allSites.size > RANGE_LINEAGE_LIMITS.sites) problems.push('Range site batches exceed their finite envelope');
  if (edgeId !== null && (!Array.isArray(edge?.targets) || edge.targets.length !== allSites.size
    || edge.targets.some(target => !allSites.has(target?.siteId)))) problems.push('Inherited range action requires its complete frozen target batches');
  return [...new Set(problems)];
}

export function rangeOriginProblems(origin, event, graph, lineage) {
  if (!fields(origin, ['version', 'rootId', 'siteId', 'sourceKey']) || origin.version !== 1
    || origin.rootId !== graph?.rootId || origin.sourceKey !== graph?.sourceKey || !text(origin.siteId)) return ['Invalid saved range event origin'];
  const site = Array.isArray(graph?.sites) && graph.sites.find(site => site?.id === origin.siteId);
  const edge = Array.isArray(graph?.edges) && graph.edges.find(edge => edge?.id === lineage?.edgeId);
  if (!site || !Array.isArray(site.events) || !site.events.some(signature => record(signature) && signature.type === event?.type && signature.status === event?.status)
    || (lineage && (!edge || edge.parentId !== site.id || edge.event !== event?.type || edge.status !== event?.status))) return ['Saved range event is outside its frozen lineage'];
  return [];
}
