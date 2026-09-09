import { bindCardInspection, cardInspectionLayout, openCardInspection } from './cardInspection.js';
import { equipmentCardModel, equipmentCardTokens } from '../../model/equipmentCard.js';
import { equipmentCardArt } from '../assets.js';
import { attachTooltip, esc, hideTooltip, showTooltipFor } from './tooltip.js';

// Connection-owned sizing: removed inventory reveals cannot retain observers.
//
// THE DIVISOR IS THE AUTHORED FRAME WIDTH, NOT A LITERAL. It read `/ 350` while
// the stylesheet separately declared a 350px frame, so the two could drift apart
// silently and the face would scale to the wrong size with nothing to say so.
function canvasElement(frameWidthPx) {
  if (!customElements.get('as-equipment-card')) customElements.define('as-equipment-card', class extends HTMLElement {
    connectedCallback() {
      this.observer = new ResizeObserver(entries => {
        const width = Number(this.dataset.frameWidth) || 350;
        this.style.setProperty('--card-scale', entries[0].contentRect.width / width);
      });
      this.observer.observe(this);
    }
    disconnectedCallback() { this.observer?.disconnect(); }
  });
  const el = document.createElement('as-equipment-card');
  el.dataset.frameWidth = String(frameWidthPx);
  return el;
}

/** Face geometry and type scale reach the stylesheet as custom properties. */
function applyCardTokens(card, tokens) {
  const set = (name, value) => card.style.setProperty(name, value);
  set('--epc-rows', tokens.rows);
  set('--epc-frame-w', `${tokens.frameWidthPx}px`);
  set('--epc-frame-h', `${tokens.frameHeightPx}px`);
  set('--epc-pad', `${tokens.paddingPx}px`);
  set('--epc-gap', `${tokens.gapPx}px`);
  set('--epc-bonus-lines', String(tokens.bonusMaxLines));
  set('--card-info-size', `${tokens.info.sizePx}px`);
  set('--card-info-inset', `${tokens.info.insetPx}px`);
  set('--card-info-fade', `${tokens.info.fadeMs}ms`);
  set('--card-info-delay', `${tokens.info.revealDelayMs}ms`);
  for (const [key, value] of Object.entries(tokens.type)) set(`--epc-text-${key}`, value);
}

export function renderEquipmentCard(registries, piece, { interactive = true, presentation = null, inspection = true } = {}) {
  const model = presentation || equipmentCardModel(registries, piece);
  const tokens = equipmentCardTokens();
  const card = canvasElement(tokens.frameWidthPx);
  applyCardTokens(card, tokens);
  card.className = 'equipment-poker-card';
  card.dataset.item = model.id;
  card.setAttribute('aria-label', `${model.name} ${model.cardKind || 'equipment'} card`);
  card.style.setProperty('--accent', model.accent);
  const explanations = [];
  const tip = (label, explanation) => {
    const index = explanations.push({ label, explanation }) - 1;
    return `data-card-tip="${index}"${interactive ? ' tabindex="0"' : ''}`;
  };
  card.innerHTML = `<span class="epc-frame">
    <span class="epc-name ec-name" style="--title-units:${Math.max(1, Array.from(String(model.name)).length * 0.62)}" ${tip(model.name, model.identityExplanation || `${model.name}. ${model.type}. ${model.flavor} The card shows base values; upgrades and comparisons are listed separately.`)}>${esc(model.name)}<span aria-hidden="true">◆</span></span>
    <span class="epc-art" ${tip(`${model.name} artwork`, 'Item identity artwork. Appearance does not change its mechanics.')}>${presentation && !model.art ? `<span class="epc-art-glyph" aria-hidden="true">${esc(model.glyph || piece.icon || '◆')}</span>` : `<img src="${esc(presentation ? model.art : equipmentCardArt(piece))}" alt="${esc(model.name)}">`}</span>
    <span class="epc-type" ${tip(model.type, model.typeExplanation)}>${esc(model.type)}</span>
    <span class="epc-facts">${model.facts.map(f => `<span class="epc-fact" ${tip(`${f.label}: ${f.value}`, f.explanation)}><strong>${esc(f.value)}</strong>${esc(f.label)}</span>`).join('')}</span>
    <span class="epc-tags ec-tags">${model.tags.map(t => `<span class="epc-tag" ${tip(t.label, t.explanation)}>${esc(t.label)}</span>`).join('')}</span>
    <span class="epc-effects ec-mods"><span class="epc-heading">${esc(model.effectsLabel || 'Equipment bonuses')}</span>${model.bonuses.map(b => `<span class="epc-bonus" ${tip(b.label, b.explanation)}>${esc(b.label)}</span>`).join('') || '<span>No additional bonuses</span>'}</span>
    <span class="epc-flavor" ${tip('Flavor', `${model.flavor} This is lore, not an additional gameplay effect.`)}>${esc(model.flavor)}</span>
    <span class="epc-footer"><span ${tip('Requirements', model.requirementExplanation)}>${esc(model.requirement)}</span><span ${tip('Rarity', `${model.rarity}. Authored item classification; actual effects are listed above.`)}>${esc(model.rarity)}</span></span>
  </span>`;
  card.querySelector('img')?.addEventListener('error', event => event.target.replaceWith(document.createTextNode(piece.icon || '◆')));
  {
    card.querySelectorAll('[data-card-tip]').forEach(target => {
      const { label, explanation } = explanations[Number(target.dataset.cardTip)];
      const html = () => `<div class="tt-title">${esc(label)}</div><p>${esc(explanation)}</p>`;
      attachTooltip(target, html);
      target.title = `${label}: ${explanation}`;
      if (!interactive) return;
      target.addEventListener('focus', () => showTooltipFor(target, html()));
      target.addEventListener('blur', hideTooltip);

    });
    // Keep explanation gestures out of the containing equipment hold action.
    if (interactive) for (const type of ['pointerdown', 'touchstart', 'click', 'keydown']) card.addEventListener(type, event => event.stopPropagation());
  }
  if (inspection) bindCardInspection(card, { title: model.name, readOnly: interactive,
    open: opener => {
      const face = renderEquipmentCard(registries, piece, { interactive: false, presentation, inspection: false }).card;
      return openCardInspection({ title: model.name, card: face, details: equipmentDetails(explanations), opener });
    } });
  return { card, explanations, model };
}

/** Full explanations remain readable, even when the compact face truncates. */
export function equipmentDetails(explanations) {
  const details = document.createElement('div');
  details.className = 'equipment-poker-explanations';
  details.innerHTML = '<dl>' + explanations.map(e => '<dt>' + esc(e.label) + '</dt><dd>' + esc(e.explanation) + '</dd>').join('') + '</dl>';
  return details;
}

export function renderEquipmentInspection(registries, piece, options = {}) {
  const { card, explanations } = renderEquipmentCard(registries, piece, { ...options, inspection: false });
  const wrap = cardInspectionLayout(card, equipmentDetails(explanations));
  wrap.classList.add('equipment-poker-inspection');
  return wrap;
}
