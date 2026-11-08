# SPEC history — Configurable stat pools (§13.4s) and §14 The deck editor and the three shops

Archive of material moved out of SPEC.md by the SpecConcise pass (2026-11-07). Not rules.

## Configurable stat pools, ratings, Poise and Ward

- Pre-ruleset-7 older formulas (before the owner's 2026-09-24 weights): AR=floor(STR/2), DR=floor(DEX/2), PR=floor(INT/2)+floor(WIS/2), Poise=1+CON+floor(STR/2), Ward=1+WIS+floor(INT/2).
- Rationale for the base of 1: "a vessel of nothing is not a vessel."
- Owner quotes on break behaviour (2026-10-12): "on poise break yes"; "any break but vulnerable to any damage type".
- Ruleset 7 = the default formulas AR=STR, DR=DEX, PR=INT, Ward=1+WIS, Poise=1+CON; the owner's 2026-09-24 weights are the frozen set for earlier runs.

## 13.4s Core card upgrades

- Heading was "13.4s Core card upgrades: free by rank, a stone past that, ten at most (owner ruling, 2026-10-28)".
- Owner ruling 2026-10-28 (Core only). 2026-10-31 owner asks: the Blacksmith cost (every upgrade costs `blacksmith.prices.cardUpgrade` cinders), the picker showing every upgradable owned card, the option list with identity steps, and the choice of 2 or 3 options. 2026-11-01 owner: a cantrip or Basic costs no Mana; `core.mendingTouch` now prints 0 MP.
- Removed as obsolete: the "co-op keeps the single roll" clause (no co-op reader in src/ besides comments).

## 14. The deck editor and the three shops

- Heading was "14. The deck editor and the three shops (owner brief, 2026-09-26)".
- Status line (2026-09-27): step 1 (this section) landed in #1331; step 2 deck rules #1343; step 3 deck editor UI #1372; step 4 shop-kind framework #1371; step 5 market additions #1374 and #1377; step 6 blacksmith #1390; step 7 wise master #1438. This section landed before its code in its own PR (CONTRIBUTING ground rule 1); feature PRs followed in the order of §14.6, each ticking its `docs/FINISH.md` §14 line. Defaults were placeholders the owner tunes later; the spec names the key, not a value.
- The `Step` column of the migration-field table (step 2: sideboard, editMintCounter, guard slot note; 4: stock.kind/offerings; 5: consumables, sigils, boughtArmour, companions; 6: smithingStonesRefined, smith stock; 7: trainingPool).
- The shipped-default column of the Deck settings table said "the data file owns" the value.
- Owner revisions inline: Core 2 collection and Adept copies (2026-10-23), equipment grants (2026-10-19), weapon arts on in Core (2026-11-01, reversing the 2026-10-19 "arts stay off"), per-weapon arts (2026-11-05), Mending Touch exclusion (2026-10-28), class spell/Power one copy (2026-09-26), set-aside revision (2026-10-03), UX tweaks (2026-10-11).
- "The editor keeps that model instead of minting bare cards"; the step-2 PR adds no `equipmentGuardSlotCount`/`removedGuardSlotIds`. The Armoury floor and editor bounds are separate settings "so the owner can compare them".
- Removed from §13.4b-era text: "The standing upgrade rule of §13.4e that this line once named is retired" (rankUpCandidates).

### 14.1 Falsify list (acceptance checks, all restate rules in §14.1)

*Falsify:*
- The header has no **Edit Deck** button; with defaults a fresh run opens **Edit Deck** through the Armoury. With `restOnly`, the shrine's Rest screen offers it while the camp's does not.
- Removing a weapon art moves the same instance to `run.sideboard` with its fields, and re-adding it moves it back. A further copy cannot be added when every owned copy is already in the deck.
- The sideboarded art appears in `run.collection` and in the smith's installable list.
- Removing an equipped Strike retires its slot and sideboards it, and adding a Strike un-retires that slot first.
- With no slot retired, adding a Strike raises `equipmentAttackSlotCount` by one, and the next `stampDeck` stamps it with the weapon's face without throwing.
- A 9-card draft is refused under min 10 with a sentence naming 9 and 10, and is allowed with `deckMinUnlimited`.
- A granted card can be removed; restamp, save/reload and combat equipment reconciliation leave it in the library until explicitly restored.
- Cancel restores both piles exactly.
- With `playInDeckOrder`, the opening hand is the first cards of `run.deck`, Innate first, and a reshuffle returns discards in deck order. With it off, a seeded opening hand is unchanged from before this section.
- A fight saved in ordered mode resumes ordered after the setting is turned off.
- A schema-10 save loads with `sideboard: []`.

### 14.2 to 14.5 notes

- Removed (owner, 2026-11-07, Unity-port cleanup): classic merchant node kind roll, weighted shopOffers roll with guaranteedMinimum, market and master kinds and stock builders, legacy market (shelves, armour, smith stones, sigils, inn rest, skill books, revive tokens, quest event, companions, model/marketAdditions.js, mountShop), legacy blacksmith offerings (smithStones, refineStones, sigilSlots, sigils, extractArt, installArt, stackCopy, refined purse, legacy upgradeArt and rack), and the wise master (training, respec, lesson, appraisal, redistribute, master screen, model/master.js, withdrawSkillAttributes, Master art-destination setting).
- 14.4 weapon arts note (owner, 2026-11-05).

### 14.6 Build order

Each item is one PR into `dev`, test-first, with a receipt, and a screenshot and a catalog update where there is UI:

1. **This SPEC PR**, with the research note and FINISH §14.
2. **The deck rules engine and settings.** It adds `deckRules.js`, the Deck settings group, `run.sideboard` (a schema bump), `deckEditRefusal`, and ordered draw in `createCombat`/`drawCards`. It has no UI beyond the settings rows.
3. **The deck editor UI.** It adds `DeckEditorModel`, `mountDeckEditor`, the Armoury and Rest doors, the `deckEdit` tag, and drag, tap and gamepad input.
4. **The shop-kind framework.** It adds `shops.js`, the offering roll with the guaranteed minimum, the Shops settings group, `stock.kind`, and the existing shelves re-expressed as offerings, with seeds byte-identical.
5. **The market additions.** It adds the smith-stone shelf, armour, and inn rest, then consumables (skill books and revive tokens), sigils (inventory only), the quest event and companions. Each is its own PR if it grows past one review.
6. **The blacksmith screen.** It adds refining, sigil slots and sigil install, art upgrade, and stack copy.
7. **The wise master.** It added masters data, the atlas service type, training, respec with the training pool, lesson, appraisal and redistribute. (Steps 4 to 7 describe the legacy shops, removed 2026-11-07; see §14.2 to §14.5.)

### 14.7 Deck-editor research — what we adopt, and why

Surveyed: Hearthstone, Legends of Runeterra, Marvel Snap, MTG Arena, Monster Train,
Inscryption, and Slay the Spire's deck-view / "Deck Builder" mods.

| Pattern | Seen in | Adopted? | Why |
|---|---|---|---|
| Two panes: collection grid left, deck list right, drag either way | Hearthstone, MTG Arena, LoR | **Yes** | The layout every player of the genre already reads; drag is the fast path. |
| Tap/click-to-add, tap-to-remove as the equal of drag | Hearthstone, Snap, LoR (mobile) | **Yes** | Drag is unreliable on small touch screens and impossible on a gamepad; every drag has a tap and a button twin. |
| Deck list collapsed to one row per card variant (id + upgrade + mods; for a locked card, also its owner) with a ×N count | Hearthstone, Arena, LoR | **Yes**, except while **Play in deck order** is on | Counts are the scan-friendly view; in ordered mode each copy is its own row so it can be placed. A Strike and a Strike+ stay two rows: merging them would hide the upgrade and make ＋/－ ambiguous, and the collection tiles use the same variant key. |
| Live size counter "N / min–max", red when out of bounds, Done disabled with a sentence | Hearthstone (30/30), Snap (12/12), Arena (60+) | **Yes** | The invalid state must be explained, not just coloured (SPEC §7.5, FINISH §6). |
| Copy limit shown on the collection tile ("2 owned, 1 in deck") and greyed when exhausted | Hearthstone, LoR, Arena | **Yes** | Weapon arts and techniques are limited to owned copies; basics show ∞. |
| Filters (type, cost, source) and sort (cost, name, type, source) as chips above the collection | Hearthstone (mana crystals), Arena, LoR | **Yes**, chips not a hidden menu | One tap each; the Reading Desk also offers a text search over collection names and resolved rules (currently off). |
| Mana/cost curve histogram | Hearthstone, Arena, LoR | **Yes, compact** | Cheap to derive; the one analytic players ask for. |
| Undo / "revert to deck on entry" | Snap (discard changes), Arena | **Yes** — Cancel restores the entry deck | Editing is out of combat, so a whole-session revert is simple and safe. |
| Deck edited mid-run only at rest or through removals | Slay the Spire, Monster Train, Inscryption | **As an option** (`Rest sites only`) | The owner wants to compare it with Free editing; roguelike tension comes from this restriction. |
| Hand-ordered draw ("stacked deck") | StS mods (e.g. "Ordered Draw"), Inscryption's squirrel/side-deck split | **Yes**, behind **Play in deck order** | The owner asked for it; the reorder handle only appears when it matters. |
| Unlimited basics, limited rares | Inscryption (squirrels), Monster Train (starter cards) | **Yes** | Matches the owner's copy rule: Strike/Defend ∞, arts and techniques by ownership. |
| Crafting / dusting inside the editor | Hearthstone, LoR, Arena | **No** | Copies are earned in play and stacked at the blacksmith (§14.3); a second economy in the editor would duplicate it. |
| Auto-fill "complete my deck" | Hearthstone, Arena | **No (v1)** | The deck starts from the run's real deck; nothing to fill. |

## Review fixes (PR #2691)
- Nothing else lived only in the Falsify list or the §14.7 table: header-has-no-Edit-Deck and the variant-key row rule were restored to §14.1; the rest restate rules kept in §14.1.
