// JSON UI layer: components, screens, layout references, enemy visibility, index.
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateUi, INDEX_FILE, indexText } from '../tools/ui-validate.mjs';

const result = validateUi();
const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => JSON.parse(readFileSync(`${root}${file}`, 'utf8'));

test('every component and screen satisfies its schema and references', () => {
  assert.deepEqual(result.errors, []);
});

test('every content/config/ui component file has a JSON component of the same id', () => {
  const required = ['buttons', 'card', 'categoryNav', 'choiceBody', 'combatTargetHud', 'dialogueFrame', 'hud', 'iconTray', 'identity', 'inspect', 'inspector', 'possession', 'selection', 'tooltip', 'workspace',
    'hand', 'handCard', 'meter', 'intent', 'statusTray', 'enemyPanel', 'playerPanel', 'endTurnButton', 'rewardChoice', 'mapNode', 'mapView', 'deckList', 'cardInspect'];
  for (const id of required) assert.ok(result.index.components.includes(id), id);
});

test('the core screens exist', () => {
  for (const id of ['title', 'creation', 'prologue', 'combat', 'map', 'dialogue', 'reward', 'rest', 'shop', 'smith', 'armoury', 'deck', 'gameOver', 'victory']) assert.ok(result.index.screens.includes(id), id);
});

test('enemy SP, MP and card costs are only reachable through the visibility query', () => {
  for (const id of ['combatTargetHud', 'enemyPanel', 'meter', 'inspector']) {
    const vm = read(`engine/ui/components/${id}.json`).viewModel;
    assert.equal(vm.visibility?.query, 'enemy_visibility.visibleFields', id);
  }
  const hud = read('engine/ui/components/combatTargetHud.json').viewModel;
  for (const gated of ['sp', 'mp', 'cardCosts']) assert.ok(!(gated in hud.bindings) && !(gated in hud.visibility.fields), `hud must not expose ${gated}`);
  const inspector = read('engine/ui/components/inspector.json').viewModel;
  for (const gated of ['sp', 'mp', 'cardCosts']) assert.ok(gated in inspector.visibility.fields, gated);
});

test('the index file is current', () => {
  assert.equal(readFileSync(`${root}${INDEX_FILE}`, 'utf8'), indexText(result.index));
  assert.equal(result.index.format, 'ashen.ui-index@1');
});
