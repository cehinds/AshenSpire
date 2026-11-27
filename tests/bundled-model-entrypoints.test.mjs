import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { loadBundleCompiler } from './helpers/production-bundle.mjs';

// A fresh classic loader must work without main.js priming its import graph.
// Definitions come from today's content; each VM initializes its own factories.
function startingDecks(bundle, makeRegistries, makeRun) {
  const registries = makeRegistries(bundle);
  const profileMeta = { discoveredArmaments: registries.equipment.armaments.map(row => row.id),
    gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
  return bundle.classes.flatMap(cls => {
    const kits = (bundle.equipment?.startingKits || []).filter(kit => kit.classId === cls.id);
    return (kits.length ? kits : [{ id: null }]).map(kit => ({ classId: cls.id, kitId: kit.id,
      deck: makeRun({ registries, classId: cls.id, startingKitId: kit.id ?? undefined, seed: 0, profileMeta }).deck }));
  });
}

const expected = startingDecks(contentBundle, createRegistries, createRunState);
const projectionCard = { id: 'fixture.entryProjection', name: 'Entry projection', class: 'reaver', type: 'attack',
  rarity: 'common', cost: 1, staminaCost: 1, manaCost: 0, costRule: 'fixed', keywords: [],
  tags: ['classification.attack', 'camp:physical', 'maneuver:attack'],
  effects: [{ op: 'damage', target: 'enemy', amount: 5 }], textTemplate: 'Deal {damage} damage.' };
const expectedProjection = JSON.parse(JSON.stringify(ProjectCardMechanicalValues(projectionCard)));
const compiler = loadBundleCompiler();
const factories = compiler.order.map(id => {
  const { body } = compiler.transformModule(id, compiler.sources.get(id), resolve(id));
  return `${JSON.stringify(id)}: ${compiler.MODULE_FN}\n${compiler.guardScript(body)}\n}`;
}).join(',\n');

for (const entry of ['loadout', 'state', 'registries', 'validate', 'shopKinds']) {
  test(`classic model entry ${entry} validates content and matches every native starting deck`, () => {
    const probe = `"model-entry-probe": ${compiler.MODULE_FN}
      require(${JSON.stringify(`src/model/${entry}.js`)});
      const bundle = require("src/content/index.js").contentBundle;
      globalThis.validation = require("src/model/validate.js").validateContent(bundle);
      globalThis.decks = (${startingDecks.toString()})(bundle,
        require("src/model/registries.js").createRegistries, require("src/model/state.js").createRunState);
      globalThis.projection = require("src/model/cardMechanicalProjection.js").ProjectCardMechanicalValues(${JSON.stringify(projectionCard)});
    }`;
    const context = { console, structuredClone, TextEncoder };
    // Match the browser's own-realm structuredClone, as production-bundle.mjs
    // does. Node's injected clone otherwise returns host-realm JSON prototypes.
    vm.runInNewContext(`{
      const nativeClone = structuredClone;
      structuredClone = value => {
        const seen = new Set();
        const adopt = item => {
          if (!item || typeof item !== 'object' || seen.has(item)) return item;
          seen.add(item);
          if (item instanceof Map) { for (const [key, value] of item) { adopt(key); adopt(value); } }
          else if (item instanceof Set) { for (const value of item) adopt(value); }
          else if (Array.isArray(item) || Object.prototype.toString.call(item) === '[object Object]') {
            Object.setPrototypeOf(item, Array.isArray(item) ? Array.prototype : Object.prototype);
            for (const value of Object.values(item)) adopt(value);
          }
          return item;
        };
        return adopt(nativeClone(value));
      };
    }`, context);
    vm.runInNewContext(compiler.assembleRuntime(factories + ',\n' + probe, 'model-entry-probe'), context,
      { filename: `classic-model-${entry}`, timeout: 30000 });
    assert.equal(context.validation.ok, true, JSON.stringify(context.validation.errors));
    assert.ok(expected.length > 0 && expected.every(row => row.deck.length > 0));
    assert.deepEqual(JSON.parse(JSON.stringify(context.decks)), expected);
    assert.deepEqual(JSON.parse(JSON.stringify(context.projection)), expectedProjection);
  });
}
