import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameContent } from '../src/model/gameProfile.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState } from '../src/model/state.js';
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
  assert.match(current.detail, /6 × 2 preview damage before Block/);
  assert.match(current.detail, /3 damage/);
  assert.doesNotMatch(current.detail, /8 × 2 damage/);
});
