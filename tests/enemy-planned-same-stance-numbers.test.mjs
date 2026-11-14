// Owner, 2026-11-14: "if an enemy is planning to do the same stance action during their turn, instead of just showing the number of leading
// action, it should show the number for all of them." Each planned follow-up of the same stance carries the HP the player loses from it,
// given what the actions before it did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { ProjectPlannedMoveDamage } from '../src/engine/enemyIntentProjection.js';
import { SameStanceNumbers } from '../src/ui/models/CombatIntentModel.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

function fight(block) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 7, profileMeta: META });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(7), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 400, maxHp: 400, statuses: {}, planDue: true, skipNextTurn: false, maxStamina: 12, stamina: 12, fixCoreStaminaRemaining: 12 });
  enemy.intent = { ...enemy.intent, kind: 'attack', moveId: 'slash', damage: 8, hits: 1 };
  enemy.plannedMoves = [{ moveId: 'slash', sp: 1 }, { moveId: 'slash', sp: 1 }];
  Object.assign(combat.player, { block, hp: 100, maxHp: 100, statuses: {} });
  return { combat, enemy };
}

test('every same-stance attack in the plan shows the HP the player loses from it, in order', () => {
  for (const block of [0, 3, 6, 10, 13, 20]) {
    const { combat, enemy } = fight(block);
    const head = projectCombatIntent(combat, enemy.id).projectedDamage;
    const shown = [head.max, ProjectPlannedMoveDamage(combat, enemy, 0)?.max, ProjectPlannedMoveDamage(combat, enemy, 1)?.max];
    assert.ok(shown.every(Number.isFinite), `block ${block}: every action has a number (${shown})`);
    const start = combat.eventLog.length;
    dispatch(combat, { type: 'endTurn' });
    while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
    const lost = combat.eventLog.slice(start).filter(event => event.type === 'damageDealt' && event.sourceId === enemy.id && event.targetId === 'player').map(event => event.hpLoss);
    assert.deepEqual(lost.slice(0, 3), shown, `block ${block}: the numbers shown are the HP lost by each action`);
  }
});

test('only the unbroken run of the head\'s own stance gets a number', () => {
  const symbols = [{ kind: 'action', icon: 'attack' }, { kind: 'action', icon: 'defend' }, { kind: 'action', icon: 'attack' }];
  const values = SameStanceNumbers({ icon: 'attack', value: '8' }, symbols, i => ({ label: String([12, 5, 7][i]) }));
  assert.deepEqual(values.map(symbol => symbol.value ?? null), ['12', null, null]);
  assert.deepEqual(values.map(symbol => symbol.icon ?? null), ['attack', 'defend', 'attack']);
  const spell = SameStanceNumbers({ icon: 'cast', value: '16' }, symbols, i => ({ label: String([12, 5, 7][i]) }));
  assert.equal(spell[0].value, '12', 'a damaging spell head is an attack stance');
  const hidden = SameStanceNumbers({ icon: 'attack', value: '8' }, [{ kind: 'unknown' }, { kind: 'action', icon: 'attack' }], () => ({ label: '9' }));
  assert.equal(hidden.every(symbol => symbol.value == null), true, 'an unread follow-up shows no number, and ends the run');
  const charging = SameStanceNumbers({ icon: 'attack', value: '8', valueKind: 'later' }, symbols, () => ({ label: '9' }));
  assert.equal(charging.every(symbol => symbol.value == null), true, 'a Charging head keeps its presentation');
});
