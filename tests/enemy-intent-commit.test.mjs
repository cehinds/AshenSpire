// Owner, 2026-11-02: "Intent does not consistently show what the enemy is going to do and often changes their choice.
// Also, if the enemy would lose sp reacting then the other actions they have queued should be removed."
// SPEC §4.6b. Root cause: the plan was rolled once at the start of the player's turn and never re-checked, so a Poise
// break (SP loss), a reaction, or a range change made the shown move unaffordable and execution refused or swapped it
// silently at act time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { rangePairKey } from '../src/model/combatEngagement.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight(id, seed = 511) {
  const run = createRunState({ registries, classId: 'reaver', seed });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: [id] });
  combat.player.hp = combat.player.maxHp = 100000;
  return combat;
}
const settle = combat => { for (let i = 0; combat.pendingReaction && i < 50; i++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null }); };
const play = (combat, card) => { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, ...(card.cardId === 'core.defend' ? {} : { targetId: combat.enemies[0].id }) }); settle(combat); };
const shown = enemy => enemy.intent?.moveId ? [enemy.intent.moveId, ...(enemy.plannedMoves || []).map(row => row.moveId)] : [];
// Moves the enemy committed to this turn: started moves, plus a charge it began preparing.
function endTurn(combat) {
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  settle(combat);
  const events = combat.eventLog.slice(start);
  return { started: events.filter(row => row.type === 'enemyMoveStarted' && !row.reaction).map(row => row.moveId),
    refused: events.filter(row => row.type === 'enemyMoveUnavailable').map(row => row.moveId) };
}

test('shown intent and plan equal what the enemy plays, over a seeded multi-round fight with player actions', () => {
  for (const id of ['wanderingSoldier', 'fellWarden', 'gildedKnight', 'thornMatriarch']) for (const seed of [511, 2, 3]) {
    const combat = fight(id, seed);
    for (let round = 0; round < 6 && !combat.result; round++) {
      for (const card of [...combat.piles.hand]) {
        if (!combat.player.energy) break;
        try { dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id }); settle(combat); } catch { /* unplayable */ }
      }
      const enemy = combat.enemies[0];
      if (!enemy.alive) break;
      const def = registries.enemies.get(id);
      const plan = shown(enemy), resolving = Boolean(enemy.pendingMove);
      const { started, refused } = endTurn(combat);
      const charged = enemy.pendingMove?.moveId;
      const acted = [...started, ...(charged && !started.includes(charged) ? [charged] : [])];
      assert.deepEqual(refused, [], `${id}/${seed}/r${round}: nothing shown is refused at act time`);
      if (resolving) continue; // a charge prepared earlier lands this turn; its resolution is not in this round's plan
      assert.deepEqual(acted, plan.filter(moveId => !def.moves[moveId].delay || moveId === charged), `${id}/${seed}/r${round}`);
    }
  }
});

test('a Poise break that takes the head move\'s SP changes the intent during the player turn', () => {
  const combat = fight('wanderingSoldier');
  const enemy = combat.enemies[0];
  assert.equal(enemy.intent.moveId, 'slash');
  assert.equal(enemy.maxStamina, 1);
  const strike = combat.piles.hand.find(row => row.cardId === 'core.strike');
  play(combat, strike);
  assert.ok(enemy.pendingStaminaLoss > 0, 'the Poise break owes SP');
  assert.equal(enemy.intent.moveId, null, 'the intent no longer promises a move it cannot pay for');
  assert.equal(enemy.intent.kind, 'unknown');
  assert.deepEqual(enemy.plannedMoves, []);
  const { started, refused } = endTurn(combat);
  assert.deepEqual([started, refused], [[], []], 'nothing is attempted and then refused');
});

