// The Core creation's starting-card chooser (owner, 2026-11-17, playtest item 19): one row per
// pool card with − count + steppers, the whole deck's size, and the deck-size refusal beside
// Done. Presentation only: model/startingDeckChoice.js decides the pool and the refusal, and
// the host keeps the chosen counts.
import { el, button, openModal } from '../kit/index.js';
import { focusElement } from '../input.js';
import { t } from '../strings.js';
import { StartingDeckChoiceRefusal, StartingDeckSize, StartingPoolIds } from '../../model/startingDeckChoice.js';

/**
 * OpenStartingCardsChooser({ registries, run, counts, settings, opener, onDone }) → the modal.
 * `run` is the preview run whose deck the counts replace; `onDone(counts)` receives the choice.
 */
export function OpenStartingCardsChooser({ registries, run, counts, settings = {}, opener = null, onDone }) {
  const pool = StartingPoolIds(run);
  const chosen = Object.fromEntries(pool.map((id) => [id, counts?.[id] || 0]));
  const rows = el('div', { class: 'starting-cards-rows' });
  const total = el('p', { class: 'starting-cards-total', aria: { live: 'polite' } });
  const refusal = el('p', { class: 'starting-cards-refusal', role: 'status' });
  const done = button({ label: t('creation.startingCards.done'), weight: 'primary', attrs: { 'data-starting-cards-done': '' } });
  const cancel = button({ label: t('common.cancel'), attrs: { 'data-starting-cards-cancel': '' } });
  const nameOf = (id) => (registries.cards.has(id) ? registries.cards.get(id).name : id);
  const updateStatus = () => {
    const count = StartingDeckSize(run, chosen);
    total.textContent = t('creation.startingCards.total', { count, plural: count === 1 ? '' : 's' });
    const reason = StartingDeckChoiceRefusal(run, chosen, settings);
    refusal.textContent = reason;
    refusal.hidden = !reason;
    done.disabled = !!reason;
  };
  rows.append(...pool.map((id) => {
    const name = nameOf(id);
    const less = button({ label: '−', className: 'starting-cards-step', disabled: chosen[id] === 0,
      attrs: { 'aria-label': t('creation.startingCards.decrease', { card: name }), 'data-starting-card': id, 'data-step': 'decrease' } });
    const more = button({ label: '+', className: 'starting-cards-step',
      attrs: { 'aria-label': t('creation.startingCards.increase', { card: name }), 'data-starting-card': id, 'data-step': 'increase' } });
    const count = el('strong', { class: 'starting-cards-count', text: String(chosen[id]) });
    const change = (delta) => {
      chosen[id] += delta;
      count.textContent = String(chosen[id]);
      const empty = chosen[id] === 0;
      if (empty && (document.activeElement === less || less.classList.contains('gp-focus'))) {
        more.focus();
        focusElement(more);
      }
      less.disabled = empty;
      updateStatus();
    };
    less.addEventListener('click', () => change(-1));
    more.addEventListener('click', () => change(1));
    return el('div', { class: 'starting-cards-row', dataset: { card: id } }, [
      el('span', { class: 'starting-cards-name', text: name }), less, count, more,
    ]);
  }));
  let shell = null;
  done.addEventListener('click', () => {
    if (StartingDeckChoiceRefusal(run, chosen, settings)) return;
    shell.close();
    onDone?.({ ...chosen });
  });
  cancel.addEventListener('click', () => shell.close());
  updateStatus();
  shell = openModal({ size: 'md', title: t('creation.startingCards.title'), className: 'starting-cards-modal', opener, showMenuButton: false,
    body: el('div', { class: 'starting-cards' }, [el('p', { class: 'starting-cards-note', text: t('creation.startingCards.note') }), rows, total, refusal]),
    secondary: [cancel], primary: done });
  return shell;
}
