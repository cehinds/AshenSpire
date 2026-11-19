# Final Gear/stat/pool captures - exact CI210, source05

The six selected after PNGs come from the actual downloaded CI artifact for **05ce3864105e0e359baf0e31aaec5589db315ca3**, compiled **0.7.4.210**, source digest **81e1d00460**. Each viewport's actual Title stamp authenticated the compiled version and digest before opening allocation. No local rebuild was used. Earlier source9d/build210/digest4662f9f633 evidence remains in the external QA bundle's final210 directory, separate from this corrected artifact.

[Exact CI artifact](https://github.com/cehinds/AshenSpire/actions/runs/44505470908/artifacts/14518942631) (GitHub sign-in required). [Successful feature workflow](https://github.com/cehinds/AshenSpire/actions/runs/44505470908).

- Downloaded HTML SHA-256: **9d522835e631cde4603fd04df696b505cf832782cdb22030a83e24d31adebe61**.
- Core profile: sha256:1d99c1e246cc6e65b4356f96b7791cceb84e2abb21c359a2fa4710e048f960c0. Complete encoded generated catalog payload matches the artifact byte-for-byte.
- Compatibility runtime: sha256:045ee701108b82e397597cb08696c4400efd156c848b4cf2e4e18dae1db286c9.
- Capture start: 2026-11-19T10:33:38.279Z UTC / 2026-11-19 01:33:38 GMT−9 (America/Anchorage).

**Posed production-UI evidence, not an earned campaign playthrough.** Existing shot=rest&shotRestPoints=1&shotClass=reaver earns a point through the actual XP ledger. Actual Armoury > Character > Progression > allocation controls open the modal. Phone disclosures and point controls use real touch taps; no forced clicks, live-state injection or new product debug controls.

| Image | Viewport | Evidence |
| --- | --- | --- |
| desktop.png | 1280 x800 | Corrected compact allocation; background HP60 |
| phone.png | 390 x844 | Corrected compact allocation |
| wide.png | 1920 x1080 | Corrected compact allocation; background HP60 |
| tablet.png | 1024 x768 | Corrected compact allocation; background HP60 |
| phone-wisdom.png | 390 x844 | Wisdom expanded |
| phone-intelligence.png | 390 x844 | Intelligence expanded |
| before-desktop.png | 1280 x800 | Incoming Gear623 source before |
| before-phone.png | 390 x844 | Incoming Gear623 source before |

The before pair is unchanged from completed final-gear-sandbox. Its actual detached base-worktree HEAD was verified at **6232329243fbea016f8774bd398f02d3be6f1573**, recorded version **0.7.4.209**, recorded digest **ce10b5d42c**. These are **source-tree captures, not compiled209 captures**; no rendered Title ordinal is inferred. See baseline-record.json and the original sandbox source-proof.json.

Final compiled checks: **31/31 capture checks +69/69 targeted pool checks =100/100 PASS**. No console errors, runtime page exceptions or visible broken images. All six selected after PNGs and four committed-point screenshots were visually inspected. Names, descriptions and controls remain separated at all four sizes.

The targeted real UI tests cover separate fresh Constitution and Wisdom allocations on desktop1280x800 and touch phone390x844:
- Initially HUD maximum, Character Sheet summary and HP inspection all show60.
- Constitution1->2 spends the earned point, changes the Sheet to65, and preserves Mana1/Stamina3. Closing the real overlays remounts the room HUD at65; reopening confirms HUD=Sheet65 with zero points remaining.
- Wisdom1->2 spends the earned point while HP remains60 in HUD and Sheet; Mana1/Stamina3 remain unchanged below their threshold. Reopening preserves those values.
- The dimmed room HUD retains its pre-commit60 while the Constitution overlay remains open; the actual room refresh on normal close updates it to65. The record distinguishes immediate, closed and reopened states rather than claiming an immediate hidden-HUD refresh.

Additional screenshots: desktop-constitution-committed.png, desktop-wisdom-committed.png, phone-constitution-committed.png, phone-wisdom-committed.png. MP/SP were checked against the real Character Sheet/resource-inspection receipts; the out-of-combat HUD intentionally shows HP only, so no MP/SP HUD parity claim is made.

The earlier source9d sandbox200PASS/0FAIL is preserved as its own scoped result; it is not relabeled as a source05 sandbox. Genuine archived-profile/Blight/deck/equipment pool cases are covered by the owning model tests reported separately by the root session.

[Feature route](https://cehinds.github.io/AshenSpire/branches/fix/StatAllocationRules/latest/) - this capture record does not claim source05 is already hosted. Hosted208 was independently verified earlier. No new hosted rerun was requested for this batch.

Committed machine-readable records: capture-record.json and baseline-record.json. The detailed pool-parity-record.json and initial pool-harness-initial-strict.json remain in the external QA bundle's final210-pools directory. The initial harness failure was corrected by scoping the active top Character Sheet, with no product change.
