// Preview and combat share the same timing, movement and hit-flash sampler.
export { durationFor, sampleSequence, hitFlashOpacity } from '../../src/model/alternativeCardAnimation.js';

// Historical base studies remain equipment-independent.
export function defaultFamily(registry, classId) {
  return registry.families[classId] ?? null;
}
