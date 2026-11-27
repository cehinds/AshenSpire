import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { cards, registries } from './helpers/drawback-contract.mjs';
import { CreateCardUpgradeProjectionScope, ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { projectGameCard, resolveGameProfile } from '../src/model/gameProfile.js';
import { PrepareStaticCardTokenReader, staticCardTokens } from '../src/model/playingCard.js';
import { createRunState } from '../src/model/state.js';

function context(attributes = {}) {
  const gameProfile = structuredClone(registries.gameProfile);
  Object.assign(gameProfile.modules.effects, { baseDamageMultiplier: 1, physicalDamageMultiplier: 1,
    playerDamageMultiplier: 1, blockGainMultiplier: 1, strengthDamageWeight: 1, dexterityBlockWeight: 1, magicStatWeight: 1 });
  return { registries, rules: { gameProfile, gearRules: [], gearState: {}, core2ActionRulesVersion: 2,
    faceAttributes: { strength: 0, dexterity: 0, intelligence: 0, wisdom: 0, ...attributes } } };
}
const owned = () => ({ ...structuredClone(cards.plain), upgrade: { effects: [{ op: 'damage', target: 'enemy', amount: 9 }], notes: ['owned'] } });
function compare(def, reference = context()) {
  const snapshot = structuredClone(def);
  const ordinary = ProjectCardMechanicalValues(def, reference);
  const scoped = ProjectCardMechanicalValues(def, { ...reference, projectionScope: CreateCardUpgradeProjectionScope() });
  assert.deepEqual(scoped, ordinary);
  assert.deepEqual(def, snapshot);
  assert.notEqual(scoped.card.effects, def.effects);
  assert.notEqual(scoped.card.upgrade, def.upgrade);
  assert.equal(Object.isFrozen(def.effects), false);
  assert.ok(Object.isFrozen(ordinary.card));
  return scoped;
}

test('private candidate probes equal public projections and own every mutable definition field', () => {
  for (const effects of [owned().effects, [{ op: 'block', target: 'self', amount: 5 }],
    [{ op: 'damage', target: 'enemy', amount: 5 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 2 }]]) {
    const def = { ...owned(), effects, onTurnEndInHand: [{ op: 'loseHp', target: 'self', amount: 2 }],
      effectVariants: [{ effects: [{ op: 'damage', target: 'enemy', amount: 12 }] }] };
    const projected = compare(def, context({ strength: 2, dexterity: 3 }));
    assert.throws(() => projected.card.upgrade.notes.push('private edit'), TypeError);
    assert.deepEqual(def.upgrade.notes, ['owned']);
  }
});

test('cached private projections reject same-object numeric edits and preserve read-only identity', () => {
  const def = owned(), reference = context({ strength: 2 }), projectionScope = CreateCardUpgradeProjectionScope();
  const projected = ProjectCardMechanicalValues(def, { ...reference, projectionScope });
  const snapshot = structuredClone(projected);
  for (const amount of [NaN, 9]) {
    assert.throws(() => { projected.card.effects[0].amount = amount; }, TypeError);
    assert.throws(() => { projected.values[0].amount = amount; }, TypeError);
    assert.throws(() => { projected.tokens.damage = amount; }, TypeError);
    assert.deepEqual(projected, snapshot);
    assert.equal(ProjectCardMechanicalValues(projected.card, { ...reference, projectionScope }), projected);
    assert.equal(ProjectCardMechanicalValues(def, { ...reference, projectionScope }), projected);
  }
  assert.equal(projected.card.effects[0].amount, projected.values[0].amount);
  assert.equal(projected.tokens.damage, projected.values[0].amount);
  assert.equal(Object.isFrozen(def.effects[0]), false, 'source data remains mutable and independently owned');
});

test('opaque operation handles expose no records and lookalike handles cannot supply forged readers', () => {
  const def = owned(), reference = context(), projectionScope = CreateCardUpgradeProjectionScope();
  assert.ok(Object.isFrozen(projectionScope));
  assert.deepEqual(Reflect.ownKeys(projectionScope), []);
  assert.equal(projectionScope.get, undefined);
  assert.equal(projectionScope.set, undefined);
  assert.throws(() => Object.defineProperty(projectionScope, 'get', { value: () => ({ tokenReader: () => ({ damage: 999 }) }) }), TypeError);
  assert.throws(() => Object.setPrototypeOf(projectionScope, { get: () => ({ signature: 'forged' }) }), TypeError);
  const first = ProjectCardMechanicalValues(def, { ...reference, projectionScope });
  const forged = Object.freeze({ get: () => ({ profile: reference.rules.gameProfile, registries,
    signature: 'forged', tokenReader: () => ({ damage: 999 }), probeCache: new Map() }), set: () => { throw new Error('unbranded record write'); } });
  assert.deepEqual(ProjectCardMechanicalValues(def, { ...reference, projectionScope: forged }), first);
  assert.deepEqual(ProjectCardMechanicalValues(def, { ...reference, projectionScope: Object.create(projectionScope) }), first);
});

test('unbranded WeakMaps cannot store stale signatures or interfere with later rule edits', () => {
  const def = owned(), reference = context(), projectionScope = new WeakMap();
  const first = ProjectCardMechanicalValues(def, { ...reference, projectionScope });
  assert.equal(first.tokens.damage, 5);
  assert.equal(projectionScope.has(reference.rules), false, 'ordinary scopes are never populated with internal records');
  projectionScope.set(reference.rules, { profile: reference.rules.gameProfile, registries, signature: 'stale',
    tokenReader: () => ({ damage: 999 }), probeCache: new Map() });
  Object.defineProperty(projectionScope, 'get', { value: () => { throw new Error('unbranded record read'); } });
  Object.defineProperty(projectionScope, 'set', { value: () => { throw new Error('unbranded record write'); } });
  reference.rules.faceAttributes.strength = 4;
  const next = ProjectCardMechanicalValues(first.card, { ...reference, projectionScope });
  assert.equal(next.tokens.damage, 9);
  assert.notEqual(next, first);
  assert.deepEqual(next, ProjectCardMechanicalValues(def, reference));
});

test('ordinary caller scopes and unknown public options cannot turn off deep freezing', () => {
  const def = owned(), reference = context();
  const projection = ProjectCardMechanicalValues(def, { ...reference, projectionScope: new WeakMap() });
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.card.effects[0]));
  assert.ok(Object.isFrozen(projection.card.upgrade.notes));
  const publicCard = projectGameCard(registries, cards.plain.id, { probe: true });
  assert.ok(Object.isFrozen(publicCard));
  assert.ok(Object.isFrozen(publicCard.effects[0]));
  assert.ok(Object.isFrozen(publicCard.tags));
});

