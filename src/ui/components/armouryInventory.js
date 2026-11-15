// src/ui/components/armouryInventory.js — the Armoury's Inventory block (the usable
// items outside a picker; the compatible replacements while a position is picked),
// extracted from mountEquipment (screens/equipment.js) so it can be built and tested
// alone. Which rows are listed and how each is presented is
// models/ArmouryInventoryModel.js; this file builds the DOM. Behaviour and rendered
// DOM are unchanged.
import { canEquip, equipTransitionReceipt, fitsSlot } from '../../model/loadout.js';
import { equipmentModLines } from '../../model/equipmentCompare.js';
import { relicText } from './card.js';
import { renderCandidateComparison } from './equipmentReceipts.js';
import { esc, hideTooltip, showTooltipFor, stickTooltip } from './tooltip.js';
import { armHold, HOLD_POINTER_SLOP, HOLD_DRAG_SETTLE_MS } from '../../framework/optionDecision.js';
import { refuses } from './refusal.js';
import { assetUrl } from '../assetmap.js';
import { mountDisclosure } from './disclosure.js';
import { consumableText } from '../../model/consumables.js';
import { openBookLearning } from './bookLearning.js';
import { renderBookArt } from './bookArt.js';
import { equipClassCard } from '../../model/classLibrary.js';
import { renderEquipmentCard, renderEquipmentInspection } from './equipmentCard.js';
import { renderCollectibleCard, renderCollectibleInspection } from './collectibleCard.js';
import { renderInventoryItemCard, renderInventoryDetailCard } from './armouryComponents.js';
import { inventoryItemCardModel, inventoryDetailCardModel } from '../models/ArmouryModels.js';
import { inventoryEligibility, inventoryFooterPlan } from '../models/ArmouryWorkspaceModel.js';
import {
  armouryInventoryModel, combatPowerRoleLabels, inventoryRowPresentation, inventorySelectionContextText,
} from '../models/ArmouryInventoryModel.js';
import { thumbSrc } from './armouryPicker.js';
import { UI_COMPONENTS as UI } from '../models/UiComponentId.js';
import { t } from '../strings.js';
import { el, prose, flavour, pill, button } from '../kit/index.js';

/** Potions and relics are collectibles: the Armoury draws them with the collectible card, never the equipment one. */
export function isCollectibleCategory(category) {
  return category === 'Potion' || category === 'Relic';
}

export function inventoryFace(registries, row, {
  selected = false, draggable = false, actionLabel = '', classModel = null,
} = {}) {
  const el = renderInventoryItemCard(inventoryItemCardModel(row, {
    selected, draggable, classModel,
  }));
  if (row.read) el.querySelector('.inventory-item-art')?.replaceChildren(renderBookArt(row.item));
  if (['armor', 'weapon', 'shield', 'staff'].includes(row.item.kind) || isCollectibleCategory(row.category)) {
    const trail = el.querySelector('.r-trail');
    // WC2: the metadata band ends with how many of this item the run holds.
    // The Armoury names itself so the manifest can patch what a glance says
    // here: the question on this screen is what goes in which slot, so the
    // type band earns its row before anything else does
    // (content/config/ui/components/card.json, behavior.fields.surfaces).
    el.replaceChildren((isCollectibleCategory(row.category)
      ? renderCollectibleCard(registries, row.item, row.category, { interactive: false, owned: row.count, surface: 'armoury' })
      // The surrounding disclosure already owns read-only inspection. A nested
      // card inspector consumes the first touch before that disclosure opens.
      : renderEquipmentCard(registries, row.item, { interactive: false, inspection: false, owned: row.count, surface: 'armoury' })).card);
    if (trail) el.append(trail);
    el.classList.add('poker-inventory-face');
  }
  // While a position is selected the face says what the tap will do — a StatePill, lit.
  if (actionLabel) el.querySelector('.r-trail').appendChild(pill({ label: actionLabel, on: true, attrs: { class: 'inventory-inline-action' } }));
  return el;
}

