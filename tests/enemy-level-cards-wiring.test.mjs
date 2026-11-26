// Enemy level cards in a Core fight (owner, 2026-11-20; docs/plans/enemy-level-scaling.md, "Level-card lists"): an
// enemy at floor step N fights with the first N cards of its list as extra moves on its instance (a boss at bossSteps),
// picked from `${seed}/${instanceId}` with no RNG draw, costing 2 SP each, named for the card, and saved with the fight.
// The shared registry definition never changes, and a profile without enemyLevelScaling gets no level cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { canonicalGameJSON } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { moveSp, enemyMoveQuote } from '../src/engine/combatRoundsAdapter.js';
import { levelCardsFor, levelMoveId } from '../src/model/enemyLevelCards.js';
import { enemyDefinitionOf, enemyMoveOf } from '../src/model/enemyMoveSet.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';

const plain = value => JSON.parse(JSON.stringify(value));
const coreRegistries = (gameProfile = resolveGameProfile('default')) =>
  bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
const core = coreRegistries();
const lists = core.gameProfile.content.enemyLevelCards;

function fight(registries, enemyId, act, floor, seed = 77) {
  const run = createRunState({ registries, classId: 'reaver', seed });
  run.actNumber = act;
  run.floor = floor;
  return createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [enemyId] });
}
function endTurn(combat) {
  dispatch(combat, { type: 'endTurn' });
  for (let guard = 0; combat.pendingReaction && guard < 30; guard++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
}
const levelIds = enemy => Object.keys(enemy.extraMoves || {});

test('the Core profile carries the level-card lists', () => {
  assert.ok(lists && Array.isArray(lists.wanderingSoldier), 'content.enemyLevelCards is loaded');
});

test('an act-1 minion has 0, 1 and 2 level moves on floors 2, 5 and 8', () => {
  const [low, mid, high] = [2, 5, 8].map(floor => fight(core, 'wanderingSoldier', 1, floor).enemies[0]);
  assert.deepEqual([low, mid, high].map(enemy => levelIds(enemy).length), [0, 1, 2]);
  assert.equal(low.extraMoves, undefined, 'a step-0 enemy carries no overlay');
  for (const enemy of [mid, high]) {
    const picked = levelCardsFor(lists, 'wanderingSoldier', enemy.levelStep, `77/${enemy.id}`);
    assert.deepEqual(levelIds(enemy), picked.map(levelMoveId));
    for (const entry of picked) {
      const move = enemy.extraMoves[levelMoveId(entry)];
      assert.equal(move.name, entry.name);
      assert.equal(move.sp, 2);
      assert.equal(move.levelCard, entry.id);
      assert.ok(move.tags.includes('camp:physical'), `${entry.id} carries its source's identity tags`);
    }
  }
  // A step-2 pick holds the step-1 card.
  assert.equal(levelIds(high)[0], levelIds(mid)[0]);
});

test('a boss has two level moves', () => {
  const king = fight(core, 'stitchedKing', 2, 10).enemies[0];
  assert.equal(king.levelStep, 2);
  assert.equal(levelIds(king).length, 2);
});

test('picks are deterministic per seed and follow the instance', () => {
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const a = fight(core, 'wanderingSoldier', 1, 8, seed).enemies[0], b = fight(core, 'wanderingSoldier', 1, 8, seed).enemies[0];
    assert.deepEqual(plain(a.extraMoves), plain(b.extraMoves), `seed ${seed}`);
    assert.deepEqual(levelIds(a), levelCardsFor(lists, 'wanderingSoldier', 2, `${seed}/e1`).map(levelMoveId));
    seen.add(levelIds(a).join(','));
  }
  assert.ok(seen.size > 1, 'different seeds can give different cards');
});

test('level moves cost 2 SP and show under the card name', () => {
  const combat = fight(core, 'wanderingSoldier', 1, 8);
  const [enemy] = combat.enemies;
  for (const [moveId, move] of Object.entries(enemy.extraMoves)) {
    assert.equal(moveSp(move, { enemy, moveId, combat }), 2, moveId);
    assert.equal(enemyMoveQuote(move, { enemy, moveId, combat }).sp, 2, moveId);
  }
  const cards = enemyMoveCards(enemyDefinitionOf(core, enemy), { enemy, registries: core });
  for (const move of Object.values(enemy.extraMoves)) assert.ok(cards.some(card => card.name === move.name), move.name);
});

