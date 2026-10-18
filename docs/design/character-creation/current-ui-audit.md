# Current creation audit

Source: 6aa51558f; fresh Chromium captures; Starseer; 1440×900 and 390×844. Existing external high/common art packs unavailable: light art fallback used where available. No game code changed.

1. Class — healthy structure and visible selection. Four choices, selected class art, stats and relic. HAND 4 here means opening hand; Attributes HAND 7 means capacity: identical labels obscure different quantities. Unselected long descriptions truncate on desktop.
2. Primary Attributes — readable totals and bonuses. Standard mode is shown twice (fold value and dropdown). Nested Keep­sake/Sprite folds remain despite a separate Keepsake rail stage. Inner Continue and footer Next duplicate navigation.
3. Keepsake — clear single selection and authored effect text. Name and Primary Stats/Sprite folds repeat from the Character pane, diluting the current task.
4. Equipment — initial direct rail entry shows a collapsed Starting armour header, otherwise blank content and disabled Next. This is the actual entered state, not a loading screen. Reveal the active section automatically or provide an explicit visible action.
4b. Starting spells — selection budget visible (0/2, Rank 1). Existing illustrated cards are strong style references. Desktop choices use only left half of the pane; lower cards are cropped at the footer and require scrolling. Continue floats in the mostly empty right half, while footer Next remains separately disabled.
5. Review — useful Character/Armour/Main Hand/Relic summary. Card-body text is tiny and clipped; Journey uses an unstyled bright native select. Begin explains the missing two spells at bottom. Distinguish opening hand and hand capacity consistently; show selected feats/spells clearly in redesigned review.

Priority: separate Feats and Spells stages; eliminate empty equipment entry; harmonize stat labels; improve card-detail readability and spell-grid use of width; simplify duplicate folds/actions.

Proposed order (owner correction): Class → Attributes → Keepsake → Equipment → Feats → Spells → Review. Spells appears only for caster classes or a class with the canonical spell tag. Martial classes skip Spells and retain maneuver choices in Equipment. Feat pick budget and eligibility remain undecided; visual concepts must state rules pending and grant nothing.

Content facts: Reaver/Rogue currently choose one Rank 1 maneuver; Starseer/Herald choose two Rank 1 spells. Prerequisites depend on attributes/hands and copy limits. General feats: Field Study (+10% character XP), Weapon Drill (+10% weapon/focus/dual-wield XP), Armour Practice (+10% armour XP), Class Insight (+10% class XP), Spoils Instinct (+10% Cinders), Vital Renewal (+5 HP after victory). These are repeatable progression choices, not existing starting grants. Separate class progression catalog has 50 level-gated feats; never imply all are valid at birth. Current run starts feats empty.

Limits: screenshot audit does not establish contrast compliance, screen-reader support, keyboard flow or large-text behavior. No gameplay fixes or new rules implemented. Browser automation is local Chromium fallback because in-app browser is unavailable. Product Design referenced support resources/preflight script were not exposed in this environment; current supplied repo/context used.

Mobile evidence: all first four stages plus spell subsection inspected. Attribute descriptions wrap across 2–3 lines; values remain tiny at right. Spell cards shrink to three across with tiny rules text and a horizontal card scroller; only first three of 14 choices are visible, with large empty vertical area. Equipment hides the creation-step dropdown, so the audit could not return to Review via visible rail navigation. Mobile Review capture blocked by unavailable category control; desktop Review accepted. No hidden DOM clicks used to claim a visible navigation route.

Accepted captures: 01-class, 02-character, 03-keepsake, 04-equipment, 04b-spells at both 1440 and 390 widths; 05-review at 1440. Equipment's empty state is accepted as an observed UX defect, not as a finished picker design. All listed screenshots were opened and visually inspected. Manifest records exact files/viewport/source URL.
