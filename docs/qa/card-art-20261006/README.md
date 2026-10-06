# Full card portrait browser review

Independent review of PR #1656 at `4bfb2be0f2bbec79e463effedebfc80ccaba3100` on 2026-10-06. The final receipt and manifest provenance changes do not change the rendered card source or asset bytes.

The disposable tooltip review gallery used the real shared card renderer with all 220 canonical identities and 17 equipment profiles, in fresh browser profiles. The high-tier desktop viewport was 1440 x 950; the light-tier mobile viewport was 390 x 950. Existing player saves were untouched.

- All 237 exact illustration paths decoded at each viewport.
- Desktop card thumbnails decoded at 512 x 768; mobile twins at 480 x 720.
- Every painting used cover at 50% 65%, with the existing absolute card layers, live rules and costs.
- No horizontal overflow, console exceptions, failed requests or HTTP errors.
- The missing-art handler loaded the outline fallback and restored contain/center behavior on both viewports.

`browser-report.json` records each card and check. `desktop.png` and `mobile.png` show the first visible cards; the report covers the full gallery. This verifies the shared card presentation in a browser, not a complete playthrough or physical touch-device acceptance.
