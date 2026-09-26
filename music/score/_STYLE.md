# Score style guide (owner feedback 2026-09-26: "way too upbeat — more like Elden Ring, but simple")

The model is the *style* of a sombre open-world soulslike score, never its notes:
no melody, motif, chord progression or title may be copied from any game. Original material only.

What that style means here:
- **Space over motion.** Long held notes, silence between phrases, reverb doing the work.
  A phrase, then air. Never busy, never bouncy, never a groove.
- **Few voices.** 2–4 layers per track. One lead at a time (solo cello, a lone choir voice,
  a single harp line). Pads and drones underneath, quiet.
- **Minor and modal, unresolved.** Aeolian, phrygian, harmonic-minor colour. Slow harmony:
  one chord per 2–4 bars. Suspensions that resolve late or not at all. No major-key brightness
  (victory may lift to a major chord only at its very end, briefly, and sadly).
- **No ostinatos, no arpeggio patterns, no eighth/sixteenth-note figures** in exploration,
  title, shop or rest. Harp = single notes or slow rolled chords, far apart.
- **Tempo:** exploration/title/rest/shop 40–60 BPM with notes on the scale of 2–8 beats.
  Battles are heavy and slow-feeling: combat ~84, elite ~88, boss ~92 BPM, written in
  half-time (weight on beat 1, big sustained string/choir/organ chords changing every bar or two,
  a solo line above). Drums: taiko on 1 (and maybe 3), sparse, low velocity, reverb; no rolls,
  no frame-drum patter, no constant pulse figures.
- **Grandeur through sustain:** choir "ah" chords swelling (long attack), low strings, organ
  pedal, a tolling bell every few bars. Tragic, not heroic.
- **Simple:** a listener should be able to hum the one line in each track.
- Keep levels: per-second RMS roughly -30..-17 dB, no silent gaps longer than ~2 s, first and
  last seconds similar (seamless loop). Loops 50–90 s; victory 30–45 s.

## The lore in the score (owner, 2026-09-26: "make sure it's inspired by the dark lore")

Source: docs/LORE.md (+ LORE-EMBER, LORE-CAST, LORE-WORLD). Three motifs live in
`music/score/_motifs.mjs` — EMBER (the starving fire; organ/strings/bells, never sung),
NAMES (the written dead; the choir, and ONLY the choir, is the names; left unfinished
everywhere but victory), FORSAKEN (the climber whose name was never written; solo cello,
never a voice). Every track quotes at least one, recognisably, in its own key. Each track
carries one idea from the lore it can be heard to be about:

| Track | Lore it carries | How it sounds |
|---|---|---|
| title | The premise: three cold flames, the ash cities, a Forsaken setting out. | FORSAKEN on cello, alone; the choir answers with NAMES, unfinished; EMBER low in the organ once, under everything. |
| map-hollow-weald | The Field Flame kept the seasons; the weald is stuck in "a spring that will not turn". The Bastion's bell "told the weald the hour". | A harmony that tries to turn to the next chord and falls back to where it began; a bell that tolls an hour and stops short of the count. |
| map-pale-marches | The Court Flame kept law and oaths; the river froze the night it died; the Stitched King refuses to leave his throne. | A pedal that never moves (the law that outlived itself); knight-like bare fifths in low strings; NAMES in one frozen choir voice that stops mid-line. |
| map-cinder-reach | The Crown Flame kept the dead and the Ember itself; the Saints' Furnace Chapel wrote names into the fire; the Ember was mined here. | EMBER in the organ pedal, slow; a low choir humming NAMES like a chapel ledger read aloud; far taiko like a mine or a heartbeat. |
| map-drowned-coast | No flame: the Ashen Spire, never lit, built to burn the unwritten; the sea took the terraces. | NO CHOIR at all — nobody here was written. Only strings like tide, the FORSAKEN cello (these are the unwritten's shores), bell-buoys. Emptiness is the point. |
| map-ashen-crown | The causeway to the Spire's summit, laid by the Ember fleeing ahead of you. | EMBER as a slow procession motif in organ and strings, drawing you on; a distant taiko pace; the choir silent until one late NAMES phrase. |
| map | The ring road between the towers; the cold that came after. | FORSAKEN on cello over a bare drone; wind-like metal. |
| shop | The merchant, a Saint who left with a censer: a private hearth in his cart, "Half price. The other half is already burning." | A small bell ticking like a swinging censer; harp and low cello; a barely audible NAMES hum under it, the names he bought, burning. |
| rest | A shrine drinks cinders; the one warm place. | Soft organ and a breathing choir; FORSAKEN once on cello, gently, at rest. |
| combat | The corrupted are citizens still burning, names half-read; some ask you to finish. | Choir chords as the names inside them, swelling and breaking off; taiko as a failing heart; EMBER in the low strings. |
| elite | The orders' champions (Wardens, Knights, Saints), heat held longer. | EMBER harmonised with the tritone; a bell of the order tolling; NAMES in a strained high voice. |
| boss | The climber's own marked person, making the offer: "my hearth-key for the Keeper's name". | FORSAKEN (cello) against EMBER (organ) in alternation, the choir the boss's own name unfinished; grand, tragic, never heroic. |
| victory | Relighting "finishes the reading": mercy, or the same crime again — the game will not say. | NAMES sung once COMPLETE, the only time it resolves; then the brief major chord — warmth bought with names — and a bell. Solemn, uneasy. |
