# Shared component wireframes

WP identifiers describe composable parts, not additional screen families. Every part receives an immutable view model and owner interaction state. WC0/WC4 and W1w compose these same components; context controls visibility and placement. Dimensions are shared configurable proposals.

## Wireframe WCB0: Buttons and inspection

**Parent: none.** Use cases: Buttons and inspection reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB1: Inspect control

**Parent: WCB0.** Use cases: Every selectable card, combatant, inventory tile. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
             (i)
        {Owning card}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB1.root | 2.75rem minimum target | 2.75rem minimum target | owning component slot | above owner top-center / above intent when present | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
On continuous selection schedule reveal after1000ms. Cancel on deselect/disposal. On activation stop propagation and open W1w with entity reference and context. Restore origin focus. Read-only inspector previews omit nested inspect.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB2: Context action

**Parent: WCB0.** Use cases: Selected card host or modal footer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[          Use            ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB2.root | usable host width | minimum target height | owning component slot | below selected card; outside its frame | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Project available domain intent. Required target gates readiness. Commit revalidates state once. No generic eligible-target button in production.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB3: Primary / confirmation button

**Parent: WCB0.** Use cases: Modal confirmation, contextual Use/Play/Equip. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ Confirm ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB3.root | shared action width | minimum target token | owning component slot | footer right; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Receive label, command intent, readiness and busy state. Green when ready/highlighted; disabled/busy wins. Emit one semantic intent; domain revalidates. Destructive role uses danger override.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB4: Back / cancel button

**Parent: WCB0.** Use cases: W0 modal footers and cancellation. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ Back ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB4.root | shared action width | minimum target token | owning component slot | footer left; full-width when sole action | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Inherit action primitive. Highlight danger color on focus/hover. Cancel only current presentation flow; restore origin focus.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCB5: Exit button

**Parent: WCB0.** Use cases: Shared modal header. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[ × ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCB5.root | minimum target token | minimum target token | owning component slot | header top-right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Use accessible Close label and inherited dismissal policy. Danger highlight; do not commit pending domain actions.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF0: Component foundations

**Parent: none.** Use cases: Component foundations reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF1: Component contract

**Parent: WCF0.** Use cases: All card and combatant parts. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Immutable model} → [View] → Intent
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF1.root | host allocation | host allocation | owning component slot | host slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Validate model; resolve inherited tokens; render only if active; dispose subscriptions.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF2: Ordered active stack

**Parent: WCF0.** Use cases: Combatant lower region. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HP]
[Resource if active]
[Buildup if admitted]
[Stance if active]
[Icons ... +N]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF2.root | 100% host width | content-fit, maximum5 rows | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Filter inactive components before ordering. Reserve HP and present stance/icon rows. Admit priority bars within remaining budget. Convert excess buildup to icons. Use shared0.2rem gap, no empty rows.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF3: Selection effect

**Parent: WCF0.** Use cases: All selectable cards and combatants. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{ Glow around complete owner }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF3.root | owner visual bounds | owner visual bounds | owning component slot | entire owner assembly including inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Observe owner selected state. Apply one shared glow to complete visible assembly; no nested additive glow. Preserve position and omit hidden parts.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCF4: Inspector facts

**Parent: WCF0.** Use cases: W1w right pane. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Label          Value
Label          Value
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCF4.root | 100% detail pane | content-fit | owning component slot | top-left within detail section | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Project knowledge-filtered snapshot through registered providers. Order HP/intent/defense, current state, history, abilities, traits, lore. Use shared label/value columns; right pane scrolls.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI0: Identity and artwork

**Parent: none.** Use cases: Identity and artwork reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI1: Nameplate

**Parent: WCI0.** Use cases: Card header, combatant above HP, inspector title. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       {Entity name}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI1.root | usable host width | content-fit | owning component slot | registered name slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve localized display name once. Render text, never HTML. Follow context anchor; inherit owner selected glow.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI2: Sprite / artwork

