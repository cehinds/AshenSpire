import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { alignCombatGround } from './environmentArt.js';

let releaseActiveStage = null;
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
      const combat = field.closest('.combat');
      combat.dataset.layout = 'formation';
      const fieldRect = field.getBoundingClientRect();
      const zoom = fieldRect.width / field.clientWidth || 1;
      const frames = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')];
      const plan = combatFormation({ width: fieldRect.width, height: fieldRect.height,
        friends: frames.filter(f => f.classList.contains('player')).map(f => f.dataset.eid),
        enemies: frames.filter(f => f.classList.contains('enemy')).map(f => f.dataset.eid) });
      const nameWidth = Math.min(...plan.slots.map(slot => slot.width));
      for (const slot of plan.slots) {
        const frame = frames.find(f => f.dataset.eid === slot.id);
        const stack = frame.querySelector('.combatant-stack');
        const sprite = frame.querySelector('.combatant-card > .sprite');
        sprite.style.zoom = '1';
        const naturalHeight = sprite.offsetHeight, naturalWidth = sprite.offsetWidth;
        const height = Math.max(16, Math.min(210, fieldRect.height * .52, slot.ground - 34)) * slot.depth;
        const scale = Math.min(height / Math.max(1, naturalHeight), slot.artWidth / Math.max(1, naturalWidth));
        sprite.style.zoom = String(scale / zoom);
        const paintedHeight = naturalHeight * scale;
        const local = anchorLocalBox(VIEWPORT_ORIGIN, { left: slot.x - nameWidth / 2, top: slot.ground - paintedHeight, width: nameWidth, height: paintedHeight });
        frame.style.left = `${local.left}px`;
        frame.style.width = `${local.width}px`;
        frame.style.zIndex = 'auto';
        sprite.style.zIndex = String(10 - slot.row);
        frame.dataset.formationRow = String(slot.row);
        frame.dataset.groundY = String(fieldRect.top + slot.ground);
        frame.dataset.groundRatio = String(slot.ground / fieldRect.height);
        stack.style.top = `${local.top}px`;
        frame.dataset.combatantScale = '1';
      }
      const rect = combat.getBoundingClientRect();
      combat.style.setProperty('--environment-top', `${(fieldRect.top - rect.top) / zoom}px`);
      combat.style.setProperty('--environment-height', `${fieldRect.height / zoom}px`);
      alignCombatGround(combat.querySelector('.environment-backdrop'), plan.ground / fieldRect.height);
      field.dataset.groundY = String(fieldRect.top + plan.ground);

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
