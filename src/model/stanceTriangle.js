// The stance triangle (stances.ruleset triangle): which of the triangle stances a card or enemy move
// plays, and who wins a matchup, read from the stances.triangle block. Leaf: imports only the flags.
import { TriangleRules } from './simpleCombatFlags.js';

const BY_EFFECT = 'byEffect';

export { TriangleRules };

function registryCard(subject, cardId)
{
  const cards = subject?.registries?.cards;
  if (!cardId || !cards?.has?.(cardId))
  {
    return null;
  }
  return cards.get(cardId);
}

function registryMove(subject, enemyId, moveId)
{
  const enemies = subject?.registries?.enemies;
  if (!enemyId || !moveId || !enemies?.has?.(enemyId))
  {
    return null;
  }
  return enemies.get(enemyId)?.moves?.[moveId] || null;
}

// A play carrier holds no effects of its own; its card or enemy move in the registries does.
function effectSource(subject, carrier, rules)
{
  const keys = rules.flatMap(rule => rule.keys || []);
  const ownEffects = Array.isArray(carrier?.effects) || keys.some(key => carrier?.[key] != null);
  if (ownEffects)
  {
    return carrier;
  }
  return registryCard(subject, carrier?.cardId)
    || registryMove(subject, carrier?.enemyId, carrier?.moveId)
    || carrier;
}

function matchesRule(source, rule)
{
  const ops = rule.ops || [];
  const keys = rule.keys || [];
  const hasOp = (source?.effects || []).some(effect => ops.includes(effect?.op));
  return hasOp || keys.some(key => source?.[key] != null);
}

function stanceByEffect(subject, carrier, byEffect)
{
  const rules = byEffect?.rules || [];
  const source = effectSource(subject, carrier, rules);
  const match = rules.find(rule => matchesRule(source, rule));
  return match
    ? match.stance
    : byEffect?.fallback;
}

/**
 * The triangle stance for a carrier whose maneuver resolved to `legacyId` (null: no maneuver).
 * A triangle stance or an id the map does not name (neutral, staggered) passes through.
 */
export function TriangleStance(subject, carrier, legacyId)
{
  const rules = TriangleRules(subject);
  const cardId = carrier?.cardId ?? carrier?.id;
  const override = cardId
    ? rules.overrides?.[cardId]
    : null;
  if (override)
  {
    return override;
  }
  if (legacyId && rules.include.includes(legacyId))
  {
    return legacyId;
  }
  const mapped = legacyId
    ? rules.map[legacyId] ?? legacyId
    : rules.noManeuver;
  return mapped === BY_EFFECT
    ? stanceByEffect(subject, carrier, rules.byEffect)
    : mapped;
}

/** Whether `attacking` beats `defending` under the triangle; a neutral stance never wins or loses. */
export function TriangleBeats(rules, attacking, defending)
{
  const neutral = rules?.neutral || [];
  if (!rules || neutral.includes(attacking) || neutral.includes(defending))
  {
    return false;
  }
  return !!rules.include?.includes(attacking) && !!rules.beats?.[attacking]?.includes(defending);
}
