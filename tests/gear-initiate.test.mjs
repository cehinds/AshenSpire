// Initiate tags (owner 2026-11-26/27): in Prepared a matching spell costs 1 less Mana (floor 0),
// one cut per spell. Tradition Initiates name Arcane or Divine spells; school Initiates one school.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApplyGearCardRules,
  GearManaCost,
  GearModText,
  GearRelicPieces,
  GearSelectorMatches,
  GearSummary,
} from '../src/model/gearEffects.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateEquipment } from '../src/model/loadout/validate.js';
import { ITEM_PROPERTIES } from '../src/content/itemProperties.js';

const PREPARED = { stance: 'prepared' };
const IDLE = { stance: 'idle' };
const PRINTED_MANA = 3;
const FIRE_INITIATE = 'schoolSpell:fire.cardInitiate=-1';
const ARCANE_INITIATE = 'arcaneSpell.cardInitiate=-1';
const DIVINE_INITIATE = 'divineSpell.cardInitiate=-1';
const PLAIN_MANA_CUT = 'spell.cardMana=-1';
const TRADITIONS_ON = {
  gameProfile: {
    modules: {
      gear: { typeEffectsVersion: 1 },
      effects: { spellTraditionsVersion: 1 },
    },
  },
};

const registries = createRegistries(contentBundle);

/** A spell of one school (or none) with an authored Mana price. */
function spell(school)
{
  const schoolTags = school
    ? [`school:${school}`]
    : [];
  return {
    id: 'initiate-probe',
    tags: [
      'camp:spell',
      ...schoolTags,
    ],
    effects: [],
    cost: 1,
    manaCost: PRINTED_MANA,
  };
}

/** The card rules a set of extra pieces fold to, each piece carrying the given mods. */
function rulesFor(modsByPiece, subject = TRADITIONS_ON)
{
  const pieces = modsByPiece.map((mods, index) => ({
    id: `initiate-piece-${index}`,
    kind: 'weapon',
    mods,
  }));
  const registry = {
    ...registries,
    equipment: {
      ...registries.equipment,
      armaments: [
        ...registries.equipment.armaments,
        ...pieces,
      ],
    },
  };
  const loadout = {
    sets: {
      rightHand: [pieces[0]?.id ?? null],
      leftHand: [pieces[1]?.id ?? null],
    },
    active: {},
  };
  return GearSummary(registry, loadout, 'starseer', subject).cardRules
    .filter(rule => rule.source.startsWith('initiate-piece-'));
}

/** The Mana a spell pays with these rules in this stance. */
function manaPaid(rules, def, state = PREPARED)
{
  return GearManaCost(ApplyGearCardRules(rules, def, state), PRINTED_MANA);
}

test('an Initiate mod reads Prepared stance and is marked as an Initiate', () =>
{
  const [rule] = rulesFor([[FIRE_INITIATE]]);
  assert.equal(rule.initiate, true);
  assert.deepEqual(rule.conds, [
    {
      name: 'stance',
      arg: 'prepared',
    },
  ]);
  const text = 'Fire spells in Prepared stance: Initiate, -1 MP cost';
  assert.equal(GearModText(registries, FIRE_INITIATE), text);
});

test('a school Initiate cuts only its own school, and only in Prepared stance', () =>
{
  const rules = rulesFor([[FIRE_INITIATE]]);
  assert.equal(manaPaid(rules, spell('fire')), PRINTED_MANA - 1, 'fire spell');
  assert.equal(manaPaid(rules, spell('frost')), PRINTED_MANA, 'another school');
  assert.equal(manaPaid(rules, spell(null)), PRINTED_MANA, 'a schoolless spell');
  assert.equal(manaPaid(rules, spell('fire'), IDLE), PRINTED_MANA, 'outside Prepared');
  const physical = {
    tags: [
      'camp:physical',
      'school:fire',
    ],
  };
  assert.equal(GearSelectorMatches('schoolSpell', 'fire', physical), false, 'spells only');
});

