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
import { progressionStats } from '../src/ui/models/ProgressionInspectionModel.js';
import { primaryStatCard } from '../src/ui/components/creationCards.js';

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

test('Core faces use current spell and hand rules without rating names or numerical bonuses', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const character = createRunState({ registries: core, classId: 'reaver', seed: 9 });
  const expected = {
    strength: 'Physical damage', dexterity: 'Defense', constitution: 'Health',
    wisdom: 'Poise · Divine magic', intelligence: 'Arcane magic',
  };
  for (const wisdom of [1, 5]) {
    character.attributes.wisdom = wisdom;
    const rows = progressionStats(core, character).attributes;
    assert.deepEqual(Object.fromEntries(rows.map(row => [row.id, row.face.mainSummary])), expected);
  }
});

test('crossing a multi-point threshold does not add it to the per-point summary', () => {
  const bundle = { ...contentBundle, derivedStatRules: structuredClone(contentBundle.derivedStatRules) };
  bundle.derivedStatRules.rules.stamina = { base: 3, dexterity: 0.5 };
  bundle.derivedStatRules.rules.handSize = { base: 7, intelligence: 0.2, min: 1 };
  const custom = createRegistries(configuredContentBundle(bundle, {}));
  const character = createRunState({ registries: custom, classId: 'reaver', seed: 10 });
  for (const dexterity of [1, 2, 3]) {
    character.attributes.dexterity = dexterity;
    const rows = cards(custom, character);
    assert.equal(rows.find(row => row.id === 'dexterity').face.mainSummary, 'Defense');
    assert.equal(rows.find(row => row.id === 'intelligence').face.mainSummary, 'Magic damage');
  }
});

test('current expanded benefits follow saved pools, hand intervals and casting traditions', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const character = createRunState({ registries: core, classId: 'reaver', seed: 12 });
  const rows = progressionStats(core, character).attributes;
  const lines = id => rows.find(row => row.id === id).reveal.lines.join(' ');
  assert.match(lines('constitution'), /HP \+5 every 1 point/);
  assert.doesNotMatch(lines('constitution'), /Poise|Mana|Stamina/);
  assert.match(lines('wisdom'), /Poise \+1 every 1 point/);
  assert.match(lines('wisdom'), /Mana \+1 every 4 points/);
  assert.match(lines('dexterity'), /Stamina.*\+1 every 4 points/);
  for (const label of ['Opening hand', 'Draw / turn', 'Hand size']) assert.ok(lines('intelligence').includes(`${label} +1 every 4 points`));
  assert.match(lines('wisdom'), /Divine magic scales with Wisdom/);
  assert.match(lines('intelligence'), /Arcane magic scales with Intelligence/);
  assert.match(lines('intelligence'), /higher of Intelligence and Wisdom, never their sum/);
  for (const row of rows) assert.doesNotMatch([row.face.summary, ...row.reveal.lines].join(' '), /\b(?:AR|DR|PR|Ward|Perception|Evasion|Precision)\b/);
});

test('historical and custom snapshots retain their own owners and hand growth in current registries', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const character = createRunState({ registries: core, classId: 'reaver', seed: 13 });
  delete character.gameProfile.modules.effects.spellTraditionsVersion;
  if (character.gameProfile.fixCoreRules) delete character.gameProfile.fixCoreRules.spellTraditionsVersion;
  delete character.gameProfile.modules.cards.handPointsPerIncrease;
  character.derivedStatRuleSnapshot.rules.rules.poise = { base: 1, constitution: 1 };
  character.derivedStatRuleSnapshot.rules.rules.hp = { base: 35, constitution: 10 };
  const rows = progressionStats(core, character).attributes;
  const con = rows.find(row => row.id === 'constitution');
  const wisdom = rows.find(row => row.id === 'wisdom');
  const intelligence = rows.find(row => row.id === 'intelligence');
  assert.equal(con.face.mainSummary, 'Health · Poise');
  assert.match(con.reveal.lines.join(' '), /HP \+10 every 1 point/);
  assert.doesNotMatch(wisdom.face.mainSummary, /Poise|Divine/);
  assert.match(intelligence.face.mainSummary, /Magic damage · Hand size/);
  assert.match(intelligence.reveal.lines.join(' '), /Hand size \+1 every 1 point/);
  character.derivedStatRuleSnapshot.rules.rules.hp = { base: 35, strength: 7 };
  const custom = progressionStats(core, character).attributes;
  assert.equal(custom.find(row => row.id === 'constitution').face.mainSummary, 'Poise');
  assert.equal(custom.find(row => row.id === 'strength').face.mainSummary, 'Physical damage · Health');
  assert.match(custom.find(row => row.id === 'strength').reveal.lines.join(' '), /HP \+7 every 1 point/);
});

