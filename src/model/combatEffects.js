import { CARD_EFFECT_TAGS } from '../content/combatEffectStyles.js';
import { CARD_DEFENSE_EFFECTS } from '../content/combatDefenseEffects.js';
const classBolts = { reaver:'emberbolt', rogue:'shadowbolt', herald:'sacredbolt', starseer:'starbolt' };

// Effects follow resolved authored card tags; resource outlines remain separate.
export function combatEffectFor(card = {}, classId = 'starseer') {
  const tags = new Set((card.cardTags || card.tags || []).map(t => typeof t === 'string' ? t : t.id));
  const style = CARD_EFFECT_TAGS.find(([tag]) => tags.has(tag));
  if (card.type === 'power') return { kind:tags.has('venom')?'poisonAura':tags.has('blood')?'bloodAura':tags.has('oath')?'sacredAura':style?.[1] || (classId === 'reaver' ? 'gorefire' : classBolts[classId] || 'ritual'), projectile:false };
  if(card.type==='skill' && Object.hasOwn(CARD_DEFENSE_EFFECTS,card.id))return {kind:CARD_DEFENSE_EFFECTS[card.id],projectile:false};
  if (card.type === 'skill' && (tags.has('guard') || tags.has('block') || ['shieldGuard','weaponGuard','unarmedGuard','sceptreGuard','staffGuard'].includes(card.equipmentProfileId))) {
    const profile=card.equipmentProfileId;
    const kind=profile==='weaponGuard'?'parry':profile==='unarmedGuard'?'guardPulse':profile==='sceptreGuard'?'arcaneWard':profile==='staffGuard'?'magicGuard':tags.has('starstone')||tags.has('ritual')?'arcaneWard':card.manaCost>0?'magicGuard':'physicalGuard';
    return {kind,projectile:false};
  }
  const damaging = (card.effects || []).some(e => e.op === 'damage' && ['enemy','allEnemies','randomEnemy'].includes(e.target));
  if (!damaging) {
    if (card.type === 'skill' && (card.effects || []).some(e => e.op === 'applyStatus' && e.target === 'enemy' && ['weak','vulnerable'].includes(e.status))) return {kind:'bind',projectile:false,at:'target'};
    if (card.type === 'skill' && (tags.has('oath') || classId === 'herald') && (card.effects || []).some(e => e.op === 'heal' && e.target === 'self')) return {kind:'cleanse',projectile:false};
    const hostile = (card.effects || []).some(e => ['enemy','allEnemies','randomEnemy'].includes(e.target));
    if(card.type === 'skill' && !hostile){
      if(tags.has('flourish') || tags.has('guile'))return {kind:'dustStep',projectile:false};
      if(['blade','pierce','precision'].some(tag=>tags.has(tag)))return {kind:'steelGlint',projectile:false};
      if(tags.has('starstone') || tags.has('ritual'))return {kind:'focusMotes',projectile:false};
    }
    return style && card.type === 'skill' ? { kind:style[1], projectile:false, ...(hostile ? { at:'target' } : {}) } : null;
  }
  const melee = !tags.has('ranged') && (['blade','pierce','heavy','precision','flourish','blood'].some(tag => tags.has(tag)) || card.equipmentProfileId === 'shieldAttack');
  let kind = card.equipmentProfileId === 'shieldAttack' ? 'shieldBash' : style?.[1] || (card.manaCost > 0 || tags.has('ranged') ? classBolts[classId] || 'starbolt' : 'heavyImpact');
  if (card.equipmentProfileId === 'sceptreArcaneAttack') kind = 'arcaneBurst';
  else if ((card.effects || []).some(e => e.op === 'heal' && e.target === 'self')) kind = 'lifeDrain';
  else if (['slash','whirlwind','thrust'].includes(kind) && !tags.has('ranged') && ((card.effects || []).some(e => e.op === 'damage' && e.target === 'enemy' && !e.if && e.hits === 2) || (card.effects || []).filter(e => e.op === 'damage' && e.target === 'enemy' && !e.if).length > 1)) kind = 'crossSlash';
  const projectile = !melee && (kind.endsWith('bolt') || tags.has('ranged'));
  return { kind, projectile, ...(!projectile ? { at:'target' } : {}) };
}
