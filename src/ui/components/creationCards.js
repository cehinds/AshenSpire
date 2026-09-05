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
 * The attribute face: a Row (LabelStack label + summary, StatusText value)
 * inside the D26 fold face, so the reveal (sense, derived lines) opens under
 * it by the one fold renderer. `.disc-summary` rides on the hint for the
 * instruments that read the folded summary.
 */
export function primaryStatCard(input) {
  const host = el('div', { class: 'cc-attribute-card as-row-fold' });
  host.dataset.stat = input.id;
  const face = row({
    tag: 'span',
    labelNode: labelStack({ label: input.reveal?.title || input.face.label, hint: input.face.summary || '' }),
    status: input.face.value === '' || input.face.value == null ? '' : String(input.face.value),
  });
  face.querySelector('.ls-hint')?.classList.add('disc-summary');
  const model = { ...input, face: { ...input.face, node: face } };
  mountDisclosure(host, [model]);
  host.querySelector('.disc-face')?.classList.add('cc-primary-stat');
  return markUiComponent(host, UI.primaryStatCard);
}

/** The derived resources: a StatStrip of Chips, each with its formula as its tooltip. */
export function resourceStrip(rows, poise) {
  const chips = rows.map((entry) => {
    const item = chip({ key: entry.faceLabel, value: entry.value, attrs: { dataset: { stat: entry.id, formula: entry.formula } } });
    attachTooltip(item, () => esc(entry.formula));
    return item;
  });
  chips.push(chip({ key: 'Poise', value: poise.value, attrs: { dataset: { stat: 'poise' } } }));
  const strip = statStrip(chips, { class: 'cc-derived', 'aria-label': 'Derived resources' });
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

/** A boolean setting: Row·setting with a LabelStack and a Toggle. */
export function booleanSettingToggle(label, value, onChoose) {
  const control = toggle({ on: value, className: 'cc-switch', attrs: { 'aria-label': label } });
  control.addEventListener('click', () => onChoose?.(!value));
  const wrapper = row({ tag: 'div', setting: true, labelNode: labelStack({ label }), trail: control, className: 'cc-boolean-setting' });
  return markUiComponent(wrapper, UI.booleanSettingToggle);
}

/** A class: an OptionCard — Glyph, Title·S, prose, and a StatePill when it is still locked. */
export function classChoiceCard(cls, { selected = false, locked = false, visual = null, onChoose = null } = {}) {
  const card = optionCard({
    name: cls.name,
    description: cls.description || '',
    badge: locked && cls.milestone ? pill({ label: `Arrives in ${cls.milestone}` }) : null,
    selected, disabled: locked, tag: locked ? 'div' : 'button',
    className: `class-pick cz-class${selected ? ' chosen' : ''}${locked ? ' locked' : ''}`,
    attrs: { dataset: { class: cls.id } },
  });
  card.prepend(el('span', { class: 'og', 'aria-hidden': 'true' }, visualNode(visual)));
  if (!locked && onChoose) card.addEventListener('click', onChoose);
  return markUiComponent(card, UI.classChoiceCard, locked ? 'locked' : 'available');
}

/** The class preview: a Pane — Eyebrow, Title·M, the figure in an ArtWell, the resources, the relic. */
export function classPreviewPane({ cls, sprite = null, resources = null, relic = null, relicDescription = '' }) {
  const art = artWell({ glyph: '', attrs: { class: 'figure cc-class-art' } });
  art.removeAttribute('aria-hidden');
  if (sprite) art.appendChild(sprite);
  const pane = el('article', { class: 'as-pane cc-class-preview', 'aria-label': `${cls.name} class preview` }, [
    eyebrow('Class preview'),
    titleM(cls.name, { tag: 'h3' }),
    hairline(),
    el('div', { class: 'as-stack' }, [
      art,
      el('div', { class: 'as-stack tight' }, [
        eyebrow('Starting resources'),
        resources,
      ]),
      el('div', { class: 'as-stack tight' }, [
        eyebrow('Class relic'),
        relic ? optionCard({
          glyph: relic.icon || '◆', name: relic.name, description: relicDescription,
          arrow: false, tag: 'div', className: 'cc-class-relic',
        }) : null,
      ]),
    ]),
  ]);
  return markUiComponent(pane, UI.classPreviewPane);
}

/** The five starting resources: a StatStrip of Chips. */
export function classResourceGrid(rows) {
  const strip = statStrip(rows.map((entry) => chip({
    key: entry.faceLabel || entry.label, value: entry.value,
    attrs: { class: 'cc-class-resource', dataset: { stat: entry.id } },
  })), { class: 'cc-class-resource-grid', 'aria-label': 'Starting resources' });
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
  const button = optionCard({
    glyph: keepsake.icon, name: keepsake.name, description: keepsake.desc, selected, arrow: false,
    className: `cz-keepsake${selected ? ' chosen' : ''}`,
    attrs: { dataset: { keepsakeId: keepsake.id }, 'aria-label': `${keepsake.name}. ${keepsake.desc}` },
  });
  if (onChoose) button.addEventListener('click', onChoose);
  return markUiComponent(button, UI.keepsakeChoice);
}

/** A starting relic: an OptionCard. */
export function relicChoiceButton(relic, description, selected, onChoose) {
  const button = optionCard({
    glyph: relic.icon || '◆', name: relic.name, description, selected, arrow: false,
    className: `cc-relic-card${selected ? ' chosen' : ''}`,
    attrs: { dataset: { relicId: relic.id }, 'aria-label': `${relic.name}. ${description}` },
  });
  if (onChoose) button.addEventListener('click', onChoose);
  return markUiComponent(button, UI.relicChoiceCard);
}
