import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, uiZoom, VIEWPORT_ORIGIN } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { combatOverheadAnchors, combatOverheadRibbonShift, combatTargetAnchors } from '../models/CombatOverheadModel.js';
import { formationTileGeometry } from '../models/FormationGridModel.js';
import { FORMATION_ROWS, formationDimensions, isFormationCell } from '../../model/formationLayout.js';
import { fitIconTray } from './iconTray.js';
import { combatSpriteRatio } from '../models/CombatSpriteScaleModel.js';
import { wireAlternativeBackdrop, fitAlternativeBackdrop } from '../alternativeArt.js';
import { combatSpriteGeometry } from './combatSpriteGeometry.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { targetOutline } from '../models/TargetLayerModel.js';
import { fitSceneBackdrop } from './sceneBackdrop.js';
import { battlefieldBackdropConfig } from '../models/SceneLayerModel.js';
import { presentationConfig } from '../../model/advancedConfig.js';
import { alternativeFormation, fitAlternativeSprites } from '../models/AlternativeFormationModel.js';
import { combatComposition } from '../models/CombatCompositionModel.js';

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
    // No combatants yet (the wiring's own call, before the first render): there
    // is nothing to fit, so do not force a layout of the half-built screen.
    const frames = [...field.querySelectorAll('.combatant[data-ui-component="combatant-frame"]')];
    if (!frames.length) return;
    const fieldRect = field.getBoundingClientRect();
    // clientWidth excludes a vertical scrollbar. Comparing it with the full
    // rendered box inflated zoom on phone co-op and lifted feet off the floor.
    const zoom = fieldRect.width / field.offsetWidth || 1;
    // WCO1 headroom: the HUD band's bottom edge, in the field's local px.
    const hudBand = combat.querySelector(':scope > .topbar');
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
    alternativeFormation(plan, fieldRect.width, fieldRect.height, document.documentElement.dataset.layout === 'narrow');
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
      const geometry = combatSpriteGeometry(sprite, schedule);
      const enemyId = sprite.firstElementChild.dataset.enemyId;
      const ratio = combatSpriteRatio(frame.dataset.stature, enemyId);
      const leadingHost = frame.querySelector('.combatant-leading');
      const leadingHeight = leadingHost ? leadingHost.getBoundingClientRect().height / zoom : 0;
      // Inspect and intent stack vertically except on short landscape screens,
      // where their complete side-by-side union must stay inside the field.
      // Decorative shortcut keys do not enlarge the actionable control box.
      const leadingRects = leadingHost ? [...leadingHost.querySelectorAll(':scope > .overhead-control')]
        .map(control => control.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0) : [];
      const leadingWidth = leadingRects.length ? (Math.max(...leadingRects.map(rect => rect.right))
        - Math.min(...leadingRects.map(rect => rect.left))) / zoom : 0;
      const multiplier = (presentation[`row${FORMATION_ROWS[slot.row]}Scale`] ?? 1) * (frame.classList.contains('player') ? presentation.playerSpriteScale : presentation.enemySpriteScale)
        * wireframeUi.formation.displayScale * (slot.characterScale || 1);
      return { slot, side: frame.classList.contains('player') ? 'player' : 'enemy', frame, stack, sprite, ratio, enemyId, multiplier, ...geometry, leadingHost,
        // The overhead stack's own height (Inspect, when shown, over the
        // intent), in local px, for the headroom clamp below.
        leadingHeight, leadingWidth,
        // Reading controls do not change the unselected fitting envelope.
        leading: Math.max(Math.min(66, fieldRect.height * .25), leadingHeight * zoom + ceiling * zoom + 14) };
    });
    const narrow = document.documentElement.dataset.layout === 'narrow';
    const handRect = combat.querySelector('.hand')?.getBoundingClientRect();
    const handLeft = handRect?.left ?? fieldRect.left;
    const solo = actors.filter(actor => actor.side === 'player').length === 1 && !combat.classList.contains('coop');
    combat.dataset.composition = 'option-c';
    combat.dataset.waistOverlap = String(solo && window.innerHeight > 480);
    if (window.innerHeight <= 480) for (const actor of actors) {
      actor.slot = { ...actor.slot, fitGround: fieldRect.height - 24, ground: fieldRect.height - 24 };
    }
    const fitFormation = () => {
      const sizes = combatComposition({ width: fieldRect.width, height: fieldRect.height, actors,
        handTop: handRect ? handRect.top - fieldRect.top + 22 : null,
        handLeft: handLeft - fieldRect.left,
        solo: solo && window.innerHeight > 480,
        sizes: fitAlternativeSprites({ width: fieldRect.width, height: fieldRect.height, actors, narrow }) });
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
      const overheads = combatOverheadAnchors({ width: fieldRect.width, ribbon,
        controls: actors.filter(actor => actor.leadingWidth > 0 && sizes.some(size => size.id === actor.slot.id)).map(actor => {
          const fitted = sizes.find(size => size.id === actor.slot.id);
          const bottom = (fitted.ground ?? actor.slot.ground) - fitted.visibleHeight * growthFor(actor, fitted) - 14;
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
      const ribbonLeading = actor => actor.leadingHeight * zoom + ribbon.bottom + 14;
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
    const placed = [];
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
      const x = overheads.find(overhead => overhead.id === slot.id)?.x ?? fitted.x;
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
      sprite.style.zIndex = String(slot.layer + (growth > 1 ? wireframeUi.formation.focusPriority : 0));
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
        const overheadTop = ground - visibleHeight - 14 - actor.leadingHeight * zoom;
        const overheadShift = overheads.find(overhead => overhead.id === slot.id)?.offsetY
          ?? combatOverheadRibbonShift({ x: overheadX, width: actor.leadingWidth * zoom,
            top: overheadTop, bottom: overheadTop + actor.leadingHeight * zoom, ribbon });
        leadingHost.style.translate = `0 ${overheadShift / zoom}px`;
      }
      // The fitter reserves the complete card and action stack. Keep this gap
      // fixed in screen pixels, independent of art resolution or sprite size.
      frame.style.setProperty('--overhead-top', `${-14 / zoom}px`);
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
        .map(footer => footer.getBoundingClientRect().width)),
      controls: [...frame.querySelectorAll('.combatant-leading button')]
        .map(control => control.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0),
    }));
    const targets = combatTargetAnchors({ width: fieldRect.width, height: fieldRect.height,
      lockX: true, size: Math.max(44, ...boxes.map(box => box.intentRect?.height || 0)),
      obstacles: boxes.flatMap(box => box.controls.map(rect => ({
        left: rect.left - fieldRect.left, right: rect.right - fieldRect.left,
        top: rect.top - fieldRect.top, bottom: rect.bottom - fieldRect.top,
      }))),
      targets: boxes.map((box, i) => ({ ...box, id: placed[i].frame.dataset.eid }))
        .filter(box => box.frameRect).map(box => ({
        id: box.id,
        x: box.hostRect.left + box.hostRect.width / 2 - fieldRect.left,
        y: box.hostRect.bottom - fieldRect.top + (box.intentRect ? box.intentRect.height / 2 : 0),
        width: Math.max(box.footerWidth, box.intentRect?.width || 0),
      })) });
    placed.forEach(({ frame, sprite, scale }, i) => {
      const { hostRect, frameRect, artRect, intentRect } = boxes[i];
      frame.dataset.intentVisibility = frame.querySelector('.intent')?.dataset.intentVisibility || 'known';
      if (intentRect) {
        frame.style.setProperty('--enemy-hit-width', `${intentRect.width / zoom}px`);
        frame.style.setProperty('--enemy-hit-height', `${intentRect.height / zoom}px`);
      }
      if (frameRect) {
        const target = targets.find(target => target.id === frame.dataset.eid);
        const local = anchorLocalBox(frameRect, { left: fieldRect.left + target.x,
          top: fieldRect.top + target.y, width: 44, height: 44 }, { zoom });
        frame.style.setProperty('--enemy-hit-x', `${local.left}px`);
        frame.style.setProperty('--enemy-hit-y', `${local.top}px`);
        frame.dataset.targetObstructed = String(!!target.obstructed);
        const offset = anchorLocalBox(VIEWPORT_ORIGIN, {
          left: fieldRect.left + target.x - hostRect.left - hostRect.width / 2,
          top: fieldRect.top + target.y - hostRect.bottom - (intentRect ? intentRect.height / 2 - 5 : 0), width: 0, height: 0 }, { zoom });
        // Keep the visible name/health footer with its tap target. Packing
        // only the invisible target would leave no cue to the intended owner.
        for (const footer of frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')) {
          footer.style.translate = `${offset.left}px ${offset.top}px`;
          footer.style.position = 'relative';
          footer.style.zIndex = '900';
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
    for (const frame of frames) fitIconTray(frame.querySelector('.statuses'), nameWidth);
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
    fitAlternativeBackdrop(combat, { width: rect.width / zoom, height: fieldRect.height / zoom,
      fieldTop: (fieldRect.top - rect.top) / zoom, ground: plan.ground / zoom, narrow });
    const fieldTop = (fieldRect.top - rect.top) / zoom;
    const sceneHeight = fieldTop + fieldRect.height / zoom;
    if (backdrop) fitSceneBackdrop(backdrop, {
      width: backdropWidth, height: rect.height / zoom, zoom,
      windowTop: 0, windowHeight: sceneHeight,
      config: battlefieldBackdropConfig({ height: sceneHeight,
        fieldTop, fieldHeight: fieldRect.height / zoom,
        formation: { cells: plan.cells.map(cell => ({ ground: cell.ground / zoom })), rowSpacing: plan.rowSpacing / zoom } }),
    });
    field.dataset.groundY = String(fieldRect.top + plan.ground);
  };
  const schedule = () => { cancelAnimationFrame(frameRequest); frameRequest = requestAnimationFrame(refresh); };
  const combatHost = field.closest('.combat');
  const releaseBackdrop = wireAlternativeBackdrop(combatHost);
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
    releaseBackdrop();
    combatHost.removeEventListener('combatantselectionchange', schedule);
    cancelAnimationFrame(frameRequest);
    resizeObserver.disconnect();
    layoutObserver.disconnect();
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
