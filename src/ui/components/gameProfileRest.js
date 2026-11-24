import { t } from '../strings.js';
import { ActivateOnKey } from '../selection.js';
import { gameModule } from '../../model/gameProfile.js';
import { restServicesAll, restServiceUsed, RestChoiceMode } from '../../model/gameProfileRest.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { statProjection } from '../../model/statProjection.js';
import { runHandRules } from '../../model/handRules.js';
import { esc } from './tooltip.js';
import { engravedIconHtml } from './engravedIcon.js';
import { recoveryLedgerHtml } from './recoveryLedger.js';
import { mountRestFrame, restPresentation } from './restFrame.js';
import { RefreshRunHud, RunHudRefreshSignature } from './runHud.js';
import { RenderStatAllocationCard } from './statAllocationCard.js';
import { mountSmithUpgradeModal } from './smithUpgradeModal.js';
import { MountCardUpgradeModal } from './cardUpgradeModal.js';
import { cardUpgradeModel } from '../models/CardUpgradeModel.js';
import { OpenConfirmationModal } from './confirmationModal.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { gameProfileRestModel, gameProfileSmithModel } from '../models/GameProfileRestModel.js';
import { restChoiceStatus } from '../models/ChoiceBodyModel.js';
import { el, button, modalFooter } from '../kit/index.js';

