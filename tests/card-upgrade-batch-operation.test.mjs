import test from 'node:test';
import assert from 'node:assert/strict';
import { cards, fresh, registries as baseRegistries, withScoring } from './helpers/drawback-contract.mjs';
import { PlanCardUpgradeBatch, planCardUpgrade, commitCardUpgrade, ClearCardUpgradePlanCache } from '../src/model/cardUpgradeService.js';
import { canUpgrade, nextUpgradeOptions, nextUpgradeStep, upgradeChoiceCount } from '../src/model/cardUpgradeLimits.js';
import { upgradeStepsOf } from '../src/model/cardUpgrade.js';
import { resolveCard } from '../src/model/registries.js';
import { projectGameCard } from '../src/model/gameProfile.js';
import { ResolveMechanicsTable } from '../src/model/combatMechanics.js';
import { GetActiveScoring, SetCustomScoring } from '../src/model/activeScoring.js';
import { cardUpgradeModel } from '../src/ui/models/CardUpgradeModel.js';

function fixture() {
  const run = fresh();
  run.seed = 4187;
  run.level.level = 5;
  run.smithingStones = 20;
  run.mapNodeId = 'fixture.batch';
  run.deck = [cards.plain, cards.hold, cards.rising].map((card, index) => ({
    instanceId: 'batch.' + index, cardId: card.id, rank: 3, upgraded: false, upgradeSteps: [],
  }));
  run.sideboard = [];
  return run;
}

const requestsFor = run => run.deck.map((instance, index) => ({
  instanceId: instance.instanceId, choices: index === 2 ? 1 : 3,
  combos: index === 1, vendor: index === 1 ? 'arcane' : 'blacksmith',
}));

// Reconstruct quotes from unprepared primitive reads, independently of the
// service's cache/batch path. No shared preparation or borrowed fingerprint.
function uncachedQuote(run, registries, { instanceId, choices = 1, combos = false, vendor = '' }) {
  const instance = [...run.deck, ...run.sideboard].find(card => card?.instanceId === instanceId);
  const verdict = canUpgrade(registries, run, instance, { preparation: null });
  const quote = { ok: verdict.ok, code: verdict.code, reason: verdict.reason, instanceId,
    n: verdict.n, cost: verdict.cost, free: verdict.free, step: null, before: null, after: null };
  if (!verdict.ok && verdict.code !== 'stones') return quote;
  const base = registries.cards.get(instance.cardId), applied = upgradeStepsOf(instance);
  const face = ref => projectGameCard(run, ref) || resolveCard(registries, ref);
  const after = step => face({ ...instance, upgraded: true, upgradeSteps: [...applied, step] });
  const before = face(instance);
  if (choices <= 1) {
    const step = vendor
      ? nextUpgradeOptions(run, instance, base, registries, 1, { vendor, preparation: null })[0] || null
      : nextUpgradeStep(run, instance, base, registries, { preparation: null });
    return { ...quote, ...(vendor ? { vendor } : {}), step, before, after: after(step) };
  }
  const options = nextUpgradeOptions(run, instance, base, registries, choices, { combos, vendor, preparation: null })
    .map(step => ({ step, after: after(step) }));
  return { ...quote, choices, combos, ...(vendor ? { vendor } : {}),
    step: options[0].step, options, before, after: options[0].after };
}

function assertNoScratch(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(value instanceof WeakMap, false, 'private scope must not escape in a quote');
  for (const key of Reflect.ownKeys(value)) {
    assert.equal(['projectionScope', 'preparation', 'scorer', 'operation'].includes(key), false, String(key));
    assertNoScratch(value[key], seen);
  }
}

