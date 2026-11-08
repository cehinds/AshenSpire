// Card-zone effect validation, pure (moved from src/engine/cardZones.js so src/model validators need no engine import).
export const CARD_ZONES = Object.freeze(['draw', 'hand', 'discard', 'exhaust']);
export function validateZoneEffect(effect) {
  if (!effect || typeof effect!=='object' || !['moveCards','modifyCards'].includes(effect.op)) throw new Error('Unknown card-zone opcode');
  const allowed=['op','from','to','amount','selection','position','look','transformTo','changes','target','if','repeat','oncePerTurn'];
  if (Object.keys(effect).some(key=>!allowed.includes(key))) throw new Error('Unknown card-zone field');
  if (typeof effect.amount==='number' ? !Number.isFinite(effect.amount) || effect.amount<0 || effect.amount>100 : !effect.amount || typeof effect.amount!=='object' || typeof effect.amount.f!=='string') throw new Error('Card count must be a bounded number or formula');
  if (effect.transformTo !== undefined && (typeof effect.transformTo!=='string' || !effect.transformTo)) throw new Error('Transform must name a card');
  if (!CARD_ZONES.includes(effect.from) || (effect.op !== 'modifyCards' && !CARD_ZONES.includes(effect.to))) throw new Error('Unknown card zone');
  if (!['first', 'random', 'choose'].includes(effect.selection || 'first')) throw new Error('Unknown card selection');
  if (effect.op === 'modifyCards') {
    if (!effect.changes || typeof effect.changes !== 'object' || Array.isArray(effect.changes)) throw new Error('Card changes must be an object');
    for (const key of Object.keys(effect.changes)) if (!['retain','retainTurns','hideTurns','maneuver','range'].includes(key)) throw new Error('Unknown card change');
    if (effect.changes.retain !== undefined && typeof effect.changes.retain !== 'boolean') throw new Error('Retain must be boolean');
    if (effect.changes.retainTurns!==undefined && (!Number.isSafeInteger(effect.changes.retainTurns) || effect.changes.retainTurns<1 || effect.changes.retainTurns>10)) throw new Error('Retain duration must be 1–10 turns');
    if (effect.changes.hideTurns !== undefined && !(effect.changes.hideTurns && typeof effect.changes.hideTurns==='object' && typeof effect.changes.hideTurns.f==='string') && (!Number.isSafeInteger(effect.changes.hideTurns) || effect.changes.hideTurns < 1 || effect.changes.hideTurns > 10)) throw new Error('Hide duration must be 1–10 turns');
    if (effect.changes.maneuver && !['attack','smash','defend','sweep','counter','casting'].includes(effect.changes.maneuver)) throw new Error('Unknown card maneuver');
    if (effect.changes.range && !['melee','reach','ranged'].includes(effect.changes.range)) throw new Error('Unknown card range');
  }
  if (!['top', 'bottom', 'random'].includes(effect.position || 'bottom')) throw new Error('Unknown card destination position');
  if (effect.look !== undefined && (!Number.isSafeInteger(effect.look) || effect.look < 1 || effect.look > 100)) throw new Error('Card look must be 1–100');
}
