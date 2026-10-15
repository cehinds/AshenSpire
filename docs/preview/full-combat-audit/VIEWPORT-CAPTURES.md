# Full combat audit — four viewport capture record

The screenshots show the final primary Quit panel and hidden paused co-op entry.
They were captured from the real production HTML in Chromium, with the title's
authored `?shot=title` saved-run fixture. No screenshot pixels were edited.

- Production source commit: `60e89f5ff8c4763552e62ebaf08830e26461b5b9`.
- Full build: **0.7.1.1530**, light edition; source digest **368140ce27**.
- Packed HTML SHA256: `1d63824ea3d6df48d2909b31b595e48d63e46e2d4322f74e868371b92792c319`.
- Local playable capture route: `http://127.0.0.1:4414/AshenSpire.html?shot=title`.
- Public route [verified for the frozen production build](https://cehinds.github.io/AshenSpire/branches/feature/FullCombatAudit/latest/) on 2026-10-15 at 08:26 UTC: **0.7.1.1536 / 78492dee2e**, commit `eccdfe210380b12b7b9ec380f83b59bada881690`.
- These four images remain the original **1530 / 368140ce27** captures. [Fresh public menu/Quit captures and exact identity](hosted/README.md) are recorded separately.
- The tooling-only parent correction `d2d02a91fdf59dcd2012aa38a9e86be18e03ac44` starts a fresh normal build/publication/proof. That normal pipeline is pending; the frozen replay is not a claim that it passed.

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
`eccdfe210380b12b7b9ec380f83b59bada881690` includes upstream runtime and HUD changes;
these captures do not establish the behavior of that newer source.

The fresh [feature build 38699427329](https://github.com/cehinds/AshenSpire/actions/runs/38699427329) succeeded for the frozen commit above: **0.7.1.1536 / 78492dee2e**. Its [download backup](https://github.com/cehinds/AshenSpire/actions/runs/38699427329/artifacts/11954559610) expires 2026-10-29; extract `AshenSpire.html`. The real [public replay 38705237731](https://github.com/cehinds/AshenSpire/actions/runs/38705237731) subsequently passed all six wrapper/source/menu/Quit/Return checks with zero runtime page errors. Its [artifact](https://github.com/cehinds/AshenSpire/actions/runs/38705237731/artifacts/11958675887) contains the three actual public screenshots and source report. These are separate from the four 1530 captures above.

Earlier failures remain explicit: [d43 run 38659820168](https://github.com/cehinds/AshenSpire/actions/runs/38659820168) exhausted its twelve-minute wait on HTTP 404; [its 642-byte artifact](https://github.com/cehinds/AshenSpire/actions/runs/38659820168/artifacts/11939036249) is diagnostic only. The normal [eccd proof 38699427242](https://github.com/cehinds/AshenSpire/actions/runs/38699427242) reached the correct public source but failed on Chrome's response-body cache limit before browser checks completed; [artifact 11958190075](https://github.com/cehinds/AshenSpire/actions/runs/38699427242/artifacts/11958190075) preserves that actual tooling failure. The successful frozen replay used bounded 256/512 MiB buffers and the same observed CDP request's bytes.

The feature preview folder and marked root README block are temporary review
evidence. Before merging into Dev, remove the block with
`node tools/feature-preview.mjs --remove` and remove only `docs/preview/features/full-combat-audit/`.
The permanent gallery and its viewport capture record remain.
