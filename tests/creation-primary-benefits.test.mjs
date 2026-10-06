import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { statProjection, playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { attributeCardModels } from '../src/model/creationBrief.js';
import { statRowValue } from '../src/model/derivedStats.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { resourceStrip } from '../src/ui/components/creationCards.js';
import { withKitDom } from './helpers/kit-dom.mjs';

const registries = createRegistries(configuredContentBundle(contentBundle, {}));
const run = createRunState({ registries, classId: 'reaver', seed: 7 });
const cards = (reg, character) => attributeCardModels(reg, character.attributes, { projection: statProjection(reg, character) });

test('each primary point adds one to its main stats and no other main stat', () => {
  const mains = { ar: 'strength', dr: 'dexterity', hp: 'constitution', poise: 'constitution', ward: 'wisdom', pr: 'intelligence' };
  for (const [id, owner] of Object.entries(mains)) {
    const row = contentBundle.derivedStatRules.rules[id];
    const value = (attributes) => statRowValue(row, { attributes, level: 1, statId: id }).value;
    for (const attribute of Object.keys(run.attributes)) {
      assert.equal(value({ ...run.attributes, [attribute]: run.attributes[attribute] + 1 }) - value(run.attributes), attribute === owner ? 1 : 0, `${attribute} -> ${id}`);
    }
  }
  assert.deepEqual(run.attributes, { strength: 3, dexterity: 1, constitution: 2, wisdom: 1, intelligence: 1 });
});

test('primary faces name the main bonus while secondary benefits remain inspectable', () => {
  const rows = cards(registries, run);
  assert.equal(rows.find((row) => row.id === 'strength').face.mainSummary, 'Physical damage / Attack Rating (AR) +1 per point');
  assert.equal(rows.find((row) => row.id === 'constitution').face.mainSummary, 'Health +1 per point · Poise +1 per point');
  assert.equal(rows.find((row) => row.id === 'intelligence').face.mainSummary, 'Magic damage / Potency Rating (PR) +1 per point');
  assert.ok(rows.find((row) => row.id === 'wisdom').reveal.lines.some((line) => line.startsWith('Mana ')));
});

test('one allocated point changes the actual character projection by one', () => {
  const values = (character) => {
    const pools = Object.fromEntries(statProjection(registries, character).derived.map((row) => [row.id, row.value]));
    return { ...pools, ...playerPoiseThresholdReceipt(registries, character).ratings };
  };
  const before = values(run);
  for (const [attribute, ids] of Object.entries({ strength: ['ar'], dexterity: ['dr'], constitution: ['hp', 'poise'], wisdom: ['ward'], intelligence: ['pr'] })) {
    const raised = values({ ...run, attributes: { ...run.attributes, [attribute]: run.attributes[attribute] + 1 } });
    for (const id of ids) assert.equal(raised[id] - before[id], 1, `${attribute} -> projected ${id}`);
  }
});

test('custom fractional bonuses and caps use the saved rules after live config changes', () => {
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.ar = { base: 0, strength: 0.5, max: 9 };
  bundle.derivedStatRules.rules.hp = { base: 51, constitution: 4, perLevel: 2 };
  const custom = createRegistries(configuredContentBundle(bundle, {}));
  const saved = createRunState({ registries: custom, classId: 'reaver', seed: 8 });
  const rows = cards(registries, saved);
  assert.equal(rows.find((row) => row.id === 'strength').face.mainSummary, 'Physical damage / Attack Rating (AR) +1 every 2 points (max 9)');
  assert.equal(rows.find((row) => row.id === 'constitution').face.mainSummary, 'Health +4 per point · Poise +1 per point');
});

test('resource rows show each total once in readable groups', () => withKitDom(() => {
  const projection = statProjection(registries, run);
  const poise = playerPoiseThresholdReceipt(registries, run);
  const strip = resourceStrip([...projection.derived, { id: 'attackRating', faceLabel: 'AR', value: 999 }], poise);
  const ids = [...strip.querySelectorAll('[data-stat]')].map((node) => node.dataset.stat);
  assert.deepEqual(ids, ['hp', 'stamina', 'mana', 'ar', 'pr', 'dr', 'poise', 'ward', 'handSize', 'draw', 'openingHand']);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(strip.querySelector('[data-stat="ar"]').querySelector('.cv').textContent, String(poise.ratings.ar));
}));
