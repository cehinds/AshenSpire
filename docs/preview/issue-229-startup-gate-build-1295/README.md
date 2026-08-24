# Issue #229 startup-gate evidence

- Base: `dev@13919f3d155928b4540342db54076ef39ee7fe91`
- Built artifact commit: `bfae40093fa1f24b06509c6ffbd94b1a00c01e44`
- Build: `0.4.0.1295 · src 37097fd4c0`
- Artifact: `dist/AshenSpire.html`
- Artifact SHA-256: `a20012fc924c8d9b9eb150b92d4a94e4dc99ebe81c8a34e44db77be3ac6144c5`
- Browser: Google Chrome on Windows, device scale factor 1

## Visually inspected captures

| File | State | SHA-256 |
|---|---|---|
| `startup-1200x730.png` | Built artifact, desktop, keyboard prompt | `6aab6c2c8388fc681e938b744f59a6c89e8dde4f77f84bdc55941a987a8667e1` |
| `startup-390x844.png` | Built artifact, phone | `e9f2d68e737243013c8afd1cb29d4655a33f3d21a220fe28b5afa7b8b1d476d7` |
| `startup-844x344-text-m-keyboard.png` | Short landscape, Text M | `d651aca8bfbe19e75ca66ea11ff4b81a863e37d6193c53b7f252121740b32f70` |
| `startup-390x844-text-xl-touch.png` | Phone, Text XL, touch prompt | `7d668ec8cec924253f48f90a3eff62346bf6476a49fbefd671258a3c4e8b4002` |
| `startup-1200x730-controller.png` | Desktop controller prompt | `75f4951a6f412cfff17262ce6284d43441d2f57cb70fe8fd139b97d9efb34da4` |
| `startup-1200x730-reduced-motion.png` | Desktop reduced motion | `a0d5afd40fc21749391d06fa527045f067b9dc74ebd831587ed2e835a78a328d` |
| `title-after-enter-1200x730.png` | Title after consumed Enter; default slot focused | `6308cda4834524ef86fa75efd2f28df5d963f650ed803ff8809f6b90d88baaac` |

`tools/startup-gate.mjs` separately exercised Click, touch, Enter, Space,
controller buttons 0 and 9, last-input prompts, return-to-title bypass, profile
crisis precedence, deterministic reduced motion, and Text M/XL at 390x844,
844x344, and 1200x730. Result: 32 checks passed; its nine same-door plants
were each observed red and the clean copied tree returned green.
