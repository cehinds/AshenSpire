// tests/quest-dialogue.test.mjs — plan phase 10a: the quest completion door
// and the quest dialogue screen's model, headless.
//
// Acceptance (plan, PR 10a): committing a completing chain choice writes one
// questCompleted row and emits one event; a reload or replay of the same commit
// writes none; claiming an atlas quest does the same with source 'atlas';
// Back, Continue and speech ending issue no command. And the two phase-10 risk
// rows: a quest completes once across a reload and a second commit, and
// dialogue grants no effect outside a response.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, serializeRun, deserializeRun } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { commitEventChoice, completeQuest, atlasQuestAction } from '../src/engine/quests.js';
import {
  recordEventChoice, recordQuestCompletion, hasQuestCompletion, questCompletionHistoryProblems,
  eventChoiceHistoryProblems, hasEventChoice, questChainForEvent, questsCompletedBy,
} from '../src/model/quests.js';
import { EVENTS, TRIGGER_EVENTS } from '../src/model/schemas.js';
import { validateContent } from '../src/model/validate.js';
import { questChains, eventSpeakers, eventChoicesWithHistory } from '../src/content/events.js';
import { worldAtlas } from '../src/content/generated/worldAtlas.js';
import { ATLAS, generateJourney, completeJourneyNode } from '../src/model/worldAtlas.js';
import {
  createDialogueState, dialogueBeats, dialogueModel, dialogueStep, dialogueFrameVars, DIALOGUE_ACTIONS,
} from '../src/ui/models/DialogueModel.js';
import { W4_PARENT, W4C_LAYOUT } from './fixtures/w4-scene-layouts.mjs';