test('a tradition Initiate cuts its tradition and Shared spells, and needs spell traditions', () =>
{
  const arcane = rulesFor([[ARCANE_INITIATE]]);
  assert.equal(manaPaid(arcane, spell('force')), PRINTED_MANA - 1, 'an Arcane spell');
  assert.equal(manaPaid(arcane, spell('fire')), PRINTED_MANA - 1, 'a Shared spell');
  assert.equal(manaPaid(arcane, spell('decay')), PRINTED_MANA, 'a Divine spell');
  const divine = rulesFor([[DIVINE_INITIATE]]);
  assert.equal(manaPaid(divine, spell('decay')), PRINTED_MANA - 1, 'a Divine spell');
  assert.equal(manaPaid(divine, spell('force')), PRINTED_MANA, 'an Arcane spell');
  const legacy = {
    gameProfile: {
      modules: {
        gear: { typeEffectsVersion: 1 },
        effects: { spellTraditionsVersion: 0 },
      },
    },
  };
  const legacyRules = rulesFor([[ARCANE_INITIATE]], legacy);
  assert.deepEqual(legacyRules, [], 'no traditions, no tradition Initiate');
});

test('one Initiate cut per spell; other Mana changes still add; the price floors at 0', () =>
{
  const stacked = rulesFor([
    [FIRE_INITIATE],
    [
      ARCANE_INITIATE,
      DIVINE_INITIATE,
    ],
  ]);
  const fire = ApplyGearCardRules(stacked, spell('fire'), PREPARED);
  const matching = fire.gearManaRules.filter(rule => rule.initiate);
  assert.ok(matching.length >= 2, 'several Initiates match');
  assert.equal(GearManaCost(fire, PRINTED_MANA), PRINTED_MANA - 1, 'one cut');
  const withPlain = rulesFor([
    [FIRE_INITIATE],
    [PLAIN_MANA_CUT],
  ]);
  const plainPaid = manaPaid(withPlain, spell('fire'));
  assert.equal(plainPaid, PRINTED_MANA - 2, 'a non-Initiate Mana change adds on top');
  assert.equal(GearManaCost(fire, 0), 0, 'never below 0');
});

test('on a Shared spell the strongest Initiate wins, even against a larger Arcane group', () =>
{
  const rules = rulesFor([
    [
      ARCANE_INITIATE,
      ARCANE_INITIATE,
    ],
    ['divineSpell.cardInitiate=-2'],
  ]);
  assert.equal(manaPaid(rules, spell('fire')), PRINTED_MANA - 2);
});

test('on a Shared spell an Initiate and a plain Divine Mana change both apply', () =>
{
  for (const [divineCut, paid] of [
    ['divineSpell.cardMana=-1', PRINTED_MANA - 2],
    ['divineSpell.cardMana=-2', PRINTED_MANA - 3],
  ])
  {
    const rules = rulesFor([
      [ARCANE_INITIATE],
      [divineCut],
    ]);
    assert.equal(manaPaid(rules, spell('fire')), paid, divineCut);
  }
});

test('a relic carries gear rules through its item properties', () =>
{
  const relicRows = [
    {
      id: 'initiateProbeRelic',
      properties: ['initiateFire'],
    },
  ];
  const fromRun = GearRelicPieces({ relics: ['initiateProbeRelic'] }, relicRows);
  const fromFight = GearRelicPieces({ player: { relicIds: ['initiateProbeRelic'] } }, relicRows);
  assert.deepEqual(fromRun, fromFight, 'a run and a fight read the same relics');
  assert.deepEqual(fromRun[0].mods, [FIRE_INITIATE]);
  const bare = GearRelicPieces({ relics: ['initiateProbeRelic'] }, [{ id: 'initiateProbeRelic' }]);
  assert.deepEqual(bare, [], 'no properties, no piece');
});

test('the Starseer and Herald starting robes carry the Arcane and Divine Initiates', () =>
{
  for (const [classId, selector] of [
    ['starseer', 'arcaneSpell'],
    ['herald', 'divineSpell'],
  ])
  {
    const loadout = {
      sets: { armor: ['default'] },
      active: {},
    };
    const summary = GearSummary(registries, loadout, classId, TRADITIONS_ON);
    const initiates = summary.cardRules.filter(rule => rule.initiate);
    assert.deepEqual(initiates.map(rule => rule.selector), [selector], classId);
  }
});

test('every Initiate property names a registered gear mod, and the equipment tables validate', () =>
{
  const initiates = ITEM_PROPERTIES.filter(row => row.id.startsWith('initiate'));
  assert.ok(initiates.length >= 8);
  for (const row of initiates)
  {
    assert.equal(row.fx.gearMods.length, 1, row.id);
  }
  const relevant = /itemProperties|Initiate|schoolSpell/;
  const problems = validateEquipment(registries).filter(problem => relevant.test(problem));
  assert.deepEqual(problems, []);
});
