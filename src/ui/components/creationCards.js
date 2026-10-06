// Reusable character-creation cards, composed from the kit and nothing else.
// The live screen and the dev catalogue both call these renderers, so a
// specimen is the production component rather than a look-alike maintained
// beside it.
//
// EVERY PIECE IS A KIT PIECE. A class is an OptionCard, a keepsake and a relic
// are OptionCards, a sprite style or a creation mode is one button of a
// Segmented, a sigil or a tint is a Swatch, the derived resources are a
// StatStrip of Chips, the class preview is a Pane, and a primary stat is the
// D26 fold face carrying a kit Row (LabelStack + StatusText). The class names
// the tools read (`class-pick`, `cz-opt`, `cz-keepsake`, `cc-primary-stat`,
// `cc-class-resource`, `cc-switch`, `data-view-mode`…) ride on the kit
// elements as hooks and draw nothing of their own.

import { attachTooltip, esc } from './tooltip.js';
import { t } from '../strings.js';
import { relicIcon } from '../assets.js';
import { keepsakeArtAsset } from '../../content/keepsakeArt.js';
import { assetUrl } from '../assetmap.js';
import { swapOnError } from '../artFallback.js';
import { mountDisclosure } from './disclosure.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import {
  el, eyebrow, titleM, hairline, artWell, optionCard, statStrip, chip, segmented, toggle,
  row, labelStack, pill,
} from '../kit/index.js';

function visualNode(visual) {
  if (visual == null || visual === '') return null;
  return visual instanceof Node ? visual : String(visual);
}

/** A pressable choice: aria-pressed says which one is chosen; `.chosen` rides along for the pad cursor. */
function pressable(node, selected, onChoose) {
  node.setAttribute('aria-pressed', selected ? 'true' : 'false');
  node.classList.toggle('chosen', !!selected);
  if (onChoose) node.addEventListener('click', onChoose);
  return node;
}

/** One button of a Segmented: the kit's own `.on` + aria-pressed grammar. */
function segmentButton({ label, ariaLabel, selected, className, dataset, onChoose }) {
  const node = el('button', {
    type: 'button', class: `${className}${selected ? ' on' : ''}`,
    'aria-label': ariaLabel || null, dataset, text: label,
  });
  return pressable(node, selected, onChoose);
}

/**
 * The attribute face: a compact Row (label + summary + current value)
 * inside a semantic details/summary fold, so the reveal (long name, sense,
 * derived lines) remains structurally attached to its own face. The
 * label includes the attribute name and abbreviation so players can read
 * the bonus without having to decode the stat acronym.
 * `.disc-summary` rides on the hint for the instruments that read the folded
 * summary.
 */
function renderPrimaryStatCard(input, peers = null) {
  const host = el('div', { class: 'cc-attribute-card as-row-fold' });
  host.dataset.stat = input.id;
  const face = row({
    tag: 'span', className: 'face-lite',
    labelNode: labelStack({ label: input.reveal?.title ? `${input.reveal.title} (${input.face.label})` : input.face.label,
      hint: input.face.mainSummary || input.face.summary || '' }),
    status: input.face.value === '' || input.face.value == null ? '' : String(input.face.value),
  });
  face.querySelector('.ls-hint')?.classList.add('disc-summary');
  const model = { ...input, face: { ...input.face, node: face } };
  const fold = mountDisclosure(host, [model], { structure: 'details' });
  const control = host.querySelector('.disc-face');
  control?.classList.add('cc-primary-stat');
  if (peers && control) {
    const member = { control, fold };
    peers.push(member);
    // mountDisclosure's click listener runs first. Once this face is open,
    // close every peer renderer in the primary-stat family. Allocation rows
    // remain separate DOM rows so their steppers never become buttons nested
    // inside buttons, while the family still has one visible reveal.
    control.addEventListener('click', () => {
      if (control.getAttribute('aria-expanded') !== 'true') return;
      for (const peer of peers) {
        if (peer !== member) peer.fold.close();
      }
    });
  }
  return markUiComponent(host, UI.primaryStatCard);
}

/** A primary-stat family: uniform cards with one reveal open at a time. */
export function primaryStatCards(inputs) {
  const peers = [];
  return [...(inputs || [])].map((input) => renderPrimaryStatCard(input, peers));
}

/** A standalone specimen remains useful in the component catalogue. */
export function primaryStatCard(input) {
  return renderPrimaryStatCard(input);
}

/**
 * The derived resources: a StatStrip of Chips, each with its formula as its
 * tooltip.
 *
 * ONE POISE CHIP, AND IT IS THE WHOLE THRESHOLD. Since ruleset 5 the
 * projection carries a `poise` row of its own — the Constitution term alone —
 * while the chip this strip appends is the RECEIPT: Constitution, body armour
 * and relics. Drawing both stood two chips labelled Poise side by side with
 * different numbers, both writing `data-stat="poise"`. The drop lives HERE
 * rather than at each caller because the second chip is this component's own
 * doing, and three callers filtering by hand is three chances to forget
 * (review, #1217).
 */
