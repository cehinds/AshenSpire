// SPEC §13.4q: data-driven mastery unlock identities and pool projections.
// No run is opted in here. The profile/run integration owns that boundary.
import { xpStepCost } from './xpCurve.js';

export const masteryRowId = row => `${row.classId}:${row.level}:${row.kind}:${row.ref}`;
export function masteryRows(registries, classId, level = null) {
  return (registries.classMastery || []).filter(row => row.classId === classId && (level === null || row.level === level));
}
export function masteryCorePool(registries, classId) {
  const gated = new Set(masteryRows(registries, classId).filter(row => row.kind === 'cards').map(row => row.ref));
  return registries.classes.get(classId).cardPool.filter(id => !gated.has(id));
}
export function masteryUnlockedRows(meta, classId = null) {
  const classes = Object.entries(meta?.classMastery || {});
  return new Set(classes.filter(([id]) => classId === null || id === classId).flatMap(([,row]) => row?.unlockedRows || []));
}
export function masteryRefAvailable(registries, meta, kind, ref, classId = null) {
  const rows = (registries.classMastery || []).filter(row => row.kind === kind && row.ref === ref && (classId === null || row.classId === classId));
  const unlocked = masteryUnlockedRows(meta, classId);
  return rows.length === 0 || rows.some(row => unlocked.has(masteryRowId(row)));
}
export function masteryCardPool(registries, meta, classId) {
  return registries.classes.get(classId).cardPool.filter(ref => masteryRefAvailable(registries, meta, 'cards', ref, classId));
}
export function masteryXpAtLevel(registries, level) {
  const curve = registries.balance.classMastery.xp;
  let total = 0;
  for (let step = 0; step < Math.min(level, curve.maxLevel); step++) total += xpStepCost(curve, step);
  return total;
}

