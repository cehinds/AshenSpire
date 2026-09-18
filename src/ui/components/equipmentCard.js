import { bindCardInspection, cardInspectionLayout, openCardInspection } from './cardInspection.js';
import { equipmentCardModel, equipmentCardTokens } from '../../model/equipmentCard.js';
import { equipmentCardArt } from '../assets.js';
import { imageHintAttrs } from '../imageHints.js';
import { attachTooltip, esc } from './tooltip.js';
import { cardLevelWidthPx } from '../models/CardSizeModel.js';
import { configureTooltipGlossary, decorateKeywords, inspectionTag } from './tooltipGlossary.js';
import { metadataFooter } from '../models/IdentityModel.js';
import { possessionVariant } from '../models/PossessionVariantModel.js';
import { t } from '../strings.js';
import { selectionRevealDelayMs } from '../models/SelectionEffectModel.js';

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
  set('--epc-flavor-row', `${tokens.heights.flavor}px`);
  set('--epc-bonus-lines', String(tokens.bonusMaxLines));
  set('--card-info-inset', `${tokens.info.insetPx}px`);
  set('--card-info-fade', `${tokens.info.fadeMs}ms`);
  set('--card-info-delay', `${selectionRevealDelayMs()}ms`);
  for (const [key, value] of Object.entries(tokens.type)) set(`--epc-text-${key}`, value);
}

export function renderEquipmentCard(registries, piece, { interactive = true, presentation = null, inspection = true, owned = null, level = 'focus' } = {}) {
  configureTooltipGlossary(registries);
  const model = presentation || equipmentCardModel(registries, piece);
  const tokens = equipmentCardTokens(undefined, { collapse: model.tags.length ? [] : ['tags'] });
  const card = canvasElement(tokens.frameWidthPx);
  applyCardTokens(card, tokens);
  card.className = 'equipment-poker-card';
  // ONE `level` ARGUMENT, NOT TWO. `glance | focus | inspect` says both how big
  // this card is (CardSizeModel, below) and which of its fields it shows; a
  // second parameter would let the two drift and put a focus-sized face on an
  // inspect-sized card. The width travels with the card as a custom property so
  // no surface has to write a `max-width` of its own ever again.
  card.dataset.cardLevel = level;
  card.style.setProperty('--epc-level-w', `${cardLevelWidthPx(level)}px`);
  card.dataset.item = model.id;
  // WC2a1–WC2c3: which rows each region carries, from the item's own data
  // (hand, card package, modifiers, relic modes, potion effects). A bespoke
  // presentation without a variant (the empty hand) keeps the plain face.
  const variant = presentation ? presentation.variant || null
    : possessionVariant(registries, piece, { kind: 'equipment', bonuses: model.bonuses,
      attributeRequirement: model.requirement.startsWith('Requires ') ? model.requirement : null });
  if (variant) card.dataset.possession = variant.families.join(' ');
  card.setAttribute('aria-label', `${model.name} ${model.cardKind || 'equipment'} card`);
  card.style.setProperty('--accent', model.accent);
  const explanations = [];
  const tip = (label, explanation, role = 'tag') => {
    const index = explanations.push({ label, explanation, role }) - 1;
    return `data-card-tip="${index}"${interactive ? ' tabindex="0"' : ''}`;
  };
  // WC2a: slot and requirements share body row one; the footer is metadata
  // only (WCI3) — rarity at the start, the owned count when the host knows it.
  const requirementRole = model.cardKind ? 'support' : model.requirement.startsWith('Requires ') ? 'requirement' : 'tag';
  const band = metadataFooter({ rarity: model.rarity, owned });
  const metaSlot = (slot, entry) => (!entry ? '' : entry.kind === 'rarity'
    ? `<span data-meta-slot="${slot}" data-meta-kind="rarity" ${tip(entry.value, `Rarity: ${entry.value}.`)}>${esc(entry.value)}</span>`
    : `<span data-meta-slot="${slot}" data-meta-kind="owned">${esc(t('card.meta.owned', { count: entry.value }))}</span>`);
  // Rows past the face budget (wireframeUi.possession) stay on the card,
  // hidden, so the inspection still lists every one of them.
  const face = variant?.face || { lines: Infinity, effects: Infinity };
  const rowsAttr = ids => (ids?.length ? ` data-wireframe-rows="${esc(ids.join(' '))}"` : '');
  const requirement = variant?.requirement || model.requirement;
  const facts = variant?.lines
    ? `<span class="epc-facts" data-layout="lines"${rowsAttr(variant.regions.facts)}>${variant.lines.map((row, index) => `<span class="epc-line" data-wireframe-row="${esc(row.id)}"${row.tint ? ` style="--line-tint:${esc(row.tint)}"` : ''}${index >= face.lines ? ' hidden' : ''} ${tip(row.text, row.explanation, 'effect')}>${esc(row.text)}</span>`).join('')}</span>`
    : `<span class="epc-facts"${rowsAttr(variant?.regions.facts)}>${model.facts.map(f => `<span class="epc-fact" ${tip(model.cardKind ? f.value : `${f.label}: ${f.value}`, f.explanation, model.cardKind ? 'tag' : 'fact')}><strong>${esc(f.value)}</strong>${esc(f.label)}</span>`).join('')}</span>`;
  const entries = variant?.entries || model.bonuses;
  const effectsAttrs = variant ? `${rowsAttr(variant.regions.effects)} data-entries="${Math.min(entries.length, face.effects) > 1 ? 'many' : 'one'}"${entries.length > face.effects ? ' data-more' : ''}` : '';
  const effects = entries.map((b, index) => `<span class="epc-bonus"${index >= face.effects ? ' hidden' : ''} ${tip(b.label, b.explanation, 'effect')}>${esc(b.label)}</span>`).join('')
    || `<span>${esc(variant?.empty || 'No additional bonuses')}</span>`;
  card.innerHTML = `<span class="epc-frame">
    <span class="epc-name ec-name" style="--title-units:${Math.max(1, Array.from(String(model.name)).length * 0.62)}">${esc(model.name)}<span aria-hidden="true">◆</span></span>
    <span class="epc-art">${presentation && !model.art ? `<span class="epc-art-glyph" aria-hidden="true">${esc(model.glyph || piece.icon || '◆')}</span>` : `<img${imageHintAttrs({ offscreen: true })} src="${esc(presentation ? model.art : equipmentCardArt(piece))}" alt="${esc(model.name)}">`}</span>
    <span class="epc-type"${rowsAttr(variant?.regions.type)}><span ${tip(model.armor ? model.type : model.type.split(' · ')[0], model.typeExplanation)}>${esc(model.type)}</span><span class="epc-requirement" ${tip(requirement, model.requirementExplanation, requirementRole)}>${esc(requirement)}</span></span>
    ${facts}
    <span class="epc-tags ec-tags">${model.tags.map(t => `<span class="epc-tag" ${tip(t.label, t.explanation)}>${esc(t.label)}</span>`).join('')}</span>
    <span class="epc-effects ec-mods"${effectsAttrs}><span class="epc-heading">${esc(variant?.heading || model.effectsLabel || 'Equipment bonuses')}</span>${effects}</span>
    <span class="epc-flavor" ${tip(model.flavor, model.flavor, 'flavor')}>${esc(model.flavor)}</span>
    <span class="epc-footer" data-identity-part="metadata">${metaSlot('start', band.start)}${metaSlot('end', band.end)}</span>
  </span>`;
  card.querySelector('img')?.addEventListener('error', event => event.target.replaceWith(document.createTextNode(piece.icon || '◆')));
  {
    card.querySelectorAll('[data-card-tip]').forEach(target => {
      const { label, explanation } = explanations[Number(target.dataset.cardTip)];
      const html = () => label === explanation ? `<p>${esc(label)}</p>` : `<div class="tt-title">${esc(label)}</div><p>${esc(explanation)}</p>`;
      attachTooltip(target, html);

    });
    // Keep explanation gestures out of the containing equipment hold action.
    if (interactive) for (const type of ['pointerdown', 'touchstart', 'click', 'keydown']) card.addEventListener(type, event => event.stopPropagation());
  }
  if (inspection) bindCardInspection(card, { title: model.name, readOnly: interactive,
    open: opener => {
      // The modal's copy is an INSPECT card whatever level its opener was —
      // that is the whole point of opening it.
      const face = renderEquipmentCard(registries, piece, { interactive: false, presentation, inspection: false, level: 'inspect' }).card;
      return openCardInspection({ title: model.name, card: face, details: equipmentDetails(explanations), opener });
    } });
  return { card, explanations, model };
}

