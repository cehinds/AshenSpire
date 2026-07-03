// src/ui/sfx.js — sound hooks (SPEC §7.4; §11: audio assets are a v1 non-goal)
//
// Every feedback moment calls sfx.play(id). v1 ships NO audio, so play() makes
// no sound — but the hooks already exist at every call site (cardPlay, hit,
// block, bleedBurst, stagger, enemyDeath, heal, stance, relic, flask, shrine,
// buy, victory, youDied). That means an audio layer plugs in with zero call-site
// changes: assign `sfx.sink = (id) => ...` (a WebAudio synth or sample bank).
//
// `recent` is a small ring buffer of the ids fired — it lets tests and QA verify
// the wiring is live without shipping any audio.

export const sfx = {
  sink: null, // future audio layer plugs in here; null = silent (v1)
  recent: [], // last fired hook ids (bounded), for verification
  play(id) {
    this.recent.push(id);
    if (this.recent.length > 32) this.recent.shift();
    if (this.sink) this.sink(id);
  },
};
