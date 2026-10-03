# Tooltip wireframes

Three configurable sizes: compact, standard and expanded. WT0 is an anchored overlay, not a modal: no close/back/primary footer. It inherits palette, spacing, typography and reduced-motion tokens from W0. Tooltips contain descriptive text only; interactive or lengthy detail opens W1 inspection.

## Wireframe WT0: Shared tooltip

**Parent: shared overlay primitives.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 20vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 30vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 60vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT0.frame | 60vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT0.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT0.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT0.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT0)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=1000; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

## Wireframe WT1: Compact tooltip

**Parent: WT0.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 12vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 18vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 36vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT1.frame | 36vw nominal | auto; 6vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT1.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT1.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT1.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT1)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=1000; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

## Wireframe WT2: Standard tooltip

**Parent: WT0.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 20vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 30vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 60vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT2.frame | 60vw nominal | auto; 12vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT2.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT2.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT2.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT2)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=1000; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

## Wireframe WT3: Expanded tooltip

**Parent: WT0.** Anchor to trigger top-center with a 0.5rem gap; flip below when above cannot fit, shift horizontally inside safe viewport. Arrow points to the trigger after shifting. Keep tooltip open while trigger or tooltip is hovered; keyboard focus and tap reveal it; Escape and outside tap dismiss.

**Wide**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 28vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Compact**

```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 42vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Portrait / iPhone SE (3rd generation)**

Reference viewport: 375 × 667 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 84vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |


**Portrait / Galaxy S24**

Reference viewport: 360 × 780 CSS px. Same inherited portrait layout; dimensions resolve against this viewport. Browser chrome and text scaling require separate device validation.


```text
┌────────────────────────────┐
│ {Tag / semantic title}     │
│ {Concise description}      │
└─────────────┬──────────────┘
              ▽
          [Trigger]
```

| Component | Width | Height | Relative to | Anchor | Align X / Y | Positioning | Offset / gap | Rule |
|---|---|---|---|---|---|---|---|---|
| WT3.frame | 84vw nominal | auto; 20vh reference | trigger | top-center; flip below | center / end | fixed overlay | 0.5rem gap | clamp to safe viewport; content height, never clip text |
| WT3.title | parent minus 1.5rem | auto | frame | top-left | start / start | normal flow | 0.75rem inset | optional, omit repeated title |
| WT3.body | parent minus 1.5rem | auto | frame | below title | start / start | normal flow | 0.375rem gap | readable text wins |
| WT3.arrow | 0.75rem | 0.375rem | frame | nearest trigger edge | center / center | overlay | tracks trigger center | decorative |

**Language-agnostic pseudocode**

```text
ResolveTooltipModelFromTagRegistry(trigger.tagId, locale)
ChooseConfiguredSize(WT3)
MeasureContentWithinClampedWidth()
PlaceAboveTrigger(); if overflow: FlipBelow(); ShiftInsideSafeViewport()
PointArrowAtTrigger(); renderInActiveModalOverlayOrRoot()
On hover/focus/tap: schedule after config.delayMs=1000; cancel on leave/blur/removal; on Escape/outside tap: dismiss
KeepOpenAcrossTriggerToTooltipPointerTransition()
CancelOnTriggerRemoval(); never execute domain commands
```