export function inventoryReveal(registries, row, {
  comparison = null, action = null, instruction = '', holdDuration = 0,
  registerHold = null, classModel = null, onClassAction = null, comparisonConfig = null, facts = null,
} = {}) {
  const item = row.item;
  let art;
  if (row.category === 'Armour' || ['Weapon', 'Shield', 'Staff', 'Armament'].includes(row.category)) {
    art = { kind: 'image', value: thumbSrc(item) };
  } else if (item.artAsset) {
    art = { kind: 'image', value: assetUrl(item.artAsset) };
  } else {
    art = { kind: 'icon', value: item.icon || 'skill' };
  }
  const description = row.category === 'Relic'
    ? relicText(item, registries)
    // A consumable's sentence names its live numbers (SPEC §14.3).
    : row.category === 'Consumable'
      ? `${consumableText(registries, item)}${row.read ? '' : ` ${t('armoury.consumable.token')}`}`
      : (item.blurb || item.textTemplate || 'No additional information.');
  const mods = equipmentModLines(registries, item);
  const detailModel = inventoryDetailCardModel({ row, art, description, mods, instruction, classModel });
  const comparisonPresentation = comparisonConfig?.presentation || 'tooltip';
  const comparisonHtml = comparison
    ? `<div data-ui-component="${UI.equipmentComparison}" data-ui-variant="${comparisonPresentation}"><div class="tt-title">Compare ${esc(item.name)}</div>${renderCandidateComparison(comparison, { expanded: true })}</div>`
    : '';
  const el = renderInventoryDetailCard(detailModel, {
    comparisonHtml: comparisonPresentation === 'inline' ? comparisonHtml : '',
    action,
  });
  if (row.read) el.querySelector('.inventory-model')?.replaceChildren(renderBookArt(item));
  if (['armor', 'weapon', 'shield', 'staff'].includes(item.kind) || isCollectibleCategory(row.category)) {
    el.classList.add('poker-inventory-detail');
    el.querySelector('.inventory-model')?.remove();
    const info = el.querySelector('.inventory-information');
    // Keep the comparison, equip action and instruction in their original container.
    for (const child of [...info.children]) if (!child.matches('.inventory-instruction, [data-ui-component], .ep-equip, .inventory-card-action-label') && child !== action) child.remove();
    el.prepend(isCollectibleCategory(row.category)
      ? renderCollectibleInspection(registries, item, row.category, { interactive: false })
      : renderEquipmentInspection(registries, item, { interactive: false }));
  }
  // W1n: what the selected item is compared with and whether it can go on
  // stand just before the action, so the action is read with its reason.
  if (facts) {
    const info = el.querySelector('.inventory-information') || el;
    info.insertBefore(facts, action && action.parentElement === info ? action : null);
  }
  el.dataset.inventoryItem = row.key;
  // When the global hold-confirm dial is off, the explicit action button owns
  // the immediate equipment change and the card keeps a short, read-only hold
  // for comparison. A zero-duration action must never erase the only comparison
  // path or turn a compare gesture into an equip.
  const cardOwnsAction = classModel?.holdAction === true && holdDuration > 0 && Boolean(onClassAction);
  let comparisonPreviewTimer = null;
  let comparisonPreviewOpen = false;
  let startComparisonPreview = null;
  let endComparisonPreview = null;
  if (comparison) {
    el.dataset.component = UI.armouryComparisonTooltipAnchor;
    el.tabIndex = 0;
    const actionVerb = action?.textContent?.trim() || 'equip this item';
    const actionInstruction = cardOwnsAction
      ? (holdDuration > 0
        ? ` Press and hold to ${actionVerb}.`
        : ` Activate this card to ${actionVerb}.`)
      : '';
    el.setAttribute('aria-label', comparisonPresentation === 'inline'
      ? `Compare ${item.name}. Comparison shown in this card.${actionInstruction}`
      : `Compare ${item.name}. Press and hold this card to preview comparison.${actionInstruction}`);
    const clear = el.closest('.disc-faces') || el.parentElement;
    const appearance = {
      variant: 'equipment-comparison',
      widthRem: comparisonConfig?.tooltipWidthRem,
      maxHeightRatio: comparisonConfig?.tooltipMaxHeightRatio,
    };
    if (comparisonPresentation === 'tooltip') {
      el.dataset.comparisonTrigger = 'hold';
      el.dataset.comparisonPreview = 'idle';
      el.dataset.focusable = 'true';
      if (!cardOwnsAction) el.setAttribute('role', 'group');
    }
    if (comparisonPresentation === 'tooltip' && !cardOwnsAction) {
      const disarm = armHold(el, {
        ms: comparisonConfig?.holdPreviewDelayMs ?? 160,
        id: 'compareEquipment',
        onConfirm: () => {
          showTooltipFor(el, comparisonHtml, { intent: 'above', clear, appearance });
          stickTooltip(el);
          el.dataset.comparisonPreview = 'open';
        },
      });
      if (registerHold) registerHold(disarm);
    }
    if (comparisonPresentation === 'tooltip' && cardOwnsAction) {
      startComparisonPreview = () => {
        clearTimeout(comparisonPreviewTimer);
        comparisonPreviewOpen = false;
        el.dataset.comparisonPreview = 'pending';
        comparisonPreviewTimer = setTimeout(() => {
          comparisonPreviewTimer = null;
          comparisonPreviewOpen = showTooltipFor(el, comparisonHtml, { intent: 'above', clear, appearance });
          el.dataset.comparisonPreview = comparisonPreviewOpen ? 'open' : 'idle';
        }, comparisonConfig?.holdPreviewDelayMs ?? 160);
      };
      endComparisonPreview = () => {
        clearTimeout(comparisonPreviewTimer);
        comparisonPreviewTimer = null;
        if (comparisonPreviewOpen) hideTooltip();
        comparisonPreviewOpen = false;
        el.dataset.comparisonPreview = 'idle';
      };
    }
  }
  if (cardOwnsAction) {
    // Expanded cards are div-based composite controls, so opt them into the
    // same keyboard/gamepad focus cursor that already reaches folded buttons.
    // armHold then supplies the identical gppress/gprelease action contract.
    el.dataset.focusable = 'true';
    el.setAttribute('role', 'button');
    const disarm = armHold(el, {
      ms: holdDuration,
      id: 'equipInventory',
      // The whole card is the control and it lives in a list that scrolls
      // under the thumb; a scroll must not paint a hold on the way past.
      settleMs: HOLD_DRAG_SETTLE_MS,
      onConfirm: onClassAction,
      onHoldStart: startComparisonPreview,
      onHoldEnd: endComparisonPreview,
      feedbackHosts: () => {
        const reveal = el.closest('.disc-reveal');
        // W1n: the face stands in the collection column, not beside its reveal.
        const faceButton = [...(el.closest('.ep-list')?.querySelectorAll('[data-face]') || [])]
          .find((candidate) => candidate.dataset?.face === row.key);
        return [reveal, faceButton?.querySelector('.inventory-face')];
      },
    });
    if (registerHold) registerHold(disarm);
  }
  return el;
}

