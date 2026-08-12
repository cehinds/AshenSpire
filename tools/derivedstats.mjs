// tools/derivedstats.mjs — executable contract for the inert derived-stat table.
//
// This deliberately does not enter tests/run-node.mjs until Phase 1 lands.
// It imports no run/combat/session code and supplies the Phase 1 attribute
// vocabulary as an explicit dependency, so this branch cannot wire mechanics
// by accident.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { derivedStatRules } from '../src/content/derivedStats.js';
import {
  derivedStatRuleProblems,
  resolveDerivedStatRules,
  deriveStat,
  createDerivedStatRuleSnapshot,
  restoreDerivedStatRuleSnapshot,
} from '../src/model/derivedStats.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATTRIBUTE_IDS = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
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

check('a finite cap clamps the final value and null means uncapped', () => {
  const capped = resolved({ explicitOverride: { rules: { energy: { cap: 2 } } } });
  equal(deriveStat(capped, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 2, 'cap');
  equal(deriveStat(resolved(), 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 3, 'uncapped');
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

check('the dependency seam is mechanically inert before Phase 1 lands', () => {
  const consumers = [
    'src/model/state.js', 'src/model/resources.js', 'src/engine/actions.js',
    'src/engine/combat.js', 'src/engine/coopCombat.js', 'tools/session.mjs',
  ];
  const wired = consumers.filter((rel) => /derivedStats|derivedStatRules/.test(readFileSync(resolve(ROOT, rel), 'utf8')));
  assert(!wired.length, `premature gameplay/session reader(s): ${wired.join(', ')}`);
  const model = readFileSync(resolve(ROOT, 'src/model/derivedStats.js'), 'utf8');
  assert(!/content\/attributes|model\/attributes/.test(model), 'reader imports Phase 1 instead of accepting its allocation seam');
});

check('no Dodge/reaction behavior or handMax policy is smuggled into the contract', () => {
  const text = readFileSync(resolve(ROOT, 'src/content/derivedStats.js'), 'utf8')
    + readFileSync(resolve(ROOT, 'src/model/derivedStats.js'), 'utf8');
  assert(!/\bdodge\b|\breaction\b|\bhandMax\b/i.test(text), 'post-contract behavior vocabulary present');
});

console.log(`\n${failures ? 'FAIL' : 'PASS'} — ${checks - failures}/${checks} contract checks held, ${failures} failed.`);
console.log('BOUNDARY: data + pure readers only. Nothing here changes a run, combat, draw pile, resource bar, save, LAN message or screen.');
process.exit(failures ? 1 : 0);

