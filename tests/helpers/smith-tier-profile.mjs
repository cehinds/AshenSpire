import { resolveGameProfile } from '../../src/model/gameProfile.js';

// Model the positive Smith ladder explicitly. Today's Core defaults leave
// per-rank attributes at zero and charge ratings for found attributes.
export function ResolveSmithFixtureProfile(author) {
  return resolveGameProfile({
    ...author,
    modules: {
      ...author.modules,
      gear: {
        ...author.modules?.gear,
        statPoints: {
          attributes: { common: 1, uncommon: 2, rare: 2, epic: 3 },
          perRank: 1,
          attributeBudgetCost: 0,
          ...author.modules?.gear?.statPoints,
        },
      },
    },
  });
}
