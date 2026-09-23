// tests/quest-board.test.mjs — plan phase 10b: the quest board as a location
// service, headless.
//
// Acceptance (plan, PR 10b): a town lists its quests; accepting and collecting
// are spoken (the exchange is a dialogue with the quest row's speaker, and its
// response commits through questAction and the 10a door); a collected quest
// shows as done and rewards once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { boardQuestResponse, BOARD_RESPONSES } from '../src/engine/quests.js';
import { createLocationVisit, leaveLocation } from '../src/engine/locations.js';
import { recordEventChoice } from '../src/model/quests.js';
import { SERVICE_TAGS, questBoardPointAt, restLocationAtPoint, locationTags } from '../src/model/locations.js';
import { ATLAS, generateJourney, completeJourneyNode } from '../src/model/worldAtlas.js';
import { boardQuestIds, questBoardModel, questExchange, questJournal } from '../src/ui/models/QuestBoardModel.js';
import { createDialogueState, dialogueModel, dialogueStep } from '../src/ui/models/DialogueModel.js';

const registries = createRegistries(contentBundle);
const COPY = Object.freeze({
  label: (move, offer) => `${move}:${offer.reward}`,
  result: (move) => `result:${move}`,
});

function newRun() {
  const run = createRunState({ seed: 123, classId: 'reaver', registries });
  if (!Number.isInteger(run.actNumber) || run.actNumber < 1) run.actNumber = 1;
  if (!Number.isInteger(run.floor) || run.floor < 0) run.floor = 0;
  return run;
}
const ownerOf = (pointId) => {
  const point = ATLAS.data.local_map_nodes.find((p) => p.nodeId === pointId);
  return ATLAS.localMaps[point.mapId].ownerNodeId;
};
/** A run on a journey whose road reaches a posted quest's objective. */
function runWithOpenQuest() {
  for (let i = 0; i < 40; i++) {
    const journey = generateJourney(`BOARD${i}`);
    const row = ATLAS.data.node_quests.find((r) => journey.activeNodeIds.includes(ATLAS.quests[r.questId].objectiveNodeId));
    if (!row) continue;
    const run = newRun();
    run.journey = journey;
    return { run, questId: row.questId, ownerId: ownerOf(row.nodeId), quest: ATLAS.quests[row.questId] };
  }
  throw new Error('no journey in the fixture sweep reaches a posted quest');
}
const completions = (run) => run.history.filter((row) => row && row.kind === 'questCompleted');
const offerOf = (run, ownerId, questId) => questBoardModel({ registries, run, ownerNodeId: ownerId }).offers.find((o) => o.questId === questId);

test('the inn carries the questBoard service; the shrine, the chapel and the camp do not', () => {
  assert.equal(SERVICE_TAGS.questBoard, 'questBoard');
  assert.ok(locationTags(registries, 'inn').includes('questBoard'));
  const run = newRun();
  for (const [id, expected] of [['inn', true], ['shrine', false], ['chapel', false], ['camp', false]]) {
    const visit = createLocationVisit({ run, registries, rng: createRng(1) }, id);
    assert.equal(visit.services.questBoard, expected, `${id} questBoard`);
    leaveLocation(visit);
  }
});

test('a town with an inn keeps a board; the point that opens it is the inn', () => {
  for (const row of ATLAS.data.node_quests) {
    const owner = ownerOf(row.nodeId);
    const point = questBoardPointAt(registries, owner);
    assert.equal(point, `${owner}/inn`, `${owner} opens its board at the inn`);
    assert.equal(restLocationAtPoint(registries, point), 'inn');
  }
  assert.equal(restLocationAtPoint(registries, 'crownfall/warden'), null, 'a point with no rest service opens no location');
  assert.equal(questBoardPointAt(registries, 'no-such-town'), null);
});

test('a town lists its quests with the state questAction plans', () => {
  const { run, questId, ownerId, quest } = runWithOpenQuest();
  assert.deepEqual(boardQuestIds(ownerId).map((r) => r.questId), [questId]);
  const view = questBoardModel({ registries, run, ownerNodeId: ownerId });
  assert.equal(view.offers.length, 1);
  const offer = view.offers[0];
  assert.equal(offer.state, 'open');
  assert.equal(offer.actionable, true);
  assert.equal(offer.reward, quest.rewardCinders);
  assert.equal(offer.speaker.id, quest.speakerId);
  assert.deepEqual(view.counts, { offered: 1, ready: 0, open: 1 });
});

