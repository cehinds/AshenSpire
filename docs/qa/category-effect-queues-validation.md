# Category effect queue validation

- The live standalone preview and Score Studio use the production planner. The browser check verifies the default category order and limits, exact 10 ms start spacing and available 10 ms transition overlap. A busy category waits for capacity, a same-actor burst observes its own limit, and a global limit of one serializes the scenario without changing clip durations.
- The production decorator links support to its healing clip in the stress scenario and One event. The browser verifies that a standalone heal starts on the support clip's last frame and that the busy scenario can delay it until capacity clears.
- The browser check exercises reordering, playback, scrubbing, 80% default opacity, changes to opacity, JSON download, restoring saved values and the legacy timing mode. The same draft survives switching away from the Effects tab, and playback pauses when the tab is hidden.
- The local save endpoint passed five tests. A category edit preserves unrelated bytes and recompiles the generated config. A flat legacy request preserves the existing category settings. Stale revisions, malformed settings and unauthorized requests are rejected. Compiler failure leaves both files intact.
- The sandbox check against `origin/dev` passed 36/36 across 1280 × 800 and 390 × 844, with before and after captures for the standalone editor and Score Studio. Playwright used the installed desktop Chrome because its own headless binary was unavailable.

Run the endpoint suite with `node --test tests/recipient-effects-save.test.mjs` and browser checks with `node tests/recipient-effect-timing-editor.browser.mjs`. Run the visual acceptance with `npm run qa:sandbox -- docs/qa/acceptance.recipient-effects-timing.json --base origin/dev`.
