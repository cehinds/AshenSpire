// Owner-approved player presentation groups. Enemy motion remains governed by
// actionAnimations.js. These plans never change card effects or combat state.
export const COMBAT_SEQUENCES = Object.freeze({
  attack: ['attack1', 'attack2', 'attack3', 'attack4'],
  cast: ['idle'], power: ['power1', 'power2', 'power3'], guard: ['guard'], hit: ['hit'],
  shieldGuard: ['shieldGuard1', 'shieldGuard2', 'shieldGuard3'],
  parry: ['parry1', 'parry2', 'parry3'],
  shieldBash: ['shieldBash1', 'shieldBash2', 'shieldBash3'],
});

export function resolveCombatAnimation(card = {}, equipment = []) {
  const tags = new Set((card.cardTags || card.tags || []).map(tag => typeof tag === 'string' ? tag : tag.id));
  // Lanterns and torches share the equipment kind but are not physical shields.
  const shield = equipment.find(item => item.kind === 'shield' && ['round', 'kite', 'tower', 'spiked'].includes(item.geom));
  const parry = equipment.some(item => item.id === 'parryDagger');
  const shieldIntent = tags.has('shield') || card.equipmentProfileId === 'shieldGuard';
  if (card.type === 'attack') {
    const bash = shield && card.sourceArmamentId !== 'parryDagger' && (card.id === 'shieldBash' || card.equipmentProfileId === 'shieldAttack' || tags.has('shield'));
    return { group: 'attack', technique: bash ? 'shieldBash' : 'attack', rest: null, family: 'strike', motion: 'impact' };
  }
  if (card.type === 'power') return { group: 'cast', technique: 'power', rest: 'cast', family: 'spell', motion: 'cast' };
  if (card.type === 'skill' && (tags.has('guard') || tags.has('block'))) {
    const technique = shieldIntent ? parry ? 'parry' : shield ? 'shieldGuard' : 'guard' : 'guard';
    return { group: 'defend', technique, rest: technique, family: 'guard', motion: 'brace' };
  }
  return { group: 'cast', technique: 'cast', rest: null, family: 'spell', motion: 'cast' };
}

export function combatRestAfterEvent(rest, event, actorId, plan) {
  if (event.type === 'playerTurnStart' && (event.playerId || 'player') === actorId) return 'idle';
  if (event.type === 'cardPlayed' && (event.playerId || event.sourceId || 'player') === actorId && plan?.rest) return plan.rest;
  return rest;
}
