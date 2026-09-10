import { statusTooltipText, statusInstancePresentation } from '../uiContent.js';
import { helpText } from '../../model/tooltipSettings.js';

/** The live abilities shown by both battlefield badges and the inspector. */
export function activeCombatAbilities(registries, entity, foundation = false) {
  const rows = [];
  if (entity.stanceId) {
    const stance = registries.frameworkTerms.withStanceWords(registries.stances.get(entity.stanceId));
    if (stance) rows.push({ id: stance.id, kind: 'stance', name: stance.name,
      detail: `${statusTooltipText(stance) || helpText('stanceFallback')} ${helpText('stanceDuration')}` });
  }
  if (foundation && entity.evade > 0) rows.push({ id: 'evade', kind: 'evade', name: helpText('evadeTitle', { count: entity.evade }),
    detail: helpText('evade', { count: entity.evade, charges: helpText(entity.evade === 1 ? 'charge' : 'charges') }) });
  for (const [id, instance] of Object.entries(entity.statuses || {})) {
    if (!instance || !((instance.meter?.value ?? instance.stacks) > 0)) continue;
    const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(id));
    if (!def) continue;
    const presentation = statusInstancePresentation(def, instance);
    rows.push({ id, kind: 'status', name: presentation.label, detail: presentation.tooltip || def.name });
  }
  return rows;
}
