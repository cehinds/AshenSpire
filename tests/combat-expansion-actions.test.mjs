import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { resolveCombatRatings } from '../src/model/combatRatings.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction } from '../src/engine/combatExpansionActions.js';
import { executeAction, applyAttackDamage, restoreExpandedWard, gainBarrier, syncWardMaximum } from '../src/engine/actions.js';
import { schoolResistanceMultiplier, persistentWardMaximum, persistentPoiseMaximum } from '../src/model/combatRatings.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { applyStatus, advanceStatusClock, decayAtTurnEnd } from '../src/engine/statuses.js';
import { restorePersistentPoise } from '../src/engine/combatStatusControl.js';
import { syncPoiseMaximum } from '../src/engine/combatPools.js';
import { combatRules as combatRulesBundle } from '../src/content/combatRules.js';

const drainQueue = combat => { while (combat.queue.length) executeAction(combat, combat.queue.shift()); };

// magicShare (optional) stamps the pebble's own share: 1 makes the Ward tests below a magic hit, as they were written.
function fixture(effects = [{ op: 'damage', target: 'enemy', amount: 5, hits: 2 }], { statuses = contentBundle.statuses, ruleset = null, magicShare = undefined } = {}) {
  const registries = createRegistries({ ...contentBundle, statuses, cards: contentBundle.cards.map(card => card.id === 'starstonePebble'
    ? { ...card, effects, cost: 0, manaCost: 0, upgrade: undefined, ...(magicShare === undefined ? {} : { magicShare }) } : card) });
  const combat = createCombat({ registries, rng: createRng(801), combatExpansionVersion: 2, ...(ruleset ? { ruleset } : {}),
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'starstonePebble', instanceId: 'paired', upgraded: false }] } });
  const enemy = combat.enemies[0]; enemy.block = enemy.barrier = 0;
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 100, ward: 3 };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  enemy.persistentWard.value = enemy.persistentWard.max = 3;
  return { combat, enemy, registries };
}

test('whole Spell action applies persistent Ward once across hits, spends it, and preview matches the committed budget', () => {
  const { combat, enemy } = fixture(undefined, { magicShare: 1 });
  const counters = combat.rng.getCounters();
  const preview = previewCard(combat, 'paired', enemy.id);
  assert.deepEqual(combat.rng.getCounters(), counters, 'preview consumes no streams');
  const value = preview.values.find(row => row.op === 'damage').totalDamage;
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  assert.equal(before - enemy.hp, value);
  assert.equal(damage.reduce((sum, event) => sum + event.wardResisted, 0), 3);
  assert.equal(enemy.persistentWard.value, 0, 'Ward is spent by the damage it absorbs');
});

// Was: the same blunt Spell action spent Ward (wardResisted 3, Ward 0). The damage type decides the route now:
// the blunt part is physical, so Ward is not touched and the hit lands on HP.
test('a blunt Spell action (physical damage type) leaves Ward alone and routes its damage through Block and HP', () => {
  const { combat, enemy } = fixture();
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  assert.equal(damage.reduce((sum, event) => sum + (event.wardResisted || 0), 0), 0, 'no Ward is resisted');
  assert.equal(enemy.persistentWard.value, 3, 'Ward stays 3');
  assert.ok(before - enemy.hp > 0, 'the hit lands on HP');
});

test('paused action receipts are interned after JSON restore and finish without repeating a charge or roll', () => {
  const { combat, enemy, registries } = fixture();
  const carrier = { cardId: 'starstonePebble', tags: ['camp:spell', 'maneuver:casting'],
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'force', damageType: 'blunt', reach: 'near', targeting: 'single' } };
  const actions = [1, 2].map(() => ({ effect: { op: 'damage', target: 'enemy', amount: 2 }, source: combat.player, owner: combat.player, target: enemy, card: carrier, meta: {} }));
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier });
  combat.pendingAbilityDiscard = { count: 1 };
  combat.pendingAbilityPlay = { instance: { instanceId: 'paid', cardId: 'starstonePebble', upgraded: false }, ref: carrier };
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  assert.equal(restored.queue[0].meta.expansionGroup, restored.queue[1].meta.expansionGroup);
  assert.equal(restored.queue[0].meta.expansionGroup, restored.queue[2].meta.expansionGroup);
  assert.equal(restored.pendingExpansionActions, 1);
  delete restored.pendingAbilityDiscard;
  drainQueue(restored);
  assert.equal(restored.pendingExpansionActions, 0);
});

