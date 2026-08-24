# Ashen Spire — Game Design Document

- **Rebuild baseline:** 2026-08-23
- **Status:** Design baseline approved for planning; implementation not started by this document
- **Product:** Ashen Spire (`AshenSpire`)
- **Platform:** Modern desktop and mobile browsers
- **Genre:** Single-player, run-based tactical deckbuilder with optional co-op seams
- **Reference layout:** 1280×720 desktop; responsive portrait target approximately 390×844

## 0. Purpose and authority

This document defines the intended player experience, visual language, interface behavior, and rebuild boundaries for Ashen Spire. It reconciles the original GDD with the current `dev` product, current character-creation and equipment behavior, the reusable component model, and the new rebuild direction.

When sources disagree, use this precedence:

1. Explicit product-owner decisions and the selected rebuild brief.
2. Current validated domain/content contracts and save invariants.
3. Current player-visible behavior recorded by the repository changelog.
4. This GDD for design intent and presentation behavior.
5. Older mockups and historical session notes as references, not authority.

Exact combat formulas, schemas, identifiers, and tuning values remain implementation contracts and should live in validated configuration or a technical specification. This GDD explains why the game is shaped the way it is and what the player must experience.

The rebuild must preserve player behavior before replacing implementation. A new architecture, renderer, theme, or asset does not authorize a rule change.

## 1. Vision

**One line:** A severe but fair ascent through a dying spire, where every threat is legible, every build is authored through meaningful choices, and every death teaches the player something reproducible.

Ashen Spire combines the decision density of a tactical deckbuilder with an original dark-fantasy pilgrimage. The player studies exact enemy intentions, spends scarce turn resources, shapes a deck and equipment loadout, and decides when to defend, build pressure, break Poise, change stance, or accept present harm for future power.

The game should feel quiet, weighty, and deliberate. It should never hide difficulty behind vague arithmetic, cluttered screens, unreliable controls, or ornamental motion.

## 2. Design pillars

### 2.1 Honest combat

- Enemy intents display the same calculated values the simulation will resolve.
- Card, flask, equipment, status, and targeting previews come from authoritative rules.
- Affordability, legality, ownership, and failure reasons are visible before confirmation.
- Difficulty comes from interacting constraints, not concealed information.

### 2.2 Forecast, then improvise

- Enemy turns are readable enough to support planning.
- Draws, rewards, encounters, and map routes require adaptation.
- A strong turn presents competing valid lines rather than one obvious answer.

### 2.3 Build identity through verbs

- Classes differ through decision patterns, resource relationships, and rules.
- Equipment, relics, cards, flasks, and stats alter how a build acts—not only its color or numbers.
- The player should be able to describe the build's plan by the middle of Act I.

### 2.4 Pressure across time scales

- Energy, actions, cards, Block, and enemy intents shape the current turn.
- HP, mana, stamina, flasks, currency, and deck quality shape an act.
- Equipment, relics, attributes, and route decisions shape the run.

### 2.5 Break the enemy's plan

- Bleed, Blight, Poise, Stagger, stances, control effects, and timing let the player disrupt threats.
- Build-up mechanics create anticipation before a clear payoff.
- Repeated control has authored diminishing costs or counterplay.

### 2.6 Readable spectacle

- Art, motion, audio, and effects communicate state before adding ornament.
- Strong motion and brightness are reserved for danger, reward, threshold events, and irreversible choices.
- No effect may obscure mandatory information or delay input without purpose.

### 2.7 Content is assembled

- Designers compose validated primitives and content records.
- Rules, presentation, assets, and tuning have explicit owners.
- Replacing art, rearranging layout, or applying a theme must not require rewriting gameplay.

## 3. Player fantasy, audience, and session shape

The player is a Forsaken climber entering a spire formed from the wreckage of a shattered kingdom. They begin with a modest deck, an authored body and identity, a chosen starting kit, and equipment they explicitly own. Through risk, sacrifice, and tactical understanding, they turn those humble tools into a coherent engine of gold, ash, blood, steel, or starstone.

