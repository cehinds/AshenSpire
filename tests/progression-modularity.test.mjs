import test from 'node:test';
import assert from 'node:assert/strict';
import { coreContentBundle, contentBundle } from '../src/content/index.js';
import * as cards from '../src/content/progression/cards.js';
import * as feats from '../src/content/progression/feats.js';
import * as relics from '../src/content/progression/relics.js';
import { progressionUnlocks } from '../src/content/progression/unlocks.js';
import { composeProgressionContent } from '../src/model/progressionContent.js';
import { validateContent } from '../src/model/validate.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { classMilestoneOptions } from '../src/model/classMilestoneOffers.js';
const modules = [cards, feats, relics];
const options = { rules: contentBundle.balance.progression, unlocks: progressionUnlocks, knownModules: modules };

for (let mask = 0; mask < 8; mask++) test(`card/feat/relic module combination ${mask.toString(2).padStart(3, '0')} validates and offers only installed definitions`, () => {
  const bundle = composeProgressionContent(coreContentBundle, modules.filter((_, index) => mask & 1 << index), options);
  const validation = validateContent(bundle);
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  const reg = createRegistries(bundle), run = createRunState({ registries: reg, classId: 'reaver', seed: 1 });
  run.skills['class:reaver'] = { level: 20, xp: 0 };
  for (const [index, family, definitions, collection, kind] of [
    [0, 'card', cards.progressionCards, bundle.cards, 'cards'],
    [1, 'feat', feats.progressionFeats, bundle.classSkillFeats, 'feat'],
    [2, 'relic', relics.progressionRelics, bundle.relics, 'relic'],
  ]) {
    const installed = !!(mask & 1 << index);
    const ids = new Set(definitions.map(row => row.id));
    assert.equal(collection.filter(row => ids.has(row.id)).length, installed ? ids.size : 0);
    if (!installed) {
      assert.ok(!bundle.tagging.some(row => row.family === family && ids.has(row.objectId)));
      assert.ok(!bundle.classMastery.some(row => ids.has(row.ref)));
      assert.ok(!classMilestoneOptions(reg, run, kind, 20).some(id => ids.has(id)));
    }
  }
});

test('composition retains explicit ownership when installing a later module', () => {
  const absent = composeProgressionContent(coreContentBundle, [], options);
  const base = { ...coreContentBundle, progressionModuleOwnership: absent.progressionModuleOwnership };
  const installed = composeProgressionContent(base, [feats], { rules: options.rules, unlocks: options.unlocks });
  assert.equal(validateContent(installed).ok, true);
  assert.equal(installed.classSkillFeats.length, coreContentBundle.classSkillFeats.length + 50);
  const newFeat = { ...feats.progressionFeats[0], id: 'installed-later-feat', name: 'Later feat' };
  const extended = composeProgressionContent(installed, [{ progressionFeats: [newFeat], progressionFeatUnlocks: [{ classId: 'reaver', level: 20, kind: 'feat', ref: newFeat.id }] }], { rules: options.rules, unlocks: installed.classMastery });
  assert.ok(extended.classSkillFeats.some(row => row.id === newFeat.id));
  assert.ok(extended.classMastery.some(row => row.classId === 'reaver' && row.level === 20 && row.kind === 'feat' && row.ref === newFeat.id));
});

test('omission never hides unknown authored associations or duplicate module definitions and unlocks', () => {
  for (const metadata of [null, [], { unknown: ['bad'] }, { card: 'bad' }, { card: [''] }, { card: ['bad', 'bad'] }]) {
    assert.throws(() => composeProgressionContent({ ...coreContentBundle, progressionModuleOwnership: metadata }, [], options), /progressionModuleOwnership/);
  }
  const typo = { ...coreContentBundle, tagging: [...coreContentBundle.tagging, { family: 'card', scope: '', objectId: 'mistyped-unregistered-card', tagId: 'blade' }] };
  const absent = composeProgressionContent(typo, [], options);
  assert.ok(absent.tagging.some(row => row.objectId === 'mistyped-unregistered-card'));
  assert.ok(validateContent(absent).errors.some(row => row.path.includes('mistyped-unregistered-card')));
  const duplicate = composeProgressionContent(coreContentBundle, [cards, cards], options);
  const errors = validateContent(duplicate).errors;
  assert.ok(errors.some(row => row.msg.toLowerCase().includes('duplicate')));
  assert.equal(duplicate.classMastery.filter(row => row.ref === cards.progressionCardUnlocks[0].ref).length, 2, 'duplicate authored gates reach validation');
});
