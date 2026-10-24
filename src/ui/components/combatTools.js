import { viewViewportBox } from '../viewViewport.js';
import { button, el } from '../kit/index.js';
import { childModel } from '../models/ComponentModel.js';
import { combatLogHeight, combatLogSnapSize, combatLogDragScale, COMBAT_LOG_SIZES } from '../models/CombatToolsModel.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';
import { t } from '../strings.js';
import { trackGesture } from '../gesture.js';
import { hudGeometry, toolsRowTop } from '../models/HudLayoutOffsetModel.js';
import { visibleCombatPanelRect } from './battlefieldStage.js';
import { openCombatLogModal } from './combatLogModal.js';
import { combatLogPalette } from '../models/CombatLogPaletteModel.js';

// The narrowest a hand-spanning row may be, in CSS px: Combat log and the
// Reaction switch side by side with their gap. A two-card hand is narrower.
const TOOLS_MIN_WIDTH = 240;

/** The tools row's HUD layout tokens, read once per layout pass. */
export function combatToolsTokens(combatEl) {
  const style = getComputedStyle(combatEl);
  const span = style.getPropertyValue('--hud-tools-span').trim() === 'hand' ? 'hand' : 'field';
  return { span, dy: hudGeometry(style).toolsDy };
}

// Controls a raised tools row must not cover (docs/hud-layout-tokens.md).
const TOOLS_OBSTACLES = '.topbar, .turn-ribbon, .combat-hud, .combatant .intent, .combatant-card > :is(.nm,.meters),'
  + ' .combatant-leading button, .combatant-info, .combatant-mini-hud, .player-action-intent,'
  + ' .target-hud-detail, .target-hud-inspect-info, .target-hud-overhead-meters, .hand .card';

/** Screen boxes of every visible control and fighter tap target above the dock. */
function toolsObstacles(combatEl, zoom) {
  const boxes = [...combatEl.querySelectorAll(TOOLS_OBSTACLES)]
    .map(node => visibleCombatPanelRect(node, combatEl)).filter(Boolean);
  // A fighter's tap target is its ::after square, centred on --enemy-hit-x/y.
  for (const frame of combatEl.querySelectorAll('.combatant:is(.enemy-target-hitbox,.player-target-hitbox):not(.dead)')) {
    const style = getComputedStyle(frame, '::after');
    if (style.display === 'none' || style.pointerEvents === 'none') continue;
    const box = frame.getBoundingClientRect();
    const x = box.left + parseFloat(style.left) * zoom, y = box.top + parseFloat(style.top) * zoom;
    const width = parseFloat(style.width) * zoom, height = parseFloat(style.height) * zoom;
    if ([x, y, width, height].every(Number.isFinite)) boxes.push({ left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 });
  }
  return boxes;
}

/** The horizontal extent of the hand's laid-out cards, or null when it has none. */
function cardBand(hand) {
  let left = Infinity, right = -Infinity;
  for (const card of hand ? hand.querySelectorAll('.card') : []) {
    const box = card.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    left = Math.min(left, box.left); right = Math.max(right, box.right);
  }
  return right > left ? { left, right } : null;
}

/** Closes the Full log door for good: the combat has ended or the screen is leaving. */
export function closeCombatFullLog(state) {
  const door = state.fullLog, drawer = state.drawerLog;
  state.fullLog = state.drawerLog = null;
  state.open = false;
  door?.close();
  drawer?.close();
}

// Gap between a corner tool and the combat screen's edge, in CSS px.
const CORNER_INSET = 16;

