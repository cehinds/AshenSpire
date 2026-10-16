// Enemies retain authored move plans. This explicit card overlay models only
// generated burdens, not a fictitious player deck hidden behind those plans.
export function addEnemyBurden(ctx, enemy, cardId, count=1, pile='draw') {
  if(!['draw','hand'].includes(pile))throw new Error('Enemy burden pile must be draw or hand');
  const def=ctx.registries.cards.get(cardId);
  if (!def.burden) throw new Error('Generated enemy card must define burden behavior');
  enemy.burdenPiles ||= {draw:[],hand:[],discard:[],exhaust:[]};
  for(let i=0;i<Math.min(20,Math.max(0,Math.floor(count)));i++) enemy.burdenPiles[pile].push({instanceId:ctx.nextInstanceId(),cardId,upgraded:false});
  ctx.emit('enemyBurdenAdded',{targetId:enemy.id,cardId,count});
}
export function beginEnemyBurdens(ctx,enemy,pool) {
  if (!enemy.burdenPiles) return;
  const piles=enemy.burdenPiles;
  if (!piles.draw.length && piles.discard.length) {piles.draw=ctx.rng.shuffle('shuffle',piles.discard);piles.discard=[];}
  const card=piles.draw.shift();
  enemy.burdenBudget=Math.max(0,pool);enemy.burdenTax=0;
  if(card)piles.hand.push(card);
  for(const held of piles.hand) {
    const rule=ctx.registries.cards.get(held.cardId).burden;
    if (rule.skipActions) enemy.skipNextTurn=true;
    enemy.burdenTax+=Math.max(0,rule.staminaTax || 0)+Math.max(0,rule.manaTax || 0);
    if(rule.status) ctx.enqueue({effect:{op:'applyStatus',target:'self',status:rule.status,stacks:1},source:enemy,owner:enemy,target:enemy,meta:{burden:true}});
    ctx.emit('enemyBurdenDrawn',{targetId:enemy.id,cardId:held.cardId,cardInstanceId:held.instanceId,skip:!!rule.skipActions,tax:enemy.burdenTax});
  }
}
export function allowBurdenMove(ctx,enemy,baseCost,move={}) {
  if (!enemy.burdenPiles || !enemy.burdenTax) return true;
  const profile=move.combatProfile || {},range=move.range || profile.range || 'melee',type=move.type || (move.intent==='attack' ? 'attack' : 'skill');
  const tax=enemy.burdenPiles.hand.reduce((sum,card)=>{const r=ctx.registries.cards.get(card.cardId).burden;return sum+((!r.ranges?.length || r.ranges.includes(range)) && (!r.cardTypes?.length || r.cardTypes.includes(type)) ? (r.staminaTax || 0)+(r.manaTax || 0) : 0);},0);
  if(!tax)return true;
  const cost=Math.max(0,baseCost)+tax;
  if (cost>(enemy.burdenBudget || 0)) {ctx.emit('enemyBurdenBlocked',{targetId:enemy.id,cost,remaining:enemy.burdenBudget || 0});return false;}
  enemy.burdenBudget-=cost;return true;
}
export function endEnemyBurdens(ctx,enemy) {
  if(!enemy.burdenPiles)return;
  for(const card of enemy.burdenPiles.hand) {
    const def=ctx.registries.cards.get(card.cardId),to=def.keywords?.includes('ethereal') || def.keywords?.includes('exhaust') ? 'exhaust' : 'discard';
    enemy.burdenPiles[to].push(card);
    if(def.burden.status) ctx.enqueue({effect:{op:'removeStatus',target:'self',status:def.burden.status,amount:1},source:enemy,owner:enemy,target:enemy,meta:{burden:true}});
  }
  enemy.burdenPiles.hand=[];delete enemy.burdenTax;delete enemy.burdenBudget;
}
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