/**
 * @typedef {object} ArmouryInventoryCtx
 * @property {object} registries  Content registries.
 * @property {object} run  The run (`run.loadout` is read live).
 * @property {object} meta  Meta (`meta.settings` carries the hold-confirm dial).
 * @property {object} layout  The normalised Armoury layout.
 * @property {object} eq  `registries.equipment`.
 * @property {boolean} inCombat  Whether a fight is on.
 * @property {HTMLElement} wrap  The Armoury overlay (drop targets are found inside it).
 * @property {() => void} draw  Redraws the Armoury.
 * @property {() => void} commit  Reports a change and redraws.
 * @property {Function} applyEquipmentChange  (slotId, setIndex, pieceId, label) Applies an equip.
 * @property {Function} beginInventoryEquip  (row, opener) Starts the slot choice for an item.
 * @property {Function} comparisonFor  (slotId, setIndex, pieceId) The candidate comparison.
 * @property {Function} footerAction  (plan) The footer's primary action from a plan.
 * @property {Function} inventoryTarget  (row) The position a row would go to, or null.
 * @property {Function} openInventoryForSelection  (slotId, setIndex) Opens the picker on a position.
 * @property {Function} pickerTable  (args) Builds the picker table (components/armouryPicker.js).
 * @property {Function} registerHold  (disarm) Registers a hold to be disarmed at the next draw.
 * @property {Function} requestEquip  (slotId, setIndex, pieceId, label) Starts an equip.
 * @property {() => string} responsiveMode  'phone' or 'desktop', asked at use.
 * @property {Function} selectionFacts  (row, target, comparison, eligibility, label, roleLabels) The facts node.
 * @property {Function} setFooterPrimary  (plan|null) Fills the footer's primary slot.
 * @property {Function} slotSummary  (slot, index) What a position holds.
 * @property {() => ?{slotId: string, setIndex: number}} getPicking  The position being picked.
 * @property {(v: null) => void} setPicking  Clears the pick ("show all").
 * @property {() => ?string} getSelectedInventoryKey  The selected row key (read live).
 * @property {(key: ?string) => void} setSelectedInventoryKey
 * @property {(disclosure: ?object) => void} setInventoryDisclosure  Hands the mounted disclosure back.
 * @property {(id: ?string) => void} setDraggingItemId  The item being dragged, or null.
 */

