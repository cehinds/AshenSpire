# Score brief

The brief every track in `music/score/` is composed against: **BASE** applies to
all of them, and each context line adds its own. The score is written as code and
rendered by `tools/score/render.mjs` (see `music/README.md`). These lines began as
prompts for an AI music model; that route was dropped on 2026-09-26, and the words
now brief the composer, which is code.

## BASE (applies to every track)

Instrumental only, no vocals with words. Dark-fantasy orchestral score for "Ashen Spire",
a roguelike card game set in a kingdom after the Burning: the Sovereign Ember, fed on the
names of the dead, took every marked name at once and burned the three cities inward
toward their towers. Ash, embers, cold hearths, a gilded crest on ruined stone.
Palette: low strings, solo cello, choir "ah/oo" pads, harp, bowed metal, distant
bells, taiko/frame drums, church organ drones. Mood: mournful, ancient, fading glory.
Mix: mastered for background under UI sounds, with no sudden loud peaks and no long silence.
Structure: seamless loop that ends on the same chord and tempo it starts on. No fade-out.

The owner's first draft of BASE described "a dying golden tree". The lore
(`docs/LORE.md`) says there never was one: the Goldbough is the kingdom's crest.
This BASE keeps the owner's palette, mood, mix and structure lines word for word and
replaces only the setting sentence.

## Map, per region

The map plays the track for the region it stands in (`map-<region id>`). A region
with no track plays the plain `map` list, then the generated score. All of them are
slow and dark, never bright or dance-like: travel through a ruined land, not an adventure.

| Context | Region lore (docs/LORE.md) | Brief |
|---|---|---|
| map-hollow-weald | Meadows, forest, river valleys. The Field Flame kept harvest and the seasons; "growth without a Field Flame does not stop; it goes wrong." | 56 BPM, D minor. Slow, heavy, overgrown: detuned harp and low cello over a damp organ drone, wordless choir "oo" that sours into dissonance, creaking bowed metal like wood under strain, one distant bell. Oppressive stillness, sickly warmth, no rhythm section. |
| map-pale-marches | Ice tundra and frozen lakes; the Citadel's bridges froze the night the Court Flame died; gilded stone, verdigris, rime. | 52 BPM, B minor. Frozen and hollow: glassy bowed metal and high sul ponticello strings, sparse harp harmonics like ice cracking, a thin choir "ah" far away, low string pedal. Cold, silent law; no drums. |
| map-cinder-reach | Volcanic ridges and lava rivers; the Ember was mined here; "it did not burn in the Burning: it was already burning". | 60 BPM, C phrygian. Smouldering, subterranean: slow taiko heartbeat very far back, deep organ pedal, grinding low strings, bowed-metal shimmer like heat haze, low male choir hum. Menacing and patient. |
| map-drowned-coast | Salt causeways, a grave of ships; the Ashen Spire stands here, the fourth tower, never lit. | 50 BPM, F minor. Desolate tide: slow swelling low strings like waves, bell-buoy tolls in the fog, solo cello lament, wordless choir "oo" drifting in and out, wind-like bowed metal. Empty, vast, grieving. |
| map-ashen-crown | The causeway to the Spire's summit, laid by the Ember; reached from any seat, belonging to none. | 54 BPM, G minor. A slow procession toward something terrible: measured frame drum, organ chords, full wordless choir "ah" rising and falling, solo cello over low brass-like strings, tolling bells. Solemn dread, never triumphant. |
| map | Fallback for any region without its own track. | 56 BPM, E minor. Slow, bleak wandering through ash: low strings, solo cello, faint choir "oo", distant bells, bowed metal. No drums, never bright. |

## Other contexts

| Context | Brief |
|---|---|
| title | Main theme, 70 BPM, D minor. Solo cello states a slow, noble melody over an organ drone and choir "oo" pads; harp arpeggios answer; distant bells mark phrases. Gentle swell mid-loop, returns to the opening chord. |
| combat | Battle loop, 110 BPM, C minor/phrygian. Driving taiko and frame drums, low string ostinato, cello counter-line, choir pads, bowed-metal accents. Tense, steady energy. |
| elite | Elite battle, 120 BPM, A minor. Heavier taiko, staccato low brass-like strings, dissonant bowed metal, urgent choir. Aggressive but controlled, no peaks. |
| boss | Boss battle, 126 BPM, G minor. Full choir "ah" chant, pounding taiko, organ pedal, racing string ostinato, tolling bells. Epic, doom-laden, sustained high intensity without sudden hits. |
| shop | Merchant theme, 76 BPM, F major pentatonic tinged minor. Warm harp and plucked strings, soft cello, faint bells, light frame drum. Cozy, curious, slightly uneasy. |
| rest | Shrine of grace, 60 BPM, D major/dorian. Solo cello and harp over soft organ drone and choir "oo". Serene, reverent, healing, very low energy. |
| victory | Run cleared, 84 BPM, C major modal, **about 60 seconds**. Rising choir "ah", organ and strings in a solemn triumphant hymn, bells ringing; bittersweet, golden, restrained.  |
