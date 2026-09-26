// src/content/index.js — the content bundle (shape: ENGINE-API §1)
//
// Aggregates every content file into the bundle createRegistries() consumes.
// Adding content = adding a data object in one file here (SPEC §3.1(2)).

import { balance } from './balance.js';
import { statuses } from './statuses.js';
import { stances } from './stances.js';
import { resources } from './resources.js';
import { keywords } from './keywords.js';
import { reaverCards } from './cards/reaver.js';
import { starseerCards } from './cards/starseer.js';
import { heraldCards } from './cards/herald.js';
import { rogueCards } from './cards/rogue.js';
import { colorlessCards } from './cards/colorless.js';
import { coopCards } from './cards/coop.js';
import { armamentCards } from './cards/armaments.js';
import { relics } from './relics.js';
import { flasks } from './flasks.js';
import { act1Enemies } from './enemies/act1.js';
import { act2Enemies } from './enemies/act2.js';
import { act3Enemies } from './enemies/act3.js';
import { wealdEncounters } from './encounters/weald.js';
import { marchesEncounters } from './encounters/marches.js';
import { reachEncounters } from './encounters/reach.js';
import { SEATS } from './seats.js';
import { events, eventHistoryRequirements, eventChoiceIds, questChains, eventSpeakers } from './events.js';
import { speakers } from './generated/speakers.js';
import { worldAtlas } from './generated/worldAtlas.js';
import { classes, LOCKED_CLASSES } from './classes.js';
import { mapConfigs } from './mapconfig.js';
import { TAGS, TAG_DOMAINS, TAG_FAMILIES, TAG_FAMILY_DOMAINS, TAGGING } from './tags.js';
import { PROPERTY_RULES } from './propertyRules.js';
import { nodes } from './generated/nodes.js';
import { nodeRelations } from './generated/nodeRelations.js';
import { familyNodes } from './generated/familyNodes.js';
import { nodeTerms } from './generated/nodeTerms.js';
import { nodeVariables } from './generated/nodeVariables.js';
import { variableBindings } from './generated/variableBindings.js';
import { nodeEffects } from './generated/nodeEffects.js';
import { scripts } from './scripts.js';
import { SFX_RECIPES } from './sfx.js';
import { SCALES, BEDS } from './music.js';
import {
  ARMAMENTS, ARMOUR, SLOTS, MOD_FIELDS, CARD_TARGETS, BASIC_CARD_PROFILES, CARD_EXPOSURE, STARTING_KITS,
  EQUIPMENT_REQUIREMENTS, CARD_EQUIPMENT_EXCEPTIONS, CARD_EQUIPMENT_TAGGING, EQUIPMENT_GRANTS, ARMOURY_UI,
  ITEM_UPGRADE_CHANGES,
} from './equipment.js';
import { equipTargets } from './generated/equipTargets.js';
import { unlocks } from './generated/unlocks.js';
import { classTree } from './generated/classTree.js';
import { attributes, creationModes, attributeRules } from './attributes.js';
import { retiredAttributeNames } from './retiredNames.js';
import { derivedStatRules } from './derivedStats.js';
import { characterCreation } from './generated/characterCreation.js';

const authoredCards = [...reaverCards, ...starseerCards, ...heraldCards, ...rogueCards, ...colorlessCards, ...coopCards, ...armamentCards];
const exposureByCard = new Map(CARD_EXPOSURE.map((row) => [row.cardId, row]));
const cards = authoredCards.map((card) => {
  const carrier = exposureByCard.get(card.id);
  return carrier ? { ...card, damageSchool: carrier.damageSchool, exposureBuildupPerHit: carrier.exposureBuildupPerHit } : card;
});