test('an enemy chooses and resolves a level move, and the registry definition is unchanged', () => {
  const def = core.enemies.get('wanderingSoldier');
  const before = plain(def);
  const combat = fight(core, 'wanderingSoldier', 1, 8);
  const [enemy] = combat.enemies;
  for (let turn = 0; turn < 12 && enemy.alive && combat.player.hp > 0 && !enemy.performedMoves.some(id => id.startsWith('level.')); turn++) endTurn(combat);
  const used = enemy.performedMoves.find(id => id.startsWith('level.'));
  assert.ok(used, `a level move was played: ${enemy.performedMoves.join(',')}`);
  const started = combat.eventLog.find(event => event.type === 'enemyMoveStarted' && event.moveId === used);
  assert.ok(started, 'the move started as an enemy move');
  assert.ok(combat.eventLog.some(event => event.type === 'enemyMoveEnded' && event.moveId === used), 'and resolved');
  assert.deepEqual(plain(def), before, 'the shared definition is untouched');
  assert.ok(!Object.keys(def.moves).some(id => id.startsWith('level.')));
  assert.equal(enemyMoveOf(core, { enemyId: 'wanderingSoldier' }, used), undefined, 'another instance does not see it');
});

test('a mid-fight save and restore keeps the level moves and plays on the same', () => {
  const combat = fight(core, 'wanderingSoldier', 1, 8);
  endTurn(combat);
  const snapshot = plain(serializeCombatSnapshot(combat));
  const restored = restoreCombatSnapshot({ registries: core, rng: createRng(77, combat.rng.getCounters()), snapshot, expectedGameProfile: core.gameProfile });
  assert.deepEqual(plain(restored.enemies[0].extraMoves), plain(combat.enemies[0].extraMoves));
  assert.deepEqual(Object.keys(enemyDefinitionOf(core, restored.enemies[0]).moves), Object.keys(enemyDefinitionOf(core, combat.enemies[0]).moves));
  const liveStart = combat.eventLog.length, restoredStart = restored.eventLog.length;
  for (let turn = 0; turn < 4; turn++) { endTurn(combat); endTurn(restored); }
  assert.deepEqual(plain(restored.enemies[0].performedMoves), plain(combat.enemies[0].performedMoves));
  assert.equal(canonicalGameJSON(plain(restored.eventLog.slice(restoredStart))), canonicalGameJSON(plain(combat.eventLog.slice(liveStart))));
});

test('a restored fight with a malformed level move is refused', () => {
  const combat = fight(core, 'wanderingSoldier', 1, 8);
  const snapshot = plain(serializeCombatSnapshot(combat));
  snapshot.enemies[0].extraMoves[levelIds(combat.enemies[0])[0]].sp = 'two';
  assert.throws(() => restoreCombatSnapshot({ registries: core, rng: createRng(77, combat.rng.getCounters()), snapshot, expectedGameProfile: core.gameProfile }), /extraMoves/);
});

// An older snapshot carries no enemyLevelScaling (and so no level-card lists): its enemies get no level moves.
function withoutScaling() {
  const old = plain(resolveGameProfile('default'));
  delete old.modules.characters.enemyLevelScaling;
  delete old.content.enemyLevelCards;
  const { hash: _hash, ...payload } = old;
  old.hash = `sha256:${createHash('sha256').update(canonicalGameJSON(payload)).digest('hex')}`;
  return resolveGameProfile(old);
}

test('an older snapshot without enemyLevelScaling gets no level moves', () => {
  const old = coreRegistries(withoutScaling());
  for (const [id, act, floor] of [['wanderingSoldier', 1, 8], ['stitchedKing', 2, 10]]) {
    const enemy = fight(old, id, act, floor).enemies[0];
    assert.equal(enemy.extraMoves, undefined, id);
    assert.equal(enemyDefinitionOf(old, enemy), old.enemies.get(id), `${id} reads the registry row itself`);
  }
  const historical = coreRegistries(validateGameProfileSnapshot(JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-73ef.json.gz', import.meta.url))))));
  assert.equal(fight(historical, 'wanderingSoldier', 1, 8).enemies[0].extraMoves, undefined, 'historical profile');
});

test('a stale list in a profile without enemyLevelScaling is ignored', () => {
  const old = plain(resolveGameProfile('default'));
  delete old.modules.characters.enemyLevelScaling;
  const { hash: _hash, ...payload } = old;
  old.hash = `sha256:${createHash('sha256').update(canonicalGameJSON(payload)).digest('hex')}`;
  const registries = coreRegistries(resolveGameProfile(old));
  // A stale list left in the content is ignored without the table.
  assert.equal(fight(registries, 'wanderingSoldier', 1, 8).enemies[0].extraMoves, undefined);
});
