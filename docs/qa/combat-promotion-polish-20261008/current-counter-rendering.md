# Counter rendering follow-up

- The packaged default-appearance build `0.7.1.1168`, source `2361091aae`, was tested from clean commit `846b3635016599de448b40a361a8fcb6c588de81` with the unchanged full native Counter driver.
  - The first desktop Shield Counter correctly paid 3 SP and 3 Mana, left enemy HP unchanged, and prepared one Counter charge.
  - The strict transient-frame assertion failed: no authored `counter-*` frame was observed before the character settled into `guard-brace` / Counter rest. Remaining shapes and projected co-op cases were not completed.
  - Raw browser health contained only the exact classified activation-policy and optional audio-fallback messages; there were no unexpected entries or runtime errors.
  - Passive RAF observations show a 617.5 ms dispatch delay followed by a 1,149.9 ms sample gap. They demonstrate the skipped presentation, but do not establish an isolated performance benchmark or a specific graphics backend cause. An independently reported accidental About-check browser may have overlapped this run.
- The follow-up adopts the independently reviewed Alternative aura renderer and stage clock already developed on the alternative task branch.
  - Independent source-alpha glows reuse a bounded work surface. First action pixels are materialized before starting the unchanged action clock; queued RAF timestamps cannot move that clock backwards.
  - Saved action restoration retains wall-clock expiry. Disposal ignores late image completions and releases the reusable work surface.
  - Classic appearance returns before allocating an Alternative canvas. Authored artwork, geometry, sequences, durations, and combat rules are unchanged.
  - The original blank-canvas motion mutation now targets the new draw call. Its replacement and expected failure remain unchanged; all 18 same-door mutation plants remain present.
- The combined focused source checks pass 28 tests with zero skips. This is source evidence; a fresh official build and unchanged full native driver are required before acceptance or promotion.
