# Post-merge effect and CI repair validation

## Full-run browser probe

The normal combat reward can offer a rank-up when the run owns cards below the rank ceiling but none meet the full-upgrade requirement. The picker shows the blocked cards and lets the player cancel. The probe now uses the picker’s enabled footer Cancel in this case. Selecting an enabled card and confirming it still take priority. This is a test-driver correction. Rank-up eligibility and character-level credits are governed by the existing game rules.

- **Baseline `94dbb85acaf`.** Local Chrome, the default FULLRUN1 seed and the pinned v30 art cache reproduced the 90-second wait for rank-up choices. The visible dialog had card inspection controls, header Close and footer Cancel. First combat and console checks passed.
- **Probe correction `dfa0ac7a57c`.** The same real browser run passed 7/7 gates in 96.8 seconds. It traversed 12 map nodes and nine fights, recorded defeat against the Furnace Saint, returned to title and saved a fresh run. No console errors were reported.
- **Driver self-test.** `node tools/full-run-probe.mjs --selftest` passed 51/51. The cases require an enabled rank-up row or commit action to win over Cancel, allow the picker to decline when only Cancel is available, and keep the underlying reward controls shielded when Cancel is unavailable.

## Packed generated data and standalone launch

The compact encoding in `5f7b760d408` reduces generated UI, reviewed artwork metadata and changelog data while preserving the decoded values, key order and deep-freeze behavior. `d1309d3d8d1` updates the equivalence test to use platform path conversion. The standalone Light file measured 15,965,429 characters and 15,980,572 UTF-8 bytes, under the existing 16 MB check.

- Official Chrome source and packed Settings/About probes passed all 1,576 receipts. Direct `file://` launch on both desktop and phone showed the same receipt count with zero uncaught page exceptions.
- The real Chrome Flask plan probe passed 27/27, including the live room rail. The core suite passed 151/151, build-version checks 9/9 and shipped verification 12/12. Code checks passed.
- The final full bundle parse suite and the PR jobs are tracked separately from these completed checks.