test('SP lost before acting drops the queued follow-ups it can no longer afford, keeping the earliest in order', () => {
  const combat = fight('fellWarden');
  const enemy = combat.enemies[0];
  assert.deepEqual(shown(enemy), ['caneStrike', 'caneStrike', 'heldBlade']);
  const history = enemy.movesHistory.slice(-3);
  assert.deepEqual(history, shown(enemy));
  enemy.pendingStaminaLoss = 1;
  const card = combat.piles.hand.find(row => row.cardId === 'core.defend');
  play(combat, card);
  assert.deepEqual(shown(enemy), ['caneStrike', 'caneStrike'], 'the unaffordable charge leaves the plan');
  assert.deepEqual(enemy.movesHistory.slice(-2), ['caneStrike', 'caneStrike'], 'and the history that maxConsecutive reads');
  enemy.pendingStaminaLoss = 2;
  const card2 = combat.piles.hand.find(row => row.cardId === 'core.defend' && row !== card) || combat.piles.hand[0];
  play(combat, card2);
  assert.deepEqual(shown(enemy), ['caneStrike'], 'only the earliest affordable action stays');
  assert.equal(enemy.intent.moveId, 'caneStrike');
  const { started, refused } = endTurn(combat);
  assert.deepEqual([started, refused], [['caneStrike'], []]);
});

test('an unaffordable head is replaced visibly, before the turn ends, by the next affordable planned move', () => {
  const combat = fight('gildedKnight', 2);
  const enemy = combat.enemies[0];
  const plan = shown(enemy);
  assert.ok(plan.length >= 1);
  enemy.pendingStaminaLoss = enemy.maxStamina;
  const card = combat.piles.hand[0];
  play(combat, card);
  assert.deepEqual(shown(enemy), [], 'with no SP left nothing is promised');
  assert.equal(enemy.intent.moveId, null);
});

test('a range change that makes the shown attack unaffordable changes the intent to the affordable closing move', () => {
  const combat = fight('wanderingSoldier');
  const enemy = combat.enemies[0];
  assert.equal(enemy.intent.moveId, 'slash');
  const pair = rangePairKey('player:player', `enemy:${enemy.id}`);
  combat.rangeState.engagements[pair] = 2;
  const card = combat.piles.hand.find(row => row.cardId === 'core.defend') || combat.piles.hand[0];
  play(combat, card);
  const now = shown(enemy);
  assert.ok(now.length === 0 || now[0] !== 'slash', 'the unpayable attack is no longer the intent');
  const { started, refused } = endTurn(combat);
  assert.deepEqual(refused, [], 'and nothing shown is refused');
  assert.deepEqual(started, now.filter(moveId => !registries.enemies.get('wanderingSoldier').moves[moveId].delay));
});

test('revalidation draws no enemyAI roll and leaves an unchanged plan untouched', () => {
  const combat = fight('fellWarden');
  const enemy = combat.enemies[0];
  const before = JSON.stringify({ plan: shown(enemy), history: enemy.movesHistory, rolls: combat.rng.getCounters().enemyAI });
  const card = combat.piles.hand.find(row => row.cardId === 'core.defend');
  play(combat, card);
  assert.equal(JSON.stringify({ plan: shown(enemy), history: enemy.movesHistory, rolls: combat.rng.getCounters().enemyAI }), before);
});

test('a fight saved without a committed plan loads, keeps its intent and plays it', () => {
  const combat = fight('fellWarden');
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  for (const row of snapshot.enemies) { delete row.plannedMoves; delete row.planDue; }
  const restored = restoreCombatSnapshot({ registries, rng: createRng(511, combat.rng.getCounters()), snapshot });
  const enemy = restored.enemies[0];
  assert.equal(enemy.intent.moveId, combat.enemies[0].intent.moveId, 'the shown intent survives the load');
  const card = restored.piles.hand.find(row => row.cardId === 'core.defend');
  play(restored, card);
  assert.equal(enemy.intent.moveId, combat.enemies[0].intent.moveId, 'revalidation leaves a plan-less old save alone');
  const { started, refused } = endTurn(restored);
  assert.deepEqual(refused, []);
  assert.deepEqual(started, [combat.enemies[0].intent.moveId]);
});