export function resourceStrip(rows, poise, { compact = false } = {}) {
  const entries = new Map(rows.map((entry) => [entry.id, entry]));
  entries.set('poise', { id: 'poise', value: poise.value, formula: poise.note || '' });
  if (poise.ratings) for (const id of ['ward', 'ar', 'dr', 'pr']) {
    entries.set(id, { ...entries.get(id), id, value: poise.ratings[id],
      formula: `${id.toUpperCase()} ${poise.ratings[id]} · Includes attributes and equipment.` });
  }
  const labels = { hp: 'HP', stamina: 'SP', mana: 'MP', ar: 'AR', pr: 'PR', dr: 'DR', poise: 'Poise', ward: 'Ward', handSize: 'Hand Size', draw: 'Draw', openingHand: 'Opening Hand' };
  const groups = [['hp', 'stamina', 'mana'], ['ar', 'pr'], ['dr', 'poise', 'ward'], ['handSize', 'draw'], ['openingHand']];
  const known = new Set(groups.flat());
  if (compact) {
    groups.pop();
    labels.handSize = t('statsPreview.hand.title');
    const capacity = entries.get('handSize');
    if (capacity) entries.set('handSize', { ...capacity,
      formula: [capacity.formula, entries.get('openingHand')?.formula].filter(Boolean).join(' · ') });
  }
  const extra = [...entries.keys()].filter((id) => !known.has(id) && !['energy', 'attackRating', 'guardRating'].includes(id));
  if (extra.length) groups.push(extra);
  const lines = groups.map((ids) => {
    const chips = ids.filter((id) => entries.has(id)).map((id) => {
      const entry = entries.get(id);
      const item = chip({ key: labels[id] || entry.faceLabel, value: entry.value,
        attrs: { dataset: { stat: id, formula: entry.formula || '' } } });
      if (entry.formula) attachTooltip(item, () => esc(entry.formula));
      return item;
    });
    return chips.length ? el('span', { class: 'cc-resource-row' }, chips) : null;
  }).filter(Boolean);
  const strip = statStrip(lines, { class: 'cc-derived', 'aria-label': 'Derived resources' });
  return markUiComponent(strip, UI.resourceStrip);
}

/** List / Grid: a Segmented. */
export function viewModeToggle(value, onChoose, label = 'View choices') {
  const group = segmented({
    options: ['list', 'grid'].map((mode) => ({
      label: mode === 'list' ? 'List' : 'Grid', value: mode, pressed: value === mode,
      className: 'cc-view-option',
      attrs: { dataset: { viewMode: mode }, 'aria-label': `${mode === 'list' ? 'List' : 'Grid'} view` },
    })),
    attrs: { class: 'cc-view-toggle', role: 'group', 'aria-label': label },
  });
  for (const button of group.querySelectorAll('button')) {
    button.addEventListener('click', () => onChoose?.(button.dataset.viewMode));
  }
  return markUiComponent(group, UI.viewModeToggle);
}

/**
 * viewModeSwitch(value, onChoose, label) → ONE small button that flips the
 * view: it shows the arrangement a press would give (▦ from a list, ☰ from a
 * grid) so the pane's width goes to the choices, not to a labelled pair
 * (owner, 2026-09-19). `data-view-mode` is the mode a press selects.
 */
export function viewModeSwitch(value, onChoose, label = 'View choices') {
  const next = value === 'grid' ? 'list' : 'grid';
  const name = t(`creation.view.${next}`);
  const control = el('button', {
    type: 'button', class: 'as-btn small cc-view-switch', text: next === 'grid' ? '\u25a6' : '\u2630',
    dataset: { viewMode: next }, 'aria-label': `${label}: ${name}`, title: name,
  });
  control.addEventListener('click', () => onChoose?.(next));
  return markUiComponent(control, UI.viewModeToggle);
}

/** A boolean setting: Row·setting with a LabelStack and a Toggle. */
export function booleanSettingToggle(label, value, onChoose) {
  const control = toggle({ on: value, className: 'cc-switch', attrs: { 'aria-label': label } });
  control.addEventListener('click', () => onChoose?.(!value));
  const wrapper = row({ tag: 'div', setting: true, labelNode: labelStack({ label }), trail: control, className: 'cc-boolean-setting' });
  return markUiComponent(wrapper, UI.booleanSettingToggle);
}

