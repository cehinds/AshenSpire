import { button, el } from '../kit/index.js';
import { childModel } from '../models/ComponentModel.js';
import { combatLogHeight, combatLogSnapSize, combatLogDragScale, COMBAT_LOG_SIZES } from '../models/CombatToolsModel.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { t } from '../strings.js';
import { trackGesture } from '../gesture.js';
import { hudGeometry, toolsRowTop } from '../models/HudLayoutOffsetModel.js';
import { visibleCombatPanelRect } from './battlefieldStage.js';
import { renderCombatLogEntries, openCombatLogModal } from './combatLogModal.js';

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
  + ' .combatant-leading button, .combatant-info, .combatant-mini-hud, .player-action-intent';

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

export function mountCombatTools(combatEl, { state, onToggle, onViewChange }) {
  const root = markUiComponent(el('aside', { class: 'combat-tools', 'data-combat-read-only': '' }), UI.combatTools);
  const logButton = button({ label: t('combat.log.title'), attrs: { 'data-combat-tool': 'log', 'aria-expanded': 'false', 'aria-controls': 'combat-log' } });
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
  const panel = markUiComponent(el('section', { id: 'combat-log', class: 'combat-log-panel', 'aria-label': t('combat.log.title'), hidden: true }), UI.combatLogDrawer);
  const title = el('div', { class: 'combat-log-heading', text: t('combat.log.title') });
  // Opens the full-screen log. It sits in the header, outside the scrolling list,
  // and is a plain text button: it is not one of the three drag sizes.
  const fullLog = button({ label: t('combat.log.full'), attrs: { 'data-combat-tool': 'full-log', 'aria-haspopup': 'dialog' } });
  fullLog.classList.add('combat-log-full');
  const head = el('div', { class: 'combat-log-head' });
  head.append(title, fullLog);
  const list = el('div', { class: 'combat-log-entries', 'data-combat-tool': 'entries', tabindex: '0', role: 'region', 'aria-label': t('combat.log.actions') });
  list.addEventListener('scroll', () => { state.scrollTop = list.scrollTop; state.followLatest = list.scrollTop + list.clientHeight >= list.scrollHeight - 4; });
  panel.append(head, list); root.append(panel, logButton, reaction); combatEl.append(root);
  let drag = null, suppressClick = false, released = false;
  const snapHeights = () => {
    const menuBottom = [...combatEl.querySelectorAll('.topbar button')].reduce((max, node) => Math.max(max, node.getBoundingClientRect().bottom), 0);
    const space = { cardHeight: combatEl.querySelector('.hand .card')?.getBoundingClientRect().height || 250,
      viewportHeight: window.visualViewport?.height || innerHeight, dockTop: root.getBoundingClientRect().top - 6,
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
    const dragScale = combatLogDragScale({ heights, viewportHeight: window.visualViewport?.height || innerHeight,
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
  // and changes neither the drawer's open state nor its size.
  let fullLogModal = null, latestEntries = [];
  fullLog.addEventListener('click', () => {
    if (fullLogModal) return;
    fullLogModal = openCombatLogModal({ entries: latestEntries, opener: fullLog, onClose: () => { fullLogModal = null; } });
  });
  reaction.addEventListener('click', () => onToggle(reaction.getAttribute('aria-checked') !== 'true'));
  let frame = 0, entryKey = '';
  function measure() {
    frame = 0;
    if (!root.isConnected) return;
    const combatBox = combatEl.getBoundingClientRect();
    const zoom = combatBox.width / combatEl.clientWidth || 1;
    const hand = combatEl.querySelector('.hand');
    const handBox = hand?.getBoundingClientRect();
    // HUD layout tokens (docs/hud-layout-tokens.md), read once per pass.
    const { span, dy } = combatToolsTokens(combatEl);
    // 'field' (the default) spans the hand's full row, as it always has.
    // 'hand' spans only the card band: the first card's left edge to the last
    // card's right edge, never narrower than the two tools need.
    let width = Math.max(0, (handBox?.width || innerWidth) - 12);
    let left = (handBox?.right || innerWidth) - width - 6;
    const band = span === 'hand' ? cardBand(hand) : null;
    if (band && handBox) {
      const minWidth = Math.min(handBox.width - 12, TOOLS_MIN_WIDTH * zoom);
      width = Math.max(band.right - band.left, minWidth);
      const center = (band.left + band.right) / 2;
      left = Math.max(handBox.left + 6, Math.min(center - width / 2, handBox.right - 6 - width));
    }
    const localWidth = anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width, height: 0 }, { zoom });
    root.style.width = `${localWidth.width}px`;
    // A compact toolbar occupies the top of the card band. It never consumes
    // hand width: doing that collapsed every card onto one slot on phones.
    combatEl.style.setProperty('--combat-tools-reserve', '0px');
    // The vertical offset only raises the row (toolsRowTop): it may rise into
    // the field but never leaves the combat screen, never covers a control
    // above it, and never drops over the cards below its dock (dy > 0 is
    // ignored). Its height is read only for a raise: at 0 no layout is forced.
    const dockTop = handBox?.top || 0;
    const top = dy < 0 ? toolsRowTop({ dockTop, dy: dy * zoom, screenTop: combatBox.top,
      row: { left, width, height: root.getBoundingClientRect().height }, obstacles: toolsObstacles(combatEl, zoom) }) : dockTop;
    const localDock = anchorLocalBox(combatEl, { left,
      top, width: 0, height: 0 }, { zoom });
    root.style.top = `${localDock.top}px`;
    root.style.left = `${localDock.left}px`;
    root.style.right = 'auto';
    const height = drag?.active ? drag.height : snapHeights()[state.size];
    const localPanel = anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width: 0, height }, { zoom });
    panel.style.height = `${localPanel.height}px`;
    root.dataset.logSize = state.size;
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
  function update(model) {
    const toggle = childModel(model, UI.reactionToggle).properties;
    const log = childModel(model, UI.combatLogDrawer).properties;
    reaction.disabled = toggle.disabled;
    reaction.setAttribute('aria-checked', String(toggle.enabled));
    const stateLabel = t(toggle.enabled ? 'combat.reactions.enabled' : 'combat.reactions.disabled');
    reaction.setAttribute('aria-label', t('combat.reactions.state', { state: stateLabel }));
    reaction.dataset.enabled = String(toggle.enabled);
    value.textContent = stateLabel;
    panel.hidden = !log.open; logButton.setAttribute('aria-expanded', String(log.open));
    logButton.setAttribute('aria-description', `${log.size}. Tap to open or close; drag up or down to resize. Arrow keys change size.`);
    latestEntries = log.entries;
    const key = JSON.stringify(log.entries);
    if (key !== entryKey) {
      entryKey = key; renderCombatLogEntries(list, log.entries); fullLogModal?.setEntries(log.entries);
      list.scrollTop = state.followLatest !== false ? list.scrollHeight : state.scrollTop || 0;
    }
    schedule();
  }
  return { update, flushGeometry,
    focusedTool() { return root.contains(document.activeElement) ? document.activeElement.dataset.combatTool || null : null; },
    restoreFocus(token) { if (token) root.querySelector(`[data-combat-tool="${CSS.escape(token)}"]`)?.focus({ preventScroll: true }); },
    release() { released = true; fullLogModal?.close(); observer.disconnect(); formFactorObserver.disconnect(); cancelAnimationFrame(frame); window.visualViewport?.removeEventListener('resize', schedule); removeEventListener('resize', schedule); root.remove(); } };
}
