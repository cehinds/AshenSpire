import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { applyAttackDamage, executeAction, applyLoseHp } from '../src/engine/actions.js';
import { applyStatus, removeStatus } from '../src/engine/statuses.js';
import { applyStatusPressure } from '../src/engine/combatStatusControl.js';
import { fixCoreRules } from '../src/model/fixCoreMechanics.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { recipientEffectsForEvent, recipientWindupFor, recipientDeliveryFor, recipientStatusPolarity } from '../src/model/recipientEffects.js';
import { decorateRecipientEffects, createRecipientEffectState } from '../src/ui/recipientEffectEvents.js';
import { RECIPIENT_EFFECT_SETTINGS as SETTINGS } from '../src/content/recipientEffectSettings.js';

const physical = { tags: ['camp:physical', 'maneuver:attack', 'damage:slashing'] };
const fire = { tags: ['camp:spell', 'maneuver:casting', 'school:fire'], effects: [{ op: 'gainWard', target: 'self' }] };
const marker = { type: 'cardPlayed', playerId: 'player', cardId: 'test' };
const hit = { type: 'damageDealt', sourceId: 'player', targetId: 'e1', amount: 6, hpRemoved: 6 };
const flatten = events => events.flatMap(event => event.recipientEffects || []);
function fixture(expansion = false) {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(77), ...(expansion ? { combatExpansionVersion: 2 } : {}),
    enemyIds: ['wanderingSoldier'], player: { classId: 'reaver', hp: 50, maxHp: 100,
      mana: 10, maxMana: 50, stamina: 10, maxStamina: 50, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 100, maxHp: 100, block: 0, statuses: {}, persistentWard: { value: 0, max: 0 },
    persistentPoise: { value: 0, max: 0 }, damageResistanceFlat: {}, damageWeaknessPercent: {} });
  if (expansion) {
    combat.fixCoreRules = structuredClone(fixCoreRules(combat));
    combat.fixCoreRules.ward = { enabled: true };
    primeAccuracyRolls(combat);
  }
  combat.eventLog.length = 0;
  const decorate = (action = physical) => decorateRecipientEffects([marker, ...combat.eventLog], {
    resolveCard: () => action, resolveStatus: id => registries.statuses.get(id),
  });
  return { combat, enemy, decorate };
}

test('JSON owns neutral magic, spell-circle opacity, and only melee/reach delivery', () => {
  const spell = { sourceId: 'player', tags: ['camp:spell', 'range:ranged'] };
  assert.equal(recipientWindupFor(spell).color, '#4169E1');
  assert.equal(recipientWindupFor(spell).opacity, SETTINGS.layering.opacity.spellCircle);
  assert.equal(recipientWindupFor(physical), null);
  assert.equal(recipientDeliveryFor(spell).mode, 'reach-extension');
  assert.equal(recipientDeliveryFor(physical).mode, 'melee-contact');
  assert.equal(recipientEffectsForEvent({ tags: ['camp:physical', 'school:frost', 'damage:fire'] }, hit)[0].overlay, 'fire');
  assert.equal(recipientEffectsForEvent({ tags: ['camp:physical', 'school:frost', 'damage:fire'] }, hit)[0].shape, 'slash');
});

test('real Block damage receipts compose one incoming contact plus distinct break', () => {
  const { combat, enemy, decorate } = fixture();
  enemy.block = 4;
  applyAttackDamage(combat, combat.player, enemy, 10, []);
  assert.ok(combat.eventLog.some(event => event.type === 'blockBroken'));
  const layers = flatten(decorate({ ...physical, tags: [...physical.tags, 'damage:fire'] }));
  assert.equal(layers.filter(layer => layer.phase === 'contact').length, 1);
  assert.equal(layers.find(layer => layer.phase === 'contact').overlay, 'fire');
  assert.equal(layers.filter(layer => layer.shape === 'block-break').length, 1);
  assert.equal(layers.filter(layer => layer.shape === 'block-hit').length, 0);
});

