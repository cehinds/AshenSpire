import { wireLayeredEnvironment } from './layeredEnvironment.js';
import { mobileFloorShadowTop, holdFloorShadowTop } from '../models/MobileFloorModel.js';
import { uiConfig } from '../../config/generated/ui.js';
import { logicalViewport } from '../viewViewport.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { anchorLocalBox, uiZoom } from '../fx.js';
import { combatFormation } from '../models/CombatFormationModel.js';
import { isWideFormFactor } from '../models/FormFactorModel.js';
import { COMBAT_TARGET_HIT_PX, combatOverheadAnchors, combatOverheadRibbonShift, combatTargetAnchors, combatTargetPackSize } from '../models/CombatOverheadModel.js';
import { formationTileGeometry, perspectiveCellOutlinePath } from '../models/FormationGridModel.js';
import { FORMATION_ROWS, formationDimensions, playerFormationCell } from '../../model/formationLayout.js';
import { fitIconTray } from './iconTray.js';
import { combatSpriteRatio, fitCombatSprites, NARROW_MIN_HEIGHT_FRACTION } from '../models/CombatSpriteScaleModel.js';
import { stageFor } from '../services/PoseAnimator.js';
import { combatSpriteGeometry, currentSpriteArtBounds, currentSpriteBodyBounds, invalidateSpriteRects } from './combatSpriteGeometry.js';
import { classicAppearance, displayAppearance } from '../displayAppearance.js';
import { wireAlternativeBackdrop, fitAlternativeBackdrop } from '../alternativeArt.js';
import { wireframeUi } from '../../content/wireframeUi.js';
import { targetOutline } from '../models/TargetLayerModel.js';
import { fitSceneBackdrop } from './sceneBackdrop.js';
import { battlefieldBackdropConfig } from '../models/SceneLayerModel.js';
import { presentationConfig } from '../../model/advancedConfig.js';
import { alternativeCombatComposition, combatComposition as classicCombatComposition, combatSceneryGround, combatStandingGround, stableHandAnchor, combatArtworkKey, stableCombatArtwork } from '../models/CombatCompositionModel.js';
import { alternativeFormation, fitAlternativeSprites } from '../models/AlternativeFormationModel.js';
import { perspectiveCellContains, overheadGroupHeightPx } from '../models/AlternativeFormationModel.js';
import { playerDetailsPlacement } from '../models/PlayerDetailsPlacementModel.js';
import { hudGeometry, offsetPlacement, offsetTargetPlate, targetPlateBox } from '../models/HudLayoutOffsetModel.js';
import { restingHandEnvelope, handGeometryKey } from '../models/HandLayout.js';
import { targetBodyHudPlacement } from '../models/TargetHudModel.js';
import { reducedMotionRequested } from '../motion.js';
import { layoutMetrics, rootStyle } from '../layoutMetrics.js';
import { separateOverheadIntents } from './overheadIntentSeparation.js';
import { perfCount } from '../performance.js';
// The overhead group's height above a head: config only, never a DOM measurement. A measured height changes with
// selection (a selected frame hides its meters) and would refit the settled artwork on every click.
const miniHudGroupHeight = grid => overheadGroupHeightPx(grid, {
  wide: isWideFormFactor(document.documentElement.dataset.formFactor),
  tall: window.matchMedia('(min-width: 1200px)').matches,
  shortWindow: window.matchMedia('(min-width: 1200px) and (max-height: 800px)').matches });

// These classes change controls, tint or outlines, not the figure's pose.
// Unknown classes remain conservative: action/reaction transforms still track.
const PRESENTATION_CLASSES = new Set(['target-hud-selected', 'target-hud-focused', 'target-hud-candidate',
  'armed', 'skill-selected', 'targetable', 'hover-target', 'gp-focus']);
export function combatantBodyMutation(mutation, detailedHud = false) {
  const { target, attributeName, oldValue } = mutation;
  const value = target.getAttribute(attributeName);
  if (oldValue === value) return false;
  if (attributeName !== 'class') return true;
  if (!target.matches?.('.combatant, .sprite')) return false;
  const bodyClasses = classes => (classes || '').split(/\s+/).filter(name => name && !PRESENTATION_CLASSES.has(name)
    // Legacy inspection enlarges the sprite; the detailed HUD explicitly does not.
    && !(detailedHud && name === 'context-selected')).sort().join(' ');
  return bodyClasses(oldValue) !== bodyClasses(value);
}

// Long range labels may cross the viewport edge when their actor stands at a
// flank. Clamp only the label; fitted figures and their anchors stay unchanged.
export function hitBadgeCenter({ bodyCenter, badgeWidth, left, right }) {
  if (badgeWidth >= right - left) return (left + right) / 2;
  return Math.max(left + badgeWidth / 2, Math.min(right - badgeWidth / 2, bodyCenter));
}

// Formation positions and adjustment deltas already use field-local physical
// coordinates. A centred view preset must not subtract its viewport inset again.
const FORMATION_LOCAL_ORIGIN = Object.freeze({ left: 0, top: 0 });

// Absolute information rows can paint below the header border box. Reserve
// their actual visible extent in the existing formation fit, so the body and
// its overhead move/fit together rather than pushing a badge onto its fighter.
export function combatHeaderKeepoutBottom(header) {
  if (!header) return null;
  let bottom = header.getBoundingClientRect().bottom;
  for (const row of header.querySelectorAll('.hud-info-row')) {
    if (row.hidden) continue;
    const box = row.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && !['hidden', 'collapse'].includes(getComputedStyle(row).visibility)) bottom = Math.max(bottom, box.bottom);
  }
  return bottom;
}

// Presentation-only adjustment: header clearance moves the compact readout,
// never the sprite's fitted position, foot anchor, or scale.
export function targetOverheadPlacement({ art, box, headerBottom, gap = 14, zoom = 1 }) {
  const preferredTop = art.top - gap - box.height;
  const top = Math.max(preferredTop, Number.isFinite(headerBottom) ? headerBottom + 4 : -Infinity);
  return { dx: ((art.left + art.right - box.left - box.right) / 2) / zoom,
    dy: (top - box.top) / zoom };
}

// Core uses the painted sprite as its usual target. Only genuinely tiny art
// needs an independent physical44px door. A narrow silhouette inside a
// sub44px box cannot guarantee a usable24px patch; normal art clears the door.
export function syncCoreTinyTarget(frame, art, frameBox, zoom = 1) {
  const keys = ['--enemy-hit-x', '--enemy-hit-y', '--enemy-hit-width', '--enemy-hit-height'];
  const width = art.right - art.left, height = art.bottom - art.top;
  const tiny = [art.left, art.right, art.top, art.bottom, frameBox.left, frameBox.top, zoom].every(Number.isFinite)
    && zoom > 0 && width > 0 && height > 0 && (width < COMBAT_TARGET_HIT_PX || height < COMBAT_TARGET_HIT_PX);
  for (const key of keys) frame.style.removeProperty(key);
  if (!tiny) { delete frame.dataset.coreTinyTarget; return false; }
  frame.dataset.coreTinyTarget = 'true';
  const values = [(art.left + width / 2 - frameBox.left) / zoom,
    (art.top + height / 2 - frameBox.top) / zoom, COMBAT_TARGET_HIT_PX / zoom, COMBAT_TARGET_HIT_PX / zoom];
  keys.forEach((key, index) => frame.style.setProperty(key, `${values[index]}px`));
  return true;
}

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

export function combatPlayerInfoRect(node, art, viewport, zoom, floor = Infinity) {
  if (!node) return null;
  const width = combatControlWidth(node, zoom);
  const height = node.getBoundingClientRect().height || width;
  if (!(width > 0 && height > 0)) return null;
  const left = (art.left + art.right) / 2 - width / 2;
  // Art whose top sits low (a waist-overlap player) must not carry the door
  // down under the resting hand or tools, which would take every tap on it.
  const top = Math.max(viewport.top, Math.min(art.top - height - 4, floor - height - 4));
  return { left, top, right: left + width, bottom: top + height, width, height };
}

// Owner (2026-10-11): the player's intent glyph (attack, smash, counter, defend,
// sweep, spell) stays above the figure's head while the player is not selected,
// so the stance reads at rest: centred over the art, below the HUD band. Selected,
// the Inspect "i" takes that centre (combatPlayerInfoRect), so the glyph steps
// just left of it (`avoid`, the visible Inspect rect), at the same height: the
// smallest move that keeps it off the Inspect tap target, half the Inspect
// width + a 4px gap + half the glyph width. Rightward if the left edge is short.
export function placePlayerIntentGlyph(leading, { art, hudBottom, zoom = 1, avoid = null, viewport = null }) {
  const node = leading.querySelector('.player-action-intent');
  if (!node) return null;
  const host = node.offsetParent || leading;
  const { width, height } = node.getBoundingClientRect();
  const floorTop = Number.isFinite(hudBottom) ? hudBottom + 2 : -Infinity;
  const top = Math.max(floorTop, art.top - height - 4);
  let centre = (art.left + art.right) / 2;
  const overlaps = avoid && centre - width / 2 < avoid.right && centre + width / 2 > avoid.left
    && top < avoid.bottom && top + height > avoid.top;
  if (overlaps) {
    const gap = 4;
    const leftCentre = avoid.left - gap - width / 2;
    centre = viewport && leftCentre - width / 2 < viewport.left ? avoid.right + gap + width / 2 : leftCentre;
  }
  const local = anchorLocalBox(host, { left: centre - width / 2, top, width, height }, { zoom });
  node.style.left = `${local.left}px`;
  node.style.top = `${local.top}px`;
  node.dataset.placed = 'true';
  return { centre, top, width, height };
}

// The selected-card action is independent of the reading panel, like Info.
export function combatPlayerActionRect(node, infoRect, art, zoom, floor = Infinity) {
  if (!node) return null;
  const width = combatControlWidth(node, zoom);
  const height = node.getBoundingClientRect().height || width;
  if (!(width > 0 && height > 0)) return null;
  const left = (art.left + art.right) / 2 - (infoRect?.width || 22) / 2 - 28;
  const top = Math.min(art.top - 28, floor - height - 4);
  return { left, top, right: left + width, bottom: top + height, width, height };
}

