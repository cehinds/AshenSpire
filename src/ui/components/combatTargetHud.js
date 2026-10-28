import { t } from '../strings.js';
import { setCombatantTargetHud } from './combatantFrame.js';
import { targetHudConfig, targetHudEnabled, targetHudPanelSizing, targetBodyHudPlacement, placeTargetHudPanels, createTargetHudDwell } from '../models/TargetHudModel.js';
import { classicAppearance } from '../displayAppearance.js';
import { attachTooltip, esc, hideTooltip } from './tooltip.js';
import { combatantInfo } from './combatantOverhead.js';
import { currentSpriteBodyBounds } from './combatSpriteGeometry.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { reducedMotionRequested } from '../motion.js';

// Inline writes that skip an unchanged value, so a repeated geometry pass
// dirties no layout and the next pass's reads are not forced flushes.
const setVar = (node, name, value) => { if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value); };
const setStyle = (node, name, value) => { if (node.style[name] !== value) node.style[name] = value; };
const setData = (node, name, value) => { if (node.dataset[name] !== value) node.dataset[name] = value; };
const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
const contains = (r, x, y, pad = 0) => x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.top + r.height + pad;
function corridor(a, b, x, y, radius) {
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy) <= radius;
}
function node(tag, className, text) { const n = document.createElement(tag); n.className = className; if (text != null) n.textContent = text; return n; }

function panelFor(entry) {
  const shell = node('section', 'target-hud-detail');
  shell.dataset.eid = entry.id;
  shell.dataset.role = entry.role;
  shell.setAttribute('aria-label', t('combat.targetHud.namedDetails', { name: entry.name }));
  const panel = node('div', 'target-hud-panel');
  panel.append(node('div', 'target-hud-name', entry.name));
  const meters = entry.createMeters();
  meters.classList.add('target-hud-meters');
  for (const child of [...meters.children]) if (child.dataset.meterRow !== 'hp') child.remove();
  // Owner (2026-10-26): the panel is name, HP bar and stats row only; the intent reads above the figure.
  panel.append(meters);
  const statuses = entry.createStatuses();
  statuses.classList.add('target-hud-statuses');
  statuses.hidden = !statuses.querySelector('.status-icon');
  shell.append(panel, statuses);
  return shell;
}

