import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState } from '../src/model/state.js';
import { previewIntent, dispatch } from '../src/engine/combat.js';
import { previewEnemyAction } from '../src/engine/enemyActionPreview.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { createRegistries } from '../src/model/registries.js';
import { enemyMoveCards } from '../src/model/enemyMoveCards.js';
import { enemyDeckInspection } from '../src/ui/models/EnemyDeckInspectionModel.js';
import { projectCombatantInspector, previewMeters } from '../src/ui/models/CombatantInspectorSections.js';

function fixture(enemyId = 'wanderingSoldier') {
  const gameProfile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, gameProfile)), gameProfile);
  const combat = { gameProfile, registries, combatExpansionVersion: 2 };
  const enemy = { enemyId, performedMoves: ['warcry', 'slash'], statuses: {} };
  const def = registries.enemies.get(enemyId);
  const preview = { moveId: 'guard', hidden: false, block: 7 };
  const moves = enemyMoveCards(def, { enemy, preview, registries });
  return { combat, enemy, moves, preview };
}

test('enemy deck uses the actual authored membership, names and runtime move prices', () => {
  const f = fixture();
  const before = JSON.stringify(f);
  const read = enemyDeckInspection(f.combat, f.enemy, f.moves, f.preview);
  const authored = gameContent(f.combat, 'enemies').find(row => row.id === f.enemy.enemyId);
  assert.deepEqual(read.cards.map(card => card.cardId), authored.defaultDeck);
  assert.equal(read.current.name, 'Guard');
  assert.equal(read.last.name, 'Slash');
  assert.match(read.last.meta, /Last played.*SP.*MP/);
  assert.equal(read.last.detail, f.moves.find(row => row.moveId === 'slash').detail);
  assert.equal(JSON.stringify(f), before, 'inspection never changes action selection or combat state');
});

test('hidden current action remains unread while the resolved last card remains inspectable', () => {
  const f = fixture();
  const read = enemyDeckInspection(f.combat, f.enemy, f.moves, { ...f.preview, hidden: true });
  assert.equal(read.current, null);
  assert.equal(read.currentHidden, true);
  assert.equal(read.last.moveId, 'slash');
  assert.equal(read.cards.some(card => card.active), false);
  assert.equal(enemyDeckInspection({ registries: f.combat.registries }, f.enemy, f.moves, f.preview), null,
    'legacy move sets must never be presented as invented authored decks');
});

test('SP remains visible at zero in enemy summary, current state and preview', () => {
  const resources = [{ label: 'HP', value: 12, max: 20 }, { label: 'SP', value: 0, max: 4 }];
  const view = projectCombatantInspector({ name: 'Soldier', resources });
  assert.deepEqual(view.sections[0].rows.find(row => row.label === 'SP').value, '0 / 4');
  assert.equal(view.sections.find(row => row.id === 'state').rows.find(row => row.label === 'SP').value, '0 / 4');
  assert.deepEqual(previewMeters(resources).map(row => row.label), ['HP', 'SP']);
});

test('last played uses the committed receipt after live modifiers change', () => {
  const f = fixture();
  f.enemy.id = 'enemy-1';
  f.combat.eventLog = [
    { type: 'enemyMoveStarted', sourceId: 'enemy-1', moveId: 'slash', actionPreview: {
      spCost: 2, totalSp: 3, actionEffects: [{ op: 'damage', target: 'player', amount: 17, hits: 2 }],
    } },
    { type: 'enemyMoveStarted', sourceId: 'someone-else', moveId: 'slash', actionPreview: {
      totalSp: 9, actionEffects: [{ op: 'damage', target: 'player', amount: 100 }],
    } },
  ];
  const read = enemyDeckInspection(f.combat, f.enemy, f.moves, f.preview);
  assert.match(read.last.meta, /Paid 3 SP/);
  assert.match(read.last.detail, /17 × 2 damage/);
  assert.doesNotMatch(read.last.detail, /100/);
  assert.notEqual(read.last.detail, read.cards.find(row => row.last).detail,
    'history is a committed action receipt, not a newly priced preview');
});


test('every registered Core enemy retains its complete authored deck including locked boss actions', () => {
  const { combat: base } = fixture();
  const { registries, gameProfile } = base;
  for (const authored of gameContent(base, 'enemies')) {
    const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'enemy-deck-corpus' });
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: [authored.id] });
    const enemy = combat.enemies[0];
    const moves = enemyMoveCards(registries.enemies.get(authored.id), { enemy, registries });
    const read = enemyDeckInspection(combat, enemy, moves, {});
    assert.deepEqual(read.cards.map(row => row.cardId), [...new Set([...(authored.defaultDeck || []), ...(authored.unlockCards || [])])], authored.id);
    assert.ok(read.cards.every(row => !row.detail.includes('[object Object]') && !row.detail.includes('=>')), authored.id);
  }
});

