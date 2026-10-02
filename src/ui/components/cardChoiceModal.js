// The pending choice a card offers before it plays (model/cardChoices.js;
// SPEC §5.2 Warrior's Vow: "Enter a Stance of your choice"). One dialog for
// solo (screens/combat.js) and co-op (screens/coop.js): one button per
// option, each naming the stance and what it does; Cancel plays nothing. The
// stance the player is already in (`option.active`) is shown but disabled and
// marked, since re-entering it does nothing (#1449 review, Codex P2).
import { openModal, button, el } from '../kit/index.js';

/**
 * openCardChoiceModal({ plan, cardName, opener, onChoose, onClosed }) → the
 * modal shell. `onChoose(optionId)` runs once, after the dialog closes; Cancel
 * or Escape runs nothing and the card stays in hand. `onClosed()` runs on
 * every close, before `onChoose`, so a screen can tell the dialog is gone.
 */
export function openCardChoiceModal({ plan, cardName = 'Card', opener = document.activeElement, onChoose, onClosed = null }) {
  let chosen = null;
  const cancel = button({ label: 'Cancel', role: 'exit', attrs: { 'data-focusable': 'true' } });
  const shell = openModal({
    size: 'sm',
    className: 'card-choice',
    opener,
    eyebrow: cardName,
    title: plan.kind === 'stance' ? 'Choose a stance' : 'Choose',
    closeLabel: `Cancel ${cardName}`,
    bodyClassName: 'as-pane card-choice-body',
    body: (host) => {
      for (const option of plan.options) {
        const pick = button({
          label: `${option.icon ? option.icon + ' ' : ''}${option.name}${option.active ? ' (active)' : ''}`,
          weight: 'primary',
          className: 'card-choice-option',
          disabled: !!option.active,
          attrs: { 'data-focusable': 'true', 'data-choice': option.id, 'aria-describedby': `card-choice-${option.id}`,
            ...(option.active ? { 'data-active': 'true', 'aria-disabled': 'true', title: 'You are already in this stance' } : {}) },
        });
        pick.addEventListener('click', () => { if (option.active) return; chosen = option.id; shell.close(); });
        host.appendChild(el('div', { class: 'card-choice-row' }, [
          pick,
          el('p', { class: 'as-prose', id: `card-choice-${option.id}`, text: option.tooltip || '' }),
        ]));
      }
    },
    primary: cancel,
    footSize: 'short',
    onClose: () => { onClosed?.(); if (chosen != null) onChoose(chosen); },
  });
  cancel.addEventListener('click', shell.close);
  return shell;
}
