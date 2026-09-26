// tools/score/alt.mjs — the "alt" cut of a score (owner, 2026-09-26: "alt
// versions with a bit more precision, emphasize the current background heart
// beat, make the cello sound less synthetic and more like a bass").
//
// A pure transform of a rendered score's JSON, so every score gets its alt
// without a second source file:
//   • cello → double bass (`bass`); anything from C3 up drops an octave into
//     the bass's own register.
//   • precision: about half the reverb send, a shorter room, a little less
//     drone under the melody, a slightly firmer melody, quicker entries.
//   • heartbeat: battle beds' game thump becomes a louder two-beat heart;
//     every other bed gets a softer heart on each in-game note, at the
//     game's thump pitch (the drone root).

const TIGHT = new Set(['strings', 'choir', 'organ']);

export function altScore(score) {
  const beat = 60 / score.bpm;
  const drone = score.events.find((e) => e.inst === 'gamedrone');
  const heartMidi = drone ? drone.midi : 38;
  const thumps = score.events.filter((e) => e.inst === 'gamethump');
  const events = [];
  for (const e0 of score.events) {
    const e = { ...e0, rev: (e0.rev ?? 0.35) * 0.5 };
    if (e.inst === 'cello') {
      e.inst = 'bass';
      if (e.midi >= 48) e.midi -= 12;
    } else if (e.inst === 'gamedrone') e.vel = (e.vel ?? 0.7) * 0.75;
    else if (e.inst === 'gamenote') e.vel = (e.vel ?? 0.7) * 1.1;
    else if (TIGHT.has(e.inst)) e.a = (e.a ?? 1) * 0.6;
    if (e.inst === 'gamethump') {
      const gap = Math.min(0.24, (e.beats ?? 1) * beat * 0.45);
      events.push({ ...e, inst: 'heart', vel: (e.vel ?? 0.7) * 1.3, gap, rev: 0.08 });
      continue;
    }
    events.push(e);
  }
  if (!thumps.length) {
    const beats = [...new Set(score.events.filter((e) => e.inst === 'gamenote' && e.wave !== 'sine').map((e) => e.beat))];
    for (const b of beats) events.push({ inst: 'heart', beat: b, beats: 1, midi: heartMidi, vel: 0.6, pan: 0, rev: 0.08, gap: 0.26 });
  }
  const rv = score.reverb ?? {};
  return { ...score, events, reverb: { ...rv, room: Math.max(0.6, (rv.room ?? 0.86) - 0.08) } };
}
