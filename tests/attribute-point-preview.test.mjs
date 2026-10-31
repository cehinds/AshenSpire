import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { attributePointGains, largestAttributeGain, attributeGainSummary } from '../src/model/attributePointPreview.js';

const build = (mutate = null) => {
  const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 73, classId: 'reaver', registries });
  if (mutate) mutate(run);
  return { registries, run };
};

test('Core 2 largest per-point gains read from the live formulas', () => {
  const { registries, run } = build();
  const text = (id) => largestAttributeGain(registries, run, id)?.text;
  assert.equal(text('strength'), '+1 AR');
  assert.equal(text('dexterity'), '+1 DR');
  assert.equal(text('constitution'), '+10 HP');
  assert.equal(text('wisdom'), '+1 Perception');
  assert.equal(text('intelligence'), '+1 PR');
});

test('the full list names every non-zero gain and skips Ward while Core switches it off', () => {
  const { registries, run } = build();
  const con = attributePointGains(registries, run, 'constitution');
  assert.ok(con.some(g => g.statId === 'hp' && g.delta === 10));
  assert.ok(con.every(g => g.delta !== 0 && g.statId !== 'ward'));
  assert.match(attributeGainSummary(con), /^\+10 HP, /);
  assert.ok(attributePointGains(registries, run, 'dexterity').some(g => g.statId === 'evasion' && g.delta === 1));
});

test('a changed authored gain changes the text: nothing is hard-coded', () => {
  const { registries, run } = build((r) => {
    const rules = structuredClone(r.derivedStatRuleSnapshot);
    rules.rules.rules.hp.constitution = 20;
    r.derivedStatRuleSnapshot = rules;
  });
  assert.equal(largestAttributeGain(registries, run, 'constitution').text, '+20 HP');
});
