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
// RULESET 7 (plan A3, 2026-09-24): ruleset 6 with Actions at 0.25 per DEX and
// HP at 36 + 2 per CON + 2.5 per level. RULESET 8 (plan A4, owner ruling
// 2026-09-24): ruleset 7 with the Draw base at 5, so a new character (INT 1-4)
// draws five. Every Energy, HP and Draw number below was re-derived by hand
// from those rows; Mana, Stamina and Poise did not move.
const CONTRACT_RULESET_VERSION = 8;

// `maxHp: 84` is deliberately NOT the HP base any row uses. The HP row is a flat
// 36 and ignores class data, so a fixture carrying a different number is what
// makes that provable rather than assumed.
const CLASS = { id: 'reaver', maxHp: 84 };
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
  equal(derivedStatRules.defaults.cap, null, 'cap');
  // Ruleset 6 has no tier, so the table-wide tier and its rounding are gone.
  assert(!('pointsPerTier' in derivedStatRules.defaults), 'no global tier');
  assert(!('rounding' in derivedStatRules.defaults), 'no global rounding');
});

check('the six rows answer to the ruled attributes', () => {
  const got = Object.entries(derivedStatRules.rules)
    .map(([id, row]) => `${id}:${ruleWeights(row).map(([attr, weight]) => `${attr}x${weight}`).join('+')}`).join(',');
  equal(got, 'energy:dexterityx0.25,draw:intelligencex0.2,hp:constitutionx2,stamina:constitutionx1,mana:wisdomx1,poise:constitutionx1', 'row map');
});

