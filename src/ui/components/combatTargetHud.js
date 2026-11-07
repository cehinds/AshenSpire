import { t } from '../strings.js';
import { setCombatantTargetHud } from './combatantFrame.js';
import { targetHudConfig, targetHudEnabled, miniHudScale, enemyHudPlacement, createTargetHudDwell, targetHudDesiredIds, targetHudTintIds } from '../models/TargetHudModel.js';
import { attachTooltip, esc, hideTooltip } from './tooltip.js';
import { combatantInfo } from './combatantOverhead.js';
import { anchorLocalBox } from '../fx.js';
import { reducedMotionRequested } from '../motion.js';
import { refreshIconTray } from './iconTray.js';
import { setVar, setStyle, setData, setAttr, markBuilt, morph } from '../domWrite.js';

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
  // Owner 2026-11-06: an enemy's panel shows its intent (the whole queue) where its name text was. The name stays for
  // screen readers (aria-label/title) and in the inspect panel; the player's panel keeps its name.
  const intent = entry.role === 'enemy' && entry.createIntent ? entry.createIntent() : null;
  if (entry.role === 'enemy') {
    const slot = node('div', 'target-hud-name target-hud-name-intent');
    slot.title = entry.name; slot.setAttribute('aria-label', entry.name);
    const sr = node('span', 'sr-only', entry.name);
    slot.append(sr);
    if (intent) slot.append(intent);
    panel.append(slot);
  } else panel.append(node('div', 'target-hud-name', entry.name));
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
  let drawnCells = null, placedKey = null, placeTries = 0;
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
    setData(shell, 'targeting', active);
    const name = shell.querySelector('.target-hud-name');
    const mark = (el, role) => { // each write only when it differs: this runs on every paint
      if (role) { setAttr(el, 'role', 'button'); setAttr(el, 'tabindex', 0); }
      else { if (el.hasAttribute('role')) el.removeAttribute('role'); if (el.hasAttribute('tabindex')) el.removeAttribute('tabindex'); }
    };
    mark(name, active);
    // Owner 2026-10-25: out of targeting the whole panel is the inspection door.
    // Its name comes from its content (name, HP, stats), not an override.
    mark(shell.querySelector('.target-hud-panel'), !active && canInspect());
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
  const desired = () => targetHudDesiredIds({ entries: entries.values(), eligible, focused, hover, focusWithin });
  const refreshDesired = () => dwell.request(enabled ? desired() : []);
  function gate() {
    const next = targetHudEnabled({ formFactor: document.documentElement.dataset.formFactor,
      layout: combat.dataset.layout || 'formation' }, config);
    enabled = next;
    if (combat.dataset.targetHud !== String(next)) combat.dataset.targetHud = String(next);
    if (layer.hidden === next) layer.hidden = !next;
    if (cells.hidden === next) cells.hidden = !next;
    for (const frame of field.querySelectorAll('.combatant')) setCombatantTargetHud(frame, next);
    if (!next) { cancelHold(); lastTap = null; hover = null; shown = []; dwell.reset(); clearPanels(); }
    refreshDesired();
  }
  function clearPanels() {
    for (const panel of panels.values()) { clearTimeout(panel.node.ashenRemove); panel.watch.disconnect(); panel.node.remove(); panel.info.remove(); }
    infoButtons.clear();
    panels.clear();
    for (const frame of field.querySelectorAll('.combatant')) {
      frame.classList.remove('target-hud-selected', 'target-hud-focused', 'target-hud-candidate');
      delete frame.dataset.matchupActive;
      delete frame.dataset.matchup;
      frame.style.removeProperty('--combat-matchup-color');
    }
    cells.replaceChildren(); drawnCells = null; placedKey = null;
  }
  function frameFor(id) { return [...field.querySelectorAll('.combatant')].find(frame => frame.dataset.eid === id); }
  // The Inspect control beside a panel is built with it and kept; only its label and handlers follow a rebuild.
  const buildInfo = (id, entry) => {
    const info = combatantInfo(entry.name, opener => inspect(id, opener));
    info.classList.add('target-hud-inspect-info'); info.dataset.eid = id;
    return info;
  };
  // Owner (2026-11-06): every HUD node is created once, when the combatant first appears (at combat mount). After that a
  // change of value is written into the nodes that stand (morph), a panel is shown or hidden by class, and nothing is
  // re-created, replaced or re-placed. Only a combatant leaving the board (a defeat) removes its panel.
  function createPanel(id, entry) {
    const shell = panelFor(entry); markBuilt(shell);
    shell.style.setProperty('--combat-matchup-color', entry.auraColor || '#e4cd59');
    const info = buildInfo(id, entry); markBuilt(info);
    combat.append(info); infoButtons.set(id, info);
    info.addEventListener('pointerenter', () => { hover = id; refreshDesired(); });
    info.addEventListener('pointerleave', () => { hover = null; refreshDesired(); });
    info.addEventListener('focusin', () => { focusWithin = id; refreshDesired(); });
    info.addEventListener('focusout', () => { focusWithin = null; refreshDesired(); });
    wireInspect(shell, id);
    layer.append(shell);
    shell.addEventListener('pointerenter', () => { hover = id; refreshDesired(); });
    shell.addEventListener('pointerleave', event => pointer(event));
    shell.addEventListener('focusin', () => { focusWithin = id; refreshDesired(); });
    shell.addEventListener('focusout', event => { if (!shell.contains(event.relatedTarget)) { focusWithin = null; refreshDesired(); } });
    const record = { node: shell, info, key: entry.key, statusKey: entry.statusKey };
    record.watch = new ResizeObserver(() => placeInfo(record)); record.watch.observe(shell);
    panels.set(id, record);
    return record;
  }
  // The panel's text and bars are rewritten where they stand. Meters holding a proc bar carry listeners a rebuild cannot
  // hand over, so those are replaced (a build-up bar appearing is a real structural change); so is a changed status tray.
  function refreshPanel(record, entry) {
    const fresh = panelFor(entry), live = record.node;
    const livePanel = live.querySelector('.target-hud-panel'), freshPanel = fresh.querySelector('.target-hud-panel');
    const keeps = !livePanel.querySelector('.procbar, .arcane') && !freshPanel.querySelector('.procbar, .arcane');
    if (keeps) morph(livePanel, freshPanel);
    else { markBuilt(freshPanel); livePanel.replaceWith(freshPanel); }
    if (record.statusKey !== entry.statusKey) {
      const tray = live.querySelector('.target-hud-statuses'), next = fresh.querySelector('.target-hud-statuses');
      const swapped = morph(tray, next);
      if (swapped) refreshIconTray(tray, next);
    }
    setAttr(live, 'aria-label', fresh.getAttribute('aria-label'));
    morph(record.info, buildInfo(entry.id, entry));
    record.key = entry.key; record.statusKey = entry.statusKey;
  }
  function removePanel(id, record) {
    panels.delete(id); infoButtons.delete(id); record.watch.disconnect(); record.info.remove(); record.node.classList.add('leaving');
    const remove = () => record.node.remove();
    if (reducedMotionRequested()) remove(); else record.node.addEventListener('transitionend', remove, { once: true });
    // A disconnected mount or a suppressed CSS transition still owns removal.
    record.node.ashenRemove = setTimeout(remove, config.motion.fadeMs);
  }
  function paint() {
    if (disposed || !enabled) return;
    const next = new Set(shown.filter(id => entries.has(id)));
    for (const [id, record] of panels) if (!entries.has(id)) removePanel(id, record);
    let created = false;
    for (const [id, entry] of entries) {
      let record = panels.get(id);
      if (!record) { record = createPanel(id, entry); created = true; } else if (record.key !== entry.key) refreshPanel(record, entry);
      const shell = record.node, visible = next.has(id);
      setData(shell, 'matchup', entry.matchup || 'neutral');
      setData(shell, 'matchupActive', !!entry.matchupActive && eligible.includes(id));
      setVar(shell, '--combat-matchup-color', entry.auraColor || '#e4cd59');
      syncActivation(shell, id);
      if (shell.classList.contains('visible') !== visible) shell.classList.toggle('visible', visible);
      // A hidden panel and its Inspect control take no pointer or focus (CSS: visibility), and say so to assistive tech.
      if (record.info.hidden === visible) record.info.hidden = !visible;
    }
    for (const frame of field.querySelectorAll('.combatant')) {
      const id = frame.dataset.eid;
      const entry = entries.get(id);
      const matchup = entry?.matchup || 'neutral', active = String(!!entry?.matchupActive && eligible.includes(id));
      const color = entry?.auraColor || '#e4cd59';
      setData(frame, 'matchup', matchup); setData(frame, 'matchupActive', active); setVar(frame, '--combat-matchup-color', color);
      const toggle = (name, on) => { if (frame.classList.contains(name) !== on) frame.classList.toggle(name, on); };
      toggle('target-hud-selected', next.has(id));
      toggle('target-hud-focused', id === focused || id === hover);
      toggle('target-hud-candidate', eligible.includes(id));
    }
    if (created) placedKey = null;
    scheduleGeometry();
  }
  const tintIds = () => targetHudTintIds({ entries: entries.values(), shown, eligible, focused, hover, focusWithin });
  function scheduleGeometry() { if (!disposed && raf === null) raf = requestAnimationFrame(geometry); }
  // Owner (2026-11-06): "keep enemy mini HUDs above them in a fixed position; keep the player HUD anchored to the right and
  // fixed". Each panel is placed once per layout pass (field.dataset.layoutEpoch, or a real viewport change) from its own
  // figure alone: an enemy's centred on its mini rack, bottom at the rack's top, as wide as its cell; the player's right of
  // the body at its top, as wide as its cell. No avoidance, no packing; only the screen edge clamps. A pose, a stance
  // preview, a selection, a hover, an intent or damage never moves a panel. The anchor is kept in the player frame's own
  // coordinates (css px from its top-left) and projected through the current frame box and zoom, so a page-zoom change
  // below the relayout threshold cannot leave the panel behind the figure. Only a settled measurement (art and body both
  // loaded) is kept; a fallback envelope is never frozen.
  // The Inspect control stands inside its panel's top-right corner (the name leaves room for it), so a panel as wide as its
  // cell never has a neighbour's control over it. It follows the panel's box: placed with it, and again whenever the panel
  // changes size (a status tray appearing grows an enemy's panel upward), through a ResizeObserver, never a poll.
  // The same resize path keeps an enemy's hanging panel inside the screen edge: it hangs from `hang` (just above its rack),
  // so when it grows taller (a status tray appears) its top may pass `minTop`; then the hang point drops, never the figure anchor.
  function clampHang(record) {
    if (record.hang == null || !record.node.isConnected) return;
    const fieldBox = rect(field), height = record.node.getBoundingClientRect().height;
    const y = Math.max(record.hang, record.minTop + height);
    if (y === record.hangApplied) return;
    const local = anchorLocalBox(fieldBox, { left: 0, top: y, width: 0, height: 0 }, { zoom: record.zoom });
    setStyle(record.node, 'top', `${local.top}px`); record.hangApplied = y;
  }
  function placeInfo(record) {
    clampHang(record);
    if (!record.node.isConnected) return;
    const panel = record.node.querySelector('.target-hud-panel').getBoundingClientRect(), rootBox = combat.getBoundingClientRect();
    if (!panel.width) return;
    const info = anchorLocalBox(rootBox, { left: panel.right - 20 - 5, top: panel.top + 5, width: 20, height: 20 });
    setStyle(record.info, 'left', `${info.left}px`); setStyle(record.info, 'top', `${info.top}px`);
    setStyle(record.info, 'width', `${info.width}px`); setStyle(record.info, 'height', `${info.height}px`);
  }
  function place(fieldBox, rootBox, zoom, bounds, epoch) {
    const gap = config.positioning.gapPx, sizing = config.sizing;
    const rows = [];
    for (const [id, record] of panels) {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry) continue;
      const cellWidth = Number(frame.dataset.cellWidth) || rect(frame).width;
      rows.push({ id, record, frame, entry, cellWidth, ...miniHudScale({ cellWidth }) });
    }
    // Writes: the panel is exactly as wide as its cell, its contents scaled to it (never below the minimum font).
    for (const { record, cellWidth, scale, fontPx } of rows) {
      const node = record.node;
      setVar(node, '--mini-hud-scale', String(scale));
      setVar(node, '--target-hud-font', `${fontPx / zoom}px`);
      setVar(node, '--target-hud-status-size', `${sizing.statusIconPx * scale / zoom}px`);
      setStyle(node, 'width', `${anchorLocalBox({ left: 0, top: 0 }, { left: 0, top: 0, width: cellWidth, height: 0 }, { zoom }).width}px`);
    }
    // Reads: each panel's height (after its font and width), each enemy's rack.
    let ready = true;
    for (const row of rows) {
      row.height = row.record.node.getBoundingClientRect().height || sizing.panelHeightPx;
      const rack = row.frame.querySelector(':scope > .target-hud-overhead-meters'), box = rack ? rack.getBoundingClientRect() : null;
      if (!box || !box.height) { ready = false; continue; }
      row.rack = { centerX: box.left + box.width / 2, top: box.top };
    }
    // Writes: positions. An enemy panel hangs from its bottom edge (CSS translates it up by its own height), so a taller
    // status tray never moves it down.
    const boxes = [];
    for (const row of rows) {
      let at;
      if (row.rack) {
        const placed = enemyHudPlacement({ centerX: row.rack.centerX, bottom: row.rack.top - gap / 4, width: row.cellWidth, height: row.height, bounds });
        at = { left: placed.left, top: placed.top + row.height };
        Object.assign(row.record, { hang: row.rack.top - gap / 4, minTop: bounds.top, hangApplied: at.top, zoom });
      }
      if (!at) continue;
      const local = anchorLocalBox(fieldBox, { left: at.left, top: at.top, width: 0, height: 0 }, { zoom });
      setStyle(row.record.node, 'left', `${local.left}px`); setStyle(row.record.node, 'top', `${local.top}px`);
      boxes.push(row);
    }
    for (const row of boxes) placeInfo(row.record);
    return ready;
  }
  function geometry() {
    raf = null;
    if (disposed || !enabled || !field.isConnected) return;
    const fieldBox = rect(field), zoom = fieldBox.width / field.clientWidth || 1;
    const hand = combat.querySelector('.hand'), handTop = hand?.getBoundingClientRect().top;
    const rootBox = combat.getBoundingClientRect();
    const bottom = Math.min(fieldBox.top + fieldBox.height, Number.isFinite(handTop) ? handTop - config.positioning.gapPx : rootBox.bottom);
    // Clamp against what is visible: the field, the combat root and the viewport, then the hand-top cut.
    const vw = window.innerWidth || rootBox.right, vh = window.innerHeight || rootBox.bottom;
    const visLeft = Math.max(fieldBox.left, rootBox.left, 0), visTop = Math.max(fieldBox.top, rootBox.top, 0);
    const visRight = Math.min(fieldBox.left + fieldBox.width, rootBox.right, vw), visBottom = Math.min(bottom, rootBox.bottom, vh);
    const bounds = { left: visLeft, top: visTop, width: Math.max(0, visRight - visLeft), height: Math.max(0, visBottom - visTop) };
    const epoch = field.dataset.layoutEpoch || '';
    const frames = [...field.querySelectorAll('.combatant:not(.dead)')];
    // The placement key is what a layout pass changes. Anything else (selection, hover, play, damage) leaves it alone, so
    // the panels are not touched; a not-yet-ready anchor (art still loading) retries a few times, then waits for an event.
    const key = [epoch, fieldBox.left, fieldBox.top, fieldBox.width, fieldBox.height, zoom, bounds.left, bounds.top, bounds.width, bounds.height,
      [...panels.keys()].join(), frames.map(frame => frame.dataset.cellWidth).join(), document.documentElement.dataset.formFactor].join('|');
    if (key !== placedKey) {
      if (place(fieldBox, rootBox, zoom, bounds, epoch)) { placedKey = key; placeTries = 0; }
      else if (placeTries++ < 20) scheduleGeometry();
    }
    // The tint cells, rebuilt only when what they draw changed (replacing them dirtied layout).
    const tiles = new Map();
    for (const id of tintIds()) {
      const frame = frameFor(id), entry = entries.get(id); if (!frame || !entry || frame.dataset.targetHudCellPolygon) continue;
      const tile = field.querySelector(`.formation-grid-cell[data-cell="${frame.dataset.formationCell}"]`);
      const path = tile?.querySelector('[data-perspective-outline]');
      if (tile && path) tiles.set(id, { path, box: tile.getBoundingClientRect() });
    }
    const viewBox = `0 0 ${fieldBox.width} ${fieldBox.height}`;
    if (cells.getAttribute('viewBox') !== viewBox) cells.setAttribute('viewBox', viewBox);
    const drawn = [];
    for (const id of tintIds()) {
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