test('batch preserves complete independent quotes, repeated-request RNG and owned JSON', () => withScoring(() => {
  for (const seed of [17, 91]) {
    const run = fixture(); run.seed = seed;
    const requests = requestsFor(run);
    requests.push({ ...requests[0] }); // Same request still owns a fresh roll/rejection state.
    const snapshot = JSON.stringify(run), definitions = JSON.stringify(cards);
    const expected = requests.map(request => uncachedQuote(run, baseRegistries, request));
    ClearCardUpgradePlanCache(run);
    const actual = PlanCardUpgradeBatch(run, baseRegistries, requests);
    assert.deepEqual(actual, expected);
    assert.deepEqual(actual[3], actual[0]);
    ClearCardUpgradePlanCache(run);
    assert.deepEqual(requests.map(({ instanceId, ...options }) => planCardUpgrade(run, baseRegistries, instanceId, options)), expected);
    assertNoScratch(actual);
    assert.equal(JSON.stringify(run), snapshot, 'no run or stored RNG changes');
    assert.equal(JSON.stringify(cards), definitions, 'authored definitions remain owned');
  }
}));

test('each new batch and the public single-plan path observe nested state and input changes', () => withScoring(() => {
  const run = fixture();
  run.combatMechanics = ResolveMechanicsTable({
    costGrowth: { enabled: true, scope: 'instance', stamina: 1, mana: 0, perUse: 1, maxSteps: 3 },
    'costGrowth.shared': { extends: 'costGrowth', scope: 'card' },
  });
  const requests = requestsFor(run);
  let registries = baseRegistries;
  const verify = () => {
    const snapshot = JSON.stringify(run);
    const expected = requests.map(request => uncachedQuote(run, registries, request));
    assert.deepEqual(PlanCardUpgradeBatch(run, registries, requests), expected);
    const { instanceId, ...options } = requests[0];
    assert.deepEqual(planCardUpgrade(run, registries, instanceId, options), expected[0]);
    assert.equal(JSON.stringify(run), snapshot);
  };
  verify();
  run.combatMechanics.resolved.costGrowth.enabled = false; verify();
  run.combatMechanics.resolved.costGrowth.enabled = true; verify();
  run.deck[0].rank = 4; verify();
  run.deck[0].upgradeSteps = [{ k: 'fx', fx: 'draw', n: 1 }]; verify();
  run.deck[0].playsEver = 7; verify();
  run.itemUpgradeLevels = { ...(run.itemUpgradeLevels || {}), 'armament/greatsword': 1 }; verify();
  run.attributes.strength += 2; verify();
  const scoring = structuredClone(GetActiveScoring()); scoring.effects.damage.weight = 2;
  assert.equal(SetCustomScoring(scoring).ok, true); verify();
  const changed = { ...cards.plain, effects: [{ op: 'damage', target: 'enemy', amount: 11 }] };
  registries = { ...baseRegistries, cards: { ...baseRegistries.cards,
    get: id => id === changed.id ? changed : baseRegistries.cards.get(id),
    has: id => id === changed.id || baseRegistries.cards.has(id) } };
  verify();
  run.gameProfile = structuredClone(run.gameProfile);
  run.gameProfile.combatMechanics = ResolveMechanicsTable({ costGrowth: { enabled: false } });
  verify(); // Explicit run mechanics win over the profile.
  delete run.combatMechanics; verify(); // Removing the override exposes current profile rules.
}));

test('commit independently replans after a batch and refuses a stale quote without mutation', () => withScoring(() => {
  const run = fixture(), request = requestsFor(run)[0];
  const [quote] = PlanCardUpgradeBatch(run, baseRegistries, [request]);
  assert.equal(quote.ok, true);
  run.deck[0].upgradeSteps = [{ k: 'fx', fx: 'draw', n: 1 }];
  run.deck[0].upgraded = true;
  const snapshot = JSON.stringify(run);
  assert.throws(() => commitCardUpgrade(run, baseRegistries, quote));
  assert.equal(JSON.stringify(run), snapshot);
  const [freshQuote] = PlanCardUpgradeBatch(run, baseRegistries, [request]);
  assert.equal(freshQuote.n, quote.n + 1);
  assert.equal(commitCardUpgrade(run, baseRegistries, freshQuote).n, freshQuote.n);
}));

