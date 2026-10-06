// Fifty class feats. Their descriptions and effects share normalized balance bindings.
import { balance } from '../balance.js';
import { PROPERTY_RULES } from '../propertyRules.js';
import { TAGGING } from '../tags.js';
import { nodeVariables } from '../generated/nodeVariables.js';
import { variableBindings } from '../generated/variableBindings.js';
import { getFeatDescription } from '../../model/classSkillFeatDescription.js';

const authored = { balance, propertyRules: PROPERTY_RULES, tagging: TAGGING, nodeVariables, variableBindings };
const featRows = [
  {
    "id": "progression-coal-on-steel",
    "skillId": "class:reaver",
    "minLevel": 1,
    "name": "Coal on Steel"
  },
  {
    "id": "progression-brace-and-bite",
    "skillId": "class:reaver",
    "minLevel": 1,
    "name": "Brace and Bite"
  },
  {
    "id": "progression-red-footwork",
    "skillId": "class:reaver",
    "minLevel": 1,
    "name": "Red Footwork"
  },
  {
    "id": "progression-anvil-discipline",
    "skillId": "class:reaver",
    "minLevel": 4,
    "name": "Anvil Discipline"
  },
  {
    "id": "progression-forge-momentum",
    "skillId": "class:reaver",
    "minLevel": 4,
    "name": "Forge Momentum"
  },
  {
    "id": "progression-paid-in-blood",
    "skillId": "class:reaver",
    "minLevel": 8,
    "name": "Paid in Blood"
  },
  {
    "id": "progression-last-rampart",
    "skillId": "class:reaver",
    "minLevel": 8,
    "name": "Last Rampart"
  },
  {
    "id": "progression-war-cadence",
    "skillId": "class:reaver",
    "minLevel": 12,
    "name": "War Cadence"
  },
  {
    "id": "progression-broad-sentence",
    "skillId": "class:reaver",
    "minLevel": 12,
    "name": "Broad Sentence"
  },
  {
    "id": "progression-ember-sovereign",
    "skillId": "class:reaver",
    "minLevel": 16,
    "name": "Ember Sovereign"
  },
  {
    "id": "progression-dread-of-the-hammer",
    "skillId": "class:reaver",
    "minLevel": 16,
    "name": "Dread of the Hammer"
  },
  {
    "id": "progression-scarred-oath",
    "skillId": "class:reaver",
    "minLevel": 20,
    "name": "Scarred Oath"
  },
  {
    "id": "progression-harvest-the-wound",
    "skillId": "class:reaver",
    "minLevel": 20,
    "name": "Harvest the Wound"
  },
  {
    "id": "progression-orbit-keeper",
    "skillId": "class:starseer",
    "minLevel": 1,
    "name": "Orbit Keeper"
  },
  {
    "id": "progression-moonward-scholar",
    "skillId": "class:starseer",
    "minLevel": 1,
    "name": "Moonward Scholar"
  },
  {
    "id": "progression-comet-reader",
    "skillId": "class:starseer",
    "minLevel": 1,
    "name": "Comet Reader"
  },
  {
    "id": "progression-mirror-of-rime",
    "skillId": "class:starseer",
    "minLevel": 4,
    "name": "Mirror of Rime"
  },
  {
    "id": "progression-constellation-keeper",
    "skillId": "class:starseer",
    "minLevel": 4,
    "name": "Constellation Keeper"
  },
  {
    "id": "progression-patient-wellspring",
    "skillId": "class:starseer",
    "minLevel": 8,
    "name": "Patient Wellspring"
  },
  {
    "id": "progression-weight-of-the-void",
    "skillId": "class:starseer",
    "minLevel": 8,
    "name": "Weight of the Void"
  },
  {
    "id": "progression-nightglass-scholar",
    "skillId": "class:starseer",
    "minLevel": 12,
    "name": "Nightglass Scholar"
  },
  {
    "id": "progression-eclipse-hunter",
    "skillId": "class:starseer",
    "minLevel": 12,
    "name": "Eclipse Hunter"
  },
  {
    "id": "progression-firmament-keeper",
    "skillId": "class:starseer",
    "minLevel": 16,
    "name": "Firmament Keeper"
  },
  {
    "id": "progression-celestial-refrain",
    "skillId": "class:starseer",
    "minLevel": 16,
    "name": "Celestial Refrain"
  },
  {
    "id": "progression-memory-of-winter",
    "skillId": "class:starseer",
    "minLevel": 20,
    "name": "Memory of Winter"
  },
  {
    "id": "progression-threefold-sky",
    "skillId": "class:starseer",
    "minLevel": 20,
    "name": "Threefold Sky"
  },
  {
    "id": "progression-first-knife",
    "skillId": "class:rogue",
    "minLevel": 1,
    "name": "First Knife"
  },
  {
    "id": "progression-pocket-method",
    "skillId": "class:rogue",
    "minLevel": 1,
    "name": "Pocket Method"
  },
  {
    "id": "progression-crooked-measure",
    "skillId": "class:rogue",
    "minLevel": 4,
    "name": "Crooked Measure"
  },
  {
    "id": "progression-open-flank",
    "skillId": "class:rogue",
    "minLevel": 4,
    "name": "Open Flank"
  },
  {
    "id": "progression-hidden-palm",
    "skillId": "class:rogue",
    "minLevel": 8,
    "name": "Hidden Palm"
  },
  {
    "id": "progression-tighten-the-wire",
    "skillId": "class:rogue",
    "minLevel": 8,
    "name": "Tighten the Wire"
  },
  {
    "id": "progression-smoke-dancer",
    "skillId": "class:rogue",
    "minLevel": 12,
    "name": "Smoke Dancer"
  },
  {
    "id": "progression-carrion-measure",
    "skillId": "class:rogue",
    "minLevel": 12,
    "name": "Carrion Measure"
  },
  {
    "id": "progression-two-quiet-knives",
    "skillId": "class:rogue",
    "minLevel": 16,
    "name": "Two Quiet Knives"
  },
  {
    "id": "progression-trapdoor-smile",
    "skillId": "class:rogue",
    "minLevel": 16,
    "name": "Trapdoor Smile"
  },
  {
    "id": "progression-clean-exit",
    "skillId": "class:rogue",
    "minLevel": 20,
    "name": "Clean Exit"
  },
  {
    "id": "progression-razor-ledger",
    "skillId": "class:rogue",
    "minLevel": 20,
    "name": "Razor Ledger"
  },
  {
    "id": "progression-ashen-mercy",
    "skillId": "class:herald",
    "minLevel": 1,
    "name": "Ashen Mercy"
  },
  {
    "id": "progression-censer-keeper",
    "skillId": "class:herald",
    "minLevel": 1,
    "name": "Censer Keeper"
  },
  {
    "id": "progression-sower-of-blight",
    "skillId": "class:herald",
    "minLevel": 4,
    "name": "Sower of Blight"
  },
  {
    "id": "progression-funeral-watch",
    "skillId": "class:herald",
    "minLevel": 4,
    "name": "Funeral Watch"
  },
  {
    "id": "progression-ember-almoner",
    "skillId": "class:herald",
    "minLevel": 8,
    "name": "Ember Almoner"
  },
  {
    "id": "progression-choir-of-bone",
    "skillId": "class:herald",
    "minLevel": 8,
    "name": "Choir of Bone"
  },
  {
    "id": "progression-requiem-reader",
    "skillId": "class:herald",
    "minLevel": 12,
    "name": "Requiem Reader"
  },
  {
    "id": "progression-pilgrim-of-scars",
    "skillId": "class:herald",
    "minLevel": 12,
    "name": "Pilgrim of Scars"
  },
  {
    "id": "progression-crowned-offering",
    "skillId": "class:herald",
    "minLevel": 16,
    "name": "Crowned Offering"
  },
  {
    "id": "progression-dawn-cantor",
    "skillId": "class:herald",
    "minLevel": 16,
    "name": "Dawn Cantor"
  },
  {
    "id": "progression-bearer-of-burdens",
    "skillId": "class:herald",
    "minLevel": 20,
    "name": "Bearer of Burdens"
  },
  {
    "id": "progression-sepulchral-promise",
    "skillId": "class:herald",
    "minLevel": 20,
    "name": "Sepulchral Promise"
  }
];
export const progressionFeats = Object.freeze(featRows.map(feat => ({
  ...feat, description: getFeatDescription(authored, feat),
})));


