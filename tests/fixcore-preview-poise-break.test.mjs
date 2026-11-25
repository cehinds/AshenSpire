// Core 2 (owner D13): Poise damage a card deals mid-card can break Poise, and the Staggered stance and its Vulnerable
// land before the card's later hits. The preview mirrors that on its detached target state, so the card face and the
// dispatched play agree (Codex P1, PR #2164: Astral Cleave's Starstone branch previewed [11, 6] but dealt [11, 8]).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { applyStatus } from '../src/engine/statuses.js';
import { damagePreviewState, previewPoiseDrain } from '../src/engine/combatDamagePreview.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fight(poise) {
  const run = createRunState({ registries: reg, classId: 'starseer', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 500, maxHp: 500, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: poise, max: Math.max(20, poise) }, attributes: { dexterity: 0 } });
  // Neutral stance has its own damage-taken bonus, which would mask the applied Vulnerable.
  enemy.combatStance = { maneuver: 'attack', camp: 'physical', range: 'melee' };
  delete enemy.combatCounter;
  combat.player.energy = 9; combat.player.mana = 9;
  applyStatus(combat, combat.player, 'starstoneCharge', 1);
  const card = combat.piles.hand[0];
  card.cardId = 'astralCleave'; card.upgraded = false;
  return { combat, enemy, id: card.instanceId };
}
const damageRows = (combat, id, enemy) => previewCard(combat, id, enemy.id).values.filter(v => v.op === 'damage');
function previewAndPlay(poise) {
  const f = fight(poise);
  primeAccuracyRolls(f.combat);
  const poiseBefore = f.enemy.persistentPoise.value;
  const rows = damageRows(f.combat, f.id, f.enemy);
  // Owner, 2026-11-14: hitDamages is the HP lost per hit, the same as the receipt's hpLoss, which is what live must deal.
  const shown = rows.map(v => v.damageReceipt.hits.map(hit => hit.hpLoss));
  // Owner, 2026-11-14 (face rule): `hitDamages` is now the card FACE (attacker side); the per-target quote is `perTargetHitDamages`.
  const shownRaw = rows.map(v => v.perTargetHitDamages[f.enemy.id]);
  assert.equal(f.enemy.persistentPoise.value, poiseBefore, 'preview leaves the real Poise alone');
  assert.equal(f.enemy.combatStance.maneuver, 'attack', 'preview leaves the real stance alone');
  dispatch(f.combat, { type: 'playCard', cardInstanceId: f.id, targetId: f.enemy.id });
  const landed = f.combat.eventLog.filter(row => row.type === 'damageDealt' && row.targetId === f.enemy.id);
  const dealt = landed.map(row => row.hpLoss);
  const breaks = f.combat.eventLog.findIndex(row => row.type === 'poiseBroken' && row.targetId === f.enemy.id);
  const betweenHits = breaks > f.combat.eventLog.indexOf(landed[0]) && breaks < f.combat.eventLog.indexOf(landed[1]);
  return { shown, shownRaw, dealt, betweenHits, incoming: landed.map(row => row.damageReceipt.hits[0].incoming), enemy: f.enemy };
}

test('Poise broken by a mid-card Poise payload: later hits preview with the Staggered Vulnerable, as live', () => {
  const r = previewAndPlay(9);
  assert.equal(r.enemy.combatStance?.maneuver, 'staggered', 'live play broke Poise');
  assert.ok(r.betweenHits, 'the payload breaks Poise after the first contact and before the second');
  assert.deepEqual(r.shown.flat(), r.dealt, 'preview HP loss equals live hit for hit');
  assert.deepEqual(r.shownRaw.flat(), r.dealt, 'and the quote equals the live HP loss, Staggered Vulnerable included');
  const unbroken = previewAndPlay(120);
  assert.ok(r.incoming[1] > unbroken.incoming[1], 'the live full hit of the second hit carries the Staggered Vulnerable');
  assert.equal(r.dealt.length, 2);
  assert.ok(r.dealt[1] > unbroken.dealt[1], 'the second hit carries the Staggered Vulnerable (x1.25)');
});
// A large starting pool survives the two contacts and the explicit mid-card Poise payload.
test('Poise that survives the payload: preview unchanged and equal to live', () => {
  const r = previewAndPlay(120);
  assert.notEqual(r.enemy.combatStance?.maneuver, 'staggered');
  assert.deepEqual(r.shown.flat(), r.dealt);
  assert.deepEqual(r.shownRaw.flat(), r.dealt);
});
test('Current profile: no Core Poise pool, so the preview drain does nothing', () => {
  const ctx = { turn: 1 }, enemy = { id: 'e', kind: 'enemy', alive: true, hp: 10, statuses: {}, persistentPoise: { value: 3, max: 3 } };
  const state = damagePreviewState(ctx, enemy);
  assert.equal(previewPoiseDrain(ctx, { id: 'p' }, state, { op: 'poiseDamage' }, {}, 8), 0);
  assert.equal(state.defender.persistentPoise.value, 3);
  assert.equal(state.defender.combatStance, undefined);
});
