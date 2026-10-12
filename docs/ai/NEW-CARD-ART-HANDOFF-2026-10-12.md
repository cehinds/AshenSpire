# New card art delivery handoff — 2026-10-12

## Delivery state

- Game branch: `Feature/NewCardArt`; implementation/review head before this handoff: `e3b885def5e654c272e541dc3dc188b3af89bc38`.
- Game PR: https://github.com/cehinds/AshenSpire/pull/1909 — open, not yet merged. CI was queued/running when this note was written.
- Art PR: https://github.com/cehinds/AshenSpire-art/pull/22 — merged at `06170d86c6ba6baa24cd60dd516edf21180450f7`; published `hd-assets-v20` is pinned here.
- Latest integrated dev: `660ee59f4`; its build box and this PR receipt are `0.7.1.1429`.
- All worker implementation is integrated and pushed to the named feature branch. No game dev/test/release/main merge has happened for PR1909.

## Implemented

The approved60-image physical/magical library is the default for supported existing cards. Sweep uses option14. All legacy assets remain, with a saved Simple/Legacy preference and safe image fallback. No playable cards or mechanics were added.

Nine tag-driven magical themes (force, fire, lightning, earth, frost, psychic, alteration/alternation, divine and necrotic) compose quiet backgrounds and decorative status layers. All30 magical bases support every theme, giving270 combinations.

Card rails show category first, then relevant damage/effect type, then up to3status effects, with at most5icons. Magic uses the approved outlined four-point diamond; Physical a shield; Slashing crossed swords; Blunt a hammer; Dodge/Evasion a boot; Frost a snowflake; Fire a flame; Earth a stone; Piercing a pointed blade. Numeric badges show unambiguous known stacks, never sums across targets or conditional effects and never buildup pressure. Layout overrides match the shared icons. Support cards omit inherited damage metadata; school/element aliases do not duplicate icons.

## Verification

- Independent reviewer `art_runtime_review` passed exact head `e3b885def5e654c272e541dc3dc188b3af89bc38`, no remaining findings.
- Full local standalone build `0.7.1.1433` at runtime-source head `f515caf546263ed411a5c8d05875d43699bfc01d` passed; later commits are evidence/docs, strict test expectations and current-dev merges, without artwork/runtime changes.
- Build-version checks9/9; shipped-file checks12/12. Actual built desktop/phone hand, Settings Simple/Legacy persistence and deck checks passed:5hand images and38/19deck thumbnails loaded,0page errors,0horizontal overflow.
- Screenshot record: [desktop, phone and deck evidence](../preview/new-card-art-20261012/README.md). Raw JSON/logs remain task-local under outputs/, not tracked.
- Source preview covers54maneuver/element examples; tests cover270combinations, registry precedence, safe status quantities, layout overrides and icon mappings.
- CI first found an old glyph expectation in `tests/tree-equivalence.test.mjs`. Commit34a2b3b0b records exactly the3approved glyph changes while preserving strict identity checks; tree/sigil tests21/21 passed, independent tree check8/8. Latest CI must still complete.
- Known Windows-only baseline check limits: CRLF-sensitive workflow/HUD equality assertions; Linux CI remains the gate. Do not weaken tests to hide these.

## Continuation

The user requested a feature-branch handoff, then explicitly selected: **Resume dev/test merge after the handoff** in this chat. Continue under that current user direction; no game release/main authority was granted.

1. Verify live PR1909 head and all fast CI checks; investigate/fix any failures. Keep current with dev and regenerate derived changelog through its tool when needed. Do not commit locally generated buildordinal or built HTML.
2. Obtain exact-head independent review for any new implementation; the handoff itself changes documentation only.
3. Merge PR1909 into dev with a merge commit once ready.
4. Wait for dev architecture-sync, build-stamp and stamped-tip dev-preview success. Verify the actual current dev tip before promotion.
5. Open/reuse dev→test PR, merge with a merge commit, and watch required heavy/alternative checks. Fix regressions through dev. Do not advance game release/main.
6. Report actual remote merge SHAs, test/build state and remaining limits concisely.

## Workspace preservation

The active isolated clone is task-relative `work/AshenSpire-NewCardArt-runtime`. Worker checkouts are `work/AshenSpire-NewCardArt-worker-composition`, `work/AshenSpire-NewCardArt-worker-runtime` and `work/AshenSpire-NewCardArt-art-pin`. The last contains the verified high/light/common v20cache; the parent has a junction to it.

Preserve the older dirty `work/AshenSpire-NewCardArt` checkout, all staged/untracked files, worker local build outputs and art archives. Do not reset or clean them. Source preview runs on localhost4186. Task-local browser evidence lives under `outputs/runtime-card-art-built` and `outputs/runtime-card-art-diamond`.

See [composition details](../card-art-composition.md), [sigil/rail rules](../combat-card-sigils.md), and the [component catalog](../component-catalog.html).
