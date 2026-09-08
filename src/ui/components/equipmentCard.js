import { equipmentCardModel } from '../../model/equipmentCard.js';
import { equipmentCardArt } from '../assets.js';
import { attachTooltip, esc, hideTooltip, showTooltipFor } from './tooltip.js';

// Connection-owned sizing: removed inventory reveals cannot retain observers.
function canvasElement() {
  if (!customElements.get('as-equipment-card')) customElements.define('as-equipment-card', class extends HTMLElement {
    connectedCallback() {
      this.observer = new ResizeObserver(entries => {
        this.style.setProperty('--card-scale', entries[0].contentRect.width / 350);
        if (!entries[0].contentRect.width) return;
        // Full text remains in the inspector. Never clip or distort the canvas.
        for (const [selector, label] of [['.epc-name', 'Item name'], ['.epc-type', 'Item type'], ['.epc-tags', 'Tags'], ['.epc-effects', 'Bonuses'], ['.epc-flavor', 'Flavor'], ['.epc-footer', 'Requirements and rarity']]) {
          const region = this.querySelector(selector);
          if (region && (region.scrollHeight > region.clientHeight + 2 || region.scrollWidth > region.clientWidth + 2)) {
            region.textContent = `${label} · Read details`;
            region.dataset.overflowSummary = 'true';
          }
        }
      });
      this.observer.observe(this);
    }
    disconnectedCallback() { this.observer?.disconnect(); }
  });
  return document.createElement('as-equipment-card');
}

export function renderEquipmentCard(registries, piece, { interactive = true, presentation = null } = {}) {
  const model = presentation || equipmentCardModel(registries, piece);
  const card = canvasElement();
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
    <span class="epc-name ec-name" ${tip(model.name, model.identityExplanation || `${model.name}. ${model.type}. ${model.flavor} The card shows base values; upgrades and comparisons are listed separately.`)}>${esc(model.name)}<span aria-hidden="true">◆</span></span>
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
      attachTooltip(target, html, { expand: true, expandTitle: label });
      if (!interactive) return;
      target.addEventListener('focus', () => showTooltipFor(target, html()));
      target.addEventListener('blur', hideTooltip);
      target.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); target.click(); } });
    });
    // Keep explanation gestures out of the containing equipment hold action.
    if (interactive) for (const type of ['pointerdown', 'touchstart', 'click', 'keydown']) card.addEventListener(type, event => event.stopPropagation());
  }
  return { card, explanations, model };
}

/** Always available full text: no tooltip gesture or small type required. */
export function renderEquipmentInspection(registries, piece, options = {}) {
  const { card, explanations } = renderEquipmentCard(registries, piece, options);
  const wrap = document.createElement('section');
  wrap.className = 'equipment-poker-inspection';
  const details = document.createElement('details');
  details.className = 'equipment-poker-explanations';
  details.innerHTML = `<summary>Read all details and explanations</summary><dl>${explanations.map(e => `<dt>${esc(e.label)}</dt><dd>${esc(e.explanation)}</dd>`).join('')}</dl>`;
  for (const type of ['pointerdown', 'touchstart', 'click', 'keydown']) details.addEventListener(type, event => event.stopPropagation());
  wrap.append(card, details);
  return wrap;
}
