# Combat card sigils

- Card bottoms show the primary action sigil and its name, including Power, Skill and Status.
- Version-2 effects keep damage types in words beside the damage amount: **5 Fire damage**, **3 Piercing damage**, or **4 Blunt damage**. Mixed contacts keep their actual types; Counter HP returns stay distinct from Poise and Ward impact.
  - Lightning spells use Piercing; Force spells use Blunt. The school never substitutes for the actual damage type.
  - Complex effects keep their full authored text with a short damage-type prefix. Historical version-1 face text stays unchanged.
- School sigils and extra source, range, counter-mode, technique and theme tags stay in Information.
- All marks use monochrome geometry. Colour is optional emphasis, never the only distinction.
- Information repeats the mark, its name and its explanation. Cards retain accessible names, existing selection controls and focus restoration.
- Effect text retains its numbers, conditions, targets and durations. Redundant damage verbs and layout whitespace are shortened. Long effects borrow room from the artwork instead of being cut off.

## Primary action legend

- Attack: crossed blades.
- Defend: a shield outline.
- Counter: a shield with a returning arrow.
- Sweep: a broad arc with a horizontal arrow.
- Ranged: a bow and arrow.
- Smash: a hammer with impact marks.
- Spell: a wand with an arcane orb.
- Power: an upward buff arrow with sparks; cast once and keep its buff for the combat. Expanded Powers Exhaust after casting.
- Skill: an open hand; reusable utility or buffs. Information includes any authored lifecycle exception.
- Status: a warning triangle; injected status-effect cards, usually harmful.

## School legend

- Frost: a snowflake.
- Fire: a flame.
- Lightning: a lightning bolt.
- Force: a small ring sending waves outward.
- Alteration: mountains on a grounded baseline, including earth and grounding.
- Illusion: an eye crossed by a diagonal stroke.
- Divine: a radiant ring crossed by a plus.
- Decay: a damaged leaf with falling fragments.

## Implementation boundary

- Identity follows the shared primary type supplied by the combat expansion and authored school metadata. A name, class colour or damage type never selects a school.
- Expanded Powers show their Exhaust rule in Information. Historical saves retain their original removal rule; the common Power explanation describes cast-once behavior without changing that lifecycle.
- These are original inline vector marks in source; the existing paintings and artwork packages remain in use.
- The editor inventory was checked at `e116cfd1414bce9effb2e12ed643a481342ee934`. Its card adapter handles data definitions; native layout and runtime renderer changes are separate. The shared vector renderer uses normal source tools.
- Build identities, review, test results, desktop/phone captures and branch promotions are recorded with delivery evidence.

## Historical browser evidence

- Source at `77a847ae6b`: 2,186 native faces on each viewport, covering base cards, upgrades, all authored ranks and equipment profiles in both authored and live expanded combat forms.
- Desktop 1440×1000 and phone 390×844 with touch emulation: no clipped effects, title overlaps, damage footer overflow, added sigil tab stops, or runtime errors. All ten actions and eight schools are covered. Minimum catalog rule text is 12.22px desktop and 11.18px phone.
- Tapping the action mark selects the card through the existing hand hit lane. Information spends no resources or card plays; Escape closes it and restores focus.
- All 2,186 faces also pass at 120, 124, 144 and 200px widths, with original geometry restored after resizing. The smallest 120px fixture uses 8.85px rule text; Information provides the enlarged card and full rules.
- Standalone build `0.7.1.1118` passes desktop and phone hand geometry, artwork loading, accessible names, sigil-position selection, Information and Escape/focus checks: [desktop combat](qa/combat-card-sigils/standalone/desktop-combat.png), [phone Information](qa/combat-card-sigils/standalone/phone-inspection.png), [report](qa/combat-card-sigils/standalone/report.json).
- Required code and artwork load. Optional SFX `.ogg` probes return 404 and use the existing synthesized audio fallback. Physical-device and subjective owner acceptance are separate.
- [Desktop combat](qa/combat-card-sigils/source/desktop-combat.png), [phone Information](qa/combat-card-sigils/source/phone-inspection.png), [desktop legend in cards](qa/combat-card-sigils/source/desktop-sigil-gallery.png), [phone legend in cards](qa/combat-card-sigils/source/phone-sigil-gallery.png), [report](qa/combat-card-sigils/source/report.json).

## Review and verification

- Independent reviewer `sigil_review` approved source through `77a847ae6b` for PR #1729. Findings were verified and corrected: historical Power lifecycle help; narrow-card title clearance under UI zoom; full upgraded effects and family limits; readable conditions, targets, discard choices, nonlethal payments and charge timing; unequal live hit sequences; Concealed duration and canonical reveal rules.
- The focused identity, equipment, rank, presentation, solo/co-op hit-preview and status-reach checks cover the changed contracts. The complete hosted core suite and branch promotion checks are recorded on the PR.
- The reusable [component catalog](component-catalog.html) and its [model/renderer inventory](COMPONENT-CATALOG.md) include the sigil band and adaptive fitter.