test('next-roll advantage and Retain hooks use saved finite owner budgets', () => {
  const { combat } = fixture([]);
  combat.enqueue({ effect: { op: 'grantRollMode', target: 'self', roll: 'evade', advantage: true }, source: combat.player, target: combat.player });
  combat.enqueue({ effect: { op: 'retain', amount: 1 }, source: combat.player, owner: combat.player });
  drainQueue(combat);
  assert.equal(combat.player.nextEvadeMode.advantage, true);
  assert.deepEqual(combat.player.combatRetainedCards, ['paired']);
  assert.equal(serializeCombatSnapshot(combat).player.nextEvadeMode.advantage, true);
});


test('mixed Martial and Spell contacts are refused before planning or spending randomness', () => {
  const { combat, enemy } = fixture([]);
  const before = { counters: combat.rng.getCounters(), serial: combat.expansionActionSerial, queue: combat.queue.length };
  const carrier = { cardId: 'starstonePebble', combatProfile: { camp: 'spell', maneuver: 'casting', reach: 'near', targeting: 'single' } };
  assert.throws(() => enqueueExpandedAction(combat, [{ effect: { op: 'damage', target: 'enemy', amount: 5,
    combatProfile: { camp: 'physical' } }, source: combat.player, target: enemy, card: carrier }],
    { source: combat.player, target: enemy, carrier }), /camp|Martial|Spell/i);
  assert.deepEqual(combat.rng.getCounters(), before.counters);
  assert.equal(combat.expansionActionSerial, before.serial);
  assert.equal(combat.queue.length, before.queue);
});

test('expanded critical hits multiply once and still announce the original multiplier', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 5, tags: ['testCritical'] }]);
  combat.player.critRules = [{ tags: ['testCritical'], base: 1, cap: 1, multiplier: 2 }];
  enemy.persistentWard.value = 0;
  // A physical hit meets Poise now; this test is about the multiplier, so the enemy has none.
  enemy.ratings.poise = 0; enemy.persistentPoise = { max: 0, value: 0 };
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  assert.equal(before - enemy.hp, 10);
  assert.equal(out.events.filter(event => event.type === 'critHit').length, 1);
  assert.equal(out.events.find(event => event.type === 'critHit').multiplier, 2);
});


test('un-aimed card faces show offense while target inspection shows Ward mitigation down to 1', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 5 }]);
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 20;
  const unAimed = previewCard(combat, 'paired');
  const aimed = previewCard(combat, 'paired', enemy.id);
  const row = unAimed.values.find(value => value.op === 'damage');
  assert.equal(unAimed.tokens[row.token], 5);
  assert.equal(row.perTarget[enemy.id], 1, 'Ward always lets at least 1 damage through');
  assert.equal(aimed.tokens[row.token], 1);
});

test('a physical hit skips Ward: Block soaks, then Health', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 4;
  enemy.ratings.poise = 0; enemy.persistentPoise = { max: 0, value: 0 }; enemy.block = 3; enemy.barrier = 5;
  const carrier = { cardId: 'strike', damageSchool: 'physical', tags: ['camp:physical', 'maneuver:attack'],
    combatProfile: { camp: 'physical', maneuver: 'attack', school: 'physical', damageType: 'slashing', reach: 'contact', targeting: 'single' } };
  const before = enemy.hp;
  const amount = applyAttackDamage(combat, combat.player, enemy, 10, [], carrier);
  assert.equal(amount, 10);
  assert.equal(enemy.persistentWard.value, 4, 'Ward guards against magic only');
  assert.equal(enemy.barrier, 5, 'Barrier guards against magic only');
  assert.equal(enemy.block, 0);
  assert.equal(before - enemy.hp, 7);
});

