import { t } from '../strings.js';
import { gameModule } from '../../model/gameProfile.js';
import { restServicesAll, restServiceUsed } from '../../model/gameProfileRest.js';
import { attributeCardModels } from '../../model/creationBrief.js';
import { statProjection } from '../../model/statProjection.js';
import { runHandRules } from '../../model/handRules.js';
import { esc } from './tooltip.js';
import { engravedIconHtml } from './engravedIcon.js';
import { mountRestFrame, restPresentation } from './restFrame.js';
import { renderStatAllocationCard } from './statAllocationCard.js';
import { mountSmithUpgradeModal } from './smithUpgradeModal.js';
import { openConfirmationModal } from './confirmationModal.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { gameProfileRestModel, gameProfileSmithModel } from '../models/GameProfileRestModel.js';
import { restChoiceStatus } from '../models/ChoiceBodyModel.js';
import { el, button, modalFooter } from '../kit/index.js';

// Presentation only. The persisted run transaction owns the one-service rule,
// final validation and every pool/flask refill; closing a review changes none.
export function mountGameProfileRest(app, { registries, run, meta, hud, visit, onStrategize, onCommit, onLeave, remount }) {
  const model = gameProfileRestModel(registries, run, visit);
  const icons = { strategize: 'deck', smith: 'smith', levelUp: 'progression' };
  const optionIds = { strategize: 'strategize-opt', smith: 'smith-opt', levelUp: 'level-opt' };
  const all = restServicesAll(run); // Core: heal on arrival, every service once, only Continue leaves
  const usedOf = id => all ? restServiceUsed(visit, id) : visit.service === id;
  const availability = restChoiceStatus(model.services.map(service => ({ ...service, used: usedOf(service.id) })));
  const layout = restPresentation(registries).optionLayout;
  const choices = el('div', { class: 'choice-body-choices rest-choices' }, el('div', {
    class: `class-row shrine-option-${layout}`, dataset: { optionLayout: layout },
  }, model.services.map(service => {
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
    return markUiComponent(card, UI.shrineOptionCard, service.id === 'levelUp' ? 'level-up' : service.id);
  })));

  // The recovery ledger is projected from the final transaction, including
  // newly derived maxima after a selected attribute/equipment upgrade.
  const recoveryHtml = after => {
    const rows = [
      ['health', t('gameProfile.rest.pool.hp'), run.hp, after.hp],
      ['mana', t('gameProfile.rest.pool.mp'), run.mana, after.mana],
      ['stamina', t('gameProfile.rest.pool.sp'), run.stamina, after.stamina],
      ...(run.flaskCharges ? [
        ['flask-health', t('gameProfile.rest.pool.healingFlask'), run.flaskCharges.hpCurrent, after.flaskCharges.hpCurrent],
        ['flask-mana', t('gameProfile.rest.pool.mpFlask'), run.flaskCharges.manaCurrent, after.flaskCharges.manaCurrent],
      ] : []),
    ];
    return `<section class="rest-recovery" aria-label="${esc(t('rest.recovery.heading'))}"><h3 class="as-eyebrow">${esc(t('rest.recovery.heading'))}</h3>${rows.map(([icon, label, before, next]) => `<div class="rest-recovery-row">${engravedIconHtml(icon)}<span>${esc(label)}</span><span>${before} → <strong>${next}</strong></span><span class="rest-recovery-gain">${next > before ? `+${next - before}` : '—'}</span></div>`).join('')}</section>`;
  };
  // Core: one line, since arrival always restores HP and MP in full. The recovery table, intro and
  // availability list are gone; each option card already says what it does or why it cannot be used.
  const consequences = el('aside', { class: 'choice-body-consequences choice-status rest-consequences', 'aria-label': t('rest.consequences.heading') }, [
    all ? el('p', { class: 'as-flavor rest-healed', dataset: { restHealed: 'true' }, text: t('gameProfile.rest.restored') })
      : el('p', { class: 'as-flavor', text: visit.service ? t('gameProfile.rest.complete', { service: t(`gameProfile.rest.service.${visit.service}`) }) : t('gameProfile.rest.chooseOne') }),
  ]);
  const status = el('p', { class: 'as-status', role: 'alert' });
  consequences.append(status);
  const leave = button({ label: t('rest.continue'), weight: 'primary', id: 'shrine-leave', className: 'shrine-leave' });
  leave.addEventListener('click', onLeave);
  const screen = mountRestFrame(app, { registries, run, meta, hud, remount,
    eyebrow: '', title: t('rest.title'), status: t('rest.status.available', { available: availability.available, total: availability.total }),
    choices, consequences, foot: modalFooter({ primary: leave, size: 'fill', className: 'choice-foot' }),
  });
  screen.classList.add('core-rest'); // scopes the compact Core rest CSS away from the full-game rest screen
  const invoke = action => {
    try { action(); }
    catch (error) { screen.inert = false; status.textContent = error.message; }
  };
  const commit = (service, payload) => invoke(() => onCommit(service, payload));

  const openSmith = () => {
    let selected = null;
    screen.inert = true;
    const makeModel = () => gameProfileSmithModel(registries, model.smith, model.smithPreviews, selected, recoveryHtml, { all, levelUpOffered: model.services.some(service => service.id === 'levelUp') });
    const modal = mountSmithUpgradeModal(app, makeModel(), {
      registries, meta, returnFocusElement: app.querySelector('#smith-opt'),
      onSelect: itemRef => { selected = itemRef; modal.update(makeModel()); },
      onBack: () => { screen.inert = false; app.querySelector('#smith-opt')?.focus({ preventScroll: true }); },
      onConfirm: itemRef => { screen.inert = false; commit('smith', { itemRef }); },
    });
  };

  const openLevel = () => {
    let selected = null;
    let allocation;
    const previews = el('div', { class: 'configured-level-recovery' });
    const cards = new Map(attributeCardModels(registries, run.attributes, {
      projection: statProjection(registries, run), equipmentProfiles: run.equipmentProfileRuleSnapshot?.profiles,
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
        allocation = renderStatAllocationCard(app, spec);
        allocation.card.classList.add('level-up-modal');
        allocation.card.querySelector('.stat-allocation-card').append(previews);
      }
      previews.innerHTML = chosen?.available ? recoveryHtml(chosen.preview) : '';
    };
    draw();
  };

  for (const service of model.services) {
    if (!service.available) continue;
    const option = app.querySelector(`#${optionIds[service.id]}`);
    const open = () => invoke(() => {
      if (service.id === 'smith') return openSmith();
      if (service.id === 'levelUp') return openLevel();
      if (gameModule(run, 'cards')) return onStrategize();
      openConfirmationModal({ title: service.title, message: t('gameProfile.rest.chooseOne'),
        detailsHtml: recoveryHtml(service.preview), confirmLabel: service.title,
        returnFocusElement: option, onConfirm: onStrategize,
      });
    });
    option.addEventListener('click', open);
    option.addEventListener('keydown', event => {
      if (event.defaultPrevented || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); open();
    });
  }
}
