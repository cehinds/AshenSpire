// The pending choice a card offers before it plays (model/cardChoices.js;
// SPEC §5.2 Warrior's Vow: "Enter a Stance of your choice"). One dialog (screens/combat.js): one button per
// option (a uniform tile naming the stance and what it does); Cancel plays nothing. The
// stance the player is already in (`option.active`) is shown but disabled and
// marked, since re-entering it does nothing (#1449 review, Codex P2).
import { openModal, button } from '../kit/index.js';
import { t } from '../strings.js';
import { cardOptionGrid } from './cardOptionGrid.js';

/**
 * openCardChoiceModal({ plan, cardName, opener, onChoose, onClosed }) → the
 * modal shell. `onChoose(optionId)` runs once, after the dialog closes; Cancel
 * or Escape runs nothing and the card stays in hand. `onClosed()` runs on
 * every close, before `onChoose`, so a screen can tell the dialog is gone.
 */
export function openCardChoiceModal({ plan, cardName = t('card.artPlaceholder'), opener = document.activeElement, onChoose, onClosed = null }) {
  let chosen = null;
  const cancel = button({ label: t('common.cancel'), role: 'exit', attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'md',
    className: 'card-choice',
    opener,
    eyebrow: cardName,
    title: plan.kind === 'stance' ? t('cardChoice.stanceTitle') : t('common.choose'),
    closeLabel: `${t('common.cancel')} ${cardName}`,
    bodyClassName: 'as-pane card-choice-body',
    body: (host) => {
      // Uniform tiles like the other card pickers; a stance has no numbers, so its tooltip is the effect line.
      const summaries = plan.options.map(option => ({ id: option.id, className: 'card-choice-option',
        name: `${option.name}${option.active ? ' (active)' : ''}`,
        text: option.tooltip || '', line: [], costs: [], disabled: !!option.active,
        attrs: option.active ? { 'data-active': 'true' } : {} }));
      host.appendChild(cardOptionGrid(summaries, { idAttr: 'data-choice', onSelect: id => { chosen = id; shell.close(); } }));
    },
    primary: cancel,
    footSize: 'short',
    onClose: () => { onClosed?.(); if (chosen != null) onChoose(chosen); },
  });
  cancel.addEventListener('click', shell.close);
  return shell;
}
