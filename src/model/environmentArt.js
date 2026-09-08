import { ENVIRONMENTS } from '../content/environments.js';

// Decorative choices never consume the engine's RNG or add save fields.
function hash(text) {
  let value = 2166136261;
  for (const char of String(text ?? '')) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

export function regionForRun({ seedString = '', actNumber = 1 } = {}) {
  const act = Math.max(1, Math.trunc(Number(actNumber) || 1));
  return ENVIRONMENTS[(hash(seedString) % ENVIRONMENTS.length + (act - 1) % ENVIRONMENTS.length) % ENVIRONMENTS.length];
}

export function combatEnvironment(run = {}) {
  const region = regionForRun(run);
  const floor = Math.max(0, Math.trunc(Number(run.floor) || 0));
  const index = (hash(`${run.seedString ?? ''}:scenery`) + floor) % region.scenes.length;
  return { region, scene: region.scenes[index] };
}
