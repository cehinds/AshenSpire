import test from 'node:test';
import assert from 'node:assert/strict';
import { combatExpansionMatchups } from '../src/content/combatMatchups.js';
import { tacticalCarrier, prepareTacticalCard, enqueueCounterWard } from '../src/engine/combatCardTactics.js';
import { armCombatCounter, setCombatStance, startTacticalTurn, prepareCombatEvade,
  previewTacticalAction, beginTacticalAction, completeTacticalAction, recordTacticalContact,
  recordTacticalStatus, counterCoverageMatches } from '../src/engine/combatMatchups.js';
import { effectiveChance, rollChanceDie, previewAvoidance } from '../src/engine/combatAvoidance.js';
import { combatExpansionEntityProblems, combatExpansionMatchupRulesProblems, combatCounterProblems } from '../src/model/combatTacticsRules.js';

const carrier = (maneuver = 'attack', extra = {}) => ({ combatProfile: {
  camp: 'physical', maneuver, reach: 'contact', targeting: 'single', damageType: 'slashing', ...extra,
} });
function fixture(dice = [5]) {
  const queue = [], events = [], rolls = [];
  const source = { id: 'enemy', kind: 'enemy', alive: true, hp: 50, block: 0, statuses: {} };
  const target = { id: 'player', kind: 'player', alive: true, hp: 50, block: 8, statuses: {},
    attributes: { dexterity: 1, wisdom: 3, intelligence: 4 }, armorClass: 'medium', ratings: { ar: 4, dr: 3 } };
  const ctx = { combatExpansionVersion: 2, turn: 1, player: target, enemies: [source],
    registries: {}, emit: (type, payload) => events.push({ type, ...payload }), enqueue: action => queue.push(action),
    rng: { int: (stream, min, max) => { rolls.push({ stream, min, max }); return dice.shift() ?? min; } },
    combatControlRestrictions: entity => ({ counterDisabled: Boolean(entity.locked), evadeDisabled: Boolean(entity.locked) }),
  };
  return { ctx, source, target, queue, events, rolls };
}
function prepare(f, profile = {}, options = { damage: 7 }) {
  const card = carrier('counter', profile);
  setCombatStance(f.ctx, f.target, card);
  armCombatCounter(f.ctx, f.target, card, options);
  return card;
}
function absorb(f, receipt) {
  const blocked = Math.min(f.target.block, receipt.amount - receipt.guardBypass);
  const hpLoss = receipt.amount - blocked;
  f.target.block -= blocked;
  f.target.hp -= hpLoss;
  recordTacticalContact(receipt, { blocked, hpLoss });
}

test('Reaver Counter uses ceil(15*.5), strict Evade, Block8, and exactly printed return7', () => {
  const f = fixture([5]); prepare(f); prepareCombatEvade(f.ctx, f.target);
  const incoming = carrier('smash');
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 15 }]);
  assert.equal(receipt.amount, 8);
  assert.equal(receipt.avoidance.evade.total, 4);
  assert.equal(receipt.avoidance.evade.difficulty, 16);
  assert.equal(receipt.avoided, false);
  absorb(f, receipt); completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
  assert.equal(f.target.hp, 50);
  assert.deepEqual(f.queue.map(action => [action.effect.op, action.effect.amount]), [['damage', 7]]);
  assert.equal(f.target.combatCounter.charges, 0);
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 15 }]).amount, 15);
});

test('multi-hit rounding conserves one action budget, failed full absorption spends charge without reply', () => {
  const f = fixture(); prepare(f); f.target.block = 0;
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 1 }, { amount: 1 }]);
  assert.equal(receipt.amount, 1);
  assert.deepEqual(receipt.amounts, [1, 0]);
  recordTacticalContact(receipt, { hpLoss: 1 });
  assert.deepEqual(completeTacticalAction(f.ctx, f.source, f.target, carrier(), receipt), []);
  assert.equal(f.target.combatCounter.charges, 0);
});

test('only active Defend grants Smash bonus, and stances remain after preparation expiry', () => {
  const f = fixture(); prepare(f);
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier('smash'), [{ amount: 10 }]).amount, 5);
  startTacticalTurn(f.ctx, f.target);
  assert.equal(f.target.combatStance.maneuver, 'counter');
  assert.equal(f.target.combatCounter, undefined);
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier('smash'), [{ amount: 10 }]).amount, 10);
  setCombatStance(f.ctx, f.target, carrier('defend'));
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier('smash'), [{ amount: 10 }]).amount, 15);
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier('sweep', { targeting: 'area' }), [{ amount: 10 }]).amount, 8);
  assert.deepEqual(startTacticalTurn(f.ctx, f.target), { block: 4, barrier: 0 });
  setCombatStance(f.ctx, f.target, carrier('defend', { camp: 'spell' }));
  assert.deepEqual(startTacticalTurn(f.ctx, f.target), { block: 0, barrier: 4 });
});