test("owner's example: Barrier soaks first and breaks, Ward lets max(5 - 3, 1) through and breaks", () => {
  const { combat } = fixture();
  const mage = combat.player;
  mage.ratings = { ...mage.ratings, ward: 3 };
  mage.persistentWard.max = mage.persistentWard.value = 3;
  mage.block = 0; mage.barrier = 0;
  gainBarrier(combat, mage, 6, { skipRatingBonus: true });
  assert.equal(mage.persistentWard.value, 3); assert.equal(mage.barrier, 6, 'Ward was full: all 6 become Barrier (9 total)');
  const events = []; const emit = combat.emit; combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit.call(combat, type, payload); };
  const loss = mage.pendingActionLoss || 0;
  const spell = { cardId: 'starstonePebble', damageSchool: 'fire', tags: ['camp:spell', 'maneuver:casting'],
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', reach: 'near', targeting: 'single' } };
  const before = mage.hp;
  applyAttackDamage(combat, combat.enemies[0], mage, 11, [], spell);
  assert.equal(mage.barrier, 0); assert.equal(mage.persistentWard.value, 0);
  assert.equal(before - mage.hp, 2);
  assert.ok(events.some(e => e.type === 'barrierBroken')); assert.ok(events.some(e => e.type === 'wardBroken'));
  const hit = events.find(e => e.type === 'damageDealt');
  assert.equal(hit.barrierAbsorbed, 6); assert.equal(hit.wardAbsorbed, 3);
  assert.equal(mage.pendingActionLoss, loss + 1, 'a Ward break costs Stamina next turn');
});

test('a resistant creature takes floor(0.75 × damage) by default, configurable down to 0.5', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.persistentWard.value = enemy.persistentWard.max = 0;
  enemy.damageResistanceBySchool = { magic: 10 };
  assert.equal(schoolResistanceMultiplier(combat, enemy, 'magic'), 0.75);
  assert.equal(schoolResistanceMultiplier(combat, enemy, 'fire'), 1);
  assert.equal(schoolResistanceMultiplier({ ratingsRules: { resistance: { schoolTaken: 0.5 } } }, enemy, 'magic'), 0.5);
  assert.equal(schoolResistanceMultiplier({ ratingsRules: { resistance: { schoolTaken: 0.01 } } }, enemy, 'magic'), 0.1, 'never past 90% resistance');
});

test('a combatant starts every fight with its full Ward (configurable share)', () => {
  assert.equal(persistentWardMaximum({}, { ratings: { ward: 25 } }), 25);
  assert.equal(persistentWardMaximum({ ratingsRules: { resistance: { wardPool: 0.5 } } }, { ratings: { ward: 25 } }), 12);
});

test('a card that adds Ward refills it first; the rest becomes Barrier', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 5 }]);
  enemy.ratings.ward = enemy.persistentWard.max = 10; enemy.persistentWard.value = 7; enemy.barrier = 0;
  assert.equal(restoreExpandedWard(combat, enemy, 5).barrier, 2);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 10, value: 10 });
  assert.equal(enemy.barrier, 2);
});

test('a buff that raises the Ward rating raises the Ward maximum and current Ward with it', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 6;
  syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 6, value: 6 });
  enemy.ratings.ward = 2;
  syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 2, value: 2 });
});

test('a rating swing keeps the missing Ward fixed: a dip and recovery cannot refill a damaged pool', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 10; enemy.persistentWard = { max: 10, value: 2 };
  enemy.ratings.ward = 3; syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 3, value: 0, missing: 8 }, 'the dip clamps the value and keeps the 8 missing');
  enemy.ratings.ward = 10; syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 10, value: 2 }, 'recovery restores the same missing, not a full pool');
});

