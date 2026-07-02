# Spire of the Erdtree — Game Design Document

This document explains the **design intent**: why the game is shaped the way it is, what the player should feel, and how the visuals support that. Exact rules, formulas, schemas, and content tables live in [SPEC.md](../SPEC.md) — where both documents state a number, the spec wins.

Visual companions (all original art, palette-accurate):

| Mockup | File |
|---|---|
| Combat screen (annotated) | [mockups/combat-screen.svg](mockups/combat-screen.svg) |
| Act map screen | [mockups/map-screen.svg](mockups/map-screen.svg) |
| Card anatomy + rarities + upgrade | [mockups/card-anatomy.svg](mockups/card-anatomy.svg) |
| Class & boss concept art | [mockups/concept-classes.svg](mockups/concept-classes.svg) |
| Sprite & icon style guide | [mockups/sprite-style-guide.svg](mockups/sprite-style-guide.svg) |

---

## 1. Vision

**One line:** *Slay the Spire's decision density wearing Elden Ring's mood — every death legible, every run a pilgrimage.*

### Pillars

1. **Honest combat.** The player can always compute what will happen before it happens: intents show exact damage, card previews use the engine's real math, meters are visible. Difficulty comes from hard choices, never hidden information. (This is StS's soul; we do not compromise it.)
2. **Build-up, not spam.** The Elden Ring layer is about *pressure over time*: Bleed accumulates toward a burst, Poise accumulates toward a Stagger, Rot is a timed sentence. Where StS statuses tick *down*, ours charge *up* — turns spent feeding a meter should feel like winding a crossbow.
3. **Death is the teacher.** "YOU DIED" is a stat sheet and a seed, not a punishment. Runs are reproducible; the player's correct response to death is "now I know," and the game must make sure there is always something to know.
4. **Quiet grandeur.** Gold on near-black, serif restraint, one accent color per entity. No screen clutter, no juice for juice's sake — a Stagger is loud precisely because everything else is quiet.

### Player fantasy

A lone Tarnished ascends a spire built from the wreckage of a shattered kingdom, growing from ten shabby cards into an engine of gold and blood. Power is earned at shrines and paid for in HP, runes, and cursed cards.

### Audience & scope

Players who know deckbuilders (we do not tutorialize energy or block — a 4-callout overlay is the entire onboarding) and Souls players curious about tactics games (status names and mood do the inviting). Solo-dev scale: ~45–90 min runs, 3 acts, 3 classes, zero backend.

---

## 2. World & narrative framing

Narrative is **ambient, not delivered**: flavor text on cards/events/bosses, no cutscenes, no dialogue trees. The story is an excuse for the climb and a skin for the mechanics — but a consistent one.

- **The premise:** The Erdtree burned; its light collapsed inward and crystallized into a spire. Grace now flows *upward*. The Tarnished climbs to restore (or claim) the Great Rune at its crown.
- **Act I — The Fallow Marches.** The kingdom's overgrown foothills. Enemies: broken soldiery, rot-touched beasts, grave-wisps. Palette: umber + faint gold. Boss: **The Watchful Omen**, a gatekeeper who *waits* — his delayed attacks are the act's exam on intent-reading.
- **Act II — The Grafted Court.** The mid-spire palace, a court that stitched itself together to survive. Enemies: grafted amalgams, gilded knights, court surgeons. Palette: tarnished gold + verdigris. Boss: **The Grafted King** — phase 2 literally adds limbs (new attack pattern at 50% HP).
- **Act III — The Ashen Crown.** The burnt canopy. Enemies: ash revenants, scarlet-rotted valkyries, grace-starved pilgrims. Palette: bone white + ember. Final boss: **The Rot Valkyrie** — heals from landing hits on you and inflicts Bleed on the *player*, turning your own favorite mechanic against you.
- **Shrines of Grace** are the only calm: gold light, a sit, a choice (heal or smith). The merchant is a wanderer who has climbed further than you and won't say why he came back down.

Names above are final for v1 (original, no FromSoftware proper nouns — see SPEC §2).

---

## 3. Game loops

