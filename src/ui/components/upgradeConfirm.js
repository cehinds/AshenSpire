// The one upgrade confirmation body, shared by the card upgrade (cardUpgradeModal.js) and the item upgrade
// (smithUpgradeModal.js), and so by every upgrade surface (owner, 2026-11-04: "use this modal as the reference
// combining both the weapon and card upgrade modal. I want the cards before and after but the updated stats under
// it"). The modal's frame, header (eyebrow, "Upgrade X?", close), one-line summary and Back / Upgrade footer are the
// confirmation modal's; this is what goes in its body, in this order: the Stone cost, the recovery preview when
// the host has one, the card faces before and after side by side, then the updated stat rows under them.
import { el } from '../kit/index.js';

/**
 * The before and after faces side by side; each is a rendered card node. A card has a fixed size, so on a narrow
 * dialog each is SCALED (never cropped) to fit its half of the row: a holder takes the scaled size and the card, at
 * its natural size, is transformed from the holder's corner. Measured live (and again when the row resizes), so the
 * largest card-size setting fits too. Where nothing can be measured the cards stay at their natural size.
 */
export function upgradeFacesNode({ before, after }) {
  const row = el('div', { class: 'card-upgrade-faces upgrade-confirm-faces' });
  const fits = [];
  for (const [which, node] of [['before', before], ['after', after]]) {
    if (!node) continue;
    const holder = el('div', { class: 'upgrade-confirm-face-holder' }, node);
    row.append(el('div', { class: `card-upgrade-face ${which}`, dataset: { cardUpgradeFace: which } }, holder));
    fits.push({ holder, node });
  }
  const fit = () => {
    const width = row.clientWidth || 0;
    if (!width || !fits.length) return;
    // The row's gap and each face's own side padding come off the half-row each card may take.
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const room = (width - gap * (fits.length - 1)) / fits.length;
    for (const { holder, node } of fits) {
      const face = getComputedStyle(holder.parentNode);
      const pad = (parseFloat(face.paddingLeft) || 0) + (parseFloat(face.paddingRight) || 0);
      const w = node.offsetWidth, h = node.offsetHeight;
      if (!w || !h) continue;
      const k = Math.min(1, (room - pad) / w);
      holder.style.width = `${Math.round(w * k)}px`;
      holder.style.height = `${Math.round(h * k)}px`;
      node.style.setProperty('--face-scale', String(k));
    }
  };
  try {
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(row);
    else if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fit);
  } catch { /* an unmeasurable host keeps natural-size cards */ }
  return row;
}

/** The body's nodes, top to bottom. `rows` are the host's stat rows (already built). Absent parts draw nothing. */
export function upgradeConfirmNodes({ cost = null, cinders = null, recovery = null, faces = null, rows = [] } = {}) {
  return [
    cost,
    cinders,
    recovery,
    faces,
    rows.length ? el('div', { class: 'confirmation-change-list' }, rows) : null,
  ].filter(Boolean);
}