export function mountCombatTools(combatEl, { state, onToggle, onAutoToggle, readAuto, readSettings = () => ({}), onViewChange, onGridToggle }) {
  const root = markUiComponent(el('aside', { class: 'combat-tools', 'data-combat-read-only': '' }), UI.combatTools);
  const logButton = button({ label: t('combat.log.title'), attrs: { 'data-combat-tool': 'log', 'aria-expanded': 'false', 'aria-controls': 'combat-log' } });
  const gridLabel = el('label', { class: 'combat-grid-toggle' });
  const gridCheckbox = el('input', { type: 'checkbox', 'data-combat-tool': 'grid', 'aria-label': t('combat.grid.aria') });
  gridLabel.append(gridCheckbox, el('span', { text: t('combat.grid.label') }));
  const gridRoot = document.documentElement;
  const syncGrid = () => { gridCheckbox.checked = gridRoot?.dataset?.formationGrid !== 'false'; };
  syncGrid();
  gridCheckbox.addEventListener('change', async () => {
    const enabled = gridCheckbox.checked;
    gridCheckbox.disabled = true;
    try { await onGridToggle?.(enabled); }
    catch (error) { console.warn('[combat] grid preference refused:', error.message); }
    finally { if (!released) { syncGrid(); gridCheckbox.disabled = false; } }
  });
  logButton.style.touchAction = 'none';
  logButton.style.userSelect = 'none';
  logButton.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown Home End');
  const reaction = markUiComponent(button({ label: '', attrs: { 'data-combat-tool': 'reaction', role: 'switch', 'aria-checked': 'true' } }), UI.reactionToggle);
  reaction.classList.add('reaction-switch');
  const label = el('span', { text: t('combat.reactions.label') });
  const track = el('span', { class: 'reaction-switch-track' });
  const value = el('span', { class: 'reaction-switch-value' });
  const thumb = el('span', { class: 'reaction-switch-thumb', 'aria-hidden': 'true' });
  track.append(value, thumb); reaction.replaceChildren(label, track);
  // The Auto switch is the Reaction switch's twin: same markup and classes, bound to the autoCombat setting.
  const auto = button({ label: '', attrs: { 'data-combat-tool': 'auto', role: 'switch', 'aria-checked': 'false' } });
  auto.classList.add('reaction-switch', 'auto-switch');
  const autoValue = el('span', { class: 'reaction-switch-value' });
  const autoTrack = el('span', { class: 'reaction-switch-track' });
  autoTrack.append(autoValue, el('span', { class: 'reaction-switch-thumb', 'aria-hidden': 'true' }));
  auto.replaceChildren(el('span', { text: t('combat.auto.label') }), autoTrack);
  const panel = markUiComponent(el('section', { id: 'combat-log', class: 'combat-log-panel', 'aria-label': t('combat.log.title'), hidden: true }), UI.combatLogDrawer);
  const title = el('div', { class: 'combat-log-heading', text: t('combat.log.title') });
  // Opens the full-screen log. It sits in the header, outside the scrolling list,
  // and is a plain text button: it is not one of the three drag sizes.
  const fullLog = button({ label: t('combat.log.full'), attrs: { 'data-combat-tool': 'full-log', 'aria-haspopup': 'dialog' } });
  fullLog.classList.add('combat-log-full');
  // A remount draws a new Full log button. An open door is adopted by it: its
  // focus return moves to this button, and a closed handle is dropped.
  if (state.fullLog && !state.fullLog.panel.isConnected) state.fullLog = null;
  state.fullLog?.setOpener(fullLog);
  state.fullLog?.setConsoleEnabled(readSettings()?.combatLogConsole === true);
  state.drawerLog?.setConsoleEnabled(readSettings()?.combatLogConsole === true);
  state.drawerLog?.setOpener(logButton);
  const head = el('div', { class: 'combat-log-head' });
  head.append(title, fullLog);
  const list = el('div', { class: 'combat-log-entries', 'data-combat-tool': 'entries', tabindex: '0', role: 'region', 'aria-label': t('combat.log.actions') });
  list.addEventListener('scroll', () => { state.scrollTop = list.scrollTop; state.followLatest = list.scrollTop + list.clientHeight >= list.scrollHeight - 4; });
  panel.append(head, list); root.append(panel, logButton, reaction, ...(onAutoToggle ? [auto] : []), gridLabel); combatEl.append(root);
  let drag = null, suppressClick = false, released = false;
  const snapHeights = () => {
    const menuBottom = [...combatEl.querySelectorAll('.topbar button')].reduce((max, node) => Math.max(max, node.getBoundingClientRect().bottom), 0);
    const space = { cardHeight: combatEl.querySelector('.hand .card')?.getBoundingClientRect().height || 250,
      viewportHeight: viewViewportBox().height, dockTop: root.getBoundingClientRect().top - 6,
      menuBottom, gap: parseFloat(getComputedStyle(root).getPropertyValue('--combat-tools-gap')) || 8 };
    return Object.fromEntries(COMBAT_LOG_SIZES.map(size => [size, combatLogHeight({ ...space, size })]));
  };
  logButton.addEventListener('click', event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); return; }
    state.open = !state.open; onViewChange();
  });
  logButton.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    suppressClick = false;
    const heights = snapHeights();
    const dragScale = combatLogDragScale({ heights, viewportHeight: viewViewportBox().bottom,
      handleBottom: root.getBoundingClientRect().bottom });
    const gesture = drag = { pointerId: event.pointerId, y: event.clientY, active: false,
      open: state.open, size: state.size, height: state.open ? heights[state.size] : heights.Small, heights };
    const initialHeight = gesture.height;
    trackGesture(event, {
      onMove(move) {
        if (released || drag !== gesture) return;
        const delta = gesture.y - move.clientY;
        if (!gesture.active && Math.abs(delta) < 6) return;
        gesture.active = true; move.preventDefault();
        gesture.height = Math.max(heights.Small, Math.min(heights.Large, initialHeight + delta * dragScale));
        root.dataset.logDragging = 'true'; state.open = true; onViewChange();
      },
      onEnd(_event, { cancelled }) {
        if (released || drag !== gesture) return;
        drag = null; delete root.dataset.logDragging;
        if (!gesture.active) return;
        suppressClick = !cancelled;
        state.open = cancelled ? gesture.open : true;
        state.size = cancelled ? gesture.size : combatLogSnapSize(gesture.height, heights);
        onViewChange();
      },
    });
  });
  logButton.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const index = COMBAT_LOG_SIZES.indexOf(state.size);
    state.size = event.key === 'Home' ? COMBAT_LOG_SIZES[0] : event.key === 'End' ? COMBAT_LOG_SIZES.at(-1)
      : COMBAT_LOG_SIZES[Math.max(0, Math.min(2, index + (event.key === 'ArrowUp' ? 1 : -1)))];
    state.open = true; onViewChange();
  });
  // The full log is a door of its own. It reads the same entries as the drawer
  // and changes neither the drawer's open state nor its size. Its live handle
  // sits on the screen's `state`, so a remount keeps the same door open; only
  // the screen's teardown (closeCombatFullLog) or the reader's Close ends it.
  let latestEntries = [];
  const readPalette = () => {
    const settings = readSettings() || {};
    return combatLogPalette(settings);
  };
  fullLog.addEventListener('click', () => {
    if (state.fullLog) return;
    state.fullLog = openCombatLogModal({ entries: latestEntries, palette: readPalette(), showConsole: readSettings()?.combatLogConsole === true, opener: fullLog, onClose: () => { state.fullLog = null; } });
  });
  reaction.addEventListener('click', () => onToggle(reaction.getAttribute('aria-checked') !== 'true'));
  // Like the Grid checkbox: wait for the write, block overlapping toggles, and repaint from the persisted
  // setting after success or rollback (the screen's handler repaints from readSettings()).
  let autoBusy = false, autoSupported = true;
  auto.addEventListener('click', async () => {
    // Toggle from the live setting when the screen supplies it: Settings may have changed it since this switch painted.
    const enabled = readAuto ? !readAuto() : auto.getAttribute('aria-checked') !== 'true';
    const hadFocus = document.activeElement === auto;
    autoBusy = true; auto.disabled = true;
    try { await onAutoToggle?.(enabled); }
    catch (error) { console.warn('[combat] auto combat preference refused:', error.message); }
    finally {
      autoBusy = false;
      if (!released) { auto.disabled = !autoSupported; if (hadFocus) auto.focus({ preventScroll: true }); }
    }
  });
  let frame = 0, entryKey = '';
  // Writes only what changed: a repeated pass (renderCombatTools runs eight to ten
  // times in an End Turn) then dirties nothing, so the next read is not a flush.
  // Custom properties are remembered here (the toolbar and the combat root are the
  // only writers of these two); plain inline properties compare with the style itself.
  const customWritten = new Map();
  const put = (node, name, value) => {
    if (name.startsWith('--')) {
      if (customWritten.get(name) === value) return;
      customWritten.set(name, value); node.style.setProperty(name, value);
    } else if (node.style[name] !== value) node.style[name] = value;
  };
  // The toolbar's own height depends on its labels, the combat width and the text
  // size, so it is read once per width/zoom/inset/log-button key and again when
  // update() changes a label.
  let heightKey = '', heightValue = 0, toolbarLabelKey = '';
  function measure() {
    frame = 0;
    if (!root.isConnected) return;
    // Phase 1: every read, before the first write of this pass.
    const combatBox = combatEl.getBoundingClientRect();
    const zoom = combatBox.width / combatEl.clientWidth || 1;
    const logWidth = logButton.getBoundingClientRect().width / zoom;
    const hand = combatEl.querySelector('.hand');
    const handBox = hand?.getBoundingClientRect();
    // HUD layout tokens (docs/hud-layout-tokens.md), read once per pass.
    const { span, dy } = combatToolsTokens(combatEl);
    // Tools belong to the screen edges, never the current fan or hand width.
    const width = Math.max(0, combatBox.width - 2 * CORNER_INSET * zoom);
    const left = combatBox.left + CORNER_INSET * zoom;
    const split = combatEl.dataset.desktopFooter === 'true';
    const inset = split ? parseFloat(getComputedStyle(combatEl).getPropertyValue('--desktop-corner-inset')) : CORNER_INSET;
    // Negative offsets may raise the dock, but cannot cover artwork, cards,
    // or controls. Compact docking needs the measured row height; the desktop
    // footer already supplies its top and only measures a requested raise.
    const dockTop = combatEl.querySelector('.hand-area')?.getBoundingClientRect().top ?? handBox?.top ?? combatBox.bottom;
    const footerControls = combatEl.querySelector('.combat-action-row');
    const footerTop = split
      ? combatBox.top + parseFloat(getComputedStyle(combatEl).getPropertyValue('--desktop-tools-top')) * zoom
      : footerControls?.getBoundingClientRect().top ?? dockTop;
    // Phase 2: the row in its final corner geometry (first pass after a resize
    // included). Skipped writes keep a repeated pass from dirtying layout.
    put(root, '--combat-log-button-width', `${logWidth}px`);
    put(root, 'left', `${inset}px`);
    put(root, 'right', `${inset}px`);
    put(root, 'width', 'auto');
    if (root.dataset.toolsPlacement !== 'corners') root.dataset.toolsPlacement = 'corners';
    // A compact toolbar occupies the top of the card band. It never consumes
    // hand width: doing that collapsed every card onto one slot on phones.
    put(combatEl, '--combat-tools-reserve', '0px');
    let rowHeight = 0;
    if (!split || dy < 0) {
      const key = [combatBox.width, zoom, inset, logWidth].join('|');
      if (key !== heightKey || dy < 0) { heightValue = root.getBoundingClientRect().height; heightKey = key; }
      rowHeight = heightValue;
    }
    const defaultTop = split ? footerTop : footerTop - rowHeight - 4 / zoom;
    const top = dy < 0 ? toolsRowTop({ dockTop: defaultTop, dy: dy * zoom,
      row: { left, width, height: rowHeight }, screenTop: combatBox.top,
      obstacles: toolsObstacles(combatEl, zoom) }) : defaultTop;
    // anchorLocalBox(combatEl, ...) with the box read above, not read again.
    put(root, 'top', `${(top - combatBox.top) / zoom}px`);
    // The legacy panel is always hidden; both readers are body modals. Only a
    // real Log press needs snapHeights(), to preserve drag/snap/cancel behavior.
    if (root.dataset.logSize !== state.size) root.dataset.logSize = state.size;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  function flushGeometry() {
    if (frame) cancelAnimationFrame(frame);
    measure();
  }
  const observer = new ResizeObserver(schedule);
  observer.observe(combatEl);
  const footer = combatEl.querySelector('.combat-action-row'); if (footer) observer.observe(footer);
  const hand = combatEl.querySelector('.hand-overlay'); if (hand) observer.observe(hand);
  window.visualViewport?.addEventListener('resize', schedule);
  addEventListener('resize', schedule);
  // applyUiScale writes data-form-factor after its debounced resize, when the
  // observer above has already measured with the old form factor's span and
  // offset. Re-measure at once on a real change, before the stage's refit
  // (its own observer) reads this row as a footer obstacle.
  const formFactorObserver = new MutationObserver(records => {
    if (records.some(record => record.oldValue !== document.documentElement.getAttribute('data-form-factor'))) flushGeometry();
  });
  formFactorObserver.observe(document.documentElement, { attributes: true, attributeOldValue: true, attributeFilter: ['data-form-factor'] });
  const gridObserver = new MutationObserver(syncGrid);
  gridObserver.observe(gridRoot, { attributes: true, attributeFilter: ['data-formation-grid'] });
  function update(model, { auto: autoOn = false } = {}) {
    const toggle = childModel(model, UI.reactionToggle).properties;
    const log = childModel(model, UI.combatLogDrawer).properties;
    reaction.disabled = toggle.disabled;
    reaction.setAttribute('aria-checked', String(toggle.enabled));
    const stateLabel = t(toggle.enabled ? 'combat.reactions.enabled' : 'combat.reactions.disabled');
    reaction.setAttribute('aria-label', t('combat.reactions.state', { state: stateLabel }));
    reaction.dataset.enabled = String(toggle.enabled);
    value.textContent = stateLabel;
    autoSupported = !!toggle.supported;
    if (!autoBusy) auto.disabled = !autoSupported;
    auto.setAttribute('aria-checked', String(!!autoOn));
    auto.dataset.enabled = String(!!autoOn);
    const autoLabel = t(autoOn ? 'combat.reactions.enabled' : 'combat.reactions.disabled');
    auto.setAttribute('aria-label', t('combat.auto.state', { state: autoLabel }));
    autoValue.textContent = autoLabel;
    const labelKey = stateLabel + '|' + autoLabel + '|' + !!onAutoToggle;
    if (labelKey !== toolbarLabelKey) { toolbarLabelKey = labelKey; heightKey = ''; }
    // Expanded reading uses the same body portal, focus/back handling and layer
    // as the full log, so battlefield stacking contexts cannot cover it.
    panel.hidden = true;
    if (log.open && !state.drawerLog) state.drawerLog = openCombatLogModal({
      entries: log.entries, palette: readPalette(), showConsole: readSettings()?.combatLogConsole === true, opener: logButton, detailed: false,
      onClose: () => { state.drawerLog = null; state.open = false; onViewChange(); },
    });
    if (!log.open && state.drawerLog) { const drawer = state.drawerLog; state.drawerLog = null; drawer.close(); }
    logButton.setAttribute('aria-expanded', String(log.open));
    logButton.setAttribute('aria-description', `${log.size}. Tap to open or close; drag up or down to resize. Arrow keys change size.`);
    latestEntries = log.entries;
    const palette = readPalette();
    state.fullLog?.setConsoleEnabled(readSettings()?.combatLogConsole === true);
    state.drawerLog?.setConsoleEnabled(readSettings()?.combatLogConsole === true);
    const key = JSON.stringify([log.entries, palette]);
    if (key !== entryKey) {
      entryKey = key;
      // The legacy panel stays hidden; only the actual modal readers need DOM.
      // latestEntries above keeps a closed reader current without building a
      // second, inaccessible copy of the receipt history on every combat beat.
      state.fullLog?.setEntries(log.entries, palette);
      state.drawerLog?.setEntries(log.entries, palette);
    }
    schedule();
  }
  return { update, flushGeometry,
    focusedTool() { return root.contains(document.activeElement) ? document.activeElement.dataset.combatTool || null : null; },
    restoreFocus(token) { if (token) root.querySelector(`[data-combat-tool="${CSS.escape(token)}"]`)?.focus({ preventScroll: true }); },
    // A remount releases this instance but leaves an open full log to the next one.
    release() { released = true; observer.disconnect(); formFactorObserver.disconnect(); gridObserver.disconnect(); cancelAnimationFrame(frame); window.visualViewport?.removeEventListener('resize', schedule); removeEventListener('resize', schedule); root.remove(); } };
}
