// src/ui/models/QuestBoardModel.js — the quest board (plan phase 10b), DOM-free.
//
// A place carrying the `questBoard` tag (model/locations.js; the inn ships
// it) keeps a board: the atlas quests offered anywhere in its town, each with
// the state questAction plans for it, and a journal of the run's quests.
//
// THE BOARD DECIDES NOTHING. Whether a quest may be accepted or collected is
// questAction's answer (model/worldAtlas.js), read here once per quest; what
// the journal lists is read off run.history (the 10a door's `eventChoice` and
// `questCompleted` rows) and the journey's accepted quests. Accepting and
// collecting are spoken: questExchange builds the dialogue the screen mounts,
// and its response commits through engine/quests.js boardQuestResponse.
//
// Headless: no document/window/localStorage/timers.
import { ATLAS, questAction } from '../../model/worldAtlas.js';
import { EVENT_CHOICE_HISTORY_KIND, QUEST_COMPLETED_HISTORY_KIND } from '../../model/quests.js';
import { surveyQuestPresentation } from './SurveyQuestModel.js';

/** The board's quest states, in the order a player acts on them. */
export const BOARD_STATES = Object.freeze(['ready', 'open', 'accepted', 'done', 'closed']);

/** boardQuestIds(ownerNodeId, atlas) → [{ questId, pointId }] offered in the owner's town, in map order. */
export function boardQuestIds(ownerNodeId, atlas = ATLAS) {
  const local = atlas.localByOwner[ownerNodeId];
  const points = (local && atlas.localPoints[local.mapId]) || [];
  const out = [];
  const seen = new Set();
  for (const point of points) {
    for (const row of atlas.nodeQuests[point.nodeId] || []) {
      if (seen.has(row.questId)) continue;
      seen.add(row.questId);
      out.push(Object.freeze({ questId: row.questId, pointId: point.nodeId }));
    }
  }
  return out;
}

/** The board state questAction's plan means. */
export function boardState(plan, journey, questId) {
  if (plan.allowed) return plan.next === 'claimed' ? 'ready' : 'open';
  const state = journey.questStates[questId];
  if (state === 'claimed') return 'done';
  if (state === 'accepted') return 'accepted';
  return 'closed';
}

function atlasQuestTitle(atlas, journey, questId) {
  const quest = atlas.quests[questId];
  return quest ? surveyQuestPresentation(quest, journey).title : questId;
}

function chainTitle(registries, chain, questId) {
  const first = chain && Array.isArray(chain.steps) ? chain.steps[0] : null;
  return (first && registries.events.has(first) && registries.events.get(first).name) || questId;
}

/**
 * questJournal({ registries, run, atlas }) → { started: [...], completed: [...] }.
 *
 * completed: every `questCompleted` row, in the order the run completed them,
 *   each { questId, title, source }.
 * started: an event chain the run has stepped into (an `eventChoice` row on
 *   one of its steps) and not completed, and an atlas quest the journey holds
 *   as accepted — accepting writes no history row, so the journey is where
 *   that fact lives. Each { questId, title, source }.
 */
export function questJournal({ registries, run, atlas = ATLAS }) {
  const history = Array.isArray(run.history) ? run.history : [];
  const journey = run.journey || null;
  const chains = registries.questChains || {};
  const done = new Set();
  const completed = [];
  for (const row of history) {
    if (!row || row.kind !== QUEST_COMPLETED_HISTORY_KIND || done.has(row.questId)) continue;
    done.add(row.questId);
    const title = chains[row.questId] ? chainTitle(registries, chains[row.questId], row.questId) : atlasQuestTitle(atlas, journey, row.questId);
    completed.push(Object.freeze({ questId: row.questId, title, source: row.source }));
  }
  const started = [];
  for (const [questId, chain] of Object.entries(chains)) {
    if (done.has(questId) || !Array.isArray(chain?.steps)) continue;
    if (history.some((row) => row && row.kind === EVENT_CHOICE_HISTORY_KIND && chain.steps.includes(row.eventId))) {
      started.push(Object.freeze({ questId, title: chainTitle(registries, chain, questId), source: 'event' }));
    }
  }
  for (const [questId, state] of Object.entries((journey && journey.questStates) || {})) {
    if (state !== 'accepted' || done.has(questId)) continue;
    started.push(Object.freeze({ questId, title: atlasQuestTitle(atlas, journey, questId), source: 'atlas' }));
  }
  return Object.freeze({ started: Object.freeze(started), completed: Object.freeze(completed) });
}

/**
 * questBoardModel({ registries, run, ownerNodeId, atlas }) → the board's view.
 *   offers:  [{ questId, pointId, title, text, report, speaker, reward, objective,
 *              state, label, actionable }] in map order
 *   journal: questJournal
 *   counts:  { offered, ready, open }
 */
export function questBoardModel({ registries, run, ownerNodeId, atlas = ATLAS }) {
  const journey = run.journey;
  if (!journey) throw new Error('questBoardModel requires run.journey');
  const offers = boardQuestIds(ownerNodeId, atlas).map(({ questId, pointId }) => {
    const quest = atlas.quests[questId];
    const plan = questAction(journey, questId, atlas);
    const writing = surveyQuestPresentation(quest, journey);
    const speaker = quest.speakerId && registries.speakers.has(quest.speakerId) ? registries.speakers.get(quest.speakerId) : null;
    return Object.freeze({
      questId,
      pointId,
      title: writing.title,
      text: writing.text,
      // What the speaker says when the quest is brought back: the lore's
      // report, read as the claimed quest will read it.
      report: surveyQuestPresentation(quest, { questStates: { [questId]: 'claimed' } }).text,
      speaker,
      reward: quest.rewardCinders,
      objective: atlas.nodes[quest.objectiveNodeId]?.displayName || null,
      state: boardState(plan, journey, questId),
      label: plan.label,
      actionable: !!plan.allowed,
    });
  });
  return Object.freeze({
    ownerNodeId,
    offers: Object.freeze(offers),
    journal: questJournal({ registries, run, atlas }),
    counts: Object.freeze({
      offered: offers.length,
      ready: offers.filter((offer) => offer.state === 'ready').length,
      open: offers.filter((offer) => offer.state === 'open').length,
    }),
  });
}

/**
 * questExchange(offer, copy) → the dialogue definition for one
 * board quest: { definition: { id, name, text, choices }, speaker, move }.
 * An open quest is offered (accept or leave); a ready one is reported (collect
 * or leave). Only those two states open an exchange. The labels and result
 * lines are the caller's copy (`copy.label(move, offer)`, `copy.result(move,
 * offer)`), so this file names no player text.
 */
export function questExchange(offer, copy) {
  if (!offer || !['open', 'ready'].includes(offer.state)) {
    throw new Error(`questExchange: quest '${offer && offer.questId}' has nothing to answer (state '${offer && offer.state}')`);
  }
  if (!offer.speaker) throw new Error(`questExchange: quest '${offer.questId}' names no speaker`);
  const move = offer.state === 'ready' ? 'collect' : 'accept';
  return Object.freeze({
    move,
    speaker: offer.speaker,
    definition: Object.freeze({
      id: `quest:${offer.questId}`,
      name: offer.title,
      text: move === 'collect' ? offer.report : offer.text,
      choices: Object.freeze([
        Object.freeze({ id: move, label: copy.label(move, offer), resultText: copy.result(move, offer) }),
        Object.freeze({ id: 'leave', label: copy.label('leave', offer), resultText: copy.result('leave', offer) }),
      ]),
    }),
  });
}
