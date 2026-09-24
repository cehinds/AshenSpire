// tools/derivedstats.mjs — executable contract for the inert derived-stat table.
//
// This deliberately does not enter tests/run-node.mjs while the rules remain
// inert. It imports no run/combat/session code and reads the Phase 1 attribute
// vocabulary from its authoritative table, so this branch cannot wire mechanics
// or drift the attribute order by accident.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivedStatRules } from '../src/content/derivedStats.js';
import { attributes as phase1Attributes } from '../src/content/attributes.js';
import {
  derivedStatRuleProblems,
  resolveDerivedStatRules,
  deriveStat,
  createDerivedStatRuleSnapshot,
  restoreDerivedStatRuleSnapshot,
  deriveAttributeTierReceipt,
  ruleWeights,
} from '../src/model/derivedStats.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATTRIBUTE_IDS = phase1Attributes.slice().sort((a, b) => a.order - b.order).map((row) => row.id);
// THE MODEL EVERY PINNED NUMBER BELOW DESCRIBES.
//
// #584: this file sat red on `dev` with eleven failures because the shipped
// rules moved to version 4 (9434b7c5, "save-safe tuned attribute formulas") and
// nothing here followed. Energy and Draw went to a ten-point tier, HP became a
// flat 30 + 2 x CON that no longer reads class data at all, and the numbers here
// still described version 3.
//
// THE TICKET ASKED FOR THE EXPECTATIONS TO BE DERIVED FROM THE LIVE RULESET.
// THEY ARE DELIBERATELY NOT. A contract file that computes its expectations from
// the table it is checking agrees with every possible table and asserts nothing —
// it would have gone green the moment the model changed, which is the opposite of
// the job. The numbers are the contract, so they stay pinned and the VERSION is
// tied instead: change the model without bumping `rulesetVersion` and the row
// corpora below catch it; bump the version without revisiting this file and the
// single check below fails and says exactly what to do.
//
// RE-DERIVED FOR RULESET 6 BY HAND (#1253, owner 2026-09-21: "make mp hp and
// every resource now a similar calculation to AR, PR, DR"). A row is now a base,
// a decimal weight per attribute floored on its own, and a decimal growth per
// level — the rating shape. Every number below was worked out from that sentence
// and the table's authored weights, not read back from the resolver.
//
// RE-DERIVED FOR RULESET 7 BY HAND (owner 2026-09-24: "I'd like all features,
// handsize, draw amount, actions, ar, dr, pr, ward, poise, stamina, mana, hp
// settings to have a similiar interface"). Twelve rows now, every one priced
// the same way: base + Σ floor(attribute × weight) + floor(perLevel × (level −
// 1)), held inside the row's own `min` / `max`. The table carries no `cap` —
// that survives only as a carrier on snapshots and layers. Mana, Stamina,
// Actions, HP and Poise read a spread of attributes rather than one, so every
// fixture below states all five attributes; the pool door refuses a missing
// one by name. Each number was worked from the rows in src/content/
// derivedStats.js with pencil arithmetic and is written out beside its check.
const CONTRACT_RULESET_VERSION = 7;

// `maxHp: 84` is deliberately NOT the HP base any row uses. The HP row is a flat
// 30 and ignores class data, so a fixture carrying a different number is what
// makes that provable rather than assumed.
const CLASS = { id: 'reaver', maxHp: 84 };
// Every attribute at 1. Each ruleset-7 weight is below 1 except HP's and
// Poise's Constitution and Ward's Wisdom, so at 1 a term floors to 0 and a
// fixture moves only the attribute it names. Written out, never read from
// the table.
const ONES = Object.freeze({ strength: 1, dexterity: 1, constitution: 1, wisdom: 1, intelligence: 1 });
const at = (attributes) => ({ ...ONES, ...attributes });
let failures = 0;
let checks = 0;

