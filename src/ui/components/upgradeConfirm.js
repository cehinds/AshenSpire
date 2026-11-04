// The one upgrade confirmation body, shared by the card upgrade (cardUpgradeModal.js) and the item upgrade
// (smithUpgradeModal.js), and so by every upgrade surface (owner, 2026-11-04: "use this modal as the reference
// combining both the weapon and card upgrade modal. I want the cards before and after but the updated stats under
// it"). The modal's frame, header (eyebrow, "Upgrade X?", close), one-line summary and Back / Upgrade footer are the
// confirmation modal's; this is what goes in its body, in this order: the Stone cost, the recovery preview when
// the host has one, the card faces before and after side by side, then the updated stat rows under them.
import { el } from '../kit/index.js';

/** The before and after faces side by side; each is a rendered card node. They share the row and shrink to fit a phone. */
export function upgradeFacesNode({ before, after }) {
  return el('div', { class: 'card-upgrade-faces upgrade-confirm-faces' }, [['before', before], ['after', after]]
    .filter(([, node]) => node)
    .map(([which, node]) => el('div', { class: `card-upgrade-face ${which}`, dataset: { cardUpgradeFace: which } }, node)));
}

/** The body's nodes, top to bottom. `rows` are the host's stat rows (already built). Absent parts draw nothing. */
export function upgradeConfirmNodes({ cost = null, recovery = null, faces = null, rows = [] } = {}) {
  return [
    cost,
    recovery,
    faces,
    rows.length ? el('div', { class: 'confirmation-change-list' }, rows) : null,
  ].filter(Boolean);
}
