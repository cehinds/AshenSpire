# Full combat audit — four viewport capture record

The screenshots show the final primary Quit panel and hidden paused co-op entry.
They were captured from the real production HTML in Chromium, with the title's
authored `?shot=title` saved-run fixture. No screenshot pixels were edited.

- Production source commit: `60e89f5ff8c4763552e62ebaf08830e26461b5b9`.
- Full build: **0.7.1.1530**, light edition; source digest **368140ce27**.
- Packed HTML SHA256: `1d63824ea3d6df48d2909b31b595e48d63e46e2d4322f74e868371b92792c319`.
- Local playable capture route: `http://127.0.0.1:4414/AshenSpire.html?shot=title`.
- Hosted preview: **unverified; the last real hosted proof failed**. Intended public route:
  `https://cehinds.github.io/AshenSpire/branches/feature/FullCombatAudit/latest/`.
  [Proof run 38659820168](https://github.com/cehinds/AshenSpire/actions/runs/38659820168)
  checked source commit `d43f0c143f0be4dd5d751e0248584ed829ee7b0b` on 2026-10-15;
  the route and `build.txt` returned HTTP 404 throughout its twelve-minute wait.
  Its [642-byte diagnostic artifact](https://github.com/cehinds/AshenSpire/actions/runs/38659820168/artifacts/11939036249)
  contains no successful browser proof. This record does not claim the public route works.

| View | Viewport | Capture date (UTC) | Permanent image |
| --- | --- | --- | --- |
| Mobile, emulated touch | 390 × 844 | 2026-10-14 | [menu-phone.png](menu-phone.png) |
| Desktop, mouse | 1280 × 800 | 2026-10-14 | [menu-desktop.png](menu-desktop.png) |
| Wide, mouse | 1920 × 1080 | 2026-10-15 | [menu-wide.png](menu-wide.png) |
| Tablet, emulated touch | 768 × 1024 | 2026-10-15 | [menu-tablet.png](menu-tablet.png) |

The mobile and desktop files reuse the earlier visually inspected captures of
this exact build. Wide and tablet were captured and inspected after the final
combat browser pass. All four show Quit last and reachable within the viewport,
with no co-op entry. Real pointer/touch activation verified the observable
blocked-close message and Return to title; no page errors occurred. The desktop
script-opened window also closed successfully. Touch emulation is not a claim
of physical-device testing.

The snapshot's 857 source inputs reproduce digest `368140ce27`. These images
retain that original identity. The later integration commit
`c54c4728ad2f4c59eea0753ebca6d1f996a0c5af` includes upstream runtime changes;
these captures do not establish the behavior of that newer source.

The [d43 feature build](https://github.com/cehinds/AshenSpire/actions/runs/38659819675)
succeeded and has a [download backup](https://github.com/cehinds/AshenSpire/actions/runs/38659819675/artifacts/11938726789)
(expires 2026-10-29), but it predates those runtime changes. Trusted Pages run
[38662239630](https://github.com/cehinds/AshenSpire/actions/runs/38662239630)
assembled this feature route after the failed hosted proof had ended.
The later [publication run 38676827571](https://github.com/cehinds/AshenSpire/actions/runs/38676827571)
omitted the newer c54 source because it lacked a successful current preview.
A fresh eligible build and real hosted browser proof remain required.

The feature preview folder and marked root README block are temporary review
evidence. Before merging into Dev, remove the block with
`node tools/feature-preview.mjs --remove` and remove only `docs/preview/features/full-combat-audit/`.
The permanent gallery and its viewport capture record remain.
