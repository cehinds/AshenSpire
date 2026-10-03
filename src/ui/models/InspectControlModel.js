import { wireframeUi } from '../../content/wireframeUi.js';
import { REFERENCE_REM_CSS } from './SelectionEffectModel.js';

// WCB1 inspect control: one uniform circle on every selectable card,
// combatant and inventory tile. Its target is `sizeRem` reference rems (at
// least 16 physical px each, so 2.75 is 44 physical px) with a `labelPx`
// physical label. It hangs `gapPx` above its owner's top centre (above the
// intent when there is one) and appears after selection.revealDelayMs.

export function inspectControl(config = wireframeUi.inspect) {
  const { sizeRem, labelPx, gapPx } = config || {};
  if (!(Number.isFinite(sizeRem) && sizeRem >= 2.75)) throw new Error('inspect: sizeRem must be at least 2.75 (a 44 px target)');
  if (!(Number.isFinite(labelPx) && labelPx >= 12)) throw new Error('inspect: labelPx must be at least 12 (readable)');
  if (!(Number.isFinite(gapPx) && gapPx >= 0)) throw new Error('inspect: gapPx must be zero or more');
  return Object.freeze({ sizeRem, labelPx, gapPx });
}

// The three custom properties the stylesheet reads, as CSS expressions that
// divide through the UI zoom once, like every other physical minimum.
export function inspectControlCss(config = wireframeUi.inspect) {
  const c = inspectControl(config);
  return Object.freeze({
    size: `calc(${c.sizeRem} * ${REFERENCE_REM_CSS})`,
    label: `calc(${c.labelPx}px / var(--ui-zoom, 1))`,
    gap: `calc(${c.gapPx}px / var(--ui-zoom, 1))`,
  });
}

// Physical px from the owner's top edge to the control's top edge, for hosts
// that place the control themselves (the hand's overlay portal).
export function inspectControlRisePx(config = wireframeUi.inspect) {
  const c = inspectControl(config);
  return c.sizeRem * 16 + c.gapPx;
}
