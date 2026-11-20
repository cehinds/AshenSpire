import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { attributePointGains, largestAttributeGain, attributeGainSummary, AttributeHandReceipts } from '../src/model/attributePointPreview.js';
import { progressionStats } from '../src/ui/models/ProgressionInspectionModel.js';
import { fixCoreRules } from '../src/model/fixCoreRulesCache.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { createRng } from '../src/engine/rng.js';
import { profileHandSize } from '../src/engine/gameProfileCombat.js';
import { sourceRatingValue } from '../src/model/combatRatings.js';

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
  assert.equal(text('strength'), '+1 Physical damage');
  assert.equal(text('dexterity'), '+1 Block');
  assert.equal(text('constitution'), '+5 HP');
  assert.equal(text('wisdom'), '+1 Poise');
  assert.equal(text('intelligence'), '+1 Arcane magic');
});

test('the full list names every non-zero gain and skips Ward while Core switches it off', () => {
  const { registries, run } = build();
  const con = attributePointGains(registries, run, 'constitution');
  assert.ok(con.some(g => g.statId === 'hp' && g.delta === 5));
  assert.ok(con.every(g => g.delta !== 0 && g.statId !== 'ward' && g.statId !== 'poise'));
  assert.equal(attributeGainSummary(con), '+5 HP');
  run.attributes.intelligence = 3;
  assert.ok(attributePointGains(registries, run, 'intelligence').some(g => g.statId === 'openingHand' && g.text === '+1 Opening hand'));
  for (const id of ['dexterity', 'wisdom']) assert.ok(attributePointGains(registries, run, id).every(g => !['evasion', 'precision', 'perception'].includes(g.statId)));
});

test('a changed authored gain changes the text: nothing is hard-coded', () => {
  const { registries, run } = build((r) => {
    const rules = structuredClone(r.derivedStatRuleSnapshot);
    rules.rules.rules.hp.constitution = 20;
    r.derivedStatRuleSnapshot = rules;
  });
  assert.equal(largestAttributeGain(registries, run, 'constitution').text, '+20 HP');
});

import { withKitDom } from './helpers/dom.mjs';
import { withModalDom } from './helpers/dom.mjs';
import { MountRewards } from '../src/ui/screens/reward.js';
import { allocateAttributePoint, rederivePools } from '../src/model/levelup.js';
import { openCharacterSheet } from '../src/ui/screens/characterSheet.js';
import { attributeCardModels } from '../src/model/creationBrief.js';

test('the Victory receipt shows the largest gain on every attribute row, with all gains in the title', () => {
  const { registries, run } = build();
  run.level.unspentPoints = 1;
  withKitDom(({ document }) => {
    document.documentElement ??= document.body;
    document.body.classList.add('reduced-motion');
    const app = document.createElement('main'); document.body.append(app);
    MountRewards(app, { registries, run, receiptOnly: true, onDone() {}, onPersist() {},
      onAllocateStat: id => allocateAttributePoint(registries, run, id),
      rewards: { title: 'Victory', xpGains: { level: 10, tracks: {} }, xpBefore: { character: { ...run.level }, tracks: {} } } });
    const chips = [...app.querySelectorAll('.reward-stat-row .reward-stat-gain')];
    assert.equal(chips.length, 5);
    assert.ok(chips.map(c => c.textContent).includes('+5 HP'));
    const hp = chips.find(c => c.textContent === '+5 HP');
    assert.equal(hp.getAttribute('title'), '+5 HP');
  });
});

test('allocation uses benefit names without numeric badges while the model retains exact gains', () => {
  const { registries, run } = build();
  run.level.unspentPoints = 1;
  withModalDom(() => {
    const sheet = openCharacterSheet({ registries, run, onChange() {} });
    sheet.panel.querySelector('.progression-points').click();
    assert.equal(document.querySelectorAll('.cc-stat-modal .se-gain').length, 0, 'no numeric gain badges');
    const summaries = [...document.querySelectorAll('.cc-stat-modal .disc-summary')].map(node => node.textContent);
    assert.deepEqual(summaries, ['Physical damage', 'Block', 'Health', 'Poise · Divine magic', 'Arcane magic']);
    assert.ok(summaries.every(text => !/\d|\b(?:AR|DR|PR|Ward)\b/.test(text)));
    sheet.close();
  });
  const cards = attributeCardModels(registries, run.attributes, { gainContext: { run } });
  assert.equal(cards.find(c => c.id === 'constitution').mainGain.text, '+5 HP');
  assert.ok(cards.every(c => Array.isArray(c.gains)));
});