test('a restore against a missing Ward fills the missing amount, and Barrier overflows only once missing reaches 0', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 10; enemy.persistentWard = { max: 10, value: 2 }; enemy.barrier = 0;
  enemy.ratings.ward = 3; syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 3, value: 0, missing: 8 });
  restoreExpandedWard(combat, enemy, 2, { modifierPercent: 0 });
  assert.deepEqual({ ...enemy.persistentWard }, { max: 3, value: 0, missing: 6 }, 'the card restores 2 of the 8 missing, not up to max');
  assert.equal(enemy.barrier, 0, 'no Barrier while missing is above max');
  enemy.ratings.ward = 10; syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 10, value: 4 }, 'recovery returns the pool to 4 of 10');
  const overflow = restoreExpandedWard(combat, enemy, 8, { modifierPercent: 0 });
  assert.deepEqual({ ...enemy.persistentWard }, { max: 10, value: 10 });
  assert.equal(overflow.barrier, 2, 'the part past the 6 missing becomes Barrier');
  assert.equal(enemy.barrier, 2);
});

test('a card that closes the missing Ward sends only the rest past it to Barrier', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 10; enemy.persistentWard = { max: 10, value: 2 }; enemy.barrier = 0;
  enemy.ratings.ward = 3; syncWardMaximum(combat, enemy);
  const out = restoreExpandedWard(combat, enemy, 10, { modifierPercent: 0 });
  assert.deepEqual({ ...enemy.persistentWard }, { max: 3, value: 3 }, 'missing 8 is closed; the pool fills to its max');
  assert.equal(out.barrier, 2);
  assert.equal(enemy.barrier, 2);
});

test('a magical Barrier gain refills Ward first and only the overflow becomes Barrier', () => {
  const { combat, enemy } = fixture();
  enemy.persistentWard = { max: 3, value: 1 }; enemy.barrier = 0;
  const spell = { cardId: 'starstonePebble', damageSchool: 'fire', tags: ['camp:spell', 'maneuver:casting'],
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', reach: 'near', targeting: 'single' } };
  gainBarrier(combat, enemy, 6, spell);
  assert.equal(enemy.persistentWard.value, 3, 'Ward is refilled to full first');
  assert.equal(enemy.barrier, 4, 'the other 4 become Barrier');
});

test('a non-magical Barrier gain adds Barrier alone and leaves Ward alone', () => {
  const { combat, enemy } = fixture();
  enemy.persistentWard = { max: 3, value: 1 }; enemy.barrier = 0;
  gainBarrier(combat, enemy, 6, { skipRatingBonus: true });
  assert.equal(enemy.persistentWard.value, 1, 'a non-magic source does not refill Ward');
  assert.equal(enemy.barrier, 6);
});

test('a mana-costing skill that is not a Spell adds Barrier alone, even though it is magical', () => {
  const { combat, enemy } = fixture();
  enemy.persistentWard = { max: 3, value: 1 }; enemy.barrier = 0;
  const skill = { cardId: 'starstonePebble', manaCost: 2, skipRatingBonus: true, tags: ['maneuver:casting'],
    combatProfile: { camp: 'physical', maneuver: 'casting', school: 'arcane', damageType: 'blunt', reach: 'near', targeting: 'single' } };
  assert.equal(gainBarrier(combat, enemy, 6, skill), 6);
  assert.equal(enemy.persistentWard.value, 1, 'a non-Spell source does not refill Ward');
  assert.equal(enemy.barrier, 6);
});

test('a Spell card refills Ward first and gainBarrier returns the Ward refill plus the Barrier overflow', () => {
  const { combat, enemy } = fixture();
  enemy.persistentWard = { max: 3, value: 1 }; enemy.barrier = 0;
  const spellByTag = { cardId: 'starstonePebble', skipRatingBonus: true, tags: ['camp:spell'] };
  assert.equal(gainBarrier(combat, enemy, 6, spellByTag), 6, 'granted: 2 into Ward, 4 into Barrier');
  assert.equal(enemy.persistentWard.value, 3);
  assert.equal(enemy.barrier, 4);
});

test('Barrier is consumed hit by hit: the first hit is fully stopped, the second meets Ward', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 5; enemy.persistentWard = { max: 5, value: 5 };
  enemy.block = 0; enemy.barrier = 5;
  const carrier = { cardId: 'starstonePebble', damageSchool: 'fire', tags: ['camp:spell', 'maneuver:casting'],
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', reach: 'near', targeting: 'single' } };
  const actions = [1, 2].map(() => ({ effect: { op: 'damage', target: 'enemy', amount: 5 }, source: combat.player, owner: combat.player, target: enemy, card: carrier, meta: {} }));
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier });
  const hits = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { if (type === 'damageDealt' && payload.targetId === enemy.id) hits.push(payload); return emit.call(combat, type, payload); };
  const before = enemy.hp;
  drainQueue(combat);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].amount, 0, 'Barrier stops the first hit outright');
  assert.equal(hits[0].barrierAbsorbed, 5);
  assert.equal(hits[1].wardAbsorbed, 4, 'the second hit meets Ward 5 and spends 4 of it');
  assert.equal(before - enemy.hp, 1, 'the second hit lets 1 through');
  assert.equal(enemy.persistentWard.value, 1);
});

