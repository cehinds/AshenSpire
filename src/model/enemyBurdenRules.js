// Enemy burden pile validation, pure (moved from src/engine/enemyBurdens.js so src/model snapshots need no engine import).
export function enemyBurdenProblems(enemy,registries) {
  if(enemy.burdenPiles===undefined)return [];
  const problems=[],seen=new Set();
  for(const zone of ['draw','hand','discard','exhaust']) {
    const rows=enemy.burdenPiles?.[zone];
    if(!Array.isArray(rows) || rows.length>100) {problems.push('invalid enemy burden pile');continue;}
    for(const card of rows) {
      if(!card || typeof card.instanceId!=='string' || !card.instanceId || seen.has(card.instanceId)) problems.push('invalid enemy burden instance');
      seen.add(card?.instanceId);
      if(registries && (!registries.cards.has(card?.cardId) || !registries.cards.get(card.cardId).burden)) problems.push('unknown enemy burden card');
    }
  }
  return problems;
}
