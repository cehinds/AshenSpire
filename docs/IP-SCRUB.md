# IP scrub — trademark-distance brief

Materials for an IP-attorney review of **Ashen Spire** (formerly "EldenSpire /
Spire of the Erdtree"). This is a factual record of the rename performed in
commit `95c3b87`, **not legal advice or a legal conclusion**. The goal of the
scrub was to remove FromSoftware / *Elden Ring* trademarks and proper nouns
while deliberately preserving the dark-fantasy, Souls-like **genre and motif**
(which are not themselves protectable).

## What the game is

A browser roguelike deck-builder in the Slay-the-Spire lineage (map → combat →
rewards, card-based turn combat), themed dark-fantasy. All art is
procedurally generated in-repo (no downloaded assets); all music is a built-in
generated score. See `CREDITS.md`.

## Non-affiliation notice (shipped in CREDITS.md)

> AshenSpire is an original fan-inspired work. It contains no assets, music,
> text, or proper nouns from Elden Ring, and is not affiliated with, endorsed
> by, or sponsored by FromSoftware Inc. or Bandai Namco Entertainment. Elden
> Ring is a trademark of its respective owners.

## Renames performed (old → new)

### Brand / title
| Old | New |
| --- | --- |
| EldenSpire / Spire of the Erdtree | **Ashen Spire** (`AshenSpire`) |

### World / theme pillars
| Old (FromSoft term) | New |
| --- | --- |
| Erdtree | Goldbough |
| Site / Shrine of Grace, "grace" | Emberlight / "ember" |
| Tarnished | Forsaken |
| Scarlet Rot (status) | Crimson Blight (stacks: "Blight") |
| Glintstone / Glintblade | Starstone / Starblade |
| Bloodflame | Gorefire |
| Cerulean | Azure |
| Grafted | Stitched |
| Crucible | Wyrm |
| Runes (currency) | Cinders |
| Great Rune | Sovereign Ember |
| Omen | Warden |
| "YOU DIED" (death screen) | "YOU PERISHED" |
| "GREAT RUNE RESTORED" | "EMBER RESTORED" |

### Classes
Vagabond → **Reaver**; Astrologer → **Starseer**; Prophet → **Herald**.

### Bosses / elites
Watchful Omen (Margit) → **Fell Warden**; Grafted King (Godrick) → **Stitched
King**; Rot Valkyrie (Malenia) → **Blighted Valkyrie**; Crucible Aspirant/Lord →
**Wyrm Aspirant/Lord**; Demi-Brute → **Husk Brute**. The Malenia move "Waterfowl
Dance" → "Whirlwind of Blades".

### Near-verbatim item / spell / enemy lifts renamed
Wondrous Physick → Wondrous Draught; Blood Grease → Blood Unction; Golden Vow →
Gilded Oath; Golden Seed → Golden Sprout; Beast Eye → Feral Eye; Stonesword Key →
Sealstone Key; Dragon Heart → Wyrm Heart; Moonveil → Moonrend; Erdtree Avatar →
Goldbough Avatar; Stake of Marika → Stake of the Martyr; Two Fingers → The
Oracle; Fingercreeper → Handspider; Runebear → Cinderbear; "Lord's Blood/Oath/
Mercy" (Mohg/Lord of Blood) → Goreblood / Oath of Ash / Last Mercy.

### Placeholder data
Dev co-op preview names Ranni / Blaidd → Wren / Fenn. In-source comments naming
Margit / Godrick / Malenia (design inspiration notes that rode into the bundle)
were neutralized.

## Deliberately retained — rationale

- **"Valkyrie"** — public-domain Norse mythology, not a FromSoft mark.
- **Generic genre/combat vocabulary** — Bleed, Poise, Block, Strength, Dexterity,
  Weak, Vulnerable, Frail, flask, shrine, merchant, elite, boss, Ascension,
  Exhaust/Ethereal/Innate. Common deck-builder / RPG terms (Slay-the-Spire
  lineage), no single-source origin.
- **Internal identifiers, never shipped as user-facing text** — the CSS variables
  `--rot` / `--grace` and the cosmetic tint slot ids `'rot'` / `'grace'` are
  color-slot names in code and save data; renaming them would break existing
  cosmetic saves and they are invisible to players.
- **Nominative references in design docs + CREDITS** — the words "Elden Ring",
  "FromSoftware", "Malenia", "Godrick", "Margit" remain in internal design docs
  (as the acknowledged inspiration and "terms to avoid" guidance) and in the
  CREDITS non-affiliation notice. This is descriptive/nominative use, not use as
  a source identifier for the product.

## Points to raise with counsel (residual-risk, by design)

1. **Motif preservation is intentional.** The replacement names keep the same
   thematic concepts (a glowing great-tree, a guiding flame, a red decay
   plague, star-magic). e.g. "Crimson Blight" is a same-meaning original name
   for a red-decay affliction. Confirm the motif-level similarity is acceptable
   (genre themes are generally not protectable, but worth a sign-off).
2. **Mechanical boss archetypes** map 1:1 to *Elden Ring* bosses (a warden-king
   gatekeeper, a grafted/stitched amalgam king, a blade-saint) though renamed
   and re-fluffed. Confirm mechanical homage without the names is acceptable.
3. **Overall Souls-like presentation** (tone, difficulty framing, dark-fantasy
   UI). Genre trade dress — confirm nothing reads as passing-off.
4. **Trade dress / visual style** of the procedurally-generated art.
5. Final pass on the **product name "Ashen Spire"** and the CREDITS disclaimer
   wording for jurisdiction fit before any commercial release.

## Verification performed (engineering, not legal)

- Residual-term grep over all shipped source **and** the built single-file bundle
  (`build/AshenSpire.html`) returns no *Elden Ring* game-vocabulary.
- `contentVersion` bumped `0.1.0-m1` → `0.2.0-ashen`; pre-scrub saves archive.
- 24/24 engine tests pass (content validation binds every id).
