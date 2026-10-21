import { fixCoreStatusDefinition } from '../../model/fixCoreMechanics.js';

// A combat-local read view. The engine and other screens retain their original
// registry; both card inspection and PIPs read the active rules' descriptions.
export function combatStatusPresentationRegistries(registries, combat) {
  const original = registries.statuses;
  const holders = new WeakMap();
  const project = (definition, holder = null) => {
    if (!definition) return definition;
    const projected = fixCoreStatusDefinition(combat, definition.id, definition, holder);
    holders.set(projected, holder);
    return projected;
  };
  return { ...registries, statuses: { ...original,
    get: (id, holder = null) => project(original.get(id), holder),
    all: () => original.all().map(definition => project(definition)),
  }, ...(registries.frameworkTerms ? { frameworkTerms: { ...registries.frameworkTerms,
    withStatusWords: definition => {
      const named = registries.frameworkTerms.withStatusWords(definition);
      // The terminology overlay owns names, but its authored legacy Evade
      // tooltip must not replace the active Core rule in either inspector.
      return definition?.id === 'evade' ? project(named, holders.get(definition) ?? null) : named;
    },
  } } : {}) };
}
