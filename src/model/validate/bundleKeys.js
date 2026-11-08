// src/model/validate/bundleKeys.js — the closed set of top-level content bundle keys.
// Split out of validate.js; an unknown key is refused by name.

import { REGISTRY_TYPES } from '../schemas.js';

export const KNOWN_BUNDLE_KEYS = new Set([
  'proposalStatusRules',
  ...REGISTRY_TYPES,
  'version',
  'contentVersion',
  'balance',
  'shops', // SPEC §14.2: the shop kinds and their offerings (content/shops.js)
  'sigils', // SPEC §14.3: sigils, sold at the market into run.sigils (content/sigils.js)
  'consumables', // SPEC §14.3: skill books and revive tokens (content/consumables.js)
  'companions', // SPEC §14.3: temporary companions (content/companions.js)
  'enemyMoves', // Scoped moves participate in the same canonical tag join.
  'mapConfigs',
  'scripts',
  'equipment',
  'unlocks',
  'classTree', // plan phase 5b: classId, nodeId, tier — the nodes a class may pick as it levels
  'classMasteryVersion',
  'legacyProgression',
  'progressionModuleOwnership',
  'breakMeterVersion', // configured bundle's scoped card faces, never stamped onto old runs
  'classMastery',
  'classSkillFeats',
  'sfx',
  'music',
  'tagDomains', // what a tag can be about — the domain lookup
  'tags', // THE tag registry — one vocabulary for every carrier (#61)
  'tagFamilies', // what can be tagged: its collection, and how its id is keyed
  'tagFamilyDomains', // family x domain — which words each family may carry
  'tagging', // family, scope, objectId, tagId — the only home a tag is written
  'propertyRules', // what each `property` tag confers (content/propertyRules.js)
  // THE TREE the five tag tables and the property rules are views of
  // (content/source/nodes.csv and companions; treeProblems checks it).
  'nodes', // id, parentId, label, color, glyph, visibility, priority, domain, aside, blurb
  'nodeRelations', // sourceId, relation, targetId, precedence
  'familyNodes', // family × subtree root — who may carry what
  'nodeTerms', // nodeId → playerTermId, tooltipTermId, template
  'nodeVariables', // the variables a conferring node exposes
  'variableBindings', // what each variable reads, per scope — balance paths, never numbers
  'nodeEffects', // { [nodeId]: { passives?, triggers? } } naming variables
  'attributeRules',
  'derivedStatRules',
  'characterCreation',
  'eventHistoryRequirements', // quest steps (E12): event-level history gates
  // Plan phase 10a: quest chains, who speaks each step, and the rows they name.
  'eventChoiceIds', // the durable choice ids a completion ref names
  'questChains', // { [questId]: { steps, completes } }
  'eventSpeakers', // { [eventId]: speakerId }
  'speakers', // content/source/speakers.csv
]);