test('a blight attribute bonus moves the threshold: the preview matches what allocateAttributePoint changes', () => {
  const { registries, run } = build((r) => {
    r.ashenBlight = { milestones: [{ path: 'survivor', tier: 1 }] };
    r.attributes.constitution = 1;
    r.level.unspentPoints = 1;
  });
  const stamina = () => run.maxStamina;
  const predicted = attributePointGains(registries, run, 'constitution').find(g => g.statId === 'stamina')?.delta ?? 0;
  rederivePools(registries, run, 'test'); // the milestone was injected after birth: settle its one-off bonus first
  const before = stamina();
  allocateAttributePoint(registries, run, 'constitution');
  assert.equal(stamina() - before, predicted, 'preview equals the real allocation');
  assert.equal(predicted, 0, 'the +1 CON bonus makes floor(0.5 x CON) cross no threshold at CON 1 -> 2');
});

test('a legacy (combatExpansionVersion 1) run prices Energy; Core 2 omits it', () => {
  const core = build();
  assert.ok(!attributePointGains(core.registries, core.run, 'dexterity').some(g => g.statId === 'energy'));
  const legacyRegistries = createRegistries(contentBundle);
  const run = createRunState({ seed: 4242, classId: 'rogue', registries: legacyRegistries });
  run.combatExpansionVersion = 1; // a run born before combat expansion 2: energy is its own pool
  run.attributes.dexterity = 3;
  rederivePools(legacyRegistries, run, 'test');
  const predicted = attributePointGains(legacyRegistries, run, 'dexterity').find(g => g.statId === 'energy');
  run.level.unspentPoints = 1;
  const before = run.energyMax;
  allocateAttributePoint(legacyRegistries, run, 'dexterity');
  assert.equal(run.energyMax - before, predicted?.delta ?? 0);
  assert.equal(predicted?.text, '+1 Energy');
});

test('Core 2 (configured combat) reads the hand from profileHandSize: INT 3 -> 4 deals one more card', () => {
  const { registries, run } = build();
  run.attributes.intelligence = 3;
  const gains = attributePointGains(registries, run, 'intelligence');
  for (const id of ['draw', 'openingHand', 'handSize']) assert.equal(gains.find(g => g.statId === id)?.delta, 1, `${id} +1`);
  assert.equal(gains.find(g => g.statId === 'draw').before, 5);
  assert.equal(gains.find(g => g.statId === 'draw').after, 6);
  assert.ok(gains.some(g => g.statId === 'arcaneMagic' && g.delta === 1));
  assert.equal(largestAttributeGain(registries, run, 'intelligence').statId, 'arcaneMagic');
});

test('allocation preview and progression totals agree at threshold and nonthreshold points', () => {
  for (const attribute of ['constitution', 'wisdom', 'dexterity', 'intelligence']) {
    for (const beforePoints of [3, 4]) {
      const { registries, run } = build(character => {
        character.attributes[attribute] = beforePoints;
        character.level.unspentPoints = 1;
      });
      rederivePools(registries, run, 'test');
      const predicted = new Map(attributePointGains(registries, run, attribute).map(gain => [gain.statId, gain.delta]));
      const before = { hp: run.maxHp, mana: run.maxMana, stamina: run.maxStamina, handSize: AttributeHandReceipts(registries, run).capacity.value };
      const beforeUi = progressionStats(registries, run);
      assert.equal(beforeUi.rows.find(row => row.id === 'handSize').value, before.handSize);
      allocateAttributePoint(registries, run, attribute);
      const after = { hp: run.maxHp, mana: run.maxMana, stamina: run.maxStamina, handSize: AttributeHandReceipts(registries, run).capacity.value };
      for (const stat of Object.keys(before)) assert.equal(after[stat] - before[stat], predicted.get(stat) || 0, `${attribute} ${beforePoints}->${beforePoints + 1}: ${stat}`);
      const afterUi = progressionStats(registries, run);
      assert.equal(afterUi.rows.find(row => row.id === 'draw').value, after.handSize);
      if (attribute === 'intelligence') assert.equal(predicted.get('handSize') || 0, beforePoints === 3 ? 1 : 0);
      if (attribute === 'wisdom') assert.equal(predicted.get('mana') || 0, beforePoints === 3 ? 1 : 0);
      if (attribute === 'dexterity') assert.equal(predicted.get('stamina') || 0, beforePoints === 3 ? 1 : 0);
      if (attribute === 'constitution') assert.equal(predicted.get('hp'), 5);
    }
  }
});

