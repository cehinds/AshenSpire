// Permanent disposal spends a grant before another copy can be acquired.
// Relic and equipment IDs are unique ownership keys; cards use instance IDs.
export function classRewardGrants(run, classId = run.class) {
  return Object.values(run.classMilestones || {}).filter(row => row.classId === classId)
    .sort((a,b) => a.level-b.level).flatMap(row => Object.entries(row.grants)
      .map(([kind,grant]) => ({...grant,kind,classId:row.classId,level:row.level})));
}
export function spendClassRewardItem(run, kind, identity, reason = 'removed') {
  for (const row of Object.values(run.classMilestones || {})) for (const [type,grant] of Object.entries(row.grants)) {
    if (type !== kind || grant.state !== 'taken') continue;
    const owned = kind === 'cards' ? grant.selection?.instanceId : grant.selection?.id;
    if (owned !== identity) continue;
    grant.state = 'spent'; grant.spentReason = reason;
  }
}
export function removeOwnedRelic(run, id, { reason = 'removed' } = {}) {
  const index = (run.relics || []).indexOf(id);
  if (index < 0) return false;
  spendClassRewardItem(run,'relic',id,reason);
  run.relics.splice(index,1);
  return true;
}
export function classRewardPresent(run, grant) {
  if (grant.state !== 'taken') return grant.state === 'pending';
  const selection = grant.selection;
  if (grant.kind === 'cards') return [...(run.deck || []),...(run.sideboard || [])].some(inst => inst.instanceId === selection?.instanceId && inst.rewardReceiptId === grant.id);
  if (grant.kind === 'relic') return (run.relics || []).includes(selection?.id);
  if (grant.kind === 'armory') {
    if (selection?.id?.startsWith('armor/')) {
      const [,classId,id] = selection.id.split('/');
      return (run.loadout?.boughtArmour || []).some(row => row.classId === classId && row.id === id);
    }
    const id = selection?.id?.slice(9);
    return (run.loadout?.storage || []).includes(id) || Object.values(run.loadout?.sets || {}).some(rows => rows.includes(id));
  }
  return true;
}
