import { statRow } from './statRows.js';
import { statRowValue } from './derivedStats.js';
import { PrAttributeView } from './fixCoreMechanics.js';
import { SpellRowValue, SpellTraditionsActive } from './spellTraditions.js';

export function ChannelRowValue(ctx, entity, id, attributes, carrier = null) {
  if (id === 'pr' && carrier && SpellTraditionsActive(ctx)) return SpellRowValue(ctx, entity, attributes, carrier);
  const enemy = entity?.kind === 'enemy';
  const run = { derivedStatRuleSnapshot: enemy ? null : ctx.derivedStatRuleSnapshot, class: enemy ? null : entity?.classId };
  const row = statRow(ctx.registries, run, id);
  if (!row) return 0;
  return statRowValue(row, {
    attributes: id === 'pr' ? PrAttributeView(ctx, attributes) : attributes,
    level: 1, statId: id, lenientAttributes: true,
  }).value;
}