test('Attack punishes active Smash, support preserves stance and switching cancels preparation', () => {
  const f = fixture(); setCombatStance(f.ctx, f.target, carrier('smash'));
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }]).amount, 10);
  prepare(f);
  prepareTacticalCard(f.ctx, f.target, f.source, carrier('casting', { stanceTrigger: false }), [{ op: 'draw', count: 1 }]);
  assert.equal(f.target.combatStance.maneuver, 'counter');
  setCombatStance(f.ctx, f.target, carrier('attack'));
  assert.equal(f.target.combatCounter, undefined);
});

test('Counter support has no free protection or unprinted return in v2', () => {
  const f = fixture(); const card = carrier('counter');
  const support = prepareTacticalCard(f.ctx, f.target, f.source, card, [{ op: 'draw', count: 1 }]);
  enqueueCounterWard(f.ctx, f.target, card);
  assert.deepEqual(support, [{ op: 'draw', count: 1 }]);
  assert.deepEqual(f.target.combatCounter.payload, { hp: 0, poise: 0, ward: 0 });
  assert.equal(f.queue.length, 0);
});

test('coverage AND filters reject one-target Area; dedicated Area coverage can catch Sweep', () => {
  const f = fixture(); prepare(f);
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier('sweep', { targeting: 'area' }), [{ amount: 8 }]).counterEligible, false);
  const coverage = { camps: ['spell'], schools: ['frost'], reaches: ['far'], targeting: ['area'], effects: ['damage'] };
  assert.equal(counterCoverageMatches(coverage, { camp: 'spell', school: 'fire', reach: 'far', targeting: 'area' }), false);
  assert.equal(counterCoverageMatches(coverage, { camp: 'spell', school: 'frost', reach: 'near', targeting: 'area' }), false);
  assert.equal(counterCoverageMatches(coverage, { camp: 'spell', school: 'frost', reach: 'far', targeting: 'area' }), true);
  prepare(f, {}, { damage: 7, coverage: { camps: ['physical'], reaches: ['contact'], targeting: ['area'], effects: ['damage'] } });
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, carrier('sweep', { targeting: 'area' }), [{ amount: 8 }]).counterEligible, true);
});

test('Piercing pressures Guard rather than universal bypass, Force needs printed Unreflectable', () => {
  for (const damageType of ['piercing', 'force']) {
    const f = fixture(); prepare(f);
    const incoming = carrier('attack', { damageType });
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
    assert.equal(receipt.counterEligible, true);
    assert.equal(receipt.amount, 4);
    absorb(f, receipt); completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
    assert.equal(f.queue.length, damageType === 'piercing' ? 0 : 1);
  }
  const f = fixture(); prepare(f);
  const incoming = carrier('attack', { damageType: 'force', traits: ['unreflectable'] });
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]); absorb(f, receipt);
  assert.deepEqual(completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt), []);
});

test('Connected Lightning interrupts Counter even fully blocked; Grounded preserves it', () => {
  for (const grounded of [false, true]) {
    const f = fixture(); prepare(f, {}, { damage: 7, coverage: { camps: ['spell'], reaches: ['contact'], targeting: ['single'], effects: ['damage'] } });
    if (grounded) f.target.combatTraits = ['grounded'];
    const incoming = carrier('attack', { camp: 'spell', school: 'lightning', damageType: 'lightning' });
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
    recordTacticalContact(receipt, { blocked: 4 });
    completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
    assert.equal(f.queue.length, grounded ? 1 : 0);
  }
});

test('all admitted partial status pressure blocks full reply; Ward-resisted status-only magic qualifies', () => {
  const coverage = { camps: ['spell'], reaches: ['near'], targeting: ['single'], effects: ['damage', 'status'] };
  for (const accepted of [0, 1]) {
    const f = fixture(); f.source.caster = true; prepare(f, { camp: 'spell' }, { coverage, payload: { hp: 3, poise: 2, ward: 1 } });
    const incoming = carrier('casting', { camp: 'spell', reach: 'near' });
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ effect: 'status', pressure: 6, amount: 0 }]);
    recordTacticalStatus(receipt, { acceptedBuildup: accepted, activeAdded: 0, resisted: 6 - accepted, wardSpent: 1 });
    completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
    assert.equal(f.queue.length, accepted ? 0 : 3);
  }
});

