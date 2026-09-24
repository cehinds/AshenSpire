# Plan: polish, structure and feel (review of 2026-09-23)

Seven read-only reviews of `dev` at `14a7c853` (game design, lore and
writing, visuals, sprites and animation, UX and responsiveness, code
structure, performance) produced the findings below. Each item is a **lead
with its evidence**, not a verified fact: the session that picks one up
re-checks it against the code first, and re-anchors any path or line that has
moved. SPEC.md, CONTRIBUTING.md and DEVELOPER.md govern; nothing here
overrides them.

Every workstream lands as pull requests into `dev` under CONTRIBUTING.md's
[one-click rule](../CONTRIBUTING.md#a-pull-request-is-not-done-until-the-owner-can-merge-it-with-one-click):
ready for review, reviewed, green, receipted, mergeable.

Effort: **S** = hours, **M** = a PR of a day or two, **L** = several PRs.

## Order and parallelism

```
P0  A balance (A1 → A2 → A3 → A4)      E1 test hygiene
      │                                    │
P1  F combat feel   G screens & UX   H sprite scale & asset hygiene   C lore pass
      │
P2  identity decisions (owner) ──→ I system cuts, J creation & hook
P3  D payload & release model (owner sign-off) · K code structure · L engine perf
```

- **A** runs as sequential PRs in one session: A1 makes the simulator measure
  the live game, and every later balance PR is judged with it.
- **E1** runs beside A. **F, G, H, C** stay off A's files. They overlap each
  other in two places, each with a set order:
  - `styles/combat.css` and `src/ui/fx.js` (F and H): F lands first, H
    rebases.
  - Player-facing copy in `src/content/relics.js` and
    `content/source/uiStrings.csv` (G and C): every copy change in those files
    belongs to C, including G's "(no current consumer)" relic note and the
    flask/potion wording. G leaves those files alone and rebases if C lands
    first.
- **P2** items are design calls for the owner before any session builds them.
- **D** changes how builds ship and needs the owner's sign-off, above all for
  any history rewrite.

## What already works (keep)

- Exact intents computed by the same evaluator that resolves them; Held Blade
  counterplay; Poise → Stagger with growing threshold; threshold-proc statuses
  with per-tag resistance.
- Seeded seat order, `restBeforeElite`, typed `?` nodes, Grace refill split.
- Boss relics with real drawbacks; quest-only relic pool; weapon-school drafts
  as a concept.
- Lore bible (LORE §2 three tellings, §8 vocabulary), disciplined card
  flavour, the prologue lines, the survey quest reports, cinders-as-people and
  the merchant's *BURN IT*.
- Painted art: the title hall, snowfield backdrop, knight and hound sprites,
  island-vignette map art.
- Headless, deterministic engine with no import cycles; data-driven content;
  model + component UI pattern in `src/ui/models/`; reduced-motion support;
  rebindable keys and a gamepad path.

---

## P0 — broken or mis-measured

### A. Balance (one session, four PRs in order)

**Target after A4:** every class at 35–65% bot win rate at default settings,
best-to-worst spread ≤ 20 points, no class dying mostly to act-1 normal
fights. Before/after tables in each PR body. Balance moves are data rows, not
code literals. The bot win rate is a proxy: SPEC §9 M3's target for an
experienced player stays ~35–50%.

Items marked **(owner ruling)** change a number or rule the owner approved or
SPEC states. They go to the owner with simulator evidence first; SPEC is
amended before code moves.

- [ ] **A1 Simulator parity (S–M).** `tools/runsim.mjs` and
  `tools/balance.mjs` do not pass `handRules`/`ratingsRules` the way
  `src/main.js` (~2124) builds live combat; their bots ignore Stamina
  (`runsim.mjs` ~256, `balance.mjs` ~56) and end the turn when a card throws.
  - [ ] Build sim fights through the same factory the game uses.
  - [ ] Bot picks only affordable cards and continues the turn on refusal.
  - [ ] Write Mana and Stamina back after each fight, as `onCombatEnd`
    does (`src/main.js` ~2320). Both sim copies persist only HP
    (`runsim.mjs` ~284, `measure-classes.mjs` ~705), so every fight starts
    on pre-fight pools and cross-fight starvation (A2) is invisible.
  - [ ] Regenerate `docs/BALANCE.md` (stale: Reaver HP 66 documented vs 48
    live; Starseer vs packHunt 100% documented vs ~19% live) and gate it in CI.
  - [ ] Record the baseline per class over ≥ 40 seeded runs. The review's
    bot measured Starseer 0/20, Herald 17–18/20, Reaver and Rogue 8–12/20,
    but that bot did not yet play by the live rules, so these figures are a
    lead, not a verdict, until A1 lands.
- [ ] **A2 Resource starvation (M).** Stamina regains +1 only on a turn with
  no spend and Mana never regenerates in combat
  (`content/framework/mechanics.json` ~6, ~10); both pools persist across
  fights (`src/main.js` ~2282); the validator forces every Mana card to also
  cost Stamina (23/36 Starseer, 20/36 Herald reward cards cost both).
  - [ ] **(owner ruling)** Stamina refills at combat start; Mana refills at
    combat end. The recovery numbers in `mechanics.json` are owner-approved
    ("Approved new-rule numbers"; `docs/framework-migration-checklist.md`
    row 7).
  - [ ] **(owner ruling)** Drop the "Mana card must also cost Stamina" rule
    and re-cost cards dual-costed only because of it. SPEC states it ("Mana is
    never the first cost line").
  - [ ] Within the current rules: re-cost Starseer and Herald cards and add
    Stamina or Mana recovery through relics, rests or cards, so the class
    becomes viable even if the rulings stand.
  - [ ] Fix dominated cards: Comet Fragment vs Shooting Shard, Starblade
    Phalanx vs Star Slicer (`starseer.js`); Bloodhunter's Strike vs Goreslash;
    Warhorn duplicates Traveler's Whetstone (`balance.js` ~1599, ~1618).
  - [ ] Consider one or two relics that bend Stamina or Mana (none of the 55
    non-starter relics do).
- [ ] **A3 Lean attribute retune (M).** Systems still tuned for the old stat
  scale:
  - [ ] Load `2×CON+STR` puts every class at 180–285% → always Heavy.
  - [ ] Dodge Roll's guard is `3 + floor((DEX−10)/2)` plus the weight bonus:
    ≤ 0 at DEX 1–4 and negative with no floor when Heavy at DEX 1–3. Heavy also prices it at A2/SP3,
    more than a Starseer's whole Stamina pool (`src/framework/weight.js` ~36,
    ~55); it sits in two starter decks. (In combat the card face already
    shows the weight-priced cost through `previewCard`; only the balance is
    at issue.)
  - [ ] Actions `3+floor(DEX/5)` and draw `3+floor(INT/5)` breakpoints are
    out of reach at creation; DEX 5 is the dominant level-up pick.
  - [ ] Starting pools fell with the rebase: a stock Reaver opens on 48 HP
    where #1238 shipped 70 (`src/content/attributes.js` ~74, which calls
    moving them "a retune of `derivedStatRules` and the rating weights").
    Enemy HP is not the comparison (act-1 normals 10–34, elites 68–72, boss
    120); measure incoming damage per encounter with the A1 simulator and
    retune pools or enemy damage from that, not from the old figure.
  - [ ] SPEC §13.4m still describes the conversion scale removed on 09-21.
