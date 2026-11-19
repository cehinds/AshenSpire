import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { statProjection, playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { attributeCardModels } from '../src/model/creationBrief.js';
import { statRowValue, resolvedRuleRow } from '../src/model/derivedStats.js';
import { configuredContentBundle } from '../src/model/advancedConfig.js';
import { resourceStrip } from '../src/ui/components/creationCards.js';
import { withKitDom } from './helpers/dom.mjs';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';

const registries = createRegistries(configuredContentBundle(contentBundle, {}));
const run = createRunState({ registries, classId: 'reaver', seed: 7 });
const cards = (reg, character) => attributeCardModels(reg, character.attributes, { projection: statProjection(reg, character) });

test('current Wisdom and spell disclosures omit retired Ward and use the real configured hand cadence', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const character = createRunState({ registries: core, classId: 'reaver', seed: 37 });
  const models = attributeCardModels(core, character.attributes, {
    projection: statProjection(core, character), gainContext: { run: character },
  });
  const wisdom = models.find(row => row.id === 'wisdom');
  const intelligence = models.find(row => row.id === 'intelligence');
  assert.equal(wisdom.face.mainSummary, 'Poise · Divine magic');
  assert.equal(models.find(row => row.id === 'constitution').face.mainSummary, 'Health');
  assert.ok(wisdom.reveal.lines.every(line => !/Ward|PR/.test(line)));
  assert.ok(wisdom.reveal.lines.some(line => /Divine magic/.test(line)));
  assert.ok(intelligence.reveal.lines.some(line => /Hand size \+1 every 4 points/.test(line)));
  assert.ok(intelligence.reveal.lines.every(line => !/every 5 points/.test(line)));
});

test('each primary point adds one to its main stats and no other main stat', () => {
  const mains = { ar: 'strength', dr: 'dexterity', hp: 'constitution', poise: 'wisdom', ward: 'wisdom', pr: 'intelligence' };
  for (const [id, owner] of Object.entries(mains)) {
    // AR, DR and PR have no table row any more: their channel is the attribute itself (resolvedRuleRow).
    const row = resolvedRuleRow(contentBundle.derivedStatRules, id);
    const value = (attributes) => statRowValue(row, { attributes, level: 1, statId: id }).value;
    for (const attribute of Object.keys(run.attributes)) {
      assert.equal(value({ ...run.attributes, [attribute]: run.attributes[attribute] + 1 }) - value(run.attributes), attribute === owner ? 1 : 0, `${attribute} -> ${id}`);
    }
  }
  assert.deepEqual(run.attributes, { strength: 3, dexterity: 1, constitution: 2, wisdom: 1, intelligence: 1 });
});

test('primary faces name the main bonus while secondary benefits remain inspectable', () => {
  const rows = cards(registries, run);
  assert.equal(rows.find((row) => row.id === 'strength').face.mainSummary, 'Physical damage');
  assert.equal(rows.find((row) => row.id === 'constitution').face.mainSummary, 'Health');
  assert.equal(rows.find((row) => row.id === 'intelligence').face.mainSummary, 'Magic damage');
  assert.ok(rows.find((row) => row.id === 'wisdom').reveal.lines.some((line) => line.startsWith('Mana ')));
});

test('one allocated point changes the actual character projection by one', () => {
  const values = (character) => {
    const pools = Object.fromEntries(statProjection(registries, character).derived.map((row) => [row.id, row.value]));
    return { ...pools, ...playerPoiseThresholdReceipt(registries, character).ratings };
  };
  const before = values(run);
  for (const [attribute, ids] of Object.entries({ strength: ['ar'], dexterity: ['dr'], constitution: ['hp'], wisdom: ['ward', 'poise'], intelligence: ['pr'] })) {
    const raised = values({ ...run, attributes: { ...run.attributes, [attribute]: run.attributes[attribute] + 1 } });
    for (const id of ids) assert.equal(raised[id] - before[id], 1, `${attribute} -> projected ${id}`);
  }
});

test('custom fractional bonuses and caps use the saved rules after live config changes', () => {
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.ward = { base: 1, wisdom: 0.5, max: 9 };
  bundle.derivedStatRules.rules.hp = { base: 51, constitution: 4, perLevel: 2 };
  const custom = createRegistries(configuredContentBundle(bundle, {}));
  const saved = createRunState({ registries: custom, classId: 'reaver', seed: 8 });
  const rows = cards(registries, saved);
  assert.equal(rows.find((row) => row.id === 'wisdom').face.mainSummary, 'Poise');
  assert.equal(rows.find((row) => row.id === 'constitution').face.mainSummary, 'Health');
});

test('resource rows show each total once in readable groups', () => withKitDom(() => {
  const projection = statProjection(registries, run);
  const poise = playerPoiseThresholdReceipt(registries, run);
  const strip = resourceStrip([...projection.derived, { id: 'attackRating', faceLabel: 'Attack', value: 999 }], poise);
  const ids = [...strip.querySelectorAll('[data-stat]')].map((node) => node.dataset.stat);
  assert.deepEqual(ids, ['hp', 'stamina', 'mana', 'poise', 'ward', 'handSize', 'draw', 'openingHand']);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(strip.querySelector('[data-stat="ar"]'), null, 'no AR chip');
  assert.equal(strip.querySelector('[data-stat="ward"]').querySelector('.cv').textContent, String(poise.ratings.ward));
}));
