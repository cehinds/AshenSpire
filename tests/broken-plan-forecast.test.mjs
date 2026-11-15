// A Broken enemy (poise.breakRule "broken") loses only the head of its plan: the follow-ups still play this turn. They are shown on its
// intent and counted in a later enemy's forecast (shown = dealt). A Staggered enemy that skips its whole turn shows none.
//   node --test tests/broken-plan-forecast.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';
import { drainFixCorePoise } from '../src/engine/actions.js';
import { enemyPlanActions } from '../src/engine/normalPreview.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

function fight(seed, enemyIds) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed, profileMeta: META });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds });
  return combat;
}

test('a Broken enemy shows its follow-ups after the lost head', () => {
  let shown = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const combat = fight(seed, ['fellWarden']); const boss = combat.enemies[0];
    const plan = boss.plannedMoves.map(row => row.moveId);
    drainFixCorePoise(combat, combat.player, boss, 999);
    assert.equal(boss.intent.kind, 'staggered', 'the intent still reads Broken');
    const cards = enemyPlanActions(combat, boss);
    if (!plan.length) { assert.deepEqual(cards, []); continue; }
    assert.deepEqual(cards.slice(1).map(card => card.id), plan, `seed ${seed}: the plan behind the lost head is shown`);
    shown++;
  }
  assert.ok(shown > 0, 'some seed has a planned follow-up');
});

test('a Staggered enemy that skips its turn (not Broken) still shows no follow-ups', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const combat = fight(seed, ['fellWarden']); const boss = combat.enemies[0];
    Object.assign(boss, { intent: { kind: 'staggered', moveId: null }, skipNextTurn: true });
    assert.equal(boss.broken, undefined);
    assert.deepEqual(enemyPlanActions(combat, boss), []);
  }
});

test('a later enemy forecast after a Broken enemy with follow-ups equals the HP lost', () => {
  let checked = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const combat = fight(seed, ['fellWarden', 'wanderingSoldier']); const [boss, soldier] = combat.enemies;
    if (!boss.plannedMoves?.length || soldier.intent?.kind !== 'attack') continue;
    Object.assign(combat.player, { hp: 400, maxHp: 400, block: 0 });
    drainFixCorePoise(combat, combat.player, boss, 999);
    const shown = projectCombatIntent(combat, soldier.id)?.projectedDamage;
    if (!shown || shown.min !== shown.max) continue;
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    for (let safety = 0; combat.pendingReaction && safety < 20; safety++) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const events = combat.eventLog.slice(start);
    const bossHit = events.some(e => e.type === 'damageDealt' && e.sourceId === boss.id && e.targetId === 'player');
    const lost = events.filter(e => e.type === 'damageDealt' && e.sourceId === soldier.id && e.targetId === 'player').reduce((n, e) => n + e.hpLoss, 0);
    assert.equal(lost, shown.max, `seed ${seed}: the soldier was shown at ${shown.max} and cost ${lost} (the Broken boss ${bossHit ? 'hit' : 'did not hit'} first)`);
    if (bossHit) checked++;
  }
  assert.ok(checked > 0, 'a Broken boss with follow-ups hit the player in some seed');
});
