// The Class step claims Adept training (unlimited copies) only where the profile grants it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { UnlimitedAdeptTraining } from '../src/model/deckCopyLimit.js';
import { legacyCoreProfile } from './helpers/legacy-core-profile.mjs';

for (const classId of ['reaver', 'rogue', 'starseer', 'herald']) {
  test(`${classId}: no Adept sentence under the shipped profile, the old one under the legacy unlimited rules`, () => {
    const shipped = createRunState({ registries, classId, seed: 1, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
    assert.deepEqual(shipped.gameProfile.modules['deck-training'].unlimited, [], 'the shipped profile grants no unlimited copies');
    assert.equal(UnlimitedAdeptTraining({ gameProfile: shipped.gameProfile, class: classId }), null);
    const legacy = UnlimitedAdeptTraining({ gameProfile: legacyCoreProfile(), class: classId });
    assert.match(legacy?.label || '', /Adept/, 'the legacy profile keeps the sentence');
  });
}

test('Customise is not drawn in the Begin green', () => {
  const src = readFileSync(new URL('../src/ui/screens/customize.js', import.meta.url), 'utf8');
  assert.match(src, /next\.classList\.toggle\('cz-next-stage', !plan\.quickBegin\)/);
});