test('a planned Spell hit does not absorb Ward a rider spent before it lands', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = enemy.persistentWard.max = enemy.persistentWard.value = 4;
  enemy.block = 0; enemy.barrier = 0;
  const carrier = { cardId: 'starstonePebble', damageSchool: 'fire', tags: ['camp:spell', 'maneuver:casting'],
    combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', reach: 'near', targeting: 'single' } };
  const actions = [1, 2].map(() => ({ effect: { op: 'damage', target: 'enemy', amount: 5 }, source: combat.player, owner: combat.player, target: enemy, card: carrier, meta: {} }));
  enqueueExpandedAction(combat, actions, { source: combat.player, target: enemy, carrier });
  const hits = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => {
    const out = emit.call(combat, type, payload);
    if (type === 'damageDealt' && payload.targetId === enemy.id) {
      hits.push(payload);
      // A rider empties Ward between the two hits; the second hit's planned share is not there.
      if (hits.length === 1) enemy.persistentWard.value = 0;
    }
    return out;
  };
  const before = enemy.hp;
  drainQueue(combat);
  assert.equal(hits.length, 2);
  assert.equal(hits[1].wardAbsorbed ?? 0, 0, 'the second hit absorbs no Ward that is not there');
  assert.equal(hits[1].amount, 5, 'its planned Ward share goes back into the hit');
  assert.equal(before - enemy.hp, 3 + 5, 'the first hit loses 3 and the second loses all 5');
});

test('a status with a Ward bonus moves the Ward pool as soon as it is applied', () => {
  const { combat, enemy } = fixture();
  combat.ratingsRules = { bonuses: { 'status:bleeding': { ward: 2 } } };
  enemy.ratings.ward = 3; enemy.persistentWard = { max: 3, value: 3 };
  applyStatus(combat, enemy, 'bleeding', 1, null);

  assert.deepEqual({ ...enemy.persistentWard }, { max: 5, value: 5 }, 'the pool follows the status without a later sync');
});

test('a Ward bonus stack that decays at turn end lowers the Ward maximum at once', () => {
  const { combat, enemy } = fixture();
  combat.ratingsRules = { bonuses: { 'status:weak': { ward: 2 } } };
  enemy.ratings.ward = 3; enemy.persistentWard = { max: 3, value: 3 };
  applyStatus(combat, enemy, 'weak', 2, null);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 7, value: 7 }, 'two stacks add 4 to the pool');
  decayAtTurnEnd(combat, enemy);
  assert.equal(enemy.statuses.weak.stacks, 1);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 5, value: 5 }, 'the decayed stack lowers the maximum without a later sync');
});

