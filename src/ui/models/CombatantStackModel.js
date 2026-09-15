import { wireframeUi } from '../../content/wireframeUi.js';

// WCF2 ordered active stack (CURRENT-SPECIFICATION, lower components). Rows
// arrive already filtered by activity; this decides their order and what fits.
// HP always; then other resources, buildup in priority order, stance, and the
// status-icon row. At most `maxRows`. Buildup that does not fit joins the icon
// row; any other row that does not fit stays readable in the inspector.
export function planCombatantStack({ resources = [], buildups = [], stance = false, icons = 0 } = {},
  config = wireframeUi.combatantStack) {
  if (!resources.includes('hp')) throw new Error('combatant stack requires an HP row');
  const optional = [
    ...resources.filter((id) => id !== 'hp').map((id) => ({ id, kind: 'resource' })),
    ...buildups.map((id) => ({ id, kind: 'buildup' })),
  ];
  let iconRow = icons > 0;
  const reserved = () => 1 + (stance ? 1 : 0) + (iconRow ? 1 : 0);
  if (!iconRow && buildups.length && optional.length > config.maxRows - reserved()) iconRow = true;
  const kept = optional.slice(0, Math.max(0, config.maxRows - reserved()));
  const excess = optional.slice(kept.length);
  const bars = kept.map((row) => row.id);
  return Object.freeze({
    rows: Object.freeze(['hp', ...bars, ...(stance ? ['stance'] : []), ...(iconRow ? ['icons'] : [])]),
    bars: Object.freeze(bars),
    promoted: Object.freeze(excess.filter((row) => row.kind === 'buildup').map((row) => row.id)),
    hidden: Object.freeze(excess.filter((row) => row.kind === 'resource').map((row) => row.id)),
  });
}

// The icon row itself is the shared icon tray: models/IconTrayModel.js plans
// it, components/iconTray.js draws it.