test('a saved combat rules object without tradition flag retains generic magic labels', () => {
  const { registries, run } = build();
  run.fixCoreRules = structuredClone(fixCoreRules(run));
  delete run.fixCoreRules.spellTraditionsVersion;
  const gains = attributePointGains(registries, run, 'intelligence');
  assert.ok(gains.some(gain => gain.statId === 'pr'));
  assert.ok(gains.every(gain => !['arcaneMagic', 'divineMagic'].includes(gain.statId)));
  const rows = progressionStats(registries, run).attributes;
  assert.doesNotMatch(rows.find(row => row.id === 'intelligence').face.mainSummary, /Arcane/);
});

test('configured hand properties appear in allocation totals and the real fight across an INT threshold', () => {
  const { registries, run } = build(character => {
    character.attributes.intelligence = 3;
    character.level.unspentPoints = 1;
    character.itemProps = { 'armament/greatsword': ['handSize1'] };
  });
  const protectedState = JSON.stringify({ attributes: run.attributes, itemProps: run.itemProps, deck: run.deck });
  const shown = AttributeHandReceipts(registries, run).capacity.value;
  assert.equal(JSON.stringify({ attributes: run.attributes, itemProps: run.itemProps, deck: run.deck }), protectedState, 'reading the hand never mutates the run');
  const live = () => profileHandSize(createRunCombat({ registries, run, rng: createRng(73), enemyIds: ['wanderingSoldier'] }));
  assert.equal(shown, 6, 'five base cards plus the equipped hand-size property');
  assert.equal(shown, live());
  const predicted = attributePointGains(registries, run, 'intelligence').find(gain => gain.statId === 'handSize');
  assert.equal(predicted.before, shown);
  assert.equal(predicted.delta, 1);
  allocateAttributePoint(registries, run, 'intelligence');
  assert.equal(AttributeHandReceipts(registries, run).capacity.value, shown + 1);
  const screen = progressionStats(registries, run);
  assert.equal(screen.rows.find(row => row.id === 'handSize').value, live());
  assert.equal(screen.rows.find(row => row.id === 'draw').value, live());
});

test('custom saved magic coefficients price Arcane and Divine allocation gains exactly like combat', () => {
  for (const [attribute, id, school, expectedBefore] of [
    ['wisdom', 'divineMagic', 'divine', 4],
    ['intelligence', 'arcaneMagic', 'alteration', 16],
  ]) {
    const { registries, run } = build(character => {
      Object.assign(character.attributes, { intelligence: 8, wisdom: 2 });
      character.derivedStatRuleSnapshot.rules.rules.pr = { base: 0, intelligence: 2 };
      character.level.unspentPoints = 1;
    });
    const card = { school, combatProfile: { camp: 'spell', maneuver: 'casting', range: 'reach' } };
    const live = () => {
      const combat = createRunCombat({ registries, run, rng: createRng(73), enemyIds: ['wanderingSoldier'] });
      return sourceRatingValue(combat, combat.player, 'pr', undefined, false, card);
    };
    const gain = attributePointGains(registries, run, attribute).find(row => row.statId === id);
    assert.equal(gain.before, expectedBefore);
    assert.equal(gain.before, live());
    assert.equal(gain.delta, 2, `${attribute} uses the saved coefficient`);
    allocateAttributePoint(registries, run, attribute);
    assert.equal(gain.after, live());
    assert.equal(gain.after, expectedBefore + 2);
  }
});

test('a legacy run still counts Draw and Opening hand through the hand rows: capacity caps them', () => {
  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 4242, classId: 'rogue', registries });
  run.combatExpansionVersion = 1;
  const ids = (int) => { run.attributes.intelligence = int; return attributePointGains(registries, run, 'intelligence').map(g => g.statId); };
  const capped = ids(3);
  assert.ok(!capped.includes('draw') && !capped.includes('openingHand'), 'INT 3 -> 4 deals no extra card, so shows none');
  const raisesCapacity = ids(8);
  for (const id of ['draw', 'openingHand', 'handSize']) assert.ok(raisesCapacity.includes(id), `INT 8 -> 9 raises capacity, so ${id} shows`);
});