test('one expiring timed application lowers a Ward bonus maximum at once', () => {
  // Two applications from different sources: one expires on its own clock while the other survives.
  const timed = { id: 'timedWard', name: 'Timed Ward', icon: '◎', stackMode: 'add', decay: 'none',
    stacking: { mode: 'independent', cap: 99, duration: 3, clock: 'ownerTurnEnd' } };
  const { combat, enemy, player } = fixture([{ op: 'damage', target: 'enemy', amount: 5, hits: 2 }],
    { statuses: [...contentBundle.statuses, timed], ruleset: combatRulesBundle });
  const other = { id: 'otherSource', kind: 'player', alive: true };
  combat.ratingsRules = { bonuses: { 'status:timedWard': { ward: 2 } } };
  enemy.ratings.ward = 3; enemy.persistentWard = { max: 3, value: 3 };
  applyStatus(combat, enemy, 'timedWard', 1, player);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 5, value: 5 });
  advanceStatusClock(combat, enemy, 'ownerTurnEnd');
  applyStatus(combat, enemy, 'timedWard', 1, other);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 7, value: 7 }, 'two applications add 4 to the pool');
  advanceStatusClock(combat, enemy, 'ownerTurnEnd');
  advanceStatusClock(combat, enemy, 'ownerTurnEnd');
  assert.equal(enemy.statuses.timedWard.stacks, 1, 'the first application has expired; the second survives');
  assert.deepEqual({ ...enemy.persistentWard }, { max: 5, value: 5 }, 'the expired application lowers the maximum without a later sync');
});

test('a rise from a full Ward pool adds the same amount to current Ward', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.ward = 10; enemy.persistentWard = { max: 10, value: 10 };
  enemy.ratings.ward = 13; syncWardMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentWard }, { max: 13, value: 13 });
});

test('each hit Ward meets still lets at least 1 damage through', () => {
  const { combat, enemy } = fixture(undefined, { magicShare: 1 });
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 20;
  const before = enemy.hp;
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'paired', targetId: enemy.id });
  const damage = out.events.filter(event => event.type === 'damageDealt' && event.targetId === enemy.id);
  assert.deepEqual(damage.map(event => event.amount), [1, 1]);
  assert.equal(before - enemy.hp, 2);
  assert.equal(enemy.persistentWard.value, 12, 'Ward is spent only by the 8 it absorbed');
});

const physicalCarrier = () => ({ cardId: 'strike', damageSchool: 'physical', tags: ['camp:physical', 'maneuver:attack'],
  combatProfile: { camp: 'physical', maneuver: 'attack', school: 'physical', damageType: 'slashing', reach: 'contact', targeting: 'single' } });
const magicCarrier = () => ({ cardId: 'starstonePebble', damageSchool: 'fire', tags: ['camp:spell', 'maneuver:casting'],
  combatProfile: { camp: 'spell', maneuver: 'casting', school: 'fire', damageType: 'fire', reach: 'near', targeting: 'single' } });
function captureEvents(combat) {
  const events = []; const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit.call(combat, type, payload); };
  return events;
}

test('Poise is the physical twin of Ward: Block soaks, Poise absorbs and breaks, the enemy is staggered after the hit', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 0;
  enemy.ratings.poise = 4; enemy.persistentPoise = { max: 4, value: 4 };
  enemy.block = 3; enemy.barrier = 0;
  const events = captureEvents(combat);
  const before = enemy.hp;
  applyAttackDamage(combat, combat.player, enemy, 10, [], physicalCarrier());
  assert.equal(enemy.block, 0, 'Block soaks 3 first');
  assert.equal(enemy.persistentPoise.value, 0, 'Poise absorbs the 4 that reach it and breaks');
  assert.equal(before - enemy.hp, 3, 'HP loss is the 3 that passed both');
  assert.equal(enemy.skipNextTurn, true, 'the enemy is staggered');
  const types = events.map(event => event.type);
  const dealt = events.find(event => event.type === 'damageDealt');
  assert.equal(dealt.poiseAbsorbed, 4); assert.equal(dealt.poiseRemaining, 0);
  assert.equal(dealt.amount, 6, 'amount is what the hit did after Poise: 10 less the 4 Poise took');
  assert.ok(types.indexOf('poiseBroken') > types.indexOf('damageDealt'), 'the break is reported after the hit');
  assert.ok(types.includes('enemyStaggered'));
});

