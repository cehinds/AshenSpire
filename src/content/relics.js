// src/content/relics.js — M1 ships only the Vagabond starter relic (SPEC §5.4
// lands with M2). Relic behavior uses the trigger DSL (SPEC §3.6).

export const relics = [
  {
    id: 'tarnishedMedallion',
    name: 'Tarnished Medallion',
    rarity: 'starter',
    icon: '🏅',
    triggers: [
      {
        // First attack hit each combat also cracks the target's poise.
        on: 'damageDealt',
        once: true,
        if: { p: 'all', preds: [{ p: 'eventIsAttack' }, { p: 'eventSourceIsOwner' }] },
        do: [{ op: 'poiseDamage', amount: 4 }],
      },
    ],
    textTemplate: 'Your first attack each combat also deals {poiseDamage} Poise damage.',
    flavor: 'Its face is worn smooth, but it still remembers being gold.',
  },
];