**Moment (5–30 s):** read intents → compute lethal/safe lines → spend 3 energy → end turn. The core question every turn: *feed a meter (Bleed/Poise) or answer the immediate threat (damage/block)?*

**Combat (2–5 min):** open with intent triage (kill order: Grave Wisp before Demi-Brute), middle game of meter investment, close with a burst/Stagger payoff. Target: average fight 4–7 turns; a fight that can't threaten at least ~15% of the player's HP shouldn't exist (it's a tax, not a fight).

**Run (45–90 min):** path-planning on the map is the strategic layer — elites are the risk/reward spine (relic vs. HP), shrines are the pacing valve (heal vs. upgrade), the deck is the long-term bet. The player should be able to articulate "my deck's plan" by floor 8 of Act I.

**Meta (between runs):** seed + run history + "now I know." No unlocks in v1 (SPEC §11) — the replay driver is class identity and mastery, so the three classes must play *differently*, not just read differently.

---

## 4. Combat design

### 4.1 The decision texture

StS's turn is a knapsack problem (3 energy, 5 cards, imperfect fit). We keep that and add **two time-shifted axes**:

- **Bleed** trades present damage for a future burst. Its escalating threshold (12 → 18 → 27…) makes it *front-loaded* — the first burst is cheap, an all-in Bleed deck needs Lord's Blood (rare Power) to keep scaling. This prevents the degenerate "Bleed always wins long fights" line.
- **Poise** trades damage-now for *tempo* — a Stagger is a skipped enemy turn plus a +50% window, worth roughly one full player turn. `poiseMax` growth (×1.25) makes each successive Stagger a bigger investment, so Stagger-lock is a diminishing (but never dead) strategy.