/** A class: an OptionCard — Glyph, Title·S, prose, and a StatePill when it is still locked. */
export function classChoiceCard(cls, { selected = false, locked = false, expanded = false, visual = null, onChoose = null, hint = null, mastery = null } = {}) {
  const preview = selected && expanded && !locked;
  const card = optionCard({
    name: cls.name,
    description: cls.description,
    meta: mastery || '',
    // A locked card wears the unlock's own hint (plan phase 5c) or, for a
    // class not yet shipped, the milestone it arrives in.
    badge: locked && hint ? pill({ label: hint }) : locked && cls.milestone ? pill({ label: `Arrives in ${cls.milestone}` }) : null,
    selected, disabled: locked, tag: locked ? 'div' : preview ? 'article' : 'button',
    className: `class-pick cz-class${selected ? ' chosen' : ''}${locked ? ' locked' : ''}`,
    attrs: { dataset: { class: cls.id }, ...(preview ? { 'aria-label': `${cls.name}, selected class`, tabindex: '-1' } : {}) },
  });
  card.prepend(el('span', { class: 'og', 'aria-hidden': 'true' }, visualNode(visual)));
  if (!locked && !preview && onChoose) card.addEventListener('click', onChoose);
  return markUiComponent(card, UI.classChoiceCard, locked ? 'locked' : 'available');
}

/** The class preview: a Pane — Eyebrow, Title·M, the figure in an ArtWell, the resources, the relic. */
export function classPreviewPane({ cls, sprite = null, resources = null, relic = null, relicDescription = '', onRelicInspect = null }) {
  const art = artWell({ glyph: '', attrs: { class: 'figure cc-class-art' } });
  art.removeAttribute('aria-hidden');
  if (sprite) art.appendChild(sprite);
  const relicCard = relic ? optionCard({
    glyph: relic.icon || '◆', art: relicIcon(relic), name: relic.name, description: relicDescription,
    arrow: false, tag: onRelicInspect ? 'button' : 'div', className: 'cc-class-relic',
    attrs: onRelicInspect ? { 'aria-haspopup': 'dialog', 'aria-label': `Inspect ${relic.name}` } : {},
  }) : null;
  if (relicCard && onRelicInspect) {
    relicCard.removeAttribute('aria-pressed');
    relicCard.addEventListener('click', () => onRelicInspect(relic, relicCard));
  }
  const pane = el('article', { class: 'as-pane cc-class-preview', 'aria-label': `${cls.name} class preview` }, [
    titleM(cls.name, { tag: 'h3' }),
    el('div', { class: 'as-stack' }, [
      art,
      el('div', { class: 'as-stack tight' }, [
        eyebrow('Starting resources'),
        resources,
      ]),
      el('div', { class: 'as-stack tight' }, relicCard),
    ]),
  ]);
  return markUiComponent(pane, UI.classPreviewPane);
}

/**
 * classUnfold({ cls, sprite, resources, relic }) → what the chosen
 * class card opens to hold (owner, 2026-09-19): the portrait on the left,
 * the summary stats on the right. Appended inside the selected article;
 * its resources and relic may open detail modals without nested buttons.
 */
export function classUnfold({ cls, sprite = null, resources = null, relic = null, visual = null, mastery = '', onRelicInspect = null }) {
  // The selected card is an article so these native detail buttons have no
  // interactive ancestor. Folded class choices remain ordinary buttons.
  if (sprite && sprite.tagName === 'IMG') sprite.alt = '';
  const art = el('span', { class: 'as-artwell figure cc-unfold-art' }, sprite);
  const relicFace = relic ? el(onRelicInspect ? 'button' : 'span', {
    class: `cc-unfold-relic${onRelicInspect ? ' cc-preview-detail-trigger' : ''}`,
    ...(onRelicInspect ? { type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `Inspect ${relic.name}` } : {}),
  }, [el('span', { class: 'cc-unfold-relic-glyph', 'aria-hidden': 'true', text: relic.icon || '◆' }), el('span', { class: 'cc-unfold-relic-name', text: relic.name })]) : null;
  if (relicFace && onRelicInspect) relicFace.addEventListener('click', () => onRelicInspect(relic, relicFace));
  const node = el('span', { class: 'cc-class-unfold', id: `cc-unfold-${cls.id}`, dataset: { class: cls.id } }, [
    el('span', { class: 'cc-unfold-portrait' }, [
      el('span', { class: 'cc-unfold-class-icon', 'aria-hidden': 'true' }, visualNode(visual)),
      art,
    ]),
    el('span', { class: 'cc-unfold-summary' }, [
      el('span', { class: 'cc-unfold-heading', text: cls.name }),
      el('span', { class: 'cc-unfold-description', text: cls.description }),
      mastery ? el('span', { class: 'cc-unfold-mastery', text: mastery }) : null,
      resources,
      relicFace,
    ]),
  ]);
  return markUiComponent(node, UI.classPreviewPane);
}

