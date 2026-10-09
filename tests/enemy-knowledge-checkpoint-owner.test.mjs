import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { createMemoryStorage, createSaveManager } from '../src/engine/save.js';
import { createBrowserSaveManager } from '../src/engine/browserSave.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';
import { commitExpansionCandidate } from '../src/engine/combatExpansionSave.js';
import { openRunEnemyKnowledge } from '../src/model/enemyKnowledgeRun.js';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const wrapper = source.match(/const durable = candidate => \{([\s\S]*?)\n    \};\n    if \(!savedSnapshot\)/)?.[1];
assert.ok(wrapper, 'the production expanded combat save wrapper is present');
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(knowledge) {
  const registries = createRegistries(contentBundle), storage = createMemoryStorage();
  assert.ok(createSaveManager(storage).ensureProfile().ok);
  const facade = createBrowserSaveManager(storage);
  let banks = 0;
  const notices = [];
  const saves = { ...facade, bankEnemyKnowledge: (...args) => {
    banks++; return facade.bankEnemyKnowledge(...args);
  } };
  const run = createRunState({ registries, seed: 11, classId: 'reaver',
    combatExpansionVersion: 2, enemyKnowledgeVersion: knowledge ? 1 : null });
  if (!knowledge) delete run.reactionRulesVersion; // Historical unsaved-turn policy.
  if (knowledge) openRunEnemyKnowledge(run, { bankable: true,
    receiptId: '50000000-0000-4000-8000-000000000003' });
  const rng = createRng(run.seed), nodeId = 'n1_4', encounterId = 'patrol';
  run.combatEntered = { nodeId, encounterId };
  const combat = createRunCombat({ registries, run, rng,
    enemyIds: ['wanderingSoldier'], settings: { playInDeckOrder: true } });
  const durable = new Function('run', 'rng', 'activeSlot', 'nodeId', 'encounterId',
    'saves', 'commitExpansionCandidate', 'showSettingsNotice',
    `return candidate => {${wrapper}}`)(run, rng, 1, nodeId, encounterId,
    saves, commitExpansionCandidate, message => notices.push(message));
  durable(combat); combat.beforeCombatCommit = durable;
  return { registries, run, rng, combat, saves, notices, banks: () => banks };
}

test('production browser wrapper preserves historical expanded checkpoint and RNG after unsaved actions', async () => {
  const f = fixture(false);
  await settle();
  const entry = f.saves.loadRun(f.registries);
  dispatch(f.combat, { type: 'endTurn' });
  await settle();
  const loaded = f.saves.loadRun(f.registries);
  assert.equal(f.combat.turn, 2);
  assert.equal(loaded.combatEntered.snapshot.turn, 1);
  assert.deepEqual(loaded.combatEntered.snapshot, entry.combatEntered.snapshot);
  assert.deepEqual(loaded.streamCounters, entry.streamCounters);
  assert.equal(f.banks(), 0);
  assert.deepEqual(f.notices, []);
});

test('production browser wrapper banks opted-in learning and preserves its latest accepted checkpoint', async () => {
  const f = fixture(true);
  await settle();
  assert.equal(f.banks(), 1);
  dispatch(f.combat, { type: 'endTurn' });
  let choices = 0;
  while (f.combat.pendingReaction) {
    assert.ok(choices++ < 64, 'reaction answers remain bounded');
    dispatch(f.combat, { type: 'chooseReaction', offerId: f.combat.pendingReaction.id, optionId: null });
  }
  await settle();
  const loaded = f.saves.loadRun(f.registries);
  assert.equal(f.banks(), 2 + choices, 'each accepted reaction command banks its own checkpoint');
  assert.equal(loaded.combatEntered.snapshot.turn, 2);
  assert.deepEqual(loaded.streamCounters, f.rng.getCounters());
  assert.deepEqual(loaded.skills.perception, f.run.skills.perception);
  assert.deepEqual(f.notices, []);
});
