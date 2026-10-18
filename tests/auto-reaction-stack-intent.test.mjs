import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { chooseReaction, perceivedManeuver } from '../src/model/autoCombatPolicy.js';
import { stackedEnemyReactionIntent } from '../src/ui/models/ReactionIncomingModel.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';

// Gilded Knight's Gilded Guard (a defend reaction move) stacks before a heavy player hit.
const strikeDef = contentBundle.cards.find(card => card.id === 'strike');
const heavyDef = { ...strikeDef, id: 'heavyStrike', name: 'Heavy Strike', effects: [{ op: 'damage', target: 'enemy', amount: 12 }] };
const strikeTags = contentBundle.tagging.filter(row => row.family === 'card' && row.objectId === 'strike');
function stacked() {
  const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards, heavyDef],
    tagging: [...contentBundle.tagging, ...strikeTags.map(row => ({ ...row, objectId: 'heavyStrike' })),
      { family: 'card', scope: '', objectId: 'strike', tagId: 'trait:reaction' }] });
  const combat = createCombat({ registries, rng: createRng(5), combatExpansionVersion: 2, reactionRulesVersion: 2, enemyIds: ['gildedKnight'],
    player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2,
      deck: ['heavyStrike', 'strike'].map((cardId, index) => ({ cardId, instanceId: `c${index}`, upgraded: false })) } });
  combat.player.block = 100;
  dispatch(combat, { type: 'playCard', cardInstanceId: 'c0', targetId: combat.enemies[0].id });
  return combat;
}

test('a prompt answering a stacked enemy reaction reads the stack move, not the normal intent', () => {
  const combat = stacked();
  const knight = combat.enemies[0];
  const entry = combat.reactionStack.entries.find(row => row.side === 'enemy');
  assert.equal(entry.moveId, 'gildedGuard');
  const pending = { groupKey: combat.reactionStack.groupKey, sourceId: knight.id };
  const stackRead = stackedEnemyReactionIntent(combat, pending, 'player');
  assert.equal(perceivedManeuver(stackRead), 'defend');
  // The separately selected normal intent is a different action.
  assert.notEqual(perceivedManeuver(projectCombatIntent(combat, knight.id)), 'defend');
  const matchups = { attack: ['defend'], defend: ['attack'], counter: ['smash'], evade: ['sweep'] };
  const options = [{ id: 'a', kind: 'defend' }, { id: 'b', kind: 'attack' }];
  const answer = chooseReaction({ matchups, seats: { player: { intent: stackRead } } }, 'player', options);
  assert.equal(answer.id, 'b'); // attack counters the stacked defend
});

test('no stacked enemy entry, or a stack of another root, falls back to the visible intent', () => {
  const combat = stacked();
  const knight = combat.enemies[0];
  assert.equal(stackedEnemyReactionIntent(combat, { groupKey: 'other', sourceId: knight.id }, 'player'), null);
  assert.equal(stackedEnemyReactionIntent(combat, { groupKey: combat.reactionStack.groupKey, sourceId: 'nobody' }, 'player'), null);
  assert.equal(stackedEnemyReactionIntent({ ...combat, reactionStack: undefined }, { groupKey: 'x', sourceId: knight.id }, 'player'), null);
});

test('a stack move that cannot be read is unknown, never guessed', () => {
  const combat = stacked();
  const knight = combat.enemies[0];
  combat.reactionStack.entries.find(row => row.side === 'enemy').moveId = 'missingMove';
  const read = stackedEnemyReactionIntent(combat, { groupKey: combat.reactionStack.groupKey, sourceId: knight.id }, 'player');
  assert.equal(perceivedManeuver(read), null);
});

// A loaded fight's stance ledger is rebuilt from the restored eventLog (the last-stance fallback survives a reload).
test('a fresh ledger replays a restored eventLog to each seat\'s last confirmed card kind', async () => {
  const { createStanceLedger, kindForCard } = await import('../src/model/alternativeStance.js');
  const log = [
    { type: 'combatStarted' },
    { type: 'cardPlayed', playerId: 'p1', cardId: 'strike', cardType: 'attack', cardTags: [] },
    { type: 'damageDealt', sourceId: 'p1' },
    { type: 'cardPlayed', playerId: 'p2', cardId: 'defend', cardType: 'skill', cardTags: [] },
  ];
  const live = createStanceLedger(kindForCard);
  for (const e of log) live.accept(e);
  const restored = createStanceLedger(kindForCard);
  restored.replay(log, () => { throw new Error('resolver failure falls back to the receipt'); });
  assert.deepEqual(restored.get('p1'), live.get('p1'));
  assert.deepEqual(restored.get('p2'), live.get('p2'));
  assert.notEqual(restored.get('p1'), null);
});

test('counter and defend cards carry a maneuver through their combat profile (kindForCard alone returns null)', async () => {
  const { combatProfileFor } = await import('../src/model/combatCardProfile.js');
  for (const id of ['frostCounter', 'fireCounter', 'crystalBarrier', 'frostVeil']) {
    const maneuver = combatProfileFor({ cardId: id })?.maneuver;
    assert.ok(maneuver, `${id} has a maneuver`);
  }
});