Target players enjoy tactical deckbuilders, buildcraft, dark-fantasy atmosphere, and systems that reward learning. A full run should last approximately 45–90 minutes, with combat encounters generally lasting 2–5 minutes. The run must support safe suspension and deterministic resumption after committed choices.

The game should welcome pointer, keyboard, touch, and gamepad players without creating a privileged input path.

## 4. World and narrative framing

Narrative is ambient and economical. It appears through locations, silhouettes, equipment, event decisions, enemy behavior, card language, and short authored descriptions. Avoid cutscene-heavy delivery and long dialogue trees.

### 4.1 Premise

The Goldbough burned. Its light collapsed inward, crystallizing into the Ashen Spire while ember began to flow upward. The Forsaken climbs to restore, claim, or transform the Sovereign Ember at its crown.

### 4.2 Acts

- **Act I — The Fallow Marches:** Overgrown foothills, broken soldiery, blight-touched beasts, grave-wisps. Umber, iron, and faint gold. The act teaches intent reading and immediate tradeoffs.
- **Act II — The Stitched Court:** A ruined court that remade itself to survive. Gilded stone, oxidized metal, surgical joins, and verdigris. The act tests whether the player's deck has a plan.
- **Act III — The Ashen Crown:** Burned canopy, mineral ash, bone light, and concentrated ember. The act judges whether the build is tuned and resilient.

### 4.3 Narrative rule

Worldbuilding may deepen the climb, but it must not become required reading for understanding a combat rule, reward consequence, or interaction state.

## 5. Core loops

### 5.1 Run loop

```text
create or select profile
  → create character and starting loadout
  → choose seed and run options
  → generate a deterministic act map
  → choose a reachable node
  → resolve combat, elite, event, merchant, shrine, or treasure
  → inspect and accept or decline rewards
  → checkpoint committed state
  → defeat the act boss or perish
  → record run receipt, seed, and statistics
```

Every node type must create a distinct decision. The map is a strategic plan, not a maze or a decorative path selector.

### 5.2 Combat loop

```text
read exact enemy intents
  → inspect hand, resources, statuses, and legal targets
  → choose cards, equipment actions, or flasks
  → preview the authoritative result
  → confirm a legal intent
  → resolve an ordered event timeline
  → end turn
  → enemies execute previously telegraphed actions
  → repeat until victory or defeat
```

The player should repeatedly face a comprehensible question: defend now, build a meter, change stance, spend a limited resource, disrupt a threat, or accept damage to create a stronger future turn.

### 5.3 Meta loop

The replay driver is mastery: class identity, route knowledge, equipment combinations, deck discipline, and seed reproducibility. Progression may add authored options, but it must not invalidate the legitimacy of an unmodified starting profile.

## 6. Combat design

### 6.1 Core resources

- Energy and actions govern what can be done this turn.
- Cards move through explicit draw, hand, discard, exhaust, and in-play ownership states.
- Guard or Block absorbs damage before HP according to the current rules contract.
- Mana supports class and equipment actions where authored.
- Stamina or SP is represented consistently with the current resource model.

### 6.2 Build-up systems

- **Bleed:** Accumulates toward a burst; the threshold and payoff remain visible.
- **Crimson Blight:** Applies pressure over time and supports attrition or health-economy builds.
- **Poise:** Accumulates toward Stagger, exchanging immediate damage for tempo and an opening.
- **Stagger:** Is visually and audibly important because normal combat feedback remains restrained.

### 6.3 Intent contract

- Intents are visually dominant on enemies.
- Multi-hit attacks show hit count and post-modifier per-hit values.
- Any displayed value must come from the same evaluator used during resolution.
- If state changes, previews update rather than preserving stale arithmetic.

### 6.4 Targeting contract