export const progressionFeatUnlocks = Object.freeze([
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "progression-coal-on-steel"
  },
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "progression-brace-and-bite"
  },
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "progression-red-footwork"
  },
  {
    "classId": "reaver",
    "level": 4,
    "kind": "feat",
    "ref": "progression-anvil-discipline"
  },
  {
    "classId": "reaver",
    "level": 4,
    "kind": "feat",
    "ref": "progression-forge-momentum"
  },
  {
    "classId": "reaver",
    "level": 8,
    "kind": "feat",
    "ref": "progression-paid-in-blood"
  },
  {
    "classId": "reaver",
    "level": 8,
    "kind": "feat",
    "ref": "progression-last-rampart"
  },
  {
    "classId": "reaver",
    "level": 12,
    "kind": "feat",
    "ref": "progression-war-cadence"
  },
  {
    "classId": "reaver",
    "level": 12,
    "kind": "feat",
    "ref": "progression-broad-sentence"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "feat",
    "ref": "progression-ember-sovereign"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "feat",
    "ref": "progression-dread-of-the-hammer"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "feat",
    "ref": "progression-scarred-oath"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "feat",
    "ref": "progression-harvest-the-wound"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "progression-orbit-keeper"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "progression-moonward-scholar"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "progression-comet-reader"
  },
  {
    "classId": "starseer",
    "level": 4,
    "kind": "feat",
    "ref": "progression-mirror-of-rime"
  },
  {
    "classId": "starseer",
    "level": 4,
    "kind": "feat",
    "ref": "progression-constellation-keeper"
  },
  {
    "classId": "starseer",
    "level": 8,
    "kind": "feat",
    "ref": "progression-patient-wellspring"
  },
  {
    "classId": "starseer",
    "level": 8,
    "kind": "feat",
    "ref": "progression-weight-of-the-void"
  },
  {
    "classId": "starseer",
    "level": 12,
    "kind": "feat",
    "ref": "progression-nightglass-scholar"
  },
  {
    "classId": "starseer",
    "level": 12,
    "kind": "feat",
    "ref": "progression-eclipse-hunter"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "feat",
    "ref": "progression-firmament-keeper"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "feat",
    "ref": "progression-celestial-refrain"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "feat",
    "ref": "progression-memory-of-winter"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "feat",
    "ref": "progression-threefold-sky"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "progression-first-knife"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "progression-pocket-method"
  },
  {
    "classId": "rogue",
    "level": 4,
    "kind": "feat",
    "ref": "progression-crooked-measure"
  },
  {
    "classId": "rogue",
    "level": 4,
    "kind": "feat",
    "ref": "progression-open-flank"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "feat",
    "ref": "progression-hidden-palm"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "feat",
    "ref": "progression-tighten-the-wire"
  },
  {
    "classId": "rogue",
    "level": 12,
    "kind": "feat",
    "ref": "progression-smoke-dancer"
  },
  {
    "classId": "rogue",
    "level": 12,
    "kind": "feat",
    "ref": "progression-carrion-measure"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "feat",
    "ref": "progression-two-quiet-knives"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "feat",
    "ref": "progression-trapdoor-smile"
  },
  {
    "classId": "rogue",
    "level": 20,
    "kind": "feat",
    "ref": "progression-clean-exit"
  },
  {
    "classId": "rogue",
    "level": 20,
    "kind": "feat",
    "ref": "progression-razor-ledger"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "progression-ashen-mercy"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "progression-censer-keeper"
  },
  {
    "classId": "herald",
    "level": 4,
    "kind": "feat",
    "ref": "progression-sower-of-blight"
  },
  {
    "classId": "herald",
    "level": 4,
    "kind": "feat",
    "ref": "progression-funeral-watch"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "feat",
    "ref": "progression-ember-almoner"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "feat",
    "ref": "progression-choir-of-bone"
  },
  {
    "classId": "herald",
    "level": 12,
    "kind": "feat",
    "ref": "progression-requiem-reader"
  },
  {
    "classId": "herald",
    "level": 12,
    "kind": "feat",
    "ref": "progression-pilgrim-of-scars"
  },
  {
    "classId": "herald",
    "level": 16,
    "kind": "feat",
    "ref": "progression-crowned-offering"
  },
  {
    "classId": "herald",
    "level": 16,
    "kind": "feat",
    "ref": "progression-dawn-cantor"
  },
  {
    "classId": "herald",
    "level": 20,
    "kind": "feat",
    "ref": "progression-bearer-of-burdens"
  },
  {
    "classId": "herald",
    "level": 20,
    "kind": "feat",
    "ref": "progression-sepulchral-promise"
  }
]);