test('resolved action lists preserve multiple damage effects and expanded pressure without duplicates', () => {
  const definition = { id: 'fixture', moves: { attack: { intent: 'attack', damage: 8, effects: [] } } };
  const actionPreviews = { attack: { actionEffects: [
    { op: 'damage', target: 'player', amount: 8, hits: 2 },
    { op: 'damage', target: 'player', amount: 3 },
    { op: 'poiseDamage', target: 'player', amount: 5 },
    { op: 'heal', target: 'self', amount: 7 },
  ], chargingEffects: [] } };
  const catalog = enemyMoveCards(definition, { actionPreviews })[0];
  assert.match(catalog.detail, /8 × 2 damage/);
  assert.match(catalog.detail, /3 damage/);
  assert.match(catalog.detail, /5 base Poise damage/);
  assert.match(catalog.detail, /Heal self for 7/);
  const current = enemyMoveCards(definition, { actionPreviews, preview: { moveId: 'attack', damage: 6, hits: 2 } })[0];
  assert.match(current.detail, /6 × 2 projected damage/);
  assert.match(current.detail, /3 damage/);
  assert.doesNotMatch(current.detail, /8 × 2 damage/);
});


test('grouped authored deck retains copy counts without inventing draw order', () => {
  const f = fixture();
  const profile = structuredClone(f.combat.gameProfile);
  const authored = profile.content.enemies.find(row => row.id === f.enemy.enemyId);
  authored.defaultDeck = ['wanderingSoldier.slash', 'wanderingSoldier.guard', 'wanderingSoldier.slash'];
  authored.unlockCards = ['wanderingSoldier.guard'];
  f.combat.gameProfile = profile;
  const read = enemyDeckInspection(f.combat, f.enemy, f.moves, f.preview);
  assert.deepEqual(read.cards.map(row => [row.cardId, row.copies]), [['wanderingSoldier.slash', 2], ['wanderingSoldier.guard', 1]]);
  assert.match(read.cards[0].meta, /2 copies/);
  assert.equal(read.cards.reduce((count, row) => count + row.copies, 0), authored.defaultDeck.length);
  assert.equal(read.current.name, 'Guard');
  assert.equal(read.last.name, 'Slash', 'playing one card does not claim all copies were played');
});

test('Core Block and rating modifiers distinguish base payload from projected and executed HP loss', () => {
  const { combat: base } = fixture();
  const { registries } = base;
  const run = createRunState({ registries, classId: 'reaver', seed: 511, runId: 'enemy-damage-basis' });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const enemy = combat.enemies[0];
  for (const entity of [combat.player, enemy]) {
    Object.assign(entity, { hp: 1000, maxHp: 1000, block: 0, barrier: 0, statuses: {}, ratings: {}, ratingSources: [],
      basePrecisionBonus: 1000, attributes: { dexterity: 0 }, persistentPoise: { value: 0, max: 0 } });
    delete entity.combatStance; delete entity.combatCounter;
  }
  const move = registries.enemies.get(enemy.enemyId).moves.slash;
  const actionPreview = previewEnemyAction(combat, enemy, 'slash');
  enemy.intent = { kind: move.intent, moveId: 'slash', damage: move.damage, hits: move.hits || 1, combatProfile: actionPreview.profile };
  enemy.intentRevealed = true; enemy.plannedMoves = []; enemy.maxStamina = 100; enemy.stamina = 100;
  enemy.knowledgeAction = { reads: { player: { visibility: 'exact' } } };
  const unmodified = previewIntent(combat, enemy.id);
  enemy.ratings.ar = 7;
  const open = previewIntent(combat, enemy.id);
  assert.ok(open.totalDamage > unmodified.totalDamage, 'the base payload has not included live AR');
  combat.player.block = 3;
  const blocked = previewIntent(combat, enemy.id);
  assert.ok(blocked.totalDamage < open.totalDamage, 'Core preview already spends Block');
  const cards = enemyMoveCards(registries.enemies.get(enemy.enemyId), { enemy, registries,
    preview: blocked, actionPreviews: { slash: actionPreview } });
  const shown = cards.find(row => row.moveId === 'slash');
  assert.match(shown.detail, new RegExp(`${blocked.damage} projected damage`));
  assert.doesNotMatch(shown.detail, /before Block/);
  const before = combat.player.hp;
  dispatch(combat, { type: 'setReactions', enabled: false });
  dispatch(combat, { type: 'endTurn' });
  assert.equal(before - combat.player.hp, blocked.totalDamage);
  const receipt = combat.eventLog.find(row => row.type === 'enemyMoveStarted' && row.sourceId === enemy.id);
  const snapshot = enemyDeckInspection(combat, enemy, cards, blocked).last;
  const committedBase = receipt.actionPreview.actionEffects.find(row => row.op === 'damage').amount;
  assert.notEqual(committedBase, blocked.damage, 'the committed base opcode is not the resulting HP loss');
  assert.match(snapshot.detail, /Base .* damage to player before combat modifiers/);
  assert.match(snapshot.meta, /Paid .* SP/);
});
