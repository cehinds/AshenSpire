// The triangle's Block winner (stances.triangle.blockBonus): a defend card's Block takes
// winnerMultiplier when the stance it beats is coming. Pure; previews read it too.
import { configuredStance } from '../model/profileStance.js';
import { TriangleRules, TriangleBeats } from '../model/stanceTriangle.js';

const ANY_ENEMY_INTENT = 'anyEnemyIntent';
const PLAYER_KIND = 'player';

// The player meets every living enemy's telegraphed move.
function enemyIntentStances(ctx)
{
  return (ctx?.enemies || [])
    .filter(enemy => enemy?.alive && enemy.intent)
    .map(enemy => configuredStance(enemy.intent, ctx));
}

// An enemy meets the stance the player holds now.
function playerStances(ctx)
{
  const held = ctx?.player?.combatStance;
  return held
    ? [configuredStance(held, ctx)]
    : [];
}

function opposingStances(ctx, entity)
{
  return entity?.kind === PLAYER_KIND
    ? enemyIntentStances(ctx)
    : playerStances(ctx);
}

/** The multiplier on the Block `card` gives `entity`: winnerMultiplier when it wins, else 1. */
export function TriangleBlockMultiplier(ctx, entity, card)
{
  const triangle = TriangleRules(ctx);
  const bonus = triangle?.blockBonus;
  if (!card || bonus?.mode !== ANY_ENEMY_INTENT)
  {
    return 1;
  }
  const stance = configuredStance(card, ctx);
  if (!bonus.stances?.includes(stance))
  {
    return 1;
  }
  const wins = opposingStances(ctx, entity).some(other => TriangleBeats(triangle, stance, other));
  return wins
    ? triangle.winnerMultiplier
    : 1;
}
