# Single-dagger verification

The gallery was exercised at 1400×1100 and 390×844 in Microsoft Edge through
Playwright and the repository browser launcher. The dedicated browser-plugin
runtime was unavailable, so the installed Playwright runtime was used.

- All 512 WebP frames decoded in the browser.
- Class and outfit selection, action selection, step controls, sequence reorder,
  add/reset, duration editing and mobile overflow checks passed.
- All 35 actual painted runtime stages selected the correct appearance.
- Runtime attack order matched the nine configured steps; guard, cast and buff
  selected DEFEND, CAST and BUFF. Portrait and conversation resolve separately.
- The browser engine harness reported 120 passed, 0 failed, zero console errors.
- Export validation verifies 32 transparent sources, 512 unclipped 512×512 frames,
  exact exported alpha and a shared scale/anchor (maximum rounding error <0.5px).
- Selector tests cover all catalog aliases, both dagger-group items, exclusion of
  dual/reversed hands and other weapon groups, shared timing, and runtime hashes.

Screenshots: [desktop](desktop.png), [phone](mobile.png). Machine-readable results
are alongside this report. This is painted pose matching, not skeletal motion
capture; the same choreography can have small drawn differences among outfits.

Security self-review: no secrets, external services, remote downloads or changes
to equipment legality. The optional preview server listens on loopback only.
No coverage reporter or dedicated linter is configured for this native-module
project; those gates are not applicable (recommend adding them). Repository
assertions, config compilation, syntax checks and whitespace checks are used.
Hosted CI is manually triggered by repository policy; these are local Windows
results, not a cross-platform CI claim.
