import test from 'node:test';
import assert from 'node:assert/strict';
import { combatMatchups } from '../src/content/combatMatchups.js';
import { armCombatCounter, clearCombatCounter, prepareMatchupHit, completeMatchupHit,
  matchupPoiseMultiplier, matchupRiderEffects } from '../src/engine/combatMatchups.js';
import { attackTagsFor } from '../src/engine/actions.js';

const card = (maneuver, damageType = 'slashing', camp = 'physical', extra = {}) => ({
  combatProfile: { camp, maneuver, damageType, ...extra },
});
function fixture() {
  const events = [], queue = [];
  const source = { id: 'enemy', kind: 'enemy', alive: true, hp: 30, block: 0, statuses: {} };
  const target = { id: 'player', kind: 'player', alive: true, hp: 30, block: 4, statuses: {} };
  const ctx = { turn: 1, emit: (type, payload) => events.push({ type, ...payload }), enqueue: action => queue.push(action),
    registries: { statuses: new Map(['bleed', 'frost', 'burn', 'weak', 'crimsonBlight', 'venom'].map(id => [id, { id }])) } };
  return { ctx, source, target, events, queue };
}
function landed(f, incoming, base) {
  const receipt = prepareMatchupHit(f.ctx, f.source, f.target, incoming, base);
  const blocked = Math.min(f.target.block, receipt.amount - receipt.guardBypass);
  f.target.block -= blocked;
  const hpLoss = receipt.amount - blocked;
  f.target.hp -= hpLoss;
  completeMatchupHit(f.ctx, f.source, f.target, incoming, receipt, { blocked, hpLoss });
  return { receipt, blocked, hpLoss };
}

test('full block halves incoming damage and returns enhanced listed damage and Poise once', () => {
  const f = fixture();
  armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6, poiseDamage: 4, bonus: 2 });
  const hit = landed(f, card('attack'), 8);
  assert.equal(hit.receipt.amount, 4);
  assert.equal(f.target.hp, 30);
  assert.deepEqual(f.queue.map(a => [a.effect.op, a.effect.amount]), [['damage', 16], ['poiseDamage', 6]]);
  assert.equal(f.target.combatCounter, undefined);
  assert.equal(landed(f, card('attack'), 8).receipt.amount, 8);
});

test('partial block consumes reaction without retaliation; absent Poise never creates bonus Poise', () => {
  const f = fixture(); f.target.block = 1;
  armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6 });
  assert.equal(landed(f, card('attack'), 8).hpLoss, 3);
  assert.equal(f.queue.length, 0);
  assert.equal(f.target.combatCounter, undefined);
  f.target.block = 20;
  armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6 });
  landed(f, card('attack'), 8);
  assert.deepEqual(f.queue.map(a => a.effect.op), ['damage']);
});

test('Sweep, Piercing, Force and ranged shots bypass melee reaction without consuming it', () => {
  for (const incoming of [card('sweep'), card('attack', 'piercing'), card('attack', 'force'), card('attack', 'arcane'), card('ranged')]) {
    const f = fixture();
    armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6 });
    const receipt = prepareMatchupHit(f.ctx, f.source, f.target, incoming, 8);
    assert.equal(receipt.counterEligible, false);
    assert.equal(receipt.amount, 8);
    assert.equal(f.target.combatCounter.charges, 1);
  }
});

test('specialized ranged Counter intercepts Piercing projectile, avoiding universal bow immunity', () => {
  const f = fixture();
  armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6, mode: 'ranged' });
  const hit = landed(f, card('ranged', 'piercing'), 8);
  assert.equal(hit.hpLoss, 0);
  assert.equal(hit.receipt.guardBypass, 0);
  assert.equal(f.queue[0].effect.amount, 14);
});

test('spell Counter versus physical projectile strips only Ward, never Health or ordinary Guard', () => {
  const f = fixture(); f.source.block = 10; f.source.wardBlock = 6; f.source.wardGuard = 2;
  armCombatCounter(f.ctx, f.target, card('counter', 'force', 'spell'), { damage: 6, poiseDamage: 4 });
  landed(f, card('ranged', 'piercing'), 8);
  assert.equal(f.source.hp, 30);
  assert.equal(f.source.block, 4);
  assert.equal(f.source.wardBlock, 0);
  assert.equal(f.source.wardGuard, 0);
  assert.equal(f.queue.length, 0);
  assert.equal(f.events.find(e => e.type === 'combatCounterTriggered').wardOnly, true);
});

test('spell Counter returns Health-capable damage to incoming spell even on hybrid enemy', () => {
  const f = fixture();
  armCombatCounter(f.ctx, f.target, card('counter', 'force', 'spell'), { damage: 6 });
  landed(f, card('attack', 'fire', 'spell'), 8);
  assert.equal(f.queue[0].effect.amount, 14);
  assert.equal(f.queue[0].target, f.source);
  assert.equal(f.queue[0].card.combatReaction, true);
});

test('reaction attacks cannot trigger Counter or damage riders', () => {
  const f = fixture();
  armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6 });
  const reaction = { ...card('attack'), combatReaction: true };
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, reaction, 8).counterEligible, false);
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, reaction, { amount: 8, hpLoss: 8 }), []);
});

test('Smash multiplies only against Guard and rewards actual Guard break with Poise', () => {
  const f = fixture(); f.target.block = 10; f.target.wardBlock = 2;
  assert.equal(landed(f, card('smash'), 8).receipt.amount, 12);
  assert.equal(f.queue[0].effect.op, 'poiseDamage');
  assert.equal(f.queue[0].effect.amount, 3);
  f.target.block = 8; f.target.wardBlock = 8;
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, card('smash'), 8).amount, 8);
});