- [ ] **A4 Hand rules (M).** Defaults `retain: true`, `drawMode: 'fill'`,
  capacity 10 (`src/content/handRules.js`) show ~10 of an 11-card deck, skip
  the derived draw stat (`src/engine/handRules.js` ~6–10) and make 21 draw
  cards and 6 draw relics near-dead.
  - [ ] **(owner ruling)** Default solo combat to drawing the derived Draw
    stat each turn with end-of-turn discard, and retune the Draw row so a new
    character draws about 5 (`3 + floor(INT/5)` is 3 at creation). SPEC §4.1
    makes retain-and-fill the solo default; the discard sequence it also
    describes applies to older saves and LAN combat.
  - [ ] Keep Retain as a keyword or class trait; keep the current mode
    selectable.
  - [ ] Within the current rules: rebalance draw cards and relics so they
    matter under retain-and-fill (for example, by raising capacity only
    through them).

### E1. Test hygiene (one session, beside A)

- [ ] Discover `tests/**/*.test.mjs` instead of the hand-typed list in
  `tests/run-node.mjs`: 31 test files are not in its list, and about 17 of
  them (including `seats`, `shared-armor`, `framework`) run in no CI job.
- [ ] Root-cause the red suites — never skip or quarantine:
  - [ ] `shared-armor.test.mjs` 16/18 (`'Requires STR 3'` vs `/12/`, likely
    the old stat scale).
  - [ ] `framework.test.mjs` 11 of 82, reachable only via
    `tools/framework-gate.mjs`: `equipment.dualWield` has no
    `playerTermId`/`tooltipTermId`, the cutover gate, status semantics,
    weapon-art and grant reconciliation (creation, equip, mid-combat swap,
    removal candidates), the Armoury equip-load receipt, and the unarmed
    and one-empty-hand Dodge Roll composition. Re-run before scoping.
  - [ ] `seats.test.mjs` 1/13 (act map byte-identical).
