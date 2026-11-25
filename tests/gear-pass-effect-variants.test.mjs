import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ApplyGearCardRules } from '../src/model/gearEffects.js';
import { evaluate } from '../src/model/formulas.js';
import { selectCardVariant } from '../src/engine/cardBehavior.js';
import { validateFormula } from '../src/model/validate/effectGrammar.js';
import { productionBundle } from './helpers/production-bundle.mjs';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const modules = ['src/content/index.js', 'src/model/registries.js', 'src/model/state.js', 'src/model/gameProfile.js',
  'src/model/loadout.js', 'src/engine/runCombat.js', 'src/engine/rng.js', 'src/engine/combat.js',
  'src/engine/combatExpansion.js', 'src/ui/components/card.js', 'src/model/cardFaceText.js'];
async function runtime(mode) {
  const require = mode === 'bundled' ? productionBundle({ additionalModules: modules }) : null;
  return Object.assign({}, ...await Promise.all(modules.map(id => require ? require(id) : import(new URL('../' + id, import.meta.url)))));
}
function fixture(api, cardId, { sword = false, multiHit = 0, savedProfile = null } = {}) {
  // Null-prototype JSON is accepted in both native and production VM realms without changing the authored configuration.
  const author = JSON.parse(JSON.stringify({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {
    effects: { baseDamageMultiplier: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1 },
  } }), (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.assign(Object.create(null), value) : value);
  const profile = api.resolveGameProfile(savedProfile || author);
  const registries = api.bindGameProfileRegistries(api.createRegistries(api.applyGameProfileToContent(api.contentBundle, profile)), profile);
  const run = api.createRunState({ registries, classId: 'reaver', seed: 31, runId: 'gear-effect-variants',
    profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  if (sword) api.equipPiece(registries, run.loadout, 'rightHand', 0, 'straightSword', { has: () => true }, { inCombat: false, classId: run.class, attributes: run.attributes });
  run.relics = [];
  const combat = api.createRunCombat({ registries, run, rng: api.createRng(31), enemyIds: ['wanderingSoldier'] });
  api.dispatch(combat, { type: 'setReactions', enabled: false });
  combat.player.energy = 20;
  combat.player.combatStance = { maneuver: 'smash', camp: 'physical', range: 'melee' };
  combat.player.abilityRiders.hpLostSinceTurnStart = 8;
  if (multiHit) combat.player.statuses.multiHit = { stacks: multiHit };
  combat.piles.hand = [{ cardId, instanceId: 'variant', upgraded: false }];
  const target = combat.enemies[0];
  Object.assign(target, { hp: 900, maxHp: 900, block: 0, statuses: {}, actorIntentRevealed: true, persistentPoise: { value: 0, max: 0 } });
  primeAccuracyRolls(combat, { count: 3 });
  return { combat, target, registries };
}
function quoteAndPlay(api, world) {
  const { combat, target, registries } = world;
  const quote = api.previewCard(combat, 'variant', target.id);
  const face = api.cardFaceLines(quote.resolvedDefinition, quote, registries, combat).map(row => row.faceHtml || row.html).join('; ').replace(/<[^>]*>/g, '');
  const before = target.hp, start = combat.eventLog.length;
  api.dispatch(combat, { type: 'playCard', cardInstanceId: 'variant', targetId: target.id });
  return { quote, face, damage: before - combat.enemies[0].hp,
    hits: combat.eventLog.slice(start).filter(event => event.type === 'damageDealt' && event.targetId === target.id) };
}
for (const mode of ['native', 'bundled']) {
  test(`Multi-hit 2 survives Stance Echo's selected Smash branch: ${mode}`, async () => {
    const api = await runtime(mode), world = fixture(api, 'base.current-stance-variant', { multiHit: 2 });
    const result = quoteAndPlay(api, world), value = result.quote.values.find(row => row.op === 'damage');
    assert.equal(value.hits, 3);
    assert.equal(result.hits.length, 3);
    assert.equal(result.quote.resolvedDefinition.activeEffectVariant, 0);
    const control = quoteAndPlay(api, fixture(api, 'base.current-stance-variant'));
    assert.equal(control.hits.length, 1, 'the unmodified Smash branch hits once');
    assert.ok(control.damage > 0);
    assert.deepEqual([...value.perTargetHitDamages[world.target.id]], Array(3).fill(control.damage));
    assert.equal(result.damage, 3 * control.damage, 'the stacks repeat exactly the same selected effect');
    assert.match(result.face, new RegExp(`${control.damage}.*×3`));
  });
  test(`Straight Sword adds its flat bonus to Reprisal Growth's unevaluated formula: ${mode}`, async () => {
    const api = await runtime(mode), equipped = fixture(api, 'base.scale-damage-taken', { sword: true });
    const control = fixture(api, 'base.scale-damage-taken', { sword: true });
    control.combat.player.itemProps.cardRules = control.combat.player.itemProps.cardRules.filter(rule => rule.stat !== 'damage');
    const withSword = quoteAndPlay(api, equipped), withoutBonus = quoteAndPlay(api, control);
    assert.equal(withoutBonus.damage, 16);
    assert.equal(withSword.damage, 18, 'one flat base damage is scaled by the existing stance rules');
    assert.equal(withSword.hits[0].damageReceipt.hits[0].sources.find(row => row.id === 'base').amount, 11);
    assert.equal(withoutBonus.hits[0].damageReceipt.hits[0].sources.find(row => row.id === 'base').amount, 10);
    assert.equal(withSword.damage, withSword.quote.values.find(row => row.op === 'damage').perTarget[equipped.target.id]);
    const projected = withSword.quote.resolvedDefinition.effects[0].amount;
    assert.equal(projected.f, 'add');
    assert.equal(projected.args[1], 1);
    assert.match(withSword.face, new RegExp(String(withSword.quote.tokens.damage)));
  });
}

const rule = (stat, amount, extra = {}) => ({ selector: 'any', arg: null, conds: [], stat, amount, mode: 'add', source: `test:${stat}`, ...extra });
test('effect selectors and annotations belong to each original branch; shared modifiers apply once without mutation', () => {
  const def = { tags: ['classification.attack', 'camp:physical'], cost: 3, staminaCost: 3, manaCost: 2, resourceCosts: { sp: 3, mp: 2 },
    effects: [{ op: 'damage', target: 'enemy', amount: 6 }], textTemplate: 'Base {damage}', marker: { value: 1 },
    effectVariants: [{ if: { p: 'all', preds: [] }, effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'heal', target: 'self', amount: 2 }], textTemplate: 'Variant {block}', marker: 'kept' }] };
  const before = structuredClone(def);
  const variantOnly = ApplyGearCardRules([rule('block', 3, { selector: 'blockCard' })], def);
  assert.equal(variantOnly.effects[0].amount, 6, 'no base effect matches the only rule');
  assert.equal(variantOnly.effectVariants[0].effects[0].amount, 8, 'a matching variant alone still receives its rule');
  assert.deepEqual(variantOnly.gearApplied, []);
  assert.deepEqual(variantOnly.effectVariants[0].gearApplied.map(note => note.stat), ['block']);
  const rules = [rule('damage', 2), rule('block', 3, { selector: 'blockCard' }), rule('heal', 1), rule('poiseDamage', 4),
    rule('cost', -1), rule('manaCost', -1), rule('retain', 1), rule('reach', 1), rule('pierce', 1)];
  const projected = ApplyGearCardRules(rules, def);
  assert.deepEqual(def, before);
  assert.deepEqual(projected.effects, [{ op: 'damage', target: 'enemy', amount: 8 }, { op: 'poiseDamage', target: 'enemy', amount: 4 }]);
  assert.deepEqual(projected.effectVariants[0].effects, [{ op: 'block', target: 'self', amount: 8 }, { op: 'heal', target: 'self', amount: 3 }]);
  const selected = selectCardVariant({ player: {} }, projected, {});
  assert.equal(selected.marker.value, 1);
  assert.equal(selected.textTemplate, 'Variant {block}');
  assert.deepEqual(selected.effectVariants[0].if, before.effectVariants[0].if);
  assert.equal(selected.effectVariants[0].marker, 'kept');
  assert.deepEqual(selected.gearApplied.map(note => note.stat), ['block', 'heal', 'cost', 'manaCost', 'retain', 'reach', 'pierce']);
  assert.deepEqual(projected.gearApplied.map(note => note.stat), ['damage', 'poiseDamage', 'cost', 'manaCost', 'retain', 'reach', 'pierce']);
  assert.equal(selected.cost, 2);
  assert.equal(selected.resourceCosts.sp, 2);
  assert.deepEqual(selected.gearManaRules, [{ mode: 'add', amount: -1 }]);
  assert.deepEqual(selected.keywords, ['retain']);
  assert.equal(selected.range, 'reach');
  assert.equal(selected.gear.pierce, 1);
  assert.equal(ApplyGearCardRules([], def), def);
});

test('an actual pre-type-effects saved profile gains no current Sword formula or variant bonuses', async () => {
  const api = await runtime('native');
  const saved = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))));
  const world = fixture(api, 'base.scale-damage-taken', { sword: true, savedProfile: saved });
  assert.equal(world.combat.gameProfile.modules.gear.typeEffectsVersion, undefined);
  assert.equal(world.combat.player.itemProps?.cardRules, undefined);
  const projected = api.resolveCombatCard(world.combat, world.combat.piles.hand[0]);
  const original = saved.content.cards.find(card => card.id === 'base.scale-damage-taken');
  assert.deepEqual(projected.effects, original.effects);
});

