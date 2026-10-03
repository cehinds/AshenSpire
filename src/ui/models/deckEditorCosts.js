import { uiConfig } from '../../config/generated/ui.js';

/** Presentation groups do not alter the framework's resource costs or payment. */
export const deckEditorResourceGroups = () => uiConfig.presentation.deckEditorCosts.components.resourceGroups;

export function deckEditorCosts(profile, groups = deckEditorResourceGroups()) {
  return groups.map(({ id, label, resources, art }) => {
    const variable = profile.variable && resources.includes('action');
    const fixed = resources.reduce((total, resource) =>
      total + (variable && resource === 'action' ? 0 : Number(profile[resource] || 0)), 0);
    return { id, label, resources: [...resources], ...(art ? { art } : {}), value: variable ? `X${fixed ? `+${fixed}` : ''}` : fixed };
  });
}
