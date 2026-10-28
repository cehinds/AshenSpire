// A card definition with its authored upgrade merged over the base. A leaf
// module: gameProfile.js and registries.js both use it, and importing
// registries.js from gameProfile.js would reorder the bundle's load cycle.
export function upgradedDefinition(base) {
  const up = base.upgrade || {};
  return {
    ...base,
    ...up,
    name: up.name != null ? up.name : `${base.name}+`,
    keywords: up.keywords != null ? up.keywords : base.keywords || [],
    effects: up.effects != null ? up.effects : base.effects,
    textTemplate: up.textTemplate != null ? up.textTemplate : base.textTemplate,
    upgraded: true,
  };
}