**Parent: WCI0.** Use cases: Playing card art, combatant sprite, inspector preview. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
       [Artwork]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI2.root | contained host width | remaining host height | owning component slot | center; combatant baseline bottom | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered asset and pose. Contain intrinsic aspect ratio. Mirror art only by facing. No independent entity facts.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCI3: Metadata footer

**Parent: WCI0.** Use cases: Item and playing-card footer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
Rarity               Owned: n
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCI3.root | 100% usable card width | 10% card height | owning component slot | card bottom band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Render applicable registered metadata left/right. Omit unsupported values. No Use/Play button in footer.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM0: Meters and statuses

**Parent: none.** Use cases: Meters and statuses reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM1: Health meter

**Parent: WCM0.** Use cases: Combatants and inspector preview. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HP ================= 32/40]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM1.root | 100% stack width | HP height token (demo1.4rem) | owning component slot | below sprite/name | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Project HP/current maximum. Render label and accessible meter. HP persists; clamp visual fill only, never mutate value.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM2: Resource meter

**Parent: WCM0.** Use cases: Active combatant resource rows, inspector facts. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Resource =========== 6/10]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM2.root | 100% stack width | 0.5 × HP height | owning component slot | after HP in ordered active stack | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Filter with domain activity predicate. Project resource metadata/current/max. Use registered semantic color. Reserve available row by configured priority.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM3: Buildup meter

**Parent: WCM0.** Use cases: Threshold progress, overflow status icon. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Buildup ============ 65/100]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM3.root | 100% stack width | 0.5 × HP height | owning component slot | after resources | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Project buildup and threshold. If optional row budget exhausted, emit progress-icon model instead. Never treat buildup as active status duration.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM4: Stance strip

**Parent: WCM0.** Use cases: Active combatant stance and inspector fact. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[       {Stance}          ]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM4.root | 100% stack width | 1 × HP height | owning component slot | after buildup / before icons | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Render active stance only with uniform dimensions. Localize label and tooltip. No stance command from informational activation.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM5: Status icon

**Parent: WCM0.** Use cases: Active effects and overflow buildup. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[◆]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM5.root | 1.575rem | 1.575rem | owning component slot | ordered bottom icon row | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Render icon only. Accessible name and tooltip contain stacks/duration/progress. Subscribe to owner selection rather than local duplicate state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCM6: Icon overflow

**Parent: WCM0.** Use cases: Crowded status rows. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[◆] [☠] [+4]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCM6.root | same as WCM5 | same as WCM5 | owning component slot | final visible icon slot | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Measure available width. Reserve last slot if all icons cannot fit. N equals hidden entries. Activate opens complete status list in W1w. Recompute on resize/model update.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO0: Combat overlays

**Parent: none.** Use cases: Combat overlays reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO1: Intent indicator

**Parent: WCO0.** Use cases: Active announced combatant intent. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[⚔ Attack · 12]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO1.root | content-fit | 2.8rem minimum | owning component slot | above sprite; below Inspect | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Require active domain intent AND role visibility; default player false, enemy true. Project action preview. No duplicate AI logic.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO2: Defense badge

**Parent: WCO0.** Use cases: Active combatant block/defense. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[◇ 8]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO2.root | 3.5rem minimum | 3.5rem minimum | owning component slot | sprite50% height; player right/enemy left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Render active defense value. Place outside sprite with0.5rem gap and center vertically. Inspector uses facts instead of overlay.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO3: Aura layer

**Parent: WCO0.** Use cases: Tag-driven combatant visual effects. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{ Aura behind sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO3.root | 100% sprite width | 100% sprite height | owning component slot | sprite bounds, behind artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Match active visual-effect tags to allowlisted provider. Paint full bounds without pointer events. Never create gameplay state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCO4: Buff layer

**Parent: WCO0.** Use cases: Active buff visual layer. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{ Buff over sprite }
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCO4.root | sprite width minus shared inset | 100% sprite height | owning component slot | sprite bounds, above artwork | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Reuse effect lifecycle; paint above art below controls. Omit in inspector. Respect reduced motion.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCT0: Tooltip components

**Parent: none.** Use cases: Tooltip components reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WCT1: Tooltip presenter

**Parent: WCT0.** Use cases: Tags, status/intent/defense explanations. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Title / explanation]
          ▽
       [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WCT1.root | WT1/WT2/WT3 token | content-fit | owning component slot | above trigger; flip/shift within viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Delay1000ms; cancel stale timers. Keep open across trigger-to-tooltip transition. Escape/outside tap dismiss. Reuse active modal overlay root.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC0: Combat composition

**Parent: none.** Use cases: Combat composition reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC1: Battlefield stage

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Battlefield stage]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Battlefield stage]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Battlefield stage]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Battlefield stage]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
shared baseline and authored slots; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC2: Player placement

