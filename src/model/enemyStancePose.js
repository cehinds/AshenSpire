import { combatIntentStance } from './combatIntentVisibility.js';
const categories = Object.freeze({ smashing: 'smash', attacking: 'attack', ranged: 'attack', countering: 'counter',
  sweeping: 'sweep', defending: 'defend', casting: 'preparing', preparing: 'preparing' });

// Read only the plan's public action category. Visibility, move identity and
// numbers never select artwork; the prepared status is not a stance.
export function enemyStanceCategory(intent = {}) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return null;
  const profile = intent.combatProfile || intent.profile || {};
  if (!intent.stance && (!intent.kind || intent.kind === 'unknown') && !profile.camp && !profile.maneuver) return null;
  const category = combatIntentStance(intent, profile);
  return Object.hasOwn(categories, category) ? categories[category] : null;
}