/** Full effect text and decision values; general definitions live behind tags. */
export function equipmentDetails(explanations) {
  const details = document.createElement('div');
  details.className = 'equipment-poker-explanations';
  const tags = document.createElement('div'); tags.className = 'inspection-tags'; tags.setAttribute('aria-label', 'Card tags');
  const seen = new Set();
  for (const entry of explanations.filter(e => e.role === 'tag')) {
    if (!entry.label || seen.has(entry.label.toLowerCase())) continue;
    seen.add(entry.label.toLowerCase()); tags.append(inspectionTag(entry.label[0].toUpperCase() + entry.label.slice(1), entry.explanation));
  }
  const facts = explanations.filter(e => e.role === 'fact');
  if (facts.length) {
    const values = document.createElement('div'); values.className = 'inspection-facts';
    for (const fact of facts) values.append(inspectionTag(fact.label, fact.explanation));
    details.append(values);
  }
  for (const effect of explanations.filter(e => e.role === 'effect' || e.role === 'requirement')) {
    const p = document.createElement('p'); p.className = effect.role === 'effect' ? 'inspection-effect' : 'inspection-requirement';
    p.textContent = effect.label;
    details.append(p);
  }
  details.append(tags);
  const lore = explanations.find(entry => entry.role === 'flavor' && entry.label);
  if (lore) {
    const disclosure = document.createElement('details'); disclosure.className = 'inspection-lore';
    const summary = document.createElement('summary'); summary.textContent = 'Flavor'; summary.tabIndex = 0;
    const text = document.createElement('p'); text.textContent = lore.label;
    disclosure.append(summary, text); details.append(disclosure);
  }
  return decorateKeywords(details);
}

// THE READING DOOR'S LEVEL IS NOT THE CALLER'S TO SET. `level` sat BEFORE the
// spread, so any caller passing one through `options` overrode it — and
// `collectibleCard.js` forwards `{ ...options }` verbatim, so a glance or focus
// level reached this door by simply being handed down. That reintroduces the
// exact defect this work closes: a card inspected at browsing size, its text
// cut. The level is pinned after the spread; everything else a caller sends
// still gets through. (Copilot review, #1127.)
export function renderEquipmentInspection(registries, piece, options = {}) {
  const { card, explanations } = renderEquipmentCard(registries, piece, { ...options, level: 'inspect', inspection: false });
  const wrap = cardInspectionLayout(card, equipmentDetails(explanations));
  wrap.classList.add('equipment-poker-inspection');
  return wrap;
}
