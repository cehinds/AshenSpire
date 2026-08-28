// Relationship-aware silhouette rendering for friendly card targets. The
// headless target rules live below UI in model/friendlyTargets.js so the
// authoritative engine never depends on DOM-facing modules.

export const TARGET_COLORS = Object.freeze({
  enemy: '#e0463c',
  self: '#4d94e0',
  ally: '#49b675',
});

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
