import { projectEnemyKnowledge } from '../../model/enemyKnowledgeView.js';
import { renderEnemyKnowledge } from '../components/enemyKnowledge.js';
import { el, button, pane, options, optionCard, pageDoor, statusText, titleS } from '../kit/index.js';
import { workspaceFrame, land } from '../components/w1Workspace.js';

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
  const detail = el('div', { class: 'cp-detail bestiary-detail', role: 'region', 'aria-label': 'Enemy knowledge details' });
  const list = options([], { class: 'cp-grid cp-scroll bestiary-list', 'aria-label': 'Encountered enemies' });
  const back = button({ label: 'Back', role: 'exit', attrs: { 'data-back': '' } });
  const door = workspaceFrame(pageDoor({
    eyebrow: 'Lifetime enemy knowledge', title: 'Bestiary', size: 'xl',
    body: pane({ children: el('div', { class: 'w1-split' }, [el('div', { class: 'cp-list' }, list), detail]) }),
    bodyClassName: 'compendium-body', primary: back, footSize: 'short', onClose: leave, closeLabel: 'Close Bestiary',
  }));
  function paintDetail() {
    const view = views.find(entry => entry.id === selectedId);
    for (const control of list.children) {
      const selected = control.dataset.member === selectedId;
      control.setAttribute('aria-pressed', String(selected));
      control.classList.toggle('is-selected', selected);
    }
    detail.replaceChildren(...(view ? [titleS(view.name), renderEnemyKnowledge(view)] : [statusText('Meet an enemy in a real encounter to begin learning about it.')]));
  }
  list.replaceChildren(...views.map(view => {
    const control = optionCard({ name: view.name, meta: `${view.progress.label} · ${view.progress.points} / ${view.progress.target}`,
      selected: view.id === selectedId, attrs: { dataset: { member: view.id }, 'aria-controls': 'bestiary-facts' } });
    control.addEventListener('click', () => { selectedId = view.id; paintDetail(); });
    return control;
  }));
  if (!views.length) list.append(statusText('No enemies encountered yet.'));
  detail.id = 'bestiary-facts';
  paintDetail();
  app.replaceChildren(el('div', { class: 'screen compendium bestiary', dataset: { surface: 'bestiary' } }, door));
  back.addEventListener('click', leave);
  app.addEventListener('keydown', onKey);
  land(list.querySelector('button') || back);
  return () => { closed = true; app.removeEventListener('keydown', onKey); };
}
