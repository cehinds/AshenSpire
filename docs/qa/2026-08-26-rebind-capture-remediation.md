# QA remediation item #5 — Escape rebind cancellation

## Routing and scope

Constantine assigned the numbered remediation queue to App Team 1 through
AshenSpire — Main, overriding ordinary Help Desk intake for implementation.
Help Desk remains the intake/status ledger; Main remains the mandatory relay,
technical triage, and sequencing authority. This candidate changes item #5
only. Item #6 conflict policy and all later items remain blocked.

The maker lane is `C:\repos\AshenSpire-qa-05-rebind-capture` on
`codex/qa-05-rebind-capture`, created from exact refreshed
`origin/dev@0187efd30320a0745241d480b8d7055b292086c3`. No stale mixed candidate
was used or cherry-picked.

## Broken player contract

While a keyboard rebind showed **Press…**, Escape was treated as the captured
key. The global input listener called `stopPropagation()`, but the Controls
overlay Escape listener was a later capture listener on the same `window`;
that propagation method did not stop it. One physical Escape therefore rebound
the selected action to Escape and closed Controls.

## Repair

- `rebind-capture-service` stores commit and cancel outcomes for the armed key.
- Lone Shift, Control, Alt, and Meta remain ignored while capture stays armed.
- Armed Escape prevents the default, stops later same-target listeners, clears
  capture, invokes only cancellation, and performs no binding mutation.
- Cancellation restores **Press…** to **Key**, removes the listening state, and
  returns DOM focus to the same `controls-key-rebind-control` while Controls
  remains open.
- Re-arming accepts a free key normally. With no capture armed, Escape closes
  one overlay layer and leaves the map intact.
- Occupied-binding conflict resolution is deliberately unchanged and remains
  item #6.

The player can now back out of an accidental rebind with Escape, see that the
capture ended, and immediately try another key without losing the Controls
screen.

## RED-first and behavior evidence

`node tools/rebind-capture.mjs` was added before the runtime repair. Against
the exact base it failed at the real rendered door: Escape changed End Turn
from E, closed Controls, and reached a later capture listener on `window`.

The repaired focused door drives 1200×730 and 390×844 from Map through the real
Quick Menu into Controls. It checks stable component identity, horizontal fit,
modifier-only behavior, zero-mutation Escape cancellation, Press… reset, focus
return, same-target event suppression, free-key re-arm, later unarmed Escape,
and unexpected console/network events. `--selftest` plants four source failures:
Escape accepted as a binding, same-target propagation leakage, missing UI/focus
reset, and modifier acceptance. Each must fail by its named assertion before a
clean copied tree passes.

## Catalog coverage

- `controls-rebind-capture`
- `controls-key-rebind-control`
- service identifier `rebind-capture-service`

The stable component IDs are present in `UiComponentId.js`, SPEC, Markdown
catalog, and interactive HTML catalog.

## Candidate and verification

- Base: `origin/dev@0187efd30320a0745241d480b8d7055b292086c3`.
- Branch: `codex/qa-05-rebind-capture`; exact local candidate head is reported
  after the final commit because a commit cannot contain its own SHA.
- Shipped build: `0.4.0.1378`; source digest `f3aedc1ad1`; artifact SHA-256
  `707429737b25240c5da719e6b802b157f2cd06ee619930f88028e3ff3b316416`;
  root/build/dist aliases are byte-identical at 4,153,748 bytes.
- Focused rendered source and shipped doors: `18/18` each. Both report zero
  unexpected console/network events and zero horizontal overflow at 1200×730
  and 390×844. The counted expected headless baseline was autoplay/favicon
  console/network `9/2` wide and `8/1` mobile.
- Focused same-door corpus: `4/4` planted regressions caught by their named RED,
  followed by a clean copied-tree run.
- Item #4 confirmation regression: `63/63` source and `63/63` shipped across
  Map/Combat and all three confirmation viewports.
- Full Node suite: `112 passed, 0 failed`; test labels: `110/110` unique.
- Component contract: `21/21`; component known-bads: `21/21` red.
- Link contract: `364/364`; link known-bads: `5/5` red. Content projection is
  current; About/Changelog: `42` receipts.
- Shipped artifact: `6/6`; shipped known-bad corpus: `25/25`; build-version
  provenance: `8/8`; build-version corpus: `21/21`; bundler corpus:
  `0 failing cases`.
- One serialized `launch.mjs --build-only` regeneration was performed after
  source authority froze. `git diff --check` is clean.

## Screenshots

- `docs/preview/qa-rebind-escape-cancel-wide-1200x730.png`
- `docs/preview/qa-rebind-escape-cancel-mobile-390x844.png`

Screenshots prove rendered state only; the focused browser door supplies the
interaction evidence.

Exact screenshot SHA-256 values, in the order listed above, are:

```text
f32d7bf216036cea54f1af2d3f9b1968033b78baf3f72fbc56ac5cd5bbfe1284
cace7a72735ee0545f759e18f742b3965a5579058c7983b056384aec521cea29
```

## Remaining boundary

Headless Chromium covers real keyboard events, mouse entry into Controls, focus
state, and responsive rendering at desktop and phone viewports. Physical touch,
real gamepad hardware, mobile Safari safe-area behavior, and assistive-
technology speech remain independent QA boundaries. Controller rebind capture
is unchanged; occupied-binding conflict resolution remains item #6.
