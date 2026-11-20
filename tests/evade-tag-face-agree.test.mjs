import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { cardBonusTags } from '../src/model/cardBonusTags.js';
import { cardPlainText } from '../src/ui/components/card.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const fight = () => createRunCombat({ registries, run: createRunState({ registries, classId: 'reaver', seed: 511 }), rng: createRng(511), enemyIds: ['wanderingSoldier'] });
// A fight saved before the 2026-11-14 ruling (no hitRoll key) grants evadeStackBase stacks per Evade card; a new fight grants evadeStacksPerCard (1).
const resumedAt = (combat, base) => {
  const accuracy = { ...combat.fixCoreRules.accuracy, evadeStackBase: base, evadeStackDex: 0 };
  delete accuracy.hitRoll; delete accuracy.evadeStacksPerCard;
  combat.fixCoreRules = { ...combat.fixCoreRules, accuracy };
  return combat;
};

for (const [label, base] of [['current fight', 1], ['resumed evadeStackBase-3 fight', 3]]) {
  test(`Evade tag and card face agree on a ${label}`, () => {
    const combat = base === 1 ? fight() : resumedAt(fight(), 3);
    for (const id of ['core.evade', 'core.closingDodge', 'core.backstep']) {
      if (!registries.cards.has(id)) continue;
      const def = registries.cards.get(id);
      const tags = JSON.stringify(cardBonusTags(def, null, registries, combat));
      const face = cardPlainText(registries, { cardId: id }, { rules: combat });
      assert.ok(tags.includes(`Gain ${base} Evade`) || tags.includes(`"count":${base}`) || !/Evade/.test(tags), `${id} tag ${tags}`);
      assert.ok(!tags.includes(`Gain ${base === 3 ? 1 : 3} Evade`), `${id} tag does not use the other rule: ${tags}`);
      if (/Evade/.test(face) && /Gain \d/.test(face)) assert.ok(face.includes(`${base} Evade`), `${id} face ${face}`);
    }
    assert.ok(registries.cards.has('core.evade'));
  });
}