Design rule of thumb for costing: at 1 energy, ~6 damage or ~5 block or ~3 Bleed or ~4 Poise or ~1.3 cards drawn are par; commons sit at par with a condition, uncommons above par with a build requirement, rares change the rules (Unbreakable, Lord's Blood).

### 4.2 Why intents must include the math

An intent that says "Attack 7" when Vulnerable would make it 10 is a lie of omission. Intents recompute live (SPEC §4.6) — this is non-negotiable because pillar 1 collapses without it, and it's what makes the Watchful Omen's *Delayed* mechanic fair: the one thing he hides is *when*, never *how much*.

### 4.3 Class identities (design contracts)

- **Vagabond — the weapon-arts duelist.** Stance dancing (Bloodflame = offense engine, Bulwark = defense engine) with Bleed and Poise as his two payoff meters. Skill expression: knowing when to *switch* stances mid-turn (Warrior's Vow, Enter cards drawing/blocking on entry). Weakness: little card draw, no AoE outside Crimson Cleave — swarms pressure him.
- **Astrologer — the combo caster.** "Glintstone": the 2nd+ spell each turn is empowered — her whole deck is sequencing. Powers that scale per-turn make her the late-game ramp class. Weakness: terrible early block; elites before floor 10 are her nightmare, path planning matters most for her.
- **Prophet — the blood economist.** Pays HP for effects, heals it back through Rot synergies and overheal-to-block (Gold Figurine). The class for players who like walking the lethal edge. Weakness: HP is one resource pool — mistakes compound; Madness (enemy-inflicted) hits him hardest.

Every card pool must keep at least two viable archetypes per class (Vagabond: Bleed-burst vs. Bulwark-fortress; designed in content, verified in the M3 balance pass).

### 4.4 Enemy design philosophy

- Every basic enemy teaches one verb: Wandering Soldier = trade math, Rot Hound = multi-hit vs. block, Grave Wisp = kill-order, Demi-Brute = when to go tall vs. wide.
- **Elites are exams** on the act's curriculum with a relic diploma. Crucible Aspirant's turn-1 Consecrate (+3 Strength) is a DPS check: answer with burst, Weak, or Stagger — three valid answers, no single required card.
- **Bosses are theses.** One signature mechanic each, readable in silhouette (see [concept sheet](mockups/concept-classes.svg): the Omen's held blade *is* his Delayed intent). Phase 2s change the pattern, never the rules.
- Nothing an enemy does uses a mechanic the player can't also access or counter. The final boss healing off hits *on you* is the sole inversion — earned by two acts of the player doing it to enemies.

### 4.5 A worked turn (tuning reference)

> Vagabond, turn 3 vs. Wandering Soldier (24 HP, intent Attack 7, Bleed meter 8/12) + Rot Hound (7 HP, intent 3×2). Hand: Strike, Serrated Blade, Quickstep, Enter: Bulwark, Shield Bash. Energy 3, player 62/78, Block 0.
>
> Line A (greedy): Serrated Blade + Strike into the Soldier = 7 (+3 Bleed → 11/12) + 6, Soldier at 11, Quickstep for 6 block. Take (7−6) + 6 = 7. Bleed bursts next turn on any application.
> Line B (tempo): Shield Bash the Hound (5, kills at 7? no — 2 left), Strike kills, Quickstep blocks 6 of the Soldier's 7. Take 1, but zero Bleed progress.
>
> Neither line dominates — that's the texture every 3-energy turn should have. If playtesting finds one-line turns, the encounter (not the engine) gets retuned.

### 4.6 Difficulty curve

Act I teaches (win rate target for experienced deckbuilder players ~70% through Act I), Act II filters (deck must have a *plan*), Act III judges (plan must be *tuned*). Full-run target 35–50% (SPEC §9 M3). HP is the run's true currency; encounters are priced in expected HP loss: basic 6–12%, elite 15–25%, boss 25–35% of max HP for an on-curve deck.

---

## 5. Economy & progression

- **Runes** (SPEC §6 for values): a run earns ~450–700 runes; a shop visit should always present one *painful* choice (can't afford removal + the relic). Card removal cost escalates (+25/purchase) because thin decks compound.
- **Card rewards** are the run's heartbeat: ~14–18 offered per run, ~8–10 taken by a good player. Skipping rewards must be visibly allowed (a "Skip" button, not a hidden click-away) — deck discipline is a skill we teach by affordance.
- **Flasks** are the panic button and the greed enabler; the decaying drop chance (SPEC §5.5) keeps them scarce enough to hoard-then-regret, StS-style.
- **Relics** bend the run's shape (Dragon Heart trades rest-healing for energy — a whole different run). Boss relics are always a Faustian trade; commons are quietly additive.
- **Upgrades**: a shrine smith is worth roughly 1.5 card rewards; rest-vs-smith is the game's cleanest recurring dilemma and must never be automated away.

---

## 6. UI / UX design

Reference mockups: [combat](mockups/combat-screen.svg) · [map](mockups/map-screen.svg) · [card](mockups/card-anatomy.svg). Layout regions and behaviors are specified in SPEC §7; below is the *intent* behind them.

- **The combat screen is a ledger.** Left = you, right = them, bottom = your options, top = your account (HP, runes, flasks, relics). Every number on it is live engine output — the hovered card in the mockup shows its post-modifier damage, struck-through when debuffed.
- **Meters stack under HP in fixed order** (HP → Poise amber → Bleed red) so the eye learns one scan line per enemy. Bleed's bar only appears when non-zero: absence of clutter is information.
- **Intents are the biggest UI element on any enemy** — bigger than the name. Reading them *is* the game.
- **The map is a plan, not a maze** ([mockup](mockups/map-screen.svg)): full act visible, traveled path in gold, reachable nodes rim-lit parchment, everything else recedes to umber. The legend is always on screen — memorizing iconography is not a skill we test.
- **Cards are documents** ([anatomy](mockups/card-anatomy.svg)): cost, name, art, type, templated text with highlighted keywords (nested tooltips), rarity frame. Upgraded cards show green name + green changed numbers — diff-style, because players think in diffs.
- **Feedback hierarchy:** normal hits are small floating numbers; Bleed bursts and Staggers get the loud treatment (banner/spray, still ≤300 ms). The player's eye should be *pulled* exactly when a meter pays off — that's the reward moment the whole design feeds.
- **Accessibility floor (v1):** never color-only (icons + text accompany every color code), tooltips on literally everything interactive within 150 ms, all type ≥ 11 px at 1280×720, animations skippable by click, no flashing above 3 Hz.

---

## 7. Art direction

Reference: [concept sheet](mockups/concept-classes.svg) · [sprite style guide](mockups/sprite-style-guide.svg).

- **Style: silhouette-first vector.** Dark mass (#1a–#2e range), exactly **one signature accent color** per entity (Vagabond ember, Astrologer glintstone blue, Prophet rot orange + broken-gold halo, Omen red + gold eye), gold rim-light for anything friendly or sacred. This style is *achievable by a developer*, reads at 70 px tall, and — critically — every asset can later be swapped for licensed art through `assets.js` without touching layout or code.
- **Shape language carries faction:** player classes = clean closed shapes; the broken kingdom = heavy triangles and squares; rot = ragged edges and organic curves; grace = circles and halos. A player should sort friend/threat/blessing preattentively.
- **Sprite sizes and the placeholder recipe** are in the [style guide](mockups/sprite-style-guide.svg): small 70×100 (hounds, wisps), medium 100×130 (soldiers), large 150×160+ (elites, bosses), portrait 96×96. Placeholder = tinted rounded rect + entity glyph + name; the game must be fully playable and *coherent-looking* with placeholders only.
- **Icon sourcing:** game-icons.net (CC BY 3.0) recolored to palette — one glyph per card/relic/status, chosen for silhouette clarity at 20 px (statuses) and 96 px (card art). Kenney CC0 nine-slices for panels/buttons. Every asset logged in [CREDITS.md](../CREDITS.md).
- **Palette** (8 CSS variables, swatched in the style guide): near-black bg, parchment text, Erdtree gold, blood, rot, frost, grace blue, ember. Rule: gold is *earned* — it marks grace, rarity, and Stagger, and is never used decoratively elsewhere.
- **Type:** Cinzel for titles/card names (stone-carved serif), Inter for body/tooltips. Mockups use Georgia/Verdana as stand-ins.

---

## 8. Audio direction (hooks only in v1)

`sfx.js` ships as a silent stub with hooks at: card play (per type), hit, block, Bleed burst, Stagger, enemy death, "YOU DIED", shrine, map node. Direction for later: dry, close, percussive foley (cloth, steel, stone) over near-silence; one low bell for Stagger; no combat music in v1 — ambience beds per act. Silence is the Elden Ring-est sound we have.

---

## 9. Content scope ↔ milestones

| | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| Classes | Vagabond | — | +Astrologer, +Prophet | — |
| Cards | 24 + 4 status/curse | — | ~150 total | — |
| Enemies | 4 + elite + boss | — | 3 acts, ~20 + 6 elites + 3 bosses | — |
| Relics / Flasks / Events | — | 16 / 7 / 4 | 40 / 10 / 10 | — |
| Screens | combat | map, shop, rest, event, reward, death | — | history, overlay |
| Art | placeholders | placeholders | placeholders | asset pass |

Acceptance criteria per milestone: SPEC §9.

---

## 10. Risks & open design questions

1. **Bleed vs. Poise redundancy risk** — two "charge a meter on the enemy" systems could feel samey. Mitigation: Bleed pays in *damage*, Poise pays in *tempo*; few cards feed both (only Shield Bash-class cards touch Poise plus damage). Watch in M1 playtests; if they blur, Poise moves toward defense-payoff (Stagger grants the player block/draw).
2. **Escalating Bleed threshold readability** — "threshold ×1.5 after burst" must be visible on the meter tooltip and the meter itself (longer bar), or it reads as a bug. UI owns this, not the manual.
3. **Stance-switch cost** — if switching is too cheap the Vagabond ignores commitment; too dear and he never switches. The Enter-cards' riders (draw/block) are the tuning knob.
4. **Delayed intents teaching moment** — the Omen's Held Blade must visually persist across the turn (blade stays raised, intent shows ⌛) or the attack on the "empty" turn feels unfair. First-run overlay callout #4 is reserved for this if playtests stumble.
5. **Three classes at solo-dev scale** — Astrologer/Prophet are M3; if scope bites, ship two classes rather than three shallow ones. Prophet (most mechanically novel) is the cut candidate — recorded here so the decision is pre-made, not panicked.