/** Refuse authored faults by their row identity, including the core's depth. */
export function classMasteryProblems(bundle) {
  const problems = [];
  const at = (id,msg) => problems.push(`classMastery.${id}: ${msg}`);
  const rules = bundle.balance?.classMastery;
  if (!rules && bundle.classMastery === undefined) return problems;
  if (!rules || !Array.isArray(rules.cycle) || !rules.cycle.length || rules.cycle.some(k=>!['cards','armament','relic','feat','weapon'].includes(k))) { at('cycle','must name a non-empty cycle of unlock kinds'); return problems; }
  const curve=rules.xp || {};
  for(const key of ['base','roundTo','maxLevel']) if(!Number.isInteger(curve[key]) || curve[key]<=0) at(`xp.${key}`,'must be a positive integer');
  if(!Number.isFinite(curve.growth) || curve.growth<1) at('xp.growth','must be finite and at least one');
  for(const key of ['perWin','perElite','perBoss','perQuest']) if(!Number.isInteger(rules.pay?.[key]) || rules.pay[key]<0) at(`pay.${key}`,'must be a non-negative integer');
  if(!Number.isFinite(rules.corePoolShare) || rules.corePoolShare<=0 || rules.corePoolShare>1) at('corePoolShare','must be greater than zero and at most one');
  if(!Array.isArray(bundle.classMastery)) { at('table','must be an array compiled from classMastery.csv'); return problems; }
  const classes=new Map((bundle.classes || []).map(c=>[c.id,c]));
  const cards=new Map((bundle.cards || []).map(c=>[c.id,c]));
  const relics=new Set((bundle.relics || []).map(r=>r.id));
  const feats=new Map((bundle.classSkillFeats || []).map(f=>[f.id,f]));
  const arms=new Map((bundle.equipment?.armaments || []).map(a=>['armament/'+a.id,a]));
  const armor=new Set((bundle.equipment?.armour || []).map(a=>`armor/${a.classId}/${a.id}`));
  const owners=new Map(),seen=new Set();
  const rows=bundle.classMastery;
  for(const row of rows){
    const label=row && masteryRowId(row);
    if(!row || typeof row!=='object') {at('row','must be an object');continue;}
    for(const key of Object.keys(row))if(!['classId','level','kind','ref'].includes(key))at(label,`unknown field '${key}'`);
    const cls=classes.get(row.classId);
    if(!cls)at(label,`unknown class '${row.classId}'`);
    if(!Number.isInteger(row.level) || row.level<1 || row.level>curve.maxLevel)at(label,'level is outside the mastery curve');
    if(row.kind!==rules.cycle[(row.level-1)%rules.cycle.length])at(label,`kind '${row.kind}' breaks the cycle`);
    if(typeof row.ref!=='string' || !row.ref)at(label,'ref must be non-empty');
    if(seen.has(label))at(label,'duplicate row');
    seen.add(label);
    const identity=['weapon','armament'].includes(row.kind)?row.ref:`${row.kind}/${row.ref}`;
    if(owners.has(identity))at(label,`ref '${row.ref}' is already listed by '${owners.get(identity)}'`);
    owners.set(identity,row.classId);
    if(row.kind==='cards'){
      if(!cards.has(row.ref))at(label,`unknown card '${row.ref}'`);
      if(cls && !cls.cardPool.includes(row.ref))at(label,`card '${row.ref}' is outside '${row.classId}' cardPool`);
    }else if(row.kind==='relic' && !relics.has(row.ref))at(label,`unknown relic '${row.ref}'`);
    else if(row.kind==='feat' && feats.get(row.ref)?.skillId!==`class:${row.classId}`)at(label,`unknown class feat '${row.ref}'`);
    else if(row.kind==='weapon' && arms.get(row.ref)?.kind!=='weapon')at(label,`'${row.ref}' is not a striking weapon`);
    else if(row.kind==='armament' && !armor.has(row.ref) && !['shield','staff'].includes(arms.get(row.ref)?.kind))at(label,`'${row.ref}' is not armour, a shield or a focus`);
  }
  const tagsFor=(family,id)=>(bundle.tagging || []).filter(t=>t.family===family && t.objectId===id).map(t=>t.tagId);
  const schools=new Set((bundle.nodes || []).filter(n=>n.parentId==='card').map(n=>n.id));
  for(const cls of classes.values()){
    const own=rows.filter(r=>r?.classId===cls.id),gated=new Set(own.filter(r=>r.kind==='cards').map(r=>r.ref));
    const core=cls.cardPool.filter(id=>!gated.has(id));
    if(core.length<Math.ceil(cls.cardPool.length*rules.corePoolShare))at(cls.id,`core pool has ${core.length}/${cls.cardPool.length}, below corePoolShare ${rules.corePoolShare}`);
    const kits=(bundle.equipment?.startingKits || []).filter(k=>k.classId===cls.id);
    const hands=new Set(kits.flatMap(k=>[k.rightHand,k.leftHand]).filter(Boolean));
    const starting=new Set([cls.abilityCard,cls.startingSignatureCard,...(bundle.balance?.equipment?.startingDeck?.global?.grants || [])]);
    for(const grant of bundle.equipment?.equipmentGrants || []) if(grant.family==='armament' && hands.has(grant.sourceId))for(const id of (Array.isArray(grant.cards)?grant.cards:[grant.cards]).filter(Boolean))starting.add(id);
    for(const profile of bundle.equipment?.basicCardProfiles || []) if(hands.has(profile.weaponId))starting.add(profile.baseCardId);
    for(const id of starting)if(gated.has(id))at(`${cls.id}.${id}`,'starting-deck card must be core');
    for(const kit of kits.filter(k=>k.baseline))for(const id of [kit.rightHand,kit.leftHand].filter(Boolean)) if(rows.some(r=>r?.ref==='armament/'+id && ['armament','weapon'].includes(r.kind)))at(`${cls.id}.${id}`,'baseline starting equipment cannot be gated');
    for(const outfit of bundle.equipment?.armour || [])if(outfit.classId===cls.id && !outfit.unlock && !outfit.sharedSet && rows.some(r=>r?.ref===`armor/${cls.id}/${outfit.id}`))at(`${cls.id}.${outfit.id}`,'starting armour cannot be gated');
    for(const id of [cls.startingRelic,cls.kitRelic])if(own.some(r=>r.kind==='relic' && r.ref===id))at(`${cls.id}.${id}`,'starting relic cannot be gated');
    for(let level=1;level<=curve.maxLevel;level++){
      const levelRows=own.filter(r=>r.level===level);
      if(!levelRows.length)at(`${cls.id}.${level}`,'level must unlock something');
      if(levelRows.length>1 && levelRows[0].kind!=='cards')at(`${cls.id}.${level}`,'a non-card level unlocks one thing');
      if(levelRows[0]?.kind==='cards' && levelRows.length>Math.ceil(gated.size/own.filter(r=>r.kind==='cards').map(r=>r.level).filter((v,i,a)=>a.indexOf(v)===i).length))at(`${cls.id}.${level}`,'card bundle exceeds the evenly divided bundle size');
    }
    const coreFeats=[...feats.values()].filter(f=>f.skillId===`class:${cls.id}` && !own.some(r=>r.kind==='feat' && r.ref===f.id));
    if(coreFeats.length<bundle.balance.skill.draftSize)at(`${cls.id}.feats`,'core class feats must fill draftSize');
    for(const hand of bundle.characterCreation?.classes?.[cls.id]?.handIds || []){
      const tags=tagsFor('armament',hand).filter(t=>schools.has(t));
      for(const rarity of Object.keys(bundle.balance.skill.rarityUnlock || {})){
        const count=core.filter(id=>cards.get(id)?.rarity===rarity && tagsFor('card',id).some(t=>tags.includes(t))).length;
        if(count<4)at(`${cls.id}.${hand}.${rarity}`,`core skill draft has ${count} cards; needs four distinct choices`);
      }
    }
  }
  const featIds=new Set();
  for(const feat of bundle.classSkillFeats || []){
    if(!feat?.id || featIds.has(feat.id))at('feats','class feat must have a unique id');
    featIds.add(feat?.id);
    if(!classes.has(feat?.skillId?.slice(6)) || !feat.skillId.startsWith('class:'))at(feat?.id,'class feat must name a class track');
    if(!Number.isInteger(feat?.minLevel) || feat.minLevel<0 || !feat?.name || !feat?.description)at(feat?.id,'class feat needs a name, description and non-negative minLevel');
    if(!feat?.crit && !feat?.passive)at(feat?.id,'class feat must author an effect');
    const effect=feat?.crit || feat?.passive;
    if(!Array.isArray(effect?.tags) || !effect.tags.length || effect.tags.some(t=>!(bundle.nodes || []).some(n=>n.id===t)))at(feat?.id,'feat effect tags must name nodes');
    if(feat?.passive && (!Number.isInteger(feat.passive.block) || feat.passive.block<=0))at(feat.id,'passive Block must be a positive integer');
    if(feat?.crit && (!Number.isFinite(feat.crit.base) || feat.crit.base<0 || !Number.isFinite(feat.crit.cap) || feat.crit.cap>1 || feat.crit.cap<feat.crit.base || !(feat.crit.multiplier>1) || !(feat.crit.divisor>0)))at(feat.id,'critical-hit chance and multiplier are invalid');
  }
  return problems;
}
