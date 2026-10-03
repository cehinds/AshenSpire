# Book library validation — local build 0.7.1.816

Validated locally on 2026-10-02 (Alaska time). Build digest: `558e3014df`.
The build stamp uses UTC date 2026-10-03. No publication or CI run is claimed.

## Browser evidence

`tools/book-library-built-browser.mjs` passed against the actual packed build
at `/build/AshenSpire.html?shot=shop&shotLibrary=1`: ten book offers, known-class
purchase refusal, Inventory reading, cross-class spell selection, single book
consumption, class learning without auto-equipping, equip and empty class slot.
No JavaScript or checked art/HTTP errors were observed. Optional sound asset
probes are excluded from this browser script's HTTP assertion.

`tools/book-learning-browser.mjs` passed against the disposable source preview:
cancel preserves the book, confirm grants exact XP plus one card, learned class
progress survives switching and removal, and Universal Tome supports keyboard
selection and choosing the XP track. The dialog fits 320px and 390px viewports.
This is desktop Edge emulation, not a physical-phone test. Source preview QA
serves the raw authoring version module without the server's digest injection;
the separate packed-build test uses the generated build unchanged.

Evidence: `qa/learning-built-results.json`, `qa/learning-browser-results.json`,
`qa/learning-built-spellbook.png`, `qa/learning-built-classless.png`,
`qa/learning-universal-320.png`, and `qa/learning-universal-390.png`.
Screenshots finish finite animations before capture.

## Automated checks

- Book learning tests: 9/9 passed, covering scopes, stale reads, single grants,
  class ownership, saved progress and empty-slot combat behavior.
- Final focused regression group: 47/47 passed.
- Additional relevant regression groups: 115/115 and 94/94 passed.
- Content/config derivation checks and `git diff --check` passed.
- Component catalog: 22/22 passed. Credits check: 51/51 passed after correcting
  the missing shop attribution table row.
- Final launch build completed and refreshed all four current-build aliases.

The broad runner (`node tests/run-node.mjs --no-selftests`) reported 2126/2127
discovered tests passing. Its one discovered-test failure is the PR receipt
gate: this local build has no matching published PR/changelog receipt. The
runner also reported the credits gate failure mentioned above; that was fixed
and its check rerun successfully. The broad runner has not been rerun after
those final focused fixes. Selftest-only checks and CI were not run. Historical
PR receipts were not changed to manufacture a passing publication gate.

## Scope notes

Class-card Inventory actions preserve progress. The legacy mirror event keeps
its prior reset behavior. Prices and XP retain the inherited configurable
defaults and have not undergone a new balance pass. See `BOOK-LIBRARY.md` for
the classless compatibility contract and content-authoring fields.