**Parent: WC4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Player placement]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Player placement]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Player placement]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Player placement]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC2.root | slot width | stage height | owning component slot | stage left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
place player facing right; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC3: Enemy placements

**Parent: WC4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Enemy placements]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Enemy placements]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Enemy placements]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Enemy placements]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC3.root | slot widths | stage height | owning component slot | stage right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
stable IDs, spacing, authored baseline; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC4: Target layer

**Parent: WCF3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Target layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Target layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Target layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Target layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC4.root | 100% | 100% | owning component slot | over battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
domain-eligible targets only; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC5: Hand region

**Parent: WC1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Hand region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Hand region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Hand region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Hand region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC5.root | 100% | config.context | owning component slot | below battlefield | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
stable card IDs; preserve targeting and hit areas; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC6: Packed action footer

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Packed action footer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Packed action footer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Packed action footer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Packed action footer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC6.root | content-fit | config.footer | owning component slot | bottom-center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
actions draw endTurn discard potions; uniform minimal gaps; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC7: Actions remaining

**Parent: WCM2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Actions remaining]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Actions remaining]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Actions remaining]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Actions remaining]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC7.root | large control | large control | owning component slot | footer first | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
domain count; fade when empty; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC8: Draw pile button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Draw pile button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Draw pile button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Draw pile button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Draw pile button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC8.root | small control | small control | owning component slot | footer second | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
open pile viewer; no invented draw command; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC9: End turn button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[End turn button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[End turn button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[End turn button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[End turn button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC9.root | large control | large control | owning component slot | footer center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
revalidate turn; green legal no-actions or highlighted; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC10: Discard/exhaust button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Discard/exhaust button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Discard/exhaust button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Discard/exhaust button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Discard/exhaust button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC10.root | small control | small control | owning component slot | footer fourth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
open category workspace; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGC11: Potion control

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Potion control]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Potion control]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Potion control]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Potion control]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGC11.root | large control | large control | owning component slot | footer fifth | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
choose owned usable potion; target through domain; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM0: Map composition

**Parent: none.** Use cases: Map composition reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM1: Map viewport

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Map viewport]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Map viewport]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Map viewport]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Map viewport]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM1.root | config.mapWidth | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
pan/zoom/recenter preserve node identity; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM2: Map paths

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Map paths]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Map paths]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Map paths]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Map paths]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM2.root | map bounds | map bounds | owning component slot | inside viewport | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
noninteractive links from map graph; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM3: Node button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM3.root | target token | target token | owning component slot | authored graph coordinate | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
current/reachable/visited/blocked states; selection does not enter; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM4: Node details

**Parent: WCF4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Node details]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Node details]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Node details]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Node details]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM4.root | 100% | config.context | owning component slot | below map | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
project selected node known facts; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM5: Region selector

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Region selector]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Region selector]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Region selector]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Region selector]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM5.root | content-fit | target token | owning component slot | inside HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
switch available region; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM6: Recenter button

**Parent: WCB4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Recenter button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Recenter button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Recenter button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Recenter button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
reset camera to current node; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGM7: Enter node button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Enter node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Enter node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Enter node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Enter node button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGM7.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
revalidate reachable selected node then enter; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ0: Dialogue composition

**Parent: none.** Use cases: Dialogue composition reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ1: Dialogue scene

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Dialogue scene]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Dialogue scene]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Dialogue scene]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Dialogue scene]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ1.root | 100% | config.scene | owning component slot | below HUD | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
authored scene art; never duplicate HUD facts; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ2: Player portrait

