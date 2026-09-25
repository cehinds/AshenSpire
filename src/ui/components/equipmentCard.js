import { bindCardInspection, cardInspectionLayout, openCardInspection } from './cardInspection.js';
import { equipmentCardModel, equipmentCardTokens } from '../../model/equipmentCard.js';
import { cardFields, resolveCardLevel } from '../../model/cardFields.js';
import { litCard } from './cardSelection.js';
import { equipmentCardArt } from '../assets.js';
import { imageHintAttrs } from '../imageHints.js';
import { attachTooltip, esc } from './tooltip.js';
import { cardLevelWidthCss } from '../models/CardSizeModel.js';
import { configureTooltipGlossary, decorateKeywords, inspectionTag } from './tooltipGlossary.js';
import { metadataFooter } from '../models/IdentityModel.js';
import { loreLine } from './loreLine.js';
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
  // A level that does not say this at all has no flavour row to describe. The
  // property is cleared rather than left behind at the previous level's number,
  // which would be a stale row height quietly sizing a region that is gone.
  if (tokens.heights.flavor === undefined) card.style.removeProperty('--epc-flavor-row');
  else set('--epc-flavor-row', `${tokens.heights.flavor}px`);
  set('--epc-bonus-lines', String(tokens.bonusMaxLines));
  set('--card-info-inset', `${tokens.info.insetPx}px`);
  set('--card-info-fade', `${tokens.info.fadeMs}ms`);
  set('--card-info-delay', `${selectionRevealDelayMs()}ms`);
  for (const [key, value] of Object.entries(tokens.type)) set(`--epc-text-${key}`, value);
}

/**
 * renderEquipmentCard(registries, piece, opts) → { card, explanations, model }.
 *
 * `opts.level` is the FLOOR of what this face says — the least this surface is
 * willing to show (src/model/cardFields.js). It is one argument on purpose: it
 * drives both which fields appear and how big the card is drawn, so a second
 * level-ish parameter would be two homes for one fact.
 *
 * A SCREEN DOES NOT DECLARE THE LEVEL IT IS AT. The level actually drawn is
 * DERIVED: `cardSelection.js` already owns which card is lit, and a card that
 * is lit rises to `focus` whatever floor it was given. No screen keeps its own
 * copy of "which card is focused" — that copy is precisely what the selection
 * store was extracted to end. A picker's grid/list toggle sets the floor
 * (`levelForView`), which is a view SELECTING a level rather than owning a
 * field set of its own.
 *
 * `opts.surface` names the place in the game this card stands on
 * (services/cardActions.js owns that vocabulary) so the manifest can patch a
 * level there: the creation picker shows rarity while you are choosing, the
 * combat hand does not show it at all.
 */