test('formula bonuses preserve the symbolic inner expression, clamps and set semantics for every amount opcode', () => {
  const formula = { f: 'missingHp', of: 'self', max: 5 };
  const def = { effects: ['damage', 'poiseDamage', 'block', 'heal'].map(op => ({ op, target: op === 'damage' ? 'enemy' : 'self', amount: formula })) };
  const before = structuredClone(def), rules = ['damage', 'poiseDamage', 'block', 'heal'].map(stat => rule(stat, 2));
  const projected = ApplyGearCardRules(rules, def);
  assert.deepEqual(def, before);
  assert.equal(projected.effects.length, 4, 'formula Poise damage is adjusted instead of injecting a duplicate');
  for (const effect of projected.effects) {
    assert.deepEqual(effect.amount, { f: 'add', args: [formula, 2], min: 0 });
    const errors = [];
    validateFormula(effect.amount, 'amount', { err: (path, message) => errors.push({ path, message }), ids: { statuses: new Set() } });
    assert.deepEqual(errors, []);
    assert.equal(evaluate(effect.amount, { entities: { self: { hp: 10, maxHp: 20 } } }), 7);
    assert.equal(evaluate(effect.amount, { entities: { self: { hp: 20, maxHp: 20 } } }), 2);
  }
  const clamped = ApplyGearCardRules([rule('damage', -9)], def).effects[0].amount;
  assert.equal(evaluate(clamped, { entities: { self: { hp: 10, maxHp: 20 } } }), 0);
  assert.equal(ApplyGearCardRules([rule('damage', -1, { mode: 'set' })], def).effects[0].amount, 0);
});