test('Poise lets at least 1 damage through per physical hit it meets, and is spent by what it absorbs', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 3 }]);
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 0;
  enemy.ratings.poise = 10; enemy.persistentPoise = { max: 10, value: 10 };
  enemy.block = 0; enemy.barrier = 0;
  const before = enemy.hp;
  applyAttackDamage(combat, combat.player, enemy, 3, [], physicalCarrier());
  assert.equal(before - enemy.hp, 1);
  assert.equal(enemy.persistentPoise.value, 8);
});

test('a Smash that breaks the last Block marks its blockBroken smash; a plain attack breaking Block does not', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 0;
  enemy.ratings.poise = 0; enemy.persistentPoise = { max: 0, value: 0 };
  enemy.combatStance = { maneuver: 'defend' };
  const physical = physicalCarrier();
  const smash = { ...physical, tags: ['camp:physical', 'maneuver:smash'], combatProfile: { ...physical.combatProfile, maneuver: 'smash' } };
  enemy.block = 3; enemy.barrier = 0;
  let events = captureEvents(combat);
  applyAttackDamage(combat, combat.player, enemy, 10, [], smash);
  assert.equal(enemy.block, 0, 'the Smash breaks the last Block');
  assert.equal(events.find(event => event.type === 'blockBroken').smash, true);
  enemy.combatStance = null; enemy.block = 3; enemy.hp = enemy.maxHp;
  events = captureEvents(combat);
  applyAttackDamage(combat, combat.player, enemy, 10, [], physical);
  assert.equal(events.find(event => event.type === 'blockBroken').smash, undefined, 'an ordinary break is not a Smash');
});

test('a physical Poise break costs a player one Stamina next turn and staggers nobody', () => {
  const { combat, enemy } = fixture();
  const mage = combat.player;
  mage.ratings = { ...mage.ratings, poise: 2, ward: 0 };
  mage.persistentWard = { max: 0, value: 0 };
  mage.persistentPoise = { max: 2, value: 2 }; mage.block = 0; mage.barrier = 0; mage.pendingActionLoss = 0;
  const events = captureEvents(combat);
  applyAttackDamage(combat, enemy, mage, 5, [], physicalCarrier());
  assert.equal(mage.persistentPoise.value, 0);
  assert.equal(mage.pendingActionLoss, 1, 'a Poise break costs one Stamina next turn');
  const broke = events.find(event => event.type === 'poiseBroken');
  assert.equal(broke.staminaLoss, 1);
  assert.equal(events.some(event => event.type === 'playerStaggered'), false, 'a player is not staggered by Poise');
});

test('a restorePoise op refills a clamped Poise pool against its missing amount, with no Barrier overflow', () => {
  const { combat, enemy } = fixture();
  enemy.ratings.poise = 10; enemy.persistentPoise = { max: 10, value: 2 }; enemy.barrier = 0;
  enemy.ratings.poise = 3; syncPoiseMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentPoise }, { max: 3, value: 0, missing: 8 });
  executeAction(combat, { effect: { op: 'restorePoise', target: 'enemy', amount: 2 }, source: combat.player, owner: combat.player, target: enemy, card: null, meta: {} });
  assert.deepEqual({ ...enemy.persistentPoise }, { max: 3, value: 0, missing: 6 }, 'the restore closes 2 of the 8 missing, not up to max');
  enemy.ratings.poise = 10; syncPoiseMaximum(combat, enemy);
  assert.deepEqual({ ...enemy.persistentPoise }, { max: 10, value: 4 }, 'recovery returns the pool to 4 of 10');
  executeAction(combat, { effect: { op: 'restorePoise', target: 'enemy', amount: 8 }, source: combat.player, owner: combat.player, target: enemy, card: null, meta: {} });
  assert.deepEqual({ ...enemy.persistentPoise }, { max: 10, value: 10 }, 'the restore fills to max');
  assert.equal(enemy.barrier, 0, 'Poise never overflows into Barrier');
});