test('no-quote picker batching preserves grouping, hidden eligibility, order and complete rows', () => withScoring(() => {
  const run = fixture();
  const maxed = { ...cards.plain, id: 'fixture.batch.maxed', type: 'power', cost: 0, staminaCost: 0, manaCost: 0, effects: [] };
  const registries = { ...baseRegistries, cards: { ...baseRegistries.cards,
    get: id => id === maxed.id ? maxed : baseRegistries.cards.get(id),
    has: id => id === maxed.id || baseRegistries.cards.has(id) } };
  run.deck.push({ ...run.deck[0], instanceId: 'batch.copy', upgradeSteps: [] }, null,
    { instanceId: 'batch.unknown', cardId: 'fixture.not.present' },
    { instanceId: 'batch.maxed', cardId: maxed.id, rank: 3, upgradeSteps: [] });
  run.sideboard = [{ ...run.deck[0], instanceId: 'batch.library', upgradeSteps: [] }];
  const snapshot = JSON.stringify(run);
  ClearCardUpgradePlanCache(run);
  const batched = cardUpgradeModel(registries, run, 'batch.0', { blacksmith: true });
  ClearCardUpgradePlanCache(run);
  const sequential = cardUpgradeModel(registries, run, 'batch.0', { blacksmith: true, quote: () => null });
  assert.deepEqual(batched, sequential);
  assert.equal(batched.rows.some(row => row.instanceIds.includes('batch.maxed')), false);
  assert.equal(batched.rows.some(row => row.instanceIds.includes('batch.unknown')), false);
  assert.equal(batched.rows.find(row => row.instanceIds.includes('batch.0')).copies, 2);
  assert.equal(batched.rows.find(row => row.instanceIds.includes('batch.library')).inDeck, false);
  assert.equal(JSON.stringify(run), snapshot);
}));

test('pricing callbacks remain sequential and freshly plan later mutated rows', () => withScoring(() => {
  const run = fixture(); run.deck = run.deck.slice(0, 2);
  const callbackIds = [], expected = new Map();
  const model = cardUpgradeModel(baseRegistries, run, run.deck[1].instanceId, {
    blacksmith: true,
    quote: id => {
      callbackIds.push(id);
      const instance = run.deck.find(card => card.instanceId === id);
      const request = { instanceId: id,
        choices: upgradeChoiceCount(baseRegistries.cards.get(instance.cardId), instance, { blacksmith: true, run }),
        combos: false, vendor: 'blacksmith' };
      expected.set(id, uncachedQuote(run, baseRegistries, request));
      if (id === run.deck[0].instanceId) {
        run.deck[1].upgradeSteps = [{ k: 'fx', fx: 'draw', n: 1 }];
        run.deck[1].upgraded = true;
        run.attributes.strength += 2;
      }
      return { ok: true, cost: 1, cinders: 100, reason: '' };
    },
  });
  assert.deepEqual(callbackIds, run.deck.map(card => card.instanceId));
  for (const row of model.rows) assert.deepEqual(row.plan, expected.get(row.instanceId));
  assert.equal(model.selected.plan.n, 2, 'later row sees the earlier callback edit');
}));

test('batch exposes no reusable fingerprint or scratch input', () => withScoring(() => {
  const run = fixture(), request = requestsFor(run)[0];
  const [first] = PlanCardUpgradeBatch(run, baseRegistries, [{ ...request, fingerprint: 'borrowed', projectionScope: {} }]);
  run.deck[0].rank = 4;
  const [next] = PlanCardUpgradeBatch(run, baseRegistries, [{ ...request, fingerprint: 'borrowed', projectionScope: {} }]);
  assert.notEqual(next, first);
  assert.deepEqual(next, uncachedQuote(run, baseRegistries, request));
  assertNoScratch(next);
  assert.deepEqual(PlanCardUpgradeBatch(run, baseRegistries, []), []);
  assert.throws(() => PlanCardUpgradeBatch(run, baseRegistries, {}), TypeError);
}));
