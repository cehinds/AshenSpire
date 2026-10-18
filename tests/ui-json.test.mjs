// JSON UI layer: components, screens, layout references, enemy visibility, index.
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, cpSync, symlinkSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

// ---- guards: a dangling command id, asset slot or src path in the UI JSON is an error ----
// plantRoot() builds a throwaway repo root that links the heavy trees and copies the UI and asset JSON,
// lets the test edit those copies, and runs validateUi({ root }) on it.
function plantedErrors(edit = () => {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ui-plant-'));
  try {
    for (const link of ['content', 'src', 'art-manifest.json']) symlinkSync(`${root}${link}`, path.join(dir, link));
    mkdirSync(path.join(dir, 'engine/ui'), { recursive: true });
    for (const link of ['contracts', 'runtime']) symlinkSync(`${root}engine/${link}`, path.join(dir, 'engine', link));
    cpSync(`${root}engine/ui/components`, path.join(dir, 'engine/ui/components'), { recursive: true });
    mkdirSync(path.join(dir, 'games/ashenspire'), { recursive: true });
    for (const sub of ['ui', 'assets']) cpSync(`${root}games/ashenspire/${sub}`, path.join(dir, 'games/ashenspire', sub), { recursive: true });
    edit(file => {
      const abs = path.join(dir, file), doc = JSON.parse(readFileSync(abs, 'utf8'));
      return { doc, save: () => writeFileSync(abs, JSON.stringify(doc, null, 2) + '\n') };
    });
    return validateUi({ root: dir }).errors;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('the planting harness is clean until something is planted', () => {
  assert.deepEqual(plantedErrors(), []);
});

test('an event naming a command that engine/runtime/commands.json lacks is an error', () => {
  const errors = plantedErrors(open => { const f = open('engine/ui/components/card.json'); f.doc.events.tap = 'card.doesNotExist'; f.save(); });
  assert.deepEqual(errors, ['engine/ui/components/card.json: event "tap" names command "card.doesNotExist", which is not in engine/runtime/commands.json']);
});

test('an asset slot that is no catalog id, alias or missing.json entry is an error', () => {
  const errors = plantedErrors(open => { const f = open('engine/ui/components/card.json'); f.doc.assets.push('icon.doesNotExist'); f.save(); });
  assert.deepEqual(errors, ['engine/ui/components/card.json: asset "icon.doesNotExist" is not a catalog id, an alias or a missing.json entry for game ashenspire']);
});

test('an alias that names a catalog id which does not exist is an error', () => {
  const errors = plantedErrors(open => { const f = open('games/ashenspire/assets/aliases.json'); f.doc.aliases['icon.health'] = 'icons.doesNotExist'; f.save(); });
  assert.deepEqual(errors, ['games/ashenspire/assets/aliases.json: alias "icon.health" names catalog id "icons.doesNotExist", which does not exist']);
});

test('a description naming a src file that does not exist is an error', () => {
  const errors = plantedErrors(open => { const f = open('games/ashenspire/ui/screens/title.json'); f.doc.description += ' Reads src/ui/screens/doesNotExist.js.'; f.save(); });
  assert.deepEqual(errors, ['games/ashenspire/ui/screens/title.json: description names src/ui/screens/doesNotExist.js, which does not exist']);
});

test('every command handler names code that exists today', () => {
  const { commands } = read('engine/runtime/commands.json');
  const mechanicCommands = new Set(readdirSync(`${root}engine/mechanics`)
    .filter(d => existsSync(`${root}engine/mechanics/${d}/interface.json`))
    .flatMap(d => { const i = read(`engine/mechanics/${d}/interface.json`); return Object.keys(i.commands || {}).map(c => `${i.mechanic}.${c}`); }));
  for (const [id, { kind, handler }] of Object.entries(commands)) {
    if (handler === 'unresolved') continue;
    if (kind === 'mechanic') { assert.ok(mechanicCommands.has(handler), `${id}: ${handler} is not a mechanic command`); continue; }
    const [file, symbol] = handler.split('#');
    assert.ok(existsSync(`${root}${file}`), `${id}: ${file} does not exist`);
    for (const word of (symbol || '').split('.')) assert.ok(readFileSync(`${root}${file}`, 'utf8').includes(word), `${id}: ${file} never mentions ${word}`);
  }
});
