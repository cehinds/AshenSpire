import { el, eyebrow, titleS, prose, statusText, row, hairline, button, pane } from '../kit/index.js';
import { renderEnemyMoveCards } from './enemyMoveCards.js';
import { PREDICTION_CHOICES } from '../../model/enemyIntentKnowledge.js';

export function renderEnemyKnowledge(view, { perception = null } = {}) {
  const progress = view.progress;
  const stages = el('ul', { class: 'enemy-knowledge-stages', 'aria-label': 'Five knowledge stages' }, view.stages.map(stage =>
    el('li', { dataset: { learned: String(stage.learned) }, text: `${stage.stage}. ${stage.label} — ${stage.learned ? 'Learned' : `Unlocks at ${stage.requiredPoints} points`}` })));
  const body = el('section', { class: 'enemy-knowledge-panel', dataset: { knowledgeStage: progress.stage } }, [
    eyebrow('Bestiary'), titleS(`${progress.label} · ${progress.points} / ${progress.target}`),
    prose('Lifetime enemy knowledge grows through real encounters and successful tactical responses.'),
    progress.nextStage ? statusText(`Next: ${progress.nextStage.label} at ${progress.nextStage.points} points.`) : statusText('Mastered. Hidden current actions still require an intent read.'),
    perception === null ? null : prose(`Run Perception: level ${perception}. Perception improves intent reads and starts fresh on each new run.`),
    stages, hairline(),
    eyebrow('Base resources and defenses'),
    ...(view.resources === null ? [statusText(`Locked · Studied at ${view.stages[1].requiredPoints} points.`)] : view.resources.length
      ? view.resources.map(fact => row({ label: fact.label, status: fact.value, tag: 'div' })) : [statusText('No base resource facts recorded.')]),
    ...(view.traits || []).map(fact => row({ label: fact.name, status: fact.detail || '', tag: 'div' })),
    hairline(), eyebrow('Known moves'),
    view.moveCards === null ? statusText(`Locked · Familiar at ${view.stages[2].requiredPoints} points.`) : renderEnemyMoveCards(view.moveCards),
    progress.stage >= 3 && progress.stage < 4 ? statusText(`Base effects and counterplay unlock at ${view.stages[3].requiredPoints} points.`) : null,
    progress.stage >= 3 && progress.stage < 5 ? statusText(`Repeat, phase and delay rules unlock at ${view.stages[4].requiredPoints} points.`) : null,
    hairline(), eyebrow('Lore and role'),
    view.lore === null ? statusText('Locked · Meet this enemy in a real encounter.')
      : el('div', {}, [view.role ? prose(view.role) : null, ...view.lore.map(line => prose(line)), !view.lore.length ? statusText('No lore recorded.') : null].filter(Boolean)),
  ].filter(Boolean));
  return body;
}

// This renderer receives an owner-specific allowlisted read model, never the
// selected action. Only an authority acknowledgment can confirm acceptance.
export function renderIntentPrediction(model, onPredict) {
  const status = el('p', { class: 'as-prose', role: 'status', 'aria-live': 'polite', text: model.prediction
    ? `Prediction: ${model.prediction}. ${model.resolved ? model.correct === true ? 'Correct.' : model.correct === false ? 'Incorrect.' : 'Action cancelled.' : 'Awaiting the action.'}`
    : 'Choose the actual action you expect. XP is earned only after a correct prediction resolves.' });
  const panel = pane({ attrs: { class: 'enemy-intent-prediction' }, children: [eyebrow('Prediction'), status] });
  if (!model.eligible) return panel;
  const choices = el('select', { 'aria-label': 'Predicted enemy action', class: 'as-btn' }, PREDICTION_CHOICES.map(choice => el('option', { value: choice, text: choice })));
  const commit = button({ label: 'Predict action' });
  commit.addEventListener('click', async () => {
    commit.disabled = true; choices.disabled = true;
    try {
      const result = await onPredict(model.actionSerial, choices.value);
      status.textContent = result?.accepted ? `Prediction: ${result.prediction}. Awaiting the action.` : 'Prediction sent. Waiting for the host.';
    } catch (error) {
      status.textContent = error.message || 'Prediction could not be accepted.';
      commit.disabled = false; choices.disabled = false;
    }
  });
  panel.append(prose('Spell means ready magic; Casting means charging; Preparing means other support.'),
    row({ label: 'Expected action', tag: 'div', setting: true, trail: [choices] }), commit);
  return panel;
}
