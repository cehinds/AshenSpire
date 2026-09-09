import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

let releaseActiveStage = null;
const FLOOR_GAP_PX = 8;
const MAX_SPRITE_ZOOM = 2.25;

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
  // Animated pose sheets include transparent overflow outside the authored
  // sprite box. Measuring that overflow makes idle poses change the fit.
  const sprite = card.querySelector(':scope > .sprite');
  const spriteZoom = sprite ? Number.parseFloat(getComputedStyle(sprite).zoom) || 1 : 1;
  const naturalCardWidth = Math.max(card.offsetWidth, (sprite?.offsetWidth || 0) * spriteZoom);
  // Intent is critical combat information, so it keeps its authored size.
  // Only the card beneath it scales; the two still move as one centered unit.
  const centeredHeight = availableHeight * centerHeightRatio;
  const fits = Math.max(0.01, Math.min(
    frame.closest('.combat:not(.coop)') ? Math.max(1, 1 / uiZoom) : 1,
    Math.max(0, centeredHeight - leadingHeight - gap) / Math.max(1, naturalCardHeight),
    availableWidth / Math.max(1, naturalCardWidth),
  ));
  return { stack, frame, leadingHeight, gap, naturalCardHeight, fits, sprite, uiZoom,
    availableHeight, availableWidth, spriteZoom, spriteHeight: sprite?.offsetHeight || 0, spriteWidth: sprite?.offsetWidth || 0 };
}

/** applyFrame → the stage's ONE scale, so every card renders the same box. */
function applyFrame(measure, scale, groundY) {
  const { stack, frame, leadingHeight, gap, naturalCardHeight } = measure;
  const cardOffset = leadingHeight + gap;
  const visualHeight = cardOffset + (naturalCardHeight * scale);
  stack.style.setProperty('--combatant-stack-height', `${visualHeight}px`);
  stack.style.setProperty('--combatant-card-offset', `${cardOffset}px`);
  stack.style.setProperty('--combatant-card-scale', String(scale));
  // Stand on a shared floor near the hand, instead of centering small figures
  // in a tall empty corridor. The fitting pass has already reserved intent/HUD.
  const localGround = groundY - frame.getBoundingClientRect().top / measure.uiZoom;
  const center = localGround - cardOffset - measure.spriteHeight * measure.spriteZoom * scale + visualHeight / 2;
  stack.style.setProperty('--combatant-stage-center', `${center}px`);
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
      const frames = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')];
      field.style.setProperty('--stage-sprite-zoom', '1');
      const baseline = frames
        .map((frame) => measureFrame(frame, model.tokens.intentGapPx, model.tokens.centerHeightRatio))
        .filter(Boolean);
      const room = baseline.map(m => {
        const displayScale = Math.max(1, 1 / m.uiZoom);
        const fixedHeight = m.naturalCardHeight - m.spriteHeight;
        return Math.min(
          m.availableWidth / (Math.max(1, m.spriteWidth) * displayScale),
          ((m.availableHeight - m.leadingHeight - m.gap - FLOOR_GAP_PX / m.uiZoom) / displayScale - fixedHeight) / Math.max(1, m.spriteHeight),
        );
      });
      // Fill the spare space up to the presentation cap. On crowded stages
      // the common fitter remains the authority preventing overlapping cells.
      const spriteZoom = Math.max(1, Math.min(MAX_SPRITE_ZOOM, ...room));
      field.style.setProperty('--stage-sprite-zoom', String(spriteZoom));
      const measures = frames
        .map((frame) => measureFrame(frame, model.tokens.intentGapPx, model.tokens.centerHeightRatio))
        .filter(Boolean);
      if (!measures.length) return;
      const belowFeet = Math.max(...measures.map(m => m.naturalCardHeight - m.spriteHeight * m.spriteZoom));
      const scale = Math.max(0.01, measures.reduce((least, m) => Math.min(least, m.fits,
        (m.availableHeight * model.tokens.centerHeightRatio - m.leadingHeight - m.gap - FLOOR_GAP_PX / m.uiZoom)
          / Math.max(1, m.spriteHeight * m.spriteZoom + belowFeet)), Infinity));
      // Reserve the tallest information strip, then align sprite foot anchors
      // instead of card bottoms (enemy names must not lift their feet).
      const groundY = Math.min(...measures.map(m =>
        m.frame.getBoundingClientRect().top / m.uiZoom + m.availableHeight - FLOOR_GAP_PX / m.uiZoom
          - (m.naturalCardHeight - m.spriteHeight * m.spriteZoom) * scale));
      for (const measure of measures) applyFrame(measure, scale, groundY);
      const combat = field.closest('.combat');
      if (combat) {
        const rect = combat.getBoundingClientRect();
        const zoom = measures[0].uiZoom;
        // The painting belongs to the battlefield, not the tall hand below it.
        const fieldRect = field.getBoundingClientRect();
        combat.style.setProperty('--environment-top', `${(fieldRect.top - rect.top) / zoom}px`);
        combat.style.setProperty('--environment-height', `${fieldRect.height / zoom}px`);
        field.dataset.groundY = String(groundY * zoom);
      }
    });
  };
  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(field);
  // CSS zoom can move the rendered floor without changing the observed
  // element's unzoomed content box. Refit after responsive UI settings settle.
  const layoutObserver = new MutationObserver(refresh);
  layoutObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['style', 'data-layout', 'data-short', 'data-composition'],
  });
  window.addEventListener('resize', refresh);
  const detachObserver = new MutationObserver(() => {
    if (!field.isConnected) release();
  });
  const release = () => {
    cancelAnimationFrame(frameRequest);
    resizeObserver.disconnect();
    layoutObserver.disconnect();
    window.removeEventListener('resize', refresh);
    detachObserver.disconnect();
    if (releaseActiveStage === release) releaseActiveStage = null;
  };
  detachObserver.observe(document.body, { childList: true, subtree: true });
  document.fonts?.ready?.then(() => { if (field.isConnected) refresh(); });
  releaseActiveStage = release;
  refresh();
  return Object.freeze({ refresh, release });
}
