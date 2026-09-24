// src/content/weaponArtUnleashed.js — each combat-kit Weapon Art's UNLEASHED
// form (SPEC §12.2.1).
//
// When a weapon's Art charge meter is full (balance.weaponArtCharge), the next
// play of the Art that weapon lends resolves its own effects and then these,
// with the same source, target and card — ordinary effect DSL (§3.4), so the
// damage and status math is the one every card uses. Keyed by the Art's card
// id; validate.js requires one entry per combat-kit Art and refuses an
// `enemy`-targeted effect on an Art that never asks for a target.

export const weaponArtUnleashed = {
  guardCounter: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }, { op: 'poiseDamage', target: 'enemy', amount: 2 }] },
  greatswordSunderingHew: { effects: [{ op: 'poiseDamage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'vulnerable', stacks: 1 }] },
  twinFang: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  quickstep: { effects: [{ op: 'block', target: 'self', amount: 5 }, { op: 'draw', amount: 1 }] },
  katanaDrawCut: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  sweepingBlow: { effects: [{ op: 'poiseDamage', target: 'allEnemies', amount: 2 }] },
  bashingBlow: { effects: [{ op: 'poiseDamage', target: 'enemy', amount: 4 }] },
  twinbladeFlurry: { effects: [{ op: 'damage', target: 'enemy', amount: 3, hits: 2 }] },
  cleavingBlow: { effects: [{ op: 'damage', target: 'allEnemies', amount: 4 }] },
  riposte: { effects: [{ op: 'poiseDamage', target: 'enemy', amount: 3 }, { op: 'block', target: 'self', amount: 4 }] },
  shieldGuardian: { effects: [{ op: 'block', target: 'self', amount: 6 }] },
  shieldBastion: { effects: [{ op: 'block', target: 'self', amount: 6 }] },
  shieldBash: { effects: [{ op: 'poiseDamage', target: 'enemy', amount: 3 }] },
  spikedReprisal: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  scholarsInsight: { effects: [{ op: 'draw', amount: 2 }] },
  flameToBlade: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }] },
  starSpark: { effects: [{ op: 'damage', target: 'enemy', amount: 4 }, { op: 'applyStatus', target: 'enemy', status: 'weak', stacks: 1 }] },
  frostNova: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 3 }] },
  blightTouch: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'crimsonBlight', stacks: 2 }] },
  penance: { effects: [{ op: 'heal', target: 'self', amount: 4 }] },
  urgentHeal: { effects: [{ op: 'heal', target: 'self', amount: 5 }] },
  contagion: { effects: [{ op: 'applyStatus', target: 'allEnemies', status: 'crimsonBlight', stacks: 1 }] },
  gorefireSlash: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 3 }] },
  moonrendCut: { effects: [{ op: 'damage', target: 'enemy', amount: 5 }, { op: 'poiseDamage', target: 'enemy', amount: 3 }] },
  rimeThrust: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 2 }] },
  kilnCleave: { effects: [{ op: 'applyStatus', target: 'enemy', status: 'burn', stacks: 2 }] },
  vesperWard: { effects: [{ op: 'block', target: 'self', amount: 5 }] },
};
