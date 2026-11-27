# Score Studio feature checklist

The [editor specification](../EDITOR-SPEC.md) controls requirements, priorities
and persistent-workbench behavior; this checklist preserves supporting coverage.

All unchecked items are requested/planned scope, not implementation claims. See the [prioritized plan](IMPLEMENTATION-PLAN.md) for dependencies and the [first user story](stories/SS-001-persistent-workspace.md) before starting the first task.

## First delivery tool features

- [ ] Connect the existing library, native preview and inspector in one usable workspace (SS-001).
- [ ] Keep the selected entity and immediate working context coordinated between supported surfaces.
- [ ] Expose separate Camp, School, Tradition and Stance controls.
- [ ] Create, duplicate and edit supported cards with clear validation and derived values.
- [ ] Add gallery/table views, explicit sorting/filtering and stable-ID selection.
- [ ] Add keyboard/range/multiselection, contextual bars, right-click/overflow and bulk editing.
- [ ] Build a two-pane deck/starter editor with quantities and validated assignment.
- [ ] Add group drag/drop, Copy/Move, manual ordering and distinct removal/Trash.
- [ ] Unify honest generation results and scoped repeatable rebalance.
- [ ] Expose naming rules, independent tool/section presets and consistent state memory.
- [ ] Make source scope, Draft/Applied/Saved/Loaded state, Undo and import/export explicit.
- [ ] Connect the actual local-game configuration and normal/scenario launch paths.
- [ ] Add supported feature/mechanic authoring with reversible registry migration.
- [ ] Reuse native card/HUD/effects tools, then add validated motion/sprite adapters.
- [ ] Expand Card/Encounter Labs, comparison and repeatable actual-game evidence.
- [ ] Extend proven controls to rewards, enemies, progression and maps one consumer at a time.

## Complete requested scope

REQ numbers preserve the original 180-item reference. Package mappings are planning coverage; completing a package requires its actual acceptance.


### Selection

- [ ] REQ-001 Click to select. (W05)
- [ ] REQ-002 Ctrl-click toggles individual cards; provide platform-equivalent modifier. (W05)
- [ ] REQ-003 Shift-click selects a range in displayed order. (W05)
- [ ] REQ-004 Ctrl+Shift-click adds a range. (W05)
- [ ] REQ-005 Ctrl+A selects all matching in the active collection, not merely rendered cards. (W05)
- [ ] REQ-006 Escape cancels drag before clearing selection. (W05, W10)
- [ ] REQ-007 Right-click a selected card preserves multiselection. (W05, W11)
- [ ] REQ-008 Stable-ID selection survives sorting and editing. (W03, W05, W12)
- [ ] REQ-009 Count selected cards, including filtered-out selections. (W05)
- [ ] REQ-010 Select visible/matching, invert, clear and show selected. (W05)
- [ ] REQ-011 Optional rectangle selection. (W05)
- [ ] REQ-012 Selection updates the visible inspector; double-click or explicit Edit may focus or expand it without being required for ordinary inspection. (W05)

### Bulk editing

- [ ] REQ-013 Contextual selection action bar. (W11)
- [ ] REQ-014 Mixed-value indicators. (W11)
- [ ] REQ-015 Only explicitly edited properties change. (W11)
- [ ] REQ-016 Set/increase/decrease/percentage operations where supported. (W11)
- [ ] REQ-017 Add/remove one trait without replacing unrelated traits. (W04, W11)
- [ ] REQ-018 Apply one current-card property to selection. (W11)
- [ ] REQ-019 Preview affected/excluded cards and before/after values. (W11)
- [ ] REQ-020 One Undo per batch. (W09, W11)
- [ ] REQ-021 Bulk duplicate/rename/rebalance/export/deck assignment. (W11, W16)
- [ ] REQ-022 Distinguish shared definitions from deck entries. (W05, W06)

### Drag/drop

