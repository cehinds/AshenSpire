/** Authored starter grips only: the artwork is not mirrored onto other equipment. */
export function classSmashProfileFor({classId, armourId, grip} = {}) {
  if (armourId !== 'default' || !grip) return null;
  const starter = {rogue:['dagger','buckler'],starseer:['ashStaff',null],herald:['boneSceptre',null]}[classId];
  return starter && grip.right === starter[0] && (starter[1] ? grip.left === starter[1] : !grip.left)
    ? classId : null;
}

/** A heavy jump and ground impact; the renderer restores the current held origin. */
export function classSmashSequence() {
  return {poses:['origin','class-smash-takeoff','class-smash-airborne','class-smash-impact','origin'],
    durations:[1,1,1,1,1],impact:3,travel:[0,0,0,0,0],hold:false,timingUnits:5,contactCue:true};
}
