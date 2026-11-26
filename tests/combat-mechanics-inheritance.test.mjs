import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { combatMechanics } from '../src/content/generated/combatMechanics.js';
import { ResolveMechanicsTable, MechanicRule, EffectiveWitherLimit, EffectiveCostGrowth } from '../src/model/combatMechanics.js';
import { WitherRemaining, Withered, projectCardBehavior } from '../src/engine/cardBehavior.js';
import { BaseFace, ScoreCard, PrepareCardScorer } from '../src/model/combatPower.js';
import { CardDefinitionToScoreFace, PrepareUpgradeStepCpContext, EvaluateUpgradeStepCp } from '../src/model/cardUpgradeCp.js';
import { planCardUpgrade, RunUpgradeStateFingerprint } from '../src/model/cardUpgradeService.js';
import { cards as upgradeCards, fresh as freshUpgradeRun, registries as upgradeRegistries, withScoring } from './helpers/drawback-contract.mjs';
import { scoringContract } from './helpers/scoring-contract.mjs';

// Explicit mechanics operands; ordinary authored defaults may change independently.
function authoredRules() {
  return {
    useLimit: { enabled: true, countScope: 'instance', onLimit: 'exhaust', nested: { values: [1] } },
    wither: { extends: 'useLimit', maxPlays: 2 },
    child: { extends: 'wither' },
    overridden: { extends: 'wither', enabled: true, maxPlays: 4 },
    costGrowth: { enabled: true, scope: 'instance', stamina: 2, mana: 1, perUse: 2, maxSteps: 2, uncapped: false },
    'costGrowth.shared': { extends: 'costGrowth', scope: 'card' },
    growthChild: { extends: 'costGrowth.shared' },
    growthOverride: { extends: 'costGrowth.shared', maxSteps: 4 },
  };
}
const context = (patch = {}) => ({ combatMechanics: ResolveMechanicsTable({ ...authoredRules(), ...patch }) });

test('compiled mechanics exactly project every current raw JSON entry, value and field provenance', () => {
  const dir = fileURLToPath(new URL('../content/source/mechanics/', import.meta.url));
  const raw = {};
  for (const name of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    for (const [id, entry] of Object.entries(JSON.parse(readFileSync(join(dir, name), 'utf8')))) {
      assert.equal(Object.hasOwn(raw, id), false, name + ': duplicate mechanic ID ' + id);
      raw[id] = entry;
    }
  }
  assert.ok(Object.keys(raw).length > 0);
  assert.deepEqual(combatMechanics.authored, raw);
  assert.deepEqual(Object.keys(combatMechanics.resolved).sort(), Object.keys(raw).sort());
  for (const [id, own] of Object.entries(raw)) {
    const chain = [id];
    while (raw[chain[0]].extends) {
      const parent = raw[chain[0]].extends;
      assert.ok(Object.hasOwn(raw, parent), id + ': known parent');
      assert.ok(!chain.includes(parent), id + ': acyclic');
      chain.unshift(parent);
    }
    const expected = {}, owners = {};
    for (const ancestor of chain) for (const [key, value] of Object.entries(raw[ancestor])) {
      if (key === 'extends') continue;
      expected[key] = value;
      owners[key] = ancestor;
    }
    assert.deepEqual(combatMechanics.resolved[id], expected, id);
    assert.deepEqual(combatMechanics.inheritedFrom[id], Object.fromEntries(Object.entries(owners).filter(([, owner]) => owner !== id)), id);
    assert.equal(combatMechanics.parents[id], own.extends || null, id);
  }
});

test('controlled parent edits reach descendants, keep overrides and never alias source or sibling data', () => {
  const raw = authoredRules(), before = structuredClone(raw);
  const original = ResolveMechanicsTable(raw);
  assert.deepEqual(raw, before);
  original.resolved.child.nested.values.push(2);
  assert.deepEqual(raw, before);
  assert.deepEqual(original.resolved.wither.nested.values, [1]);
  raw.useLimit.enabled = false;
  raw.costGrowth.maxSteps = 5;
  const edited = ResolveMechanicsTable(raw);
  assert.equal(edited.resolved.child.enabled, false);
  assert.equal(edited.resolved.overridden.enabled, true);
  assert.equal(edited.resolved.growthChild.maxSteps, 5);
  assert.equal(edited.resolved.growthOverride.maxSteps, 4);
  assert.equal(edited.inheritedFrom.child.countScope, 'useLimit');
  assert.equal(edited.inheritedFrom.child.maxPlays, 'wither');
  assert.equal(edited.inheritedFrom.overridden.maxPlays, undefined);
  edited.authored.useLimit.nested.values.push(3);
  assert.deepEqual(raw.useLimit.nested.values, [1]);
});

