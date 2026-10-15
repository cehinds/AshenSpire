import { renderCard } from './card.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { renderCollectibleCard } from './collectibleCard.js';
import { mountRewardDoor } from './rewardDoor.js';
import { clearSelection } from './cardSelection.js';
import { el, button, modalFooter } from '../kit/index.js';
import { t } from '../strings.js';

// Configured mixed rewards share the full-game reward door, option columns,
// card faces and explicit selection/confirmation. Claims remain host-owned.
export function mountGameProfileOffers(app, { registries, run, offer, title, onTake, onContinue }) {
  clearSelection();
  app.replaceChildren();
  const strip = el('div', { class: 'reward-row reward-choice-grid', role: 'radiogroup', 'aria-label': t('reward.card.aria') });
  strip.style.setProperty('--choice-count', String(offer.options.length));
  const note = el('p', { class: 'reward-note', text: t('reward.configured.note', { count: offer.takeCount }) });
  const status = el('p', { class: 'reward-confirm-status', role: 'alert' });
  const confirm = button({ label: t('common.confirm'), weight: 'primary', id: 'reward-card-confirm', className: 'reward-confirm', disabled: true });
  const next = button({ label: t('reward.continue'), id: 'reward-continue' });
  next.addEventListener('click', onContinue);
  let selected = null;
  let pending = false;
  const choices = [];
  function select(index) {
    if (offer.claimed !== null || offer.taken.includes(index)) return;
    selected = index;
    for (const [at, { face, control }] of choices.entries()) {
      const chosen = at === selected;
      face.classList.toggle('reward-selected', chosen); face.classList.toggle('is-chosen', chosen);
      control.classList.toggle('is-chosen', chosen); control.setAttribute('aria-checked', String(chosen));
    }
    confirm.disabled = false; status.textContent = '';
  }
  for (const [index, option] of offer.options.entries()) {
    const card = ['combatCards', 'weaponArts'].includes(option.kind);
    const equipment = ['weapons', 'armor'].includes(option.kind);
    const definition = card ? registries.cards.get(option.id)
      : option.kind === 'relics' ? registries.relics.get(option.id)
      : option.kind === 'potions' ? registries.flasks.get(option.id)
      : option.kind === 'weapons' ? registries.equipment.armaments.find(item => item.id === option.id)
      : registries.equipment.armour.find(item => item.id === option.id && item.classId === run.class);
    const unavailable = offer.taken.includes(index) || offer.claimed !== null;
    const column = el('div', { class: `reward-choice-option${unavailable ? ' is-owned' : ''}`, dataset: { pickId: String(index) } });
    const face = card ? renderCard(registries, { cardId: option.id, instanceId: `offer:${index}`, upgraded: false }, {
      rules: run, surface: 'reward', level: 'glance', actionOwnsTouch: true,
      availability: { choose: unavailable ? t('reward.card.alreadyTaken') : true },
      commands: { choose: () => select(index) },
    }) : equipment ? renderEquipmentCard(registries, definition, { interactive: false, inspection: false, level: 'glance', surface: 'reward' }).card
      : renderCollectibleCard(registries, definition, option.kind === 'potions' ? 'Potion' : 'Relic', { interactive: false, inspection: false, level: 'glance' }).card;
    face.classList.add('reward-choice-face'); face.dataset.pickId = String(index);
    if (!unavailable) face.addEventListener('click', () => select(index));
    const control = button({ label: definition.name, disabled: unavailable, className: 'class-pick reward-node reward-pick reward-choice-button', attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { pickId: String(index) } } });
    control.addEventListener('click', () => select(index));
    column.append(face, control); strip.append(column); choices.push({ face, control });
  }
  confirm.addEventListener('click', async () => {
    if (pending || selected === null || confirm.disabled) return;
    pending = true; confirm.disabled = true;
    try { await onTake(selected); }
    catch (error) { status.textContent = error.message; }
    finally { pending = false; if (app.contains(confirm)) confirm.disabled = offer.claimed !== null || offer.taken.includes(selected); }
  });
  mountRewardDoor(app, { owner: {}, title, body: [note, strip, status], foot: modalFooter({ secondary: [next], primary: confirm, className: 'reward-foot reward-chooser-foot', size: 'medium' }) });
}
