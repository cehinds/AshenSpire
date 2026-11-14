// Owner, 2026-11-14 (Wave 2, rule 1): a delayed move shows no current-damage number on the turns it does not land. It reads "Charging", the
// turns left and the Block it gains now, with its number as the later one; the turn it lands it reads as the attack it is.
//   node --test tests/charging-intent.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { EnemyChargingState } from '../src/engine/enemyCharging.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { combatIntentPresentation } from '../src/ui/models/CombatIntentModel.js';
import { enemyIntentRead } from '../src/ui/models/EnemyIntentReadModel.js';
import { t } from '../src/ui/strings.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

// A Marrow Organist whose head move is its delayed funeralChord (`delay: { turns: 1, whileCharging: { block: 5 } }`).
function organist() {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 11, profileMeta: META });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(11), enemyIds: ['marrowOrganist'] });
  const enemy = combat.enemies[0];
  const def = reg.enemies.get(enemy.enemyId);
  assert.ok(def.moves.funeralChord.delay, 'funeralChord is a delayed move');
  enemy.intent = { kind: 'attack', moveId: 'funeralChord', damage: def.moves.funeralChord.damage, hits: 1, block: null, delayed: true, pending: false };
  enemy.plannedMoves = []; enemy.planDue = true;
  combat.player.hp = 100; combat.player.maxHp = 100; combat.player.block = 0;
  return { combat, enemy };
}

test('the turn a delayed move commits: charging, turns left, the Block it gains, and its number as the later one', () => {
  const { combat, enemy } = organist();
  const intent = projectCombatIntent(combat, enemy.id);
  assert.deepEqual(intent.charging, { moveId: 'funeralChord', turnsLeft: 1, block: 5 });
  const shown = combatIntentPresentation(intent);
  assert.equal(shown.title, t('combat.intent.charging'));
  assert.equal(shown.damageClass, null, 'not tinted as incoming damage');
  assert.equal(shown.projectedDamage, undefined);
  const attack = shown.parts.find(part => part.icon === 'attack');
  assert.equal(attack.valueKind, 'later', 'the number is the later one');
  assert.match(attack.note, /1 turn/);
  assert.deepEqual(shown.parts.find(part => part.icon === 'defend'), { icon: 'defend', value: '5' }, 'the Block it gains this turn');
  assert.ok(shown.parts.every(part => part.valueKind === 'later' || part.icon === 'defend'), 'no part reads as current damage');
  // The tooltip says the same.
  const read = enemyIntentRead(combat, enemy, { preview: intent });
  assert.match(read.detail, /Charging: \S+ HP lands in 1 turn\./);
  assert.match(read.detail, /Gains 5 Block this turn\./);
});

test('a charging turn takes no HP, and the next turn the move lands as an attack whose number is the HP lost', () => {
  const { combat, enemy } = organist();
  const hp = combat.player.hp;
  dispatch(combat, { type: 'endTurn' });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  assert.equal(combat.player.hp, hp, 'the charging turn cost the player nothing');
  assert.equal(enemy.block >= 5, true, 'the Block was gained now');
  assert.ok(enemy.pendingMove, 'the move is committed');
  // Landing turn: an ordinary attack, no charging state.
  const landing = projectCombatIntent(combat, enemy.id);
  assert.equal(landing.charging, undefined);
  assert.equal(EnemyChargingState(combat, enemy), null);
  const shown = combatIntentPresentation(landing);
  assert.equal(shown.stance, 'attacking');
  const number = Number(shown.parts.find(part => part.icon === 'attack').value);
  assert.ok(number > 0);
  dispatch(combat, { type: 'endTurn' });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  assert.equal(hp - combat.player.hp, number, 'the HP lost is the number the landing turn showed');
});

test('a committed move with turns still to wait stays charging, and gains no second Block', () => {
  const { combat, enemy } = organist();
  enemy.pendingMove = { moveId: 'funeralChord', resolveOnTurn: combat.turn + 2 };
  enemy.intent = { ...enemy.intent, pending: true };
  const charging = projectCombatIntent(combat, enemy.id).charging;
  assert.deepEqual(charging, { moveId: 'funeralChord', turnsLeft: 2, block: null });
  assert.match(combatIntentPresentation(projectCombatIntent(combat, enemy.id)).parts.at(-1).note, /2 turns/);
  enemy.pendingMove.resolveOnTurn = combat.turn;
  assert.equal(projectCombatIntent(combat, enemy.id).charging, undefined, 'it lands this coming enemy phase');
});

test('a move with no delay is never charging', () => {
  const { combat, enemy } = organist();
  enemy.intent = { kind: 'attack', moveId: 'bonePrelude', damage: 6, hits: 1, block: null, delayed: false, pending: false };
  assert.equal(projectCombatIntent(combat, enemy.id).charging, undefined);
});
