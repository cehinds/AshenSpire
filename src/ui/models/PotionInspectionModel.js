// W1q potion inspection. The same inspection body as an item (art beside
// facts), with the potion's remaining charges, whether it can be used here —
// and why not, when it cannot — and Use as the one footer action when the
// host's flask plan offers it. The header close is the only way out; there is
// no footer Close beside it.

export function potionInspectionView({ charges = null, use = null } = {}) {
  const chargeLine = Number.isInteger(charges) && charges >= 0
    ? `${charges} charge${charges === 1 ? '' : 's'} remaining.`
    : null;
  const action = use
    ? Object.freeze({ id: 'use', label: String(use.label || 'Use'), enabled: !!use.enabled, reason: use.enabled ? '' : String(use.reason || '') })
    : null;
  return Object.freeze({
    chargeLine,
    // Eligibility is stated only when it refuses: an enabled Use says itself.
    eligibility: action && !action.enabled && action.reason ? action.reason : null,
    action,
  });
}
