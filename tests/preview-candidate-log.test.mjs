// A phone stalled for seconds per tap because every card preview (and every
// reaction option check) deep-cloned the whole combat, and the largest part of
// that graph is eventLog, which only grows during the fight. A detached
// preview candidate starts with an empty log; this pins that, and that the
// numbers a preview shows do not depend on the log it no longer copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { candidateState } from '../src/engine/combatRules.js';

const registries = createRegistries(contentBundle);
function fight() {
  const deck = Array.from({ length: 10 }, (_, i) => ({ instanceId: `c${i}`, cardId: i % 2 ? 'strike' : 'defend', upgraded: false }));
  const combat = createCombat({ registries, rng: createRng(7), enemyIds: ['wanderingSoldier'],
    player: { id: 'p', classId: 'reaver', hp: 400, maxHp: 400, energyMax: 20, maxStamina: 20, stamina: 20, drawPerTurn: 5, relicIds: [], deck } });
  combat.enemies[0].hp = combat.enemies[0].maxHp = 100000;
  return combat;
}
function longFight(turns = 4) {
  const combat = fight();
  for (let turn = 0; turn < turns && !combat.result; turn += 1) {
    for (const card of [...combat.piles.hand]) {
      try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }); } catch { /* unaffordable */ }
    }
    dispatch(combat, { type: 'endTurn' });
  }
  return combat;
}
const strip = combat => { const copy = { ...combat }; copy.eventLog = []; return copy; };
const data = combat => structuredClone(Object.fromEntries(Object.entries(combat)
  .filter(([key, value]) => typeof value !== 'function' && !['registries', 'rng'].includes(key))));

test('a detached candidate does not copy the fight history, a transaction candidate does', () => {
  const combat = longFight();
  assert.ok(combat.eventLog.length > 50, `fight log is ${combat.eventLog.length} events`);
  const detached = candidateState(combat, { detached: true });
  assert.deepEqual(detached.eventLog, []);
  assert.notEqual(detached.eventLog, combat.eventLog);
  const full = candidateState(combat);
  assert.deepEqual(full.eventLog, combat.eventLog);
  assert.notEqual(full.eventLog, combat.eventLog);
  // Everything else is the same graph.
  const { eventLog: ignoredA, ...restDetached } = Object.fromEntries(Object.entries(detached).filter(([, v]) => typeof v !== 'function' && !(v instanceof Map)));
  const { eventLog: ignoredB, ...restFull } = Object.fromEntries(Object.entries(full).filter(([, v]) => typeof v !== 'function' && !(v instanceof Map)));
  for (const key of Object.keys(restFull)) if (key !== 'rng' && key !== 'registries') assert.deepEqual(restDetached[key], restFull[key], key);
});

test('previewing a card clones no event history and never touches the live log or state', () => {
  const combat = longFight();
  const cardId = combat.piles.hand[0].instanceId;
  const logBefore = combat.eventLog.length, stateBefore = data(combat);
  const real = globalThis.structuredClone;
  let historyCloned = 0;
  globalThis.structuredClone = (value, ...args) => { if (Array.isArray(value?.eventLog) && value.eventLog.length > 0) historyCloned += 1; return real(value, ...args); };
  let shown;
  try { shown = previewCard(combat, cardId); } finally { globalThis.structuredClone = real; }
  assert.equal(historyCloned, 0, 'a preview must not deep-clone the fight log');
  assert.equal(combat.eventLog.length, logBefore);
  assert.deepEqual(data(combat), stateBefore);
  // The numbers do not depend on the log: the same fight with its history cut away shows the same preview.
  const trimmed = strip(combat);
  trimmed.eventLog = [];
  assert.deepEqual(previewCard(trimmed, cardId), shown);
  assert.deepEqual(previewCard(combat, cardId), shown, 'repeating a preview shows the same numbers');
});