test('spell return HP requires visible caster; explicit Ward and Poise return remain', () => {
  const f = fixture(); prepare(f, { camp: 'spell' }, { payload: { hp: 7, poise: 2, ward: 1 } });
  const incoming = carrier('casting', { camp: 'spell' });
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
  recordTacticalContact(receipt, { wardResisted: 8 });
  completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
  assert.deepEqual(f.queue.map(action => [action.effect.op, action.effect.amount]), [['poiseDamage', 2], ['wardDamage', 1]]);
});

test('same-camp covered and uncovered deliveries cannot return when any direct HP leaks', () => {
  const f = fixture(); prepare(f);
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }, { amount: 8, reach: 'near', maneuver: 'ranged' }]);
  assert.equal(receipt.amount, 12);
  assert.deepEqual(receipt.amounts, [6, 6]); // Final budget follows pre-matchup contact proportions.
  recordTacticalContact(receipt, { blocked: 6, hpLoss: 6 });
  assert.deepEqual(completeTacticalAction(f.ctx, f.source, f.target, carrier(), receipt), []);
});

test('mixed-camp actions are rejected before consuming Counter or avoidance RNG', () => {
  const f = fixture(); prepare(f);
  const before = JSON.stringify(f.target);
  assert.throws(() => beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }, { amount: 8, camp: 'spell' }]), /cannot mix/);
  assert.equal(JSON.stringify(f.target), before);
});

test('Counter rounds the whole action before the additive incoming status modifier stage', () => {
  const f = fixture(); prepare(f);
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 6 }, { amount: 7 }], { percent: 35 });
  assert.equal(receipt.amount, 10); // ceil(ceil(13 × .5) × 1.35), contract two-stage order.
  assert.equal(receipt.amounts.reduce((sum, amount) => sum + amount, 0), 10);
});

test('same-camp mixed delivery applies each contact status modifier before the action-wide status rounding', () => {
  const f = fixture();
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }, { amount: 8, reach: 'far' }],
    { contactModifiers: [{ percent: 35 }, { percent: -15 }] });
  assert.equal(receipt.amount, 18); // 8×1.35 + 8×.85 =17.6, rounded once at this stage.
  assert.deepEqual(receipt.amounts, [9, 9]);
});

test('active Grounded preserves Counter against fully blocked Lightning', () => {
  const f = fixture(); f.target.statuses.grounded = { stacks: 1 };
  prepare(f, { camp: 'spell', counterMode: 'spell' }); f.source.combatTraits = { caster: true };
  const incoming = carrier('casting', { camp: 'spell', school: 'lightning' });
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 4 }]);
  assert.equal(receipt.counterBroken, undefined);
  recordTacticalContact(receipt, { wardResisted: 4 });
  assert.equal(completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt).length, 1);
});

test('guaranteed direct-action prevention consumes one Invulnerability, preserves Evade and admits independent pressure', () => {
  const f = fixture(); prepare(f); prepareCombatEvade(f.ctx, f.target);
  f.target.statuses.invulnerability = { stacks: 2 };
  const incoming = carrier();
  assert.equal(previewAvoidance(f.ctx, f.target, incoming.combatProfile, 15).chance, 100);
  assert.equal(f.target.statuses.invulnerability.stacks, 2);
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 7 }, { amount: 8 }, { effect: 'status', pressure: 4 }]);
  assert.equal(receipt.avoided, true); assert.equal(receipt.connected, false);
  assert.equal(receipt.avoidance.prevention, 'invulnerability');
  assert.equal(f.target.statuses.invulnerability.stacks, 1);
  assert.equal(f.target.combatEvade.charges, 1); assert.deepEqual(f.rolls, []);
  recordTacticalStatus(receipt, { acceptedBuildup: 4 });
  assert.equal(receipt.statusAccepted, 4);
  assert.deepEqual(completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt), []);
});

test('Decoy catches only one positive Single Near/Far action, never Area, Contact or status-only', () => {
  for (const [reach, targeting, amount, catches] of [['near', 'single', 8, true], ['far', 'single', 8, true],
    ['near', 'area', 8, false], ['contact', 'single', 8, false], ['far', 'single', 0, false]]) {
    const f = fixture(); f.target.statuses.decoy = { stacks: 1 };
    const incoming = carrier('ranged', { reach, targeting });
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount }]);
    assert.equal(receipt.avoided, catches);
    assert.equal(!!f.target.statuses.decoy, !catches);
    assert.deepEqual(f.rolls, []);
  }
});

