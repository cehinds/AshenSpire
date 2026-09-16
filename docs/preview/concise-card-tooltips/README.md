# Concise card inspection and tooltip QA

Preview: [playable situation switcher](../../../tooltip-review.html). Screenshots: [review gallery](index.html).

Built and verified on 2026-09-09 from `codex/concise-card-tooltips`, based on dev `769dc18f`. Standalone version: **0.6.0.64**, source digest `4cfc5148ad`.

## Player-visible changes

- Inspections retain full effect text, equipment values, current potion charges, and actual attribute requirements. Supporting classifications become tags beneath the card.
- Removed the expanded list of artwork explanations, generic usage instructions, flavor explanations, and repeated effect paragraphs. The existing illustrated card face remains visible.
- Status, stance, framework and card keywords disclose definitions, using the active content bundle's resolved numbers. General classification words are not automatically treated as mechanical keywords in prose.
- Every ordinary hover, tooltip handover and nested term waits 500 ms. Leaving before opening cancels it. Owner and panel share a hover region; leaving both closes after 500 ms, with re-entry cancelling dismissal. Hovered tooltips do not expire.
- Touch never synthesizes a hover popup. Explicit tags, keywords, Information controls, status taps and keyboard inspection remain available. Co-op status pips now also provide explicit touch and keyboard definitions.
- Enemy and player hover use the shared clock. Changing a scene removes its tooltip and cancels pending openings. New tooltips cannot be cancelled by an old tooltip's simultaneous close timer. Tooltip placement clears a card's Information button.

## Verification

**687 browser checks passed; zero failures or page errors** in the full run. [Machine-readable results and source inventory](qa-results.json). After that run, final screenshot review removed the duplicate current-intent summary and empty active-effects section from enemy inspection. Focused desktop, phone and final standalone checks verified that cleanup, the complete move set, and zero page errors.

| Coverage | Result |
| --- | --- |
| 41 equipment items, 7 potions, 55 relics | All inspection definitions rendered; effect and tag contracts checked |
| 363 base/upgraded playing-card variants | All inspection effects rendered; expanded glossary paragraphs absent |
| 50 statuses, 2 stances, 5 keywords | All definitions resolve their authored numeric tokens |
| 13 situations at 1440×1000 and 390×844 | Combat, co-op, potion reward, reward menu, merchant, Armoury, smithing, creation, map, compendium, content catalog, timing lab, combat test setup |
| 195 visible tooltip-bearing targets across desktop situations | 184 explanations tested for delayed opening and delayed closing; 11 suppressed/inert labels recorded by name in the JSON |
| Shared state machine | Exact 499/500 ms thresholds, handover, early exit, nested cancellation, owner/panel traversal, persistence beyond 10 seconds, re-entry, keyboard focus, Escape, touch pointer suppression, anchor removal and modal replacement |
| Gameplay | Information does not play/collect; deliberate Play card plus target confirmation damages the enemy; End Turn confirmation advances combat on desktop and phone |
| Standalone artifact | Regenerated game boots and opens playing-card inspection, zero page errors |
| Additional narrow check | 320×650, touch and reduced motion: potion and keyword tooltip contained, no horizontal overflow or page errors |
| Additional input check | Adopting a native title preserves the underlying button's click action |
| Repository suite | 138 passed, 0 failed; card removal/flick regression group: 25 checks passed |
| Build/version/shipped files/receipts/About | Passed; all three current standalone aliases rebuilt identically |
| Whitespace | `git diff --check` passed |

The 11 silent probes are the two inactive second hand slots and nine nested labels on withheld Compendium entries. They do not create competing tooltips; the parent/available surface owns the explanation. The inventory retains these cases rather than counting them as successful tooltip openings.

The source inventory names all 26 UI files referencing the tooltip APIs, including the service itself and the review fixture. Shared rendering covers keyword explanations in the other callers without copying a second tooltip system.

## Existing checker limitation

`node tools/ui-components.mjs --selftest` fails its clean-tree C8 check on four old string patterns for battlefield scaling. Those checks expect older forms of `availableHeight * centerHeightRatio`, `measureFrame(...)`, `measures.reduce(...)`, and `applyFrame(...)`.

Neither the checker nor the battlefield component was changed by this task. The battlefield file's working-tree hash and `origin/dev` blob are both `759ce1f47413e2f3088283e5aaf8be2fa8d10b95`. The tooltip changes are not the cause of that failure. The final build and browser assertions exercise the current battlefield successfully.

## Scope limits

This is an exhaustive content-definition pass and a rendered component/interaction sweep, not every possible random encounter, save state, hidden settings combination, or browser implementation. Co-op uses the repository's snapshot-driven UI fixture; no live network session was tested. Desktop and phone checks use Edge, with emulated touch; no physical phone was used. Hold-to-confirm comparisons and explicit action/refusal feedback remain deliberate actions rather than hover effects.

## Re-run

Start `node tools/serve.mjs --port 8317 --no-open --no-lan`, then run `node tools/tooltip-review-qa.mjs`.

The runner uses an installed Playwright package. If it is outside the project, set `PLAYWRIGHT_MODULE` to its CommonJS entry; optionally set `QA_BROWSER` to the browser executable, `QA_URL` to the serving origin, and `QA_OUTPUT` to an evidence directory. The default output is the operating system's temporary directory. Screenshots in this folder are selected final-run evidence.

Also run:

```sh
node tests/run-node.mjs
node tools/launch.mjs --build-only
node tools/buildversion.mjs --check
node tools/verify-shipped.mjs
node tools/receipts.mjs --check
node tools/about-changelog.mjs --check
git diff --check
```

The [component catalog](../../COMPONENT-CATALOG.md) and its [visual miniature](../../component-catalog.html) describe the updated shared tooltip contract.
