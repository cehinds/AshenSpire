// src/model/validate/quests.js — quest-step gates, speakers, quest chains and quest-pool relics (E12, plan phase 10a).
// Split out of validate.js's collectContentProblems: same errors, same order. `ctx` carries the
// cross-reference data earlier sections built (and the data this one hands on).

import { speakerPortraitAsset } from '../../content/speakerArt.js';
import { eventChoiceRequirementProblems, validQuestId } from '../quests.js';

export function questProblems(b, err, ctx) {
  const { eventsDoorOpen } = ctx;
  // Quest steps (E12): an event-level history gate must name a shipped event,
  // carry a well-formed requirement (model/quests.js is the one grammar), and
  // point only at shipped events. Choice ids are the events module's sidecar
  // contract and are proven by tools/quest-choice-contract.mjs.
  const eventGates = b.eventHistoryRequirements;
  if (eventGates !== undefined) {
    if (!eventGates || typeof eventGates !== 'object' || Array.isArray(eventGates)) {
      err('eventHistoryRequirements', 'must be an object keyed by event id');
    } else {
      const eventIds = new Set((Array.isArray(b.events) ? b.events : []).map((e) => e && e.id));
      for (const [eventId, requirement] of Object.entries(eventGates)) {
        if (!eventsDoorOpen && !eventIds.has(eventId)) err(`eventHistoryRequirements.${eventId}`, 'unknown event');
        for (const problem of eventChoiceRequirementProblems(requirement)) err(`eventHistoryRequirements.${eventId}`, problem);
        for (const group of ['all', 'any', 'none']) {
          for (const ref of (requirement && Array.isArray(requirement[group]) ? requirement[group] : [])) {
            if (ref && ref.eventId === eventId) err(`eventHistoryRequirements.${eventId}.${group}`, 'an event cannot be gated on its own choice');
            if (ref && !eventsDoorOpen && !eventIds.has(ref.eventId)) err(`eventHistoryRequirements.${eventId}.${group}`, `unknown event '${ref && ref.eventId}'`);
          }
        }
      }
    }
  }

  // Quest chains and speakers (plan phase 10a). Each refusal is named, and
  // tests/quest-dialogue.test.mjs asserts every name:
  //   'is not a shipped event'           a chain step that no event answers
  //   'does not resolve to a shipped choice'  a completes ref with no such choice
  //   'is not a step of this chain'      a completes ref outside the chain
  //   'a Leave choice may not complete a quest'
  //   'names no speaker'                 a chain step without eventSpeakers
  //   'unknown speaker'                  an event naming no row
  //   'unknown portrait key'             a speaker whose art does not ship
  {
    const eventList = Array.isArray(b.events) ? b.events : [];
    const eventById = new Map(eventList.filter(Boolean).map((e) => [e.id, e]));
    const choiceIdsOf = (eventId) => (b.eventChoiceIds && Array.isArray(b.eventChoiceIds[eventId]) ? b.eventChoiceIds[eventId] : []);
    const enemyIds = new Set((Array.isArray(b.enemies) ? b.enemies : []).map((e) => e && e.id));
    const speakerIds = new Set();
    (Array.isArray(b.speakers) ? b.speakers : []).forEach((row, index) => {
      if (!row || typeof row.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(row.id)) {
        err(`speakers[${index}].id`, 'a speaker needs a stable id');
        return;
      }
      if (speakerIds.has(row.id)) err(`speakers.${row.id}`, 'duplicate speaker id');
      speakerIds.add(row.id);
      if (typeof row.name !== 'string' || !row.name.trim()) err(`speakers.${row.id}.name`, 'a speaker needs a name for its caption and name plate');
      if (row.portraitKey !== '' && row.portraitKey !== undefined && row.portraitKey !== null
        && !enemyIds.has(row.portraitKey) && !speakerPortraitAsset(row.portraitKey)) {
        err(`speakers.${row.id}.portraitKey`, `unknown portrait key '${row.portraitKey}': no shipped art answers to it (leave it blank for the name plate)`);
      }
    });
    const eventSpeakers = b.eventSpeakers || {};
    for (const [eventId, speakerId] of Object.entries(eventSpeakers)) {
      if (!eventsDoorOpen && !eventById.has(eventId)) err(`eventSpeakers.${eventId}`, 'unknown event');
      if (!speakerIds.has(speakerId)) err(`eventSpeakers.${eventId}`, `unknown speaker '${speakerId}'`);
    }
    const chains = b.questChains;
    if (chains !== undefined) {
      if (!chains || typeof chains !== 'object' || Array.isArray(chains)) {
        err('questChains', 'must be an object keyed by quest id');
      } else {
        for (const [questId, chain] of Object.entries(chains)) {
          const at = `questChains.${questId}`;
          if (!validQuestId(questId)) err(at, 'a quest needs a stable id');
          for (const key of Object.keys(chain || {})) {
            if (key !== 'steps' && key !== 'completes') err(`${at}.${key}`, `unknown quest chain field '${key}'`);
          }
          const steps = Array.isArray(chain && chain.steps) ? chain.steps : [];
          if (!steps.length) err(`${at}.steps`, 'a quest chain needs at least one step');
          steps.forEach((eventId, index) => {
            if (!eventsDoorOpen && !eventById.has(eventId)) err(`${at}.steps[${index}]`, `quest chain step '${eventId}' is not a shipped event`);
            else if (!eventSpeakers[eventId]) err(`${at}.steps[${index}]`, `chain event '${eventId}' names no speaker (eventSpeakers)`);
          });
          const completes = Array.isArray(chain && chain.completes) ? chain.completes : [];
          if (!completes.length) err(`${at}.completes`, 'a quest chain needs at least one completing choice');
          completes.forEach((ref, index) => {
            const where = `${at}.completes[${index}]`;
            const ids = choiceIdsOf(ref && ref.eventId);
            const choiceIndex = ref ? ids.indexOf(ref.choiceId) : -1;
            const event = ref && eventById.get(ref.eventId);
            // With the events door open the event half of this ref is unknowable;
            // eventChoiceIds still ships, so the choice half is still proven.
            if ((!eventsDoorOpen && !event) || choiceIndex < 0) {
              err(where, `quest completion ref '${ref && ref.eventId}/${ref && ref.choiceId}' does not resolve to a shipped choice`);
              return;
            }
            if (!steps.includes(ref.eventId)) err(where, `quest completion ref '${ref.eventId}/${ref.choiceId}' is not a step of this chain`);
            const choice = event && Array.isArray(event.choices) ? event.choices[choiceIndex] : null;
            if (ref.choiceId === 'leave' || (choice && String(choice.label).trim().toLowerCase() === 'leave')) {
              err(where, `a Leave choice may not complete a quest ('${ref.eventId}/${ref.choiceId}')`);
            }
          });
        }
      }
    }
  }

  // A quest-pool relic (RELIC_POOLS) is withheld from every generic reward
  // pool, so the only road to it is an event choice that grants it by id. A
  // quest-pool relic no choice names is unreachable content, and a class's
  // starting relic is a starter, not a quest reward.
  {
    const granted = new Set();
    for (const event of (Array.isArray(b.events) ? b.events : [])) {
      for (const choice of (event && Array.isArray(event.choices) ? event.choices : [])) {
        for (const eff of (choice && Array.isArray(choice.effects) ? choice.effects : [])) {
          if (eff && eff.op === 'addRelic' && typeof eff.id === 'string') granted.add(eff.id);
        }
      }
    }
    const startingRelics = new Set((Array.isArray(b.classes) ? b.classes : []).map((row) => row && row.startingRelic));
    for (const relic of (Array.isArray(b.relics) ? b.relics : [])) {
      if (!relic || relic.pool !== 'quest') continue;
      if (!eventsDoorOpen && !granted.has(relic.id)) err(`relics.${relic.id}.pool`, 'a quest-pool relic must be granted by id from at least one event choice');
      if (startingRelics.has(relic.id)) err(`relics.${relic.id}.pool`, 'a class starting relic cannot be quest-pool');
    }
  }
}
