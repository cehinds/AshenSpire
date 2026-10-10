import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, uiZoom, VIEWPORT_ORIGIN } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { combatOverheadAnchors, combatOverheadRibbonShift, combatTargetAnchors } from '../models/CombatOverheadModel.js';
import { formationTileGeometry } from '../models/FormationGridModel.js';
import { FORMATION_ROWS, formationDimensions, isFormationCell } from '../../model/formationLayout.js';
import { fitIconTray } from './iconTray.js';
import { combatSpriteRatio, fitCombatSprites, NARROW_MIN_HEIGHT_FRACTION } from '../models/CombatSpriteScaleModel.js';
import { combatSpriteGeometry, currentSpriteArtBounds } from './combatSpriteGeometry.js';
import { classicAppearance, displayAppearance } from '../displayAppearance.js';
import { wireAlternativeBackdrop, fitAlternativeBackdrop } from '../alternativeArt.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { targetOutline } from '../models/TargetLayerModel.js';
import { fitSceneBackdrop } from './sceneBackdrop.js';
import { battlefieldBackdropConfig } from '../models/SceneLayerModel.js';
import { presentationConfig } from '../../model/advancedConfig.js';
import { alternativeCombatComposition as combatComposition, stableHandAnchor, combatArtworkKey, stableCombatArtwork } from '../models/CombatCompositionModel.js';
import { alternativeFormation, fitAlternativeSprites } from '../models/AlternativeFormationModel.js';
import { playerDetailsPlacement } from '../models/PlayerDetailsPlacementModel.js';
import { restingHandEnvelope, handGeometryKey } from '../models/HandLayout.js';

// Hidden panels can retain layout rectangles. Reserve controls that will paint
// together at the layout boundary, including during its common screen fade.
// Individually hidden children and intermediate ancestors remain excluded.
export function visibleCombatPanelRect(node, field) {
  if (!node) return null;
  for (let current = node; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (current.hidden || style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility)
      || (style.opacity === '0' && current !== field)) return null;
    if (current === field) break;
  }
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

export function combatControlWidth(node, zoom) {
  if (!node) return 0;
  const width = node.getBoundingClientRect().width;
  if (width > 0) return width;
  // Unselected Info doors are display:none. Their authored border-box width
  // still resolves in computed style, so selecting the actor need not repack it.
  const style = getComputedStyle(node);
  return Math.max(0, parseFloat(style.width) || 0, parseFloat(style.minWidth) || 0) * zoom;
}

