// A snapshot saved before the Focus Mana discount stores the printed manaCost on a pending reaction option; answering must pay the live price.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const registries = createRegistries({ ...contentBundle,
  enemies: contentBundle.enemies.map(e => e.id === 'wanderingSoldier'
    ? { ...e, firstMove: 'slash', equipmentSp: 0, moves: { slash: { intent: 'attack', damage: 1, hits: 1, weight: 1,
      tags: ['camp:physical', 'maneuver:attack', 'range:melee', 'targeting:single'] } } } : e) });

test('a snapshot paused on a Mana reaction with the printed manaCost still answers, at the Focus price', () => {
  const run = createRunState({ registries, classId: 'reaver', seed: 7 });
  run.loadout.sets.rightHand[0] = 'boneSceptre';
  run.loadout.sets.leftHand[0] = null;
  run.loadout.active.rightHand = 0; run.loadout.active.leftHand = 0;
  const combat = createCombat({ registries, rng: createRng(701), combatExpansionVersion: 2, reactionRulesVersion: 1,
    enemyIds: ['wanderingSoldier'], player: { id: 'player', classId: 'reaver', loadout: run.loadout, maxHp: 100, hp: 100, maxMana: 20, mana: 20,
      maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 1, deck: [{ cardId: 'guardCounter', instanceId: 'r0', upgraded: false }] } });
  combat.player.block = 100;
  dispatch(combat, { type: 'endTurn' });
  const option = combat.pendingReaction.options.find(row => row.id === 'r0:1:default');
  assert.ok(option, 'the Mana reaction card is offered');
  assert.equal(option.manaCost, 1, 'live price is the printed 2 minus the Focus discount');
  const snapshot = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const stored = snapshot.pendingReaction.options.find(row => row.id === option.id);
  stored.manaCost = option.manaCost + 1; // what a pre-deploy save holds: the printed cost
  const restored = restoreCombatSnapshot({ registries, rng: createRng(combat.rng.seed, combat.rng.getCounters()), snapshot });
  const before = restored.player.mana;
  dispatch(restored, { type: 'chooseReaction', offerId: restored.pendingReaction.id, optionId: option.id });
  assert.equal(before - restored.player.mana, 1, 'pays the discounted price, not the stale one');
});