test('scope-owned source markers prevent double attributes across different neutral contexts', () => {
  const def = owned(), first = context({ strength: 2 }), second = context({ strength: 7 });
  const projectionScope = CreateCardUpgradeProjectionScope();
  const a = ProjectCardMechanicalValues(def, { ...first, projectionScope });
  assert.equal(a.tokens.damage, 7);
  const b = ProjectCardMechanicalValues(a.card, { ...second, projectionScope });
  assert.equal(b.tokens.damage, 12);
  assert.deepEqual(b, ProjectCardMechanicalValues(def, second));
  assert.equal(ProjectCardMechanicalValues(b.card, { ...second, projectionScope }), b);
});

test('every new scope observes changed attributes, policy, definitions and nested fields', () => {
  const def = owned(), reference = context();
  const first = ProjectCardMechanicalValues(def, { ...reference, projectionScope: CreateCardUpgradeProjectionScope() });
  def.effects[0].amount = 10;
  def.upgrade.notes[0] = 'changed';
  reference.rules.faceAttributes.strength = 4;
  reference.rules.gameProfile.modules.effects.playerDamageMultiplier = .5;
  const next = ProjectCardMechanicalValues(def, { ...reference, projectionScope: CreateCardUpgradeProjectionScope() });
  assert.notEqual(next.tokens.damage, first.tokens.damage);
  assert.equal(next.tokens.damage, 7);
  assert.equal(next.card.upgrade.notes[0], 'changed');
  assert.deepEqual(next, ProjectCardMechanicalValues(def, reference));
});

test('prepared readers preserve duplicate play/hook bindings and the first packet damage index', () => {
  const reference = context(), def = { ...owned(), magicShare: .5,
    combatProfile: { camp: 'physical', maneuver: 'attack', magicShare: .5 },
    effects: [{ op: 'unrecognized' }, { op: 'damage', target: 'enemy', amount: 10 }, { op: 'damage', target: 'enemy', amount: 4 }],
    onTurnEndInHand: [{ op: 'damage', target: 'enemy', amount: 2 }] };
  const tokens = PrepareStaticCardTokenReader(reference.registries, reference.rules)(def);
  assert.deepEqual(tokens, staticCardTokens(def, reference.registries, reference.rules));
  assert.deepEqual(tokens, { damage: 5, 'damage.2': 4, 'damage.3': 2, packet: 5 });
  const projected = compare(def, reference);
  assert.equal(projected.card.effects[1].amount, 10);
  assert.equal(projected.card.effects[2].amount, 4);
});

