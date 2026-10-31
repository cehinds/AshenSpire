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

import { withKitDom } from './helpers/kit-dom.mjs';
import { withModalDom } from './helpers/modal-dom.mjs';
import { mountRewards } from '../src/ui/screens/reward.js';
import { allocateAttributePoint } from '../src/model/levelup.js';
import { openCharacterSheet } from '../src/ui/screens/characterSheet.js';
import { attributeCardModels } from '../src/model/creationBrief.js';

test('the Victory receipt shows the largest gain on every attribute row, with all gains in the title', () => {
  const { registries, run } = build();
  run.level.unspentPoints = 1;
  withKitDom(({ document }) => {
    document.documentElement ??= document.body;
    document.body.classList.add('reduced-motion');
    const app = document.createElement('main'); document.body.append(app);
    mountRewards(app, { registries, run, receiptOnly: true, onDone() {}, onPersist() {},
      onAllocateStat: id => allocateAttributePoint(registries, run, id),
      rewards: { title: 'Victory', xpGains: { level: 10, tracks: {} }, xpBefore: { character: { ...run.level }, tracks: {} } } });
    const chips = [...app.querySelectorAll('.reward-stat-row .reward-stat-gain')];
    assert.equal(chips.length, 5);
    assert.ok(chips.map(c => c.textContent).includes('+10 HP'));
    const hp = chips.find(c => c.textContent === '+10 HP');
    assert.match(hp.getAttribute('title'), /^\+10 HP, /);
  });
});

test('the Armoury allocation modal shows the same span, and the Rest card model carries mainGain', () => {
  const { registries, run } = build();
  run.level.unspentPoints = 1;
  withModalDom(() => {
    const sheet = openCharacterSheet({ registries, run, onChange() {} });
    sheet.panel.querySelector('.progression-points').click();
    const chips = [...document.querySelectorAll('.cc-stat-modal .se-gain')];
    assert.ok(chips.length >= 5, 'one gain span per attribute row');
    assert.ok(chips.map(c => c.textContent).includes('+10 HP'));
    sheet.close();
  });
  const cards = attributeCardModels(registries, run.attributes, { gainContext: { run } });
  assert.equal(cards.find(c => c.id === 'constitution').mainGain.text, '+10 HP');
  assert.ok(cards.every(c => Array.isArray(c.gains)));
});
