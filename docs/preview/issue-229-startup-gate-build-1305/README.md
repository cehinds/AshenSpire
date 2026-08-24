# Issue #229 startup-gate evidence

- Base: `dev@13919f3d155928b4540342db54076ef39ee7fe91`
- Built artifact commit: `PENDING_FINAL_BUILD_COMMIT`
- Build: `0.4.0.1305 · src PENDING_FINAL_SOURCE_DIGEST`
- Artifact: `dist/AshenSpire.html`
- Artifact SHA-256: `PENDING_FINAL_ARTIFACT_SHA256`
- Browser: Google Chrome on Windows, device scale factor 1

## Visually inspected captures

| File | State | SHA-256 |
|---|---|---|
| `startup-1200x730.png` | Built artifact, desktop, keyboard prompt | `2313911fc41eca2183c6da3f1a06c4171199d07d9096f203549974d3dabcee5b` |
| `startup-390x844.png` | Built artifact, phone | `9edfb83af8f83611bdc1fccada8a89989f81bb6da2e183a01f11a59a4430e399` |
| `startup-844x344-text-m-keyboard.png` | Short landscape, Text M | `4c9fbcb3a7d9cb1f48b0f2a84d96030a49b5a047aa93248ee17fb8e2271ddabc` |
| `startup-390x844-text-xl-touch.png` | Phone, Text XL, touch prompt | `e1739c025fb1544094d84fcbcfccce6d7f3fe2bc60a88b90f9fe0ce4dc87bfc8` |
| `startup-1200x730-controller.png` | Desktop controller prompt | `f44e3974e5b741c2a9a38eb9dc385b555745bbf511d0e75d6a6696c62dc0d319` |
| `startup-1200x730-reduced-motion.png` | Desktop reduced motion | `06cdd98bf9b9e29c6d7d61dc1d7e5b5f50dbdc2bfc60e9b3998ac919af2168ca` |
| `title-after-enter-1200x730.png` | Title after consumed Enter; keyboard cursor visible | `5900178241f72a6fec3cdf81e91cba693c88039ba35e50c768a325548a65ffd1` |
| `title-after-pointer-1200x730.png` | Title after pointer reveal; DOM focus without gamepad cursor | `208a91b489cd5315fe2bfec5fb22c0f8bc32beb1f13dd464b7381948d3bceb00` |

`tools/startup-gate.mjs` separately exercised Click, touch, Enter, Space,
controller buttons 0 and 9, D-pad/analog last-input prompts, pointer/touch focus
without a persistent gamepad cursor, return-to-title bypass, profile
crisis precedence, interrupted-press cancellation, actionable startup semantics,
deterministic reduced-motion reveal cleanup, and Text M/XL at 390x844,
844x344, and 1200x730. Result: 45 checks passed; its 16 same-door plants
were each observed red and the clean copied tree returned green.
