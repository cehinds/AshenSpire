// Which beats of a timeline are one Counter exchange (owner, 2026-11-14: "the counter is super slow ... do the counter
// animation simultaneously with the floaters, and then the hit/miss then reaction with damage floaters").
//
// A Counter exchange is a Counter card the player answers an enemy attack with, the attack landing on it, and the
// counter-return (`combatCounterTriggered`, either side). The roles (presentation only; the engine's log is untouched):
//   'card'    the player's Counter card beat: its cost, action word, stance and animation play at once, with no wait
//             between the floaters and the animation (ui/fx.js timingFor; motion.counter.floaterToAnimMs).
//   'hit'     the beat whose hit or miss the Counter answers: its stage gaps after the sprite are the Counter gap.
//   'return'  the counter-return beat (kind 'counter'): the animation, the hit or miss word, then the reaction with
//             its damage floaters, every gap the Counter gap.
const CardBeat = (beat) => beat.actorId === 'player' && beat.events.some((event) => event.type === 'cardPlayed');

/** CounterExchangeRoles(beats) -> Map<beat, 'card' | 'hit' | 'return'>; beats outside a Counter exchange are absent. */
export function CounterExchangeRoles(beats) {
  const roles = new Map();
  beats.forEach((beat, at) => {
    if (beat.kind !== 'counter') return;
    roles.set(beat, 'return');
    let back = at - 1;
    // The beat the Counter answers: the attack that hit (or missed) the counter-user.
    const hit = beats[back];
    if (hit && hit.kind === 'attack' && !roles.has(hit)) { roles.set(hit, 'hit'); back -= 1; }
    // The Counter card(s) the player played in answer to an enemy's attack sit just before it (a hit by the player is the
    // enemy's Counter: no card of the player's answers it).
    if (hit?.actorId !== 'player') for (; back >= 0 && CardBeat(beats[back]); back -= 1) roles.set(beats[back], 'card');
  });
  return roles;
}
