import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { creationTraitPreview, applyCreationTraits, creationTraitDescription } from '../src/model/creationTraits.js';
import { openRunClassMastery, registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { classCarrier } from '../src/engine/properties.js';
import { initialClassTreeChoices } from '../src/model/classTree.js';
import { masterySpentXp } from '../src/model/classMasteryProfile.js';
const registries = createRegistries(contentBundle);
function birth(classId, subclassId, meta = {}) { return createRunState({ registries, seed: 42, classId, subclassId, profileMeta: meta }); }
function complete(classId, subclassId, meta) {
  const ids = [];
  let preview = creationTraitPreview(registries, birth(classId, subclassId, meta), meta, ids);
  while (preview.run.classMasteryState.initialTreeTiers.length) {
    assert.ok(preview.choices.length, `${classId}/${subclassId} offers a legal trait`);
    ids.push(preview.choices[0]);
    preview = creationTraitPreview(registries, birth(classId, subclassId, meta), meta, ids);
  }
  return { ids, preview };
}
for (const cls of registries.classes.all()) {
  for (const subclass of registries.subclasses.all().filter(row => row.classId === cls.id)) {
    test(`fresh ${cls.id}/${subclass.id} trait projection is detached and matches adopted run`, () => {
      const meta = {}; const original = structuredClone(meta);
      const { ids, preview } = complete(cls.id, subclass.id, meta);
      assert.equal(ids.length, 1); assert.deepEqual(meta, original);
      assert.equal(preview.run.classMasteryState.bankable, false);
      const run = birth(cls.id, subclass.id, meta);
      openRunClassMastery(registries, run, meta, { receiptId: 'actual' });
      assert.equal(applyCreationTraits(registries, run, ids), true);
      assert.deepEqual(run.coreTags, preview.run.coreTags);
      assert.ok(ids.every(id => classCarrier(registries, run.class, 'player', run.coreTags).tagIds.includes(id)), 'the real combat carrier mounts every selected trait');
      assert.deepEqual(run.deck, preview.run.deck);
      assert.deepEqual(run.attributes, preview.run.attributes);
      assert.deepEqual(run.classMasteryState.initialTreeTiers, []);
    });
    test(`veteran ${cls.id}/${subclass.id} replays all eligible trait choices and rejects stale IDs atomically`, () => {
      const level = Math.max(...registries.balance.skill.class.tierAt);
      const meta = { classMastery: { [cls.id]: { level, xp: masterySpentXp(registries, level), unlockedRows: [] } } };
      const { ids, preview } = complete(cls.id, subclass.id, meta);
      assert.equal(ids.length, registries.balance.skill.class.tierAt.length);
      const run = birth(cls.id, subclass.id, meta);
      openRunClassMastery(registries, run, meta, { receiptId: 'veteran' });
      const before = structuredClone(run);
      assert.equal(applyCreationTraits(registries, run, [...ids, 'invalid']), false);
      assert.deepEqual(run, before);
      assert.equal(applyCreationTraits(registries, run, [ids[0], ids[0], ...ids.slice(1)]), false);
      assert.deepEqual(run, before);
      assert.equal(applyCreationTraits(registries, run, ids.slice(0, -1)), false);
      assert.deepEqual(run, before);
      assert.equal(applyCreationTraits(registries, run, ids.slice(1)), false);
      assert.deepEqual(run, before);
      assert.equal(applyCreationTraits(registries, run, ids), true);
      assert.deepEqual(run.coreTags, preview.run.coreTags);
      assert.ok(ids.every(id => classCarrier(registries, run.class, 'player', run.coreTags).tagIds.includes(id)), 'the real combat carrier mounts every selected trait');
      assert.deepEqual(initialClassTreeChoices(registriesForClassMastery(registries, run), run), []);
    });
  }
}
test('legacy omitted trait selections preserve the pending queue and incomplete explicit selections refuse', () => {
  const run = birth('reaver'); openRunClassMastery(registries, run, {}, { receiptId: 'legacy' });
  assert.equal(applyCreationTraits(registries, run, undefined), true);
  assert.deepEqual(run.classMasteryState.initialTreeTiers, [1]);
  const before = structuredClone(run);
  assert.equal(applyCreationTraits(registries, run, []), false); assert.deepEqual(run, before);
  assert.equal(applyCreationTraits(registries, run, 'invalid'), false); assert.deepEqual(run, before);
});

test('trait cards resolve the canonical effect sentence and its live number bindings', () => {
  for (const row of registries.classTree) {
    const text = creationTraitDescription(registries, row.nodeId);
    assert.ok(text.length, row.nodeId); assert.doesNotMatch(text, /\{[\w.]+\}/, row.nodeId);
  }
  assert.match(creationTraitDescription(registries, 'ironFooting'), /Entering a stance grants \d+ Block\./);
});