export function renderEquipmentCard(registries, piece, { interactive = true, presentation = null, inspection = true, owned = null, level = null, surface = 'none', identity: identityOverride = null, run = null } = {}) {
  configureTooltipGlossary(registries);
  // `run`, when there is one, is whose snapshot the scaling grades read
  // (model/equipmentCard.js); creation and previews pass none and read live content.
  const model = presentation || equipmentCardModel(registries, piece, { run });
  // `inspection: false` MEANS "no door on this face", NOT "this face says
  // everything". The two got conflated, and the second reading won: a caller
  // that made an inert face and bound the door to its WRAPPER — the shop's
  // armament shelf does exactly that — had its resting tile drawn at `inspect`,
  // 320px, when the tile is something you are browsing past. customize.js's
  // summary slots were already asking for `glance` explicitly and being
  // overridden by this line.
  //
  // An explicit level now wins. With none, an inert face still defaults to
  // `inspect` (the modal's own face stands IN FOR the door rather than beside
  // it) and a live one to `glance`.
  const floor = level || (inspection === false ? 'inspect' : 'glance');
  // `card.dataset.item` is the identity bindCardInspection lights this card
  // by; asking the store with the same key is what keeps the two facts one.
  // An explicit identity feeds BOTH the lit-card comparison below and the
  // selection binding, so a caller that renames a card cannot leave the two
  // disagreeing about which card is lit. Only the catalogue passes one.
  const identity = identityOverride || model.id;
  // `inspecting` means THIS FACE IS THE ONE IN THE READING DOOR, and it was
  // being fed `inspection === false`, which means something else entirely: that
  // no door is bound to this face. Every inert face on every shelf therefore
  // resolved to `inspect` no matter what floor it asked for — the same
  // conflation as above, one level down, and the reason fixing `floor` alone
  // did not move the shop's tiles. The door's own faces pass `level: 'inspect'`
  // explicitly, so the floor already carries that and nothing is lost.
  // Creation keeps its comparison shelf at glance; the info door still uses inspect.
  const levelNow = () => surface === 'creation' && floor === 'glance' ? 'glance' : resolveCardLevel({ floor, lit: litCard() === identity });
  let drawn = levelNow();
  const tokensFor = (at) => equipmentCardTokens(undefined, {
    collapse: model.tags.length ? [] : ['tags'],
    omit: cardFields(at, { surface }).omit,
  });
  const tokens = tokensFor(drawn);
  const card = canvasElement(tokens.frameWidthPx);
  applyCardTokens(card, tokens);
  card.className = 'equipment-poker-card';
  // ONE `level` ARGUMENT, NOT TWO. `glance | focus | inspect` says both how big
  // this card is (CardSizeModel, below) and which of its fields it shows; a
  // second parameter would let the two drift and put a focus-sized face on an
  // inspect-sized card. The width travels with the card as a custom property so
  // no surface has to write a `max-width` of its own ever again.
  // The width follows the level actually DRAWN, so it is set in `paint` beside
  // the row tokens rather than once here: a card that lights rises to `focus`
  // and must grow with what it now says, or the fields and the frame drift.
  card.dataset.item = model.id;
  // THE DOM AGREES WITH THE SELECTION ABOUT WHICH CARD THIS IS. With an
  // identity override, `data-item` alone would say one thing and the selection
  // store another — and `bindCardInspection`'s fallback chain, if the explicit
  // argument were ever refactored away, would quietly resolve back to the item
  // id and re-couple the faces this override exists to separate.
  // It is written to `data-instance-id`, which that chain already prefers over
  // `data-item`, rather than over `data-item` itself: styles/kit.css and two QA
  // tools select real pieces by `[data-item="..."]`, so that attribute has to
  // keep naming the piece.
  if (identityOverride) card.dataset.instanceId = identityOverride;
  // WC2a1–WC2c3: which rows each region carries, from the item's own data
  // (hand, card package, modifiers, relic modes, potion effects). A bespoke
  // presentation without a variant (the empty hand) keeps the plain face.
  const variant = presentation ? presentation.variant || null
    : possessionVariant(registries, piece, { kind: 'equipment', bonuses: model.bonuses,
      attributeRequirement: model.requirement.startsWith('Requires ') ? model.requirement : null });
  if (variant) card.dataset.possession = variant.families.join(' ');
  card.setAttribute('aria-label', `${model.name} ${model.cardKind || 'equipment'} card`);
  card.style.setProperty('--accent', model.accent);
  // ONE ARRAY, REPAINTED IN PLACE. The door and every caller that asked for a
  // detail pane hold this reference; a paint at a new level refills it rather
  // than replacing it, so nobody is left reading the level before last.
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
  const paint = (at) => {
    explanations.length = 0;
    const visible = new Set(cardFields(at, { surface }).visible);
    const facts = variant?.lines
      ? `<span class="epc-facts" data-layout="lines"${rowsAttr(variant.regions.facts)}>${variant.lines.map((row, index) => `<span class="epc-line" data-wireframe-row="${esc(row.id)}"${row.tint ? ` style="--line-tint:${esc(row.tint)}"` : ''}${index >= face.lines ? ' hidden' : ''} ${tip(row.text, row.explanation, 'effect')}>${esc(row.text)}</span>`).join('')}</span>`
      : `<span class="epc-facts"${rowsAttr(variant?.regions.facts)}>${model.facts.map(f => `<span class="epc-fact"${f.grade ? ` data-grade="${esc(f.value)}"` : ''} ${tip(model.cardKind ? f.value : `${f.label}: ${f.value}`, f.explanation, model.cardKind ? 'tag' : 'fact')}><strong>${esc(f.label === 'DR' && f.value > 0 ? `+${f.value}` : f.value)}</strong>${esc(surface === 'creation' ? ({ Attack: 'AR', Defense: 'DR', Weight: 'Wt' }[f.label] || f.label) : f.label)}</span>`).join('')}</span>`;
    const entries = variant?.entries || model.bonuses;
    const effectsAttrs = variant ? `${rowsAttr(variant.regions.effects)} data-entries="${Math.min(entries.length, face.effects) > 1 ? 'many' : 'one'}"${entries.length > face.effects ? ' data-more' : ''}` : '';
    const effects = entries.map((b, index) => `<span class="epc-bonus"${index >= face.effects ? ' hidden' : ''} ${tip(b.label, b.explanation, 'effect')}>${esc(b.label)}</span>`).join('')
      || `<span>${esc(model.armor ? 'No additional bonuses' : variant?.empty || 'No additional bonuses')}</span>`;
    // A REGION THIS LEVEL DOES NOT SAY IS NOT IN THE MARKUP AT ALL. Not
    // `display:none` and not `hidden`: the row solver has already given its
    // pixels away (equipmentCardTokens' `omit`), so an element left behind would
    // sit in a row that no longer exists — and a screen reader would announce a
    // field the player cannot see. `.epc-name` is the exception by construction:
    // it is absolutely positioned over the art, holds no grid row, and is the
    // title, which shows at every level.
    const region = (key, html) => (visible.has(key) ? html : '');
    // ONLY THE FRAME IS REPLACED. The information button and the chevron are
    // children of the card, not of the frame, and `bindCardInspection` appended
    // them with their own listeners — `card.innerHTML =` would take both away
    // and leave a card that can no longer be read the second time it is lit.
    const frameHtml = `<span class="epc-frame">
      <span class="epc-name ec-name" style="--title-units:${Math.max(1, Array.from(String(model.name)).length * 0.62)}">${esc(model.name)}<span aria-hidden="true">◆</span></span>
      ${region('art', `<span class="epc-art">${presentation && !model.art ? `<span class="epc-art-glyph" aria-hidden="true">${esc(model.glyph || piece.icon || '◆')}</span>` : `<img${imageHintAttrs({ offscreen: true })} src="${esc(presentation ? model.art : equipmentCardArt(piece))}" alt="${esc(model.name)}">`}</span>`)}
      ${region('type', `<span class="epc-type"${rowsAttr(variant?.regions.type)}><span ${tip(model.armor ? model.type : model.type.split(' · ')[0], model.typeExplanation)}>${esc(model.type)}</span><span class="epc-requirement" ${tip(requirement, model.requirementExplanation, requirementRole)}>${esc(requirement)}</span></span>`)}
      ${region('facts', facts)}
      ${region('tags', `<span class="epc-tags ec-tags">${model.tags.map(t => `<span class="epc-tag" ${tip(t.label, t.explanation)}>${esc(t.label)}</span>`).join('')}</span>`)}
      ${region('effects', `<span class="epc-effects ec-mods"${effectsAttrs}><span class="epc-heading">${esc(variant?.heading || model.effectsLabel || 'Equipment bonuses')}</span>${effects}</span>`)}
      ${region('flavor', `<span class="epc-flavor" ${tip(model.flavor, model.flavor, 'flavor')}>${esc(model.flavor)}</span>`)}
      ${region('footer', `<span class="epc-footer" data-identity-part="metadata">${metaSlot('start', band.start)}${metaSlot('end', band.end)}</span>`)}
    </span>`;
    const existing = card.querySelector(':scope > .epc-frame');
    if (existing) existing.outerHTML = frameHtml;
    else card.insertAdjacentHTML('afterbegin', frameHtml);
    card.dataset.level = at;
    applyCardTokens(card, tokensFor(at));
    card.dataset.cardLevel = at;
    card.style.setProperty('--epc-level-w', cardLevelWidthCss(at));
    card.querySelector('img')?.addEventListener('error', event => event.target.replaceWith(document.createTextNode(piece.icon || '◆')));
    card.querySelectorAll('[data-card-tip]').forEach(target => {
      const { label, explanation } = explanations[Number(target.dataset.cardTip)];
      const html = () => label === explanation ? `<p>${esc(label)}</p>` : `<div class="tt-title">${esc(label)}</div><p>${esc(explanation)}</p>`;
      attachTooltip(target, html);
    });
  };
  paint(drawn);
  // Keep explanation gestures out of the containing equipment hold action.
  if (interactive) for (const type of ['pointerdown', 'touchstart', 'click', 'keydown']) card.addEventListener(type, event => event.stopPropagation());
  if (inspection) {
    bindCardInspection(card, { title: model.name, readOnly: interactive, identity,
      open: opener => {
        // THE DOOR READS ITS OWN FACE'S EXPLANATIONS, not this one's. The
        // outer card may be standing at `glance`, where it has not built a tag
        // or flavour explanation at all; the modal's face is at `inspect` and
        // has every one of them. Reading the outer array here is how the door
        // would come to show fewer tags the less the card beside it said.
        const full = renderEquipmentCard(registries, piece, { interactive: false, presentation, inspection: false, surface, run });
        return openCardInspection({ title: model.name, card: full.card, details: equipmentDetails(full.explanations), opener });
      } });
    // EXACTLY THE TWO CARDS WHOSE LEVEL CHANGED, and they tell themselves. A
    // selection lights one card and douses one card; both events are fired on
    // the card they concern (cardInspection.js), so each face repaints itself
    // and nothing walks the document looking for the others. The guard matters
    // as much as the listener: `select()` runs on every tap, including taps on
    // a card that is already lit, and repainting the DOM under a thumb
    // mid-gesture would be a new defect wearing this feature's clothes.
    const restate = () => {
      const next = levelNow();
      if (next === drawn) return;
      drawn = next;
      paint(drawn);
    };
    card.addEventListener('cardinspectionselect', restate);
    card.addEventListener('cardinspectiondouse', restate);
  }
  return { card, explanations, model, level: drawn };
}

