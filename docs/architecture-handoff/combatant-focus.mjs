// Documentation presentation defaults; no combat/domain rules live here.
export const combatantFocusConfig = {
  rowIds: ['upper', 'middle', 'lower'],
  rowBase: [0.9, 0.95, 1],
  selectedGrowth: [1.1, 1.05, 1.1],
  rowZPriority: [10, 20, 30],
  focusZ: 100,
  fit: { maximumScale: 1, minimumScale: 0.01, inset: 0, gap: 0 },
  selectionDetailsAffectFit: false,
  sharedBaseAcrossFactions: true,
  stableAnchor: 'sprite-baseline-center'
};
