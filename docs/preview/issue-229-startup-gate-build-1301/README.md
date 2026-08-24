# Issue #229 startup-gate evidence

- Base: `dev@13919f3d155928b4540342db54076ef39ee7fe91`
- Built artifact commit: `900e323ee224866e23a84e44dce2a70eee2dcce5`
- Build: `0.4.0.1301 · src a4f1853380`
- Artifact: `dist/AshenSpire.html`
- Artifact SHA-256: `1a4b1c60c2a2c37d84e85f475cc4bccbdc986a966bfaa3ffa6be89f60cd8a075`
- Browser: Google Chrome on Windows, device scale factor 1

## Visually inspected captures

| File | State | SHA-256 |
|---|---|---|
| `startup-1200x730.png` | Built artifact, desktop, keyboard prompt | `8333ef70403aac32f0e24eda11a984f760d656527814892051f7caa6dd8eb58d` |
| `startup-390x844.png` | Built artifact, phone | `bfe8343fd55bc119dabc55595732252a17c82ae0a37f280731339785aae4983e` |
| `startup-844x344-text-m-keyboard.png` | Short landscape, Text M | `ca2a60371cabe84f3e7711da00f0dbd982617be878db717bcd412203a44440f2` |
| `startup-390x844-text-xl-touch.png` | Phone, Text XL, touch prompt | `85d525c3ed8f3917d3cfb23515e53ebb59584e975ac6bf0b3cf58e84cb874a99` |
| `startup-1200x730-controller.png` | Desktop controller prompt | `c8e4173f82765fc89a7f00da7caa67f29dd8e4a090681c4d667460e3981f742f` |
| `startup-1200x730-reduced-motion.png` | Desktop reduced motion | `ca4d81d6476b2d1d74e8e141437d8485b4e0e86e00ae468e0b7c079185208f34` |
| `title-after-enter-1200x730.png` | Title after consumed Enter; default slot focused | `d6795b48a8545d8cbe6f685789e4f29c58ea18f2ed9c4f5383ad6fa40f66e827` |

`tools/startup-gate.mjs` separately exercised Click, touch, Enter, Space,
controller buttons 0 and 9, last-input prompts, return-to-title bypass, profile
crisis precedence, interrupted-press cancellation, actionable startup semantics,
deterministic reduced-motion reveal cleanup, and Text M/XL at 390x844,
844x344, and 1200x730. Result: 38 checks passed; its 12 same-door plants
were each observed red and the clean copied tree returned green.