- [ ] Move slow tool self-tests (`screen-census --selftest` and others) to
  their own CI job; the core suite currently takes over 5 minutes.
- [ ] Report suite runtime before and after.

---

## P1 — feel, screens and sprites

### F. Combat feel

- [ ] **Card play latency (S).** Click to damage number measured at 1.28 s.
  - [ ] Merge the actor-less `energySpent` beat into the next actor beat
    (`src/ui/fx.js` `groupBeats` ~504–547; it costs `stepMs` + `beatMs`
    ≈ 490 ms before the swing).
  - [ ] Retime attack clips so impact lands ≤ 250 ms: 60–70 ms frames, hold
    the impact frame, drop borrowed DEFEND/BUFF in-betweens
    (`swordShieldAttack` is 11 × 100 ms, impact on frame 7).
  - [ ] Fire the card-play sound with the picture, not ~560 ms ahead
    (`combat.js` ~2313).
  - [ ] Card leaves the hand on pointerup and travels to the target or
    discard (~180 ms); draws come from the Draw pile.
- [ ] **Enemy turn pacing (S).** ≈ 1.7 s + 0.77 s per enemy.
  - [ ] Banner plays over the first wind-up; enemy breath ~150 ms.
  - [ ] Show that a click skips (already works, `fx.js` ~600–615).
- [ ] **Idle life (S).** `sprite-idle` targets `.sprite > img` but the image
  is a grandchild, so it never matches (`combat.css` ~629). Retarget; 2–3 px,
  2.8–3.6 s, desynced per actor.
- [ ] **Impact (S).**
  - [ ] 50–80 ms hit-stop on the impact frame; one white frame.
  - [ ] Recoil and a 1–2 px shake on every hit, scaled by damage (shake is
    currently only at ≥ 15, `fx.js` ~790).
  - [ ] Trailing "ghost" HP bar.
- [ ] **Pose swap (S).** The player sprite vanishes mid-attack
  (`visibility:hidden` swap, `combat.css` ~411–432); crossfade instead. Add a
  CSS squash for enemy anticipation and an eased recovery.
- [ ] **Hover lift (S).** Inline transforms in `hand.js` (~123, ~275) fight
  `!important` rules (`combat.css` ~990, ~1085); compose
  `transform: var(--fan) translateY(var(--lift, 0))` and drop the overrides.
- [ ] **Damage numbers (S).** Anchor at ~55% of sprite height or offset from
  the intent badge (`floatNum`, `fx.js` ~345); a size step and scale punch.
- [ ] **Focus ring (S).** Browser-default white box on a targeted enemy;
  `:focus-visible` only, themed.
- [ ] **Render cost (M).** Five chained `drop-shadow` filters per sprite
  (`combat.css` ~59–63) plus animated `filter: brightness` cost ~1.5 s of
  raster in one card play (frames up to 136 ms). Bake the outline; animate an
  overlay's opacity.
- [ ] **Sound (M).** 15 synth recipes, one `hit` for all damage.
  - [ ] Swing on wind-up; impact tiered by damage and family.
  - [ ] Turn stingers (`fx.js` ~681 is silent); draw, shuffle, discard ticks.
  - [ ] Player-hurt distinct from enemy-hurt.
  - [ ] Probe `assets/sfx/*.ogg` without 404s (manifest), or ship the files.
- [ ] Longer term (L): 4–6-frame attack, hurt and death clips for bosses and
  elites.

### G. Screens, responsiveness and UX

- [ ] **Zoom floor and tablets (M).** `min(w/1200, h/730)` clamped 0.62–1.7
  (`src/main.js` ~528–625, `balance.js` ~1016) drops text to 6.2–6.4 px at
  768×1024 and 844×390.
  - [ ] Portrait tablets (aspect < 1) use the narrow layout, or add a middle
    baseline (~900×1100).
  - [ ] Raise the floor to ~0.75 and reflow short-wide screens.
  - [ ] 11 px minimum on eyebrow/status tokens
    (`styles/responsive-type.css`).
  - [ ] Reconcile the 26 viewport `@media` queries with `data-layout`.