function check(name, fn) {
  checks++;
  try {
    const detail = fn();
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name} — ${error && error.message ? error.message : error}`);
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const equal = (actual, expected, message) => assert(Object.is(actual, expected), `${message}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
const clone = (value) => structuredClone(value);

function resolved(options = {}) {
  return resolveDerivedStatRules(derivedStatRules, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'], ...options });
}

console.log('derivedstats — inert post-Phase-1 rules contract\n');

check('this file is written against the shipped ruleset version', () => {
  equal(derivedStatRules.rulesetVersion, CONTRACT_RULESET_VERSION,
    'the shipped ruleset version moved. Every pinned number in this file describes ruleset '
    + `${CONTRACT_RULESET_VERSION}. Re-derive them by hand against the new model and bump `
    + 'CONTRACT_RULESET_VERSION. Do NOT compute them from derivedStatRules — that makes this '
    + 'file agree with any model and assert nothing (#584)');
});

check('one authoritative object carries the global defaults', () => {
  equal(derivedStatRules.defaults.perLevel, 0, 'perLevel');
  // Ruleset 7 bounds a row with its own `min` / `max`; a table-wide `cap` is
  // gone, and so are the tier and its rounding ruleset 6 already dropped.
  equal(JSON.stringify(Object.keys(derivedStatRules.defaults)), '["perLevel"]', 'default fields');
  assert(!('cap' in derivedStatRules.defaults), 'no global cap');
  assert(!('pointsPerTier' in derivedStatRules.defaults), 'no global tier');
  assert(!('rounding' in derivedStatRules.defaults), 'no global rounding');
});

check('the twelve rows answer to the ruled attributes', () => {
  const got = Object.entries(derivedStatRules.rules)
    .map(([id, row]) => `${id}:${ruleWeights(row).map(([attr, weight]) => `${attr}x${weight}`).join('+')}`).join(',');
  equal(got, [
    'energy:strengthx0.1+dexterityx0.2+wisdomx0.01+intelligencex0.01',
    'openingHand:intelligencex0.45',
    'draw:intelligencex0.1',
    'handSize:intelligencex0.19',
    'hp:strengthx0.35+constitutionx4+wisdomx0.1',
    'stamina:strengthx0.25+dexterityx0.25+constitutionx0.5',
    'mana:strengthx0.125+constitutionx0.25+wisdomx0.5+intelligencex0.125',
    'ar:strengthx0.75+dexterityx0.5+constitutionx0.25+wisdomx0.25+intelligencex0.25',
    'dr:strengthx0.5+dexterityx0.75+constitutionx0.25+wisdomx0.35+intelligencex0.15',
    'pr:dexterityx0.25+constitutionx0.5+wisdomx0.5+intelligencex0.75',
    'ward:dexterityx0.2+constitutionx0.3+wisdomx1+intelligencex0.5',
    'poise:strengthx0.5+constitutionx1+wisdomx0.3+intelligencex0.2',
  ].join(','), 'row map');
});

// THE BOUNDS ARE THE ROW'S OWN. Only the three hand rows carry them, and they
// are the retired hand rules' minimum / maximum restated on the row.
check('only the hand rows are bounded, by their own min and max', () => {
  const got = Object.entries(derivedStatRules.rules)
    .filter(([, row]) => 'min' in row || 'max' in row || 'cap' in row)
    .map(([id, row]) => `${id}:${row.min}..${row.max}${'cap' in row ? ' cap' : ''}`).join(',');
  equal(got, 'openingHand:3..15,draw:2..10,handSize:1..30', 'bounded rows');
});

check('the shipped table passes the closed schema', () => {
  const problems = derivedStatRuleProblems(derivedStatRules, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  assert(Array.isArray(problems) && problems.length === 0, problems.map((p) => `${p.path}: ${p.msg}`).join('; '));
});

// A WEIGHT OF 0.2 IS ONE EVERY FIVE POINTS, FLOORED ON ITS OWN: DEX 10 buys
// floor(10 x 0.2) = 2 Actions on the base 3. STR 1 x 0.1, WIS 1 x 0.01 and
// INT 1 x 0.01 each floor to 0.
check('DEX 10 gives Energy base 3 + floor(10 x 0.2) = 5', () => {
  const out = deriveStat(resolved(), 'energy', { attributes: at({ dexterity: 10 }), classDef: CLASS });
  equal(out.terms.dexterity, 2, 'dexterity term'); equal(out.terms.strength, 0, 'strength term at 1');
  equal(out.raw, 5, 'raw'); equal(out.value, 5, 'value');
});

check('INT 10 gives Draw base 2 + floor(10 x 0.1) = 3', () => {
  const out = deriveStat(resolved(), 'draw', { attributes: at({ intelligence: 10 }), classDef: CLASS });
  equal(out.terms.intelligence, 1, 'intelligence term'); equal(out.raw, 3, 'raw'); equal(out.value, 3, 'value');
});

check('a tenth of a card is nothing until ten arrive: INT 9 stays at the base, INT 10 buys one', () => {
  equal(deriveStat(resolved(), 'draw', { attributes: at({ intelligence: 9 }), classDef: CLASS }).value, 2, 'INT 9');
  equal(deriveStat(resolved(), 'draw', { attributes: at({ intelligence: 10 }), classDef: CLASS }).value, 3, 'INT 10');
  equal(deriveStat(resolved(), 'draw', { attributes: at({ intelligence: 19 }), classDef: CLASS }).value, 3, 'INT 19');
  equal(deriveStat(resolved(), 'draw', { attributes: at({ intelligence: 20 }), classDef: CLASS }).value, 4, 'INT 20');
});

// Stamina's budget is 1: STR 0.25 + DEX 0.25 + CON 0.5. Wisdom left the row
// in ruleset 7, so a Wisdom fixture proves it moves nothing.
check('CON 10 gives Stamina base 1 + floor(10 x 0.5) = 6, STR and DEX a quarter each, WIS nothing', () => {
  equal(deriveStat(resolved(), 'stamina', { attributes: at({ constitution: 10 }), classDef: CLASS }).value, 6, 'CON 10');
  equal(deriveStat(resolved(), 'stamina', { attributes: at({ strength: 4, dexterity: 4, constitution: 10 }), classDef: CLASS }).value, 8,
    'STR 4, DEX 4, CON 10: 1 + 1 + 1 + 5');
  equal(deriveStat(resolved(), 'stamina', { attributes: at({ wisdom: 20 }), classDef: CLASS }).value, 1, 'WIS 20 is not a Stamina source');
});

// "mana should be derived but mostly comes from about 4 points in wisdom with
// some from constitution strength and intelligence" — weights WIS 0.5, CON
// 0.25, STR 0.125, INT 0.125, a budget of 1.
check('Mana comes mostly from Wisdom: WIS 10 yields base 1 + floor(10 x 0.5) = 6, and every attribute at 8 yields 1 + 8', () => {
  const out = deriveStat(resolved(), 'mana', { attributes: at({ wisdom: 10 }), classDef: CLASS });
  equal(out.base, 1, 'Mana base'); equal(out.terms.wisdom, 5, 'wisdom term'); equal(out.value, 6, 'Mana');
  // At 8 each term is whole: STR 1 + CON 2 + WIS 4 + INT 1 = 8, the budget of 1 per point.
  const eights = deriveStat(resolved(), 'mana', { attributes: { strength: 8, dexterity: 8, constitution: 8, wisdom: 8, intelligence: 8 }, classDef: CLASS });
  equal(JSON.stringify(eights.terms), '{"strength":1,"constitution":2,"wisdom":4,"intelligence":1}', 'Mana terms at 8');
  equal(eights.value, 9, 'Mana at every attribute 8');
});

check('CON HP is a flat base plus four per point, and reads no class field', () => {
  const out = deriveStat(resolved(), 'hp', { attributes: at({ constitution: 10 }), classDef: CLASS });
  equal(out.base, 30, 'HP base is the row, not the class'); equal(out.terms.constitution, 40, 'four per CON point');
  equal(out.terms.strength, 0, 'STR 1 x 0.35 floors to 0'); equal(out.terms.wisdom, 0, 'WIS 1 x 0.1 floors to 0');
  equal(out.value, 70, 'derived HP: 30 + 10 x 4');
});

check('the level term is one decimal, floored: HP 2, Mana/Stamina 0.2, Actions 0.1, Draw none', () => {
  const bonus = (id, level) => deriveStat(resolved(), id, { attributes: ONES, classDef: CLASS, level }).levelBonus;
  equal(bonus('hp', 1), 0, 'no term at level 1');
  equal(bonus('hp', 4), 6, 'HP: two per level past the first');
  equal(bonus('mana', 5), 0, 'Mana: four fifths is not yet a point');
  equal(bonus('mana', 6), 1, 'Mana: five fifths is one');
  equal(bonus('stamina', 6), 1, 'Stamina: five fifths is one');
  equal(bonus('energy', 10), 0, 'Actions wait for level 11');
  equal(bonus('energy', 11), 1, 'Actions: one at 11');
  equal(bonus('draw', 50), 0, 'Draw has no level term');
});

check('a row may answer to several attributes, each term floored on its own', () => {
  const source = clone(derivedStatRules);
  source.rules.energy = { base: 3, dexterity: 0.25, strength: 0.5 };
  const rules = resolveDerivedStatRules(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  const out = deriveStat(rules, 'energy', { attributes: { dexterity: 9, strength: 3 }, classDef: CLASS });
  equal(out.terms.dexterity, 2, 'floor(9 x 0.25)'); equal(out.terms.strength, 1, 'floor(3 x 0.5)');
  equal(out.value, 6, 'Energy: base 3 + 2 + 1 — not floor(3.75)');
});

check('an authored row outranks the authored global defaults', () => {
  const source = clone(derivedStatRules);
  source.defaults.perLevel = 0.5;
  const rules = resolveDerivedStatRules(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  // Draw states no perLevel, so it inherits the table's; HP states its own 2.
  equal(deriveStat(rules, 'draw', { attributes: ONES, classDef: CLASS, level: 3 }).levelBonus, 1, 'Draw inherits 0.5');
  equal(deriveStat(rules, 'hp', { attributes: ONES, classDef: CLASS, level: 3 }).levelBonus, 4, 'HP keeps its own 2');
});

// The equipment-profile helper keeps the single-stat tier vocabulary — it is a
// different table (content/attributes.js equipmentProfiles), not this one.
check('the equipment-profile tier receipt owns no weapon base', () => {
  const receipt = deriveAttributeTierReceipt({ sourceStat: 'dexterity', pointsPerTier: 4, gainPerTier: 3, rounding: 'ceil' },
    { attributes: { dexterity: 9 } });
  equal(receipt.sourceStat, 'dexterity', 'source stat');
  equal(receipt.points, 9, 'points');
  equal(receipt.tier, 3, 'ceil(9 / 4)');
  equal(receipt.value, 9, 'tier contribution only');
  assert(!Object.hasOwn(receipt, 'base'), 'generic receipt must not own a weapon base');
});

// RULESET 7 BOUNDS A ROW WITH `min` / `max`; `cap` is a carrier a layer may
// still state, and it clamps exactly as it always did.
check('a row\'s min and max clamp the final value, a layer\'s cap still clamps, and no bound means none', () => {
  const dex10 = at({ dexterity: 10 });
  const value = (options) => deriveStat(resolved(options), 'energy', { attributes: dex10, classDef: CLASS });
  equal(value({ explicitOverride: { rules: { energy: { max: 4 } } } }).value, 4, 'max');
  equal(value({ explicitOverride: { rules: { energy: { max: 4 } } } }).raw, 5, 'max leaves raw');
  equal(value({ explicitOverride: { rules: { energy: { min: 7 } } } }).value, 7, 'min');
  equal(value({ explicitOverride: { rules: { energy: { cap: 2 } } } }).value, 2, 'carrier cap');
  equal(value().value, 5, 'unbounded');
  // Draw's own floor: base 0 at INT 1 is raw 0, held to the row's min 2.
  const floored = deriveStat(resolved({ explicitOverride: { rules: { draw: { base: 0 } } } }), 'draw', { attributes: ONES, classDef: CLASS });
  equal(floored.raw, 0, 'Draw raw'); equal(floored.value, 2, 'Draw held to min 2');
});

check('shipped Energy grows unbounded at high stats; the hand rows hold to their max', () => {
  const rules = resolved();
  for (const [id, row] of Object.entries(rules.rules)) assert(!('cap' in row), `resolved ${id} carries a cap`);
  equal(rules.rules.energy.min, undefined, 'Energy min'); equal(rules.rules.energy.max, undefined, 'Energy max');
  const high = (id, attribute) => deriveStat(rules, id, { attributes: at({ [attribute]: 5000 }), classDef: CLASS });
  // 3 + floor(5000 x 0.2); STR, WIS and INT at 1 add nothing.
  equal(high('energy', 'dexterity').value, 1003, 'uncapped high-stat Energy');
  // 2 + floor(5000 x 0.1) = 502, 4 + floor(5000 x 0.45) = 2254, 7 + floor(5000 x 0.19) = 957.
  equal(high('draw', 'intelligence').raw, 502, 'Draw raw'); equal(high('draw', 'intelligence').value, 10, 'Draw max');
  equal(high('openingHand', 'intelligence').raw, 2254, 'opening hand raw'); equal(high('openingHand', 'intelligence').value, 15, 'opening hand max');
  equal(high('handSize', 'intelligence').raw, 957, 'hand size raw'); equal(high('handSize', 'intelligence').value, 30, 'hand size max');
});

// The fixture carries a maxHp and a maxMana that are BOTH wrong answers, so a
// row that started reading class data again would be caught.
check('neither HP nor Mana reads class data, and deriving mutates no input', () => {
  const attributes = at({ constitution: 10, wisdom: 10 });
  const classDef = { id: 'newClass', maxHp: 137, maxMana: 23 };
  const before = JSON.stringify({ attributes, classDef });
  equal(deriveStat(resolved(), 'hp', { attributes, classDef }).base, 30, 'HP ignores class data');
  equal(deriveStat(resolved(), 'mana', { attributes, classDef }).base, 1, 'Mana ignores class data');
  equal(JSON.stringify({ attributes, classDef }), before, 'inputs unchanged');
});

check('precedence is authored defaults/rows < mode < run < explicit override', () => {
  const rules = resolved({
    modeModifiers: { rules: { energy: { base: 2, dexterity: 0.5 } } },
    runModifiers: [{ rules: { energy: { base: 4, dexterity: 1 } } }],
    explicitOverride: { rules: { energy: { base: 7 } } },
  });
  const out = deriveStat(rules, 'energy', { attributes: at({ dexterity: 10 }), classDef: CLASS });
  equal(out.terms.dexterity, 10, 'retained run weight'); equal(out.raw, 17, 'explicit base plus retained run weight');
});

check('run modifiers apply in listed order before the explicit/debug override', () => {
  const rules = resolved({
    runModifiers: [
      { rules: { draw: { base: 4, intelligence: 1 } } },
      { rules: { draw: { base: 6 } } },
    ],
    explicitOverride: { rules: { draw: { intelligence: 0.5 } } },
  });
  const out = deriveStat(rules, 'draw', { attributes: at({ intelligence: 10 }), classDef: CLASS });
  equal(out.raw, 11, 'later run base 6 + explicit floor(10 x 0.5)');
  equal(out.value, 10, 'held to Draw\'s own max 10');
});

check('a mode-level defaults override reaches every row until a row patch replaces it', () => {
  const rules = resolved({ modeModifiers: {
    defaults: { perLevel: 0.5 },
    rules: { energy: { perLevel: 2 } },
  } });
  equal(deriveStat(rules, 'draw', { attributes: ONES, classDef: CLASS, level: 3 }).levelBonus, 1, 'mode default reached Draw');
  equal(deriveStat(rules, 'energy', { attributes: ONES, classDef: CLASS, level: 3 }).levelBonus, 4, 'row patch replaced mode default');
});

const badCases = [
  ['negative global perLevel', (x) => { x.defaults.perLevel = -1; }, 'defaults.perLevel'],
  ['a rounding word on a ruleset-7 row', (x) => { x.rules.draw.rounding = 'floor'; }, 'rules.draw.rounding'],
  // Ruleset 7 bounds a row with min / max; a cap is a snapshot or layer
  // carrier only, refused on an authored row whatever its value.
  ['a cap on a ruleset-7 row', (x) => { x.rules.energy.cap = 3; }, 'rules.energy.cap'],
  ['non-numeric max', (x) => { x.rules.draw.max = 'ten'; }, 'rules.draw.max'],
  ['a fractional min', (x) => { x.rules.handSize.min = 1.5; }, 'rules.handSize.min'],
  ['a min above its max', (x) => { x.rules.openingHand.min = 16; }, 'rules.openingHand.min'],
  ['missing required base', (x) => { delete x.rules.stamina.base; }, 'rules.stamina.base'],
  ['unknown source attribute', (x) => { x.rules.mana.luck = 1; }, 'rules.mana.luck'],
  ['negative attribute weight', (x) => { x.rules.hp.constitution = -1; }, 'rules.hp.constitution'],
  ['a retired tier on a ruleset-7 row', (x) => { x.rules.energy.pointsPerTier = 5; }, 'rules.energy.pointsPerTier'],
  ['a gain on a ruleset-7 row', (x) => { x.rules.hp.gain = 4; }, 'rules.hp.gain'],
  ['the retired { every, gain } cadence', (x) => { x.rules.hp.perLevel = { every: 5, gain: 5 }; }, 'rules.hp.perLevel'],
  // Replacing the whole base keeps the class-base schema path covered without
  // depending on the shipped table still using that shape.
  ['unknown class base field', (x) => { x.rules.hp.base = { field: 'hitPoints' }; }, 'rules.hp.base.field'],
  ['unknown rule field', (x) => { x.rules.energy.diminishing = true; }, 'rules.energy.diminishing'],
  ['missing required row', (x) => { delete x.rules.draw; }, 'rules.draw'],
  ['extra derived row', (x) => { x.rules.dodge = clone(x.rules.energy); }, 'rules.dodge'],
];
for (const [name, mutate, path] of badCases) check(`schema refuses ${name} by path`, () => {
  const source = clone(derivedStatRules); mutate(source);
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  assert(problems.some((p) => p.path === path), `no problem at ${path}: ${JSON.stringify(problems)}`);
});

const rootNumericMutants = [
  ['rulesetVersion zero', (x) => { x.rulesetVersion = 0; }, 'rulesetVersion'],
  ['rulesetVersion fractional', (x) => { x.rulesetVersion = 1.5; }, 'rulesetVersion'],
  ['rulesetVersion NaN', (x) => { x.rulesetVersion = Number.NaN; }, 'rulesetVersion'],
  // ONE PAST WHATEVER SHIPS, not the literal 4. Pinning 4 was right while 3
  // shipped; 4 then BECAME the shipped version and this known-bad quietly stopped
  // being bad. The property is "a version the resolver does not support", and
  // that is the only thing here derived from the live table — deriving a number
  // this file is asserting would be the tautology the header refuses.
  ['unsupported positive rulesetVersion', (x) => { x.rulesetVersion = derivedStatRules.rulesetVersion + 1; }, 'rulesetVersion'],
  ['default perLevel NaN', (x) => { x.defaults.perLevel = Number.NaN; }, 'defaults.perLevel'],
  // A ruleset-7 table has no global cap, so any value there is refused.
  ['default cap negative', (x) => { x.defaults.cap = -1; }, 'defaults.cap'],
  ['default cap infinite', (x) => { x.defaults.cap = Infinity; }, 'defaults.cap'],
];
for (const [name, mutate, path] of rootNumericMutants) check(`numeric corpus refuses ${name}`, () => {
  const source = clone(derivedStatRules); mutate(source);
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  assert(problems.some((p) => p.path === path), `no problem at ${path}`);
});

for (const id of Object.keys(derivedStatRules.rules)) {
  const row = derivedStatRules.rules[id];
  const [attribute] = ruleWeights(row)[0];
  const mutations = [
    ['weight NaN', (x) => { x.rules[id][attribute] = Number.NaN; }, `rules.${id}.${attribute}`],
    ['perLevel negative', (x) => { x.rules[id].perLevel = -0.5; }, `rules.${id}.perLevel`],
    ['max negative', (x) => { x.rules[id].max = -1; }, `rules.${id}.max`],
    ['min fractional', (x) => { x.rules[id].min = 0.5; }, `rules.${id}.min`],
  ];
  if (typeof row.base === 'number') mutations.push(['base NaN', (x) => { x.rules[id].base = Number.NaN; }, `rules.${id}.base`]);
  else mutations.push(['class base loses field', (x) => { delete x.rules[id].base.field; }, `rules.${id}.base.field`]);
  for (const [name, mutate, path] of mutations) check(`${id} row corpus refuses ${name}`, () => {
    const source = clone(derivedStatRules); mutate(source);
    const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
    assert(problems.some((p) => p.path === path), `no problem at ${path}`);
  });
}

const completenessMutants = [
  ['missing global perLevel', (x) => { delete x.defaults.perLevel; }, 'defaults.perLevel'],
  // Ruleset 7 retired the global cap: stating one is the error, not omitting it.
  ['a retired global cap', (x) => { x.defaults.cap = null; }, 'defaults.cap'],
  ['unknown global field', (x) => { x.defaults.threshold = 4; }, 'defaults.threshold'],
  ['a retired global tier', (x) => { x.defaults.pointsPerTier = 5; }, 'defaults.pointsPerTier'],
  ['unknown root field', (x) => { x.secondRules = {}; }, 'derivedStatRules.secondRules'],
  ['missing row base', (x) => { delete x.rules.energy.base; }, 'rules.energy.base'],
];
for (const [name, mutate, path] of completenessMutants) check(`completeness corpus refuses ${name}`, () => {
  const source = clone(derivedStatRules); mutate(source);
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  assert(problems.some((p) => p.path === path), `no problem at ${path}`);
});

// A LAYER IS READ IN RULESET-6 WORDS, so a retired spelling is refused under
// the name it is carried by: a zero `pointsPerTier` divisor is named as the
// `pointsPerIncrease` it becomes.
const overrideMutants = [
  ['default divisor zero', { defaults: { pointsPerTier: 0 } }, 'explicitOverride.defaults.pointsPerIncrease'],
  ['default perLevel negative', { defaults: { perLevel: -1 } }, 'explicitOverride.defaults.perLevel'],
  ['default rounding unknown', { defaults: { rounding: 'truncate' } }, 'explicitOverride.defaults.rounding'],
  ['default cap negative', { defaults: { cap: -1 } }, 'explicitOverride.defaults.cap'],
  ['rule base NaN', { rules: { energy: { base: Number.NaN } } }, 'explicitOverride.rules.energy.base'],
  ['rule attribute unknown', { rules: { energy: { luck: 1 } } }, 'explicitOverride.rules.energy.luck'],
  ['rule weight negative', { rules: { energy: { dexterity: -1 } } }, 'explicitOverride.rules.energy.dexterity'],
  ['rule perLevel negative', { rules: { energy: { perLevel: -1 } } }, 'explicitOverride.rules.energy.perLevel'],
  ['rule rounding unknown', { rules: { energy: { rounding: 'truncate' } } }, 'explicitOverride.rules.energy.rounding'],
  ['rule cap negative', { rules: { energy: { cap: -1 } } }, 'explicitOverride.rules.energy.cap'],
  ['unknown override field', { debugMagic: true }, 'explicitOverride.debugMagic'],
  ['unknown override row', { rules: { dodge: { base: 1 } } }, 'explicitOverride.rules.dodge'],
];
for (const [name, explicitOverride, path] of overrideMutants) check(`override corpus refuses ${name}`, () => {
  let message = '';
  try { resolved({ explicitOverride }); } catch (error) { message = error.message; }
  assert(message.includes(path), `refusal did not name ${path}: ${message}`);
});

check('the same override validator guards mode and every run layer by its own path', () => {
  let modeMessage = '';
  try { resolved({ modeModifiers: { defaults: { perLevel: -1 } } }); } catch (error) { modeMessage = error.message; }
  assert(modeMessage.includes('modeModifiers.defaults.perLevel'), `mode path absent: ${modeMessage}`);
  let runMessage = '';
  try { resolved({ runModifiers: [{}, { rules: { draw: { cap: -1 } } }] }); } catch (error) { runMessage = error.message; }
  assert(runMessage.includes('runModifiers[1].rules.draw.cap'), `run path absent: ${runMessage}`);
});

check('only a host may author the co-op rules snapshot', () => {
  let message = '';
  try { createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'client', attributeIds: ATTRIBUTE_IDS }); }
  catch (error) { message = error.message; }
  assert(/host/i.test(message), `client refusal did not name host authority: ${message}`);
});

check('a host snapshot records the ruleset version and resolved overrides', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, {
    authority: 'host', attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'], classDef: CLASS,
    explicitOverride: { rules: { energy: { base: 9 } } },
  });
  equal(snap.rulesetVersion, CONTRACT_RULESET_VERSION, 'rulesetVersion');
  equal(snap.rules.rules.energy.base, 9, 'snapshotted explicit override');
});

check('resume derives from the saved snapshot, never changed live rules', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'host', attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'], classDef: CLASS });
  const changed = clone(derivedStatRules); changed.rules.energy.base = 99;
  const restored = restoreDerivedStatRuleSnapshot(JSON.parse(JSON.stringify(snap)), { attributeIds: ATTRIBUTE_IDS });
  equal(deriveStat(restored.rules, 'energy', { attributes: at({ dexterity: 10 }), classDef: CLASS }).value, 5, 'resumed Energy');
  equal(changed.rules.energy.base, 99, 'control mutation');
});

