// src/ui/sfx.js — sound hooks (SPEC §7.4)
//
// Every feedback moment calls sfx.play(id), and the sink is live: main.js
// assigns `sfx.sink = (id) => audio.sfx(id)`, so these ids DO make sound —
// the synth recipes are content in src/content/sfx.js. (This header used to
// say "v1 ships NO audio, so play() makes no sound" and listed `bleedBurst`,
// an id nothing has fired since #65; both were false at #66 and are corrected
// here rather than left as a third copy of the same lie Sunna found on the
// settings screen.)
//
// An id may be COMPOSED from data — ui/fx.js plays `procBurst_${status}` —
// and content/sfx.js resolves it exact-row → family-row → default. So a call
// site may name a sound the table has not authored yet: it will sound like
// its family, and the engine warns by name once (ui/audio.js synthSfx).
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
