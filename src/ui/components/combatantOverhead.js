import { attachTooltip, hideTooltip, esc } from './tooltip.js';
import { intentBadge } from '../uiContent.js';
import { glyph } from '../kit/index.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { wireframeUi } from '../../content/wireframeUi.js';

const inspectTimers = new WeakMap();

// Reading selection is separate from an armed card or co-op's attack target.
export function selectCombatantInfo(root, id) {
  hideTooltip();
  for (const frame of root.querySelectorAll('.combatant')) {
    const selected = frame.dataset.eid === id;
    const changed = frame.classList.contains('context-selected') !== selected;
    frame.classList.toggle('context-selected', selected);
    frame.setAttribute('aria-pressed', String(selected));
    if (changed || !selected) {
      clearTimeout(inspectTimers.get(frame));
      delete frame.dataset.inspectReady;
      if (selected) inspectTimers.set(frame, setTimeout(() => {
        if (frame.isConnected && frame.classList.contains('context-selected')) frame.dataset.inspectReady = 'true';
      }, wireframeUi.card.inspectDelayMs));
    }
  }
  root.dispatchEvent(new CustomEvent('combatantselectionchange'));
}

export function combatantInfo(name, open) {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'combatant-info overhead-control';
  node.textContent = 'i';
  node.dataset.focusable = 'true';
  node.setAttribute('aria-label', `Inspect ${name}`);
  node.setAttribute('aria-haspopup', 'dialog');
  attachTooltip(node, () => `<div class="tt-title">${esc(name)}</div>Inspect resources, skills, and active effects.`, {
    selectionFirst: true, activate: open, intent: 'above', align: 'center',
  });
  return node;
}

export function combatantIntent(intent, content) {
  const badge = intentBadge(intent);
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `intent overhead-control ${badge.cls}${badge.dashed ? ' dashed' : ''}`;
  node.dataset.focusable = 'true';
  if (badge.tone) node.dataset.tone = badge.tone;
  node.setAttribute('aria-label', `Intent: ${intent?.kind || "unknown"} ${badge.label}`);
  if (badge.glyph) node.append(glyph(badge.glyph, { class: 'ic' }));
  const label = document.createElement('span');
  label.textContent = badge.label; node.append(label);
  markUiComponent(node, UI.intentIndicator, badge.cls);
  attachTooltip(node, content, { selectionFirst: true, intent: 'above', align: 'center' });
  return node;
}