- Targeting is a policy over the current board, not a screen-specific guess.
- Self, ally, mixed, enemy, multi-enemy, and future target sets share one legality service.
- Pointer, drag, keyboard, gamepad, AI, and accessibility consume the same legal-target record.
- If a selected target remains legal across a redraw, focus remains on that target.
- If a selected target becomes illegal, cancel or refuse clearly and restore the originating control's focus.

## 7. Current class identities

The current game has four playable classes. Older three-class references are superseded.

### 7.1 Reaver

- **Fantasy:** Armoured weapon-arts duelist.
- **Primary verbs:** Strike, change footing, build Bleed, break Poise, counter.
- **Strength:** Immediate melee pressure and stance-driven offense or defense.
- **Weakness:** Limited draw and pressure from wide enemy boards.
- **Signature accent:** Ember iron and restrained warm metal.

### 7.2 Starseer

- **Fantasy:** Fragile sequencing caster.
- **Primary verbs:** Cast in order, amplify later spells, shape mana, delay for a stronger sequence.
- **Strength:** Combo turns and late-run scaling.
- **Weakness:** Vulnerable early defense and demanding route decisions.
- **Signature accent:** Starstone blue-violet against near-black.

### 7.3 Rogue

- **Fantasy:** Opportunist who creates and exploits openings.
- **Primary verbs:** Accelerate, evade, poison, ambush, reposition, finish.
- **Strength:** Speed, extra actions, setup-payoff turns, and decisive strikes.
- **Weakness:** Lower tolerance for prolonged direct exchanges.
- **Signature accent:** Oxidized green-grey with sharp pale highlights.

### 7.4 Herald

- **Fantasy:** Blood economist and martial support pilgrim.
- **Primary verbs:** Spend HP, recover it, spread Blight, convert healing and sacrifice into advantage.
- **Strength:** Flexible sustain and risk-fueled effects.
- **Weakness:** Mistakes compound because health is both life and currency.
- **Signature accent:** Blight orange, blood warmth, and broken-gold halo forms.

Each class requires at least two viable build directions and a silhouette that remains identifiable without relying on color.

## 8. Economy and progression

- Cinders create painful purchasing tradeoffs rather than routine shopping.
- Card rewards are inspectable and skippable; deck discipline is a taught skill.
- Flasks are limited panic tools and greed enablers.
- Relics alter the shape of a run rather than merely adding small percentages.
- Shrines preserve the recurring heal-versus-improve dilemma.
- Equipment changes combat verbs and ownership while preserving clear before-and-after receipts.

Nothing enters the player's run merely because a reward screen opened. Collection occurs only through an explicit action or an explicitly configured Auto collection policy.

## 9. Character creation rebuild contract

Character creation is a compact, progressive form built from reusable sections. It must read as a ritual of preparing for the climb, not as an account-registration wizard or dashboard.

### 9.1 Primary order

```text
Class
Character
Starting Equipment
Seed
Back                 Begin the Climb
```

One section may be expanded at a time on compact layouts. Completed sections collapse into readable receipts and remain directly reopenable.

### 9.2 Class section

- Shows all four playable classes.
- Supports list and grid presentation through the same records.
- Provides a large class portrait or full-body preview supplied through an asset reference.
- Communicates class identity through verbs, starting resources, and equipment—not color alone.
- Selecting a class may advance to Character when auto-advance is enabled.

### 9.3 Character section

Contains:

- Character name.
- Strength, Dexterity, Constitution, Wisdom, and Intelligence.
- Standard/Tuned and Assign Points modes as currently supported by validated content.
- Derived HP, Mana, Actions, Draw, Stamina/SP, and other authored resources beside the attributes.
- Sprite, tint, sigil, and keepsake selection.
- Live character preview whose side is controlled by layout configuration.

Standard or preset modes do not show meaningless plus/minus controls. Assign Points opens a focused allocation surface using the same underlying allocation rules and refusal messages as the game.

### 9.4 Starting Equipment section

Contains direct, inspectable choices for:

