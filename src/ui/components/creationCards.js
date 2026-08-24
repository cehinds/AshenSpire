// Reusable character-creation cards. The live screen and dev catalogue both
// call these renderers, so a specimen is the production component rather than
// a look-alike maintained beside it.

import { attachTooltip } from './tooltip.js';

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

export function primaryStatCard(row) {
  const card = document.createElement('div');
  card.className = 'disc-face cc-primary-stat';
  card.dataset.stat = row.id;
  const name = document.createElement('b');
  name.className = 'disc-name';
  name.textContent = row.shortLabel;
  const value = document.createElement('span');
  value.className = 'disc-value';
  value.textContent = row.value;
  card.append(name, value);
  return card;
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
  return strip;
}

export function modeChoiceButton(mode, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt se-mode', selected, text: mode.label,
    label: `${mode.label} attributes`, onChoose,
  });
  button.dataset.modeId = mode.id;
  button.dataset.creationMode = mode.id;
  return button;
}

export function spriteChoiceButton(style, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt style', selected, text: style.name,
    label: `${style.name} sprite`, onChoose,
  });
  button.dataset.spriteStyle = style.id;
  return button;
}

export function tintChoiceButton(tint, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt tint', selected, text: '', label: tint.name, onChoose,
  });
  button.dataset.tintId = tint.id;
  button.style.background = tint.css;
  button.title = tint.name;
  attachTooltip(button, () => tint.name);
  return button;
}

export function sigilChoiceButton(glyph, selected, onChoose) {
  const button = choiceButton({
    className: 'cz-opt sigil', selected, text: glyph,
    label: `Sigil ${glyph}`, onChoose,
  });
  button.dataset.sigil = glyph;
  return button;
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
  return button;
}