**Parent: WCI2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Player portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Player portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Player portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Player portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ2.root | portrait width | scene height | owning component slot | scene left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
preserve art ratio; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ3: NPC portrait

**Parent: WCI2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[NPC portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[NPC portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[NPC portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[NPC portrait]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ3.root | portrait width | scene height | owning component slot | scene right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
preserve art ratio, speaking emphasis; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ4: Caption/choice region

**Parent: WCF4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Caption/choice region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Caption/choice region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Caption/choice region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Caption/choice region]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ4.root | 100% | config.context | owning component slot | below scene | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
short authored beats, knowledge-filtered choices; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ5: Speech progression

**Parent: WCF1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Speech progression]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Speech progression]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Speech progression]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Speech progression]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ5.root | none | none | owning component slot | nonvisual controller | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
audio-ended advances linear beats only; stale generation guard; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ6: Back button

**Parent: WCB4.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Back button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Back button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Back button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ6.root | action width | target token | owning component slot | footer left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
previous permitted beat without replaying effects; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ7: Skip speech button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Skip speech button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Skip speech button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Skip speech button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Skip speech button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ7.root | action width | target token | owning component slot | footer middle | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
stop current clip and reveal caption; no quest skip; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGQ8: Continue button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Continue button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Continue button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Continue button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Continue button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGQ8.root | action width | target token | owning component slot | footer right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
advance once or commit explicitly chosen response; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS0: Shared scene layers

**Parent: none.** Use cases: Shared scene layers reusable component family. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
{Shared family components}
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS0.root | configured by child | configured by child | owning component slot | owning context | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
Resolve registered child component and view model. Inherit common tokens and lifecycle; never duplicate domain state.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS1: Background composition

**Parent: WCI2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Background composition]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Background composition]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Background composition]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Background composition]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS1.root | full scene | full scene | owning component slot | scene background | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
compose independently configured skyline and floor; neither captures input; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS2: Shared HUD

**Parent: WCF2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Shared HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Shared HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Shared HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Shared HUD]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS2.root | 100% | config.hud | owning component slot | top band | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
identity/resources/menu; one shared model; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS3: HUD identity

**Parent: WCI1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HUD identity]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HUD identity]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HUD identity]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HUD identity]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS3.root | content-fit | HUD inner height | owning component slot | HUD left | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
player name/portrait from snapshot; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS4: HUD resource strip

**Parent: WCM2.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HUD resource strip]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HUD resource strip]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HUD resource strip]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HUD resource strip]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS4.root | remaining | HUD inner height | owning component slot | HUD center | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
active resources only; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS5: HUD menu button

**Parent: WCB3.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[HUD menu button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[HUD menu button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HUD menu button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[HUD menu button]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS5.root | target token | target token | owning component slot | HUD right | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
open menu, preserve simulation policy; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS6: Skyline layer

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Skyline layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Skyline layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Skyline layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Skyline layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS6.root | 100% scene | 100% scene | owning component slot | scene top / behind floor | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
distant sky and scenery; configurable asset/color; no input; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

## Wireframe WGS7: Floor layer

**Parent: WGS1.** Use cases: Combat/map/dialogue composition. Owner selection propagates to the component; no duplicated selected state.

**Wide**

```text
[Floor layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Compact**

```text
[Floor layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Floor layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
[Floor layer]
```

| Component | Width | Height | Relative to | Anchor | Alignment | Positioning | Offset | Rule |
|---|---|---|---|---|---|---|---|---|
| WGS7.root | 100% scene | config.background.floorHeightPercent | owning component slot | scene bottom / ahead of skyline | inherited semantic alignment | normal flow unless overlay | shared token | Preserve proportions and readable minimums in every mode |

**Language-agnostic pseudocode**

```text
INPUT: immutable component model, owner state, context, layout tokens
ground plane under actors; preserve stage baseline; read configuration from gameplay-config.json. Emit semantic intents only.
On model change: reproject registered values; preserve stable identity
On dispose: release timers, observers and events
```