/** Scoped presentation owner. Target activation delegates to the combat owner. */
export function mountCombatTargetHud(combat, { field = combat.querySelector('.field'), config = targetHudConfig(), onActivate, canInspect = () => true } = {}) {
  const layer = node('div', 'target-hud-layer'), cells = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  layer.setAttribute('aria-label', t('combat.targetHud.details'));
  cells.classList.add('target-hud-cells'); cells.setAttribute('aria-hidden', 'true');
  field.append(cells, layer);
  let entries = new Map(), eligible = [], focused = null, hover = null, focusWithin = null, shown = [], enabled = false, disposed = false, raf = null;
  const panels = new Map(), infoButtons = new Map();
  let drawnCells = null;
  const gestures = new AbortController();
  let holdTimer = null, held = null, lastTap = null, inspectionPointer = null, readGesture = null, clickSeriesActivated = false, tapInspected = false, pressMoved = false;
  const cancelHold = () => { clearTimeout(holdTimer); held = null; };
  // A read owns its originating pointer's trailing click, however long the
  // finger stays down. A new press after release is a separate gesture.
  const inspectionClick = event => !!inspectionPointer && event.detail !== 0
    && (event.pointerId == null || event.pointerId < 0 || event.pointerId === inspectionPointer.id);
  const inspect = (id, opener) => { cancelHold(); hideTooltip(); entries.get(id)?.inspect?.(opener); };
  const syncActivation = (shell, id) => {
    const active = !!onActivate && eligible.includes(id);
    shell.dataset.targeting = String(active);
    const name = shell.querySelector('.target-hud-name');
    if (active) { name.setAttribute('role', 'button'); name.tabIndex = 0; }
    else { name.removeAttribute('role'); name.removeAttribute('tabindex'); }
    // Owner 2026-10-25: out of targeting the whole panel is the inspection door.
    // Its name comes from its content (name, HP, stats), not an override.
    const panel = shell.querySelector('.target-hud-panel');
    const door = !active && canInspect();
    if (door) { panel.setAttribute('role', 'button'); panel.tabIndex = 0; }
    else { panel.removeAttribute('role'); panel.removeAttribute('tabindex'); }
  };
  function wireInspect(shell, id) {
    // The visible name/HP replaces the frame footer in this layout. While
    // armed it is the same target door, including resource descendants whose
    // tooltip listeners otherwise swallow the click before it reaches us.
    shell.addEventListener('click', event => {
      // Native detail joins the two presses of a double-click without a timer.
      if (event.detail === 1) { clickSeriesActivated = false; tapInspected = false; }
      if (inspectionClick(event)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (event.detail !== 0 && readGesture?.blocked) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      // The rest of a series whose first tap inspected is never a target press.
      if (event.detail > 1 && tapInspected) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (!onActivate || !eligible.includes(id)) {
        if (event.detail > 1 && clickSeriesActivated) lastTap = null;
        // Not a target: one tap or click anywhere on the panel (name, HP,
        // statuses, padding) opens the inspection; the rest of a double-click
        // series is swallowed so it cannot open it twice. Keys are handled by
        // the keydown below and never click this div; a detail-0 click on the
        // panel itself is an assistive-technology activation of the button.
        if (event.detail === 0) {
          if (event.target.classList?.contains('target-hud-panel') && canInspect()) { event.preventDefault(); event.stopImmediatePropagation(); inspect(id, event.target); }
          return;
        }
        if (!canInspect() || pressMoved) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.detail === 1) { clickSeriesActivated = true; if (readGesture) readGesture.blocked = true; lastTap = null; tapInspected = true; inspect(id, shell); }
        return;
      }
      // The status tray keeps its authored reading door.
      // Only the footer replacement (name, HP, and its panel padding) confirms.
      if (!event.target.closest('.target-hud-name, .target-hud-meters')
          && !event.target.matches('.target-hud-panel')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.detail !== 0) { clickSeriesActivated = true; if (readGesture) readGesture.blocked = true; }
      lastTap = null; cancelHold(); hideTooltip(); onActivate(id);
    }, true);
    shell.addEventListener('keydown', event => {
      if (event.target.classList?.contains('target-hud-panel') && ['Enter', ' '].includes(event.key)
          && !(onActivate && eligible.includes(id)) && canInspect()) { event.preventDefault(); event.stopPropagation(); inspect(id, event.target); return; }
      if (!onActivate || !eligible.includes(id) || !event.target.closest('.target-hud-name')
          || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); event.target.click();
    });
    shell.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
      if (inspectionClick(event) || (event.detail !== 0 && (readGesture?.blocked || clickSeriesActivated)) || !canInspect()) return;
      inspect(id, shell);
    });
    // Resource tooltip descendants stop pointerdown while bubbling. Ownership
    // must still reset for their fresh presses without starting a HUD hold.
    shell.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      if (inspectionPointer?.released) inspectionPointer = null;
      pressMoved = false;
      // Keep the state at press start: playback can finish before release.
      readGesture = { blocked: !canInspect() };
      if (readGesture.blocked) lastTap = null;
    }, true);
    shell.addEventListener('pointerdown', event => {
      cancelHold(); if (!event.isPrimary || event.button !== 0 || readGesture?.blocked) return;
      held = { id, opener: shell, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      holdTimer = setTimeout(() => { if (!shell.isConnected || readGesture?.blocked || !canInspect()) return; inspectionPointer = { id: event.pointerId, released: false }; lastTap = null; inspect(id, shell); }, 500);
    });
    shell.addEventListener('click', event => {
      event.stopPropagation();
      // Reuse each resource/status component's authored shared tooltip content.
      event.target.closest('[data-tip-attached]')?.dispatchEvent(new Event('gpfocus'));
    });
  }
  const listen = (target, type, handler, capture = false) => target.addEventListener(type, handler, { signal: gestures.signal, capture });
  listen(document, 'pointermove', event => { if (held && held.pointerId === event.pointerId && Math.hypot(event.clientX - held.x, event.clientY - held.y) > 8) { cancelHold(); lastTap = null; pressMoved = true; } });
  listen(document, 'pointerup', event => {
    if (inspectionPointer?.id === event.pointerId) inspectionPointer.released = true;
  }, true);
  listen(document, 'pointerup', event => {
    if (!held || held.pointerId !== event.pointerId) return;
    const current = held; cancelHold(); if (event.pointerType !== 'touch') return;
    // Two quick target confirmations must never become the inspection gesture.
    if (readGesture?.blocked || !canInspect() || (onActivate && eligible.includes(current.id))) { lastTap = null; return; }
    const time = performance.now();
    if (lastTap?.id === current.id && time - lastTap.time < 350 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) { lastTap = null; inspectionPointer = { id: event.pointerId, released: true }; inspect(current.id, current.opener); }
    else lastTap = { id: current.id, time, x: event.clientX, y: event.clientY };
  });
  listen(document, 'pointercancel', () => { cancelHold(); lastTap = null; inspectionPointer = null; readGesture = null; clickSeriesActivated = false; });
  listen(window, 'blur', () => { cancelHold(); lastTap = null; inspectionPointer = null; readGesture = null; clickSeriesActivated = false; });
  const dwell = createTargetHudDwell({ delay: config.motion.dwellMs, onChange: ids => { shown = ids; paint(); } });
  const desired = () => [...new Set([...eligible, focused, hover, focusWithin].filter(id => entries.has(id)))];
  const refreshDesired = () => dwell.request(enabled ? desired() : []);
  function gate() {
    const next = targetHudEnabled({ formFactor: document.documentElement.dataset.formFactor,
      classic: classicAppearance(), layout: combat.dataset.layout || 'formation' }, config);
    enabled = next;
    if (combat.dataset.targetHud !== String(next)) combat.dataset.targetHud = String(next);
    layer.hidden = cells.hidden = !next;
    for (const frame of field.querySelectorAll('.combatant')) setCombatantTargetHud(frame, next);
    if (!next) { cancelHold(); lastTap = null; hover = null; shown = []; dwell.reset(); clearPanels(); }
    refreshDesired();
  }
  function clearPanels() {
    for (const panel of panels.values()) panel.node.remove();
    for (const button of infoButtons.values()) button.remove();
    infoButtons.clear();
    panels.clear();
    for (const frame of field.querySelectorAll('.combatant')) {
      frame.classList.remove('target-hud-selected', 'target-hud-focused', 'target-hud-candidate');
      delete frame.dataset.matchupActive;
      delete frame.dataset.matchup;
      frame.style.removeProperty('--combat-matchup-color');
    }
    cells.replaceChildren(); drawnCells = null;
  }
  function frameFor(id) { return [...field.querySelectorAll('.combatant')].find(frame => frame.dataset.eid === id); }
  function paint() {
    if (disposed || !enabled) return;
    const next = new Set(shown.filter(id => entries.has(id)));
    for (const [id, panel] of panels) if (!next.has(id)) {
      panels.delete(id); infoButtons.get(id)?.remove(); infoButtons.delete(id); panel.node.classList.add('leaving');
      const remove = () => panel.node.remove();
      if (reducedMotionRequested()) remove(); else panel.node.addEventListener('transitionend', remove, { once: true });
      // A disconnected mount or a suppressed CSS transition still owns removal.
      panel.node.ashenRemove = setTimeout(remove, config.motion.fadeMs);
    }
    for (const id of next) {
      const entry = entries.get(id), old = panels.get(id);
      if (old && old.key === entry.key) {
        old.node.dataset.matchupActive = String(!!entry.matchupActive && eligible.includes(id));
        syncActivation(old.node, id);
        continue;
      }
      const shell = panelFor(entry);
      shell.dataset.matchup = entry.matchup || 'neutral';
      shell.dataset.matchupActive = String(!!entry.matchupActive && eligible.includes(id));
      syncActivation(shell, id);
      shell.style.setProperty('--combat-matchup-color', entry.auraColor || '#e4cd59');
      infoButtons.get(id)?.remove();
      const info = combatantInfo(entry.name, opener => inspect(id, opener));
      info.classList.add('target-hud-inspect-info'); info.dataset.eid = id;
      combat.append(info); infoButtons.set(id, info);
      info.addEventListener('pointerenter', () => { hover = id; refreshDesired(); });
      info.addEventListener('pointerleave', () => { hover = null; refreshDesired(); });
      info.addEventListener('focusin', () => { focusWithin = id; refreshDesired(); });
      info.addEventListener('focusout', () => { focusWithin = null; refreshDesired(); });
      wireInspect(shell, id);
      if (old) old.node.replaceWith(shell); else layer.append(shell);
      panels.set(id, { node: shell, key: entry.key });
      shell.addEventListener('pointerenter', () => { hover = id; refreshDesired(); });
      shell.addEventListener('pointerleave', event => pointer(event));
      shell.addEventListener('focusin', () => { focusWithin = id; refreshDesired(); });
      shell.addEventListener('focusout', event => { if (!shell.contains(event.relatedTarget)) { focusWithin = null; refreshDesired(); } });

    }
    for (const frame of field.querySelectorAll('.combatant')) {
      const id = frame.dataset.eid;
      const entry = entries.get(id);
      const matchup = entry?.matchup || 'neutral', active = String(!!entry?.matchupActive && eligible.includes(id));
      const color = entry?.auraColor || '#e4cd59';
      if (frame.dataset.matchup !== matchup) frame.dataset.matchup = matchup;
      if (frame.dataset.matchupActive !== active) frame.dataset.matchupActive = active;
      if (frame.style.getPropertyValue('--combat-matchup-color') !== color) frame.style.setProperty('--combat-matchup-color', color);
      frame.classList.toggle('target-hud-selected', next.has(id));
      frame.classList.toggle('target-hud-focused', id === focused || id === hover);
      frame.classList.toggle('target-hud-candidate', eligible.includes(id));
    }
    scheduleGeometry();
  }
  function scheduleGeometry() { if (!disposed && raf === null) raf = requestAnimationFrame(geometry); }
  // The two computed-style reads a frame's geometry needs (the core marker's
  // custom properties and the active target's ::after box) change only when the
  // frame's classes, inline style or the layout words change, so they are read
  // once per such change and not once per run (each was a style flush after the
  // run's own writes).
  const frameMetrics = new WeakMap();
  function metricsFor(frame, zoom) {
    const root = document.documentElement;
    const key = [frame.className, frame.getAttribute('style') || '', zoom, combat.dataset.layout, combat.dataset.targetHud,
      root.dataset.displayAppearance, root.dataset.formFactor, root.dataset.viewPreset].join('|');
    const known = frameMetrics.get(frame);
    if (known?.key === key) return known.value;
    const style = getComputedStyle(frame);
    const x = parseFloat(style.getPropertyValue('--enemy-core-x')), y = parseFloat(style.getPropertyValue('--enemy-core-y'));
    const value = { core: Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null, pseudo: null };
    // The active target pseudo-element can extend past the sprite. Reserve
    // its exact computed box; inactive legacy proxies do not consume room.
    const pseudo = getComputedStyle(frame, '::after');
    if (!(pseudo.display === 'none' || pseudo.visibility === 'hidden' || pseudo.pointerEvents === 'none' || ['none', 'normal'].includes(pseudo.content))) {
      const width = parseFloat(pseudo.width), height = parseFloat(pseudo.height), left = parseFloat(pseudo.left), top = parseFloat(pseudo.top);
      if ([width, height, left, top].every(Number.isFinite)) {
        const matrix = new DOMMatrixReadOnly(pseudo.transform === 'none' ? undefined : pseudo.transform);
        value.pseudo = { width, height, left: left + matrix.e, top: top + matrix.f };
      }
    }
    frameMetrics.set(frame, { key, value });
    return value;
  }
  // Reads and writes are in separate phases (a write between two reads made each
  // later read a forced layout, one per combatant or panel): everything is read
  // from the DOM as it stands, then each write group is followed only by the
  // reads that depend on it (a panel's height after its font size, its box after
  // its position).
  function geometry() {
    raf = null;
    if (disposed || !enabled || !field.isConnected) return;
    // Phase 1: reads.
    const fieldBox = rect(field), zoom = fieldBox.width / field.clientWidth || 1;
    const hand = combat.querySelector('.hand'), handTop = hand?.getBoundingClientRect().top;
    const rootBox = combat.getBoundingClientRect();
    const bottom = Math.min(fieldBox.top + fieldBox.height, Number.isFinite(handTop) ? handTop - config.positioning.gapPx : rootBox.bottom);
    const bounds = { ...fieldBox, height: Math.max(0, bottom - fieldBox.top) };
    const frames = [...field.querySelectorAll('.combatant:not(.dead)')];
    const intents = frames.map(frame => {
      const body = currentSpriteBodyBounds(frame.querySelector('.sprite'), scheduleGeometry);
      const intentHeight = frame.querySelector(':scope > .target-hud-overhead-meters > :is(.intent,.player-action-intent)')?.getBoundingClientRect().height || 37;
      const intentBox = frame.querySelector(':scope > .target-hud-overhead-meters > :is(.intent,.player-action-intent)')?.getBoundingClientRect();
      return { frame, intentWidth: intentBox?.width || 0, intentHeight, placement: targetBodyHudPlacement({ body, frame: rect(frame), intentHeight, zoom }) };
    });
    // Phase 2: reads that follow. The intent placement itself is written last:
    // it moves only the intent inside its own frame, and none of the boxes read
    // here, so writing it first made every one of these reads a forced layout.
    const sprites = frames.map(frame => ({ id: frame.dataset.eid, ...rect(frame.querySelector('.sprite')) }));
    const obstacles = [...sprites, ...frames.map(frame => frame.querySelector('.combatant-leading')).filter(Boolean).map(rect),
      ...combat.querySelectorAll(':scope > .topbar, .combat-hud, .combat-tools, .combat-action-row, .turn-ribbon, .hand .card')].map(value => value?.nodeType ? rect(value) : value);
    const boxes = frames.map(frame => rect(frame));
    // Owner 2026-10-28: an armed card's panel never covers an enemy's intent. The intent's box is where
    // the placement below will put it (centre over the body, above the head), not where it was last pass.
    intents.forEach(({ frame, intentWidth, intentHeight, placement }, index) => {
      if (!intentWidth || frame.classList.contains('player')) return;
      const box = boxes[index];
      obstacles.push({ left: box.left + placement.center * zoom - intentWidth / 2, top: box.top + (frame.classList.contains('target-hud-selected') ? placement.selectedTop : placement.miniTop) * zoom, width: intentWidth, height: intentHeight });
    });
    frames.forEach((frame, index) => {
      const { core } = metricsFor(frame, zoom), box = boxes[index];
      if (core) obstacles.push({ left: box.left + core.x * zoom - 22, top: box.top + core.y * zoom - 22, width: 44, height: 44 });
    });
    frames.forEach((frame, index) => {
      const { pseudo } = metricsFor(frame, zoom), box = boxes[index];
      if (pseudo) obstacles.push({ left: box.left + pseudo.left * zoom, top: box.top + pseudo.top * zoom, width: pseudo.width * zoom, height: pseudo.height * zoom });
    });
    const sizing = [...panels].flatMap(([id, panel]) => {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry) return [];
      return [{ id, panel, entry, frame, anchor: rect(frame.querySelector('.sprite')), lane: frame.dataset.targetHudLane != null ? frame.dataset.targetHudLane
        : Math.max(0, Math.min(2, 'ABCDEF'.indexOf(frame.dataset.formationCell?.[0]))),
        ...targetHudPanelSizing({ viewportWidth: rootBox.width, count: panels.size }, config) }];
    });
    // Each frame's grid tile, read now: the writes below never move a tile, and
    // reading it after them was a forced layout per tile.
    const tiles = new Map();
    for (const id of new Set([...shown, ...eligible, focused].filter(Boolean))) {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry || frame.dataset.targetHudCellPolygon) continue;
      const tile = field.querySelector(`.formation-grid-cell[data-cell="${frame.dataset.formationCell}"]`);
      const path = tile?.querySelector('[data-perspective-outline]');
      if (tile && path) tiles.set(id, { path, box: tile.getBoundingClientRect() });
    }
    // Phase 3: panel sizing writes, then every panel's height.
    for (const { panel, crowded, width, font, statusSize } of sizing) {
      setData(panel.node, 'crowded', String(crowded));
      setVar(panel.node, '--target-hud-padding-block', `${crowded ? config.sizing.crowdedPaddingBlockEm : .65}em`);
      setVar(panel.node, '--target-hud-padding-inline', `${crowded ? config.sizing.crowdedPaddingInlineEm : .75}em`);
      // The width term only. A plain origin stands in for VIEWPORT_ORIGIN, whose
      // getters read window.innerWidth (a forced layout) for a `left` not used here.
      const panelLocalWidth = anchorLocalBox({ left: 0, top: 0 }, { left: 0, top: 0, width, height: 0 }, { zoom }).width;
      setStyle(panel.node, 'width', `${panelLocalWidth}px`);
      setVar(panel.node, '--target-hud-font', `${font / zoom}px`);
      setVar(panel.node, '--target-hud-status-size', `${statusSize / zoom}px`);
    }
    const requests = sizing.map(({ id, entry, panel, anchor, lane, width }) => ({ id, role: entry.role, lane, anchor, width: width + 25,
      height: panel.node.getBoundingClientRect().height || config.sizing.panelHeightPx + config.sizing.statusHeightPx }));
    const placed = placeTargetHudPanels({ bounds, panels: requests, obstacles, config });
    // Phase 4: panel positions, then each panel's box; then the Info buttons.
    const positioned = [];
    for (const box of placed) {
      const panel = panels.get(box.id)?.node; if (!panel) continue;
      // anchorLocalBox(field, ...) with the field box read above, not read again.
      const panelLocal = anchorLocalBox(fieldBox, { left: box.left + 25, top: box.top, width: 0, height: 0 }, { zoom });
      setStyle(panel, 'left', `${panelLocal.left}px`); setStyle(panel, 'top', `${panelLocal.top}px`);
      setData(panel, 'side', box.side); panel.classList.add('visible');
      const info = infoButtons.get(box.id);
      if (info) positioned.push({ info, panel });
    }
    const infoBoxes = positioned.map(({ info, panel }) => ({ info, panelBox: panel.querySelector('.target-hud-panel').getBoundingClientRect() }));
    for (const { info, panelBox } of infoBoxes) {
      // The separate root control escapes the detail's layer while sharing its measured position.
      const infoBox = anchorLocalBox(rootBox, { left: panelBox.left - 25,
        top: panelBox.top + panelBox.height / 2 - 10, width: 20, height: 20 });
      setStyle(info, 'left', `${infoBox.left}px`);
      setStyle(info, 'top', `${infoBox.top}px`);
      setStyle(info, 'width', `${infoBox.width}px`);
      setStyle(info, 'height', `${infoBox.height}px`);
    }
    for (const { frame, placement } of intents) {
      setVar(frame, '--combat-selected-intent-top', `${placement.selectedTop}px`);
      setVar(frame, '--combat-selected-intent-center', `${placement.center}px`);
    }
    // Phase 5: the tint cells, rebuilt only when what they draw changed (replacing
    // them dirtied layout, so the next run's first read was a forced layout).
    cells.setAttribute('viewBox', `0 0 ${fieldBox.width} ${fieldBox.height}`);
    const drawn = [];
    for (const id of new Set([...shown, ...eligible, focused].filter(Boolean))) {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry) continue;
      const fill = entry.role === 'player' ? config.behavior.playerTint : config.behavior.enemyTint;
      const opacity = id === focused ? config.behavior.focusedTintOpacity : config.behavior.candidateTintOpacity;
      if (frame.dataset.targetHudCellPolygon) {
        drawn.push({ polygon: JSON.parse(frame.dataset.targetHudCellPolygon).map(point => point.join(',')).join(' '), fill, opacity });
        continue;
      }
      const tile = tiles.get(id);
      if (tile) drawn.push({ path: tile.path, outline: tile.path.outerHTML, box: tile.box, fill, opacity });
    }
    const cellsKey = JSON.stringify([fieldBox.left, fieldBox.top, fieldBox.width, fieldBox.height,
      drawn.map(item => [item.polygon, item.outline, item.box && [item.box.left, item.box.top, item.box.width, item.box.height], item.fill, item.opacity])]);
    if (cellsKey === drawnCells && cells.isConnected) return;
    drawnCells = cellsKey;
    cells.replaceChildren();
    for (const item of drawn) {
      if (item.polygon != null) {
        const shape = document.createElementNS(cells.namespaceURI, 'polygon');
        shape.setAttribute('points', item.polygon);
        shape.setAttribute('fill', item.fill);
        shape.setAttribute('fill-opacity', item.opacity);
        cells.append(shape); continue;
      }
      const svg = document.createElementNS(cells.namespaceURI, 'svg');
      svg.setAttribute('x', item.box.left - fieldBox.left); svg.setAttribute('y', item.box.top - fieldBox.top);
      svg.setAttribute('width', item.box.width); svg.setAttribute('height', item.box.height); svg.setAttribute('viewBox', '0 0 100 100');
      const shape = item.path.cloneNode();
      shape.setAttribute('fill', item.fill);
      shape.setAttribute('fill-opacity', item.opacity);
      shape.setAttribute('stroke', 'none'); svg.append(shape); cells.append(svg);
    }
  }
  function pointer(event) {
    if (!enabled || event.pointerType === 'touch') return;
    const direct = event.target.closest?.('.target-hud-inspect-info, .target-hud-detail, .combatant');
    const id = direct?.dataset.eid;
    if (id && entries.has(id) && !direct.classList.contains('dead') && !direct.inert) {
      if (hover !== id) { hover = id; refreshDesired(); paint(); } return;
    }
    if (hover && panels.has(hover)) {
      const frame = frameFor(hover), panel = panels.get(hover).node;
      const a = frame && rect(frame.querySelector('.sprite')), b = rect(panel);
      if (a && (contains(a, event.clientX, event.clientY, 5) || contains(b, event.clientX, event.clientY, 5)
        || corridor(a, b, event.clientX, event.clientY, config.positioning.gapPx * 1.5))) return;
    }
    if (hover != null) { hover = null; refreshDesired(); paint(); }
  }
  function focus(event) {
    const frame = event.target.closest?.('.combatant, .target-hud-detail');
    if (frame && entries.has(frame.dataset.eid)) { focusWithin = frame.dataset.eid; refreshDesired(); }
  }
  function focusOut(event) { if (!field.contains(event.relatedTarget)) { focusWithin = null; refreshDesired(); } }
  combat.addEventListener('pointermove', pointer);
  combat.addEventListener('pointerleave', pointer);
  field.addEventListener('focusin', focus);
  field.addEventListener('focusout', focusOut);
  field.addEventListener('formationlayoutchange', scheduleGeometry);
  field.addEventListener('battlefieldgeometrychange', scheduleGeometry);
  const resized = () => { gate(); paint(); scheduleGeometry(); };
  window.addEventListener('resize', resized);
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.oldValue !== m.target.getAttribute(m.attributeName))) resized();
  });
  observer.observe(document.documentElement, { attributes: true, attributeOldValue: true, attributeFilter: ['data-form-factor', 'data-display-appearance', 'data-view-preset'] });
  observer.observe(combat, { attributes: true, attributeOldValue: true, attributeFilter: ['data-layout'] });
  const resize = new ResizeObserver(scheduleGeometry); resize.observe(field);
  for (const [name, value] of Object.entries({ fade: config.motion.fadeMs, 'enemy-tint': config.behavior.enemyTint, 'player-tint': config.behavior.playerTint })) layer.style.setProperty(`--target-hud-${name}`, name === 'fade' ? `${value}ms` : value);
  gate();
  return {
    update({ combatants = [], eligibleIds = [], focusedId = null } = {}) {
      if (disposed) return;
      entries = new Map(combatants.map(entry => [entry.id, entry])); eligible = [...eligibleIds]; focused = focusedId;
      gate(); refreshDesired(); paint();
    },
    release() {
      if (disposed) return; disposed = true; cancelHold(); inspectionPointer = null; readGesture = null; clickSeriesActivated = false; gestures.abort(); dwell.dispose(); if (raf !== null) cancelAnimationFrame(raf);
      for (const node of layer.querySelectorAll('.target-hud-detail')) clearTimeout(node.ashenRemove);
      combat.removeEventListener('pointermove', pointer); combat.removeEventListener('pointerleave', pointer);
      field.removeEventListener('focusin', focus); field.removeEventListener('focusout', focusOut);
      field.removeEventListener('battlefieldgeometrychange', scheduleGeometry);
      field.removeEventListener('formationlayoutchange', scheduleGeometry); window.removeEventListener('resize', resized);
      observer.disconnect(); resize.disconnect(); clearPanels(); layer.remove(); cells.remove(); delete combat.dataset.targetHud;
    },
  };
}