check('the shipped table passes the closed schema', () => {
  const problems = derivedStatRuleProblems(derivedStatRules, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  assert(Array.isArray(problems) && problems.length === 0, problems.map((p) => `${p.path}: ${p.msg}`).join('; '));
});

// A WEIGHT OF 0.25 IS ONE EVERY FOUR POINTS, FLOORED ON ITS OWN: DEX 10 buys
// floor(10 x 0.25) = floor(2.5) = 2 Actions on the base 3.
check('DEX 10 gives Energy base 3 + floor(10 x 0.25) = 5', () => {
  const out = deriveStat(resolved(), 'energy', { attributes: { dexterity: 10 }, classDef: CLASS });
  equal(out.terms.dexterity, 2, 'dexterity term'); equal(out.raw, 5, 'raw'); equal(out.value, 5, 'value');
});

check('INT 10 gives Draw base 5 + floor(10 x 0.2) = 7', () => {
  const out = deriveStat(resolved(), 'draw', { attributes: { intelligence: 10 }, classDef: CLASS });
  equal(out.terms.intelligence, 2, 'intelligence term'); equal(out.raw, 7, 'raw');
});

check('a fifth of a point is nothing until five arrive: INT 4 stays at the base, INT 9 buys one', () => {
  equal(deriveStat(resolved(), 'draw', { attributes: { intelligence: 4 }, classDef: CLASS }).value, 5, 'INT 4');
  equal(deriveStat(resolved(), 'draw', { attributes: { intelligence: 9 }, classDef: CLASS }).value, 6, 'INT 9');
});

check('CON 10 gives Stamina base 1 + 10 = 11', () => {
  equal(deriveStat(resolved(), 'stamina', { attributes: { constitution: 10 }, classDef: CLASS }).value, 11, 'Stamina');
});

check('WIS 10 is the only Mana authority and yields base 1 + 10 = 11', () => {
  const out = deriveStat(resolved(), 'mana', { attributes: { wisdom: 10 }, classDef: CLASS });
  equal(out.base, 1, 'Mana base'); equal(out.value, 11, 'Mana');
});

check('CON HP is a flat base plus two per point, and reads no class field', () => {
  const out = deriveStat(resolved(), 'hp', { attributes: { constitution: 10 }, classDef: CLASS });
  equal(out.base, 36, 'HP base is the row, not the class'); equal(out.terms.constitution, 20, 'two per CON point');
  equal(out.value, 56, 'derived HP: 36 + 10 x 2');
});

check('the level term is one decimal, floored: HP 2.5, Mana/Stamina 0.2, Draw 0.1', () => {
  const at = (id, level, attributes) => deriveStat(resolved(), id, { attributes, classDef: CLASS, level }).levelBonus;
  equal(at('hp', 1, { constitution: 1 }), 0, 'no term at level 1');
  equal(at('hp', 2, { constitution: 1 }), 2, 'HP: floor(1 x 2.5) at level 2');
  equal(at('hp', 4, { constitution: 1 }), 7, 'HP: floor(3 x 2.5) three levels past the first');
  equal(at('mana', 5, { wisdom: 1 }), 0, 'Mana: four fifths is not yet a point');
  equal(at('mana', 6, { wisdom: 1 }), 1, 'Mana: five fifths is one');
  equal(at('draw', 10, { intelligence: 1 }), 0, 'Draw waits for level 11');
  equal(at('draw', 11, { intelligence: 1 }), 1, 'Draw: one card at 11');
  equal(at('energy', 50, { dexterity: 1 }), 0, 'Energy has no level term');
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
  equal(deriveStat(rules, 'energy', { attributes: { dexterity: 1 }, classDef: CLASS, level: 3 }).levelBonus, 1, 'Energy inherits 0.5');
  equal(deriveStat(rules, 'hp', { attributes: { constitution: 1 }, classDef: CLASS, level: 3 }).levelBonus, 5, 'HP keeps its own 2.5: floor(2 x 2.5)');
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

check('a finite cap clamps the final value and null means uncapped', () => {
  const capped = resolved({ explicitOverride: { rules: { energy: { cap: 2 } } } });
  equal(deriveStat(capped, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 2, 'cap');
  equal(deriveStat(resolved(), 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 5, 'uncapped');
});

check('shipped Energy and Draw resolve cap null and grow unbounded at high stats', () => {
  const rules = resolved();
  equal(rules.rules.energy.cap, null, 'Energy cap');
  equal(rules.rules.draw.cap, null, 'Draw cap');
  const energy = deriveStat(rules, 'energy', { attributes: { dexterity: 5000 }, classDef: CLASS });
  const draw = deriveStat(rules, 'draw', { attributes: { intelligence: 5000 }, classDef: CLASS });
  equal(energy.value, 1253, 'uncapped high-stat Energy: base 3 + floor(5000 x 0.25)');
  equal(draw.value, 1005, 'uncapped high-stat Draw: base 5 + floor(5000 x 0.2)');
});

// The fixture carries a maxHp and a maxMana that are BOTH wrong answers, so a
// row that started reading class data again would be caught.
check('neither HP nor Mana reads class data, and deriving mutates no input', () => {
  const attributes = { constitution: 10, wisdom: 10 };
  const classDef = { id: 'newClass', maxHp: 137, maxMana: 23 };
  const before = JSON.stringify({ attributes, classDef });
  equal(deriveStat(resolved(), 'hp', { attributes, classDef }).base, 36, 'HP ignores class data');
  equal(deriveStat(resolved(), 'mana', { attributes, classDef }).base, 1, 'Mana ignores class data');
  equal(JSON.stringify({ attributes, classDef }), before, 'inputs unchanged');
});

check('precedence is authored defaults/rows < mode < run < explicit override', () => {
  const rules = resolved({
    modeModifiers: { rules: { energy: { base: 2, dexterity: 0.5 } } },
    runModifiers: [{ rules: { energy: { base: 4, dexterity: 1 } } }],
    explicitOverride: { rules: { energy: { base: 7 } } },
  });
  const out = deriveStat(rules, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS });
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
  const out = deriveStat(rules, 'draw', { attributes: { intelligence: 10 }, classDef: CLASS });
  equal(out.raw, 11, 'later run base 6 + explicit floor(10 x 0.5)');
});

check('a mode-level defaults override reaches every row until a row patch replaces it', () => {
  const rules = resolved({ modeModifiers: {
    defaults: { perLevel: 0.5 },
    rules: { energy: { perLevel: 2 } },
  } });
  equal(deriveStat(rules, 'draw', { attributes: { intelligence: 1 }, classDef: CLASS, level: 3 }).levelBonus, 1, 'mode default reached Draw');
  equal(deriveStat(rules, 'energy', { attributes: { dexterity: 1 }, classDef: CLASS, level: 3 }).levelBonus, 4, 'row patch replaced mode default');
});

const badCases = [
  ['negative global perLevel', (x) => { x.defaults.perLevel = -1; }, 'defaults.perLevel'],
  ['a rounding word on a ruleset-6 row', (x) => { x.rules.draw.rounding = 'floor'; }, 'rules.draw.rounding'],
  ['non-numeric cap', (x) => { x.rules.energy.cap = 'three'; }, 'rules.energy.cap'],
  ['missing required base', (x) => { delete x.rules.stamina.base; }, 'rules.stamina.base'],
  ['unknown source attribute', (x) => { x.rules.mana.luck = 1; }, 'rules.mana.luck'],
  ['negative attribute weight', (x) => { x.rules.hp.constitution = -1; }, 'rules.hp.constitution'],
  ['a retired tier on a ruleset-6 row', (x) => { x.rules.energy.pointsPerTier = 5; }, 'rules.energy.pointsPerTier'],
  ['a gain on a ruleset-6 row', (x) => { x.rules.hp.gain = 4; }, 'rules.hp.gain'],
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
    ['cap negative', (x) => { x.rules[id].cap = -1; }, `rules.${id}.cap`],
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
  ['missing global cap', (x) => { delete x.defaults.cap; }, 'defaults.cap'],
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
  equal(deriveStat(restored.rules, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 5, 'resumed Energy');
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
