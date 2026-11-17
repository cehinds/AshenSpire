// The Core creation's starting-card chooser (owner, 2026-11-17, playtest item 19): one row per
// pool card with − count + steppers, the whole deck's size, and the deck-size refusal beside
// Done. Presentation only: model/startingDeckChoice.js decides the pool and the refusal, and
// the host keeps the chosen counts.
import { el, button, openModal } from '../kit/index.js';
import { t } from '../strings.js';
import { startingDeckChoiceRefusal, startingDeckSize, startingPoolIds } from '../../model/startingDeckChoice.js';

/**
 * OpenStartingCardsChooser({ registries, run, counts, settings, opener, onDone }) → the modal.
 * `run` is the preview run whose deck the counts replace; `onDone(counts)` receives the choice.
 */
export function OpenStartingCardsChooser({ registries, run, counts, settings = {}, opener = null, onDone }) {
  const pool = startingPoolIds(run);
  const chosen = Object.fromEntries(pool.map((id) => [id, counts?.[id] || 0]));
  const rows = el('div', { class: 'starting-cards-rows' });
  const total = el('p', { class: 'starting-cards-total', aria: { live: 'polite' } });
  const refusal = el('p', { class: 'starting-cards-refusal', role: 'status' });
  const done = button({ label: t('creation.startingCards.done'), weight: 'primary', attrs: { 'data-starting-cards-done': '' } });
  const cancel = button({ label: t('common.cancel'), attrs: { 'data-starting-cards-cancel': '' } });
  const nameOf = (id) => (registries.cards.has(id) ? registries.cards.get(id).name : id);
  const draw = () => {
    rows.replaceChildren(...pool.map((id) => {
      const name = nameOf(id);
      const less = button({ label: '−', className: 'starting-cards-step', disabled: chosen[id] < 1,
        attrs: { 'aria-label': t('creation.startingCards.decrease', { card: name }), 'data-starting-card': id, 'data-step': 'decrease' } });
      const more = button({ label: '+', className: 'starting-cards-step',
        attrs: { 'aria-label': t('creation.startingCards.increase', { card: name }), 'data-starting-card': id, 'data-step': 'increase' } });
      less.addEventListener('click', () => { if (chosen[id] > 0) { chosen[id] -= 1; draw(); } });
      more.addEventListener('click', () => { chosen[id] += 1; draw(); });
      return el('div', { class: 'starting-cards-row', dataset: { card: id } }, [
        el('span', { class: 'starting-cards-name', text: name }),
        less,
        el('strong', { class: 'starting-cards-count', text: String(chosen[id]) }),
        more,
      ]);
    }));
    const count = startingDeckSize(run, chosen);
    total.textContent = t('creation.startingCards.total', { count, plural: count === 1 ? '' : 's' });
    const reason = startingDeckChoiceRefusal(run, chosen, settings);
    refusal.textContent = reason;
    refusal.hidden = !reason;
    done.disabled = !!reason;
  };
  let shell = null;
  done.addEventListener('click', () => {
    if (startingDeckChoiceRefusal(run, chosen, settings)) return;
    shell.close();
    onDone?.({ ...chosen });
  });
  cancel.addEventListener('click', () => shell.close());
  draw();
  shell = openModal({ size: 'md', title: t('creation.startingCards.title'), className: 'starting-cards-modal', opener, showMenuButton: false,
    body: el('div', { class: 'starting-cards' }, [el('p', { class: 'starting-cards-note', text: t('creation.startingCards.note') }), rows, total, refusal]),
    secondary: [cancel], primary: done });
  return shell;
}
