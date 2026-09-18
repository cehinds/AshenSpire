// tests/tree-equivalence.test.mjs — the tree phase's feel-neutrality proof
// (docs/plan-progression-and-property-system.md, the tree phase).
//
// THE CLAIM: folding three tag systems into one tree changed no answer any
// reader gets. Three fixtures under tests/fixtures/*-pre-tree.json were
// recorded on `dev` at 0.7.1.104, BEFORE the fold, from the three systems as
// they were: the flat tag registry (tags/tagDomains/tagFamilyDomains), the
// property rules resolved with their numbers, and the framework's property
// rows and relations. Everything the tree now DERIVES is compared against
// them, row for row.
//
// WHY THREE FIXTURES AND NOT A DIFF: the derived modules gained rows on
// purpose (nine framework roots became tag domains, 61 framework nodes became
// registered tags, 435 kind rows, fourteen family pairings) so a byte diff is
// red by design. What must not have moved is every row that existed — and
// this says exactly which rows those are.
//
// WHEN A NUMBER IS DELIBERATELY RETUNED, the property-rules fixture is
// re-recorded in the pull request that retunes it. Regenerating it to make a
// red go away is the one use it does not have.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { contentBundle } from '../src/content/index.js';
import { PROPERTY_RULES } from '../src/content/propertyRules.js';
import { properties as frameworkProperties } from '../src/framework/data/properties.js';
import { relations as frameworkRelations } from '../src/framework/data/relations.js';
import { TAGS, TAG_DOMAINS, TAG_FAMILY_DOMAINS } from '../src/content/tags.js';
import { createRegistries, objectKinds } from '../src/model/registries.js';
import { resolveVariable, nodeTree, nodeTokens, cardKind, CARD_TYPE_KIND } from '../src/model/tree.js';
import { relicTokens } from '../src/model/validate.js';
import { relicPropertyRules } from '../src/model/registries.js';
import { cardPropertyInstances } from '../src/framework/importer.js';
import { NODE_RELATIONS } from '../src/model/schemas.js';
import { RELATION_KINDS } from '../src/framework/schema.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(resolve(HERE, 'fixtures', name), 'utf8'));
const REG = createRegistries(contentBundle);

test('every property rule resolves to exactly the numbers it had before its rule became a node', () => {
  const pre = fixture('property-rules-pre-tree.json');
  const now = new Map(PROPERTY_RULES.map((r) => [r.tag, r]));
  assert.equal(pre.length, 50, 'the fixture holds the 50 rules that existed');
  for (const old of pre) {
    const rule = now.get(old.tag);
    assert.ok(rule, `rule '${old.tag}' is still derived`);
    for (const field of ['requires', 'excludes', 'textTemplate', 'passives', 'triggers']) {
      assert.deepEqual(rule[field], old[field], `rule '${old.tag}'.${field} reads as it did — its numbers now come through variableBindings.csv and balance.js`);
    }
  }
});

test('every framework property row and relation is derived unchanged, defaultParameters included', () => {
  const pre = fixture('framework-properties-pre-tree.json');
  const now = new Map(frameworkProperties.properties.map((p) => [p.id, p]));
  for (const old of pre.properties) {
    assert.deepEqual(now.get(old.id), old, `framework property '${old.id}' is derived as it was`);
  }
  const key = (r) => `${r.sourcePropertyId} ${r.relation} ${r.targetPropertyId} @${r.precedence}`;
  const nowRel = new Set(frameworkRelations.relations.map(key));
  for (const old of pre.relations) assert.ok(nowRel.has(key(old)), `relation ${key(old)} is derived`);
  assert.equal(frameworkRelations.relations.length, pre.relations.length, 'and no relation was invented');
});

test('every registered tag, domain and family pairing is derived unchanged; the additions are the named ones', () => {
  const pre = fixture('tag-registry-pre-tree.json');
  const tags = new Map(TAGS.map((t) => [t.id, t]));
  for (const old of pre.tags) {
    const t = tags.get(old.id);
    assert.ok(t, `tag '${old.id}' is still registered`);
    for (const field of ['domain', 'label', 'color', 'glyph', 'blurb']) assert.equal(t[field], old[field], `tag '${old.id}'.${field}`);
  }
  const domains = new Map(TAG_DOMAINS.map((d) => [d.id, d]));
  for (const old of pre.tagDomains) {
    const d = domains.get(old.id);
    assert.ok(d, `domain '${old.id}' is still a root`);
    assert.equal(d.label, old.label, `domain '${old.id}'.label`);
    assert.equal(d.blurb, old.blurb, `domain '${old.id}'.blurb`);
  }
  const pairs = new Set(TAG_FAMILY_DOMAINS.map((r) => `${r.family}|${r.domain}`));
  for (const old of pre.tagFamilyDomains) assert.ok(pairs.has(`${old.family}|${old.domain}`), `pairing ${old.family}×${old.domain} is derived`);
  // The additions, by name, so a stray one cannot hide among them.
  const addedDomains = TAG_DOMAINS.map((d) => d.id).filter((id) => !pre.tagDomains.some((d) => d.id === id)).sort();
  assert.deepEqual(addedDomains, ['classification', 'cost', 'damage', 'equipment', 'internal', 'lifecycle', 'scaling', 'targeting', 'utility'],
    'the roots that joined are the framework\'s nine (presentation merged with the flat root of the same name)');
  const addedTags = TAGS.filter((t) => !pre.tags.some((o) => o.id === t.id));
  assert.ok(addedTags.every((t) => t.visibility), 'every tag that joined is a framework node — one carrying a visibility, never a chip');
  assert.equal(addedTags.length, TAGS.length - pre.tags.length);
});

