import { uiConfig } from '../../config/generated/ui.js';

/** Presentation groups do not alter the framework's resource costs or payment. */
export const deckEditorResourceGroups = () => uiConfig.presentation.deckEditorCosts.components.resourceGroups;

export function deckEditorCosts(profile, groups = deckEditorResourceGroups()) {
  return groups.map(({ id, label, resources, art }) => {
    // Action is a legacy alias of the same turn Stamina pool, never an
    // additional cost. Older authored groups may contain both spellings.
    const canonical = [...new Set(resources.map(resource => resource === 'action' ? 'stamina' : resource))];
    const variable = profile.variable && canonical.includes('stamina');
    const fixed = canonical.reduce((total, resource) => {
      const value = resource === 'stamina' ? profile.stamina ?? profile.action : profile[resource];
      return total + (variable && resource === 'stamina' ? 0 : Number(value || 0));
    }, 0);
    return { id, label, resources: canonical, ...(art ? { art } : {}), value: variable ? `X${fixed ? `+${fixed}` : ''}` : fixed };
  });
}
