import assert from 'node:assert/strict';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
import { act1Enemies } from '../src/content/enemies/act1.js';
import { act2Enemies } from '../src/content/enemies/act2.js';
import { act3Enemies } from '../src/content/enemies/act3.js';

const all = [...act1Enemies, ...act2Enemies, ...act3Enemies];
for (const def of all) {
  const before = JSON.stringify(def);
  const cards = enemyMoveCards(def);
  assert.equal(cards.length, Object.keys(def.moves).length);
  for (const card of cards) {
    assert(card.detail && card.name && card.meta);
    assert.deepEqual(card.tags, def.moves[card.moveId].tags || []);
    assert.equal(card.active, false);
  }
  assert.equal(JSON.stringify(def), before);
}
const warden = all.find((e) => e.id === 'fellWarden');
const enemy = { unlockedMoves: [], pendingMove: { moveId: 'heldBlade', resolveOnTurn: 3 } };
const preview = { moveId: 'heldBlade', damage: 19, hits: 1, pending: true };
const before = JSON.stringify({ warden, enemy, preview });
const cards = enemyMoveCards(warden, { enemy, preview });
assert.equal(cards.filter((c) => c.active).length, 1);
assert.match(cards.find((c) => c.moveId === 'heldBlade').detail, /19 preview damage before Block.*Delayed 1 turn.*8 base Block while charging/);
assert.match(cards.find((c) => c.moveId === 'heldBlade').meta, /Charging/);
assert.match(cards.find((c) => c.moveId === 'twinDaggers').meta, /Locked.*50% HP/);
assert.equal(enemyMoveCards(warden, { enemy: { unlockedMoves: ['twinDaggers'] } }).find((c) => c.moveId === 'twinDaggers').locked, false);
assert.equal(JSON.stringify({ warden, enemy, preview }), before);
assert.equal(enemyMoveCards(warden, { preview: { kind: 'staggered', moveId: null } }).some((c) => c.active), false);
const hound = enemyMoveCards(all.find((e) => e.id === 'blightHound'));
assert.match(hound.find((c) => c.moveId === 'lunge').detail, /3 × 2 base damage/);
const soldier = enemyMoveCards(all.find((e) => e.id === 'wanderingSoldier'));
assert.match(soldier.find((c) => c.moveId === 'warcry').detail, /Apply 2 Strength to self/);
assert.match(enemyMoveCards(all.find((e) => e.id === 'graveWisp')).find((c) => c.moveId === 'curse').detail, /Dazed to Draw \(random\)/);
assert.match(enemyMoveCards(all.find((e) => e.id === 'ashRevenant')).find((c) => c.moveId === 'reform').detail, /Heal self for 6.*6 base Block/);
console.log(`enemyMoveCards: ${all.length} rosters plus live intent, phase, delay, multi-hit, effects and immutability passed`);