test('resolver refuses unknown parents, cycles, malformed rows and invalid parent identifiers', () => {
  assert.throws(() => ResolveMechanicsTable({ child: { extends: 'missingParent' } }), /unknown parent 'missingParent'/);
  assert.throws(() => ResolveMechanicsTable({ a: { extends: 'b' }, b: { extends: 'a' } }), /inheritance cycle/);
  for (const entry of [null, [], 4]) assert.throws(() => ResolveMechanicsTable({ bad: entry }), /entry must be a JSON object/);
  for (const value of ['', ' ', 2]) assert.throws(() => ResolveMechanicsTable({ bad: { extends: value } }), /non-empty mechanic id/);
});

function fight(keywords = [], enabled = true) {
  const def = { id: 'fixture.mechanic', name: 'Probe', type: 'skill', cost: 0, staminaCost: 0,
    manaCost: 0, keywords, kindIds: ['classification.skill'], wither: 2, effects: [{ op: 'block', target: 'self', amount: 1 }] };
  const enemy = { id: 'fixture.target', name: 'Target', hp: [1000, 1000], poiseMax: 0, spPool: 1,
    moves: { wait: { id: 'wait', intent: 'block', block: 0, sp: 1, weight: 1 } }, firstMove: 'wait' };
  const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, def], enemies: [enemy] });
  const player = { classId: 'reaver', hp: 80, maxHp: 80, mana: 10, maxMana: 10, energyMax: 10,
    drawPerTurn: 1, deck: [{ instanceId: 'probe', cardId: def.id }], relicIds: [] };
  const c = createCombat({ registries, rng: createRng(7), enemyIds: [enemy.id], player });
  c.combatMechanics = context({ useLimit: { ...authoredRules().useLimit, enabled } }).combatMechanics;
  return { c, def, inst: c.piles.hand[0] };
}

test('controlled Wither N exhausts exactly the Nth play; parent toggle and explicit Exhaust keep their behavior', () => {
  for (const [keywords, enabled, exhaustAt] of [[[], true, 2], [[], false, null], [['exhaust'], false, 1]]) {
    const { c, def, inst } = fight(keywords, enabled);
    for (let n = 1; n <= (exhaustAt || 3); n++) {
      assert.equal(WitherRemaining(c.player, inst, def, c), enabled ? 3 - n : null);
      dispatch(c, { type: 'playCard', cardInstanceId: inst.instanceId, targetId: c.player.id });
      assert.equal(c.piles.exhaust.some(card => card.instanceId === inst.instanceId), n === exhaustAt, 'play ' + n + ', enabled=' + enabled + ', keywords=' + keywords);
      if (n === exhaustAt) {
        assert.ok(c.eventLog.some(e => e.type === 'cardExhausted' && e.reason === (keywords.length ? 'played' : 'withered')));
      } else c.piles.hand.push(c.piles.discard.pop());
    }
    assert.equal(Withered(c.player, inst, def, c), enabled);
  }
});

test('Wither counters use the configured instance/card scope and reject invalid limits', () => {
  const def = { id: 'probe', wither: 5 }, inst = { instanceId: 'i', cardId: def.id };
  const actor = { abilityRiders: { instanceUsesCombat: { i: 1 }, cardUsesCombat: { probe: 4 } } };
  assert.equal(WitherRemaining(actor, inst, def, context()), 4);
  const shared = context({ useLimit: { ...authoredRules().useLimit, countScope: 'card' } });
  assert.equal(WitherRemaining(actor, inst, def, shared), 1);
  assert.equal(WitherRemaining(actor, { cardId: 'probe' }, def, context()), 1);
  for (const wither of [0, -1, 1.5, '2']) assert.equal(EffectiveWitherLimit({ wither }, context()), null);
});

