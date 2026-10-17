// JSON contracts for mechanics, UI, maps, assets and the build artifact
// (docs/ai/json-game-modules/MECHANICS-ARCHITECTURE.md, owner 2026-10-17).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateGameSchema } from '../engine/kernel/gameConfig.js';

const dir = new URL('../engine/contracts/', import.meta.url);
const schema = name => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
const NEW = ['mechanic', 'mechanic-interface', 'mechanic-service', 'mechanic-cases', 'ui-component', 'ui-screen', 'map-component', 'map', 'asset-catalog', 'build-artifact'];

test('every contract schema parses and has an id and title', () => {
  const files = readdirSync(dir).filter(f => f.endsWith('.schema.json'));
  for (const id of NEW) assert.ok(files.includes(`${id}.schema.json`), id);
  for (const id of NEW) { const s = schema(`${id}.schema.json`); assert.match(s.$id, /^ashen\./); assert.ok(s.title); }
});

test('the documented examples satisfy their contracts', () => {
  validateGameSchema({ id: 'fx_heal', tag: 'fx:heal', version: '1.0.0', family: 'fx', label: 'Heal', attaches: ['card', 'character'],
    files: { model: 'model.schema.json', interface: 'interface.json', service: 'service.json' }, presentation: { icon: 'heal', color: '9FC3E8' },
    portability: 'portable', legacy: { file: 'src/engine/actions.js', symbol: 'applyHeal' } }, schema('mechanic.schema.json'));
  validateGameSchema({ mechanic: 'fx_heal', commands: { heal: { params: { target: 'entityRef', amount: 'value' } } }, events: { healed: { payload: { target: 'entityRef' } } },
    queries: { healAmount: { params: { pct: 'number' }, returns: 'number', value: { f: 'percentMaxHp', of: 'target', pct: '$pct' } } }, listens: ['card.played'], requires: [] }, schema('mechanic-interface.schema.json'));
  validateGameSchema({ mechanic: 'fx_heal', handlers: [{ on: 'command.heal', do: [{ op: 'heal', target: '$target', amount: '$amount' }, { emit: 'fx_heal.healed', with: {} }] }] }, schema('mechanic-service.schema.json'));
  validateGameSchema([{ name: 'heals', given: {}, when: { command: 'fx_heal.heal' }, then: {} }], schema('mechanic-cases.schema.json'));
  validateGameSchema({ id: 'combatTargetHud', layout: { ref: 'content/config/ui/components/combatTargetHud.json' }, viewModel: { props: { entity: 'entityRef' }, bindings: { hp: '$entity.pools.hp' } },
    states: ['idle'], events: { tap: 'inspect.open' }, children: [{ component: 'meter', props: { value: '$hp' } }], assets: [] }, schema('ui-component.schema.json'));
  validateGameSchema({ id: 'map.act1', label: 'Act 1', act: 1, generator: { kind: 'branching', steps: 10, paths: 3, weights: { combat: 50 } }, nodes: ['node.combat'] }, schema('map.schema.json'));
});

test('contracts reject what they should', () => {
  assert.throws(() => validateGameSchema({ id: 'fx:heal', tag: 'fx:heal', version: '1.0.0', family: 'fx', label: 'Heal', attaches: ['card'], files: { model: 'a', interface: 'b', service: 'c' }, portability: 'portable' }, schema('mechanic.schema.json')), /does not match/);
  assert.throws(() => validateGameSchema({ mechanic: 'fx_heal', handlers: [{ on: 'heal', do: [] }] }, schema('mechanic-service.schema.json')), /does not match/);
  assert.throws(() => validateGameSchema({ format: 'other', assets: {} }, schema('asset-catalog.schema.json')), /expected "ashen.assets@1"/);
});
