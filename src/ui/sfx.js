// src/ui/sfx.js — sound hooks (SPEC §7.4: no-op stubs in v1)
//
// Wired at: cardPlay, hit, block, bleedBurst, stagger, enemyDeath, youDied,
// victory, stance. Audio assets land in M4; hooks exist so no call sites
// need to change.

export const sfx = {
  play(_id) {
    // Intentionally silent in v1.
  },
};
