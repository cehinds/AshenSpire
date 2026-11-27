// Current relic contracts follow the authored definitions. The old rendered-text
// migration snapshot is not a contract for today's membership or balance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, relicPropertyRules, passiveMult, passiveSum } from '../src/model/registries.js';
import { relicTokens, tokenRe, validateContent } from '../src/model/validate.js';
import { relicInRewardPool } from '../src/model/schemas.js';
import { rollRelicReward, rollRuneReward } from '../src/engine/encounters.js';

const json = name => JSON.parse(readFileSync(new URL(`../content/source/${name}.json`, import.meta.url), 'utf8'));
const authored = [...json('relics'), ...json('progressionRelics')];
const REG = createRegistries(contentBundle);

test('current relic JSON reaches the runtime with its authored fields intact', () => {
  assert.deepEqual(REG.relics.ids().sort(), authored.map(row => row.id).sort());
  for (const row of authored) {
    const def = REG.relics.get(row.id);
    for (const [key, value] of Object.entries(row)) assert.deepEqual(def[key], value, `${row.id}.${key}`);
    assert.ok(Object.isFrozen(def), `${row.id} is immutable`);
  }
  const result = validateContent(contentBundle);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('every eligible relic reaches its authored rarity pool and owned copies are excluded', () => {
  for (const def of REG.relics.all()) {
    const owned = REG.relics.ids().filter(id => id !== def.id);
    const pick = rollRelicReward(REG, { pick: (_stream, pool) => pool[0] }, owned, { rarities: [def.rarity] });
    assert.equal(pick, relicInRewardPool(def) ? def.id : null, def.id);
  }
  assert.equal(rollRelicReward(REG, { pick: () => assert.fail('owned relic offered') }, REG.relics.ids()), null);
});

test('passive readers compose explicit factors, additive values and floored reward gains', () => {
  // Small independent operands protect the arithmetic without pinning any item.
  const rows = new Map([
    ['factorA', { id: 'factorA', passives: { restHealMult: 1.1, flaskPowerMult: 1.25, runeGainMult: 1.1, powerCostReduction: 2 } }],
    ['factorB', { id: 'factorB', passives: { restHealMult: 0.5, flaskPowerMult: 0.9, runeGainMult: 0.6, powerCostReduction: 3 } }],
  ]);
  const reg = { ...REG, relics: { get: id => rows.get(id), has: id => rows.has(id) } };
  assert.equal(passiveMult(reg, ['factorA', 'factorB'], 'restHealMult'), 0.55);
  assert.equal(passiveMult(reg, ['factorA', 'factorB'], 'flaskPowerMult'), 1.125);
  assert.equal(passiveSum(reg, ['factorA', 'factorB'], 'powerCostReduction'), 5);
  assert.equal(rollRuneReward(reg, { int: () => 21 }, 'normal', ['factorA']), 23);
  assert.equal(rollRuneReward(reg, { int: () => 21 }, 'normal', ['factorA', 'factorB']), 13);
});

test('no current relic sentence leaves a numeric token unresolved', () => {
  for (const def of REG.relics.all()) {
    const tokens = relicTokens(def, relicPropertyRules(REG, def), REG);
    const sentence = (def.textTemplate || '').replace(tokenRe(), (match, key) => typeof tokens[key] === 'number' ? String(tokens[key]) : match);
    assert.doesNotMatch(sentence, /\{[A-Za-z]/, def.id);
  }
});

test('authored property associations reach each relic and resolve to conferring rules', () => {
  const propertyIds = new Set(contentBundle.tags.filter(row => row.domain === 'property').map(row => row.id));
  for (const def of REG.relics.all()) {
    const tags = contentBundle.tagging.filter(row => row.family === 'relic' && row.objectId === def.id && propertyIds.has(row.tagId)).map(row => row.tagId);
    assert.deepEqual([...(def.propertyTags || [])].sort(), tags.sort(), def.id);
    assert.equal(Array.isArray(def.triggers) && def.triggers.length > 0, false, `${def.id}: triggers belong to property rules`);
    const held = new Set(tags);
    const expected = tags.map(tag => REG.propertyRules.get(tag)).filter(rule =>
      (rule.requires || []).every(tag => held.has(tag)) && !(rule.excludes || []).some(tag => held.has(tag)));
    const actual = relicPropertyRules(REG, def);
    assert.deepEqual(actual.map(rule => rule.tag), expected.map(rule => rule.tag), `${def.id}: every applicable rule resolves`);
    assert.deepEqual(actual, expected, `${def.id}: resolved rules preserve their authored behavior`);
    for (const rule of actual) {
      assert.ok(tags.includes(rule.tag), `${def.id}: rule belongs to an authored property`);
      assert.ok((rule.triggers || []).length > 0 || Object.keys(rule.passives || {}).length > 0, `${def.id}: rule confers behavior`);
    }
  }
});
