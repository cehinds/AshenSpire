import { attachTooltip, hideTooltip, esc } from './tooltip.js';
import { combatIntentPresentation } from '../models/CombatIntentModel.js';
import { intentIcon } from './intentIcon.js';
import { UI_COMPONENTS as UI, markUiComponent } from './uiComponents.js';
import { selectionRevealDelayMs } from '../models/SelectionEffectModel.js';
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

export function combatantIntent(intent, content, registries = null, { onTarget = null } = {}) {
  const badge = combatIntentPresentation(intent);
  const stanceLabel = badge.title;
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `intent overhead-control${badge.visibility !== 'known' ? ' dashed' : ''}`;
  node.dataset.focusable = 'true';
  node.dataset.intentVisibility = badge.visibility;
  node.dataset.stance = badge.stance;
  node.dataset.intentHidden = String(!!intent?.hidden);
  const compact = document.createElement('span');
  compact.className = 'intent-compact';
  if (badge.parts[0]) compact.append(intentIcon(badge.parts[0].icon));
  if (badge.visibility !== 'known') compact.append(document.createTextNode(' ?'));
  node.append(compact);
  node.setAttribute('aria-label', `${stanceLabel}. ${intent?.hidden ? 'Exact move and amounts hidden.' : badge.parts.map(part => `${part.icon}: ${part.value ?? ''}`).join('. ')}`);
  {
    const stanceNode = document.createElement('span');
    stanceNode.className = 'intent-stance';
    stanceNode.textContent = stanceLabel;
    node.append(stanceNode);
  }
  if (badge.parts.length) {
    const values = document.createElement('span');
    values.className = 'intent-values';
    for (const part of badge.parts) {
      const group = document.createElement('span'); group.className = 'intent-value';
      group.append(intentIcon(part.icon));
      if (part.value != null) {
        const value = document.createElement('span'); value.textContent = part.value; group.append(value);
      }
      values.append(group);
    }
    node.append(values);
  }
  markUiComponent(node, UI.intentIndicator, badge.visibility);
  const tooltip = () => {
    if (intent?.hidden) return `<div class="tt-title">Stance: ${esc(stanceLabel)}</div>Exact move, damage, and effects unread. Wisdom and Intelligence improve intent reads.`;
    const body = typeof content === 'function' ? content() : content;
    const tags = intent?.profile ? combatProfileTags(intent.profile, registries) : [];
    const counter = badge.stance === 'countering' && intent.counterDamage != null
      ? `<div>Base counter damage: ${esc(intent.counterDamage)} HP${intent.counterPoiseDamage > 0 ? `, ${esc(intent.counterPoiseDamage)} Poise` : ''}. The triggering attack and defenses determine the resolved damage.</div>` : '';
    return `${body || ''}${counter}${tags.length ? `<div class="combat-rule-hint">${tags.map(tag => `${esc(tag.label)}: ${esc(tag.blurb)}`).join('<br>')}</div>` : ''}`;
  };
  attachTooltip(node, tooltip, { selectionFirst: true, intent: 'above', align: 'center' });
  // A visible intent is also the owning enemy's target control. Resolve that
  // action before the tooltip's selecting tap can consume it on touch.
  if (onTarget) node.addEventListener('click', event => {
    if (onTarget() === false) return;
    event.preventDefault(); event.stopImmediatePropagation(); hideTooltip();
  }, true);
  return node;
}

// Selected card previews use authored action identity, never card-name guesses.
export function playerActionIntent(profile, onTarget) {
  if (!profile?.maneuver) return null;
  const icon = ({ defend: 'defend', counter: 'counter', smash: 'smash', attack: 'attack', sweep: 'attack', ranged: 'attack', casting: 'cast' })[profile.maneuver]
    || (profile.camp === 'spell' ? 'cast' : null);
  if (!icon) return null;
  const node = document.createElement('button');
  node.type = 'button'; node.className = 'player-action-intent overhead-control';
  node.setAttribute('aria-label', `Selected action: ${profile.maneuver}`);
  node.append(intentIcon(icon));
  node.addEventListener('click', event => { event.stopPropagation(); onTarget(); });
  return node;
}
