// Reusable character-creation cards. The live screen and dev catalogue both
// call these renderers, so a specimen is the production component rather than
// a look-alike maintained beside it.

import { attachTooltip } from './tooltip.js';
import { mountDisclosure } from './disclosure.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

function appendVisual(host, visual) {
  if (!visual) return;
  if (visual instanceof Node) host.appendChild(visual);
  else host.textContent = String(visual);
}

function choiceButton({ className, selected, label, text, onChoose }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${className}${selected ? ' chosen' : ''}`;
  button.textContent = text;
  button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  if (label) button.setAttribute('aria-label', label);
  if (onChoose) button.addEventListener('click', onChoose);
  return button;
}

export function primaryStatCard(model) {
  const host = document.createElement('div');
  host.className = 'cc-attribute-card';
  host.dataset.stat = model.id;
  mountDisclosure(host, [model]);
  host.querySelector('.disc-face')?.classList.add('cc-primary-stat');
  return markUiComponent(host, UI.primaryStatCard);
}

export function resourceStrip(rows, poise) {
  const strip = document.createElement('div');
  strip.className = 'cc-derived';
  strip.setAttribute('aria-label', 'Derived resources');
  for (const row of rows) {
    const item = document.createElement('span');
    item.dataset.stat = row.id;
    item.dataset.formula = row.formula;
    item.title = row.formula;
    const label = document.createElement('b');
    label.textContent = row.faceLabel;
    item.append(label, ` ${row.value}`);
    strip.appendChild(item);
  }
  const poiseItem = document.createElement('span');
  poiseItem.dataset.stat = 'poise';
  const poiseLabel = document.createElement('b');
  poiseLabel.textContent = 'Poise';
  poiseItem.append(poiseLabel, ` ${poise.value}`);
  strip.appendChild(poiseItem);
  return markUiComponent(strip, UI.resourceStrip);
}

export function viewModeToggle(value, onChoose, label = 'View choices') {
  const group = document.createElement('div');
  group.className = 'cc-view-toggle';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  for (const mode of ['list', 'grid']) {
    const button = choiceButton({
      className: 'cc-view-option', selected: value === mode,
      text: mode === 'list' ? 'List' : 'Grid',
      label: `${mode === 'list' ? 'List' : 'Grid'} view`,
      onChoose: () => onChoose?.(mode),
    });
    button.dataset.viewMode = mode;
    group.appendChild(button);
  }
  return markUiComponent(group, UI.viewModeToggle);
}

export function booleanSettingToggle(label, value, onChoose) {
  const wrapper = document.createElement('label');
  wrapper.className = 'cc-boolean-setting';
  const text = document.createElement('span');
  text.textContent = label;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cc-switch';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-checked', value ? 'true' : 'false');
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => onChoose?.(!value));
  const knob = document.createElement('span');
  knob.className = 'cc-switch-knob';
  button.appendChild(knob);
  wrapper.append(text, button);
  return markUiComponent(wrapper, UI.booleanSettingToggle);
}

export function classChoiceCard(cls, { selected = false, locked = false, visual = null, onChoose = null } = {}) {
  const card = document.createElement(locked ? 'div' : 'button');
  if (!locked) card.type = 'button';
  card.className = `class-pick cz-class${selected ? ' chosen' : ''}${locked ? ' locked' : ''}`;
  card.dataset.class = cls.id;
  if (!locked) card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const icon = document.createElement('div');
  icon.className = 'glyph';
  appendVisual(icon, visual);
  const copy = document.createElement('div');
  copy.className = 'cp-body';
  const title = document.createElement('h3');
  title.textContent = cls.name;
  const description = document.createElement('p');
  description.textContent = cls.description || '';
  copy.append(title, description);
  if (locked && cls.milestone) {
    const milestone = document.createElement('span');
    milestone.className = 'chip';
    milestone.textContent = `ARRIVES IN ${cls.milestone}`;
    copy.appendChild(milestone);
  }
  card.append(icon, copy);
  if (!locked && onChoose) card.addEventListener('click', onChoose);
  return markUiComponent(card, UI.classChoiceCard, locked ? 'locked' : 'available');
}

export function classPreviewPane({ cls, sprite = null, resources = null, relic = null, relicDescription = '' }) {
  const pane = document.createElement('article');
  pane.className = 'cc-class-preview';
  pane.setAttribute('aria-label', `${cls.name} class preview`);
  const eyebrow = document.createElement('p');
  eyebrow.className = 'cc-preview-eyebrow';
  eyebrow.textContent = 'CLASS PREVIEW';
  const title = document.createElement('h3');
  title.textContent = cls.name;
  const art = document.createElement('div');
  art.className = 'cc-class-art';
  appendVisual(art, sprite);
  const resourceHeading = document.createElement('p');
  resourceHeading.className = 'cc-preview-eyebrow';
  resourceHeading.textContent = 'STARTING RESOURCES';
  const resourceHost = document.createElement('div');
  resourceHost.className = 'cc-class-resources';
  if (resources) resourceHost.appendChild(resources);
  const relicHeading = document.createElement('p');
  relicHeading.className = 'cc-preview-eyebrow';
  relicHeading.textContent = 'CLASS RELIC';
  const relicRow = document.createElement('div');
  relicRow.className = 'cc-class-relic';
  if (relic) {
    const icon = document.createElement('span');
    icon.className = 'cc-class-relic-art';
    appendVisual(icon, relic.icon || null);
    const copy = document.createElement('span');
    const name = document.createElement('b');
    name.textContent = relic.name;
    const description = document.createElement('small');
    description.textContent = relicDescription;
    copy.append(name, description);
    relicRow.append(icon, copy);
  }
  pane.append(eyebrow, title, art, resourceHeading, resourceHost, relicHeading, relicRow);
  return markUiComponent(pane, UI.classPreviewPane);
}

export function classResourceGrid(rows) {
  const grid = document.createElement('div');
  grid.className = 'cc-class-resource-grid';
  grid.setAttribute('aria-label', 'Starting resources');
  for (const row of rows) {
    const item = document.createElement('div');
    item.className = 'cc-class-resource';
    item.dataset.stat = row.id;
    const label = document.createElement('span');
    label.textContent = row.faceLabel || row.label;
    const value = document.createElement('b');
    value.textContent = row.value;
    item.append(label, value);
    grid.appendChild(item);
  }
  return markUiComponent(grid, UI.classResourceGrid);
}

export function selectionSectionFace(label, value, visual = null) {
  const node = document.createElement('span');
  node.className = 'cc-selection-face';
  if (visual) {
    const art = document.createElement('span');
    art.className = 'cc-selection-face-art';
    appendVisual(art, visual);
    node.appendChild(art);
  }
  const name = document.createElement('b');
  name.className = 'disc-name';
  name.textContent = label;
  const receipt = document.createElement('span');
  receipt.className = 'disc-value';
  receipt.textContent = value;
  node.append(name, receipt);
  return {
    node: markUiComponent(node, UI.selectionSectionFace),
    setValue(next) { receipt.textContent = next; },
  };
}

export function modeChoiceButton(mode, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt se-mode', selected, text: mode.label,
    label: `${mode.label} attributes`, onChoose,
  });
  button.dataset.modeId = mode.id;
  button.dataset.creationMode = mode.id;
  return markUiComponent(button, UI.modeChoice);
}

export function spriteChoiceButton(style, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt style', selected, text: style.name,
    label: `${style.name} sprite`, onChoose,
  });
  button.dataset.spriteStyle = style.id;
  return markUiComponent(button, UI.spriteChoice);
}

export function tintChoiceButton(tint, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt tint', selected, text: '', label: tint.name, onChoose,
  });
  button.dataset.tintId = tint.id;
  button.style.background = tint.css;
  button.title = tint.name;
  attachTooltip(button, () => tint.name);
  return markUiComponent(button, UI.tintChoice);
}

export function sigilChoiceButton(glyph, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt sigil', selected, text: glyph,
    label: `Sigil ${glyph}`, onChoose,
  });
  button.dataset.sigil = glyph;
  return markUiComponent(button, UI.sigilChoice);
}

export function keepsakeChoiceButton(keepsake, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-keepsake', selected, text: '',
    label: `${keepsake.name}. ${keepsake.desc}`, onChoose,
  });
  button.dataset.keepsakeId = keepsake.id;
  const icon = document.createElement('span');
  icon.className = 'ks-icon';
  icon.textContent = keepsake.icon;
  const copy = document.createElement('span');
  const name = document.createElement('b');
  name.textContent = keepsake.name;
  const description = document.createElement('small');
  description.textContent = keepsake.desc;
  copy.append(name, description);
  button.append(icon, copy);
  return markUiComponent(button, UI.keepsakeChoice);
}

export function relicChoiceButton(relic, description, selected, onChoose) {
  const button = choiceButton({
    className: 'cc-relic-card', selected, text: '',
    label: `${relic.name}. ${description}`, onChoose,
  });
  button.dataset.relicId = relic.id;
  const icon = document.createElement('span');
  icon.className = 'cc-relic-art';
  appendVisual(icon, relic.icon || null);
  const name = document.createElement('b');
  name.textContent = relic.name;
  const copy = document.createElement('small');
  copy.textContent = description;
  button.append(icon, name, copy);
  return markUiComponent(button, UI.relicChoiceCard);
}
