import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { withKitDom } from './helpers/kit-dom.mjs';

const source = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
function shipped(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}

test('frame names match inspector identity without constructing inspection data', () => {
  const run = { class: 'reaver', customization: {} };
  const context = { run, runClassIdentity: (_registries, state) => ({ name: state.classUnequipped ? 'Classless' : 'Reaver' }), registries: { classes: { get: () => ({ name: 'Reaver' }) }, enemies: { get: () => ({ name: 'Wandering Soldier' }) } } };
  runInNewContext(shipped('combatantName') + '\nglobalThis.nameFor = combatantName;', context);
  assert.equal(context.nameFor('player', {}), 'REAVER');
  run.classUnequipped = true;
  assert.equal(context.nameFor('player', {}), 'CLASSLESS');
  run.customization.name = 'Élan';
  assert.equal(context.nameFor('player', {}), 'ÉLAN');
  assert.equal(context.nameFor('enemy', { enemyId: 'soldier' }), 'Wandering Soldier');
});

test('context labels and selection state refresh from a plain name', () => withKitDom(({ document }) => {
  const context = { selectedCombatantId: 'enemy-1' };
  runInNewContext(shipped('refreshCombatantContext') + '\nglobalThis.refresh = refreshCombatantContext;', context);
  const box = document.createElement('div'); box.dataset.eid = 'enemy-1';
  context.refresh(box, 'Wandering Soldier');
  assert.equal(box.getAttribute('aria-label'), 'Select Wandering Soldier');
  assert.equal(box.getAttribute('aria-pressed'), 'true');
  assert.equal(box.getAttribute('role'), 'button');
  assert.equal(box.tabIndex, -1);
  assert.equal(box.dataset.focusable, '');
  context.selectedCombatantId = 'player';
  context.refresh(box, 'Bell Keeper');
  assert.equal(box.getAttribute('aria-label'), 'Select Bell Keeper');
  assert.equal(box.getAttribute('aria-pressed'), 'false');
}));

// Inspector callbacks remain live: their model is built when opened and still
// includes intent, resources, skills and history. Ordinary frame context uses
// only labels, including reuse and the armed self-target confirmation label.
test('stage labels leave complete inspector models in activation callbacks', () => {
  assert.doesNotMatch(source, /(?:refresh|wire)CombatantContext\(box, combatantSubject/);
  const player = shipped('renderPlayer');
  assert.match(player, /combatantInfo\(combatantName\('player', p\), opener => openCombatantDoor\(combatantSubject\('player', p\), opener\)\)/);
  assert.doesNotMatch(player, /combatantSubject\('player', p\)\.name/);
  assert.match(shipped('wireCombatantContext'), /openCombatantDoor\(combatantSubject\(entity\.kind === 'player' \? 'player' : 'enemy', entity\), box\)/);
});
