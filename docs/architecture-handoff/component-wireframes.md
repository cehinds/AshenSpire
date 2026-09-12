# Shared component wireframes

WP identifiers describe composable parts, not additional screen families. Every part receives an immutable view model and owner interaction state. WC0/WC4 and W1w compose these same components; context controls visibility and placement. Dimensions are shared configurable proposals.

## Wireframe W1x: Proficiencies

**Parent: W1.** Use cases: Character profile and post-combat progression review. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌──────────────────────────────────────────────┐
│ Proficiencies                             [×] │
├──────────┬────────────┬───────────────────────┤
│ Weapons  │ Swords  3  │ Swords · Rank 3       │
│ Skills   │ Bows    2  │ [Progress──────────]  │
│          │            │ Next benefit          │
│          │            │ Known techniques      │
│          │            │ Recent practice       │
├──────────┴────────────┴───────────────────────┤
│ [                  Back                   ] │
└──────────────────────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x.root | config.progression.layout.width | config.progression.layout.height | owning component slot | W0 title/exit/footer anchors | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x.root | config.progression.layout.width | config.progression.layout.height | owning component slot | W0 title/exit/footer anchors | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x.root | config.progression.layout.width | config.progression.layout.height | owning component slot | W0 title/exit/footer anchors | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x.root | config.progression.layout.width | config.progression.layout.height | owning component slot | W0 title/exit/footer anchors | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT character knowledge, progression projection, config.progression
// Category and proficiency selection are presentation state, not progression mutations.
category = ResolveCategoryOrDefault(config.progression.categories, config.progression.defaultCategory)
entries = ProjectKnownProficiencies(character, category)
selected = ResolveStableSelection(entries)
ComposeW1Shell(title=config.progression.labels.title)
Compose(WGP1, entries); Compose(WGP2, selected); Compose(WGP3, selected); Compose(WGP4, selected)
// Compact hosts replace navigation columns with dropdowns; retain the same selected ID.
AdaptNavigationToHost(config.progression.layout.compactBreakpoint)
RenderOnlyKnownBenefitsAndTechniques(character.knowledge)
If config.progression.showHistory: RenderOrderedPracticeEvents(selected)
// Back is the sole production footer command and therefore fills the footer.
Compose(WCB4, width=AvailableFooterWidth())
// Preview award is outside the game frame and changes only cloned fixture state.
If config.progression.allowPreviewAward: ExposePreviewAward(config.progression.previewAward)
// Each viewport gets isolated preview state; controls stay outside the game frame.
instance = ClonePresentationState(config.progression)
ExposeInstanceControls(instance.showLockedTechniques, instance.showHistory, instance.previewAward)
OnPreviewControlChange: ReprojectOnlyThisInstance(instance)
OnResetPreview: RestoreThisInstanceDefaults(config.progression)
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe W1x1: Weapon proficiency

**Parent: W1x.** Use cases: Weapons category; same workspace model. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌──────────────────────────────────────────────┐
│ Proficiencies                             [×] │
├──────────┬────────────┬───────────────────────┤
│ Weapons  │ Swords  3  │ Swords · Rank 3       │
│ Skills   │ Bows    2  │ [Progress──────────]  │
│          │            │ Next benefit          │
│          │            │ Known techniques      │
│          │            │ Recent practice       │
├──────────┴────────────┴───────────────────────┤
│ [                  Back                   ] │
└──────────────────────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x1.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x1.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x1.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x1.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT character knowledge, progression projection, config.progression
// Category and proficiency selection are presentation state, not progression mutations.
category = ResolveCategoryOrDefault(config.progression.categories, config.progression.defaultCategory)
entries = ProjectKnownProficiencies(character, category)
selected = ResolveStableSelection(entries)
ComposeW1Shell(title=config.progression.labels.title)
Compose(WGP1, entries); Compose(WGP2, selected); Compose(WGP3, selected); Compose(WGP4, selected)
// Compact hosts replace navigation columns with dropdowns; retain the same selected ID.
AdaptNavigationToHost(config.progression.layout.compactBreakpoint)
RenderOnlyKnownBenefitsAndTechniques(character.knowledge)
If config.progression.showHistory: RenderOrderedPracticeEvents(selected)
// Back is the sole production footer command and therefore fills the footer.
Compose(WCB4, width=AvailableFooterWidth())
// Preview award is outside the game frame and changes only cloned fixture state.
If config.progression.allowPreviewAward: ExposePreviewAward(config.progression.previewAward)
// Each viewport gets isolated preview state; controls stay outside the game frame.
instance = ClonePresentationState(config.progression)
ExposeInstanceControls(instance.showLockedTechniques, instance.showHistory, instance.previewAward)
OnPreviewControlChange: ReprojectOnlyThisInstance(instance)
OnResetPreview: RestoreThisInstanceDefaults(config.progression)
SelectCategory(config.progression.categoryIds.weapons) // Bind configured category ID, not a mechanics rule.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe W1x2: Skill proficiency

**Parent: W1x.** Use cases: Skills category; same workspace model. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌──────────────────────────────────────────────┐
│ Proficiencies                             [×] │
├──────────┬────────────┬───────────────────────┤
│ Weapons  │ Swords  3  │ Swords · Rank 3       │
│ Skills   │ Bows    2  │ [Progress──────────]  │
│          │            │ Next benefit          │
│          │            │ Known techniques      │
│          │            │ Recent practice       │
├──────────┴────────────┴───────────────────────┤
│ [                  Back                   ] │
└──────────────────────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x2.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x2.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x2.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌───────────────────────────┐
│ Proficiencies          [×] │
│ [Weapons ▾]  [Swords ▾]   │
├───────────────────────────┤
│ Swords · Rank 3           │
│ [Progress──────────────]  │
│ Next benefit              │
│ Known techniques          │
│ Recent practice           │
├───────────────────────────┤
│ [         Back          ] │
└───────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| W1x2.root | parent body width | parent body height | owning component slot | W1x active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT character knowledge, progression projection, config.progression
// Category and proficiency selection are presentation state, not progression mutations.
category = ResolveCategoryOrDefault(config.progression.categories, config.progression.defaultCategory)
entries = ProjectKnownProficiencies(character, category)
selected = ResolveStableSelection(entries)
ComposeW1Shell(title=config.progression.labels.title)
Compose(WGP1, entries); Compose(WGP2, selected); Compose(WGP3, selected); Compose(WGP4, selected)
// Compact hosts replace navigation columns with dropdowns; retain the same selected ID.
AdaptNavigationToHost(config.progression.layout.compactBreakpoint)
RenderOnlyKnownBenefitsAndTechniques(character.knowledge)
If config.progression.showHistory: RenderOrderedPracticeEvents(selected)
// Back is the sole production footer command and therefore fills the footer.
Compose(WCB4, width=AvailableFooterWidth())
// Preview award is outside the game frame and changes only cloned fixture state.
If config.progression.allowPreviewAward: ExposePreviewAward(config.progression.previewAward)
// Each viewport gets isolated preview state; controls stay outside the game frame.
instance = ClonePresentationState(config.progression)
ExposeInstanceControls(instance.showLockedTechniques, instance.showHistory, instance.previewAward)
OnPreviewControlChange: ReprojectOnlyThisInstance(instance)
OnResetPreview: RestoreThisInstanceDefaults(config.progression)
SelectCategory(config.progression.categoryIds.skills) // Bind configured category ID, not a mechanics rule.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB0: Buttons and inspection

