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
} from '../src/model/derivedStats.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATTRIBUTE_IDS = phase1Attributes.slice().sort((a, b) => a.order - b.order).map((row) => row.id);
const CLASS = { id: 'reaver', maxHp: 84, maxMana: 40 };
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
  return resolveDerivedStatRules(derivedStatRules, { attributeIds: ATTRIBUTE_IDS, ...options });
}

console.log('derivedstats — inert post-Phase-1 rules contract\n');

check('one authoritative object carries the global defaults', () => {
  equal(derivedStatRules.defaults.pointsPerTier, 5, 'pointsPerTier');
  equal(derivedStatRules.defaults.rounding, 'floor', 'rounding');
  equal(derivedStatRules.defaults.cap, null, 'cap');
});

check('the five rows map to the ruled source attributes', () => {
  const got = Object.entries(derivedStatRules.rules).map(([id, row]) => `${id}:${row.sourceStat}`).join(',');
  equal(got, 'energy:dexterity,draw:intelligence,hp:constitution,stamina:constitution,mana:wisdom', 'row map');
});

check('the shipped table passes the closed schema', () => {
  const problems = derivedStatRuleProblems(derivedStatRules, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp', 'maxMana'] });
  assert(Array.isArray(problems) && problems.length === 0, problems.map((p) => `${p.path}: ${p.msg}`).join('; '));
});

check('DEX 10 gives Energy raw 1 + tier 2 = 3', () => {
  const out = deriveStat(resolved(), 'energy', { attributes: { dexterity: 10 }, classDef: CLASS });
  equal(out.tier, 2, 'tier'); equal(out.raw, 3, 'raw'); equal(out.value, 3, 'value');
});

check('INT 10 gives Draw raw 3 + tier 2 = 5', () => {
  const out = deriveStat(resolved(), 'draw', { attributes: { intelligence: 10 }, classDef: CLASS });
  equal(out.tier, 2, 'tier'); equal(out.raw, 5, 'raw');
});

check('CON 10 gives at least 2 Stamina', () => {
  assert(deriveStat(resolved(), 'stamina', { attributes: { constitution: 10 }, classDef: CLASS }).value >= 2, 'Stamina below 2');
});

check('WIS 10 preserves the class Mana base and adds at least 2', () => {
  const out = deriveStat(resolved(), 'mana', { attributes: { wisdom: 10 }, classDef: CLASS });
  equal(out.base, 40, 'class Mana base'); assert(out.value >= 42, 'Mana did not add two tiers');
});

check('CON HP starts from class data rather than a duplicated constant', () => {
  const out = deriveStat(resolved(), 'hp', { attributes: { constitution: 10 }, classDef: CLASS });
  equal(out.base, 84, 'class HP base'); equal(out.value, 86, 'derived HP');
});

check('a row may override pointsPerTier and rounding', () => {
  const source = clone(derivedStatRules);
  source.rules.energy.pointsPerTier = 4;
  source.rules.energy.rounding = 'ceil';
  const rules = resolveDerivedStatRules(source, { attributeIds: ATTRIBUTE_IDS });
  const out = deriveStat(rules, 'energy', { attributes: { dexterity: 9 }, classDef: CLASS });
  equal(out.tier, 3, 'ceil(9/4)'); equal(out.value, 4, 'Energy');
});

check('an authored row override outranks the authored global defaults', () => {
  const source = clone(derivedStatRules);
  source.defaults.pointsPerTier = 5;
  source.rules.energy.pointsPerTier = 10;
  const out = deriveStat(resolveDerivedStatRules(source, { attributeIds: ATTRIBUTE_IDS }), 'energy', {
    attributes: { dexterity: 10 }, classDef: CLASS,
  });
  equal(out.tier, 1, 'row pointsPerTier');
});

check('weapon-facing tier receipt consumes a resolved row and owns no weapon base', () => {
  const row = resolved({
    modeModifiers: { defaults: { pointsPerTier: 4 } },
    explicitOverride: { rules: { energy: { gainPerTier: 3, rounding: 'ceil' } } },
  }).rules.energy;
  const receipt = deriveAttributeTierReceipt(row, { attributes: { dexterity: 9 } });
  equal(receipt.sourceStat, 'dexterity', 'source stat');
  equal(receipt.points, 9, 'points');
  equal(receipt.pointsPerTier, 4, 'resolved global pointsPerTier');
  equal(receipt.rounding, 'ceil', 'resolved row rounding');
  equal(receipt.tier, 3, 'tier');
  equal(receipt.gainPerTier, 3, 'resolved row gain');
  equal(receipt.value, 9, 'tier contribution only');
  assert(!Object.hasOwn(receipt, 'base'), 'generic receipt must not own a weapon base');
});

check('a finite cap clamps the final value and null means uncapped', () => {
  const capped = resolved({ explicitOverride: { rules: { energy: { cap: 2 } } } });
  equal(deriveStat(capped, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 2, 'cap');
  equal(deriveStat(resolved(), 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 3, 'uncapped');
});

check('shipped Energy and Draw both declare cap null and grow unbounded at high stats', () => {
  equal(derivedStatRules.rules.energy.cap, null, 'Energy cap');
  equal(derivedStatRules.rules.draw.cap, null, 'Draw cap');
  const rules = resolved();
  const energy = deriveStat(rules, 'energy', { attributes: { dexterity: 5000 }, classDef: CLASS });
  const draw = deriveStat(rules, 'draw', { attributes: { intelligence: 5000 }, classDef: CLASS });
  equal(energy.tier, 1000, 'high-stat Energy tier');
  equal(energy.value, 1001, 'uncapped high-stat Energy');
  equal(draw.tier, 1000, 'high-stat Draw tier');
  equal(draw.value, 1003, 'uncapped high-stat Draw');
});

check('class-field bases are live data references and calculations mutate no input', () => {
  const attributes = { constitution: 10, wisdom: 10 };
  const classDef = { id: 'newClass', maxHp: 137, maxMana: 23 };
  const before = JSON.stringify({ attributes, classDef });
  equal(deriveStat(resolved(), 'hp', { attributes, classDef }).base, 137, 'HP reads changed class data');
  equal(deriveStat(resolved(), 'mana', { attributes, classDef }).base, 23, 'Mana reads changed class data');
  equal(JSON.stringify({ attributes, classDef }), before, 'inputs unchanged');
});

check('precedence is authored defaults/rows < mode < run < explicit override', () => {
  const rules = resolved({
    modeModifiers: { rules: { energy: { base: 2, pointsPerTier: 4 } } },
    runModifiers: [{ rules: { energy: { base: 4, pointsPerTier: 2, gainPerTier: 3 } } }],
    explicitOverride: { rules: { energy: { base: 7, pointsPerTier: 10 } } },
  });
  const out = deriveStat(rules, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS });
  equal(out.tier, 1, 'explicit pointsPerTier'); equal(out.raw, 10, 'explicit base plus retained run gain');
});

check('run modifiers apply in listed order before the explicit/debug override', () => {
  const rules = resolved({
    runModifiers: [
      { rules: { draw: { base: 4, gainPerTier: 2 } } },
      { rules: { draw: { base: 6 } } },
    ],
    explicitOverride: { rules: { draw: { gainPerTier: 4 } } },
  });
  const out = deriveStat(rules, 'draw', { attributes: { intelligence: 10 }, classDef: CLASS });
  equal(out.raw, 14, 'later run base 6 + explicit gain 4 × tier 2');
});

check('a mode-level defaults override reaches every row until a row patch replaces it', () => {
  const rules = resolved({ modeModifiers: {
    defaults: { pointsPerTier: 10 },
    rules: { energy: { pointsPerTier: 2 } },
  } });
  equal(deriveStat(rules, 'draw', { attributes: { intelligence: 10 }, classDef: CLASS }).tier, 1, 'mode default reached Draw');
  equal(deriveStat(rules, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).tier, 5, 'row patch replaced mode default');
});

const badCases = [
  ['zero global pointsPerTier', (x) => { x.defaults.pointsPerTier = 0; }, 'defaults.pointsPerTier'],
  ['unknown rounding word', (x) => { x.rules.draw.rounding = 'bankers'; }, 'rules.draw.rounding'],
  ['non-numeric cap', (x) => { x.rules.energy.cap = 'three'; }, 'rules.energy.cap'],
  ['missing required base', (x) => { delete x.rules.stamina.base; }, 'rules.stamina.base'],
  ['unknown source attribute', (x) => { x.rules.mana.sourceStat = 'luck'; }, 'rules.mana.sourceStat'],
  ['unknown class base field', (x) => { x.rules.hp.base.field = 'hitPoints'; }, 'rules.hp.base.field'],
  ['unknown rule field', (x) => { x.rules.energy.diminishing = true; }, 'rules.energy.diminishing'],
  ['missing required row', (x) => { delete x.rules.draw; }, 'rules.draw'],
  ['extra derived row', (x) => { x.rules.dodge = clone(x.rules.energy); }, 'rules.dodge'],
];
for (const [name, mutate, path] of badCases) check(`schema refuses ${name} by path`, () => {
  const source = clone(derivedStatRules); mutate(source);
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp', 'maxMana'] });
  assert(problems.some((p) => p.path === path), `no problem at ${path}: ${JSON.stringify(problems)}`);
});

const rootNumericMutants = [
  ['rulesetVersion zero', (x) => { x.rulesetVersion = 0; }, 'rulesetVersion'],
  ['rulesetVersion fractional', (x) => { x.rulesetVersion = 1.5; }, 'rulesetVersion'],
  ['rulesetVersion NaN', (x) => { x.rulesetVersion = Number.NaN; }, 'rulesetVersion'],
  ['unsupported positive rulesetVersion', (x) => { x.rulesetVersion = 2; }, 'rulesetVersion'],
  ['default pointsPerTier NaN', (x) => { x.defaults.pointsPerTier = Number.NaN; }, 'defaults.pointsPerTier'],
  ['default cap negative', (x) => { x.defaults.cap = -1; }, 'defaults.cap'],
  ['default cap infinite', (x) => { x.defaults.cap = Infinity; }, 'defaults.cap'],
];
for (const [name, mutate, path] of rootNumericMutants) check(`numeric corpus refuses ${name}`, () => {
  const source = clone(derivedStatRules); mutate(source);
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp', 'maxMana'] });
  assert(problems.some((p) => p.path === path), `no problem at ${path}`);
});

for (const id of Object.keys(derivedStatRules.rules)) {
  const row = derivedStatRules.rules[id];
  const mutations = [
    ['gainPerTier NaN', (x) => { x.rules[id].gainPerTier = Number.NaN; }, `rules.${id}.gainPerTier`],
    ['pointsPerTier zero', (x) => { x.rules[id].pointsPerTier = 0; }, `rules.${id}.pointsPerTier`],
    ['rounding unknown', (x) => { x.rules[id].rounding = 'truncate'; }, `rules.${id}.rounding`],
    ['cap negative', (x) => { x.rules[id].cap = -1; }, `rules.${id}.cap`],
  ];
  if (typeof row.base === 'number') mutations.push(['base NaN', (x) => { x.rules[id].base = Number.NaN; }, `rules.${id}.base`]);
  else mutations.push(['class base loses field', (x) => { delete x.rules[id].base.field; }, `rules.${id}.base.field`]);
  for (const [name, mutate, path] of mutations) check(`${id} row corpus refuses ${name}`, () => {
    const source = clone(derivedStatRules); mutate(source);
    const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp', 'maxMana'] });
    assert(problems.some((p) => p.path === path), `no problem at ${path}`);
  });
}

const completenessMutants = [
  ['missing global pointsPerTier', (x) => { delete x.defaults.pointsPerTier; }, 'defaults.pointsPerTier'],
  ['missing global rounding', (x) => { delete x.defaults.rounding; }, 'defaults.rounding'],
  ['missing global cap', (x) => { delete x.defaults.cap; }, 'defaults.cap'],
  ['unknown global field', (x) => { x.defaults.threshold = 4; }, 'defaults.threshold'],
  ['unknown root field', (x) => { x.secondRules = {}; }, 'derivedStatRules.secondRules'],
  ['missing row sourceStat', (x) => { delete x.rules.energy.sourceStat; }, 'rules.energy.sourceStat'],
  ['missing row gainPerTier', (x) => { delete x.rules.energy.gainPerTier; }, 'rules.energy.gainPerTier'],
];
for (const [name, mutate, path] of completenessMutants) check(`completeness corpus refuses ${name}`, () => {
  const source = clone(derivedStatRules); mutate(source);
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp', 'maxMana'] });
  assert(problems.some((p) => p.path === path), `no problem at ${path}`);
});

const overrideMutants = [
  ['default pointsPerTier zero', { defaults: { pointsPerTier: 0 } }, 'explicitOverride.defaults.pointsPerTier'],
  ['default rounding unknown', { defaults: { rounding: 'truncate' } }, 'explicitOverride.defaults.rounding'],
  ['default cap negative', { defaults: { cap: -1 } }, 'explicitOverride.defaults.cap'],
  ['rule base NaN', { rules: { energy: { base: Number.NaN } } }, 'explicitOverride.rules.energy.base'],
  ['rule source unknown', { rules: { energy: { sourceStat: 'luck' } } }, 'explicitOverride.rules.energy.sourceStat'],
  ['rule pointsPerTier zero', { rules: { energy: { pointsPerTier: 0 } } }, 'explicitOverride.rules.energy.pointsPerTier'],
  ['rule gainPerTier NaN', { rules: { energy: { gainPerTier: Number.NaN } } }, 'explicitOverride.rules.energy.gainPerTier'],
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
  try { resolved({ modeModifiers: { defaults: { pointsPerTier: 0 } } }); } catch (error) { modeMessage = error.message; }
  assert(modeMessage.includes('modeModifiers.defaults.pointsPerTier'), `mode path absent: ${modeMessage}`);
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
    authority: 'host', attributeIds: ATTRIBUTE_IDS,
    explicitOverride: { rules: { energy: { base: 9 } } },
  });
  equal(snap.rulesetVersion, 1, 'rulesetVersion');
  equal(snap.rules.rules.energy.base, 9, 'snapshotted explicit override');
});

