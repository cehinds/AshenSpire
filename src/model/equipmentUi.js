// src/model/equipmentUi.js — validation and resolution for Armoury UI data.
//
// The authored source is content/source/armouryUi.json. The UI asks this module
// whether the equipped badge uses its custom colour; it never reads a raw JSON
// field and invents its own fallback. `null` means "use the current motif".

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

export function armouryUiProblems(config) {
  const problems = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return [{ path: 'equipment.armouryUi', message: 'must be an object' }];
  }
  for (const key of Object.keys(config)) {
    if (!['equippedTag', 'drawer', 'assetComponents'].includes(key)) {
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

  const drawer = config.drawer;
  if (!drawer || typeof drawer !== 'object' || Array.isArray(drawer)) {
    problems.push({ path: 'equipment.armouryUi.drawer', message: 'must be an object' });
  } else {
    for (const key of Object.keys(drawer)) {
      if (!['resize', 'regions'].includes(key)) {
        problems.push({ path: `equipment.armouryUi.drawer.${key}`, message: 'Unknown field' });
      }
    }
    const resize = drawer.resize;
    if (!resize || typeof resize !== 'object' || Array.isArray(resize)) {
      problems.push({ path: 'equipment.armouryUi.drawer.resize', message: 'must be an object' });
    } else {
      for (const key of Object.keys(resize)) {
        if (!['enabled', 'orientation'].includes(key)) {
          problems.push({ path: `equipment.armouryUi.drawer.resize.${key}`, message: 'Unknown field' });
        }
      }
      if (typeof resize.enabled !== 'boolean') {
        problems.push({ path: 'equipment.armouryUi.drawer.resize.enabled', message: 'must be true or false' });
      }
      if (resize.orientation !== 'vertical') {
        problems.push({ path: 'equipment.armouryUi.drawer.resize.orientation', message: "must be 'vertical'" });
      }
    }
    const regions = drawer.regions;
    if (!regions || typeof regions !== 'object' || Array.isArray(regions)) {
      problems.push({ path: 'equipment.armouryUi.drawer.regions', message: 'must be an object' });
    } else {
      for (const key of Object.keys(regions)) {
        if (!['inventory', 'cards'].includes(key)) {
          problems.push({ path: `equipment.armouryUi.drawer.regions.${key}`, message: 'Unknown region' });
          continue;
        }
        const row = regions[key];
        const path = `equipment.armouryUi.drawer.regions.${key}`;
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
          problems.push({ path, message: 'must be an object' });
          continue;
        }
        for (const field of Object.keys(row)) {
          if (!['default', 'min', 'max', 'snap', 'snapThreshold', 'keyboardStep'].includes(field)) {
            problems.push({ path: `${path}.${field}`, message: 'Unknown field' });
          }
        }
        for (const field of ['default', 'min', 'max', 'snapThreshold', 'keyboardStep']) {
          if (!Number.isFinite(Number(row[field]))) problems.push({ path: `${path}.${field}`, message: 'must be a number' });
        }
        if (!Array.isArray(row.snap) || row.snap.some((value) => !Number.isFinite(Number(value)))) {
          problems.push({ path: `${path}.snap`, message: 'must be an array of numbers' });
        }
        if (Number(row.min) < 0 || Number(row.max) < Number(row.min) || Number(row.default) < Number(row.min) || Number(row.default) > Number(row.max)) {
          problems.push({ path, message: 'default/min/max range is invalid' });
        }
      }
    }
  }

  const components = config.assetComponents;
  if (!components || typeof components !== 'object' || Array.isArray(components)) {
    problems.push({ path: 'equipment.armouryUi.assetComponents', message: 'must be an object' });
  } else {
    for (const [key, row] of Object.entries(components)) {
      const path = `equipment.armouryUi.assetComponents.${key}`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        problems.push({ path, message: 'must be an object' });
        continue;
      }
      for (const field of Object.keys(row)) {
        if (!['id', 'label', 'selector'].includes(field)) {
          problems.push({ path: `${path}.${field}`, message: 'Unknown field' });
        }
      }
      for (const field of ['id', 'label', 'selector']) {
        if (typeof row[field] !== 'string' || !row[field].trim()) {
          problems.push({ path: `${path}.${field}`, message: 'must be a non-empty string' });
        }
      }
    }
  }
  return problems;
}

/** A custom CSS colour, or null when the equipped tag follows the motif. */
export function equippedTagColor(config) {
  if (armouryUiProblems(config).length) return null;
  return config.equippedTag.useCustomColor ? config.equippedTag.customColor : null;
}