test('fast physical Attack pressures preparation through Poise without changing intent or stunning', () => {
  const f = fixture(); f.target.intent = { combatProfile: { camp: 'physical', maneuver: 'smash' } };
  assert.equal(matchupPoiseMultiplier(f.ctx, f.source, f.target, card('attack')), 1.5);
  assert.equal(matchupPoiseMultiplier(f.ctx, f.source, f.target, card('smash')), 1);
  assert.equal(f.target.intent.combatProfile.maneuver, 'smash');
});

test('riders apply once per action+target, wait for Health leak, and skip already printed statuses', () => {
  const f = fixture(); const incoming = { ...card('attack'), combatRiderTargets: [] };
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, incoming, { amount: 8, hpLoss: 0 }), []);
  assert.equal(matchupRiderEffects(f.ctx, f.source, f.target, incoming, { amount: 8, hpLoss: 3 })[0].status, 'bleed');
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, incoming, { amount: 8, hpLoss: 3 }), []);
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, { ...card('attack'), appliedStatuses: ['bleed'] }, { amount: 8, hpLoss: 3 }), []);
});

test('Piercing bypass occurs once per action+target, not on every hit of multi-hit card', () => {
  const f = fixture(); f.target.block = 20;
  const incoming = { ...card('attack', 'piercing'), combatRiderTargets: [] };
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, incoming, 6).guardBypass, 2);
  matchupRiderEffects(f.ctx, f.source, f.target, incoming, { amount: 6, hpLoss: 2 });
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, incoming, 6).guardBypass, 0);
});

test('old unprofiled carriers preserve damage; Counter state expires and survives serialization', () => {
  const f = fixture();
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, null, 8).amount, 8);
  const partial = { combatProfile: { camp: null, damageType: 'piercing' } };
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, partial, 8).guardBypass, 0);
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, partial, { amount: 8, hpLoss: 8 }), []);
  armCombatCounter(f.ctx, f.target, card('counter'), { damage: 6 });
  f.target = JSON.parse(JSON.stringify(f.target));
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, card('attack'), 8).amount, 4);
  f.ctx.turn = 2;
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, card('attack'), 8).amount, 8);
  clearCombatCounter(f.target);
  assert.equal(f.target.combatCounter, undefined);
});

test('combat-local rules override tactical balance without changing defaults', () => {
  const f = fixture();
  f.ctx.combatMatchupRules = structuredClone(combatMatchups);
  f.ctx.combatMatchupRules.smash.guardedMultiplier = 2;
  assert.equal(prepareMatchupHit(f.ctx, f.source, f.target, card('smash'), 8).amount, 16);
  assert.equal(combatMatchups.smash.guardedMultiplier, 1.5);
});

test('typed status riders resolve canonical types and legacy aliases through content rules', () => {
  for (const [type, status] of [['slashing', 'bleed'], ['cold', 'frost'], ['frost', 'frost'],
    ['fire', 'burn'], ['lightning', 'weak'], ['necrotic', 'crimsonBlight'], ['decay', 'crimsonBlight'], ['poison', 'venom']]) {
    const f = fixture();
    const effects = matchupRiderEffects(f.ctx, f.source, f.target, card('attack', type), { amount: 4, hpLoss: 1 });
    assert.deepEqual(effects, [{ op: 'applyStatus', status, stacks: 1 }], type);
  }
});

test('Blunt pressure, Force Ward stripping and Holy cleansing provide distinct utility', () => {
  const f = fixture();
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, card('attack', 'blunt'), { amount: 4, hpLoss: 0 }),
    [{ op: 'poiseDamage', amount: 2 }]);
  f.target.block = 5; f.target.wardBlock = 1; f.target.wardGuard = 3;
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, card('attack', 'arcane'), { amount: 4, hpLoss: 0 }), []);
  assert.equal(f.target.block, 4);
  assert.equal(f.target.wardBlock, 0);
  assert.equal(f.target.wardGuard, 2);
  f.source.statuses.weak = { stacks: 3 };
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, card('attack', 'sacred'), { amount: 4, hpLoss: 1 }),
    [{ op: 'removeStatus', target: 'self', status: 'weak', amount: 1 }]);
});

test('empty card identity permits explicit local hit tags without inheriting registry tags', () => {
  const action = { card: { cardId: 'strike', tags: [] } };
  const registries = { cards: new Map([['strike', { tags: ['camp:physical', 'maneuver:attack', 'blade'] }]]) };
  assert.deepEqual(attackTagsFor(action, {}, registries), []);
  assert.deepEqual(attackTagsFor(action, { tags: [] }, registries), []);
  assert.deepEqual(attackTagsFor(action, { tags: ['starstone'] }, registries), ['starstone']);
  assert.equal(prepareMatchupHit(fixture().ctx, null, null,
    { tags: attackTagsFor(action, { tags: ['starstone'] }, registries), combatProfile: { camp: null } }, 10).profile, null);
});

test('lethal contact allows source cleansing while dead targets receive no riders', () => {
  const f = fixture(); f.target.alive = false; f.target.hp = 0;
  f.target.block = 4; f.target.wardBlock = 2;
  f.source.statuses.weak = { stacks: 3 };
  assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, card('attack', 'holy'), { amount: 4, hpLoss: 4 }),
    [{ op: 'removeStatus', target: 'self', status: 'weak', amount: 1 }]);
  for (const type of ['blunt', 'slashing', 'force']) {
    assert.deepEqual(matchupRiderEffects(f.ctx, f.source, f.target, card('attack', type), { amount: 4, hpLoss: 4 }), []);
  }
  assert.equal(f.target.block, 4);
  assert.equal(f.target.wardBlock, 2);
});