**Parent: none.** Use cases: Buttons and inspection reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Header  Title                         [×]
Owner               (i)
Footer  [Back]                   [Confirm]
Selected card       [Context action]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Header  Title                         [×]
Owner               (i)
Footer  [Back]                   [Confirm]
Selected card       [Context action]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Header  Title                         [×]
Owner               (i)
Footer  [Back]                   [Confirm]
Selected card       [Context action]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Header  Title                         [×]
Owner               (i)
Footer  [Back]                   [Confirm]
Selected card       [Context action]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve every control through the shared action contract. Keep footer actions inline; sole action spans its footer. Inherit focus, disabled, busy, selected, and semantic role tokens.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB1: Inspect control

**Parent: WCB0.** Use cases: Every selectable card, combatant, inventory tile. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
              (i)
               │ center anchor
         selected owner
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
              (i)
               │ center anchor
         selected owner
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
              (i)
               │ center anchor
         selected owner
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
              (i)
               │ center anchor
         selected owner
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Schedule visibility with config.selection.revealDelayMs. Open knowledge-filtered W1w on activation; stop owner activation propagation and restore source focus on dismissal.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB2: Context action

**Parent: WCB0.** Use cases: Selected card host or modal footer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
          selected card
           [ Use ] ← outside card footer
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
          selected card
           [ Use ] ← outside card footer
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
          selected card
           [ Use ] ← outside card footer
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
          selected card
           [ Use ] ← outside card footer
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project domain action and readiness. Omit absent actions. Await required target when applicable; revalidate once on commit. Never place Use inside metadata footer.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB3: Primary / confirmation button

