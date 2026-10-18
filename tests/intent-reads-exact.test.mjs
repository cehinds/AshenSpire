// Core preview route (owner, 2026-10-18): the intent module's `reads: exact` shows every enemy intent exactly and
// skips the hidden-intent roll (SPEC §4.7). A run without that setting (Current, the legacy fallback) keeps the roll.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, gameModule } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const ENEMIES = ['wanderingSoldier', 'wanderingSoldier'];
function fixture(profileName, seed) {
  const profile = profileName ? resolveGameProfile(profileName) : null;
  const registries = profile ? bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile) : createRegistries(contentBundle);
  const run = createRunState({ registries, seed, classId: 'reaver', enemyKnowledgeVersion: null }); // knowledge off: the roll path is under test
  const rng = createRng(seed);
  const combat = createRunCombat({ registries, run, rng, enemyIds: ENEMIES });
  return { run, combat, rng };
}
function playTurns(combat, turns) {
  const reads = [];
  for (let t = 0; t < turns && combat.phase !== 'ended'; t++) {
    for (const e of combat.enemies) if (e.intent?.combatProfile?.camp) reads.push(e.intentRevealed);
    dispatch(combat, { type: 'endTurn' });
    let guard = 0;
    while (combat.pendingReaction && guard++ < 64) dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id, optionId: null });
  }
  return reads;
}

test('Core resolves intent reads exact; Current and the module default stay rolled', () => {
  assert.equal(gameModule({ gameProfile: resolveGameProfile('core') }, 'intent').reads, 'exact');
  assert.equal(gameModule({ gameProfile: resolveGameProfile('current') }, 'intent')?.reads ?? 'rolled', 'rolled');
});

test('Core: every enemy intent is read exactly and the visibility stream is never drawn, across 20 seeds', () => {
  let seen = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const { combat, rng } = fixture('core', seed);
    const reads = playTurns(combat, 4);
    for (const e of combat.enemies) if (e.intent?.combatProfile?.camp) assert.equal(e.intentRevealed, true, `seed ${seed}`);
    for (const read of reads) assert.equal(read, true, `seed ${seed}`);
    seen += reads.length;
    assert.equal(rng.getCounters().enemyIntentVisibility || 0, 0, `seed ${seed}: hidden-intent roll was drawn`);
  }
  assert.ok(seen > 0, 'the fixture must actually present camp intents');
});

test('Core: the exact rule survives a mid-fight save and restore', () => {
  const { run, combat, rng } = fixture('core', 5);
  const saved = JSON.parse(JSON.stringify(serializeCombatSnapshot(combat)));
  const restored = restoreCombatSnapshot({ registries: combat.registries, rng: createRng(5), snapshot: saved, expectedGameProfile: run.gameProfile });
  playTurns(restored, 3);
  for (const e of restored.enemies) if (e.intent?.combatProfile?.camp) assert.equal(e.intentRevealed, true);
  assert.equal(restored.rng.getCounters().enemyIntentVisibility || 0, 0);
  assert.equal(rng.getCounters().enemyIntentVisibility || 0, 0);
});

test('Legacy and Current runs on the same seeds still roll, and some reads are hidden', () => {
  for (const name of [null, 'current']) {
    let hidden = 0, drawn = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { combat, rng } = fixture(name, seed);
      hidden += playTurns(combat, 4).filter(read => read === false).length;
      drawn += rng.getCounters().enemyIntentVisibility || 0;
    }
    assert.ok(drawn > 0, `${name}: the roll still runs`);
    assert.ok(hidden > 0, `${name}: at least one intent stays hidden`);
  }
});
