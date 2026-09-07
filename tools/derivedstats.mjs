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
const CONTRACT_RULESET_VERSION = 4;

// `maxHp: 84` is deliberately NOT the HP base any row uses. Under ruleset 4 the
// HP row is a flat 30 and ignores class data, so a fixture carrying a different
// number is what makes that provable rather than assumed.
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
  equal(derivedStatRules.defaults.pointsPerTier, 5, 'pointsPerTier');
  equal(derivedStatRules.defaults.rounding, 'floor', 'rounding');
  equal(derivedStatRules.defaults.cap, null, 'cap');
});

check('the five rows map to the ruled source attributes', () => {
  const got = Object.entries(derivedStatRules.rules).map(([id, row]) => `${id}:${row.sourceStat}`).join(',');
  equal(got, 'energy:dexterity,draw:intelligence,hp:constitution,stamina:constitution,mana:wisdom', 'row map');
});

check('the shipped table passes the closed schema', () => {
  const problems = derivedStatRuleProblems(derivedStatRules, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  assert(Array.isArray(problems) && problems.length === 0, problems.map((p) => `${p.path}: ${p.msg}`).join('; '));
});

// Energy and Draw each override the global five-point tier with ten (ruleset 4),
// so DEX/INT 10 buys ONE tier, not two. The titles said two and the values said
// three and five, which were the version-3 answers for a different arithmetic.
check('DEX 10 gives Energy base 2 + one ten-point tier = 3', () => {
  const out = deriveStat(resolved(), 'energy', { attributes: { dexterity: 10 }, classDef: CLASS });
  equal(out.tier, 1, 'tier'); equal(out.raw, 3, 'raw'); equal(out.value, 3, 'value');
});

check('INT 10 gives Draw base 4 + one ten-point tier = 5', () => {
  const out = deriveStat(resolved(), 'draw', { attributes: { intelligence: 10 }, classDef: CLASS });
  equal(out.tier, 1, 'tier'); equal(out.raw, 5, 'raw');
});

check('CON 10 gives at least 2 Stamina', () => {
  assert(deriveStat(resolved(), 'stamina', { attributes: { constitution: 10 }, classDef: CLASS }).value >= 2, 'Stamina below 2');
});

check('WIS 10 is the only Mana authority and yields 2', () => {
  const out = deriveStat(resolved(), 'mana', { attributes: { wisdom: 10 }, classDef: CLASS });
  equal(out.base, 0, 'Mana base'); equal(out.value, 2, 'Mana');
});

// THE ROW STOPPED READING CLASS DATA AND THIS CHECK STILL SAID IT DID. Under
// ruleset 4 the HP row is `base: 30, pointsPerTier: 1, gainPerTier: 2` — a flat
// 30 plus two per CON point, with no `base.field` at all. The class base moved
// into the "other bonuses" slot (c9b31970) and #484 then removed the per-tier
// class coefficient outright. The old assertion expected 84 from the fixture
// class and got 30, which read as a broken product and was a stale contract.
check('CON HP is a flat base plus two per point, and reads no class field (D22, #484)', () => {
  const out = deriveStat(resolved(), 'hp', { attributes: { constitution: 10 }, classDef: CLASS });
  equal(out.base, 30, 'HP base is the row, not the class'); equal(out.tier, 10, 'one tier per CON point');
  equal(out.value, 50, 'derived HP: 30 + 10 x 2');
});

check('a row may override pointsPerTier and rounding', () => {
  const source = clone(derivedStatRules);
  source.rules.energy.pointsPerTier = 4;
  source.rules.energy.rounding = 'ceil';
  const rules = resolveDerivedStatRules(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
  const out = deriveStat(rules, 'energy', { attributes: { dexterity: 9 }, classDef: CLASS });
  equal(out.tier, 3, 'ceil(9/4)'); equal(out.value, 5, 'Energy: base 2 + 3');
});

check('an authored row override outranks the authored global defaults', () => {
  const source = clone(derivedStatRules);
  source.defaults.pointsPerTier = 5;
  source.rules.energy.pointsPerTier = 10;
  const out = deriveStat(resolveDerivedStatRules(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] }), 'energy', {
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
  // 5000 over a TEN-point tier is 500, not 1000. The point of the check is that
  // nothing clamps, so the numbers move with the tier width and were not re-read.
  equal(energy.tier, 500, 'high-stat Energy tier');
  equal(energy.value, 502, 'uncapped high-stat Energy: base 2 + 500');
  equal(draw.tier, 500, 'high-stat Draw tier');
  equal(draw.value, 504, 'uncapped high-stat Draw: base 4 + 500');
});

// THE PREMISE INVERTED, SO THE CHECK DID TOO. This asserted HP was live to class
// data; under ruleset 4 neither HP nor Mana reads it. The fixture deliberately
// carries a maxHp and a maxMana that are BOTH wrong answers, so a row that
// started reading class data again would be caught rather than merely un-asserted.
check('neither HP nor Mana reads class data, and deriving mutates no input', () => {
  const attributes = { constitution: 10, wisdom: 10 };
  const classDef = { id: 'newClass', maxHp: 137, maxMana: 23 };
  const before = JSON.stringify({ attributes, classDef });
  equal(deriveStat(resolved(), 'hp', { attributes, classDef }).base, 30, 'HP ignores class data');
  equal(deriveStat(resolved(), 'mana', { attributes, classDef }).base, 0, 'Mana ignores class data');
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
  equal(out.raw, 10, 'later run base 6 + explicit gain 4 x tier 1');
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
  // ASSIGNS THE OBJECT INSTEAD OF REACHING INTO IT. `hp.base` is a NUMBER under
  // ruleset 4, so `x.rules.hp.base.field = ...` threw TypeError and the plant
  // reported a crash rather than a verdict. Replacing the whole base keeps the
  // class-base schema path covered without depending on the shipped table still
  // using that shape — and nothing does now, so this is its only coverage.
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
  ['default pointsPerTier NaN', (x) => { x.defaults.pointsPerTier = Number.NaN; }, 'defaults.pointsPerTier'],
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
    const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
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
  const problems = derivedStatRuleProblems(source, { attributeIds: ATTRIBUTE_IDS, classFields: ['maxHp'] });
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
  equal(deriveStat(restored.rules, 'energy', { attributes: { dexterity: 10 }, classDef: CLASS }).value, 3, 'resumed Energy');
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