**Parent: WCB0.** Use cases: Modal confirmation, contextual Use/Play/Equip. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Footer right      [Confirm]
Sole action       [       Confirm       ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Footer right      [Confirm]
Sole action       [       Confirm       ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Footer right      [Confirm]
Sole action       [       Confirm       ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Footer right      [Confirm]
Sole action       [       Confirm       ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Bind model.label and model.intent. Ready and focused primary uses configured green; disabled and busy states take precedence. Revalidate command at activation.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB4: Back / cancel button

**Parent: WCB0.** Use cases: W0 modal footers and cancellation. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Footer left [Back]        [Primary]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Footer left [Back]        [Primary]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Footer left [Back]        [Primary]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Footer left [Back]        [Primary]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Apply shared action contract with dismissal role. Use configured danger highlight on focus and pointer hover. Cancel presentation state and restore originating focus.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB5: Exit button

**Parent: WCB0.** Use cases: Shared modal header. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Title                     [×] ← top-right
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Title                     [×] ← top-right
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Title                     [×] ← top-right
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Title                     [×] ← top-right
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Use Close accessible label and shared dismissal policy. Respect pending modal decisions. Keep aligned to the header inset.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF0: Component foundations

**Parent: none.** Use cases: Component foundations reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
MODEL → CONTRACT → VIEW
                ↘ Selection / active stack / inspector facts
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
MODEL → CONTRACT → VIEW
                ↘ Selection / active stack / inspector facts
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
MODEL → CONTRACT → VIEW
                ↘ Selection / active stack / inspector facts
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
MODEL → CONTRACT → VIEW
                ↘ Selection / active stack / inspector facts
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project immutable values; validate registered component; compose contract, state projection, selection, and facts.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF1: Component contract

**Parent: WCF0.** Use cases: All card and combatant parts. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Immutable model ──► validated component
Owner state ──────► presentation
Activation ───────► semantic intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Immutable model ──► validated component
Owner state ──────► presentation
Activation ───────► semantic intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Immutable model ──► validated component
Owner state ──────► presentation
Activation ───────► semantic intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Immutable model ──► validated component
Owner state ──────► presentation
Activation ───────► semantic intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Validate required identity and provider fields. Resolve inherited tokens. Render only active providers. Dispatch semantic intents without changing domain state.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF2: Ordered active stack

**Parent: WCF0.** Use cases: Combatant lower region. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
HP        [████████░░]
Resource  [██████░░░░]  if active
Buildup   [██████░░░░]  if budget admits
Stance    [Aggressive]  if active
Effects   [✚][☠][↓][+N] if present
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
HP        [████████░░]
Resource  [██████░░░░]  if active
Buildup   [██████░░░░]  if budget admits
Stance    [Aggressive]  if active
Effects   [✚][☠][↓][+N] if present
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP        [████████░░]
Resource  [██████░░░░]  if active
Buildup   [██████░░░░]  if budget admits
Stance    [Aggressive]  if active
Effects   [✚][☠][↓][+N] if present
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP        [████████░░]
Resource  [██████░░░░]  if active
Buildup   [██████░░░░]  if budget admits
Stance    [Aggressive]  if active
Effects   [✚][☠][↓][+N] if present
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Filter inactive providers before sorting by configured order. Reserve HP, present stance and icon row. Admit optional bars within config.meter.maxRows. Convert excess buildup to progress icons; collapse absent rows and gaps.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF3: Selection effect

**Parent: WCF0.** Use cases: All selectable cards and combatants. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
              (i) ← delayed reveal
  glow ╭────────────────────╮
       │ entire owner       │
       │ art + name + parts │
       ╰────────────────────╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
              (i) ← delayed reveal
  glow ╭────────────────────╮
       │ entire owner       │
       │ art + name + parts │
       ╰────────────────────╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
              (i) ← delayed reveal
  glow ╭────────────────────╮
       │ entire owner       │
       │ art + name + parts │
       ╰────────────────────╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
              (i) ← delayed reveal
  glow ╭────────────────────╮
       │ entire owner       │
       │ art + name + parts │
       ╰────────────────────╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Observe owner selection once. Apply inherited glow to the entire visible assembly. Reveal inspect after config.selection.revealDelayMs. Cancel pending reveal on deselection and disposal.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF4: Inspector facts

**Parent: WCF0.** Use cases: W1w right pane. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
HP 32/40   Intent Attack 12   Defense 8
Current state   Mana 6/10 · Aggressive
Previous actions  Attack → Defend
Known abilities   Cleave
Known traits      Fire weakness
Lore              Knowledge-filtered prose
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
HP 32/40   Intent Attack 12   Defense 8
Current state   Mana 6/10 · Aggressive
Previous actions  Attack → Defend
Known abilities   Cleave
Known traits      Fire weakness
Lore              Knowledge-filtered prose
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP 32/40   Intent Attack 12   Defense 8
Current state   Mana 6/10 · Aggressive
Previous actions  Attack → Defend
Known abilities   Cleave
Known traits      Fire weakness
Lore              Knowledge-filtered prose
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP 32/40   Intent Attack 12   Defense 8
Current state   Mana 6/10 · Aggressive
Previous actions  Attack → Defend
Known abilities   Cleave
Known traits      Fire weakness
Lore              Knowledge-filtered prose
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project known values using registered detail providers. Render shared label/value columns in declared section order. Unknown is distinct from absent. Preserve one independently scrolling details pane.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI0: Identity and artwork

**Parent: none.** Use cases: Identity and artwork reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Name
┌──────── Artwork ────────┐
│    intrinsic ratio     │
└────────────────────────┘
Rarity             Owned
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Name
┌──────── Artwork ────────┐
│    intrinsic ratio     │
└────────────────────────┘
Rarity             Owned
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Name
┌──────── Artwork ────────┐
│    intrinsic ratio     │
└────────────────────────┘
Rarity             Owned
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Name
┌──────── Artwork ────────┐
│    intrinsic ratio     │
└────────────────────────┘
Rarity             Owned
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose identity, contained artwork, and metadata only where the owner contract provides their slots. Do not copy the owner domain model into leaf state.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI1: Nameplate

**Parent: WCI0.** Use cases: Card header, combatant above HP, inspector title. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       Ashen Sentinel
       [ HP 32 / 40 ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       Ashen Sentinel
       [ HP 32 / 40 ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       Ashen Sentinel
       [ HP 32 / 40 ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       Ashen Sentinel
       [ HP 32 / 40 ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve localized display name from the identity provider; render text safely. Anchor to owner name slot immediately above HP for combatants.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI2: Sprite / artwork

**Parent: WCI0.** Use cases: Playing card art, combatant sprite, inspector preview. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
     ╭─ sprite bounds ─╮
     │      ◯          │
     │     ╱│╲         │
     │     ╱ ╲         │
     ╰──── baseline ───╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
     ╭─ sprite bounds ─╮
     │      ◯          │
     │     ╱│╲         │
     │     ╱ ╲         │
     ╰──── baseline ───╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
     ╭─ sprite bounds ─╮
     │      ◯          │
     │     ╱│╲         │
     │     ╱ ╲         │
     ╰──── baseline ───╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
     ╭─ sprite bounds ─╮
     │      ◯          │
     │     ╱│╲         │
     │     ╱ ╲         │
     ╰──── baseline ───╯
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve asset and pose from the registry. Preserve intrinsic aspect ratio in allocated bounds. Mirror artwork for facing; do not mirror text or controls.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI3: Metadata footer

**Parent: WCI0.** Use cases: Item and playing-card footer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Common                     Owned: 1
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Common                     Owned: 1
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Common                     Owned: 1
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Common                     Owned: 1
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project applicable metadata. Place rarity at start and ownership at end of the card metadata band. No domain action belongs in this band.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM0: Meters and statuses

**Parent: none.** Use cases: Meters and statuses reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
HP      [████████░░] 32/40
Mana    [██████░░░░]  6/10
Buildup [██████░░░░] 65/100
Stance  [  Aggressive  ]
Icons   [✚][☠][↓][+N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
HP      [████████░░] 32/40
Mana    [██████░░░░]  6/10
Buildup [██████░░░░] 65/100
Stance  [  Aggressive  ]
Icons   [✚][☠][↓][+N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP      [████████░░] 32/40
Mana    [██████░░░░]  6/10
Buildup [██████░░░░] 65/100
Stance  [  Aggressive  ]
Icons   [✚][☠][↓][+N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP      [████████░░] 32/40
Mana    [██████░░░░]  6/10
Buildup [██████░░░░] 65/100
Stance  [  Aggressive  ]
Icons   [✚][☠][↓][+N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose the same meter primitive for health, resource and buildup with semantic model metadata. Stance and icons use shared tokens and active filtering.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM1: Health meter

**Parent: WCM0.** Use cases: Combatants and inspector preview. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HP ████████░░ 32 / 40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HP ████████░░ 32 / 40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HP ████████░░ 32 / 40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HP ████████░░ 32 / 40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Read model.current and model.maximum. Clamp visual fill to valid display range, preserve original domain values. Provide accessible current and maximum labels.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM2: Resource meter

**Parent: WCM0.** Use cases: Active combatant resource rows, inspector facts. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Mana ██████░░░░ 6 / 10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Mana ██████░░░░ 6 / 10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Mana ██████░░░░ 6 / 10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Mana ██████░░░░ 6 / 10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Render only active resource providers in configured priority. Set height to config.meter.secondaryHeightRatio times HP height. Reuse meter semantics and color registry.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM3: Buildup meter

**Parent: WCM0.** Use cases: Threshold progress, overflow status icon. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Burn buildup ██████░░░░ 65 / 100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Burn buildup ██████░░░░ 65 / 100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Burn buildup ██████░░░░ 65 / 100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Burn buildup ██████░░░░ 65 / 100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Use threshold progress model distinct from status duration. Render admitted bars at configured secondary height; otherwise project a progress icon with stable identity.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM4: Stance strip

**Parent: WCM0.** Use cases: Active combatant stance and inspector fact. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[          Aggressive          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[          Aggressive          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[          Aggressive          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[          Aggressive          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Show active stance only. Set width equal to HP and height from config.meter.stanceHeightRatio. The informational strip does not issue a stance change.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM5: Status icon

**Parent: WCM0.** Use cases: Active effects and overflow buildup. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[☠]  ← icon only; details in tooltip
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[☠]  ← icon only; details in tooltip
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[☠]  ← icon only; details in tooltip
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[☠]  ← icon only; details in tooltip
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Use configured square icon size, icon asset and accessible name. Schedule shared tooltip for stacks, duration and effect description. Do not print extra counters inside icon boxes.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM6: Icon overflow

**Parent: WCM0.** Use cases: Crowded status rows. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[✚][☠][↓][+N] ← final reserved tile
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[✚][☠][↓][+N] ← final reserved tile
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[✚][☠][↓][+N] ← final reserved tile
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[✚][☠][↓][+N] ← final reserved tile
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Measure available inline width and configured icon size and gap. If overflow exists, reserve final tile; N equals hidden count. Open complete inspector status section; never wrap into another row.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO0: Combat overlays

**Parent: none.** Use cases: Combat overlays reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
         Intent
      ┌─ aura ───┐
      │ sprite  │  Defense ← midpoint
      │ + buff  │
      └─────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
         Intent
      ┌─ aura ───┐
      │ sprite  │  Defense ← midpoint
      │ + buff  │
      └─────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
         Intent
      ┌─ aura ───┐
      │ sprite  │  Defense ← midpoint
      │ + buff  │
      └─────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
         Intent
      ┌─ aura ───┐
      │ sprite  │  Defense ← midpoint
      │ + buff  │
      └─────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose active layers around a shared sprite rectangle. Keep effect layers noninteractive and controls above effects. Resolve role-facing placement from configuration.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO1: Intent indicator

**Parent: WCO0.** Use cases: Active announced combatant intent. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       (i)
   [⚔ Attack · 12]
      sprite
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       (i)
   [⚔ Attack · 12]
      sprite
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       (i)
   [⚔ Attack · 12]
      sprite
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       (i)
   [⚔ Attack · 12]
      sprite
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Require active announced intent and configured role visibility. Project preview supplied by domain; never reproduce AI calculations. Place below inspect above sprite.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO2: Defense badge

**Parent: WCO0.** Use cases: Active combatant block/defense. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
 sprite             [◇ 8]
         ← gap →    midpoint
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
 sprite             [◇ 8]
         ← gap →    midpoint
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
 sprite             [◇ 8]
         ← gap →    midpoint
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
 sprite             [◇ 8]
         ← gap →    midpoint
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Show active defense only. Anchor at config.overlay.defenseAnchorRatio of sprite height with config.overlay.defenseGapRem external gap. Player right, enemy left.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO3: Aura layer

**Parent: WCO0.** Use cases: Tag-driven combatant visual effects. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌── full sprite bounds ──┐
│ aura behind artwork   │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌── full sprite bounds ──┐
│ aura behind artwork   │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌── full sprite bounds ──┐
│ aura behind artwork   │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌── full sprite bounds ──┐
│ aura behind artwork   │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve active effect provider. Fill complete sprite bounds behind artwork. Omit absent effect; never intercept pointer input or create domain buffs.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO4: Buff layer

**Parent: WCO0.** Use cases: Active buff visual layer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌── full sprite bounds ──┐
│ buff above artwork    │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌── full sprite bounds ──┐
│ buff above artwork    │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌── full sprite bounds ──┐
│ buff above artwork    │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌── full sprite bounds ──┐
│ buff above artwork    │
│                       │
└───────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve active buff visual provider. Cover full sprite height above artwork beneath controls. Respect reduced motion and disposal lifecycle.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCT0: Tooltip components

**Parent: none.** Use cases: Tooltip components reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ Trigger ] ── delay ──► ┌ Tooltip ┐
                         │ detail  │
                         └────▽────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ Trigger ] ── delay ──► ┌ Tooltip ┐
                         │ detail  │
                         └────▽────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ Trigger ] ── delay ──► ┌ Tooltip ┐
                         │ detail  │
                         └────▽────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ Trigger ] ── delay ──► ┌ Tooltip ┐
                         │ detail  │
                         └────▽────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Reuse one tooltip presenter with configured size variant and placement policy. Keep tooltips in current modal overlay layer.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCT1: Tooltip presenter

**Parent: WCT0.** Use cases: Tags, status/intent/defense explanations. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌ Poison ────────────────────┐
│ Damage over time.          │
│ 3 stacks · 2 turns         │
└────────────▽───────────────┘
             [☠]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌ Poison ────────────────────┐
│ Damage over time.          │
│ 3 stacks · 2 turns         │
└────────────▽───────────────┘
             [☠]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌ Poison ────────────────────┐
│ Damage over time.          │
│ 3 stacks · 2 turns         │
└────────────▽───────────────┘
             [☠]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌ Poison ────────────────────┐
│ Damage over time.          │
│ 3 stacks · 2 turns         │
└────────────▽───────────────┘
             [☠]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// On hover or focus schedule after config.selection.tooltipDelayMs. Cancel stale requests, flip and shift to viewport bounds, dismiss on Escape or outside activation.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC0: Combat composition

**Parent: none.** Use cases: Combat composition reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Shared HUD
Battlefield: player →   ← enemies
Hand: [card] [card] [card]
(A)[Draw][End turn][Discard](P)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Shared HUD
Battlefield: player →   ← enemies
Hand: [card] [card] [card]
(A)[Draw][End turn][Discard](P)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Shared HUD
Battlefield: player →   ← enemies
Hand: [card] [card] [card]
(A)[Draw][End turn][Discard](P)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Shared HUD
Battlefield: player →   ← enemies
Hand: [card] [card] [card]
(A)[Draw][End turn][Discard](P)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose shared HUD, stage, hand and footer using scene band config. Child modules receive the same immutable snapshot and emit domain intents through the host dispatcher.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC1: Battlefield stage

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌ Skyline / floor ──────────────┐
│                              │
│ Player →      ← Foe  ← Foe   │
└──────── shared baseline ─────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌ Skyline / floor ──────────────┐
│                              │
│ Player →      ← Foe  ← Foe   │
└──────── shared baseline ─────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌ Skyline / floor ──────────────┐
│                              │
│ Player →      ← Foe  ← Foe   │
└──────── shared baseline ─────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌ Skyline / floor ──────────────┐
│                              │
│ Player →      ← Foe  ← Foe   │
└──────── shared baseline ─────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project authored formation slots from host size and stable actor IDs. Compose player and enemy WC4 instances on the same baseline above background with target overlay.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC2: Player placement

**Parent: WC4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Player slot →
   sprite          defense
   name
   HP / active stack
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Player slot →
   sprite          defense
   name
   HP / active stack
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player slot →
   sprite          defense
   name
   HP / active stack
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player slot →
   sprite          defense
   name
   HP / active stack
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Allocate the player slot and render shared combatant card with player-facing context. Intent is hidden by role default but configurable. Preserve sprite proportions.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC3: Enemy placements

**Parent: WC4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       ← Enemy       ← Enemy
       sprite        sprite
       name / HP     name / HP
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       ← Enemy       ← Enemy
       sprite        sprite
       name / HP     name / HP
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       ← Enemy       ← Enemy
       sprite        sprite
       name / HP     name / HP
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       ← Enemy       ← Enemy
       sprite        sprite
       name / HP     name / HP
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project stable enemy IDs to authored slots. Render the same combatant component with enemy-facing context and active intent; do not mirror controls or names.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC4: Target layer

**Parent: WCF3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Player       [eligible enemy]   unavailable
                    ↑ active target outline
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Player       [eligible enemy]   unavailable
                    ↑ active target outline
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player       [eligible enemy]   unavailable
                    ↑ active target outline
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player       [eligible enemy]   unavailable
                    ↑ active target outline
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Use domain-eligible entity IDs for hit regions and keyboard navigation. Highlight eligible and selected targets without selecting impossible targets. Clear stale selection on model change.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC5: Hand region

**Parent: WC1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Attack] [Skill] [Power]
    proportional cards, shared selection
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Attack] [Skill] [Power]
    proportional cards, shared selection
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Attack] [Skill] [Power]
    proportional cards, shared selection
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Attack] [Skill] [Power]
    proportional cards, shared selection
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project stable hand cards through the shared WC1 renderer. Use configured spacing and card ratio; fit/paginate when minimum readable width cannot fit. Do not implement draw or damage logic here.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC6: Packed action footer

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
(Actions)[Draw][ End turn ][Discard](Potions)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
(Actions)[Draw][ End turn ][Discard](Potions)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
(Actions)[Draw][ End turn ][Discard](Potions)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
(Actions)[Draw][ End turn ][Discard](Potions)
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose controls in configured order as one tightly packed centered group. Large outer circles and center control share size token; empty non-End-turn controls fade.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC7: Actions remaining

**Parent: WCM2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
  ( 3 )
 Actions
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
  ( 3 )
 Actions
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
  ( 3 )
 Actions
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
  ( 3 )
 Actions
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Read remaining actions from snapshot. Use large circular control size. Empty state fades and is announced accessibly; display does not spend actions.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC8: Draw pile button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Draw · 12] → shared pile workspace
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Draw · 12] → shared pile workspace
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Draw · 12] → shared pile workspace
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Draw · 12] → shared pile workspace
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Open draw pile inspector on activation. Use current pile count; no invented draw-card command. Empty state follows configured faded styling.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC9: End turn button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ End turn ]  ← center / large
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ End turn ]  ← center / large
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ End turn ]  ← center / large
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ End turn ]  ← center / large
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project turn readiness. Highlight green when legal and remaining actions exhausted or selected. Never fade solely because actions are empty. Revalidate end-turn command on activation.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC10: Discard/exhaust button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Discard · 4 / Exhaust · 1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Discard · 4 / Exhaust · 1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Discard · 4 / Exhaust · 1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Discard · 4 / Exhaust · 1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Open shared categorized pile workspace with selected category. Counts come from snapshot; preserve one control between End turn and Potions.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC11: Potion control

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
(Potions)
  [HP ×2]
  [MP ×1]
  [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
(Potions)
  [HP ×2]
  [MP ×1]
  [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
(Potions)
  [HP ×2]
  [MP ×1]
  [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
(Potions)
  [HP ×2]
  [MP ×1]
  [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Open shared WGH8 contents inside the Potions control: charge flasks and carried consumables are entries in one projection, never sibling HUD buttons. Resolve selected item action and target through domain. Use the shared large circular footer control and fade empty state.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH0: HUD composition contract

**Parent: WCF2.** Use cases: WGH4 concrete composition; WGS2 shared scene slot. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[WGH7 Run header]
[WGH1 Vitality] [WGH2 Armoury] [WGH3 Menu]
[WGH6 Relics rail]
[WGH5 Experience strip when configured]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH0.root | 100% host width | content-fit within configured scene band | owning component slot | scene top; shared parent bounds | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[WGH7 Run header]
[WGH1 Vitality] [WGH2 Armoury] [WGH3 Menu]
[WGH6 Relics rail]
[WGH5 Experience strip when configured]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH0.root | 100% host width | content-fit within configured scene band | owning component slot | scene top; shared parent bounds | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[WGH7 Run header]
[WGH1 Vitality] [WGH2 Armoury] [WGH3 Menu]
[WGH6 Relics rail]
[WGH5 Experience strip when configured]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH0.root | 100% host width | content-fit within configured scene band | owning component slot | scene top; shared parent bounds | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[WGH7 Run header]
[WGH1 Vitality] [WGH2 Armoury] [WGH3 Menu]
[WGH6 Relics rail]
[WGH5 Experience strip when configured]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH0.root | 100% host width | content-fit within configured scene band | owning component slot | scene top; shared parent bounds | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT snapshot, context, config, commandRegistry
// This is a reference projection. Never award XP or spend inventory in a view.
model = ProjectKnownHudFields(snapshot, config.sample)
visible = FilterConfiguredActiveLayers(model, config.layers)
// Collapsed layers leave no reserved row or gap.
ComposeHeader(visible.class, visible.cinders, visible.position)
ComposePrimaryRow(visible.vitality, visible.armoury, visible.menu)
// One Potions control owns flask charges and carried consumables.
potionEntries = ProjectPotions(snapshot, visible.chargeFlasks, visible.potions)
ComposeDetachedRail(visible.relics)
// Top HUD never renders Potions in either preset. Footer owns WGC11.
PublishFooterPotionsModel(config.potions.componentId, potionEntries)
// HP, MP and Smoke vial are revealed inside the FOOTER Potions control only.
OnPotionsActivate: OpenSharedPotionContents(potionEntries)
OnPotionChoice: EmitRegisteredUseIntent(); DomainRevalidatesReadiness()
IF visible.experience AND context IN config.experience.contexts
  RenderExperienceStrip(model.experience, config.experience)
// XP animation consumes an authoritative before/after settlement event.
ON combatSettled(event): AnimateProjectedFill(event.before, event.after, config.experience.animationMs)
ON action(intent): commandRegistry.dispatch(intent)
ON configurationChanged: ReprojectAndRender(); RestoreFocusedControl()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH1: Vitality HUD

**Parent: WCF2.** Use cases: WGH4; WGS2; combat and map HUD. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
HP      [████░]                 32 / 40
Mana    [██████░░░░]    6 / 10
Stamina [████████░░]    8 / 10
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH1.root | remaining primary row width | active meters × config.layout.meterHeightRem | owning component slot | primary row left; align meter edges | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
HP      [████░]                 32 / 40
Mana    [██████░░░░]    6 / 10
Stamina [████████░░]    8 / 10
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH1.root | remaining primary row width | active meters × config.layout.meterHeightRem | owning component slot | primary row left; align meter edges | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP      [████░]                 32 / 40
Mana    [██████░░░░]    6 / 10
Stamina [████████░░]    8 / 10
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH1.root | remaining primary row width | active meters × config.layout.meterHeightRem | owning component slot | primary row left; align meter edges | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP      [████░]                 32 / 40
Mana    [██████░░░░]    6 / 10
Stamina [████████░░]    8 / 10
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH1.root | remaining primary row width | active meters × config.layout.meterHeightRem | owning component slot | primary row left; align meter edges | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT resource snapshot, config.vitality, availableWidth
// Current source resourceBarPlan separates track length from fill.
FOR each configured active resource
  reference = config.vitality.referenceMaximum[resource.id]
  allowedWidth = availableWidth * PercentFraction(config.vitality.maximumWidthPercent)
  trackWidth = IF config.vitality.scaleByMaximum THEN ClampToHost(resource.maximum / reference * allowedWidth) ELSE allowedWidth
  fillWidth = SafeProgressFraction(resource.current, resource.maximum) * trackWidth
  RenderTrack(trackWidth); RenderFill(fillWidth)
  RenderExternalValue(resource.current, resource.maximum)
// Current/max label occupies a shared outside column, never squeezed inside a short track.
// Reference maximum caps presentation width only; never caps domain maximum or value.
// Proposed reference defaults: read config; current source uses different mana/stamina references.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH2: Armoury control

**Parent: WCB2.** Use cases: WGH4 primary row; equipment workspace. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ ⚔ Armoury ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH2.root | content-fit | config.layout.actionHeightRem | owning component slot | right of vitality; before Menu | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ ⚔ Armoury ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH2.root | content-fit | config.layout.actionHeightRem | owning component slot | right of vitality; before Menu | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ ⚔ Armoury ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH2.root | content-fit | config.layout.actionHeightRem | owning component slot | right of vitality; before Menu | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ ⚔ Armoury ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH2.root | content-fit | config.layout.actionHeightRem | owning component slot | right of vitality; before Menu | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Reuse WCB2. Project armoury command readiness; dispatch openArmoury intent. No loadout mutation in this control.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH3: Menu control

**Parent: WCB2.** Use cases: WGH4 primary row; quick menu. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ ☰ Menu ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH3.root | content-fit | config.layout.actionHeightRem | owning component slot | primary row far right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ ☰ Menu ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH3.root | content-fit | config.layout.actionHeightRem | owning component slot | primary row far right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ ☰ Menu ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH3.root | content-fit | config.layout.actionHeightRem | owning component slot | primary row far right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ ☰ Menu ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH3.root | content-fit | config.layout.actionHeightRem | owning component slot | primary row far right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Reuse WCB2. Dispatch openMenu; focus first available menu control and restore trigger on dismissal.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH4: Total HUD

**Parent: WCF2.** Use cases: W4a W4b; WGS2 aliases this composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌─────────────────────────────────────────────────────┐
│ Class: Warden       Cinders: 120       Act 1 Floor 4 │
│ HP      ████████░░ 32/40     [Armoury] [Menu]        │
│ Mana    ██████░░░░  6/10                            │
│ Stamina ███████░░░  8/10                            │
├─────────────────────────────────────────────────────┤
│ [Ash seal] [Ember charm]                           │
└─────────────────────────────────────────────────────┘
████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH4.root | 100% host / 100vw in full-screen scene | content-fit within configured scene HUD band | owning component slot | top full-width; XP directly below entire HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌─────────────────────────────────────────────────────┐
│ Class: Warden       Cinders: 120       Act 1 Floor 4 │
│ HP      ████████░░ 32/40     [Armoury] [Menu]        │
│ Mana    ██████░░░░  6/10                            │
│ Stamina ███████░░░  8/10                            │
├─────────────────────────────────────────────────────┤
│ [Ash seal] [Ember charm]                           │
└─────────────────────────────────────────────────────┘
████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH4.root | 100% host / 100vw in full-screen scene | content-fit within configured scene HUD band | owning component slot | top full-width; XP directly below entire HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌──────────────────────────────┐
│ Warden    ⛁120    Act1 Floor4│
│ HP  █████░░ 32/40 [⚔] [☰]   │
│ MP  ███░░░░  6/10           │
│ STA ████░░░  8/12           │
│ [Relics]                   │
└──────────────────────────────┘
████████████░░░░░░░░░░░░░░░░░░
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH4.root | 100% host / 100vw in full-screen scene | content-fit within configured scene HUD band | owning component slot | top full-width; XP directly below entire HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌──────────────────────────────┐
│ Warden    ⛁120    Act1 Floor4│
│ HP  █████░░ 32/40 [⚔] [☰]   │
│ MP  ███░░░░  6/10           │
│ STA ████░░░  8/12           │
│ [Relics]                   │
└──────────────────────────────┘
████████████░░░░░░░░░░░░░░░░░░
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH4.root | 100% host / 100vw in full-screen scene | content-fit within configured scene HUD band | owning component slot | top full-width; XP directly below entire HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT snapshot, context, config, commandRegistry
// This is a reference projection. Never award XP or spend inventory in a view.
model = ProjectKnownHudFields(snapshot, config.sample)
visible = FilterConfiguredActiveLayers(model, config.layers)
// Collapsed layers leave no reserved row or gap.
ComposeHeader(visible.class, visible.cinders, visible.position)
ComposePrimaryRow(visible.vitality, visible.armoury, visible.menu)
// One Potions control owns flask charges and carried consumables.
potionEntries = ProjectPotions(snapshot, visible.chargeFlasks, visible.potions)
ComposeDetachedRail(visible.relics)
// Top HUD never renders Potions in either preset. Footer owns WGC11.
PublishFooterPotionsModel(config.potions.componentId, potionEntries)
// HP, MP and Smoke vial are revealed inside the FOOTER Potions control only.
OnPotionsActivate: OpenSharedPotionContents(potionEntries)
OnPotionChoice: EmitRegisteredUseIntent(); DomainRevalidatesReadiness()
IF visible.experience AND context IN config.experience.contexts
  RenderExperienceStrip(model.experience, config.experience)
// XP animation consumes an authoritative before/after settlement event.
ON combatSettled(event): AnimateProjectedFill(event.before, event.after, config.experience.animationMs)
ON action(intent): commandRegistry.dispatch(intent)
ON configurationChanged: ReprojectAndRender(); RestoreFocusedControl()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH5: Experience strip

**Parent: WCM2.** Use cases: WGH4 below detached rail; combat-only default. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
Blue fill / full host width / no permanent caption
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH5.root | 100% host; 100vw when host is viewport | config.experience.heightRem | owning component slot | below total HUD; left-to-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
Blue fill / full host width / no permanent caption
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH5.root | 100% host; 100vw when host is viewport | config.experience.heightRem | owning component slot | below total HUD; left-to-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
Blue fill / full host width / no permanent caption
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH5.root | 100% host; 100vw when host is viewport | config.experience.heightRem | owning component slot | below total HUD; left-to-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░
Blue fill / full host width / no permanent caption
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH5.root | 100% host; 100vw when host is viewport | config.experience.heightRem | owning component slot | below total HUD; left-to-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Proposed owner extension; not existing game XP rules.
IF config.layers.experience AND context IN config.experience.contexts
  ratio = SafeNormalizedProgress(snapshot.experience)
  RenderMeter(ratio, config.experience.color, config.experience.heightRem)
ON authoritativeCombatSettlement(event)
  AnimateFill(event.previousProgress, event.currentProgress, config.experience.animationMs)
// Announce progress through accessible meter label; level thresholds come from domain.
// Ignore duplicate settlement IDs; reduced-motion uses immediate final projection.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH6: Relic rail

**Parent: WCF2.** Use cases: WGH4; separate source inventoryBelt model. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Relic: Ash seal] [Relic: Ember charm]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH6.root | 100% usable HUD width | content-fit | owning component slot | below primary row; relics left; no potion controls | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Relic: Ash seal] [Relic: Ember charm]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH6.root | 100% usable HUD width | content-fit | owning component slot | below primary row; relics left; no potion controls | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Relic: Ash seal] [Relic: Ember charm]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH6.root | 100% usable HUD width | content-fit | owning component slot | below primary row; relics left; no potion controls | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Relic: Ash seal] [Relic: Ember charm]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH6.root | 100% usable HUD width | content-fit | owning component slot | below primary row; relics left; no potion controls | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Filter layers and preserve stable entity IDs. Relics use shared cards. Potions are exclusively footer-owned: WGC11 opens WGH8 contents combining HP/MP charge providers and carried consumables. Never render any potion control in this top-HUD rail, regardless of preset. Resource meters remain distinct information components.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH7: Run header strip

