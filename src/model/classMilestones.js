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
  return receipt;
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
  const instances = new Set();
  for (const [id, row] of Object.entries(run.classMilestones || {})) {
    if (!object(row) || !Object.hasOwn(rules.classSkills,row.classId) || id !== `class:${row.classId}:${row.level}` || !Number.isInteger(row.level) || row.level < 1 || row.level > 20 || row.level > (run.skills?.[`class:${row.classId}`]?.level || 0) || typeof row.veteran !== 'boolean' || row.skillXpPaid !== !row.veteran || !object(row.grants)) { problems.push(`classMilestones.${id} is invalid or unfunded`); continue; }
    const expected = Object.keys(rules.cadence).filter(kind => rules.cadence[kind].includes(row.level));
    if (JSON.stringify(Object.keys(row.grants).sort()) !== JSON.stringify(expected.sort())) problems.push(`classMilestones.${id} breaks its earned cadence`);
    for (const [kind, grant] of Object.entries(row.grants)) {
      if (!object(grant) || !expected.includes(kind) || grant.id !== milestoneReceiptId(row.classId,row.level,kind) || !['pending','taken','spent'].includes(grant.state)) { problems.push(`classMilestones.${id}.${kind} is invalid`); continue; }
      if (grant.state === 'taken') {
        const offer = run.classMilestoneOffers?.[grant.id];
        const choiceIndex = (offer?.choiceIds || offer?.options || []).indexOf(grant.selection?.choiceId || grant.selection?.id);
        if (!object(grant.selection) || choiceIndex < 0 || grant.selection.id !== offer.options[choiceIndex] || grant.selection.abilityRank !== (offer.abilityRanks?.[choiceIndex] ?? null) || offer.classId !== row.classId || offer.level !== row.level || offer.rewardKind !== kind) problems.push(`classMilestones.${id}.${kind} lacks its earned selection`);
        if (grant.selection?.instanceId) {
          if (instances.has(grant.selection.instanceId)) problems.push(`classMilestones.${id}.${kind} duplicates an instance`);
          instances.add(grant.selection.instanceId);
        }
      }
    }
  }
  return problems;
}
