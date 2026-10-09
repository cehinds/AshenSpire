import test from 'node:test';
import assert from 'node:assert/strict';
import { combatLogEntries } from '../src/model/combatLog.js';
import { combatLogHeight, combatLogSnapSize, combatToolsModel, COMBAT_LOG_SIZES } from '../src/ui/models/CombatToolsModel.js';
import { childModel } from '../src/ui/models/ComponentModel.js';
import { UI_COMPONENTS as UI } from '../src/ui/models/UiComponentId.js';

test('log contains executed public receipts by round, never predictions or unstarted intent', () => {
  const registries = { cards: new Map([['guardCounter', { name: 'Guard Counter' }]]), enemies: new Map([['soldier', { name: 'Soldier' }]]), statuses: new Map() };
  const events = [{ type: 'enemyActorTurnStarted', sourceId: 'e1', moveId: 'privateFuture' },
    { type: 'enemyIntentPrediction', maneuver: 'secretGuess' },
    { type: 'cardPlayed', playerId: 'p1', cardId: 'guardCounter', staminaSpent: 2, manaSpent: 3, upcastTier: 2 },
    { type: 'enemyMoveStarted', sourceId: 'e1', moveId: 'slash' },
    { type: 'damageDealt', sourceId: 'e1', targetId: 'player', targetPlayerId: 'p1', amount: 7, blocked: 7 },
    { type: 'hpLost', targetPlayerId: 'p1', amount: 7, cause: 'attack' },
    { type: 'playerTurnStart', turn: 2 },
    { type: 'combatReactionChosen', ownerId: 'p1' },
    { type: 'damageDealt', sourceId: 'player', sourcePlayerId: 'p1', targetId: 'e1', amount: 10, blocked: 1 }];
  const rows = combatLogEntries(events, { registries, players: [{ id: 'p1', name: 'Reaver' }], enemies: [{ id: 'e1', enemyId: 'soldier' }] });
  assert.deepEqual(rows.map(row => [row.id, row.round]), [[2, 1], [3, 1], [4, 1], [7, 2], [8, 2]]);
  assert.match(rows[0].text, /Reaver played Guard Counter \(Upcast 2\).*2 SP, 3 MP/);
  assert.equal(rows[2].text, 'Reaver blocked 7 damage.');
  assert.equal(rows[4].text, 'Reaver dealt 9 damage to Soldier (1 blocked).');
  assert.doesNotMatch(JSON.stringify(rows), /privateFuture|secretGuess|hpLost/);
  assert.deepEqual(combatLogEntries(JSON.parse(JSON.stringify(events)), { registries, players: [{ id: 'p1', name: 'Reaver' }], enemies: [{ id: 'e1', enemyId: 'soldier' }] }), rows);
});

test('three log heights use physical card, visible viewport and actual menu clearance', () => {
  const space = { cardHeight: 250, viewportHeight: 900, dockTop: 700, menuBottom: 60, gap: 8 };
  assert.equal(combatLogHeight({ ...space, size: 'Small' }), 125);
  assert.equal(combatLogHeight({ ...space, size: 'Medium' }), 450);
  assert.equal(combatLogHeight({ ...space, size: 'Large' }), 632);
  assert.equal(combatLogHeight({ ...space, size: 'Medium', dockTop: 120 }), (52 / 3 + 52) / 2);
  assert.equal(combatLogHeight({ ...space, size: 'Large', dockTop: 20 }), 0);
});

test('compressed log has distinct ordered stops and gestures snap to the nearest stop', () => {
  const space = { cardHeight: 110, viewportHeight: 513, dockTop: 270, menuBottom: 62, gap: 8 };
  const heights = Object.fromEntries(COMBAT_LOG_SIZES.map(size => [size, combatLogHeight({ ...space, size })]));
  assert(heights.Small < heights.Medium && heights.Medium < heights.Large);
  assert.equal(heights.Large, 200);
  for (const size of COMBAT_LOG_SIZES) assert.equal(combatLogSnapSize(heights[size], heights), size);
  assert.equal(combatLogSnapSize((heights.Small + heights.Medium) / 2 - 1, heights), 'Small');
  assert.equal(combatLogSnapSize((heights.Small + heights.Medium) / 2 + 1, heights), 'Medium');
  assert.equal(combatLogSnapSize((heights.Medium + heights.Large) / 2 + 1, heights), 'Large');
  assert.equal(combatLogSnapSize(-100, heights), 'Small');
  assert.equal(combatLogSnapSize(1000, heights), 'Large');
});

test('unsupported historical combat has a disabled switch and immutable public log model', () => {
  const entries = [{ id: 2, round: 1, text: 'A public action.' }];
  const model = combatToolsModel({ supported: false, enabled: true, open: true, size: 'Large', entries });
  assert.deepEqual(childModel(model, UI.reactionToggle).properties, { enabled: false, disabled: true });
  assert.equal(childModel(model, UI.combatLogDrawer).properties.open, true);
  entries[0].text = 'Mutated';
  assert.equal(childModel(model, UI.combatLogDrawer).properties.entries[0].text, 'A public action.');
});