check('resume refuses an unknown snapshot/ruleset version by name', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'host', attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'], classDef: CLASS });
  snap.rulesetVersion = 999;
  let message = '';
  try { restoreDerivedStatRuleSnapshot(snap, { attributeIds: ATTRIBUTE_IDS }); } catch (error) { message = error.message; }
  assert(/rulesetVersion 999/.test(message), `version refusal not named: ${message}`);
});

check('resume refuses an unknown snapshot envelope version by name', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'host', attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'], classDef: CLASS });
  snap.snapshotVersion = 999;
  let message = '';
  try { restoreDerivedStatRuleSnapshot(snap, { attributeIds: ATTRIBUTE_IDS }); } catch (error) { message = error.message; }
  assert(/snapshotVersion 999/.test(message), `snapshot refusal not named: ${message}`);
});

check('the integrated dependency seam has one rules owner and value-only consumers', () => {
  const consumers = [
    'src/model/state.js', 'src/model/resources.js', 'src/engine/actions.js',
    'src/engine/combat.js', 'src/engine/coopCombat.js', 'tools/session.mjs',
  ];
  const wired = consumers.filter((rel) => /derivedStats|derivedStatRules/.test(readFileSync(resolve(ROOT, rel), 'utf8')));
  equal(wired.join(','), 'src/model/state.js', 'only run-state creation/restore resolves rules');
  const model = readFileSync(resolve(ROOT, 'src/model/derivedStats.js'), 'utf8');
  assert(!/content\/attributes|model\/attributes/.test(model), 'reader imports Phase 1 instead of accepting its allocation seam');
});

