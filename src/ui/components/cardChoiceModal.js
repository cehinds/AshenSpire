// The pending choice a card offers before it plays (model/cardChoices.js;
// SPEC §5.2 Warrior's Vow: "Enter a Stance of your choice"). One dialog (screens/combat.js): one button per
// option (a uniform tile naming the stance and what it does); Cancel plays nothing. The
// stance the player is already in (`option.active`) is shown but disabled and
// marked, since re-entering it does nothing (#1449 review, Codex P2). Design of the defensive-reaction prompt
// (owner, 2026-11-14): option rows, Cancel as the exit and one primary Choose, disabled until a row is selected.
import { openModal, button } from '../kit/index.js';
import { t } from '../strings.js';
import { optionRowList, markOptionRows } from './optionRowList.js';

/**
 * openCardChoiceModal({ plan, cardName, opener, onChoose, onClosed }) → the
 * modal shell. `onChoose(optionId)` runs once, after the dialog closes; Cancel
 * or Escape runs nothing and the card stays in hand. `onClosed()` runs on
 * every close, before `onChoose`, so a screen can tell the dialog is gone.
 */
export function openCardChoiceModal({ plan, cardName = t('card.artPlaceholder'), opener = document.activeElement, onChoose, onClosed = null }) {
  let chosen = null;
  let selected = null;
  let bodyHost = null;
  const cancel = button({ label: t('common.cancel'), role: 'exit', attrs: { 'data-focusable': 'true' } });
  const commit = button({ label: t('common.choose'), weight: 'primary', disabled: true, attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'md',
    className: 'option-choice card-choice',
    opener,
    eyebrow: cardName,
    title: plan.kind === 'stance' ? t('cardChoice.stanceTitle') : t('common.choose'),
    closeLabel: `${t('common.cancel')} ${cardName}`,
    bodyClassName: 'as-pane card-choice-body',
    deferFocus: true,
    initialFocus: () => [...(bodyHost?.querySelectorAll('[data-choice]') || [])].find((row) => !row.disabled) || null,
    body: (host) => {
      bodyHost = host;
      // A stance has no numbers, so its row's effect line is the tooltip.
      const rows = plan.options.map(option => ({ id: option.id, className: option.active ? 'card-choice-option is-active' : 'card-choice-option',
        name: `${option.name}${option.active ? ' (active)' : ''}`,
        text: option.tooltip || '', line: [], costs: [], disabled: !!option.active }));
      const list = optionRowList(rows, { idAttr: 'data-choice', onSelect: (id, row) => {
        selected = id;
        row?.focus?.({ preventScroll: true });
        markOptionRows(list, 'data-choice', [id]);
        commit.disabled = false;
      } });
      host.appendChild(list);
    },
    primary: commit,
    secondary: [cancel],
    footSize: 'short',
    onClose: () => { onClosed?.(); if (chosen != null) onChoose(chosen); },
  });
  commit.addEventListener('click', () => { if (selected == null) return; chosen = selected; shell.close(); });
  cancel.addEventListener('click', shell.close);
  return shell;
}