test('restorePersistentPoise honours a once-per-combat key and never restores a full pool', () => {
  const { combat, enemy } = fixture();
  enemy.persistentPoise = { max: 4, value: 1 };
  const first = restorePersistentPoise(combat, enemy, 2, { onceKey: 'rite' });
  assert.equal(first.restored, 2); assert.equal(enemy.persistentPoise.value, 3);
  const again = restorePersistentPoise(combat, enemy, 2, { onceKey: 'rite' });
  assert.equal(again.restored, 0, 'the once key is spent for the fight');
  restorePersistentPoise(combat, enemy, 5, { modifierPercent: 0 });
  assert.deepEqual({ ...enemy.persistentPoise }, { max: 4, value: 4 });
  assert.equal(restorePersistentPoise(combat, enemy, 3).restored, 0, 'a full pool takes nothing');
});

test('an older save with Ward and no Poise restores with a full Poise pool; a newer save keeps its Poise', () => {
  const { combat, enemy, registries } = fixture();
  enemy.ratings.poise = 4; enemy.persistentPoise = { max: 4, value: 1 };
  const restore = saved => restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot: saved });
  const kept = restore(JSON.parse(JSON.stringify(serializeCombatSnapshot(combat))));
  assert.equal(kept.enemies[0].persistentPoise.value, 1, 'a save that has Poise keeps its value');
  const old = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  delete old.enemies[0].persistentPoise;
  const restored = restore(old);
  const back = restored.enemies[0];
  assert.ok(back.persistentWard, 'the combatant is still expanded');
  assert.deepEqual({ ...back.persistentPoise }, { max: persistentPoiseMaximum(restored, back), value: persistentPoiseMaximum(restored, back) },
    'the missing Poise pool starts full at the Poise maximum');
  assert.ok(back.persistentPoise.max > 0);
});

test('a magical hit leaves Poise untouched', () => {
  const { combat, enemy } = fixture([{ op: 'damage', target: 'enemy', amount: 10 }]);
  enemy.ratings.ward = enemy.persistentWard.value = enemy.persistentWard.max = 0;
  enemy.ratings.poise = 4; enemy.persistentPoise = { max: 4, value: 4 };
  enemy.block = 0; enemy.barrier = 0;
  applyAttackDamage(combat, combat.player, enemy, 10, [], magicCarrier());
  assert.equal(enemy.persistentPoise.value, 4, 'Poise guards against physical hits only');
});

test('a spell status pressure that spends the last Ward point breaks Ward: one event, one Stamina for a player', async () => {
  const Control = await import('../src/engine/combatStatusControl.js');
  const { combat, enemy } = fixture();
  const mage = combat.player;
  mage.persistentWard = { max: 1, value: 1 }; mage.pendingActionLoss = 0;
  const events = captureEvents(combat);
  // frost is a Spell status: its buildup spends Ward before it can land.
  Control.applyStatusPressure(combat, mage, 'frost', 10, enemy, { camp: 'spell' });
  assert.equal(mage.persistentWard.value, 0);
  assert.equal(mage.pendingActionLoss, 1, 'a player pays one Stamina next turn');
  const broke = events.filter(event => event.type === 'wardBroken');
  assert.equal(broke.length, 1);
  assert.equal(broke[0].staminaLoss, 1);
});

// A gainWard card restores the same amount it previews: the base plus the card's rating bonus (Attune, PR 10: 1 + 10).
test('an expanded gainWard restores exactly the Ward its preview shows, rating bonus included', () => {
  const registries = createRegistries(contentBundle);
  const ratingsRules = { ...resolveCombatRatings({}, contentBundle), enabled: true };
  const combat = createCombat({ registries, rng: createRng(811), combatExpansionVersion: 2, ratingsRules,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1,
      deck: [{ cardId: 'attune', instanceId: 'attune-1', upgraded: false }] } });
  const player = combat.player;
  player.ratings = { ar: 0, dr: 0, pr: 10, poise: 0, ward: 30 };
  player.persistentWard = { max: 30, value: 0 };
  const preview = previewCard(combat, 'attune-1', player.id);
  const gain = preview.values.find(row => row.op === 'gainWard');
  assert.ok(gain, 'Attune previews a Ward gain');
  assert.equal(gain.value, 11, 'the preview shows the base 1 plus PR 10');
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'attune-1', targetId: player.id });
  assert.equal(player.persistentWard.value, gain.value, 'Ward restored equals the previewed amount');
});
