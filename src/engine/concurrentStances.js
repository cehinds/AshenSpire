import { stanceMitigation } from './stanceMitigation.js';
import { proposalCardPlan, proposalContext } from './proposalStatusRuntime.js';
import { fixCoreEnabled } from '../model/fixCoreMechanics.js';
import * as StatusHelpers from '../framework/statusSemantics.js';
export const MANEUVERS=Object.freeze(['attack','smash','defend','sweep','counter','casting','evade']);
function policy(ctx,entity) {
 const {rules}=proposalContext(ctx);
 for(const [id,row] of Object.entries(rules)) if((entity.statuses?.[id]?.stacks || 0)>0) {
  const behavior=row.behaviors?.find(b=>b.kind==='stanceCapacity');if(behavior)return behavior;
 }
 return {};
}
export function stanceCapacity(ctx,entity) {const p=policy(ctx,entity);return Math.min(p.maxStances ?? 2,Math.max(1,1+proposalCardPlan(ctx,entity,{}).additionalStanceCapacity));}
export function activeCombatStances(ctx,entity) {
 if(!entity?.combatStance)return [];
 if(stanceCapacity(ctx,entity)<=1)return [entity.combatStance];
 const unique=new Map();
 for(const stance of [...(entity.concurrentStances || []),entity.combatStance]) if(stance?.maneuver && (stance.expiresOnOwnerCycle==null || stance.expiresOnOwnerCycle>(entity.combatOwnerCycle || 0))) unique.set(`${stance.camp}:${stance.maneuver}`,stance);
 return [...unique.values()].slice(-stanceCapacity(ctx,entity));
}
// Staggered is a forced, temporary condition (owner D13): it is never a chosen stance, so it is never remembered.
export function rememberCombatStance(ctx,entity,previous) {
 if(stanceCapacity(ctx,entity)<=1){delete entity.concurrentStances;return;}
 const existing=[...(entity.concurrentStances || []),previous,entity.combatStance].filter(row=>row && row.maneuver!=='staggered'),unique=new Map();
 for(const stance of existing) unique.set(`${stance.camp}:${stance.maneuver}`,stance);
 entity.concurrentStances=[...unique.values()].slice(-stanceCapacity(ctx,entity));
}
export function trimCombatStances(ctx,entity) {if(stanceCapacity(ctx,entity)<=1)delete entity.concurrentStances;else entity.concurrentStances=activeCombatStances(ctx,entity);}
// One deterministic defense is selected for each hostile carrier, for preview
// and live receipts alike. It cannot apply two defense multipliers to one hit.
export function defensiveCombatStance(ctx,entity,carrier={}) {
 const rows=activeCombatStances(ctx,entity);if(rows.length<2)return entity?.combatStance;
 const rawIncoming=carrier.combatProfile?.maneuver || carrier.maneuver,incoming=rawIncoming==='casting' ? 'prepared' : rawIncoming;
 const profile=ctx.gameProfile?.modules?.stances;
 const priority=policy(ctx,entity).defensePriority || ['counter','defend','evade','casting','attack','smash','sweep'];
 const penalty=stance=>profile?.mode==='configured' ? (profile.matchups?.[incoming]?.includes(stance.maneuver) ? profile.advantageMultiplier || 2 : 1) : incoming==='smash' && ['defend','casting'].includes(stance.maneuver) || incoming==='counter' && ['attack','smash','evade'].includes(stance.maneuver) || incoming==='sweep' && stance.maneuver==='counter' ? 2 : 1;
 const damageFactor=stance=>penalty(stance)*stanceMitigation(ctx,incoming,stance.maneuver).multiplier;
 return [...rows].sort((a,b)=>damageFactor(a)-damageFactor(b) || priority.indexOf(a.maneuver==='prepared' ? 'casting' : a.maneuver)-priority.indexOf(b.maneuver==='prepared' ? 'casting' : b.maneuver))[0];
}

// Core 2: a Poise break puts the owner in the Staggered stance and never adds a `staggered` status, yet content gates
// on hasStatus(..., 'staggered'). This is the one place that answers "is it staggered" for predicates and previews.
export function isStaggered(ctx,entity) {
 return !!entity && fixCoreEnabled(ctx) && activeCombatStances(ctx,entity).some(row=>row?.maneuver==='staggered');
}
/** Status stacks, counting the Core Staggered stance as one `staggered` stack. */
export function statusStacksWithStance(ctx,entity,statusId) {
 const stacks=StatusHelpers.getStacks(entity,statusId);
 return stacks>0 || statusId!=='staggered' || !isStaggered(ctx,entity) ? stacks : 1;
}
