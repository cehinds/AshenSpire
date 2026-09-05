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
import { relics } from './relics.js';
import { flasks } from './flasks.js';
import { act1Enemies } from './enemies/act1.js';
import { act2Enemies } from './enemies/act2.js';
import { act3Enemies } from './enemies/act3.js';
import { act1Encounters } from './encounters/act1.js';
import { act2Encounters } from './encounters/act2.js';
import { act3Encounters } from './encounters/act3.js';
import { events, eventHistoryRequirements } from './events.js';
import { classes, LOCKED_CLASSES } from './classes.js';
import { mapConfigs } from './mapconfig.js';
import { TAGS, TAG_DOMAINS, TAG_FAMILIES, TAG_FAMILY_DOMAINS, TAGGING } from './tags.js';
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
import { attributes, creationModes, attributeRules } from './attributes.js';
import { retiredAttributeNames } from './retiredNames.js';
import { derivedStatRules } from './derivedStats.js';
import { characterCreation } from './generated/characterCreation.js';

const authoredCards = [...reaverCards, ...starseerCards, ...heraldCards, ...rogueCards, ...colorlessCards, ...coopCards];
const exposureByCard = new Map(CARD_EXPOSURE.map((row) => [row.cardId, row]));
const cards = authoredCards.map((card) => {
  const carrier = exposureByCard.get(card.id);
  return carrier ? { ...card, damageSchool: carrier.damageSchool, exposureBuildupPerHit: carrier.exposureBuildupPerHit } : card;
});

export const contentBundle = {
  // THE RELEASE HALF, AND THE CANDIDATE NUMBER IS THE THIRD COMPONENT.
  //
  // Constantine, 2026-09-01, on reading `0.5.0-rc.4.1959`: "I thought it was
  // going to be something like 0.5.3.2" — the candidate in slot three, and a
  // build counter in slot four that "should restart ... to 0.5.4.0 and
  // increment from there". So `0.5.0-rc.4` is written `0.5.4`: the fourth
  // candidate of the 0.5 line, and tools/buildversion.mjs appends the count of
  // builds within it.
  //
  // WHAT THAT COSTS, STATED HERE RATHER THAN DISCOVERED LATER: the patch number
  // of the release being auditioned no longer appears, so a shipped `0.5.0`
  // would sort BELOW the `0.5.4` that led to it. A release under this scheme
  // must be numbered past its last candidate. Raised with him when the
  // directive was given; the scheme is his call and this is the note.
  // 0.5.4 was promoted to `test` (#611) and on to `release` (#609) on
  // 2026-09-04, carrying the component kit, the card-ownership rulings and the
  // painted class figures. Cutting the fifth candidate here is the same step
  // #556 and #563 took when their candidates reached `test` — the owner's call,
  // given 2026-09-05. The build counter restarts, so the next build is 0.5.5.0.
  version: '0.5.5',
  balance,
  cards,
  relics,
  statuses,
  stances,
  // HUD resource bars — one row per bar (Law 0: add a row, a bar appears).
  resources,
  keywords,
  enemies: [...act1Enemies, ...act2Enemies, ...act3Enemies],
  encounters: [...act1Encounters, ...act2Encounters, ...act3Encounters],
  events,
  eventHistoryRequirements,
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