- Starting armour.
- Left Hand armament.
- Right Hand armament.
- Relic.
- Any class starting-kit composition required by content.

Left Hand and Right Hand are real ownership sockets. An individual armament instance may occupy only one hand. Choosing it for the other hand moves it; it is never duplicated, deleted, or silently substituted. Items are not inherently left- or right-handed unless content explicitly says so.

The section uses one shared Inventory owner. There must not be a second visual inventory containing the same items.

### 9.5 Seed section

- Remains separate from character identity and equipment.
- Supports generated and user-entered seed values.
- Explains reproducibility without exposing implementation noise.
- Collapses into a receipt that reads the selected seed or Random.

### 9.6 Begin contract

Begin validates the complete character and loadout. Invalid states identify the exact field, equipment requirement, ownership conflict, or unspent allocation that must be corrected. The action consumes the selected values only after successful validation.

## 10. HUD, map, and combat presentation

### 10.1 Shared run HUD

Map and Combat consume one shared run HUD composition rather than parallel markup.

The intended information hierarchy is:

1. Character identity, act/floor/seed/build receipt, and Cinders.
2. HP, MP, and SP in a consistent vertical order.
3. Relics and limited-use resources.
4. Armoury, Menu, Health, and Mana actions in one compact control cluster.

Combat adds battlefield, combatant, hand, and action components. It does not fork the persistent HUD.

### 10.2 Map

- The full act is understandable as a route plan.
- Traveled paths use earned gold; reachable nodes receive a parchment rim light.
- Unreachable structure recedes without becoming invisible.
- Zoom and legend controls remain grouped below the playfield.
- Camera position and zoom persist when the player returns.

### 10.3 Combat

- Player information is grouped to the left, enemies to the right, and available cards/actions below.
- The center and lower-middle playfield remain readable.
- Combatant cards expose intent, sprite, name, HP, Poise, buildup meters, Block, and statuses in a learned order.
- Long hands or strips page or scroll without covering target areas.

## 11. Armoury and equipment

The Armoury is one equipment owner with multiple configurable presentations.

### 11.1 Core composition

```text
Armoury Overlay
└─ Armoury Panel
   ├─ Header and view switcher
   ├─ Character figure and equipment sockets
   ├─ Folding Tray: Inventory
   ├─ Folding Tray: Cards
   └─ Folding Tray: Stats
```

Inventory, Cards, and Stats share one Folding Tray shell but retain independent content models.

### 11.2 Ownership and receipts

- Equipment instances have one authoritative location.
- Equipped-hand labels describe actual sockets.
- Swapping, moving, and unequipping preserve ownership.
- Before-and-after receipts expose affected stats, cards, and resource changes.
- The player's facing direction must not reverse semantic Left Hand and Right Hand ownership.

### 11.3 Folding trays

- Top and Bottom collapse to horizontal bars.
- Left and Right collapse to narrow vertical rails.
- Closed arrows point toward the area that will open; open arrows point back toward the anchored edge.
- Counts remain visible while folded and represent the full quantity.
- Expanded content owns its scrollport.
- Mouse resizing begins immediately; touch resizing begins after a short deliberate hold.
- Keyboard arrows resize a focused handle in consistent steps.
- Expanded size persists by stable tray ID and edge.
- Compact screens may enforce one open secondary tray per group.

## 12. Rewards, merchants, and disclosure

### 12.1 Reward menu

- Cinders, cards, flasks, armaments, and relics appear as inspectable rows or cards.
- Nothing is applied until selected or resolved by the configured collection policy.
- Back leaves uncollected rewards unchanged.
- A full destination explains why collection is unavailable and may offer Skip.
- Continue is always available and says what it will do.
- Hold-to-continue behaves consistently for mouse, touch, keyboard, and gamepad.

### 12.2 Merchant

- Cards, Relics, Flasks, Remove a Card, and Sell are progressive-disclosure sections.
- One section is open at a time on compact layouts.
- Buying preserves the current browsing context.
- Disabled or absent features use truthful authored policy; they are not decorative dead controls.

