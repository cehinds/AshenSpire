// One relationship model and one silhouette renderer for every friendly card
// target. The model is deliberately DOM-free until the rendering helpers so
// the authoritative co-op engine can enforce the exact set the clients show.

export const TARGET_COLORS = Object.freeze({
  enemy: '#e0463c',
  self: '#4d94e0',
  ally: '#49b675',
});

// Every hostile member of the effect target vocabulary owns card resolution
// before source-side self effects are considered. An AoE/random strike may
// heal, block, exhaust, or otherwise affect its source without becoming a
// friendly-target transaction.
const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy']);

export function friendlyTargetMode(def) {
  const effects = def && Array.isArray(def.effects) ? def.effects : [];
  const hasEnemy = effects.some((effect) => HOSTILE_TARGETS.has(effect.target));
  const hasAlly = effects.some((effect) => effect.target === 'ally');
  const hasSelf = effects.some((effect) => effect.target === 'self');
  // Enemy cards continue through enemy aiming even when they also have a
  // source-side self effect. Friendly aiming owns ally cards and pure self
  // cards only.
  if (hasEnemy || (!hasAlly && !hasSelf)) return 'none';
  if (hasAlly && hasSelf) return 'mixed';
  return hasAlly ? 'ally' : 'self';
}

export function friendlyTargetPlan(def, actorId, players = []) {
  const mode = friendlyTargetMode(def);
  if (mode === 'none') return { mode, active: false, targets: [], legalIds: [] };
  const targets = [];
  for (const player of players) {
    if (!player || !player.alive || !player.connected) continue;
    const relationship = player.id === actorId ? 'self' : 'ally';
    if (mode === 'self' && relationship !== 'self') continue;
    if (mode === 'ally' && relationship !== 'ally') continue;
    targets.push({ id: player.id, relationship });
  }
  return { mode, active: true, targets, legalIds: targets.map((target) => target.id) };
}

export function assertFriendlyTarget(plan, requestedId, actorId) {
  if (!plan || !plan.active) return requestedId;
  // A self-only card historically omitted targetId. Preserve that network
  // compatibility while the new clients always send their explicit choice.
  const targetId = requestedId == null && plan.mode === 'self' ? actorId : requestedId;
  if (!plan.legalIds.includes(targetId)) {
    throw new Error(`Invalid ${plan.mode} target '${targetId == null ? 'none' : targetId}'`);
  }
  return targetId;
}

function tintedClone(spriteWrap, color) {
  const src = spriteWrap && spriteWrap.firstElementChild;
  if (!src) return null;
  const clone = src.cloneNode(true);
  const svg = clone.matches && clone.matches('svg') ? clone : clone.querySelector && clone.querySelector('svg');
  if (svg) {
    svg.querySelectorAll('*').forEach((node) => {
      const fill = node.getAttribute && node.getAttribute('fill');
      const stroke = node.getAttribute && node.getAttribute('stroke');
      if (fill && fill !== 'none') node.setAttribute('fill', color);
      if (stroke && stroke !== 'none') node.setAttribute('stroke', color);
    });
  } else if (clone.style) {
    clone.style.background = color;
    clone.style.borderColor = color;
    clone.style.color = 'transparent';
    clone.style.boxShadow = 'none';
    // Rendered class art is an <img> inside a wrapper. Recolor the wrapper's
    // full composited pixels so this remains a silhouette rather than a tinted
    // rectangle hidden behind the opaque original.
    const filter = color === TARGET_COLORS.self
      ? 'brightness(0) saturate(100%) invert(55%) sepia(44%) saturate(1273%) hue-rotate(177deg) brightness(91%) contrast(89%)'
      : color === TARGET_COLORS.ally
        ? 'brightness(0) saturate(100%) invert(62%) sepia(44%) saturate(721%) hue-rotate(95deg) brightness(91%) contrast(86%)'
        : 'brightness(0) saturate(100%) invert(35%) sepia(77%) saturate(1314%) hue-rotate(330deg) brightness(94%) contrast(89%)';
    clone.style.filter = filter;
  }
  return clone;
}

export function clearTargetSilhouettes(root) {
  if (!root) return;
  root.querySelectorAll('.aim-silho').forEach((node) => node.remove());
  root.querySelectorAll('.combatant.aiming').forEach((node) => {
    node.classList.remove('aiming', 'aim-enemy', 'aim-self', 'aim-ally');
  });
}

export function renderTargetSilhouette(combatantEl, relationship) {
  const color = TARGET_COLORS[relationship];
  const spriteWrap = combatantEl && combatantEl.querySelector('.sprite');
  if (!color || !spriteWrap) return false;
  const clone = tintedClone(spriteWrap, color);
  if (!clone) return false;
  const holder = document.createElement('div');
  holder.className = 'aim-silho';
  holder.dataset.targetRelationship = relationship;
  holder.style.setProperty('--target-color', color);
  holder.appendChild(clone);
  spriteWrap.insertBefore(holder, spriteWrap.firstChild);
  combatantEl.classList.add('aiming', `aim-${relationship}`);
  return true;
}

export function decorateFriendlyTarget(combatantEl, { relationship, label }) {
  combatantEl.dataset.friendlyTarget = relationship;
  combatantEl.dataset.focusable = '';
  combatantEl.tabIndex = -1;
  combatantEl.setAttribute('role', 'button');
  combatantEl.setAttribute('aria-label', `Target ${label} (${relationship})`);
  renderTargetSilhouette(combatantEl, relationship);
}
