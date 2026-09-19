import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { commitEventChoice } from '../src/engine/quests.js';
import { resolveUnknownNode } from '../src/engine/encounters.js';
import { availableEventChoices, hasQuestCompletion } from '../src/model/quests.js';
import { eventChoicesWithHistory } from '../src/content/events.js';
const registries = createRegistries(contentBundle);
const fresh = () => createRunState({ seed: 123, classId: 'reaver', registries });
const commit = (run, eventId, choiceId) => commitEventChoice({ run, registries, rng: createRng(7) }, { eventId, choiceId });
const choices = run => availableEventChoices(eventChoicesWithHistory(registries.events.get('lanternCaravan')), run).map(({ choice }) => choice.id);
function pool(run, seenEvents = []) {
  let candidates;
  resolveUnknownNode(registries, { float: () => 0, pick: (_stream, ids) => { candidates = ids; return ids[0]; } }, { tier: 1, history: run.history, seenEvents });
  return candidates;
}
test('Last Lantern enters real Unknown pools and only aid unlocks its return, including fallback', () => {
  const run = fresh();
  assert.ok(pool(run).includes('lastLantern'));
  assert.ok(!pool(run).includes('lanternCaravan'));
  commit(run, 'lastLantern', 'leave');
  assert.ok(!pool(run, registries.events.ids()).includes('lanternCaravan'));
  commit(run, 'lastLantern', 'haulBeacon');
  assert.ok(pool(run).includes('lanternCaravan'));
  commit(run, 'lanternCaravan', 'leave');
  assert.ok(!hasQuestCompletion(run, 'lastLantern'));
  assert.ok(!pool(run, registries.events.ids()).includes('lanternCaravan'));
});
test('oil investment charges exactly 40, exposes lesson, and completes after save/resume', () => {
  let run = fresh(); run.cinders = 39;
  assert.throws(() => commit(run, 'lastLantern', 'buyOil'), /costs more/);
  assert.equal(run.cinders, 39);
  run.cinders = 40;
  commit(run, 'lastLantern', 'buyOil');
  assert.equal(run.cinders, 0);
  run = deserializeRun(serializeRun(run));
  assert.deepEqual(choices(run), ['acceptLesson', 'claimStrongbox', 'leave']);
  assert.throws(() => commit(run, 'lanternCaravan', 'acceptWages'), /not open/);
  const upgraded = run.deck.filter(card => card.upgraded).length;
  const result = commit(run, 'lanternCaravan', 'acceptLesson');
  assert.ok(run.deck.filter(card => card.upgraded).length > upgraded || result.events.some(event => event.type === 'armamentSmithed'));
  assert.equal(result.completions.length, 1);
  assert.ok(hasQuestCompletion(run, 'lastLantern'));
  assert.ok(!pool(run, registries.events.ids()).includes('lanternCaravan'));
});
test('beacon work costs health and earns wages; strongbox instead adds its promised curse', () => {
  for (const reward of ['acceptWages', 'claimStrongbox']) {
    const run = fresh();
    const hp = run.hp;
    commit(run, 'lastLantern', 'haulBeacon');
    assert.equal(run.hp, hp - 8);
    assert.deepEqual(choices(run), ['acceptWages', 'claimStrongbox', 'leave']);
    const cinders = run.cinders, deck = run.deck.length;
    commit(run, 'lanternCaravan', reward);
    assert.equal(run.cinders, cinders + (reward === 'acceptWages' ? 60 : 100));
    assert.equal(run.deck.length, deck + (reward === 'claimStrongbox' ? 1 : 0));
    if (reward === 'claimStrongbox') assert.equal(run.deck.at(-1).cardId, 'guilt');
    assert.ok(hasQuestCompletion(run, 'lastLantern'));
  }
});

