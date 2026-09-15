import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { fitStatusTray } from './statusTray.js';
import { combatSpriteRatio, fitCombatSprites } from '../models/CombatSpriteScaleModel.js';
import { combatSpriteGeometry } from './combatSpriteGeometry.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { overheadStackBottom } from '../models/CombatOverlayModel.js';
import { sceneLayers } from '../models/SceneLayerModel.js';
import { targetOutline } from '../models/TargetLayerModel.js';
import { ENVIRONMENTS } from '../../content/environments.js';

const sceneById = (id) => ENVIRONMENTS.flatMap(region => region.scenes).find(scene => scene.id === id) || null;

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
    // WCO1 headroom: the HUD band's bottom edge, in the field's local px.
    const hudBand = combat.querySelector(':scope > .topbar');
    const ceiling = hudBand ? Math.max(0, (hudBand.getBoundingClientRect().bottom - fieldRect.top) / zoom) : 0;
    const frames = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')];
    if (!frames.length || fieldRect.width <= 0 || fieldRect.height <= 0) return;
    const plan = combatFormation({ width: fieldRect.width, height: fieldRect.height,
      footerClearance: window.innerHeight <= 480 && window.innerWidth >= 600 ? 48 : 64,
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
      const leadingHost = frame.querySelector('.combatant-leading');
      return { slot, frame, stack, sprite, ratio, ...geometry, leadingHost,
        // The overhead stack's own height (Inspect, when shown, over the
        // intent), in local px, for the headroom clamp below.
        leadingHeight: leadingHost ? leadingHost.getBoundingClientRect().height / zoom : 0,
        // Reading controls do not change the unselected fitting envelope.
        leading: Math.min(66, fieldRect.height * .25) };
    });
    const sizes = fitCombatSprites({ width: fieldRect.width, height: fieldRect.height, actors });
    for (const actor of actors) {
      const { slot, frame, stack, sprite, boxHeight, footOffset, ratio, leadingHost, leadingHeight } = actor;
      // A stack that grows or shrinks (Inspect revealed, a new intent) refits.
      if (leadingHost) resizeObserver.observe(leadingHost);
      const fitted = sizes.find(size => size.id === slot.id);
      const growth = frame.classList.contains('context-selected') ? wireframeUi.formation.selectedGrowth[slot.row] : 1;
      const scale = fitted.scale * wireframeUi.formation.displayScale * growth;
      const x = fitted.x;
      const visibleHeight = fitted.visibleHeight * wireframeUi.formation.displayScale * growth;
      sprite.style.zoom = String(scale / zoom);
      sprite.firstElementChild.style.top = `${footOffset}px`;
      const paintedHeight = boxHeight * scale;
      const local = anchorLocalBox(VIEWPORT_ORIGIN, { left: x - nameWidth / 2, top: slot.ground - paintedHeight, width: nameWidth, height: paintedHeight });
      frame.style.left = `${local.left}px`;
      frame.style.width = `${local.width}px`;
      frame.style.zIndex = String(slot.layer + (growth > 1 ? wireframeUi.formation.focusPriority : 0));
      sprite.style.zIndex = String(slot.row);
      frame.dataset.formationRow = slot.formationRow;
      frame.dataset.formationDepth = String(slot.row);
      frame.dataset.formationCell = slot.cell;
      frame.dataset.baseSpriteScale = String(fitted.scale);
      frame.dataset.groundY = String(fieldRect.top + slot.ground);
      frame.dataset.groundRatio = String(slot.ground / fieldRect.height);
      stack.style.top = `${local.top}px`;
      // WCO1 headroom: the stack rests 6 px above the art's visible top, but its
      // top edge never rises above the HUD band's bottom (field-local px,
      // like `local`). On a short field it comes down over the sprite instead.
      const overhead = overheadStackBottom({
        anchor: local.top + (paintedHeight - visibleHeight - 6) / zoom, height: leadingHeight, ceiling,
      });
      frame.style.setProperty('--overhead-top', `${overhead.bottom - local.top}px`);
      frame.dataset.overheadClamped = String(overhead.clamped);
      frame.dataset.combatantScale = '1';
      frame.dataset.spriteRatio = String(ratio);
      frame.dataset.spriteVisibleHeight = String(visibleHeight);
      // WCO2: the guard badge lives inside this zoomed host. Publish the zoom
      // and the visible artwork's box (local px, relative to the host) so the
      // badge can counter-zoom and anchor to the art rather than inheriting
      // the sprite's scale (which left it a few px tall on phones).
      const hostRect = sprite.getBoundingClientRect();
      // The drawn frame, not its wrapper: an enemy's pose stage is narrower
      // than the frame it paints, which overhangs the host.
      const artRect = (sprite.querySelector('.pose-stage, img, svg') || sprite.firstElementChild || sprite).getBoundingClientRect();
      sprite.style.setProperty('--sprite-zoom', String(scale / zoom));
      sprite.style.setProperty('--art-left', `${(artRect.left - hostRect.left) / zoom}px`);
      sprite.style.setProperty('--art-right', `${(artRect.right - hostRect.left) / zoom}px`);
      sprite.style.setProperty('--art-top', `${(artRect.top - hostRect.top) / zoom}px`);
      sprite.style.setProperty('--art-height', `${artRect.height / zoom}px`);
      // WGC4: the target outline is drawn on this zoomed host; hold it at its
      // physical minimum (sprite px, since the host's screen scale is `scale`).
      const outline = targetOutline({ scale });
      sprite.style.setProperty('--target-outline-width', `${outline.width}px`);
      sprite.style.setProperty('--target-outline-offset', `${outline.offset}px`);
    }
    for (const frame of frames) fitStatusTray(frame.querySelector('.statuses'), nameWidth);
    const rect = combat.getBoundingClientRect();
    combat.style.setProperty('--environment-top', `${(fieldRect.top - rect.top) / zoom}px`);
    combat.style.setProperty('--environment-height', `${fieldRect.height / zoom}px`);
    // WGS1: crop the scene's painted plate so its ground line meets the floor
    // band (WGS7) and its sky fills the rest (WGS6). Feet are not moved.
    const backdrop = combat.querySelector('.environment-backdrop');
    const art = backdrop?.querySelector(':scope > svg');
    if (art) {
      const layers = sceneLayers({ width: backdrop.clientWidth, height: fieldRect.height / zoom, scene: sceneById(backdrop.dataset.scene) });
      if (layers.skyline.viewBox) art.setAttribute('viewBox', layers.skyline.viewBox.join(' '));
      backdrop.dataset.sceneFit = layers.aligned ? 'floor' : 'cover';
      backdrop.dataset.skyline = layers.skyline.visible ? 'on' : 'off';
      backdrop.dataset.floor = layers.floor.visible ? 'on' : 'off';
      // Screen px below the battlefield's top edge (relative, so it cannot go
      // stale when the whole board shifts without resizing).
      backdrop.dataset.floorTop = String(layers.floor.top * zoom);
    }
    field.dataset.groundY = String(fieldRect.top + plan.ground);
  };
  const schedule = () => { cancelAnimationFrame(frameRequest); frameRequest = requestAnimationFrame(refresh); };
  const combatHost = field.closest('.combat');
  combatHost.addEventListener('combatantselectionchange', schedule);
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
    combatHost.removeEventListener('combatantselectionchange', schedule);
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
