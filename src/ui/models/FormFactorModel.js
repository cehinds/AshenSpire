// The HUD form factor (docs/hud-layout-tokens.md): which of the four
// content/hud-layout/<form-factor>.json files styles the combat HUD. Pure and
// DOM-free; main.js's applyUiScale — the single layout decider — asks it with
// the window's CSS px and writes the answer to <html data-form-factor>, next
// to data-layout. Stylesheets read that attribute and measure nothing.
//
// Thresholds are data (balance.ui.uiScale.formFactor). First match wins:
//   widescreen  w / h >= widescreenMinAspect at w >= widescreenAspectMinWidth
//               (a landscape phone is not widescreen), or w >= widescreenMinWidth
//   mobile      w <= mobileMaxWidth
//   tablet      w <= tabletMaxWidth
//   desktop     otherwise

export function formFactorFor(width, height, thresholds) {
  const t = thresholds || {};
  const w = Number(width), h = Number(height);
  if (!(w > 0) || !(h > 0)) return 'desktop';
  if ((t.widescreenMinAspect != null && w / h >= t.widescreenMinAspect
      && w >= (t.widescreenAspectMinWidth ?? 0))
    || (t.widescreenMinWidth != null && w >= t.widescreenMinWidth)) return 'widescreen';
  if (t.mobileMaxWidth != null && w <= t.mobileMaxWidth) return 'mobile';
  if (t.tabletMaxWidth != null && w <= t.tabletMaxWidth) return 'tablet';
  return 'desktop';
}

// The wide-screen form factors: the desktop and widescreen HUD layouts. A
// phone (mobile) and a tablet keep their established geometry; only these two
// read the desktop sizing in content/config (w4a-combat sizing.desktopBands, and
// footerLayout sizing.desktopMaximumWidthPx).
export const WIDE_FORM_FACTORS = Object.freeze(['desktop', 'widescreen']);
export function isWideFormFactor(formFactor) {
  return WIDE_FORM_FACTORS.includes(formFactor);
}