test('one successful return budget survives reprepare, finalize replay, and JSON restoration', () => {
  const f = fixture(); prepare(f); const incoming = carrier();
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
  recordTacticalContact(receipt, { blocked: 4 }); completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
  completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
  f.target = JSON.parse(JSON.stringify(f.target)); prepare(f);
  const second = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
  recordTacticalContact(second, { blocked: 4 }); completeTacticalAction(f.ctx, f.source, f.target, incoming, second);
  assert.equal(f.queue.length, 1);
  startTacticalTurn(f.ctx, f.target); prepare(f);
  const third = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]);
  recordTacticalContact(third, { blocked: 4 }); completeTacticalAction(f.ctx, f.source, f.target, incoming, third);
  assert.equal(f.queue.length, 2);
});

test('incapacitation snapshots suppress Counter/Evade; clearing it after impact cannot retroactively reply', () => {
  const f = fixture(); prepare(f); prepareCombatEvade(f.ctx, f.target); f.target.locked = true;
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }]);
  assert.equal(receipt.counterEligible, false); assert.equal(f.rolls.length, 0);
  recordTacticalContact(receipt, { blocked: 8 }); f.target.locked = false;
  assert.deepEqual(completeTacticalAction(f.ctx, f.source, f.target, carrier(), receipt), []);
});

test('a same-action stagger clears pending Counter before full-action finalization', () => {
  const f = fixture(); prepare(f);
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }]);
  recordTacticalContact(receipt, { blocked: 4 });
  setCombatStance(f.ctx, f.target, carrier('attack'));
  assert.deepEqual(completeTacticalAction(f.ctx, f.source, f.target, carrier(), receipt), []);
});

test('distance rolls before Evade, preserves charge on success, and exposes combined32% purely', () => {
  const f = fixture([20]); f.target.armorClass = 'light';
  setCombatStance(f.ctx, f.target, carrier('ranged', { reach: 'near' })); prepareCombatEvade(f.ctx, f.target);
  const preview = previewAvoidance(f.ctx, f.target, carrier().combatProfile, 9);
  assert.equal(preview.distance.chance, 20); assert.equal(preview.evade.chance, 15); assert.equal(preview.chance, 32);
  assert.equal(f.rolls.length, 0);
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 9 }]);
  assert.equal(receipt.avoided, true); assert.equal(f.target.combatEvade.charges, 1);
  assert.deepEqual(f.rolls.map(roll => roll.max), [100]);
});

test('distance failure permits one action-wide Evade, strict tie fails, high DC has no natural20 floor', () => {
  for (const [damage, dice, avoided] of [[8, [100, 17], false], [8, [100, 18], true], [30, [100, 20], false]]) {
    const f = fixture(dice); setCombatStance(f.ctx, f.target, carrier('ranged', { reach: 'near' })); prepareCombatEvade(f.ctx, f.target);
    const receipt = beginTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: damage / 2 }, { amount: damage / 2 }]);
    assert.equal(receipt.avoided, avoided); assert.equal(f.target.combatEvade.charges, 0);
    assert.equal(f.rolls.length, 2);
    beginTacticalAction(f.ctx, f.source, f.target, carrier(), [], { receipt }); assert.equal(f.rolls.length, 2);
  }
});

test('Advantage chooses high d20 / low d100; Disadvantage reverses and both cancel', () => {
  assert.equal(effectiveChance(15, { advantage: true }).toFixed(2), '27.75');
  assert.equal(effectiveChance(15, { disadvantage: true }).toFixed(2), '2.25');
  for (const [die, flags, want] of [[20, { advantage: true }, 17], [20, { disadvantage: true }, 4],
    [100, { advantage: true }, 4], [100, { disadvantage: true }, 17], [20, { advantage: true, disadvantage: true }, 4]]) {
    const f = fixture([4, 17]); const result = rollChanceDie(f.ctx.rng, die, flags);
    assert.equal(result.roll, want); assert.equal(result.dice.length, flags.advantage && flags.disadvantage ? 1 : 2);
  }
});

test('school edges modify only explicitly selected printed effect and weakness wins', () => {
  const f = fixture(); prepare(f, { school: 'fire', schoolEffect: 'poise' }, { payload: { hp: 7, poise: 8, ward: 4 } });
  const incoming = carrier('attack', { school: 'frost', damageType: 'blunt' });
  const receipt = beginTacticalAction(f.ctx, f.source, f.target, incoming, [{ amount: 8 }]); recordTacticalContact(receipt, { blocked: 4 });
  completeTacticalAction(f.ctx, f.source, f.target, incoming, receipt);
  assert.deepEqual(f.queue.map(action => action.effect.amount), [7, 6, 4]);
});

