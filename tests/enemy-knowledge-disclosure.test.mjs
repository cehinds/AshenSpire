import assert from 'node:assert/strict';
import { projectEnemyKnowledge } from '../src/model/enemyKnowledgeView.js';
const def = { id: 'probe', name: 'Secret Sentinel', size: 'large', lore: ['Hidden biography'], hp: [78, 81], poiseMax: 43,
  moves: { secret: { name: 'Secret Slash', intent: 'attack', damage: 47, maxConsecutive: 2,
    delay: { turns: 4, whileCharging: { block: 39 } }, tags: ['camp:physical', 'maneuver:smash'] } },
  phases: [{ on: 'hpBelowPct', pct: 17, unlockMoves: ['secret'] }] };
const record = points => points ? { target: 30, receipts: Object.fromEntries(Array.from({ length: points }, (_, n) => [`r${n}`, { bonus: false }])) } : null;
let view = projectEnemyKnowledge(def, record(0));
assert.equal(view.name, 'Unknown enemy');
assert.equal(view.lore, null); assert.equal(view.resources, null); assert.equal(view.moveCards, null);
assert.ok(!JSON.stringify(view).includes('Secret Sentinel'));
view = projectEnemyKnowledge(def, record(1));
assert.equal(view.name, def.name); assert.deepEqual(view.lore, def.lore);
assert.equal(view.resources, null); assert.equal(view.moveCards, null);
view = projectEnemyKnowledge(def, record(6));
assert.equal(view.resources[0].value, '78–81'); assert.equal(view.moveCards, null);
view = projectEnemyKnowledge(def, record(12));
assert.equal(view.moveCards[0].name, 'Secret Slash'); assert.equal(view.moveCards[0].detail, 'Attack');
assert.ok(!JSON.stringify(view.moveCards).includes('47')); assert.ok(!JSON.stringify(view.moveCards).includes('Delayed'));
view = projectEnemyKnowledge(def, record(21));
assert.ok(view.moveCards[0].detail.includes('47'));
assert.ok(!view.moveCards[0].detail.includes('Delayed')); assert.ok(!view.moveCards[0].meta.includes('17%'));
assert.ok(!view.moveCards[0].meta.includes('consecutive'));
view = projectEnemyKnowledge(def, record(30));
assert.ok(view.moveCards[0].detail.includes('Delayed 4 turns')); assert.ok(view.moveCards[0].meta.includes('17%'));
assert.ok(view.moveCards[0].meta.includes('At most 2 consecutive')); assert.equal(view.moveCards[0].active, false);
assert.deepEqual(projectEnemyKnowledge({ ...def, moves: {}, lore: [] }, record(30)).moveCards, []);
console.log('PASS enemy knowledge disclosure: only learned facts enter models; mastered catalogs never select a live action');
