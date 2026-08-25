import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';

let releaseActiveStage = null;

function scaleFrame(frame, intentGapPx) {
  const stack = frame.querySelector(':scope > .combatant-stack');
  const leading = stack?.querySelector(':scope > .combatant-leading');
  const card = stack?.querySelector(':scope > .combatant-card');
  if (!stack || !leading || !card) return;
  const availableHeight = frame.clientHeight;
  const availableWidth = frame.clientWidth;
  if (!(availableHeight > 0) || !(availableWidth > 0)) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const uiZoom = Number.parseFloat(rootStyle.getPropertyValue('--ui-zoom')) || 1;
  const hasLeading = leading.childElementCount > 0;
  const leadingHeight = hasLeading ? leading.offsetHeight : 0;
  const gap = hasLeading ? intentGapPx / uiZoom : 0;
  const naturalCardHeight = card.offsetHeight;
  const naturalCardWidth = Math.max(card.offsetWidth, card.scrollWidth);
  // Intent is critical combat information, so it keeps its authored size.
  // Only the card beneath it scales; the two still move as one centered unit.
  const scale = Math.max(0.01, Math.min(
    1,
    Math.max(0, availableHeight - leadingHeight - gap) / Math.max(1, naturalCardHeight),
    availableWidth / Math.max(1, naturalCardWidth),
  ));
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
  field.setAttribute('aria-label', model.accessibility.label);
  field.style.setProperty('--battlefield-hud-clearance', `calc(${model.tokens.hudClearanceViewportPct}vh / var(--ui-zoom, 1))`);
  field.style.setProperty('--battlefield-action-clearance', `calc(${model.tokens.actionClearanceViewportPct}vh / var(--ui-zoom, 1))`);
  field.style.setProperty('--combatant-stage-center', `${model.tokens.centerPct}%`);

  let frameRequest = 0;
  const refresh = () => {
    cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      if (!field.isConnected) return;
      field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]').forEach((frame) => {
        scaleFrame(frame, model.tokens.intentGapPx);
      });
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