/** The Inventory section: the usable items normally (none, and no section, when there are none), compatible replacements while a position is selected.
 *  @param {ArmouryInventoryCtx} ctx */
export function armouryInventoryBlock(ctx) {
  const {
    registries, run, meta, layout, eq, inCombat, wrap,
    draw, commit, applyEquipmentChange, beginInventoryEquip, comparisonFor, footerAction, inventoryTarget,
    openInventoryForSelection, pickerTable, registerHold, requestEquip, responsiveMode, selectionFacts,
    setFooterPrimary, slotSummary,
    getPicking, setPicking, getSelectedInventoryKey, setSelectedInventoryKey,
    setInventoryDisclosure, setDraggingItemId,
  } = ctx;
  // The picked position: set before the block is built, cleared only by its own "show all".
  const picking = getPicking();
  const box = document.createElement('div');
  box.className = 'inventory-list ep-list armoury-split';
  box.dataset.wireframeBody = 'W1n';
  // W1n: the items on one side, the selected item's detail on the other. The
  // disclosure keeps its faces in the collection and puts its reveal in the
  // detail column; before a selection that column carries the instruction.
  const collection = el('div', { class: 'armoury-item-collection', dataset: { component: UI.armouryItemCollection } });
  const detail = el('div', { class: 'armoury-item-detail', dataset: { component: UI.armouryItemDetail }, 'aria-live': 'polite' });
  const prompt = prose(t('armoury.detail.prompt'), { class: 'armoury-detail-prompt' });
  detail.appendChild(prompt);
  box.append(collection, detail);
  const footerPlans = new Map();
  const roleLabels = combatPowerRoleLabels(layout);
  // Owner 2026-11-06: outside a slot's picker the Armory lists only the usable non-equippable items (a skill book is
  // Read here): compact rows, no grid, and the detail opens under the rows only once an item is chosen.
  const { selectedSlot, allRows, rows, itemCount } = armouryInventoryModel({ registries, run, meta, eq, picking, inCombat });
  if (!selectedSlot) { box.classList.add('is-books-only'); box.dataset.detailOpen = 'false'; prompt.hidden = true; }
  // Equip and unequip commit on one tap (owner, 2026-11-14): a worn item is not
  // lost, it goes back to the inventory. So the card never owns a hold here;
  // the explicit action button (or the face, once a slot is picked) commits on
  // a press, and the hold-confirm dial no longer governs this surface.
  const holdDuration = 0;
  const inventoryItemClass = layout.cardClasses.inventoryItem;
  const faceActions = new Map();
  const pickerParts = new Map();
  const draggableRows = new Map();
  // An action can still be unavailable because its destination is locked,
  // its requirements fail, or a combat mount omitted the engine callback.
  // Keep that refusal on the action itself so the card explains why it cannot
  // move instead of binding a dead act.
  const sealChip = (element, reason) => {
    element.classList.add('locked');
    refuses(element, () => reason);
    return element;
  };
  const attachInventoryDrag = (element, row) => {
    let pointerDrag = null;
    let suppressClick = false;
    const clearDropReady = () => {
      for (const cell of wrap.querySelectorAll('.armoury-position-card.drop-ready')) cell.classList.remove('drop-ready');
    };
    const dropAt = (x, y) => {
      const card = document.elementFromPoint(x, y)?.closest?.('[data-slot-position]');
      if (!card || card.classList.contains('is-locked')) return null;
      const [slotId, rawIndex] = String(card.dataset.slotPosition || '').split(':');
      const setIndex = Number(rawIndex);
      const slot = (eq.slots || []).find((candidate) => candidate.id === slotId);
      if (!slot || !Number.isInteger(setIndex) || !fitsSlot(slot, row.item)) return null;
      return { card, slot, setIndex };
    };
    const detachPointerTracking = () => {
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
    };
    const finishPointerTracking = () => {
      detachPointerTracking();
      pointerDrag = null;
      element.classList.remove('dragging');
      clearDropReady();
    };
    const onPointerMove = (event) => {
      if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
      if (!pointerDrag.dragging
        && Math.hypot(event.clientX - pointerDrag.x, event.clientY - pointerDrag.y) <= HOLD_POINTER_SLOP) return;
      if (!pointerDrag.dragging) element.dispatchEvent(new CustomEvent('carddragstart'));
      pointerDrag.dragging = true;
      event.preventDefault();
      element.classList.add('dragging');
      clearDropReady();
      pointerDrag.drop = dropAt(event.clientX, event.clientY);
      if (pointerDrag.drop) pointerDrag.drop.card.classList.add('drop-ready');
    };
    const onPointerUp = (event) => {
      if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
      const completed = pointerDrag.dragging;
      const drop = pointerDrag.drop || (completed ? dropAt(event.clientX, event.clientY) : null);
      finishPointerTracking();
      if (!completed) return;
      suppressClick = true;
      event.preventDefault();
      event.stopPropagation();
      if (drop) {
        openInventoryForSelection(drop.slot.id, drop.setIndex);
        applyEquipmentChange(drop.slot.id, drop.setIndex, row.id, `Equip ${row.name} to ${drop.slot.label}`);
      }
    };
    const onPointerCancel = (event) => {
      if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
      finishPointerTracking();
    };
    element.draggable = true;
    element.addEventListener('dragstart', (ev) => {
      element.dispatchEvent(new CustomEvent('carddragstart'));
      detachPointerTracking();
      pointerDrag = null;
      setDraggingItemId(row.id);
      element.classList.add('dragging');
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('application/x-ashenspire-item', row.id);
        ev.dataTransfer.setData('text/plain', row.id);
      }
    });
    element.addEventListener('dragend', () => {
      setDraggingItemId(null);
      element.classList.remove('dragging');
      clearDropReady();
    });
    // HTML drag/drop is retained for mouse browsers. Pointer drag is the
    // shared card path for touch and for browser surfaces that do not start
    // an HTML DragEvent from a disclosure button. Moving beyond the hold's
    // own slop cancels that hold and becomes a drag; a tap remains a tap.
    element.addEventListener('pointerdown', (event) => {
      // Touch swipes scroll the inventory. Equip uses its explicit button;
      // mouse/pen users retain drag and drop between named positions.
      if (event.pointerType === 'touch' || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      detachPointerTracking();
      pointerDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, drop: null };
      try { element.setPointerCapture(event.pointerId); } catch { /* capture is a progressive enhancement */ }
      document.addEventListener('pointermove', onPointerMove, true);
      document.addEventListener('pointerup', onPointerUp, true);
      document.addEventListener('pointercancel', onPointerCancel, true);
    });
    element.addEventListener('click', (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  };
  if (selectedSlot) {
    box.dataset.filteredFor = `${selectedSlot.id}:${picking.setIndex}`;
    box.setAttribute('aria-label', `Inventory items compatible with ${selectedSlot.label}`);

  }
  const entries = rows.map((row) => {
    let lastSeal = null, lastTransition = null;
    const target = inventoryTarget(row);
    const { armament, cardClass, draggable, actionLabel, faceActionLabel } = inventoryRowPresentation(row, { target, selectedSlot, layout });
    const face = inventoryFace(registries, row, {
      draggable,
      actionLabel: faceActionLabel,
      classModel: cardClass,
    });
    if (draggable) draggableRows.set(row.key, row);
    let actionButton = null;
    let comparison = null;
    let eligibility = null;
    if (target) {
      const act = () => requestEquip(target.slot.id, target.setIndex, target.pieceId, actionLabel);
      // With the candidate named, the seal carries the grip's sentence too
      // (model/loadout.js gripRefusal) — the player reads why before the act.
      // EVERY INPUT THE MUTATION READS, or the seal refuses in words an act
      // the mutation would accept: `armamentLevels` carries the smithing
      // tiers whose `requirement` deltas lower a minimum, and leaving it out
      // made the card say "Straight Sword requires STR 5 (you have 4)" over
      // a +1 sword the run could legitimately hold (review, #1217).
      const seal = canEquip(registries, target.slot.id, { inCombat, loadout: run.loadout, classId: run.class, setIndex: target.setIndex, itemId: target.pieceId, attributes: run.attributes, itemUpgradeLevels: run.itemUpgradeLevels, armamentLevels: run.armamentLevels });
      const transition = equipTransitionReceipt(
        registries, run.loadout, target.slot.id, target.setIndex, target.pieceId
      );
      lastSeal = seal; lastTransition = transition;
      const wholeCardHold = !selectedSlot && cardClass.holdAction && holdDuration > 0 && seal.ok && transition.ok;
      // The act is a kit Button — danger for an unequip, primary for an equip.
      // When the whole card is the hold target the act is a lit StatePill that
      // names it, not a second control.
      actionButton = wholeCardHold
        ? pill({ label: actionLabel, on: true, attrs: { class: 'ep-equip inventory-card-action-label', 'aria-hidden': 'true' } })
        : button({ label: actionLabel, weight: target.kind === 'unequip' ? 'danger' : 'primary', className: 'ep-equip' });
      actionButton.dataset.act = target.kind;
      if (!wholeCardHold) {
        actionButton.addEventListener('pointerdown', (event) => event.stopPropagation());
        actionButton.addEventListener('click', (event) => event.stopPropagation());
      }
      if (!seal.ok) { actionButton.disabled = true; sealChip(actionButton, seal.reason); }
      else if (!transition.ok) {
        actionButton.disabled = true;
        actionButton.classList.add('locked');
        refuses(actionButton, () => transition.reason);
      } else if (wholeCardHold) {
        faceActions.set(row.key, act);
      } else if (armament) {
        actionButton.addEventListener('click', act);
      } else {
        const disarm = armHold(actionButton, {
          ms: inventoryItemClass.holdAction ? holdDuration : 0,
          id: 'equipInventory',
          onConfirm: act,
        });
        registerHold(disarm);
        faceActions.set(row.key, act);
      }
      comparison = comparisonFor(target.slot.id, target.setIndex, target.pieceId);
      eligibility = inventoryEligibility({ target, seal, transition, requirement: comparison?.requirement });
      const plan = inventoryFooterPlan({ target, actionLabel, eligibility }).primary;
      // The footer runs the same act, through the same hold, as the card.
      if (plan) footerPlans.set(row.key, { ...plan, act, explicit: !!armament, holdMs: cardClass.holdAction ? holdDuration : 0 });
    } else if (armament && (eq.slots || []).some((slot) => fitsSlot(slot, row.item))) {
      // Equip asks for a slot only when there is a choice (beginInventoryEquip).
      actionButton = button({ label: t('armoury.picker.act.equip'), weight: 'primary', className: 'ep-equip' });
      actionButton.dataset.act = 'equip';
      actionButton.addEventListener('pointerdown', (event) => event.stopPropagation());
      actionButton.addEventListener('click', (event) => { event.stopPropagation(); beginInventoryEquip(row, actionButton); });
    } else if (row.classCard && !inCombat && run.gameProfile?.foundation?.mode !== 'configured') {
      const equipped = !run.classUnequipped && run.class === row.id;
      const label = equipped ? 'Unequip class' : 'Equip class';
      const act = () => { equipClassCard(registries, run, equipped ? null : row.id, { inCombat }); commit(); };
      actionButton = button({ label, weight: 'primary', className: 'ep-equip armoury-class-action', disabled: !!run.pendingReward });
      actionButton.title = run.pendingReward ? 'Finish the pending reward before changing class cards.' : '';
      actionButton.addEventListener('click', (event) => { event.stopPropagation(); act(); });
      if (!run.pendingReward) footerPlans.set(row.key, { label, kind: 'class', act, holdMs: 0 });
    } else if (row.read && !inCombat && run.gameProfile?.foundation?.mode !== 'configured') {
      // SPEC §14.3: a skill book is read here, out of combat only — one
      // awardSkillXp on its track (model/consumables.js), then one fewer.
      const label = t('armoury.consumable.read');
      const act = () => {
        openBookLearning({ registries, run, id: row.id, inCombat, settings: meta.settings, onLearn: () => commit() });
      };
      actionButton = button({ label, weight: 'primary', className: 'ep-equip armoury-read-book' });
      actionButton.dataset.act = 'read';
      actionButton.addEventListener('pointerdown', (event) => event.stopPropagation());
      actionButton.addEventListener('click', (event) => { event.stopPropagation(); act(); });
      footerPlans.set(row.key, { label, kind: 'read', act, holdMs: 0 });
    }
    const revealed = inventoryReveal(registries, row, {
      comparison,
      facts: target ? selectionFacts(row, target, comparison, eligibility, actionLabel, roleLabels) : null,
      action: actionButton,
      instruction: '',
      holdDuration, registerHold, classModel: cardClass,
      comparisonConfig: armament ? { ...layout.comparison, presentation: cardClass.comparisonPresentation } : layout.comparison,
      onClassAction: armament ? null : (selectedSlot || holdDuration > 0) ? (faceActions.get(row.key) || null) : null,
    });
    pickerParts.set(row.key, { revealed, target, actionLabel, seal: target ? lastSeal : null, transition: target ? lastTransition : null });
    return {
      key: row.key,
      kind: 'item',
      disclosure: 'face',
      face: {
        label: row.name,
        node: face,
        compact: true,
        className: 'inventoryItem',
        classModel: cardClass,
      },
      reveal: {
        node: revealed,
        sense: `${row.name}. ${row.category}. ${row.count} owned.`,
      },
    };
  });
  if (selectedSlot) {
    setInventoryDisclosure(null);
    collection.append(pickerTable({ selectedSlot, allRows, pickerParts, footerPlans, draggableRows, attachInventoryDrag }));
    detail.remove();            // the table expands inline; no side column
    box.classList.add('is-picker-table');
  } else {
    setInventoryDisclosure(mountDisclosure(collection, entries, {
      moreLabel: 'more items',
      layout: 'column',
      revealHost: detail,
      onReveal: (key) => {
        const changed = key && key !== getSelectedInventoryKey();
        setSelectedInventoryKey(key);
        // On a stacked (phone) layout the detail sits below the whole list, so
        // a newly selected item scrolls its detail into view and lands focus
        // there; desktop keeps its sticky detail beside the list.
        if (changed && responsiveMode() === 'phone') {
          requestAnimationFrame(() => {
            if (!detail.isConnected) return;
            // The action sits at the foot of a tall card: bring IT into view
            // (and focus it), falling back to the detail column itself.
            const act = [...detail.querySelectorAll('.ep-equip')].find((node) => node.getClientRects().length);
            if (!act && !detail.hasAttribute('tabindex')) detail.tabIndex = -1;
            const target = act || detail;
            target.focus({ preventScroll: true });
            target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          });
        }
        prompt.hidden = !!key;
        // Phone rows collapse the detail track until an item is chosen (kit.css).
        box.dataset.detailOpen = key ? 'true' : 'false';
        setFooterPrimary(key ? footerAction(footerPlans.get(key)) : null);
      },
      armFace: ({ button, entry, onTap }) => {
        const draggableRow = draggableRows.get(entry.key);
        if (draggableRow) attachInventoryDrag(button, draggableRow);
        if (entry.face?.classModel?.holdAction !== true) return false;
        const act = faceActions.get(entry.key);
        if (!act) return false;
        button.dataset.cardClass = entry.face.className;
        button.dataset.holdCapable = 'true';
        if (holdDuration > 0) {
          const disarm = armHold(button, {
            ms: holdDuration,
            id: 'equipInventory',
            // Same card, same scrolling list — see the whole-card hold above.
            settleMs: HOLD_DRAG_SETTLE_MS,
            onConfirm: act,
            onTap: () => {
              // The hold controller consumes its trailing click; reveal the
              // nested card's Information control through the short-tap path.
              button.querySelector('.card-inspection-target')?.dispatchEvent(new CustomEvent('cardinspectionrequest'));
              onTap();
            },
            hintHost: button.querySelector('.inventory-face'),
            hintBefore: button.querySelector('.inventory-category'),
            feedbackHosts: () => {
              // W1n: the reveal is in the detail column, not beside the face.
              const reveal = detail.querySelector('.disc-reveal');
              return [button.querySelector('.inventory-face'), reveal?.dataset.revealFor === entry.key ? reveal : null];
            },
          });
          registerHold(disarm);
        } else if (selectedSlot) {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            act();
          });
        } else {
          return false;
        }
        return true;
      },
    }));
  }
  if (selectedSlot) {
    const clear = button({ label: t('armoury.destination.showAll') });
    clear.addEventListener('click', () => { setPicking(null); draw(); });
    const index = picking.setIndex;
    const current = slotSummary(selectedSlot, index);
    box.prepend(el('div', { class: 'armoury-selection-context', role: 'status' }, [
      prose(inventorySelectionContextText({
        slotLabel: selectedSlot.label, index, activeIndex: run.loadout.active[selectedSlot.id], currentName: current.name,
      })), clear]));
  }
  box.dataset.inventoryCount = String(itemCount);
  // While picking, the table owns its own empty state.
  if (!entries.length && !selectedSlot) {
    // Nothing to select: the collection says why and takes the whole pane.
    collection.appendChild(flavour(selectedSlot ? `Nothing in Inventory fits ${selectedSlot.label}.` : 'Inventory is empty.', { class: 'ep-hint' }));
    if (detail.isConnected) detail.remove();
    box.classList.add('is-empty');
  }
  return box;
}