- [ ] REQ-023 Single-card drop into deck/starter. (W10)
- [ ] REQ-024 Drag the whole selection. (W10)
- [ ] REQ-025 Drag badge shows cards/copies. (W10)
- [ ] REQ-026 Valid drop targets and reasons for invalid targets. (W10)
- [ ] REQ-027 Destination/quantity preview. (W10)
- [ ] REQ-028 Explicit Copy/Move semantics. (W10)
- [ ] REQ-029 Sidebar deck targets. (W05, W06, W10)
- [ ] REQ-030 Hover opens the destination without committing data. (W10)
- [ ] REQ-031 Edge autoscroll. (W09, W10, W23)
- [ ] REQ-032 Manual reorder. (W03, W05, W10, W12)
- [ ] REQ-033 Remove from this deck preserves definitions. (W05, W06, W10)
- [ ] REQ-034 Recoverable custom-definition Trash. (W09, W10)
- [ ] REQ-035 Escape cancels without mutations. (W10)
- [ ] REQ-036 Keyboard/menu alternatives to dragging. (W10)

### Sort/filter

- [ ] REQ-037 Sort CP/name/ID/type/rank/rarity. (W03, W05, W12)
- [ ] REQ-038 Sort SP/MP/HP costs. (W03, W05, W12)
- [ ] REQ-039 Class/school/tradition/stance sort/group. (W03, W05, W12)
- [ ] REQ-040 Sort directions and deterministic tie-breaks. (W03, W05, W12)
- [ ] REQ-041 Secondary sort. (W03, W05, W12)
- [ ] REQ-042 Separate sort, group and filter concepts. (W03, W05, W12)
- [ ] REQ-043 Selection IDs persist after sorting. (W03, W05, W12)
- [ ] REQ-044 Shift range uses the new displayed order. (W05)
- [ ] REQ-045 Drag reorder explicitly switches to Manual ordering. (W03, W05, W10, W12)
- [ ] REQ-046 Per-deck/view saved filters, sort, columns and layout. (W03, W05, W12)
- [ ] REQ-047 Visible filter chips and clear actions. (W03, W05, W12)
- [ ] REQ-048 Search names/IDs/tags/effects/descriptions with truthful hints. (W03, W05)

### Context menus

- [ ] REQ-049 Library-card context actions: edit/duplicate/add/rebalance/rename/export. (W11)
- [ ] REQ-050 Count-aware multi-card context menu. (W11)
- [ ] REQ-051 Deck quantity/replace/edit definition/remove actions. (W05, W06, W11)
- [ ] REQ-052 Starter quantity/replace/validate/test actions. (W06, W11)
- [ ] REQ-053 Deck duplicate/compare/rename/export/play actions. (W11, W16)
- [ ] REQ-054 Feature edit/template/references/archive/restore actions. (W11, W17)
- [ ] REQ-055 Setting reset/explanation/copy/apply-to-selection actions. (W11, W18)
- [ ] REQ-056 Batch select/compare/reroll/save recipe/remove actions. (W11, W12, W13)
- [ ] REQ-057 Empty-space create/import/generate/paste actions. (W11)
- [ ] REQ-058 Scope-aware verbs such as Remove 15 cards from this deck. (W11)
- [ ] REQ-059 Explain unavailable actions. (W11)
- [ ] REQ-060 Right-click, overflow, keyboard and touch parity. (W11)

### Decks/starters

- [ ] REQ-061 Persistent library/deck/starter/recent sidebar. (W05, W06)
- [ ] REQ-062 Two-pane deck builder. (W05, W06)
- [ ] REQ-063 Inline minus/quantity/plus controls. (W05, W06)
- [ ] REQ-064 Arbitrary supported custom cards in starters. (W05, W06)
- [ ] REQ-065 Separate library membership, class eligibility and starter membership. (W05, W06)
- [ ] REQ-066 Counts, cost curves and tradition distribution. (W05, W06)
- [ ] REQ-067 Missing-definition/restriction/effect/total validation. (W05, W06)
- [ ] REQ-068 Named balance variants. (W05, W06, W16)
- [ ] REQ-069 Compare and restore snapshots. (W05, W06, W09, W16)
- [ ] REQ-070 Replace a card while retaining quantity. (W05, W06)
- [ ] REQ-071 Find usages before shared definition edits. (W05, W06, W17)
- [ ] REQ-072 Recent destination shortcuts. (W05, W06, W10)

### Generation

- [ ] REQ-073 One generation entry with Simple/Distribution modes. (W13)
- [ ] REQ-074 Existing/new destination deck. (W05, W06, W13)
- [ ] REQ-075 Count/school/camp/rank/rarity/cost/allowed-effect controls. (W13)
- [ ] REQ-076 Complete named generation recipes. (W12, W13)
- [ ] REQ-077 Section presets. (W12)
- [ ] REQ-078 Deterministic seed and reproduction receipt. (W13, W16)
- [ ] REQ-079 Preview before accept. (W13)
- [ ] REQ-080 Expose constraint misses. (W13)
- [ ] REQ-081 Retry failures only. (W13)
- [ ] REQ-082 Automatically select/filter the accepted new batch. (W05, W13)
- [ ] REQ-083 Compare variants with their recipes. (W16)
- [ ] REQ-084 Effective total replaces a confusing overridden total. (W13)

