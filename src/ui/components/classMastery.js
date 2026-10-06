import { el, modalHead, optionCard, bindModalDismiss } from '../kit/index.js';
import { initialClassTreeChoices, pickInitialClassTreeNode } from '../../model/classTree.js';
import { masteryNextUnlocks, masteryUnlockName } from '../../model/classMasteryRun.js';
import { t } from '../strings.js';

export function masteryClassSummary(registries, meta, classId) {
  const level = meta.classMastery?.[classId]?.level || 0;
  const names = masteryNextUnlocks(registries, meta, classId).map(row => masteryUnlockName(registries, row));
  return t(names.length ? 'mastery.classNext' : 'mastery.classComplete', { level, unlocks: names.join(', ') });
}

// Modal and OptionCard are the shared kit components. The run model owns
// eligibility and the pick; this surface persists only a successful choice.
let releaseModal = null;
export function mountInitialClassMastery(app, { registries, run, onPersist, onDone, onChoose = null, onBack = null }) {
  releaseModal?.();
  releaseModal = null;
  const tier = run.classMasteryState.initialTreeTiers[0];
  const cls = registries.classes.get(run.class);
  const back = () => { releaseModal?.(); releaseModal = null; app.querySelector('.class-mastery-veil')?.remove(); onBack?.(); };
  const head = modalHead({ eyebrow: t('mastery.treeEyebrow', { class: cls.name, level: run.skills[`class:${run.class}`].level }), title: t('mastery.treeTitle', { tier }), onClose: back });
  head.querySelector('.modal-close').hidden = !onBack;
  const choices = initialClassTreeChoices(registries, run).map(id => {
    const node = registries.nodes.find(row => row.id === id);
    const choice = optionCard({ name: node?.label || id, description: node?.description || node?.blurb || '',
      className: 'class-mastery-node', attrs: { dataset: { masteryNode: id } } });
    choice.addEventListener('click', () => {
      if (onChoose) { releaseModal?.(); releaseModal = null; return onChoose(id); }
      if (!pickInitialClassTreeNode(registries, run, id)) return;
      onPersist();
      if (run.classMasteryState.initialTreeTiers.length) mountInitialClassMastery(app, { registries, run, onPersist, onDone, onBack });
      else { releaseModal?.(); releaseModal = null; app.querySelector('.class-mastery-veil')?.remove(); onDone(); }
    });
    return choice;
  });
  app.querySelector('.class-mastery-veil')?.remove();
  const modal = el('section', { class: 'modal', dataset: { size: 'md' }, tabindex: '-1', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Choose ${cls.name} class tree node` }, [head,
    el('div', { class: 'modal-body' }, [el('p', { text: t('mastery.treeIntro') }), el('div', { class: 'class-row' }, choices)])]);
  if (!app.firstElementChild) app.appendChild(el('div', { class: 'screen' }));
  const veil = el('div', { class: 'modal-veil class-mastery-veil' }, modal);
  app.appendChild(veil);
  releaseModal = bindModalDismiss({ veil, panel: modal, close: onBack ? back : () => {} });
  modal.querySelector('.class-mastery-node')?.focus();
}