### 12.3 Disclosure grammar

Reusable disclosure components support:

- **Face:** Compact name, icon, quantity, and key value.
- **Reveal:** Authored explanation plus derived effects.
- **Receipt:** The exact calculation, selection, ownership, or consequence.

The data record chooses the disclosure tier. Screens do not maintain hidden lists of which entries are considered simple.

## 13. Component and presentation architecture

The rebuild uses composition/component-based presentation with explicit boundaries. MVVM-style read models may be used where they improve clarity; screen classes must not become markup owners or domain-rule containers.

### 13.1 Presentation record

Every reusable component receives an immutable, serializable model equivalent to:

```text
ComponentModel
  id
  variant
  properties
  tokens
  accessibility
  behaviors
  children
```

Behaviors declare semantic commands and policies. They do not carry hidden domain mutations inside display records.

### 13.2 Responsibilities

- **Domain Models:** State, rules, plans, ownership, and receipts.
- **Application Services:** Use-case orchestration over domain rules and interfaces.
- **Presentation Models/ViewModels:** Already-calculated labels, values, states, reasons, focus order, asset IDs, and component keys.
- **Components/Views:** Semantic markup, visual states, and accessibility attributes.
- **Behaviors:** Focus, command, tooltip, hold, refusal, resize, drag, and lifecycle binding.
- **Infrastructure:** Browser storage, audio, timing, navigation, networking, and asset loading adapters.
- **Composition Root:** Selects implementations and assembles screens.

Dependencies point inward. Domain and application rules do not import UI, browser APIs, or renderer types.

### 13.3 Stable components

The component library must cover at least:

- Ashen Spire wordmark and header marks.
- Class portrait and class selector card.
- Grid/list view toggle.
- Split divider and tray resize handle.
- Resource icon, meter, and compact resource receipt.
- Section face, reveal, and receipt.
- Auto-advance and hold-to-continue controls.
- Armour, armament, relic, keepsake, sigil, tint, and sprite cards.
- Equipment socket and equipment comparison receipt.
- Collapsed Character, Equipment, and Seed receipts.
- Shared action control, refusal message, tooltip, modal, and focus scope.
- Desktop and mobile form compositions.

Each component defines default, hover, focus-visible, active, selected, disabled, loading where applicable, invalid, and reduced-motion behavior.

## 14. Visual language and motif

### 14.1 Emotional tone

Quiet grandeur. The interface feels carved, assembled, repaired, and carried up the Spire. It is severe without becoming muddy, ornate without becoming noisy, and ancient without sacrificing interaction clarity.

### 14.2 Material language

- Soot-dark architecture and near-black voids.
- Worn dark wood and blackened iron.
- Oxidized brass and restrained gold leaf.
- Parchment, bone, ash, leather, mineral dust, and ember light.
- Fine etched borders, riveted joints, shallow bevels, and controlled surface wear.
- Soft directional light with restrained bloom around selected or sacred elements.

Avoid glossy fantasy UI, neon gradients, generic glassmorphism, clean SaaS cards, cartoon bevels, fake stone slabs on every control, or ornament that competes with content.

### 14.3 Palette behavior

- Near-black and deep umber own the background.
- Warm parchment owns primary readable text.
- Muted metal and ash own inactive structure.
- Gold is earned: selection, sacred objects, important receipts, rarity, and Stagger payoffs.
- Blood red communicates harm or Bleed.
- Blight orange/rot tones communicate corruption and Herald systems.
- Starstone blue-violet communicates arcane or Starseer systems.
- Oxidized green-grey supports Rogue identity.
- Focus and selection remain distinguishable without color alone.

### 14.4 Typography

- A licensed inscriptional serif such as Cinzel supports titles, class names, card names, and major section faces.
- A highly readable licensed text face supports body copy, receipts, tooltips, and controls.
- Numeric displays use tabular figures where comparison matters.
- Display typography remains restrained; all-caps is reserved for short labels and ritual headings.