## Alternative integration evidence

- Independent reviewer `sigil_review` approved PR #1731 runtime `cd4536f6b7`. The shared model, sigil renderer and fitter match the approved regular implementation. Both histories, receipts and credits are retained.
- Alternative art, stage hooks, class weapon animations, pacing and scenery are preserved. The canonical expanded/corrupted-card styles load before alternative overrides.
- Source evidence at `cd4536f6b7` covers 2,186 native faces per desktop and touch-phone viewport, all ten actions/eight schools, 120/124/144/200px widths and restoration after resizing. Geometry, loaded artwork, accessible names, sigil selection and Information/Escape/focus checks pass.
- [Alternative desktop combat](qa/combat-card-sigils/alternative/source/desktop-combat.png), [phone Information](qa/combat-card-sigils/alternative/source/phone-inspection.png), [desktop legend](qa/combat-card-sigils/alternative/source/desktop-sigil-gallery.png), [phone legend](qa/combat-card-sigils/alternative/source/phone-sigil-gallery.png), [source report](qa/combat-card-sigils/alternative/source/report.json).
- All 50 focused checks pass, including the alternative card animation and stage contracts. Standalone `0.7.1.1122` passes desktop and phone hand geometry, loaded artwork, accessible names, sigil-position selection, Information and Escape/focus checks: [desktop combat](qa/combat-card-sigils/alternative/standalone/desktop-combat.png), [phone Information](qa/combat-card-sigils/alternative/standalone/phone-inspection.png), [report](qa/combat-card-sigils/alternative/standalone/report.json). Build version and receipt ordering checks also pass; hosted promotion outcomes remain separate.
- PR #1732 fixes the heavy parse gate's legal doubled-semicolon import fixture. It changes bundler syntax acceptance without changing card behavior; the same reviewed patch is present on both branches.

## Combined delivery evidence

- After the merged #1728 targeting/input changes, source `5f9942e112` again passes all 2,186 native faces per desktop and touch-phone viewport, all action/school identities, narrow widths and resize restoration. The 38 focused checks also pass, including the merged targeting, co-op upcast and tutorial Escape contracts.
- Standalone `0.7.1.1124` passes desktop and phone hand geometry, artwork loading, accessible names, sigil-position selection, Information and Escape/focus restoration. All four current-build aliases, build identity and receipt ordering checks pass.
- [Combined source desktop](qa/combat-card-sigils/combined-source/desktop-combat.png), [phone Information](qa/combat-card-sigils/combined-source/phone-inspection.png), [source report](qa/combat-card-sigils/combined-source/report.json), [combined standalone desktop](qa/combat-card-sigils/combined-standalone/desktop-combat.png), [phone Information](qa/combat-card-sigils/combined-standalone/phone-inspection.png), [standalone report](qa/combat-card-sigils/combined-standalone/report.json).
- Independent review approved #1732 runtime `df48a4d796`: legal empty statements and adjacent side-effect/named imports are accepted, while invalid trailing text and strict-only syntax remain refused. Three real-bundler probes pass. The full hosted corpus and exact-head branch promotions are required separately.

## Combined alternative verification

- After #1728, alternative source `0c33312e4e` passes 2,186 native faces per desktop and touch-phone viewport, all ten actions/eight schools, narrow widths and resize restoration: [desktop](qa/combat-card-sigils/alternative/combined-source/desktop-combat.png), [phone Information](qa/combat-card-sigils/alternative/combined-source/phone-inspection.png), [report](qa/combat-card-sigils/alternative/combined-source/report.json).
- Independent reviewer `sigil_review` approved the final regular/alternative source reconciliation through `fb8a7d25c2`, preserving battlefield art, stage and animation hooks, both histories and receipts. The current focused suite passes all 39 checks, including legal targets, co-op upcast, tutorial Escape, alternative animation and stage contracts.
- Tutorial prose passes card input. Its active controls remain bound inside the veil and choose a separate clear position when compact layouts leave no room for the whole callout. Actual hand input, all four Next steps and Skip pass at 800×465, 1024×640, 1200×730, 1280×800, 1366×768, 1440×900 and touch-phone 390×844: [small desktop](qa/combat-card-sigils/alternative/tutorial/800x465-tutorial.png), [phone](qa/combat-card-sigils/alternative/tutorial/390x844-tutorial.png), [report](qa/combat-card-sigils/alternative/tutorial/report.json).
- With visible sprite target centers protected, actual enemy-target and self-Counter plays plus unarmed Escape pass at 800×465 and touch-phone 390×844: [target report](qa/combat-card-sigils/alternative/tutorial/target-report.json). Both updated off-screen/covered-control fault plants remain observable in the real browser: [fault report](qa/combat-card-sigils/alternative/tutorial/fault-report.json). Full hosted tutorial and self-test corpora remain required separately.

## Joined alternative checkpoint and price evidence

