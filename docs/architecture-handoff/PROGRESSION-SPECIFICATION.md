# W1x · Weapon and skill proficiencies

Proposed documentation reference: separate weapon and skill practice tracks, inspired by the requested use-based progression. No exact FF2 formulas, award triggers, rank benefits or balance are asserted. The existing game equipment screen, equipment cards, modal shell and resource bars are reuse references; this proposal does not implement progression in the game.

W1x inherits W1 navigation and W0 title/exit/inline footer anchors. W1x1 selects Weapons and W1x2 selects Skills. WGP0 groups reusable WGP1 list rows, WGP2 progress, WGP3 known techniques and WGP4 next benefit. Reuse WCI1 identity, WCM2 meter, WCF4 fact rows, WCB4 Back and WCB5 Exit contracts. The only production footer action is Back and it spans the footer. Preview awards sit outside the game frame.

Wide uses category, proficiency list and detail columns. Compact, iPhone SE and Galaxy S24 use two inline dropdowns followed by the same details. Detail order is name/rank, practice, next benefit, known techniques and recent practice. Only the details scroll when necessary; header and footer remain anchored. All measurements and presentation colors originate in `progressionConfig` in `progression-reference.mjs`. The container breakpoint must be emitted from that config when integrating the stylesheet; the standalone CSS records its default.

Category buttons use `layout.standardButtonHeight` (default `2.75rem`). Weapon and skill tiles use that height multiplied by `layout.tileHeightMultiplier` (default `2`), giving a default tile height of `5.5rem`. The desktop category, tile and detail tracks use `1fr / 1fr / 2fr`: nominally 25% / 25% / 50% of the available track space. Category and tile columns have equal width and the same horizontal inset, so their buttons and tiles also have equal width. The three columns align at the top and have vertical separators. Buttons and tiles do not stretch to fill unused column height.

Each proficiency tile contains exactly two rows: name at the left and rank at the right; then a progress bar at the left and the `x/X` fraction at the right. The meter takes the remaining row width after the fraction and configured gap. Its thickness is `layout.meterHeight`. There is no “Practice” subtitle. WGP2 uses this same inline arrangement in standalone examples and in workspace details. Compact and both portrait profiles retain the two navigation dropdowns; they do not squeeze the desktop tile columns into the phone. A standalone WGP1 tile keeps the same height rule in every profile.

The shared nine-size button catalog combines third/half/full widths with standard/tall/double heights. Progression imports `buttonWidths` from `button-widths.mjs`; it does not maintain independent height defaults. Category buttons use `full-standard` and proficiency tiles use `full-double`, relative to their equal-width columns. `layout.standardButtonHeight` and `layout.tileHeightMultiplier` derive from the shared standard height and double multiplier.

The renderer in `progression-reference-client.js` consumes projected records and cloned preview state. It never grants a gameplay ability. Awards clamp at the illustrative threshold; real rank crossing and rollover require a separate approved domain specification. Unknown techniques render generic locked rows, without leaking their names. JSON sample values are immutable and intentionally illustrative.

Each rendered wide, compact or portrait view owns separate selection, award and preview-configuration state. Controls outside the player frame toggle locked techniques and history, set the preview award amount and reset the instance. W1x1 and W1x2 retain their wireframe identity when switching categories. Standalone WGP components receive the same visual tokens, controls and linked child references as their composed workspace.

## Normalized storage (3NF)

| Relation | Key and facts |
|---|---|
| ProficiencyCategory | category_id PK; category_name |
| ProficiencyDefinition | proficiency_id PK; category_id FK; name_key; description_key |
| CharacterProficiency | character_id FK + proficiency_id FK composite PK; accumulated_practice |
| ProficiencyThreshold | proficiency_id FK + rank composite PK; required_practice |
| TechniqueDefinition | technique_id PK; name_key; description_key |
| ProficiencyUnlock | proficiency_id + rank + technique_id composite PK/FKs |
| PracticeEvent | event_id PK; character_id FK; proficiency_id FK; source_event_id; awarded_practice; occurred_at |
| KnownTechnique | character_id + technique_id composite PK/FKs; discovery_event_id FK |
| TagDefinition | tag_id PK; tag_name |
| ProficiencyTag | proficiency_id + tag_id composite PK/FKs |

Do not store rank or next threshold in CharacterProficiency when they are derived from accumulated practice and threshold definitions. Do not copy category names into proficiency rows, technique names into unlocks, or current totals into events. Choose events as the authority with a rebuildable totals projection, or a transactional total plus audit events; never maintain unrelated competing totals. Enforce award idempotency with a unique source-event/proficiency/character constraint, or a configured award sequence where one source can intentionally award multiple times. JSON/CSV imports represent these same relations and validate foreign keys before publication. View models may denormalize names and meter values for rendering.

## Source references

- `src/ui/screens/equipment.js`: current equipment surface; proposed proficiency navigation can attach here after mechanics approval.
- `src/ui/components/equipmentCard.js`: existing equipment presentation boundary.
- `src/ui/components/modalShell.js`: current modal shell reference; W0 describes the requested placement contract.
- `src/ui/components/resbars.js`: existing meter presentation reference.
- `progression-reference.mjs`: complete diagrams, pseudocode, model defaults and source descriptions.
- `progression-reference-client.js` and `progression-reference.css`: actual runnable documentation renderer and styles.

The gallery must label this as a proposed reference composition, not execution of the production game. Source file paths above are present source references; no line numbers are frozen because they drift as the game changes.
