import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATION_DEFAULTS, FORMATION_PRESETS, formationDimensions, formationSpawn, isFormationCell } from '../src/model/formationLayout.js';
import { presentationConfig, advancedConfigExport, parseAdvancedConfigFile } from '../src/model/advancedConfig.js';
import { contentBundle } from '../src/content/index.js';
import { combatFormation } from '../src/ui/models/CombatFormationModel.js';
import { formationTileGeometry } from '../src/ui/models/FormationGridModel.js';
import { formationMovePlan } from '../src/model/formationMovement.js';
const ids = n => Array.from({ length: n }, (_, i) => `actor-${i}`);
const config = values => presentationConfig(Object.fromEntries(Object.entries(values).map(([key, value]) => [`gameConfig.presentation.${key}`, value])));

test('all selectable dimensions and presets give unique uniform cells and matching actor anchors', () => {
  for (const { value: formationPreset } of FORMATION_PRESETS) for (const formationColumns of [1, 2, 3]) for (const formationRows of [1, 2, 3, 4, 5, 6]) for (const width of [320, 1440]) {
    const presentation = config({ formationPreset, formationColumns, formationRows, playerSpawnRow: 'F', enemySpawnRow: 'F' });
    const capacity = formationColumns * formationRows;
    const plan = combatFormation({ width, height: 400, friends: ids(capacity), enemies: ids(capacity).map(id => `enemy-${id}`), presentation });
    assert.equal(plan.cells.length, capacity * 2);
    assert.equal(new Set(plan.slots.map(slot => slot.cell)).size, capacity * 2);
    assert.equal(new Set(plan.cells.map(cell => cell.width)).size, 1);
    assert.equal(new Set(plan.cells.map(cell => cell.tileHeight)).size, 1);
    for (const slot of plan.slots) {
      const anchor = plan.cells.find(cell => cell.cell === slot.cell);
      assert.equal(slot.x, anchor.x); assert.equal(slot.ground, anchor.ground);
      assert.ok(Number.isFinite(slot.depth));
      assert.ok(slot.x - slot.width / 2 >= 0 && slot.x + slot.width / 2 <= width);
      assert.ok(slot.ground > 0 && slot.ground < 400);
      assert.ok(isFormationCell(slot.cell, plan, slot.side));
    }
    for (let row = 0; row < formationRows; row++) {
      assert.deepEqual(plan.cells.filter(c => c.row === row).sort((a, b) => a.x - b.x).map(c => c.cell),
        Array.from({ length: formationColumns * 2 }, (_, col) => `${'ABCDEF'[row]}${col + 1}`));
    }
  }
});

test('slants remain parallel across teams, straight ranks stay straight, and only V converges', () => {
  for (const { value: formationPreset } of FORMATION_PRESETS) {
    const plan = combatFormation({ width: 1000, height: 500, friends: [], enemies: [], presentation: config({ formationPreset, formationColumns: 3, formationRows: 6 }) });
    const x = (row, side) => plan.cells.find(c => c.row === row && c.column === 0 && c.side === side).x;
    const left = x(5, 'player') - x(0, 'player'), right = x(5, 'enemy') - x(0, 'enemy');
    if (formationPreset === 'straight') assert.equal(left + right, 0), assert.equal(left, 0);
    else if (formationPreset === 'classic-v') assert.ok(left > 0 && right < 0);
    else {
      assert.ok(Math.abs(left - right) < 1e-8);
      assert.ok(formationPreset === 'forward-slant' ? left < 0 : left > 0);
    }
  }
});

test('maximum grid supports row F adjustments and saved spawn preferences', () => {
  const presentation = config({ formationColumns: 3, formationRows: 6, playerSpawnRow: 'F', playerSpawnColumn: '3', enemySpawnRow: 'F', enemySpawnColumn: '4', rowFLayer: 44, rowFScale: 1.7 });
  const plan = combatFormation({ width: 1000, height: 500, friends: ['p'], enemies: ['e'], presentation });
  assert.deepEqual(plan.slots.map(slot => slot.cell), ['F3', 'F4']);
  assert.ok(plan.slots.every(slot => slot.layer === presentation.frontLayer + 44));
  assert.equal(presentation.rowFScale, 1.7);
});

