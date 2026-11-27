// Review fix 2 (W25Bands, owner 2026-11-15): a back-row melee enemy's intent is planned against the player's band at the COMING enemy phase,
// re-planned whenever the player's Advanced state changes in the turn (Advance, auto-Advance, Retreat), costs no rng, and the move shown is the move done.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/engine/combat.js';
import { bandsFight, pairOf, registries } from './helpers/bands-fight.mjs';
import { enemyTurnSp, enemyMoveQuote, extendEnemyQueue } from '../src/engine/combatRoundsAdapter.js';
import { GrantRetreatCard } from '../src/engine/bandRows.js';
import { EnemyDefinitionOf } from '../src/model/enemyMoveSet.js';

const moves = combat => combat.eventLog.filter(e => e.type === 'enemyMoveStarted' && e.sourceId === 'e1').map(e => e.moveId);
const fight = (seed, hand = []) => bandsFight({ enemyIds: ['courtSurgeon', 'wanderingSoldier'], seed, hand });
const play = (combat, instanceId, targetId) => dispatch(combat, { type: 'playCard', cardInstanceId: instanceId, targetId });
const advanceCard = (combat) => { combat.piles.hand.push({ instanceId: 'adv', cardId: 'core.advance', upgraded: false }); return 'adv'; };
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

test('the repro: the Advance ends at this turn\'s end, so turn 2 shows Approaching and Approaching is what runs', () => {
  let approaching = 0;
  for (const seed of seeds) {
    const combat = fight(seed, ['core.advance']);
    play(combat, 'qa0', 'e1');
    assert.equal(combat.player.advanced, 2);
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.player.advanced, 1);
    const surgeon = combat.enemies[0], shown = surgeon.intent.moveId, before = moves(combat).length;
    if (surgeon.intent.approachFor) { approaching++; assert.equal(shown, 'advance', `seed ${seed}`); }
    dispatch(combat, { type: 'endTurn' });
    assert.equal(moves(combat)[before], shown, `seed ${seed}: the move done is the move shown`);
  }
  assert.ok(approaching > 0, 'at least one seed rolls an attack that becomes the step forward');
});

test('Advance played after the intents rolled flips the shown step forward to the attack, and the attack runs', () => {
  for (const seed of seeds) {
    const combat = fight(seed);
    const surgeon = combat.enemies[0];
    if (!surgeon.intent.approachFor) continue;
    const attack = surgeon.intent.approachFor;
    play(combat, advanceCard(combat), 'e1');
    assert.equal(surgeon.intent.moveId, attack, `seed ${seed}: the attack is shown`);
    assert.equal(surgeon.intent.approachFor, undefined);
    dispatch(combat, { type: 'endTurn' });
    assert.equal(moves(combat)[0], attack);
  }
});

test('Retreat played after that ends the Advance and sends the front enemy back; the surgeon, back all along and not held, steps forward at the phase start (no front row left), so its attack stands', () => {
  let ran = 0;
  for (const seed of seeds) {
    const combat = fight(seed);
    const surgeon = combat.enemies[0];
    if (!surgeon.intent.approachFor) continue;
    const attack = surgeon.intent.approachFor;
    play(combat, advanceCard(combat), 'e1');
    assert.equal(surgeon.intent.moveId, attack);
    combat.loadout = structuredClone(combat.loadout); combat.loadout.sets.rightHand = ['shortbow'];
    GrantRetreatCard(combat);
    play(combat, combat.piles.hand.find(c => c.cardId === 'core.retreat').instanceId);
    assert.equal(combat.player.advanced, 0, 'the Advance is over');
    assert.equal(surgeon.row, 'back', `seed ${seed}: Retreat sent it to the back row`);
    assert.equal(surgeon.intent.moveId, attack, 'a lone back-row enemy plans its attack, not an approach (SPEC rows)');
    ran++;
  }
  assert.ok(ran > 0);
});

test('re-planning costs no rng: the stream counters match a fight where the same cards were played with no flip to make', () => {
  for (const seed of seeds) {
    const combat = fight(seed);
    if (!combat.enemies[0].intent.approachFor) continue;
    const counters = JSON.stringify(combat.rng.getCounters());
    play(combat, advanceCard(combat), 'e1'); // flips the intent
    assert.equal(combat.enemies[0].intent.approachFor, undefined);
    // The card play itself draws what it draws; a twin fight whose surgeon is already front (nothing to flip) draws the same.
    const twin = fight(seed);
    twin.enemies[0].row = 'front';
    const before = JSON.stringify(twin.rng.getCounters());
    play(twin, advanceCard(twin), 'e1');
    const delta = (a, b) => JSON.stringify(Object.keys(JSON.parse(b)).filter(k => JSON.parse(b)[k] !== JSON.parse(a)[k]));
    assert.equal(delta(counters, JSON.stringify(combat.rng.getCounters())), delta(before, JSON.stringify(twin.rng.getCounters())), `seed ${seed}`);
  }
});

