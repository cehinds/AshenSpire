// A committed combat action must not deep-clone the fight's whole event log: the log grows about 1 KB an
// event, and a 200-turn fight spent 80% of its CPU cloning it (playCard 4 ms -> 45 ms). The transaction's
// candidate gets a new array holding the same rows; a rejected action leaves ctx's log as it was, and the
// fight plays out byte-identically to one whose log rows are re-cloned every action (the old path).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot } from '../src/engine/combatSnapshot.js';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

function startFight(seed) {
  const run = createRunState({ registries, seed, classId: 'reaver' });
  const rng = createRng(seed);
  const combat = createRunCombat({ registries, run, rng, enemyIds: ['wanderingSoldier'], settings: {} });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return { rng, combat };
}

// The greedy bot of save-quota-long-fight; HP is padded so the fight lasts. `act` runs one intent.
function playTurn(combat, act) {
  combat.enemies.forEach(e => { e.hp = e.maxHp = 1e7; });
  combat.player.hp = combat.player.maxHp = 1e7;
  for (let pass = 0; pass < 6; pass++) for (const card of [...combat.piles.hand]) {
    if (combat.result) return;
    act({ type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies.find(e => e.alive)?.id });
  }
  if (!combat.result && combat.phase === 'player') act({ type: 'endTurn', discardIds: [] });
}

const tryDispatch = (combat, intent) => { try { dispatch(combat, intent); return true; } catch { return false; /* unplayable */ } };
// Play the first hand card that commits; a refused card leaves the fight as it was.
const playOne = combat => combat.piles.hand.slice().some(card => tryDispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }));

test('a committed action keeps the earlier log rows and appends to a new array', () => {
  const { combat } = startFight(3);
  playTurn(combat, intent => tryDispatch(combat, intent));
  const before = combat.eventLog, rows = before.slice();
  assert.ok(playOne(combat), 'a card played');
  assert.notEqual(combat.eventLog, before, 'the committed log is the candidate\'s array');
  assert.equal(before.length, rows.length, 'the old array was not appended to');
  assert.ok(combat.eventLog.length > rows.length, 'the play logged events');
  rows.forEach((row, i) => assert.equal(combat.eventLog[i], row, `row ${i} is the same object`));
});

test('a rejected action leaves the log untouched', () => {
  const { combat } = startFight(4);
  playTurn(combat, intent => tryDispatch(combat, intent));
  const before = combat.eventLog, json = JSON.stringify(before), length = before.length;
  assert.throws(() => dispatch(combat, { type: 'playCard', cardInstanceId: 'no-such-card', targetId: combat.enemies[0].id }));
  assert.equal(combat.eventLog, before);
  assert.equal(combat.eventLog.length, length);
  assert.equal(JSON.stringify(combat.eventLog), json);
});

test('a seeded fight plays out byte-identically to one whose log rows are re-cloned every action', () => {
  const shared = startFight(7), cloned = startFight(7);
  for (let turn = 0; turn < 12; turn++) {
    playTurn(shared.combat, intent => tryDispatch(shared.combat, intent));
    // The old path: every action's candidate deep-cloned the log, so each commit held fresh row objects.
    playTurn(cloned.combat, intent => { cloned.combat.eventLog = structuredClone(cloned.combat.eventLog); tryDispatch(cloned.combat, intent); });
  }
  const state = ({ combat, rng }) => JSON.stringify({ turn: combat.turn, phase: combat.phase, result: combat.result, player: combat.player,
    enemies: combat.enemies, piles: combat.piles, counters: rng.getCounters() });
  assert.ok(shared.combat.eventLog.length > 300, 'the fight logged a real history');
  assert.equal(state(shared), state(cloned));
  assert.equal(JSON.stringify(shared.combat.eventLog), JSON.stringify(cloned.combat.eventLog));
  assert.equal(JSON.stringify(serializeCombatSnapshot(shared.combat)), JSON.stringify(serializeCombatSnapshot(cloned.combat)));
});

// Counts the values structuredClone walks: the work an action spends cloning, without timing anything.
function cloneWork(run) {
  const original = globalThis.structuredClone;
  let nodes = 0;
  const count = (value, seen) => {
    const stack = [value];
    while (stack.length) {
      const item = stack.pop();
      nodes++;
      if (!item || typeof item !== 'object' || seen.has(item)) continue;
      seen.add(item);
      if (item instanceof Map) for (const [k, v] of item) stack.push(k, v);
      else if (item instanceof Set) for (const v of item) stack.push(v);
      else for (const key of Object.keys(item)) stack.push(item[key]);
    }
  };
  globalThis.structuredClone = (value, options) => { count(value, new Set()); return original(value, options); };
  try { run(); } finally { globalThis.structuredClone = original; }
  return nodes;
}

test('the clone work of a card play does not grow with the event log', () => {
  const { combat } = startFight(7);
  // The first card of a fresh turn, so the hand is full and one commits; refused tries count too.
  const playWork = () => { let played = false; const work = cloneWork(() => { played = playOne(combat); }); assert.ok(played); return work; };
  playTurn(combat, intent => tryDispatch(combat, intent));
  const earlyLog = combat.eventLog.length, early = playWork();
  for (let turn = 0; turn < 40; turn++) playTurn(combat, intent => tryDispatch(combat, intent));
  const lateLog = combat.eventLog.length, late = playWork();
  assert.ok(lateLog > earlyLog * 8, `the log grew (${earlyLog} -> ${lateLog})`);
  assert.ok(late < early * 2, `clone work ${early} -> ${late} nodes as the log grew ${earlyLog} -> ${lateLog}`);
});
