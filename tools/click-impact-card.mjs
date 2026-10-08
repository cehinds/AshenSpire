import { immediateCardEffects } from '../src/model/cardTargets.js';

const HOSTILE_TARGETS = new Set(['enemy', 'allEnemies', 'randomEnemy', 'otherEnemies']);

// The latency gate measures an immediate hit. Attack-typed Counter cards
// prepare a later reaction and cannot provide a click-to-impact sample.
export function hasImmediateHostileDamage(def, { targeted = false } = {}) {
  return immediateCardEffects(def).some(effect => effect.op === 'damage'
    && (targeted ? effect.target === 'enemy' : HOSTILE_TARGETS.has(effect.target)));
}

// A Counter may give immediate protection while its attack waits for a reply.
// Keep that visible preparation eligible without counting the deferred damage.
export function hasImmediateCombatImpact(def) {
  const effects = immediateCardEffects(def);
  return hasImmediateHostileDamage(def)
    || effects.some(effect => ['poiseDamage', 'wardDamage'].includes(effect.op)
      && HOSTILE_TARGETS.has(effect.target))
    || (def?.counterPayload != null && effects.some(effect =>
      ['block', 'gainBarrier', 'gainPoise', 'gainWard'].includes(effect.op)
      && effect.target === 'self'));
}
