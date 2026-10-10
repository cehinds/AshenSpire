import { progressionRules } from '../content/progression/rules.js';
export const expandedProgression = run => run?.progressionRulesVersion === 1;
export const milestoneReceiptId = (classId, level, kind) => `class:${classId}:${level}:${kind}`;
export function classRewardBudget(registries, level) {
  return Object.fromEntries(Object.entries(registries.balance.progression.cadence).map(([kind, levels]) => [kind, levels.filter(at => at <= level).length]));
}
// A claim records XP and grant budgets separately from the player's choices.
// Old profile levels are seeded as allocations without paying skill XP.
export function queueClassMilestone(registries, run, classId, level, { veteran = false } = {}) {
  run.classMilestones ||= {};
  const id = `class:${classId}:${level}`;
  if (run.classMilestones[id]) return null;
  const cadence = registries.balance.progression.cadence;
  const grants = Object.keys(cadence).filter(kind => cadence[kind].includes(level));
  const receipt = { classId, level, skillXpPaid: !veteran, veteran, grants: Object.fromEntries(grants.map(kind => [kind, { id: milestoneReceiptId(classId, level, kind), state: 'pending' }])) };
  run.classMilestones[id] = receipt;
  capRunClassGrants(registries, run, classId);
  return receipt;
}
// SPEC §13.4r: feat slots and class attribute points are a per-run budget
// (reached milestones, up to six and four), not a per-class one. A second
// class's milestones may use only what the run has not already taken, so a
// class swap cannot replay or stack them. Excess pending grants are spent.
export const RUN_BUDGET_KINDS = ['feat', 'attribute'];
export function runGrantsTaken(run, kind) {
  return Object.values(run.classMilestones || {}).filter(row => row.grants?.[kind]?.state === 'taken').length;
}
export function capRunClassGrants(registries, run, classId = run.class) {
  const rows = Object.values(run.classMilestones || {}).filter(row => row.classId === classId).sort((a, b) => a.level - b.level);
  const level = Math.max(run.skills?.[`class:${classId}`]?.level || 0, ...rows.map(row => row.level));
  const budget = classRewardBudget(registries, level);
  for (const kind of RUN_BUDGET_KINDS) {
    let used = runGrantsTaken(run, kind);
    for (const row of rows) {
      const grant = row.grants[kind];
      if (grant?.state !== 'pending') continue;
      if (used >= (budget[kind] || 0)) { grant.state = 'spent'; grant.spentReason = 'run budget'; }
      else used++;
    }
  }
}
export function pendingClassMilestones(run, classId = run.class) {
  return Object.values(run.classMilestones || {}).filter(row => row.classId === classId).flatMap(row =>
    Object.entries(row.grants).filter(([,grant]) => grant.state === 'pending').map(([kind, grant]) => ({ ...grant, kind, classId: row.classId, level: row.level })));
}
export function finishClassMilestone(run, receiptId, selection) {
  for (const row of Object.values(run.classMilestones || {})) {
    const grant = Object.values(row.grants).find(value => value.id === receiptId);
    if (!grant || grant.state !== 'pending') continue;
    grant.state = 'taken'; grant.selection = structuredClone(selection);
    return true;
  }
  return false;
}
export function classMilestoneProblems(run) {
  const problems = [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const rules = run.progressionRuleSnapshot || progressionRules;
  if (run.progressionRulesVersion !== undefined && run.progressionRulesVersion !== 1) problems.push('progressionRulesVersion must be 1');
  if (run.classMilestones !== undefined && !object(run.classMilestones)) return [...problems,'classMilestones must be an object'];
  if ((run.classMilestones || run.classMilestoneOffers || run.abilityOffers) && !expandedProgression(run)) problems.push('expanded progression receipts require their rules version');
  const validateOffer = (id, offer, ids) => {
    if (!object(offer) || !Array.isArray(ids) || !ids.length || ids.some(value => typeof value !== 'string' || !value)) { problems.push(`progression offer ${id} lacks its choices`); return false; }
    if (!Number.isFinite(offer.intelligenceSnapshot) || offer.intelligenceSnapshot < 0) problems.push(`progression offer ${id} lacks its intelligence snapshot`);
    if (offer.abilityRanks !== undefined && (!Array.isArray(offer.abilityRanks) || offer.abilityRanks.length !== ids.length || offer.abilityRanks.some(rank => rank !== null && (!Number.isInteger(rank) || rank < 0 || rank > 5)))) problems.push(`progression offer ${id} has invalid grades`);
    if (offer.choiceIds !== undefined && (!Array.isArray(offer.choiceIds) || offer.choiceIds.length !== ids.length || new Set(offer.choiceIds).size !== ids.length || offer.choiceIds.some((choice,index) => choice !== (Number.isInteger(offer.abilityRanks?.[index]) ? `${ids[index]}@${offer.abilityRanks[index]}` : ids[index])))) problems.push(`progression offer ${id} has invalid choice identities`);
    return true;
  };
  for (const [id,offer] of Object.entries(run.abilityOffers || {})) {
    if (!validateOffer(id,offer,offer?.cardIds)) continue;
    if (offer.offerId !== id || !['item:magic-focus','combatManeuvers'].includes(offer.skillId) || !Number.isInteger(offer.level) || offer.level < 1 || offer.level > rules.ability.maxLevel || !Array.isArray(offer.abilityRanks) || !offer.choiceIds || offer.cardIds.length < rules.ability.draftSize || offer.cardIds.length > rules.ability.draftSize + 1 || new Set(offer.cardIds.slice(0,rules.ability.draftSize)).size !== rules.ability.draftSize) problems.push(`abilityOffers.${id} is invalid`);
  }
  for (const [id,offer] of Object.entries(run.classMilestoneOffers || {})) {
    if (!validateOffer(id,offer,offer?.options)) continue;
    if (!Object.hasOwn(rules.classSkills,offer.classId) || !rules.cadence[offer.rewardKind]?.includes(offer.level) || offer.receiptId !== id || id !== milestoneReceiptId(offer.classId,offer.level,offer.rewardKind) || offer.skillId !== `class:${offer.classId}` || offer.requiredLevel !== offer.level) problems.push(`classMilestoneOffers.${id} breaks its earned cadence`);
  }
  if(run.classRespecReceipts!==undefined && !Array.isArray(run.classRespecReceipts))return [...problems,'classRespecReceipts must be an array'];
  const respecIds=new Set();
  for(const receipt of run.classRespecReceipts || []){
    if(!object(receipt) || typeof receipt.id!=='string' || respecIds.has(receipt.id) || !Object.hasOwn(rules.classSkills,receipt.classId) || !Number.isInteger(receipt.level) || receipt.level<0 || receipt.level>(run.skills?.[`class:${receipt.classId}`]?.level || 0) || !Array.isArray(receipt.changes) || !Array.isArray(receipt.treeBefore) || !Array.isArray(receipt.treeAfter) || !Array.isArray(receipt.spent) || !Array.isArray(receipt.transfers)){problems.push('classRespecReceipts lacks its funded rebuild provenance');continue;}
    respecIds.add(receipt.id);
    const selections=new Set();
    for(const change of receipt.changes){
      const grant=Object.values(run.classMilestones || {}).find(row=>row.classId===receipt.classId && row.grants?.[change?.kind]?.id===change?.receiptId)?.grants?.[change?.kind];
      const offer=run.classMilestoneOffers?.[change?.receiptId];
      const rank=change?.abilityRank;
      if(!object(change) || !grant || typeof change.after!=='string' || !change.after || selections.has(change.receiptId) || (rank!==null && (!Number.isInteger(rank)||rank<0||rank>5)) || (change.kind==='cards' && !grant.originalSelection && !(offer?.abilityRanks || [null]).includes(rank)))problems.push(`classRespecReceipts.${receipt.id} has an unfunded selection`);
      selections.add(change?.receiptId);
    }
  }
  const instances = new Set();
  for (const [id, row] of Object.entries(run.classMilestones || {})) {
    if (!object(row) || !Object.hasOwn(rules.classSkills,row.classId) || id !== `class:${row.classId}:${row.level}` || !Number.isInteger(row.level) || row.level < 1 || row.level > 20 || row.level > (run.skills?.[`class:${row.classId}`]?.level || 0) || typeof row.veteran !== 'boolean' || row.skillXpPaid !== !row.veteran || !object(row.grants)) { problems.push(`classMilestones.${id} is invalid or unfunded`); continue; }
    const expected = Object.keys(rules.cadence).filter(kind => rules.cadence[kind].includes(row.level));
    if (JSON.stringify(Object.keys(row.grants).sort()) !== JSON.stringify(expected.sort())) problems.push(`classMilestones.${id} breaks its earned cadence`);
    for (const [kind, grant] of Object.entries(row.grants)) {
      if (!object(grant) || !expected.includes(kind) || grant.id !== milestoneReceiptId(row.classId,row.level,kind) || !['pending','taken','spent'].includes(grant.state)) { problems.push(`classMilestones.${id}.${kind} is invalid`); continue; }
      if (grant.state === 'taken') {
        const offer = run.classMilestoneOffers?.[grant.id];
        const origin = Object.hasOwn(grant,'originalSelection') ? grant.originalSelection : grant.selection;
        const choiceIndex = (offer?.choiceIds || offer?.options || []).indexOf(origin?.choiceId || origin?.id);
        if (grant.respecReceiptId) {
          const receipt = (run.classRespecReceipts || []).find(receipt => receipt.id === grant.respecReceiptId && receipt.classId === row.classId && receipt.level <= (run.skills?.[`class:${receipt.classId}`]?.level || 0));
          const change = receipt?.changes?.find(row => row.receiptId === grant.id && row.kind === kind);
          if (!change || !object(grant.selection) || grant.selection.id !== change.after || grant.selection.abilityRank !== change.abilityRank || (origin && origin.abilityRank !== grant.selection.abilityRank)) problems.push(`classMilestones.${id}.${kind} lacks its respec provenance`);
        }
        if ((!grant.respecReceiptId || origin) && (!object(origin) || choiceIndex < 0 || origin.id !== offer.options[choiceIndex] || origin.abilityRank !== (offer.abilityRanks?.[choiceIndex] ?? null) || offer.classId !== row.classId || offer.level !== row.level || offer.rewardKind !== kind)) problems.push(`classMilestones.${id}.${kind} lacks its earned selection`);
        if (grant.selection?.instanceId) {
          if (instances.has(grant.selection.instanceId)) problems.push(`classMilestones.${id}.${kind} duplicates an instance`);
          instances.add(grant.selection.instanceId);
        }
      }
    }
  }
  return problems;
}