**Parent: WCF2.** Use cases: WGH4; map/combat run header. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Class: Warden           Cinders: 120           Act 1 · Floor 4
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH7.root | 100% usable HUD width | content-fit | owning component slot | top baseline; left / center / right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Class: Warden           Cinders: 120           Act 1 · Floor 4
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH7.root | 100% usable HUD width | content-fit | owning component slot | top baseline; left / center / right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Class: Warden           Cinders: 120           Act 1 · Floor 4
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH7.root | 100% usable HUD width | content-fit | owning component slot | top baseline; left / center / right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Class: Warden           Cinders: 120           Act 1 · Floor 4
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH7.root | 100% usable HUD width | content-fit | owning component slot | top baseline; left / center / right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Project class, Cinders, Act and Floor from run snapshot. Filter config layers before arranging tracks. Use localization and semantic fields, not parsed text.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH8: Potions contents

**Parent: WCB2.** Use cases: Shared footer Potions control contents; WGC11 owns presentation. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[WGC11 Potions]
    └─ on open: [HP ×2] [MP ×1] [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH8.root | shared Potions content host width | content-fit; action height config.layout.actionHeightRem | owning component slot | inside footer WGC11 disclosure; never in top HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[WGC11 Potions]
    └─ on open: [HP ×2] [MP ×1] [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH8.root | shared Potions content host width | content-fit; action height config.layout.actionHeightRem | owning component slot | inside footer WGC11 disclosure; never in top HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[WGC11 Potions]
    └─ on open: [HP ×2] [MP ×1] [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH8.root | shared Potions content host width | content-fit; action height config.layout.actionHeightRem | owning component slot | inside footer WGC11 disclosure; never in top HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[WGC11 Potions]
    └─ on open: [HP ×2] [MP ×1] [Smoke vial ×1]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH8.root | shared Potions content host width | content-fit; action height config.layout.actionHeightRem | owning component slot | inside footer WGC11 disclosure; never in top HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Proposed owner correction supersedes separate flask buttons.
entries = ProjectPotionEntries(snapshot.chargeFlasks, snapshot.carriedPotions, config.potions)
RenderInsideSharedControl(config.potions.componentId, entries)
// Footer-only placement applies to current and proposed preview presets.
// Data keeps charge providers separate from owned item instances; view combines references only.
OnChoose(entry): EmitRegisteredUseIntent(entry.id); DomainRevalidatesChargesAndTarget()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGH9: HUD mode grip

**Parent: WCB2.** Use cases: Current-checkout expanded/compact HUD model. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[⌃ Compact HUD / ⌄ Expand HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH9.root | content-fit | config.layout.actionHeightRem | owning component slot | HUD bottom center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[⌃ Compact HUD / ⌄ Expand HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH9.root | content-fit | config.layout.actionHeightRem | owning component slot | HUD bottom center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[⌃ Compact HUD / ⌄ Expand HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH9.root | content-fit | config.layout.actionHeightRem | owning component slot | HUD bottom center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[⌃ Compact HUD / ⌄ Expand HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGH9.root | content-fit | config.layout.actionHeightRem | owning component slot | HUD bottom center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
// Compatibility reference to current checkout HudModeModel.
ProjectNextMode(config.hudMode)
OnActivate: SetPresentationMode(nextMode); RecomposeActiveLayers()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM0: Map composition

**Parent: none.** Use cases: Map composition reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Shared HUD
Map viewport: connected node graph
Selected node: known details
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Shared HUD
Map viewport: connected node graph
Selected node: known details
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Shared HUD
Map viewport: connected node graph
Selected node: known details
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Shared HUD
Map viewport: connected node graph
Selected node: known details
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose shared HUD, camera viewport, selected-node details and inline footer. Use configured map bands; selection projects details and never enters a node immediately.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM1: Map viewport

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
         [?]
        /   \
   [Combat] [Town]
        \   /
       [Visited]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
         [?]
        /   \
   [Combat] [Town]
        \   /
       [Visited]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
         [?]
        /   \
   [Combat] [Town]
        \   /
       [Visited]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
         [?]
        /   \
   [Combat] [Town]
        \   /
       [Visited]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Render graph paths and buttons in a shared camera coordinate space. Preserve node identity during pan/zoom. Apply knowledge filtering before rendering unknown node labels.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM2: Map paths

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
      ●
     / \
    ●   ●
     \ /
      ●
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
      ●
     / \
    ●   ●
     \ /
      ●
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
      ●
     / \
    ●   ●
     \ /
      ●
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
      ●
     / \
    ●   ●
     \ /
      ●
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Read graph edges and registered node positions. Render noninteractive SVG paths beneath buttons; expose graph connections in accessible node descriptions.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM3: Node button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Visited ●   Reachable [⌂]   Blocked [?]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Visited ●   Reachable [⌂]   Blocked [?]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Visited ●   Reachable [⌂]   Blocked [?]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Visited ●   Reachable [⌂]   Blocked [?]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Render node state from knowledge-filtered graph. Selection only updates preview state. Blocked nodes explain unavailable reason without permitting entry.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM4: Node details

**Parent: WCF4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Town · Reachable
Services   Smith · Merchant · Rest
Risk       Known safe
Entry      Select Enter town to travel
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Town · Reachable
Services   Smith · Merchant · Rest
Risk       Known safe
Entry      Select Enter town to travel
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Town · Reachable
Services   Smith · Merchant · Rest
Risk       Known safe
Entry      Select Enter town to travel
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Town · Reachable
Services   Smith · Merchant · Rest
Risk       Known safe
Entry      Select Enter town to travel
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project known selected-node identity, services, risk and entry reason. Use aligned label/value rows. Do not disclose unseen or unprovided node data.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM5: Region selector

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Region [Ashen March ▾]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Region [Ashen March ▾]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Region [Ashen March ▾]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Region [Ashen March ▾]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Populate available regions from model. Selecting changes the local map view while preserving run location; no travel command is emitted.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM6: Recenter button

**Parent: WCB4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Emit local camera recenter intent for current node. Reset view transform without changing selected destination or run graph.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM7: Enter node button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Recenter]                 [Enter town]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project node-specific label and readiness. Revalidate reachability and entry command against latest domain state before transition.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGP0: Progression components

**Parent: WCF0.** Use cases: Shared weapon and skill progression. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[WGP1 list] → [WGP2 progress]
               [WGP4 next benefit]
               [WGP3 techniques]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP0.root | available width | content fit | owning component slot | W1 active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[WGP1 list] → [WGP2 progress]
               [WGP4 next benefit]
               [WGP3 techniques]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP0.root | available width | content fit | owning component slot | W1 active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[WGP1 list] → [WGP2 progress]
               [WGP4 next benefit]
               [WGP3 techniques]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP0.root | available width | content fit | owning component slot | W1 active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[WGP1 list] → [WGP2 progress]
               [WGP4 next benefit]
               [WGP3 techniques]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP0.root | available width | content fit | owning component slot | W1 active body | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT projection, config.progression
// Children consume the same selected proficiency ID.
ComposeRegisteredChildren(projection, config.progression.layout)
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGP1: Proficiency list row

**Parent: WCF1.** Use cases: Weapon and skill navigation; links WCI1, WGP2. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Name                         Rank]
[Progress────────────────────────]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP1.root | available list width | content fit | owning component slot | start aligned; rank at inline end | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Name                         Rank]
[Progress────────────────────────]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP1.root | available list width | content fit | owning component slot | start aligned; rank at inline end | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Name                         Rank]
[Progress────────────────────────]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP1.root | available list width | content fit | owning component slot | start aligned; rank at inline end | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Name                         Rank]
[Progress────────────────────────]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP1.root | available list width | content fit | owning component slot | start aligned; rank at inline end | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT proficiency summary, selected ID, config.progression
// Preserve stable selection across categories and host sizes.
RenderNameAndRank(WCI1, summary); Compose(WGP2, summary)
OnActivate: SelectProficiency(summary.id)
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGP2: Proficiency progress

**Parent: WCM2.** Use cases: List rows, details and award preview; shared meter model. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Practice 42 / 100
[████████░░░░░░░░░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP2.root | available width | config.progression.layout.meterHeight | owning component slot | label start; meter spans host | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Practice 42 / 100
[████████░░░░░░░░░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP2.root | available width | config.progression.layout.meterHeight | owning component slot | label start; meter spans host | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Practice 42 / 100
[████████░░░░░░░░░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP2.root | available width | config.progression.layout.meterHeight | owning component slot | label start; meter spans host | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Practice 42 / 100
[████████░░░░░░░░░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP2.root | available width | config.progression.layout.meterHeight | owning component slot | label start; meter spans host | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT accumulated practice, threshold, config.progression
// Domain projection supplies values; renderer does not award progression.
fraction = SafeProgressFraction(accumulatedPractice, threshold)
RenderSharedMeter(WCM2, fraction, config.progression.colors.progress)
ProvideAccessibleValueText(accumulatedPractice, threshold)
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGP3: Known techniques

**Parent: WCF4.** Use cases: Knowledge-filtered proficiency details. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Known techniques
Measured cut       Available
Guard break        Undiscovered
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP3.root | available detail width | content fit | owning component slot | aligned label/value columns | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Known techniques
Measured cut       Available
Guard break        Undiscovered
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP3.root | available detail width | content fit | owning component slot | aligned label/value columns | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Known techniques
Measured cut       Available
Guard break        Undiscovered
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP3.root | available detail width | content fit | owning component slot | aligned label/value columns | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Known techniques
Measured cut       Available
Guard break        Undiscovered
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP3.root | available detail width | content fit | owning component slot | aligned label/value columns | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT technique unlock projection, knowledge, config.progression
// Unknown mechanics must not leak through tooltips or source-backed view data.
rows = ApplyKnowledgeFilter(techniques, knowledge)
If config.progression.showLockedTechniques: AppendGenericUnknownRows()
RenderFactRows(WCF4, rows)
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGP4: Next proficiency benefit

**Parent: WCF4.** Use cases: Weapon and skill progression details. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Next benefit
{Known benefit or undiscovered}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP4.root | available detail width | content fit | owning component slot | start aligned in detail stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Next benefit
{Known benefit or undiscovered}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP4.root | available detail width | content fit | owning component slot | start aligned in detail stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Next benefit
{Known benefit or undiscovered}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP4.root | available detail width | content fit | owning component slot | start aligned in detail stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Next benefit
{Known benefit or undiscovered}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGP4.root | available detail width | content fit | owning component slot | start aligned in detail stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT next threshold projection, knowledge, config.progression
// Threshold effects are data references; avoid invented growth formulas.
benefit = ProjectKnownBenefitOrUnknown(nextThreshold, knowledge)
RenderFactRows(WCF4, benefit)
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ0: Dialogue composition

**Parent: none.** Use cases: Dialogue composition reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Player portrait      NPC portrait
Speaker: short current caption
[Available authored choices]
[Back]       [Skip speech]       [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Player portrait      NPC portrait
Speaker: short current caption
[Available authored choices]
[Back]       [Skip speech]       [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player portrait      NPC portrait
Speaker: short current caption
[Available authored choices]
[Back]       [Skip speech]       [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player portrait      NPC portrait
Speaker: short current caption
[Available authored choices]
[Back]       [Skip speech]       [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose scene portraits, current authored beat, progression controller and inline navigation. Keep quest effects behind explicit domain choice commit.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ1: Dialogue scene

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌─────── authored scene ─────────┐
│ Player →             ← Keeper │
│ portrait              portrait│
└───────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌─────── authored scene ─────────┐
│ Player →             ← Keeper │
│ portrait              portrait│
└───────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌─────── authored scene ─────────┐
│ Player →             ← Keeper │
│ portrait              portrait│
└───────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌─────── authored scene ─────────┐
│ Player →             ← Keeper │
│ portrait              portrait│
└───────────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve authored scene and speaker portraits. Preserve left/right roles and sprite proportions; apply speaking emphasis only to the current speaker.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ2: Player portrait

**Parent: WCI2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Player →           NPC
portrait           portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Player →           NPC
portrait           portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player →           NPC
portrait           portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player →           NPC
portrait           portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Use the shared artwork component and player-facing context. Anchor left and baseline bottom; no portrait interaction duplicates dialogue choices.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ3: NPC portrait

**Parent: WCI2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Player         ← NPC speaking
portrait         portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Player         ← NPC speaking
portrait         portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player         ← NPC speaking
portrait         portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Player         ← NPC speaking
portrait         portrait
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Use the shared artwork component with NPC asset and speaking state. Anchor right; mirror artwork only when authored facing requires it.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ4: Caption/choice region

**Parent: WCF4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
The Keeper
The forge is still warm.
[Ask about the forge] [Leave]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
The Keeper
The forge is still warm.
[Ask about the forge] [Leave]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
The Keeper
The forge is still warm.
[Ask about the forge] [Leave]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
The Keeper
The forge is still warm.
[Ask about the forge] [Leave]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project one short authored beat and only known eligible choices. Choice activation records selection; explicit Continue commits through domain. Keep text size readable and choices inline when they fit.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ5: Speech progression

**Parent: WCF1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Idle → Playing → Ended → Next eligible beat
                 ↘ Await choice
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Idle → Playing → Ended → Next eligible beat
                 ↘ Await choice
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Idle → Playing → Ended → Next eligible beat
                 ↘ Await choice
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Idle → Playing → Ended → Next eligible beat
                 ↘ Await choice
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Subscribe to authored audio ended event with current generation token. Advance only linear eligible beats when config.dialogue.autoAdvance is enabled. Cancel stale events on skip/back/dispose; never invent audio timing.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ6: Back button

**Parent: WCB4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Move to previous permitted caption without replaying domain effects. Disable when history does not allow navigation. Cancel current media generation.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ7: Skip speech button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Stop current media and reveal caption. Do not skip quest content or choose a response. Ignore stale audio ended events.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ8: Continue button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back]         [Skip speech]     [Continue]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Advance once to next permitted beat or commit explicitly selected choice. Honor readiness; cancel prior media generation and reject duplicate activation.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS0: Shared scene layers

**Parent: none.** Use cases: Shared scene layers reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Shared HUD
┌ Skyline ─────────────────┐
│ world scene              │
├ Floor ───────────────────┤
│ baseline / actors        │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Shared HUD
┌ Skyline ─────────────────┐
│ world scene              │
├ Floor ───────────────────┤
│ baseline / actors        │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Shared HUD
┌ Skyline ─────────────────┐
│ world scene              │
├ Floor ───────────────────┤
│ baseline / actors        │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Shared HUD
┌ Skyline ─────────────────┐
│ world scene              │
├ Floor ───────────────────┤
│ baseline / actors        │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose HUD once and background layers below. Apply visibility flags independently; shared domain facts remain owned by the HUD model.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS1: Background composition

**Parent: WCI2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌ Skyline · behind ────────┐
│ distant sky and scenery  │
│                         │
├ Floor · bottom ──────────┤
│ ground under actors      │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌ Skyline · behind ────────┐
│ distant sky and scenery  │
│                         │
├ Floor · bottom ──────────┤
│ ground under actors      │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌ Skyline · behind ────────┐
│ distant sky and scenery  │
│                         │
├ Floor · bottom ──────────┤
│ ground under actors      │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌ Skyline · behind ────────┐
│ distant sky and scenery  │
│                         │
├ Floor · bottom ──────────┤
│ ground under actors      │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Resolve skyline and floor asset providers. Paint only enabled layers; floor height follows config.scene.floorHeightPercent and anchors bottom. Preserve shared actor baseline.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS2: Shared HUD

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Class          Cinders          Act / Floor
Resource meters               Armoury Menu
Relic rail                      Potion rail
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Class          Cinders          Act / Floor
Resource meters               Armoury Menu
Relic rail                      Potion rail
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Class          Cinders          Act / Floor
Resource meters               Armoury Menu
Relic rail                      Potion rail
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Class          Cinders          Act / Floor
Resource meters               Armoury Menu
Relic rail                      Potion rail
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Render the shared RunHud view model through WGH4. Toggle configured children before layout; never maintain separate combat and map HUD facts.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS3: HUD identity

**Parent: WCI1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Class            Cinders            Act / Floor
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Class            Cinders            Act / Floor
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Class            Cinders            Act / Floor
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Class            Cinders            Act / Floor
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Project class identity and run metadata from RunHeaderModel. Reuse shared header renderer rather than adding portrait, XP or duplicate character facts.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS4: HUD resource strip

**Parent: WCM2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
HP 32/40  [████████░░]
Mana 6/10 [██████░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
HP 32/40  [████████░░]
Mana 6/10 [██████░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP 32/40  [████████░░]
Mana 6/10 [██████░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HP 32/40  [████████░░]
Mana 6/10 [██████░░░░]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Read active resource plan and semantic order from resource providers. Reuse resourceBars main surface and shared meter primitive.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS5: HUD menu button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
HUD right        [Armoury] [Menu]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
HUD right        [Armoury] [Menu]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HUD right        [Armoury] [Menu]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
HUD right        [Armoury] [Menu]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Compose shared menu action with accessible label and command intent. Opening a menu follows configured simulation/input policy.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS6: Skyline layer

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
┌──────────────────────────┐
│ sky · distant silhouettes│
│       /    /          │
│      /  __/           │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
┌──────────────────────────┐
│ sky · distant silhouettes│
│       /    /          │
│      /  __/           │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌──────────────────────────┐
│ sky · distant silhouettes│
│       /    /          │
│      /  __/           │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌──────────────────────────┐
│ sky · distant silhouettes│
│       /    /          │
│      /  __/           │
└──────────────────────────┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Paint configured distant-art asset across scene bounds with intrinsic crop policy. Layer behind floor and actors. Omit when config.scene.skyline is disabled.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS7: Floor layer

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
                 scene top
┌──────────────────────────┐
│ floor at bottom          │
└──────── actor baseline ──┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
                 scene top
┌──────────────────────────┐
│ floor at bottom          │
└──────── actor baseline ──┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
                 scene top
┌──────────────────────────┐
│ floor at bottom          │
└──────── actor baseline ──┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
                 scene top
┌──────────────────────────┐
│ floor at bottom          │
└──────── actor baseline ──┘
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
INPUT: snapshot, knowledge, ownerState, context, config
// Load shared tokens; numeric defaults live in componentCompletionDefaults.
model = ProjectRegisteredModel(snapshot, knowledge, context)
// Paint floor at scene bottom using config.scene.floorHeightPercent. Omit when config.scene.floor is disabled without shifting the actor placement model.
FilterInactiveProviders(model)
children = ResolveDeclaredChildReferences(model.children)
RenderRegisteredComponent(model, children, config)
// Local preview actions never mutate the game. Production host revalidates commands.
On activation: DispatchSemanticIntent(model.intent, context)
On disposal: ReleaseTimersObserversAndSubscriptions()
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

