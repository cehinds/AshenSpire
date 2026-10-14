import { el, eyebrow, titleS, prose, statusText, row, hairline, button, pane } from '../kit/index.js';
import { renderEnemyMoveCards } from './enemyMoveCards.js';
import { PREDICTION_CHOICES } from '../../model/enemyIntentKnowledge.js';
import { t } from '../strings.js';

export function renderEnemyKnowledge(view, { perception = null } = {}) {
  const progress = view.progress;
  const stages = el('ul', { class: 'enemy-knowledge-stages', 'aria-label': t('knowledge.stages') }, view.stages.map(stage =>
    el('li', { dataset: { learned: String(stage.learned) }, text: t('knowledge.stage', { stage: stage.stage, label: stage.label, status: stage.learned ? t('knowledge.learned') : t('knowledge.unlock', { points: stage.requiredPoints }) }) })));
  const body = el('section', { class: 'enemy-knowledge-panel', dataset: { knowledgeStage: progress.stage } }, [
    eyebrow(t('knowledge.bestiary')), titleS(t('knowledge.progress', { label: progress.label, points: progress.points, target: progress.target })),
    prose(t('knowledge.lifetime')),
    progress.nextStage ? statusText(t('knowledge.next', { label: progress.nextStage.label, points: progress.nextStage.points })) : statusText(t('knowledge.mastered')),
    perception === null ? null : prose(t('knowledge.perception', { level: perception })),
    stages, hairline(),
    eyebrow(t('knowledge.resources')),
    ...(view.resources === null ? [statusText(t('knowledge.resources.locked', { points: view.stages[1].requiredPoints }))] : view.resources.length
      ? view.resources.map(fact => row({ label: fact.label, status: fact.value, tag: 'div' })) : [statusText(t('knowledge.resources.empty'))]),
    ...(view.traits || []).map(fact => row({ label: fact.name, status: fact.detail || '', tag: 'div' })),
    hairline(), eyebrow(t('knowledge.moves')),
    view.moveCards === null ? statusText(t('knowledge.moves.locked', { points: view.stages[2].requiredPoints })) : renderEnemyMoveCards(view.moveCards),
    progress.stage >= 3 && progress.stage < 4 ? statusText(t('knowledge.effects.locked', { points: view.stages[3].requiredPoints })) : null,
    progress.stage >= 3 && progress.stage < 5 ? statusText(t('knowledge.rules.locked', { points: view.stages[4].requiredPoints })) : null,
    hairline(), eyebrow(t('knowledge.lore')),
    view.lore === null ? statusText(t('knowledge.lore.locked'))
      : el('div', {}, [view.role ? prose(view.role) : null, ...view.lore.map(line => prose(line)), !view.lore.length ? statusText(t('knowledge.lore.empty')) : null].filter(Boolean)),
  ].filter(Boolean));
  return body;
}

// This renderer receives an owner-specific allowlisted read model, never the
// selected action. Only an authority acknowledgment can confirm acceptance.
export function renderIntentPrediction(model, onPredict) {
  const status = el('p', { class: 'as-prose', role: 'status', 'aria-live': 'polite', text: model.prediction
    ? t('knowledge.prediction.status', { prediction: model.prediction, status: t(model.resolved ? model.correct === true ? 'knowledge.prediction.correct' : model.correct === false ? 'knowledge.prediction.incorrect' : 'knowledge.prediction.cancelled' : 'knowledge.prediction.awaiting') })
    : t('knowledge.prediction.choose') });
  const panel = pane({ attrs: { class: 'enemy-intent-prediction' }, children: [eyebrow(t('knowledge.prediction')), status] });
  for (const receipt of model.feedback || []) panel.append(statusText(t('knowledge.prediction.feedback', { serial: receipt.actionSerial, prediction: receipt.prediction, outcome: t(receipt.outcome === 'cancelled' ? 'knowledge.prediction.feedback.cancelled' : receipt.correct ? 'knowledge.prediction.feedback.correct' : 'knowledge.prediction.feedback.incorrect') })));
  if (!model.eligible) return panel;
  const choices = el('select', { 'aria-label': t('knowledge.prediction.action'), class: 'as-btn' }, PREDICTION_CHOICES.map(choice => el('option', { value: choice, text: choice })));
  const commit = button({ label: t('knowledge.prediction.commit') });
  commit.addEventListener('click', async () => {
    commit.disabled = true; choices.disabled = true;
    try {
      const result = await onPredict(model.actionSerial, choices.value);
      status.textContent = result?.accepted ? t('knowledge.prediction.status', { prediction: result.prediction, status: t('knowledge.prediction.awaiting') }) : t('knowledge.prediction.sent');
    } catch (error) {
      status.textContent = error.message || t('knowledge.prediction.failed');
      commit.disabled = false; choices.disabled = false;
    }
  });
  panel.append(prose(t('knowledge.prediction.help')),
    row({ label: t('knowledge.prediction.expected'), tag: 'div', setting: true, trail: [choices] }), commit);
  return panel;
}