### Rebalance

- [ ] REQ-085 Explicit current/selected/filtered/deck/pool rebalance scopes. (W14)
- [ ] REQ-086 Context-appropriate scope without silent expansion. (W14)
- [ ] REQ-087 Lock preserved properties. (W14)
- [ ] REQ-088 Remember constraints, preferences and distributions. (W12, W14)
- [ ] REQ-089 Named rebalance recipes/defaults. (W12, W14)
- [ ] REQ-090 Before/after comparison. (W14, W16)
- [ ] REQ-091 Constraint explanations and targeted retry. (W14)
- [ ] REQ-092 Apply successful selection atomically and reversibly. (W09, W14)
- [ ] REQ-093 Preview separate from Apply. (W14)
- [ ] REQ-094 Recipe export separate from resulting-card export. (W02, W09, W12, W14)

### Naming

- [ ] REQ-095 Naming rules reachable from rename and generation. (W15)
- [ ] REQ-096 Rename once versus keep Auto-name. (W15)
- [ ] REQ-097 Maximum length and rule priority. (W15)
- [ ] REQ-098 Live examples including dropped name parts. (W15)
- [ ] REQ-099 Naming-only presets and JSON. (W12, W15)
- [ ] REQ-100 Collision/duplicate/truncation preview. (W15)
- [ ] REQ-101 Preserve manual names unless explicitly included. (W15)
- [ ] REQ-102 Save/restore prior names. (W09, W15)

### Features/weights

- [ ] REQ-103 Searchable supported-feature catalogue. (W17)
- [ ] REQ-104 Feature-definition templates. (W17)
- [ ] REQ-105 Stable IDs with editable display labels. (W17)
- [ ] REQ-106 Archive obsolete features from active lists. (W17)
- [ ] REQ-107 Restore archived features. (W17)
- [ ] REQ-108 Find affected references. (W17, W20)
- [ ] REQ-109 Separate identity, scoring and runtime binding. (W17, W18, W19)
- [ ] REQ-110 Flat/additive/per-unit/multiplier/supported-condition templates. (W18)
- [ ] REQ-111 Units/ranges/caps/stacking/evaluation order. (W18, W19)
- [ ] REQ-112 Eligibility/restrictions/exclusions. (W18, W19)
- [ ] REQ-113 Validated selectors for existing engine effects. (W19)
- [ ] REQ-114 Explicit Engine support required for new behavior. (W01, W02, W19)
- [ ] REQ-115 Scoring and actual behavior preview. (W19, W22)
- [ ] REQ-116 Versioned JSON definition/rule/restriction transfer. (W20)
- [ ] REQ-117 Conflict and migration preview. (W20)
- [ ] REQ-118 Bulk restrictions/archive/restore. (W17, W20)

### Defaults/memory

- [ ] REQ-119 Last used versus project default versus named preset versus factory default. (W12)
- [ ] REQ-120 Independent generation/rebalance/naming and card/item state. (W12)
- [ ] REQ-121 Section presets. (W12)
- [ ] REQ-122 Save as/Load/Set default/Reset default. (W12)
- [ ] REQ-123 Consistent Cancel semantics. (W09, W12, W23)
- [ ] REQ-124 Close/reload persistence. (W03, W05, W12)
- [ ] REQ-125 Dirty-preset indicator and active-preset name. (W12)
- [ ] REQ-126 Draft/Applied/Saved/Loaded-in-game states. (W01, W02, W07, W09)
- [ ] REQ-127 Exact Save/Import/Export scope and destination. (W01, W02, W09, W20)

### Local testing

- [ ] REQ-128 Actual local-game content/starter installation. (W01, W02, W06, W07)
- [ ] REQ-129 Start normal run. (W07, W08)
- [ ] REQ-130 Start scenario with class/deck/enemies/resources/seed. (W08, W21)
- [ ] REQ-131 Loaded build/content revision and effective settings. (W01, W02, W07, W22)
- [ ] REQ-132 New card appears and is playable. (W06, W07, W21)
- [ ] REQ-133 Restart the same scenario. (W08, W21, W22)
- [ ] REQ-134 Isolated test unlock/save profile. (W07, W08)
- [ ] REQ-135 Same-scenario baseline/candidate comparison. (W16, W22)
- [ ] REQ-136 Saved scenarios and regression packs. (W21, W23)

