#!/usr/bin/env node

// Issue #257: previous event choices can unlock or exclude later quest steps.
// This tool drives the public model API and plants malformed history and
// requirements under --selftest so fail-closed behavior remains observable.

import {
  availableEventChoices,
  availableQuestSteps,
  eventChoiceHistoryProblems,
  eventChoiceRequirementMet,
  hasEventChoice,
  recordEventChoice,
} from '../src/model/quests.js';
import { eventChoiceIds, eventChoicesWithHistory, events } from '../src/content/events.js';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const newRun = () => ({
  actNumber: 1,
  floor: 3,
  mapNodeId: 'a1_n3',
  history: [{ kind: 'event', nodeId: 'a1_n2' }],
});

const firstRun = newRun();
const firstReceipt = recordEventChoice(firstRun, {
  eventId: 'weepingPilgrim',
  choiceId: 'helpPilgrim',
});
check('committed choice appends a stable deterministic receipt',
  JSON.stringify(firstReceipt) === JSON.stringify({
    kind: 'eventChoice',
    eventId: 'weepingPilgrim',
    choiceId: 'helpPilgrim',
    actNumber: 1,
    floor: 3,
    mapNodeId: 'a1_n3',
  }));
check('pre-existing non-choice run history is preserved',
  firstRun.history.length === 2 && firstRun.history[0].kind === 'event');
check('exact earlier choice is discoverable', hasEventChoice(firstRun, {
  eventId: 'weepingPilgrim',
  choiceId: 'helpPilgrim',
}));
check('a different choice does not satisfy the fact', !hasEventChoice(firstRun, {
  eventId: 'weepingPilgrim',
  choiceId: 'refusePilgrim',
}));

const steps = [
  {
    id: 'pilgrimReturns',
    requiresHistory: { all: [{ eventId: 'weepingPilgrim', choiceId: 'helpPilgrim' }] },
  },
  {
    id: 'pilgrimResents',
    requiresHistory: { all: [{ eventId: 'weepingPilgrim', choiceId: 'refusePilgrim' }] },
  },
  {
    id: 'pilgrimNeutral',
    requiresHistory: { none: [{ eventId: 'weepingPilgrim', choiceId: 'refusePilgrim' }] },
  },
];
const available = availableQuestSteps(steps, firstRun).map((step) => step.id);
check('earlier choice unlocks the matching later step', available.includes('pilgrimReturns'));
check('unmade choice leaves its later step locked', !available.includes('pilgrimResents'));
check('none group excludes only a recorded contradictory choice', available.includes('pilgrimNeutral'));
check('any group accepts one of several prior choices', eventChoiceRequirementMet({
  any: [
    { eventId: 'goldboughAvatar', choiceId: 'pray' },
    { eventId: 'weepingPilgrim', choiceId: 'helpPilgrim' },
  ],
}, firstRun));

const replay = newRun();
recordEventChoice(replay, { eventId: 'weepingPilgrim', choiceId: 'helpPilgrim' });
check('same state and choice replay byte-identically', JSON.stringify(replay) === JSON.stringify(firstRun));

const authoredChoices = events.flatMap((event) => eventChoicesWithHistory(event)
  .map((choice) => ({ event, choice })));
check('all shipped event choices have stable explicit ids', authoredChoices.length === 54
  && authoredChoices.every(({ choice }) => /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(choice.id)));
check('choice ids are unique within each event', events.every((event) => {
  const ids = eventChoiceIds[event.id] || [];
  return new Set(ids).size === ids.length;
}));

const gatedChoices = availableEventChoices([
  { id: 'alwaysVisible' },
  {
    id: 'helpedPilgrim',
    requiresHistory: { all: [{ eventId: 'weepingPilgrim', choiceId: 'helpPilgrim' }] },
  },
  {
    id: 'refusedPilgrim',
    requiresHistory: { all: [{ eventId: 'weepingPilgrim', choiceId: 'refusePilgrim' }] },
  },
], firstRun);
check('event choice projection gates from history without reindexing',
  gatedChoices.length === 2
  && gatedChoices[0].choice.id === 'alwaysVisible'
  && gatedChoices[0].index === 0
  && gatedChoices[1].choice.id === 'helpedPilgrim'
  && gatedChoices[1].index === 1);

if (process.argv.includes('--selftest')) {
  const malformedHistory = {
    history: [{
      kind: 'eventChoice',
      eventId: 'weepingPilgrim',
      choiceId: '',
      actNumber: 1,
      floor: 3,
      mapNodeId: 'a1_n3',
    }],
  };
  const historyProblems = eventChoiceHistoryProblems(malformedHistory);
  check('selftest detects missing stable choice id',
    historyProblems.some((problem) => problem.includes('choiceId')),
    historyProblems.join('; '));
  check('selftest malformed history cannot unlock content', !eventChoiceRequirementMet({
    all: [{ eventId: 'weepingPilgrim', choiceId: 'helpPilgrim' }],
  }, malformedHistory));
  check('selftest rejects an empty any group', !eventChoiceRequirementMet({ any: [] }, firstRun));
  check('selftest rejects unknown requirement groups', !eventChoiceRequirementMet({
    after: [{ eventId: 'weepingPilgrim', choiceId: 'helpPilgrim' }],
  }, firstRun));
  let refused = false;
  try {
    recordEventChoice(newRun(), { eventId: 'weepingPilgrim', choiceId: '' });
  } catch (error) {
    refused = /choiceId/.test(error.message);
  }
  check('selftest record door refuses an unstable choice id', refused);
}

console.log(`RESULT ${pass}/${pass + fail}`);
process.exitCode = fail ? 1 : 0;
