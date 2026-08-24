# Issue #229 startup-gate evidence

- Base: `dev@13919f3d155928b4540342db54076ef39ee7fe91`
- Built artifact commit: `6a4da5ed16ddc15de414ba5006c03da1cb18ea44`
- Build: `0.4.0.1305 · src 3248caabca`
- Artifact: `dist/AshenSpire.html`
- Artifact SHA-256: `ca8f9168da94d28098e27032d2c9f45dc108bd7039bbb0246c170f233618539e`
- Browser: Google Chrome on Windows, device scale factor 1

## Visually inspected captures

| File | State | SHA-256 |
|---|---|---|
| `startup-1200x730.png` | Built artifact, desktop, keyboard prompt | `209da3a3204b1c9737548d8e934b3385931ae7c73c582133cb8df175ff0b0e5d` |
| `startup-390x844.png` | Built artifact, phone | `c52283199cd916a9f394523d413570b3f4d002b97b2123f47e76d53a5e010cd0` |
| `startup-844x344-text-m-keyboard.png` | Short landscape, Text M | `618efa2357950eb438d602fbc4617d686241f45287a62ad7994a15196f52065f` |
| `startup-390x844-text-xl-touch.png` | Phone, Text XL, touch prompt | `026b7cb0996690abf26a647d1bbb85138130778b3d840d2810fd9de9c2e6472c` |
| `startup-1200x730-controller.png` | Desktop controller prompt | `4250440e66d02cf438a340f5485a56b5c03ae189aa44f834b390fb11c6dd1e16` |
| `startup-1200x730-reduced-motion.png` | Desktop reduced motion | `ef79b1676d821faf4728e36d9ebb9c8d3b33984ca3da36e2730394e47aca4ea0` |
| `title-after-enter-1200x730.png` | Title after consumed Enter; keyboard cursor visible | `6c5b3f4ec0c59ab17f2cf862f1339906e402d01c15f23d4c357e0e5e45d3f49f` |
| `title-after-pointer-1200x730.png` | Title after pointer reveal; DOM focus without gamepad cursor | `a49a1321b58e5f6550330a336a78fad5622b4a83d4c1e89e340f9927d4186974` |

`tools/startup-gate.mjs` separately exercised Click, touch, Enter, Space,
controller buttons 0 and 9, D-pad/analog last-input prompts, pointer/touch focus
without a persistent gamepad cursor, return-to-title bypass, profile
crisis precedence, interrupted-press cancellation, actionable startup semantics,
deterministic reduced-motion reveal cleanup, and Text M/XL at 390x844,
844x344, and 1200x730. Result: 45 checks passed; its 16 same-door plants
were each observed red and the clean copied tree returned green.