// A readable player panel can consume the only near-foot slot for another
// actor. Retry its placement once with those actors' physical cores reserved;
// retain the first layout unless the full footer pack actually improves.
// `targetCores` is the caller's settled reservation: it is cleared in place when
// the retry is refused, so the tracking pass never reapplies a rejected layout.
export function packCombatTargetsWithHud({ pack, placeHud, targetCores }) {
  const original = pack();
  const blocked = targets => targets.filter(target => target.obstructed);
  const ids = new Set(blocked(original).map(target => target.id));
  if (!ids.size) return original;
  placeHud(targetCores.filter(core => ids.has(core.id)));
  const retry = pack();
  if (blocked(retry).length < ids.size) return retry;
  placeHud([]);
  targetCores.length = 0;
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

// getBoundingClientRect and the placement obstacles are already in physical
// screen pixels. Match the CSS pseudo-element's 44px target without applying
// UI zoom a second time: 22px mark + 18px above + 4px below.
export function combatInspectTapBox({ left, top, width, height = width }) {
  return { left: left - 11, right: left + width + 11,
    top: top - 18, bottom: top + height + 4 };
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
  field.style.setProperty('--battlefield-hud-clearance', `calc(${model.tokens.hudClearanceViewportPct} * var(--view-vh, 1vh) / var(--ui-zoom, 1))`);
  field.style.setProperty('--battlefield-action-clearance', `calc(${model.tokens.actionClearanceViewportPct} * var(--view-vh, 1vh) / var(--ui-zoom, 1))`);
  field.style.setProperty('--combatant-stage-center', `${model.tokens.centerPct}%`);

  let frameRequest = 0;
  const loadedGeometry = layoutState.loadedGeometry ||= new Map();
  let trackingRequest = 0;
  let settledTargets = [], settledFooterSize = 44, settledTargetCores = [];
  let playerInfoRects = [];
  const labelMeasure = document.createElement('canvas').getContext('2d');
  function fitLabels() {
    if (!labelMeasure) return;
    // The zoom is read once, before any label's font size is written: each
    // uiZoom() is a computed-style read that flushes the pending style change,
    // and this loop made three per label (a phone profile put the reads at
    // about as much time as the fitting itself).
    const zoom = uiZoom();
    // Read every box and style first, then write every font size: a write
    // between two reads makes the next clientWidth a forced layout, once per
    // label.
    const fits = [];
    for (const label of field.querySelectorAll('.nm .ls-label, .intent-stance')) {
      const box = label.closest('.nm, .intent');
      const width = box.clientWidth - 8 / zoom;
      if (width <= 0) continue;
      const style = getComputedStyle(label);
      const maximum = (label.closest('.player.context-selected') && logicalViewport().width > 320 ? 12 : 11) / zoom;
      labelMeasure.font = `${style.fontWeight} ${maximum}px ${style.fontFamily}`;
      const measured = labelMeasure.measureText(label.textContent).width;
      fits.push([label, `${Math.max(8 / zoom, maximum * Math.min(1, width / Math.max(1, measured)))}px`]);
    }
    for (const [label, size] of fits) label.style.fontSize = size;
  }
  function readRestingHand() {
    const hand = field.closest('.combat').querySelector('.hand');
    if (!hand) return null;
    const envelope = restingHandEnvelope({ rect: hand.getBoundingClientRect(), clientWidth: hand.clientWidth,
      clientHeight: hand.clientHeight, fontSize: layoutMetrics().fontSize,
      geometry: hand.dataset.handGeometry, restLeft: parseFloat(hand.style.getPropertyValue('--hand-rest-left')),
      restTop: parseFloat(hand.style.getPropertyValue('--hand-rest-top')),
      clearanceTop: parseFloat(hand.style.getPropertyValue('--hand-clearance-top')) }, layoutState.restHandAnchor);
    if (envelope?.validated) layoutState.restHandAnchor = envelope;
    return envelope;
  }
  // The hit-% badge sits on the middle of the painted body, in the frame's own px (owner 2026-10-18). Independent of the
  // target HUD (Classic appearance has none), and only for a combatant that shows a badge. Split in two so a caller that
  // also reads (centerTargetOverheads) can read everything, then write everything: readHitBadges() does the reads and
  // returns the writes (null when there is no badge), and a value that did not change is not written again (this runs per
  // animation frame while tracking).
  function readHitBadges() {
    const frames = [...field.querySelectorAll('.combatant')].filter(frame => frame.querySelector(':scope > .combat-hit-chance'));
    if (!frames.length) return null;
    const zoom = uiZoom();
    const reads = frames.map(frame => {
      const sprite = frame.querySelector('.sprite');
      if (!sprite) return null;
      const body = currentSpriteBodyBounds(sprite, schedule), box = frame.getBoundingClientRect();
      const top = Number.isFinite(body.headY) ? body.headY : body.top, bottom = Number.isFinite(body.feetY) ? body.feetY : body.bottom;
      if (![body.left, body.right, top, bottom].every(Number.isFinite)) return null;
      const badge = frame.querySelector(':scope > .combat-hit-chance');
      const center = (body.left + body.right) / 2;
      const x = badge.dataset.rangeDetail === 'true' ? hitBadgeCenter({ bodyCenter: center, badgeWidth: badge.getBoundingClientRect().width, left: 8, right: globalThis.innerWidth - 8 }) : center;
      return { frame, x: `${(x - box.left) / zoom}px`, y: `${((top + bottom) / 2 - box.top) / zoom}px` };
    });
    return () => {
      for (const row of reads) {
        if (!row) continue;
        if (row.frame.style.getPropertyValue('--combat-body-center-x') !== row.x) row.frame.style.setProperty('--combat-body-center-x', row.x);
        if (row.frame.style.getPropertyValue('--combat-body-center-y') !== row.y) row.frame.style.setProperty('--combat-body-center-y', row.y);
      }
    };
  }
  function placeHitBadges() { invalidateSpriteRects(); readHitBadges()?.(); }
  // The detailed-target presentation owns its side panels. Only the compact
  // overhead follows the visible figure; selecting it never moves that figure.
  // One pass, in phases: every read (hit badges, each figure's body and box),
  // then every style write, then the reads that depend on those writes (the
  // overhead's own box after its reset), then the final translate. A write
  // between two reads made each following read a forced layout, once per
  // combatant per tracked frame.
  // Reads the settled intents after the rack writes above, then writes one
  // sideways offset per intent (a CSS variable the stylesheet applies).
  // The shifts are a pure function of where the intents rest unshifted, which
  // follows from the frame's box, the intent's size and the placement variables
  // written just before (a shift moves only an intent's `left`, never its size
  // or its frame). A pass that finds all of those as the last pass did, on the
  // same intent elements still holding the shifts written, keeps them and skips
  // the reset that made every intent read a forced layout.
  let racksKey = '', racksIntents = [], racksShifts = [];
  const shiftOf = intent => intent.style.getPropertyValue('--combat-intent-shift');
  function separateRackedIntents(racked, zoom) {
    const rows = racked.filter(row => row.intent);
    if (rows.length < 2) {
      racksKey = '';
      for (const { intent } of rows) if (shiftOf(intent)) intent.style.removeProperty('--combat-intent-shift');
      return;
    }
    const fieldBox = field.getBoundingClientRect();
    const key = [fieldBox.left, fieldBox.right, zoom, ...rows.map(({ frame, intent }) => {
      const frameBox = frame.getBoundingClientRect(), box = intent.getBoundingClientRect(), style = frame.style;
      const rack = intent.parentElement.getBoundingClientRect();
      return [frameBox.left, frameBox.top, frameBox.width, rack.left, rack.width, box.width, box.height, box.top, intent.className, intent.textContent,
        style.getPropertyValue('--combat-mini-hud-top'), style.getPropertyValue('--combat-selected-intent-top'),
        style.getPropertyValue('--combat-selected-intent-center')].join('|');
    })].join('\n');
    if (key === racksKey && rows.every(({ intent }, i) => intent === racksIntents[i] && shiftOf(intent) === racksShifts[i])) return;
    for (const { intent } of rows) if (shiftOf(intent)) intent.style.removeProperty('--combat-intent-shift');
    const items = rows.map(({ frame, intent }, id) => {
      const box = intent.getBoundingClientRect();
      return { id, left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        movable: intent.classList.contains('player-action-intent'), visible: box.width > 0 && box.height > 0 };
    }).filter(item => item.visible);
    const shifts = separateOverheadIntents(items, { left: fieldBox.left, right: fieldBox.right }, 4 * zoom);
    for (const [id, dx] of shifts) if (dx) rows[id].intent.style.setProperty('--combat-intent-shift', `${dx / zoom}px`);
    racksKey = key;
    racksIntents = rows.map(row => row.intent);
    racksShifts = rows.map(row => shiftOf(row.intent));
  }
  function centerTargetOverheads() {
    perfCount('hudPass');
    invalidateSpriteRects();
    const zoom = uiZoom();
    const commitBadges = readHitBadges();
    const config = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
    const racked = [], plain = [];
    for (const frame of field.querySelectorAll('.combatant')) {
      const sprite = frame.querySelector('.sprite'), leading = frame.querySelector('.combatant-leading');
      if (!sprite || !leading) continue;
      const rack = frame.querySelector(':scope > .target-hud-overhead-meters');
      if (rack) {
        const body = currentSpriteBodyBounds(sprite, schedule);
        const intentHeight = rack.querySelector(':scope > :is(.intent,.player-action-intent)')?.getBoundingClientRect().height || 37;
        racked.push({ frame, body, intent: rack.querySelector(':scope > :is(.intent,.player-action-intent)'), placement: targetBodyHudPlacement({ body, frame: frame.getBoundingClientRect(),
          groupHeight: miniHudGroupHeight(config), intentHeight, gap: config.miniHudSpriteGapPx, zoom }) });
      } else plain.push({ frame, sprite, leading });
    }
    const headerBottom = plain.length ? field.closest('.combat')?.querySelector(':scope > .topbar')?.getBoundingClientRect().bottom : undefined;
    commitBadges?.();
    for (const { frame, body, placement } of racked) {
      for (const [name, value] of [
        ['--combat-mini-hud-top', `${placement.miniTop}px`],
        ['--combat-selected-intent-top', `${placement.selectedTop}px`],
        ['--combat-selected-intent-center', `${placement.center}px`],
      ]) if (frame.style.getPropertyValue(name) !== value) frame.style.setProperty(name, value);
      const head = String(body.headY ?? body.top);
      if (frame.dataset.miniHudHeadY !== head) frame.dataset.miniHudHeadY = head;
    }
    for (const { frame, leading } of plain) {
      leading.style.left = '0px';
      leading.style.top = 'var(--combat-elev, 0px)';
      leading.style.translate = 'none';
      delete frame.dataset.overheadObstructed;
    }
    if (!plain.length) { separateRackedIntents(racked, zoom); return; }
    const gap = field.closest('.combat')?.dataset.compactCombat === 'true' ? 4 : 14;
    const placements = plain.map(({ frame, sprite, leading }) => {
      const art = currentSpriteArtBounds(sprite, schedule), box = leading.getBoundingClientRect();
      return { frame, leading, ...targetOverheadPlacement({ art, box, headerBottom, gap, zoom }) };
    });
    for (const { leading, dx, dy } of placements) leading.style.translate = `${dx}px ${dy}px`;
    separateRackedIntents(racked, zoom);
  }

  function placePlayerHud(reserveFirst = false, targetCores = [], tick = false) {
    if (field.closest('.combat')?.dataset.targetHud === 'true') { centerTargetOverheads(); return; }
    // A player's Inspect over the head must not hide an enemy's intent or
    // Inspect. It takes the head's left, the field's left edge, or the head's
    // right before accepting an overlap. Declared here so the placement source
    // stays one self-contained unit.
    const clearOfEnemyControls = (rect, art, viewport, zoom) => {
      if (!rect) return rect;
      const controls = [...field.querySelectorAll('.enemy .combatant-leading > .intent, .enemy .combatant-leading > .combatant-info')]
        .map(node => visibleCombatPanelRect(node, field)).filter(Boolean);
      // The 44 px tap pad counts: a neighbour's control must not sit under it.
      const pad = 11 * zoom;
      const hits = box => controls.some(c => box.left - pad < c.right && box.right + pad > c.left
        && box.top - pad < c.bottom && box.bottom + pad > c.top);
      if (!hits(rect)) return rect;
      const gap = 4 * zoom;
      // Head's left, the field's left edge, then the head's right; each on the
      // head's row first, then one and two rows higher.
      const lefts = [art.left - gap - rect.width, viewport.left + gap, art.right + gap];
      const tops = [rect.top, rect.top - rect.height - gap, rect.top - 2 * (rect.height + gap)];
      for (const top of tops) for (const left of lefts) {
        const moved = { ...rect, left, right: left + rect.width, top, bottom: top + rect.height };
        if (left >= viewport.left && moved.right <= viewport.right && top >= viewport.top && !hits(moved)) return moved;
      }
      return rect;
    };
    const zoom = uiZoom();
    const combat = field.closest('.combat');
    // HUD layout geometry tokens (docs/hud-layout-tokens.md), read once per pass.
    const hudOffsets = hudGeometry(rootStyle);
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
      const doorFloor = Math.min(toolsBox?.top ?? Infinity, handTop ?? Infinity);
      // The Info door keeps its offset from the figure's stack, which only a
      // layout refit moves. Idle bob and pose motion read the live artwork, so
      // they never move the door; the frame tick (tick = true) follows the stack.
      const offset = tick ? player.inspectOffset : null;
      const infoRect = offset && inspect ? { left: stack.left + offset.x, top: stack.top + offset.y, width: offset.width,
        height: offset.height, right: stack.left + offset.x + offset.width, bottom: stack.top + offset.y + offset.height }
        : clearOfEnemyControls(combatPlayerInfoRect(inspect, art, viewport, zoom, doorFloor), art, viewport, zoom);
      if (!tick) player.inspectOffset = infoRect ? { x: infoRect.left - stack.left, y: infoRect.top - stack.top,
        width: infoRect.width, height: infoRect.height } : null;
      const actionRect = combatPlayerActionRect(action, infoRect, art, zoom, doorFloor);
      return [{ player, leading, art, stack, viewport, panel, inspect, action, infoRect, actionRect }];
    });
    // Reserve every seat's intended Info/action doors before placing any panel,
    // including selectable doors that have not painted yet.
    playerInfoRects = players.flatMap(({ infoRect, actionRect }) => [infoRect, actionRect]).filter(Boolean);
    panels.push(...playerInfoRects);
    for (const { player, leading, art, stack, viewport, panel, inspect, infoRect } of players) {
      const expanded = player.classList.contains('context-selected');
      const panelGap = expanded && viewport.width <= 320 ? 3 : 4;
      const idleLeft = Math.max(viewport.left + 4, Math.min(art.left + (art.width - panel.width) / 2, viewport.right - panel.width - 4));
      const idleTop = classicAppearance()
        ? Math.min(art.bottom + 3, Math.min(toolsBox?.top ?? Infinity, handTop ?? Infinity) - panel.height - 4)
        : Math.max((combat.querySelector('.combat-hud')?.getBoundingClientRect().bottom ?? viewport.top) + 4, art.top - panel.height - 14);
      const handFloor = Math.min(toolsBox?.top ?? Infinity, handTop ?? Infinity);
      const hudBottom = combat.querySelector('.combat-hud')?.getBoundingClientRect().bottom;
      // The panel's previous spot without the token offset applied last pass,
      // so a kept position never accumulates the offset frame after frame.
      const applied = player.hudDetailsShift || { x: 0, y: 0 };
      const placed = playerDetailsPlacement({
        art: expanded ? { ...art, top: art.bottom - panel.height } : { ...art, right: idleLeft - 4, top: idleTop - 16 },
        width: panel.width, height: panel.height, viewport, gap: panelGap,
        handTop: handFloor,
        previous: reserveFirst === true ? undefined : { left: panel.left - applied.x, top: panel.top - applied.y },
        hudBottom, obstacles: panels });
      // The details offset tokens, added after placement and clamped to the
      // same field, header and hand edges; an offset onto another control is
      // refused (HudLayoutOffsetModel). Both 0: `placed` exactly.
      const shift = offsetPlacement({ rect: { left: placed.left, top: placed.top, width: panel.width, height: panel.height },
        dx: hudOffsets.playerDetailsDx * zoom, dy: hudOffsets.playerDetailsDy * zoom,
        bounds: { left: viewport.left + 4, right: viewport.right - 4, top: Number.isFinite(hudBottom) ? hudBottom : viewport.top,
          bottom: Number.isFinite(handFloor) ? handFloor - 4 : viewport.bottom },
        obstacles: panels });
      const placement = !classicAppearance() && !expanded ? { ...placed, left: idleLeft, top: idleTop }
        : shift.shifted ? { ...placed, left: shift.left, top: shift.top } : placed;
      player.hudDetailsShift = { x: placement.left - placed.left, y: placement.top - placed.top };
      panels.push({ ...placement, right: placement.left + panel.width, bottom: placement.top + panel.height });
      const top = `${(placement.top - stack.top) / zoom}px`;
      const left = `${(placement.left - stack.left) / zoom}px`;
      if (leading.style.top !== top) leading.style.top = top;
      if (leading.style.left !== left) leading.style.left = left;
      leading.style.translate = 'none';
      // Selected, the Inspect door is visible: the glyph keeps off it.
      placePlayerIntentGlyph(leading, { art, hudBottom, zoom, avoid: expanded ? infoRect : null, viewport });
      for (const [door, rect] of [[inspect, infoRect]]) {
        if (!rect) continue;
        const local = anchorLocalBox({ left: placement.left, top: placement.top, width: panel.width, height: panel.height }, rect, { zoom });
        door.style.left = `${local.left}px`;
        door.style.top = `${local.top}px`;
        // The Info door stays visibility:hidden until its spot is written, so
        // it never paints at a temporary position and then moves.
        if (door === inspect) door.dataset.placed = 'true';
      }
      player.dataset.spriteArtTop = String(art.top);
      player.dataset.playerHudGap = String(art.top - leading.getBoundingClientRect().bottom);
    }
  }
  // Floor shadows follow the visible idle silhouette, independent of HUD size.
  function syncFloorShadows() {
    for (const frame of field.querySelectorAll('.combatant')) {
      const sprite = frame.querySelector('.sprite');
      if (!sprite) continue;
      const art = currentSpriteArtBounds(sprite, schedule);
      const spriteWidth = sprite.getBoundingClientRect().width;
      const artWidth = art.right - art.left;
      if (!(artWidth > 0 && spriteWidth > 0)) continue;
      sprite.style.setProperty('--floor-shadow-width', `${(artWidth / spriteWidth * 100).toFixed(2)}%`);
    }
  }
  // Every living enemy's Inspect hangs above its intent. The default spot is
  // read after the refit; it moves to the intent's left or right only when the
  // 44 px tap area above would sit under the HUD, the turn ribbon, or another
  // combatant's control. Nothing here reserves room in the fitted envelope.
  // Reads every box first, then writes only the sides that change, so a pass
  // costs one layout read and no forced re-layout between enemies.
  function placeEnemyInspect() {
    const combat = field.closest('.combat');
    const infos = [...field.querySelectorAll('.combatant.enemy:not(.dead) > .combatant-stack > .combatant-leading > .combatant-info')];
    if (!infos.length || !combat) return;
    const viewport = combat.getBoundingClientRect();
    const hudBoxes = [...combat.ownerDocument.querySelectorAll('.topbar, .combat-hud, .turn-ribbon, .combat-tools')]
      .map(node => visibleCombatPanelRect(node, combat)).filter(Boolean);
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const gap = 4;
    // Other combatants' controls, excluding Inspect marks: those are placed by
    // this pass and tracked from their planned boxes below.
    const controls = [...field.querySelectorAll('.combatant-leading > .intent, .combatant-leading > .player-action-intent, .combatant.player .combatant-leading > .combatant-info, .combatant-mini-hud, .combatant-card > .nm, .combatant-card > .meters')]
      .map(node => ({ node, rect: visibleCombatPanelRect(node, combat) })).filter(entry => entry.rect);
    const measured = infos.map(info => ({ info, size: info.getBoundingClientRect().width,
      anchor: info.parentElement, box: info.parentElement.getBoundingClientRect() }));
    const planned = [], sides = [];
    for (const { info, size, anchor, box } of measured) {
      if (!(size > 0) || !(box.width > 0)) { sides.push(null); continue; }
      // Each spot with its 44 px tap box. A side spot never reaches into the intent.
      const centre = box.left + box.width / 2;
      const spots = [
        ['', { left: centre - size / 2, top: box.top - gap - size }],
        ['left', { left: box.left - gap - size, top: box.top }],
        ['right', { left: box.right + gap, top: box.top }],
        // Beside the intent's top corners, for a back-row figure wedged between
        // neighbouring intents, where the ribbon ends.
        ['left-up', { left: box.left - gap - size, top: box.top - gap - size }],
        ['right-up', { left: box.right + gap, top: box.top - gap - size }],
        // One mark further out, past a turn ribbon that ends beside the intent.
        ['right-far-up', { left: box.right + gap + size, top: box.top - gap - size }],
        // Last resort, below the overhead on this enemy's own art: a tap that
        // misses the mark still selects this same enemy.
        ['below', { left: centre - size / 2, top: box.bottom + gap }],
      ].map(([side, at]) => [side, at, combatInspectTapBox({ ...at, width: size })]);
      // A readout hung below the feet keeps Inspect below or beside its
      // intent: a spot above it would put the tap area over the fighter.
      if (info.closest('.combatant')?.dataset.hudBelow) spots.splice(0, spots.length, ...['below', 'left', 'right'].map(side => spots.find(([s]) => s === side)));
      // Our own intent is the anchor; every tap pad must clear everything else,
      // including the Inspect marks already planned this pass.
      const others = [...controls.filter(({ node }) => !(node.matches('.intent') && node.parentElement === anchor)).map(({ rect }) => rect),
        ...planned];
      const mark = at => ({ left: at.left, top: at.top, right: at.left + size, bottom: at.top + size });
      // The painted 22 px mark must clear the HUD; its tap pad must clear the
      // other combatants' controls.
      const pick = spots.find(([, at, tap]) => tap.left >= viewport.left && tap.right <= viewport.right && tap.top >= viewport.top
        && !hudBoxes.some(hud => overlaps(mark(at), hud)) && !others.some(rect => overlaps(tap, rect)));
      // With every spot taken (a back-row figure wedged under the ribbon),
      // keep the mark reachable on the figure's own art rather than hidden.
      const chosen = pick || (hudBoxes.some(hud => overlaps(mark(spots[0][1]), hud)) ? spots.at(-1) : spots[0]);
      planned.push(chosen[2]);
      sides.push(chosen[0]);
    }
    measured.forEach(({ info }, i) => {
      // Not displayed (unselected): its spot is no longer current, so the
      // door must be placed again before it can show.
      if (sides[i] == null) { delete info.dataset.placed; return; }
      if (sides[i]) { if (info.dataset.inspectSide !== sides[i]) info.dataset.inspectSide = sides[i]; }
      else if (info.hasAttribute('data-inspect-side')) info.removeAttribute('data-inspect-side');
      info.dataset.placed = 'true';
    });
  }
  let inspectTick = 0;
  // Pose animations (attacks, hurt, stance) settle well inside this window.
  const TRACK_WINDOW_MS = 900;
  let trackUntil = 0;
  // A class change can start a pose whose first frames read the same as rest (an eased lunge at 0%), so the
  // early stop waits this long after the latest change before two unmoved frames may end the window.
  const TRACK_SETTLE_MS = 120;
  let trackChangedAt = 0;
  const extendTracking = () => { trackChangedAt = performance.now(); trackUntil = trackChangedAt + TRACK_WINDOW_MS; trackFresh = true; if (!trackingRequest) trackStable = 0; };
  // Tracking only has work while a body actually moves. Each frame compares every figure's painted body with the
  // previous frame's (kept across windows, so a selection that moves nothing settles at once): the first frame of a
  // window always places, a frame whose bodies did not move (within half a pixel) skips the placement, and two such
  // frames in a row end the window. Lite samples every second frame, except the one that closes the window.
  let trackFresh = true, trackStable = 0, trackTick = 0, trackBodies = null;
  const lite = () => document.documentElement.dataset.performance === 'lite';
  // Classic figures report no `busy`: their actions are finite CSS animations (a hit holds its displaced pose
  // mid-way, then recovers with no attribute change), so a running one counts as busy. The idle bob loops forever
  // and does not.
  const figureBusy = sprite => !!stageFor(sprite)?.busy
    || !!(sprite.closest?.('.combatant') || sprite).getAnimations?.({ subtree: true })
      .some(animation => animation.playState === 'running' && animation.effect?.getTiming?.().iterations !== Infinity);
  function trackedBodies() {
    const rows = [];
    for (const sprite of field.querySelectorAll('.combatant .sprite')) {
      const body = currentSpriteBodyBounds(sprite, schedule);
      rows.push(body.left, body.right, body.top, body.bottom, body.headY, body.feetY);
    }
    return rows;
  }
  const sameBodies = (a, b) => !!a && !!b && a.length === b.length
    && a.every((value, i) => value === b[i] || Math.abs(value - b[i]) <= .5 || (Number.isNaN(value) && Number.isNaN(b[i])));
  function trackPlayerHud() {
    perfCount('hudTrack');
    invalidateSpriteRects();
    // Reduced motion has no idle or pose drift to follow. Do not turn the HUD
    // into a script-driven animation by rewriting its settled coordinates.
    if (reducedMotionRequested()) { trackingRequest = 0; return; }
    const open = field.isConnected && field.querySelector('.combatant.player') && performance.now() < trackUntil;
    if (open && lite() && trackTick++ % 2 === 1) { trackingRequest = requestAnimationFrame(trackPlayerHud); return; }
    const bodies = trackedBodies();
    const same = sameBodies(bodies, trackBodies), place = trackFresh || !same;
    trackFresh = false;
    trackBodies = bodies;
    // A pose sequence, reaction or hit-stop hold can pause the body and then move it again with no attribute change,
    // so an unmoved frame only counts toward the early stop while every figure is at rest.
    trackStable = same && ![...field.querySelectorAll('.combatant .sprite')].some(figureBusy) ? trackStable + 1 : 0;
    if (place) {
      // Keep the settled target cores reserved, or the HUD can snap back over the player target.
      placePlayerHud(false, settledTargetCores, true);
      if (field.closest('.combat')?.dataset.targetHud !== 'true') placeHitBadges();
      // A neighbour's intent that moves between refits re-picks the spot about
      // four times a second; the Inspect itself never follows the body's bob.
      if (++inspectTick % 15 === 0 && field.closest('.combat')?.dataset.targetHud !== 'true') placeEnemyInspect();
    }
    // Follow pose/stance motion only for a bounded window after it changes.
    // Tracking idle breathing every frame forced a full layout read per frame
    // and made combat unplayable on phones; the bob's few pixels are tolerated.
    trackingRequest = open && (trackStable < 2 || performance.now() - trackChangedAt < TRACK_SETTLE_MS) ? requestAnimationFrame(trackPlayerHud) : 0;
  }
  const refresh = () => {
    cancelAnimationFrame(frameRequest);
    invalidateSpriteRects();
    // Fit replacement DOM synchronously before it can paint at intrinsic width.
    if (!field.isConnected) return;
    const combat = field.closest('.combat');
    if (wiredAppearance !== displayAppearance()) {
      releaseBackdrop();
      releaseLayeredEnvironment();
      releaseBackdrop = wireAlternativeBackdrop(combat);
      releaseLayeredEnvironment = wireLayeredEnvironment(combat);
      wiredAppearance = displayAppearance();
    }
    if (combat.dataset.layout !== 'formation') combat.dataset.layout = 'formation';
    const targetHud = combat.dataset.targetHud === 'true';
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
    // Owner (2026-10-26): on desktop and widescreen the HUD reads smaller; phones keep their scale.
    const hudGrid = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
    const hudWide = isWideFormFactor(document.documentElement.dataset.formFactor);
    combat.style.setProperty('--combat-mini-hud-scale', String(hudWide ? hudGrid.desktopMiniHudScale : hudGrid.miniHudScale));
    // WCO1 headroom: the HUD band's bottom edge, in the field's local px.
    const hudBand = combat.querySelector(':scope > .topbar');
    const overheadGap = combat.dataset.compactCombat === 'true' ? 4 : 14;
    // Owner (2026-10-12): a readout sits directly above or below its fighter,
    // never beside it. On the perspective grid a front-rank enemy's readout
    // goes below its feet; above its head stands the back rank's.
    const hudBelow = () => false;
    const ceiling = hudBand ? Math.max(0, (combatHeaderKeepoutBottom(hudBand) - fieldRect.top) / zoom) : 0;
    const vitality = hudBand?.querySelector('.resbars-host');
    if (vitality) combat.style.setProperty('--combat-header-opaque-end',
      `${Math.max(0, (vitality.getBoundingClientRect().bottom - hudBand.getBoundingClientRect().top) / zoom)}px`);
    // The turn ribbon hangs from the HUD band's bottom edge (player-polish.css
    // reads --turn-ribbon-top), so it never sits under a band taller than its
    // row. Its box, in the same screen px as the plan, is a second ceiling for
    // every figure whose art or overhead stack shares its columns (below).
    const ribbonEl = field.querySelector(':scope > .turn-ribbon');
    // HUD layout geometry tokens (docs/hud-layout-tokens.md), read once per pass.
    const hudOffsets = hudGeometry(rootStyle);
    if (ribbonEl) {
      // The ribbon offset token is added below the band's edge and clamped:
      // never up under the HUD band, never past the field's floor.
      const ribbonDy = hudOffsets.turnRibbonDy
        ? Math.max(0, Math.min(hudOffsets.turnRibbonDy, measuredField.height / zoom - ceiling - ribbonEl.offsetHeight)) : 0;
      field.style.setProperty('--turn-ribbon-top', `${ceiling + ribbonDy}px`);
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
    const presentation = { formationPolicy: JSON.parse(field.dataset.formationPolicy || 'null'),
      formationOccupancy: JSON.parse(field.dataset.formationOccupancy || '[]'), ...presentationConfig(), ...JSON.parse(document.documentElement.dataset.formationSettings || '{}'),
      perspectiveGrid: !classicAppearance() };
    const partySize = frames.filter(f => f.classList.contains('player')).length;
    const dimensions = formationDimensions(presentation, Math.max(partySize, frames.filter(f => f.classList.contains('enemy')).length), partySize);
    const playerCell = playerFormationCell(field.dataset.playerCell, dimensions);
    if (playerCell) {
      presentation.playerSpawnRow = playerCell[0];
      presentation.playerSpawnColumn = playerCell[1];
    }
    const plan = combatFormation({ width: fieldRect.width, height: fieldRect.height,
      presentation,
      footerClearance: logicalViewport().height <= 480 && logicalViewport().width >= 600 ? 48 : 0,
      friends: frames.filter(f => f.classList.contains('player')).map(f => f.dataset.eid),
      enemies: frames.filter(f => f.classList.contains('enemy')).map(f => f.dataset.eid) });
    if (!classicAppearance()) alternativeFormation(plan, fieldRect.width, fieldRect.height, document.documentElement.dataset.layout === 'narrow', { ...presentation, formFactor: document.documentElement.dataset.formFactor });
    const nameWidth = Math.min(...plan.slots.map(slot => slot.width));
    // Three or more lanes on a phone cap HUD width while retaining physical type/tap floors.
    combat.style.setProperty('--combat-enemy-hud-scale', String(Math.min(
      hudWide ? hudGrid.desktopEnemyMiniHudScale : hudGrid.enemyMiniHudScale,
      Math.max(1, Math.min((fieldRect.width - 24) / plan.rows,
        ...plan.cells.map(cell => (cell.box?.width ?? Infinity) - 12)) / 104))));
    // Geometry uses local offset dimensions, which already exclude CSS zoom.
    // Keep the fitted zoom while reading; resetting it would invalidate every
    // sprite descendant before the unchanged final zoom is written below.
    const slotFrames = plan.slots.map(slot => {
      const frame = frames.find(f => f.dataset.eid === slot.id);
      const sprite = frame.querySelector('.combatant-card > .sprite');
      resizeObserver.observe(sprite);
      return { slot, frame, sprite };
    });
    const actors = slotFrames.map(({ slot, frame, sprite }) => {
      const stack = frame.querySelector('.combatant-stack');
      let geometry = combatSpriteGeometry(sprite, schedule);
      // Reserve the tallest authored pose once. Following the current ink must
      // not push the overhead into the ribbon or resize art during an attack.
      if (frame.classList.contains('player') && classicAppearance()) {
        const ratio = Number(sprite.querySelector('.painted-stage')?.dataset.maximumHeightRatio || 0);
        geometry.visibleHeight = Math.max(geometry.visibleHeight, geometry.boxHeight * ratio);
      }
      const enemyId = sprite.firstElementChild.dataset.enemyId;
      const ratio = combatSpriteRatio(frame.dataset.stature, enemyId);
      const leadingHost = frame.querySelector('.combatant-leading');
      let leadingHeight = !frame.classList.contains('player') ? (visibleCombatPanelRect(leadingHost, field)?.height || 0) / zoom : 0;
      // Inspect and intent stack vertically except on short landscape screens,
      // where their complete side-by-side union must stay inside the field.
      // Decorative shortcut keys do not enlarge the actionable control box.
      // An enemy's Inspect sits above its intent outside the fitted envelope
      // (placeEnemyInspect), so it never widens or heightens the stack.
      const leadingRects = leadingHost ? [...leadingHost.querySelectorAll(':scope > .overhead-control:not(.combatant-info), :scope > .combatant-mini-hud, :scope > .statuses')]
        .map(control => visibleCombatPanelRect(control, field)).filter(Boolean) : [];
      // Status rows belong to this HUD; transient hit-chance receipts do not resize art.
      if (!frame.classList.contains('player') && leadingRects.length) leadingHeight =
        (Math.max(...leadingRects.map(r => r.bottom)) - Math.min(...leadingRects.map(r => r.top))) / zoom;
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
      const racked = hudWide && !frame.classList.contains('player') && frame.querySelector(':scope > .target-hud-overhead-meters')
        ? Math.max(0, miniHudGroupHeight(hudGrid) + hudGrid.miniHudSpriteGapPx + 6 - hudGrid.desktopMiniHudBandOverlapPx) : 0;
      return { slot, side: frame.classList.contains('player') ? 'player' : 'enemy', frame, stack, sprite, ratio, enemyId, multiplier, ...geometry, leadingHost,
        art,
        // The overhead stack's own height (Inspect, when shown, over the
        // intent), in local px, for the headroom clamp below.
        leadingHeight, leadingWidth, artLeading: Math.max(ceiling * zoom, racked),
        // Reading controls do not change the unselected fitting envelope.
        // Desktop and widescreen enemies carry the taller racked group (intent + health row) above the head: the body is
        // fitted under it, so the group never overlaps the head. It may rise desktopMiniHudBandOverlapPx into the HUD
        // band's empty middle, as the old group did (owner 2026-10-28).
        leading: Math.max(Math.min(66, fieldRect.height * .25), leadingHeight * zoom + ceiling * zoom + overheadGap, racked) };
    });
    // A readout below the feet needs no headroom above the head.
    for (const actor of actors) if (hudBelow(actor)) actor.leading = 6;
    const narrow = document.documentElement.dataset.layout === 'narrow';
    const hand = combat.querySelector('.hand');
    const handRect = hand?.getBoundingClientRect();
    // Read the resting envelope, never a selected or horizontally panned card.
    // Keep it across screen remounts until viewport geometry or text scale changes.
    const handKey = handRect && hand.clientWidth > 0
      ? handGeometryKey({ width: hand.clientWidth, height: hand.clientHeight, zoom: handRect.width / hand.clientWidth,
        fontSize: layoutMetrics().fontSize, left: handRect.left }) : null;
    const handLeft = readRestingHand()?.left ?? fieldRect.left;
    // Preserve the incoming remount cache's subpixel tolerance; raw geometry
    // still validates the hand's authored resting envelope above.
    const stableHandKey = handKey?.split(':').map(value => Number.isFinite(Number(value))
      ? Math.round(Number(value) * 1000) / 1000 : value).join(':');
    const handLayoutKey = [fieldRect.width, fieldRect.height, pageZoom].map(value => Math.round(value * 1000) / 1000).join(':') + ':' + stableHandKey;
    const handAnchor = layoutState.handAnchor = stableHandAnchor(layoutState.handAnchor, handLayoutKey, {
      left: handLeft - fieldRect.left, top: handRect ? handRect.top - fieldRect.top : null,
    });
    const solo = actors.filter(actor => actor.side === 'player').length === 1 && !combat.classList.contains('coop');
    combat.dataset.composition = 'option-c';
    combat.dataset.waistOverlap = String(solo && logicalViewport().height > 480);
    // Short landscape needs a lower foot line to reserve the full intent row.
    if (classicAppearance() && logicalViewport().height <= 480) for (const actor of actors) {
      actor.slot = { ...actor.slot, fitGround: fieldRect.height - 24, ground: fieldRect.height - 24 };
    }
    const fitFormation = () => {
      // Classic and alternative compositions differ; choose per fit, not at import.
      const combatComposition = classicAppearance() ? classicCombatComposition : alternativeCombatComposition;
      const sizes = combatComposition({ width: fieldRect.width, height: fieldRect.height, actors,
        perspectiveGrid: !classicAppearance(),
        handTop: handAnchor?.key === handLayoutKey ? handAnchor.top : null,
        handLeft: handAnchor?.key === handLayoutKey ? handAnchor.left : 0,
        solo: solo && logicalViewport().height > 480,
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
          return crosses(fitted.x, artWidth) || (!hudBelow(actor) && crosses(overheadX, actor.leadingWidth * zoom));
        });
        if (!moved.length) break;
        for (const actor of moved) actor.leading = ribbonLeading(actor);
        ({ sizes, growthFor, overheads } = fitFormation());
      }
    }
    const artworkFit = layoutState.artworkFit = stableCombatArtwork(layoutState.artworkFit, combatArtworkKey({ width: fieldRect.width,
      height: fieldRect.height, zoom: pageZoom, wide: isWideFormFactor(document.documentElement.dataset.formFactor), presentation, appearance: displayAppearance(), handAnchor, ceiling, actors }), sizes);
    sizes = artworkFit.sizes;
    // Intent/Inspect controls still respond to their current text and selection,
    // but their changing headroom cannot resize or move the settled artwork.
    const overheadControls = actors.filter(actor => actor.leadingWidth > 0 && sizes.some(size => size.id === actor.slot.id)).map(actor => {
      const fitted = sizes.find(size => size.id === actor.slot.id);
      const ground = fitted.ground ?? actor.slot.ground;
      if (hudBelow(actor)) {
        const top = ground + overheadGap;
        return { id: actor.slot.id, side: actor.side, row: 'below', x: fitted.x,
          width: actor.leadingWidth * zoom, top, bottom: top + actor.leadingHeight * zoom };
      }
      const bottom = ground - fitted.visibleHeight - overheadGap;
      return { id: actor.slot.id, side: actor.side, row: actor.slot.row, x: fitted.x,
        width: actor.leadingWidth * zoom, top: bottom - actor.leadingHeight * zoom, bottom };
    });
    overheads = combatOverheadAnchors({ width: fieldRect.width, ribbon, ribbonClearance: overheadGap, controls: overheadControls });
    const placed = [];
    const leadingWrites = [];
    // Writes one readable overhead at its anchor. Called again once the
    // player's settled art and controls are measured (see below).
    const placeLeading = ({ actor, frame, leadingHost, id, x, ground, visibleHeight }, anchors) => {
      const anchor = targetHud ? null : anchors.find(overhead => overhead.id === id);
      if (hudBelow(actor)) {
        // A front-rank enemy's readout hangs below its feet. Keep its preferred
        // centre on the body, but honour the packer's bounded displacement when
        // four or more perspective lanes make neighbouring readouts collide.
        const overheadX = anchor?.x ?? x;
        const overheadLocal = anchorLocalBox(FORMATION_LOCAL_ORIGIN,
          { left: overheadX - x, top: 0, width: 0, height: 0 }, { zoom });
        leadingHost.style.left = `${overheadLocal.left}px`;
        const above = ground - visibleHeight - overheadGap - actor.leadingHeight * zoom;
        leadingHost.style.translate = `0 ${(ground + overheadGap - above + (anchor?.offsetY ?? 0)) / zoom}px`;
        if (anchor?.obstructed) frame.dataset.overheadObstructed = 'true';
        else delete frame.dataset.overheadObstructed;
        frame.dataset.hudBelow = 'true';
        return;
      }
      delete frame.dataset.hudBelow;
      const overheadX = anchor?.x ?? x;
      const overheadLocal = anchorLocalBox(FORMATION_LOCAL_ORIGIN,
        { left: overheadX - x, top: 0, width: 0, height: 0 }, { zoom });
      leadingHost.style.left = `${overheadLocal.left}px`;
      // Full-height artwork may reach its final ground before the fitter
      // can reserve more ribbon headroom. Move only the readable controls,
      // including a packed cross-row control, clear of the ribbon.
      const overheadTop = ground - visibleHeight - overheadGap - actor.leadingHeight * zoom;
      const overheadShift = targetHud ? 0 : anchor?.offsetY
        ?? combatOverheadRibbonShift({ x: overheadX, width: actor.leadingWidth * zoom,
          top: overheadTop, bottom: overheadTop + actor.leadingHeight * zoom, ribbon, clearance: overheadGap });
      leadingHost.style.translate = actor.side === 'player' ? 'none' : `0 ${overheadShift / zoom}px`;
      // An overhead with no clear slot stays at its anchor, reported, not hidden.
      if (anchor?.obstructed) frame.dataset.overheadObstructed = 'true';
      else delete frame.dataset.overheadObstructed;
    };
    // The grid tiles are written here, after the read phase above (sprite, hint and hand boxes),
    // so their style writes no longer force a layout before those reads. Nothing read above depends on them.
    const grid = field.querySelector('.formation-grid');
    if (grid) {
      grid.dataset.shape = presentation.gridShape;
      grid.dataset.perspective = String(!classicAppearance());
      grid.style.zIndex = presentation.gridLayer === 'above'
        ? 'var(--combat-layer-selection)' : 'calc(var(--combat-layer-shadows) - 1)';
      grid.style.setProperty('--player-grid-color', presentation.playerGridColor);
      grid.style.setProperty('--enemy-grid-color', presentation.enemyGridColor);
      const occupied = new Set(plan.slots.map(slot => slot.cell));
      // Offsets and edge clamping must not resize the reference tiles.
      const gridCells = plan.visualCells || plan.cells;
      const activeCells = new Set(gridCells.map(cell => cell.cell));
      for (const tile of grid.querySelectorAll('[data-cell]')) tile.hidden = !activeCells.has(tile.dataset.cell);
      for (const cell of gridCells) {
        const tile = grid.querySelector(`[data-cell="${cell.cell}"]`);
        if (!tile) continue;
        // A perspective cell is drawn whole, its shadow at the foot anchor.
        const geometry = cell.box ? { width: cell.box.width, height: cell.box.height, transform: 'none' }
          : formationTileGeometry(cell, plan, presentation);
        const localTile = anchorLocalBox(FORMATION_LOCAL_ORIGIN, cell.box ?? {
          left: cell.x - geometry.width / 2, top: cell.ground,
          width: geometry.width, height: geometry.height,
        }, { zoom: pageZoom });
        if (cell.box) {
          tile.style.setProperty('--foot-y', `${(cell.ground - cell.box.top) / cell.box.height * 100}%`);
          // Shear the rectangle about its centre into the cell's parallelogram;
          // the shadow is sheared back so it stays a level ellipse.
          const shear = Math.atan(cell.box.skew || 0);
          tile.style.transform = `skewX(${-shear}rad)`;
          tile.style.setProperty('--cell-unskew', `${shear}rad`);
        } else {
          tile.style.removeProperty('--foot-y');
          tile.style.removeProperty('transform');
          tile.style.removeProperty('--cell-unskew');
        }
        tile.style.left = `${localTile.left}px`;
        tile.style.top = `${localTile.top}px`;
        tile.style.width = `${localTile.width}px`;
        tile.style.height = `${localTile.height}px`;
        tile.style.setProperty('--tile-transform', geometry.transform);
        tile.dataset.side = cell.side || (Number(cell.cell[1]) <= plan.columns ? 'player' : 'enemy');
        tile.dataset.occupied = String(occupied.has(cell.cell));
        tile.dataset.visualBand = cell.visualBand || '';
        tile.dataset.visualOnly = String(!!cell.visualOnly);
        // Each shared edge is painted once, so translucent seams stay thin.
        tile.querySelector('[data-perspective-outline]')?.setAttribute('d',
          perspectiveCellOutlinePath(cell, plan.rows));
        tile.dataset.anchorX = String(cell.x);
        tile.dataset.anchorY = String(cell.ground);
      }
      field.formationPlan = { plan, width: fieldRect.width, height: fieldRect.height };
      wireGridTargeting(field);
      field.dispatchEvent(new Event('formationlayoutchange'));
    }
    invalidateSpriteRects();
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
      const local = anchorLocalBox(FORMATION_LOCAL_ORIGIN, { left: x - nameWidth / 2, top: ground - visibleHeight, width: nameWidth, height: visibleHeight }, { zoom: pageZoom });
      frame.style.left = `${local.left}px`;
      frame.style.width = `${local.width}px`;
      // Keep depth on the artwork. A z-index on the whole frame traps its
      // overhead buttons below a neighbouring frame's sprite on short phones.
      frame.style.zIndex = '';
      // Depth stays within a role's plane: players always paint over enemies.
      sprite.style.setProperty('--combat-depth', String(depthOrder.indexOf(slot.layer)));
      frame.dataset.formationRow = slot.formationRow;
      frame.dataset.visualBand = slot.visualBand;
      frame.dataset.formationRole = slot.formationRole;
      frame.dataset.formationDepth = String(slot.row);
      frame.dataset.formationCell = slot.cell;
      frame.dataset.targetHudLane = slot.lane === 0 ? 'left' : slot.lane === plan.rows - 1 ? 'right' : 'middle';
      if (slot.box) {
        const { left, top, width, height, skew = 0 } = slot.box;
        frame.dataset.targetHudCellPolygon = JSON.stringify([[left + skew * height / 2, top],
          [left + width + skew * height / 2, top], [left + width - skew * height / 2, top + height],
          [left - skew * height / 2, top + height]]);
      }
      if (!classicAppearance() && Number.isFinite(slot.miniHudWidth)) {
        const miniHud = uiConfig.presentation.combatFormationModel.positioning.perspectiveGrid;
        const peers = actors.filter(other => other.slot.visualBand === slot.visualBand);
        const groupTop = Math.min(...peers.map(other => {
          const fit = sizes.find(size => size.id === other.slot.id);
          return (fit?.ground ?? other.slot.ground) - (fit?.visibleHeight ?? 0) - miniHudGroupHeight(miniHud);
        })) - miniHud.miniHudSpriteGapPx;
        frame.style.setProperty('--combat-mini-hud-left', `${(slot.miniHudLeft - x + nameWidth / 2) / pageZoom}px`);
        frame.style.setProperty('--combat-mini-hud-top', `${groupTop / pageZoom}px`);
        frame.style.setProperty('--combat-mini-hud-width', `${slot.miniHudWidth / pageZoom}px`);
        frame.dataset.miniHudLeft = String(slot.miniHudLeft);
        frame.dataset.miniHudTop = String(groupTop);
        frame.dataset.miniHudWidth = String(slot.miniHudWidth);
      }
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
      if (leadingHost) leadingWrites.push({ actor, frame, leadingHost, id: slot.id, x, ground, visibleHeight });
      // The fitter reserves the complete card and action stack. Keep this gap
      // fixed in screen pixels, independent of art resolution or sprite size.
      frame.style.setProperty('--combat-elev', `${-overheadGap / zoom}px`);
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
    invalidateSpriteRects();
    for (const entry of leadingWrites) placeLeading(entry, overheads);
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
    settledTargetCores = [];
    placePlayerHud();
    if (!targetHud) {
    // Enemy overheads pack around the player's measured art and controls. An
    // obstacle never blocks its own owner, and the fitted artwork does not move.
    const playerObstacles = placed.filter(({ frame }) => frame.classList.contains('player')).flatMap(({ frame, sprite }) => {
      const art = currentSpriteArtBounds(sprite, refresh);
      const controls = [...frame.querySelectorAll('.combatant-leading, .combatant-info, .player-action-intent, .combatant-mini-hud')]
        .map(node => visibleCombatPanelRect(node, field)).filter(Boolean);
      return [art, ...controls].map(rect => ({ ownerId: frame.dataset.eid, left: rect.left - fieldRect.left,
        right: rect.right - fieldRect.left, top: rect.top - fieldRect.top, bottom: rect.bottom - fieldRect.top }));
    });
    // Only a clash re-packs: a layout where no overhead reaches the player keeps
    // the anchors above, so it is written exactly as before.
    const repacked = combatOverheadAnchors({ width: fieldRect.width, height: fieldRect.height, ribbon,
      ribbonClearance: overheadGap, controls: overheadControls, obstacles: playerObstacles });
    if (repacked.some(anchor => { const before = overheads.find(overhead => overhead.id === anchor.id);
      return anchor.x !== before?.x || (anchor.offsetY ?? 0) !== (before?.offsetY ?? 0) || !!anchor.obstructed !== !!before?.obstructed; })) {
      overheads = repacked;
      for (const entry of leadingWrites) placeLeading(entry, overheads);
    }
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
    // Space packed targets by the real hit-area height, never the compact
    // footer alone, so neighbouring tap areas cannot overlap.
    const footerSize = combatTargetPackSize(boxes.filter((box, index) => placed[index].frame.classList.contains('context-selected')).map(box=>box.footerHeight));
    const packTargets = () => combatTargetAnchors({ width: fieldRect.width,
      height: Math.max(fieldRect.height, combat.getBoundingClientRect().bottom-fieldRect.top-60),
      // Crowded HUD/intent bands may leave no vertical slot. Only the plate
      // and its visible footer may then shift by at most one physical target.
      lockX: true, size: footerSize, maxShiftX: 44,
      obstacles: [...readFooterObstacles(),
        ...boxes.flatMap((box, index) => placed[index].frame.classList.contains('player') ? [] : box.controls),
        ...placed.map(({ frame, sprite }) => ({ ...currentSpriteArtBounds(sprite, refresh), ownerId: frame.dataset.eid }))].map(rect => ({
        ownerId: rect.ownerId,
        left: rect.left - fieldRect.left, right: rect.right - fieldRect.left,
        top: rect.top - fieldRect.top, bottom: rect.bottom - fieldRect.top,
      })),
      // Idle enemies read above their bodies. Living players retain a 44px
      // proxy even with waist-overlap art, so pack it clear of their own HUD.
      targets: boxes.flatMap((box, i) => box.frameRect && !placed[i].frame.classList.contains('dead')
        && (placed[i].frame.classList.contains('player')
          || placed[i].frame.classList.contains('context-selected')) ? [combatFrameTarget({
        ...box, id: placed[i].frame.dataset.eid, fieldRect, footerSize,
        player: placed[i].frame.classList.contains('player'),
      })] : []) });
    // A fallen frame survives for its defeat pose but paints no target
    // proxy, so it neither competes for footer space nor blocks the HUD.
    const targetCores = boxes.flatMap((box, i) => {
        if (placed[i].frame.classList.contains('dead') || (!placed[i].frame.classList.contains('player')
          && !placed[i].frame.classList.contains('context-selected'))) return [];
        const target = combatFrameTarget({ ...box, id: placed[i].frame.dataset.eid, fieldRect, footerSize,
          player: placed[i].frame.classList.contains('player') });
        const half = COMBAT_TARGET_HIT_PX / 2;
        return [{ id: target.id, left: fieldRect.left + target.x - half, right: fieldRect.left + target.x + half,
          top: fieldRect.top + target.y - half, bottom: fieldRect.top + target.y + half }];
    });
    const targets = packCombatTargetsWithHud({ pack: packTargets,
      placeHud: cores => placePlayerHud(true, cores),
      targetCores,
    });
    settledTargetCores = targetCores;
    settledFooterSize = footerSize;
    // The selected enemy nameplate's offset token moves its visible footer
    // and its tap target together (offsetTargetPlate), clamped to the field.
    // It is refused when the moved plate would cover anything packing avoids:
    // the footer obstacles (HUD, ribbon, tools, hand, the player's panel),
    // another fighter's controls, or another packed target. 0: as packed.
    const plateOf = (target) => {
      const index = placed.findIndex(({ frame }) => frame.dataset.eid === target.id);
      const box = boxes[index] || {};
      return targetPlateBox({ x: target.x, y: target.y, footerWidth: box.footerWidth, footerHeight: box.footerHeight,
        footerSize, hitPx: COMBAT_TARGET_HIT_PX, fieldLeft: fieldRect.left, fieldTop: fieldRect.top });
    };
    const platedTargets = !hudOffsets.enemyNameplateDy ? targets : targets.map((target) => {
      const index = placed.findIndex(({ frame }) => frame.dataset.eid === target.id);
      const frame = placed[index]?.frame;
      if (!frame?.classList.contains('enemy') || !frame.classList.contains('context-selected')) return target;
      const toEdges = (rect) => ({ left: rect.left, right: rect.left + rect.width, top: rect.top, bottom: rect.top + rect.height });
      const obstacles = [...readFooterObstacles(),
        ...boxes.flatMap((box, i) => i === index || placed[i].frame.classList.contains('player') ? [] : box.controls),
        ...targets.filter((other) => other.id !== target.id).map((other) => toEdges(plateOf(other)))];
      return offsetTargetPlate({ target, plate: plateOf(target), dy: hudOffsets.enemyNameplateDy * zoom,
        bounds: { left: -Infinity, right: Infinity, top: fieldRect.top, bottom: fieldRect.top + fieldRect.height }, obstacles });
    });
    settledTargets = platedTargets;
    placed.forEach(({ frame, sprite, scale }, i) => {
      const { hostRect, frameRect, artRect, intentRect } = boxes[i];
      frame.dataset.intentVisibility = frame.querySelector('.intent')?.dataset.intentVisibility || 'known';
      if (intentRect) {
        frame.style.setProperty('--enemy-hit-width', `${Math.max(COMBAT_TARGET_HIT_PX,boxes[i].footerWidth) / zoom}px`);
        // Intent cards can be taller; the independent foot target keeps its
        // physical 44px minimum so two aligned footer bands fit a short stage.
        frame.style.setProperty('--enemy-hit-height', `${COMBAT_TARGET_HIT_PX / zoom}px`);
      }
      if (frameRect) {
        const target = platedTargets.find(target => target.id === frame.dataset.eid) || combatFrameTarget({
          ...boxes[i], id: frame.dataset.eid, fieldRect, footerSize, player: frame.classList.contains('player'),
        });
        const local = anchorLocalBox(frameRect, { left: fieldRect.left + target.x,
          top: fieldRect.top + target.y, width: COMBAT_TARGET_HIT_PX, height: COMBAT_TARGET_HIT_PX }, { zoom });
        frame.style.setProperty('--enemy-hit-x', `${local.left}px`);
        frame.style.setProperty('--enemy-hit-y', `${local.top}px`);
        frame.dataset.targetObstructed = String(!!target.obstructed);
        // Each refresh reads the footer back through its own translate, so
        // float error re-wrote it a few thousandths of a pixel apart on every
        // settle. Round to a hundredth: a still footer then writes the same
        // value, and reduced motion sees no script-driven drift.
        const settledPx = value => Math.round(value * 100) / 100 || 0;
        const offset = anchorLocalBox(FORMATION_LOCAL_ORIGIN, {
          left: fieldRect.left + target.x - (boxes[i].footerCenterX ?? hostRect.left + hostRect.width / 2),
          top: fieldRect.top + target.y - footerSize / 2 - (Number.isFinite(boxes[i].footerTop) ? boxes[i].footerTop : hostRect.bottom), width: 0, height: 0 }, { zoom });
        // Keep the visible name/health footer with its tap target. Packing
        // only the invisible target would leave no cue to the intended owner.
        for (const footer of frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')) {
          footer.style.translate = `${settledPx(offset.left)}px ${settledPx(offset.top)}px`;
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
            const idleOffset = anchorLocalBox(FORMATION_LOCAL_ORIGIN, {
              left: leading.left + (leading.width - rect.width) / 2 - rect.left,
              top: leading.bottom - rect.height - rect.top, width: 0, height: 0,
            }, { zoom });
            meter.style.translate = `${settledPx(offset.left + idleOffset.left)}px ${settledPx(offset.top + idleOffset.top)}px`;
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
    // Owner (2026-10-12): an enemy's intent is centred on its HP bar's track
    // and sits just above its badges and bar, never over them. The footer was
    // packed above, so the overhead (intent and Inspect together) moves by the
    // measured difference. Reads first, then writes: one layout serves all.
    // Gap between the intent and the badge row, in layout px (anchorLocalBox
    // measures in the frame's own layout space, so no zoom arithmetic here).
    const INTENT_BAR_GAP = 5;
    // A selected (targeted) enemy's HP bar sits below its figure, so its intent goes above the
    // figure's head instead: centred on the bar, its bottom a few px above the painted art's top.
    const INTENT_ART_GAP = 4;
    // Owner (2026-10-12): a selected intent keeps at least this gap under the turn ribbon's
    // bottom edge wherever the two overlap horizontally. It may then overlap the art's top.
    // The gap is 4 visual px, so in local px it is 4 / --ui-zoom (a 390 px phone runs at 0.9).
    const INTENT_RIBBON_GAP = 4 / uiZoom();
    const turnRibbonEl = field.querySelector(':scope > .turn-ribbon');
    const ribbonBox = turnRibbonEl ? anchorLocalBox(field, turnRibbonEl) : null;
    const enemyCount = placed.filter(({frame}) => frame.classList.contains('enemy')).length;
    const ribbonSeats = placed.flatMap(({frame}) => {
      const intent = frame.querySelector('.intent');
      return intent ? [{ id: frame.dataset.eid, ...anchorLocalBox(field, intent) }] : [];
    });
    const intentMoves = placed.map(({ frame, sprite }) => {
      if (!frame.classList.contains('enemy') || frame.classList.contains('dead')) return null;
      const leadingHost = frame.querySelector('.combatant-leading');
      const intent = leadingHost?.querySelector(':scope > .intent');
      const row = frame.querySelector('.combat-health-row');
      const track = row?.querySelector('.combat-health-meter .m-track');
      if (!leadingHost || !intent || !track) return null;
      const intentBox = anchorLocalBox(frame, intent), trackBox = anchorLocalBox(frame, track);
      const selected = frame.classList.contains('context-selected') && !!sprite;
      let bottomLimit;
      if (selected) {
        const artTop = anchorLocalBox(frame, { left: 0, top: currentSpriteArtBounds(sprite, refresh).top, width: 0, height: 0 }).top;
        bottomLimit = artTop - INTENT_ART_GAP;
      } else {
        const statusHeight = (leadingHost.querySelector(':scope > .statuses')?.getBoundingClientRect().height || 0) / zoom;
        const topOfRow = Math.min(anchorLocalBox(frame, row).top, ...[...row.querySelectorAll('.combat-health-badge')]
          .map(badge => anchorLocalBox(frame, badge).top));
        bottomLimit = topOfRow - INTENT_BAR_GAP - statusHeight;
      }
      let dx = (trackBox.left + trackBox.width / 2) - (intentBox.left + intentBox.width / 2);
      let footerShiftX = 0;
      let dy = bottomLimit - (intentBox.top + intentBox.height);
      if (!classicAppearance() && !selected && enemyCount <= 3 && ribbonBox) {
        const box = anchorLocalBox(field, intent);
        const centre = box.left + dx + box.width / 2, half = box.width / 2, gap = 6 / zoom;
        const top = box.top + dy, bottom = top + box.height;
        if (top < ribbonBox.top + ribbonBox.height && bottom > ribbonBox.top
          && centre - half < ribbonBox.left + ribbonBox.width && centre + half > ribbonBox.left) {
          const walls = [{ left:ribbonBox.left, right:ribbonBox.left+ribbonBox.width },
            ...ribbonSeats.filter(seat => seat.id !== frame.dataset.eid).map(seat => ({left:seat.left,right:seat.left+seat.width}))];
          const candidates = walls.flatMap(wall => [wall.left-gap-half,wall.right+gap+half])
            .filter(x => x-half >= gap && x+half <= field.clientWidth-gap
              && walls.every(wall => x+half <= wall.left-gap || x-half >= wall.right+gap))
            .sort((a,b) => Math.abs(a-centre)-Math.abs(b-centre));
          if (candidates.length) { footerShiftX = candidates[0]-centre; dx += footerShiftX; }
        }
      }
      if (selected && ribbonBox && ribbonBox.width > 0 && ribbonBox.height > 0) {
        // Both boxes are in the field's local px, so the shift needs no zoom arithmetic.
        const intentFieldBox = anchorLocalBox(field, intent);
        const intentLeft = intentFieldBox.left + dx;
        const sharesColumns = intentLeft < ribbonBox.left + ribbonBox.width && intentLeft + intentFieldBox.width > ribbonBox.left;
        const ribbonFloor = ribbonBox.top + ribbonBox.height + INTENT_RIBBON_GAP;
        const intentTop = intentFieldBox.top + dy;
        if (sharesColumns && intentTop < ribbonFloor) dy += ribbonFloor - intentTop;
      }
      return { leadingHost, dx, dy, footerShiftX, frame, intent, selected };
    });
    // Classic compact intents can be wider than the old fixed badge. Reuse
    // the measured overhead packer after the HP alignment above; move only
    // unselected reading controls, preserving selected controls and artwork.
    const compactMoves = classicAppearance() && combat.dataset.targetHud === 'false'
      ? intentMoves.flatMap(move => {
        if (!move || move.selected) return [];
        const box = visibleCombatPanelRect(move.intent, combat);
        return box ? [{ move, box }] : [];
      }) : [];
    if (compactMoves.length) {
      const controls = compactMoves.map(({ move, box }) => {
        return { id: move.frame.dataset.eid, side: 'enemy', x: box.left + box.width / 2 - fieldRect.left + move.dx * zoom,
          width: box.width, top: box.top - fieldRect.top + move.dy * zoom,
          bottom: box.bottom - fieldRect.top + move.dy * zoom };
      });
      const headerBottom = combatHeaderKeepoutBottom(combat.querySelector(':scope > .combat-hud'));
      const obstacles = [...combat.querySelectorAll('.turn-ribbon, .combat-health-row, .combatant-info, .player .combatant-leading, .enemy.context-selected .intent')]
        .map(node => visibleCombatPanelRect(node, combat)).filter(Boolean)
        .map(box => ({ left: box.left - fieldRect.left, right: box.right - fieldRect.left,
          top: box.top - fieldRect.top, bottom: box.bottom - fieldRect.top }));
      const anchors = combatOverheadAnchors({ width: fieldRect.width, controls,
        height: Math.min(fieldRect.height, (readRestingHand()?.clearanceTop ?? fieldRect.bottom) - fieldRect.top),
        ribbon: { left: 0, right: fieldRect.width, top: -Infinity,
          bottom: Math.max(0, (headerBottom ?? fieldRect.top) - fieldRect.top) },
        ribbonClearance: 6, obstacles });
      for (const { move } of compactMoves) {
        const control = controls.find(source => source.id === move.frame.dataset.eid);
        const anchor = control && anchors.find(source => source.id === control.id);
        if (!anchor) continue;
        move.dx += (anchor.x - control.x) / zoom;
        move.dy += (anchor.offsetY ?? 0) / zoom;
      }
    }
    for (const move of intentMoves) {
      if (!move || (Math.abs(move.dx) < 0.01 && Math.abs(move.dy) < 0.01)) continue;
      const { leadingHost, dx, dy, footerShiftX, frame } = move;
      if (footerShiftX) for (const meter of frame.querySelectorAll('.combatant-card > :is(.nm,.meters)')) {
        const [x=0,y=0] = meter.style.translate.split(' ').map(v=>parseFloat(v)||0);
        meter.style.translate = `${x+footerShiftX}px ${y}px`;
      }
      // The host's current place in its own containing block, in layout px.
      const hostBox = anchorLocalBox(leadingHost.offsetParent || leadingHost.parentElement, leadingHost);
      const hostShiftY = parseFloat(leadingHost.style.translate.split(' ')[1]) || 0;
      leadingHost.style.left = `${hostBox.left + dx}px`;
      leadingHost.style.translate = `0 ${hostShiftY + dy}px`;
    }
    }
    if (targetHud) for (const { frame, sprite } of placed) {
      syncCoreTinyTarget(frame, currentSpriteArtBounds(sprite, refresh), frame.getBoundingClientRect(), zoom);
    }
    // Idle names do not reserve footer rows, but their independent tap cores
    // still need separate space when two formation rows meet on a short field.
    // Move only these transparent cores; keep art and readable plates fixed.
    for (const { frame } of placed) {
      frame.style.removeProperty('--enemy-core-x');
      frame.style.removeProperty('--enemy-core-y');
      delete frame.dataset.coreObstructed;
    }
    const idleCores = placed.filter(({frame}) => targetHud
      ? frame.dataset.coreTinyTarget === 'true' && !frame.classList.contains('dead')
      : frame.matches('.enemy:not(.context-selected):not(.dead)'))
      .map(({frame, sprite}) => {
        const box = frame.getBoundingClientRect(), style = getComputedStyle(frame, '::before');
        const artBox = targetHud ? currentSpriteArtBounds(sprite, refresh) : sprite.getBoundingClientRect();
        const art = { left:artBox.left, right:artBox.right, top:artBox.top, bottom:artBox.bottom, width:artBox.right - artBox.left };
        return { id: frame.dataset.eid, frame, box, art,
          x: box.left + parseFloat(style.left) * zoom - fieldRect.left,
          y: box.top + parseFloat(style.top) * zoom - fieldRect.top, width: 44 };
      });
    const actorArt = placed.map(({frame, sprite}) => {
      const box = currentSpriteArtBounds(sprite, refresh);
      return { ownerId:frame.dataset.eid, left:box.left-fieldRect.left,
        right:box.right-fieldRect.left, top:box.top-fieldRect.top, bottom:box.bottom-fieldRect.top };
    });
    const stealsArtwork = core => actorArt.some(box => box.ownerId !== core.id
      && core.x + 22 > box.left && core.x - 22 < box.right
      && core.y + 22 > box.top && core.y - 22 < box.bottom);
    // A context-selected enemy and the player keep their fitted cores. They are
    // not repacked, but an idle core must leave them room rather than sit over
    // them (the player's square takes self-cast cards).
    const fixedCores = placed.filter(({frame}) => frame.matches('.enemy.context-selected:not(.dead), .player:not(.dead)')
      && !(targetHud && frame.dataset.coreTinyTarget === 'true'))
      .map(({frame}) => {
        const box = frame.getBoundingClientRect(), style = getComputedStyle(frame, '::before');
        if (style.display === 'none' || style.pointerEvents === 'none') return null;
        const x = box.left + parseFloat(style.left) * zoom - fieldRect.left;
        const y = box.top + parseFloat(style.top) * zoom - fieldRect.top;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        // Aiming can promote an enemy to context-selected after its idle core
        // was packed. Its auxiliary square still cannot cover another actor.
        if (frame.classList.contains('enemy') && stealsArtwork({ id: frame.dataset.eid, x, y })) {
          frame.dataset.coreObstructed = 'true';
          return null;
        }
        return { ownerId:frame.dataset.eid, x, y, left:x-22, right:x+22, top:y-22, bottom:y+22 };
      }).filter(Boolean);
    const near = (a, b) => Math.abs(a.x-b.x) < 44 && Math.abs(a.y-b.y) < 44;
    if (idleCores.some((core, i) => targetHud || core.y > core.art.bottom - fieldRect.top || stealsArtwork(core) || fixedCores.some(fixed => near(core, fixed))
      || idleCores.slice(i + 1).some(other => near(core, other)))) {
      const boundary = Math.min(combat.querySelector('.combat-tools')?.getBoundingClientRect().top ?? Infinity,
        readRestingHand()?.clearanceTop ?? Infinity, fieldRect.top + fieldRect.height);
      const obstacles = [...combat.querySelectorAll('.combat-hud, .turn-ribbon, .combatant-leading, .combatant-info, .combatant-card > .meters, .combatant-card > .nm, .target-hud-overhead-meters > .meters, .target-hud-overhead-meters > .intent, .target-hud-overhead-meters > .player-action-intent, .target-hud-inspect-info, .target-hud-panel, .target-hud-statuses')]
        .map(node => visibleCombatPanelRect(node, combat)).filter(Boolean)
        .map(box => ({ left:box.left-fieldRect.left, right:box.right-fieldRect.left,
          top:box.top-fieldRect.top, bottom:box.bottom-fieldRect.top }));
      obstacles.push(...actorArt, ...fixedCores);
      const cores = combatTargetAnchors({ width:fieldRect.width, height:boundary-fieldRect.top,
        size:44, lockX:true, maxShiftX:44,
        targets:idleCores.map(core => ({ ...core, x:core.art.width >= 44
          ? core.art.left+core.art.width/2-fieldRect.left : core.x })), obstacles });
      for (const core of cores) {
        const { frame, box } = idleCores.find(source => source.id === core.id);
        frame.style.setProperty('--enemy-core-x', `${(fieldRect.left+core.x-box.left)/zoom}px`);
        frame.style.setProperty('--enemy-core-y', `${(fieldRect.top+core.y-box.top)/zoom}px`);
        frame.dataset.coreObstructed = String(!!core.obstructed);
        if (targetHud) {
          // The plate and its auxiliary door share the one measured receipt.
          // An infeasible square cannot take input from another actor or HUD.
          frame.style.setProperty('--enemy-hit-x', `${(fieldRect.left+core.x-box.left)/zoom}px`);
          frame.style.setProperty('--enemy-hit-y', `${(fieldRect.top+core.y-box.top)/zoom}px`);
          frame.style.setProperty('--enemy-hit-width', `${core.obstructed ? 0 : COMBAT_TARGET_HIT_PX / zoom}px`);
          frame.style.setProperty('--enemy-hit-height', `${core.obstructed ? 0 : COMBAT_TARGET_HIT_PX / zoom}px`);
        }
      }
    }
    const rect = combat.getBoundingClientRect();
    // Last layout write of the refit: the HUD, ribbon and intents are settled.
    // The combat box above is unchanged by the Inspect marks.
    if (!targetHud) placeEnemyInspect();
    else centerTargetOverheads();
    if (!targetHud) placeHitBadges();
    syncFloorShadows();
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
    const floorShadowTop = mobileFloorShadowTop(placed.filter(({frame}) => frame.classList.contains('enemy') && !frame.classList.contains('dead')).map(({frame,sprite}) => {
      const box = sprite.getBoundingClientRect(), style = getComputedStyle(sprite), shadow = getComputedStyle(sprite, '::before');
      const spriteZoom = box.height / (parseFloat(style.height) || sprite.offsetHeight || 1);
      const translatedY = new DOMMatrix(shadow.transform === 'none' ? undefined : shadow.transform).m42;
      return { band: frame.dataset.visualBand,
        top: box.bottom - (parseFloat(shadow.bottom) + parseFloat(shadow.height) - translatedY) * spriteZoom };
    }));

    if (!classicAppearance()) fitAlternativeBackdrop(combat, { width: rect.width / zoom, height: fieldRect.height / zoom,
      fieldTop, ground: combatSceneryGround(sizes, actors, plan.ground) / zoom,
      standGround: combatStandingGround(sizes, actors, plan.ground) / zoom, narrow,
      coverFloor: true, zoom, floorShadowTop: holdFloorShadowTop(layoutState, Number.isFinite(floorShadowTop) ? (floorShadowTop - rect.top) / zoom : undefined) });
    if (backdrop) fitSceneBackdrop(backdrop, {
      width: backdropWidth, height: rect.height / zoom, zoom,
      windowTop: 0, windowHeight: sceneHeight,
      groundY: fieldTop + combatSceneryGround(sizes, actors, plan.ground) / zoom,
      config: battlefieldBackdropConfig({ height: sceneHeight, appearance: displayAppearance(),
        fieldTop, fieldHeight: fieldRect.height / zoom,
        formation: { cells: plan.cells.map(cell => ({ ground: cell.ground / zoom })), rowSpacing: plan.rowSpacing / zoom } }),
    });
    field.dataset.groundY = String(fieldRect.top + plan.ground);
    field.dispatchEvent(new Event('battlefieldgeometrychange'));
  };
  const schedule = () => { cancelAnimationFrame(frameRequest); frameRequest = requestAnimationFrame(refresh); };
  const combatHost = field.closest('.combat');
  let wiredAppearance = displayAppearance();
  let releaseBackdrop = wireAlternativeBackdrop(combatHost);
  let releaseLayeredEnvironment = wireLayeredEnvironment(combatHost);
  let overheadRequest = 0;
  // Glyph replacement cannot change formation or tiny-target obstruction.
  // General inspection still refits those controls in both presentations.
  const selectionChanged = event => {
    if (combatHost.dataset.targetHud === 'true' && event.detail?.geometry === 'overhead') {
      cancelAnimationFrame(overheadRequest);
      overheadRequest = requestAnimationFrame(() => {
        overheadRequest = 0;
        if (field.isConnected) centerTargetOverheads();
      });
      return;
    }
    // Detailed HUD controls place themselves in their own geometry pass. A
    // synchronous full-board refit here duplicated the caller's render fit
    // (and the queued fit), blocking each action before it could paint.
    if (combatHost.dataset.targetHud !== 'true') refresh();
    schedule();
  };
  combatHost.addEventListener('combatantselectionchange', selectionChanged);
  combatHost.addEventListener('handlayoutchange', schedule);
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(field);
  // CSS zoom can move the rendered floor without changing the observed
  // element's unzoomed content box. Refit after responsive UI settings settle.
  // The root's inline style is rewritten by many unrelated custom properties
  // (dialogue bands, shop rails, tower light timings); only the page zoom and
  // the view box move this layout, so a style mutation refits only when one of
  // those changed. Reading them off the inline style is no layout read.
  const LAYOUT_ROOT_VARS = ['--ui-zoom', '--visible-height', '--view-width', '--view-height', '--view-fit', '--view-left', '--view-top'];
  // Text size is the root's inline font-size; the HUD is sized in rem.
  const rootLayoutKey = () => {
    const rootStyle = document.documentElement.style;
    if (!rootStyle) return '';
    return [...LAYOUT_ROOT_VARS.map(name => rootStyle.getPropertyValue(name)), rootStyle.fontSize].join('|');
  };
  let lastRootLayoutKey = rootLayoutKey();
  const layoutObserver = new MutationObserver(records => {
    const key = rootLayoutKey();
    const styleOnly = records.every(record => record.attributeName === 'style');
    if (styleOnly && key === lastRootLayoutKey) return;
    lastRootLayoutKey = key;
    schedule();
  });
  layoutObserver.observe(document.documentElement, {
    // The two scene words are named here rather than left to ride on
    // `data-formation-settings` (which applyDisplaySettings also rewrites on
    // every pass): a fight on screen must refit because the player answered
    // the Scenes choice, not because another attribute happened to change in
    // the same breath.
    attributes: true,
    // data-form-factor picks content/hud-layout/<ff>.json, whose geometry
    // tokens this layout reads, so a form-factor change refits too.
    attributeFilter: ['style', 'data-layout', 'data-short', 'data-composition', 'data-form-factor', 'data-formation-settings',
      'data-wireframe-scene-skyline', 'data-wireframe-scene-floor'],
  });
  window.addEventListener('resize', schedule);
  const poseObserver = new MutationObserver(mutations => {
    // Selection tint and control visibility need the HUD's one-shot geometry,
    // not a new 900ms body-motion window. Pose/source and action changes keep it.
    if (!mutations.some(m => combatantBodyMutation(m, combatHost.dataset.targetHud === 'true'))) return;
    // A deliberate stance still settles its readout when idle motion is off.
    if (reducedMotionRequested()) {
      if (field.closest('.combat')?.dataset.targetHud === 'true') centerTargetOverheads();
      return;
    }
    // Genuine body motion still follows the complete stance/action transition.
    extendTracking();
    if (!trackingRequest) trackingRequest = requestAnimationFrame(trackPlayerHud);
  });
  poseObserver.observe(field, { subtree: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['src', 'data-pose', 'data-rest', 'data-stance', 'data-animating', 'class'] });
  // Both accessibility inputs can change while a fight is on screen. Settle
  // once after motion is disabled, and resume frame tracking only after it is
  // enabled again; otherwise the HUD can retain the last idle-frame offset.
  let reduced = reducedMotionRequested();
  const reducedMedia = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reconcileReducedMotion = () => {
    const next = reducedMotionRequested();
    if (next === reduced) return;
    reduced = next;
    trackFresh = true; trackStable = 0;
    cancelAnimationFrame(trackingRequest);
    trackingRequest = 0;
    schedule();
    if (!next) trackingRequest = requestAnimationFrame(trackPlayerHud);
  };
  reducedMedia?.addEventListener('change', reconcileReducedMotion);
  const reducedSettingObserver = new MutationObserver(reconcileReducedMotion);
  reducedSettingObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const detachObserver = new MutationObserver(() => {
    if (!field.isConnected) release();
  });
  const release = () => {
    releaseBackdrop();
    releaseLayeredEnvironment();
    combatHost.removeEventListener('combatantselectionchange', selectionChanged);
    combatHost.removeEventListener('handlayoutchange', schedule);
    cancelAnimationFrame(frameRequest);
    cancelAnimationFrame(trackingRequest);
    cancelAnimationFrame(overheadRequest);
    resizeObserver.disconnect();
    layoutObserver.disconnect();
    poseObserver.disconnect();
    reducedMedia?.removeEventListener('change', reconcileReducedMotion);
    reducedSettingObserver.disconnect();
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
  return Object.freeze({ refresh, release, placeHitBadges });
}

// In the perspective grid the whole cell is the enemy's target: a press
// anywhere in an occupied enemy cell acts as a press on that enemy (select it,
// or play the armed card or flask on it). Bodies and controls keep their own
// handlers; a vacant or disabled cell passes the press through unchanged.
const gridTargetingFields = new WeakSet();
function enemyFrameAtCell(field, x, y) {
  const grid = field.querySelector('.formation-grid[data-perspective="true"]');
  const plan = field.formationPlan?.plan;
  if (!grid || !plan) return null;
  const rect = field.getBoundingClientRect();
  const occupied = new Set(plan.slots.filter(slot => slot.side === 'enemy').map(slot => slot.cell));
  const cell = plan.cells.find(cell => cell.box && occupied.has(cell.cell)
    && perspectiveCellContains(cell.box, x - rect.left, y - rect.top));
  if (!cell) return null;
  // Past the grid's capacity two enemies can share a cell; take a living one.
  return [...field.querySelectorAll(`.combatant.enemy[data-formation-cell="${CSS.escape(cell.cell)}"]`)]
    .find(frame => !frame.inert && !frame.classList.contains('dead')) ?? null;
}
function wireGridTargeting(field) {
  if (gridTargetingFields.has(field)) return;
  gridTargetingFields.add(field);
  const passive = target => target.closest('.combatant, .target-hud-layer, button:not(.formation-grid-cell), .hand, .card, .modal, input, a, [role="button"]');
  field.addEventListener('click', event => {
    if (passive(event.target)) return;
    const frame = enemyFrameAtCell(field, event.clientX, event.clientY);
    if (!frame) return;
    event.stopPropagation();
    event.preventDefault();
    frame.click();
  }, true);
  let hovered = null;
  field.addEventListener('pointermove', event => {
    // Over a body or control, that element's own pointer events own the
    // highlight: keep it on the same enemy, clear it from any other.
    if (passive(event.target)) {
      if (hovered && hovered !== event.target.closest('.combatant')) hovered.dispatchEvent(new PointerEvent('pointerleave'));
      hovered = null;
      field.classList.remove('grid-target-hover');
      return;
    }
    const frame = enemyFrameAtCell(field, event.clientX, event.clientY);
    if (frame === hovered) return;
    hovered?.dispatchEvent(new PointerEvent('pointerleave'));
    hovered = frame;
    frame?.dispatchEvent(new PointerEvent('pointerenter'));
    field.classList.toggle('grid-target-hover', !!frame);
  });
  field.addEventListener('pointerleave', () => {
    hovered?.dispatchEvent(new PointerEvent('pointerleave'));
    hovered = null;
    field.classList.remove('grid-target-hover');
  });
}