- After #1733 and #1736 source integration, alternative source `9183363e9a` passes all 2,186 native faces per desktop and touch-phone viewport, all ten actions/eight schools, narrow widths and resize restoration. Required code and art load; Information preserves resources, Escape closes it and focus returns. [Desktop](qa/combat-card-sigils/alternative/checkpoint-source/desktop-combat.png), [phone Information](qa/combat-card-sigils/alternative/checkpoint-source/phone-inspection.png), [report](qa/combat-card-sigils/alternative/checkpoint-source/report.json).
- All 44 focused checkpoint, snapshot, full-price, sigil, rule-text and co-op checks pass. Independent review approved joined runtime `b08172b3dc`, preserving alternative art, stage, animations and tutorial input controls. Final standalone and promoted-head hosted checks are required separately.

## Checkpoint and price integration evidence

- After #1733, regular source `16d6b84ff1` passes all 2,186 native faces on desktop and touch-phone, all ten actions/eight schools, narrow widths and resize restoration. Required code and art load; Information preserves resources, Escape closes it and focus returns. [Desktop](qa/combat-card-sigils/checkpoint-source/desktop-combat.png), [phone Information](qa/combat-card-sigils/checkpoint-source/phone-inspection.png), [report](qa/combat-card-sigils/checkpoint-source/report.json).
- All 33 focused checkpoint, snapshot, upcast-price and focus tests pass. PR #1736 separately checks legacy entry restart, default expanded entry restoration and an explicit Save Game checkpoint after a later unsaved turn, including exact serialized state and RNG seed/counters. Its hosted seven-mutant corpus and exact promoted-head checks are required separately.
- Standalone `0.7.1.1129` passes desktop and touch-phone native hand geometry, artwork, accessible names, sigil-position selection, Information, resource preservation and Escape/focus restoration. Captures wait for finite entrance animations to finish: [desktop](qa/combat-card-sigils/checkpoint-standalone/desktop-combat.png), [phone Information](qa/combat-card-sigils/checkpoint-standalone/phone-inspection.png), [report](qa/combat-card-sigils/checkpoint-standalone/report.json). All four launcher aliases, nine build-identity checks, twelve shipped-file checks and receipt ordering pass.
- At committed source `ac7b84f7ec`, all eleven stock slot-load scenario assertions pass through a local Playwright CDP transport adapter. Removing only the initial production checkpoint call produces the intended expanded-entry failure while the other ten assertions pass: [checkpoint report](qa/combat-card-sigils/checkpoint-standalone/save-checkpoint-report.json). An earlier cold-boot attempt measured no verdict; it is not counted as passing. The full hosted seven-mutant corpus remains required separately.

### Historical hosted standalone: build 1130

The final regular artifact is `0.7.1.1130`, source digest `bdef3226d1`. Hosted preview run [37795823879](https://github.com/cehinds/AshenSpire/actions/runs/37795823879) built PR head `0f9821dddc541fabe825309cea8013bb5d309306` at synthetic merge `104fe6e68d6e23eda3b351b7f76aa151d85b89cf`; the merge differs only in the newer architecture inventory. Hosted unchanged-build and shipped-identity checks pass. Independent review confirms the artifact carries the unique expected SOURCE, ORDINAL and BUILT stamps.

[Final standalone evidence](qa/combat-card-sigils/final-standalone/report.json) passes desktop 1440×1000 and touch-phone emulation 390×844: loaded art, complete hand effects and written damage words, accessible sigil names, real sigil selection, Information without payment, and Escape/focus restoration. Both images were inspected after the modal entrance animation settled. The server supplies the exact hosted HTML and the pinned checkout music/art sidecars. An initial artifact-only server lacked the music manifest and failed; the corrected complete rerun passed. Historical build-1129 evidence remains in its original folder. Final dev/test hosted heavy suites and synchronization are tracked separately.

### Final alternative hosted standalone: build 1140

The final alternative artifact is `0.7.1.1140`, source digest `46ddd2f6ec`. Hosted preview run [37813280468](https://github.com/cehinds/AshenSpire/actions/runs/37813280468) built reviewed PR head `0bb82d1d95e6b3a7601bf90d5fb44895c4956100` at synthetic merge `4fdb67929f7e950bfc2df4731e4f54ff2fe4cb77`. The launcher refreshed all four aliases; the unchanged-tree, build-identity and shipped-file gates pass. The canonical generated box and this PR receipt name the same build.

[Final alternative standalone evidence](qa/combat-card-sigils/alternative/final-standalone/report.json) passes desktop 1440×1000 and touch-phone emulation 390×844: loaded artwork, complete hand effects and written damage words, accessible sigil names, real sigil-position selection, Information without payment, and Escape/focus restoration. Both images were inspected after finite entrance animations settled. The server supplies the exact hosted HTML and pinned checkout sidecars; all native assertions remain unchanged. Earlier source and tutorial evidence remains in its original folders. Alternative dev/test promoted-head suites and both synchronization workflows are tracked separately.
