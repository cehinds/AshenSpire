import { immediateCardEffects } from '../src/model/cardTargets.js';

const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']);

// The latency gate measures an immediate hit. Attack-typed Counter cards
// prepare a later reaction and cannot provide a click-to-impact sample.
export function hasImmediateHostileDamage(def, { targeted = false } = {}) {
  return immediateCardEffects(def).some(effect => effect.op === 'damage'
    && (targeted ? effect.target === 'enemy' : HOSTILE_TARGETS.has(effect.target)));
}

// Immediate protection, including Counter preparation, provides a visible
// numeric readout even when the hostile matchup cannot be hit from this range.
export function hasImmediateCombatImpact(def) {
  const effects = immediateCardEffects(def);
  return hasImmediateHostileDamage(def)
    || effects.some(effect => ['poiseDamage', 'wardDamage'].includes(effect.op)
      && HOSTILE_TARGETS.has(effect.target))
    || effects.some(effect =>
      ['block', 'gainBarrier', 'gainPoise', 'gainWard'].includes(effect.op)
      && effect.target === 'self');
}