test('small saved grids expand uniformly when needed, without stacking or losing actors', () => {
  const presentation = config({ formationColumns: 1, formationRows: 1 });
  for (const count of [2, 6, 12, 18]) {
    const plan = combatFormation({ width: 390, height: 400, friends: ['p'], enemies: ids(count), presentation });
    assert.equal(plan.slots.length, count + 1);
    assert.equal(new Set(plan.slots.map(slot => slot.cell)).size, count + 1);
    assert.ok(plan.columns <= 3 && plan.rows <= 6);
  }
});

test('movement accepts the whole selected player grid and rejects enemy or hidden cells', () => {
  const settings = { 'gameConfig.presentation.movementEnabled': true, 'gameConfig.presentation.formationColumns': 3, 'gameConfig.presentation.formationRows': 6 };
  const combat = { player: { energy: 3, formationCell: 'F3' }, phase: 'player', enemies: [] };
  assert.equal(formationMovePlan(combat, 'F2', settings).ok, true);
  for (const cell of ['F3', 'F4', 'G1', 'A0', 'A7']) assert.equal(formationMovePlan(combat, cell, settings).ok, false);
  const reduced = { ...settings, 'gameConfig.presentation.formationColumns': 1, 'gameConfig.presentation.formationRows': 2 };
  assert.equal(formationMovePlan(combat, 'A1', reduced).current, 'B1');
  assert.equal(formationMovePlan(combat, 'A1', reduced).ok, true);
  assert.equal(formationMovePlan(combat, 'C1', reduced).ok, false);
});

test('layout configuration clamps whole grid dimensions and round trips through export', () => {
  const invalid = config({ formationColumns: 9, formationRows: 4.8, formationPreset: 'invalid', groundSkew: -100 });
  assert.equal(invalid.formationColumns, 3); assert.equal(invalid.formationRows, 5);
  // An unknown preset falls back to the authored default ('straight' since the owner's exported config, 2026-09-24).
  assert.equal(invalid.formationPreset, FORMATION_DEFAULTS.formationPreset); assert.equal(invalid.groundSkew, -35);
  const settings = { 'gameConfig.presentation.formationColumns': 3, 'gameConfig.presentation.formationRows': 6,
    'gameConfig.presentation.formationPreset': 'back-slant', 'gameConfig.presentation.groundTilt': 50, 'gameConfig.presentation.rowFScale': 1.7 };
  assert.deepEqual(parseAdvancedConfigFile(advancedConfigExport(settings), contentBundle), settings);
  assert.throws(() => parseAdvancedConfigFile(advancedConfigExport({ 'gameConfig.presentation.formationRows': 7 }), contentBundle));
});

test('ground projection leaves position anchors and character geometry upright', () => {
  const input = { width: 1000, height: 500, friends: ['p'], enemies: [] };
  const flat = config({ formationColumns: 3, formationRows: 6, gridShape: 'rectangle', groundTilt: 0, groundSkew: 0 });
  const angled = { ...flat, groundTilt: 60, groundSkew: 25 };
  const a = combatFormation({ ...input, presentation: flat }), b = combatFormation({ ...input, presentation: angled });
  assert.deepEqual(a.slots, b.slots);
  assert.notEqual(formationTileGeometry(a.cells[0], a, flat).transform, formationTileGeometry(b.cells[0], b, angled).transform);
  assert.deepEqual(formationDimensions(config({ formationColumns: 3, formationRows: 6 })), { columns: 3, rows: 6 });
  assert.equal(formationSpawn(config({ formationColumns: 1, formationRows: 1 }), 'enemy'), 'A2');
});
