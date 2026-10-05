// tests/skill-feat-crit.test.mjs — SPEC §13.4o: every `balance.skill.featEvery`
// (2) levels of a track that authors skill feats offers one; the owner's Blade
// example grants critical hits: chance 0.05 + (0.1·DEX + 0.2·WIS + 0.1·INT)/100,
// capped at 0.5, for 1.5× damage, on Blade-tagged attacks only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { awardSkillXp, xpToNext, skillFeatOptions, takeSkillFeat, critRulesFor } from '../src/model/skills.js';
import { critChance } from '../src/engine/actions.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { rewardPlan } from '../src/model/rewardplan.js';

const registries = createRegistries(contentBundle);
const BLADE = 'item:blade';
const toLevel = (run, level) => awardSkillXp(registries, run, BLADE, Array.from({ length: level }, (_, l) => xpToNext(registries, 'weapon', l)).reduce((a, b) => a + b, 0));

test('Blade levels 2 and 4 queue feat picks; the crit feat opens at 2 and is taken once', () => {
  const run = createRunState({ seed: 5, classId: 'reaver', registries });
  toLevel(run, 4);
  assert.equal(run.skills[BLADE].pendingSkillFeats, 2);
  assert.equal(run.skills['item:shield']?.pendingSkillFeats, undefined, 'a track with no authored feat queues none');
  assert.deepEqual(skillFeatOptions(run, BLADE, 1), []);
  assert.deepEqual(skillFeatOptions(run, BLADE, 2), ['bladeCritical']);
  assert.ok(takeSkillFeat(run, BLADE, 'bladeCritical'));
  assert.equal(run.skills[BLADE].pendingSkillFeats, 1);
  assert.ok(!takeSkillFeat(run, BLADE, 'bladeCritical'), 'a feat is taken once');
  assert.deepEqual(skillFeatOptions(run, BLADE, 4), [], 'nothing left to offer');
  const back = deserializeRun(serializeRun(run));
  assert.deepEqual(back.skillFeats, ['bladeCritical']);
  assert.deepEqual(validateRunShape(back).filter((p) => /skillFeat/.test(p)), []);
  back.skillFeats = ['bladeCritical', 'bladeCritical'];
  assert.ok(validateRunShape(back).some((p) => /skillFeats must be distinct/.test(p)));
});

test('the crit chance is the owner\'s formula, capped, and only for matching tags', () => {
  const rules = critRulesFor(['bladeCritical']);
  const attrs = { dexterity: 10, wisdom: 10, intelligence: 10 };
  const { chance, multiplier } = critChance(rules, attrs, ['blade']);
  assert.ok(Math.abs(chance - (0.05 + (1 + 2 + 1) / 100)) < 1e-9, `chance ${chance}`);
  assert.equal(multiplier, 1.5);
  assert.equal(critChance(rules, { wisdom: 1000 }, ['blade']).chance, 0.5, 'capped at 0.5');
  assert.equal(critChance(rules, attrs, ['guard']).chance, 0, 'a non-Blade attack never crits');
  assert.ok(Math.abs(critChance(rules.concat(rules), attrs, ['blade']).chance - Math.min(0.5, 2 * chance)) < 1e-9, 'sources add before the cap');
});

test('in a fight a Blade hit can crit for 1.5×, and a run without the feat draws nothing new', () => {
  const play = (withFeat, seed) => {
    const run = createRunState({ seed: 5, classId: 'reaver', registries });
    run.attributes = { ...run.attributes, wisdom: 1000 }; // the cap: half the hits crit
    run.deck = Array.from({ length: 10 }, (_, n) => ({ instanceId: `r${n}`, cardId: 'rend', upgraded: false }));
    if (withFeat) run.skillFeats = ['bladeCritical'];
    const combat = createRunCombat({ registries, rng: createRng(seed), run, enemyIds: ['wanderingSoldier'] });
    combat.enemies[0].hp = combat.enemies[0].maxHp = 100000;
    const crits = [];
    for (let i = 0; i < 3; i++) {
      const card = combat.piles.hand[0];
      if (!card) break;
      dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: combat.enemies[0].id });
    }
    for (const event of combat.eventLog) if (event.type === 'critHit') crits.push(event);
    return { combat, crits };
  };
  let critted = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { crits } = play(true, seed);
    critted += crits.length;
    for (const c of crits) assert.equal(c.multiplier, 1.5);
  }
  assert.ok(critted > 0, 'some Blade hits crit');
  const plain = play(false, 7);
  assert.equal(plain.crits.length, 0, 'no feat, no crit');
  assert.equal(plain.combat.player.critRules, undefined);
});

test('the feat pick is a keyed choice row', () => {
  const [row] = rewardPlan({ skillFeats: [{ skillId: BLADE, level: 2, claimOrdinal: 0, featIds: ['bladeCritical'] }] }).rows;
  assert.equal(row.key, `skillFeat:${BLADE}:0`);
  assert.deepEqual(row.options, [{ kind: 'skillFeat', id: 'bladeCritical' }]);
});
