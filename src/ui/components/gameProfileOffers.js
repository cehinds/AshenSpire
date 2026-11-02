import { renderCard } from './card.js';
import { renderEquipmentCard } from './equipmentCard.js';
import { renderCollectibleCard } from './collectibleCard.js';
import { mountRewardDoor } from './rewardDoor.js';
import { clearSelection } from './cardSelection.js';
import { openBoundCardInspection } from './cardInspection.js';
import { el, button, modalFooter } from '../kit/index.js';
import { t } from '../strings.js';
import { armouryOpensDeckEditor, noncombatEditing } from '../../model/armouryRules.js';

// Presentation ownership stays outside the serializable run and offer data.
const rewardDoorOwners = new WeakMap();

// Configured mixed rewards share the full-game reward door, option columns,
// card faces and explicit selection/confirmation. Claims remain host-owned.
export function mountGameProfileOffers(app, { registries, run, offer, title, onTake, onContinue, settings, onAddToDeck = null, addRefusal = null, onEditDeck = null, canEditDeck = false, deckMax = null, onEditEquipment = null, canEditEquipment = false }) {
  clearSelection();
  let presentation = rewardDoorOwners.get(run);
  if (!presentation || presentation.offerId !== offer.id) {
    presentation = { offerId: offer.id, owner: {} };
    rewardDoorOwners.set(run, presentation);
  }
  const strip = el('div', { class: 'reward-row reward-choice-grid', role: 'radiogroup', 'aria-label': t('reward.card.aria') });
  strip.style.setProperty('--choice-count', String(offer.options.length));
  // The copy follows the cards module's whole editor policy (not the rest services): the Armoury when it opens the deck editor,
  // no editing promise when non-combat editing is on but the editor is disabled, otherwise Strategize.
  const note = el('p', { class: 'reward-note', text: t(!noncombatEditing(run) ? 'reward.configured.note' : armouryOpensDeckEditor(run, settings) ? 'reward.configured.noteArmoury' : 'reward.configured.noteNoEditor', { count: offer.takeCount }) });
  const status = el('p', { class: 'reward-confirm-status', role: 'alert' });
  const confirm = button({ label: t('common.confirm'), weight: 'primary', id: 'reward-card-confirm', className: 'reward-confirm', disabled: true });
  const inspect = button({ label: t('deckEditor.inspectAction'), id: 'reward-inspect', disabled: true });
  inspect.addEventListener('click', () => {
    if (!pending && !completed && selected !== null) openBoundCardInspection(choices[selected].face, inspect);
  });
  // Owner 2026-10-18: reviewing a card offers "Add to deck" and (when a deck door is open) "Edit deck".
  const editDeck = button({ label: t('reward.configured.editDeck'), id: 'reward-edit-deck', className: 'reward-edit-deck' });
  const equip = button({ label: t('reward.configured.equipNow'), id: 'reward-equip-now', className: 'reward-equip-now' });
  equip.hidden = true;
  const keep = button({ label: t('reward.configured.addToLibrary'), id: 'reward-keep', className: 'reward-keep' });
  editDeck.hidden = true; keep.hidden = true;
  const next = button({ label: t('common.skip'), id: 'reward-continue', className: 'danger' });
  let selected = null;
  let pending = false;
  let reviewing = false;
  let completed = false;
  let addToDeckMode = false;
  const choices = [];
  function select(index) {
    if (pending || reviewing || completed || offer.claimed !== null || offer.taken.includes(index)) return;
    selected = index;
    for (const [at, { face, control }] of choices.entries()) {
      const chosen = at === selected;
      face.classList.toggle('reward-selected', chosen); face.classList.toggle('is-chosen', chosen);
      control.classList.toggle('is-chosen', chosen); control.setAttribute('aria-checked', String(chosen));
    }
    confirm.disabled = false; inspect.disabled = false;
    inspect.setAttribute('aria-label', t('deckEditor.inspectNamed', { name: choices[index].control.textContent }));
    status.textContent = '';
    syncCardActions();
  }
  // Owner 2026-11-02: a selected card shows exactly [Edit deck, Add to library, Add to deck] at once (no review step);
  // the card face's own inspection door replaces the Inspect button. Other kinds keep Confirm / Inspect.
  function syncCardActions() {
    const cardMode = !!(onAddToDeck && cardPick());
    const changed = cardMode !== addToDeckMode;
    addToDeckMode = cardMode;
    inspect.hidden = cardMode;
    editDeck.hidden = !(cardMode && onEditDeck && canEditDeck);
    keep.hidden = !cardMode;
    confirm.textContent = t(cardMode ? 'reward.configured.addToDeck' : 'common.confirm');
    const refusal = cardMode && addRefusal ? addRefusal(selected) : '';
    confirm.disabled = !!refusal;
    if (refusal) status.textContent = refusalText(refusal);
    if (changed) mountDoor();
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
    const face = card ? renderCard(registries, { cardId: option.id, instanceId: `offer:${index}`, upgraded: false, ...(option.rank > 1 ? { rank: option.rank } : {}) }, {
      rules: run, surface: 'reward', level: 'glance', actionOwnsTouch: true,
      // Reading a reward never chooses it; the chooser owns that action.
      only: [],
    }) : equipment ? renderEquipmentCard(registries, definition, { interactive: false, inspection: true, actionOwnsTouch: true, level: 'glance', surface: 'reward' }).card
      : renderCollectibleCard(registries, definition, option.kind === 'potions' ? 'Potion' : 'Relic', { interactive: false, inspection: true, actionOwnsTouch: true, level: 'glance' }).card;
    face.classList.add('reward-choice-face'); face.dataset.pickId = String(index);
    if (!unavailable) face.addEventListener('click', () => select(index));
    const control = button({ label: definition.name, disabled: unavailable, className: 'class-pick reward-node reward-pick reward-choice-button', attrs: { type: 'button', role: 'radio', 'aria-checked': 'false', dataset: { pickId: String(index) } } });
    control.addEventListener('click', () => select(index));
    column.append(face, control); strip.append(column); choices.push({ face, control });
  }
  const cardPick = () => selected !== null && ['combatCards', 'weaponArts'].includes(offer.options[selected]?.kind);
  const resetReview = () => {
    reviewing = false; addToDeckMode = false;
    for (const [index, { control }] of choices.entries()) control.disabled = offer.taken.includes(index) || offer.claimed !== null;
    equip.hidden = true; status.textContent = '';
    confirm.disabled = selected === null;
    mountDoor();
  };
  next.addEventListener('click', () => {
    if (pending || completed) return;
    if (reviewing) {
      resetReview();
      for (const column of strip.children) column.hidden = false;
      confirm.textContent = t('common.confirm');
      next.textContent = t('common.skip');
      return;
    }
    try { onContinue(); completed = true; }
    catch (error) { status.textContent = error.message; }
  });
  // After a claim: leave when the offer is spent, else show the next pick. Also the way back from the deck editor.
  function proceed() {
    try {
      if (offer.claimed !== null || offer.taken.length >= Math.min(offer.takeCount, offer.options.length)) {
        onContinue();
        completed = true;
      } else {
        mountGameProfileOffers(app, { registries, run, offer, title, onTake, onContinue, settings, onAddToDeck, addRefusal, onEditDeck, canEditDeck, deckMax, onEditEquipment, canEditEquipment });
      }
    } catch (error) {
      inspect.disabled = completed; strip.inert = completed;
      status.textContent = error.message; pending = false; confirm.disabled = false; next.disabled = false; editDeck.disabled = false; equip.disabled = false; keep.disabled = false;
    }
  }
  async function commit(take, afterClaim = proceed) {
    if (pending || completed || selected === null) return;
    inspect.disabled = true; strip.inert = true;
    pending = true; confirm.disabled = true; next.disabled = true; editDeck.disabled = true; equip.disabled = true; keep.disabled = true;
    try {
      const updated = await take(selected);
      if (updated?.id === offer.id) offer = updated;
      afterClaim();
    } catch (error) {
      pending = false; inspect.disabled = completed; strip.inert = completed;
      status.textContent = error.message;
      confirm.disabled = false; next.disabled = false; editDeck.disabled = false; equip.disabled = false; keep.disabled = false;
    } finally { if (!completed && afterClaim === proceed) pending = false; }
  }
  const claimOnly = index => offer.taken.includes(index) ? undefined : onTake(index);
  const refusalText = code => code === 'full' ? t('reward.configured.deckFull', { max: deckMax ?? '' }) : t('reward.configured.deckLimit');
  confirm.addEventListener('click', () => {
    if (pending || completed || selected === null || confirm.disabled) return;
    if (addToDeckMode) return commit(index => onAddToDeck(index));
    if (!reviewing) {
      reviewing = true;
      // Keep the selected face's Information control available in review.
      for (const { control } of choices) control.disabled = true;
      for (const column of strip.children) column.hidden = Number(column.dataset.pickId) !== selected;
      next.textContent = t('common.back');
      confirm.textContent = t('common.continue');
      equip.hidden = !(onEditEquipment && canEditEquipment && ['weapons', 'armor'].includes(offer.options[selected]?.kind));
      mountDoor(); return;
    }
    return commit(claimOnly);
  });
  keep.addEventListener('click', () => commit(claimOnly));
  equip.addEventListener('click', () => commit(claimOnly, () => onEditEquipment(selected, proceed)));
  editDeck.addEventListener('click', () => commit(claimOnly, () => onEditDeck(selected, proceed)));
  // The footer drops hidden buttons when built, so the door is rebuilt (same owner: in place) whenever the review changes them.
  function mountDoor() {
    mountRewardDoor(app, { owner: presentation.owner, title, body: [note, strip, status], foot: modalFooter({ secondary: [next, inspect, equip, editDeck, keep], primary: confirm, className: 'reward-foot reward-chooser-foot', size: 'medium' }) });
  }
  mountDoor();
}
