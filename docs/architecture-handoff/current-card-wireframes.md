# Current playing-card wireframes

## Current playing card (WC1) — implemented

These are the cards the game draws now, based on [the authored card manifest](../../content/config/ui/components/card.json), [the renderer](../../src/ui/components/card.js), and [the WC1 styles](../../styles/kit.css). The face is **5:7**. The authored track weights are **1:4:4:1** for name, art, body, and metadata; a withheld region removes its track and the remaining weights renormalize. The name never disappears.

The left-edge cost rail starts below the name and stays readable in a fanned hand. It always shows action cost, including zero, and adds stamina or mana only when nonzero. The art well currently uses the card's glyph; tags, when shown, sit at its bottom. The body contains the type band when allowed and rule text. The footer holds metadata, not the Play command. Flavor is read in the inspection pane outside the face. The information control belongs to selection/inspection, outside the face.

### Glance — At rest

Nominal box **152×212.8px** (compact 108×151.2px, mobile 152×212.8px); all sizes preserve 5:7. Visible regions: `art`, `facts`, `effects`. In-flow tracks: **1:4:4**.

```text
┌──────────────────────────────┐
│          CARD NAME           │
├──────────────────────────────┤
│ ◆ 1   [ GLYPH / ART ]       │
│ ϟ 2   (extra costs if used)  │
├──────────────────────────────┤
│       RULES / EFFECTS        │
└──────────────────────────────┘
```

### Focus — Selected

Nominal box **280×392px**; all sizes preserve 5:7. Visible regions: `art`, `type`, `facts`, `effects`, `footer`. In-flow tracks: **1:4:4:1**.

```text
┌──────────────────────────────┐
│          CARD NAME           │
├──────────────────────────────┤
│ ◆ 1   [ GLYPH / ART ]       │
│ ϟ 2   (extra costs if used)  │
├──────────────────────────────┤
│         TYPE BAND            │
│       RULES / EFFECTS        │
├──────────────────────────────┤
│ Rarity             Owned: n  │
└──────────────────────────────┘
```

### Inspect — Reading door

Nominal box **320×448px**; all sizes preserve 5:7. Visible regions: `art`, `type`, `facts`, `tags`, `effects`, `flavor`, `footer`. In-flow tracks: **1:4:4:1**.

```text
┌──────────────────────────────┐
│          CARD NAME           │
├──────────────────────────────┤
│ ◆ 1   [ GLYPH / ART ]       │
│ ϟ 2   (extra costs if used)  │
│ [tags at art well bottom]    │
├──────────────────────────────┤
│         TYPE BAND            │
│       RULES / EFFECTS        │
├──────────────────────────────┤
│ Rarity             Owned: n  │
└──────────────────────────────┘
```

### Surface adjustments

| Surface | Level | Change to the face | In-flow tracks |
|---|---|---|---|
| creation | glance | add footer | 1:4:4:1 |
| armoury | glance | add type | 1:4:4 |
| combat | focus | drop footer | 1:4:4 |

[Visual anatomy of all three current levels](../mockups/card-anatomy.svg). Art proposals should keep this shell and change only the content of the art well.
