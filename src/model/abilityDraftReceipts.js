import {isAbilitySkill} from './abilityGrades.js';

export const abilityDraftId=(skillId,level)=>`ability:${skillId}:${level}`;
export function abilityDraftChoice(offer,choiceId) {
  const exact=(offer?.choiceIds || []).indexOf(choiceId);
  const matching=(offer?.cardIds || []).flatMap((id,index)=>id===choiceId?[index]:[]);
  const index=exact>=0?exact:matching.length===1?matching[0]:-1;
  if(index<0)return null;
  return {choiceId:offer.choiceIds?.[index] || choiceId,cardId:offer.cardIds[index],abilityRank:offer.abilityRanks[index]};
}
function inferredClaims(run,skillId) {
  const row=run.skills?.[skillId],claims={},unclaimed=new Set();
  const checkpoints=[run.pendingReward].filter(Boolean);
  for(const checkpoint of checkpoints)for(const offer of checkpoint.rewards?.skillDrafts || []){
    if(offer.skillId!==skillId || !offer.offerId)continue;
    if(checkpoint.states?.[`skillDraft:${offer.offerId}`]==='taken')claims[offer.offerId]={skillId,level:offer.level,claimedLevel:row.level,migrated:true};
    else unclaimed.add(offer.level);
  }
  for(const offer of run.deferredProgression?.skillDrafts || [])if(offer.skillId===skillId && offer.offerId)unclaimed.add(offer.level);
  // A pre-ledger save has only a count. Preserve its old chronological
  // interpretation, except where checkpoint/deferred receipts prove identity.
  let remaining=Math.max(0,(row?.level || 0)-(row?.pendingDrafts || 0)-Object.keys(claims).length);
  for(let level=1;level<=(row?.level || 0)&&remaining>0;level++){
    const id=abilityDraftId(skillId,level);
    if(unclaimed.has(level)||claims[id])continue;
    claims[id]={skillId,level,claimedLevel:row.level,migrated:true};remaining--;
  }
  return claims;
}
export function initializeAbilityDraftClaims(run,skillId) {
  run.abilityDraftClaims ||= {};
  return run.abilityDraftClaims[skillId] ||= inferredClaims(run,skillId);
}
export function pendingAbilityDraftLevels(run,skillId,{banked=0}={}) {
  if(run.progressionRulesVersion!==1 || !isAbilitySkill(skillId))return [];
  const row=run.skills?.[skillId];if(!row)return [];
  const claims=initializeAbilityDraftClaims(run,skillId);
  return Array.from({length:row.level+banked},(_,index)=>index+1).filter(level=>!claims[abilityDraftId(skillId,level)]);
}
export function spendAbilityDraft(run,skillId,offerId,choiceId) {
  const row=run.skills?.[skillId],offer=run.abilityOffers?.[offerId];
  if(!row || !(row.pendingDrafts>0) || !offer || offer.skillId!==skillId || offer.offerId!==offerId || offerId!==abilityDraftId(skillId,offer.level) || offer.level>row.level)return false;
  const selection=abilityDraftChoice(offer,choiceId);if(!selection)return false;
  const claims=run.abilityDraftClaims?.[skillId] || inferredClaims(run,skillId);
  if(claims[offerId])return false;
  run.abilityDraftClaims ||= {};run.abilityDraftClaims[skillId]=claims;
  claims[offerId]={skillId,level:offer.level,claimedLevel:row.level,...selection};
  row.pendingDrafts--;
  return true;
}
export function abilityDraftClaimProblems(run) {
  const problems=[],object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  if(run.abilityDraftClaims===undefined)return problems;
  if(run.progressionRulesVersion!==1 || !object(run.abilityDraftClaims))return ['abilityDraftClaims requires the expanded rules and a receipt map'];
  for(const [skillId,claims] of Object.entries(run.abilityDraftClaims)){
    if(!isAbilitySkill(skillId)||!object(claims)){problems.push(`abilityDraftClaims.${skillId} is not an ability receipt map`);continue;}
    for(const [id,claim] of Object.entries(claims)){
      if(!object(claim)||claim.skillId!==skillId||id!==abilityDraftId(skillId,claim.level)||!Number.isInteger(claim.level)||claim.level<1||claim.level>10||!Number.isInteger(claim.claimedLevel)||claim.claimedLevel<claim.level||claim.claimedLevel>10){problems.push(`abilityDraftClaims.${id} is unfunded`);continue;}
      if(claim.migrated===true)continue;
      const offer=run.abilityOffers?.[id],selection=abilityDraftChoice(offer,claim.choiceId);
      if(!selection||offer.skillId!==skillId||offer.level!==claim.level||selection.cardId!==claim.cardId||selection.abilityRank!==claim.abilityRank)problems.push(`abilityDraftClaims.${id} lacks its immutable choice`);
    }
  }
  return problems;
}