test('every object states exactly one kind, the one its collection and type name', () => {
  let counted = 0;
  for (const spec of contentBundle.tagFamilies) {
    if (!spec.source || typeof spec.source !== 'string') continue;
    let node = REG;
    for (const part of spec.source.split('.')) node = node && node[part];
    const list = node && typeof node.all === 'function' ? node.all() : node;
    for (const def of list || []) {
      const kinds = objectKinds(REG, def);
      const want = spec.family === 'card' ? CARD_TYPE_KIND[def.type] : `classification.${spec.family}`;
      assert.deepEqual(kinds, [want], `${spec.family} '${def.id}' states its kind`);
      assert.ok(!def.tags.includes(want), `and the kind never joins '${def.id}'.tags`);
      counted += 1;
    }
  }
  assert.equal(counted, 435, 'the 435 shipped objects, every one');
});

test('a node carries no numbers: every variable resolves through a binding to a balance row, and the ladder reads highest scope first', () => {
  for (const v of contentBundle.nodeVariables) {
    const value = resolveVariable(REG, v.nodeId, v.variable);
    assert.ok(Number.isFinite(value), `${v.nodeId}.${v.variable} resolves in the default scope`);
  }
  assert.equal(resolveVariable(REG, 'siphon', 'restoreMana'), REG.balance.exposure.siphonRefund, 'the value is the balance row, not a copy');
  // The ladder, on a registries copy with one instance row on top.
  const scoped = createRegistries({
    ...contentBundle,
    balance: { ...contentBundle.balance, probe: { instance: 9 } },
    variableBindings: [...contentBundle.variableBindings, { scope: 'instance', scopeId: 'copy1', nodeId: 'siphon', variable: 'restoreMana', balancePath: 'probe.instance' }],
  });
  assert.equal(resolveVariable(scoped, 'siphon', 'restoreMana', { instanceId: 'copy1' }), 9, 'an instance binding wins for that copy');
  assert.equal(resolveVariable(scoped, 'siphon', 'restoreMana', { instanceId: 'copy2' }), REG.balance.exposure.siphonRefund, 'and another copy still reads the default');
  assert.equal(resolveVariable(scoped, 'siphon', 'restoreMana'), REG.balance.exposure.siphonRefund, 'no scope given reads the default');
});

test('the tree is one tree: paths derive from parents, roots are domains, and the relation verbs are the framework\'s', () => {
  const tree = nodeTree(REG);
  assert.equal(tree.pathOf('lifecycle.recall.afterUse'), 'lifecycle.recall.afterUse', 'the framework\'s dotted path is derived from parentIds, not read off the id');
  assert.equal(tree.rootOf('fx:blade'), 'presentation');
  assert.equal(tree.rootOf('siphon'), 'property');
  assert.equal(tree.rootOf('classification.attack'), 'classification');
  assert.deepEqual(tree.childrenOf('lifecycle.recall').sort(), ['lifecycle.recall.afterCardPlay', 'lifecycle.recall.afterTurnDraw', 'lifecycle.recall.afterUse']);
  assert.ok(tree.isUnder('classification.strike', 'classification'));
  assert.deepEqual([...NODE_RELATIONS].sort(), [...RELATION_KINDS].sort(), 'model/schemas.js NODE_RELATIONS and framework/schema.js RELATION_KINDS are one list');
  const roots = contentBundle.nodes.filter((n) => !n.parentId).map((n) => n.id).sort();
  assert.deepEqual(roots, TAG_DOMAINS.map((d) => d.id).sort(), 'every root is a domain and every domain is a root');
});

test('the engine reads a card\'s kind, and the kind is the type for every shipped card', () => {
  // The switch: combat.js, coopCombat.js, triggers.js, combatAnimation.js,
  // consequence.js and the combat screen ask cardKind(def) — the kind tag —
  // instead of def.type. Feel-neutral because validate.js refuses a card whose
  // kind and type disagree; this is that refusal asserted the other way round.
  for (const def of REG.cards.all()) {
    assert.equal(cardKind(def), def.type, `card '${def.id}' kind tag reads as its type`);
    assert.equal(cardPropertyInstances(def)[0].propertyId, CARD_TYPE_KIND[def.type], `the framework classifies '${def.id}' by its kind row`);
  }
  assert.equal(cardKind({ id: 'noRow', type: 'attack' }), null, 'a def with no kind row is no kind — never quietly its type');
});

test('a relic sentence binds its powers\' numbers by variable name, and reads the same', () => {
  // The switch: relicTokens(def, rules, registries) takes the rules' numbers
  // from nodeTokens — {poiseDamage} reads the variable poiseDamage through its
  // binding — not by counting op positions. Every token a relic sentence uses
  // that belongs to a rule is a declared variable of that node, and the number
  // it renders is the bound balance row.
  let bound = 0;
  for (const def of REG.relics.all()) {
    const rules = relicPropertyRules(REG, def);
    if (!rules.length) continue;
    const byName = Object.assign({}, ...rules.map((r) => nodeTokens(REG, r.tag)));
    const tokens = relicTokens(def, rules, REG);
    for (const [token, value] of Object.entries(byName)) {
      assert.equal(tokens[token], value, `relic '${def.id}' token {${token}} is the variable's bound value`);
      bound += 1;
    }
  }
  assert.ok(bound >= 48, `${bound} rule tokens bound by name across the relics`);
  assert.equal(nodeTokens(REG, 'siphon')['restoreMana.2'], REG.balance.exposure.siphonRefundMastered, 'a repeated token spells its variable restoreMana_2 as {restoreMana.2}');
});
