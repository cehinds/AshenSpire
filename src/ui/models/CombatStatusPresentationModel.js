import { fixCoreStatusDefinition } from '../../model/fixCoreMechanics.js';

// A combat-local read view. The engine and other screens retain their original
// registry; both card inspection and PIPs read the active rules' descriptions.
export function combatStatusPresentationRegistries(registries, combat) {
  const original = registries.statuses;
  const project = definition => definition ? fixCoreStatusDefinition(combat, definition.id, definition) : definition;
  return { ...registries, statuses: { ...original,
    get: id => project(original.get(id)),
    all: () => original.all().map(project),
  } };
}
