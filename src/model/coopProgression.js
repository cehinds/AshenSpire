// Character card receipts owned by the co-op host. Presentation XP receipts
// carry no authority; these card receipts do and must remain funded on load.
export function coopProgressionProblems(run){
  if(run.coopLevelCards===undefined)return [];
  const problems=[],object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  if(run.progressionRulesVersion!==1||!object(run.coopLevelCards))return ['coopLevelCards requires expanded progression and a receipt map'];
  for(const [key,offer] of Object.entries(run.coopLevelCards)){
    const match=key.match(/^coop-character:(\d+):(\d+)$/);
    if(!object(offer)||!match||offer.key!==key||!Number.isInteger(offer.level)||offer.level<2||offer.level>run.level?.level||offer.level!==Number(match[1])||!Array.isArray(offer.cardIds)||!offer.cardIds.length||offer.cardIds.some(id=>typeof id!=='string'||!id)||new Set(offer.cardIds).size!==offer.cardIds.length||(offer.taken!==undefined&&!offer.cardIds.includes(offer.taken)))problems.push(`coopLevelCards.${key} is not a funded character card receipt`);
  }
  return problems;
}