### Layout/accessibility

- [ ] REQ-137 Compact preview beside common fields. (W04, W24)
- [ ] REQ-138 Related identity/cost/effect controls together. (W04, W19, W24)
- [ ] REQ-139 Sticky primary actions. (W03, W05, W12)
- [ ] REQ-140 Collapsible advanced groups with summaries. (W03, W05, W12)
- [ ] REQ-141 Persist panel layout and expansion. (W03, W05, W12)
- [ ] REQ-142 Remove redundant headings/subtitles/instructions. (W03, W05, W12)
- [ ] REQ-143 Concise contextual help. (W03, W11)
- [ ] REQ-144 Scope/consequence tooltips alongside visible critical information. (W11)
- [ ] REQ-145 Accessible icon names. (W03, W05, W12)
- [ ] REQ-146 Hover and keyboard-focus shortcuts. (W03, W11)
- [ ] REQ-147 No essential hover-only actions. (W03, W11)
- [ ] REQ-148 Shallow menus and fewer modal hops. (W03, W05, W11, W12)
- [ ] REQ-149 Compact table plus gallery. (W03, W05, W12)
- [ ] REQ-150 Command search. (W03)

### Recovery/integrity

- [ ] REQ-151 Complete Undo/Redo across edit/generation/delete/import/deck operations. (W09)
- [ ] REQ-152 Recoverable Trash. (W09, W10)
- [ ] REQ-153 Atomic changes. (W09, W11, W23)
- [ ] REQ-154 Lossless full-bundle round trip. (W02, W09, W20)
- [ ] REQ-155 Duplicate IDs/references/bindings/schema validation. (W01, W02, W09, W19, W20)
- [ ] REQ-156 Preserve unrelated fields. (W02, W09, W11)
- [ ] REQ-157 Interruption recovery. (W02, W09, W23)
- [ ] REQ-158 Import diff/conflict review. (W01, W02, W09, W20)
- [ ] REQ-159 Separate authored sources from generated outputs. (W01, W02, W09, W24, W25, W29)
- [ ] REQ-160 Named revisions and change summaries. (W02, W09)

### Broader authoring

- [ ] REQ-161 Class availability/resources/supported settings. (W01, W02, W07, W08, W32)
- [ ] REQ-162 Rewards/loot/drop distributions. (W30)
- [ ] REQ-163 Enemy stats/abilities. (W21, W31)
- [ ] REQ-164 Encounters and difficulty. (W21, W31, W32)
- [ ] REQ-165 Progression/unlocks/scaling. (W32)
- [ ] REQ-166 Economy/prices/rewards. (W30)
- [ ] REQ-167 Supported map/run-generation settings. (W01, W02, W33)
- [ ] REQ-168 Labels/descriptions/tooltips/presentation. (W15, W24, W25, W28)
- [ ] REQ-169 Same validation/test workflow per subsystem. (W01, W02, W23, W24, W25, W29)
- [ ] REQ-170 New-run versus existing-run application timing. (W01, W02, W07, W08, W32)

### Acceptance

- [ ] REQ-171 Measure actual step/click/menu/panel counts separately from targets. (W03, W05, W09, W12, W23)
- [ ] REQ-172 Measure scroll travel and context dislocation. (W03, W05, W09, W12, W23)
- [ ] REQ-173 Test reopen, reload and restart separately. (W09, W12, W22, W23)
- [ ] REQ-174 Stable selection through sort/edit/drag. (W03, W05, W10, W12)
- [ ] REQ-175 Exact affected IDs and scope. (W05, W11, W14)
- [ ] REQ-176 Complete Undo restores relationships. (W09, W10)
- [ ] REQ-177 Keyboard/narrow/wide checks. (W03, W05, W12, W28)
- [ ] REQ-178 Large pools and long operations. (W09, W13, W23)
- [ ] REQ-179 Cross-tool name/rank-band/calculation consistency. (W01, W02, W13, W16, W18, W22)
- [ ] REQ-180 Actual local-game consumption verified. (W01, W02, W07, W08, W21, W22)