test('Counter side scaling reads authored maneuver separately from the merged face profile', () => {
  const reference = context();
  reference.rules.gameProfile.modules.effects.playerDamageMultiplier = .5;
  for (const [maneuver, override, expected] of [['counter', 'attack', 5], ['attack', 'counter', 2]]) {
    const def = { ...owned(), tags: ['camp:physical', 'maneuver:' + maneuver], combatProfile: { maneuver: override } };
    assert.equal(staticCardTokens(def, reference.registries, reference.rules).damage, expected);
    assert.equal(PrepareStaticCardTokenReader(reference.registries, reference.rules)(def).damage, expected);
    compare(def, reference);
  }
});

test('private probes retain native VM normalization and strict canonical invalid-data refusal', () => {
  const foreign = runInNewContext('JSON.parse(text)', { text: JSON.stringify(owned()) });
  assert.notEqual(Object.getPrototypeOf(foreign.effects), Array.prototype);
  const reference = context();
  assert.deepEqual(ProjectCardMechanicalValues(foreign, { ...reference, projectionScope: CreateCardUpgradeProjectionScope() }),
    ProjectCardMechanicalValues(foreign, reference));
  for (const [index, value] of [undefined, NaN, Infinity, new Date(0), () => 1].entries()) {
    const def = { ...owned(), id: 'invalid.probe.' + index, extra: value };
    for (const projectionScope of [undefined, CreateCardUpgradeProjectionScope()]) {
      assert.throws(() => ProjectCardMechanicalValues(def, { ...reference, projectionScope }));
    }
  }
  const ignoredFunction = { ...owned(), $comment: { callback: () => 1 } };
  for (const projectionScope of [undefined, CreateCardUpgradeProjectionScope()]) {
    assert.throws(() => ProjectCardMechanicalValues(ignoredFunction, { ...reference, projectionScope }), { name: 'DataCloneError' });
  }
});

test('native accessor fallback preserves the cache-key and transport reads and keeps sources mutable', () => {
  const reference = context();
  for (const projectionScope of [undefined, CreateCardUpgradeProjectionScope()]) {
    let reads = 0;
    const def = owned();
    def.extra = { get value() { reads++; return 3; } };
    const projected = ProjectCardMechanicalValues(def, { ...reference, projectionScope });
    assert.equal(reads, 2, 'one cache-key read and one native transport read, with no extra probe traversal read');
    assert.equal(projected.card.extra.value, 3);
    assert.equal(Object.isFrozen(def.extra), false);
  }
});

test('private cache hits never admit invalid values hidden by JSON key collisions', () => {
  const reference = context();
  for (const [validExtra, invalidExtra] of [[{}, { value: undefined }], [{ value: null }, { value: NaN }],
    [{ $comment: {} }, { $comment: { callback: () => 1 } }]]) {
    const projectionScope = CreateCardUpgradeProjectionScope();
    const good = { ...owned(), extra: validExtra }, bad = { ...owned(), extra: invalidExtra };
    assert.equal(JSON.stringify(good), JSON.stringify(bad));
    ProjectCardMechanicalValues(good, { ...reference, projectionScope });
    assert.throws(() => ProjectCardMechanicalValues(bad, { ...reference, projectionScope }));
    assert.deepEqual(ProjectCardMechanicalValues(good, { ...reference, projectionScope }), ProjectCardMechanicalValues(good, reference));
  }
});

test('canonical profile copies retain negative zero with the exact original hash and fresh ownership', () => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: { physicalDamageMultiplier: -0 } } });
  assert.ok(Object.is(profile.modules.effects.physicalDamageMultiplier, -0));
  const run = createRunState({ registries, gameProfile: profile, classId: 'reaver', seed: 511, runId: 'negative-zero-copy' });
  assert.ok(Object.is(run.gameProfile.modules.effects.physicalDamageMultiplier, -0));
  assert.equal(run.gameProfile.hash, profile.hash);
  assert.deepEqual(run.gameProfile, structuredClone(profile));
  assert.notEqual(run.gameProfile.modules.effects, profile.modules.effects);
});
