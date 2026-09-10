import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { fitStatusTray } from './statusTray.js';
import { alignCombatGround } from './environmentArt.js';
import { combatSpriteRatio, fitCombatSprites } from '../models/CombatSpriteScaleModel.js';
import { combatSpriteGeometry } from './combatSpriteGeometry.js';

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
    // Fit replacement DOM synchronously before it can paint at intrinsic width.
    if (!field.isConnected) return;
    const combat = field.closest('.combat');
    combat.dataset.layout = 'formation';
    const fieldRect = field.getBoundingClientRect();
    const zoom = fieldRect.width / field.clientWidth || 1;
    const frames = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')];
    if (!frames.length || fieldRect.width <= 0 || fieldRect.height <= 0) return;
    const plan = combatFormation({ width: fieldRect.width, height: fieldRect.height,
      friends: frames.filter(f => f.classList.contains('player')).map(f => f.dataset.eid),
      enemies: frames.filter(f => f.classList.contains('enemy')).map(f => f.dataset.eid) });
    const nameWidth = Math.min(...plan.slots.map(slot => slot.width));
    // Writes first, then reads: resetting each sprite's zoom immediately before
    // measuring it forced one synchronous layout per combatant. One batch of
    // writes and one layout serve every measurement below.
    const slotFrames = plan.slots.map(slot => {
      const frame = frames.find(f => f.dataset.eid === slot.id);
      const sprite = frame.querySelector('.combatant-card > .sprite');
      sprite.style.zoom = '1';
      return { slot, frame, sprite };
    });
    const actors = slotFrames.map(({ slot, frame, sprite }) => {
      const stack = frame.querySelector('.combatant-stack');
      const geometry = combatSpriteGeometry(sprite, schedule);
      const enemyId = sprite.firstElementChild.dataset.enemyId;
      const ratio = combatSpriteRatio(frame.dataset.stature, enemyId);
      return { slot, frame, stack, sprite, ratio, ...geometry,
        leading: Math.max(28, frame.querySelector('.combatant-leading').getBoundingClientRect().height) };
    });
    const sizes = fitCombatSprites({ width: fieldRect.width, height: fieldRect.height, actors });
    for (const actor of actors) {
      const { slot, frame, stack, sprite, boxHeight, footOffset, ratio } = actor;
      const { scale, x, visibleHeight } = sizes.find(size => size.id === slot.id);
      sprite.style.zoom = String(scale / zoom);
      sprite.firstElementChild.style.top = `${footOffset}px`;
      const paintedHeight = boxHeight * scale;
      const local = anchorLocalBox(VIEWPORT_ORIGIN, { left: x - nameWidth / 2, top: slot.ground - paintedHeight, width: nameWidth, height: paintedHeight });
      frame.style.left = `${local.left}px`;
      frame.style.width = `${local.width}px`;
      frame.style.zIndex = 'auto';
      sprite.style.zIndex = String(10 - slot.row);
      frame.dataset.formationRow = String(slot.row);
      frame.dataset.groundY = String(fieldRect.top + slot.ground);
      frame.dataset.groundRatio = String(slot.ground / fieldRect.height);
      stack.style.top = `${local.top}px`;
      frame.dataset.combatantScale = '1';
      frame.dataset.spriteRatio = String(ratio);
      frame.dataset.spriteVisibleHeight = String(visibleHeight);
    }
    for (const frame of frames) fitStatusTray(frame.querySelector('.statuses'), nameWidth);
    const rect = combat.getBoundingClientRect();
    combat.style.setProperty('--environment-top', `${(fieldRect.top - rect.top) / zoom}px`);
    combat.style.setProperty('--environment-height', `${fieldRect.height / zoom}px`);
    alignCombatGround(combat.querySelector('.environment-backdrop'), plan.ground / fieldRect.height);
    field.dataset.groundY = String(fieldRect.top + plan.ground);
  };
  const schedule = () => { cancelAnimationFrame(frameRequest); frameRequest = requestAnimationFrame(refresh); };
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(field);
  // CSS zoom can move the rendered floor without changing the observed
  // element's unzoomed content box. Refit after responsive UI settings settle.
  const layoutObserver = new MutationObserver(schedule);
  layoutObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ['style', 'data-layout', 'data-short', 'data-composition'],
  });
  window.addEventListener('resize', schedule);
  const detachObserver = new MutationObserver(() => {
    if (!field.isConnected) release();
  });
  const release = () => {
    cancelAnimationFrame(frameRequest);
    resizeObserver.disconnect();
    layoutObserver.disconnect();
    window.removeEventListener('resize', schedule);
    detachObserver.disconnect();
    if (releaseActiveStage === release) releaseActiveStage = null;
  };
  detachObserver.observe(document.body, { childList: true, subtree: true });
  document.fonts?.ready?.then(() => { if (field.isConnected) refresh(); });
  releaseActiveStage = release;
  refresh();
  return Object.freeze({ refresh, release });
}