test('configured hand summaries respect the saved points-per-card interval at every threshold', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const character = createRunState({ registries: core, classId: 'reaver', seed: 11 });
  character.gameProfile.modules.cards.handPointsPerIncrease = 4;
  for (const intelligence of [1, 3, 4, 5, 7, 8]) {
    character.attributes.intelligence = intelligence;
    const rows = progressionStats(core, character).attributes;
    assert.equal(rows.find(row => row.id === 'intelligence').face.mainSummary, 'Arcane magic');
  }
});

test('retired custom magic rows cannot change current fixed-channel labels or formulas', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  for (const coefficient of [0, 0.5, 2]) {
    const character = createRunState({ registries: core, classId: 'reaver', seed: 14 });
    character.derivedStatRuleSnapshot.rules.rules.pr = { base: 3, intelligence: coefficient, multiplier: 2, max: 40 };
    for (const points of [1, 2, 3, 4, 5, 8]) {
      Object.assign(character.attributes, { intelligence: points, wisdom: points });
      const models = progressionStats(core, character).attributes;
      for (const [id, label, short] of [['intelligence', 'Arcane magic', 'INT'], ['wisdom', 'Divine magic', 'WIS']]) {
        const row = models.find(model => model.id === id);
        assert.equal(row.face.mainSummary.includes(label), true, `${id}, retired coefficient ${coefficient}, value ${points}`);
        const text = row.reveal.lines.join(' ');
        assert.ok(text.includes(`${label}: 0 base`));
        assert.ok(text.includes(`floor(1 × ${short})`));
        assert.ok(!text.includes('max 40'));
        assert.doesNotMatch(text, /\b(?:AR|DR|PR)\b/);
        const gain = row.gains.find(gain => gain.statId === (id === 'intelligence' ? 'arcaneMagic' : 'divineMagic'));
        assert.equal(gain?.delta, 1);
      }
    }
  }
});

test('retired Wisdom terms cannot double the fixed Divine casting channel', () => {
  const profile = resolveGameProfile('core');
  const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const character = createRunState({ registries: core, classId: 'reaver', seed: 15 });
  for (const [intelligence, wisdom] of [[0, 2], [0.5, 1], [0.5, 0.5]]) {
    character.derivedStatRuleSnapshot.rules.rules.pr = { base: 0, intelligence, wisdom };
    for (const points of [1, 2, 3, 4]) {
      character.attributes.wisdom = points;
      const row = progressionStats(core, character).attributes.find(model => model.id === 'wisdom');
      assert.equal(row.face.mainSummary.includes('Divine magic'), true, `${intelligence} retired INT + ${wisdom} retired WIS at ${points}`);
      const formula = row.reveal.lines.find(line => line.startsWith('Divine magic:'));
      assert.ok(formula.includes('floor(1 × WIS)'));
      assert.equal(row.gains.find(gain => gain.statId === 'divineMagic')?.delta, 1);
    }
  }
});

test('an intentionally empty primary summary does not fall back to numerical legacy prose', () => withKitDom(() => {
  const model = cards(registries, run)[0];
  model.face.mainSummary = '';
  model.face.summary = 'AR +1 every 2 points';
  const node = primaryStatCard(model);
  assert.equal(node.querySelector('.disc-summary'), null);
}));

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
