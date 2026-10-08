import { combatIntentStance } from '../../model/combatIntentVisibility.js';
import { intentBadge } from '../uiContent.js';

// Presentation consumes only the observer's projected intent. Never recover a
// hidden amount from enemy definitions, a move id, or the host's private state.
export function combatIntentPresentation(intent = {}) {
  intent ||= {};
  // Knowledge reads contain only an observer's broad clue, never private stance.
  if (intent.hidden && intent.knowledgeRead) {
    if (intent.knowledgeRead !== 'clue' || !['Attack?', 'Magic?', 'Preparing?'].includes(intent.label)) {
      return { visibility: 'unknown', title: '?', parts: [], stance: 'unknown' };
    }
    const attacking = intent.label === 'Attack?';
    return { visibility: 'partial', title: attacking ? 'Attacking ?' : 'Preparing ?',
      stance: attacking ? 'attacking' : 'preparing', parts: [{ icon: attacking ? 'attack' : 'prepare', value: null }] };
  }
  const stance = combatIntentStance(intent);
  const partial = intent.hidden === true;
  const unknown = !partial && (!intent.kind || intent.kind === 'unknown' || intent.moveId === null) && intent.kind !== 'staggered';
  if (unknown || (partial && !intent.stance && !intent.profile?.camp && !intent.profile?.maneuver)) {
    return { visibility: 'unknown', title: '?', parts: [], stance: 'unknown' };
  }
  if (partial) {
    const family = ['attacking', 'smashing', 'sweeping', 'ranged'].includes(stance) ? 'attacking'
      : ['defending', 'countering'].includes(stance) ? 'defending' : 'preparing';
    return { visibility: 'partial', title: `${capitalize(family)} ?`, stance: family,
      parts: [{ icon: family === 'attacking' ? 'attack' : family === 'defending' ? 'defend' : 'prepare', value: null }] };
  }
  // Interrupted turns retain their status in the tooltip; their badge simply
  // reports that the enemy is preparing, rather than claiming an attack.
  if (intent.kind === 'staggered') return { visibility: 'partial', title: 'Preparing ?', stance: 'preparing',
    parts: [{ icon: 'prepare', value: null }] };
  const family = intent.kind === 'buff' ? 'buffing' : ['ranged', 'sweeping'].includes(stance) ? 'attacking'
    : stance === 'preparing' ? (intent.kind === 'buff' ? 'buffing' : 'casting') : stance;
  const damage = intent.damage != null ? intentBadge(intent).label : null;
  const part = (icon, value = null) => ({ icon, value: value == null ? null : String(value) });
  const parts = family === 'countering' ? [part('defend', intent.block), part('attack', intent.counterDamage)]
    : family === 'defending' ? [part('defend', intent.block)]
    : family === 'smashing' ? [part('smash', damage)]
    : family === 'attacking' ? [part('attack', damage)]
    : [part(family === 'buffing' ? 'buff' : 'cast')];
  return { visibility: 'known', title: capitalize(family), stance: family, parts };
}

const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);
