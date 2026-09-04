import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

let releaseActiveStage = null;

/**
 * measureFrame → what this frame WOULD need, and what it naturally is. The
 * scale is not applied here, because a scale chosen per frame is what made
 * every combatant a different size: each card was divided by its OWN sprite's
 * natural height, so a tall soldier shrank to 0.68 and a low hound stayed at
 * 1.00 — 260px and 384px side by side (Constantine, 2026-09-04: "combatant
 * card sizes should be uniform, this one is too narrow").
 */
function measureFrame(frame, intentGapPx, centerHeightRatio) {
  const stack = frame.querySelector(':scope > .combatant-stack');
  const leading = stack?.querySelector(':scope > .combatant-leading');
  const card = stack?.querySelector(':scope > .combatant-card');
  if (!stack || !leading || !card) return null;
  const availableHeight = frame.clientHeight;
  const availableWidth = frame.clientWidth;
  if (!(availableHeight > 0) || !(availableWidth > 0)) return null;

  const rootStyle = getComputedStyle(document.documentElement);
  const uiZoom = Number.parseFloat(rootStyle.getPropertyValue('--ui-zoom')) || 1;
  const hasLeading = leading.childElementCount > 0;
  const leadingHeight = hasLeading ? leading.offsetHeight : 0;
  const gap = hasLeading ? intentGapPx / uiZoom : 0;
  const naturalCardHeight = card.offsetHeight;
  const naturalCardWidth = Math.max(card.offsetWidth, card.scrollWidth);
  // Intent is critical combat information, so it keeps its authored size.
  // Only the card beneath it scales; the two still move as one centered unit.
  const centeredHeight = availableHeight * centerHeightRatio;
  const fits = Math.max(0.01, Math.min(
    1,
    Math.max(0, centeredHeight - leadingHeight - gap) / Math.max(1, naturalCardHeight),
    availableWidth / Math.max(1, naturalCardWidth),
  ));
  return { stack, frame, leadingHeight, gap, naturalCardHeight, fits };
}

/** applyFrame → the stage's ONE scale, so every card renders the same box. */
function applyFrame(measure, scale) {
  const { stack, frame, leadingHeight, gap, naturalCardHeight } = measure;
  const cardOffset = leadingHeight + gap;
  const visualHeight = cardOffset + (naturalCardHeight * scale);
  stack.style.setProperty('--combatant-stack-height', `${visualHeight}px`);
  stack.style.setProperty('--combatant-card-offset', `${cardOffset}px`);
  stack.style.setProperty('--combatant-card-scale', String(scale));
  frame.dataset.combatantScale = scale.toFixed(4);
}

export function wireBattlefieldStage(field, model) {
  if (releaseActiveStage) releaseActiveStage();
  if (!field) throw new Error('battlefieldStage requires a field host');
  if (!model || model.component !== UI.battlefieldStage) throw new Error('battlefieldStage requires its Component Model');

  markUiComponent(field, model.component, model.variant);
  field.dataset.stageSafeCorridor = 'true';
  field.dataset.hudClearanceViewportPct = String(model.tokens.hudClearanceViewportPct);
  field.dataset.actionClearanceViewportPct = String(model.tokens.actionClearanceViewportPct);
  field.dataset.centerHeightRatio = String(model.tokens.centerHeightRatio);
  field.setAttribute('aria-label', model.accessibility.label);
  field.style.setProperty('--battlefield-hud-clearance', `calc(${model.tokens.hudClearanceViewportPct}vh / var(--ui-zoom, 1))`);
  field.style.setProperty('--battlefield-action-clearance', `calc(${model.tokens.actionClearanceViewportPct}vh / var(--ui-zoom, 1))`);
  field.style.setProperty('--combatant-stage-center', `${model.tokens.centerPct}%`);

  let frameRequest = 0;
  const refresh = () => {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      if (!field.isConnected) return;
      // ONE SCALE FOR THE STAGE: measure every frame, then apply the smallest
      // scale any of them needs. Uniform boxes, and nobody overflows its cell.
      // Stature still differentiates an elite or a boss — that multiplier is
      // on the sprite inside the card (kit.css COMBATANT), not on the card.
      const measures = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')]
        .map((frame) => measureFrame(frame, model.tokens.intentGapPx, model.tokens.centerHeightRatio))
        .filter(Boolean);
      if (!measures.length) return;
      const scale = measures.reduce((least, m) => Math.min(least, m.fits), 1);
      for (const measure of measures) applyFrame(measure, scale);
    });
  };
  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(field);
  const detachObserver = new MutationObserver(() => {
    if (!field.isConnected) release();
  });
  const release = () => {
    cancelAnimationFrame(frameRequest);
    resizeObserver.disconnect();
    detachObserver.disconnect();
    if (releaseActiveStage === release) releaseActiveStage = null;
  };
  detachObserver.observe(document.body, { childList: true, subtree: true });
  document.fonts?.ready?.then(() => { if (field.isConnected) refresh(); });
  releaseActiveStage = release;
  refresh();
  return Object.freeze({ refresh, release });
}