// NO PARSER. FOUR ROUNDS OF REVIEW KILLED FOUR TEXT SCANNERS HERE.
//
//   a blanket quote strip     erased the smuggling it was hunting
//   a comment regex           read `const url = 'https://x'` as a comment opener
//   a hand-written lexer      took `/[/*]/` for a block comment and swallowed
//                             the rest of the file
//   a global subtraction      removed the approved sentence from EVERY place it
//                             appeared, so code comparing against that exact
//                             sentence had the word removed for it
//
// Every one was a correct fix for the previous defect and wrong in a new way.
// The first three needed to know JavaScript's grammar and did not. The fourth
// knew no grammar at all and still failed, for the reason that unites all four:
// AN EXEMPTION APPLIED WHEREVER IT MATCHES IS NOT AN EXEMPTION, IT IS A HOLE.
//
// So the exemption is pinned to the declaration and nothing else. Three arms:
//
//   THE DATA is walked as data — keys and values off the imported table, so no
//   text is involved and a row, a key or a non-prose value carrying the
//   vocabulary is caught by structure rather than by spelling.
//
//   THE MODEL FILE gets NO exemption whatsoever. It is code; it declares no
//   presentation prose, so there is nothing there to allow. Codex's example
//   lived in this file, and this arm alone would have caught it.
//
//   THE CONTENT FILE has its declarations subtracted, KEY INCLUDED: the needle
//   is `sense: '…'`, not `'…'`. A bare copy of the sentence in a comparison has
//   no key in front of it, survives the subtraction, and fails. Each needle is
//   subtracted ONCE, so a second declaration-shaped copy also survives.
//
// If a declared value were ever built by concatenation, or quoted in a form
// this needle does not reproduce, the subtraction would not find it and the
// check goes RED rather than quiet. It fails closed in every direction.
const BANNED = /dodge|reaction|handMax/i;
const PROSE_KEYS = new Set(['label', 'faceLabel', 'sense']);
const CONTENT_FILE = 'src/content/derivedStats.js';
const MODEL_FILE = 'src/model/derivedStats.js';

