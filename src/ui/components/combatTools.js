import { button, el } from '../kit/index.js';
import { childModel } from '../models/ComponentModel.js';
import { combatLogHeight, COMBAT_LOG_SIZES } from '../models/CombatToolsModel.js';
import { markUiComponent, UI_COMPONENTS as UI } from './uiComponents.js';
import { anchorLocalBox, VIEWPORT_ORIGIN } from '../fx.js';
import { t, tFull } from '../strings.js';

export function mountCombatTools(combatEl, { state, onToggle, onViewChange }) {
  const root = markUiComponent(el('aside', { class: 'combat-tools', 'data-combat-read-only': '' }), UI.combatTools);
  const logButton = button({ label: t('combat.log.title'), attrs: { 'data-combat-tool': 'log', 'aria-expanded': 'false', 'aria-controls': 'combat-log' } });
  const reaction = markUiComponent(button({ label: '', attrs: { 'data-combat-tool': 'reaction', role: 'switch', 'aria-checked': 'true' } }), UI.reactionToggle);
  reaction.classList.add('reaction-switch');
  const label = el('span', { text: t('combat.reactions.label') });
  const track = el('span', { class: 'reaction-switch-track' });
  const value = el('span', { class: 'reaction-switch-value' });
  const thumb = el('span', { class: 'reaction-switch-thumb', 'aria-hidden': 'true' });
  track.append(value, thumb); reaction.replaceChildren(label, track);
  const panel = markUiComponent(el('section', { id: 'combat-log', class: 'combat-log-panel', 'aria-label': t('combat.log.title'), hidden: true }), UI.combatLogDrawer);
  const title = el('div', { class: 'combat-log-heading', text: t('combat.log.title') });
  const sizes = el('div', { class: 'combat-log-sizes', role: 'group', 'aria-label': t('combat.log.sizeLabel') });
  for (const size of COMBAT_LOG_SIZES) {
    const pick = button({ label: t(`combat.log.size.${size.toLowerCase()}`), attrs: { 'data-combat-tool': size, 'data-log-size': size, 'aria-pressed': 'false' } });
    pick.addEventListener('click', () => { state.size = size; onViewChange(); root.querySelector(`[data-log-size="${size}"]`)?.focus(); });
    sizes.append(pick);
  }
  const list = el('div', { class: 'combat-log-entries', 'data-combat-tool': 'entries', tabindex: '0', role: 'region', 'aria-label': t('combat.log.actions') });
  list.addEventListener('scroll', () => { state.scrollTop = list.scrollTop; state.followLatest = list.scrollTop + list.clientHeight >= list.scrollHeight - 4; });
  panel.append(title, sizes, list); root.append(panel, logButton, reaction); combatEl.append(root);
  logButton.addEventListener('click', () => { state.open = !state.open; onViewChange(); });
  reaction.addEventListener('click', () => onToggle(reaction.getAttribute('aria-checked') !== 'true'));
  let frame = 0, entryKey = '';
  function measure() {
    frame = 0;
    if (!root.isConnected) return;
    const zoom = combatEl.getBoundingClientRect().width / combatEl.clientWidth || 1;
    const style = getComputedStyle(root);
    const gap = parseFloat(style.getPropertyValue('--combat-tools-gap')) || 8;
    const compact = innerHeight <= 480 && innerWidth >= 600;
    const width = compact ? 120 : parseFloat(style.getPropertyValue('--combat-tools-physical-width')) || 136;
    const localWidth = anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width, height: 0 }, { zoom });
    root.style.width = `${localWidth.width}px`;
    // Short landscape already gives the hand left/right footer rails. Put the
    // tools in the left rail instead of subtracting its width a second time.
    const reserve = anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width: compact ? 0 : width + gap + 4, height: 0 }, { zoom });
    combatEl.style.setProperty('--combat-tools-reserve', `${reserve.width}px`);
    const footerHost = combatEl.querySelector('.combat-action-row');
    const footer = footerHost?.getBoundingClientRect();
    // Landscape side rails span the whole hand. Dock above their actual
    // buttons, not the transparent container that reaches into the battlefield.
    const footerButtons = [...(footerHost?.querySelectorAll('button, [role="button"]') || [])]
      .map(button=>button.getBoundingClientRect()).filter(rect=>rect.width && rect.height
        && (!compact || rect.left < innerWidth / 2));
    const bottom = (footerButtons.length ? Math.min(...footerButtons.map(rect=>rect.top)) : footer?.top ?? innerHeight) - gap;
    const localDock = anchorLocalBox(combatEl, { left: 0, top: bottom - root.getBoundingClientRect().height, width: 0, height: 0 }, { zoom });
    root.style.top = `${localDock.top}px`;
    const menu = [...combatEl.querySelectorAll('.topbar button')].reduce((max, node) => Math.max(max, node.getBoundingClientRect().bottom), 0);
    const card = combatEl.querySelector('.hand .card')?.getBoundingClientRect().height || 250;
    const height = combatLogHeight({ size: state.size, cardHeight: card,
      viewportHeight: window.visualViewport?.height || innerHeight, dockTop: root.getBoundingClientRect().top - 6, menuBottom: menu, gap });
    const localPanel = anchorLocalBox(VIEWPORT_ORIGIN, { left: 0, top: 0, width: 0, height }, { zoom });
    panel.style.height = `${localPanel.height}px`;
    root.dataset.logSize = state.size;
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
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
    sizes.querySelectorAll('[data-log-size]').forEach(pick => pick.setAttribute('aria-pressed', String(pick.dataset.logSize === log.size)));
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
  return { update,
    focusedTool() { return root.contains(document.activeElement) ? document.activeElement.dataset.combatTool || null : null; },
    restoreFocus(token) { if (token) root.querySelector(`[data-combat-tool="${CSS.escape(token)}"]`)?.focus({ preventScroll: true }); },
    release() { observer.disconnect(); cancelAnimationFrame(frame); window.visualViewport?.removeEventListener('resize', schedule); removeEventListener('resize', schedule); root.remove(); } };
}
