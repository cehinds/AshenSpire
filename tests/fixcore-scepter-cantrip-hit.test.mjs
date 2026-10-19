import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { attackHitPreview, resolveAttackHit } from '../src/engine/stanceHit.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { effectiveManeuver } from '../src/model/stanceRules.js';

// Codex P2 on #2170: a mirrored cantrip enters its basic's stance, so its hit chance must price that
// stance too (Evade defensive advantage, Counter), exactly like the basic card, in preview and live.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(seed = 511) {
  const run = createRunState({ registries: reg, classId: 'starseer', seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  return createRunCombat({ registries: reg, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
}
const carrier = id => { const def = reg.cards.get(id); return { ...def, tags: def.tags, combatProfile: combatProfileFor(def) }; };

test('effectiveManeuver: mirrored cantrip is Attack, the basic and a plain spell are unchanged', () => {
  assert.equal(effectiveManeuver(carrier('core.cantrip')), 'attack');
  assert.equal(effectiveManeuver(carrier('core.strike')), 'attack');
  assert.notEqual(effectiveManeuver(carrier('core.starseerSpecial')), 'attack');
});

for (const stance of ['evade', 'counter', 'defend', 'smash']) {
  // Stances whose matchup row beats Attack (Counter, Smash) raise the target stance factor; a casting-priced Spark would miss it.
  test(`Arcane Spark prices a ${stance}-stance target like Strike (preview and live)`, () => {
    const spark = carrier('core.cantrip'), strike = carrier('core.strike');
    for (const [label, mk] of [['preview', c => attackHitPreview], ['live', () => resolveAttackHit]]) {
      const a = live(), b = live();
      for (const combat of [a, b]) {
        const target = combat.enemies[0];
        target.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
        target.baseEvasionBonus = 12; // a large Evasion so the stance factor shows in whole numbers
        if (stance === 'evade') target.statuses.evade = { stacks: 1 };
      }
      const run = (combat, c) => mk(c)(combat, combat.player, combat.enemies[0], c);
      const s = run(a, spark), t = run(b, strike);
      assert.equal(s.hitChance, t.hitChance, `${label} ${stance}`);
      assert.equal(s.stanceFactor, t.stanceFactor, `${label} ${stance} factor`);
      assert.equal(s.need, t.need, `${label} ${stance} need`);
      assert.equal(s.evasion, t.evasion, `${label} ${stance} evasion`);
    }
  });
}