check('no Dodge/reaction behavior or handMax policy is smuggled into the contract', () => {
  const declarations = [];
  const walk = (node, path) => {
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      assert(!BANNED.test(key), `banned vocabulary in key ${path}${key}`);
      if (typeof value === 'string') {
        if (PROSE_KEYS.has(key)) { declarations.push([key, value]); continue; }
        assert(!BANNED.test(value), `banned vocabulary in value ${path}${key}: ${JSON.stringify(value)}`);
      } else walk(value, `${path}${key}.`);
    }
  };
  walk(derivedStatRules, '');
  assert(declarations.length > 0, 'no declared prose found — the walk is not reaching the presentation table');

  // The model file is code and allows nothing.
  const model = readFileSync(resolve(ROOT, MODEL_FILE), 'utf8');
  const modelHit = model.match(BANNED);
  assert(!modelHit, `${MODEL_FILE}: '${modelHit && modelHit[0]}' — this file declares no prose and allows none`);

  // The content file allows each declaration, once, with its key attached.
  let residue = readFileSync(resolve(ROOT, CONTENT_FILE), 'utf8');
  for (const [key, value] of declarations) {
    for (const quote of ["'", '"']) {
      const needle = `${key}: ${quote}${value}${quote}`;
      const at = residue.indexOf(needle);
      if (at < 0) continue;
      residue = residue.slice(0, at) + ' ' + residue.slice(at + needle.length);
      break;                                     // ONCE. A second copy survives.
    }
  }
  const hit = residue.match(BANNED);
  assert(!hit, `${CONTENT_FILE}: '${hit && hit[0]}' outside a single declared presentation value`);
});

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${checks - failures}/${checks} contract checks held, ${failures} failed.`);
console.log('BOUNDARY: one host-owned snapshot resolves at run state; downstream systems consume persisted values, not live rules.');
process.exit(failures ? 1 : 0);