export const contentBundle = {
  // Release series and candidate live here; tools/buildversion.mjs derives the
  // fourth component and resets it to zero whenever this release changes.
  // The owner moved current builds to the 0.6.x.x series on 2026-09-08.
  // 0.7.1: the first candidate of the 0.7 line — seats (SPEC §13), a new
  // run-order system live for players with its save-schema migration, is a
  // MINOR under docs/versioning.md rule 2; the owner's release cut names 0.7.0.
  version: '0.7.1',
  balance,
  cards,
  relics,
  statuses,
  stances,
  // HUD resource bars — one row per bar (Law 0: add a row, a bar appears).
  resources,
  keywords,
  enemies: [...act1Enemies, ...act2Enemies, ...act3Enemies],
  // Bundle order is read order: the boss pool a map draws from is this list
  // filtered, so a seat's bosses keep the columns they have always landed in
  // (SPEC §13.6). The Valkyrie row sits first in reach.js for the same reason.
  encounters: [...wealdEncounters, ...marchesEncounters, ...reachEncounters],
  // The seats (SPEC §13.1): a registry, so an encounter's `seat` is a ref the
  // validator resolves like any other id.
  seats: SEATS,
  events,
  eventHistoryRequirements,
  // Plan phase 10a: quest chains complete through one door, and every chain
  // step is spoken by a speaker row (content/source/speakers.csv). Atlas quest
  // rows ride along so validation can resolve their speakers too.
  eventChoiceIds,
  questChains,
  eventSpeakers,
  speakers,
  atlasQuests: worldAtlas.quests,
  flasks,
  classes,
  mapConfigs,
  scripts,
  // SFX recipes ride the bundle so validateContent rules on them at boot and
  // in tests (#46); the audio engine imports the same table from content/sfx.js.
  sfx: SFX_RECIPES,
  // The score rides the same way (word 3): beds are bed objects or the exact
  // word 'silence' — deliberate quiet — and the validator rejects every
  // quiet-shaped mistake (null, [], {}, zero gain, wrong word) by name.
  music: { scales: SCALES, beds: BEDS },
  // Equipment rides in the bundle as plain tables (see model/registries.js).
  equipment: {
    armaments: ARMAMENTS,
    armour: ARMOUR,
    slots: SLOTS,
    modFields: Object.fromEntries(MOD_FIELDS),
    targets: equipTargets,
    cardTargets: CARD_TARGETS,
    basicCardProfiles: BASIC_CARD_PROFILES,
    cardExposure: CARD_EXPOSURE,
    startingKits: STARTING_KITS,
    equipmentRequirements: EQUIPMENT_REQUIREMENTS,
    itemUpgradeChanges: ITEM_UPGRADE_CHANGES,
    cardEquipmentExceptions: CARD_EQUIPMENT_EXCEPTIONS,
    cardTagging: CARD_EQUIPMENT_TAGGING,
    equipmentGrants: EQUIPMENT_GRANTS,
    armouryUi: ARMOURY_UI,
  },
  unlocks,
  // Plan phase 5b: the class tree — which property nodes a class may pick, by tier.
  classTree,
  // The tag schema rides the bundle so every carrier — effect `tags`,
  // taggedVulnerability lists, creature kinds, equipment, relics — validates
  // against ONE vocabulary home (#61). Five normalised tables: the domain
  // lookup, the registry, what can be tagged, who may carry which domain, and
  // the association rows themselves (content/tags.js says why five).
  tagDomains: TAG_DOMAINS,
  tags: TAGS,
  tagFamilies: TAG_FAMILIES,
  tagFamilyDomains: TAG_FAMILY_DOMAINS,
  tagging: TAGGING,
  // What each `property` tag confers — one rule per tag (content/propertyRules.js).
  propertyRules: PROPERTY_RULES,
  // THE TREE the five tag tables and the property rules are views of
  // (content/source/nodes.csv and its six companions; tools/content-build.mjs
  // derives tags/tagDomains/tagFamilyDomains/propertyRules/propertyRuleEffects
  // and the framework's properties/relations from these). They ride the bundle
  // so validate.js can check the tree itself — parents, cycles, edges,
  // variables against bindings, kinds against collections.
  nodes,
  nodeRelations,
  familyNodes,
  nodeTerms,
  nodeVariables,
  variableBindings,
  nodeEffects,
  attributes,
  creationModes,
  // `retired` is composed HERE, from its own file, so that reverting
  // attributes.js to a pre-rename copy cannot delete the guard along with the
  // row it guards against (retiredNames.js says why in full).
  attributeRules: { ...attributeRules, retired: retiredAttributeNames },
  derivedStatRules,
  characterCreation,
};

// Not part of the bundle (UI-only data / M1 flow):
export { LOCKED_CLASSES };
