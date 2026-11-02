import { combatIntentStance } from '../../model/combatIntentVisibility.js';
import { intentBadge } from '../uiContent.js';
import { t } from '../strings.js';

// Presentation consumes only the observer's projected intent. Never recover a
// hidden amount from enemy definitions, a move id, or the host's private state.
export function combatIntentPresentation(intent = {}) {
  intent ||= {};
  // Knowledge reads contain only an observer's broad clue, never private stance.
  if (intent.hidden && intent.knowledgeRead) {
    if (intent.knowledgeRead !== 'clue' || !['Attack?', 'Magic?', 'Preparing?'].includes(intent.label)) {
      return { visibility: 'unknown', title: '?', parts: [], stance: 'unknown', damageClass: null };
    }
    const attacking = intent.label === 'Attack?';
    const magic = intent.label === 'Magic?';
    return { visibility: 'partial', title: partialTitle(attacking ? 'attacking' : 'preparing'),
      stance: attacking ? 'attacking' : 'preparing', parts: [{ icon: attacking ? 'attack' : magic ? 'cast' : 'prepare', value: null }],
      damageClass: attacking ? 'physical' : magic ? 'magic' : null };
  }
  const stance = combatIntentStance(intent);
  const partial = intent.hidden === true;
  const unknown = !partial && (!intent.kind || intent.kind === 'unknown' || intent.moveId === null) && intent.kind !== 'staggered';
  if (unknown || (partial && !intent.stance && !intent.profile?.camp && !intent.profile?.maneuver)) {
    return { visibility: 'unknown', title: '?', parts: [], stance: 'unknown', damageClass: null };
  }
  if (partial) {
    const family = ['attacking', 'smashing', 'sweeping', 'ranged'].includes(stance) ? 'attacking'
      : ['defending', 'countering'].includes(stance) ? 'defending' : 'preparing';
    return { visibility: 'partial', title: partialTitle(family), stance: family,
      parts: [{ icon: family === 'attacking' ? 'attack' : family === 'defending' ? 'defend' : 'prepare', value: null }],
      damageClass: damageClassOf(intent, family) };
  }
  // Interrupted turns retain their status in the tooltip; their badge simply
  // reports that the enemy is preparing, rather than claiming an attack.
  if (intent.kind === 'staggered') return { visibility: 'partial', title: partialTitle('preparing'), stance: 'preparing',
    parts: [{ icon: 'prepare', value: null }], damageClass: null };
  const family = intent.kind === 'buff' ? 'buffing' : ['ranged', 'sweeping'].includes(stance) ? 'attacking'
    : stance === 'preparing' ? (intent.kind === 'buff' ? 'buffing' : 'casting') : stance;
  const projectedDamage = intent.projectedDamage || null;
  const damageRead = intentDamageRead(intent);
  const damage = damageRead?.label ?? (intent.damage != null ? intentBadge(intent).label : null);
  const part = (icon, value = null) => ({ icon, value: value == null ? null : String(value) });
  const counterParts = [part('counter', intent.block)];
  if (!(intent.counterPoiseDamage > 0) || intent.counterDamage > 0) counterParts.push(part('attack', intent.counterDamage));
  if (intent.counterPoiseDamage > 0) counterParts.push(part('smash', intent.counterPoiseDamage));
  const parts = family === 'countering' ? counterParts
    : family === 'defending' && intent.profile?.maneuver === 'evade' ? [part('evade', intent.dodgeCharges ?? intent.evadeCharges)]
    : family === 'defending' ? [part('defend', intent.block)]
    : family === 'smashing' ? [part('smash', damage)]
    : family === 'attacking' ? [part('attack', damage)]
    : [part(family === 'buffing' ? 'buff' : 'cast', family === 'buffing' ? null : damage)];
  if (damageRead) for (const part of parts) if (part.value === damage) part.summary = damageRead.summary;
  // A movement move (an Advance or a Retreat) reads as what it does, not as a generic buff.
  const movement = family === 'buffing' ? (intent.actionEffects || []).find(effect => effect?.op === 'moveEngagement') : null;
  const title = movement ? t(movement.bands > 0 ? 'combat.intent.retreating' : 'combat.intent.advancing') : capitalize(family);
  return { visibility: 'known', title, stance: family, parts, damageClass: damageClassOf(intent, family), ...(projectedDamage ? { projectedDamage } : {}) };
}

const capitalize = value => value.charAt(0).toUpperCase() + value.slice(1);
const partialTitle = stance => t('combat.intent.partial', { stance: capitalize(stance) });
const SPELL_CAMPS = Object.freeze(['spell', 'spells', 'magic']);
// Tint class from projected fields only: a spell camp is magic; otherwise an
// attacking or smashing family is physical. Defend, counter, buff and cast
// without a spell camp carry no damage class.
function damageClassOf(intent, family) {
  if (SPELL_CAMPS.includes(intent.profile?.camp)) return 'magic';
  return ['attacking', 'smashing'].includes(family) ? 'physical' : null;
}


// The prominent number always names individual hits. Totals have their own
// explicit scope, so 5 x 3 cannot silently become an unlabeled 15 per hit.
export function intentDamageRead(intent) {
  if (!intent || intent.hidden || intent.revealed === false || intent.damage == null) return null;
  const hits = Array.isArray(intent.hitDamages) && intent.hitDamages.length ? intent.hitDamages : Array.from({ length: Math.max(1, intent.hits || 1) }, () => intent.damage);
  const same = hits.every(n => n === hits[0]);
  const label = hits.length === 1 && intent.projectedDamage ? intent.projectedDamage.label : same ? `${hits[0]}${hits.length > 1 ? `×${hits.length}` : ''}`
    : hits.length <= 3 ? hits.join('+') : `${Math.min(...hits)}–${Math.max(...hits)}×${hits.length}`;
  const bounds = intent.projectedDamage?.label || (intent.hpLossBounds ? intent.hpLossBounds[0] === intent.hpLossBounds[1] ? String(intent.hpLossBounds[1]) : intent.hpLossBounds.join('–') : String(intent.totalDamage ?? hits.reduce((a, b) => a + b, 0)));
  const basis = intent.projectedDamage?.basis === 'hp' || intent.damageBasis === 'hp' || intent.hpLossBounds ? t('combat.intent.damageHp') : t('combat.intent.damageBeforeBlock');
  return { label, summary: intent.damageScope === 'contact'
    ? t('combat.intent.damageContact', { index: (intent.contactIndex || 0) + 1, count: intent.contactCount || 1, amount: bounds, basis })
    : t('combat.intent.damageTotal', { amount: bounds, basis }) };
}
