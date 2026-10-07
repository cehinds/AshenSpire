import { immediateCardEffects } from '../src/model/cardTargets.js';

const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']);

// The latency gate measures an immediate hit. Attack-typed Counter cards
// prepare a later reaction and cannot provide a click-to-impact sample.
export function hasImmediateHostileDamage(def, { targeted = false } = {}) {
  return immediateCardEffects(def).some(effect => effect.op === 'damage'
    && (targeted ? effect.target === 'enemy' : HOSTILE_TARGETS.has(effect.target)));
}
