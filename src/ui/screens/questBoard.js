// src/ui/screens/questBoard.js — the quest board (plan phase 10b).
//
// A place carrying `questBoard` (the inn) keeps a board: the atlas quests
// offered in its town, each in the state questAction plans, and a journal of
// the run's started and completed quests. It is a W1s choice body: the quests
// are the choices, the journal the second slot, Leave the foot.
//
// THE BOARD COMMITS NOTHING. A quest that can be accepted or collected opens
// the dialogue screen with the quest row's speaker (`onOpen`), and the
// response there commits through engine/quests.js boardQuestResponse — the
// 10a completion door. This adapter renders QuestBoardModel and names its
// actions; it owns no state, so a reload reopens the board as the run stands.
import { questBoardModel } from '../models/QuestBoardModel.js';
import { mountChoiceBody } from '../components/choiceBody.js';
import { runHudHtml, wireRunHud } from '../components/runHud.js';
import { el, modalFooter, button, options, optionCard, statusText } from '../kit/index.js';
import { t } from '../strings.js';

/** The copy a board quest's dialogue speaks with (QuestBoardModel.questExchange). */
export const QUEST_EXCHANGE_COPY = Object.freeze({
  label: (move, offer) => t(`questBoard.respond.${move}`, { reward: offer.reward }),
  result: (move, offer) => t(`questBoard.result.${move}`, { reward: offer.reward, speaker: offer.speaker ? offer.speaker.name : '' }),
});

function journalList(heading, rows, empty, kind) {
  return el('section', { class: 'quest-journal-part', dataset: { journal: kind } }, [
    el('h3', { class: 'as-eyebrow', text: heading }),
    rows.length
      ? el('ul', { class: 'choice-status-list quest-journal-list' }, rows.map((row) => el('li', {
        class: 'choice-status-row', dataset: { questId: row.questId, source: row.source },
      }, [el('span', { class: 'choice-status-name', text: row.title })])))
      : el('p', { class: 'as-subtitle', text: empty }),
  ]);
}

/**
 * mountQuestBoard(app, { registries, run, meta, ownerNodeId, hud, onOpen, onDone })
 *   onOpen(questId)  a quest that can be answered was chosen
 *   onDone()         Leave
 */
export function mountQuestBoard(app, { registries, run, meta, ownerNodeId, hud = null, onOpen, onDone }) {
  const view = questBoardModel({ registries, run, ownerNodeId });
  app.innerHTML = `
    ${hud ? runHudHtml({ registries, run, meta, place: 'rest', headerClass: 'map-header room-header' }) : ''}
    <div class="screen room-screen quest-board-screen"></div>`;

  const cards = view.offers.map((offer) => optionCard({
    glyph: offer.state === 'done' ? '✓' : '✉',
    name: offer.title,
    description: offer.text,
    meta: t('questBoard.offer.meta', { reward: offer.reward, objective: offer.objective || t('questBoard.offer.noObjective') }),
    trail: [statusText(offer.actionable ? offer.label : t(`questBoard.state.${offer.state}`), { class: 'quest-board-state' })],
    disabled: !offer.actionable,
    arrow: offer.actionable,
    attrs: { dataset: { questId: offer.questId, state: offer.state } },
    className: 'quest-board-offer',
  }));
  const choices = el('div', { class: 'choice-body-choices quest-board-choices' }, [
    cards.length ? options(cards) : el('p', { class: 'as-subtitle', text: t('questBoard.empty') }),
  ]);
  const consequences = el('aside', { class: 'choice-body-consequences choice-status quest-journal', 'aria-label': t('questBoard.journal.heading') }, [
    journalList(t('questBoard.journal.started'), view.journal.started, t('questBoard.journal.noneStarted'), 'started'),
    journalList(t('questBoard.journal.completed'), view.journal.completed, t('questBoard.journal.noneCompleted'), 'completed'),
  ]);
  const leave = button({ label: t('questBoard.leave'), weight: 'primary', id: 'quest-board-leave' });
  mountChoiceBody(app.querySelector('.quest-board-screen'), {
    className: 'quest-board-door',
    eyebrow: t('questBoard.eyebrow'),
    title: t('questBoard.title'),
    status: t('questBoard.status', { ready: view.counts.ready, open: view.counts.open }),
    choices,
    consequences,
    foot: modalFooter({ primary: leave, size: 'fill', className: 'choice-foot' }),
  });
  if (hud) wireRunHud(app, { ...hud, registries, run, meta, remount: () => mountQuestBoard(app, { registries, run, meta, ownerNodeId, hud, onOpen, onDone }) });
  for (const card of cards) {
    if (card.disabled) continue;
    card.addEventListener('click', () => onOpen(card.dataset.questId));
  }
  leave.addEventListener('click', () => onDone());
  return view;
}
