import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { formationTileGeometry } from '../models/FormationGridModel.js';
import { FORMATION_ROWS, formationDimensions, isFormationCell } from '../../model/formationLayout.js';
import { fitIconTray } from './iconTray.js';
import { combatSpriteRatio, fitCombatSprites } from '../models/CombatSpriteScaleModel.js';
import { combatSpriteGeometry } from './combatSpriteGeometry.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { targetOutline } from '../models/TargetLayerModel.js';
import { fitSceneBackdrop } from './sceneBackdrop.js';
import { presentationConfig } from '../../model/advancedConfig.js';

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
    const presentation = { ...presentationConfig(), ...JSON.parse(document.documentElement.dataset.formationSettings || '{}') };
    const dimensions = formationDimensions(presentation, Math.max(frames.filter(f => f.classList.contains('player')).length, frames.filter(f => f.classList.contains('enemy')).length));
    if (isFormationCell(field.dataset.playerCell, dimensions)) {
      presentation.playerSpawnRow = field.dataset.playerCell[0];
      presentation.playerSpawnColumn = field.dataset.playerCell[1];
    }
    const plan = combatFormation({ width: fieldRect.width, height: fieldRect.height,
      presentation,
      footerClearance: window.innerHeight <= 480 && window.innerWidth >= 600 ? 48 : 0,
      friends: frames.filter(f => f.classList.contains('player')).map(f => f.dataset.eid),
      enemies: frames.filter(f => f.classList.contains('enemy')).map(f => f.dataset.eid) });
    const nameWidth = Math.min(...plan.slots.map(slot => slot.width));
    const grid = field.querySelector('.formation-grid');
    if (grid) {
      grid.dataset.shape = presentation.gridShape;
      grid.style.zIndex = String(presentation.gridLayer === 'above' ? 2000 : Math.min(-1, ...plan.slots.map(slot => slot.layer - 1)));
      grid.style.setProperty('--player-grid-color', presentation.playerGridColor);
      grid.style.setProperty('--enemy-grid-color', presentation.enemyGridColor);
      const occupied = new Set(plan.slots.map(slot => slot.cell));
      // Offsets and edge clamping must not resize the reference tiles.
      const activeCells = new Set(plan.cells.map(cell => cell.cell));
      for (const tile of grid.querySelectorAll('[data-cell]')) tile.hidden = !activeCells.has(tile.dataset.cell);
      for (const cell of plan.cells) {
        const tile = grid.querySelector(`[data-cell="${cell.cell}"]`);
        if (!tile) continue;
        const geometry = formationTileGeometry(cell, plan, presentation);
        const localTile = anchorLocalBox(VIEWPORT_ORIGIN, {
          left: cell.x - geometry.width / 2, top: cell.ground,
          width: geometry.width, height: geometry.height,
        });
        tile.style.left = `${localTile.left}px`;
        tile.style.top = `${localTile.top}px`;
        tile.style.width = `${localTile.width}px`;
        tile.style.height = `${localTile.height}px`;
        tile.style.setProperty('--tile-transform', geometry.transform);
        tile.dataset.side = cell.side || (Number(cell.cell[1]) <= plan.columns ? 'player' : 'enemy');
        tile.dataset.occupied = String(occupied.has(cell.cell));
        tile.dataset.anchorX = String(cell.x);
        tile.dataset.anchorY = String(cell.ground);
      }
      field.dispatchEvent(new Event('formationlayoutchange'));
    }
    // Writes first, then reads: resetting each sprite's zoom immediately before
    // measuring it forced one synchronous layout per combatant. One batch of
    // writes and one layout serve every measurement below.
    const slotFrames = plan.slots.map(slot => {
      const frame = frames.find(f => f.dataset.eid === slot.id);
      const sprite = frame.querySelector('.combatant-card > .sprite');
      resizeObserver.observe(sprite);
      sprite.style.zoom = '1';
      return { slot, frame, sprite };
    });
    const actors = slotFrames.map(({ slot, frame, sprite }) => {
      const stack = frame.querySelector('.combatant-stack');
      const geometry = combatSpriteGeometry(sprite, schedule);
      const enemyId = sprite.firstElementChild.dataset.enemyId;
      const ratio = combatSpriteRatio(frame.dataset.stature, enemyId);
      const leadingHost = frame.querySelector('.combatant-leading');
      const leadingHeight = leadingHost ? leadingHost.getBoundingClientRect().height / zoom : 0;
      const multiplier = (presentation[`row${FORMATION_ROWS[slot.row]}Scale`] ?? 1) * (frame.classList.contains('player') ? presentation.playerSpriteScale : presentation.enemySpriteScale)
        * wireframeUi.formation.displayScale;
      return { slot, side: frame.classList.contains('player') ? 'player' : 'enemy', frame, stack, sprite, ratio, multiplier, ...geometry, leadingHost,
        // The overhead stack's own height (Inspect, when shown, over the
        // intent), in local px, for the headroom clamp below.
        leadingHeight,
        // Reading controls do not change the unselected fitting envelope.
        leading: Math.max(Math.min(66, fieldRect.height * .25), leadingHeight * zoom + ceiling * zoom + 14) };
    });
    const sizes = fitCombatSprites({ width: fieldRect.width, height: fieldRect.height, actors });
    const smallestEnemyHeight = Math.min(...actors.filter(a => a.side === 'enemy')
      .map(a => sizes.find(size => size.id === a.slot.id)?.visibleHeight ?? Infinity));
    for (const actor of actors) {
      const { slot, frame, stack, sprite, boxHeight, footOffset, ratio, leadingHost, leadingHeight } = actor;
      // A stack that grows or shrinks (Inspect revealed, a new intent) refits.
      if (leadingHost) resizeObserver.observe(leadingHost);
      const fitted = sizes.find(size => size.id === slot.id);
      if (!fitted) continue;
      const requestedGrowth = frame.classList.contains('context-selected') ? wireframeUi.formation.selectedGrowth[Math.min(2, slot.row)] : 1;
      const growth = Math.min(requestedGrowth, Math.max(1,
        (slot.ground - actor.leading - 6) / fitted.visibleHeight),
        // Selection must not make the player tower over a foe already capped
        // by the available headroom on a short screen.
        actor.side === 'player' ? Math.max(1, smallestEnemyHeight / fitted.visibleHeight) : Infinity);
      // The fit already carries the presentation multiplier, capped to the
      // screen (CombatSpriteScaleModel); only the selection growth is added.
      const multiplier = fitted.multiplier / wireframeUi.formation.displayScale;
      const scale = fitted.scale * growth;
      const x = fitted.x;
      const visibleHeight = fitted.visibleHeight * growth;
      sprite.style.zoom = String(scale / zoom);
      sprite.firstElementChild.style.top = `${footOffset}px`;
      const paintedHeight = boxHeight * scale;
      // Transparent canvas above the figure is not part of the card's layout.
      // Keep the image and its feet in place while the card starts at the ink.
      sprite.style.marginTop = `${(visibleHeight - paintedHeight) / scale}px`;
      const local = anchorLocalBox(VIEWPORT_ORIGIN, { left: x - nameWidth / 2, top: slot.ground - visibleHeight, width: nameWidth, height: visibleHeight });
      frame.style.left = `${local.left}px`;
      frame.style.width = `${local.width}px`;
      // Keep depth on the artwork. A z-index on the whole frame traps its
      // overhead buttons below a neighbouring frame's sprite on short phones.
      frame.style.zIndex = '';
      sprite.style.zIndex = String(slot.layer + (growth > 1 ? wireframeUi.formation.focusPriority : 0));
      frame.dataset.formationRow = slot.formationRow;
      frame.dataset.formationDepth = String(slot.row);
      frame.dataset.formationCell = slot.cell;
      frame.dataset.baseSpriteScale = String(fitted.scale);
      frame.dataset.presentationScale = String(multiplier);
      frame.dataset.formationX = String(slot.x);
      frame.dataset.groundY = String(fieldRect.top + slot.ground);
      frame.dataset.groundRatio = String(slot.ground / fieldRect.height);
      stack.style.top = `${local.top}px`;
      // The fitter reserves the complete card and action stack. Keep this gap
      // fixed in screen pixels, independent of art resolution or sprite size.
      frame.style.setProperty('--overhead-top', `${-14 / zoom}px`);
      frame.dataset.overheadClamped = 'false';
      frame.dataset.combatantScale = '1';
      frame.dataset.spriteRatio = String(ratio);
      frame.dataset.spriteVisibleHeight = String(visibleHeight);
      // WCO2: the guard badge lives inside this zoomed host. Publish the zoom
      // and the visible artwork's box (local px, relative to the host) so the
      // badge can counter-zoom and anchor to the art rather than inheriting
      // the sprite's scale (which left it a few px tall on phones).
      const hostRect = sprite.getBoundingClientRect();
      // Keep the 44 px target on the clickable frame, above neighbouring art.
      // It does not change the dimensions read by the sprite fitter.
      frame.classList.toggle('enemy-target-hitbox', frame.classList.contains('enemy'));
      if (frame.classList.contains('enemy-target-hitbox')) {
        const frameRect = frame.getBoundingClientRect();
        frame.style.setProperty('--enemy-hit-x', `${(hostRect.left + hostRect.width / 2 - frameRect.left) / zoom}px`);
        frame.style.setProperty('--enemy-hit-y', `${(hostRect.bottom - frameRect.top) / zoom}px`);
      }
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
    for (const frame of frames) fitIconTray(frame.querySelector('.statuses'), nameWidth);
    const rect = combat.getBoundingClientRect();
    combat.style.setProperty('--environment-top', `${(fieldRect.top - rect.top) / zoom}px`);
    combat.style.setProperty('--environment-height', `${fieldRect.height / zoom}px`);
    // WGS1: crop the scene's painted plate so its ground line meets the floor
    // band (WGS7) and its sky fills the rest (WGS6). Feet are not moved. The
    // fitter is the W4 parent's, shared with the quest dialogue.
    const backdrop = combat.querySelector('.environment-backdrop');
    if (backdrop) fitSceneBackdrop(backdrop, { width: backdrop.clientWidth, height: fieldRect.height / zoom, zoom });
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
    // The two scene words are named here rather than left to ride on
    // `data-formation-settings` (which applyDisplaySettings also rewrites on
    // every pass): a fight on screen must refit because the player answered
    // the Scenes choice, not because another attribute happened to change in
    // the same breath.
    attributes: true,
    attributeFilter: ['style', 'data-layout', 'data-short', 'data-composition', 'data-formation-settings',
      'data-wireframe-scene-skyline', 'data-wireframe-scene-floor'],
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