// Presentation only. The persisted run transaction owns the one-service rule,
// final validation and every pool/flask refill; closing a review changes none.
// It returns { root, refresh }: a commit refreshes the service cards in place (owner, 2026-11-18), so the
// Shrine, its scroll position, the free deck door and every unchanged card stay mounted.
export function mountGameProfileRest(app, { registries, run, meta, hud, visit, onStrategize, deckEditor = null, onCommit, onLeave }) {
  let model = gameProfileRestModel(registries, run, visit);
  const visitId = visit.id;
  const serviceCards = new Map();
  const HUD_OPTIONS = { place: 'rest', headerClass: 'map-header room-header workspace-hud' };
  const icons = { rest: 'rest', strategize: 'deck', smith: 'smith', levelUp: 'progression', upgradeCard: 'deck' };
  const optionIds = { rest: 'rest-opt', strategize: 'strategize-opt', smith: 'smith-opt', levelUp: 'level-opt', upgradeCard: 'upgrade-card-opt' };
  const all = restServicesAll(run); // Core: heal on arrival, every service once, only Continue leaves
  const pick = RestChoiceMode(run); // one pick per visit; only the Rest card restores
  const usedOf = id => all ? restServiceUsed(visit, id) : visit.service === id;
  const availability = restChoiceStatus(model.services.map(service => ({ ...service, used: usedOf(service.id) })));
  const layout = restPresentation(registries).optionLayout;
  const row = el('div', { class: `class-row shrine-option-${layout}`, dataset: { optionLayout: layout } });
  const choices = el('div', { class: 'choice-body-choices rest-choices' }, row);
  // What a service card shows: an unchanged card keeps its node across a refresh.
  const serviceSignature = service => JSON.stringify([service.id, service.title, service.description, service.available, service.reason, usedOf(service.id)]);
  function makeServiceCard(service) {
    const card = el('div', {
      class: `class-pick${service.available ? '' : ' locked rest-option-off'}`, id: optionIds[service.id], role: 'button',
      tabindex: service.available ? '0' : '-1', 'aria-disabled': String(!service.available),
    }, [
      el('div', { class: 'glyph', html: engravedIconHtml(icons[service.id]) }),
      el('div', { class: 'cp-body' }, [
        el('h3', { text: service.title }),
        el('p', { text: service.available ? service.description : usedOf(service.id) ? t('gameProfile.rest.usedService') : service.reason }),
      ]),
    ]);
    const open = () => openService(service.id, card);
    card.addEventListener('click', open);
    ActivateOnKey(card, open, { canActivate: event => !event.defaultPrevented });
    return markUiComponent(card, UI.shrineOptionCard, service.id === 'levelUp' ? 'level-up' : service.id);
  }
  for (const service of model.services) {
    const card = makeServiceCard(service);
    serviceCards.set(service.id, { card, signature: serviceSignature(service) });
    row.append(card);
  }

  // Core 2: editing the deck is a free door, not a service. It is open before and after the pick, never touches `visit`, and is not
  // counted in the availability status above.
  if (deckEditor) {
    const deck = el('div', { class: 'class-pick', id: 'deck-opt', role: 'button', tabindex: '0', 'aria-disabled': 'false' }, [
      el('div', { class: 'glyph', html: engravedIconHtml('deck') }),
      el('div', { class: 'cp-body' }, [el('h3', { text: t('gameProfile.rest.service.deck') }), el('p', { text: t('gameProfile.rest.description.deck') })]),
    ]);
    row.append(markUiComponent(deck, UI.shrineOptionCard, 'deck'));
    const open = () => invoke(() => deckEditor.onOpen());
    deck.addEventListener('click', open);
    ActivateOnKey(deck, open, { canActivate: event => !event.defaultPrevented });
  }

  // The recovery ledger is projected from the final transaction, including
  // newly derived maxima after a selected attribute/equipment upgrade.
  const recoveryHtml = after => pick ? '' : recoveryLedgerHtml(run, after);
  // Core: one line, since arrival always restores HP and MP in full. The recovery table, intro and
  // availability list are gone; each option card already says what it does or why it cannot be used.
  const consequences = el('aside', { class: 'choice-body-consequences choice-status rest-consequences', 'aria-label': t('rest.consequences.heading') }, [
    all ? el('p', { class: 'as-flavor rest-healed', dataset: { restHealed: 'true' }, text: t('gameProfile.rest.restored') })
      : el('p', { class: 'as-flavor', text: visit.service ? t('gameProfile.rest.complete', { service: t(`gameProfile.rest.service.${visit.service}`) }) : t(pick ? 'gameProfile.rest.chooseOneRest' : 'gameProfile.rest.chooseOne') }),
  ]);
  const status = el('p', { class: 'as-status', role: 'alert' });
  consequences.append(status);
  const leave = button({ label: t('rest.continue'), weight: 'primary', id: 'shrine-leave', className: 'shrine-leave' });
  leave.addEventListener('click', onLeave);
  const screen = mountRestFrame(app, { registries, run, meta, hud, remount: () => refresh(),
    eyebrow: '', title: t('rest.title'), status: t('rest.status.available', { available: availability.available, total: availability.total }),
    choices, consequences, foot: modalFooter({ primary: leave, size: 'fill', className: 'choice-foot' }),
  });
  let hudSignature = hud ? RunHudRefreshSignature({ registries, run, meta, ...HUD_OPTIONS }) : '';
  screen.classList.add('core-rest'); // scopes the compact Core rest CSS away from the full-game rest screen
  const invoke = action => {
    status.textContent = '';
    try { action(); return true; }
    catch (error) { screen.inert = false; status.textContent = error.message; return false; }
  };
  const commit = (service, payload) => invoke(() => onCommit(service, payload));

  // A confirmed upgrade lands back on the refreshed list (modalReturn.js): the option is
  // re-queried then, and not reopened if it is spent (Back and the X still exit fully).
  const shrineParent = (selector) => ({ place: t('common.place.shrine'), reopen: () => {
    const option = app.querySelector(selector);
    if (option && option.getAttribute('aria-disabled') !== 'true') option.click();
  } });
  const openSmith = () => {
    let selected = null;
    screen.inert = true;
    const makeModel = () => gameProfileSmithModel(registries, model.smith, model.smithPreviews, selected, recoveryHtml, { all, pick, levelUpOffered: model.services.some(service => service.id === 'levelUp') });
    const modal = mountSmithUpgradeModal(app, makeModel(), {
      registries, meta, returnFocusElement: app.querySelector('#smith-opt'),
      parent: shrineParent('#smith-opt'),
      onSelect: itemRef => { selected = itemRef; modal.update(makeModel()); },
      onBack: () => { screen.inert = false; app.querySelector('#smith-opt')?.focus({ preventScroll: true }); },
      onConfirm: itemRef => { screen.inert = false; return commit('smith', { itemRef }); },
    });
  };

  // Core: pick one deck card; the modal previews the plan's own before/after and the recovery ledger of the same transaction.
  const openUpgradeCard = () => {
    let selected = null;
    screen.inert = true;
    const makeModel = () => cardUpgradeModel(registries, run, selected,
      { blockedReason: selected && model.cardPreviews.get(selected)?.available === false ? model.cardPreviews.get(selected).reason : '' });
    const modal = MountCardUpgradeModal(app, makeModel(), {
      registries, meta, returnFocusElement: app.querySelector('#upgrade-card-opt'),
      parent: shrineParent('#upgrade-card-opt'),
      decisionConsequence: t(pick ? 'gameProfile.rest.upgradeCardDecisionPick' : 'gameProfile.rest.upgradeCardDecision'),
      onSelect: instanceId => { selected = instanceId; modal.update(makeModel()); },
      onBack: () => { screen.inert = false; app.querySelector('#upgrade-card-opt')?.focus({ preventScroll: true }); },
      onConfirm: (instanceId, quote) => { screen.inert = false; return commit('upgradeCard', { instanceId, quote }); },
    });
  };

  const openLevel = () => {
    let selected = null;
    let allocation;
    const previews = el('div', { class: 'configured-level-recovery' });
    const cards = new Map(attributeCardModels(registries, run.attributes, {
      projection: statProjection(registries, run), equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
      gainContext: { run, settings: meta?.settings || {} },
      hand: runHandRules(registries, run, meta?.settings || {}),
    }).map(card => [card.id, card]));
    const draw = () => {
      const chosen = model.attributes.find(attribute => attribute.id === selected);
      const spec = {
        title: t('gameProfile.rest.service.levelUp'), modal: true,
        remaining: selected ? 0 : 1, note: t(all ? 'gameProfile.rest.levelNoteAll' : 'gameProfile.rest.levelNote'),
        doneLabel: t(all ? 'gameProfile.rest.levelConfirmAll' : 'gameProfile.rest.levelConfirm'), doneDisabled: !chosen?.available,
        rows: model.attributes.map(attribute => ({ ...attribute, card: cards.get(attribute.id),
          value: attribute.value + (attribute.id === selected ? 1 : 0),
          canDecrease: attribute.id === selected, canIncrease: !selected && attribute.available,
        })),
        onIncrease: id => { selected = id; draw(); },
        onDecrease: () => { selected = null; draw(); },
        onCancel: () => allocation.close(),
        onClose: () => { screen.inert = false; app.querySelector('#level-opt')?.focus({ preventScroll: true }); },
        onDone: () => {
          if (!model.attributes.find(attribute => attribute.id === selected)?.available) return;
          allocation.close(); commit('levelUp', { attributeId: selected });
        },
      };
      if (allocation) allocation.update(spec);
      else {
        screen.inert = true;
        allocation = RenderStatAllocationCard(app, spec);
        allocation.card.classList.add('level-up-modal');
        allocation.card.querySelector('.stat-allocation-card').append(previews);
      }
      previews.innerHTML = chosen?.available ? recoveryHtml(chosen.preview) : '';
    };
    draw();
  };

  // A card's handler reads the live model, so a spent service refuses even through a retained card.
  function openService(id, option) {
    const service = model.services.find(entry => entry.id === id);
    if (!service?.available) return undefined;
    return invoke(() => {
      if (id === 'rest') return commit('rest', {});
      if (id === 'smith') return openSmith();
      if (id === 'levelUp') return openLevel();
      if (id === 'upgradeCard') return openUpgradeCard();
      if (gameModule(run, 'cards')) return onStrategize();
      OpenConfirmationModal({ title: service.title, message: t(pick ? 'gameProfile.rest.chooseOneRest' : 'gameProfile.rest.chooseOne'),
        detailsHtml: recoveryHtml(service.preview), confirmLabel: service.title,
        returnFocusElement: option, onConfirm: onStrategize,
      });
      return undefined;
    });
  }

  function syncServiceCards() {
    const seen = new Set();
    model.services.forEach((service, index) => {
      seen.add(service.id);
      const signature = serviceSignature(service);
      let entry = serviceCards.get(service.id);
      if (!entry || entry.signature !== signature) {
        const card = makeServiceCard(service);
        if (entry) entry.card.replaceWith(card);
        entry = { card, signature };
        serviceCards.set(service.id, entry);
      }
      if (row.children[index] !== entry.card) row.insertBefore(entry.card, row.children[index] || null);
    });
    for (const [id, entry] of serviceCards) if (!seen.has(id)) { entry.card.remove(); serviceCards.delete(id); }
  }

  function syncStatusLines() {
    const now = restChoiceStatus(model.services.map(service => ({ ...service, used: usedOf(service.id) })));
    const summary = screen.querySelector('.choice-head-status');
    const summaryText = t('rest.status.available', { available: now.available, total: now.total });
    if (summary && summary.textContent !== summaryText) summary.textContent = summaryText;
    const recovery = consequences.querySelector('.as-flavor');
    const recoveryText = all ? t('gameProfile.rest.restored') : visit.service
      ? t('gameProfile.rest.complete', { service: t(`gameProfile.rest.service.${visit.service}`) })
      : t(pick ? 'gameProfile.rest.chooseOneRest' : 'gameProfile.rest.chooseOne');
    if (recovery && recovery.textContent !== recoveryText) recovery.textContent = recoveryText;
  }

  // Focus returns to the card the player used, or to the next service still open, the deck door or Continue.
  function restoreFocus(restoreId, previousIds) {
    if (!restoreId || document.querySelector('.modal-veil:not(.confirmation-input-shield)')) return;
    const same = screen.querySelector(`#${restoreId}`);
    const at = Math.max(0, previousIds.findIndex(id => optionIds[id] === restoreId));
    const following = [...model.services.slice(at), ...model.services.slice(0, at).reverse()].find(service => service.available);
    const target = same && same.getAttribute('aria-disabled') !== 'true' ? same : serviceCards.get(following?.id)?.card || screen.querySelector('#deck-opt') || leave;
    target?.focus?.({ preventScroll: true });
  }

  function refresh({ focusId = null } = {}) {
    // A refresh that lands after the player left must not draw over the next screen.
    if (!screen.isConnected) return;
    const scroll = [screen, choices, row, ...screen.querySelectorAll('.choice-body, .choice-body-columns')]
      .map(node => [node, node.scrollTop, node.scrollLeft]);
    const focusedId = document.activeElement?.closest?.('.class-pick')?.id;
    const previousIds = [...serviceCards.keys()];
    // The commit replaces the persisted visit; read the current one.
    visit = run.gameProfileRestVisits?.[visitId] || visit;
    model = gameProfileRestModel(registries, run, visit);
    syncServiceCards();
    syncStatusLines();
    if (hud) {
      const signature = RunHudRefreshSignature({ registries, run, meta, ...HUD_OPTIONS });
      if (signature !== hudSignature) {
        hudSignature = signature;
        RefreshRunHud(app, { registries, run, meta, ...HUD_OPTIONS, hud, remount: () => refresh() });
      }
    }
    restoreFocus(optionIds[focusId] || focusId || focusedId, previousIds);
    for (const [node, top, left] of scroll) { node.scrollTop = top; node.scrollLeft = left; }
  }
  return { root: screen, refresh };
}

