import { cardKind } from './tree.js';
import { cardActionPlan } from './alternativeCardAnimation.js';
// Owner-approved player presentation groups. Enemy motion remains governed by
// actionAnimations.js. These plans never change card effects or combat state.
export const COMBAT_SEQUENCES = Object.freeze({
  attack: ['attack1', 'attack2', 'attack3', 'attack4'],
  cast: ['idle'], power: ['power1', 'power2', 'power3'], guard: ['guard'], hit: ['hit'],
  shieldGuard: ['shieldGuard1', 'shieldGuard2', 'shieldGuard3'],
  parry: ['parry1', 'parry2', 'parry3'],
  shieldBash: ['shieldBash1', 'shieldBash2', 'shieldBash3'],
});

export function resolveCombatAnimation(card = {}, equipment = [], { animation, classId, appearance = 'alternative', combatExpansionVersion } = {}) {
  const classDefault = appearance === 'alternative' ? cardActionPlan(card, classId) : null;
  if (classDefault) return classDefault;
  // The card's kind tag decides the family of motion, not its `type` field.
  const kind = cardKind(card);
  const tags = new Set((card.cardTags || card.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id));
  const visuals = new Set((card.animationTags || []).map(tag => typeof tag === 'string' ? tag : tag.id));
  // Lanterns and torches share the equipment kind but are not physical shields.
  const shield = equipment.find(item => item.kind === 'shield' && ['round', 'kite', 'tower', 'spiked'].includes(item.geom));
  const bow = equipment.find(item => item.id === 'shortbow');
  const parry = equipment.some(item => item.id === 'parryDagger');
  const shieldIntent = visuals.has('fx:shield') || tags.has('shield') || card.equipmentProfileId === 'shieldGuard';
  // Expanded maneuvers describe the paid action independently of its legacy
  // Attack/Skill lifecycle kind. Preparing a Counter never swings a weapon.
  if (combatExpansionVersion === 2 && tags.has('maneuver:counter')) {
    if (tags.has('camp:spell')) return { group: 'cast', technique: 'cast', rest: 'cast', family: 'spell', motion: 'cast' };
    const technique = shield && card.sourceArmamentId !== 'parryDagger' ? 'shieldGuard'
      : parry ? 'parry' : 'guard';
    return { group: 'defend', technique, rest: technique, family: 'guard', motion: 'brace' };
  }
  if (kind === 'attack') {
    // Spell source is the card's attack identity, regardless of which focus or
    // physical weapon happens to be held. A selected set supplies its cast clip;
    // the painted outfit supplies a safe fallback where no clip was authored.
    if (tags.has('source:spell')) {
      return { group: 'cast', technique: 'cast', rest: null, family: 'spell', motion: 'cast' };
    }
    const bash = shield && card.sourceArmamentId !== 'parryDagger'
      && (card.sourceArmamentId === shield.id || visuals.has('fx:shield') || card.id === 'shieldBash' || card.equipmentProfileId === 'shieldAttack' || tags.has('shield'));
    const bowShot = !bash && bow && (!card.sourceArmamentId || card.sourceArmamentId === bow.id)
      && (tags.has('bow') || (card.sourceArmamentId === bow.id && tags.has('ranged')))
      && animation?.references?.bowAttack;
    const blade = !bash && !tags.has('ranged') && tags.has('blade') && animation?.references?.bladeAttack;
    return { group: 'attack', technique: bash ? 'shieldBash' : bowShot ? 'bowAttack' : blade ? 'bladeAttack' : 'attack', rest: null, family: bowShot ? 'projectile' : 'strike', motion: bowShot ? 'release' : 'impact' };
  }
  if (kind === 'power') return { group: 'cast', technique: 'power', rest: 'cast', family: 'spell', motion: 'cast' };
  if (kind === 'skill' && (tags.has('guard') || tags.has('block'))) {
    const technique = shield && card.sourceArmamentId !== 'parryDagger' ? 'shieldGuard'
      : parry && shieldIntent ? 'parry' : 'guard';
    return { group: 'defend', technique, rest: technique, family: 'guard', motion: 'brace' };
  }
  return { group: 'cast', technique: 'cast', rest: null, family: 'spell', motion: 'cast' };
}

export function combatRestAfterEvent(rest, event, actorId, plan) {
  if (event.type === 'playerTurnStart' && (event.playerId || 'player') === actorId) return 'idle';
  if (event.type === 'cardPlayed' && (event.playerId || event.sourceId || 'player') === actorId && plan?.rest) return plan.rest;
  return rest;
}