/** The five starting resources: a StatStrip of Chips. */
export function classResourceGrid(rows, { onInspect = null } = {}) {
  const strip = statStrip(rows.map((entry) => {
    const face = chip({ key: entry.faceLabel || entry.label, value: entry.value });
    const item = onInspect ? el('button', {
      type: 'button', class: 'cc-preview-detail-trigger', 'aria-haspopup': 'dialog',
      'aria-label': `${entry.inspectionLabel || entry.label || entry.faceLabel}: ${entry.value}. View details`,
    }, face) : face;
    item.classList.add('cc-class-resource');
    item.dataset.stat = entry.id;
    if (onInspect) item.addEventListener('click', () => onInspect(entry, item));
    return item;
  }), { class: 'cc-class-resource-grid', 'aria-label': 'Starting resources' });
  return markUiComponent(strip, UI.classResourceGrid);
}

/** A section face: label left, the current choice right — a Row inside the fold face. */
export function selectionSectionFace(label, value, visual = null) {
  const node = row({
    tag: 'span', className: 'cc-selection-face face-lite',
    glyph: visual instanceof Node ? '' : (visual || ''),
    labelNode: labelStack({ label }),
    status: value,
  });
  node.querySelector('.ls-label')?.classList.add('disc-name');
  const receipt = node.querySelector('.as-status');
  receipt?.classList.add('disc-value');
  return {
    node: markUiComponent(node, UI.selectionSectionFace),
    setValue(next) { if (receipt) receipt.textContent = next; },
  };
}

/** Standard / Assign points: one button of a Segmented. */
export function modeChoiceButton(mode, selected, onChoose) {
  const button = segmentButton({
    label: mode.label, ariaLabel: `${mode.label} attributes`, selected,
    className: 'cz-opt se-mode', dataset: { modeId: mode.id, creationMode: mode.id, val: mode.id }, onChoose,
  });
  return markUiComponent(button, UI.modeChoice);
}

/** A sprite style: one button of a Segmented. */
export function spriteChoiceButton(style, selected, onChoose) {
  const button = segmentButton({
    label: style.name, ariaLabel: `${style.name} sprite`, selected,
    className: 'cz-opt style', dataset: { spriteStyle: style.id, val: style.id }, onChoose,
  });
  return markUiComponent(button, UI.spriteChoice);
}

/** A tint: a Swatch showing its colour. */
export function tintChoiceButton(tint, selected, onChoose) {
  const button = el('button', { type: 'button', class: 'as-swatch tint cz-opt', 'aria-label': tint.name, dataset: { tintId: tint.id } });
  button.style.setProperty('--swatch', tint.css);
  attachTooltip(button, () => esc(tint.name));
  return markUiComponent(pressable(button, selected, onChoose), UI.tintChoice);
}

/** A sigil: a Swatch showing its glyph. */
export function sigilChoiceButton(glyph, selected, onChoose) {
  const button = el('button', { type: 'button', class: 'as-swatch sigil cz-opt', 'aria-label': `Sigil ${glyph}`, dataset: { sigil: glyph }, text: glyph });
  return markUiComponent(pressable(button, selected, onChoose), UI.sigilChoice);
}

/** A keepsake: an OptionCard. */
export function keepsakeChoiceButton(keepsake, selected, onChoose) {
  const artPath = keepsakeArtAsset(keepsake);
  const img = artPath ? el('img', { src: assetUrl(artPath), alt: '', width: '48', height: '48' }) : null;
  if (img) swapOnError(img, () => el('span', { text: keepsake.icon }));
  const art = img ? el('span', { class: 'og relic-art', 'aria-hidden': 'true' }, img) : null;
  const button = optionCard({
    glyph: keepsake.icon, art, name: keepsake.name, description: keepsake.desc, selected, arrow: false,
    className: `cz-keepsake${selected ? ' chosen' : ''}`,
    attrs: { dataset: { keepsakeId: keepsake.id }, 'aria-label': `${keepsake.name}. ${keepsake.desc}` },
  });
  if (onChoose) button.addEventListener('click', onChoose);
  return markUiComponent(button, UI.keepsakeChoice);
}

/** A starting relic: an OptionCard. */
export function relicChoiceButton(relic, description, selected, onChoose) {
  const button = optionCard({
    glyph: relic.icon || '◆', art: relicIcon(relic), name: relic.name, description, selected, arrow: false,
    className: `cc-relic-card${selected ? ' chosen' : ''}`,
    attrs: { dataset: { relicId: relic.id }, 'aria-label': `${relic.name}. ${description}` },
  });
  if (onChoose) button.addEventListener('click', onChoose);
  return markUiComponent(button, UI.relicChoiceCard);
}
