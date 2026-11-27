# Generate subclass card lists

This is the current operating guide. Future editor workflow and workbench
requirements are consolidated in [Editor tool specification](EDITOR-SPEC.md).

Score Studio can generate fifteen named cards for each of twelve playstyles:

| Class | Subclasses |
| --- | --- |
| Reaver | Bloodletter, Bulwark, Breaker |
| Rogue | Assassin, Venomist, Duelist |
| Starseer | Constellation, Gravitist, Reservoir |
| Herald | Martyr, Plaguebearer, Saint |

Generating all twelve produces 180 cards. These are the subclass cards; the
additional class foundation cards, shared cards, and equipment catalogs are
separate work.

## Open Score Studio

From the repository root, start the local authoring server:

```powershell
node tools/score-studio/launch.mjs --no-open --port 4173
```

Open `http://localhost:4173/tools/score-studio/`. The **Tools** menu contains
**Generate subclass lists…**, the other generators, and Rebalance power.

## Workspace and decks

The gallery stays on the left. The **Content type** dropdown beside search
switches between **Cards** and **Items**, retaining each gallery's search and
filters. The **Customize** dropdown above the right pane switches
between **Properties**, **Design**, **Weights**, and **Deck lists** without
replacing the gallery. Design follows the card/item context; applying weights
rescores the visible entries.

