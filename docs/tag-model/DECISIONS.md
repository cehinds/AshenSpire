# Tag model: owner decisions

Each section records one owner decision from 2026-10-11, what it decided, and
what changed in the tables. A decision that changes no table says so. Open
points are listed in *Couldn't place* at the end of each section and again in
the final section.

Tables are regenerated with `tools/build.mjs`; `tools/check.mjs` validates them.
Formula, relation and value keys follow the README conventions.

---

## 1. Settings are split (per-device and global)

- **Date:** 2026-10-11 (owner).
- **Decision:** Settings are split in two. *Per-device* settings are layout,
  text size and similar. *Global* settings are audio, difficulty, keybinds and
  similar.
- **Tables changed:** none in this step. `settings.csv` `scope` still derives
  `player` or `tuning` from the source file (`scopeOf` in `tools/build.mjs`).
  The device/global split has no column and no classifier rule yet.
- **Couldn't place:** the rule that maps each settings row to device or global.
  It needs a classifier rule before it can be a column.

## 2. Device bands gain `wide`

- **Date:** 2026-10-11 (owner).
- **Decision:** Four device bands. Phone is 599px and under, tablet 600px to
  1023px, desktop 1024px to 1439px, and a new `wide` band from 1440px.
- **Tables changed:**
  - `tools/bands.mjs`: the ranges, and `wide` in `BAND_NAMES`.
  - `tools/build.mjs` and `tools/check.mjs`: `wide` in the band vocabulary. The
    build regenerates `meta.presentation.layout.breakpoint.wide` in `tags.csv`.
  - `tables/presentation/layouts.csv`, `styles.csv` and `breakpoints.csv` derive
    `band` (or the breakpoint `tag`) from the new ranges. Rows that were
    `mobile` and whose width straddled the new 599/600 edge move to `other`:
    45 layouts, 128 styles and 5 breakpoints. No row lands in `wide` or `tablet`
    because the inventory has no condition at or above 1440px and none that sits
    wholly inside 600px to 1023px.
  - `layouts.csv` does not key by band (its key is component and breakpoint), so
    only its derived `band` column changes.
  - `breakpoints.csv` has no `band` column; its band lives in `tag`.
  - `README.md`: the band list.
- **Couldn't place:** a `(max-width: 600px)` condition is now `other`, not
  `mobile`. If the owner wants 600px to count as phone, the rule is a one-line
  change in `bands.mjs`. The pointer:coarse portrait rule is unchanged.

## 3. Delivery is a type of its own (melee, ranged, cast)

- **Date:** 2026-10-11 (owner).
- **Decision:** Ranged and Casting are a delivery type, separate from stance.
  Delivery is melee, ranged or cast. Each stance has a delivery reference that
  by default points to the stance's default delivery, so delivery and stance
  resolve the same today. A tag may later override the delivery.
- **Tables changed:**
  - `tables/tags.csv`: new `meta.combat.delivery.melee` (key `melee`, status
    `new`). The existing `ranged` and `casting` nodes stay. `casting` is the
    owner's "cast" and keeps its id. `multi-hit` and `area` stay as delivery
    modifiers.
  - `tools/legacy-status.json`: `melee` added as `new`, so the build accepts it.
  - `tables/relations.csv`: relation `DEFAULT_DELIVERY` (stance key to delivery
    key), seven rows:
    - `attack`, `smash` and `sweep` to `melee`. Their children inherit it.
    - `parry` to `melee`.
    - `school-counter` and `ward-counter` to `casting`.
    - `ranged-counter` to `ranged`.
  - The override is not a row yet. It would be a relation such as
    `OVERRIDES_DELIVERY` from a tag to a delivery, and is added with the first
    tag that needs it.
- **Couldn't place:**
  - `school-counter` and `ward-counter` as `casting` are my reading of the tree
    ("Umbral Ward", "Warding Star" are cast-like). Owner to confirm.
  - Defensive stances (`block`, `evade`) and the `counter` group have no
    default delivery row. Defensive stances are not attacks, and counter
    children differ. Owner to say whether they should have a delivery.
  - `elemental-strike` is under Attack and inherits `melee`. Owner to confirm.