### 14.5 Shape language

- Player classes use clean, closed, confident silhouettes.
- Broken-kingdom enemies use heavy triangles, squares, and fractured geometry.
- Blight uses ragged edges and organic curves.
- Ember and sacred systems use circles, halos, and controlled radiance.
- Cards read as documents; equipment reads as carried objects; trays read as field cases or mechanical folios.

### 14.6 Motion

- Folds, selections, and receipts move with restrained mechanical weight.
- Strong motion is reserved for threshold events, damage, reward, danger, and onboarding.
- Reduced-motion alternatives preserve all state communication.
- Motion never changes focus order, target geometry, or committed state.

## 15. Asset and provenance contract

Art and layout are independent. Components consume logical asset IDs or explicit asset records. Replacing an image, icon, texture, or typeface must not require markup changes.

### 15.1 Asset manifest entry

```json
{
  "id": "character/reaver/portrait/default",
  "kind": "image",
  "variants": {
    "resolution": ["1x", "2x"],
    "theme": ["ashen"],
    "accessibility": ["standard", "high-contrast"]
  },
  "sourceFiles": [],
  "fallbackId": "character/common/portrait/fallback",
  "preloadGroup": "character-creation",
  "license": {
    "owner": "",
    "sourceUrl": "",
    "licenseId": "",
    "attribution": "",
    "proofDate": ""
  },
  "provenance": {
    "method": "human | generated | licensed",
    "tool": "",
    "date": "",
    "promptSummary": "",
    "edits": ""
  }
}
```

### 15.2 Visible-art policy

- Use genuine raster assets, production 3D renders, or an established icon library with an allowed license.
- Do not ship emoji as primary visible art.
- Do not fake custom art with CSS drawings or improvised inline SVG silhouettes.
- Handcrafted SVG is acceptable only for functional geometry such as simple arrows when it is not presented as custom illustration and when the implementation policy permits it.
- Missing art falls back to an intentional licensed or first-party asset, never a blank box or broken URL.
- Every shipped asset requires provenance, license, attribution, modifications, and a proof/archive date.

### 15.3 Art production workflow

1. Approve silhouette and value grouping at gameplay size.
2. Establish the final crop, aspect ratio, and required negative space.
3. Produce non-destructive source art or a reproducible render.
4. Export optimized browser variants.
5. Review in the actual component at minimum and maximum supported scale.
6. Record provenance, license, and fallback.
7. Capture golden desktop and mobile screenshots.

## 16. Accessibility, input, and responsive behavior

### 16.1 Accessibility floor

- No mandatory distinction relies on color alone.
- Every interactive image has an accessible name or is correctly decorative.
- Focus-visible treatment is always present and distinct from selection.
- Tooltips and explanations are available without pointer hover.
- Text scaling changes text without unexpectedly scaling unrelated geometry.
- Reduced motion preserves sequence and outcome information.
- Live regions announce consequential selection, refusal, ownership movement, and completion where needed.
- Modals and overlays trap focus intentionally and restore it to the invoking control.

### 16.2 Input parity

- Pointer, touch, keyboard, and gamepad dispatch the same semantic actions.
- Confirm, Cancel, Menu, Continue, targeting, hold, drag, resize, and section navigation have one contract.
- Input glyphs reflect current bindings.
- A redraw preserves the focused semantic component when it still exists.
- Slow drag, short tap, long hold, and release behavior are explicitly separated.

### 16.3 Target sizes

Primary controls and drag/resize handles maintain a minimum 44 CSS-pixel target after UI scaling. Dense desktop layouts may visually compress internal ornament while preserving the interaction target.

### 16.4 Responsive forms

Desktop may use split-pane composition with preview and choices side by side. Mobile at approximately 390×844 uses a single-column progressive form, compact receipts, and one expanded secondary region at a time.

At both sizes:

- No horizontal overflow.
- Footer actions remain reachable.
- Expanded content owns a bounded scroll region.
- The selected object remains visible or is read back in its receipt.
- Text XL, long names, long binding labels, and refusal messages are standard test cases.

## 17. Rebuild architecture boundaries

The rebuild may target .NET and a component-based presentation stack, but the engine decision must be explicit before implementation. The following boundaries are mandatory regardless of framework:

- Simulation state is independent of the renderer.
- Domain rules are deterministic and headless.
- UI consumes read models and dispatches semantic commands.
- Browser or platform services sit behind interfaces.
- Assets are addressed by stable manifest IDs.
- Saves contain serializable domain state, not UI or renderer objects.
- Input mapping is centralized and configurable.
- Generated artifacts are reproducible projections, not hand-maintained authorities.

For a browser-first rebuild, text-heavy HUD, menus, character creation, Armoury, settings, and accessibility-sensitive controls should remain DOM-based unless a tested alternative provides equal semantics. The combat or map playfield may use DOM, Canvas, WebGL, or another renderer without owning gameplay state.

## 18. Data ownership and authoring

### 18.1 Authoritative data

Classes, attributes, starting kits, armour, armaments, equipment slots, requirements, relics, keepsakes, sigils, sprites, presentation options, and tuning are validated content records.

JSON is appropriate for nested configuration and presentation records. CSV is appropriate for authoring table-shaped content such as armaments, armour sets, slots, and requirements. Runtime code consumes normalized immutable catalogs.

### 18.2 No duplicate facts

- A player-visible number has one authoritative source.
- A choice label, requirement, ownership location, and asset ID have one owner.
- Receipts are derived from the rule that produced the outcome.
- Generated files are never hand-corrected to disagree with source.

### 18.3 Content validation

Validation rejects unknown fields, duplicate IDs, dangling references, invalid asset IDs, unsupported enum values, circular fallbacks, illegal equipment ownership, and impossible starting loadouts.

## 19. Saves, determinism, and lifecycle

- Checkpoint after every committed run choice.
- Persist independent named random streams or deterministic counters.
- Cosmetic randomness never perturbs simulation.
- Store explicit save-schema and content-manifest versions.
- Unsupported or corrupt saves are refused without destroying the last good copy.
- Navigation, backgrounding, remount, disconnect, and Save & Quit flush or cancel pending writes in a defined order.
- Character creation preserves valid customized values while clearly migrating or refusing invalid legacy state.

## 20. Audio and feedback

Audio communicates confirmation, refusal, danger, Guard, HP damage, resource changes, meter thresholds, reward collection, and navigation before it adds ambience.

- Mandatory information is never audio-only.
- Repeated cues have controlled variation and concurrency.
- Missing samples fall back gracefully.
- Reduced sensory settings soften impact without hiding outcomes.
- Music supports title, creation, map, standard combat, elite, boss phases, merchant, shrine, event, defeat, and victory contexts.
- Audio availability and playback never alter deterministic state.

## 21. Verification and evidence

No screen or component is production-ready from DOM inspection alone.

### 21.1 Automated evidence

- Domain and content validation.
- Save and migration tests.
- Ownership and hand-uniqueness tests.
- Component-model schema and serialization tests.
- Accessibility-state tests.
- Input-action parity tests.
- Asset-manifest, provenance, and fallback validation.
- Build and shipped-artifact identity checks.
- Responsive overflow and target-size checks.

### 21.2 Real-browser evidence

At minimum verify:

- 1440×900 desktop.
- Approximately 390×844 mobile portrait.
- Short landscape and Text XL stress cases.
- Pointer, keyboard, touch emulation, and gamepad-equivalent paths.
- Default, hover, focus-visible, active, selected, disabled, invalid, refusal, loading where applicable, and reduced-motion states.
- Every character-creation selector and transition.
- Left/Right hand movement and non-duplication.
- Folding, reopening, resize persistence, and scroll containment.
- No horizontal overflow or unreachable Continue/Begin actions.