test('real fully blocked contact does not claim HP damage; real Poise break differs from Block', () => {
  const blocked = fixture(); blocked.enemy.block = 20;
  applyAttackDamage(blocked.combat, blocked.combat.player, blocked.enemy, 4, []);
  const protectedContact = flatten(blocked.decorate()).find(layer => layer.phase === 'contact');
  assert.equal(protectedContact.claimsDamage, false);
  assert.equal(protectedContact.opacity, SETTINGS.layering.opacity.protectedContact);
  const { combat, enemy, decorate } = fixture(true);
  enemy.persistentPoise = { value: 3, max: 3 };
  applyAttackDamage(combat, combat.player, enemy, 12, [], { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', damageType: 'slashing' } });
  assert.ok(combat.eventLog.some(event => event.type === 'poiseBroken'));
  const layers = flatten(decorate());
  assert.ok(layers.some(layer => layer.shape === 'poise-break'));
  assert.ok(!layers.some(layer => layer.shape === 'block-break' || layer.shape === 'poise-hit'));
});

test('real healing, Mana and Stamina restoration are positive receipts, never costs or zero gains', () => {
  const { combat, decorate } = fixture();
  combat.player.stamina = 0;
  for (const op of ['heal', 'restoreMana', 'restoreStamina']) executeAction(combat, {
    source: combat.player, owner: combat.player, effect: { op, target: 'self', amount: 3 },
  });
  const layers = flatten(decorate(fire));
  assert.equal(layers.find(layer => layer.shape === 'heal-plus').color, SETTINGS.behavior.palettes.healing);
  assert.ok(layers.find(layer => layer.palette === 'mana' && layer.shape === 'buff'));
  assert.ok(layers.find(layer => layer.palette === 'stamina' && layer.shape === 'buff'));
  for (const layer of layers.filter(layer => layer.shape === 'buff')) {
    assert.equal(layer.anchor, 'card-bottom'); assert.equal(layer.sizing, 'card');
  }
  for (const type of ['staminaRecovered', 'manaRestored', 'staminaSpent', 'manaSpent']) {
    assert.deepEqual(recipientEffectsForEvent(fire, { type, amount: 0, targetId: 'player' }), []);
  }
});

test('real status apply/remove and triggered tick receipts preserve lifecycle identity', () => {
  const { combat, enemy, decorate } = fixture();
  applyStatus(combat, enemy, 'burn', 2, combat.player);
  removeStatus(combat, enemy, 'burn', { reason: 'cleansed' });
  combat._abilityAction = { source: enemy, meta: { triggeredBy: { kind: 'status', id: 'venom', ownerId: enemy.id } } };
  applyLoseHp(combat, enemy, 2);
  delete combat._abilityAction;
  const layers = flatten(decorate(fire));
  assert.ok(layers.find(layer => layer.shape === 'status-apply' && layer.palette === 'fire'));
  assert.ok(layers.find(layer => layer.shape === 'status-clear' && layer.overlayTreatment === 'fade-out'));
  assert.ok(layers.find(layer => layer.shape === 'status-tick' && layer.palette === 'decay'));
});

test('real Ward status resistance renders Ward silhouette and resistance without fake hit', () => {
  const { combat, enemy, decorate } = fixture(true);
  enemy.persistentWard = { value: 3, max: 3 };
  applyStatusPressure(combat, enemy, 'sleep', 6, combat.player, { camp: 'spell', actionKey: 'pressure' });
  assert.ok(combat.eventLog.some(event => event.type === 'statusPressure' && event.resisted > 0));
  const layers = flatten(decorate(fire));
  assert.ok(layers.some(layer => layer.shape === 'ward' && layer.silhouette === 'ward' && layer.treatment === 'absorb'));
  assert.ok(layers.some(layer => layer.shape === 'status-resist'));
  assert.ok(!layers.some(layer => layer.phase === 'contact'));
});

test('successful evade has ghosts only; an Evade grant or range miss is not a dodge', () => {
  for (const event of [{ type: 'attackMissed', missReason: 'evaded' }, { type: 'combatAvoidanceResolved', avoided: true }, { type: 'damageDealt', evaded: true, amount: 4 }]) {
    const layers = recipientEffectsForEvent(fire, { ...event, targetId: 'player' });
    assert.deepEqual(layers.map(layer => layer.shape), ['evade']);
    assert.equal(layers[0].claimsDamage, false);
  }
  assert.deepEqual(recipientEffectsForEvent(fire, { type: 'attackMissed', missReason: 'range', targetId: 'player' }), []);
  assert.ok(!recipientEffectsForEvent(fire, { type: 'statusApplied', status: 'evade', stacks: 1, targetId: 'player' }).some(layer => layer.shape === 'evade'));
});

test('nested counters and continuation dispatches retain source definitions and normalized co-op seats', () => {
  const state = createRecipientEffectState();
  const options = { state, resolveCard: () => physical, resolveEnemyMove: () => fire };
  const first = decorateRecipientEffects([{ type: 'combatContactPrepared', sourceId: 'mage', enemyId: 'mageDef', moveId: 'bolt', contactKey: 'g1' }], options);
  assert.ok(first[0].recipientWindup);
  const next = decorateRecipientEffects([
    { type: 'combatCounterTriggered', sourceKind: 'player', sourceId: 'player', sourcePlayerId: 'seat-b', cardId: 'counter' },
    { ...hit, sourcePlayerId: 'seat-b', targetId: 'mage' },
    { type: 'persistentWardChanged', targetId: 'mage', restored: 3 },
    { type: 'combatHitStarted', sourceId: 'mage', enemyId: 'mageDef', moveId: 'bolt', contactKey: 'g1', contactIndex: 1 },
    { ...hit, sourceId: 'mage', targetId: 'player', targetPlayerId: 'seat-b' },
  ], options);
  assert.equal(next[1].recipientEffect.action, 'counter');
  assert.equal(next[1].recipientSourceId, 'seat-b');
  assert.equal(next[2].recipientEffect.palette, 'fire');
  assert.equal(next[2].recipientEffect.targetType, 'self');
  assert.equal(next[4].recipientEffect.palette, 'fire');
  assert.equal(next[4].recipientTargetId, 'seat-b');
  assert.equal(next[3].recipientWindup, undefined, 'same action does not restart its circle after a pause');
});

test('Sweep is one unchanged group sprite per action; a repeated action is not deduplicated', () => {
  const state = createRecipientEffectState();
  const action = { tags: ['camp:physical', 'maneuver:sweep', 'targeting:area'] };
  const options = { state, resolveCard: () => action };
  const events = [marker, hit, { ...hit, targetId: 'e2' }, { ...hit, targetId: 'e3', evaded: true }];
  for (let repeat = 0; repeat < 2; repeat++) {
    const layers = flatten(decorateRecipientEffects(events, options));
    const sweeps = layers.filter(layer => layer.shape === 'sweep');
    assert.equal(sweeps.length, 1); assert.equal(sweeps[0].mount, 'group');
    assert.deepEqual(sweeps[0].targetIds, ['e1', 'e2']);
  }
});

test('actual heal/bleed secondaries overlap primary last frame, never tag-only or across boundaries', () => {
  const bleed = { type: 'statusApplied', targetId: 'e1', sourceId: 'player', status: 'bleed', stacks: 2 };
  const out = decorateRecipientEffects([marker, hit, bleed], { resolveCard: () => fire });
  assert.deepEqual(out[1].recipientEffects.map(layer => layer.shape), ['spell', 'bleed-drops']);
  assert.equal(out[1].recipientEffects[1].delayMs, out[1].recipientEffects[0].durationMs * 2 / 3);
  assert.equal(out[1].recipientEffects[1].color, SETTINGS.behavior.palettes.blood);
  assert.deepEqual(out[2].recipientEffects, []);
  assert.ok(!recipientEffectsForEvent({ tags: ['bleed'] }, hit).some(layer => layer.shape === 'bleed-drops'));
  for (const events of [[hit, { type: 'healed', targetId: 'e1', amount: 2 }], [marker, hit, { type: 'playerTurnEnd' }, { type: 'healed', targetId: 'e1', amount: 2 }]]) {
    const rows = decorateRecipientEffects(events, { resolveCard: () => physical });
    assert.equal(rows.find(row => row.type === 'damageDealt').recipientEffects.length, 1);
    assert.ok(rows.at(-1).recipientEffects.some(layer => layer.shape === 'heal-plus'));
  }
});

test('authored beneficial modifiers include other stats; unknown or negative metadata never invents a buff', () => {
  assert.equal(recipientStatusPolarity({ modifiers: { accuracyAdd: 2 } }), 'positive');
  assert.equal(recipientStatusPolarity({ modifiers: { damageTakenMult: 1.5 } }), 'negative');
  assert.equal(recipientStatusPolarity({ modifiers: { unknownField: 4 } }), 'neutral');
  const rows = decorateRecipientEffects([
    { type: 'statusApplied', targetId: 'player', status: 'customAccuracy', stacks: 1 },
    { type: 'statusApplied', targetId: 'player', status: 'wisdom', stacks: 1 },
    { type: 'statusApplied', targetId: 'player', status: 'customCurse', stacks: 1 },
  ], { resolveStatus: id => id === 'customAccuracy' ? { modifiers: { accuracyAdd: 1 } } : id === 'customCurse' ? { beneficial: false } : {} });
  assert.equal(rows[0].recipientEffect.shape, 'buff');
  assert.equal(rows[1].recipientEffect.palette, 'wisdom');
  assert.equal(rows[2].recipientEffect.shape, 'debuff');
});

test('actual allied MP/SP restoration receipts name target seat, retain amounts, and leave solo payloads unchanged', () => {
  const { combat } = fixture();
  const ally = { ...combat.player, mana: 2, maxMana: 10, stamina: 2, maxStamina: 10, statuses: {} };
  combat.playerIdForEntity = entity => entity === ally ? 'seat-b' : entity === combat.player ? 'seat-a' : null;
  const action = { type: 'skill', effects: [{ op: 'restoreMana', target: 'ally' }, { op: 'restoreStamina', target: 'ally' }] };
  for (const op of ['restoreMana', 'restoreStamina']) executeAction(combat, {
    source: combat.player, owner: combat.player, target: ally, effect: { op, target: 'ally', amount: 3 },
  });
  assert.equal(ally.mana, 5); assert.equal(ally.stamina, 5);
  const receipts = combat.eventLog.filter(event => ['manaRestored', 'staminaRecovered'].includes(event.type));
  assert.deepEqual(receipts.map(event => [event.targetId, event.targetPlayerId, event.amount]), [['player', 'seat-b', 3], ['player', 'seat-b', 3]]);
  const rows = decorateRecipientEffects([{ ...marker, playerId: 'seat-a' }, ...receipts], { resolveCard: () => action });
  for (const row of rows.slice(1)) {
    assert.equal(row.recipientTargetId, 'seat-b'); assert.equal(row.recipientSourceId, 'seat-a');
    assert.equal(row.recipientEffect.targetType, 'target');
  }
  const solo = fixture(); solo.combat.player.stamina = 0;
  for (const op of ['restoreMana', 'restoreStamina']) executeAction(solo.combat, {
    source: solo.combat.player, owner: solo.combat.player, effect: { op, target: 'self', amount: 3 },
  });
  assert.deepEqual(solo.combat.eventLog, [
    { type: 'manaRestored', targetId: 'player', amount: 3 },
    { type: 'staminaRecovered', targetId: 'player', amount: 3, reason: 'effect' },
  ]);
});

test('real Core Evade spends its status and emits ghosts without a successful-hit layer', () => {
  const { combat, enemy, decorate } = fixture(true);
  enemy.statuses = { evade: { stacks: 1 } };
  applyAttackDamage(combat, combat.player, enemy, 10, [], { combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', damageType: 'slashing' } });
  assert.ok(combat.eventLog.some(event => event.type === 'attackMissed' && event.missReason === 'evaded'));
  const layers = flatten(decorate());
  assert.equal(layers.filter(layer => layer.shape === 'evade').length, 1);
  assert.ok(!layers.some(layer => layer.claimsDamage || layer.phase === 'contact'));
});

test('refresh/capped status applications and bookkeeping have no positive gain aura', () => {
  for (const event of [
    { status: 'strength', previousTotal: 4, total: 4 },
    { status: 'prepared', previousTotal: 1, total: 1 },
    { status: 'stanceShifted', previousTotal: 0, total: 1 },
  ]) assert.deepEqual(recipientEffectsForEvent(fire, { type: 'statusApplied', targetId: 'player', stacks: 1, ...event }), []);
});

test('a later contact break does not erase an earlier hit reaction', () => {
  const state = createRecipientEffectState();
  const rows = decorateRecipientEffects([
    { type: 'combatHitStarted', sourceId: 'mage', enemyId: 'mageDef', moveId: 'bolt', contactKey: 'g1', contactIndex: 0 },
    { ...hit, sourceId: 'mage', targetId: 'player', blocked: 2 },
    { type: 'combatHitStarted', sourceId: 'mage', enemyId: 'mageDef', moveId: 'bolt', contactKey: 'g1', contactIndex: 1 },
    { type: 'blockBroken', sourceId: 'mage', targetId: 'player' },
  ], { state, resolveEnemyMove: () => fire });
  assert.ok(rows[1].recipientEffects.some(layer => layer.shape === 'block-hit'));
  assert.ok(rows[3].recipientEffects.some(layer => layer.shape === 'block-break'));
});

test('mixed AoE damage and support receipts keep self, ally, and group targeting distinct', () => {
  const action = { sourceId: 'seat-a', tags: ['camp:spell', 'targeting:area'], effects: [
    { op: 'damage', target: 'allEnemies' }, { op: 'heal', target: 'self' },
    { op: 'restoreMana', target: 'self' }, { op: 'restoreStamina', target: 'self' },
    { op: 'gainEnergy', target: 'self' }, { op: 'gainPoise', target: 'self' },
  ] };
  assert.equal(recipientEffectsForEvent(action, { ...hit, sourceId: 'seat-a' })[0].targetType, 'aoe');
  for (const type of ['healed', 'manaRestored', 'staminaRecovered', 'energyGained', 'persistentPoiseChanged']) {
    const layers = recipientEffectsForEvent(action, { type, sourceId: 'seat-a', targetId: 'seat-a', amount: 3, restored: 3 });
    assert.ok(layers.length, type);
    assert.ok(layers.every(layer => layer.targetType === 'self'), type);
  }
  const allyAction = { ...action, effects: action.effects.map(effect => ['restoreMana', 'restoreStamina'].includes(effect.op)
    ? { ...effect, target: 'ally' } : effect) };
  for (const type of ['manaRestored', 'staminaRecovered']) {
    const layers = recipientEffectsForEvent(allyAction, { type, sourceId: 'player', sourcePlayerId: 'seat-a',
      targetId: 'player', targetPlayerId: 'seat-b', amount: 3 });
    assert.equal(layers[0].targetType, 'target');
    assert.equal(layers[0].targetId, 'seat-b');
  }
});

test('canonical Skill classification gets its own impact unless an explicit maneuver overrides it', () => {
  const skill = { tags: ['camp:physical', 'classification.skill'] };
  assert.equal(recipientEffectsForEvent(skill, hit)[0].shape, 'skill');
  assert.equal(recipientEffectsForEvent({ ...skill, tags: [...skill.tags, 'maneuver:smash'] }, hit)[0].shape, 'smash');
});

test('prepared Reach telegraph carries only delivery, with no duplicate delivery or invented impact on evade', () => {
  const state = createRecipientEffectState();
  const options = { state, resolveEnemyMove: () => ({ ...fire, range: 'reach' }), resolveTelegraphTargets: () => ['seat-b'] };
  const start = { type: 'combatContactPrepared', sourceId: 'mage', enemyId: 'mageDef', moveId: 'bolt', contactKey: 'telegraph', contactIndex: 0 };
  const telegraph = decorateRecipientEffects([start], options)[0];
  assert.equal(telegraph.recipientDelivery.phase, 'delivery');
  assert.equal(telegraph.recipientDelivery.shape, null);
  assert.equal(telegraph.recipientDelivery.impactShape, 'spell');
  assert.equal(telegraph.recipientDelivery.claimsDamage, false);
  assert.deepEqual(telegraph.recipientDelivery.targetIds, ['seat-b']);
  assert.deepEqual(telegraph.recipientEffects, []);
  const continuation = { ...start, type: 'combatHitStarted', contactPrepared: true };
  const rows = decorateRecipientEffects([continuation, { ...hit, sourceId: 'mage', targetId: 'seat-b' }], options);
  assert.equal(rows[0].recipientDelivery, undefined);
  assert.equal(rows[1].recipientEffect.delivery, null);
  const miss = decorateRecipientEffects([continuation, { type: 'attackMissed', sourceId: 'mage', targetId: 'seat-b', missReason: 'evaded' }], options);
  assert.deepEqual(flatten(miss).map(layer => layer.shape), ['evade']);
});

test('an annotated miss suppresses old projectile/impact sprites while retaining the caster effect', async t => {
  const { withKitDom } = await import('./helpers/dom.mjs');
  const { playCombatEffectPlan } = await import('../src/ui/combatEffectSprites.js');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const previousImage = globalThis.Image;
  globalThis.Image = class { addEventListener() {} };
  try {
    withKitDom(dom => {
      const createElement = dom.document.createElement.bind(dom.document);
      dom.document.createElement = tag => {
        const node = createElement(tag);
        node.animate = () => ({ cancel() {}, finished: new Promise(() => {}) });
        return node;
      };
      const layer = dom.document.createElement('div');
      const events = decorateRecipientEffects([marker, { type: 'attackMissed', sourceId: 'player', targetId: 'e1', missReason: 'range' }], { resolveCard: () => fire });
      assert.ok(events.every(event => Array.isArray(event.recipientEffects)));
      assert.ok(events.every(event => !event.recipientEffect));
      const cancel = playCombatEffectPlan(layer, { left: 0, top: 0, width: 50, height: 80 },
        { kind: 'emberbolt', cast: 'focusMotes', projectile: true, at: 'target' },
        { targets: [{ left: 100, top: 0, width: 50, height: 80 }], duration: 300,
          recipientEffects: !events.some(event => Array.isArray(event.recipientEffects)) });
      const kinds = () => [...layer.children].map(node => node.dataset.effect);
      assert.ok(kinds().includes('focusMotes'), 'authored caster emission is preserved');
      t.mock.timers.tick(150);
      assert.ok(!kinds().includes('emberbolt'), 'no old projectile manufactures an impact');
      cancel();
      assert.equal(layer.children.length, 0);
    });
  } finally {
    if (previousImage === undefined) delete globalThis.Image; else globalThis.Image = previousImage;
  }
});

test('actual enemy marker schema uses expanded nested Reach profile over raw move tags', () => {
  const registries = createRegistries(contentBundle);
  const move = registries.enemies.get('valkyrieShade').moves.bloodFeather;
  const state = createRecipientEffectState();
  const options = { state, resolveEnemyMove: () => move, resolveTelegraphTargets: () => ['player'] };
  const profile = { camp: 'physical', maneuver: 'ranged', damageType: 'piercing', range: 'reach', targeting: 'single', projectile: true };
  const telegraph = { type: 'combatContactPrepared', sourceId: 'e1', enemyId: 'valkyrieShade', moveId: 'bloodFeather',
    kind: 'attack', contactKey: 'actual-enemy', contactIndex: 0, actionPreview: { profile } };
  const out = decorateRecipientEffects([telegraph], options);
  assert.equal(out[0].recipientDelivery.range, 'reach');
  assert.equal(out[0].recipientDelivery.delivery.mode, 'reach-extension');
  assert.equal(out[0].recipientDelivery.impactShape, 'thrust');
  const continued = decorateRecipientEffects([{ ...telegraph, type: 'enemyMoveStarted', contactPrepared: true,
    intentPreview: { combatProfile: profile } }, { ...hit, sourceId: 'e1', targetId: 'player' }], options);
  assert.equal(continued[1].recipientEffect.range, 'reach');
  assert.equal(continued[1].recipientEffect.delivery, null, 'the telegraphed approach is not repeated at contact');
});

test('all four player/enemy spell flows circle the invoker and independently target the actual outcome', () => {
  for (const [sourceId, targetId, support] of [
    ['player', 'player', true], ['player', 'e1', false], ['e1', 'e1', true], ['e1', 'player', false],
  ]) {
    const { combat, enemy } = fixture();
    const source = sourceId === 'player' ? combat.player : enemy;
    const target = targetId === 'player' ? combat.player : enemy;
    if (support) applyStatus(combat, target, 'strength', 2, source);
    else applyAttackDamage(combat, source, target, 4, []);
    const action = { tags: ['camp:spell', 'school:fire', 'classification.skill'],
      effects: [{ op: support ? 'applyStatus' : 'damage', status: support ? 'strength' : undefined, target: support ? 'self' : 'enemy' }] };
    const start = sourceId === 'player' ? { ...marker, targetId }
      : { type: 'enemyMoveStarted', sourceId, enemyId: 'mage', moveId: support ? 'enchant' : 'bolt', kind: support ? 'buff' : 'attack',
        actionPreview: { profile: { camp: 'spell', maneuver: 'casting', school: 'fire', range: 'reach' } } };
    const rows = decorateRecipientEffects([start, ...combat.eventLog], { resolveCard: () => action, resolveEnemyMove: () => action });
    const circle = rows[0].recipientWindup;
    assert.equal(circle.shape, 'spell-circle', `${sourceId}→${targetId}`);
    assert.equal(circle.targetType, 'self');
    assert.equal(circle.mount, 'actor');
    assert.equal(circle.sourceId, sourceId);
    assert.equal(circle.targetId, sourceId);
    assert.deepEqual(circle.targetIds, [sourceId]);
    assert.equal(circle.palette, 'fire');
    const outcome = rows.find(row => row.type === (support ? 'statusApplied' : 'damageDealt'));
    assert.equal(outcome.recipientTargetId, targetId);
    assert.ok(outcome.recipientEffects.every(layer => layer.targetId === targetId));
    assert.equal(outcome.recipientEffect.shape, support ? 'buff' : 'spell');
  }
});

test('co-op recipient aliases and attribute colors cannot redirect or recolor the invoker circle', () => {
  const spell = { tags: ['camp:spell', 'school:fire', 'classification.skill'] };
  const receipt = { type: 'statusApplied', sourceId: 'player', sourcePlayerId: 'seat-a', targetId: 'player',
    targetPlayerId: 'seat-b', playerId: 'seat-b', status: 'dexterity', stacks: 2 };
  const circle = recipientWindupFor(spell, receipt);
  assert.deepEqual(circle.targetIds, ['seat-a']);
  assert.equal(circle.targetId, 'seat-a'); assert.equal(circle.sourceId, 'seat-a');
  assert.equal(circle.palette, 'fire', 'the cast keeps its school; the buff keeps its own stat tint');
  const buff = recipientEffectsForEvent(spell, receipt)[0];
  assert.equal(buff.targetId, 'seat-b'); assert.equal(buff.palette, 'dexterity');
  const rawPlayer = recipientWindupFor(spell, { sourceId: 'player', targetId: 'player', playerId: 'seat-b' });
  assert.equal(rawPlayer.targetId, 'player', 'a recipient playerId alias is never a source identifier');
  const rows = decorateRecipientEffects([
    { ...marker, sourceId: 'player', sourcePlayerId: 'seat-a', playerId: 'seat-a', targetId: 'player', targetPlayerId: 'seat-b' }, receipt,
  ], { resolveCard: () => spell });
  assert.deepEqual(rows[0].recipientWindup.targetIds, ['seat-a']);
  assert.equal(rows[1].recipientTargetId, 'seat-b');
});
