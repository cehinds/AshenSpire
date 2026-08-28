// src/model/armouryUi.js — pure Armoury presentation configuration.
//
// Heights are fractions of the viewport, not pixels. The authored JSON owns the
// defaults, bounds, snap points, and component vocabulary; this module only
// normalises those values so the DOM and the tests use the same arithmetic.

function finite(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

/** Return one independent region's authored height policy. */
export function armouryRegionConfig(ui, regionId) {
  const row = ui && ui.drawer && ui.drawer.regions && ui.drawer.regions[regionId];
  if (!row || typeof row !== 'object') {
    throw new Error(`Unknown Armoury drawer region '${regionId}'`);
  }
  const min = Math.max(0, finite(row.min, 0));
  const max = Math.max(min, finite(row.max, min));
  const def = Math.min(max, Math.max(min, finite(row.default, min)));
  const snap = [...new Set((Array.isArray(row.snap) ? row.snap : [])
    .map((value) => finite(value, NaN))
    .filter((value) => Number.isFinite(value) && value >= min && value <= max))]
    .sort((a, b) => a - b);
  return Object.freeze({
    min,
    max,
    default: def,
    snap,
    snapThreshold: Math.max(0, finite(row.snapThreshold, 0)),
    keyboardStep: Math.max(0, finite(row.keyboardStep, 0)),
  });
}

/** Clamp a stored or dragged fraction to the region's authored range. */
export function normalizeArmouryHeight(ui, regionId, value) {
  const cfg = armouryRegionConfig(ui, regionId);
  const n = finite(value, cfg.default);
  return Math.min(cfg.max, Math.max(cfg.min, n));
}

/** Snap only inside the authored threshold; otherwise preserve the drag value. */
export function snapArmouryHeight(ui, regionId, value) {
  const cfg = armouryRegionConfig(ui, regionId);
  const clamped = normalizeArmouryHeight(ui, regionId, value);
  if (!cfg.snap.length || cfg.snapThreshold <= 0) return clamped;
  let nearest = cfg.snap[0];
  for (const point of cfg.snap) {
    if (Math.abs(point - clamped) < Math.abs(nearest - clamped)) nearest = point;
  }
  return Math.abs(nearest - clamped) <= cfg.snapThreshold ? nearest : clamped;
}

/** Stable component id lookup; labels/selectors stay in the authored registry. */
export function armouryComponentId(ui, key) {
  const row = ui && ui.assetComponents && ui.assetComponents[key];
  return row && typeof row.id === 'string' && row.id ? row.id : `armoury.${key}`;
}

