// Authoring sampler: frame time and travel are independent of image dimensions.
// Equipment is deliberately not an input until tag-combination choreography exists.
export function defaultFamily(registry, classId) {
  return registry.families[classId] ?? null;
}

export function hitFlashOpacity(action, progress, { reduced = false } = {}) {
  if (reduced || action !== 'hurt' || progress < 0 || progress >= .55) return 0;
  return .72 * (1 - progress / .55);
}

export function durationFor(sequence, speed) {
  if (!speed) return 0;
  const base = sequence.durations.reduce((sum, ms) => sum + ms, 0);
  const contact = sequence.durations.slice(0, sequence.impact).reduce((sum, ms) => sum + ms, 0);
  const scale = Math.min(speed.lungeMs / 260, contact ? speed.impactCapMs / contact : Infinity);
  return base * scale;
}

export function sampleSequence(sequence, elapsed, duration, { reduced = false } = {}) {
  const base = sequence.durations.reduce((sum, ms) => sum + ms, 0);
  if (reduced || duration <= 0) return { index: sequence.hold ? sequence.poses.length-1 : 0, x: 0, progress: 1, finished: true };
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  let index = 0, boundary = sequence.durations[0];
  while (index < sequence.poses.length-1 && progress * base >= boundary) boundary += sequence.durations[++index];
  const start = boundary-sequence.durations[index];
  const phase = (progress * base-start)/sequence.durations[index];
  const x = sequence.travel[index] + ((sequence.travel[index+1] ?? 0)-sequence.travel[index]) * Math.max(0,Math.min(1,phase));
  return {index, x:progress === 1 ? 0 : x, progress, finished:progress === 1};
}
