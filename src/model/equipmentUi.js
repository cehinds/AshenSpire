// src/model/equipmentUi.js — validation and resolution for Armoury UI data.
//
// The authored source is content/source/armouryUi.json. The UI asks this module
// whether the equipped badge uses its custom colour; it never reads a raw JSON
// field and invents its own fallback. `null` means "use the current motif".

import { normalizeArmouryLayout } from './armouryLayout.js';

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export function armouryUiProblems(config) {
  const problems = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return [{ path: 'equipment.armouryUi', message: 'must be an object' }];
  }
  for (const key of Object.keys(config)) {
    if (!['equippedTag', 'layout'].includes(key)) {
      problems.push({ path: `equipment.armouryUi.${key}`, message: 'Unknown field' });
    }
  }
  const tag = config.equippedTag;
  if (!tag || typeof tag !== 'object' || Array.isArray(tag)) {
    problems.push({ path: 'equipment.armouryUi.equippedTag', message: 'must be an object' });
    return problems;
  }
  for (const key of Object.keys(tag)) {
    if (!['useCustomColor', 'customColor'].includes(key)) {
      problems.push({ path: `equipment.armouryUi.equippedTag.${key}`, message: 'Unknown field' });
    }
  }
  if (typeof tag.useCustomColor !== 'boolean') {
    problems.push({
      path: 'equipment.armouryUi.equippedTag.useCustomColor',
      message: 'must be true or false',
    });
  }
  if (typeof tag.customColor !== 'string' || !HEX_COLOUR.test(tag.customColor)) {
    problems.push({
      path: 'equipment.armouryUi.equippedTag.customColor',
      message: `must be a six-digit hex colour such as #7FD47F — got ${JSON.stringify(tag.customColor)}`,
    });
  }
  if (config.layout !== undefined) {
    try {
      normalizeArmouryLayout(config.layout);
    } catch (error) {
      problems.push({ path: 'equipment.armouryUi.layout', message: error.message });
    }
  }
  return problems;
}

/** A custom CSS colour, or null when the equipped tag follows the motif. */
export function equippedTagColor(config) {
  if (armouryUiProblems(config).length) return null;
  return config.equippedTag.useCustomColor ? config.equippedTag.customColor : null;
}