Screenshots must be inspected visually after capture. A successful screenshot command does not prove a good image.

## 22. Rebuild delivery sequence

The rebuild should proceed in independently reviewable vertical slices.

1. **Contracts:** Domain vocabulary, command model, component model, tokens, asset manifest, and accessibility contract.
2. **Foundations:** Composition root, storage/audio/input interfaces, content loading, validation, deterministic seed services, and debug surfaces.
3. **UI primitives:** Buttons, cards, meters, tooltips, refusal, hold, disclosure, modal, split divider, tray, focus, and receipts.
4. **Character creation vertical slice:** Four classes, Character, Starting Equipment, Seed, Begin, saves, and responsive catalog evidence.
5. **Shared run HUD:** One composition consumed by Map and Combat.
6. **Armoury vertical slice:** Figure, sockets, one Inventory, Cards and Stats trays, equipment receipts, and ownership invariants.
7. **Map and run flow:** Deterministic map, nodes, rewards, merchant, shrine, event, and checkpoints.
8. **Combat vertical slice:** Intent, hand, targeting, actions, statuses, Poise, feedback timeline, and victory/defeat.
9. **Content migration:** Classes, cards, relics, flasks, enemies, encounters, acts, and balance.
10. **Polish and release evidence:** Production assets, audio, accessibility stress cells, performance, golden screenshots, build provenance, and independent review.

Each slice must state what changed, what was migrated, what was tested, which screenshots were inspected, and what remains untested. A clean local check does not imply merge, release, publication, or deployment authority.

## 23. Rebuild acceptance baseline

The first rebuild milestone is acceptable when:

- The game fantasy, player verbs, four current classes, and core loop are preserved.
- Character creation uses the required progressive order and one shared Inventory.
- Equipment ownership is explicit and hand-safe.
- Components receive content and art through explicit records or props.
- A replacement asset requires no component-markup rewrite.
- The dark medieval brown/gold motif is coherent without generic dashboard styling.
- The component catalog demonstrates representative interaction states.
- Accessibility and input semantics are defined before screen-specific shortcuts.
- Desktop and approximately 390×844 mobile screenshots have been visually inspected.
- No protected checkout, remote repository, branch, pull request, release, or deployment has been mutated without separate explicit authority.

## 24. Open decisions before implementation

These choices remain explicit rebuild gates:

1. Final runtime and presentation stack for the .NET-oriented rebuild.
2. Whether the existing vanilla JavaScript game remains the behavioral oracle, a maintained product, or a migration source only.
3. Final production-art sourcing mix: first-party rendered, commissioned, generated, and licensed library assets.
4. The authoritative naming and coding convention document referred to as the Dimitar convention; it must be supplied or written before enforcement.
5. Which co-op features belong in the first rebuild milestone versus preserved extension seams.
6. Final localization scope and whether display text ships as keyed content from the first milestone.

Until these choices are made, choose reversible interfaces and avoid framework-specific domain dependencies.

## Appendix A — superseded statements

- Any statement that Ashen Spire has only three playable classes is superseded; Rogue is the fourth current class.
- Old class names and pre-IP-scrub vocabulary are historical references only.
- Inline emoji, CSS drawings, and handcrafted silhouette SVGs may describe the old placeholder system but are not the production-art target for the rebuild.
- Separate Map and Combat HUD markup is superseded by one shared HUD composition.
- Duplicate Inventory surfaces are defects; Character Creation and Armoury use one ownership model.
- Visual experiments are configurations over shared semantic components, not separate screens with independent behavior.

## Appendix B — source basis

This revision was reconciled against the current AshenSpire README, CHANGELOG, SPEC, rebuild PROMPT, DEVELOPER guide, CREDITS ledger, original GDD, component catalog, component-model architecture, folding-tray contract, current class/attribute/equipment source, and the available AshenSpire task history as of 2026-08-23.