check('resume derives from the saved snapshot, never changed live rules', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'host', attributeIds: ATTRIBUTE_IDS });
  const changed = clone(derivedStatRules); changed.rules.energy.base = 99;
  const restored = restoreDerivedStatRuleSnapshot(JSON.parse(JSON.stringify(snap)), { attributeIds: ATTRIBUTE_IDS });
  equal(deriveStat(restored.rules, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 3, 'resumed Energy');
  equal(changed.rules.energy.base, 99, 'control mutation');
});

check('resume refuses an unknown snapshot/ruleset version by name', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'host', attributeIds: ATTRIBUTE_IDS });
  snap.rulesetVersion = 999;
  let message = '';
  try { restoreDerivedStatRuleSnapshot(snap, { attributeIds: ATTRIBUTE_IDS }); } catch (error) { message = error.message; }
  assert(/rulesetVersion 999/.test(message), `version refusal not named: ${message}`);
});

check('resume refuses an unknown snapshot envelope version by name', () => {
  const snap = createDerivedStatRuleSnapshot(derivedStatRules, { authority: 'host', attributeIds: ATTRIBUTE_IDS });
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

check('no Dodge/reaction behavior or handMax policy is smuggled into the contract', () => {
  const text = readFileSync(resolve(ROOT, 'src/content/derivedStats.js'), 'utf8')
    + readFileSync(resolve(ROOT, 'src/model/derivedStats.js'), 'utf8');
  assert(!/\bdodge\b|\breaction\b|\bhandMax\b/i.test(text), 'post-contract behavior vocabulary present');
});

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${checks - failures}/${checks} contract checks held, ${failures} failed.`);
console.log('BOUNDARY: one host-owned snapshot resolves at run state; downstream systems consume persisted values, not live rules.');
process.exit(failures ? 1 : 0);
