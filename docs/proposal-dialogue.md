# Parley — dialogue and choices on the combat stage

*Design proposal, not a change. Follows [LORE.md](LORE.md) §7 (voices, one line of
world) and the seat plan's wayfarer, city, companion and consequence rules
([proposal-seat-adventure.md](proposal-seat-adventure.md)). Owner's brief,
2026-09-11: "the combat view without the cards, the card section replaced with
dialogue, name : line, typed out with a sound like old Nintendo games, a
Continue, short steps, the one not talking dimmed, smaller, out of focus, and
lifted when it is their turn."*

## 1. What is being asked for

A **parley screen**: one presentation surface for every moment where someone
speaks and the player answers. It replaces the event modal's art-well and prose
for anything with a face in it, and it is the surface wayfarers, the city's
sites, companions, quest givers, boss antechambers and the ending all talk
through. Three claims:

1. **It is the combat stage.** Same backdrop, same field, same foot line, same
   HUD. The hand tray becomes the dialogue tray. A player who knows where the
   fight happens knows where the talk happens.
2. **The portrait layer is the actor.** Faces stand on the field where fighters
   stand. Focus is a lift: the speaker steps forward, lit and full size; the
   listener stays, dimmed, softened and a step back.
3. **Text is short and typed.** Name, colon, one or two lines, typed with a
   per-character blip, a Continue. Never a paragraph. Never a wall.

## 2. What games usually do (research)

