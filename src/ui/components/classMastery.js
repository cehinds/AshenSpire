import { el, modalHead, optionCard } from '../kit/index.js';
import { initialClassTreeChoices, pickInitialClassTreeNode } from '../../model/classTree.js';
import { masteryNextUnlocks, masteryUnlockName } from '../../model/classMasteryRun.js';

export function masteryClassSummary(registries, meta, classId) {
  const level = meta.classMastery?.[classId]?.level || 0;
  const names = masteryNextUnlocks(registries, meta, classId).map(row => masteryUnlockName(registries, row));
  return `Mastery ${level}${names.length ? ` · Next: ${names.join(', ')}` : ' · All levels claimed'}`;
}

// Modal and OptionCard are the shared kit components. The run model owns
// eligibility and the pick; this surface persists only a successful choice.
export function mountInitialClassMastery(app, { registries, run, onPersist, onDone, onChoose = null }) {
  const tier = run.classMasteryState.initialTreeTiers[0];
  const cls = registries.classes.get(run.class);
  const head = modalHead({ eyebrow: `${cls.name} · Mastery ${run.skills[`class:${run.class}`].level}`, title: `Choose your tier ${tier} node` });
  head.querySelector('.modal-close').hidden = true;
  const choices = initialClassTreeChoices(registries, run).map(id => {
    const node = registries.nodes.find(row => row.id === id);
    const choice = optionCard({ name: node?.label || id, description: node?.description || node?.blurb || '',
      className: 'class-mastery-node', attrs: { dataset: { masteryNode: id } } });
    choice.addEventListener('click', () => {
      if (onChoose) return onChoose(id);
      if (!pickInitialClassTreeNode(registries, run, id)) return;
      onPersist();
      if (run.classMasteryState.initialTreeTiers.length) mountInitialClassMastery(app, { registries, run, onPersist, onDone });
      else { app.querySelector('.class-mastery-veil')?.remove(); onDone(); }
    });
    return choice;
  });
  app.querySelector('.class-mastery-veil')?.remove();
  const modal = el('section', { class: 'modal', dataset: { size: 'md' }, role: 'dialog', 'aria-modal': 'true', 'aria-label': `Choose ${cls.name} class tree node` }, [head,
    el('div', { class: 'modal-body' }, [el('p', { text: 'Your class level lasts. Choose a fresh build for this climb.' }), el('div', { class: 'class-row' }, choices)])]);
  if (!app.firstElementChild) app.appendChild(el('div', { class: 'screen' }));
  app.appendChild(el('div', { class: 'modal-veil class-mastery-veil' }, modal));
  modal.querySelector('button')?.focus();
}
