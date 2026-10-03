import { skillBookReadPlan, commitSkillBookRead } from '../../model/consumables.js';
import { el, button } from '../kit/index.js';
import { modalHead, modalFooter, bindModalDismiss } from './modalShell.js';
import { renderCard } from './card.js';
import { t } from '../strings.js';
import { renderBookArt, bookSymbolUrl } from './bookArt.js';
import { featById } from '../../model/feats.js';
import { bookLessonCard } from '../../model/bookLearning.js';
import { learnedClassIds } from '../../model/classLibraryState.js';

let activeClose = null;

export function openBookLearning({ registries, run, id, inCombat = false, settings = {}, onLearn = () => {} }) {
  activeClose?.();
  let plan = skillBookReadPlan(registries, run, id, { inCombat });
  let choice = plan.def?.learnClass ? plan.lessons[0] : null;
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
    if (choice.kind === 'card') detail.appendChild(renderCard(registries, bookLessonCard(registries, run, plan.def, plan.skillId, choice.id), { inspectReadOnly: true }));
    else {
      const cls = registries.classes.get(choice.id);
      detail.append(el('h3', { text: cls.name }), el('p', { text: cls.description }), el('p', { text: t(learnedClassIds(run).includes(cls.id) ? 'book.read.knownClass' : 'book.read.class') }));
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
      const receipt = commitSkillBookRead(registries, run, { ...plan, choice }, { inCombat, settings });
      committed = true;
      confirm.disabled = true;
      close();
      onLearn(receipt);
      if (plan.def.learnClass) showClassBookReceipt({ registries, def: plan.def, receipt });
    } catch (failure) { error.textContent = failure.message; }
  });
  const body = el('div', { class: 'modal-body book-learning-body' }, [
    renderBookArt(plan.def, { className: 'book-reading-art' }),
    el('p', { text: plan.def?.learnClass ? t('book.read.classSummary', { xp: plan.def.xp, card: plan.def.combatCardChance || 0, feat: plan.def.featChance || 0 }) : t('book.read.summary', { xp: plan.def?.xp || 0 }) }),
    el('label', { for: 'book-learning-track', text: t('book.read.track') }), trackSelect,
    el('p', { class: 'book-learning-rarity', text: t('book.read.rarity') }), search,
    el('div', { class: 'book-lesson-columns' }, [choices, detail]), error,
  ]);
  panel.append(head, body, modalFooter({ secondary: [cancel], primary: confirm }));
  veil.appendChild(panel); document.body.appendChild(veil);
  release = bindModalDismiss({ veil, panel, close });
  draw(); showDetail(); search.focus();
  return close;
}

function showClassBookReceipt({ registries, def, receipt }) {
  activeClose?.();
  const veil = el('div', { class: 'modal-veil book-learning-veil' });
  const panel = el('section', { class: 'modal book-learning-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'book-receipt-title', tabindex: '-1', dataset: { component: 'book-receipt' } });
  let release;
  const close = () => { release?.(); veil.remove(); if (activeClose === close) activeClose = null; };
  activeClose = close;
  const body = el('div', { class: 'modal-body book-learning-body' }, [
    renderBookArt(def, { className: 'book-reading-art' }),
    el('p', { text: t('book.read.xpAwarded', { xp: receipt.gained }) }),
    el('p', { text: t(receipt.classLearned ? 'book.read.classLearned' : 'book.read.knownClass') }),
  ]);
  if (receipt.bonuses.card) {
    body.append(el('p', { text: t('book.read.cardAwarded', { name: receipt.bonuses.card.name }) }));
    body.append(renderCard(registries, { cardId: receipt.bonuses.card.id, upgraded: false }, { inspectReadOnly: true }));
    if (receipt.bonuses.card.destination === 'sideboard') body.append(el('p', { text: t('book.read.sideboard') }));
  }
  if (receipt.bonuses.feat) body.append(
    el('img', { src: bookSymbolUrl('feat'), alt: '', width: 72, height: 72 }),
    el('p', { text: t('book.read.featAwarded', { name: receipt.bonuses.feat.name }) }),
    el('p', { text: featById(receipt.bonuses.feat.id).description }),
  );
  if (!receipt.bonuses.card && !receipt.bonuses.feat) body.append(el('p', { text: t('book.read.noBonus') }));
  const done = button({ label: t('book.read.done') }); done.addEventListener('click', close);
  panel.append(modalHead({ title: t('book.read.complete'), titleId: 'book-receipt-title', onClose: close }), body, modalFooter({ primary: done }));
  veil.append(panel); document.body.append(veil);
  release = bindModalDismiss({ veil, panel, close }); done.focus();
}