| Convention | Seen in | What we take |
|---|---|---|
| Bottom text box, name plate, typewriter reveal, a blinking "advance" glyph | visual novels (Ren'Py defaults), RPG Maker, Ace Attorney | the tray, the name plate, the glyph |
| Portraits over a background, active speaker undimmed, listener tinted darker | Fire Emblem support conversations, 001 Game Creator's Speaker/Listener tint | the lift/dim rule, stated as data |
| One synth note per printed character, one note per character *voice* | Undertale (one looped tone per character), Banjo-Kazooie | a `voice_<id>` sfx family per speaker; the family fallback keeps unknown speakers audible |
| Per-letter recorded syllables ("animalese") | Animal Crossing | not for us: too much audio; a single tone with pitch per speaker does the job |
| Tap to finish the line, tap again to advance; hold to skip; Auto mode; a backlog | every modern VN; Game Accessibility Guidelines (adjustable text speed, skippable, re-readable) | all four, as settings and inputs, day one |
| Key words tinted or pulsed inside the line | VN text styling | one emphasis style only, for the vocabulary words in LORE §8 |
| Choices as a short vertical list, the bound ones confirmed | Disco Elysium's list, Fire Emblem's two-option prompts; the game's own event door and hold-confirm | reuse `optionCard` and `beatArmer`; no new choice widget |
| Emotion via portrait swap, not new art per line | Fire Emblem, Persona | one portrait, three states (neutral / speaking / struck), from existing pose art |

Sources: Ren'Py and RPG Maker forum threads on dialogue blips; the RPG Maker
"Undertale/Animal Crossing text sounds" thread; 001 Game Creator's visual novel
kit (Speaker/Listener tinting); Game Developer's "Accessibility in Dialogue";
gameuidatabase.com entries for Fire Emblem Fates and Three Houses.

## 3. The screen

Landscape, the default. The combat shell with the hand tray swapped:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◈ Reaver · Lv 3     [HP 41/48] [Cinders 27]   Act 1 · Floor 4 · #A7 │  ← run HUD, unchanged
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│        (backdrop: Lanternwood Crossing — the combat painting)        │
│                                                                      │
│                                        ░░░░░░░░                      │
│      ▓▓▓▓▓▓▓▓▓▓                        ░░░░░░░░   ← listener:        │
│      ▓▓▓▓▓▓▓▓▓▓  ← speaker:            ░░░░░░░░     90% size, dim,   │
│      ▓▓▓▓▓▓▓▓▓▓    full size, lit,     ░░░░░░░░     soft, a step     │
│      ▓▓▓▓▓▓▓▓▓▓    a step forward      ░░░░░░░░     back             │
│  ────▓▓▓▓▓▓▓▓▓▓──────────────────────░░░░░░░░────── foot line ──────│
├──────────────────────────────────────────────────────────────────────┤
│ ┌ WAYWARD PILGRIM ─────────────────────────────────────────────────┐ │
│ │ "The bell rang last night. Nobody rang it."█                     │ │  ← typed, blip per char
│ └──────────────────────────────────────────────── ▼ Continue ──────┘ │
│  [Log]                                                    [Skip ▶▶] │
└──────────────────────────────────────────────────────────────────────┘
```

The same beat, one step later, the player answering:

```
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│      ░░░░░░░░                          ▓▓▓▓▓▓▓▓▓▓                    │
│      ░░░░░░░░   ← pilgrim drops back   ▓▓▓▓▓▓▓▓▓▓  ← Reaver lifts    │
│      ░░░░░░░░                          ▓▓▓▓▓▓▓▓▓▓                    │
│  ────░░░░░░░░──────────────────────────▓▓▓▓▓▓▓▓▓▓─── foot line ──────│
├──────────────────────────────────────────────────────────────────────┤
│ ┌ REAVER ──────────────────────────────────────────────────────────┐ │
│ │ "Then who is ringing it now?"                                    │ │
│ └──────────────────────────────────────────────── ▼ Continue ──────┘ │
```

A choice. The tray grows upward; the stage does not move:

```
├──────────────────────────────────────────────────────────────────────┤
│  ────░░░░░░░░──────────────────────────▓▓▓▓▓▓▓▓▓▓─── foot line ──────│
├──────────────────────────────────────────────────────────────────────┤
│ ┌ WAYWARD PILGRIM ─────────────────────────────────────────────────┐ │
│ │ "Come and see. Or don't. The road forks here."                    │ │
│ ├──────────────────────────────────────────────────────────────────┤ │
│ │  ▸ Go with him.            (a quest: The Cracked Bell)            │ │
│ │  ▸ Ask what it costs.                                             │ │
│ │  ▸ Leave.                                                          │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│  [Log]                                                               │
```

A binding choice (one that writes a consequence) uses the hold-confirm the
event door already uses:

```
│ │  ▸ Give him the Sacrificial Knife.   [ hold ▓▓▓▓▓▓░░░░ ]  ⚠ binding │
```

A narrator beat (no face): the tray carries no name plate and both portraits
drop back.

```
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ Cinder-light seeps between the blades like frost.                │ │
│ └──────────────────────────────────────────────── ▼ Continue ──────┘ │
```

Portrait phone (the combat shell's narrow layout):

```
┌──────────────────────┐
│ ◈ Reaver  HP 41  ◉27 │
├──────────────────────┤
│                      │
│   (backdrop, cropped)│
│                      │
│  ░░░░░      ▓▓▓▓▓▓   │
│  ░░░░░      ▓▓▓▓▓▓   │
│  ░░░░░      ▓▓▓▓▓▓   │
│ ─░░░░░──────▓▓▓▓▓▓── │
├──────────────────────┤
│ REAVER               │
│ "Then who is ringing │
│  it now?"            │
│           ▼ Continue │
│ [Log]       [Skip ▶▶]│
└──────────────────────┘
```

## 4. Rules

### Stage and portraits

- **Positions are the combat positions.** Player side left, others right, feet
  on the combat foot line (`groundAnchor`). Up to three faces: player, one or two
  others. A companion stands beside the player, half a step back.
- **Focus is one state on one actor.** `focus: 'speaker'` gives: full size, full
  brightness, no blur, one step forward (translate up-stage ~4% of field height),
  raised z. Everyone else: 90% size, brightness 0.7, a 1.5px blur, one step back.
  The swap is one 180 ms ease; reduced motion swaps instantly. Values are data.
- **Portrait = existing pose art.** The idle pose sprite, cropped to a bust in
  CSS, is the neutral portrait; the class portrait WebPs already exist for the
  player. Three states per actor: `idle`, `speaking` (a subtle 2–3 frame mouth or
  breath loop if the sprite sheet has one, else the same frame), `struck` (the
  hit pose, for a line that lands). No new art is required to ship; new art can
  replace it per actor later.
- **Narration has no face**; both drop back and the plate is empty.

### Tray and text

- **Name plate above the line**, small caps, the actor's accent colour (class tint
  for the player, seat tint for locals).
- **One beat is one to two lines**, at most ~90 characters at the reference
  width. `validateContent` refuses longer beats; a wordy thought becomes two
  beats. Rule of thumb from LORE §7: name a thing you could pick up.
- **Typed at a per-setting rate** (default 40 chars/s). Tap, click, Space or A
  finishes the line instantly; a second tap advances. Continue is also a button
  for pointer and switch users.
- **Blips**: one sfx family per speaker, `voice_<actorId>`, resolved by the
  existing exact → family → default ladder, so an unvoiced actor still blips. One
  synth note per 2 printed characters, pitch per actor, silent on spaces and
  punctuation, a longer pause on `.` `—` `…`. Music volume ducks 20% while typing.
- **Emphasis**: `*word*` in the source renders in the accent colour, no bold, no
  size change. Reserved for LORE §8 vocabulary and proper names.
- **Hold to skip** runs the rest of the scene at instant speed, stopping at any
  choice. **Auto** advances after `text length / rate + 900 ms`. **Log** opens
  the backlog of the current scene, plain text, scrollable, screen-reader
  friendly.
- **Accessibility**: the tray is `aria-live="polite"` and announces the whole
  line at once (never the typed fragments); text zoom applies; reduced motion
  disables the typewriter (whole line at once) and the lift animation; Reduce
  flashes has nothing to suppress here.

### Choices

- **Reuse the event door's parts**: `decide`, `options`, `optionCard`, and
  `beatArmer` for binding choices. The list sits inside the tray, above the
  speaker's last line so the question stays visible.
- **Two to four options**, one line each, with an optional trailing note in
  parentheses (what it starts, costs, or is: *a quest*, *3 cinders*, *binding*).
  Leave/decline is always last and never gated (the event system's own rule).
- **Gating and consequences are the existing sidecars**: choice requirements
  read run history; effects use the existing event ops (`addCinders`,
  `addRelic`, `startCombat`, …) plus the seat plan's new ones (`acceptQuest`,
  `recruit`, `trust`). A gated option that is hidden stays hidden; one that is
  shown but disabled says why in its note.
- **The player's reply is a beat.** After a choice, the Reaver says the chosen
  line (or a short authored variant) before the scene continues, so the choice
  is heard, not just clicked.

## 5. Data

```js
// content/parleys.js — one scene
{
  id: 'wayfarer.crackedBell',
  stage: { backdrop: 'auto' },            // 'auto' = the node's combat scene
  actors: [
    { id: 'player' },                     // the run's class, its portrait
    { id: 'waywardPilgrim', side: 'right', voice: 'voice_pilgrim', accent: 'seat' },
  ],
  beats: [
    { speaker: 'waywardPilgrim', text: 'The bell rang last night. Nobody rang it.' },
    { speaker: 'player',         text: 'Then who is ringing it now?' },
    { speaker: 'waywardPilgrim', text: 'Come and see. Or don’t. The road forks here.',
      choices: [
        { id: 'go',   text: 'Go with him.',        note: 'a quest: The Cracked Bell',
          effects: [{ op: 'acceptQuest', questId: 'crackedBell' }], reply: 'Lead, then.' },
        { id: 'cost', text: 'Ask what it costs.',  goto: 'cost' },
        { id: 'leave',text: 'Leave.',              effects: [] },
      ] },
    { id: 'cost', speaker: 'waywardPilgrim', text: 'Nothing you have. Everything you were promised.',
      choices: [ /* … */ ] },
  ],
}
```

- Beats are a list with optional `id`s and `goto`s: enough for branches and
  loops without a graph editor. `validateContent` checks every `goto` resolves,
  every speaker is an actor, every beat is under the length cap, and every
  choice list ends in an ungated option.
- A `parley` field on an event, a city site, a companion moment or a boss
  antechamber points at a scene. The event door stays for faceless events.
- The player's `struck` and `speaking` states, and each NPC's, are pose ids in
  `content/poseSprites.js`; missing states fall back to `idle`.

## 6. Suggestions beyond the brief

1. **Let the stage react.** A line with `fx: 'shake'` or `fx: 'flash'` reuses the
   combat fx layer (bounded by the same Reduced motion / Reduce flashes rules).
   A boss's antechamber line can land like a hit.
2. **Interjections.** A beat with `interrupt: true` types over the previous line
   before it finishes; the companion cutting in is characterisation for free.
3. **Silence is a beat.** `{ speaker: 'waywardPilgrim', text: '…' }` with a long
   pause and no blip. Old Nintendo games used it constantly.
4. **The lorekeeper reads in this screen**, one page a beat, in its voice, so
   the city's lore is a conversation, not a scroll.
5. **The ending is a parley.** The last antechamber's wayfarer tells the player
   what they fed the fires (seat plan §6) in this exact frame.
6. **Co-op**: each seat's player portrait stands on the left; the host's choice
   is the party's, the others see the vote as in the fork vote today.

## 7. Implementation sketch (one phase, medium)

| Change | Where |
|---|---|
| `content/parleys.js`, schema and validate (length cap, goto resolution, actor check, ungated last option) | `model/schemas.js`, `model/validate.js` |
| `ui/screens/parley.js`: mounts the combat shell (`.combat` with `data-mode="parley"`), backdrop and field from `environmentArt`, portraits as `.combatant` elements with `data-focus`, tray replaces `.hand-area` | new; `styles/combat.css` gains the `[data-mode="parley"]` rules |
| Typewriter and blips: `ui/typewriter.js` (rate, pause map, reduced motion), `voice_*` sfx family rows in `content/sfx.js` | new + content |
| Settings: Text speed (slow / normal / fast / instant), Auto-advance, Dialogue blips volume | `ui/screens/settings.js` |
| Choices: reuse `decide`/`options`/`optionCard`/`beatArmer`; effects through `executeRunEffects` | `ui/screens/event.js` parts extracted to `ui/components/choiceList.js` |
| Log: a scene-scoped backlog panel | `ui/components/parleyLog.js` |
| Event, city site, companion, antechamber rows gain `parley: sceneId` | content |
| Tests: beat cap, goto resolution, focus state per beat, typewriter finishes on tap, reduced motion prints whole line, aria-live announces once, ungated last option, phone layout keeps the foot line | new `tests/parley.test.mjs`; `tools/release-shots.mjs` gains the `parley` state |