test('SP an enemy spends reacting in the player turn comes out of its next turn, and the plan is trimmed visibly', () => {
  const combat = fight('gildedKnight', 2);
  const enemy = combat.enemies[0];
  assert.deepEqual(shown(enemy), ['thrust', 'thrust']);
  assert.equal(enemy.maxStamina, 2);
  play(combat, combat.piles.hand.find(row => row.cardId === 'core.strike'));
  assert.equal(combat.eventLog.filter(row => row.type === 'combatEnemyReactionStacked').length, 1, 'the knight reacted');
  assert.equal(enemy.stamina, 1, 'the reaction paid its 1 SP now');
  assert.equal(enemy.pendingStaminaLoss, 1, 'and owes it once against the next turn');
  assert.deepEqual(shown(enemy), ['thrust'], 'the queued thrust it can no longer afford leaves the plan');
  assert.deepEqual(enemy.movesHistory.slice(-1), ['thrust']);
  const { started, refused } = endTurn(combat);
  assert.deepEqual([started, refused], [['thrust'], []], 'it plays only what it showed, without a silent refusal');
});

test('reaction SP is not counted twice: the next turn starts at pool minus the one reaction payment', () => {
  const combat = fight('gildedKnight', 2);
  const enemy = combat.enemies[0];
  play(combat, combat.piles.hand.find(row => row.cardId === 'core.strike'));
  assert.equal(enemy.pendingStaminaLoss, 1);
  dispatch(combat, { type: 'endTurn' });
  settle(combat);
  assert.equal(enemy.pendingStaminaLoss, 0, 'the debt was consumed at the enemy turn start');
  const started = combat.eventLog.filter(row => row.type === 'enemyMoveStarted' && !row.reaction && row.sourceId === enemy.id);
  assert.equal(started.length, 1, 'one affordable move, not zero (a double count would leave 0 SP)');
});

// Version-1 action rules keep a player's Advance temporary to its action, so the knight's reaction still has a band to close.
function farFight(band) {
  const combat = fight('gildedKnight', 2);
  combat.core2ActionRulesVersion = 1;
  const enemy = combat.enemies[0];
  combat.rangeState.engagements[rangePairKey('player:player', `enemy:${enemy.id}`)] = band;
  return { combat, enemy };
}

test('an Advance an enemy pays reacting in the player turn is owed with its reaction SP, and the plan is trimmed', () => {
  const { combat, enemy } = farFight(1);
  assert.equal(enemy.maxStamina, 2);
  play(combat, combat.piles.hand.find(row => row.cardId === 'core.strike'));
  assert.equal(combat.eventLog.filter(row => row.type === 'combatEnemyReactionStacked').length, 1, 'the knight reacted');
  assert.equal(enemy.stamina, 0, 'it paid 1 SP for the reaction and 1 SP to Advance');
  assert.equal(enemy.pendingStaminaLoss, 2, 'both come out of its next turn (pool 2 - 2), not only the reaction SP');
  assert.deepEqual(shown(enemy), [], 'nothing it can no longer afford stays in the plan');
  dispatch(combat, { type: 'endTurn' });
  settle(combat);
  assert.equal(enemy.pendingStaminaLoss, 0, 'the debt was consumed at its turn start');
  assert.deepEqual(combat.eventLog.filter(row => row.type === 'enemyMoveStarted' && !row.reaction && row.sourceId === enemy.id), [], 'it has no SP left to act');
});

test('an Advance paid in the enemy phase owes nothing against a later turn', () => {
  const { combat, enemy } = farFight(2);
  const { refused } = endTurn(combat);
  assert.deepEqual(refused, []);
  assert.ok(!enemy.pendingStaminaLoss, 'its own turn draws on that turn\'s pool and carries nothing');
});