- [ ] **Large screens (S).** Cap End Turn at ~2.5 card widths. Card width
  already grows with the body-wide `zoom: var(--ui-zoom)`
  (`styles/base.css` ~293), so do not scale it again.
- [ ] **Phone combat (M).** First intent badge clipped; overlapping intents
  cut "3×2" to "3×"; right card overflows; Potions/ACTIONS labels overflow;
  25 px pips (need 44 px). Scale formation to stage height, cap the hand at
  viewport width, move counters into the HUD row.
- [ ] **Phone lists (S).** Compendium list is a ~3.5-row nested scroll trap
  at 360×640; shop Buy chip clipped.
- [ ] **Card frame (M).** Hand-slot key chips cover card titles; large cost
  gem in a corner; type ribbon; "HOLD" only on the focused card or once as a
  hint; action ◆ and mana ♦ need different shapes; `aria-label` on the cost
  block.
- [ ] **Title to first card (M).** 26 inputs today.
  - [ ] No "Start in slot 1?" confirm for an empty slot.
  - [ ] Auto-pick a select with a single option.
  - [ ] Show a disabled Next's reason as text, not only a tooltip
    (`customize.js` ~110–128).
  - [ ] "Quick start (recommended)" with defaults.
- [ ] **Transitions (M).** Boot long task 756 ms; Start→customize 344 ms;
  entering combat has 124/87/72 ms long tasks; title reveal ~2.4 s. Warm the
  combat and customize modules during the gate or prologue; let a key skip
  the reveal.
- [ ] **Touch info (M).** A tap on an intent shows nothing; the double-tap /
  hold scheme (`tooltip.js` ~24) is never taught; desktop hover waits more
  than 900 ms. Single tap opens tips on icons with no primary action; ~400 ms
  hover; one-time hint.
- [ ] **Esc (S).** Route Esc to each screen's Back/Leave through the `cancel`
  action (`src/ui/input.js` ~103): compendium, victory dialog, shop, event,
  rest.
- [ ] **Combat HUD (M).** 27 numbers, 13 glyph-only nodes, 11 bars at once.
  Hide cinders/act/floor in combat; one HP readout; one Actions readout.
- [ ] **Map (M).** Opens on one node; frame the next 2–3 rows, fog later
  ones; header band full width.
- [ ] **Reward and rest (S–M).** Drop the duplicate status column; "Upgrade:
  Available" with 0 Smithing Stones; dimmed-but-Available Rest; ⚒ used for
  two actions; progression rows wrap on phone; scroll fade.
- [ ] **Character creation (M).** Large class portrait panel instead of a
  40 px avatar; left-align the steps; gold selection, not green.
- [ ] **Palette (S).** One gold/ember primary-button token; green only for
  heal and positive states; themed End Turn.
- [ ] **Settings (S to hide, L to curate).** Advanced exposes ~3,086 rows in
  112 sub-sections; put it behind a Developer / Modding switch; move text
  size, motion, contrast and tap size into Accessibility.
- [ ] **Contrast and focus (S).** Gold `#c9a227` on reward panels 3.03:1;
  keyword red 4.1–4.3:1 at small sizes; "HOLD" 2.45:1. Cards come after 16+
  Tab stops — add a skip-to-hand key.