test('accepting and collecting are spoken, commit through the door, and a collected quest is done and rewards once', () => {
  const { run, questId, ownerId, quest } = runWithOpenQuest();
  const ctx = { run, registries, rng: createRng(7) };

  // Accept: the exchange is a dialogue with the quest row's speaker, and only
  // its response commits.
  const offered = questExchange(offerOf(run, ownerId, questId), COPY);
  assert.equal(offered.move, 'accept');
  assert.equal(offered.speaker.id, quest.speakerId);
  assert.deepEqual(offered.definition.choices.map((c) => c.id), ['accept', 'leave']);
  const input = { eventId: offered.definition.id, title: offered.definition.name, text: offered.definition.text, speaker: offered.speaker,
    responses: offered.definition.choices.map((c) => ({ choiceId: c.id, label: c.label, resultText: c.resultText })) };
  let state = createDialogueState();
  let view = dialogueModel(input, state);
  const skip = dialogueStep(view, state, { type: 'skipSpeech' });
  assert.equal(skip.command, null, 'moving the speech issues no command');
  state = skip.state;
  view = dialogueModel(input, state);
  const respond = dialogueStep(view, state, { type: 'respond', choiceId: 'accept' });
  assert.equal(respond.command.choiceId, 'accept');
  const accepted = boardQuestResponse(ctx, { questId, choiceId: respond.command.choiceId });
  assert.equal(accepted.plan.next, 'accepted');
  assert.equal(run.journey.questStates[questId], 'accepted');
  assert.equal(completions(run).length, 0, 'accepting is not completing');
  assert.equal(offerOf(run, ownerId, questId).state, 'accepted');
  assert.throws(() => questExchange(offerOf(run, ownerId, questId), COPY), /nothing to answer/);
  assert.deepEqual(questJournal({ registries, run }).started.map((r) => r.questId), [questId]);

  // Collect is refused, by name, until the objective is explored.
  assert.throws(() => boardQuestResponse(ctx, { questId, choiceId: 'collect' }), new RegExp(`quest '${questId}' does not offer 'collect'`));
  completeJourneyNode(run.journey, quest.objectiveNodeId);
  const ready = offerOf(run, ownerId, questId);
  assert.equal(ready.state, 'ready');
  const reported = questExchange(ready, COPY);
  assert.equal(reported.move, 'collect');
  assert.equal(reported.definition.text, ready.report, 'the warden speaks the report on return');
  assert.deepEqual(reported.definition.choices.map((c) => c.id), ['collect', 'leave']);

  const before = run.cinders;
  const collected = boardQuestResponse(ctx, { questId, choiceId: 'collect' });
  assert.equal(run.cinders, before + quest.rewardCinders);
  assert.deepEqual(collected.completion, { kind: 'questCompleted', questId, source: 'atlas' });
  assert.equal(offerOf(run, ownerId, questId).state, 'done');
  assert.deepEqual(questJournal({ registries, run }).completed.map((r) => [r.questId, r.source]), [[questId, 'atlas']]);
  assert.deepEqual(questJournal({ registries, run }).started, []);

  // Rewards once: a second collect, before and after a reload, is refused and pays nothing.
  assert.throws(() => boardQuestResponse(ctx, { questId, choiceId: 'collect' }), /does not offer 'collect'/);
  const reloaded = deserializeRun(serializeRun(run));
  assert.throws(() => boardQuestResponse({ ...ctx, run: reloaded }, { questId, choiceId: 'collect' }), /does not offer 'collect'/);
  assert.equal(reloaded.cinders, before + quest.rewardCinders);
  assert.equal(completions(reloaded).length, 1);
  assert.equal(offerOf(reloaded, ownerId, questId).state, 'done');
});

test('Leave answers without a move, and a response the board does not know is refused by name', () => {
  const { run, questId } = runWithOpenQuest();
  const ctx = { run, registries, rng: createRng(7) };
  const before = serializeRun(run);
  assert.deepEqual(boardQuestResponse(ctx, { questId, choiceId: 'leave' }), { choiceId: 'leave', plan: null, completion: null, events: [] });
  assert.equal(serializeRun(run), before, 'Leave changes nothing');
  assert.throws(() => boardQuestResponse(ctx, { questId, choiceId: 'claimAll' }), /'claimAll' is not a board response/);
  assert.deepEqual(Object.keys(BOARD_RESPONSES), ['accept', 'collect', 'leave']);
});

test('the journal reads a started event chain off run.history, and its completion', () => {
  const run = newRun();
  assert.deepEqual(questJournal({ registries, run }), { started: [], completed: [] });
  recordEventChoice(run, { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' });
  const started = questJournal({ registries, run }).started;
  assert.deepEqual(started.map((r) => [r.questId, r.source]), [['nameless', 'event']]);
  assert.equal(started[0].title, registries.events.get('graveOfTheNameless').name);
  run.history.push({ kind: 'questCompleted', questId: 'nameless', source: 'event' });
  const after = questJournal({ registries, run });
  assert.deepEqual(after.started, []);
  assert.deepEqual(after.completed.map((r) => r.questId), ['nameless']);
});
