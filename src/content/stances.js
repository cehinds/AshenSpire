// src/content/stances.js — Reaver stances as data (SPEC §4.5)
//
// At most one stance is active; the enterStance opcode handles exclusivity.
// Stances are combat-scoped.

export const stances = [
  {
    id: 'gorefire',
    name: 'Gorefire Stance',
    icon: '🔥',
    onEnter: [{ op: 'loseHp', target: 'self', amount: 2 }],
    hooks: [
      {
        // Every attack HIT the player lands applies 2 Bleed (per hit, so
        // multi-hit cards like Twinblade Flurry apply it per hit).
        on: 'damageDealt',
        if: { p: 'all', preds: [{ p: 'eventSourceIsOwner' }, { p: 'eventIsAttack' }] },
        do: [{ op: 'applyStatus', status: 'bleed', stacks: 2 }],
      },
    ],
    tooltip: 'Your attacks apply 2 Bleed per hit. On entering: take 2 damage (ignores Block).',
  },
  {
    id: 'bulwark',
    name: 'Bulwark Stance',
    icon: '🛡',
    onEnter: [{ op: 'block', target: 'self', amount: 3 }],
    hooks: [
      {
        on: 'cardPlayed',
        if: { p: 'cardTypeIs', type: 'skill' },
        do: [{ op: 'block', target: 'owner', amount: 2 }],
      },
    ],
    tooltip: 'Whenever you play a Skill, gain 2 Block. On entering: gain 3 Block.',
  },
];