test('an auto-Advance from a melee card aimed at the back row flips the intent too, and the move done is the move shown', () => {
  let checked = 0;
  for (const seed of seeds) {
    const combat = fight(seed, ['core.strike']);
    const surgeon = combat.enemies[0];
    if (!surgeon.intent.approachFor) continue;
    surgeon.persistentPoise = { max: 1000, value: 1000 }; // the hit must not stagger it: a staggered enemy has no move to show
    play(combat, 'qa0', 'e1');
    assert.ok(combat.player.advanced > 0);
    const shown = surgeon.intent.moveId;
    if (shown == null) continue;
    assert.notEqual(shown, 'advance', `seed ${seed}: the attack shows once the player is Advanced`);
    dispatch(combat, { type: 'endTurn' });
    assert.equal(moves(combat)[0], shown);
    checked++;
  }
  assert.ok(checked > 0);
});

// Review follow-ups (W25Bands, 2026-11-15). The cleanup baseline's historical dragon moved because its opener is now priced against the projected bands:
// its start enemyAI draws went 2 -> 0 and its live draws 3 -> 1 (not "one fewer"); commit 3473e2bb81's message said the latter loosely.
test('a back-row melee opener with a front ally shows Approaching at once, and ending the turn runs it', () => {
  for (const seed of seeds) {
    const combat = bandsFight({ enemyIds: ['fellWarden', 'wanderingSoldier'], seed, encounter: { id: 'x', rows: ['back', 'front'] } });
    const warden = combat.enemies[0];
    assert.equal(warden.row, 'back');
    assert.equal(warden.intent.moveId, 'advance', `seed ${seed}: the opener is shown as the step forward`);
    assert.equal(warden.intent.approachFor, 'caneStrike');
    const before = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    const done = combat.eventLog.slice(before).filter(e => e.type === 'enemyMoveStarted' && e.sourceId === warden.id).map(e => e.moveId);
    assert.equal(done[0], 'advance', `seed ${seed}: the move done is the move shown`);
  }
});

test('a plan never hides an attack the pool cannot pay: every stored approachFor attack is affordable', () => {
  let hidden = 0;
  const ids = [...registries.enemies.ids()].filter(id => !registries.enemies.get(id).boss).slice(0, 80);
  for (const id of ids) for (const seed of [1, 2, 3]) {
    let combat;
    try { combat = bandsFight({ enemyIds: [id, 'wanderingSoldier'], seed, encounter: { id: 'x', rows: ['back', 'front'] } }); } catch { continue; }
    // The instance's move set: a stepped enemy's level-card moves (owner, 2026-11-20) can be the attack behind the step.
    const [enemy] = combat.enemies, def = EnemyDefinitionOf(registries, enemy);
    const pool = enemyTurnSp(enemy, def, combat);
    for (const entry of [{ moveId: enemy.intent?.moveId, approachFor: enemy.intent?.approachFor }, ...(enemy.plannedMoves || [])]) {
      if (!entry.approachFor) continue;
      hidden++;
      const quote = enemyMoveQuote(def.moves[entry.approachFor], { enemy, moveId: entry.approachFor, combat });
      assert.ok(quote.totalSp <= pool, `${id} seed ${seed}: ${entry.approachFor} costs ${quote.totalSp} of ${pool}`);
    }
  }
  assert.ok(hidden > 0, 'some enemy hides an attack behind the step forward');
});

test('the planner itself queues a back-row melee opener as the step forward (no later re-plan needed)', () => {
  const combat = bandsFight({ enemyIds: ['fellWarden', 'wanderingSoldier'], seed: 1, encounter: { id: 'x', rows: ['back', 'front'] } });
  const [enemy] = combat.enemies, def = registries.enemies.get('fellWarden');
  const queue = extendEnemyQueue({ ...enemy, movesHistory: [] }, def, [], { isFirstTurn: true, pick: () => null, combat });
  assert.equal(queue[0].moveId, 'advance');
  assert.equal(queue[0].approachFor, 'caneStrike');
});

test('retreat hold: a lone enemy sent back by Retreat shows the step forward (it cannot reach this phase), and the move done is the move shown', () => {
  let held = 0;
  for (const seed of seeds) {
    const combat = bandsFight({ enemyIds: ['wanderingSoldier'], seed, hand: ['core.retreat'] });
    const soldier = combat.enemies[0];
    play(combat, 'qa0');
    assert.equal(soldier.row, 'back');
    assert.equal(soldier.statuses.retreat?.stacks, 1);
    const shown = soldier.intent.moveId;
    if (soldier.intent.approachFor) { held++; assert.equal(shown, 'advance', `seed ${seed}: a held melee enemy shows the step forward`); }
    const before = combat.eventLog.filter(e => e.type === 'enemyMoveStarted').length;
    dispatch(combat, { type: 'endTurn' });
    assert.equal(combat.eventLog.filter(e => e.type === 'enemyMoveStarted')[before]?.moveId, shown, `seed ${seed}: the move done is the move shown`);
  }
  assert.ok(held > 0, 'at least one seed rolls a melee attack that becomes the step forward');
});