Drag the divider to resize the pane, or focus it and use the arrow keys.
**Undock** moves the same controls into a modal. The selected card or item shows
a centered pencil/**Edit** action over its illustration on hover or keyboard
focus; touch keeps the action visible. A 10% gray face overlay sits beneath Edit
and Select on hover. Clicking a card selects it; Edit explicitly opens its modal,
which includes Rename and Rebalance power for that entry. Docking keeps edits,
selection, and undo state.

Enable **Select** to reveal checkboxes over the card art. Check individual cards
or choose **Edit → Select visible cards** for bulk actions. Selected cards have a green outline.
Turning Select off clears the selection. The blue **Add card** cell is an action
and never participates in selection.
The inline selection count includes cards outside the current filter; selecting
cards adds no rows above the gallery. **Edit** contains Clear card selection,
Rename selected cards, and Remove selected added cards. **Tools → Rebalance power
selected cards…** balances only that selection, without generating additional
cards or trimming unrelated entries.
The **Rebalance** quick action also uses the selected cards when any are
selected; **Tools → Rebalance power cards…** remains available for the full pool.
The arrow beside **Rebalance** opens **Generate names**. It renames selected
cards when there is a selection, otherwise all cards (with the existing prompt
to save their current names first). In Items, it renames all items.
**File → New deck from selected cards…** creates a deck from the selection.
**Tools → Add selected cards to a deck…** and **Remove selected cards from a
deck…** open Deck lists and focus its deck selector; choose the deck, then
confirm the membership action in that pane.

**Deck lists** shows compact rows grouped by class/type, with search, counts,
and a Remove button for each member. The **Deck / class list** dropdown inside **Filters** combines
filtering and opening a list: **All cards** or **All items** shows the whole gallery, **Class decks**
includes each class (and Shared), and **Custom decks** contains your own lists.
Choosing a list updates the Deck lists pane while Filters stays open, so you
can combine filters before choosing **Done**. **Manage decks…** closes Filters
and opens that pane, including when it is undocked. Class lists use strict class
membership and are read-only; copy one to make an editable custom deck.
Use **View → Deck lists** to create a deck,
add the selected cards, or remove selected members in the right pane.
Removing deck membership leaves the gallery
card intact. Subclass templates are read-only; copy a template into a custom
deck to change its membership.

**Remove added cards…** removes selected generated/custom cards from the Studio
draft and its deck/list references. Original Core cards are protected. Confirm
the displayed count; Undo restores the removed cards. This action does not
delete previously exported game content.

The first gallery cell is **Add card**. It inserts a common Skill named **New
card**, with **New card** as its text. Its green draft outline remains until you
edit it. A short insertion animation shows existing cards moving to make room;
reduced-motion preferences disable that animation.

The compact header keeps **File**, **Edit**, **View**, **Tools**, **Git**, and
**Test** left-aligned on one row, with the Score Studio name at the right.
Select mode sits at the left of the row below, followed by search, Content type,
and the **Rebalance** split button. **Filters** stays at the right. On narrow screens these controls wrap rather
than shrinking or overflowing.
Both **Filters** buttons open dialogs; neither adds rows above the gallery. Cards
includes its deck/class list, type, class, rank, rank shifts, and view settings.
Items includes its deck/class list, kind, rarity, rank, and sort controls. Changes
apply immediately; **Reset filters** clears them, and **Done** returns to the
gallery. Filter dialogs always start closed.

Each dialog includes a gallery **Size** slider, percentage, and **Reset size**.
Ctrl/Cmd + wheel over the gallery changes card or item size around the pointer;
normal wheel scrolling remains unchanged. Smaller sizes show more entries per
row. Card and item sizes are saved separately; filter resets preserve them. The
inspector preview size remains independent.

**Git** opens the repository, pull requests, or Dev history on GitHub; it does
not perform Git writes. **Test** opens the combat simulator, tests the selected
card, applies scoring, resets or refills the simulation, ends a turn, or opens
Effects timing. The simulator retains its class/enemy scenario selectors.
The right pane's Customize dropdown remains available for fast view changes.

## Preview and apply power changes

**Rebalance** opens a workspace for the current selection. Set a rank, rarity,
or target CP; **Keep current** preserves a property, and a blank target CP lets
the tuner choose. Costs, preferred effects, and stances are optional sections.
Blank SP/MP costs are automatic; enter a number to fix a cost. Effect count
defaults to keeping the current count. Preferred effects include the existing
status effects, subject to the current rank and rarity gates.
**Generate names** applies to the next preview you create.

**Rebalance** and **Reroll** create staged versions. The game card faces and
their measured CP/rank appear before and after, with a short change list.
CP uses the same profile-scaled mechanics displayed by the face. Changing an
authored number within the same rounding step does not change CP when the
displayed effects, costs, rarity, and other properties stay the same. Conditional
effects and next-card charges retain their expected-use weighting.
Use the card arrows to move through the frozen scope and the version arrows to
compare attempts. **Compare with original** keeps the starting card on the
left; turn it off to compare the previous version. A warning reports a target
the tuner could not reach exactly.

**Revert** discards the current card's staged changes. **Apply changes**
saves the staged results as one undo step. **Cancel** leaves the Studio draft
unchanged, including when generation is still running. The footer stays visible
while the previews and settings scroll; phone previews stack vertically.

The comparison header groups scope and targets with naming. Card and version
arrows share one compact toolbar; single-card and empty-history arrow groups
stay hidden. Reverting to Original keeps the version arrows available.
Numeric changes remain prominent; tags and upgrade-choice metadata sit under
**Other changes**. On phones the action footer shares one row, and completed
previews return to Changes without moving focus away from the action.

The presentation draws on the prominent card pair in the
[Slay the Spire upgrade example](https://note.com/_pechi/n/n1172b7eac9b0)
and the concise upgrade summaries shown in
[Monster Train](https://boilingsteam.com/monster-train/). No artwork was copied.

**Advanced pool settings** starts collapsed. Explicitly enable pool mode to use
the existing seed, quotas, count, generation/trim, and import/export controls.
Selected-card work keeps its fixed selection. Items use the same staged workflow
with their legal item controls; card costs, effects, and stances are hidden.

## Generate and edit lists

1. Choose all classes, one class, or one subclass.
2. Set a seed. Keeping the seed, settings, and scoring weights unchanged gives
   the same card definitions and stable card IDs.
3. Leave rank on its defaults or select a rank from 1 to 5.
4. Choose **Preview** to inspect names, rules, upgrades, and projected ranks.
5. Generate the lists into the gallery. **View cards** filters to one list;
   the normal inspector edits its cards.

Existing cards remain in the gallery. Replacing an already generated list
requires the replacement checkbox. Undo/redo and the saved draft include list
membership. A missing list member blocks export rather than silently dropping it.

## Upgrades and scoring

Cards reuse the game's existing effects, statuses, tags, upgrade families, and
tier-unlock rules. Their compatible upgrade menus travel with their definitions.
The generator, subclass inspector, upgrade evaluation, and game rank report use
the same definition projection.

Conditional effects and next-card charges use the configured scoring reliability;
their score is an estimate of power, not a promise of a particular combat outcome.
The preview reports adjustments and target misses instead of hiding them behind
rank overrides. Existing combat rules take precedence over the working names:
Reservoir uses Retain, Mana restoration, and charges that expire this turn;
Constellation uses the existing prior-spell and distinct-spell checks. It does
not add a new stored-Mana resource or a new ordered-sequence engine.

## Export into the game

**Export selected lists into game** validates the current edited definitions,
adds them to their class reward pools, and rebuilds game content and rank lists.
It updates both the authored content tables and Core pack. Repeated exports
update only cards owned by the subclass catalog; collisions with authored cards
are rejected. Failed rebuilds roll back the export.

Reload the game after a successful export. Its ordinary class, resource,
spell-tradition, ownership, and rank eligibility rules still apply.

**Download catalog** saves the selected lists, current card definitions, and
upgrade choices as a portable JSON file. It does not write to the game. Import
that file through the subclass dialog on another checkout, or run:

```powershell
node tools/import-subclass-catalog.mjs C:\path\ashenspire-subclass-catalog.json
```

Hosted Score Studio supports generation, editing, and downloading. Export into
game requires the local authoring server. The existing scoring-settings export
remains separate from card-catalog export.

## Interaction references

The action/selection distinction follows the
[Carbon tile patterns](https://www.carbondesignsystem.com/building-blocks/core/components/tile/guidelines)
and the floating Edit action adapts
[Fluent card interaction guidance](https://fluent2.microsoft.design/components/web/react/core/card/usage/).
The centered placement and 10% gray treatment are this Studio's visual choices.