/**
 * Full effect text and decision values; general definitions live behind tags.
 *
 * THE TAG BLOCK STAYS, AND THAT IS A DECISION RATHER THAN AN OVERSIGHT.
 *
 * At `inspect` the face itself now carries `.epc-tags`, so the obvious
 * question is whether this pane should stop drawing `.inspection-tags` beside
 * it and keep only the long-form explanations. It should not, because the two
 * are not the same thing wearing one name:
 *
 *   `.epc-tag` on the face is a LABEL — one word, in an 18px row, clipped with
 *   an ellipsis when it does not fit. It says which tags this item has.
 *
 *   `.inspection-tags` is that label's DEFINITION — `inspectionTag(label,
 *   explanation)`, a focusable chip carrying the authored blurb, and the only
 *   place in the game a player can read what "Bleed" actually does.
 *
 * `cardInspectionLayout` already relocates this block out of the text column
 * and up beside the artwork, precisely so it reads as the face's legend rather
 * than as a repeat of it. Dropping it to avoid printing a word twice would
 * cost the reader the sentence and keep the word, at the one level whose whole
 * job is to show everything.
 *
 * Worth saying plainly for the reviewer: this duplication is NOT introduced by
 * the presentation levels. The face drew every region on every surface before
 * they existed, so the face and this pane have always both shown tags at the
 * inspect door. Nothing about what a player sees here changes.
 */
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
  // The identity line, as card inspection shows it (components/loreLine.js).
  const line = lore ? loreLine({ text: lore.label }) : null;
  if (line) details.append(line);
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
