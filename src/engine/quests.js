// src/engine/quests.js — THE QUEST DOOR (plan phase 10a; proposal §7.5).
//
// Two things happen when a quest exchange is answered, and they happen here
// and nowhere else:
//
//   commitEventChoice — the event door. Run the choice's effects, then write
//     the choice's history row, then ask whether that choice completes a quest
//     chain. The Event screen and the dialogue screen both call it, so run
//     effects and the history row have exactly one writer, and a dialogue adds
//     no second effect path.
//
//   completeQuest — the completion door. One `questCompleted` history row, at
//     most once per quest per run, and one `questCompleted` event. Event chains
//     and atlas claims both come through it. Everything that will reward a
//     quest (xp.quest, class XP, a quest-pool relic) listens to that one event;
//     nothing reads a screen or a node type to decide a quest is done.
//
// Headless: no document/window/localStorage/timers.

import { executeRunEffects } from './actions.js';
import {
  availableEventChoices,
  recordEventChoice,
  recordQuestCompletion,
  questsCompletedBy,
} from '../model/quests.js';
import { questAction } from '../model/worldAtlas.js';
import { eventChoicesWithHistory } from '../content/events.js';

/** A choice's price, read the one way both event screens read it. */
export function choiceAffordable(choice, run) {
  const requires = choice && choice.requires;
  if (!requires) return true;
  if (typeof requires.cinders === 'number' && !(run.cinders >= requires.cinders)) return false;
  return true;
}

/**
 * completeQuest(ctx, { questId, source }) → { record, event } | null.
 *
 * The only emitter of `questCompleted`. A quest already complete in this run
 * returns null and emits nothing: that is the reload/replay/second-claim case,
 * not an error. `ctx.emit(type, payload)` is called when the caller supplies
 * one; the event is also returned so a headless caller can count it.
 */
export function completeQuest(ctx, { questId, source } = {}) {
  const record = recordQuestCompletion(ctx.run, { questId, source });
  if (!record) return null;
  const event = Object.freeze({ type: 'questCompleted', questId, source });
  if (typeof ctx.emit === 'function') ctx.emit('questCompleted', { questId, source });
  return { record, event };
}

/**
 * commitEventChoice(ctx, { eventId, choiceId }) → { choice, receipt, completions, events }.
 *
 * ctx: { run, registries, rng, emit? }. Refuses (throws) a choice the event
 * does not have, one the run's history has not opened, or one the run cannot
 * pay for — the screens never offer those, so reaching here with one is a
 * defect to see, not a state to absorb. `events` are the run effects' events
 * followed by any `questCompleted` the commit caused.
 */
export function commitEventChoice(ctx, { eventId, choiceId } = {}) {
  const { run, registries, rng } = ctx || {};
  if (!run || !registries) throw new Error('commitEventChoice requires { run, registries }');
  const def = registries.events.get(eventId);
  const choice = eventChoicesWithHistory(def).find((entry) => entry.id === choiceId);
  if (!choice) throw new Error(`commitEventChoice: event '${eventId}' has no choice '${choiceId}'`);
  if (!availableEventChoices([choice], run).length) {
    throw new Error(`commitEventChoice: '${eventId}/${choiceId}' is not open to this run's history`);
  }
  if (!choiceAffordable(choice, run)) {
    throw new Error(`commitEventChoice: '${eventId}/${choiceId}' costs more than the run holds`);
  }
  // 1. effects, 2. the history row, 3. the completion check — in that order.
  const { events } = executeRunEffects({ run, registries, rng }, choice.effects || []);
  const receipt = recordEventChoice(run, { eventId, choiceId });
  const completions = [];
  for (const questId of questsCompletedBy(registries.questChains, { eventId, choiceId })) {
    const done = completeQuest(ctx, { questId, source: 'event' });
    if (done) {
      completions.push(done.record);
      events.push(done.event);
    }
  }
  return { choice, receipt, completions, events };
}

/**
 * atlasQuestAction(ctx, questId, atlas?) → { plan, completion, events }.
 *
 * The atlas quest button: accept, or collect the reward. A collect moves the
 * quest to `claimed`, pays its cinders and completes the quest through the
 * same door with `source: 'atlas'`. A refused action changes nothing.
 */
export function atlasQuestAction(ctx, questId, atlas) {
  const run = ctx && ctx.run;
  const j = run && run.journey;
  if (!j) throw new Error('atlasQuestAction requires run.journey');
  const plan = questAction(j, questId, atlas);
  if (!plan.allowed) return { plan, completion: null, events: [] };
  j.questStates[questId] = plan.next;
  run.cinders += plan.reward;
  const events = [];
  let completion = null;
  if (plan.next === 'claimed') {
    const done = completeQuest(ctx, { questId, source: 'atlas' });
    if (done) {
      completion = done.record;
      events.push(done.event);
    }
  }
  return { plan, completion, events };
}