- [ ] **Copy (S).** Tutorial says Energy, HUD says Actions (`tutorial.js`
  ~35); Quit says "YOUR CLIMB IS SAVED" with no climb; death screen repeats
  the class name and does not group duplicate cards. (Flask vs potion
  wording is C's.)
- [ ] **Dev text in play (S).** "UNSTAMPED" build line and "Replay entrance"
  on the title. (The "(no current consumer)" relic note, `relics.js` ~154,
  is C's.)

### H. Sprite scale and asset hygiene

- [ ] **Threat scale (M).** `fitCombatSprites` (`CombatSpriteScaleModel.js`
  ~19–37) fits every fighter to one visible height, so a hound equals the
  knight; boss fights shrink the hero to 82 px (22 px on phone) under
  ~330 px of empty sky.
  - [ ] Per-enemy authored `heightScale`.
  - [ ] A floor under the hero's size.
  - [ ] Bosses rise into headroom instead of taking the hero's width.
- [ ] **Upscaling (S).** Combat backdrop drawn at 1.9–2.55× (1536×1024
  source), event portraits ~2.7×, atlas 7.6×; cap backdrop zoom ~1.2× until
  re-exported art lands.
- [ ] **Grade (S).** Per-act colour-grade overlay to tie warm sprites to cold
  backdrops.
- [ ] **Event scene (S).** Hard line across the backdrop at ~y=258; hero
  crop cuts at the face; name plates; text box sized to content.
- [ ] **Duplicates and waste (S).** `assets/enemies-unity` and
  `enemies-expansion` are byte-identical to `enemy-poses/*_idle`; legacy
  `sprites/enemy_*` used only as a fallback; 64/96 px thumbnails for relic
  icons (256 px shown at 23 px) and customize portraits (512 shown at 40).
- [ ] **Icons (S–M).** Reward screen uses unicode glyphs though 512 px
  `icon_*.webp` exist; replace colour OS emoji in card art, HUD pips, flask
  and medallion with one monochrome engraved set.
- [ ] **Font (S).** `--font-display: 'Cinzel'` (`styles/base.css` ~182) has
  no `@font-face` or file; bundle a woff2 with `font-display: swap`.

### C. Lore pass

- [ ] **Leftover borrowed names (S).**
  - [ ] Elden Ring: "Rune restored" (`history.js` ~41), Smithing Stones,
    atlas node "Grace", "Legacy dungeon", The Oracle's Riddle's giant fingers
    (`events.js` ~478), Handspider Nest, Blessed Dew, Twinned Armor.
  - [ ] Slay the Spire: Blade Dance, Afterimage, Acrobatics, Setup, Master of
    Strategy, Dazed, Wound, Slimed, Envenom, Prepared, Ascension.
- [ ] **Own-vocabulary clashes (S).** "Warden's Altar" idol (`events.js`
  ~305); "Seat of Faded Emberlight" (~380); flame and shrine rest spots;
  lower-case "the spire" as the whole world (`events.js` ~136, Carrion
  Morsel, `customMods.js` ~31, `uiStrings.csv` ~285); "Act 3" numbering of
  unordered seats; moon cards; Weeping Oak / Elder names implying a great
  tree; "Ancient Cinder Stone".
- [ ] **Relics (M).** 12 of 63 lack flavour; rewrite the rest as signed
  witnesses; fix Forsaken Medallion (gold → cold iron), Titan's Cinder
  (giants), Gold Figurine.
- [ ] **Atlas text (M).** 200 of 291 descriptions are one template; 30 more
  "Inspect the road toward…".
- [ ] **Card name vs flavour (S).** #1264 rewrote every card's lore after
  this review, so the flavour-variety findings are closed. One naming issue
  remains: Plague of Butterflies' flavour describes red moths (`herald.js`
  ~364). Rename the card (for example Ossuary Moths); leave the approved
  lore as it is.
- [ ] **Terms (S).** Arcane Exposure, Frost-Exposed boosting starstone,
  Insanity and Madness both exist, Poise has no fiction; `roadWarden` has no
  portrait.
- [ ] Ready-made rewrites from the review:

  | Where | Before | After |
  |---|---|---|
  | `history.js` ~41 | Rune restored | Hearths relit |
  | Forsaken Medallion | …still remembers being gold. | Cold iron, blank on both faces. The hamlets stamp nothing on it; there is nothing to stamp. |
  | Carrion Morsel | The spire feeds those who feed it. | The ring feeds those who feed it. |
  | `events.js` ~136 | "The spire will finish what I would have started." | "The fire will finish what I would have started." |
  | `events.js` ~478 | A pair of enormous fingers rises from a font… | A drowned clerk's hand rises from the font, still tapping out a count. |
  | `customMods.js` ~31 | After Act 3 the spire loops | After the third seat the ring turns again |
  | Card | Plague of Butterflies | Ossuary Moths |
  | `uiStrings` | No potions carried. | No flasks carried. |

---

## P2 — identity (owner decisions first)

- [ ] **I. System load (L).** Six enemy fill-a-bar meters (Poise, Ward,
  Exposure, Bleed, Frost, Insanity); player Poise fired on 2.7% of turns;
  five XP/currency streams on three curves; tier-3 subclass at class level 5
  vs ~2 reached per run; armour and `dualWield` tracks level 0 per run;
  smithing tier cap 1; skill auto-upgrade at level 5 empties the shrine's
  choice. Decide:
  - [ ] Fold Ward and Exposure into Poise?
  - [ ] Hide player Poise and combat ratings from the default HUD?
  - [ ] Merge class XP into character level, or open tier 3 by act 2?
  - [ ] Cut or hide dormant tracks, empty equipment slots, smithing tiers?
  - [ ] Freeze one creation mode and ruleset until all four classes pass A.
- [ ] **Resource bar reference.** HP bars are drawn against 200 and Mana and
  Stamina against 20 — the owner's ruling of 2026-08-22
  (`src/content/resources.js` `HUD_REFERENCE_MAX`), so a trough shows a
  pool's capacity. Since the rebase, a full 34–48 HP pool fills about a fifth
  of its track and a 2–4 Mana pool a tenth to a fifth. The ruling's own
  removal condition anticipates revisiting it: keep the reference, or lower
  it to the rebased band?
- [ ] **J. The hook first (M).** "Your weapon drafts your cards" is the
  distinct idea; creation opens on a 3-point stat spread. Make kit choice the
  first creation screen (three weapons per class, each changing the starter
  deck and draft pool); stats behind Advanced.
- [ ] **Lore in play (L).**
  - [ ] Put the central mystery on screen (the fire has started reading the
    unwritten): prologue line, relight moment.
  - [ ] The four endings LORE §4 promises; today one ("Ember restored",
    `gameover.js` ~30).
  - [ ] Inspector lore for the 33 enemies
    (`CombatantInspectorSections.js` ~58 is wired, empty).
  - [ ] Events with moral weight; replace random Guilt with a debt that
    follows from the choice.
- [ ] **Signature pillars** to steer C, I and art: the Ledger (names are
  fuel), the Stopped Year (each seat frozen in its season), signed witnesses
  for every text, the uncounted hamlet folk, herding the fire toward the
  causeway.
- [ ] **Art direction brief.** Material language: soot-blackened iron,
  ember-lit parchment, oxidised bronze, bone and wax. Palette ground
  `#0d0b08` `#171310` `#241d15`; figures `#3f2720`–`#5b2719`; accents gold
  `#c9a227`, ember `#c9502e`, blood `#8a1a1a`; parchment `#e8dcc0`; cold
  `#7fa8c9` for ambience only. One warm key light (~3200 K) from upper front,
  cool fill from the backdrop, environment-tinted rim, 1–2 px dark contour.
  Signature motion: ash and ember (cards burn to ash on discard).
- [ ] **Art asset priorities** (need an artist or pipeline, not a code
  session):
  1. Five combat backdrops at 3072×1024, graded warm-over-cool.
  2. ~12 card-art family plates, then per card.
  3. 4–6-frame clips for 3 bosses and 3 elites.
  4. Portrait busts at 1024² for the classes and speaking NPCs.
  5. Painted node medallions (256², ~8 types); atlas ≥ 2048 px.
  6. Reward and resource icons (128²).
  7. Engraved 9-slice card and panel frames.

---

## P3 — structure and performance

### D. Payload and release model (owner sign-off)

- [ ] **Serve external art (M).** The shipped page is 253 MB, 96.5% base64
  art (`tools/bundle.mjs` ~365–398); evaluating it costs ~2 s and ~485 MB of
  heap on a desktop CPU. Make `--external-art` (57.6 → 4.8 MB, code path
  exists, `bundle.mjs` ~108) the Pages build with a service worker for
  offline; keep the single file as a download.
- [ ] **Stop committing builds (M).** `AshenSpire.html`, `build/`, `dist/`
  and `buildordinal.json` change in ~300 of 888 recent commits; each PR adds
  ~300 MB of LFS; the repo is ~21 GB locally and history holds ~60 GB of
  bundles. Build in CI, publish as release assets, derive the ordinal in CI,
  changelog fragments per PR. Update `verify-shipped`, `receipts` and the
  Pages workflow with it.
- [ ] **Pages workflow (S).** `pages-builds.yml` fetches full history with
  LFS on every dev push and can pull ~12 GB; the Pages site limit is 1 GB.
- [ ] **CI (S).** Full build and LFS checkout on Ubuntu only; small
  byte-identity smoke test on Windows and macOS.
- [ ] **Assets (S–M).** Build `assets-mobile/` (41 MB) in CI instead of
  committing it; consider AVIF or 384 px frames for the 128 MB desktop
  animation tree; move `art/` (1.6 GB) to LFS or its own repo.
- [ ] **History clean-up** (`git lfs migrate` / `filter-repo`) — only with
  the owner's explicit approval.

### K. Code structure

- [ ] **`src/main.js` (L).** 3,493 lines, 98 imports, 16 module-level `let`s,
  ~850 lines of `?shot=` fixtures and 13 `window.__*` hooks shipped to
  players. Split into run controller, navigation, layout, and a
  `dev/shotHarness.js` loaded only with `?shot`.
- [ ] **Giant screens (L).** `mountCombat` spans ~2,490 lines
  (`combat.js` 109–2599); `settings.js` is 2,967 lines and holds game-rule
  resolvers that 20+ modules import; move the schema and resolvers to
  `model/settings.js`, split combat into presenter, view and input.
- [ ] **`model/loadout.js` (M–L).** 3,581 lines, 87 exports; split into
  equipment rules, deck, transitions, swap cost; move transitions to
  `engine/`; add `engine/economy.js` for cinder spends now done in
  `shop.js` and `reward.js`.
- [ ] **Layering (S).** `content/prototypes/combatBuilds.js` imports the
  engine; `model/advancedConfig.js` `saveJsonFile` touches `document`; the
  architecture check is stale and does not cover content or framework
  direction — replace with an import-graph layer check in `ci.yml`.
- [ ] **Framework re-export layer (M).** `framework/index.js` says nothing
  consults it, yet engine and model import it; `framework/optionDecision.js`
  imports ui. Finish or abandon the cutover; teach `tools/bundle.mjs`
  `export { } from`.
- [ ] **Tools (S–M).** 283 files; 65 referenced by nothing; 82 committed
  `tools/results/*`; 22 tools launch Chromium themselves. A tools manifest,
  archive the unreferenced, ignore results.
- [ ] **Repo hygiene (S).** Root preview HTML files and
  `AshenSpire-LegacyPreview.html` (7.1 MB, not LFS); committed `scratch/`;
  `docs/preview` 160 MB of PNGs; five overlapping architecture docs; a
  duplicated section in DEVELOPER.md; CONTRIBUTING.md titled "EldenSpire".
- [ ] **Duplicated helpers (S).** `ownObject`/`integer` copied in four files;
  `deepFreeze`, `clamp`, `hash` redefined 3–6 times; orphan modules
  `mapHeader.js`, `armamentRadial.js`, `CombatantInspectorModel.js`.
- [ ] **`tests/engine.test.js` (M).** One 9,868-line file; split by domain.

### L. Engine and runtime performance

- [ ] **Trigger scan (S–M).** `scanTriggers` (`src/engine/triggers.js` ~68)
  sorts mounts and walks every rule, status and phase on every event (11%
  self time). Index by `trigger.on` when mounts and statuses change.
- [ ] **Load receipt (S).** `effectiveCost` calls `playerWeightClass()`
  twice per card play, rebuilding the loadout each time (11.5% inclusive).
  Cache per combat, invalidate on equipment change.
- [ ] **Boot validation (S).** `validateContent` ~115 ms, 21% in
  `eligibleCards`/`authoredCardTags` filtering 1,785 tagging rows per card
  (`attackCardDamage.js` ~60, ~281). Build a card→tags map once; validate the
  authored bundle in CI and only overrides at runtime.
- [ ] **Minify and lazy-load (S).** ~9 MB of unminified code;
  `config/generated/ui.js` 1.1 MB pretty JSON (503 KB compact); load
  `changelog.generated.js` when its screen opens. `worldAtlas.js` feeds
  journey generation, encounters, save validation and `atlasQuests`, so
  defer it only to the run-loading boundary, never to the atlas screen.
- [ ] **Render keys and observers (S).** Combat memo keys `JSON.stringify` the
  whole player and each enemy per render; seven `MutationObserver`s watch the
  document subtree only to detect their own removal — one disposal registry
  or an `AbortController` per screen.
- [ ] **Saves (S, optional).** Trim the snapshot `eventLog` to its tail —
  but first persist a cumulative kill count in the snapshot, since
  `onCombatEnd` counts `enemyDied` events from the log for character XP
  (`src/main.js` ~2339) and a trimmed log would under-award a resumed fight.
