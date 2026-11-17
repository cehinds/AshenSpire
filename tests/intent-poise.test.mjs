// Owner, 2026-11-17: "it's hard for the player to know how much poise damage they are taking from an attack." Each attacking intent now carries the
// Poise the player loses to it (projectedPoise, src/engine/enemyIntentProjection.js), forecast through the same receipts as the HP number. These
// cases play the turn live and require the forecast to equal the Poise each enemy's move actually took, and its BREAK to equal a live break.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { previewEnemyAction } from '../src/engine/enemyActionPreview.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

/** A fight against `moves` ([enemyId, moveId] each, in turn order) with the player holding `poise` Poise and `block` Block in `stance`. */
function fight(moves, { poise = 12, block = 0, stance = null, ward = 0, hp = 500 } = {}) {
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: moves.map(([enemyId]) => enemyId) });
  dispatch(combat, { type: 'setReactions', enabled: false });
  const player = combat.player;
  Object.assign(player, { hp, maxHp: hp, block, persistentPoise: { value: poise, max: Math.max(poise, 8) }, statuses: ward ? { ward: { stacks: ward } } : {} });
  if (stance) player.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' }; else delete player.combatStance;
  combat.enemies.forEach((enemy, i) => {
    const [enemyId, moveId] = moves[i];
    const move = registries.enemies.get(enemyId).moves[moveId];
    const projection = previewEnemyAction(combat, enemy, moveId);
    enemy.intent = { kind: move.intent, moveId, damage: move.damage ?? null, hits: move.hits ?? 1, combatProfile: projection.profile };
    Object.assign(enemy, { intentRevealed: true, actorIntentRevealed: true, plannedMoves: [], planDue: false, maxStamina: 100, stamina: 100 });
  });
  return combat;
}

/** Each enemy's forecast, then the turn played live: the Poise each move took and whether it broke the player's Poise. */
function forecastAndPlay(combat) {
  const forecast = combat.enemies.map(enemy => projectCombatIntent(combat, enemy.id).projectedPoise);
  // The turn runs on a transaction candidate (dispatch), which keeps the event door `_emitEvent`; wrap that door and read the candidate it is handed.
  const live = new Map(), door = combat._emitEvent;
  let before = null;
  combat._emitEvent = function (ctx, type, payload) {
    if (type === 'enemyMoveStarted' && !payload?.reaction) before = ctx.player.persistentPoise.value;
    const out = door.apply(this, arguments);
    if (type === 'enemyMoveEnded' && before !== null) {
      const after = ctx.player.persistentPoise.value;
      live.set(payload.sourceId, { lost: before - after, broke: before > 0 && after === 0 });
      before = null;
    }
    return out;
  };
  dispatch(combat, { type: 'endTurn' });
  combat._emitEvent = door;
  return combat.enemies.map((enemy, i) => ({ forecast: forecast[i], live: live.get(enemy.id) }));
}

function expectMatch(rows, label, { someLoss = true } = {}) {
  if (someLoss) assert.ok(rows.some(row => row.live?.lost > 0), `${label}: some Poise is really lost, so the comparison means something`);
  rows.forEach(({ forecast, live }, i) => {
    assert.ok(forecast, `${label} #${i + 1}: the intent carries a Poise forecast`);
    assert.ok(live, `${label} #${i + 1}: the move played`);
    assert.equal(forecast.min, forecast.max, `${label} #${i + 1}: a certain forecast`);
    assert.equal(forecast.max, live.lost, `${label} #${i + 1}: forecast Poise = Poise lost live`);
    assert.equal(forecast.breaks, live.broke, `${label} #${i + 1}: BREAK exactly when live breaks`);
  });
}

test('a plain attack: the intent Poise is the Poise the hit takes', () => {
  expectMatch(forecastAndPlay(fight([['wanderingSoldier', 'slash']])), 'slash');
});

test('an attack that empties the player Poise is marked BREAK', () => {
  const rows = forecastAndPlay(fight([['wanderingSoldier', 'slash']], { poise: 3 }));
  expectMatch(rows, 'slash into 3 Poise');
  assert.equal(rows[0].forecast.breaks, true);
});

test('Block in front: the forecast spends Block first, as live does', () => {
  for (const block of [3, 10, 40]) expectMatch(forecastAndPlay(fight([['wanderingSoldier', 'slash']], { block })), `Block ${block}`, { someLoss: block < 19 });
});

test('Defend stance with Block keeps the 1 Poise floor in the forecast', () => {
  const rows = forecastAndPlay(fight([['wanderingSoldier', 'slash']], { poise: 3, block: 2, stance: 'defend' }));
  expectMatch(rows, 'Defend floor');
  assert.equal(rows[0].forecast.breaks, false);
});

test('Ward against magic: a spell meets the Ward lane in the forecast as live', () => {
  for (const ward of [0, 2]) expectMatch(forecastAndPlay(fight([['lanternMoth', 'wingSparks']], { ward })), `wingSparks, Ward ${ward}`);
});

test('multi-hit moves: every hit Poise is counted, hit after hit', () => {
  for (const [enemyId, moveId] of [['fellWarden', 'twinDaggers'], ['bellKeeper', 'crackedPeal'], ['blightHound', 'lunge']]) {
    for (const poise of [4, 20]) expectMatch(forecastAndPlay(fight([[enemyId, moveId]], { poise })), `${enemyId}/${moveId}, Poise ${poise}`);
  }
});

test('several enemies in one turn: each later intent is priced after the earlier ones', () => {
  for (const poise of [6, 30]) {
    expectMatch(forecastAndPlay(fight([['wanderingSoldier', 'slash'], ['fellWarden', 'twinDaggers'], ['wanderingSoldier', 'slash']], { poise })), `three attackers, Poise ${poise}`);
  }
});

import { combatIntentPresentation, IntentPoiseRead } from '../src/ui/models/CombatIntentModel.js';

test('the intent presentation puts the Poise beside the attack number, with a plain sentence and BREAK', () => {
  const combat = fight([['wanderingSoldier', 'slash']], { poise: 3 });
  const intent = projectCombatIntent(combat, combat.enemies[0].id);
  const shown = combatIntentPresentation(intent);
  const head = shown.parts[0];
  assert.equal(head.icon, 'attack');
  assert.equal(head.poise.value, intent.projectedPoise.label);
  assert.equal(head.poise.breaks, true);
  assert.equal(IntentPoiseRead(intent).summary, `${intent.projectedDamage.label} damage, ${intent.projectedPoise.label} Poise (breaks your Poise)`);
  const calm = fight([['wanderingSoldier', 'slash']], { poise: 30 });
  const read = IntentPoiseRead(projectCombatIntent(calm, calm.enemies[0].id));
  assert.equal(read.breaks, false);
  assert.doesNotMatch(read.summary, /break/, 'no break note when Poise holds');
  assert.doesNotMatch(read.summary, /—/, 'no em dashes');
});

test('no Poise mark when the attack costs no Poise, or the intent is hidden', () => {
  const combat = fight([['wanderingSoldier', 'slash']], { block: 60 });
  assert.equal(IntentPoiseRead(projectCombatIntent(combat, combat.enemies[0].id)), null);
  assert.equal(IntentPoiseRead({ hidden: true, projectedPoise: { max: 3, label: '3' } }), null);
});
