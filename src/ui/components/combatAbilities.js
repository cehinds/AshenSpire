import { statusTooltipText, statusInstancePresentation } from '../uiContent.js';

/** The live abilities shown by both battlefield badges and the inspector. */
export function activeCombatAbilities(registries, entity, foundation = false) {
  const rows = [];
  if (entity.stanceId) {
    const stance = registries.frameworkTerms.withStanceWords(registries.stances.get(entity.stanceId));
    if (stance) rows.push({ id: stance.id, kind: 'stance', name: stance.name,
      detail: `${statusTooltipText(stance) || 'Current stance.'} Persists until replaced or combat ends.` });
  }
  if (foundation && entity.evade > 0) rows.push({ id: 'evade', kind: 'evade', name: `Evade ${entity.evade}`,
    detail: `${entity.evade} charge${entity.evade === 1 ? '' : 's'} remaining. Avoids the next dodgeable attack hit, including its damage, impact, and on-hit buildup. Each avoided hit consumes one charge. Unused charges expire at the start of your next turn.` });
  for (const [id, instance] of Object.entries(entity.statuses || {})) {
    if (!instance || !((instance.meter?.value ?? instance.stacks) > 0)) continue;
    const def = registries.frameworkTerms.withStatusWords(registries.statuses.get(id));
    if (!def) continue;
    const presentation = statusInstancePresentation(def, instance);
    rows.push({ id, kind: 'status', name: presentation.label, detail: presentation.tooltip || def.name });
  }
  return rows;
}
