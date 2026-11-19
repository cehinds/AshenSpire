// The one reader that prices a damage-channel row (ar / dr / pr) at a given set of attributes, for a fight entity. Live stats
// (engine/liveStats.js) and the stance attribute grants (model/stanceRules.js) both read it, so neither restates the row formula.
import { statRow } from './statRows.js';
import { statRowValue } from './derivedStats.js';
import { PrAttributeView } from './fixCoreMechanics.js';

/** ChannelRowValue(ctx, entity, id, attributes) -> the stat row `id` priced at `attributes` (PR reads the highest of its attributes). */
export function ChannelRowValue(ctx, entity, id, attributes) {
  const run = { derivedStatRuleSnapshot: entity.kind === 'enemy' ? null : ctx.derivedStatRuleSnapshot, class: entity.kind === 'enemy' ? null : entity.classId };
  const row = statRow(ctx.registries, run, id);
  if (!row) return 0;
  const read = id === 'pr' ? PrAttributeView(ctx, attributes) : attributes;
  return statRowValue(row, { attributes: read, level: 1, statId: id, lenientAttributes: true }).value;
}
