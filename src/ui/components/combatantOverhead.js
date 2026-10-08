import { attachTooltip, hideTooltip, esc } from './tooltip.js';
import { intentBadge } from '../uiContent.js';
import { glyph } from '../kit/index.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { selectionRevealDelayMs } from '../models/SelectionEffectModel.js';
import { combatIntentStance } from '../../model/combatIntentVisibility.js';
import { combatProfileTags } from '../../model/combatCardProfile.js';

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
      }, selectionRevealDelayMs()));
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

export function combatantIntent(intent, content, registries = null) {
  if (intent?.hidden && intent.knowledgeRead) {
    const node = document.createElement('button'); node.type = 'button';
    node.className = 'intent overhead-control unknown dashed';
    node.dataset.focusable = 'true'; node.dataset.intentHidden = 'true';
    node.setAttribute('aria-label', `Intent: ${intent.label || '?'}`);
    const label = document.createElement('span'); label.textContent = intent.label || '?'; node.append(label);
    markUiComponent(node, UI.intentIndicator, 'unknown');
    attachTooltip(node, () => `<div class="tt-title">Intent: ${esc(intent.label || '?')}</div>Exact action unread. Wisdom, Intelligence, character level and run Perception improve intent reads.`, { selectionFirst: true, intent: 'above', align: 'center' });
    return node;
  }
  const stance = combatIntentStance(intent);
  const stanceLabel = stance.charAt(0).toUpperCase() + stance.slice(1);
  const badge = intent?.hidden ? {
    cls: stance === 'defending' ? 'block' : 'unknown', label: '?', dashed: true,
  } : intentBadge(intent);
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `intent overhead-control ${badge.cls}${badge.dashed ? ' dashed' : ''}`;
  node.dataset.focusable = 'true';
  if (badge.tone) node.dataset.tone = badge.tone;
  node.dataset.stance = stance;
  node.dataset.intentHidden = String(!!intent?.hidden);
  node.setAttribute('aria-label', `Stance: ${stanceLabel}. ${intent?.hidden ? 'Exact move hidden.' : `Intent: ${intent?.kind || 'unknown'} ${badge.label}`}`);
  if (intent?.stance || intent?.profile || intent?.hidden) {
    const stanceNode = document.createElement('span');
    stanceNode.className = 'intent-stance';
    stanceNode.textContent = stanceLabel;
    node.append(stanceNode);
  }
  if (badge.glyph) node.append(glyph(badge.glyph, { class: 'ic' }));
  const label = document.createElement('span');
  label.textContent = badge.label; node.append(label);
  markUiComponent(node, UI.intentIndicator, badge.cls);
  const tooltip = () => {
    if (intent?.hidden) return `<div class="tt-title">Stance: ${esc(stanceLabel)}</div>Exact move, damage, and effects unread. Wisdom and Intelligence improve intent reads.`;
    const body = typeof content === 'function' ? content() : content;
    const tags = intent?.profile ? combatProfileTags(intent.profile, registries) : [];
    return `${body || ''}${tags.length ? `<div class="combat-rule-hint">${tags.map(tag => `${esc(tag.label)}: ${esc(tag.blurb)}`).join('<br>')}</div>` : ''}`;
  };
  attachTooltip(node, tooltip, { selectionFirst: true, intent: 'above', align: 'center' });
  return node;
}
