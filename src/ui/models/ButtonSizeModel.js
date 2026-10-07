import { wireframeUi } from '../../content/wireframeUi.js';

// WCB0 button sizes: one pure, DOM-free plan. A size ID names width × height;
// a group names who owns the action region and how siblings divide it. Button
// width is a named preset, never the length of its label.
//
// UNITS. Percentages are of the owning region's content box (they equal vw only
// when that region is the viewport). Heights, gaps and minimums are reference
// rems: at least 16 physical px each, the unit the hand and footer plans use
// (components/combatLayout.js: max(16 / zoom, root font size)). kit.css paints
// the same arithmetic from the tokens below; resolveButtonGroupWidths() is the
// tested statement of it.

export const BUTTON_GROUP_KINDS = Object.freeze(['footer', 'choice']);

export function buttonSizeIds(config = wireframeUi.buttons) {
  return Object.freeze(config.sizeWidths.flatMap((width) =>
    Object.keys(config.heightMultipliers).map((height) => `${width}-${height}`)));
}

export const BUTTON_SIZE_IDS = buttonSizeIds();

/** 'half-tall' → { width: 'half', height: 'tall', widthPercent: 50, heightRem: 4.125 }. */
export function resolveButtonSize(id, config = wireframeUi.buttons) {
  const parts = String(id).split('-');
  const [width, height] = parts;
  if (parts.length !== 2 || !config.sizeWidths.includes(width) || !Object.hasOwn(config.presets, width)
      || !Object.hasOwn(config.heightMultipliers, height)) {
    throw new Error(`Unknown button size '${id}'`);
  }
  return Object.freeze({
    id: `${width}-${height}`, width, height,
    widthPercent: config.presets[width],
    heightRem: config.standardHeightRem * config.heightMultipliers[height],
  });
}

/**
 * planButtonGroup({ kind, count, size }) → the discrete plan a host stamps.
 *   footer  siblings take equal shares of the region after gaps; a sole
 *           action fills it. Each button is `full` of its share.
 *   choice  siblings share ONE size (default: the configured choice preset at
 *           standard height), capped by the equal share; a sole choice keeps
 *           its preset but not below the readable minimum.
 */
export function planButtonGroup({ kind, count, size = null } = {}, config = wireframeUi.buttons) {
  if (!BUTTON_GROUP_KINDS.includes(kind)) throw new Error(`Unknown button group '${kind}'`);
  if (!Number.isInteger(count) || count < 0) throw new Error(`Button group count must be a whole number, got '${count}'`);
  if (kind === 'footer') {
    if (config.footer !== 'equalSharesAfterGaps') throw new Error(`Unknown footer rule '${config.footer}'`);
    if (size != null) throw new Error('Footer buttons take equal shares; they do not accept a size');
    const resolved = resolveButtonSize(`${config.singleFooter}-standard`, config);
    return Object.freeze({
      kind, count, size: resolved.id, preset: resolved.width,
      layout: count === 0 ? 'empty' : count === 1 ? 'fill' : 'equal-shares',
    });
  }
  const resolved = resolveButtonSize(size ?? `${config.choice}-standard`, config);
  return Object.freeze({ kind, count, size: resolved.id, preset: resolved.width, layout: 'preset' });
}

/** The plan in CSS px for a measured host: what kit.css renders. `rem` is one reference rem in local px. */
export function resolveButtonGroupWidths({ kind, count, size = null, hostWidth, rem = 16 } = {}, config = wireframeUi.buttons) {
  const plan = planButtonGroup({ kind, count, size }, config);
  const resolved = resolveButtonSize(plan.size, config);
  const host = Math.max(0, hostWidth);
  const gap = config.gapRem * rem;
  const share = count > 0 ? Math.max(0, host - gap * (count - 1)) / count : 0;
  let width = 0;
  if (kind === 'footer') {
    width = count === 1 ? host : share;
  } else if (count > 0) {
    const requested = host * resolved.widthPercent / 100;
    width = count === 1
      ? Math.max(Math.min(requested, host), Math.min(config.minimumReadableRem * rem, host))
      : Math.min(requested, share);
  }
  return Object.freeze({
    ...plan, gap, width, height: resolved.heightRem * rem,
    groupWidth: count > 0 ? width * count + gap * (count - 1) : 0,
  });
}

/** The custom properties kit.css reads, as strings. Only consumed values are emitted. */
export function buttonSizeTokens(config = wireframeUi.buttons) {
  const tokens = { '--button-standard-rem': String(config.standardHeightRem) };
  for (const [height, multiplier] of Object.entries(config.heightMultipliers)) tokens[`--button-height-${height}`] = String(multiplier);
  for (const width of config.sizeWidths) tokens[`--button-${width}`] = `${config.presets[width]}%`;
  tokens['--button-minimum-rem'] = String(config.minimumReadableRem);
  tokens['--button-gap-rem'] = String(config.gapRem);
  return Object.freeze(tokens);
}
