import { ARMAMENTS } from '../equipment.js';
import { progressionGearRequirements } from './gear.js';
// Existing families rescheduled by the approved expansion catalog.
// Item gates derive from the single gear requirements table.
export const progressionUnlocks = [
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "reaverIronFooting"
  },
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "reaverKeenBlade"
  },
  {
    "classId": "reaver",
    "level": 1,
    "kind": "feat",
    "ref": "reaverBloodDiscipline"
  },
  {
    "classId": "reaver",
    "level": 2,
    "kind": "cards",
    "ref": "enterGorefire"
  },
  {
    "classId": "reaver",
    "level": 4,
    "kind": "cards",
    "ref": "enterBulwark"
  },
  {
    "classId": "reaver",
    "level": 5,
    "kind": "relic",
    "ref": "whetstoneFragment"
  },
  {
    "classId": "reaver",
    "level": 8,
    "kind": "feat",
    "ref": "reaverMasteryFocus"
  },
  {
    "classId": "reaver",
    "level": 10,
    "kind": "cards",
    "ref": "warSurgeon"
  },
  {
    "classId": "reaver",
    "level": 11,
    "kind": "relic",
    "ref": "warhorn"
  },
  {
    "classId": "reaver",
    "level": 12,
    "kind": "cards",
    "ref": "hemorrhage"
  },
  {
    "classId": "reaver",
    "level": 14,
    "kind": "cards",
    "ref": "warcry"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "feat",
    "ref": "reaverMasteryResolve"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "cards",
    "ref": "sunderplate"
  },
  {
    "classId": "reaver",
    "level": 16,
    "kind": "cards",
    "ref": "goreblood"
  },
  {
    "classId": "reaver",
    "level": 17,
    "kind": "relic",
    "ref": "vowOfVengeance"
  },
  {
    "classId": "reaver",
    "level": 18,
    "kind": "cards",
    "ref": "warriorsVow"
  },
  {
    "classId": "reaver",
    "level": 18,
    "kind": "cards",
    "ref": "sanguinePactCard"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "cards",
    "ref": "bloodTithe"
  },
  {
    "classId": "reaver",
    "level": 20,
    "kind": "cards",
    "ref": "poiseBreaker"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "starseerAshShelter"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "starseerClearSky"
  },
  {
    "classId": "starseer",
    "level": 1,
    "kind": "feat",
    "ref": "starseerRitualPrecision"
  },
  {
    "classId": "starseer",
    "level": 2,
    "kind": "cards",
    "ref": "frostVeil"
  },
  {
    "classId": "starseer",
    "level": 5,
    "kind": "relic",
    "ref": "azureSigil"
  },
  {
    "classId": "starseer",
    "level": 6,
    "kind": "cards",
    "ref": "starlance"
  },
  {
    "classId": "starseer",
    "level": 8,
    "kind": "feat",
    "ref": "starseerMasteryFocus"
  },
  {
    "classId": "starseer",
    "level": 10,
    "kind": "cards",
    "ref": "meteorSwarm"
  },
  {
    "classId": "starseer",
    "level": 11,
    "kind": "relic",
    "ref": "pearlOfSagacity"
  },
  {
    "classId": "starseer",
    "level": 12,
    "kind": "cards",
    "ref": "azureCoilCard"
  },
  {
    "classId": "starseer",
    "level": 12,
    "kind": "cards",
    "ref": "astralCleave"
  },
  {
    "classId": "starseer",
    "level": 14,
    "kind": "cards",
    "ref": "radiantSpray"
  },
  {
    "classId": "starseer",
    "level": 14,
    "kind": "cards",
    "ref": "starPath"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "feat",
    "ref": "starseerMasteryResolve"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "cards",
    "ref": "moonlitShieldCard"
  },
  {
    "classId": "starseer",
    "level": 16,
    "kind": "cards",
    "ref": "astralInsight"
  },
  {
    "classId": "starseer",
    "level": 17,
    "kind": "relic",
    "ref": "prismaticThorn"
  },
  {
    "classId": "starseer",
    "level": 18,
    "kind": "cards",
    "ref": "umbralWard"
  },
  {
    "classId": "starseer",
    "level": 18,
    "kind": "cards",
    "ref": "waxingMoonCard"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "cards",
    "ref": "celestialLance"
  },
  {
    "classId": "starseer",
    "level": 20,
    "kind": "cards",
    "ref": "astromancerCard"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "rogueQuietGuard"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "rogueMeasuredPoint"
  },
  {
    "classId": "rogue",
    "level": 1,
    "kind": "feat",
    "ref": "rogueKnifeWork"
  },
  {
    "classId": "rogue",
    "level": 2,
    "kind": "cards",
    "ref": "feint"
  },
  {
    "classId": "rogue",
    "level": 5,
    "kind": "relic",
    "ref": "feralEye"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "feat",
    "ref": "rogueMasteryFocus"
  },
  {
    "classId": "rogue",
    "level": 8,
    "kind": "cards",
    "ref": "vanish"
  },
  {
    "classId": "rogue",
    "level": 10,
    "kind": "cards",
    "ref": "garrote"
  },
  {
    "classId": "rogue",
    "level": 11,
    "kind": "relic",
    "ref": "carrionTalon"
  },
  {
    "classId": "rogue",
    "level": 12,
    "kind": "cards",
    "ref": "setupRogue"
  },
  {
    "classId": "rogue",
    "level": 14,
    "kind": "cards",
    "ref": "sap"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "feat",
    "ref": "rogueMasteryResolve"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "cards",
    "ref": "bloodletterRogue"
  },
  {
    "classId": "rogue",
    "level": 16,
    "kind": "cards",
    "ref": "venomcoat"
  },
  {
    "classId": "rogue",
    "level": 17,
    "kind": "relic",
    "ref": "paupersDiadem"
  },
  {
    "classId": "rogue",
    "level": 18,
    "kind": "cards",
    "ref": "opportunistCard"
  },
  {
    "classId": "rogue",
    "level": 18,
    "kind": "cards",
    "ref": "envenomCard"
  },
  {
    "classId": "rogue",
    "level": 20,
    "kind": "cards",
    "ref": "smokeBomb"
  },
  {
    "classId": "rogue",
    "level": 20,
    "kind": "cards",
    "ref": "perfectHeist"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "heraldRiteShelter"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "heraldBlightPrecision"
  },
  {
    "classId": "herald",
    "level": 1,
    "kind": "feat",
    "ref": "heraldOathEdge"
  },
  {
    "classId": "herald",
    "level": 2,
    "kind": "cards",
    "ref": "contagion"
  },
  {
    "classId": "herald",
    "level": 5,
    "kind": "relic",
    "ref": "blessedDew"
  },
  {
    "classId": "herald",
    "level": 6,
    "kind": "cards",
    "ref": "scourge"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "feat",
    "ref": "heraldMasteryFocus"
  },
  {
    "classId": "herald",
    "level": 8,
    "kind": "cards",
    "ref": "emberTideCard"
  },
  {
    "classId": "herald",
    "level": 10,
    "kind": "cards",
    "ref": "harbingerOfBlightCard"
  },
  {
    "classId": "herald",
    "level": 11,
    "kind": "relic",
    "ref": "flayersCenser"
  },
  {
    "classId": "herald",
    "level": 12,
    "kind": "cards",
    "ref": "stigmataCard"
  },
  {
    "classId": "herald",
    "level": 14,
    "kind": "cards",
    "ref": "reclamation"
  },
  {
    "classId": "herald",
    "level": 16,
    "kind": "feat",
    "ref": "heraldMasteryResolve"
  },
  {
    "classId": "herald",
    "level": 16,
    "kind": "cards",
    "ref": "desperateRite"
  },
  {
    "classId": "herald",
    "level": 17,
    "kind": "relic",
    "ref": "blightTouchedIdol"
  },
  {
    "classId": "herald",
    "level": 18,
    "kind": "cards",
    "ref": "lastMercy"
  },
  {
    "classId": "herald",
    "level": 20,
    "kind": "cards",
    "ref": "bloodOfferingRite"
  }
].concat(progressionGearRequirements.filter(row => row.level > 0).map(({classId,level,ref}) => ({classId,level,ref,kind:ref.startsWith('armament/') && ARMAMENTS.find(piece => piece.id === ref.slice(9))?.kind === 'weapon' ? 'weapon' : 'armament'})));
