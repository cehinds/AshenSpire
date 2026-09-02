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
import { eventChoiceIds, eventChoicesWithHistory, eventHistoryRequirements, events } from '../src/content/events.js';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { resolveUnknownNode, rollRelicReward, buildShopStock } from '../src/engine/encounters.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { validateContent } from '../src/model/validate.js';
import { createRng } from '../src/engine/rng.js';

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
check('all shipped event choices have stable explicit ids', authoredChoices.length === 62
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

const merchant = events.find((event) => event.id === 'merchantsGhost');
const merchantBefore = availableEventChoices(eventChoicesWithHistory(merchant), newRun())
  .map(({ choice }) => choice.id);
const cartLooter = newRun();
recordEventChoice(cartLooter, { eventId: 'abandonedCart', choiceId: 'lootStrongbox' });
const merchantAfter = availableEventChoices(eventChoicesWithHistory(merchant), cartLooter)
  .map(({ choice }) => choice.id);
check('shipped cart choice changes the later merchant event through the runtime projection',
  merchantBefore.includes('payInKind')
  && !merchantAfter.includes('payInKind')
  && merchantAfter.includes('stealRelic')
  && merchantAfter.includes('leave'));

// ---- THE FIRST QUEST CHAIN (E12): grave → keeper → the nameless at rest ------
const REG = createRegistries(contentBundle);
const allChoiceRefs = new Set(events.flatMap((event) => (eventChoiceIds[event.id] || []).map((id) => `${event.id}/${id}`)));
const refsOf = (req) => ['all', 'any', 'none'].flatMap((g) => (req && req[g]) || []);
check('every event-level history gate names shipped events and choices',
  Object.entries(eventHistoryRequirements).every(([eventId, req]) => events.some((e) => e.id === eventId)
    && refsOf(req).every((ref) => allChoiceRefs.has(`${ref.eventId}/${ref.choiceId}`))));
check('every choice-level history gate names shipped events and choices',
  events.every((event) => eventChoicesWithHistory(event).every((choice) => refsOf(choice.requiresHistory)
    .every((ref) => allChoiceRefs.has(`${ref.eventId}/${ref.choiceId}`)))));
check('a gated event is never listed among its own unlock choices',
  Object.entries(eventHistoryRequirements).every(([eventId, req]) => refsOf(req).every((ref) => ref.eventId !== eventId)));
const stepsOf = (run) => availableQuestSteps(events.map((e) => ({ id: e.id, requiresHistory: eventHistoryRequirements[e.id] })), run)
  .map((s) => s.id);
const fresh = newRun();
check('a fresh run has neither chain step available',
  !stepsOf(fresh).includes('namelessKeeper') && !stepsOf(fresh).includes('namelessRest'));
const digger = newRun();
recordEventChoice(digger, { eventId: 'graveOfTheNameless', choiceId: 'digForCinders' });
check('digging at the grave unlocks the keeper but not the second cairn',
  stepsOf(digger).includes('namelessKeeper') && !stepsOf(digger).includes('namelessRest'));
const keeper = events.find((e) => e.id === 'namelessKeeper');
const diggerChoices = availableEventChoices(eventChoicesWithHistory(keeper), digger).map(({ choice }) => choice.id);
check('the keeper offers the digger repayment or a fight, never the mourner\'s thanks, and always Leave',
  diggerChoices.includes('returnCinders') && diggerChoices.includes('faceKeeper')
  && !diggerChoices.includes('acceptThanks') && diggerChoices.includes('leave'));
const mourner = newRun();
recordEventChoice(mourner, { eventId: 'graveOfTheNameless', choiceId: 'payRespects' });
const mournerChoices = availableEventChoices(eventChoicesWithHistory(keeper), mourner).map(({ choice }) => choice.id);
check('the keeper thanks the mourner and offers nothing else but Leave',
  mournerChoices.includes('acceptThanks') && !mournerChoices.includes('returnCinders')
  && !mournerChoices.includes('faceKeeper') && mournerChoices.includes('leave'));
recordEventChoice(mourner, { eventId: 'namelessKeeper', choiceId: 'acceptThanks' });
const rest = events.find((e) => e.id === 'namelessRest');
const restChoices = availableEventChoices(eventChoicesWithHistory(rest), mourner).map(({ choice }) => choice.id);
check('the second cairn opens after the keeper and answers the branch taken',
  stepsOf(mourner).includes('namelessRest')
  && restChoices.includes('keepVigil') && !restChoices.includes('restAmongStones')
  && !restChoices.includes('lootBarrow') && restChoices.includes('leave'));
// The engine's own door: an Unknown node can roll a gated event only once the
// run's history earned it. Force the event branch of the roll by sweeping
// seeds until the resolver returns an event, on both sides of the gate.
const rollEvents = (history, seeds = 400) => {
  const seen = new Set();
  for (let seed = 1; seed <= seeds; seed++) {
    const r = resolveUnknownNode(REG, createRng(seed), { act: 1, history });
    if (r.kind === 'event') seen.add(r.eventId);
  }
  return seen;
};
const ungatedRolls = rollEvents([]);
const diggerRolls = rollEvents(digger.history);
const mournerRolls = rollEvents(mourner.history);
check('an Unknown node never rolls a chain step before it is earned',
  !ungatedRolls.has('namelessKeeper') && !ungatedRolls.has('namelessRest') && ungatedRolls.size >= 10);
check('an Unknown node rolls the earned chain step',
  diggerRolls.has('namelessKeeper') && !diggerRolls.has('namelessRest') && mournerRolls.has('namelessRest'));
// A gated step already answered is complete: a later act's map must not roll
// it again (the keeper does not come twice; the Bell is handed over once). The
// mourner's history holds a keeper choice, so the keeper is out of that pool,
// while the grave — ungated — keeps its shipped repeatability across acts.
check('a completed quest step never rolls again in a later act',
  !mournerRolls.has('namelessKeeper') && mournerRolls.has('graveOfTheNameless'));

// The reward is reserved: no generic pool may hand the Bell over first, or the
// keeper's thanks would grant nothing (addRelic ignores a duplicate id). Every
// generic roller is swept — elite and boss drops across every rarity, the
// shop's stock, and an event's "random relic" — with nothing owned.
const bell = REG.relics.get('gravetendersBell');
check('the quest relic is authored quest-pool', bell.pool === 'quest');
const allRarities = [...new Set(REG.relics.all().map((r) => r.rarity))];
let drops = 0;
for (let seed = 1; seed <= 600; seed++) {
  if (rollRelicReward(REG, createRng(seed), [], { rarities: allRarities }) === 'gravetendersBell') drops++;
}
check('elite and boss drops never roll the quest relic', drops === 0, `${drops} drops`);
let stocked = 0;
for (let seed = 1; seed <= 300; seed++) {
  const stock = buildShopStock(REG, createRng(seed), { class: 'reaver', relics: [], flasks: [], deck: [] });
  if (stock.relics.some((row) => row.id === 'gravetendersBell')) stocked++;
}
check('the shop never stocks the quest relic', stocked === 0, `${stocked} stocks`);
let randomed = 0;
for (let seed = 1; seed <= 300; seed++) {
  const run = { ...newRun(), relics: [], flasks: [], deck: [], cinders: 0 };
  executeRunEffects({ registries: REG, rng: createRng(seed), run }, [{ op: 'addRelic', random: true }]);
  if (run.relics.includes('gravetendersBell')) randomed++;
}
check('an event\'s random relic never hands over the quest relic', randomed === 0, `${randomed} grants`);
const orphan = { ...contentBundle, relics: contentBundle.relics.map((r) => (r.id === 'feralEye' ? { ...r, pool: 'quest' } : r)) };
const orphanResult = validateContent(orphan);
check('validation refuses a quest-pool relic that no event choice grants',
  !orphanResult.ok && orphanResult.errors.some((e) => /relics\.feralEye\.pool/.test(String(e.path || e))),
  JSON.stringify(orphanResult.errors || []).slice(0, 200));

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
