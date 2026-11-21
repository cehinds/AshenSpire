// Plays one Core card in a real Core 2 fight and returns the outcome (events and state). Used to prove an upgrade changes what the card does.
import { registries } from './fixcore-combat-rules.mjs';
import { dispatch } from '../../src/engine/combat.js';
import { createRunState } from '../../src/model/state.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import { primeAccuracyRolls } from '../accuracyFixture.mjs';
import { candidateState } from '../../src/engine/combatRules.js';
export { registries };
const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? undefined : v)));
// Building a fight costs ~90 ms (run, combat, profile copy, Accuracy priming) and a play ~12 ms, so each
// (class, enemies, seed) fight is built once and every play runs on its own copy: candidateState is the
// engine's own transaction clone (every field and bound function, the event log rows and the RNG counters).
const preparedFights = new Map();
function preparedFight(classId, enemies, seed) {
  const key = JSON.stringify([classId, enemies, seed]);
  if (preparedFights.has(key)) return preparedFights.get(key);
  const run = createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: enemies });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  // filler so draw has something
  const filler = (n) => ({ instanceId: 'f' + n, cardId: 'core.strike', upgraded: false });
  for (let i = 0; i < 6; i++) combat.piles.draw.push(filler(i));
  for (const e of combat.enemies) {
    Object.assign(e, { hp: 500, maxHp: 500, block: 0, barrier: 0, persistentPoise: { value: 80, max: 80 } });
    // Status application reconciles maximum Poise from the rating. Keep the
    // probe's enlarged pool and its rating consistent across Frost/Chill hits.
    e.ratings.poise = 80;
  }
  combat.player.hp = 30; combat.player.stamina = combat.player.maxStamina = 20;
  if ('mana' in combat.player) combat.player.mana = combat.player.maxMana = Math.max(20, combat.player.maxMana || 0);
  primeAccuracyRolls(combat, { count: 3 });
  preparedFights.set(key, combat);
  return combat;
}
export function play(cardId, instExtra = {}, { classId = 'reaver', enemies = ['wanderingSoldier'], seed = 511 } = {}) {
  const combat = candidateState(preparedFight(classId, enemies, seed));
  const instance = { instanceId: 'probe-1', cardId, upgraded: false, ...instExtra };
  combat.piles.hand.push(instance);
  const enemy = combat.enemies[0];
  const before = snap(combat);
  const start = combat.eventLog.length;
  let error = null, result = null;
  const tryPlay = (targetId) => dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, ...(targetId ? { targetId } : {}) });
  try { result = tryPlay(enemy.id); } catch (e) {
    error = e.message;
    if (/friendly target/.test(error)) { error = null; try { result = tryPlay('player'); } catch (e2) { error = e2.message; try { result = tryPlay(null); error = null; } catch (e3) { error = e3.message; } } }
  }
  const after = snap(combat);
  const ev = combat.eventLog.slice(start).map((e) => clean(e));
  return { error, before, after, ev, played: !error && !!(result?.ok ?? true), result: clean(result) };
}
function snap(c) {
  const e = c.enemies[0];
  const piles = Object.fromEntries(Object.entries(c.piles).map(([k, v]) => [k, v.length]));
  return clean({ ehp: e.hp, eblock: e.block, estat: Object.fromEntries(Object.entries(e.statuses || {}).map(([k, v]) => [k, v.stacks ?? v])), epoise: e.persistentPoise?.value, eposture: e.poise ?? e.poiseMeter ?? null,
    php: c.player.hp, pblock: c.player.block, pstat: Object.fromEntries(Object.entries(c.player.statuses || {}).map(([k, v]) => [k, v.stacks ?? v])), stam: c.player.stamina, mana: c.player.mana, piles, range: c.range ?? c.band ?? c.distance ?? null, ppos: c.player.position ?? c.player.band ?? null, epos: e.position ?? e.band ?? null, stance: c.player.combatStance ?? null,
    others: c.enemies.slice(1).map((o) => ({ hp: o.hp, block: o.block, poise: o.persistentPoise?.value, stat: Object.fromEntries(Object.entries(o.statuses || {}).map(([k, v]) => [k, v.stacks ?? v])) })) });
}
const keep = (x) => Object.fromEntries(Object.entries(x).filter(([k, v]) => !/^(ability|knowledge|cardInstanceId|damageReceipt|serial|seq|id$)/.test(k) && typeof v !== 'object'));
export const outcome = (r) => JSON.stringify({ e: r.error, a: r.after, ev: r.ev.map(keep) });
