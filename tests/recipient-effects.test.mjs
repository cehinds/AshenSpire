import test from 'node:test';
import assert from 'node:assert/strict';
import { ResolveRecipientEffect, RecipientEffectForEvent } from '../src/model/recipientEffects.js';

const damage = { type: 'damageDealt', sourceId: 'player', targetId: 'enemy-1', amount: 5 };

test('fire spell impact layers elemental art over magic shape', () => {
  const recipe = RecipientEffectForEvent({ tags: ['camp:spell', 'school:fire', 'maneuver:casting', 'range:reach'] }, damage);
  assert.equal(recipe.shape, 'spell');
  assert.equal(recipe.overlay, 'fire');
  assert.equal(recipe.action, 'spell');
  assert.equal(recipe.range, 'reach');
  assert.equal(recipe.frameCount, 3);
});

test('physical elemental weapon retains its stance and damage silhouette', () => {
  const recipe = ResolveRecipientEffect({ tags: ['camp:physical', 'school:fire', 'damage:piercing', 'range:reach'] }, damage);
  assert.equal(recipe.shape, 'thrust');
  assert.equal(recipe.overlay, 'fire');
  assert.equal(recipe.action, 'attack');
  assert.equal(ResolveRecipientEffect({ combatProfile: { camp: 'spell', maneuver: 'smash', school: 'earth' } }, damage).shape, 'smash');
});

test('generic physical or magic damage does not erase an explicit school or element', () => {
  for (const damageType of ['physical', 'magic']) {
    const recipe = ResolveRecipientEffect({ tags: ['camp:physical', 'school:fire'] }, { ...damage, damageType });
    assert.equal(recipe.palette, 'fire');
    assert.equal(recipe.overlay, 'fire');
  }
  const explicit = ResolveRecipientEffect({ tags: ['camp:spell', 'element:frost', 'school:fire'], damageSchool: 'magic' }, damage);
  assert.equal(explicit.palette, 'frost');
  assert.equal(ResolveRecipientEffect({ damageSchool: 'magic', tags: ['starstone'] }, damage).palette, 'force');
});

test('legacy spell identity keeps magic impact without overriding explicit physical identity', () => {
  for (const action of [{ damageSchool: 'magic' }, { tags: ['magic'] }, { tags: ['fx:starstone'] }, { attack: { source: 'spell' } }]) {
    assert.equal(ResolveRecipientEffect(action, damage).shape, 'spell', JSON.stringify(action));
  }
  for (const action of [
    { damageSchool: 'magic', tags: ['camp:physical'] },
    { damageSchool: 'magic', attack: { source: 'weapon' } },
    { damageSchool: 'magic', equipmentProfileId: 'weaponAttack' },
  ]) assert.equal(ResolveRecipientEffect(action, damage).shape, 'slash', JSON.stringify(action));
});

test('authored status IDs get matching elemental debuffs and actual regen is beneficial', () => {
  for (const [status, palette] of [['burn', 'fire'], ['frost', 'frost'], ['chill', 'frost'], ['freeze', 'frost'], ['shock', 'lightning'], ['necroticBuildup', 'decay']]) {
    const recipe = RecipientEffectForEvent({}, { type: 'statusApplied', targetId: 'enemy-1', status, stacks: 1 });
    assert.equal(recipe.palette, palette);
    assert.equal(recipe.polarity, 'negative');
  }
  assert.equal(RecipientEffectForEvent({}, { type: 'statusApplied', targetId: 'player', status: 'regen', stacks: 1 }).shape, 'buff');
});

test('resolved namespaces and replacement card tags take precedence over base tags', () => {
  const recipe = ResolveRecipientEffect({ cardTags: [{ id: 'camp:spell' }, { id: 'school:frost' }], tags: ['camp:physical', 'school:fire'] }, damage);
  assert.equal(recipe.shape, 'spell');
  assert.equal(recipe.palette, 'frost');
  assert.equal(ResolveRecipientEffect({ tags: ['fx:pierce', 'source:spell'], combatProfile: { camp: 'physical' } }, damage).shape, 'thrust');
});

