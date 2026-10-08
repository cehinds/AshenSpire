import { projectEnemyKnowledge } from '../../model/enemyKnowledgeView.js';
import { renderEnemyKnowledge } from '../components/enemyKnowledge.js';
import { el, button, pane, options, optionCard, pageDoor, statusText, titleS } from '../kit/index.js';
import { workspaceFrame, land } from '../components/w1Workspace.js';
import { t } from '../strings.js';

export function mountBestiary(app, { registries, meta = {}, onBack, initialEnemyId = null }) {
  let closed = false;
  function leave() {
    if (closed) return;
    closed = true;
    app.removeEventListener('keydown', onKey);
    onBack?.();
  }
  function onKey(event) {
    if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[aria-modal="true"]')) {
      event.preventDefault(); leave();
    }
  }
  const learned = meta.enemyKnowledge?.enemies || {};
  const definitions = registries.enemies.all().filter(def => Object.hasOwn(learned, def.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Unencountered definitions are not projected into DOM/accessible labels.
  const views = definitions.map(def => projectEnemyKnowledge(def, learned[def.id], { registries }));
  let selectedId = views.find(view => view.id === initialEnemyId)?.id || views[0]?.id || null;
  const detail = el('div', { class: 'cp-detail bestiary-detail', role: 'region', 'aria-label': t('knowledge.details') });
  const list = options([], { class: 'cp-grid cp-scroll bestiary-list', 'aria-label': t('knowledge.encountered') });
  const back = button({ label: t('common.back'), role: 'exit', attrs: { 'data-back': '' } });
  const door = workspaceFrame(pageDoor({
    eyebrow: t('knowledge.heading'), title: t('knowledge.bestiary'), size: 'xl',
    body: pane({ children: el('div', { class: 'w1-split' }, [el('div', { class: 'cp-list' }, list), detail]) }),
    bodyClassName: 'compendium-body', primary: back, footSize: 'short', onClose: leave, closeLabel: t('knowledge.close'),
  }));
  function paintDetail() {
    const view = views.find(entry => entry.id === selectedId);
    for (const control of list.children) {
      const selected = control.dataset.member === selectedId;
      control.setAttribute('aria-pressed', String(selected));
      control.classList.toggle('is-selected', selected);
    }
    detail.replaceChildren(...(view ? [titleS(view.name), renderEnemyKnowledge(view)] : [statusText(t('knowledge.empty.help'))]));
  }
  list.replaceChildren(...views.map(view => {
    const control = optionCard({ name: view.name, meta: t('knowledge.progress', { label: view.progress.label, points: view.progress.points, target: view.progress.target }),
      selected: view.id === selectedId, attrs: { dataset: { member: view.id }, 'aria-controls': 'bestiary-facts' } });
    control.addEventListener('click', () => { selectedId = view.id; paintDetail(); });
    return control;
  }));
  if (!views.length) list.append(statusText(t('knowledge.empty')));
  detail.id = 'bestiary-facts';
  paintDetail();
  app.replaceChildren(el('div', { class: 'screen compendium bestiary', dataset: { surface: 'bestiary' } }, door));
  back.addEventListener('click', leave);
  app.addEventListener('keydown', onKey);
  land(list.querySelector('button') || back);
  return () => { closed = true; app.removeEventListener('keydown', onKey); };
}
