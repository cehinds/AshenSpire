import { resolveCombatAnimation, COMBAT_SEQUENCES } from '../../../src/model/combatAnimation.js';
import { resourceAura } from '../../../src/ui/combatAura.js';
export function routeCard(card = {}, equipment = []) {
  return resolveCombatAnimation(card, equipment);
}

export const sequences = COMBAT_SEQUENCES;

// Actor-owned resting state survives a renderer rebind. An attack/hit settles
// back to that state; changing turns or interrupting cancels old callbacks.
export function createAnimator({ actorId, frames, draw, schedule = setTimeout, cancel = clearTimeout }) {
  let rest = 'idle', pose = 'idle', active = null, reduced = false, tickets = [], epoch = 0;
  let aura = [];
  const available = name => frames.has(name);
  const restPose = () => {
    const names = sequences[rest] || [rest];
    return [...names].reverse().find(available) || 'idle';
  };
  const show = name => { pose = available(name) ? name : 'idle'; draw({ pose, rest, active, aura }); };
  const clear = () => { epoch++; tickets.forEach(cancel); tickets = []; };
  const settle = () => { clear(); active = null; aura = []; show(restPose()); };
  const play = (technique, duration = 900) => {
    clear(); active = technique;
    const names = (sequences[technique] || ['idle']).filter(available);
    if (!names.length || reduced) { settle(); return; }
    const token = epoch, ms = Math.max(60, Number(duration) || 900);
    show(names[0]);
    names.slice(1).forEach((name, index) => tickets.push(schedule(() => {
      if (token === epoch) show(name);
    }, ms * (index + 1) / names.length)));
    tickets.push(schedule(() => { if (token === epoch) settle(); }, ms));
  };
  return {
    get state() { return { pose, rest, active }; },
    card(card, equipment, duration) {
      const plan = routeCard(card, equipment);
      if (plan.rest) rest = plan.rest;
      aura = resourceAura(card);
      play(plan.technique, duration);
      return plan;
    },
    hit(duration) { aura = []; play('hit', duration); },
    nextTurn(ownerId) { if (ownerId === actorId) { rest = 'idle'; settle(); } },
    skip: settle,
    bind(renderer) { draw = renderer; show(pose); },
    reducedMotion(value) { reduced = value; if (value) settle(); },
    dispose() { clear(); },
  };
}