test('Spell Piercing does not borrow Martial Guard bypass and Counter Ward uses one fractional edge', () => {
  const f = fixture();
  const spell = carrier('casting', { camp: 'spell', school: 'lightning', damageType: 'piercing', reach: 'near' });
  assert.equal(previewTacticalAction(f.ctx, f.source, f.target, spell, [{ amount: 4 }]).guardBypass, 0);
  for (const [incomingType, expected] of [['slashing', 2.5], ['blunt', 1.5]]) {
    const row = fixture();
    const counter = carrier('counter', { camp: 'spell', school: 'fire', schoolEffect: 'ward', damageType: 'piercing' });
    setCombatStance(row.ctx, row.target, counter);
    armCombatCounter(row.ctx, row.target, counter, { payload: { ward: 2 },
      coverage: { camps: ['spell'], reaches: ['near'], targeting: ['single'], effects: ['damage'] } });
    const incoming = carrier('casting', { camp: 'spell', school: 'frost', damageType: incomingType, reach: 'near' });
    const receipt = beginTacticalAction(row.ctx, row.source, row.target, incoming, [{ amount: 4 }]);
    recordTacticalContact(receipt, { wardResisted: 4 });
    completeTacticalAction(row.ctx, row.source, row.target, incoming, receipt);
    assert.equal(row.queue[0].effect.amount, expected);
    assert.equal(row.queue[0].card.combatWardEdgeApplied, true);
  }
});

test('co-op receipt identity belongs to seat, not duplicate player entity ids', () => {
  const f = fixture(); const other = { ...f.target, attributes: { dexterity: 10, wisdom: 3, intelligence: 4 } };
  f.ctx.playerIdForEntity = entity => entity === other ? 'seat-b' : entity === f.target ? 'seat-a' : null;
  prepareCombatEvade(f.ctx, f.target); prepareCombatEvade(f.ctx, other);
  const a = previewTacticalAction(f.ctx, f.source, f.target, carrier(), [{ amount: 8 }]);
  const b = previewTacticalAction(f.ctx, f.source, other, carrier(), [{ amount: 8 }]);
  assert.equal(a.targetKey, 'seat-a'); assert.equal(b.targetKey, 'seat-b');
  assert.notEqual(a.avoidance.evade.bonus, b.avoidance.evade.bonus);
});

test('authoring preserves explicit coverage/payload/Evade fields and adds reach/targeting chips', () => {
  const def = { id: 'example', tags: ['camp:physical', 'maneuver:counter', 'reach:far', 'targeting:area', 'trait:projectile'],
    counterCoverage: { camps: ['physical'], reaches: ['far'], targeting: ['area'], effects: ['damage'] },
    counterPayload: { poise: 5 }, evade: { charges: 1, bonus: 2 } };
  const card = tacticalCarrier(def);
  assert.equal(card.combatProfile.reach, 'far'); assert.equal(card.combatProfile.targeting, 'area');
  assert.deepEqual(card.combatProfile.counterCoverage, def.counterCoverage);
  assert.deepEqual(card.combatProfile.evade, def.evade);
});

test('version2 tactical snapshots and tuning validate strictly while legacy counter retains1-only rule', () => {
  const f = fixture(); prepare(f); prepareCombatEvade(f.ctx, f.target);
  assert.deepEqual(combatExpansionEntityProblems(f.target), []);
  assert.deepEqual(combatExpansionMatchupRulesProblems(structuredClone(combatExpansionMatchups)), []);
  f.target.combatCounter.charges = 0;
  assert.deepEqual(combatCounterProblems(f.target.combatCounter, 'counter', 2), []);
  assert.deepEqual(combatCounterProblems(f.target.combatCounter, 'counter'), []);
  assert.ok(combatCounterProblems({ charges: 0, mode: 'melee', damage: 5, poiseDamage: 0, bonus: 0,
    carrier: carrier('counter') }, 'counter').some(problem => problem.includes('charges must be 1')));
  for (const change of [entity => entity.combatCounter.payload.hp = Infinity, entity => entity.combatStance.reach = 'elsewhere',
    entity => entity.combatEvade.bonus = NaN, entity => entity.combatCounter.coverage.targeting = ['unknown'],
    entity => entity.combatCounter.serial++]) {
    const invalid = structuredClone(f.target); change(invalid); assert.ok(combatExpansionEntityProblems(invalid).length > 0);
  }
});
