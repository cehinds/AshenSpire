import { skillBookReadPlan, commitSkillBookRead } from '../../model/consumables.js';
import { el, button } from '../kit/index.js';
import { modalHead, modalFooter, bindModalDismiss } from './modalShell.js';
import { renderCard } from './card.js';
import { t } from '../strings.js';
import { renderBookArt } from './bookArt.js';

let activeClose = null;

export function openBookLearning({ registries, run, id, inCombat = false, onLearn = () => {} }) {
  activeClose?.();
  let plan = skillBookReadPlan(registries, run, id, { inCombat });
  let choice = null;
  let release = null;
  const veil = el('div', { class: 'modal-veil book-learning-veil' });
  const panel = el('section', { class: 'modal book-learning-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'book-learning-title', tabindex: '-1', dataset: { component: 'book-learning' } });
  const close = () => { release?.(); veil.remove(); if (activeClose === close) activeClose = null; };
  activeClose = close;
  const head = modalHead({ title: t('book.read.title', { name: plan.def?.name || id }), titleId: 'book-learning-title', onClose: close });
  const trackSelect = el('select', { id: 'book-learning-track', 'aria-label': t('book.read.track') });
  for (const track of plan.tracks) trackSelect.appendChild(el('option', { value: track.id, text: track.label }));
  trackSelect.value = plan.skillId || '';
  trackSelect.disabled = plan.tracks.length < 2;
  const search = el('input', { type: 'search', placeholder: t('book.read.search'), 'aria-label': t('book.read.search') });
  search.value = '';
  const choices = el('div', { class: 'book-lesson-list', role: 'group', 'aria-label': t('book.refuse.choice') });
  const detail = el('div', { class: 'book-lesson-detail' });
  const error = el('p', { class: 'book-learning-status', role: 'status' });
  const confirm = button({ label: t('book.read.choose'), disabled: true, className: 'book-learning-confirm' });
  const cancel = button({ label: t('book.read.cancel') });
  cancel.addEventListener('click', close);
  const showDetail = () => {
    detail.replaceChildren();
    if (!choice) return;
    if (choice.kind === 'card') detail.appendChild(renderCard(registries, { cardId: choice.id, upgraded: false }, { inspectReadOnly: true }));
    else {
      const cls = registries.classes.get(choice.id);
      detail.append(el('h3', { text: cls.name }), el('p', { text: cls.description }), el('p', { text: 'Learn this class card now. Equip or remove it later in your inventory; its progress is kept.' }));
    }
  };
  const draw = () => {
    choices.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const shown = plan.lessons.filter((row) => row.name.toLowerCase().includes(query));
    for (const lesson of shown) {
      const selected = lesson.kind === choice?.kind && lesson.id === choice?.id;
      const pick = button({ label: `${lesson.kind === 'class' ? '◇ ' : ''}${lesson.name}`, attrs: { 'aria-pressed': String(selected) }, className: 'book-lesson-option' });
      pick.dataset.lessonId = lesson.id;
      pick.dataset.lessonKind = lesson.kind;
      pick.addEventListener('click', () => { choice = lesson; draw(); showDetail(); choices.querySelector(`[data-lesson-id="${lesson.id}"]`)?.focus(); });
      choices.appendChild(pick);
    }
    error.textContent = plan.reason || (!shown.length ? t('book.read.empty') : '');
    confirm.disabled = !plan.ok || !choice;
  };
  trackSelect.addEventListener('change', () => {
    plan = skillBookReadPlan(registries, run, id, { inCombat, skillId: trackSelect.value });
    choice = null; draw(); showDetail();
  });
  search.addEventListener('input', draw);
  let committed = false;
  confirm.addEventListener('click', () => {
    if (committed || !choice) return;
    try {
      const receipt = commitSkillBookRead(registries, run, { ...plan, choice }, { inCombat });
      committed = true;
      confirm.disabled = true;
      close();
      onLearn(receipt);
    } catch (failure) { error.textContent = failure.message; }
  });
  const body = el('div', { class: 'modal-body book-learning-body' }, [
    renderBookArt(plan.def, { className: 'book-reading-art' }),
    el('p', { text: t('book.read.summary', { xp: plan.def?.xp || 0 }) }),
    el('label', { for: 'book-learning-track', text: t('book.read.track') }), trackSelect,
    el('p', { class: 'book-learning-rarity', text: t('book.read.rarity') }), search,
    el('div', { class: 'book-lesson-columns' }, [choices, detail]), error,
  ]);
  panel.append(head, body, modalFooter({ secondary: [cancel], primary: confirm }));
  veil.appendChild(panel); document.body.appendChild(veil);
  release = bindModalDismiss({ veil, panel, close });
  draw(); search.focus();
  return close;
}
