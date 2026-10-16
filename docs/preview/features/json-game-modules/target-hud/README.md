# Reviewed desktop target HUD

The approved target HUD is implemented on the Feature branches. Enemy feet and shadows sit inside their cells, with fresh enemy order back-right, back-left, back-middle, front-right, front-middle, front-left. Saved/moved positions remain authoritative. Desktop and widescreen show delayed target details with HP, Poise, perceived intent and shared status tooltips. Selecting a card previews all eligible targets. Turn status sits in the header; Cinders sits beside the shield. Both existing fades remain.

| View | Actual standalone capture |
| --- | --- |
| Selected enemy | [Desktop](core-two-selected-1440.png) |
| Six eligible enemies | [Desktop](core-six-candidates-1440.png) |
| Self-target card | [Desktop](core-self-1440.png) |
| Three large enemies | [Desktop](desktop-boss-three.png) |
| Current game | [Desktop](current-1440.png) |
| Phone legacy HUD | [Phone](core-390.png) |

Captured 2026-10-16 from locally built standalone source `2610e12ef`, runtime `89d5f4d4cb`, version `0.7.1.1534`. HTML SHA-256: `5d019bf6e747ef2efc26e4b1c5263d8053e704a11ba88443c046707ba26aa50b`. Chromium drove actual game controls using the existing in-memory combat screenshot fixtures. The same runtime loaded Core and Current through the profile parameter; no screenshot DOM or combat-state edits were used. These captures verify the local standalone, not the live Pages publication.

The 123 serialized profile/save, damage projection, mitigation, header and target-model checks passed. Four focused model/overhead checks passed after the last focus styling change. Final browser smoke passed nine desktop/wide/tablet/phone cases with zero page errors or horizontal overflow: selected enemies, six eligible panels, self targeting, Current gameplay, retained narrow-screen HUDs, restored phone enemy size, stable actor positions, and panel-background clicks that cannot play an armed card. Earlier actual browser checks verified the single 500ms enter/switch/exit dwell and immediate card execution (87ms receipt). [Machine-readable summary](final-report.json).

New Core and Current profiles use JSON-authored 25% mitigation when the defending stance wins. Damage previews use the production calculation. Counter still responds to connected positive hits even when mitigation rounds their damage to zero. Existing saved resolved profiles without this setting retain their previous combat rules. See the [configuration guide](../../../../ai/json-game-modules/COMBAT-TARGET-HUD.md).

Coverage limits: green damage was verified by production-engine/projection tests, not naturally demonstrated in these browser captures. Normal new-game progression and nondefault player lanes were not exercised in this final smoke. Dense Current encounters with status rows can use fallback panel positions that overlap lower artwork; panels remain visible above the cards and footer. Core's six-panel layouts were additionally checked for sprite/card clearance at 1366, 1440 and 1920 widths.

These changes have not been promoted to dev.