test('controlled growth inherits steps, caps and resource increments, with independent scopes and toggles', () => {
  const def = { id: 'probe', cost: 1, staminaCost: 1, manaCost: 3, resourceCosts: { sp: 1, mp: 3 }, costGrowth: {} };
  const inst = { instanceId: 'i', cardId: def.id };
  const ctx = { ...context(), player: { abilityRiders: { instanceUsesCombat: { i: 3 }, cardUsesCombat: { probe: 10 } } } };
  const before = structuredClone({ def, ctx });
  const project = (card = def, env = ctx) => projectCardBehavior(env, inst, card, { applyGear: false });
  assert.deepEqual(EffectiveCostGrowth(def, ctx), { stamina: 2, mana: 1, perUse: 2, max: 2, uncapped: false, perCard: false, scope: 'instance' });
  assert.deepEqual(project().resourceCosts, { sp: 3, mp: 4 });
  const shared = { ...def, costGrowth: { scope: 'card' } };
  assert.deepEqual(project(shared).resourceCosts, { sp: 5, mp: 5 }, 'shared uses capped at two steps');
  assert.deepEqual(project({ ...shared, costGrowth: { scope: 'card', uncapped: true } }).resourceCosts, { sp: 11, mp: 8 });
  assert.deepEqual(project({ ...shared, costGrowth: { scope: 'card', max: 1, stamina: 3, mana: 2 } }).resourceCosts, { sp: 4, mp: 5 });
  const off = { ...ctx, ...context({ costGrowth: { ...authoredRules().costGrowth, enabled: false } }) };
  assert.equal(EffectiveCostGrowth(def, off), null);
  assert.deepEqual(project(def, off).resourceCosts, def.resourceCosts);
  assert.deepEqual({ def, ctx }, before);
});

test('prepared and ordinary scoring share exact Wither/growth arithmetic and per-call contexts without mutation', () => {
  const weights = scoringContract();
  weights.keywords = { wither: { flat: -12 }, costGrowth: { flat: -4 }, exhaust: { flat: -9 } };
  const base = { ...BaseFace(), sp: 0, blk: 12 };
  const faces = [base, { ...base, wither: 3 }, { ...base, costGrowth: {} },
    { ...base, wither: 3, costGrowth: { stamina: 1, mana: 2 } }, { ...base, wither: 3, kw: ['exhaust'] }];
  const on = context();
  const off = context({ useLimit: { enabled: false }, costGrowth: { enabled: false } });
  const viaProfile = { gameProfile: { combatMechanics: on.combatMechanics } };
  const operands = { weights, faces, on, off, viaProfile }, before = structuredClone(operands);
  const prepared = PrepareCardScorer(weights);
  for (const ctx of [on, off, viaProfile, null, on]) for (const face of faces) {
    assert.deepEqual(prepared(face, ctx), ScoreCard(face, weights, ctx));
  }
  assert.deepEqual(prepared(base), ScoreCard(base, weights));
  assert.equal(prepared(faces[1], on).parts.wither, -4);
  assert.equal(prepared(faces[2], on).parts.costGrowth, -12);
  assert.equal(prepared(faces[3], on).parts.costGrowth, -12);
  assert.equal(prepared(faces[3], off).raw, prepared(base, off).raw);
  assert.equal(prepared(faces[4], on).parts.wither, undefined, 'Exhaust prevents a second Wither discount');
  assert.equal(prepared(faces[4], on).parts.exhaust, -9);
  const noSurcharge = structuredClone(weights);
  noSurcharge.keywords.wither.surchargeEnabled = false;
  noSurcharge.keywords.costGrowth.surchargeEnabled = false;
  assert.equal(PrepareCardScorer(noSurcharge)(faces[3], on).raw, prepared(base, on).raw);
  assert.deepEqual(operands, before);
});


test('selected shared child controls enabled overrides in both directions', () => {
  const def = { costGrowth: { scope: 'card' } };
  const parentOnChildOff = context({ 'costGrowth.shared': { extends: 'costGrowth', scope: 'card', enabled: false } });
  assert.equal(EffectiveCostGrowth(def, parentOnChildOff), null);
  const parentOffChildOn = context({ costGrowth: { ...authoredRules().costGrowth, enabled: false },
    'costGrowth.shared': { extends: 'costGrowth', scope: 'card', enabled: true } });
  assert.equal(EffectiveCostGrowth(def, parentOffChildOn).stamina, 2);
  assert.equal(EffectiveCostGrowth({ costGrowth: {} }, parentOffChildOn), null);
});

