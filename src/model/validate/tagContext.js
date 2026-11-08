// src/model/validate/tagContext.js — mechanic attachments, the tag system and the shared validation context.
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { fixCoreModuleParameters } from '../fixCoreMechanics.js';
import { compileBindings } from '../mechanicsKernel.js';
import { skillTracks } from '../skills.js';
import { tagContentProblems, tagIdsInDomain, tagIdsAllowedFor } from '../tags.js';

export function tagContextProblems(b, err, ctx) {
  const { ids } = ctx;
  const mechanicCarriers = [
    ['cards', b.cards, 'card'], ['relics', b.relics, 'relic'], ['statuses', b.statuses, 'status'],
    ['classes', b.classes, 'character'], ['enemies', b.enemies, 'entity'],
    ['equipment.armaments', b.equipment?.armaments, 'gear'], ['equipment.armour', b.equipment?.armour, 'gear'],
  ];
  for (const [table, rows, kind] of mechanicCarriers) for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.mechanicTags && !row?.mechanicBindings) continue;
    try {
      compileBindings({mechanics:behaviorMechanics,moduleParameters:fixCoreModuleParameters(),attachments:[{
        ownerId:row.id,sourceInstanceId:row.id,kind,tags:row.mechanicTags || [],mechanicBindings:row.mechanicBindings || [],
      }]});
    } catch(error) { err(`${table}.${row.id}.mechanicBindings`,error.message); }
  }

  // The whole tag system in one pass: the registry, who may carry which
  // domain, and every carrier's tags (model/tags.js states the rules).
  const keywordIds = Array.isArray(b.keywords) ? b.keywords.map((k) => k && k.id) : [];
  for (const problem of tagContentProblems(b, keywordIds)) {
    err(problem.path, problem.message);
  }
  // Effect-tag vocabulary, FROM THE JOIN rather than from memory. Effect `tags`
  // and taggedVulnerability lists draw from whatever domains tagFamilyDomains
  // pairs the `effect` family with — today `card`, which is why this reads the
  // same as the hard-coded set it replaces. Hard-coding it made that row
  // decorative: editing `effect,card` to `effect,item` changed the table and
  // nothing else, so the normalised constraint was not actually the constraint.
  const tagIds = new Set(tagIdsAllowedFor(b, 'effect'));
  // Creature identity is the creature domain of that same registry, so adding
  // a kind is a node in nodes.csv rather than an edit to a frozen array.
  const creatureTagIds = tagIdsInDomain(b, 'creature');
  // Every node of the tree, for the predicate that may ask about any of them.
  const nodeIds = new Set((Array.isArray(b.nodes) ? b.nodes : []).map((n) => n && n.id).filter(Boolean));
  // The skill tracks, derived (model/skills.js): the ids a progression gate
  // may name are exactly the ones the ledger can hold.
  const skillIds = new Set(skillTracks(b).map((t) => t.id));
  const vctx = { ids, err, tagIds, nodeIds, skillIds };

  // Equipment profiles are nested tables, but receive the same strict central
  // schema walk as top-level registries. Absence is not an empty valid table.
  const equipment = b.equipment;
  ctx.tagIds = tagIds;
  ctx.creatureTagIds = creatureTagIds;
  ctx.vctx = vctx;
  ctx.equipment = equipment;
}
