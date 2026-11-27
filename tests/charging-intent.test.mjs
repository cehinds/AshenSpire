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

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: {
  baseDamageMultiplier: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1,
  enemyDamageMultiplier: 1, blockGainMultiplier: 1, strengthDamageWeight: 0, dexterityBlockWeight: 0,
} } });
const baseReg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const CHARGER = 'fixture.chargingOrganist';
const move = (id, extra = {}) => ({ id, enemyId: CHARGER, intent: 'attack', damage: 8, sp: 1, weight: 1,
  tags: ['camp:physical', 'maneuver:attack', 'range:melee'], ...extra });
const definition = { id: CHARGER, name: 'Charging fixture', hp: [1000, 1000], poiseMax: 0, spPool: 1,
  attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 },
  levelProfile: { min: 1, max: 1 }, firstMove: 'funeralChord', startingRange: 'melee',
  moves: { funeralChord: move('funeralChord', { delay: { turns: 1, whileCharging: { block: 5 } } }),
    bonePrelude: move('bonePrelude') } };
const reg = { ...baseReg, enemies: { ...baseReg.enemies,
  get: id => id === CHARGER ? definition : baseReg.enemies.get(id),
  has: id => id === CHARGER || baseReg.enemies.has(id) } };
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };

// Both moves and their one-turn delay are explicit mechanics operands.
function chargingFight(enemyIds = [CHARGER]) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 11, profileMeta: META });
  run.relics = [];
  run.loadout = { sets: { rightHand: [null], leftHand: [null], armor: [null] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  const combat = createRunCombat({ registries: reg, run, rng: createRng(11), enemyIds });
  combat.fixCoreRules.stance = { ...combat.fixCoreRules.stance, effectivenessMultiplier: 1 };
  combat.fixCoreRules.accuracy = { ...combat.fixCoreRules.accuracy, hitRoll: false };
  combat.player.critRules = [];
  return combat;
}
function organist() {
  const combat = chargingFight();
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
  const shownBlock = EnemyChargingState(combat, enemy).block;
  assert.equal(shownBlock, 5, 'the controlled 5-Block charge grants exactly 5 before UI projection');
  assert.deepEqual(intent.charging, { moveId: 'funeralChord', turnsLeft: 1, block: shownBlock });
  const shown = combatIntentPresentation(intent);
  assert.equal(shown.title, t('combat.intent.charging'));
  assert.equal(shown.damageClass, null, 'not tinted as incoming damage');
  assert.equal(shown.projectedDamage, undefined);
  const attack = shown.parts.find(part => part.icon === 'attack');
  assert.equal(attack.valueKind, 'later', 'the number is the later one');
  assert.match(attack.note, /1 turn/);
  assert.deepEqual(shown.parts.find(part => part.icon === 'defend'), { icon: 'defend', value: String(shownBlock) }, 'the Block it gains this turn');
  assert.ok(shown.parts.every(part => part.valueKind === 'later' || part.icon === 'defend'), 'no part reads as current damage');
  // The tooltip says the same.
  const read = enemyIntentRead(combat, enemy, { preview: intent });
  assert.match(read.detail, /Charging: \S+ HP lands in 1 turn\./);
  assert.ok(read.detail.includes(`Gains ${shownBlock} Block this turn.`));
});

test('a charging turn takes no HP, and the next turn the move lands as an attack whose number is the HP lost', () => {
  const { combat, enemy } = organist();
  const hp = combat.player.hp;
  const shownBlock = projectCombatIntent(combat, enemy.id).charging.block;
  const eventIndex = combat.eventLog.length;
  dispatch(combat, { type: 'endTurn' });
  while (combat.pendingReaction) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  assert.equal(combat.player.hp, hp, 'the charging turn cost the player nothing');
  const blockGains = combat.eventLog.slice(eventIndex).filter(event =>
    event.type === 'blockGained' && event.targetId === enemy.id);
  assert.deepEqual(blockGains.map(event => event.amount), [shownBlock], 'the forecast matches the Block gained at commitment');
  assert.equal(enemy.block, shownBlock);
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

// Review finding (2026-11-14): a charging enemy ahead of another must not count in the later enemy's number; its move lands nothing this turn.
test('a charging enemy earlier in the order does not spend the player\'s Block in a later enemy\'s intent', () => {
  const combat = chargingFight([CHARGER, CHARGER]);
  const [first, second] = combat.enemies;
  const def = reg.enemies.get(first.enemyId);
  const charging = { kind: 'attack', moveId: 'funeralChord', damage: def.moves.funeralChord.damage, hits: 1, block: null, delayed: true, pending: false };
  for (const enemy of combat.enemies) { enemy.intent = { ...charging }; enemy.plannedMoves = []; enemy.planDue = true; }
  combat.player.hp = 100; combat.player.maxHp = 100; combat.player.block = 12;
  const withCharger = projectCombatIntent(combat, second.id);
  first.alive = false;
  const alone = projectCombatIntent(combat, second.id);
  first.alive = true;
  assert.deepEqual(withCharger.charging, alone.charging, 'the later enemy reads the same whether or not an earlier one is charging');
  assert.equal(JSON.stringify(withCharger), JSON.stringify(alone));
});

// Owner 2026-11-15, "icon + turn pip": the charging move renders its icon, the landing number (dimmed, never 0) and an hourglass badge with the turns
// left; the sentence is the aria-label (and the tooltip's lead line), not HUD text.
test('a charging part renders the icon, the later number and a turns pip, with no sentence on the HUD', async () => {
  const { withKitDom } = await import('./helpers/kit-dom.mjs');
  const { intentParts } = await import('../src/ui/components/combatantOverhead.js');
  const { combat, enemy } = organist();
  const shown = combatIntentPresentation(projectCombatIntent(combat, enemy.id));
  const attack = shown.parts.find(part => part.valueKind === 'later');
  assert.equal(attack.turns, 1, 'the part carries the turns left');
  withKitDom(() => {
    const row = intentParts(shown.parts);
    const group = row.querySelector('.intent-action[data-charging="true"]');
    assert.ok(group, 'the charging group is marked');
    assert.equal(group.querySelector('.intent-action-value')?.textContent, String(attack.value));
    assert.notEqual(group.querySelector('.intent-action-value')?.textContent, '0');
    assert.equal(group.querySelector('.intent-later-turns')?.textContent, '1');
    assert.equal(row.querySelector('.intent-later-note'), null, 'no "Charging" sentence on the HUD');
    assert.equal(group.getAttribute('aria-label'), attack.summary, 'the sentence is the label');
  });
});
