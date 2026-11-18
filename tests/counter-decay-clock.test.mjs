// Owner 2026-11-18: Counter stacks lose their decay only at the START of the holder's own turn, never at the end of it
// (so Counter gained on your turn survives the enemy's turn and protects you). The clock is data: counter.decayClock "ownerTurnStart".
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { decayAtTurnEnd } from '../src/engine/statuses.js';
import { startTacticalTurn } from '../src/engine/combatMatchups.js';
import { primeEnemyCounter } from '../src/engine/combatCardTactics.js';
import { validateFixCoreRules, CounterDecayClock, FixCoreCounterStacks } from '../src/model/fixCoreMechanics.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(enemyId = 'wanderingSoldier') {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: [enemyId] });
  Object.assign(combat.player, { hp: 9999, maxHp: 9999, energy: 99, basePrecisionBonus: 1000 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { combat, enemy: combat.enemies[0] };
}
const changed = (combat, from) => combat.eventLog.slice(from).filter(e => e.type === 'counterStacksChanged');
const decayAmount = combat => FixCoreCounterStacks(combat).decayPerTurn;

test('the data names the clock: counter.decayClock is ownerTurnStart, and the validator only accepts that', () => {
  assert.equal(shipped.counter.decayClock, 'ownerTurnStart');
  const { combat } = live();
  assert.equal(CounterDecayClock(combat), 'ownerTurnStart');
  assert.doesNotThrow(() => validateFixCoreRules(shipped));
  assert.throws(() => validateFixCoreRules({ ...shipped, counter: { ...shipped.counter, decayClock: 'ownerTurnEnd' } }), /decayClock/);
});

test('player: Counter stacks gained this turn are intact when the enemy attacks, and fade only at the start of the player\'s next turn', () => {
  const { combat, enemy } = live();
  const stacks = 3;
  combat.player.counterStacks = stacks;
  enemy.intent = { ...enemy.intent, kind: 'buff', moveId: enemy.intent.moveId, damage: 0, hits: 0 }; // an enemy turn that does not strike, so no hit spends a stack
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const rows = changed(combat, from);
  const turnStarts = combat.eventLog.slice(from).filter(e => ['playerTurnEnd', 'enemyTurnStart', 'enemyTurnEnd', 'playerTurnStart'].includes(e.type)).map(e => e.type);
  assert.deepEqual(turnStarts, ['playerTurnEnd', 'enemyTurnStart', 'enemyTurnEnd', 'playerTurnStart']);
  const decayRows = rows.filter(e => e.decay && e.targetId === 'player');
  assert.equal(decayRows.length, 1, 'one fade');
  const idx = e => combat.eventLog.indexOf(e);
  const enemyEnd = combat.eventLog.slice(from).find(e => e.type === 'enemyTurnEnd');
  assert.ok(idx(decayRows[0]) > idx(enemyEnd), 'the fade comes after the enemy turn ended, at the player\'s next turn start');
  assert.equal(combat.player.counterStacks, stacks - decayAmount(combat), 'lost exactly the live decay amount once, at the owner\'s turn start');
});

test('player: no Counter fade is logged between the end of the player\'s turn and the end of the enemy\'s turn', () => {
  const { combat } = live();
  combat.player.counterStacks = 3;
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const log = combat.eventLog.slice(from);
  const start = log.findIndex(e => e.type === 'playerTurnEnd'), end = log.findIndex(e => e.type === 'enemyTurnEnd');
  assert.ok(start >= 0 && end > start);
  assert.deepEqual(log.slice(start, end + 1).filter(e => e.type === 'counterStacksChanged' && e.decay && e.targetId === 'player'), []);
  assert.equal(combat.player.counterStacks, 3 - decayAmount(combat) - (log.some(e => e.type === 'counterStacksChanged' && e.consumed && e.targetId === 'player') ? 1 : 0));
});

test('player: the end-of-turn status decay never touches Counter stacks', () => {
  const { combat } = live();
  combat.player.counterStacks = 4;
  decayAtTurnEnd(combat, combat.player);
  assert.equal(combat.player.counterStacks, 4);
});

test('player: several stacks fade by the live decay amount per own turn start, floored at 0', () => {
  const { combat } = live();
  const n = decayAmount(combat), start = 4;
  combat.player.counterStacks = start;
  const seen = [];
  for (let i = 0; i < start + 1; i++) { startTacticalTurn(combat, combat.player); seen.push(combat.player.counterStacks ?? 0); }
  const expected = []; let v = start; for (let i = 0; i < start + 1; i++) { v = Math.max(0, v - n); expected.push(v); }
  assert.deepEqual(seen, expected);
  assert.equal(seen.at(-1), 0);
});

test('enemy: a Counter badge is not faded by the enemy\'s turn-end decay, and fades at the start of the enemy\'s own turn', () => {
  const { combat, enemy } = live('gildedKnight');
  primeEnemyCounter(combat, enemy, reg.enemies.get('gildedKnight').moves.parry, 'parry');
  for (let n = 0; combat.queue.length && n < 100; n++) combat.queue.shift();
  const badge = enemy.counterStacks;
  assert.ok(badge > 0, 'the enemy holds a Counter badge');
  decayAtTurnEnd(combat, enemy);
  assert.equal(enemy.counterStacks, badge, 'the end-of-turn decay leaves it');
  const from = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  const rows = combat.eventLog.slice(from).filter(e => e.type === 'counterStacksChanged' && e.targetId === enemy.id);
  assert.ok(rows.length >= 1, 'the badge went at the enemy\'s turn start');
  const enemyStart = combat.eventLog.slice(from).findIndex(e => e.type === 'enemyTurnStart');
  const rowAt = combat.eventLog.slice(from).findIndex(e => e.type === 'counterStacksChanged' && e.targetId === enemy.id);
  const enemyEnd = combat.eventLog.slice(from).findIndex(e => e.type === 'enemyTurnEnd');
  assert.ok(rowAt > enemyStart && rowAt < enemyEnd, 'between the enemy\'s turn start and its turn end action, i.e. at its own turn start');
});
