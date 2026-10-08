# Combat card sigils

- Card bottoms show one large primary action sigil and a smaller school sigil where applicable.
- Damage types remain written words, including Blunt, Piercing, Slashing, Cold, Fire, Lightning, Force, Holy and Necrotic.
- Extra source, range, counter-mode, technique and theme tags stay in Information.
- All marks use monochrome geometry. Colour is optional emphasis, never the only distinction.
- Information repeats the mark, its name and its explanation. Cards retain accessible names, existing selection controls and focus restoration.
- Effect text retains its numbers, conditions, targets and durations. Redundant damage verbs and layout whitespace are shortened. Long effects borrow room from the artwork instead of being cut off.

## Primary action legend

- Attack: a diagonal blade pointing forward.
- Defend: a shield outline.
- Counter: a returning circular arrow crossed by a blade.
- Sweep: a broad arc with a horizontal arrow.
- Ranged: a bow and arrow.
- Smash: a hammer with impact marks.
- Spell: a four-point arcane star.
- Power: a crown; cast once and keep its buff for the combat. Expanded Powers Exhaust after casting.
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
- Expanded Powers show their Exhaust rule in Information. Historical saves retain their original removal rule; the common crown explanation describes cast-once behavior without changing that lifecycle.
- These are original inline vector marks in source; the existing paintings and artwork packages remain in use.
- The editor inventory was checked at `e116cfd1414bce9effb2e12ed643a481342ee934`. Its card adapter handles data definitions; native layout and runtime renderer changes are separate. The shared vector renderer uses normal source tools.
- Build identities, review, test results, desktop/phone captures and branch promotions are recorded with delivery evidence.

## Browser evidence

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