const registries = createRegistries(contentBundle);
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function newRun() {
  const run = createRunState({ seed: 123, classId: 'reaver', registries });
  if (!Number.isInteger(run.actNumber) || run.actNumber < 1) run.actNumber = 1;
  if (!Number.isInteger(run.floor) || run.floor < 0) run.floor = 0;
  return run;
}
/** A run whose history has walked the Nameless chain to the second cairn. */
function runAtSecondCairn(keeperChoice = 'faceKeeper') {
  const run = newRun();
  recordEventChoice(run, { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' });
  recordEventChoice(run, { eventId: 'namelessKeeper', choiceId: keeperChoice });
  return run;
}
const completionRows = (run) => run.history.filter((row) => row && row.kind === 'questCompleted');
const ctxFor = (run, sink) => ({ run, registries, rng: createRng(7), emit: (type, payload) => sink.push({ type, ...payload }) });

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

test('committing a completing chain choice runs effects, then the history row, then one completion and one event', () => {
  const run = runAtSecondCairn('faceKeeper');
  const sink = [];
  const cindersBefore = run.cinders;
  const deckBefore = run.deck.length;
  const result = commitEventChoice(ctxFor(run, sink), { eventId: 'namelessRest', choiceId: 'lootBarrow' });
  assert.equal(run.cinders, cindersBefore + 120, 'the choice\'s own effects ran');
  assert.equal(run.deck.length, deckBefore + 1, 'the Guilt curse joined the deck');
  const tail = run.history.slice(-2);
  assert.deepEqual(tail.map((row) => row.kind), ['eventChoice', 'questCompleted'], 'history row first, completion second');
  assert.deepEqual(tail[1], { kind: 'questCompleted', questId: 'nameless', source: 'event' });
  assert.equal(completionRows(run).length, 1);
  assert.deepEqual(sink.filter((e) => e.type === 'questCompleted'), [{ type: 'questCompleted', questId: 'nameless', source: 'event' }]);
  assert.equal(result.events.filter((e) => e.type === 'questCompleted').length, 1);
  assert.deepEqual(result.completions, [{ kind: 'questCompleted', questId: 'nameless', source: 'event' }]);
});

test('risk: a quest completes once across a reload and a second commit of the same choice', () => {
  const run = runAtSecondCairn('faceKeeper');
  const sink = [];
  commitEventChoice(ctxFor(run, sink), { eventId: 'namelessRest', choiceId: 'lootBarrow' });
  const reloaded = deserializeRun(serializeRun(run));
  assert.equal(completionRows(reloaded).length, 1, 'the completion row survives the save');
  const replay = commitEventChoice(ctxFor(reloaded, sink), { eventId: 'namelessRest', choiceId: 'lootBarrow' });
  assert.equal(completionRows(reloaded).length, 1, 'one questCompleted row after the replay');
  assert.equal(sink.filter((e) => e.type === 'questCompleted').length, 1, 'one questCompleted event across both commits');
  assert.deepEqual(replay.completions, []);
  assert.equal(replay.events.some((e) => e.type === 'questCompleted'), false);
});

test('every non-Leave answer at the second cairn completes nameless; Leave and earlier steps complete nothing', () => {
  for (const choiceId of ['keepVigil', 'restAmongStones', 'lootBarrow']) {
    assert.deepEqual(questsCompletedBy(questChains, { eventId: 'namelessRest', choiceId }), ['nameless']);
  }
  assert.deepEqual(questsCompletedBy(questChains, { eventId: 'namelessRest', choiceId: 'leave' }), []);
  assert.deepEqual(questsCompletedBy(questChains, { eventId: 'namelessKeeper', choiceId: 'acceptThanks' }), []);

  const leaveRun = runAtSecondCairn('faceKeeper');
  const sink = [];
  commitEventChoice(ctxFor(leaveRun, sink), { eventId: 'namelessRest', choiceId: 'leave' });
  commitEventChoice(ctxFor(leaveRun, sink), { eventId: 'goldboughAvatar', choiceId: 'leave' });
  assert.equal(completionRows(leaveRun).length, 0);
  assert.equal(sink.length, 0, 'no questCompleted without a completing choice');
});

test('the door refuses a choice the event lacks, one history has not opened, and one the run cannot pay for', () => {
  const run = newRun();
  const ctx = ctxFor(run, []);
  assert.throws(() => commitEventChoice(ctx, { eventId: 'namelessRest', choiceId: 'noSuchChoice' }), /has no choice/);
  assert.throws(() => commitEventChoice(ctx, { eventId: 'namelessRest', choiceId: 'lootBarrow' }), /not open to this run's history/);
  const poor = runAtSecondCairn('faceKeeper');
  recordEventChoice(poor, { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' });
  poor.cinders = 0;
  assert.throws(() => commitEventChoice(ctxFor(poor, []), { eventId: 'namelessKeeper', choiceId: 'returnCinders' }), /costs more/);
  assert.equal(completionRows(run).length + completionRows(poor).length, 0);
});

test('claiming an atlas quest completes it through the same door with source atlas, once', () => {
  let journey = null;
  let quest = null;
  for (let i = 0; i < 30 && !quest; i++) {
    journey = generateJourney(`QUEST${i}`);
    quest = Object.values(ATLAS.quests).find((q) => journey.activeNodeIds.includes(q.objectiveNodeId));
  }
  assert.ok(quest, 'a journey in the fixture sweep offers a quest');
  const run = newRun();
  run.journey = journey;
  const sink = [];
  const ctx = ctxFor(run, sink);
  const accepted = atlasQuestAction(ctx, quest.questId);
  assert.equal(accepted.plan.next, 'accepted');
  assert.equal(accepted.completion, null, 'accepting is not completing');
  completeJourneyNode(journey, quest.objectiveNodeId);
  const cindersBefore = run.cinders;
  const claimed = atlasQuestAction(ctx, quest.questId);
  assert.equal(claimed.plan.next, 'claimed');
  assert.equal(run.cinders, cindersBefore + quest.rewardCinders);
  assert.deepEqual(claimed.completion, { kind: 'questCompleted', questId: quest.questId, source: 'atlas' });
  assert.deepEqual(sink, [{ type: 'questCompleted', questId: quest.questId, source: 'atlas' }]);

  const again = atlasQuestAction(ctx, quest.questId);
  assert.equal(again.plan.allowed, false, 'a claimed quest cannot be claimed again');
  assert.equal(completeQuest(ctx, { questId: quest.questId, source: 'atlas' }), null, 'the door itself is idempotent');
  const reloaded = deserializeRun(serializeRun(run));
  assert.equal(completeQuest(ctxFor(reloaded, sink), { questId: quest.questId, source: 'atlas' }), null);
  assert.equal(completionRows(reloaded).length, 1);
  assert.equal(sink.length, 1, 'still one questCompleted event');
});

test('questCompleted is a bus event, and only the door emits it', () => {
  assert.ok(EVENTS.includes('questCompleted'));
  assert.ok(TRIGGER_EVENTS.includes('questCompleted'));
  const emitters = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) {
        const source = readFileSync(path, 'utf8');
        if (/emit\(\s*['"]questCompleted['"]|type:\s*['"]questCompleted['"]/.test(source)) emitters.push(path.slice(ROOT.length).split(/[\\/]/).join('/'));
      }
    }
  }(join(ROOT, 'src')));
  assert.deepEqual(emitters, ['src/engine/quests.js']);
});

test('the new history row kind is accepted by save validation and ignored by the choice readers', () => {
  const run = newRun();
  recordEventChoice(run, { eventId: 'graveOfTheNameless', choiceId: 'payRespects' });
  assert.deepEqual(recordQuestCompletion(run, { questId: 'survey:crownfall', source: 'atlas' }),
    { kind: 'questCompleted', questId: 'survey:crownfall', source: 'atlas' });
  assert.equal(recordQuestCompletion(run, { questId: 'survey:crownfall', source: 'event' }), null, 'at most once per quest');
  const reloaded = deserializeRun(serializeRun(run));
  assert.deepEqual(reloaded.history.at(-1), { kind: 'questCompleted', questId: 'survey:crownfall', source: 'atlas' });
  assert.deepEqual(eventChoiceHistoryProblems(reloaded), []);
  assert.deepEqual(questCompletionHistoryProblems(reloaded), []);
  assert.equal(hasEventChoice(reloaded, { eventId: 'graveOfTheNameless', choiceId: 'payRespects' }), true);
  assert.equal(hasQuestCompletion(reloaded, 'survey:crownfall'), true);
  assert.equal(hasQuestCompletion(reloaded, 'nameless'), false);
  assert.throws(() => recordQuestCompletion(run, { questId: 'bad id', source: 'event' }), /stable quest id/);
  assert.throws(() => recordQuestCompletion(run, { questId: 'nameless', source: 'board' }), /source must be one of/);
  assert.deepEqual(questCompletionHistoryProblems([{ kind: 'questCompleted', questId: 'x', source: 'event' }, { kind: 'questCompleted', questId: 'x', source: 'atlas' }]),
    ["history[1].questId: 'x' completed twice"]);
});

// ---------------------------------------------------------------------------
// Validation refusals by name (the style of tests/engine.test.js test 15)
// ---------------------------------------------------------------------------

test('shipped quest chains and speakers validate; each broken ref is refused by name', () => {
  const shipped = validateContent(contentBundle);
  assert.ok(shipped.ok, shipped.errors.slice(0, 5).map((e) => `${e.path}: ${e.msg}`).join(' | '));
  const refusedWith = (patch, text) => {
    const r = validateContent({ ...contentBundle, ...patch });
    return !r.ok && r.errors.some((e) => e.msg.includes(text));
  };
  const chain = (extra) => ({ questChains: { ...questChains, planted: extra } });

  assert.ok(refusedWith(chain({ steps: ['noSuchEvent'], completes: [{ eventId: 'namelessRest', choiceId: 'keepVigil' }] }),
    "quest chain step 'noSuchEvent' is not a shipped event"), 'an unknown step is refused');
  assert.ok(refusedWith(chain({ steps: ['namelessRest'], completes: [{ eventId: 'namelessRest', choiceId: 'noSuchChoice' }] }),
    'does not resolve to a shipped choice'), 'an unresolved completes ref is refused');
  assert.ok(refusedWith(chain({ steps: ['namelessKeeper'], completes: [{ eventId: 'namelessRest', choiceId: 'keepVigil' }] }),
    'is not a step of this chain'), 'a completes ref outside the chain is refused');
  assert.ok(refusedWith(chain({ steps: ['namelessRest'], completes: [{ eventId: 'namelessRest', choiceId: 'leave' }] }),
    'a Leave choice may not complete a quest'), 'a Leave completion is refused');
  assert.ok(refusedWith(chain({ steps: ['goldboughAvatar'], completes: [{ eventId: 'goldboughAvatar', choiceId: 'pray' }] }),
    "chain event 'goldboughAvatar' names no speaker"), 'a chain event without a speaker is refused');
  assert.ok(refusedWith({ eventSpeakers: { ...eventSpeakers, namelessRest: 'nobodyAtAll' } },
    "unknown speaker 'nobodyAtAll'"), 'an event naming no speaker row is refused');
  assert.ok(refusedWith({ atlasQuests: [{ ...contentBundle.atlasQuests[0], speakerId: 'nobodyAtAll' }] },
    "unknown speaker 'nobodyAtAll'"), 'an atlas quest naming no speaker row is refused');
  assert.ok(refusedWith({ speakers: [...contentBundle.speakers, { id: 'planted', name: 'Planted', portraitKey: 'noSuchArt' }] },
    "unknown portrait key 'noSuchArt'"), 'a portrait key no art answers to is refused');
});

// ---------------------------------------------------------------------------
// Speakers and routing
// ---------------------------------------------------------------------------

test('every Nameless step routes to dialogue with a speaker; one-off events do not', () => {
  assert.deepEqual(questChains.nameless.steps, ['graveOfTheNameless', 'namelessKeeper', 'namelessRest']);
  for (const eventId of questChains.nameless.steps) {
    assert.equal(questChainForEvent(registries.questChains, eventId), 'nameless', `${eventId} is a chain step`);
    const speaker = registries.speakers.get(registries.eventSpeakers[eventId]);
    assert.ok(speaker.name, `${eventId} is spoken by ${speaker.id}`);
    const def = registries.events.get(eventId);
    assert.ok(dialogueBeats(def.text).length >= 2, `${eventId} divides into beats`);
  }
  for (const eventId of ['goldboughAvatar', 'abandonedCart', 'sleepingSmith']) {
    assert.equal(questChainForEvent(registries.questChains, eventId), null, `${eventId} keeps the Event screen`);
  }
});

test('every atlas quest row names a speaker that exists', () => {
  assert.ok(worldAtlas.quests.length > 0);
  for (const quest of worldAtlas.quests) {
    assert.ok(registries.speakers.has(quest.speakerId), `${quest.questId} → ${quest.speakerId}`);
  }
});

// ---------------------------------------------------------------------------
// DialogueModel
// ---------------------------------------------------------------------------

const keeper = { id: 'keeperOfTheNameless', name: 'The Keeper of the Nameless', portraitKey: 'emberStarvedPilgrim' };
const input = (overrides = {}) => ({
  eventId: 'namelessKeeper',
  title: 'The Keeper of the Nameless',
  text: 'First line.\n\nSecond line,\n  still second.\n\n\nThird line.',
  speaker: keeper,
  portraitAvailable: true,
  responses: [
    { choiceId: 'returnCinders', label: 'Return', affordable: false, binding: false, resultText: 'Paid.' },
    { choiceId: 'acceptThanks', label: 'Accept', affordable: true, binding: true, resultText: 'A bell.' },
    { choiceId: 'leave', label: 'Leave', affordable: true, binding: false, resultText: 'Gone.' },
  ],
  ...overrides,
});

test('beats split on blank lines; the player stands left and the speaker right', () => {
  assert.deepEqual([...dialogueBeats('A.\n\nB  b.\n \nC.')], ['A.', 'B b.', 'C.']);
  assert.deepEqual([...dialogueBeats('')], ['']);
  const view = dialogueModel(input());
  assert.equal(view.total, 3);
  assert.deepEqual(view.beats.map((beat) => beat.text), ['First line.', 'Second line, still second.', 'Third line.']);
  assert.equal(view.player.side, 'left');
  assert.equal(view.speaker.side, 'right');
  assert.deepEqual(view.caption, { side: 'speaker', speakerName: keeper.name, text: 'First line.' });
  assert.deepEqual(view.speaker.portrait, { kind: 'art', key: 'emberStarvedPilgrim', name: keeper.name });
  assert.ok(Object.isFrozen(view) && Object.isFrozen(view.beats[0]) && Object.isFrozen(view.controls.back));
});

test('Continue walks the beats and responses appear on the last beat only', () => {
  let state = createDialogueState();
  const seen = [];
  for (;;) {
    const view = dialogueModel(input(), state);
    seen.push([view.beat, view.responses.length, view.phase]);
    if (view.onLast) break;
    const step = dialogueStep(view, state, { type: 'continue' });
    assert.equal(step.command, null);
    state = step.state;
  }
  assert.deepEqual(seen, [[0, 0, 'speaking'], [1, 0, 'speaking'], [2, 3, 'respond']]);
  const last = dialogueModel(input(), state);
  assert.equal(last.controls.continue.enabled, false, 'on the last unanswered beat the responses are the way on');
  assert.equal(last.controls.skipSpeech.enabled, false);
  assert.equal(dialogueStep(last, state, { type: 'continue' }).state, state, 'a closed Continue changes nothing');
});

test('risk: Back, Continue, Skip speech and speech ending issue no command and never pick a response', () => {
  let state = createDialogueState();
  const drive = (action) => {
    const step = dialogueStep(dialogueModel(input(), state), state, action);
    assert.equal(step.command, null, `${action.type} issued no command`);
    assert.equal(step.exit, false, `${action.type} did not leave`);
    state = step.state;
    return dialogueModel(input(), state);
  };
  assert.equal(drive({ type: 'back' }).beat, 0, 'Back on the first beat stays');
  assert.equal(drive({ type: 'continue' }).beat, 1);
  assert.equal(drive({ type: 'back' }).beat, 0);
  const started = state.generation;
  assert.equal(drive({ type: 'speechEnded', generation: started }).beat, 1, 'a current speech ending advances prose');
  assert.equal(drive({ type: 'speechEnded', generation: started }).beat, 1, 'a stale speech ending changes nothing');
  assert.equal(drive({ type: 'skipSpeech' }).beat, 2, 'Skip speech reaches the last beat');
  const atLast = drive({ type: 'speechEnded', generation: state.generation });
  assert.equal(atLast.beat, 2, 'speech ending on the last beat never picks a response');
  assert.equal(atLast.resolved, false);
  assert.equal(drive({ type: 'back' }).beat, 1, 'reviewing an earlier beat is presentation only');
  assert.equal(drive({ type: 'respond', choiceId: 'acceptThanks' }).resolved, false, 'a response off the last beat is not offered');
  assert.throws(() => dialogueStep(dialogueModel(input(), state), state, { type: 'grantReward' }), /Unknown dialogue action/);
  assert.deepEqual([...DIALOGUE_ACTIONS], ['back', 'continue', 'skipSpeech', 'speechEnded', 'respond', 'resolved']);
});

test('only an offered, affordable response becomes the one command; Continue then leaves', () => {
  let state = dialogueStep(dialogueModel(input()), createDialogueState(), { type: 'skipSpeech' }).state;
  const view = dialogueModel(input(), state);
  assert.equal(dialogueStep(view, state, { type: 'respond', choiceId: 'returnCinders' }).command, null, 'an unaffordable response is closed');
  assert.equal(dialogueStep(view, state, { type: 'respond', choiceId: 'notOffered' }).command, null);
  const step = dialogueStep(view, state, { type: 'respond', choiceId: 'acceptThanks' });
  assert.deepEqual(step.command, { type: 'commitEventChoice', eventId: 'namelessKeeper', choiceId: 'acceptThanks' });
  assert.equal(step.state, state, 'the response waits for the door\'s receipt');
  state = dialogueStep(view, state, { type: 'resolved', choiceId: 'acceptThanks', resultText: 'A bell.' }).state;
  const done = dialogueModel(input(), state);
  assert.equal(done.phase, 'resolved');
  assert.deepEqual(done.responses, [], 'an answered exchange offers nothing again');
  assert.deepEqual(done.caption, { side: 'player', speakerName: null, text: 'A bell.' });
  assert.deepEqual([done.controls.back.enabled, done.controls.skipSpeech.enabled, done.controls.continue.enabled], [false, false, true]);
  assert.equal(dialogueStep(done, state, { type: 'respond', choiceId: 'acceptThanks' }).command, null, 'no second commit');
  const leave = dialogueStep(done, state, { type: 'continue' });
  assert.deepEqual([leave.command, leave.exit], [null, true]);
});

test('a missing portrait shows the name plate, never a blank', () => {
  const warden = { id: 'roadWarden', name: 'The Warden', portraitKey: '' };
  assert.deepEqual(dialogueModel(input({ speaker: warden, portraitAvailable: false })).speaker.portrait,
    { kind: 'plate', key: null, name: 'The Warden' });
  assert.deepEqual(dialogueModel(input({ portraitAvailable: false })).speaker.portrait,
    { kind: 'plate', key: null, name: keeper.name }, 'art the screen cannot find falls back too');
  assert.equal(registries.speakers.get('roadWarden').portraitKey, '', 'the shipped warden has no portrait yet');
  assert.throws(() => dialogueModel(input({ speaker: { id: 'x', name: '' } })), /named speaker/);
});

test('the shipped Nameless steps project through the model with their real choices', () => {
  const run = runAtSecondCairn('acceptThanks');
  for (const eventId of questChains.nameless.steps) {
    const def = registries.events.get(eventId);
    const view = dialogueModel({
      eventId, title: def.name, text: def.text,
      speaker: registries.speakers.get(registries.eventSpeakers[eventId]),
      portraitAvailable: true,
      responses: eventChoicesWithHistory(def).map((choice) => ({ choiceId: choice.id, label: choice.label })),
    });
    assert.equal(view.speaker.side, 'right');
    assert.equal(view.responses.length, 0, `${eventId} opens on its first beat with no responses`);
  }
  assert.ok(run.history.length >= 2);
});

test('the dialogue frame resolves a W4c scene config to W4 frame custom properties', () => {
  const layout = W4C_LAYOUT;
  const vars = dialogueFrameVars(layout, W4_PARENT);
  const ref = 'max(16px / var(--ui-zoom, 1), 1rem)';
  const vw = 'var(--w4-vw, calc(1vw / var(--ui-zoom, 1)))';
  const vh = 'var(--w4-vh, calc(1dvh / var(--ui-zoom, 1)))';
  assert.equal(vars['--dialogue-ref-rem'], ref);
  assert.equal(vars['--dialogue-inset-x'], `calc(2.5 * ${vw})`);
  assert.equal(vars['--dialogue-portrait-w'], `calc(20 * ${vw})`);
  assert.equal(vars['--dialogue-portrait-w-compact'], `calc(30 * ${vw})`);
  assert.equal(vars['--dialogue-slot-top'], `calc(2 * ${vh})`);
  assert.equal(vars['--dialogue-context-w'], `calc(95 * ${vw})`);
  assert.equal(vars['--dialogue-context-inset-y'], `calc(1 * ${vh})`);
  assert.equal(vars['--dialogue-foot-gap'], `calc(1.5 * ${vw})`);
  assert.equal(vars['--dialogue-action-h'], `max(calc(6 * ${vh}), calc(44px / var(--ui-zoom, 1)))`);
  assert.equal(vars['--dialogue-caption-min'], `calc(3.645 * ${ref})`);
  assert.equal(vars['--dialogue-response-min-h'], 'calc(44px / var(--ui-zoom, 1))', 'responses keep the touch target');
  assert.equal(vars['--dialogue-response-lines'], '2');
  assert.equal(vars['--dialogue-title-size'], `calc(0.95 * ${ref})`);
  assert.deepEqual(
    ['skybox', 'floor', 'player-portrait', 'npc-portrait', 'context', 'hud', 'footer'].map((name) => vars[`--dialogue-z-${name}`]),
    ['2', '3', '4', '4', '5', '6', '6'],
  );
  assert.equal(vars['--dialogue-speaker-lift'], '1');
  const sizing = layout.sizing;
  assert.throws(() => dialogueFrameVars({ ...layout, sizing: { ...sizing, context: { ...sizing.context, captionLines: 0 } } }, W4_PARENT), /captionLines/);
  assert.throws(() => dialogueFrameVars({ ...layout, sizing: { ...sizing, bands: { ...sizing.bands, footer: 20 } } }, W4_PARENT), /bands must sum to 100 \(got 105\)/);
});
