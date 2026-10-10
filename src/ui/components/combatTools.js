import { button, el } from '../kit/index.js';
import { childModel } from '../models/ComponentModel.js';
import { combatLogHeight, combatLogSnapSize, combatLogDragScale, COMBAT_LOG_SIZES } from '../models/CombatToolsModel.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { t, tFull } from '../strings.js';
import { trackGesture } from '../gesture.js';

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
  const list = el('div', { class: 'combat-log-entries', 'data-combat-tool': 'entries', tabindex: '0', role: 'region', 'aria-label': t('combat.log.actions') });
  list.addEventListener('scroll', () => { state.scrollTop = list.scrollTop; state.followLatest = list.scrollTop + list.clientHeight >= list.scrollHeight - 4; });
  panel.append(title, list); root.append(panel, logButton, reaction); combatEl.append(root);
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
  reaction.addEventListener('click', () => onToggle(reaction.getAttribute('aria-checked') !== 'true'));
  let frame = 0, entryKey = '';
  function measure() {
    frame = 0;
    if (!root.isConnected) return;
    const zoom = combatEl.getBoundingClientRect().width / combatEl.clientWidth || 1;
    const hand = combatEl.querySelector('.hand');
    const handBox = hand?.getBoundingClientRect();
    const width = Math.min(220, (handBox?.width || innerWidth) - 12);
    const localWidth = anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width, height: 0 }, { zoom });
    root.style.width = `${localWidth.width}px`;
    // A compact toolbar occupies the top of the card band. It never consumes
    // hand width: doing that collapsed every card onto one slot on phones.
    combatEl.style.setProperty('--combat-tools-reserve', '0px');
    const localDock = anchorLocalBox(combatEl, { left: (handBox?.right || innerWidth) - width - 6,
      top: handBox?.top || 0, width: 0, height: 0 }, { zoom });
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
    const key = JSON.stringify(log.entries);
    if (key !== entryKey) {
      entryKey = key; list.replaceChildren();
      let round, items;
      for (const entry of log.entries) {
        if (entry.round !== round) { round = entry.round; items = el('ol', {}); list.append(el('h3', { text: t('combat.log.round', { round }) }), items); }
        items.append(el('li', { text: entry.text }));
      }
      if (!log.entries.length) list.append(el('p', { text: tFull('combat.log.empty') }));
      list.scrollTop = state.followLatest !== false ? list.scrollHeight : state.scrollTop || 0;
    }
    schedule();
  }
  return { update, flushGeometry,
    focusedTool() { return root.contains(document.activeElement) ? document.activeElement.dataset.combatTool || null : null; },
    restoreFocus(token) { if (token) root.querySelector(`[data-combat-tool="${CSS.escape(token)}"]`)?.focus({ preventScroll: true }); },
    release() { released = true; observer.disconnect(); cancelAnimationFrame(frame); window.visualViewport?.removeEventListener('resize', schedule); removeEventListener('resize', schedule); root.remove(); } };
}
