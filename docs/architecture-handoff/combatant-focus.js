/* Pure presentation helpers. Sizes use one consistent host coordinate unit. */
function rowPresentationScale(row, selected, config) {
  const index = typeof row === 'number' ? row : config.rowIds.indexOf(row);
  if (!Number.isInteger(index) || index < 0 || index >= config.rowBase.length) throw new RangeError('Unknown combat row');
  const base = config.rowBase[index];
  const growth = config.selectedGrowth[index];
  if (![base, growth].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid row scaling configuration');
  const normalZ = config.rowZPriority[index];
  if (!Number.isFinite(normalZ) || !Number.isFinite(config.focusZ) || config.focusZ <= Math.max(...config.rowZPriority)) throw new RangeError('Focus priority must be higher than all row priorities');
  return { factor: base * (selected ? growth : 1), zPriority: selected ? config.focusZ : normalZ };
}
function sharedCombatantBaseScale(groups, config) {
  const fit = config.fit;
  if (!groups.length) return fit.maximumScale;
  if (![fit.maximumScale, fit.minimumScale].every(value => Number.isFinite(value) && value > 0) || fit.minimumScale > fit.maximumScale) throw new RangeError('Invalid scale bounds');
  if (![fit.inset, fit.gap].every(value => Number.isFinite(value) && value >= 0)) throw new RangeError('Invalid fit spacing');
  let scale = fit.maximumScale;
  for (const group of groups) {
    if (!group.actors.length) continue;
    // Both faction groups of the same size category must be passed together.
    // Geometry is the cached UNSELECTED sprite/frame envelope, not live bounds.
    let rowWidth = 0, rowHeight = 0;
    for (const actor of group.actors) {
      if (![actor.baseWidth, actor.baseHeight].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('Invalid unselected actor envelope');
      const rowFactor = rowPresentationScale(actor.row, false, config).factor;
      rowWidth += actor.baseWidth * rowFactor;
      rowHeight = Math.max(rowHeight, actor.baseHeight * rowFactor);
    }
    if (![group.availableWidth, group.availableHeight].every(value => Number.isFinite(value) && value >= 0)) throw new RangeError('Invalid group allocation');
    const usableWidth = Math.max(0, group.availableWidth - fit.inset - fit.inset - fit.gap * Math.max(0, group.actors.length - 1));
    const usableHeight = Math.max(0, group.availableHeight - fit.inset - fit.inset);
    scale = Math.min(scale, usableWidth / rowWidth, usableHeight / rowHeight);
  }
  return Math.max(fit.minimumScale, scale);
}