test('ordinary prototype member names are valid mechanic IDs; own prototype keys are refused recursively', () => {
  const table = ResolveMechanicsTable(JSON.parse('{"constructor":{"enabled":true,"payload":{"v":2}},"toString":{"extends":"constructor","enabled":false}}'));
  assert.deepEqual(table.resolved.constructor, { enabled: true, payload: { v: 2 } });
  assert.deepEqual(table.resolved.toString, { enabled: false, payload: { v: 2 } });
  assert.equal(table.inheritedFrom.toString.payload, 'constructor');
  for (const id of ['constructor', 'toString']) {
    assert.equal(MechanicRule(id, { combatMechanics: { resolved: {} } }), null);
    assert.deepEqual(MechanicRule(id, { combatMechanics: table }), table.resolved[id]);
  }
  const fields = ResolveMechanicsTable({ root: { constructor: 2, toString: 3 }, child: { extends: 'root' } });
  assert.deepEqual(fields.inheritedFrom.child, { constructor: 'root', toString: 'root' });
  for (const raw of ['{"__proto__":{}}', '{"base":{"payload":{"__proto__":{"marker":7}}}}']) {
    assert.throws(() => ResolveMechanicsTable(JSON.parse(raw)), /mechanics.*unsupported own __proto__/);
  }
});

test('CP projection retains detached drawback metadata and Steady changes the same ordinary/prepared score', () => {
  const weights = scoringContract();
  weights.keywords = { wither: { flat: -12 }, costGrowth: { flat: -4 } };
  weights.upgradeTags = {};
  const def = { id: 'fixture.cp.mechanics', type: 'skill', class: 'reaver', rarity: 'common',
    cost: 1, staminaCost: 1, manaCost: 0, wither: 2, costGrowth: {}, effects: [{ op: 'block', amount: 12, target: 'self' }] };
  const before = structuredClone(def), on = context(), off = context({ useLimit: { enabled: false }, costGrowth: { enabled: false } });
  const face = CardDefinitionToScoreFace(def, { scoring: weights });
  assert.equal(face.wither, 2);
  assert.deepEqual(face.costGrowth, {});
  face.costGrowth.stamina = 99;
  assert.deepEqual(def, before);
  const score = PrepareCardScorer(weights);
  for (const mechanicsContext of [on, off, on]) {
    const args = { baseDef: def, currentDef: def, scoring: weights, mechanicsContext };
    const ordinary = PrepareUpgradeStepCpContext(args);
    const prepared = PrepareUpgradeStepCpContext({ ...args, scoreCard: score });
    assert.equal(ordinary.rawBefore, score(CardDefinitionToScoreFace(def, { scoring: weights }), mechanicsContext).raw);
    assert.equal(prepared.rawBefore, ordinary.rawBefore);
    const request = { ...args, step: { k: 'fx', fx: 'steady' } };
    const uncompiled = EvaluateUpgradeStepCp({ ...request, context: ordinary });
    const compiled = EvaluateUpgradeStepCp({ ...request, context: prepared });
    assert.deepEqual(compiled, uncompiled);
    assert.equal(compiled.raw - prepared.rawBefore, mechanicsContext === on ? 12 : 0);
    assert.deepEqual(EvaluateUpgradeStepCp(request), uncompiled, 'direct CP evaluation forwards context too');
  }
  assert.deepEqual(def, before);
});

test('upgrade quote cache invalidates on mechanics table edits and replacements without exposing preparation', () => withScoring(() => {
  const run = freshUpgradeRun();
  const instance = { instanceId: 'mechanic-cache', cardId: upgradeCards.rising.id };
  run.deck = [instance];
  run.combatMechanics = context().combatMechanics;
  const request = () => planCardUpgrade(run, upgradeRegistries, instance.instanceId, { choices: 3 });
  const original = request(), signature = RunUpgradeStateFingerprint(run);
  assert.equal(request(), original, 'unchanged operands reuse the quote');
  run.combatMechanics.resolved.costGrowth.enabled = false;
  assert.notEqual(RunUpgradeStateFingerprint(run), signature);
  const edited = request();
  assert.notEqual(edited, original);
  assert.equal(request(), edited);
  run.combatMechanics = context().combatMechanics;
  const replaced = request();
  assert.notEqual(replaced, edited);
  const hasInternal = value => value && typeof value === 'object' && Object.entries(value).some(([key, item]) =>
    ['mechanicsContext', 'preparation', 'scoreCard', 'projectionScope'].includes(key) || typeof item === 'function' || hasInternal(item));
  assert.equal(Boolean(hasInternal(replaced)), false);
}));
