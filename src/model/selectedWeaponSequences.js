// Reviewed pilot phase ratios. The 350 ms review exposure is not gameplay pace:
// one gameplay unit is one sixth of the existing attack lunge (32.5 ms Normal).
export function selectedWeaponSequence(kind) {
  const impact = ['defend','impact-v','impact-g','impact-h','counter','defend'];
  const impactWeights = [2,3,1,2,3,2];
  const attack = Array.from({length:6},(_,i)=>'attack-'+(i+1));
  const evade = ['evade-1','evade-2','evade-3'];
  let poses, weights, contact = 0;
  if (kind === 'fully-defended') { poses=impact;weights=impactWeights; }
  else if (kind === 'evade') { poses=evade;weights=[1,1,1]; }
  else if (kind === 'defend' || kind === 'guard-break') { poses=[kind];weights=[6]; }
  else if (kind === 'attack' || kind === 'smash') { poses=attack;weights=[1,1,1,1,1,1];contact=3; }
  else if (kind === 'counter-guard') { poses=[...impact,'smash',...attack];weights=[...impactWeights,1,1,1,1,1,1,1];contact=10; }
  else if (kind === 'counter-evade') { poses=[...evade,...attack];weights=[1,1,1,1,1,1,1,1,1];contact=6; }
  else return null;
  return {poses:poses.map(p=>'pilot-'+p),durations:weights,impact:contact,travel:poses.map(()=>0),hold:false,pilot:true,reaction:kind === 'defend' || kind === 'guard-break'};
}

export function selectedWeaponSequenceTiming(sequence, speed) {
  if (!speed || !sequence) return {totalMs:0,impactMs:0};
  if(sequence.reaction)return {totalMs:speed.reactionMs,impactMs:0};
  const unit = speed.lungeMs / 6;
  return {totalMs:sequence.durations.reduce((a,b)=>a+b,0)*unit,
    impactMs:sequence.durations.slice(0,sequence.impact).reduce((a,b)=>a+b,0)*unit};
}

/** Associate a return with only its consumed incoming root action. */
export function selectedWeaponCounterOrigins(events, qualifies = () => true) {
  const reactions = new Set();
  let root = [], consumed = [];
  const reset = () => {root=[];consumed=[];};
  for (const event of events || []) {
    if (['enemyMoveStarted','cardPlayed','enemyActorTurnStarted','playerTurnStart','enemyTurnStart'].includes(event.type)) reset();
    if (event.type === 'combatCounterConsumed') consumed.push(event);
    if (event.type === 'combatCounterTriggered') {
      const origin = consumed.find(row=>row.sourceId===event.sourceId && row.targetId===event.targetId
        && row.cardInstanceId===event.cardInstanceId && row.cardId===event.cardId);
      if (origin && qualifies(event)) for (const row of root) if (row.sourceId===event.targetId && row.targetId===event.sourceId) reactions.add(row);
      reset();
    } else root.push(event);
  }
  return reactions;
}