export function combatPlayerInfoRect(node, art, viewport, zoom) {
  if (!node) return null;
  const width = combatControlWidth(node, zoom);
  const height = node.getBoundingClientRect().height || width;
  if (!(width > 0 && height > 0)) return null;
  const left = (art.left + art.right) / 2 - width / 2;
  const top = Math.max(viewport.top, art.top - height - 4);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

// The selected-card action is independent of the reading panel, like Info.
export function combatPlayerActionRect(node, infoRect, art, zoom) {
  if (!node) return null;
  const width = combatControlWidth(node, zoom);
  const height = node.getBoundingClientRect().height || width;
  if (!(width > 0 && height > 0)) return null;
  const left = (art.left + art.right) / 2 - (infoRect?.width || 22) / 2 - 28;
  const top = art.top - 28;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

// A readable player panel can consume the only near-foot slot for another
// actor. Retry its placement once with those actors' physical cores reserved;
// retain the first layout unless the full footer pack actually improves.
export function packCombatTargetsWithHud({ pack, placeHud, targetCores }) {
  const original = pack();
  const blocked = targets => targets.filter(target => target.obstructed);
  const ids = new Set(blocked(original).map(target => target.id));
  if (!ids.size) return original;
  placeHud(targetCores.filter(core => ids.has(core.id)));
  const retry = pack();
  if (blocked(retry).length < ids.size) return retry;
  placeHud([]);
  return original;
}

export function combatTargetHudFootprints(targets, fieldRect, size) {
  return targets.map(target => ({
    left: fieldRect.left + target.x - target.width / 2,
    right: fieldRect.left + target.x + target.width / 2,
    top: fieldRect.top + target.y - size / 2,
    bottom: fieldRect.top + target.y + size / 2,
  }));
}

export function combatFrameTarget({ id, hostRect, fieldRect, footerSize, footerWidth, player }) {
  const foot = hostRect.bottom - fieldRect.top + footerSize / 2;
  // Waist-overlap artwork extends into the hand. The player's independent
  // proxy stays in the field and can pack above real hand/action obstacles;
  // enemy name/HP footers retain their owning body's bottom floor.
  return { id, x: hostRect.left + hostRect.width / 2 - fieldRect.left,
    y: player ? Math.min(foot, fieldRect.height - footerSize / 2) : foot,
    minY: player ? footerSize / 2 : foot, width: Math.max(48, footerWidth) };
}

let releaseActiveStage = null;
export function wireBattlefieldStage(field, model, layoutState = {}) {
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
  const loadedGeometry = layoutState.loadedGeometry ||= new Map();
  let trackingRequest = 0;
  let settledTargets = [], settledFooterSize = 44;
  let playerInfoRects = [];
  const labelMeasure = document.createElement('canvas').getContext('2d');
  function fitLabels() {
    if (!labelMeasure) return;
    for (const label of field.querySelectorAll('.nm .ls-label, .intent-stance')) {
      const box = label.closest('.nm, .intent');
      const width = box.clientWidth - 8 / uiZoom();
      if (width <= 0) continue;
      const style = getComputedStyle(label);
      const maximum = 11 / uiZoom();
      labelMeasure.font = `${style.fontWeight} ${maximum}px ${style.fontFamily}`;
      const measured = labelMeasure.measureText(label.textContent).width;
      label.style.fontSize = `${Math.max(8 / uiZoom(), maximum * Math.min(1, width / Math.max(1, measured)))}px`;
    }
  }
  function readRestingHand() {
    const hand = field.closest('.combat').querySelector('.hand');
    if (!hand) return null;
    const envelope = restingHandEnvelope({ rect: hand.getBoundingClientRect(), clientWidth: hand.clientWidth,
      clientHeight: hand.clientHeight, fontSize: getComputedStyle(document.documentElement).fontSize,
      geometry: hand.dataset.handGeometry, restLeft: parseFloat(hand.style.getPropertyValue('--hand-rest-left')),
      restTop: parseFloat(hand.style.getPropertyValue('--hand-rest-top')),
      clearanceTop: parseFloat(hand.style.getPropertyValue('--hand-clearance-top')) }, layoutState.restHandAnchor);
    if (envelope?.validated) layoutState.restHandAnchor = envelope;
    return envelope;
  }
  function placePlayerHud(reserveFirst = false, targetCores = []) {
    const zoom = uiZoom();
    const combat = field.closest('.combat');
    const panels = [...field.querySelectorAll(reserveFirst === true
      ? '.enemy .intent, .enemy .combatant-info, .enemy .sprite, .turn-ribbon'
      : '.enemy .intent, .enemy .combatant-info, .enemy .nm, .enemy .meters, .enemy .sprite, .turn-ribbon')]
      .map(node => visibleCombatPanelRect(node, field)).filter(Boolean);
    const toolsBox = visibleCombatPanelRect(combat?.querySelector('.combat-tools'), combat);
    if (toolsBox) panels.push(toolsBox);
    panels.push(...targetCores);
    // Tracking reserves complete settled targets in the field's current coordinates.
    if (reserveFirst !== true && settledTargets.length) panels.push(
      ...combatTargetHudFootprints(settledTargets, field.getBoundingClientRect(), settledFooterSize));
    const handTop = readRestingHand()?.clearanceTop;
    const players = [...field.querySelectorAll('.combatant.player')].flatMap(player => {
      const sprite = player.querySelector('.sprite'), leading = player.querySelector('.combatant-leading');
      if (!sprite || !leading || !leading.querySelector('.combatant-mini-hud')) return [];
      const art = currentSpriteArtBounds(sprite, placePlayerHud);
      art.width = art.right - art.left;
      const stack = player.querySelector('.combatant-stack').getBoundingClientRect();
      const viewport = combat.getBoundingClientRect();
      const panel = leading.getBoundingClientRect();
      const inspect = leading.querySelector('.combatant-info');
      const action = leading.querySelector('.player-action-intent');
      const infoRect = combatPlayerInfoRect(inspect, art, viewport, zoom);
      const actionRect = combatPlayerActionRect(action, infoRect, art, zoom);
      return [{ player, leading, art, stack, viewport, panel, inspect, action, infoRect, actionRect }];
    });
    // Reserve every seat's intended Info/action doors before placing any panel,
    // including selectable doors that have not painted yet.
    playerInfoRects = players.flatMap(({ infoRect, actionRect }) => [infoRect, actionRect]).filter(Boolean);
    panels.push(...playerInfoRects);
    for (const { player, leading, art, stack, viewport, panel, inspect, action, infoRect, actionRect } of players) {
      const expanded = player.classList.contains('context-selected');
      const panelGap = expanded && viewport.width <= 320 ? 3 : 4;
      const idleLeft = Math.max(viewport.left + 4, Math.min(art.left + (art.width - panel.width) / 2, viewport.right - panel.width - 4));
      const idleTop = Math.min(art.bottom + 3, Math.min(toolsBox?.top ?? Infinity, handTop ?? Infinity) - panel.height - 4);
      const placement = playerDetailsPlacement({
        art: expanded ? { ...art, top: art.bottom - panel.height } : { ...art, right: idleLeft - 4, top: idleTop - 16 },
        width: panel.width, height: panel.height, viewport, gap: panelGap,
        handTop: Math.min(toolsBox?.top ?? Infinity, handTop ?? Infinity),
        previous: reserveFirst === true ? undefined : { left: panel.left, top: panel.top },
        hudBottom: combat.querySelector('.combat-hud')?.getBoundingClientRect().bottom, obstacles: panels });
      panels.push({ ...placement, right: placement.left + panel.width, bottom: placement.top + panel.height });
      const top = `${(placement.top - stack.top) / zoom}px`;
      const left = `${(placement.left - stack.left) / zoom}px`;
      if (leading.style.top !== top) leading.style.top = top;
      if (leading.style.left !== left) leading.style.left = left;
      leading.style.translate = 'none';
      for (const [door, rect] of [[inspect, infoRect], [action, actionRect]]) {
        if (!rect) continue;
        const local = anchorLocalBox({ left: placement.left, top: placement.top, width: panel.width, height: panel.height }, rect, { zoom });
        door.style.left = `${local.left}px`;
        door.style.top = `${local.top}px`;
      }
      player.dataset.spriteArtTop = String(art.top);
      player.dataset.playerHudGap = String(art.top - leading.getBoundingClientRect().bottom);
    }
  }
  function trackPlayerHud() {
    placePlayerHud();
    // Idle breathing also moves the painted body. Keep the physical gap during
    // those CSS transforms as well as explicit attack and movement poses.
    trackingRequest = field.isConnected && field.querySelector('.combatant.player')
      ? requestAnimationFrame(trackPlayerHud) : 0;
  }
  const refresh = () => {
    cancelAnimationFrame(frameRequest);
    // Fit replacement DOM synchronously before it can paint at intrinsic width.
    if (!field.isConnected) return;
    const combat = field.closest('.combat');
    if (wiredAppearance !== displayAppearance()) {
      releaseBackdrop();
      releaseBackdrop = wireAlternativeBackdrop(combat);
      wiredAppearance = displayAppearance();
    }
    combat.dataset.layout = 'formation';
    // No combatants yet (the wiring's own call, before the first render): there
    // is nothing to fit, so do not force a layout of the half-built screen.
    const frames = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')];
    if (!frames.length) return;
    fitLabels();
    const measuredField = field.getBoundingClientRect();
    // CSS zoom can report float noise across equivalent DOM remounts. Snap the
    // dimensions before deriving formation coordinates, not only its cache key.
    const fieldRect = { top: measuredField.top, left: measuredField.left,
      width: Math.round(measuredField.width * 64) / 64,
      height: Math.round(measuredField.height * 64) / 64 };
    const zoom = fieldRect.width / field.offsetWidth || 1;
    // WCO1 headroom: the HUD band's bottom edge, in the field's local px.
    const hudBand = combat.querySelector(':scope > .topbar');
    const overheadGap = combat.dataset.compactCombat === 'true' ? 4 : 14;
    const ceiling = hudBand ? Math.max(0, (hudBand.getBoundingClientRect().bottom - fieldRect.top) / zoom) : 0;
    const vitality = hudBand?.querySelector('.resbars-host');
    if (vitality) combat.style.setProperty('--combat-header-opaque-end',
      `${Math.max(0, (vitality.getBoundingClientRect().bottom - hudBand.getBoundingClientRect().top) / zoom)}px`);
    // The turn ribbon hangs from the HUD band's bottom edge (player-polish.css
    // reads --turn-ribbon-top), so it never sits under a band taller than its
    // row. Its box, in the same screen px as the plan, is a second ceiling for
    // every figure whose art or overhead stack shares its columns (below).
    const ribbonEl = field.querySelector(':scope > .turn-ribbon');
    if (ribbonEl) {
      field.style.setProperty('--turn-ribbon-top', `${ceiling}px`);
      // A ribbon that changes size (its text, a short screen's font) refits.
      resizeObserver.observe(ribbonEl);
    }
    const ribbonRect = ribbonEl?.getBoundingClientRect();
    const ribbon = ribbonRect?.width > 0 && ribbonRect.height > 0 ? { left: ribbonRect.left - fieldRect.left,
      right: ribbonRect.right - fieldRect.left, top: ribbonRect.top - fieldRect.top, bottom: ribbonRect.bottom - fieldRect.top } : null;
    if (fieldRect.width <= 0 || fieldRect.height <= 0) return;
    // The page zoom, read once before the writes below. anchorLocalBox reads it
    // as computed style when not handed it, and per tile and per combatant, each
    // after a style write, that was a style flush apiece (36 tiles).
    const pageZoom = uiZoom();
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
    if (!classicAppearance()) alternativeFormation(plan, fieldRect.width, fieldRect.height, document.documentElement.dataset.layout === 'narrow');
    const nameWidth = Math.min(...plan.slots.map(slot => slot.width));
    const grid = field.querySelector('.formation-grid');
    if (grid) {
      grid.dataset.shape = presentation.gridShape;
      grid.style.zIndex = presentation.gridLayer === 'above'
        ? 'var(--combat-layer-selection)' : 'calc(var(--combat-layer-shadows) - 1)';
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
        }, { zoom: pageZoom });
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
      field.formationPlan = { plan, width: fieldRect.width, height: fieldRect.height };
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
      let geometry = combatSpriteGeometry(sprite, schedule);
      // Reserve the tallest authored pose once. Following the current ink must
      // not push the overhead into the ribbon or resize art during an attack.
      if (frame.classList.contains('player')) {
        const ratio = Number(sprite.querySelector('.painted-stage')?.dataset.maximumHeightRatio || 0);
        geometry.visibleHeight = Math.max(geometry.visibleHeight, geometry.boxHeight * ratio);
      }
      const enemyId = sprite.firstElementChild.dataset.enemyId;
      const ratio = combatSpriteRatio(frame.dataset.stature, enemyId);
      const leadingHost = frame.querySelector('.combatant-leading');
      const leadingHeight = !frame.classList.contains('player') ? (visibleCombatPanelRect(leadingHost, field)?.height || 0) / zoom : 0;
      // Inspect and intent stack vertically except on short landscape screens,
      // where their complete side-by-side union must stay inside the field.
      // Decorative shortcut keys do not enlarge the actionable control box.
      const leadingRects = leadingHost ? [...leadingHost.querySelectorAll(':scope > .overhead-control, :scope > .combatant-mini-hud')]
        .map(control => visibleCombatPanelRect(control, field)).filter(Boolean) : [];
      const leadingWidth = leadingRects.length && !frame.classList.contains('player') ? (Math.max(...leadingRects.map(rect => rect.right))
        - Math.min(...leadingRects.map(rect => rect.left))) / zoom : 0;
      const multiplier = (presentation[`row${FORMATION_ROWS[slot.row]}Scale`] ?? 1) * (frame.classList.contains('player') ? presentation.playerSpriteScale : presentation.enemySpriteScale)
        * wireframeUi.formation.displayScale * (slot.characterScale || 1);
      const stage = sprite.querySelector('.pose-stage');
      const art = [sprite.firstElementChild.className, stage?.dataset.poseClass, stage?.dataset.animationSet,
        sprite.querySelector('.enemy-pose-idle, .painted-presentation')?.getAttribute('src')];
      // A replacement image briefly has no intrinsic pixels. Reuse its last
      // loaded measurement instead of replacing the encounter fit with a box.
      const geometryKey = JSON.stringify([art, sprite.offsetWidth, sprite.offsetHeight]);
      const image = sprite.querySelector('.enemy-pose-idle, .painted-presentation, .facing > img');
      if (image && (!image.complete || !image.naturalWidth)) {
        geometry = loadedGeometry.get(geometryKey) || geometry;
      } else loadedGeometry.set(geometryKey, geometry);
      return { slot, side: frame.classList.contains('player') ? 'player' : 'enemy', frame, stack, sprite, ratio, enemyId, multiplier, ...geometry, leadingHost,
        art,
        // The overhead stack's own height (Inspect, when shown, over the
        // intent), in local px, for the headroom clamp below.
        leadingHeight, leadingWidth,
        // Reading controls do not change the unselected fitting envelope.
        leading: Math.max(Math.min(66, fieldRect.height * .25), leadingHeight * zoom + ceiling * zoom + overheadGap) };
    });
    const narrow = document.documentElement.dataset.layout === 'narrow';
    const hand = combat.querySelector('.hand');
    const handRect = hand?.getBoundingClientRect();
    // Read the resting envelope, never a selected or horizontally panned card.
    // Keep it across screen remounts until viewport geometry or text scale changes.
    const handKey = handRect && hand.clientWidth > 0
      ? handGeometryKey({ width: hand.clientWidth, height: hand.clientHeight, zoom: handRect.width / hand.clientWidth,
        fontSize: getComputedStyle(document.documentElement).fontSize, left: handRect.left }) : null;
    const handLeft = readRestingHand()?.left ?? fieldRect.left;
    // Preserve the incoming remount cache's subpixel tolerance; raw geometry
    // still validates the hand's authored resting envelope above.
    const stableHandKey = handKey?.split(':').map(value => Number.isFinite(Number(value))
      ? Math.round(Number(value) * 1000) / 1000 : value).join(':');
    const handLayoutKey = [fieldRect.width, fieldRect.height, pageZoom].map(value => Math.round(value * 1000) / 1000).join(':') + ':' + stableHandKey;
    const handAnchor = layoutState.handAnchor = stableHandAnchor(layoutState.handAnchor, handLayoutKey, {
      left: handLeft - fieldRect.left, top: handRect ? handRect.top - fieldRect.top + 22 : null,
    });
    const solo = actors.filter(actor => actor.side === 'player').length === 1 && !combat.classList.contains('coop');
    combat.dataset.composition = 'option-c';
    combat.dataset.waistOverlap = String(solo && window.innerHeight > 480);
    // Short landscape needs a lower foot line to reserve the full intent row.
    if (classicAppearance() && window.innerHeight <= 480) for (const actor of actors) {
      actor.slot = { ...actor.slot, fitGround: fieldRect.height - 24, ground: fieldRect.height - 24 };
    }
    const fitFormation = () => {
      const sizes = combatComposition({ width: fieldRect.width, height: fieldRect.height, actors,
        handTop: handAnchor?.key === handLayoutKey ? handAnchor.top : null,
        handLeft: handAnchor?.key === handLayoutKey ? handAnchor.left : 0,
        solo: solo && window.innerHeight > 480,
        sizes: classicAppearance()
          ? fitCombatSprites({ width: fieldRect.width, height: fieldRect.height, actors,
            minHeight: narrow ? fieldRect.height * NARROW_MIN_HEIGHT_FRACTION : 0 })
          : fitAlternativeSprites({ width: fieldRect.width, height: fieldRect.height, actors, narrow }) });
      const smallestEnemyHeight = Math.min(...actors.filter(a => a.side === 'enemy')
        .map(a => sizes.find(size => size.id === a.slot.id)?.visibleHeight ?? Infinity));
      const growthFor = (actor, fitted) => {
        const requestedGrowth = 1; // Reading selection never changes approved artwork geometry.
        return Math.min(requestedGrowth, Math.max(1,
          ((fitted.ground ?? actor.slot.ground) - actor.leading - 6) / fitted.visibleHeight),
          // Selection must not make the player tower over a foe already capped
          // by the available headroom on a short screen.
          actor.side === 'player' ? Math.max(1, smallestEnemyHeight / fitted.visibleHeight) : Infinity);
      };
      const overheads = combatOverheadAnchors({ width: fieldRect.width, ribbon, ribbonClearance: overheadGap,
        controls: actors.filter(actor => actor.leadingWidth > 0 && sizes.some(size => size.id === actor.slot.id)).map(actor => {
          const fitted = sizes.find(size => size.id === actor.slot.id);
          const bottom = (fitted.ground ?? actor.slot.ground) - fitted.visibleHeight * growthFor(actor, fitted) - overheadGap;
          return { id: actor.slot.id, side: actor.side, row: actor.slot.row, x: fitted.x,
            width: actor.leadingWidth * zoom, top: bottom - actor.leadingHeight * zoom, bottom };
        }) });
      return { sizes, growthFor, overheads };
    };
    let { sizes, growthFor, overheads } = fitFormation();
    // The turn ribbon never covers a figure. A figure whose art or overhead
    // stack shares the ribbon's columns is fitted below it, with the same 14 px
    // gap the HUD band gets, and the formation is fitted again (until no other
    // figure moves under it; the set only grows, so this ends). Figures clear
    // of its columns keep their room, so a short landscape phone does not lose
    // its fighters to a ribbon none of them stands under.
    if (ribbon) {
      const crosses = (centre, width) => centre - width / 2 < ribbon.right && centre + width / 2 > ribbon.left;
      const ribbonLeading = actor => actor.leadingHeight * zoom + ribbon.bottom + overheadGap;
      for (let pass = 0; pass < actors.length; pass++) {
        const moved = actors.filter(actor => {
          const fitted = sizes.find(size => size.id === actor.slot.id);
          if (!fitted || ribbonLeading(actor) <= actor.leading) return false;
          const artWidth = fitted.visibleHeight * growthFor(actor, fitted) * actor.visibleWidth / actor.visibleHeight;
          const overheadX = overheads.find(overhead => overhead.id === actor.slot.id)?.x ?? fitted.x;
          return crosses(fitted.x, artWidth) || crosses(overheadX, actor.leadingWidth * zoom);
        });
        if (!moved.length) break;
        for (const actor of moved) actor.leading = ribbonLeading(actor);
        ({ sizes, growthFor, overheads } = fitFormation());
      }
    }
    const artworkFit = layoutState.artworkFit = stableCombatArtwork(layoutState.artworkFit, combatArtworkKey({ width: fieldRect.width,
      height: fieldRect.height, zoom: pageZoom, presentation, appearance: displayAppearance(), handAnchor, actors }), sizes);
    sizes = artworkFit.sizes;
    // Intent/Inspect controls still respond to their current text and selection,
    // but their changing headroom cannot resize or move the settled artwork.
    overheads = combatOverheadAnchors({ width: fieldRect.width, ribbon, ribbonClearance: overheadGap,
      controls: actors.filter(actor => actor.leadingWidth > 0 && sizes.some(size => size.id === actor.slot.id)).map(actor => {
        const fitted = sizes.find(size => size.id === actor.slot.id);
        const bottom = (fitted.ground ?? actor.slot.ground) - fitted.visibleHeight - overheadGap;
        return { id: actor.slot.id, side: actor.side, row: actor.slot.row, x: fitted.x,
          width: actor.leadingWidth * zoom, top: bottom - actor.leadingHeight * zoom, bottom };
      }) });
    const placed = [];
    const depthOrder = [...new Set(plan.slots.map(slot => slot.layer))].sort((a, b) => a - b);
    for (const actor of actors) {
      const { slot, frame, stack, sprite, boxHeight, footOffset, ratio, leadingHost, leadingHeight } = actor;
      // A stack that grows or shrinks (Inspect revealed, a new intent) refits.
      if (leadingHost) resizeObserver.observe(leadingHost);
      const fitted = sizes.find(size => size.id === slot.id);
      if (!fitted) continue;
      const growth = growthFor(actor, fitted);
      // The fit already carries the presentation multiplier, capped to the
      // screen (CombatSpriteScaleModel); only the selection growth is added.
      const multiplier = fitted.multiplier / wireframeUi.formation.displayScale;
      const scale = fitted.scale * growth;
      // Packing inspection/intent controls must never move the body underneath.
      const x = fitted.x;
      const ground = fitted.ground ?? slot.ground;
      const visibleHeight = fitted.visibleHeight * growth;
      sprite.style.zoom = String(scale / zoom);
      sprite.firstElementChild.style.top = `${footOffset}px`;
      const paintedHeight = boxHeight * scale;
      // Transparent canvas above the figure is not part of the card's layout.
      // Keep the image and its feet in place while the card starts at the ink.
      sprite.style.marginTop = `${(visibleHeight - paintedHeight) / scale}px`;
      const local = anchorLocalBox(VIEWPORT_ORIGIN, { left: x - nameWidth / 2, top: ground - visibleHeight, width: nameWidth, height: visibleHeight }, { zoom: pageZoom });
      frame.style.left = `${local.left}px`;
      frame.style.width = `${local.width}px`;
      // Keep depth on the artwork. A z-index on the whole frame traps its
      // overhead buttons below a neighbouring frame's sprite on short phones.
      frame.style.zIndex = '';
      // Depth stays within a role's plane: players always paint over enemies.
      sprite.style.setProperty('--combat-depth', String(depthOrder.indexOf(slot.layer)));
      frame.dataset.formationRow = slot.formationRow;
      frame.dataset.formationDepth = String(slot.row);
      frame.dataset.formationCell = slot.cell;
      frame.dataset.baseSpriteScale = String(fitted.scale);
      frame.dataset.presentationScale = String(multiplier);
      frame.dataset.formationX = String(slot.x);
      frame.dataset.groundY = String(fieldRect.top + ground);
      frame.dataset.groundRatio = String(ground / fieldRect.height);
      stack.style.top = `${local.top}px`;
      // The half-field art floor may move two enemies to the same painted
      // centre. Their intent/Inspect controls retain their distinct reserved
      // slots instead of following that inward art clamp. Measured collisions
      // also occur on short landscape screens; clear anchors stay unchanged.
      const overheadX = overheads.find(overhead => overhead.id === slot.id)?.x ?? x;
      const overheadLocal = anchorLocalBox(VIEWPORT_ORIGIN,
        { left: overheadX - x, top: 0, width: 0, height: 0 }, { zoom });
      if (leadingHost) {
        leadingHost.style.left = `${overheadLocal.left}px`;
        // Full-height artwork may reach its final ground before the fitter
        // can reserve more ribbon headroom. Move only the readable controls,
        // including a packed cross-row control, clear of the ribbon.
        const overheadTop = ground - visibleHeight - overheadGap - actor.leadingHeight * zoom;
        const overheadShift = overheads.find(overhead => overhead.id === slot.id)?.offsetY
          ?? combatOverheadRibbonShift({ x: overheadX, width: actor.leadingWidth * zoom,
            top: overheadTop, bottom: overheadTop + actor.leadingHeight * zoom, ribbon, clearance: overheadGap });
        leadingHost.style.translate = actor.side === 'player' ? 'none' : `0 ${overheadShift / zoom}px`;
      }
      // The fitter reserves the complete card and action stack. Keep this gap
      // fixed in screen pixels, independent of art resolution or sprite size.
      frame.style.setProperty('--overhead-top', `${-overheadGap / zoom}px`);
      frame.dataset.overheadClamped = 'false';
      frame.dataset.combatantScale = '1';
      frame.dataset.spriteRatio = String(ratio);
      frame.dataset.spriteVisibleHeight = String(visibleHeight);
      // Keep the 44 px target on the clickable frame, above neighbouring art.
      // It does not change the dimensions read by the sprite fitter.
      frame.classList.toggle('enemy-target-hitbox', frame.classList.contains('enemy'));
      frame.classList.toggle('player-target-hitbox', frame.classList.contains('player'));
      placed.push({ frame, sprite, scale });
    }
    // WCO2: the guard badge lives inside this zoomed host. Publish the zoom
    // and the visible artwork's box (local px, relative to the host) so the
    // badge can counter-zoom and anchor to the art rather than inheriting
    // the sprite's scale (which left it a few px tall on phones).
    //
    // READ EVERY BOX, THEN WRITE EVERY VARIABLE. Reading one combatant's boxes
    // straight after writing the previous one's forced a synchronous layout per
    // box: three per combatant on every refresh, and the click that enters a
    // fight runs several refreshes before its first paint. What is written
    // below places only the absolutely positioned badge and the hit target's
    // ::after, never a box read here, so one layout serves every read.
    // Position the player's visible reading widget from the final art before
    // reserving target space. Its hit-testable health row and ability badges
    // must not split the independent frame plate's complete tap area.
    for (const frame of frames) fitIconTray(frame.querySelector('.statuses'), nameWidth);
    settledTargets = [];
    placePlayerHud();
    const boxes = placed.map(({ frame, sprite }) => ({
      intentRect: frame.querySelector('.intent')?.getBoundingClientRect(),
      hostRect: sprite.getBoundingClientRect(),
      // Waist-overlap moves the painted player below the field; its real
      // 44px frame tap target must still receive a finite, in-field anchor.
      frameRect: frame.classList.contains('enemy-target-hitbox') || frame.classList.contains('player-target-hitbox') ? frame.getBoundingClientRect() : null,
      // The drawn frame, not its wrapper: an enemy's pose stage is narrower
      // than the frame it paints, which overhangs the host.
      artRect: (sprite.querySelector('.pose-stage, img, svg') || sprite.firstElementChild || sprite).getBoundingClientRect(),
      footerWidth: Math.max(0, ...[...frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')]
        .map(footer => visibleCombatPanelRect(footer, field)?.width || 0)),
      footerHeight: [...frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')]
        .reduce((height, footer) => height + (visibleCombatPanelRect(footer, field)?.height || 0), 0),
      footerTop: Math.min(...[...frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')]
        .filter(footer => visibleCombatPanelRect(footer, field))
        .map(footer => footer.getBoundingClientRect().top - (parseFloat(footer.style.translate.split(' ')[1]) || 0) * zoom)),
      footerCenterX: [...frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')].filter(node => visibleCombatPanelRect(node, field))
        .map(footer => { const rect = footer.getBoundingClientRect(); return rect.left + rect.width / 2 - (parseFloat(footer.style.translate) || 0) * zoom; })[0],
      controls: [...frame.querySelectorAll('.combatant-leading button, .combatant-mini-hud')]
        .map(control => visibleCombatPanelRect(control, field)).filter(Boolean),
    }));
    // Reserve the player's readable panel before packing enemy footers. The
    // final HUD pass can then keep this slot without competing with a footer.
    placePlayerHud(true);
    const readFooterObstacles = () => {
      const footerObstacles = [...combat.querySelectorAll('.combat-tools, .combat-action-row button, .combat-hud, .turn-ribbon, .player .combatant-leading, .player .combatant-info, .player .player-action-intent')]
        .map(node => {
          const rect = visibleCombatPanelRect(node, combat);
          if (!rect) return null;
          // Footer packing supplies two pixels; reserve eight more around the
          // panel and its independently positioned Inspect control.
          const playerControl = node.matches('.player .combatant-leading, .player .combatant-info');
          const padding = playerControl ? 8 : 0;
          return { left: rect.left - padding, right: rect.right + padding,
            top: rect.top - padding, bottom: rect.bottom + padding, width: rect.width, height: rect.height };
        }).filter(Boolean);
      // A hidden but selectable Info door occupies this same art-centered
      // footprint when exposed. It is no longer an overhang of the HUD panel.
      for (const rect of playerInfoRects) footerObstacles.push({ ...rect,
        left: rect.left - 8, right: rect.right + 8, top: rect.top - 8, bottom: rect.bottom + 8 });
      const footerHandRect = combat.querySelector('.hand')?.getBoundingClientRect();
      const handEnvelope = readRestingHand();
      if (footerHandRect?.width > 0 && footerHandRect.height > 0) footerObstacles.push({
        left: footerHandRect.left, right: footerHandRect.right, top: handEnvelope?.clearanceTop ?? footerHandRect.top, bottom: footerHandRect.bottom,
      });
      return footerObstacles;
    };
    const footerSize = Math.max(44, ...boxes.filter((box, index) => placed[index].frame.classList.contains('context-selected')).map(box=>box.footerHeight));
    const packTargets = () => combatTargetAnchors({ width: fieldRect.width,
      height: Math.max(fieldRect.height, combat.getBoundingClientRect().bottom-fieldRect.top-60),
      // Crowded HUD/intent bands may leave no vertical slot. Only the plate
      // and its visible footer may then shift by at most one physical target.
      lockX: true, size: footerSize, maxShiftX: 44,
      obstacles: [...readFooterObstacles(),
        ...boxes.flatMap((box, index) => placed[index].frame.classList.contains('player') ? [] : box.controls)].map(rect => ({
        left: rect.left - fieldRect.left, right: rect.right - fieldRect.left,
        top: rect.top - fieldRect.top, bottom: rect.bottom - fieldRect.top,
      })),
      targets: boxes.flatMap((box, i) => box.frameRect && !placed[i].frame.classList.contains('dead') ? [combatFrameTarget({
        ...box, id: placed[i].frame.dataset.eid, fieldRect, footerSize,
        player: placed[i].frame.classList.contains('player'),
      })] : []) });
    const targets = packCombatTargetsWithHud({ pack: packTargets,
      placeHud: cores => placePlayerHud(true, cores),
      // A fallen frame survives for its defeat pose but paints no target
      // proxy, so it neither competes for footer space nor blocks the HUD.
      targetCores: boxes.flatMap((box, i) => {
        if (placed[i].frame.classList.contains('dead')) return [];
        const target = combatFrameTarget({ ...box, id: placed[i].frame.dataset.eid, fieldRect, footerSize,
          player: placed[i].frame.classList.contains('player') });
        return [{ id: target.id, left: fieldRect.left + target.x - 22, right: fieldRect.left + target.x + 22,
          top: fieldRect.top + target.y - 22, bottom: fieldRect.top + target.y + 22 }];
      }),
    });
    settledTargets = targets;
    settledFooterSize = footerSize;
    placed.forEach(({ frame, sprite, scale }, i) => {
      const { hostRect, frameRect, artRect, intentRect } = boxes[i];
      frame.dataset.intentVisibility = frame.querySelector('.intent')?.dataset.intentVisibility || 'known';
      if (intentRect) {
        frame.style.setProperty('--enemy-hit-width', `${Math.max(44,boxes[i].footerWidth) / zoom}px`);
        // Intent cards can be taller; the independent foot target keeps its
        // physical 44px minimum so two aligned footer bands fit a short stage.
        frame.style.setProperty('--enemy-hit-height', `${44 / zoom}px`);
      }
      if (frameRect) {
        const target = targets.find(target => target.id === frame.dataset.eid) || combatFrameTarget({
          ...boxes[i], id: frame.dataset.eid, fieldRect, footerSize, player: frame.classList.contains('player'),
        });
        const local = anchorLocalBox(frameRect, { left: fieldRect.left + target.x,
          top: fieldRect.top + target.y, width: 44, height: 44 }, { zoom });
        frame.style.setProperty('--enemy-hit-x', `${local.left}px`);
        frame.style.setProperty('--enemy-hit-y', `${local.top}px`);
        frame.dataset.targetObstructed = String(!!target.obstructed);
        const offset = anchorLocalBox(VIEWPORT_ORIGIN, {
          left: fieldRect.left + target.x - (boxes[i].footerCenterX ?? hostRect.left + hostRect.width / 2),
          top: fieldRect.top + target.y - footerSize / 2 - (Number.isFinite(boxes[i].footerTop) ? boxes[i].footerTop : hostRect.bottom), width: 0, height: 0 }, { zoom });
        // Keep the visible name/health footer with its tap target. Packing
        // only the invisible target would leave no cue to the intended owner.
        for (const footer of frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')) {
          footer.style.translate = `${offset.left}px ${offset.top}px`;
          footer.style.position = 'relative';
          footer.style.zIndex = 'var(--combat-layer-selection)';
          // A fallen footer reserves no space, so a living one may pack onto
          // its spot. Hide it rather than paint a faded plate over that fighter.
          footer.style.visibility = frame.classList.contains('dead') ? 'hidden' : '';
        }
        if (frame.classList.contains('enemy') && !frame.classList.contains('context-selected')) {
          const meter = frame.querySelector('.combatant-card > .meters');
          if (meter) {
            const rect = meter.getBoundingClientRect();
            const leading = frame.querySelector('.combatant-leading').getBoundingClientRect();
            const idleOffset = anchorLocalBox(VIEWPORT_ORIGIN, {
              left: leading.left + (leading.width - rect.width) / 2 - rect.left,
              top: leading.bottom - rect.height - rect.top, width: 0, height: 0,
            }, { zoom });
            meter.style.translate = `${offset.left + idleOffset.left}px ${offset.top + idleOffset.top}px`;
          }
        }
      }
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
    });
    const rect = combat.getBoundingClientRect();
    // Fit the sky from the top of the combat screen, including the HUD.
    // Extending a field-only crop upward can expose empty space above the
    // painting. Continuing behind cards must not move the ground line.
    const backdrop = combat.querySelector('.environment-backdrop');
    // Its width is read BEFORE the two variables below are written: they are
    // set on the fight's root, so a read after them restyled the whole screen
    // once more. The width is the root's (inset: 0), never the height written.
    const backdropWidth = backdrop ? backdrop.clientWidth : 0;
    combat.style.setProperty('--environment-top', '0px');
    combat.style.setProperty('--environment-height', `${rect.height / zoom}px`);
    const fieldTop = (fieldRect.top - rect.top) / zoom;
    // Continue real ground past the lowered footer fade, including on phones
    // where the hand consumes much of the viewport. Keep the same horizon.
    const sceneHeight = fieldTop + fieldRect.height / zoom;
    if (!classicAppearance()) fitAlternativeBackdrop(combat, { width: rect.width / zoom, height: fieldRect.height / zoom,
      fieldTop, ground: plan.ground / zoom, narrow });
    if (backdrop) fitSceneBackdrop(backdrop, {
      width: backdropWidth, height: rect.height / zoom, zoom,
      windowTop: 0, windowHeight: sceneHeight,
      config: battlefieldBackdropConfig({ height: sceneHeight, appearance: displayAppearance(),
        fieldTop, fieldHeight: fieldRect.height / zoom,
        formation: { cells: plan.cells.map(cell => ({ ground: cell.ground / zoom })), rowSpacing: plan.rowSpacing / zoom } }),
    });
    field.dataset.groundY = String(fieldRect.top + plan.ground);
  };
  const schedule = () => { cancelAnimationFrame(frameRequest); frameRequest = requestAnimationFrame(refresh); };
  const combatHost = field.closest('.combat');
  let wiredAppearance = displayAppearance();
  let releaseBackdrop = wireAlternativeBackdrop(combatHost);
  combatHost.addEventListener('combatantselectionchange', schedule);
  combatHost.addEventListener('handlayoutchange', schedule);
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
  const poseObserver = new MutationObserver(() => {
    if (!trackingRequest) trackingRequest = requestAnimationFrame(trackPlayerHud);
  });
  poseObserver.observe(field, { subtree: true, attributes: true,
    attributeFilter: ['src', 'data-pose', 'data-animating', 'class'] });
  const detachObserver = new MutationObserver(() => {
    if (!field.isConnected) release();
  });
  const release = () => {
    releaseBackdrop();
    combatHost.removeEventListener('combatantselectionchange', schedule);
    combatHost.removeEventListener('handlayoutchange', schedule);
    cancelAnimationFrame(frameRequest);
    cancelAnimationFrame(trackingRequest);
    resizeObserver.disconnect();
    layoutObserver.disconnect();
    poseObserver.disconnect();
    window.removeEventListener('resize', schedule);
    document.fonts?.removeEventListener?.('loadingdone', fontsLoaded);
    detachObserver.disconnect();
    if (releaseActiveStage === release) releaseActiveStage = null;
  };
  detachObserver.observe(document.body, { childList: true, subtree: true });
  // A late web font can resize the overhead stacks, so refit when a font load
  // finishes. Not `document.fonts.ready`: reading that getter flushes style and
  // layout of the half-built screen, and with the fonts already in it settled
  // straight after the mount and ran a second full fit (every combatant's boxes
  // measured again) before the fight's first paint. The fit at mount already
  // used whatever fonts were loaded; only a load still to finish needs a refit.
  // (The field's ResizeObserver still delivers its first observation and refits
  // once after mount, as before.)
  const fontsLoaded = () => { if (field.isConnected) schedule(); };
  document.fonts?.addEventListener?.('loadingdone', fontsLoaded);
  releaseActiveStage = release;
  refresh();
  return Object.freeze({ refresh, release });
}