test('AoE damage and self buff on the same card use their own recipients', () => {
  const action = { tags: ['maneuver:sweep', 'targeting:area'], effects: [
    { op: 'damage', target: 'allEnemies' }, { op: 'applyStatus', status: 'strength', target: 'self' },
  ] };
  assert.equal(ResolveRecipientEffect(action, damage).targetType, 'aoe');
  const buff = RecipientEffectForEvent(action, { type: 'statusApplied', targetId: 'player', status: 'strength', stacks: 2 });
  assert.equal(buff.targetType, 'self');
  assert.equal(buff.shape, 'buff');
  assert.equal(buff.palette, 'strength');
  assert.equal(buff.action, 'sweep', 'debug placeholder still identifies the action stance');
});

test('enemy attacks and allied buffs resolve on their actual seat', () => {
  assert.equal(RecipientEffectForEvent({ damage: 8, tags: ['maneuver:smash'] }, { ...damage, sourceId: 'wolf', targetId: 'player' }).shape, 'smash');
  const ally = RecipientEffectForEvent({ type: 'skill' }, { type: 'statusApplied', sourceId: 'player', targetId: 'player', sourcePlayerId: 'seat-a', targetPlayerId: 'seat-b', status: 'dexterity', stacks: 1 });
  assert.equal(ally.targetType, 'target');
  assert.equal(ally.palette, 'dexterity');
  const allyRedirect = { type: 'skill', effects: [{ op: 'applyStatus', status: 'dexterity', target: 'self' }] };
  assert.equal(ResolveRecipientEffect(allyRedirect, { type: 'statusApplied', sourceId: 'seat-a', targetId: 'seat-b', status: 'dexterity' }).targetType, 'target');
  assert.equal(ResolveRecipientEffect({ effects: [{ op: 'heal', target: 'allAllies' }] }, { type: 'healed', sourceId: 'player', targetId: 'player', amount: 1 }).targetType, 'aoe');
});

test('Ward uses positive actual Ward receipts and school tint', () => {
  const action = { combatProfile: { camp: 'spell', maneuver: 'defend', school: 'alteration' } };
  const receipt = { type: 'persistentWardChanged', targetId: 'player', restored: 3 };
  assert.equal(RecipientEffectForEvent(action, receipt).shape, 'ward');
  assert.equal(RecipientEffectForEvent(action, receipt).palette, 'alteration');
  assert.equal(RecipientEffectForEvent(action, { ...receipt, restored: 0, credited: 3 }), null);
  assert.equal(RecipientEffectForEvent(action, { ...receipt, restored: 0, missingRecovered: 2 }).shape, 'ward');
});

test('buff hue and debuff direction override spell damage classification', () => {
  const action = { tags: ['camp:spell', 'school:fire'], effects: [{ op: 'damage', target: 'enemy' }] };
  const intellect = RecipientEffectForEvent(action, { type: 'statusApplied', targetId: 'player', status: 'intelligence', stacks: 1 });
  assert.equal(intellect.shape, 'buff');
  assert.equal(intellect.palette, 'intelligence');
  assert.equal(intellect.overlay, null);
  const weak = RecipientEffectForEvent(action, { type: 'statusApplied', targetId: 'enemy-1', status: 'weak', stacks: 1 });
  assert.equal(weak.shape, 'debuff');
  assert.equal(weak.polarity, 'negative');
  assert.equal(RecipientEffectForEvent(action, { type: 'healed', targetId: 'player', amount: 2 }).shape, 'heal');
});

test('no false impacts for missing targets, dodges, immunity, failed grants, proc duplication', () => {
  for (const event of [
    { ...damage, targetId: null }, { ...damage, evaded: true }, { ...damage, immune: true },
    { ...damage, amount: 0 }, { type: 'statusApplied', targetId: 'player', stacks: 0 },
    { type: 'healed', targetId: 'player', amount: 0 }, { type: 'procBurst', targetId: 'enemy-1', status: 'bleed' },
    { type: 'barrierGained', targetId: 'player', amount: 2 },
  ]) assert.equal(RecipientEffectForEvent({}, event), null, JSON.stringify(event));
  assert.ok(RecipientEffectForEvent({}, { ...damage, amount: 0, wardAbsorbed: 4 }));
});

test('fallback identity is independent of elemental and status variants', () => {
  const fire = ResolveRecipientEffect({ tags: ['camp:spell', 'school:fire', 'targeting:area'] }, damage);
  const frost = ResolveRecipientEffect({ tags: ['camp:spell', 'school:frost', 'targeting:area'] }, damage);
  assert.equal(`${fire.action}/${fire.targetType}`, 'spell/aoe');
  assert.equal(`${fire.action}/${fire.targetType}`, `${frost.action}/${frost.targetType}`);
});
