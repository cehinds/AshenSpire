# Music generation prompts

Each track prompt = **BASE** + the context line. Generated with ElevenLabs Music
(`eleven_music_v2`); drop chosen renders into `music/<context>/` and list them in
`manifest.json`.

## BASE (prepend to every track)

Instrumental only, no vocals with words. Dark-fantasy orchestral score for "Ashen Spire",
a roguelike card game about a dying golden tree, embers, ash and a cursed tower.
Palette: low strings, solo cello, choir "ah/oo" pads, harp, bowed metal, distant
bells, taiko/frame drums, church organ drones. Mood: mournful, ancient, fading glory.
Mix: mastered for background under UI sounds — no sudden loud peaks, no long silence.
Structure: seamless loop, ends on the same chord/tempo it starts on. No fade-out.

## Per context

| Context | Prompt |
|---|---|
| title | Main theme, 70 BPM, D minor. Solo cello states a slow, noble melody over organ drone and choir "oo" pads; harp arpeggios answer; distant bells mark phrases. Gentle swell mid-loop, returns to the opening chord. |
| map | Travel ambience, 80 BPM, E minor/dorian. Sparse harp and pizzicato low strings walking, soft choir "ah" pads, bowed-metal shimmer. Calm, wandering, steady energy throughout. |
| combat | Battle loop, 110 BPM, C minor/phrygian. Driving taiko and frame drums, low string ostinato, cello counter-line, choir pads, bowed-metal accents. Tense, steady energy. |
| elite | Elite battle, 120 BPM, A minor. Heavier taiko, staccato low brass-like strings, dissonant bowed metal, urgent choir. Aggressive but controlled, no peaks. |
| boss | Boss battle, 126 BPM, G minor. Full choir "ah" chant, pounding taiko, organ pedal, racing string ostinato, tolling bells. Epic, doom-laden, sustained high intensity without sudden hits. |
| shop | Merchant theme, 76 BPM, F major pentatonic tinged minor. Warm harp and plucked strings, soft cello, faint bells, light frame drum. Cozy, curious, slightly uneasy. |
| rest | Shrine of grace, 60 BPM, D major/dorian. Solo cello and harp over soft organ drone and choir "oo". Serene, reverent, healing, very low energy. |
| victory | Run cleared, 84 BPM, C major modal. Rising choir "ah", organ and strings in a solemn triumphant hymn, bells ringing; bittersweet, golden, restrained. |
